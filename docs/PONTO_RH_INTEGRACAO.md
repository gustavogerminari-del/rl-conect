# Integração RH-MIL ↔ PONTO RH

## Arquitetura

O PONTO RH possui uma única API para todas as empresas. Cada empresa recebe um `Client ID` e um `Client Secret` próprios. O token emitido pela API do PONTO RH identifica o tenant e impede que uma credencial consulte dados de outra empresa.

URL padrão do PONTO RH:

`https://pronto-rh.gustavogerminari.workers.dev`

No RH-MIL, a configuração fica no Painel Master em **Integração PONTO RH**.

## Segurança

O navegador envia o Client Secret uma única vez para `/api/integrations/ponto`. O backend criptografa o segredo com AES-GCM antes de persistir em `integration_secrets`.

A chave `PONTO_RH_INTEGRATION_KEY` é server-only e deve possuir pelo menos 32 caracteres. Nunca use prefixo `VITE_` nessa chave.

O backend só aceita usuário Firebase com perfil MASTER. A resposta enviada ao navegador informa apenas `hasClientSecret: true/false`; o segredo criptografado e o segredo original nunca retornam ao frontend.

## Teste de conexão

1. O RH-MIL solicita token em `POST /api/v1/integracoes/auth/token`.
2. Com o Bearer token, consulta `GET /api/v1/integracoes/ponto/status`.
3. O ID e nome da empresa retornados pelo PONTO RH são registrados na configuração do RH-MIL.
4. Só após resposta real o status fica `CONECTADO`.

## Sincronização

O botão **Sincronizar ponto agora**:

- consulta marcações paginadas em `/api/v1/integracoes/ponto/marcacoes`;
- grava/upserta os registros em `registros_ponto` usando `empresaId` do RH-MIL;
- consulta `/api/v1/integracoes/ponto/banco-horas`;
- grava/upserta os saldos em `ponto_banco_horas`;
- registra `lastSyncAt` somente após concluir a sincronização.

`externalEmployeeId` deve corresponder ao ID do funcionário do RH-MIL enviado ao PONTO RH durante o provisionamento do colaborador.

## Variável obrigatória no RH-MIL

```env
PONTO_RH_INTEGRATION_KEY="uma-chave-aleatoria-com-no-minimo-32-caracteres"
```

## Pré-requisito do PONTO RH

A API multiempresa deve estar publicada com os endpoints sob `/api/v1/integracoes/ponto`. A implementação está separada no repositório `PRONTO-RH` e deve ser publicada antes de o teste de conexão do RH-MIL retornar sucesso.
