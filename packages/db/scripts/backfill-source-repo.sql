-- Backfill source_repo for github_repo jobs that were ingested before the
-- source_repo column was added (migration 0009). external_id is built as
-- "${repoName}-..." so each built-in repo has a unique prefix to match on.
-- Run in the Supabase SQL editor (same pattern as reclassify-jobs.sql).

-- negarprh/Canadian-Tech-Internships-2026 — check BEFORE the shorter name
UPDATE jobs SET source_repo = 'negarprh/Canadian-Tech-Internships-2026'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'Canadian-Tech-Internships-2026-%';

-- jenndryden/Canadian-Tech-Internships
UPDATE jobs SET source_repo = 'jenndryden/Canadian-Tech-Internships'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'Canadian-Tech-Internships-%';

-- SimplifyJobs/Summer2026-Internships
UPDATE jobs SET source_repo = 'SimplifyJobs/Summer2026-Internships'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'Summer2026-Internships-%';

-- vanshb03/Summer2027-Internships
UPDATE jobs SET source_repo = 'vanshb03/Summer2027-Internships'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'Summer2027-Internships-%';

-- speedyapply/2026-SWE-College-Jobs
UPDATE jobs SET source_repo = 'speedyapply/2026-SWE-College-Jobs'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE '2026-SWE-College-Jobs-%';

-- speedyapply/2026-AI-College-Jobs
UPDATE jobs SET source_repo = 'speedyapply/2026-AI-College-Jobs'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE '2026-AI-College-Jobs-%';

-- skillsire/Internship-and-Co-op-Jobs
UPDATE jobs SET source_repo = 'skillsire/Internship-and-Co-op-Jobs'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'Internship-and-Co-op-Jobs-%';

-- SimplifyJobs/New-Grad-Positions (formerly pittcsc/New-Grad-Positions)
UPDATE jobs SET source_repo = 'SimplifyJobs/New-Grad-Positions'
WHERE source_type = 'github_repo' AND source_repo IS NULL
  AND external_id ILIKE 'New-Grad-Positions-%';

-- Summary
SELECT source_repo, count(*) AS count
FROM jobs
WHERE source_type = 'github_repo'
GROUP BY source_repo
ORDER BY count DESC;

-- Diagnostic: show sample external_ids for still-NULL rows so the full repo name is visible
SELECT external_id
FROM jobs
WHERE source_type = 'github_repo' AND source_repo IS NULL
LIMIT 10;
