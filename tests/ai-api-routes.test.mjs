import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('rotas de IA usadas pelo front existem em app/api', () => {
  for (const path of [
    'app/api/ai/parse-resume/route.ts',
    'app/api/ai/evaluate-candidate/route.ts',
    'app/api/ai/generate-job-description/route.ts',
  ]) {
    assert.equal(fs.existsSync(path), true, `${path} deveria existir`);
    assert.match(read(path), /generateJson/);
  }
});

test('Gemini usa modelo configurável com fallback estável atual', () => {
  const source = read('app/api/ai/_gemini.ts');
  assert.match(source, /GEMINI_MODEL/);
  assert.match(source, /gemini-3\.6-flash/);
  assert.doesNotMatch(source, /Candidato Analisado \(Modo Offline\)/);
});

test('IA publicada falha explicitamente quando não há chave em vez de fingir sucesso', () => {
  const source = read('app/api/ai/_gemini.ts');
  assert.match(source, /GEMINI_API_KEY não está configurada/);
  assert.match(source, /status = .*503/);
});
