import { auth, db } from '../lib/firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { tenantIdFrom, withTenantAliases } from '../lib/tenant';

export type DpStatus = 'PENDENTE' | 'APROVADO' | 'CONCLUIDO' | 'ATIVO' | 'ENCERRADO';
export type DpRecord = Record<string, any> & { id: string; empresa_id: string };

async function tenantId(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão Firebase não autenticada.');
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  if (!snap.exists()) throw new Error('Perfil da empresa não encontrado.');
  const id = tenantIdFrom(snap.data());
  if (!id) throw new Error('Perfil sem empresa vinculada.');
  return id;
}

async function listByTenant(name: string): Promise<DpRecord[]> {
  const companyId = await tenantId();
  const found = new Map<string, DpRecord>();
  for (const field of ['empresa_id', 'empresaId', 'companyId'] as const) {
    try {
      const snap = await getDocs(query(collection(db, name), where(field, '==', companyId)));
      snap.forEach(row => found.set(row.id, { id: row.id, ...row.data() } as DpRecord));
    } catch (error) {
      console.debug(`[DP] consulta ignorada ${name}.${field}`, error);
    }
  }
  return [...found.values()];
}

async function createTenantRecord(name: string, payload: Record<string, any>) {
  const companyId = await tenantId();
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, name), withTenantAliases({ ...payload, criado_em: payload.criado_em || now, atualizado_em: now }, companyId));
  return ref.id;
}

async function patchTenantRecord(name: string, id: string, patch: Record<string, any>) {
  const companyId = await tenantId();
  const ref = doc(db, name, id);
  const current = await getDoc(ref);
  if (!current.exists() || tenantIdFrom(current.data()) !== companyId) throw new Error('Registro não pertence à empresa atual.');
  await updateDoc(ref, withTenantAliases({ ...patch, atualizado_em: new Date().toISOString() }, companyId));
}

export const dpWorkflowService = {
  async snapshot() {
    const [funcionarios, admissoes, exames, beneficios, folhas, ferias, afastamentos, retornos] = await Promise.all([
      listByTenant('funcionarios'),
      listByTenant('solicitacoes_admissao'),
      listByTenant('exames_ocupacionais'),
      listByTenant('dp_beneficios'),
      listByTenant('dp_folhas'),
      listByTenant('ferias'),
      listByTenant('dp_afastamentos'),
      listByTenant('dp_retornos'),
    ]);
    return { funcionarios, admissoes, exames, beneficios, folhas, ferias, afastamentos, retornos };
  },

  async solicitarExame(funcionarioId: string, tipo = 'ADMISSIONAL', dataAgendada = '') {
    return createTenantRecord('exames_ocupacionais', {
      funcionario_id: funcionarioId,
      tipo,
      data_agendada: dataAgendada,
      status: 'PENDENTE',
      resultado: '',
    });
  },

  async concluirExame(id: string, resultado: 'APTO' | 'INAPTO', observacoes = '') {
    return patchTenantRecord('exames_ocupacionais', id, {
      status: 'CONCLUIDO', resultado, observacoes, data_resultado: new Date().toISOString().slice(0, 10),
    });
  },

  async concederBeneficio(funcionarioId: string, tipo: string, valor: number) {
    return createTenantRecord('dp_beneficios', { funcionario_id: funcionarioId, tipo, valor, status: 'ATIVO', inicio: new Date().toISOString().slice(0, 10) });
  },

  async gerarFolha(funcionarioId: string, competencia: string, salarioBase: number, extras = 0, descontos = 0) {
    const liquido = Math.max(0, Number(salarioBase || 0) + Number(extras || 0) - Number(descontos || 0));
    return createTenantRecord('dp_folhas', {
      funcionario_id: funcionarioId, competencia, salario_base: Number(salarioBase || 0), extras: Number(extras || 0), descontos: Number(descontos || 0), liquido, status: 'CONCLUIDO',
    });
  },

  async programarFerias(funcionarioId: string, inicio: string, fim: string, dias: number) {
    return createTenantRecord('ferias', { funcionario_id: funcionarioId, data_inicio: inicio, data_fim: fim, dias: Number(dias || 0), status: 'programada' });
  },

  async afastarFuncionario(funcionarioId: string, motivo: string, inicio: string, previsaoRetorno = '') {
    const companyId = await tenantId();
    await createTenantRecord('dp_afastamentos', { funcionario_id: funcionarioId, motivo, inicio, previsao_retorno: previsaoRetorno, status: 'ATIVO' });
    const ref = doc(db, 'funcionarios', funcionarioId);
    const current = await getDoc(ref);
    if (current.exists() && tenantIdFrom(current.data()) === companyId) {
      await setDoc(ref, withTenantAliases({ status: 'afastado', atualizado_em: new Date().toISOString() }, companyId), { merge: true });
    }
  },

  async registrarRetorno(funcionarioId: string, afastamentoId: string, dataRetorno: string, apto = true) {
    const companyId = await tenantId();
    await createTenantRecord('dp_retornos', { funcionario_id: funcionarioId, afastamento_id: afastamentoId, data_retorno: dataRetorno, apto, status: 'CONCLUIDO' });
    if (afastamentoId) await patchTenantRecord('dp_afastamentos', afastamentoId, { status: 'ENCERRADO', data_retorno: dataRetorno });
    const ref = doc(db, 'funcionarios', funcionarioId);
    const current = await getDoc(ref);
    if (current.exists() && tenantIdFrom(current.data()) === companyId) {
      await setDoc(ref, withTenantAliases({ status: apto ? 'ativo' : 'afastado', atualizado_em: new Date().toISOString() }, companyId), { merge: true });
    }
  },
};
