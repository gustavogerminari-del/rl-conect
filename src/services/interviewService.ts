import { dataService } from './dataService';
import type { Entrevista } from '../types';

export type IntegrationStatus =
  | 'synced'
  | 'not_synced'
  | 'pending'
  | 'error'
  | 'cancelled'
  | 'legacy_unverified';

export type EnhancedEntrevista = Entrevista & {
  google_calendar_event_id?: string;
  google_calendar_id?: string;
  google_meet_url?: string;
  google_event_html_link?: string;
  integration_status?: IntegrationStatus;
  integration_error?: string;
  timezone?: string;
  inicio_em?: string;
  fim_em?: string;
  atualizado_em?: string;
};

type Overlay = Partial<EnhancedEntrevista> & { id: string };
const STORAGE_KEY = 'rl_connect_v2_interview_calendar_overlay';

function readOverlay(): Record<string, Overlay> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeOverlay(value: Record<string, Overlay>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function looksLikeLegacyFakeMeet(url?: string): boolean {
  return Boolean(
    url &&
      (/meet\.google\.com\/(abc-defg-hij|xyz-uvwx-rst)/i.test(url) || /example\.com/i.test(url))
  );
}

function mergeInterview(base: Entrevista, overlay?: Overlay): EnhancedEntrevista {
  const merged = { ...base, ...(overlay || {}) } as EnhancedEntrevista;

  // Migração de segurança: versões antigas marcavam Calendar como sincronizado
  // e gravavam links fictícios. Sem eventId real, nunca afirmar sincronização.
  if (!overlay?.google_calendar_event_id && looksLikeLegacyFakeMeet(base.link_reuniao)) {
    merged.link_reuniao = undefined;
    merged.google_meet_url = undefined;
    merged.sincronizado_gcal = false;
    merged.integration_status = 'legacy_unverified';
  }
  if (merged.sincronizado_gcal && !merged.google_calendar_event_id) {
    merged.sincronizado_gcal = false;
    merged.integration_status = merged.integration_status || 'legacy_unverified';
  }
  return merged;
}

export const interviewService = {
  getAll(): EnhancedEntrevista[] {
    const overlays = readOverlay();
    return dataService.getEntrevistas().map((item) => mergeInterview(item, overlays[item.id]));
  },

  create(
    data: Omit<Entrevista, 'id' | 'criado_em' | 'empresa_id'>,
    integration: Partial<EnhancedEntrevista> = {}
  ): EnhancedEntrevista {
    const base = dataService.createEntrevista(data);
    const overlays = readOverlay();
    overlays[base.id] = {
      id: base.id,
      ...integration,
      sincronizado_gcal: Boolean(integration.google_calendar_event_id),
      link_reuniao: integration.google_meet_url || data.link_reuniao,
      integration_status:
        integration.integration_status ||
        (integration.google_calendar_event_id ? 'synced' : 'not_synced'),
      atualizado_em: new Date().toISOString(),
    };
    writeOverlay(overlays);
    return mergeInterview(base, overlays[base.id]);
  },

  update(id: string, updates: Partial<EnhancedEntrevista>): EnhancedEntrevista | null {
    const base = dataService.getEntrevistas().find((item) => item.id === id);
    if (!base) return null;
    const overlays = readOverlay();
    overlays[id] = {
      id,
      ...(overlays[id] || {}),
      ...updates,
      atualizado_em: new Date().toISOString(),
    };
    writeOverlay(overlays);
    return mergeInterview(base, overlays[id]);
  },

  setIntegrationError(id: string, message: string): EnhancedEntrevista | null {
    return this.update(id, {
      sincronizado_gcal: false,
      integration_status: 'error',
      integration_error: message,
    });
  },
};
