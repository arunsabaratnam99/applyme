import { describe, it, expect } from 'vitest';
import { classifyJobCategory, classifyEmploymentType, classifyWorkplace } from './classify.js';

describe('classifyJobCategory', () => {
  it('classifies software engineering roles', () => {
    expect(classifyJobCategory('Software Engineer', '')).toBe('software');
    expect(classifyJobCategory('Senior Frontend Developer', '')).toBe('software');
    expect(classifyJobCategory('Full Stack Developer', '')).toBe('software');
  });

  it('classifies business roles', () => {
    expect(classifyJobCategory('Financial Analyst', '')).toBe('business');
    expect(classifyJobCategory('Business Analyst', '')).toBe('business');
    expect(classifyJobCategory('Marketing Manager', '')).toBe('business');
  });

  it('uses description fallback when title is ambiguous', () => {
    const result = classifyJobCategory('Apprentice', 'write Python scripts and deploy microservices using AWS and Docker');
    expect(result).toBe('software');
  });

  it('returns null for unclassifiable roles', () => {
    expect(classifyJobCategory('Warehouse Associate', 'pack and ship boxes')).toBeNull();
  });
});

describe('classifyEmploymentType', () => {
  it('detects full-time', () => {
    expect(classifyEmploymentType('Full-Time Position')).toBe('full_time');
    expect(classifyEmploymentType('Permanent full time role')).toBe('full_time');
  });

  it('detects internship', () => {
    expect(classifyEmploymentType('Summer Internship 2025')).toBe('internship');
    expect(classifyEmploymentType('4-month intern position')).toBe('internship');
  });

  it('detects co-op', () => {
    expect(classifyEmploymentType('Co-op Software Engineer')).toBe('co_op');
    expect(classifyEmploymentType('Winter COOP term')).toBe('co_op');
  });

  it('defaults to full_time when ambiguous', () => {
    expect(classifyEmploymentType('Join our team')).toBe('full_time');
  });

  it('does NOT classify senior roles as internship (regression)', () => {
    expect(classifyEmploymentType('Senior Associate, Fraud Strategy Analyst')).toBe('full_time');
    expect(classifyEmploymentType('Senior Associate, Product Strategy Analyst')).toBe('full_time');
    expect(classifyEmploymentType('Senior Associate')).toBe('full_time');
    expect(classifyEmploymentType('Lead Software Engineer')).toBe('full_time');
    expect(classifyEmploymentType('Staff Engineer')).toBe('full_time');
    expect(classifyEmploymentType('Principal Product Manager')).toBe('full_time');
  });

  it('correctly classifies explicit intern titles', () => {
    expect(classifyEmploymentType('Software Engineering Intern Summer 2025')).toBe('internship');
    expect(classifyEmploymentType('Data Analyst Intern')).toBe('internship');
    expect(classifyEmploymentType('Student Software Developer')).toBe('internship');
    expect(classifyEmploymentType('Junior Software Engineer')).toBe('internship');
    expect(classifyEmploymentType('New Grad Software Engineer')).toBe('internship');
  });
});

describe('classifyWorkplace', () => {
  it('detects remote', () => {
    expect(classifyWorkplace('Remote – Canada')).toBe('remote');
    expect(classifyWorkplace('Work from home')).toBe('remote');
  });

  it('detects hybrid', () => {
    expect(classifyWorkplace('Hybrid – Toronto office 2x/week')).toBe('hybrid');
  });

  it('detects onsite', () => {
    expect(classifyWorkplace('In-office, Vancouver BC')).toBe('onsite');
    expect(classifyWorkplace('On-site required')).toBe('onsite');
  });

  it('returns null when not determinable', () => {
    expect(classifyWorkplace('')).toBeNull();
  });
});
