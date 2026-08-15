import React, { useMemo, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  AlignCenter,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  Image,
  Layers3,
  Loader2,
  Monitor,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

type DeviceKey = 'desktop' | 'tablet' | 'mobile';
type EditorMode = 'edit' | 'preview';
type NodeKind = 'text' | 'button' | 'card' | 'input' | 'image';

type VisualNode = {
  id: string;
  kind: NodeKind;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  color: string;
  fontSize: number;
  radius: number;
  visible: boolean;
};

type PageKey = 'dashboard' | 'vagas' | 'banco-talentos' | 'portal-vagas' | 'acesso-master';

const DEVICES: Record<DeviceKey, { label: string; width: number; height: number; Icon: React.ElementType }> = {
  desktop: { label: 'Desktop', width: 1180, height: 720, Icon: Monitor },
  tablet: { label: 'Tablet', width: 768, height: 820, Icon: Tablet },
  mobile: { label: 'Mobile', width: 390, height: 844, Icon: Smartphone },
};

const BASE_NODES: Record<PageKey, VisualNode[]> = {
  dashboard: [
    { id: 'title', kind: 'text', name: 'Título principal', text: 'Visão Geral', x: 56, y: 44, width: 330, height: 54, background: 'transparent', color: '#0f172a', fontSize: 34, radius: 0, visible: true },
    { id: 'subtitle', kind: 'text', name: 'Subtítulo', text: 'Acompanhe os principais indicadores da sua empresa.', x: 58, y: 102, width: 520, height: 32, background: 'transparent', color: '#64748b', fontSize: 15, radius: 0, visible: true },
    { id: 'action', kind: 'button', name: 'Ação rápida', text: '+ Nova vaga', x: 928, y: 49, width: 174, height: 46, background: '#1d4f7a', color: '#ffffff', fontSize: 14, radius: 12, visible: true },
    { id: 'search', kind: 'input', name: 'Busca', text: 'Buscar candidato, vaga ou competência...', x: 56, y: 158, width: 1046, height: 50, background: '#ffffff', color: '#64748b', fontSize: 14, radius: 12, visible: true },
    { id: 'card-vagas', kind: 'card', name: 'Card Vagas', text: 'Vagas ativas\n12', x: 56, y: 242, width: 238, height: 138, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'card-candidatos', kind: 'card', name: 'Card Candidatos', text: 'Candidatos\n184', x: 318, y: 242, width: 238, height: 138, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'card-entrevistas', kind: 'card', name: 'Card Entrevistas', text: 'Entrevistas\n8', x: 580, y: 242, width: 238, height: 138, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'card-contratacoes', kind: 'card', name: 'Card Contratações', text: 'Contratações\n4', x: 842, y: 242, width: 260, height: 138, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
  ],
  vagas: [
    { id: 'title', kind: 'text', name: 'Título principal', text: 'Vagas', x: 56, y: 44, width: 260, height: 52, background: 'transparent', color: '#0f172a', fontSize: 34, radius: 0, visible: true },
    { id: 'subtitle', kind: 'text', name: 'Subtítulo', text: 'Crie, publique e acompanhe seus processos seletivos.', x: 58, y: 102, width: 520, height: 32, background: 'transparent', color: '#64748b', fontSize: 15, radius: 0, visible: true },
    { id: 'new-job', kind: 'button', name: 'Nova vaga', text: '+ Criar nova vaga', x: 890, y: 48, width: 212, height: 48, background: '#1d4f7a', color: '#ffffff', fontSize: 14, radius: 12, visible: true },
    { id: 'filters', kind: 'input', name: 'Filtros', text: 'Buscar por cargo, cidade ou status...', x: 56, y: 158, width: 1046, height: 50, background: '#ffffff', color: '#64748b', fontSize: 14, radius: 12, visible: true },
    { id: 'job-card-1', kind: 'card', name: 'Vaga 1', text: 'Analista de Logística\nLondrina • Presencial', x: 56, y: 244, width: 324, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'job-card-2', kind: 'card', name: 'Vaga 2', text: 'Assistente de RH\nLondrina • Híbrido', x: 404, y: 244, width: 324, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'job-card-3', kind: 'card', name: 'Vaga 3', text: 'Executivo Comercial\nCuritiba • Remoto', x: 752, y: 244, width: 350, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
  ],
  'banco-talentos': [
    { id: 'title', kind: 'text', name: 'Título principal', text: 'Banco de Talentos', x: 56, y: 44, width: 430, height: 52, background: 'transparent', color: '#0f172a', fontSize: 34, radius: 0, visible: true },
    { id: 'subtitle', kind: 'text', name: 'Subtítulo', text: 'Encontre candidatos e organize seus talentos.', x: 58, y: 102, width: 520, height: 32, background: 'transparent', color: '#64748b', fontSize: 15, radius: 0, visible: true },
    { id: 'search', kind: 'input', name: 'Busca de talentos', text: 'Buscar nome, cargo ou competência...', x: 56, y: 158, width: 1046, height: 50, background: '#ffffff', color: '#64748b', fontSize: 14, radius: 12, visible: true },
    { id: 'candidate-1', kind: 'card', name: 'Candidato 1', text: 'Mariana Souza\nAnalista de RH', x: 56, y: 244, width: 324, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'candidate-2', kind: 'card', name: 'Candidato 2', text: 'Lucas Martins\nAnalista de Logística', x: 404, y: 244, width: 324, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'candidate-3', kind: 'card', name: 'Candidato 3', text: 'Amanda Ribeiro\nExecutiva Comercial', x: 752, y: 244, width: 350, height: 170, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
  ],
  'portal-vagas': [
    { id: 'portal-header', kind: 'card', name: 'Cabeçalho do portal', text: 'RL CONNECT', x: 0, y: 0, width: 1180, height: 82, background: '#ffffff', color: '#123657', fontSize: 18, radius: 0, visible: true },
    { id: 'portal-logo', kind: 'text', name: 'Nome / logo', text: 'RL CONNECT', x: 42, y: 18, width: 210, height: 48, background: 'transparent', color: '#123657', fontSize: 22, radius: 0, visible: true },
    { id: 'portal-menu', kind: 'text', name: 'Menu do portal', text: 'Início   Vagas   Empresas   Soluções   Sobre   Contato', x: 310, y: 24, width: 550, height: 38, background: 'transparent', color: '#334155', fontSize: 13, radius: 0, visible: true },
    { id: 'portal-login', kind: 'button', name: 'Botão Entrar', text: 'Entrar', x: 1010, y: 18, width: 128, height: 46, background: '#123657', color: '#ffffff', fontSize: 14, radius: 12, visible: true },
    { id: 'portal-title', kind: 'text', name: 'Título principal', text: 'Conectando talentos às melhores oportunidades', x: 70, y: 126, width: 720, height: 106, background: 'transparent', color: '#123657', fontSize: 42, radius: 0, visible: true },
    { id: 'portal-subtitle', kind: 'text', name: 'Texto de apresentação', text: 'Encontre vagas, cadastre seu currículo e conecte-se às melhores empresas.', x: 72, y: 238, width: 700, height: 48, background: 'transparent', color: '#64748b', fontSize: 17, radius: 0, visible: true },
    { id: 'portal-search', kind: 'input', name: 'Busca de vagas', text: 'Cargo, palavra-chave ou cidade...', x: 70, y: 304, width: 770, height: 54, background: '#ffffff', color: '#64748b', fontSize: 14, radius: 14, visible: true },
    { id: 'portal-search-button', kind: 'button', name: 'Botão Buscar Vagas', text: 'Buscar Vagas', x: 860, y: 304, width: 210, height: 54, background: '#1d4f7a', color: '#ffffff', fontSize: 15, radius: 14, visible: true },
    { id: 'portal-candidate', kind: 'button', name: 'Cadastrar currículo', text: 'Cadastrar Currículo', x: 70, y: 386, width: 230, height: 50, background: '#1d4f7a', color: '#ffffff', fontSize: 14, radius: 13, visible: true },
    { id: 'portal-company', kind: 'button', name: 'Área para empresas', text: 'Anunciar Vaga', x: 320, y: 386, width: 210, height: 50, background: '#ffffff', color: '#123657', fontSize: 14, radius: 13, visible: true },
    { id: 'portal-stat-jobs', kind: 'card', name: 'Indicador Vagas', text: 'Vagas abertas\n0', x: 70, y: 484, width: 230, height: 124, background: '#ffffff', color: '#123657', fontSize: 16, radius: 18, visible: true },
    { id: 'portal-stat-companies', kind: 'card', name: 'Indicador Empresas', text: 'Empresas verificadas\nConectadas', x: 320, y: 484, width: 230, height: 124, background: '#ffffff', color: '#123657', fontSize: 16, radius: 18, visible: true },
    { id: 'portal-stat-ai', kind: 'card', name: 'Indicador IA', text: 'RL Connect IA\nMatch inteligente', x: 570, y: 484, width: 230, height: 124, background: '#ffffff', color: '#123657', fontSize: 16, radius: 18, visible: true },
    { id: 'portal-image', kind: 'image', name: 'Imagem principal', text: 'Imagem do Portal', x: 840, y: 462, width: 270, height: 170, background: '#e2e8f0', color: '#64748b', fontSize: 13, radius: 22, visible: true },
  ],
  'acesso-master': [
    { id: 'title', kind: 'text', name: 'Título principal', text: 'Painel Master RL Connect', x: 56, y: 44, width: 500, height: 52, background: 'transparent', color: '#0f172a', fontSize: 32, radius: 0, visible: true },
    { id: 'subtitle', kind: 'text', name: 'Subtítulo', text: 'Controle administrativo central da plataforma.', x: 58, y: 102, width: 520, height: 32, background: 'transparent', color: '#64748b', fontSize: 15, radius: 0, visible: true },
    { id: 'refresh', kind: 'button', name: 'Atualizar dados', text: 'Atualizar dados', x: 912, y: 49, width: 190, height: 46, background: '#0f172a', color: '#ffffff', fontSize: 14, radius: 12, visible: true },
    { id: 'companies', kind: 'card', name: 'Empresas', text: 'Empresas cadastradas\n4', x: 56, y: 170, width: 324, height: 148, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'users', kind: 'card', name: 'Usuários', text: 'Usuários ativos\n5', x: 404, y: 170, width: 324, height: 148, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
    { id: 'finance', kind: 'card', name: 'Financeiro', text: 'Contas a receber\nR$ 0,00', x: 752, y: 170, width: 350, height: 148, background: '#ffffff', color: '#0f172a', fontSize: 16, radius: 18, visible: true },
  ],
};

const cloneNodes = (nodes: VisualNode[]) => nodes.map(node => ({ ...node }));
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const panelClass = 'border border-slate-800 bg-slate-950/95';
const inputClass = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-500';
const toolButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40';

export function VisualBuilder() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [device, setDevice] = useState<DeviceKey>('desktop');
  const [mode, setMode] = useState<EditorMode>('edit');
  const [nodes, setNodes] = useState<VisualNode[]>(() => cloneNodes(BASE_NODES.dashboard));
  const [selectedId, setSelectedId] = useState<string>('title');
  const [zoom, setZoom] = useState(0.75);
  const [showGrid, setShowGrid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<VisualNode[][]>(() => [cloneNodes(BASE_NODES.dashboard)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);

  const canvas = DEVICES[device];
  const selected = nodes.find(node => node.id === selectedId) || null;

  const commitNodes = (next: VisualNode[]) => {
    const snapshot = cloneNodes(next);
    const nextHistory = [...history.slice(0, historyIndex + 1), snapshot].slice(-60);
    setNodes(snapshot);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const updateSelected = (patch: Partial<VisualNode>) => {
    if (!selected) return;
    commitNodes(nodes.map(node => node.id === selected.id ? { ...node, ...patch } : node));
  };

  const switchPage = (nextPage: PageKey) => {
    const next = cloneNodes(BASE_NODES[nextPage]);
    setPage(nextPage);
    setNodes(next);
    setHistory([next]);
    setHistoryIndex(0);
    setSelectedId(next[0]?.id || '');
    setNotice(null);
  };

  const switchDevice = (nextDevice: DeviceKey) => {
    if (nextDevice === device) return;
    const currentCanvas = DEVICES[device];
    const nextCanvas = DEVICES[nextDevice];
    const ratioX = nextCanvas.width / currentCanvas.width;
    const ratioY = nextCanvas.height / currentCanvas.height;
    const next = nodes.map(node => ({
      ...node,
      x: Math.round(node.x * ratioX),
      y: Math.round(node.y * ratioY),
      width: Math.max(24, Math.round(node.width * ratioX)),
      height: Math.max(20, Math.round(node.height * ratioY)),
    }));
    setDevice(nextDevice);
    commitNodes(next);
    setNotice({ tone: 'warning', text: `Layout adaptado para ${nextCanvas.label}. Revise os elementos antes de salvar.` });
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setNodes(cloneNodes(history[nextIndex]));
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setNodes(cloneNodes(history[nextIndex]));
  };

  const addNode = (kind: NodeKind) => {
    const id = `${kind}-${Date.now()}`;
    const node: VisualNode = {
      id,
      kind,
      name: kind === 'text' ? 'Novo texto' : kind === 'button' ? 'Novo botão' : kind === 'image' ? 'Nova imagem' : 'Novo card',
      text: kind === 'text' ? 'Digite seu texto' : kind === 'button' ? 'Novo botão' : kind === 'input' ? 'Campo de busca...' : kind === 'image' ? 'Imagem' : 'Novo card',
      x: 80 + (nodes.length % 5) * 28,
      y: 430 + (nodes.length % 4) * 24,
      width: kind === 'text' ? 260 : kind === 'button' ? 160 : kind === 'input' ? 320 : 220,
      height: kind === 'text' ? 50 : kind === 'button' ? 46 : kind === 'input' ? 48 : 130,
      background: kind === 'text' ? 'transparent' : kind === 'button' ? '#1d4f7a' : '#ffffff',
      color: kind === 'button' ? '#ffffff' : '#0f172a',
      fontSize: 15,
      radius: kind === 'text' ? 0 : 12,
      visible: true,
    };
    commitNodes([...nodes, node]);
    setSelectedId(id);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `${selected.kind}-${Date.now()}`, name: `${selected.name} cópia`, x: selected.x + 24, y: selected.y + 24 };
    commitNodes([...nodes, copy]);
    setSelectedId(copy.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const next = nodes.filter(node => node.id !== selected.id);
    commitNodes(next);
    setSelectedId(next.at(-1)?.id || '');
  };

  const moveLayer = (direction: -1 | 1) => {
    if (!selected) return;
    const current = nodes.findIndex(node => node.id === selected.id);
    const target = clamp(current + direction, 0, nodes.length - 1);
    if (target === current) return;
    const next = [...nodes];
    const [node] = next.splice(current, 1);
    next.splice(target, 0, node);
    commitNodes(next);
  };

  const pointerDown = (event: React.PointerEvent, node: VisualNode) => {
    if (mode !== 'edit') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(node.id);
    dragRef.current = { id: node.id, startX: event.clientX, startY: event.clientY, nodeX: node.x, nodeY: node.y };
  };

  const pointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || mode !== 'edit') return;
    const deltaX = (event.clientX - drag.startX) / zoom;
    const deltaY = (event.clientY - drag.startY) / zoom;
    setNodes(current => current.map(node => node.id === drag.id ? {
      ...node,
      x: Math.round(clamp(drag.nodeX + deltaX, 0, canvas.width - node.width)),
      y: Math.round(clamp(drag.nodeY + deltaY, 0, canvas.height - node.height)),
    } : node));
  };

  const pointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    const snapshot = cloneNodes(nodes);
    const nextHistory = [...history.slice(0, historyIndex + 1), snapshot].slice(-60);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const validateLayout = () => {
    const invalid = nodes.filter(node => node.visible && (
      node.x < 0 || node.y < 0 || node.x + node.width > canvas.width || node.y + node.height > canvas.height ||
      node.width < 24 || node.height < 20 || !node.name.trim()
    ));
    if (invalid.length) {
      setNotice({ tone: 'error', text: `${invalid.length} elemento(s) precisam de ajuste antes da validação.` });
      return false;
    }
    setNotice({ tone: 'success', text: `Layout validado: ${nodes.filter(node => node.visible).length} elementos dentro da área segura.` });
    return true;
  };

  const runPreviewTest = () => {
    const valid = validateLayout();
    if (!valid) return;
    setMode('preview');
    setNotice({ tone: 'success', text: `Preview ${canvas.label} aprovado. Nenhum código de produção foi alterado.` });
  };

  const saveDraft = async (createVersion = false) => {
    if (!auth.currentUser) {
      setNotice({ tone: 'error', text: 'Sessão Firebase não encontrada.' });
      return;
    }
    if (!validateLayout()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, createVersion ? 'developer_versions' : 'developer_visual_drafts'), {
        documentType: createVersion ? 'VISUAL_LAYOUT_VERSION' : 'VISUAL_LAYOUT_DRAFT',
        page,
        device,
        canvas: { width: canvas.width, height: canvas.height },
        nodes,
        status: createVersion ? 'VERSAO_CRIADA' : 'RASCUNHO',
        createdBy: auth.currentUser.uid,
        responsibleUid: auth.currentUser.uid,
        appliedToProduction: false,
        createdAt: serverTimestamp(),
      });
      setNotice({ tone: 'success', text: createVersion ? 'Versão visual criada no Firebase. Publicação continua aguardando aprovação.' : 'Rascunho visual salvo no Firebase.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível salvar o layout.' });
    } finally {
      setSaving(false);
    }
  };

  const orderedLayers = useMemo(() => [...nodes].reverse(), [nodes]);

  return (
    <div className="-m-1 flex h-[calc(100dvh-7.5rem)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0a1220] shadow-2xl lg:-m-3">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-cyan-500 p-2 text-slate-950"><MousePointer2 className="h-4 w-4" /></div>
          <div className="min-w-0"><h2 className="truncate text-sm font-black text-white">Editor Visual RL Connect</h2><p className="text-[10px] text-slate-500">Edite o layout sem mexer no código</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select value={page} onChange={event => switchPage(event.target.value as PageKey)} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-white">
            <option value="dashboard">Dashboard</option>
            <option value="vagas">Vagas</option>
            <option value="banco-talentos">Banco de Talentos</option>
            <option value="portal-vagas">Portal de Vagas (Público)</option>
            <option value="acesso-master">Painel Master</option>
          </select>
          {(Object.entries(DEVICES) as Array<[DeviceKey, typeof DEVICES[DeviceKey]]>).map(([key, item]) => <button key={key} type="button" title={item.label} onClick={() => switchDevice(key)} className={`${toolButton} ${device === key ? '!border-cyan-500 !bg-cyan-500/10 !text-cyan-300' : ''}`}><item.Icon className="h-4 w-4" /></button>)}
          <span className="mx-1 hidden h-7 w-px bg-slate-800 sm:block" />
          <button type="button" onClick={undo} disabled={historyIndex <= 0} className={toolButton} title="Desfazer"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} className={toolButton} title="Refazer"><Redo2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => void saveDraft(false)} disabled={saving} className={`${toolButton} !border-cyan-500/40 !text-cyan-300`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="hidden sm:inline">Salvar</span></button>
          <button type="button" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')} className={`${toolButton} ${mode === 'preview' ? '!border-emerald-500 !text-emerald-300' : ''}`}>{mode === 'edit' ? <Eye className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}{mode === 'edit' ? 'Preview' : 'Editar'}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`hidden w-56 shrink-0 flex-col ${panelClass} border-y-0 border-l-0 xl:flex`}>
          <div className="border-b border-slate-800 p-3">
            <p className="flex items-center gap-2 text-xs font-black text-white"><Plus className="h-4 w-4 text-cyan-400" />Adicionar</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => addNode('text')} className={toolButton}><Type className="h-3.5 w-3.5" />Texto</button>
              <button type="button" onClick={() => addNode('button')} className={toolButton}><Box className="h-3.5 w-3.5" />Botão</button>
              <button type="button" onClick={() => addNode('card')} className={toolButton}><Layers3 className="h-3.5 w-3.5" />Card</button>
              <button type="button" onClick={() => addNode('image')} className={toolButton}><Image className="h-3.5 w-3.5" />Imagem</button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="flex items-center gap-2 border-b border-slate-800 p-3 text-xs font-black text-white"><Layers3 className="h-4 w-4 text-cyan-400" />Camadas</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {orderedLayers.map(node => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] ${selectedId === node.id ? 'bg-cyan-500/15 font-black text-cyan-300' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}>
                {node.visible ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{node.name}</span>
              </button>)}
            </div>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1 overflow-auto bg-[#101827]">
          <div className="sticky left-0 top-0 z-20 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowGrid(value => !value)} className={`${toolButton} ${showGrid ? '!text-cyan-300' : ''}`}><Grid3X3 className="h-4 w-4" />Grade</button>
              <button type="button" onClick={validateLayout} className={toolButton}><CheckCircle2 className="h-4 w-4" />Validar</button>
              <button type="button" onClick={runPreviewTest} className={toolButton}><Play className="h-4 w-4" />Testar</button>
              <button type="button" onClick={() => void saveDraft(true)} disabled={saving} className={toolButton}><Copy className="h-4 w-4" />Criar versão</button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setZoom(value => clamp(value - 0.1, 0.4, 1.25))} className={toolButton}><ZoomOut className="h-4 w-4" /></button>
              <span className="w-12 text-center text-[11px] font-bold text-slate-400">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom(value => clamp(value + 0.1, 0.4, 1.25))} className={toolButton}><ZoomIn className="h-4 w-4" /></button>
            </div>
          </div>

          {notice && <div className={`sticky left-3 top-14 z-30 mx-3 mt-3 rounded-lg border px-3 py-2 text-xs font-bold ${notice.tone === 'success' ? 'border-emerald-500/30 bg-emerald-950/95 text-emerald-300' : notice.tone === 'error' ? 'border-rose-500/30 bg-rose-950/95 text-rose-300' : 'border-amber-500/30 bg-amber-950/95 text-amber-300'}`}>{notice.text}</div>}

          <div className="p-12" style={{ width: canvas.width * zoom + 96, height: canvas.height * zoom + 96 }}>
            <div
              className="relative origin-top-left overflow-hidden bg-[#f7f9fc] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
              style={{ width: canvas.width, height: canvas.height, transform: `scale(${zoom})`, backgroundImage: showGrid && mode === 'edit' ? 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)' : undefined, backgroundSize: '16px 16px' }}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onClick={() => mode === 'edit' && setSelectedId('')}
            >
              {nodes.map((node, index) => node.visible && <VisualElement key={node.id} node={node} selected={mode === 'edit' && selectedId === node.id} zIndex={index + 1} mode={mode} onPointerDown={pointerDown} />)}
            </div>
          </div>
        </section>

        <aside className={`hidden w-64 shrink-0 overflow-y-auto ${panelClass} border-y-0 border-r-0 lg:block`}>
          <div className="border-b border-slate-800 p-3"><p className="text-xs font-black text-white">Propriedades</p><p className="mt-1 text-[10px] text-slate-500">Selecione um elemento no canvas</p></div>
          {selected ? <div className="space-y-4 p-3">
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Nome da camada<input value={selected.name} onChange={event => updateSelected({ name: event.target.value })} className={inputClass} /></label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">Texto<textarea value={selected.text} onChange={event => updateSelected({ text: event.target.value })} rows={3} className={inputClass} /></label>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={selected.x} onChange={x => updateSelected({ x: clamp(x, 0, canvas.width - selected.width) })} />
              <NumberField label="Y" value={selected.y} onChange={y => updateSelected({ y: clamp(y, 0, canvas.height - selected.height) })} />
              <NumberField label="Largura" value={selected.width} min={24} onChange={width => updateSelected({ width: clamp(width, 24, canvas.width - selected.x) })} />
              <NumberField label="Altura" value={selected.height} min={20} onChange={height => updateSelected({ height: clamp(height, 20, canvas.height - selected.y) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Fundo" value={selected.background === 'transparent' ? '#ffffff' : selected.background} onChange={background => updateSelected({ background })} />
              <ColorField label="Texto" value={selected.color} onChange={color => updateSelected({ color })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Fonte" value={selected.fontSize} min={8} onChange={fontSize => updateSelected({ fontSize: clamp(fontSize, 8, 72) })} />
              <NumberField label="Cantos" value={selected.radius} min={0} onChange={radius => updateSelected({ radius: clamp(radius, 0, 80) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => moveLayer(1)} className={toolButton}><ChevronUp className="h-4 w-4" />Para frente</button>
              <button type="button" onClick={() => moveLayer(-1)} className={toolButton}><ChevronDown className="h-4 w-4" />Para trás</button>
              <button type="button" onClick={() => updateSelected({ visible: !selected.visible })} className={toolButton}>{selected.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{selected.visible ? 'Ocultar' : 'Exibir'}</button>
              <button type="button" onClick={duplicateSelected} className={toolButton}><Copy className="h-4 w-4" />Duplicar</button>
            </div>
            <button type="button" onClick={deleteSelected} className={`${toolButton} w-full !border-rose-500/30 !text-rose-300`}><Trash2 className="h-4 w-4" />Excluir elemento</button>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-[11px] leading-relaxed text-cyan-100"><AlignCenter className="mb-2 h-4 w-4" />Arraste o elemento no canvas ou informe posição e tamanho aqui. As mudanças ficam em rascunho no Firebase.</div>
          </div> : <div className="p-6 text-center text-xs text-slate-500"><MousePointer2 className="mx-auto mb-2 h-7 w-7" />Clique em um elemento para editar.</div>}
        </aside>
      </div>
    </div>
  );
}

function VisualElement({ node, selected, zIndex, mode, onPointerDown }: { node: VisualNode; selected: boolean; zIndex: number; mode: EditorMode; onPointerDown: (event: React.PointerEvent, node: VisualNode) => void }) {
  const baseStyle: React.CSSProperties = {
    position: 'absolute', left: node.x, top: node.y, width: node.width, height: node.height,
    background: node.background, color: node.color, fontSize: node.fontSize, borderRadius: node.radius,
    zIndex, whiteSpace: 'pre-line', userSelect: 'none', touchAction: 'none',
  };
  const selection = selected ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#f7f9fc]' : '';
  const shared = { style: baseStyle, onPointerDown: (event: React.PointerEvent) => onPointerDown(event, node), onClick: (event: React.MouseEvent) => event.stopPropagation() };

  if (node.kind === 'text') return <div {...shared} className={`flex items-center font-black ${mode === 'edit' ? 'cursor-move' : ''} ${selection}`}>{node.text}</div>;
  if (node.kind === 'button') return <div {...shared} className={`flex items-center justify-center font-black shadow-sm ${mode === 'edit' ? 'cursor-move' : ''} ${selection}`}>{node.text}</div>;
  if (node.kind === 'input') return <div {...shared} className={`flex items-center border border-slate-200 px-4 shadow-sm ${mode === 'edit' ? 'cursor-move' : ''} ${selection}`}>{node.text}</div>;
  if (node.kind === 'image') return <div {...shared} className={`flex flex-col items-center justify-center border border-dashed border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ${mode === 'edit' ? 'cursor-move' : ''} ${selection}`}><Image className="mb-2 h-7 w-7" /><span className="text-xs font-bold">{node.text}</span></div>;
  return <div {...shared} className={`flex flex-col justify-between border border-slate-200 p-5 font-bold shadow-sm ${mode === 'edit' ? 'cursor-move' : ''} ${selection}`}><span>{node.text}</span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Componente RL Connect</span></div>;
}

function NumberField({ label, value, min = 0, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}<input type="number" min={min} value={Math.round(value)} onChange={event => onChange(Number(event.target.value) || 0)} className={inputClass} /></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}<span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-1.5"><input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" /><span className="truncate text-[10px] font-mono text-slate-300">{value}</span></span></label>;
}
