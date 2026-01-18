require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const uploadDocs = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth session missing!' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Auth session missing!' });
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Auth session missing!' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Auth session missing!' });
  }
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid credentials' });
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', data.user.id)
    .single();
  
  res.json({ 
    token: data.session.access_token, 
    role: profile?.role || 'intern', 
    name: profile?.full_name || data.user.email 
  });
});

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  
  if (data.user) {
    // Use service role to bypass RLS during initial profile creation
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ 
        id: data.user.id, 
        full_name: name, 
        role: 'intern' 
      });
    
    if (profileError) return res.status(500).json({ error: profileError.message });
  }
  
  res.json({ message: 'Account created successfully' });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Google auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({ 
          id: user.id, 
          full_name: user.user_metadata?.full_name || user.email, 
          role: 'intern' 
        });
      if (insertError) {
        console.error('Profile creation error:', insertError);
        return res.status(500).json({ error: insertError.message });
      }
      profile = { full_name: user.user_metadata?.full_name || user.email, role: 'intern' };
    }
    
    res.json({ 
      role: profile.role, 
      name: profile.full_name 
    });
  } catch (err) {
    console.error('Google auth exception:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/attendance/checkin', auth, upload.single('photo'), async (req, res) => {
  try {
    const { time_in } = req.body;
    const date = new Date().toISOString().split('T')[0];

    // Allow up to 2 check-ins per day (morning + afternoon)
    const { data: existingCheckins, error: existingError } = await supabaseAdmin
      .from('attendance')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('date', date);

    if (existingError) {
      console.error('Check existing attendance error:', existingError);
      return res.status(500).json({ error: existingError.message });
    }

    if (existingCheckins && existingCheckins.length >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum of 2 check-ins today.' });
    }

    const openSameDay = existingCheckins?.find(c => !c.time_out);
    if (openSameDay) {
      return res.status(400).json({ error: 'Please check out your current session before checking in again.' });
    }
    
    // Convert AM/PM time to 24-hour for comparison and compute deductions
    const timeIn24 = convertTo24Hour(time_in);
    const [h, m] = timeIn24.split(':').map(v => parseInt(v, 10));
    const minutesSinceMidnight = h * 60 + m;

    // Morning window baseline: 08:05, late <=09:00 deduct 1hr, >=09:00 deduct 2hr
    // Afternoon window baseline: 13:05, late <=14:00 deduct 1hr, >=14:00 deduct 2hr
    const morningBaseline = 8 * 60 + 5;
    const morningLate = 9 * 60;
    const afternoonBaseline = 13 * 60 + 5;
    const afternoonLate = 14 * 60;

    const isMorning = minutesSinceMidnight < 12 * 60;
    let lateDeduction = 0;
    let lateMinutes = 0;
    let status = 'On-Time';

    if (isMorning) {
      if (minutesSinceMidnight > morningBaseline) {
        lateMinutes = minutesSinceMidnight - morningBaseline;
        status = 'Late';
        lateDeduction = minutesSinceMidnight >= morningLate ? 2 : 1;
      }
    } else {
      if (minutesSinceMidnight > afternoonBaseline) {
        lateMinutes = minutesSinceMidnight - afternoonBaseline;
        status = 'Late';
        lateDeduction = minutesSinceMidnight >= afternoonLate ? 2 : 1;
      }
    }
    
    let photoUrl = null;
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${req.user.id}/${uuidv4()}.${fileExt}`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('checkinphoto')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });
      
      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        return res.status(500).json({ error: uploadError.message });
      }
      
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('checkinphoto')
        .getPublicUrl(fileName);
      
      photoUrl = publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert({ 
        user_id: req.user.id, 
        date, 
        time_in, 
        status, 
        photo_path: photoUrl,
        late_deduction_hours: lateDeduction
      })
      .select()
      .single();
    
    if (error) {
      console.error('Checkin error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ id: data.id, status, lateMinutes, lateDeduction });
  } catch (err) {
    console.error('Checkin exception:', err);
    res.status(500).json({ error: err.message });
  }
});

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

app.put('/api/attendance/checkout/:id', auth, uploadDocs.array('attachments', 5), async (req, res) => {
  try {
    const { time_out, work_documentation } = req.body;
    console.log('Checkout request:', { id: req.params.id, time_out, work_documentation, user_id: req.user.id });
    
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Attendance entry not found.' });
    }

    let attachmentUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${req.user.id}/${uuidv4()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from('workdocs')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });
        
        if (uploadError) {
          console.error('File upload error:', uploadError);
          continue;
        }
        
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('workdocs')
          .getPublicUrl(fileName);
        
        attachmentUrls.push(publicUrl);
      }
    }

    const updateData = { time_out, work_documentation };
    if (attachmentUrls.length > 0) {
      updateData.attachments = attachmentUrls;
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) {
      console.error('Checkout error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Checkout exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/overtime-in/:id', auth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  // Require afternoon checkout to be completed
  const { data: afternoon, error: afternoonError } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('date', today)
    .order('time_in', { ascending: false })
    .limit(1)
    .single();

  if (afternoonError || !afternoon || !afternoon.time_out) {
    return res.status(400).json({ error: 'Complete afternoon checkout before starting overtime.' });
  }

  const now = new Date();
  const otTimeIn = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_in: otTimeIn })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/attendance/overtime-out/:id', auth, async (req, res) => {
  const now = new Date();
  const otTimeOut = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_out: otTimeOut })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/interns', auth, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();
  
  if (profile?.role !== 'coordinator')
    return res.status(403).json({ error: 'Access denied' });
  
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, profile_picture')
    .eq('role', 'intern')
    .order('full_name');
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/attendance/my', auth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/attendance/all', auth, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();
  
  if (profile?.role !== 'coordinator')
    return res.status(403).json({ error: 'Access denied' });
  
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select(`
      *,
      profiles!attendance_user_id_fkey(full_name)
    `)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  
  const formatted = data.map(a => ({
    ...a,
    full_name: a.profiles?.full_name
  }));
  
  res.json(formatted);
});

app.get('/api/profile', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    if (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ ...data, email: req.user.email });
  } catch (err) {
    console.error('Profile fetch exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', auth, async (req, res) => {
  const { full_name } = req.body;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name })
    .eq('id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/profile/password', auth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Use admin client to update user password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password }
    );
    
    if (error) {
      console.error('Password update error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Password update exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/picture', auth, upload.single('profile_pic'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    console.log('Profile pic upload:', { userId: req.user.id, fileName: req.file.originalname });
    
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${req.user.id}/profile.${fileExt}`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('profilepicture')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }
    
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('profilepicture')
      .getPublicUrl(fileName);
    
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ profile_picture: publicUrl })
      .eq('id', req.user.id);
    
    if (error) {
      console.error('Database update error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Profile picture uploaded successfully:', publicUrl);
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Profile picture upload exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Todo endpoints
app.get('/api/todos', auth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('todos')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/todos', auth, async (req, res) => {
  const { task } = req.body;
  const { data, error } = await supabaseAdmin
    .from('todos')
    .insert({ user_id: req.user.id, task })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/todos/:id', auth, async (req, res) => {
  const { completed } = req.body;
  const { error } = await supabaseAdmin
    .from('todos')
    .update({ completed })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('todos')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Overtime request endpoints
app.post('/api/overtime', auth, async (req, res) => {
  try {
    const {
      employee_name,
      job_position,
      date_completed,
      department,
      periods = [],
      anticipated_hours,
      explanation,
      employee_signature,
      supervisor_signature,
      management_signature,
      approval_date
    } = req.body;

    if (!employee_name || !job_position) {
      return res.status(400).json({ error: 'Employee name and job position are required.' });
    }

    const safePeriods = Array.isArray(periods)
      ? periods
          .filter(p => p)
          .map(p => ({
            start_date: p.start_date || null,
            end_date: p.end_date || null,
            start_time: p.start_time || null,
            end_time: p.end_time || null
          }))
      : [];

    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .insert({
        user_id: req.user.id,
        employee_name,
        job_position,
        date_completed: date_completed || new Date().toISOString().split('T')[0],
        department: department || null,
        periods: safePeriods,
        anticipated_hours: anticipated_hours || null,
        explanation: explanation || null,
        employee_signature: employee_signature || null,
        supervisor_signature: supervisor_signature || null,
        management_signature: management_signature || null,
        approval_date: approval_date || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('Overtime insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Get all coordinators
    const { data: coordinators } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'coordinator');

    // Create notification for all coordinators
    if (coordinators && coordinators.length > 0) {
      const notifications = coordinators.map(coord => ({
        user_id: coord.id,
        type: 'ot_submitted',
        title: 'New Overtime Request',
        message: `${employee_name} submitted an overtime request.`,
        link: 'overtime-requests'
      }));
      
      console.log('Creating notifications for coordinators:', notifications);
      const { data: notifData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.error('Notification insert error:', notifError);
      } else {
        console.log('Notifications created successfully:', notifData);
      }
    }

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Overtime insert exception:', err);
    res.status(500).json({ error: 'Failed to submit overtime request.' });
  }
});

app.get('/api/overtime/my', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Overtime fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Overtime fetch exception:', err);
    res.status(500).json({ error: 'Failed to load overtime requests.' });
  }
});

app.get('/api/overtime/all', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator')
      return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .select('*, profiles!overtime_requests_user_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Overtime coordinator fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    const formatted = data.map(item => ({
      ...item,
      full_name: item.profiles?.full_name
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Overtime coordinator fetch exception:', err);
    res.status(500).json({ error: 'Failed to load overtime requests.' });
  }
});

app.put('/api/overtime/:id/approve', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      supervisor_signature,
      management_signature,
      approval_date
    } = req.body;

    // Get overtime request details
    const { data: otRequest } = await supabaseAdmin
      .from('overtime_requests')
      .select('user_id, employee_name')
      .eq('id', req.params.id)
      .single();

    const { error } = await supabaseAdmin
      .from('overtime_requests')
      .update({
        supervisor_signature: supervisor_signature || null,
        management_signature: management_signature || null,
        approval_date: approval_date || new Date().toISOString().split('T')[0]
      })
      .eq('id', req.params.id);

    if (error) {
      console.error('Overtime approval update error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Create notification for intern
    if (otRequest?.user_id) {
      console.log('Creating notification for user:', otRequest.user_id);
      const { data: notifData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: otRequest.user_id,
          type: 'ot_approved',
          title: 'Overtime Approved',
          message: 'Your overtime request has been approved by the coordinator.',
          link: 'overtime-status'
        });
      
      if (notifError) {
        console.error('Notification insert error:', notifError);
      } else {
        console.log('Notification created successfully:', notifData);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Overtime approval exception:', err);
    res.status(500).json({ error: 'Failed to update overtime approval.' });
  }
});

// Notification endpoints
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('Notifications fetch exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notification read exception:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
