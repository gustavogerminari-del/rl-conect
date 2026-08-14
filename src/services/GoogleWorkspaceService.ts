import { auth } from '../lib/firebase';

export type GoogleWorkspaceStatus = {
  companyId: string;
  status: string;
  connectedEmail?: string | null;
  calendarId?: string;
  calendarAvailable?: boolean;
  meetAvailable?: boolean;
};

async function authenticatedRequest(url: string, init: RequestInit = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Sessão Firebase obrigatória.');
  const token = await currentUser.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const raw = await response.text(); let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { error: raw }; }
  if (!response.ok || payload.success === false) throw Object.assign(new Error(payload.error || `Requisição recusada (${response.status}).`), { status: response.status });
  return payload;
}

export class GoogleWorkspaceService {
  static async getStatus(companyId: string) {
    return authenticatedRequest(`/api/google/workspace?companyId=${encodeURIComponent(companyId)}`) as Promise<{ success: true; integration: GoogleWorkspaceStatus; configuration: { oauthConfigured: boolean; secureStoreConfigured: boolean } }>;
  }
  static async connect(companyId: string) {
    const result = await authenticatedRequest('/api/google/workspace', { method: 'POST', body: JSON.stringify({ companyId }) });
    if (!result.authorizationUrl) throw new Error('Google não retornou a página de autorização.');
    window.location.assign(result.authorizationUrl);
  }
  static async disconnect(companyId: string) {
    return authenticatedRequest('/api/google/workspace', { method: 'DELETE', body: JSON.stringify({ companyId }) });
  }
  static async createInterview(companyId: string, input: { interviewId: string; title: string; start: string; end: string; timezone?: string; attendees?: string[]; description?: string }) {
    return authenticatedRequest('/api/google/interviews', { method: 'POST', body: JSON.stringify({ ...input, companyId, empresaId: companyId }) }) as Promise<{ success: true; eventId: string; meetUrl: string | null; htmlLink: string | null }>;
  }
  static async updateInterview(companyId: string, eventId: string, input: Record<string, any>) {
    return authenticatedRequest(`/api/google/interviews/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify({ ...input, companyId, empresaId: companyId }) });
  }
  static async cancelInterview(companyId: string, eventId: string, interviewId: string) {
    return authenticatedRequest(`/api/google/interviews/${encodeURIComponent(eventId)}?companyId=${encodeURIComponent(companyId)}&interviewId=${encodeURIComponent(interviewId)}`, { method: 'DELETE' });
  }
}
