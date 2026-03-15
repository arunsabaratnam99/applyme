-- Migration: Add salary_min and salary_max columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max text;
