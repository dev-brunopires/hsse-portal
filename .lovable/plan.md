## Objetivo

Eliminar os erros `ERR_INTERNET_DISCONNECTED` / `Failed to fetch` que poluem o console quando o app está offline, pausando as tentativas automáticas de refresh do token Supabase enquanto não houver rede.

## Mudanças

### 1. `src/contexts/AuthContext.tsx`
Adicionar um `useEffect` que escuta os eventos `online` / `offline` do navegador:

- Ao montar: se `navigator.onLine === false`, chamar `supabase.auth.stopAutoRefresh()`.
- Listener `offline`: `supabase.auth.stopAutoRefresh()`.
- Listener `online`: `supabase.auth.startAutoRefresh()` e disparar um refresh imediato (a lógica de `refreshIfNeeded` já existente cuida disso via evento `online` que já está registrado).
- Cleanup: remover listeners.

Isso evita que o cliente Supabase fique tentando POST no endpoint `/auth/v1/token?grant_type=refresh_token` enquanto offline, eliminando os erros do console. Quando a rede volta, o auto-refresh é retomado e o token é renovado normalmente.

### 2. `src/main.tsx` (opcional, defensivo)
No handler `unhandledrejection`, ignorar silenciosamente rejeições cuja mensagem inclui `Failed to fetch` **e** `navigator.onLine === false`. Isso cobre qualquer outro fetch que falhe durante períodos offline (não só o auth).

## Detalhes técnicos

- `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` fazem parte da API pública do `@supabase/supabase-js` e são seguros de chamar múltiplas vezes.
- A sessão persiste em `localStorage` (já configurado), então ao voltar online o refresh recupera tudo.
- Não há mudança de UI nem de comportamento funcional — apenas redução de ruído no console e menos requisições inúteis.

## Fora de escopo

- Não alterar `OfflineIndicator`, `SyncButton` ou fluxo de sync de dados — esses já funcionam.
- Não tocar em `client.ts` (arquivo auto-gerado).
