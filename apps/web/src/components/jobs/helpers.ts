const KEYWORD_LIST = [
  // Languages
  'Python', 'TypeScript', 'JavaScript', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'PHP', 'R',
  // Frontend
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Tailwind', 'CSS', 'HTML', 'Webpack', 'Vite',
  // Backend / runtime
  'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring', 'Rails', 'GraphQL', 'REST', 'gRPC',
  // Data / ML
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Spark', 'Kafka', 'Airflow', 'dbt',
  'TensorFlow', 'PyTorch', 'scikit-learn', 'pandas', 'NumPy',
  // Cloud / DevOps
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'GitHub Actions', 'Linux', 'Bash',
  // Tools / practices
  'Git', 'Agile', 'Scrum', 'Jira', 'Figma', 'Storybook', 'Jest', 'Cypress', 'Playwright',
];

export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return KEYWORD_LIST.filter((kw) => {
    const lkw = kw.toLowerCase();
    const escaped = lkw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`);
    return re.test(lower);
  });
}

export type SalaryUnit = 'annual' | 'monthly' | 'hourly';
export interface ParsedSalary { min: number | null; max: number | null; unit: SalaryUnit; }

export function extractSalaryFromText(text: string): ParsedSalary {
  if (!text) return { min: null, max: null, unit: 'annual' };

  const t = text.replace(/\b(USD|CAD|usd|cad)\b/g, '');

  const hourlyRange = t.match(/\$(\d[\d,]*(?:\.\d+)?)\s*(?:–|-|to)\s*\$(\d[\d,]*(?:\.\d+)?)\s*(?:per\s+hour|\/hour|\/hr?|an\s+hour)/i);
  if (hourlyRange) {
    const a = parseFloat(hourlyRange[1]!.replace(/,/g, ''));
    const b = parseFloat(hourlyRange[2]!.replace(/,/g, ''));
    return { min: Math.round(a * 2080), max: Math.round(b * 2080), unit: 'hourly' };
  }
  const hourlySingle = t.match(/\$(\d[\d,]*(?:\.\d+)?)\s*(?:per\s+hour|\/hour|\/hr?|an\s+hour)/i);
  if (hourlySingle) {
    const v = parseFloat(hourlySingle[1]!.replace(/,/g, ''));
    if (v >= 10) return { min: Math.round(v * 2080), max: null, unit: 'hourly' };
  }

  const monthlyRange = t.match(/\$(\d[\d,]*)\s*(?:–|-|to)\s*\$(\d[\d,]*)\s*(?:per\s+month|\/month|\/mo\b)/i);
  if (monthlyRange) {
    const a = parseInt(monthlyRange[1]!.replace(/,/g, ''), 10);
    const b = parseInt(monthlyRange[2]!.replace(/,/g, ''), 10);
    return { min: a * 12, max: b * 12, unit: 'monthly' };
  }
  const monthlySingle = t.match(/\$(\d[\d,]*)\s*(?:per\s+month|\/month|\/mo\b)/i);
  if (monthlySingle) {
    const v = parseInt(monthlySingle[1]!.replace(/,/g, ''), 10);
    if (v >= 500) return { min: v * 12, max: null, unit: 'monthly' };
  }

  const hourlyCtxBefore = t.match(/hourly[^$\n]{0,80}\$(\d[\d,]*)\s*[-–—]\s*\$(\d[\d,]*)/i);
  if (hourlyCtxBefore) {
    const a = parseInt(hourlyCtxBefore[1]!.replace(/,/g, ''), 10);
    const b = parseInt(hourlyCtxBefore[2]!.replace(/,/g, ''), 10);
    if (a >= 10 && a < 500) return { min: a * 2080, max: b * 2080, unit: 'hourly' };
  }
  const hourlyCtxAfter = t.match(/\$(\d[\d,]*)\s*[-–—]\s*\$(\d[\d,]*)[^\n]{0,60}(?:per\s+hour|hourly|\/hr?)\b/i);
  if (hourlyCtxAfter) {
    const a = parseInt(hourlyCtxAfter[1]!.replace(/,/g, ''), 10);
    const b = parseInt(hourlyCtxAfter[2]!.replace(/,/g, ''), 10);
    if (a >= 10 && a < 500) return { min: a * 2080, max: b * 2080, unit: 'hourly' };
  }

  const annualRange = t.match(/\$(\d[\d,]*)\s*k?\s*[-–—]\s*\$(\d[\d,]*)\s*k?/i);
  if (annualRange) {
    const parse = (s: string, hasK: boolean) => { const n = parseInt(s.replace(/,/g, ''), 10); return hasK || n < 1000 ? n * 1000 : n; };
    const hasK = /k/i.test(annualRange[0]);
    return { min: parse(annualRange[1]!, hasK), max: parse(annualRange[2]!, hasK), unit: 'annual' };
  }

  const singleMatch = t.match(/\$(\d[\d,]+)\s*k?(?:\/yr|\/year|per\s+year)?/i);
  if (singleMatch) {
    const raw = parseInt(singleMatch[1]!.replace(/,/g, ''), 10);
    const val = /k/i.test(singleMatch[0]) ? raw * 1000 : raw;
    if (val >= 30000) return { min: val, max: null, unit: 'annual' };
  }

  return { min: null, max: null, unit: 'annual' };
}
