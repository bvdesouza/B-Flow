-- Add schedule and class_category columns
ALTER TABLE students ADD COLUMN schedule JSONB DEFAULT '[]'::jsonb;
ALTER TABLE groups ADD COLUMN schedule JSONB DEFAULT '[]'::jsonb;
ALTER TABLE groups ADD COLUMN class_category TEXT DEFAULT 'personal';
