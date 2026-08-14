from pathlib import Path
p = Path('src/services/dataService.ts')
t = p.read_text(encoding='utf-8')
t = t.replace("        id: 'em_' + Date.now() + '_' + m.chave,\n        empresa_id: newEmp.id,", "        id: stableEntityId('em', `${newEmp.id}:${m.id}`),\n        empresa_id: newEmp.id,")
# Also harden toggle creation path if present.
t = t.replace("        id: 'em_' + Date.now(),\n        empresa_id: empresaId,\n        modulo_id: moduloId,", "        id: stableEntityId('em', `${empresaId}:${moduloId}`),\n        empresa_id: empresaId,\n        modulo_id: moduloId,")
p.write_text(t, encoding='utf-8')

p = Path('scripts/qa-no-duplicate-business-entities.ts')
t = p.read_text(encoding='utf-8')
t = t.replace("    assert.match(x, /duplicidade evitada/);", "    assert.match(x, /stableEntityId\\('emp'/);\n    assert.match(x, /stableEntityId\\('em', `\\$\\{newEmp\\.id\\}:\\$\\{m\\.id\\}`\\)/);")
p.write_text(t, encoding='utf-8')
print('Company/module dedupe hardened.')
