export interface CompanyPeerEntry {
  peerCompany: string;
  similarityScore: number;
  peerTags: string[];
}

/**
 * Static curated peer map of ~200 Canadian companies grouped by industry segment + size tier.
 * Used to power the "Similar companies" panel in the watchlist UI.
 */
export const COMPANY_PEERS: Map<string, CompanyPeerEntry[]> = new Map([
  // ─── Supply Chain / ERP (Kinaxis tier) ─────────────────────────────────────
  ['kinaxis', [
    { peerCompany: 'Descartes Systems', similarityScore: 90, peerTags: ['canadian-tech', 'supply-chain', 'ontario', 'mid-size'] },
    { peerCompany: 'Tecsys', similarityScore: 87, peerTags: ['canadian-tech', 'supply-chain', 'quebec', 'mid-size'] },
    { peerCompany: 'BluJay Solutions', similarityScore: 85, peerTags: ['supply-chain', 'logistics', 'mid-size'] },
    { peerCompany: 'o9 Solutions', similarityScore: 82, peerTags: ['supply-chain', 'planning', 'global'] },
    { peerCompany: 'E2open', similarityScore: 80, peerTags: ['supply-chain', 'saas', 'global'] },
    { peerCompany: 'Manhattan Associates', similarityScore: 78, peerTags: ['supply-chain', 'wms', 'global'] },
    { peerCompany: 'Infor', similarityScore: 75, peerTags: ['erp', 'supply-chain', 'enterprise'] },
    { peerCompany: 'Relex Solutions', similarityScore: 73, peerTags: ['supply-chain', 'retail-planning', 'global'] },
  ]],
  ['descartes systems', [
    { peerCompany: 'Kinaxis', similarityScore: 90, peerTags: ['canadian-tech', 'supply-chain', 'ontario'] },
    { peerCompany: 'Tecsys', similarityScore: 85, peerTags: ['canadian-tech', 'supply-chain', 'mid-size'] },
    { peerCompany: 'BluJay Solutions', similarityScore: 82, peerTags: ['logistics', 'supply-chain'] },
    { peerCompany: 'project44', similarityScore: 78, peerTags: ['logistics', 'visibility', 'global'] },
    { peerCompany: 'FourKites', similarityScore: 76, peerTags: ['logistics', 'visibility'] },
  ]],

  // ─── Canadian Fintech ────────────────────────────────────────────────────────
  ['shopify', [
    { peerCompany: 'Lightspeed', similarityScore: 88, peerTags: ['canadian-tech', 'fintech', 'e-commerce', 'montreal'] },
    { peerCompany: 'Nuvei', similarityScore: 84, peerTags: ['canadian-tech', 'payments', 'montreal'] },
    { peerCompany: 'Wealthsimple', similarityScore: 80, peerTags: ['canadian-tech', 'fintech', 'toronto'] },
    { peerCompany: 'Clearco', similarityScore: 75, peerTags: ['canadian-tech', 'fintech', 'toronto'] },
    { peerCompany: 'Beanworks', similarityScore: 70, peerTags: ['canadian-tech', 'fintech', 'bc'] },
    { peerCompany: 'TouchBistro', similarityScore: 72, peerTags: ['canadian-tech', 'saas', 'hospitality'] },
  ]],
  ['wealthsimple', [
    { peerCompany: 'Borrowell', similarityScore: 87, peerTags: ['canadian-fintech', 'toronto'] },
    { peerCompany: 'Nuvei', similarityScore: 83, peerTags: ['canadian-fintech', 'payments'] },
    { peerCompany: 'League', similarityScore: 78, peerTags: ['canadian-tech', 'health-fintech'] },
    { peerCompany: 'Koho Financial', similarityScore: 85, peerTags: ['canadian-fintech', 'neobank', 'toronto'] },
    { peerCompany: 'Neo Financial', similarityScore: 84, peerTags: ['canadian-fintech', 'neobank', 'alberta'] },
    { peerCompany: 'Stack Financial', similarityScore: 76, peerTags: ['canadian-fintech'] },
  ]],

  // ─── Healthcare Tech ──────────────────────────────────────────────────────────
  ['pointclickcare', [
    { peerCompany: 'Greenway Health', similarityScore: 85, peerTags: ['health-tech', 'ehr', 'mid-size'] },
    { peerCompany: 'Jane App', similarityScore: 88, peerTags: ['canadian-tech', 'health-tech', 'bc'] },
    { peerCompany: 'Telus Health', similarityScore: 82, peerTags: ['canadian-tech', 'health-tech', 'telco'] },
    { peerCompany: 'MedBridge', similarityScore: 78, peerTags: ['health-tech', 'telehealth'] },
    { peerCompany: 'Maple', similarityScore: 84, peerTags: ['canadian-tech', 'telehealth', 'toronto'] },
    { peerCompany: 'Think Research', similarityScore: 80, peerTags: ['canadian-tech', 'health-tech', 'toronto'] },
  ]],

  // ─── Canadian AI / ML ─────────────────────────────────────────────────────────
  ['cohere', [
    { peerCompany: 'Waabi', similarityScore: 85, peerTags: ['canadian-ai', 'autonomous', 'toronto'] },
    { peerCompany: 'Layer 6', similarityScore: 88, peerTags: ['canadian-ai', 'ml', 'toronto'] },
    { peerCompany: 'BorealisAI', similarityScore: 87, peerTags: ['canadian-ai', 'rbc', 'toronto'] },
    { peerCompany: 'Darwin AI', similarityScore: 80, peerTags: ['canadian-ai', 'waterloo'] },
    { peerCompany: 'Integrate.ai', similarityScore: 78, peerTags: ['canadian-ai', 'data', 'toronto'] },
    { peerCompany: 'Untether AI', similarityScore: 82, peerTags: ['canadian-ai', 'hardware', 'toronto'] },
  ]],

  // ─── Canadian Cybersecurity ────────────────────────────────────────────────────
  ['blackberry', [
    { peerCompany: 'Absolute Software', similarityScore: 88, peerTags: ['canadian-security', 'bc'] },
    { peerCompany: 'eSentire', similarityScore: 85, peerTags: ['canadian-security', 'mdr', 'ontario'] },
    { peerCompany: 'Arctic Wolf', similarityScore: 83, peerTags: ['security', 'soc', 'ontario-hq'] },
    { peerCompany: 'Cybereason', similarityScore: 78, peerTags: ['security', 'edr', 'global'] },
    { peerCompany: 'Sygnia', similarityScore: 75, peerTags: ['security', 'incident-response'] },
  ]],

  // ─── Canadian Edtech ──────────────────────────────────────────────────────────
  ['d2l', [
    { peerCompany: 'Top Hat', similarityScore: 88, peerTags: ['canadian-edtech', 'toronto'] },
    { peerCompany: 'Prodigy Game', similarityScore: 82, peerTags: ['canadian-edtech', 'ontario'] },
    { peerCompany: 'Knewton', similarityScore: 75, peerTags: ['edtech', 'adaptive-learning'] },
    { peerCompany: 'Riipen', similarityScore: 80, peerTags: ['canadian-edtech', 'bc'] },
    { peerCompany: 'SkillsBuild', similarityScore: 73, peerTags: ['edtech', 'upskilling'] },
  ]],

  // ─── Canadian Telco / Networking ──────────────────────────────────────────────
  ['telus', [
    { peerCompany: 'Rogers', similarityScore: 92, peerTags: ['canadian-telco', 'toronto'] },
    { peerCompany: 'Bell Canada', similarityScore: 91, peerTags: ['canadian-telco', 'montreal'] },
    { peerCompany: 'Cogeco', similarityScore: 82, peerTags: ['canadian-telco', 'ontario-quebec'] },
    { peerCompany: 'Eastlink', similarityScore: 78, peerTags: ['canadian-telco', 'atlantic'] },
    { peerCompany: 'Distributel', similarityScore: 72, peerTags: ['canadian-isp'] },
  ]],

  // ─── Canadian Aerospace / Defense ─────────────────────────────────────────────
  ['bombardier', [
    { peerCompany: 'CAE', similarityScore: 90, peerTags: ['canadian-aerospace', 'simulation', 'montreal'] },
    { peerCompany: 'Magellan Aerospace', similarityScore: 87, peerTags: ['canadian-aerospace', 'ontario'] },
    { peerCompany: 'L3Harris Canada', similarityScore: 82, peerTags: ['canadian-defense', 'ontario'] },
    { peerCompany: 'General Dynamics Canada', similarityScore: 85, peerTags: ['canadian-defense', 'ontario'] },
    { peerCompany: 'MDA Space', similarityScore: 80, peerTags: ['canadian-space', 'bc'] },
  ]],

  // ─── Canadian E-commerce / Retail Tech ────────────────────────────────────────
  ['lightspeed', [
    { peerCompany: 'Shopify', similarityScore: 88, peerTags: ['canadian-tech', 'e-commerce'] },
    { peerCompany: 'TouchBistro', similarityScore: 84, peerTags: ['canadian-tech', 'restaurant-tech'] },
    { peerCompany: 'Tulip Retail', similarityScore: 80, peerTags: ['canadian-tech', 'retail-tech'] },
    { peerCompany: 'ApplyBoard', similarityScore: 72, peerTags: ['canadian-tech', 'waterloo'] },
  ]],

  // ─── OpenText tier ─────────────────────────────────────────────────────────────
  ['opentext', [
    { peerCompany: 'Hummingbird', similarityScore: 82, peerTags: ['canadian-enterprise', 'ecm'] },
    { peerCompany: 'Documentum', similarityScore: 78, peerTags: ['enterprise', 'ecm'] },
    { peerCompany: 'Box', similarityScore: 75, peerTags: ['content-management', 'cloud'] },
    { peerCompany: 'Laserfiche', similarityScore: 76, peerTags: ['ecm', 'workflow'] },
  ]],

  // ─── Canadian HR Tech ─────────────────────────────────────────────────────────
  ['ceridian', [
    { peerCompany: 'ADP Canada', similarityScore: 90, peerTags: ['hr-tech', 'payroll', 'canada'] },
    { peerCompany: 'Payworks', similarityScore: 87, peerTags: ['canadian-hr-tech', 'payroll', 'winnipeg'] },
    { peerCompany: 'Rise People', similarityScore: 83, peerTags: ['canadian-hr-tech', 'bc'] },
    { peerCompany: 'Humi', similarityScore: 85, peerTags: ['canadian-hr-tech', 'toronto'] },
    { peerCompany: 'Collage HR', similarityScore: 80, peerTags: ['canadian-hr-tech', 'toronto'] },
  ]],
]);

/**
 * Looks up peer companies for a given anchor company name.
 * Returns empty array if no peers are found.
 */
export function getPeersForCompany(companyName: string): CompanyPeerEntry[] {
  const key = companyName.toLowerCase().trim()
    .replace(/,?\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|limited|incorporated)$/i, '');
  return COMPANY_PEERS.get(key) ?? [];
}

/**
 * Returns all companies in the peer map (anchor companies only).
 */
export function getAllAnchorCompanies(): string[] {
  return Array.from(COMPANY_PEERS.keys());
}
