-- Department Tasks Table
-- Allows users in the same department to suggest, grab, complete, and abandon tasks

CREATE TABLE IF NOT EXISTS department_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  
  -- Task ownership tracking
  suggested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  grabbed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Status: 'suggested', 'grabbed', 'completed', 'abandoned'
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'grabbed', 'completed', 'abandoned')),
  
  -- Timestamps
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  grabbed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  abandoned_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  start_date DATE,
  deadline DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for performance
CREATE INDEX idx_department_tasks_department ON department_tasks(department);
CREATE INDEX idx_department_tasks_status ON department_tasks(status);
CREATE INDEX idx_department_tasks_suggested_by ON department_tasks(suggested_by);
CREATE INDEX idx_department_tasks_grabbed_by ON department_tasks(grabbed_by);
CREATE INDEX idx_department_tasks_deleted_at ON department_tasks(deleted_at);

-- RLS Policies
ALTER TABLE department_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view tasks in their department
CREATE POLICY "Users can view department tasks"
  ON department_tasks FOR SELECT
  USING (
    department = (SELECT department FROM profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
  );

-- Users can suggest tasks for their department
CREATE POLICY "Users can suggest tasks"
  ON department_tasks FOR INSERT
  WITH CHECK (
    department = (SELECT department FROM profiles WHERE id = auth.uid())
    AND suggested_by = auth.uid()
  );

-- Users can update tasks they suggested (before grabbed) or tasks they grabbed
CREATE POLICY "Users can update their tasks"
  ON department_tasks FOR UPDATE
  USING (
    department = (SELECT department FROM profiles WHERE id = auth.uid())
    AND (
      (suggested_by = auth.uid() AND status = 'suggested') OR
      (grabbed_by = auth.uid() AND status IN ('grabbed', 'completed'))
    )
  );

-- Coordinators can manage all department tasks
CREATE POLICY "Coordinators can manage all tasks"
  ON department_tasks FOR ALL
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'coordinator'
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_department_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER department_tasks_updated_at
  BEFORE UPDATE ON department_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_department_tasks_updated_at();

-- Function to handle task grab (transfer ownership)
-- Ensures user is from same department as task
CREATE OR REPLACE FUNCTION grab_department_task(task_id UUID, user_id UUID)
RETURNS department_tasks AS $$
DECLARE
  task department_tasks;
  user_dept TEXT;
  task_dept TEXT;
BEGIN
  -- Get user's department
  SELECT department INTO user_dept FROM profiles WHERE id = user_id;
  
  -- Get task's department
  SELECT department INTO task_dept FROM department_tasks WHERE id = task_id;
  
  -- Verify same department
  IF user_dept IS NULL OR task_dept IS NULL OR user_dept != task_dept THEN
    RAISE EXCEPTION 'User must be in same department as task';
  END IF;
  
  UPDATE department_tasks
  SET 
    grabbed_by = user_id,
    grabbed_at = NOW(),
    status = 'grabbed',
    updated_at = NOW()
  WHERE id = task_id
    AND status = 'suggested'
    AND department = user_dept
  RETURNING * INTO task;
  
  RETURN task;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete task
-- Ensures user is from same department and is the one who grabbed it
CREATE OR REPLACE FUNCTION complete_department_task(task_id UUID, user_id UUID)
RETURNS department_tasks AS $$
DECLARE
  task department_tasks;
  user_dept TEXT;
  task_dept TEXT;
BEGIN
  -- Get user's department
  SELECT department INTO user_dept FROM profiles WHERE id = user_id;
  
  -- Get task's department
  SELECT department INTO task_dept FROM department_tasks WHERE id = task_id;
  
  -- Verify same department
  IF user_dept IS NULL OR task_dept IS NULL OR user_dept != task_dept THEN
    RAISE EXCEPTION 'User must be in same department as task';
  END IF;
  
  UPDATE department_tasks
  SET 
    completed_by = user_id,
    completed_at = NOW(),
    status = 'completed',
    updated_at = NOW()
  WHERE id = task_id
    AND grabbed_by = user_id
    AND status = 'grabbed'
    AND department = user_dept
  RETURNING * INTO task;
  
  RETURN task;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to abandon task (revert to suggested)
-- Ensures user is from same department and is the one who grabbed it
CREATE OR REPLACE FUNCTION abandon_department_task(task_id UUID, user_id UUID)
RETURNS department_tasks AS $$
DECLARE
  task department_tasks;
  user_dept TEXT;
  task_dept TEXT;
BEGIN
  -- Get user's department
  SELECT department INTO user_dept FROM profiles WHERE id = user_id;
  
  -- Get task's department
  SELECT department INTO task_dept FROM department_tasks WHERE id = task_id;
  
  -- Verify same department
  IF user_dept IS NULL OR task_dept IS NULL OR user_dept != task_dept THEN
    RAISE EXCEPTION 'User must be in same department as task';
  END IF;
  
  UPDATE department_tasks
  SET 
    grabbed_by = NULL,
    grabbed_at = NULL,
    abandoned_at = NOW(),
    status = 'suggested',
    updated_at = NOW()
  WHERE id = task_id
    AND grabbed_by = user_id
    AND status = 'grabbed'
    AND department = user_dept
  RETURNING * INTO task;
  
  RETURN task;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for department task statistics
CREATE OR REPLACE VIEW department_task_stats AS
SELECT 
  department,
  COUNT(*) FILTER (WHERE status = 'suggested') as suggested_count,
  COUNT(*) FILTER (WHERE status = 'grabbed') as grabbed_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) as total_count
FROM department_tasks
WHERE deleted_at IS NULL
GROUP BY department;

-- Grant permissions
GRANT SELECT ON department_task_stats TO authenticated;
