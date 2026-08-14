export type HiringDestination = 'ADMISSION' | 'FINANCEIRO_HEADHUNTER';
export type FeeRule = { type: 'percent'; value: number } | { type: 'fixed'; value: number } | { type: 'salary_multiplier'; value: number };
export function resolveHiringDestination(origin?: string): HiringDestination {
  const normalized = String(origin || '').trim().toLowerCase();
  return normalized === 'headhunter' || normalized === 'headhunter_executive' ? 'FINANCEIRO_HEADHUNTER' : 'ADMISSION';
}
function parseBrazilianMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
export function parseFeeRule(raw?: string): FeeRule | null {
  if (!raw) return null;
  const original = raw.trim().toLowerCase();
  const percent = original.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
  if (percent) { const value = Number(percent[1].replace(',', '.')); return value > 0 ? { type: 'percent', value } : null; }
  const multiplier = original.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:x|sal[aá]rios?)/);
  if (multiplier) { const value = Number(multiplier[1].replace(',', '.')); return value > 0 ? { type: 'salary_multiplier', value } : null; }
  if (/fix|r\$/.test(original)) {
    const fixedMatch = original.match(/(?:r\$\s*)?([0-9][0-9.,]*)/);
    const value = fixedMatch ? parseBrazilianMoney(fixedMatch[1]) : null;
    return value && value > 0 ? { type: 'fixed', value } : null;
  }
  return null;
}
export function calculateHeadhunterFee(salary: number | undefined, rawRule?: string, explicit?: FeeRule | null): number | null {
  const rule = explicit || parseFeeRule(rawRule);
  if (!rule) return null;
  if (rule.type === 'fixed') return rule.value > 0 ? roundMoney(rule.value) : null;
  if (!salary || salary <= 0) return null;
  if (rule.type === 'percent') return roundMoney(salary * (rule.value / 100));
  return roundMoney(salary * rule.value);
}
export function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function isValidCpfForAdmission(cpf: string): boolean { return /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(cpf.trim()); }
export function normalizeDocument(value?: string): string { return String(value || '').replace(/\D/g, ''); }
export function normalizeEmail(value?: string): string { return String(value || '').trim().toLowerCase(); }
export function candidateIdentity(companyId: string, email: string): string { return `${companyId}:${normalizeEmail(email)}`; }
export function applicationIdentity(companyId: string, jobId: string, candidateId: string): string { return `${companyId}:${jobId}:${candidateId}`; }
export function admissionIdentity(companyId: string, applicationId: string): string { return `${companyId}:${applicationId}`; }
export function billingIdentity(companyId: string, applicationId: string): string { return `${companyId}:${applicationId}`; }
