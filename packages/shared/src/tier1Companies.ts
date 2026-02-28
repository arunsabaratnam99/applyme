/**
 * Curated list of large / well-known employers with significant Canadian presence.
 * Jobs from these companies default to tier1 (require user approval before applying).
 * Users can override any company's tier in the watchlist panel.
 */
export const TIER1_COMPANIES = new Set<string>([
  // Canadian Big Banks
  'rbc', 'royal bank of canada', 'td', 'td bank', 'toronto-dominion bank',
  'scotiabank', 'bank of nova scotia', 'bmo', 'bank of montreal',
  'cibc', 'canadian imperial bank of commerce', 'national bank', 'national bank of canada',
  'manulife', 'sun life', 'great-west lifeco', 'intact financial', 'fairfax financial',

  // Canadian Tech Giants
  'shopify', 'opentext', 'open text', 'cgi', 'cgi group', 'blackberry',
  'lightspeed', 'nuvei', 'wealthsimple', 'borrowell', 'clearco',
  'hootsuite', 'd2l', 'desire2learn', 'pivotal', 'traction on demand',
  'absolute software', 'magellan aerospace', 'bombardier', 'cae',
  'loblaws', 'loblaw', 'george weston', 'empire company',

  // Canadian Telcos / Media
  'bell', 'bell canada', 'rogers', 'rogers communications', 'telus',
  'shaw communications', 'cogeco', 'videotron', 'eastlink',

  // US Big Tech (Canadian offices)
  'google', 'alphabet', 'microsoft', 'amazon', 'amazon web services', 'aws',
  'meta', 'facebook', 'apple', 'salesforce', 'oracle', 'ibm',
  'intel', 'nvidia', 'amd', 'qualcomm', 'cisco', 'vmware',
  'adobe', 'sap', 'servicenow', 'workday', 'palantir',
  'uber', 'lyft', 'airbnb', 'stripe', 'square', 'block',
  'twitter', 'x corp', 'linkedin', 'snap', 'spotify',
  'netflix', 'amazon prime video', 'disney', 'warner bros',

  // Consulting / Professional Services
  'deloitte', 'pwc', 'pricewaterhousecoopers', 'kpmg', 'ernst & young', 'ey ',
  'mckinsey', 'bain', 'bcg', 'boston consulting group', 'accenture', 'capgemini',
  'cognizant', 'infosys', 'tcs', 'tata consultancy', 'wipro', 'hcl',

  // Canadian Supply Chain / Enterprise Tech
  'kinaxis', 'descartes', 'descartes systems', 'tecsys',
  'manhattan associates', 'e2open', 'o9 solutions', 'blujay solutions', 'infor',

  // Healthcare / Pharma
  'pfizer', 'johnson & johnson', 'j&j', 'abbvie', 'novartis', 'roche',
  'astrazeneca', 'eli lilly', 'bayer', 'sanofi', 'merck',
  'baxter', 'stryker', 'medtronic', 'philips healthcare',
  'pointclickcare', 'jane app', 'telus health',

  // Financial Services / Fintech
  'visa', 'mastercard', 'american express', 'amex', 'paypal',
  'fiserv', 'fis', 'temenos', 'ss&c technologies', 'broadridge',
  'td securities', 'rbc capital markets', 'cibc capital markets',
  'institutional shareholder services', 'iss',

  // E-commerce / Retail
  'amazon canada', 'walmart canada', 'costco canada', 'target canada',
  'best buy canada', 'the bay', 'hudson bay', 'hbc',
  'indigo', 'chapters',

  // Aerospace / Defense / Gov
  'lockheed martin', 'raytheon', 'boeing', 'airbus', 'general dynamics',
  'l3harris', 'bae systems',
]);

/**
 * Returns true if a company name matches a tier-1 company.
 * Case-insensitive, strips legal suffixes before comparing.
 */
export function isTier1Company(companyName: string): boolean {
  const lower = companyName.toLowerCase().trim()
    .replace(/,?\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|incorporated)$/i, '');
  return TIER1_COMPANIES.has(lower);
}
