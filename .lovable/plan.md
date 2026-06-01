## Salvar regras permanentes no memory do projeto

Vou adicionar duas regras no bloco **Core** do `mem://index.md` (sempre injetado no meu contexto, em toda ação nesse projeto):

### Regra 1 — Backend externo (não usar tools do Cloud antigo)

> **Backend externo:** O Supabase real é `ovugummbxablwmbpbbhj`. As tools `supabase--migration`, `deploy_edge_functions`, `secrets`, `storage_upload`, `read_query`, `insert`, `configure_auth` apontam para o Cloud antigo (`mxyxnnjcsmkswqbosaex`) e **NÃO devem ser usadas**. Para qualquer mudança de backend (SQL, edge function, secret, bucket, auth config), entregar SQL/código bruto + comando CLI no chat para o usuário aplicar manualmente. Frontend pode ser editado normalmente. Ao mudar schema, fornecer comando `supabase gen types typescript --project-id ovugummbxablwmbpbbhj` para regenerar `types.ts`.

### Regra 2 — Preservar UI/UX

> **Preservar UI/UX:** Não alterar layout, espaçamentos, cores, tipografia, componentes visuais, fluxos de navegação ou comportamento de interação sem pedido explícito do usuário. Mudanças funcionais/backend devem manter UI idêntica. Qualquer refatoração visual exige confirmação prévia.

### Arquivos a alterar

- `mem://index.md` — adicionar as 2 linhas no bloco **Core** (preservando todo o resto do conteúdo atual: 7 regras Core existentes + 26 referências de Memories).

### Não vou

- Criar arquivos separados em `mem://design/` ou `mem://architecture/` — regras curtas o suficiente para ficar inline no Core.
- Tocar em código do app.
- Chamar nenhuma tool de Supabase.
