
# Unificar Formulario de Inspeção: Eliminar o Formulario Offline Separado

## Problema

Atualmente existem **dois formularios de inspeção separados**:
1. **`InspectionFormDialog`** (online) -- formulario completo, com traduções, scroll, campos de inspetor, data, assinatura, fotos, etc.
2. **`OfflineInspectionDialog`** (offline) -- formulario separado, com problemas de scroll, traduções faltando (chaves i18n aparecendo cruas na tela), e UX inferior.

O `InspectionFormDialog` **ja suporta modo offline** internamente (verifica `isOnline` e salva localmente via `addPendingInspection`). Porem, o `NewInspectionDialog` roteia usuarios offline para o formulario separado inferior.

## Solucao

Eliminar o `OfflineInspectionDialog` e usar o `InspectionFormDialog` tambem quando offline. Isso garante experiencia identica em ambos os modos.

## Alteracoes

### 1. `src/components/inspections/NewInspectionDialog.tsx`
- Quando offline e o usuario seleciona um equipamento, em vez de abrir `OfflineInspectionDialog`, converter o `CachedEquipment` para o tipo `Equipment` e abrir o `InspectionFormDialog` normalmente.
- Remover toda a logica separada de `selectedOfflineEquipment`, `offlineInspectionDialogOpen`, e `handleOfflineInspectionClose`.
- Remover o import de `OfflineInspectionDialog`.
- Unificar o fluxo: tanto online quanto offline usam `setSelectedEquipment` + `setInspectionDialogOpen` + `InspectionFormDialog`.

### 2. `src/components/equipment/InspectionFormDialog.tsx`
- Ja tem suporte offline, mas precisa de pequenos ajustes:
  - O botao de submit mostra `inspectionForm.saveOffline` sempre -- ajustar para mostrar texto diferente conforme `isOnline` (ex: "Registrar Inspeção" quando online, "Salvar Offline" quando offline).
  - O campo de Inspetor (`inspectorId`) usa `useTechniciansAndAdmins()` que depende de rede. Quando offline, pre-preencher com o usuario logado e desabilitar o campo (ja que nao ha lista de inspetores disponivel offline).
  - O campo de `next_inspection_date` pode permanecer, sera ignorado no sync offline se vazio.

### 3. Remover `src/components/offline/OfflineInspectionDialog.tsx`
- O arquivo inteiro pode ser removido pois nao sera mais utilizado.

## Detalhes Tecnicos

A conversao de `CachedEquipment` para `Equipment` no fluxo offline ja existe parcialmente no `NewInspectionDialog` (funcao `convertToEquipmentType`). O ajuste e fazer o path offline tambem passar por essa conversao:

```text
Offline Equipment Selected
  -> Convert CachedEquipment to EquipmentWithCategory (ja feito no equipmentList useMemo)
  -> convertToEquipmentType()
  -> InspectionFormDialog (mesmo componente do online)
  -> isOnline check interno salva via addPendingInspection
```

O `InspectionFormDialog` ja carrega checklist via `useDefaultChecklistTemplate` que faz query ao banco. Quando offline, essa query retornara vazio/erro, e o fallback para checklist padrao ja existe (linhas 150-166). Para garantir que o template correto do cache seja usado offline, podemos adicionar uma prop opcional `offlineTemplateItems` ao `InspectionFormDialog`.

### Resumo de arquivos alterados:
- **`src/components/inspections/NewInspectionDialog.tsx`** -- simplificar fluxo, remover path offline separado
- **`src/components/equipment/InspectionFormDialog.tsx`** -- adicionar prop `offlineTemplateItems`, ajustar texto botao submit, tratar inspetor offline
- **Remover `src/components/offline/OfflineInspectionDialog.tsx`** -- nao mais necessario
