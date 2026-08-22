import { auth } from '../lib/firebase';

export interface PontoIntegrationStatus {
  empresaId: string;
  automatico: true;
  moduleEnabled: boolean;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface PontoSyncResult {
  importedPunches: number;
  bankRecords: number;
  inicio: string;
  fim: string;
}

async function headers() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão Firebase não encontrada.');
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
  async get(companyId?: string) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const response = await fetch(`/api/integrations/ponto${query}`, {
      headers: await headers(),
      cache: 'no-store',
    });
    return parse<{ success: true } & PontoIntegrationStatus>(response);
  },

  async ensure(companyId: string) {
    const response = await fetch('/api/integrations/ponto', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ companyId, action: 'ensure' }),
    });
    return parse<{ success: true; automatico: true; result: Record<string, unknown> }>(response);
  },

  async sync(companyId?: string, inicio?: string, fim?: string) {
    const response = await fetch('/api/integrations/ponto', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ ...(companyId ? { companyId } : {}), action: 'sync', inicio, fim }),
    });
    return parse<{ success: true; automatico: true } & PontoSyncResult>(response);
  },
};
