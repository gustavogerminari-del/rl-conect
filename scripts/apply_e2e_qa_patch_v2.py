from pathlib import Path
import subprocess
import sys

# Reuse the complete patcher. It intentionally stopped at the final Headhunter
# layout cleanup in v1; keep all successful worktree changes and repair that
# final structure here before committing.
result = subprocess.run([sys.executable, 'scripts/apply_e2e_qa_patch.py'])

p = Path('src/components/views/HeadhunterView.tsx')
text = p.read_text(encoding='utf-8')
needle = "\n      </div>\n\n        <button\n          onClick={() => setActiveTab('financeiro')}"
replacement = "\n        <button\n          onClick={() => setActiveTab('financeiro')}"
if needle in text:
    text = text.replace(needle, replacement, 1)
p.write_text(text, encoding='utf-8')

# Assert the important fixes really landed. This turns a silent partial patch
# into a hard CI failure instead of shipping a broken UI.
checks = {
    'src/services/dataService.ts': [
        'getAdmissoesPendentes',
        'getCobrancasHeadhunter',
        'FINANCEIRO_HEADHUNTER',
        'PENDENTE_DOCUMENTOS',
    ],
    'src/components/views/DepartamentoPessoalView.tsx': ['Admissões Pendentes'],
    'src/components/views/HeadhunterView.tsx': ["setActiveTab('financeiro')", 'AGUARDANDO_COBRANCA'],
    'src/components/views/RecruitmentView.tsx': ['Origem:'],
}
for filename, markers in checks.items():
    body = Path(filename).read_text(encoding='utf-8')
    for marker in markers:
        if marker not in body:
            raise SystemExit(f'Missing expected marker {marker!r} in {filename}')

print('E2E QA patch v2 applied and verified')
