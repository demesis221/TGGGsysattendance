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
    const { task, description, start_date, deadline, priority } = req.body;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('department')
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
        start_date,
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
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Grab department task
app.post('/api/department-tasks/:id/grab', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('grab_department_task', {
      task_id: req.params.id,
      user_id: req.user.id
    });

    if (error) return res.status(500).json({ error: error.message });
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
    const { data, error } = await supabaseAdmin.rpc('abandon_department_task', {
      task_id: req.params.id,
      user_id: req.user.id
    });

    if (error) return res.status(500).json({ error: error.message });
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
