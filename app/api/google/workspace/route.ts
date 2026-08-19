import {
  createGoogleMeetEvent,
  disconnectGoogleWorkspace,
  getGoogleWorkspaceStatus,
  jsonResponse,
  startGoogleWorkspaceOAuth,
} from './_shared';

export async function POST(request: Request) {
  try {
    const body: any = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'status') {
      return jsonResponse({ success: true, ...(await getGoogleWorkspaceStatus(request, body)) });
    }
    if (action === 'start_oauth') {
      return jsonResponse({ success: true, ...(await startGoogleWorkspaceOAuth(request, body)) });
    }
    if (action === 'create_meet_event') {
      return jsonResponse(await createGoogleMeetEvent(request, body));
    }
    if (action === 'disconnect') {
      return jsonResponse(await disconnectGoogleWorkspace(request, body));
    }

    return jsonResponse({ success: false, error: 'Ação Google Workspace inválida.' }, 400);
  } catch (error: any) {
    const message = String(error?.message || 'Falha na integração Google Workspace.');
    const status = /sessão|perfil|outra empresa|acesso|não possui/i.test(message)
      ? 403
      : /não configurado|configure|falta google|encryption_key/i.test(message)
        ? 503
        : 500;
    return jsonResponse({ success: false, error: message }, status);
  }
}
