from pathlib import Path
import re
p=Path('src/components/views/PublicCompanyPortal.tsx')
t=p.read_text(encoding='utf-8')
if "PublicApplicationService" not in t:
    t=t.replace("import { dataService } from '../../services/dataService';\n", "import { dataService } from '../../services/dataService';\nimport { PublicApplicationService } from '../../services/PublicApplicationService';\n")

job_pattern=r"  const handleApplyToJob = \(e: React\.FormEvent\) => \{.*?\n  \};\n\n  const handleApplyToTalentPool"
job_replacement="""  const handleApplyToJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVaga || !empresa || !nomeForm || !emailForm || !aceiteLgpd) return;
    setIsSubmitting(true);
    try {
      await PublicApplicationService.applyToJob(empresa.id, selectedVaga.id, {
        nome: nomeForm,
        email: emailForm,
        telefone: telefoneForm,
        cidade: cidadeForm || empresa.cidade,
        estado: estadoForm,
        cargo_desejado: selectedVaga.titulo,
        linkedin_url: linkedinForm,
        pretensao_salarial: pretensaoForm,
        observacoes: observacoesForm,
        curriculo_texto: curriculoTexto,
      }, curriculoFile, aceiteLgpd);
      setSubmissionSuccess(true);
    } catch (err) {
      console.error('Error submitting application:', err);
      alert(err instanceof Error ? err.message : 'Não foi possível enviar a candidatura.');
    } finally { setIsSubmitting(false); }
  };

  const handleApplyToTalentPool"""
t,n=re.subn(job_pattern,job_replacement,t,flags=re.S)
if n!=1: raise SystemExit(f'job handler replacement count={n}')

talent_pattern=r"  const handleApplyToTalentPool = \(e: React\.FormEvent\) => \{.*?\n  \};\n\n  const handleCopyPortalLink"
talent_replacement="""  const handleApplyToTalentPool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa || !nomeForm || !emailForm || !aceiteLgpd) return;
    setIsSubmitting(true);
    try {
      await PublicApplicationService.applyToTalentPool(empresa.id, {
        nome: nomeForm,
        email: emailForm,
        telefone: telefoneForm,
        cidade: cidadeForm || empresa.cidade,
        estado: estadoForm,
        cargo_desejado: 'Banco de Talentos / Oportunidades Futuras',
        linkedin_url: linkedinForm,
        pretensao_salarial: pretensaoForm,
        observacoes: observacoesForm,
        curriculo_texto: curriculoTexto,
      }, curriculoFile, aceiteLgpd);
      setSubmissionSuccess(true);
    } catch (err) {
      console.error('Error submitting to talent pool:', err);
      alert(err instanceof Error ? err.message : 'Não foi possível enviar o currículo.');
    } finally { setIsSubmitting(false); }
  };

  const handleCopyPortalLink"""
t,n=re.subn(talent_pattern,talent_replacement,t,flags=re.S)
if n!=1: raise SystemExit(f'talent handler replacement count={n}')

# Object URLs are previews only; never persist them as resume URLs.
t=t.replace("    // Create a local object URL or Base64 data for the file\n    const fileUrl = URL.createObjectURL(file);\n    setCurriculoUrl(fileUrl);\n", "    // Local URL is preview-only. The actual file is uploaded by the Firebase Admin public endpoint.\n    const fileUrl = URL.createObjectURL(file);\n    setCurriculoUrl(fileUrl);\n")
p.write_text(t,encoding='utf-8')
print('Public portal migrated to Firebase Admin API.')
