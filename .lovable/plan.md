
# Plano: Módulo OBS Cards (BCO / PSO) no Portal

Adicionar módulo de análise de Observation Cards offshore ao portal, reutilizando arquitetura, autenticação multi-tenant, design system e padrões de UI/UX existentes.

**Acesso fase 1:**
- **Admin Master + Platform Owner**: upload, gerenciar datasets, excluir observações.
- **Demais papéis (Admin, Supervisor, Technician, Viewer)**: sem acesso ao módulo nesta fase — fica preparado para liberar visualização depois (RLS de SELECT já incluída, mas item do menu oculto).

Multi-tenant: cada organização vê e gerencia apenas seus próprios datasets (`organization_id` em todas as tabelas + Storage isolado).

## 1. Arquitetura & Integração

- Novo grupo no `AppSidebar` — "Segurança / HSE" com item **OBS Cards** (ícone `ShieldAlert`). Visível somente se `isAdminMaster || isPlatformOwner` na fase 1.
- Novas rotas em `src/App.tsx`, todas protegidas por `ProtectedRoute requiredRole="admin_master"` (com bypass de Platform Owner já existente):
  - `/obs-cards` — Dashboard interativo
  - `/obs-cards/upload` — Importação
  - `/obs-cards/datasets` — Lista de uploads (gerenciar/excluir)
  - `/obs-cards/table` — Tabela detalhada drill-down
- Reuso obrigatório: `AppLayout`, `PageHeader`, `Card`, `StatCard`, `Button`, `Tabs`, `Select`, `Popover`, `Calendar`, `Tooltip`, `Spinner` (padrão do projeto), `DashboardFilters` como referência visual.
- i18n: novas chaves em `pt-BR.json` e `en.json` sob `obsCards.*` (zero strings hardcoded, conforme memória).
- Datas via `src/utils/dateFormat.ts`.
- Query keys padrão: `['obs-datasets', orgId]`, `['obs-cards', datasetId, filters]`, `['obs-stats', datasetId, filters]`.

## 2. Modelo de Dados (Lovable Cloud)

Duas tabelas novas, multi-tenant via `organization_id`:

**`obs_card_datasets`** — um registro por upload  
Campos: `id`, `organization_id`, `name`, `original_filename`, `row_count`, `status` (processing/ready/failed), `column_mapping` (jsonb), `uploaded_by`, `uploaded_at`, `source_storage_path`.

**`obs_cards`** — um registro por observação  
Campos: `id`, `dataset_id` (FK cascade), `organization_id`,  
- Mapeados: `obs_type` (`BCO`|`PSO`), `status` (`SAFE`|`UNSAFE`), `creation_date`, `area`, `department`, `description`, `action_taken`, `responsible`, `due_date`, `close_date`  
- Derivados: `category` (PPE/Housekeeping/Behavior/Equipment/Dropped Objects/Process Failure/Other), `severity` (low/medium/high), `time_to_close_days`, `is_open` (bool), `month`, `year`, `nlp_confidence`  
- `raw_row` jsonb (linha original para tooltips ricos)

**Storage**: bucket privado `obs-cards-uploads`, isolado por `organization_id/dataset_id/arquivo`.

**RLS (fase 1)**:
- SELECT: usuários da mesma organização OU platform_owner — permissivo para liberar futura visualização.
- INSERT/UPDATE/DELETE: somente `is_admin_master(auth.uid())` OR `is_platform_owner(auth.uid())` + org match.

**Auditoria**: trigger `log_generic_changes` nas duas tabelas + adicionar `obs_card_datasets` e `obs_cards` ao allowlist de `revert_audit_log`.

## 3. Pipeline de Upload & Classificação

**Edge Function `obs-cards-import`** (Deno):
1. Recebe `dataset_id` + arquivo via signed URL do Storage.
2. Parse XLSX/CSV com `npm:xlsx`.
3. Auto-detecção de colunas por fuzzy-match PT/EN nos headers.
4. Derivação automática:
   - `time_to_close_days` = close_date − creation_date
   - `month`/`year` de creation_date
   - `category` via regex de keywords no description (configurável)
   - `severity` heurística (palavras-chave + UNSAFE + PSO)
5. NLP via Lovable AI (`google/gemini-3-flash-preview`) em lote para reclassificar `BCO` (humano/comportamento) vs `PSO` (processo/equipamento) quando ausente/ambíguo. Cache por hash de description.
6. Bulk insert em chunks de 500.
7. Retorna sumário (linhas processadas, ignoradas, mapeamento).

**Edge Function `obs-cards-insights`**: gera Smart Insights via Lovable AI sobre stats agregadas. Cache 1h por dataset+filtros.

**Frontend de upload**: drag-and-drop, preview do mapeamento detectado com ajuste manual, barra de progresso, validação prévia. Padrão visual igual ao `ImportEquipmentDialog`.

## 4. Telas do Dashboard

Layout "21st.dev style" usando tokens semânticos. Adicionar paleta SBM como tokens em `index.css`:
- `--obs-primary: 207 80% 21%` (#0B3C5D)
- `--obs-secondary: 204 56% 46%` (#3282B8)
- `--obs-accent: 14 87% 55%` (#F05A28)

Estrutura com `Tabs`:

1. **Executive Overview** — KPIs (`StatCard`): Total, % SAFE/UNSAFE, BCO, PSO, Open vs Closed, Avg Closing Time + tendência mensal (Recharts).
2. **BCO Analysis** — top comportamentos inseguros, trend, áreas críticas, recorrência.
3. **PSO Analysis** — alta severidade, equipment-related, process failures, distribuição por área.
4. **Critical Areas** — heatmap Área × Categoria.
5. **Performance** — ranking de departamentos, eficiência de fechamento, top SAFE contributors.

**Filtros globais** (`ObsCardsFilters` inspirado em `DashboardFilters`): toggle BCO/PSO obrigatório, Área, Depto, Status, Período, Categoria, Severidade. Estado via `ObsCardsFilterContext`.

**Tooltips ricos** (`ObsTooltipCard` sobre `Tooltip` shadcn): descrição completa, ação tomada, área, depto, status, data, responsável.

## 5. Recursos Avançados

- **Smart Insights** — card no topo do Overview com texto gerado pela Edge Function.
- **Alertas** — badges para overdue (due_date < hoje && aberto) e PSO de alta severidade.
- **Drill-down** — clique em qualquer chart abre `Sheet` lateral com tabela filtrada.
- **Data Table** (`/obs-cards/table`) — TanStack Table com busca, filtros por coluna, exportação CSV/XLSX (base em `exportEquipment`).

## 6. Segurança & Auditoria

- Todas mutações: RLS + checagem de role server-side via funções existentes.
- Datasets e observações no allowlist de `revert_audit_log` (Ctrl+Z).
- Excluir dataset → cascade nas observações + remoção do arquivo do Storage.

## 7. Entregáveis

1. **Migration**: tabelas + RLS + bucket + grants + triggers de auditoria + allowlist do revert.
2. **Edge Functions**: `obs-cards-import`, `obs-cards-insights`.
3. **Páginas**: `ObsCardsDashboard.tsx`, `ObsCardsUpload.tsx`, `ObsCardsDatasets.tsx`, `ObsCardsTable.tsx`.
4. **Componentes**: `ObsCardsFilters`, `ObsTooltipCard`, `ExecutiveOverview`, `BCOAnalysis`, `PSOAnalysis`, `CriticalAreasHeatmap`, `PerformancePanel`, `SmartInsightsCard`, `ObsCardsImportDialog`.
5. **Hooks**: `useObsDatasets`, `useObsCards`, `useObsStats`, `useObsInsights`.
6. **i18n** PT/EN completo, item no sidebar, rota protegida.
7. **Tokens SBM** em `index.css` + extensão em `tailwind.config.ts`.

## Notas Técnicas

- A página inteira oculta para roles abaixo de Admin Master, mas as RLS de SELECT já cobrem todas as organizações para evitar nova migration quando liberarmos visualização.
- Toda navegação respeita o seletor de organização atual (`OrganizationContext`).
- Recharts (já presente no projeto) para todos os gráficos.

