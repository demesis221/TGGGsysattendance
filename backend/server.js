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

// Notification helper function
const createNotification = async (userId, type, title, message, link = null) => {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link
    });
  } catch (err) {
    console.error('Notification creation failed:', err);
  }
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid credentials' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, verification_status, is_employee_or_trainee')
    .eq('id', data.user.id)
    .single();

  if (profile?.is_employee_or_trainee && profile?.verification_status !== 'approved') {
    const message = profile.verification_status === 'declined'
      ? 'Your signup was declined. Please contact the coordinator for help.'
      : 'Your account is pending for verification, cannot login.';
    return res.status(403).json({ error: message });
  }

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
    // All new accounts require verification
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: name,
        role: 'intern',
        verification_status: 'pending',
        is_employee_or_trainee: true
      });

    if (profileError) return res.status(500).json({ error: profileError.message });

    // Add to pending verifications
    const { error: pendingError } = await supabaseAdmin
      .from('pending_verifications')
      .upsert({
        user_id: data.user.id,
        full_name: name,
        email,
        reason_for_request: 'New account verification'
      });

    if (pendingError) return res.status(500).json({ error: pendingError.message });
  }

  res.json({ message: 'Signup submitted for coordinator verification.' });
});

// Verification queue for coordinators
app.get('/api/verifications/pending', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabaseAdmin
      .from('pending_verifications')
      .select('id, user_id, full_name, email, reason_for_request, created_at, action')
      .is('action', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Pending verifications fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('Pending verifications exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verifications/:id/decision', auth, async (req, res) => {
  try {
    const { action, department } = req.body;
    if (!['approved', 'declined'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (action === 'approved' && !department?.trim()) {
      return res.status(400).json({ error: 'Department is required for approval' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: pending, error: fetchError } = await supabaseAdmin
      .from('pending_verifications')
      .select('user_id, email, full_name')
      .eq('id', req.params.id)
      .is('action', null)
      .single();

    if (fetchError || !pending) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const profileUpdateData = { verification_status: action };
    if (action === 'approved') {
      profileUpdateData.department = department.trim();
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', pending.user_id);

    if (profileUpdateError) {
      console.error('Verification profile update error:', profileUpdateError);
      return res.status(500).json({ error: profileUpdateError.message });
    }

    const { error: pendingUpdateError } = await supabaseAdmin
      .from('pending_verifications')
      .update({
        action,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.user.id
      })
      .eq('id', req.params.id);

    if (pendingUpdateError) {
      console.error('Pending verification update error:', pendingUpdateError);
      return res.status(500).json({ error: pendingUpdateError.message });
    }

    // Send email notification to user
    try {
      const emailSubject = action === 'approved' 
        ? 'Account Approved - Triple G BuildHub'
        : 'Account Verification Update - Triple G BuildHub';

      const emailBody = action === 'approved'
        ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF7120;">Account Approved!</h2>
            <p>Hello ${pending.full_name},</p>
            <p>Great news! Your account has been approved by a coordinator.</p>
            <p>You can now log in to your account and start using the Triple G BuildHub attendance system.</p>
            <p><strong>Next steps:</strong></p>
            <ul>
              <li>Log in with your email and password</li>
              <li>Complete your profile information</li>
              <li>Start tracking your attendance</li>
            </ul>
            <p style="margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="background-color: #FF7120; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Log In Now
              </a>
            </p>
            <p style="color: #666; margin-top: 30px;">
              If you have any questions, please contact your coordinator.
            </p>
          </div>
        `
        : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF7120;">Account Verification Update</h2>
            <p>Hello ${pending.full_name},</p>
            <p>We regret to inform you that your account verification request has been declined.</p>
            <p>If you believe this is an error or need more information, please contact your coordinator for assistance.</p>
            <p style="color: #666; margin-top: 30px;">
              Thank you for your understanding.
            </p>
          </div>
        `;

      await transporter.sendMail({
        from: `"Triple G BuildHub" <${process.env.SMTP_USER}>`,
        to: pending.email,
        subject: emailSubject,
        html: emailBody
      });

      console.log(`Verification email sent to ${pending.email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Verification decision exception:', err);
    res.status(500).json({ error: err.message });
  }
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
    // Overtime window baseline: 19:05 (7:05 PM), late after 19:05 deduct 1hr
    // Session baselines (5-minute grace period)
    const morningBaseline = 8 * 60; // 8:00 AM
    const morningGrace = 8 * 60 + 5; // 8:05 AM
    const afternoonBaseline = 13 * 60; // 1:00 PM
    const afternoonGrace = 13 * 60 + 5; // 1:05 PM
    const overtimeBaseline = 19 * 60; // 7:00 PM
    const overtimeGrace = 19 * 60 + 5; // 7:05 PM

    const isMorning = minutesSinceMidnight < 12 * 60;
    const isAfternoon = minutesSinceMidnight >= 12 * 60 && minutesSinceMidnight < 18 * 60;
    const isOvertime = minutesSinceMidnight >= 18 * 60;

    let lateMinutes = 0;
    let status = 'On-Time';

    // Calculate late minutes (total late time for this session)
    // Only deduct if late time exceeds 5 minutes grace period
    if (isMorning) {
      if (minutesSinceMidnight > morningGrace) {
        lateMinutes = minutesSinceMidnight - morningGrace;
        status = 'Late';
      }
    } else if (isAfternoon) {
      if (minutesSinceMidnight > afternoonGrace) {
        lateMinutes = minutesSinceMidnight - afternoonGrace;
        status = 'Late';
      }
    } else if (isOvertime) {
      if (minutesSinceMidnight > overtimeGrace) {
        lateMinutes = minutesSinceMidnight - overtimeGrace;
        status = 'Late';
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
        late_minutes: lateMinutes
      })
      .select()
      .single();

    if (error) {
      console.error('Checkin error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ id: data.id, status, lateMinutes });
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
    const { actual_time_out, work_documentation } = req.body;
    console.log('Checkout request:', { id: req.params.id, actual_time_out, work_documentation, user_id: req.user.id });

    const { data: entry, error: entryError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Attendance entry not found.' });
    }

    // Determine session and calculate early checkout deduction
    const timeIn24 = convertTo24Hour(entry.time_in);
    const actualTimeOut24 = convertTo24Hour(actual_time_out);
    const [hIn, mIn] = timeIn24.split(':').map(v => parseInt(v, 10));
    const [hOut, mOut] = actualTimeOut24.split(':').map(v => parseInt(v, 10));
    const checkInMinutes = hIn * 60 + mIn;
    const checkOutMinutes = hOut * 60 + mOut;

    let standardCheckoutMinutes;
    let baselineStartMinutes;

    if (checkInMinutes < 12 * 60) {
      // Morning session - baseline 8:00 AM, standard checkout 12:00 PM
      baselineStartMinutes = 8 * 60;
      standardCheckoutMinutes = 12 * 60;
    } else if (checkInMinutes >= 12 * 60 && checkInMinutes < 18 * 60) {
      // Afternoon session - baseline 1:00 PM, standard checkout 5:00 PM
      baselineStartMinutes = 13 * 60;
      standardCheckoutMinutes = 17 * 60;
    } else {
      // Overtime session - baseline 7:00 PM, standard checkout 10:00 PM
      baselineStartMinutes = 19 * 60;
      standardCheckoutMinutes = 22 * 60;
    }

    // Calculate total hours worked from BASELINE to checkout (capped at 4 hours per session)
    // This ensures: Morning 8AM-12PM (4h), Afternoon 1PM-5PM (4h), OT 7PM-10PM (3h)
    let totalMinutesWorked = Math.min(checkOutMinutes, standardCheckoutMinutes) - baselineStartMinutes;
    if (totalMinutesWorked < 0) totalMinutesWorked = 0; // Prevent negative
    
    // Cap at maximum session duration
    const maxSessionMinutes = checkInMinutes < 12 * 60 ? 240 : (checkInMinutes < 18 * 60 ? 240 : 180); // 4h morning/afternoon, 3h OT
    totalMinutesWorked = Math.min(totalMinutesWorked, maxSessionMinutes);

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

    const updateData = {
      time_out: actual_time_out,
      total_minutes_worked: totalMinutesWorked,
      work_documentation
    };
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
    res.json({ success: true, totalMinutesWorked });
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
    .select('id, full_name, profile_picture, is_leader, additional_hours')
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

// ====== GROUP MANAGEMENT ENDPOINTS ======

// Get all groups (for coordinators/leaders)
app.get('/api/groups', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    let query = supabaseAdmin
      .from('groups')
      .select(`
        *,
        leader:profiles!groups_leader_id_fkey(id, full_name),
        members:group_members(
          user_id,
          user:profiles(id, full_name)
        )
      `);

    // If not coordinator, only show groups where user is leader or member
    if (profile?.role !== 'coordinator') {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', req.user.id)
        .single();

      const { data: leaderGroups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('leader_id', req.user.id);

      const groupIds = [
        ...(membership ? [membership.group_id] : []),
        ...(leaderGroups?.map(g => g.id) || [])
      ];

      if (groupIds.length === 0) {
        return res.json([]);
      }
      query = query.in('id', groupIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new group (coordinators or leaders only)
app.post('/api/groups', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && !profile?.is_leader) {
      return res.status(403).json({ error: 'Only coordinators or leaders can create groups' });
    }

    const { name, description, leader_id } = req.body;
    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert({
        name,
        description,
        leader_id: leader_id || req.user.id,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
app.put('/api/groups/:id', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, leader_id } = req.body;
    const { error } = await supabaseAdmin
      .from('groups')
      .update({ name, description, leader_id })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group (coordinators or group leader)
app.delete('/api/groups/:id', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isGroupLeader = group?.leader_id === req.user.id;

    if (!isCoordinator && !isGroupLeader) {
      return res.status(403).json({ error: 'Only coordinators or group leaders can delete groups' });
    }

    const { error } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add member to group
app.post('/api/groups/:id/members', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only leaders or coordinators can add members' });
    }

    const { user_id } = req.body;

    // Check if user is already in a group
    const { data: existingMembership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', user_id)
      .single();

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of another group' });
    }

    const { data, error } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: req.params.id, user_id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove member from group
app.delete('/api/groups/:id/members/:userId', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only leaders or coordinators can remove members' });
    }

    const { error } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', req.params.id)
      .eq('user_id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available users (not in any group) - for adding to groups
app.get('/api/users/available', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && !profile?.is_leader) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all interns not in any group
    const { data: allInterns } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_leader')
      .eq('role', 'intern');

    const { data: groupMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id');

    const memberIds = groupMembers?.map(m => m.user_id) || [];
    const availableUsers = allInterns?.filter(u => !memberIds.includes(u.id)) || [];

    res.json(availableUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign leader role to an intern (coordinators only)
app.post('/api/users/:userId/make-leader', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Only coordinators can assign leaders' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_leader: true })
      .eq('id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove leader role from an intern (coordinators only)
app.post('/api/users/:userId/remove-leader', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Only coordinators can remove leaders' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_leader: false })
      .eq('id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all interns (for coordinators to assign leaders)
app.get('/api/users/interns', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, is_leader')
      .eq('role', 'intern')
      .order('full_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== TODO ENDPOINTS ======

// Get all todos (filtered by type)
app.get('/api/todos', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    // Get user's group membership
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', req.user.id)
      .single();

    // Get groups where user is leader
    const { data: leaderGroups } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('leader_id', req.user.id);

    const leaderGroupIds = leaderGroups?.map(g => g.id) || [];

    let query = supabaseAdmin
      .from('todos')
      .select(`
        *,
        creator:profiles!todos_user_id_fkey(id, full_name),
        assignee:profiles!todos_assigned_to_fkey(id, full_name),
        assigner:profiles!todos_assigned_by_fkey(id, full_name),
        suggester:profiles!todos_suggested_by_fkey(id, full_name),
        group:groups(id, name)
      `);

    if (type) {
      if (type === 'personal') {
        query = query.eq('todo_type', 'personal').eq('user_id', req.user.id);
      } else if (type === 'group') {
        // GROUP TAB (Leaders only): Show pending suggestions + pending completions
        // Only accessible to leaders
        console.log('Group tab requested by user:', req.user.id);
        console.log('Profile is_leader:', profile?.is_leader);
        console.log('Leader group IDs:', leaderGroupIds);

        if (!profile?.is_leader && leaderGroupIds.length === 0) {
          console.log('User is not a leader, returning empty array');
          return res.json([]);
        }

        const groupIds = leaderGroupIds;
        if (groupIds.length === 0) {
          console.log('No leader group IDs found, returning empty array');
          return res.json([]);
        }

        console.log('Fetching pending suggestions for groups:', groupIds);

        // Get unconfirmed group todos (pending suggestions)
        const { data: pendingSuggestions, error: suggestError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('is_confirmed', false)
          .order('created_at', { ascending: false });

        console.log('Pending suggestions found:', pendingSuggestions?.length || 0);
        if (suggestError) console.log('Suggest error:', suggestError);

        if (suggestError) return res.status(500).json({ error: suggestError.message });

        // Get pending completion todos (awaiting leader approval)
        const { data: pendingCompletion, error: pendingError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('pending_completion', true)
          .eq('completed', false)
          .order('created_at', { ascending: false });

        if (pendingError) return res.status(500).json({ error: pendingError.message });

        // Also get assigned tasks with pending completion for this group's members
        const { data: groupMembers } = await supabaseAdmin
          .from('group_members')
          .select('user_id')
          .in('group_id', groupIds);

        // Include the leader (req.user.id) in the member list
        const memberIds = [...(groupMembers?.map(m => m.user_id) || []), req.user.id];
        let assignedPending = [];
        let allAssignedTasks = [];

        if (memberIds.length > 0) {
          // Get pending completion assigned tasks
          const { data: assigned, error: assignedError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .eq('pending_completion', true)
            .eq('completed', false)
            .order('created_at', { ascending: false });

          if (!assignedError && assigned) {
            assignedPending = assigned;
          }

          // Also get ALL assigned tasks (for member stats calculation)
          const { data: allAssigned } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .eq('assigned_by', req.user.id)
            .order('created_at', { ascending: false });

          if (allAssigned) {
            allAssignedTasks = allAssigned;
          }
        }

        // Combine: pending suggestions + pending completions + all assigned tasks (for stats)
        // Note: allAssignedTasks may have duplicates with assignedPending, frontend will dedupe
        const allTodos = [...(pendingSuggestions || []), ...(pendingCompletion || []), ...assignedPending, ...allAssignedTasks]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Remove duplicates by id
        const uniqueTodos = [...new Map(allTodos.map(item => [item.id, item])).values()];

        return res.json(uniqueTodos);
      } else if (type === 'team') {
        // TEAM TAB (All members): Show confirmed ongoing + completed tasks
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];

        if (groupIds.length === 0) {
          return res.json([]);
        }

        // Get confirmed group todos (ongoing and completed)
        const { data: confirmedTodos, error: confirmedError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('is_confirmed', true)
          .order('created_at', { ascending: false });

        if (confirmedError) return res.status(500).json({ error: confirmedError.message });

        // Get assigned tasks for group members
        const { data: groupMembers } = await supabaseAdmin
          .from('group_members')
          .select('user_id')
          .in('group_id', groupIds);

        // Fetch leaders for these groups to include them
        const { data: groupsData } = await supabaseAdmin
          .from('groups')
          .select('leader_id')
          .in('id', groupIds);

        const groupLeaderIds = groupsData?.map(g => g.leader_id) || [];

        const memberIds = [
          ...(groupMembers?.map(m => m.user_id) || []),
          ...groupLeaderIds
        ];

        let assignedTodos = [];
        if (memberIds.length > 0) {
          const { data: assigned, error: assignedError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .order('created_at', { ascending: false });

          if (!assignedError && assigned) {
            assignedTodos = assigned;
          }
        }

        // Combine and sort
        const allTodos = [...(confirmedTodos || []), ...assignedTodos]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json(allTodos);
      } else if (type === 'assigned') {
        // Show assigned todos + confirmed group todos for user's groups
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];

        // We need to fetch both assigned todos and confirmed group todos
        // First get assigned todos
        const { data: assignedTodos, error: assignedError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'assigned')
          .or(`assigned_to.eq.${req.user.id},assigned_by.eq.${req.user.id}`)
          .order('created_at', { ascending: false });

        if (assignedError) return res.status(500).json({ error: assignedError.message });

        // Then get confirmed group todos if user is in a group
        let confirmedGroupTodos = [];
        if (groupIds.length > 0) {
          const { data: groupTodos, error: groupError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'group')
            .eq('is_confirmed', true)
            .in('group_id', groupIds)
            .order('created_at', { ascending: false });

          if (groupError) return res.status(500).json({ error: groupError.message });
          confirmedGroupTodos = groupTodos || [];
        }

        // Combine and sort by created_at
        const allTodos = [...(assignedTodos || []), ...confirmedGroupTodos]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json(allTodos);
      } else if (type === 'global') {
        // Global tab shows: global todos + confirmed group todos (not completed) + assigned tasks (not completed)
        // Exclude: personal, unconfirmed group, completed tasks
        query = query.or('todo_type.eq.global,and(todo_type.eq.group,is_confirmed.eq.true,completed.eq.false),and(todo_type.eq.assigned,completed.eq.false)');
      } else if (type === 'coordinator_overview') {
        // Coordinator Panel: Show ALL assigned tasks + ALL confirmed group tasks
        if (profile?.role !== 'coordinator') {
          return res.status(403).json({ error: 'Access denied' });
        }

        // We can't easily express "ALL assigned OR (group AND confirmed)" with a single supabase OR query because of the mixed logic on is_confirmed
        // But we can use: type=assigned OR (type=group AND is_confirmed=true)
        // using query.or allows comma separated conditions.

        query = query.or('todo_type.eq.assigned,and(todo_type.eq.group,is_confirmed.eq.true)');
      }
    } else {
      // No type filter - get all accessible todos
      // Build OR conditions for accessible todos
      const orConditions = [
        `todo_type.eq.personal,user_id.eq.${req.user.id}`,
        'todo_type.eq.global'
      ];

      if (membership || leaderGroupIds.length > 0) {
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];
        orConditions.push(`todo_type.eq.group,group_id.in.(${groupIds.join(',')})`);
      }

      orConditions.push(`todo_type.eq.assigned,assigned_to.eq.${req.user.id}`);
      orConditions.push(`todo_type.eq.assigned,assigned_by.eq.${req.user.id}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
app.post('/api/todos', auth, async (req, res) => {
  try {
    const { task, description, todo_type = 'personal', group_id, assigned_to, start_date, deadline } = req.body;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    const todoData = {
      user_id: req.user.id,
      task,
      todo_type,
      is_confirmed: true // Default to confirmed for personal todos
    };

    // Add description if provided
    if (description) todoData.description = description;

    // Add dates if provided (valid for all types, but specifically requested for personal)
    if (start_date) todoData.start_date = start_date;
    if (deadline) todoData.deadline = deadline;

    // Handle different todo types
    if (todo_type === 'global') {
      // Only coordinators can create global todos
      if (profile?.role !== 'coordinator') {
        return res.status(403).json({ error: 'Only coordinators can create global todos' });
      }
    } else if (todo_type === 'group') {
      // Anyone in the group can suggest, but needs leader confirmation
      if (!group_id) {
        return res.status(400).json({ error: 'Group ID is required for group todos' });
      }

      // Check if user is member or leader of this group
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('leader_id')
        .eq('id', group_id)
        .single();

      const isLeader = group?.leader_id === req.user.id;

      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', req.user.id)
        .single();

      if (!isLeader && !membership) {
        return res.status(403).json({ error: 'You must be a member of this group' });
      }

      todoData.group_id = group_id;
      todoData.suggested_by = req.user.id;
      todoData.is_confirmed = isLeader; // Auto-confirm if created by leader
      console.log('Creating group todo:', { group_id, suggested_by: req.user.id, is_confirmed: isLeader, isLeader });

      // Notify leader if member suggests a task
      if (!isLeader && group?.leader_id) {
        const { data: suggester } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', req.user.id)
          .single();

        const taskTitle = task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
        
        await createNotification(
          group.leader_id,
          'group_task_suggested',
          'New Team Task Suggestion',
          `${suggester?.full_name || 'A member'} suggested a task: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
          'todos:team:manage'
        );
      }
    } else if (todo_type === 'assigned') {
      // Only leaders or coordinators can assign tasks
      const isCoordinator = profile?.role === 'coordinator';
      const isLeaderProfile = profile?.is_leader === true;

      if (!isCoordinator && !isLeaderProfile) {
        return res.status(403).json({ error: 'Only leaders or coordinators can assign tasks' });
      }
      if (!assigned_to) {
        return res.status(400).json({ error: 'Assignee is required for assigned todos' });
      }

      // Leaders can always assign to themselves, otherwise check group membership
      const isSelfAssign = String(assigned_to) === String(req.user.id);

      if (isLeaderProfile && !isCoordinator && !isSelfAssign) {
        // Only check group membership if assigning to someone else
        const { data: leaderGroups } = await supabaseAdmin
          .from('groups')
          .select('id')
          .eq('leader_id', req.user.id);

        const leaderGroupIds = leaderGroups?.map(g => g.id) || [];

        const { data: assigneeMembership } = await supabaseAdmin
          .from('group_members')
          .select('group_id')
          .eq('user_id', assigned_to)
          .single();

        if (!assigneeMembership || !leaderGroupIds.includes(assigneeMembership.group_id)) {
          return res.status(403).json({ error: 'You can only assign tasks to members of your group' });
        }
      }

      todoData.assigned_to = assigned_to;
      todoData.assigned_by = req.user.id;
      todoData.is_confirmed = true;
      todoData.date_assigned = new Date().toISOString();

      // Add start_date and deadline if provided
      if (start_date) todoData.start_date = start_date;
      if (deadline) todoData.deadline = deadline;
    }

    const { data, error } = await supabaseAdmin
      .from('todos')
      .insert(todoData)
      .select(`
        *,
        creator:profiles!todos_user_id_fkey(id, full_name),
        assignee:profiles!todos_assigned_to_fkey(id, full_name),
        assigner:profiles!todos_assigned_by_fkey(id, full_name),
        group:groups(id, name)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Create notification for assigned task
    if (todoData.todo_type === 'assigned' && todoData.assigned_to) {
      const { data: assigner } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', req.user.id)
        .single();
      
      // Extract task title (remove date prefix if exists)
      const taskTitle = task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
      
      await createNotification(
        todoData.assigned_to,
        'task_assigned',
        'New Task Assigned',
        `${assigner?.full_name || 'Someone'} assigned you: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
        'todos:team'
      );
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update todo (mark complete, edit task)
app.put('/api/todos/:id', auth, async (req, res) => {
  try {
    const { completed, task, is_confirmed } = req.body;
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isOwner = todo.user_id === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;
    const isAssigner = todo.assigned_by === req.user.id;
    const isAssignee = todo.assigned_to === req.user.id;

    // Check permissions based on todo type
    let canUpdate = false;
    let updateData = {};

    if (todo.todo_type === 'personal') {
      canUpdate = isOwner;
      if (canUpdate) updateData = { completed, task };
    } else if (todo.todo_type === 'global') {
      canUpdate = isCoordinator;
      if (canUpdate) updateData = { completed, task };
    } else if (todo.todo_type === 'group') {
      // Check if user is a member of this group
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', todo.group_id)
        .eq('user_id', req.user.id)
        .single();

      const isGroupMember = !!membership;

      if (isGroupLeader || isCoordinator) {
        // Leaders can directly complete/edit group todos
        canUpdate = true;
        updateData = { completed, task, is_confirmed, pending_completion: false };
      } else if (isGroupMember && todo.is_confirmed) {
        // Group members can request completion for confirmed group todos
        canUpdate = true;
        if (completed === true && !todo.completed) {
          // Member requests completion - needs leader approval
          updateData = { pending_completion: true };
        } else if (completed === false) {
          // Member can uncheck pending_completion
          updateData = { pending_completion: false };
        }
      }
    } else if (todo.todo_type === 'assigned') {
      // Self-assigned tasks (leader assigned to themselves) can be completed directly
      const isSelfAssigned = todo.assigned_to === todo.assigned_by;

      if (isSelfAssigned && isAssignee) {
        // Leader completing their own self-assigned task - no approval needed
        canUpdate = true;
        updateData = { completed, task, pending_completion: false };
      } else if (isAssignee && !isAssigner && !isCoordinator) {
        canUpdate = true;
        // If assignee tries to mark complete, set pending_completion instead
        if (completed === true && !todo.completed) {
          updateData = { pending_completion: true };
        } else if (completed === false) {
          // Assignee can uncheck pending_completion
          updateData = { pending_completion: false };
        }
      } else if (isAssigner || isCoordinator) {
        canUpdate = true;
        updateData = { completed, task, pending_completion: false };
      }
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const { error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Create notification when completion is pending
    if (completed === true && !todo.completed && updateData.pending_completion) {
      const notifyUserId = todo.assigned_by || todo.group?.leader_id;
      if (notifyUserId) {
        const { data: assignee } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', req.user.id)
          .single();
        
        const taskTitle = todo.task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
        
        await createNotification(
          notifyUserId,
          'task_pending_completion',
          'Task Completion Approval Pending',
          `${assignee?.full_name || 'Someone'} submitted task for approval: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
          'todos:team:manage'
        );
      }
    }

    // Create notification when self-assigned task is completed directly
    if (completed === true && !todo.completed && !updateData.pending_completion && todo.todo_type === 'assigned') {
      const isSelfAssigned = todo.assigned_to === todo.assigned_by;
      if (isSelfAssigned && isAssignee) {
        const { data: assignee } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', req.user.id)
          .single();
        
        const taskTitle = todo.task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
        
        await createNotification(
          req.user.id,
          'task_completion_confirmed',
          'Task Completed',
          `You completed: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
          'todos:team'
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm group todo (leaders only) - with assignment details
app.post('/api/todos/:id/confirm', auth, async (req, res) => {
  try {
    const { start_date, deadline, assigned_to, task, description } = req.body;

    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || todo.todo_type !== 'group') {
      return res.status(404).json({ error: 'Group todo not found' });
    }

    if (todo.group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the group leader can confirm todos' });
    }

    // Build update data
    const updateData = {
      is_confirmed: true,
      date_assigned: new Date().toISOString()
    };

    // Optional fields that leader can set/modify
    if (start_date) updateData.start_date = start_date;
    if (deadline) updateData.deadline = deadline;
    if (task) updateData.task = task;
    if (description !== undefined) updateData.description = description;

    // If assigning to someone, change todo_type to 'assigned' and set assigned_to/assigned_by
    if (assigned_to) {
      updateData.todo_type = 'assigned';
      updateData.assigned_to = assigned_to;
      updateData.assigned_by = req.user.id;
      // Clear group_id since it's now an assigned task (to avoid constraint violation)
      updateData.group_id = null;
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Notify suggestor about confirmation
    if (todo.suggested_by) {
      const taskTitle = (task || todo.task).replace(/^\[.*?\]\s*/, '').substring(0, 60);
      
      await createNotification(
        todo.suggested_by,
        'group_task_confirmed',
        'Team Task Approved',
        `Leader approved your suggestion: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
        'todos:team'
      );
    }

    // Notify assignee if task was assigned to someone (even if they're the suggestor)
    if (assigned_to) {
      const taskTitle = (task || todo.task).replace(/^\[.*?\]\s*/, '').substring(0, 60);
      const isSelfAssign = assigned_to === req.user.id;
      
      await createNotification(
        assigned_to,
        'task_assigned',
        'Task Assigned to You',
        isSelfAssign 
          ? `You assigned yourself a task: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"` 
          : `Leader assigned you a task: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
        'todos:team'
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm completion of assigned or group task (leader/assigner only)
app.post('/api/todos/:id/confirm-completion', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || (todo.todo_type !== 'assigned' && todo.todo_type !== 'group')) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (!todo.pending_completion) {
      return res.status(400).json({ error: 'This task is not pending completion' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isAssigner = todo.assigned_by === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;

    // For assigned todos: assigner or coordinator can confirm
    // For group todos: group leader or coordinator can confirm
    const canConfirm = isCoordinator ||
      (todo.todo_type === 'assigned' && isAssigner) ||
      (todo.todo_type === 'group' && isGroupLeader);

    if (!canConfirm) {
      return res.status(403).json({ error: 'Only the leader or coordinator can confirm completion' });
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update({ completed: true, pending_completion: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Create notification for completion approval
    const taskTitle = todo.task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
    
    await createNotification(
      todo.assigned_to || todo.user_id,
      'task_completion_confirmed',
      'Task Approved',
      `Your task completion was approved: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
      'todos:team'
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject completion of assigned or group task (leader/assigner only)
app.post('/api/todos/:id/reject-completion', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || (todo.todo_type !== 'assigned' && todo.todo_type !== 'group')) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (!todo.pending_completion) {
      return res.status(400).json({ error: 'This task is not pending completion' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isAssigner = todo.assigned_by === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;

    // For assigned todos: assigner or coordinator can reject
    // For group todos: group leader or coordinator can reject
    const canReject = isCoordinator ||
      (todo.todo_type === 'assigned' && isAssigner) ||
      (todo.todo_type === 'group' && isGroupLeader);

    if (!canReject) {
      return res.status(403).json({ error: 'Only the leader or coordinator can reject completion' });
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update({ pending_completion: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    // Create notification for completion rejection
    const taskTitle = todo.task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
    
    await createNotification(
      todo.assigned_to || todo.user_id,
      'task_completion_rejected',
      'Task Rejected',
      `Your task completion needs revision: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
      'todos:team'
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete todo
app.delete('/api/todos/:id', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isOwner = todo.user_id === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;
    const isAssigner = todo.assigned_by === req.user.id;

    let canDelete = false;

    if (todo.todo_type === 'personal') {
      canDelete = isOwner;
    } else if (todo.todo_type === 'global') {
      canDelete = isCoordinator;
    } else if (todo.todo_type === 'group') {
      canDelete = isGroupLeader || isCoordinator;
    } else if (todo.todo_type === 'assigned') {
      canDelete = isAssigner || isCoordinator;
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Notify suggestor if their suggestion is rejected (deleted before confirmation)
    if (todo.todo_type === 'group' && !todo.is_confirmed && todo.suggested_by) {
      const taskTitle = todo.task.replace(/^\[.*?\]\s*/, '').substring(0, 60);
      
      await createNotification(
        todo.suggested_by,
        'group_task_rejected',
        'Team Task Declined',
        `Leader declined your suggestion: "${taskTitle}${taskTitle.length >= 60 ? '...' : ''}"`,
        'todos:team'
      );
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

app.get('/api/overtime/my-approved', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .not('supervisor_signature', 'is', null)
      .order('date', { ascending: false });

    if (error) {
      console.error('Approved overtime fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    const approvedOTs = data.map(ot => ({
      ...ot,
      status: 'approved'
    }));

    res.json(approvedOTs);
  } catch (err) {
    console.error('Approved overtime fetch exception:', err);
    res.status(500).json({ error: 'Failed to load approved overtime requests.' });
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

// Mark all notifications as read
app.put('/api/notifications/read-all', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all notifications read exception:', err);
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
        late_minutes: 0
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

// ====== DEPARTMENT TASKS ENDPOINTS ======

// Get department tasks
app.get('/api/department-tasks', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('department')
      .eq('id', req.user.id)
      .single();

    if (!profile?.department) {
      return res.json([]);
    }

    const { data, error } = await supabaseAdmin
      .from('department_tasks')
      .select(`
        *,
        suggester:profiles!department_tasks_suggested_by_fkey(id, full_name),
        grabber:profiles!department_tasks_grabbed_by_fkey(id, full_name),
        completer:profiles!department_tasks_completed_by_fkey(id, full_name)
      `)
      .eq('department', profile.department)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Suggest department task
app.post('/api/department-tasks', auth, async (req, res) => {
  try {
    const { task, description, deadline, priority } = req.body;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('department, full_name')
      .eq('id', req.user.id)
      .single();

    if (!profile?.department) {
      return res.status(400).json({ error: 'You must be assigned to a department' });
    }

    const { data, error } = await supabaseAdmin
      .from('department_tasks')
      .insert({
        task,
        description,
        department: profile.department,
        suggested_by: req.user.id,
        deadline,
        priority,
        status: 'suggested'
      })
      .select(`
        *,
        suggester:profiles!department_tasks_suggested_by_fkey(id, full_name)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Notify all department members
    const { data: deptMembers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('department', profile.department)
      .neq('id', req.user.id);

    if (deptMembers && deptMembers.length > 0) {
      const taskTitle = task.substring(0, 60);
      for (const member of deptMembers) {
        await createNotification(
          member.id,
          'department_task_suggested',
          `${profile.full_name} suggested a task`,
          taskTitle,
          'todos:department'
        );
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Grab department task
app.post('/api/department-tasks/:id/grab', auth, async (req, res) => {
  try {
    const { data: task } = await supabaseAdmin
      .from('department_tasks')
      .select('task, suggested_by')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabaseAdmin.rpc('grab_department_task', {
      task_id: req.params.id,
      user_id: req.user.id
    });

    if (error) return res.status(500).json({ error: error.message });

    // Notify suggester
    if (task?.suggested_by) {
      const { data: grabber } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', req.user.id)
        .single();

      const taskTitle = task.task.substring(0, 60);
      await createNotification(
        task.suggested_by,
        'department_task_grabbed',
        `${grabber?.full_name || 'Someone'} grabbed your task`,
        taskTitle,
        'todos:department'
      );
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete department task
app.post('/api/department-tasks/:id/complete', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('complete_department_task', {
      task_id: req.params.id,
      user_id: req.user.id
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Abandon department task
app.post('/api/department-tasks/:id/abandon', auth, async (req, res) => {
  try {
    const { data: task } = await supabaseAdmin
      .from('department_tasks')
      .select('task, suggested_by, department')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabaseAdmin.rpc('abandon_department_task', {
      task_id: req.params.id,
      user_id: req.user.id
    });

    if (error) return res.status(500).json({ error: error.message });

    const { data: abandoner } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', req.user.id)
      .single();

    const taskTitle = task.task.substring(0, 60);

    // Notify suggester
    if (task?.suggested_by) {
      await createNotification(
        task.suggested_by,
        'department_task_abandoned',
        `${abandoner?.full_name || 'Someone'} abandoned your task`,
        taskTitle,
        'todos:department'
      );
    }

    // Notify all department members (except abandoner)
    const { data: deptMembers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('department', task.department)
      .neq('id', req.user.id);

    if (deptMembers && deptMembers.length > 0) {
      for (const member of deptMembers) {
        await createNotification(
          member.id,
          'department_task_available',
          'Task available to grab',
          taskTitle,
          'todos:department'
        );
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete department task (only suggester or coordinator)
app.delete('/api/department-tasks/:id', auth, async (req, res) => {
  try {
    const { data: task } = await supabaseAdmin
      .from('department_tasks')
      .select('suggested_by')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isSuggester = task?.suggested_by === req.user.id;

    if (!isCoordinator && !isSuggester) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabaseAdmin
      .from('department_tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
