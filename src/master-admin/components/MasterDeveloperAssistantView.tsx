import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bot, CheckCircle2, Code2, ExternalLink, FileCode2, KeyRound, Loader2, Play, Save, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { auth, db } from '../../lib/firebase';

type SourceFile = { path: string; size: number };
type AiResult = {
  message?: string;
  revisedContent?: string | null;
  affectedFiles?: string[];
  tests?: string[];
  warnings?: string[];
};
type ProviderChoice = 'gemini_free' | 'gemini_paid' | 'openai';
type KeyProvider = 'gemini' | 'openai';

async function authHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sessão Firebase MASTER/DEV não encontrada.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const draftId = (path: string) => encodeURIComponent(path).replaceAll('.', '%2E');

export const MasterDeveloperAssistantView: React.FC = () => {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [filter, setFilter] = useState('');
  const [activePath, setActivePath] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openAiConfigured, setOpenAiConfigured] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice>('gemini_free');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyProvider, setKeyProvider] = useState<KeyProvider>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/developer/assistant', { headers: await authHeaders() });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os arquivos.');
        const safeFiles: SourceFile[] = Array.isArray(payload.files)
          ? payload.files
              .map((file: any) => ({ path: String(file?.path || ''), size: Number(file?.size || 0) }))
              .filter((file: SourceFile) => file.path.length > 0)
          : [];
        setFiles(safeFiles);
        const openAiReady = Boolean(payload.providers?.openai ?? payload.openAiConfigured);
        const geminiReady = Boolean(payload.providers?.gemini ?? payload.geminiConfigured);
        setOpenAiConfigured(openAiReady);
        setGeminiConfigured(geminiReady);
        setSelectedProvider(geminiReady ? 'gemini_free' : openAiReady ? 'openai' : 'gemini_free');
        if (safeFiles[0]?.path) setActivePath(safeFiles[0].path);
      } catch (error: any) {
        setNotice({ type: 'error', text: error?.message || 'Falha ao abrir o ambiente de desenvolvimento.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activePath || !auth.currentUser) return;
    void (async () => {
      setLoadingFile(true);
      setNotice(null);
      try {
        const [response, savedDraft] = await Promise.all([
          fetch(`/api/developer/assistant?path=${encodeURIComponent(activePath)}`, { headers: await authHeaders() }),
          getDoc(doc(db, 'developer_code_drafts', `developer_draft_${auth.currentUser!.uid}_${draftId(activePath)}`)),
        ]);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Arquivo não encontrado.');
        const original = String(payload.file?.content || '');
        setSourceContent(original);
        setDraftContent(savedDraft.exists() ? String(savedDraft.data().content || original) : original);
        setResult(null);
      } catch (error: any) {
        setNotice({ type: 'error', text: error?.message || 'Não foi possível abrir o arquivo.' });
      } finally {
        setLoadingFile(false);
      }
    })();
  }, [activePath]);

  const filteredFiles = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return term ? files.filter(file => String(file.path || '').toLowerCase().includes(term)) : files;
  }, [files, filter]);

  const saveDraft = async (content = draftContent, successText = 'Rascunho salvo com sucesso.') => {
    if (!auth.currentUser || !activePath) return;
    setSaving(true);
    setNotice(null);
    try {
      await setDoc(doc(db, 'developer_code_drafts', `developer_draft_${auth.currentUser.uid}_${draftId(activePath)}`), {
        id: `developer_draft_${auth.currentUser.uid}_${draftId(activePath)}`,
        documentType: 'DEVELOPER_CODE_DRAFT',
        companyId: 'GLOBAL',
        path: activePath,
        content,
        originalContent: sourceContent,
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setNotice({ type: 'success', text: successText });
    } catch (error: any) {
      setNotice({ type: 'error', text: error?.message || 'Não foi possível salvar o rascunho no Firebase.' });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const askAi = async () => {
    if (!prompt.trim() || !activePath) return;
    setAsking(true);
    setNotice(null);
    try {
      await saveDraft(draftContent, 'Rascunho salvo antes da análise.');
      const response = await fetch('/api/developer/assistant', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          prompt,
          activePath,
          draftContent,
          provider: selectedProvider.startsWith('gemini') ? 'gemini' : 'openai',
          geminiTier: selectedProvider === 'gemini_paid' ? 'paid' : selectedProvider === 'gemini_free' ? 'free' : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'A IA não conseguiu analisar o pedido.');
      setResult(payload.result || {});
      setNotice({ type: 'success', text: payload.fallbackMessage || 'Análise concluída. Revise antes de aplicar ao rascunho.' });
    } catch (error: any) {
      setNotice({ type: 'error', text: error?.message || 'Falha ao consultar a IA.' });
    } finally {
      setAsking(false);
    }
  };

  const applySuggestion = async () => {
    if (!result?.revisedContent) return;
    setDraftContent(result.revisedContent);
    await saveDraft(result.revisedContent, 'Sugestão aplicada e salva como rascunho.');
  };

  const configureProvider = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    setNotice(null);
    try {
      const response = await fetch('/api/developer/assistant', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'configure_provider_key', provider: keyProvider, apiKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Não foi possível conectar ${keyProvider === 'openai' ? 'a OpenAI' : 'o Gemini'}.`);
      setApiKey('');
      if (keyProvider === 'openai') {
        setOpenAiConfigured(true);
        setSelectedProvider('openai');
      } else {
        setGeminiConfigured(true);
        setSelectedProvider('gemini_free');
      }
      setShowKeyModal(false);
      setNotice({ type: 'success', text: `${keyProvider === 'openai' ? 'OpenAI conectada' : 'Google AI Studio / Gemini conectado'} com segurança.` });
    } catch (error: any) {
      setNotice({ type: 'error', text: error?.message || 'Falha ao conectar a IA.' });
    } finally {
      setSavingKey(false);
    }
  };

  const selectedConfigured = selectedProvider === 'openai' ? openAiConfigured : geminiConfigured;
  const selectedLabel = selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'gemini_paid' ? 'Gemini pago' : 'Gemini gratuito';

  const openKeyModal = (provider: KeyProvider) => {
    setKeyProvider(provider);
    setApiKey('');
    setShowKeyModal(true);
  };

  if (loading) return <div className="min-h-[500px] flex items-center justify-center text-slate-300"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Preparando arquivos do projeto...</div>;

  return (
    <div className="space-y-4 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2"><Code2 className="w-5 h-5 text-amber-400" /> Assistente de Desenvolvimento</h2>
          <p className="text-xs text-slate-400 mt-1">Edição de código assistida por Google AI Studio / Gemini para usuários MASTER e DESENVOLVEDOR autenticados pelo Firebase.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-200 flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Abrir Google AI Studio</a>
          <button onClick={() => openKeyModal('gemini')} className={`px-3 py-2 rounded-xl border flex items-center gap-1 ${geminiConfigured ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}><KeyRound className="w-4 h-4" /> {geminiConfigured ? 'Google AI Studio conectado' : 'Conectar Gemini / AI Studio'}</button>
          <button onClick={() => openKeyModal('openai')} className={`px-3 py-2 rounded-xl border flex items-center gap-1 ${openAiConfigured ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}><KeyRound className="w-4 h-4" /> {openAiConfigured ? 'OpenAI conectada' : 'Conectar OpenAI'}</button>
          <span className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Chave somente no backend</span>
          <span className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">Rascunho — não publica sozinho</span>
        </div>
      </div>

      {notice && <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${notice.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{notice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <TriangleAlert className="w-4 h-4" />}{notice.text}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_360px] gap-4 min-h-[650px]">
        <aside className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Buscar arquivo..." className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-500" /></div></div>
          <div className="flex-1 overflow-y-auto max-h-[650px] p-2 space-y-1">
            {filteredFiles.map(file => <button key={file.path} onClick={() => setActivePath(file.path)} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-start gap-2 ${activePath === file.path ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:bg-slate-800'}`}><FileCode2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="break-all">{file.path}</span></button>)}
          </div>
        </aside>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-w-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-3"><span className="font-mono text-xs text-amber-300 truncate">{activePath}</span><button disabled={saving || loadingFile} onClick={() => void saveDraft()} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho</button></div>
          {loadingFile ? <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Abrindo arquivo...</div> : <textarea spellCheck={false} value={draftContent} onChange={event => setDraftContent(event.target.value)} className="flex-1 min-h-[600px] w-full resize-none bg-[#08111f] text-slate-200 font-mono text-[12px] leading-5 p-4 outline-none" />}
        </section>

        <aside className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800"><h3 className="font-black flex items-center gap-2"><Bot className="w-5 h-5 text-amber-400" /> Chat de programação</h3><p className="text-[11px] text-slate-400 mt-1">A IA analisa o arquivo aberto e outros arquivos relacionados.</p></div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[480px]">
            {result ? <><div className="text-xs text-slate-200 whitespace-pre-wrap leading-5">{result.message || 'Análise concluída.'}</div>{result.affectedFiles?.length ? <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Arquivos relacionados</p>{result.affectedFiles.map(path => <p key={path} className="text-[11px] font-mono text-amber-300 break-all">{path}</p>)}</div> : null}{result.tests?.length ? <div><p className="text-[10px] font-black uppercase text-slate-500 mb-1">Testes sugeridos</p>{result.tests.map(test => <p key={test} className="text-[11px] text-slate-300">• {test}</p>)}</div> : null}{result.warnings?.length ? <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">{result.warnings.map(warning => <p key={warning} className="text-[11px] text-amber-200">• {warning}</p>)}</div> : null}{result.revisedContent ? <button onClick={() => void applySuggestion()} className="w-full p-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">Aplicar ao rascunho e salvar</button> : null}</> : <div className="text-xs text-slate-500">Descreva uma correção, melhoria ou dúvida sobre o código selecionado.</div>}
          </div>
          <div className="p-4 border-t border-slate-800 space-y-3">
            <label className="block"><span className="text-[10px] uppercase font-black text-slate-500">IA utilizada</span><select value={selectedProvider} onChange={event => setSelectedProvider(event.target.value as ProviderChoice)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs outline-none focus:border-amber-500"><option value="gemini_free">Gemini gratuito</option><option value="gemini_paid">Gemini pago</option><option value="openai">OpenAI</option></select></label>
            {selectedProvider === 'gemini_free' && <p className="text-[10px] text-emerald-300">Usa a cota gratuita disponível na conta Google, sujeita aos limites do Google.</p>}
            {selectedProvider === 'gemini_paid' && <p className="text-[10px] text-amber-300">Usa a mesma chave Gemini com faturamento ativado na conta Google.</p>}
            <textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={5} placeholder="Ex.: encontre por que este botão abre uma tela branca e proponha a correção sem alterar o layout..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs resize-none outline-none focus:border-amber-500" />
            <button disabled={asking || !prompt.trim() || !selectedConfigured} onClick={() => void askAi()} className="w-full p-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50">{asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{asking ? `Analisando com ${selectedLabel}...` : selectedConfigured ? `Analisar com ${selectedLabel}` : `Conecte ${selectedProvider === 'openai' ? 'a OpenAI' : 'o Gemini'} primeiro`}</button>
          </div>
        </aside>
      </div>

      {showKeyModal && <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-black flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-400" /> Conectar {keyProvider === 'openai' ? 'OpenAI' : 'Google AI Studio / Gemini'}</h3><p className="text-xs text-slate-400 mt-1">A chave será enviada ao backend e armazenada criptografada.</p></div><button onClick={() => { setShowKeyModal(false); setApiKey(''); }} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-4 h-4" /></button></div><div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200">{keyProvider === 'openai' ? 'Crie a chave em platform.openai.com.' : 'Crie sua chave no Google AI Studio e cole abaixo. A mesma chave funciona no modo gratuito ou pago, conforme o faturamento da conta Google.'} Não envie a chave por ChatGPT, e-mail ou WhatsApp.</div>{keyProvider === 'gemini' && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs font-black text-violet-200 hover:bg-violet-500/20"><ExternalLink className="h-4 w-4" />Criar/copiar chave no Google AI Studio</a>}<input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={keyProvider === 'openai' ? 'sk-...' : 'AIza...'} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-mono outline-none focus:border-amber-500" /><div className="flex justify-end gap-2"><button onClick={() => { setShowKeyModal(false); setApiKey(''); }} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold">Cancelar</button><button disabled={savingKey || !apiKey.trim()} onClick={() => void configureProvider()} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-50">{savingKey ? 'Validando no Google...' : 'Validar, salvar e conectar'}</button></div></div></div>}
    </div>
  );
};
