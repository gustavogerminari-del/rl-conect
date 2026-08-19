import { firebaseSessionService } from './firebaseSessionService';

export type GoogleWorkspaceStatus = {
  connected: boolean;
  connectedEmail?: string;
  updatedAt?: string;
  companyId?: string;
};

export type GoogleMeetEventInput = {
  companyId: string;
  title: string;
  startDateTime: string;
  durationMinutes: number;
  attendeeEmails?: string[];
  timeZone?: string;
  description?: string;
  vagaId?: string;
  candidatoId?: string;
  candidaturaId?: string;
};

export type GoogleMeetEventResult = {
  success: boolean;
  eventId: string;
  meetLink: string;
  calendarLink?: string;
  startDateTime: string;
  endDateTime: string;
  connectedEmail?: string;
};

async function requestGoogle(action: string, companyId: string, extra: Record<string, unknown> = {}) {
  const token = await firebaseSessionService.idToken();
  if (!token) throw new Error('Sessão Firebase obrigatória para usar o Google Workspace.');

  const response = await fetch('/api/google/workspace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, companyId, ...extra }),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Google Workspace respondeu HTTP ${response.status}.`);
  }
  return payload;
}

class GoogleWorkspaceService {
  async status(companyId: string): Promise<GoogleWorkspaceStatus> {
    const result = await requestGoogle('status', companyId);
    return {
      connected: Boolean(result.connected),
      connectedEmail: result.connectedEmail,
      updatedAt: result.updatedAt,
      companyId: result.companyId,
    };
  }

  async connect(companyId: string, returnTo = '/?tab=agenda') {
    const result = await requestGoogle('start_oauth', companyId, { returnTo });
    if (!result.authorizationUrl) throw new Error('Google não devolveu a URL de autorização.');
    window.location.assign(String(result.authorizationUrl));
  }

  async createMeetEvent(input: GoogleMeetEventInput): Promise<GoogleMeetEventResult> {
    const result = await requestGoogle('create_meet_event', input.companyId, input as unknown as Record<string, unknown>);
    if (!result.meetLink || !result.eventId) throw new Error('Google não devolveu o link da reunião criada.');
    return result as GoogleMeetEventResult;
  }

  async disconnect(companyId: string) {
    await requestGoogle('disconnect', companyId);
  }
}

export const googleWorkspaceService = new GoogleWorkspaceService();
