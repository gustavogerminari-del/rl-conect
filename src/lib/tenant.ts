export function tenantIdFrom(data: any): string {
  return String(data?.empresa_id || data?.empresaId || data?.companyId || data?.tenantId || '').trim();
}
export function requireTenantId(value: unknown, operation = 'realizar esta operação'): string {
  const id = String(value || '').trim();
  if (!id) throw new Error(`Não foi possível ${operation}: empresaId é obrigatório.`);
  return id;
}
export function withTenantAliases<T extends Record<string, any>>(data: T, tenant: string): T & { empresa_id: string; empresaId: string; companyId: string } {
  const id = requireTenantId(tenant);
  return { ...data, empresa_id: id, empresaId: id, companyId: id };
}
