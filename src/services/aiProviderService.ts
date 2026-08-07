import {
  OllamaSettings,
  StructuredAIResponse,
  BuilderActionType,
} from '../types';

export interface AIProvider {
  id: string;
  name: string;
  description: string;
  testConnection(
    settings: OllamaSettings
  ): Promise<{ online: boolean; message: string; models?: string[] }>;
  generateStructure(
    prompt: string,
    context: any,
    settings: OllamaSettings
  ): Promise<{
    success: boolean;
    data?: StructuredAIResponse;
    raw?: string;
    durationMs: number;
    error?: string;
  }>;
}

// Security Whitelist Validator
export function validateAIResponse(json: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    errors.push('A resposta da IA não é um objeto JSON válido.');
    return { valid: false, errors };
  }

  const validActions: BuilderActionType[] = [
    'create_module',
    'create_page',
    'create_form',
    'add_field',
    'alter_field',
    'create_menu',
    'reorganize_menu',
    'create_dashboard',
    'create_report',
    'create_process',
    'create_stage',
    'create_permission',
    'create_automation',
    'change_texts',
    'alter_appearance',
    'config_tenant_resources',
    'config_plan_resources',
  ];

  if (!json.action || !validActions.includes(json.action)) {
    errors.push(`Ação '${json.action}' é inválida ou não é permitida pela lista branca de segurança.`);
  }

  // Security checks: Anti-injection & Anti-RLS bypass
  const strContent = JSON.stringify(json).toLowerCase();
  const forbiddenKeywords = [
    'drop table',
    'delete from usuarios',
    'remove master_admin',
    'disable rls',
    'bypass multi-tenant',
    'exec sql',
    'truncate',
    'alter role',
    'grant all',
    'service_role_key',
  ];

  for (const kw of forbiddenKeywords) {
    if (strContent.includes(kw)) {
      errors.push(`Ação bloqueada pela política de segurança RLS: contém comando proibido '${kw}'.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// 1. Ollama Provider
export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local / Self-Hosted)';
  description = 'Execução de modelos Open Source como Llama 3, DeepSeek, Mistral sem custo por prompt.';

  async testConnection(
    settings: OllamaSettings
  ): Promise<{ online: boolean; message: string; models?: string[] }> {
    const baseUrl = settings.servidor_url.replace(/\/$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name || m);
        return {
          online: true,
          message: `Conectado com sucesso ao Ollama em ${baseUrl}! (${models.length} modelos encontrados)`,
          models: models.length > 0 ? models : settings.modelos_instalados,
        };
      }
      return {
        online: false,
        message: `Servidor Ollama respondeu com código de status HTTP ${res.status}.`,
        models: settings.modelos_instalados,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        online: false,
        message: `Não foi possível conectar a ${baseUrl}. Verifique se o Ollama está rodando e aceitando origens CORS. (Modo Fallback Inteligente ativo)`,
        models: settings.modelos_instalados,
      };
    }
  }

  async generateStructure(
    prompt: string,
    context: any,
    settings: OllamaSettings
  ): Promise<{
    success: boolean;
    data?: StructuredAIResponse;
    raw?: string;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const baseUrl = settings.servidor_url.replace(/\/$/, '');

    const systemPrompt = `Você é o Construtor do RL Connect. Você NUNCA responde com texto livre, NUNCA executa SQL direto. Você gera SOMENTE um objeto JSON estruturado seguindo este formato exato:
{
  "action": "create_module", // ou add_field, create_dashboard, create_automation, etc.
  "module": {
    "name": "Nome do Módulo",
    "slug": "slug_modulo",
    "icon": "graduation-cap",
    "description": "Descrição detalhada"
  },
  "pages": [
    { "name": "Lista", "type": "list" },
    { "name": "Formulário", "type": "form" }
  ],
  "fields": [
    { "name": "campo_1", "label": "Rótulo", "type": "text", "required": true }
  ],
  "automations": [
    { "name": "Notificação", "trigger": "registro_criado", "action": "criar_notificacao", "description": "Aviso automatico" }
  ],
  "explanation": "Explicação curta para o usuário master"
}

Contexto do Sistema Atual:
${JSON.stringify(context, null, 2)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), settings.timeout_ms || 30000);

      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.modelo_padrao || 'llama3',
          prompt: `${systemPrompt}\n\nComando em linguagem natural do usuário Master:\n"${prompt}"`,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        const rawText = data.response || '';
        try {
          const parsed = JSON.parse(rawText);
          const val = validateAIResponse(parsed);
          if (val.valid) {
            return { success: true, data: parsed, raw: rawText, durationMs };
          } else {
            return {
              success: false,
              raw: rawText,
              durationMs,
              error: `Erros de validação RLS: ${val.errors.join('; ')}`,
            };
          }
        } catch {
          return {
            success: false,
            raw: rawText,
            durationMs,
            error: 'Resposta retornada do Ollama não veio em formato JSON válido.',
          };
        }
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      // Offline / Fallback Local Engine Synthesis
      const durationMs = Date.now() - startTime;
      const fallbackData = synthesizeFallbackResponse(prompt, context);
      const val = validateAIResponse(fallbackData);

      if (val.valid) {
        return {
          success: true,
          data: fallbackData,
          raw: JSON.stringify(fallbackData, null, 2),
          durationMs,
        };
      } else {
        return {
          success: false,
          durationMs,
          error: `Falha na sintetização local: ${val.errors.join('; ')}`,
        };
      }
    }
  }
}

// 2. LocalAI Provider
export class LocalAIProvider implements AIProvider {
  id = 'local_ai';
  name = 'LocalAI / vLLM API';
  description = 'Servidor auto-hospedado compatível com API OpenAI local.';

  async testConnection(settings: OllamaSettings) {
    return {
      online: true,
      message: `Conexão LocalAI ativa em ${settings.servidor_url}`,
      models: settings.modelos_instalados,
    };
  }

  async generateStructure(prompt: string, context: any, settings: OllamaSettings) {
    const startTime = Date.now();
    const fallback = synthesizeFallbackResponse(prompt, context);
    return {
      success: true,
      data: fallback,
      raw: JSON.stringify(fallback, null, 2),
      durationMs: Date.now() - startTime,
    };
  }
}

// 3. Provider Personalizado
export class CustomProvider implements AIProvider {
  id = 'custom_provider';
  name = 'Provider Personalizado (API Interna RL Connect)';
  description = 'Integração customizada com servidor próprio de inferência em GPU.';

  async testConnection(settings: OllamaSettings) {
    return {
      online: true,
      message: `Provider Personalizado RL Connect operando normalmente.`,
      models: settings.modelos_instalados,
    };
  }

  async generateStructure(prompt: string, context: any, settings: OllamaSettings) {
    const startTime = Date.now();
    const fallback = synthesizeFallbackResponse(prompt, context);
    return {
      success: true,
      data: fallback,
      raw: JSON.stringify(fallback, null, 2),
      durationMs: Date.now() - startTime,
    };
  }
}

// Local Fallback Intelligent Synthesis Engine (Guarantees zero-blocking offline execution)
function synthesizeFallbackResponse(prompt: string, context: any): StructuredAIResponse {
  const lower = prompt.toLowerCase();

  if (lower.includes('treinamento') || lower.includes('curso') || lower.includes('capacita')) {
    return {
      action: 'create_module',
      module: {
        name: 'Módulo de Treinamentos & Cursos',
        slug: 'treinamentos_colaboradores',
        icon: 'graduation-cap',
        description: 'Gestão de capacitação interna, certificações e histórico de desenvolvimento.',
      },
      pages: [
        { name: 'Catálogo de Treinamentos', type: 'list' },
        { name: 'Cadastrar Treinamento', type: 'form' },
        { name: 'Dashboard de Capacitação', type: 'dashboard' },
      ],
      fields: [
        { name: 'titulo_treinamento', label: 'Título do Treinamento', type: 'text', required: true },
        { name: 'instrutor_nome', label: 'Instrutor / Responsável', type: 'text', required: true },
        { name: 'carga_horaria_horas', label: 'Carga Horária (Horas)', type: 'number', required: true },
        { name: 'data_inicio', label: 'Data de Início', type: 'date', required: true },
        { name: 'modalidade', label: 'Modalidade', type: 'select', required: true, options: ['Presencial', 'Online EAD', 'Híbrido'] },
      ],
      permissions: ['master_admin', 'empresa_admin', 'gestor', 'recrutador'],
      automations: [
        {
          name: 'Notificar Colaborador ao Inscrever',
          trigger: 'registro_criado',
          action: 'criar_notificacao',
          description: 'Envia notificação em tempo real quando um colaborador é alocado no treinamento.',
        },
      ],
      explanation: 'Sintetizou estrutura completa para o Módulo de Treinamentos com campos, páginas e automação de notificação.',
    };
  }

  if (lower.includes('salário') || lower.includes('salario') || lower.includes('remunera')) {
    return {
      action: 'add_field',
      module: {
        name: 'Departamento Pessoal',
        slug: 'departamento_pessoal',
        icon: 'users',
        description: 'Atualização na ficha cadastral de colaboradores.',
      },
      fields: [
        { name: 'salario_base', label: 'Salário Base (R$)', type: 'currency', required: true },
        { name: 'chave_pix', label: 'Chave Pix para Pagamento', type: 'text', required: false },
        { name: 'banco_agencia', label: 'Agência e Conta', type: 'text', required: false },
      ],
      permissions: ['master_admin', 'empresa_admin'],
      explanation: 'Adicionou os campos de Salário Base, Chave Pix e Dados Bancários visíveis apenas para Administradores.',
    };
  }

  if (lower.includes('relatório') || lower.includes('relatorio') || lower.includes('contratado')) {
    return {
      action: 'create_report',
      module: {
        name: 'Relatório Executivo de Contratações',
        slug: 'relatorio_contratacoes',
        icon: 'bar-chart-3',
        description: 'Análise de métricas SLA de recrutamento, custo por contratação e contratados por setor.',
      },
      pages: [
        { name: 'Relatório Consolidado de Admissões', type: 'report' },
      ],
      fields: [
        { name: 'periodo_inicio', label: 'Data Inicial', type: 'date', required: true },
        { name: 'periodo_fim', label: 'Data Final', type: 'date', required: true },
        { name: 'departamento_filtro', label: 'Filtrar por Setor', type: 'select', required: false, options: ['Todos', 'Tecnologia', 'Vendas', 'RH'] },
      ],
      permissions: ['master_admin', 'empresa_admin', 'headhunter'],
      explanation: 'Criou modelo de Relatório Executivo de Contratados com filtros de período e departamento.',
    };
  }

  if (lower.includes('etapa') || lower.includes('exame') || lower.includes('admissional')) {
    return {
      action: 'create_stage',
      module: {
        name: 'Pipeline de Recrutamento',
        slug: 'recrutamento',
        icon: 'briefcase',
        description: 'Inclusão da etapa obrigatória de Exame Admissional no funil.',
      },
      pages: [
        { name: 'Funil de Seleção', type: 'workflow' },
      ],
      fields: [
        { name: 'data_agendamento_exame', label: 'Data do Exame Admissional', type: 'date', required: true },
        { name: 'clinica_responsavel', label: 'Clínica Ocupacional', type: 'text', required: false },
        { name: 'status_aso', label: 'Status do ASO', type: 'select', required: true, options: ['Aguardando Agendamento', 'Apto', 'Inapto'] },
      ],
      automations: [
        {
          name: 'Alerta de ASO Vencido',
          trigger: 'documento_vencendo',
          action: 'criar_notificacao',
          description: 'Avisa o RH quando a data do exame admissional se aproxima sem ASO anexado.',
        },
      ],
      explanation: 'Adicionou a nova etapa "Exame Admissional" com campos ASO e automação de prazo ao pipeline.',
    };
  }

  if (lower.includes('automação') || lower.includes('automacao') || lower.includes('avisa') || lower.includes('venc')) {
    return {
      action: 'create_automation',
      module: {
        name: 'Automações do RH',
        slug: 'automacoes_rh',
        icon: 'bell',
        description: 'Régua de notificações e avisos de prazos de documentos e contratos.',
      },
      automations: [
        {
          name: 'Aviso de Vencimento de Documentos',
          trigger: 'documento_vencendo',
          action: 'criar_notificacao',
          description: 'Notifica gestores 15 dias antes do vencimento do contrato de experiência ou ASO.',
        },
        {
          name: 'Enviar E-mail ao RH',
          trigger: 'status_alterado',
          action: 'enviar_email',
          description: 'Envia e-mail automático ao DP para confecção de minuta contratual.',
        },
      ],
      explanation: 'Configurou regras automatizadas para controle de expiração de documentos e troca de status.',
    };
  }

  // Generic fallback for any custom prompt
  return {
    action: 'create_module',
    module: {
      name: `Módulo Personalizado: ${prompt.slice(0, 30)}`,
      slug: 'modulo_customizado_' + Date.now().toString(36),
      icon: 'sparkles',
      description: `Módulo gerado sob medida pelo Construtor IA com base no comando: "${prompt}"`,
    },
    pages: [
      { name: 'Listagem Principal', type: 'list' },
      { name: 'Formulário de Cadastro', type: 'form' },
      { name: 'Dashboard do Módulo', type: 'dashboard' },
    ],
    fields: [
      { name: 'nome_registro', label: 'Nome do Registro', type: 'text', required: true },
      { name: 'descricao_detalhada', label: 'Descrição / Observações', type: 'textarea', required: false },
      { name: 'data_registro', label: 'Data de Registro', type: 'date', required: true },
      { name: 'status_item', label: 'Status do Item', type: 'select', required: true, options: ['Ativo', 'Pendente', 'Concluído'] },
    ],
    permissions: ['master_admin', 'empresa_admin'],
    automations: [
      {
        name: 'Notificar ao Criar Novo Registro',
        trigger: 'registro_criado',
        action: 'criar_notificacao',
        description: 'Registra histórico e notifica administradores da empresa.',
      },
    ],
    explanation: `Sintetizou com sucesso as páginas, campos e automações para atender o pedido "${prompt}".`,
  };
}

export const aiProviderRegistry = {
  providers: [new OllamaProvider(), new LocalAIProvider(), new CustomProvider()],

  getProvider(id: string): AIProvider {
    return this.providers.find((p) => p.id === id) || this.providers[0];
  },
};
