require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');
const nodemailer = require('nodemailer');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const uploadDocs = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg'
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
  
  // Use admin client to create user with auto-confirmation
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Auto-confirm email
  });
  
  if (error) return res.status(400).json({ error: error.message });
  
  if (data.user) {
    // Create profile for the new user
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
    // Use Philippines timezone for date
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const date = format(phTime, 'yyyy-MM-dd');

    // Allow up to 2 check-ins per day (morning + afternoon)
    const { data: existingCheckins, error: existingError } = await supabaseAdmin
      .from('attendance')
      .select('id, time_out')
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
    // Afternoon window baseline: 13:00, late >5min (13:05) deduct 1hr
    const morningBaseline = 8 * 60 + 5;
    const morningLate = 9 * 60;
    const afternoonBaseline = 13 * 60; // 1:00 PM
    const afternoonLateThreshold = 13 * 60 + 5; // 1:05 PM

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
      // Afternoon: late if after 1:05 PM, deduct 1 hour
      if (minutesSinceMidnight > afternoonLateThreshold) {
        lateMinutes = minutesSinceMidnight - afternoonBaseline;
        status = 'Late';
        lateDeduction = 1;
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
  // Use Philippines timezone for date
  const phTime = toZonedTime(new Date(), 'Asia/Manila');
  const today = format(phTime, 'yyyy-MM-dd');
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

  const phTime2 = toZonedTime(new Date(), 'Asia/Manila');
  const otTimeIn = format(phTime2, 'hh:mm a');
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_in: otTimeIn })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/attendance/overtime-out/:id', auth, async (req, res) => {
  const phTime = toZonedTime(new Date(), 'Asia/Manila');
  const otTimeOut = format(phTime, 'hh:mm a');
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
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
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
    console.log('Fetching notifications for user:', req.user.id);
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Notifications fetch error:', error);
      return res.status(500).json({ error: error.message });
    }
    console.log('Notifications fetched:', data?.length || 0);
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

// Admin manual check-in for users
app.post('/api/admin/checkin/:userId', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { time_in, date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert({ 
        user_id: req.params.userId, 
        date: targetDate, 
        time_in, 
        status: 'On-Time',
        late_deduction_hours: 0
      })
      .select()
      .single();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin manual check-out for users
app.put('/api/admin/checkout/:attendanceId', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
    
    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { time_out } = req.body;

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ time_out })
      .eq('id', req.params.attendanceId);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Verify code first
    const { data: codes, error: codeError } = await supabaseAdmin
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (codeError || !codes || codes.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    
    // Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }
    
    // Mark code as used
    await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('id', codes[0].id);
    
    // Send confirmation email
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail({
          from: `"Triple G BuildHub" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Password Reset Successful',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FF7120;">Password Reset Successful</h2>
              <p>Your password has been successfully reset.</p>
              <p>You can now log in with your new password at:</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="display: inline-block; padding: 12px 24px; background: #FF7120; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Login Now
              </a>
              <p style="color: #666; font-size: 14px;">If you didn't request this change, please contact support immediately.</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a verification code will be sent.' });
    }
    
    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store verification code in database (you'll need to create this table)
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_codes')
      .insert({
        email: email,
        code: verificationCode,
        expires_at: expiresAt.toISOString(),
        used: false
      });
    
    if (insertError) {
      console.error('Failed to store verification code:', insertError);
      return res.status(500).json({ error: 'Failed to generate verification code' });
    }
    
    // Send verification code via email
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail({
          from: `"Triple G BuildHub" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Password Reset Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #FF7120;">Password Reset Request</h2>
              <p>You requested to reset your password. Use the verification code below:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                <h1 style="color: #FF7120; font-size: 32px; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
        return res.status(500).json({ error: 'Failed to send verification code' });
      }
    }
    
    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (err) {
    console.error('Forgot password exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    
    // Find valid code
    const { data: codes, error } = await supabaseAdmin
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error || !codes || codes.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    
    res.json({ success: true, message: 'Code verified successfully' });
  } catch (err) {
    console.error('Verify code exception:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
