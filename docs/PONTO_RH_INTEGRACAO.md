# Integração automática RH-MIL ↔ PONTO RH

## Arquitetura oficial

O RH-MIL e o PONTO RH usam uma integração interna central multi-tenant. Não existe API, Client ID ou Client Secret por empresa no Painel Master.

Existe somente uma credencial privada servidor-servidor entre as duas plataformas. O `empresaId` do RH-MIL identifica o tenant em todas as operações.

```text
RH-MIL
  ↓
API interna central
  ↓ empresaId
PONTO RH
  ├─ Empresa A
  ├─ Empresa B
  └─ Empresa C
```

A mesma base de código e a mesma API atendem todas as empresas. Os dados continuam isolados pelo tenant.

## O que o MASTER faz

O MASTER não configura integração de ponto.

Ele apenas ativa ou desativa os módulos da empresa normalmente. Quando DP/Ponto é habilitado, a integração é executada por trás do sistema.

Não existe menu de Client ID, Client Secret, URL de API, botão Conectar ou configuração manual por empresa.

## Ativação automática

Quando `departamentoPessoal`, `dp` ou `ponto` é ativado para uma empresa:

1. o RH-MIL detecta a alteração no cadastro da empresa;
2. chama o backend `/api/integrations/ponto` com ação `ensure`;
3. o backend lê os dados reais da empresa no Firestore;
4. chama `POST /api/v1/internal/rh-mil/tenants/sync` no PONTO RH;
5. o PONTO RH cria ou atualiza o tenant usando o `empresaId` do RH-MIL como `external_company_id`;
6. o vínculo passa a ser automático e idempotente.

Nenhum usuário precisa cadastrar credenciais manualmente.

## Segurança

Variáveis somente no servidor do RH-MIL:

```env
PONTO_RH_BASE_URL="https://pronto-rh.gustavogerminari.workers.dev"
PONTO_RH_SYSTEM_TOKEN="uma-chave-longa-aleatoria"
```

No PONTO RH, o mesmo valor deve ser configurado como secret:

```env
RH_MIL_SYSTEM_TOKEN="a-mesma-chave-longa-aleatoria"
```

O token nunca recebe prefixo `VITE_`, nunca vai para o navegador e nunca é salvo por empresa.

Usuários comuns não escolhem `empresaId`: o backend resolve a empresa a partir do perfil Firebase autenticado. O MASTER pode informar uma empresa somente nas operações administrativas de provisionamento interno.

## Sincronização de ponto

O RH-MIL consulta o gateway interno do PONTO RH:

- `GET /api/v1/internal/rh-mil/tenants/:empresaId/marcacoes`
- `GET /api/v1/internal/rh-mil/tenants/:empresaId/banco-horas`

Os dados são gravados no RH-MIL mantendo o tenant:

- `registros_ponto` com `empresaId` e `companyId`;
- `ponto_banco_horas` com `empresaId` e `companyId`.

Antes de sincronizar, o backend executa `ensureTenant`, de modo que uma integração pendente seja corrigida automaticamente na próxima operação.

## Regra de negócio

O módulo de DP/Ponto controla visibilidade e ativação funcional. A API não é duplicada por empresa.

```text
MASTER ativa DP para Empresa A
          ↓
RH-MIL provisiona Empresa A no PONTO RH
          ↓
mesma API central
          ↓
consultas sempre filtradas pelo empresaId da Empresa A
```

Para ativar o PONTO RH, a empresa precisa possuir razão social e CNPJ válido, pois o sistema de ponto mantém esses dados no cadastro do empregador.
