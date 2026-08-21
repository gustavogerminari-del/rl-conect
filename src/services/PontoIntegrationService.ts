import { auth } from '../lib/firebase';

export interface PontoIntegrationConfig {
  companyId: string;
  provider: 'PONTO_RH';
  baseUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  pontoCompanyId: string;
  pontoCompanyName: string;
  status: string;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface PontoSyncResult {
  importedPunches: number;
  bankRecords: number;
  inicio: string;
  fim: string;
}

async function headers() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão Firebase não encontrada. Entre novamente como MASTER.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new Error(String(body?.error || `Falha HTTP ${response.status}.`));
  }
  return body as T;
}

export const PontoIntegrationService = {
  async get(companyId: string) {
    const response = await fetch(`/api/integrations/ponto?companyId=${encodeURIComponent(companyId)}`, {
      headers: await headers(),
      cache: 'no-store',
    });
    const body = await parse<{ success: true; config: PontoIntegrationConfig }>(response);
    return body.config;
  },

  async save(input: { companyId: string; baseUrl: string; clientId: string; clientSecret?: string }) {
    const response = await fetch('/api/integrations/ponto', {
      method: 'PUT',
      headers: await headers(),
      body: JSON.stringify(input),
    });
    const body = await parse<{ success: true; config: PontoIntegrationConfig }>(response);
    return body.config;
  },

  async test(companyId: string) {
    const response = await fetch('/api/integrations/ponto', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ companyId, action: 'test' }),
    });
    return parse<{ success: true; status: string; empresa: Record<string, unknown> | null }>(response);
  },

  async sync(companyId: string, inicio?: string, fim?: string) {
    const response = await fetch('/api/integrations/ponto', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ companyId, action: 'sync', inicio, fim }),
    });
    return parse<{ success: true } & PontoSyncResult>(response);
  },
};
