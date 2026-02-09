

# Download Offline Dinamico ao Trocar de Unidade

## Situacao Atual

- O download offline e feito com base no **navio favorito** (estrela)
- Se o admin troca o filtro para outra unidade (sem mudar o favorito), os dados offline continuam sendo apenas do navio favoritado
- O sync offline so roda no mount inicial ou quando o usuario clica em "Sincronizar"

## Mudanca Proposta

Quando o admin troca de unidade no seletor, o sistema deve:
1. Manter o favorito como default ao logar
2. Ao trocar para outra unidade, disparar um sync incremental automatico dos dados dessa unidade
3. Armazenar os dados da unidade ativa no storage offline (substituindo ou acumulando)

## Detalhes Tecnicos

### 1. Reagir a mudanca de `selectedShipId` no `useOfflineSync`

Adicionar um `useEffect` que observa o `selectedShipId` do `ShipFilterContext`. Quando muda para um navio diferente, dispara um sync parcial apenas daquela unidade.

### 2. Funcao `syncForShip(shipId)` 

Criar uma funcao dedicada que faz download incremental dos dados de um navio especifico, reutilizando a logica existente de `downloadEquipmentData`, `downloadInspections`, etc., mas passando o `shipId` como filtro.

### 3. Evitar syncs duplicados

Usar um ref para guardar o ultimo `shipId` sincronizado e um timestamp, evitando re-downloads desnecessarios se o usuario trocar e voltar rapidamente.

### 4. Arquivos a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useOfflineSync.ts` | Adicionar `useEffect` observando `selectedShipId`, criar `syncForShip()` |
| `src/components/layout/Header.tsx` | Nenhuma mudanca necessaria (ja seta o `selectedShipId`) |

### 5. Fluxo do usuario

1. Admin loga -> navio favorito "Alpha" ja selecionado -> dados de "Alpha" baixados offline
2. Admin troca para "Beta" no seletor -> sync automatico baixa dados de "Beta"
3. Admin volta para "Alpha" -> dados ja estao em cache, nao precisa re-baixar
4. Proximo login -> volta para "Alpha" (favorito) automaticamente

