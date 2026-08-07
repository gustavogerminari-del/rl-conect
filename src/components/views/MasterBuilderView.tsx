import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  Zap,
  Server,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Rocket,
  Sliders,
  History,
  Layers,
  Code2,
  Plus,
  Trash2,
  Edit3,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  HelpCircle,
  ArrowRight,
  Terminal,
  RefreshCw,
  Copy,
  Lock,
  Globe,
  Layout,
  List,
  Grid,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { aiProviderRegistry, validateAIResponse } from '../../services/aiProviderService';
import {
  OllamaSettings,
  BuilderModule,
  BuilderPage,
  BuilderField,
  BuilderAutomation,
  StructuredAIResponse,
  BuilderVersion,
  AILogExecution,
  UserRole,
} from '../../types';
import { DynamicPage, DynamicAutomationList } from '../builder/DynamicComponents';

export const MasterBuilderView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'prompt_ia' | 'editor_visual' | 'config_ollama' | 'historico_versoes' | 'modulos_automacoes'
  >('prompt_ia');

  // Ollama Settings State
  const [settings, setSettings] = useState<OllamaSettings>(dataService.getOllamaSettings());
  const [testingConn, setTestingConn] = useState(false);
  const [connMessage, setConnMessage] = useState<string | null>(null);

  // Prompt State
  const [promptInput, setPromptInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<StructuredAIResponse | null>(null);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [executionDuration, setExecutionDuration] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<'rascunho' | 'homologacao' | 'producao'>('rascunho');

  // Modules & Versions State
  const [modules, setModules] = useState<BuilderModule[]>(dataService.getBuilderModules());
  const [selectedModule, setSelectedModule] = useState<BuilderModule | null>(modules[0] || null);
  const [versions, setVersions] = useState<BuilderVersion[]>(dataService.getBuilderVersions());
  const [logs, setLogs] = useState<AILogExecution[]>(dataService.getAILogs());

  // Visual Builder Editing Field State
  const [editingField, setEditingField] = useState<BuilderField | null>(null);
  const [showJsonRawModal, setShowJsonRawModal] = useState(false);

  const refreshState = () => {
    setSettings(dataService.getOllamaSettings());
    const mods = dataService.getBuilderModules();
    setModules(mods);
    if (!selectedModule && mods.length > 0) {
      setSelectedModule(mods[0]);
    }
    setVersions(dataService.getBuilderVersions());
    setLogs(dataService.getAILogs());
  };

  useEffect(() => {
    refreshState();
  }, []);

  // Quick prompt suggestions
  const promptExamples = [
    'Crie um módulo de treinamentos com lista de cursos e inscrições.',
    'Adicione o campo salário base e dados bancários na ficha do funcionário.',
    'Crie um relatório executivo de candidatos contratados.',
    'Adicione uma etapa chamada Exame Admissional no pipeline de vagas.',
    'Crie uma automação para avisar quando um documento estiver vencendo.',
    'Mostre o campo salário apenas para o perfil de administrador.',
  ];

  // Test Ollama Connection
  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnMessage(null);
    const provider = aiProviderRegistry.getProvider(settings.provider_ativo);
    const result = await provider.testConnection(settings);
    setTestingConn(false);

    const nextStatus = result.online ? 'online' : 'offline';
    const updated = dataService.updateOllamaSettings({
      status_conexao: nextStatus,
      modelos_instalados: result.models || settings.modelos_instalados,
      ultimo_teste: new Date().toISOString(),
    });
    setSettings(updated);
    setConnMessage(result.message);
  };

  // Run AI Prompt Generation
  const handleRunPrompt = async (selectedPrompt?: string) => {
    const textToRun = selectedPrompt || promptInput;
    if (!textToRun.trim()) return;

    setIsProcessing(true);
    setValidationErrors([]);
    setCurrentResponse(null);

    const provider = aiProviderRegistry.getProvider(settings.provider_ativo);
    const systemContext = dataService.getSystemContextForAI();

    const result = await provider.generateStructure(textToRun, systemContext, settings);
    setIsProcessing(false);
    setExecutionDuration(result.durationMs);

    if (result.success && result.data) {
      setCurrentResponse(result.data);
      setRawResponse(result.raw || JSON.stringify(result.data, null, 2));

      const validation = validateAIResponse(result.data);
      if (!validation.valid) {
        setValidationErrors(validation.errors);
      } else {
        setValidationErrors([]);
      }

      // Log execution
      dataService.addAILog({
        prompt: textToRun,
        modelo: `${settings.modelo_padrao} (${settings.provider_ativo})`,
        duracao_ms: result.durationMs,
        status: validation.valid ? 'sucesso' : 'erro',
        resposta_json: result.data,
        erros_validacao: validation.errors,
        ambiente: activeEnvironment,
      });
      refreshState();
    } else {
      setValidationErrors([result.error || 'Falha ao processar comando com modelo local.']);
    }
  };

  // Apply Action to Environment
  const handleApplyAction = (targetEnv: 'rascunho' | 'homologacao' | 'producao') => {
    if (!currentResponse) return;

    const mod = dataService.applyAIResponseToModule(currentResponse, promptInput, targetEnv);
    setSelectedModule(mod);
    setActiveEnvironment(targetEnv);
    refreshState();

    alert(
      `Sucesso! As alterações geradas pela IA foram aplicadas no ambiente [${targetEnv.toUpperCase()}]. Versão registrada no histórico.`
    );
  };

  // Rollback Version
  const handleRollback = (versionId: string) => {
    if (confirm('Deseja realmente restaurar esta versão anterior do módulo?')) {
      const restored = dataService.restoreBuilderVersion(versionId);
      if (restored) {
        setSelectedModule(restored);
        refreshState();
        alert(`Módulo restaurado com sucesso para a versão anterior.`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <Cpu className="h-6 w-6 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">CONSTRUTOR MASTER COM IA LOCAL</h1>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                  SEM CRÉDITOS PAGO
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Desenvolva e adapte o RL Connect com comandos em linguagem natural via servidor Ollama / Open Source
              </p>
            </div>
          </div>

          {/* Real-time Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Ollama Connection Badge */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border font-bold text-xs ${
                settings.status_conexao === 'online'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  settings.status_conexao === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>
                Servidor: {settings.servidor_url.replace('http://', '')} (
                {settings.status_conexao === 'online' ? 'Ollama OK' : 'Fallback Local'})
              </span>
            </div>

            {/* Active Model Badge */}
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3 py-1.5 text-slate-300 border border-slate-700">
              <Server className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-mono text-[11px] font-bold">{settings.modelo_padrao}</span>
            </div>

            {/* Test Connection Quick Button */}
            <button
              onClick={handleTestConnection}
              disabled={testingConn}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500 transition shadow-xs text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${testingConn ? 'animate-spin' : ''}`} />
              <span>{testingConn ? 'Testando...' : 'Testar Servidor'}</span>
            </button>
          </div>
        </div>

        {connMessage && (
          <div className="mt-4 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{connMessage}</span>
          </div>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white p-2 rounded-2xl border shadow-xs">
        <button
          onClick={() => setActiveTab('prompt_ia')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'prompt_ia'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>1. Prompt & IA Local</span>
        </button>

        <button
          onClick={() => setActiveTab('editor_visual')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'editor_visual'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>2. Editor Visual Drag & Drop</span>
        </button>

        <button
          onClick={() => setActiveTab('config_ollama')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'config_ollama'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server className="h-4 w-4" />
          <span>3. Servidor Ollama & Modelos</span>
        </button>

        <button
          onClick={() => setActiveTab('historico_versoes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'historico_versoes'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>4. Histórico & Versionamento</span>
        </button>

        <button
          onClick={() => setActiveTab('modulos_automacoes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            activeTab === 'modulos_automacoes'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>5. Módulos & Automações</span>
        </button>
      </div>

      {/* TAB 1: PROMPT & IA LOCAL */}
      {activeTab === 'prompt_ia' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Prompt Input & Controls */}
          <div className="lg:col-span-6 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  <span>Comando em Linguagem Natural</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Custo por Prompt: R$ 0,00
                </span>
              </div>

              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Exemplo: 'Crie um módulo de treinamentos com catálogo de cursos, inscrições e notificação automática de alocação.'"
                rows={4}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
              />

              {/* Prompt Quick Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sugestões de Comandos:</span>
                <div className="flex flex-wrap gap-1.5">
                  {promptExamples.map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPromptInput(ex);
                        handleRunPrompt(ex);
                      }}
                      className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition border border-slate-200/80 text-left"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 items-center justify-between">
                <button
                  onClick={() => handleRunPrompt()}
                  disabled={isProcessing || !promptInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{isProcessing ? 'Sintetizando com Modelo Local...' : 'Analisar e Gerar Plano'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPromptInput('');
                      setCurrentResponse(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Pipeline Checkpoints (7-step security) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Validação e Segurança RLS (7 Checkpoints)</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>1. Validação do Esquema JSON</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>2. Permissões de Perfil</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>3. Anti-Injeção SQL & RLS</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>4. Isolamento Multiempresa</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>5. Prévia Interativa Canvas</span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>6. Homologação Segura</span>
                </div>
                <div className="p-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg col-span-2 flex items-center gap-2 font-bold">
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>7. Aprovação do Master com Versionamento Automático</span>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Bloqueio de Segurança Encontrado:</span>
                  </div>
                  {validationErrors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Generated Plan, Canvas & Environment Controls */}
          <div className="lg:col-span-6 space-y-5">
            {currentResponse ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      Ação: {currentResponse.action}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-base mt-1">
                      {currentResponse.module?.name || 'Estrutura Gerada pela IA'}
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowJsonRawModal(!showJsonRawModal)}
                    className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600"
                  >
                    <Code2 className="w-4 h-4" /> Raw JSON
                  </button>
                </div>

                {/* Explanation text */}
                {currentResponse.explanation && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80 italic">
                    "{currentResponse.explanation}"
                  </p>
                )}

                {/* Live Canvas Preview of Generated Module */}
                <div className="space-y-3">
                  <div className="text-xs font-extrabold text-slate-800 flex items-center justify-between">
                    <span>Prévia do Módulo Dinâmico (Canvas Live)</span>
                    <span className="text-[10px] text-slate-400">Tempo de Resposta: {executionDuration}ms</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <DynamicPage
                      module={{
                        id: 'preview_mod',
                        nome: currentResponse.module?.name || 'Módulo Gerado',
                        slug: currentResponse.module?.slug || 'preview',
                        descricao: currentResponse.module?.description || '',
                        icone: currentResponse.module?.icon || 'sparkles',
                        empresa_id: 'emp_1',
                        status: 'rascunho',
                        versao: '1.0.0',
                        criado_em: new Date().toISOString(),
                        atualizado_em: new Date().toISOString(),
                        paginas: (currentResponse.pages || [{ name: 'Listagem', type: 'list' }]).map(
                          (p, idx) => ({
                            id: 'preview_pag_' + idx,
                            nome: p.name,
                            slug: p.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                            type: p.type,
                            campos: (currentResponse.fields || []).map((f, fIdx) => ({
                              id: 'f_prev_' + fIdx,
                              nome: f.name,
                              label: f.label || f.name.replace(/_/g, ' ').toUpperCase(),
                              type: f.type,
                              required: f.required,
                              width: 'half',
                              options: f.options,
                            })),
                            componentes: [],
                            permissoes: ['master_admin', 'empresa_admin'],
                          })
                        ),
                        automacoes: (currentResponse.automations || []).map((a, aIdx) => ({
                          id: 'aut_prev_' + aIdx,
                          nome: a.name,
                          gatilho: a.trigger,
                          acao: a.action,
                          descricao: a.description,
                          ativo: true,
                        })),
                      }}
                    />
                  </div>
                </div>

                {/* Environment Deployment Controls */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Publicar Alterações por Ambiente:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleApplyAction('rascunho')}
                      className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition text-center"
                    >
                      Salvar Rascunho
                    </button>
                    <button
                      onClick={() => handleApplyAction('homologacao')}
                      className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs font-bold hover:bg-blue-100 transition text-center"
                    >
                      Aplicar em Homologação
                    </button>
                    <button
                      onClick={() => handleApplyAction('producao')}
                      className="p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition text-center shadow-xs"
                    >
                      Publicar em Produção
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
                <Cpu className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-sm">Aguardando Comando do Usuário Master</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Digite um comando no campo ao lado para gerar novas páginas, campos, formulários ou automações.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EDITOR VISUAL DRAG & DROP */}
      {activeTab === 'editor_visual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Module & Page Picker */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Selecione o Módulo para Editar</h3>
            <div className="space-y-2">
              {modules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => setSelectedModule(mod)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                    selectedModule?.id === mod.id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div>{mod.nome}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{mod.slug} • v{mod.versao}</div>
                  </div>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border uppercase">
                    {mod.status}
                  </span>
                </button>
              ))}
            </div>

            {selectedModule && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="font-bold text-xs text-slate-800">Adicionar Novo Campo Visual</h4>
                <button
                  onClick={() => {
                    const newField: BuilderField = {
                      id: 'f_' + Date.now(),
                      nome: 'novo_campo_' + Date.now().toString(36).slice(-4),
                      label: 'Novo Campo ' + (selectedModule.paginas[0]?.campos.length + 1 || 1),
                      type: 'text',
                      required: false,
                      width: 'half',
                    };
                    if (selectedModule.paginas.length > 0) {
                      selectedModule.paginas[0].campos.push(newField);
                      dataService.saveBuilderModule(selectedModule);
                      refreshState();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold text-xs py-2 rounded-xl hover:bg-blue-500 transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar Campo ao Form
                </button>
              </div>
            )}
          </div>

          {/* Visual Fields Canvas & Drag/Property Inspector */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            {selectedModule && selectedModule.paginas.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      Campos de {selectedModule.paginas[0].nome}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Altere ordem, obrigatoriedade, rótulo e largura sem consumir solicitações da IA
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    Editor Sem Custo
                  </span>
                </div>

                {/* Fields List with Property Edits */}
                <div className="space-y-3">
                  {selectedModule.paginas[0].campos.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 font-mono">#{idx + 1}</span>
                        <div>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => {
                              field.label = e.target.value;
                              dataService.saveBuilderModule(selectedModule);
                              refreshState();
                            }}
                            className="font-bold text-xs text-slate-900 bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none"
                          />
                          <div className="text-[10px] text-slate-400 mt-0.5">Slug: {field.nome}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <select
                          value={field.type}
                          onChange={(e) => {
                            field.type = e.target.value as any;
                            dataService.saveBuilderModule(selectedModule);
                            refreshState();
                          }}
                          className="bg-white border border-slate-200 text-xs font-semibold rounded-md px-2 py-1"
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="currency">Moeda (R$)</option>
                          <option value="date">Data</option>
                          <option value="select">Seleção</option>
                          <option value="boolean">Sim / Não</option>
                          <option value="textarea">Área de Texto</option>
                        </select>

                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              field.required = e.target.checked;
                              dataService.saveBuilderModule(selectedModule);
                              refreshState();
                            }}
                            className="rounded text-blue-600"
                          />
                          <span>Obrigatório</span>
                        </label>

                        <button
                          onClick={() => {
                            selectedModule.paginas[0].campos = selectedModule.paginas[0].campos.filter(
                              (f) => f.id !== field.id
                            );
                            dataService.saveBuilderModule(selectedModule);
                            refreshState();
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                Selecione um módulo na lista para abrir o editor visual.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SERVIDOR OLLAMA & CONFIGURAÇÕES */}
      {activeTab === 'config_ollama' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span>Configurações do Servidor de IA Local (Ollama)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Gerencie a conexão e os modelos open source executados em infraestrutura própria sem depender de APIs pagas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Server Address */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Endereço do Servidor Ollama</label>
              <input
                type="text"
                value={settings.servidor_url}
                onChange={(e) => setSettings({ ...settings, servidor_url: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400">
                Exemplo local: http://localhost:11434 ou servidor privado: http://servidor-interno:11434
              </span>
            </div>

            {/* Provider Type */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Provedor de IA Ativo</label>
              <select
                value={settings.provider_ativo}
                onChange={(e) => setSettings({ ...settings, provider_ativo: e.target.value as any })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-bold"
              >
                <option value="ollama">OllamaProvider (Local / Private Server)</option>
                <option value="local_ai">LocalAIProvider (OpenAI API Compatível)</option>
                <option value="custom_provider">ProviderPersonalizado (Inference GPU)</option>
              </select>
            </div>

            {/* Default Model */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Modelo Padrão Selecionado</label>
              <select
                value={settings.modelo_padrao}
                onChange={(e) => setSettings({ ...settings, modelo_padrao: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-bold font-mono"
              >
                {settings.modelos_instalados.map((m, i) => (
                  <option key={i} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Programming Model */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Modelo Especializado em Código</label>
              <select
                value={settings.modelo_programacao}
                onChange={(e) => setSettings({ ...settings, modelo_programacao: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
              >
                {settings.modelos_instalados.map((m, i) => (
                  <option key={i} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Context Limit */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Limite de Janela de Contexto: <span className="text-blue-600">{settings.limite_contexto} tokens</span>
              </label>
              <input
                type="range"
                min={4096}
                max={32768}
                step={4096}
                value={settings.limite_contexto}
                onChange={(e) => setSettings({ ...settings, limite_contexto: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Timeout */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Tempo Máximo de Resposta: <span className="text-blue-600">{settings.timeout_ms / 1000}s</span>
              </label>
              <input
                type="range"
                min={10000}
                max={120000}
                step={10000}
                value={settings.timeout_ms}
                onChange={(e) => setSettings({ ...settings, timeout_ms: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleTestConnection}
              disabled={testingConn}
              className="px-4 py-2 bg-slate-100 text-slate-800 font-bold text-xs rounded-xl hover:bg-slate-200 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${testingConn ? 'animate-spin' : ''}`} />
              <span>Testar Conexão</span>
            </button>

            <button
              onClick={() => {
                dataService.updateOllamaSettings(settings);
                alert('Configurações do Ollama salvas com sucesso!');
              }}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 shadow-xs flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Salvar Configurações
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: HISTÓRICO & VERSIONAMENTO */}
      {activeTab === 'historico_versoes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Histórico de Versões Publicadas</h3>
                <p className="text-xs text-slate-500">
                  Rastreabilidade total de alterações com suporte a Rollback ("RESTAURAR VERSÃO ANTERIOR")
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="p-3">Versão</th>
                    <th className="p-3">Prompt Original</th>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">Ambiente</th>
                    <th className="p-3">Data</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((ver) => (
                    <tr key={ver.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold font-mono text-blue-600">v{ver.versao}</td>
                      <td className="p-3 font-medium text-slate-800 max-w-xs truncate">
                        {ver.prompt_original}
                      </td>
                      <td className="p-3 text-slate-600">{ver.usuario_nome}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 border">
                          {ver.ambiente}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(ver.data).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRollback(ver.id)}
                          className="flex items-center gap-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-bold ml-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> RESTAURAR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MÓDULOS & AUTOMAÇÕES */}
      {activeTab === 'modulos_automacoes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="font-extrabold text-slate-900 text-sm">Automações Ativas no Sistema</h3>
            {selectedModule && (
              <DynamicAutomationList automations={selectedModule.automacoes} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
