## Cutover para o Supabase externo (`ovugummbxablwmbpbbhj`)

Como o `.env` e `src/integrations/supabase/client.ts` são arquivos gerenciados pelo Lovable Cloud e são reescritos automaticamente, não dá pra simplesmente trocar a URL ali. Vou contornar criando um client paralelo que ignora o `.env` e aponta direto para o seu projeto.

### Etapas

1. **Criar `src/integrations/supabase/client.ts` apontando para o externo** (sobrescrever):
   - URL: `https://ovugummbxablwmbpbbhj.supabase.co`
   - Anon key: a sua chave publishable do projeto externo (você me passa nesta etapa — é pública, pode colar no chat).
   - Manter o mesmo `export const supabase` para não quebrar nenhum dos ~150 imports.
   - Manter `import type { Database } from './types'` (os tipos atuais já refletem o schema que você replicou via SQL — se houver divergência, aparecerá só como `any` em campos novos, não quebra build).

2. **Validar conexão** com 3 testes rápidos no preview:
   - Tela `/auth`: tentar login com o admin que você criou no novo projeto.
   - Após login: dashboard carrega (chama `get_dashboard_stats` RPC, valida que as funções SQL foram criadas).
   - Listar Equipamentos: valida RLS + grants + tabela `equipment`.

3. **Checar console/network** para erros 401/403/404/PGRST — se aparecer, indica:
   - 401/403 → RLS ou grant faltando no projeto novo
   - 404 `PGRST205` → tabela não existe
   - `function ... does not exist` → faltou rodar alguma migration

4. **Edge functions**: o `supabase.functions.invoke(...)` usa a URL do client, então as chamadas vão para o seu projeto. Você precisa ter deployado as 7 functions (`check-inspection-deadlines`, `client-telemetry`, `create-user`, `delete-user`, `health-check`, `ifs-integration`, `obs-cards-import`, `reset-user-password`) e configurado os secrets necessários no dashboard do Supabase externo.

### O que eu preciso de você agora

- **Anon/publishable key** do projeto `ovugummbxablwmbpbbhj` (formato `eyJ...` ou `sb_publishable_...`). Pega em: Supabase Dashboard → Project Settings → API → `anon` `public`.
- Confirmação de que rodou:
  - SQL completo (tabelas + funções + triggers + RLS + grants)
  - Criação dos 7 buckets de storage com as políticas
  - Deploy das edge functions
  - Criação do usuário admin

### Riscos / o que vai parar de funcionar pelo Lovable

- Tools `supabase--migration`, `supabase--deploy_edge_functions`, `supabase--edge_function_logs`, `secrets`, `storage_upload`, `read_query` continuarão batendo no projeto **antigo** (`mxyxnnjcsmkswqbosaex`), não no seu. Qualquer mudança futura de schema/edge function/secret você executa manualmente no dashboard do `ovugummbxablwmbpbbhj`.
- O arquivo `src/integrations/supabase/types.ts` para de ser regenerado automaticamente conforme o schema do projeto novo. Se você alterar o schema lá, eu posso regenerar os tipos via CLI (`supabase gen types`) e colar no arquivo manualmente.
- O `.env` continuará mostrando o projeto antigo — vou ignorá-lo no client.

Confirma e me manda a anon key pra eu prosseguir?
