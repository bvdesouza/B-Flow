-- Add is_default column to plans
ALTER TABLE plans ADD COLUMN is_default BOOLEAN DEFAULT false;
