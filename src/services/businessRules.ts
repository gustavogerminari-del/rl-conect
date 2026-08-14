export type HiringDestination = 'ADMISSION' | 'FINANCEIRO_HEADHUNTER';

export type FeeRule =
  | { type: 'percent'; value: number }
  | { type: 'fixed'; value: number }
  | { type: 'salary_multiplier'; value: number };

export function resolveHiringDestination(origin?: string): HiringDestination {
  return origin === 'headhunter' ? 'FINANCEIRO_HEADHUNTER' : 'ADMISSION';
}

export function parseFeeRule(raw?: string): FeeRule | null {
  if (!raw) return null;
  const text = raw.trim().toLowerCase().replace(',', '.');

  const percent = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
  if (percent) {
    const value = Number(percent[1]);
    return value > 0 ? { type: 'percent', value } : null;
  }

  const multiplier = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:x|sal[aá]rios?)/);
  if (multiplier) {
    const value = Number(multiplier[1]);
    return value > 0 ? { type: 'salary_multiplier', value } : null;
  }

  const fixed = text.match(/(?:r\$\s*)?([0-9]+(?:\.[0-9]+)?)/);
  if (fixed && /fix|r\$/.test(text)) {
    const value = Number(fixed[1]);
    return value > 0 ? { type: 'fixed', value } : null;
  }

  return null;
}

export function calculateHeadhunterFee(
  salary: number | undefined,
  rawRule?: string,
  explicit?: FeeRule | null
): number | null {
  const rule = explicit || parseFeeRule(rawRule);
  if (!rule) return null;
  if (rule.type === 'fixed') return rule.value > 0 ? roundMoney(rule.value) : null;
  if (!salary || salary <= 0) return null;
  if (rule.type === 'percent') return roundMoney(salary * (rule.value / 100));
  return roundMoney(salary * rule.value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isValidCpfForAdmission(cpf: string): boolean {
  return /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(cpf.trim());
}
