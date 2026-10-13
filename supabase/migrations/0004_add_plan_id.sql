-- Add plan_id column to students and groups
ALTER TABLE students ADD COLUMN plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE groups ADD COLUMN plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
