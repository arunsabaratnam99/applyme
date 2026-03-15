-- Re-classify employment_type for all existing jobs.
-- Mirrors the TypeScript classifyEmploymentType() logic exactly:
--   1. Senior signals   → full_time  (checked FIRST)
--   2. Co-op keywords   → co_op
--   3. Intern keywords  → internship
--   4. New-grad signals → internship
--   5. Default          → full_time
--
-- Run this in the Supabase SQL Editor.

UPDATE jobs
SET employment_type = CASE

  -- 1. Senior signals always win
  WHEN lower(title) SIMILAR TO '%(senior|sr\.|sr |lead|principal|staff|director|manager|head of|vp |vice president)%'
    THEN 'full_time'

  -- 2. Co-op
  WHEN lower(title) SIMILAR TO '%(co-op|coop|co op|cooperative education)%'
    THEN 'co_op'

  -- 3. Explicit internship keywords
  WHEN lower(title) SIMILAR TO '%(intern|internship|student|practicum|trainee|placement|work term)%'
    THEN 'internship'

  -- 4. New-grad / junior signals
  WHEN lower(title) SIMILAR TO '%(new grad|new graduate|junior|entry level|entry-level|early career)%'
    THEN 'internship'

  -- 5. Default
  ELSE 'full_time'

END;

-- Show a summary of the new distribution
SELECT employment_type, count(*) AS count
FROM jobs
GROUP BY employment_type
ORDER BY count DESC;
