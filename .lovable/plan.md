
# Navio Favorito -- Carregamento Inteligente

## Conceito

Admins e admin_masters (ou qualquer usuario com mais de 1 navio) podem marcar **um** navio como favorito (estrela). Esse navio vira o filtro padrao ao acessar o sistema e tambem e o unico baixado para uso offline, otimizando performance.

## Como Funciona

1. **Estrela no seletor de navios** -- No dropdown/drawer de navios do Header, cada navio ganha um icone de estrela ao lado
2. **Um favorito por vez** -- Ao favoritar um navio, o anterior e desfavoritado automaticamente (toggle simples)
3. **Filtro padrao ao login** -- O `ShipFilterContext` carrega o navio favorito como `selectedShipId` inicial (ao inves de "Todas as Unidades")
4. **Offline otimizado** -- O `useOfflineSync` usa o navio favorito como filtro de download, mesmo para admins (que hoje baixam tudo)
5. **Sem favorito = comportamento atual** -- Se nenhum navio estiver favoritado, o sistema funciona como hoje (todas as unidades, download completo)

## Detalhes Tecnicos

### 1. Tabela no banco (ja existe parcialmente)

A tabela `user_favorites` ja existe com `entity_type` e `entity_id`. Vamos reutiliza-la com `entity_type = 'ship'`. Precisamos apenas de uma constraint para garantir no maximo 1 navio favorito por usuario:

```text
-- Funcao para garantir max 1 ship favorito por usuario
-- Antes de inserir, remove qualquer favorito ship existente do mesmo usuario
CREATE OR REPLACE FUNCTION enforce_single_favorite_ship()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type = 'ship' THEN
    DELETE FROM public.user_favorites
    WHERE user_id = NEW.user_id
      AND entity_type = 'ship'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_favorite_ship
  AFTER INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION enforce_single_favorite_ship();
```

### 2. Hook `useFavoriteShip` (novo)

Hook dedicado que encapsula a logica de navio favorito:

- `useFavoriteShip()` -- retorna o `ship_id` favorito (ou `null`)
- `useSetFavoriteShip()` -- mutation para favoritar/desfavoritar
- Internamente usa a tabela `user_favorites` com `entity_type = 'ship'`

### 3. Integrar no `ShipFilterContext`

No `useEffect` de inicializacao:

```text
// Prioridade: localStorage > navio favorito > null (todas)
if (isFilterEnabled) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    setSelectedShipId(stored);
  } else if (favoriteShipId) {
    setSelectedShipId(favoriteShipId);
  }
}
```

### 4. UI no Header -- Estrela nos navios

No dropdown e drawer de selecao de navios, cada item ganha um botao de estrela (Star/StarOff do Lucide). Clicar na estrela favorita aquele navio. O navio favoritado mostra a estrela preenchida.

```text
[* Navio Alpha]     <-- favoritado (estrela preenchida)
[  Navio Beta ]     <-- nao favoritado (estrela vazia)
[  Navio Gamma]
```

### 5. Offline -- Download filtrado pelo favorito

No `getUserShipIds()` do `useOfflineSync.ts`:

```text
if (role === 'admin' || role === 'admin_master') {
  // Verificar se tem navio favorito
  const { data: fav } = await supabase
    .from('user_favorites')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_type', 'ship')
    .maybeSingle();

  if (fav?.entity_id) {
    return [fav.entity_id]; // Baixar apenas o favorito
  }
  return null; // Sem favorito = baixar tudo
}
```

### 6. Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar trigger `enforce_single_favorite_ship` |
| `src/hooks/useFavoriteShip.ts` | Novo hook dedicado |
| `src/contexts/ShipFilterContext.tsx` | Usar favorito como default |
| `src/components/layout/Header.tsx` | Adicionar estrela nos itens de navio |
| `src/hooks/useOfflineSync.ts` | Filtrar download pelo favorito |
| `src/i18n/locales/en.json` e `pt-BR.json` | Traducoes ("Navio favorito", "Favoritar navio") |

### 7. Fluxo do usuario

1. Admin faz login -> ve "Todas as Unidades" (sem favorito ainda)
2. Abre o seletor de navios -> clica na estrela do "Navio Alpha"
3. Toast: "Navio Alpha definido como favorito"
4. Na proxima vez que acessar, "Navio Alpha" ja esta selecionado automaticamente
5. Offline: so baixa dados do "Navio Alpha"
6. Para mudar: clica na estrela de outro navio (ou remove a estrela do atual)
