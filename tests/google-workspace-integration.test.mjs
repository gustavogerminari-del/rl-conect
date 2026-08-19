import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('Agenda não usa link fictício e chama serviço real do Google Workspace', () => {
  const source = read('src/components/views/AgendaView.tsx');
  assert.doesNotMatch(source, /meet\.google\.com\/abc-defg-hij/);
  assert.match(source, /googleWorkspaceService\.createMeetEvent/);
  assert.match(source, /googleWorkspaceService\.connect/);
  assert.match(source, /PENDING_MEET_KEY/);
  assert.match(source, /sincronizado_gcal:\s*sincronizadoGcal/);
});

test('backend Google usa OAuth com PKCE e cria Meet pelo Calendar', () => {
  const source = read('app/api/google/workspace/_shared.ts');
  assert.match(source, /code_challenge_method:\s*'S256'/);
  assert.match(source, /code_verifier/);
  assert.match(source, /GOOGLE_OAUTH_STATE_SECRET/);
  assert.match(source, /GOOGLE_WORKSPACE_ENCRYPTION_KEY/);
  assert.match(source, /conferenceDataVersion=1/);
  assert.match(source, /conferenceSolutionKey:\s*\{\s*type:\s*'hangoutsMeet'/);
  assert.match(source, /sendUpdates=all/);
});

test('callback OAuth retorna para Agenda', () => {
  const callback = read('app/api/google/workspace/callback/route.ts');
  const app = read('src/App.tsx');
  assert.match(callback, /handleGoogleWorkspaceCallback/);
  assert.match(app, /tabFromUrl/);
  assert.match(app, /'agenda'/);
});
