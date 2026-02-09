

# Melhorias de Performance e Correções

## 1. Bug: syncForShip não sincroniza categorias, navios e templates

**Problema**: Quando o usuario troca de unidade, o `syncForShip()` baixa equipamentos e planos de manutencao, mas **nao sincroniza categorias, navios nem templates de checklist**. Se o cache estiver vazio (primeiro acesso), o usuario offline nao tera essas informacoes basicas para fazer inspeçoes.

**Correção**: Adicionar `syncCategories()`, `syncShips()` e `syncTemplates()` dentro do `syncForShip()`.

---

## 2. Bug: Desfavoritar nao limpa o localStorage do ShipFilterContext

**Problema**: Quando o usuario desfavorita um navio (clicando na estrela de novo), o `setFavoriteShip.mutate` remove do banco, mas o `selectedShipId` continua apontando para aquele navio via `localStorage`. No proximo login, o `ShipFilterContext` tenta ler do `localStorage` e encontra o navio antigo — mesmo sem favorito. Nao e exatamente um bug grave, mas o comportamento esperado seria voltar para "Todas as Unidades" ao desfavoritar.

**Correção**: Ao desfavoritar (toggle off), chamar `setSelectedShipId(null)` para limpar a selecao.

---

## 3. Performance: syncForShip dispara toast desnecessariamente

**Problema**: Toda vez que o usuario troca de unidade, aparece um toast "Cache atualizado" mesmo quando pouca coisa mudou. Isso polui a experiencia.

**Correção**: Mostrar o toast apenas se houve dados novos baixados (delta > 0), e usar um toast mais discreto (sem `success`, usar `info` por exemplo).

---

## 4. Bug potencial: syncForShip pode conflitar com preCacheData

**Problema**: Se o `preCacheData` (sync inicial do mount) ainda esta rodando quando o usuario troca de unidade, o `syncForShip` retorna imediatamente por causa do guard `globalCacheInProgress`. Os dados da nova unidade **nao sao baixados** e o usuario nao recebe nenhum feedback.

**Correção**: Adicionar uma fila simples — se `globalCacheInProgress` estiver true, guardar o `shipId` pendente e executar apos o sync atual terminar.

---

## 5. Performance: useOfflineSync usa useShipFilter mas roda fora do Provider em alguns cenarios

**Problema**: O `useOfflineSync` agora importa `useShipFilter()`. Se o hook for usado em qualquer componente que esteja **fora** do `ShipFilterProvider` (ex: `OfflinePage` montada antes do provider), vai dar crash com "useShipFilter must be used within a ShipFilterProvider".

**Correção**: Adicionar um try/catch no import do `selectedShipId` ou usar um hook wrapper seguro que retorna `null` se o provider nao existir.

---

## 6. Performance: Header carrega useCertificates para todos os usuarios

**Problema**: O Header importa `useCertificates()` para calcular certificados expirando. Isso faz uma query pesada ao banco para **todos** os usuarios (incluindo tecnicos que nao veem certificados). 

**Correção**: Condicionar a query de certificados ao role (admin/admin_master apenas).

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useOfflineSync.ts` | Corrigir `syncForShip` (adicionar categories/ships/templates, fila de pendentes, toast condicional) |
| `src/components/layout/Header.tsx` | Desfavoritar limpa selecao; condicionar `useCertificates` ao role |
| `src/contexts/ShipFilterContext.tsx` | Nenhuma mudanca necessaria |

## Prioridade

1. **Bug #1** (syncForShip incompleto) — impacto alto, offline quebra
2. **Bug #4** (conflito com preCacheData) — impacto medio, race condition
3. **Bug #2** (desfavoritar nao limpa) — impacto baixo, UX confusa
4. **Perf #6** (Header useCertificates) — impacto medio, query desnecessaria
5. **Perf #3** (toast excessivo) — impacto baixo, UX poluida
6. **Bug #5** (provider missing) — impacto medio se OfflinePage rodar fora do provider

