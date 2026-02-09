

# Plano de Performance e Correções para Escala

## Problemas Identificados

### 1. Dashboard carrega TODOS os equipamentos na memória
O `useDashboardStats` faz `SELECT *` sem limite e processa tudo no frontend (status, alertas, categorias). Com milhares de equipamentos, isso vai travar o app.

### 2. Loop de refresh do PWA
O `PWAUpdatePrompt` faz `window.location.reload()` no evento `controllerchange` sem proteção contra loops. Em ambiente de preview com builds frequentes, isso causa reloads infinitos.

### 3. Mobile renderiza TODOS os cards sem virtualização
No mobile/tablet, o `VirtualizedEquipmentTable` renderiza todos os equipamentos como cards (`sortedEquipment.map(...)`) sem virtualização -- só o desktop usa o virtualizer.

### 4. useEffect com dependência instável causa re-renders
Linha 246 do VirtualizedEquipmentTable: `rowVirtualizer.getVirtualItems()` na lista de dependências do `useEffect` cria um array novo a cada render, disparando o efeito infinitamente.

### 5. Limite de 1000 rows do Supabase não tratado
O `useDashboardStats` não pagina -- se houver mais de 1000 equipamentos, os dados ficam incompletos silenciosamente.

### 6. Warning de ref em componente funcional
`TrendIndicator` dentro de `ActivityComparisonChart` recebe ref indevidamente (React warning no console).

---

## Correções Propostas

### A. Mover cálculos do Dashboard para o servidor (SQL)
Criar uma função SQL `get_dashboard_stats(ship_id)` que retorna contagens e alertas diretamente do banco, eliminando o carregamento de todos os equipamentos no frontend.

### B. Proteger PWA contra loop de reload
Adicionar um guard com `sessionStorage` no `controllerchange` para evitar mais de 1 reload por sessão.

### C. Virtualizar cards no mobile
Usar `useVirtualizer` também na view mobile de cards, renderizando apenas os visíveis na tela.

### D. Corrigir dependência instável do useEffect
Remover `rowVirtualizer.getVirtualItems()` da lista de deps e usar o tamanho do virtualizer ou um ref estável.

### E. Tratar limite de 1000 rows no Dashboard
Na solução SQL (item A), isso é resolvido automaticamente. Caso mantenhamos frontend, adicionar paginação com `.range()`.

### F. Corrigir warning do TrendIndicator
Mover `TrendIndicator` para fora do componente ou usar `React.forwardRef`.

---

## Detalhes Técnicos

### Migração SQL -- `get_dashboard_stats`

```text
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_ship_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
  -- Retorna contagens por status, categoria, alertas de certificados
  -- e manutenções diretamente do banco, sem carregar todos os registros
$$;
```

O hook `useDashboardStats` passa a chamar essa função via `supabase.rpc('get_dashboard_stats', { p_ship_id })`, reduzindo de "carregar todos os equipamentos + processar no JS" para uma única chamada RPC leve.

### PWAUpdatePrompt -- guard de reload

```text
const handleControllerChange = () => {
  if (sessionStorage.getItem('sw-reloaded')) return;
  sessionStorage.setItem('sw-reloaded', '1');
  window.location.reload();
};
```

### VirtualizedEquipmentTable -- mobile virtualizado

Substituir o `sortedEquipment.map()` na view mobile por um virtualizer com `estimateSize: () => 220` (altura do card) e renderizar apenas os itens virtuais.

### useEffect fix

```text
// Antes (instável):
], [hasNextPage, fetchNextPage, sortedEquipment.length, isFetchingNextPage, rowVirtualizer.getVirtualItems()]);

// Depois (estável):
], [hasNextPage, fetchNextPage, sortedEquipment.length, isFetchingNextPage]);
```

Usar um `onScroll` callback ou checar dentro do virtualizer com `scrollOffset`.

### TrendIndicator fix

Mover a definição de `TrendIndicator` para fora do componente `ActivityComparisonChart`, como um componente standalone no mesmo arquivo.

---

## Resumo de Impacto

| Mudança | Impacto |
|---------|---------|
| Dashboard SQL | Elimina carregamento de milhares de registros no frontend |
| PWA guard | Para o loop de refresh |
| Mobile virtualizado | Renderiza ~5 cards ao invés de milhares |
| useEffect fix | Elimina re-renders desnecessários |
| 1000 rows | Dados completos sempre |
| TrendIndicator | Remove warnings do console |

