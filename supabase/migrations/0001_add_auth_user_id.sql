-- Add user_id to students
ALTER TABLE students ADD COLUMN user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to groups
ALTER TABLE groups ADD COLUMN user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_students ENABLE ROW LEVEL SECURITY;

-- Create policies for students
CREATE POLICY "Users can view their own students" ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own students" ON students FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own students" ON students FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own students" ON students FOR DELETE USING (auth.uid() = user_id);

-- Create policies for groups
CREATE POLICY "Users can view their own groups" ON groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own groups" ON groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own groups" ON groups FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own groups" ON groups FOR DELETE USING (auth.uid() = user_id);

-- Create policies for group_students
CREATE POLICY "Users can view their group_students" ON group_students FOR SELECT USING (
  EXISTS (SELECT 1 FROM groups WHERE groups.id = group_students.group_id AND groups.user_id = auth.uid())
);
CREATE POLICY "Users can insert their group_students" ON group_students FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM groups WHERE groups.id = group_students.group_id AND groups.user_id = auth.uid())
);
CREATE POLICY "Users can update their group_students" ON group_students FOR UPDATE USING (
  EXISTS (SELECT 1 FROM groups WHERE groups.id = group_students.group_id AND groups.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM groups WHERE groups.id = group_students.group_id AND groups.user_id = auth.uid())
);
CREATE POLICY "Users can delete their group_students" ON group_students FOR DELETE USING (
  EXISTS (SELECT 1 FROM groups WHERE groups.id = group_students.group_id AND groups.user_id = auth.uid())
);
