import { supabase } from '../lib/supabase';

export type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail?: string | null;
  calendarId?: string | null;
  status?: 'connected' | 'disconnected' | 'error' | 'revoked';
  updatedAt?: string | null;
  message?: string;
};

export type GoogleCalendarEventInput = {
  interviewId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  timezone?: string;
  attendees?: string[];
  createMeet?: boolean;
};

export type GoogleCalendarEventResult = {
  eventId: string;
  calendarId?: string;
  meetUrl?: string | null;
  htmlLink?: string | null;
  status?: string;
};

async function getRlAccessToken(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase/Auth do RL Connect não está configurado neste ambiente.');
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Faça login normalmente no RL Connect antes de conectar ou usar o Google Calendar.');
  }
  return data.session.access_token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getRlAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || `Falha na integração Google (${response.status}).`);
  }
  return payload as T;
}

export const googleCalendarService = {
  async getStatus(): Promise<GoogleCalendarStatus> {
    return api<GoogleCalendarStatus>('/api/integrations/google/calendar/status');
  },

  async connect(): Promise<void> {
    const result = await api<{ authUrl: string }>('/api/integrations/google/calendar/auth-url', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!result.authUrl) throw new Error('Servidor não retornou a URL de autorização do Google Calendar.');
    window.location.assign(result.authUrl);
  },

  async disconnect(): Promise<void> {
    await api<{ disconnected: boolean }>('/api/integrations/google/calendar/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async createEvent(input: GoogleCalendarEventInput): Promise<GoogleCalendarEventResult> {
    return api<GoogleCalendarEventResult>('/api/integrations/google/calendar/events', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateEvent(eventId: string, input: Partial<GoogleCalendarEventInput>): Promise<GoogleCalendarEventResult> {
    return api<GoogleCalendarEventResult>(`/api/integrations/google/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteEvent(eventId: string): Promise<void> {
    await api<{ deleted: boolean }>(`/api/integrations/google/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  },
};
