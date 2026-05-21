## Problema

O preview do Lovable fica servindo partes antigas do app porque o **Service Worker (PWA)** está ativo também em ambiente de preview/desenvolvimento. O `vite-plugin-pwa` está configurado com `registerType: "autoUpdate"` e várias estratégias de cache (`StaleWhileRevalidate`, `CacheFirst`) que guardam JS, CSS, imagens e fontes. Resultado: ao abrir o preview, o navegador entrega primeiro a versão em cache e só depois (às vezes) busca a nova — dando a sensação de "app antigo".

Além disso, o `main.tsx` tem um auto-recover que limpa caches e faz reload, mas só dispara em `import.meta.env.PROD` e apenas quando detecta erro de chunk — não resolve o caso normal de "está exibindo versão velha".

## Solução proposta

Registrar o Service Worker **somente no domínio publicado** (`sbm-inspect.lovable.app`), e **desativá-lo no preview** (`*.lovable.app/id-preview--*` e em desenvolvimento). Assim:

- **Preview Lovable**: sempre versão fresca, sem cache de SW.
- **App publicado / PWA instalado**: continua funcionando offline normalmente.

### Mudanças

1. **`vite.config.ts`**
   - Trocar `registerType: "autoUpdate"` por `registerType: "prompt"` (mais previsível) **ou** manter `autoUpdate` e adicionar `devOptions: { enabled: false }` (já é o default, só explicitar).
   - Nenhuma mudança estrutural no Workbox.

2. **`src/main.tsx`** (principal correção)
   - Adicionar um bloco que, ao detectar que o host é o domínio de **preview** do Lovable (`id-preview--*.lovable.app` ou qualquer host que não seja o publicado), executa no boot:
     - `navigator.serviceWorker.getRegistrations()` → `unregister()` em todos.
     - `caches.keys()` → `caches.delete()` em todos.
   - Isso garante que, mesmo que um SW tenha sido instalado antes nesse host, ele é removido na próxima visita.
   - Não afeta o domínio publicado nem PWAs instalados pelos usuários finais.

3. **Opcional (recomendado)**: adicionar um pequeno helper `src/utils/previewEnvironment.ts` com `isLovablePreviewHost()` para centralizar a detecção (`hostname.includes('id-preview--')` ou `hostname.endsWith('.lovable.app') && hostname !== 'sbm-inspect.lovable.app'`).

### O que NÃO muda

- Comportamento offline do app publicado.
- Estratégias de cache do Workbox em produção.
- Lazy loading / `lazyWithRetry`.
- Nada de UI.

## Resultado esperado

- No preview do Lovable: cada reload busca os assets novos direto da rede; sem "fantasmas" de versões antigas.
- No app publicado: PWA continua igual, com cache e funcionamento offline.

Quer que eu siga por esse caminho (desativar SW só no preview) ou prefere algo mais agressivo, tipo desligar o PWA inteiro em qualquer ambiente que não seja produção publicada?
