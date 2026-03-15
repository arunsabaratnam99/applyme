-- Seed: Insert new job source records for aggregator connectors
-- Run after 0001_add_salary_columns.sql
-- Uses INSERT ... ON CONFLICT DO NOTHING so it's safe to re-run.

INSERT INTO job_sources (source_type, config, enabled)
VALUES
  ('remotive',       '{}', true),
  ('workatastartup', '{}', true),
  ('linkedin_scraper', '{}', true),
  ('indeed_scraper',  '{}', true)
ON CONFLICT DO NOTHING;
