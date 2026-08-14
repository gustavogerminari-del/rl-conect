import { Router } from 'express';
import { adminAuth, adminDb, verifyRlBearer } from './firebaseAdmin.js';

const ALLOWED_ROLES = new Set(['empresa_admin', 'recrutador', 'gestor', 'headhunter']);

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('head')) return 'headhunter';
  if (raw.includes('recrut')) return 'recrutador';
  if (raw.includes('gestor')) return 'gestor';
  if (raw.includes('admin')) return 'empresa_admin';
  return raw;
}

function fail(res: any, error: unknown) {
  const status = Number((error as any)?.statusCode || 500);
  const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ success: false, error: message });
}

export function registerAdminUserRoutes(app: { use: (...args: any[]) => any }) {
  const router = Router();

  router.post('/users', async (req, res) => {
    try {
      const requestedCompanyId = String(req.body?.companyId || req.body?.empresa_id || '').trim();
      const ctx = await verifyRlBearer(req.header('authorization'), requestedCompanyId);
      const canCreate = ctx.isMaster || ['empresa_admin', 'ADMIN_EMPRESA', 'EMPRESA_ADMIN', 'ADMIN'].includes(ctx.role);
      if (!canCreate) throw Object.assign(new Error('Seu perfil não pode criar acessos.'), { statusCode: 403 });

      const email = normalizeEmail(req.body?.email);
      const nome = String(req.body?.nome || '').trim();
      const password = String(req.body?.password || '');
      const role = normalizeRole(req.body?.role);
      const companyId = requestedCompanyId || ctx.companyId;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('E-mail inválido.'), { statusCode: 400 });
      if (!nome) throw Object.assign(new Error('Nome é obrigatório.'), { statusCode: 400 });
      if (!ALLOWED_ROLES.has(role)) throw Object.assign(new Error('Perfil de acesso inválido.'), { statusCode: 400 });
      if (!ctx.isMaster && companyId !== ctx.companyId) throw Object.assign(new Error('Empresa não autorizada.'), { statusCode: 403 });

      let authUser;
      let created = false;
      try {
        authUser = await adminAuth().getUserByEmail(email);
      } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') throw error;
        if (password.length < 8) throw Object.assign(new Error('Senha inicial deve ter ao menos 8 caracteres.'), { statusCode: 400 });
        authUser = await adminAuth().createUser({ email, password, displayName: nome, emailVerified: false, disabled: false });
        created = true;
      }

      const ref = adminDb().collection('usuarios').doc(authUser.uid);
      const snap = await ref.get();
      const existing: any = snap.exists ? snap.data() : null;
      const existingCompany = String(existing?.empresa_id || existing?.empresaId || existing?.companyId || '').trim();
      if (existingCompany && existingCompany !== companyId) {
        if (created) await adminAuth().deleteUser(authUser.uid).catch(() => undefined);
        throw Object.assign(new Error('Este e-mail já pertence a outra empresa no RL Connect.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const profile = {
        id: authUser.uid,
        uid: authUser.uid,
        email,
        nome,
        role,
        perfil_id: `perf_${role}`,
        empresa_id: companyId,
        empresaId: companyId,
        companyId,
        status: 'ativo',
        ativo: true,
        criado_em: existing?.criado_em || now,
        atualizado_em: now,
        criado_por: ctx.uid,
      };
      await ref.set(profile, { merge: true });

      res.status(created ? 201 : 200).json({ success: true, created, user: profile });
    } catch (error) {
      fail(res, error);
    }
  });

  app.use('/api/admin', router);
}
