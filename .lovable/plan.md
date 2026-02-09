

# Correção: Alertas Offline Duplicados e Deduplicação Global de Toasts

## Problema Identificado

O hook `useOfflineSync()` e chamado em **pelo menos 5 componentes simultaneamente** na tela:
- OfflineIndicator
- MobileBottomNav
- SyncProgressIndicator
- NewInspectionDialog (na pagina de Inspections)
- InspectionFormDialog

Cada instancia registra seu proprio listener de `online`/`offline` no `window`, e cada um dispara um `toast.error()` independente. Por isso voce ve 4 alertas identicos quando o celular perde conexao.

## Solucao (2 camadas)

### Camada 1: Toasts com ID fixo (deduplicacao via Sonner)

O Sonner ja suporta um parametro `id` nos toasts. Quando dois toasts tem o mesmo `id`, o segundo **substitui** o primeiro em vez de criar um novo. Vamos adicionar `id` fixo em todos os toasts do `useOfflineSync`:

- `toast.error('offline', { id: 'offline-status' })` -- so aparece 1 vez
- `toast.success('online', { id: 'online-status' })` -- so aparece 1 vez  
- `toast.success('sync', { id: 'sync-completed' })` -- so aparece 1 vez
- `toast.error('sync-failed', { id: 'sync-failed' })` -- so aparece 1 vez
- `toast.success('cache', { id: 'cache-updated' })` -- so aparece 1 vez

### Camada 2: Listeners de online/offline como singleton

Mover os `addEventListener('online')` / `addEventListener('offline')` para fora do hook, num modulo singleton, para que sejam registrados apenas **uma vez** independente de quantas instancias do hook existam.

### Camada 3: Aplicar deduplicacao em outros toasts do sistema

Revisar os toasts mais criticos de outros hooks (erro de query, sync, etc.) e adicionar `id` fixo onde faz sentido para evitar empilhamento.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useOfflineSync.ts` | Singleton para listeners online/offline; adicionar `id` em todos os toasts |
| `src/hooks/use-toast.ts` | Suportar parametro `id` no wrapper de compatibilidade |

## Impacto

- Elimina os 4 alertas duplicados de offline
- Previne empilhamento de toasts identicos em qualquer cenario futuro
- Zero mudanca visual -- os toasts continuam aparecendo, so que apenas 1 vez cada
