
# Módulo eV&V — Plano de Implementação

Funcionalidade nova baseada no spec "All Safe - Digital Tool". Será integrada como uma nova **seção na sidebar** (grupo "eV&V") com submenu: Forms, History, Reports.

---

## 1. Backend (Supabase externo `ovugummbxablwmbpbbhj`)

Como o backend real é externo, vou **gerar o SQL completo no chat** para você colar manualmente no Supabase Dashboard. Sem `supabase--migration`.

### Tabelas novas (schema `public`)

- **`evv_locations`** — `id`, `name` (Guyana/Angola/Brazil), `organization_id`, `created_at`
- **`evv_vessels`** — `id`, `location_id` FK, `name` (FPSO Unity, Destiny, Prosperity, Cidade de Anchieta...), `organization_id`
- **`evv_submissions`** — `id`, `organization_id`, `user_id`, `form_type` (safeguard/leaders/workers/tlo/aar), `status` (draft/completed/not_synced), `scope` jsonb (environment, location_id, vessel_id, department, your_org, your_role, task_description, observed_org, observed_role), `answers` jsonb (categorias → perguntas → {rating, deficiencies[]}), `comments`, `submitted_at`, `client_id` (uuid do cliente para idempotência offline), `created_at`, `updated_at`
- Seed inicial dos locations + vessels (Guyana → Unity/Destiny/Prosperity; Brazil → Cidade de Anchieta).

GRANTs + RLS:
- SELECT para `authenticated` na mesma `organization_id` (via `user_belongs_to_organization`).
- INSERT/UPDATE submissions: dono (`user_id = auth.uid()`).
- Locations/Vessels: read-only para org members; manage para admin_master.

### Catálogo de perguntas
Hard-coded em TS (`src/features/evv/catalog.ts`) — 17 categorias LSR, com as 3 obrigatórias do spec totalmente preenchidas (Confined Space, Bypassing Safety Controls, Hot Work) e as deficiências específicas de Hot Work conforme listadas. Demais categorias ficam como stubs configuráveis para evolução futura.

---

## 2. Frontend

### Sidebar (`AppSidebar.tsx` + `MobileSidebar.tsx`)
Adicionar novo `NavGroup` **"eV&V"** com ícone `ClipboardList`/`ShieldCheck`:
- `/evv` — Home (botão Sync + atalhos)
- `/evv/forms` — Seleção do formulário (5 cards)
- `/evv/forms/:formType` — Wizard multi-step
- `/evv/history` — Tabela de submissões
- `/evv/reports` — Dashboard (gate: admin/admin_master/platform_owner)

### Componentes (`src/features/evv/`)
- `EvvHome.tsx` — KPIs + botão Sync com estados (idle/ongoing/completed)
- `FormSelector.tsx` — 5 cards (Safeguard, Leaders Engagement, Workers Engagement, TLO, AAR)
- `EvvWizard.tsx` — Stepper 3 passos
  - **Step 1 ScopeStep** — Environment, Location, Vessel (dependente), Department, Your Organization, Your Role, Task Description. Para Leaders Engagement: campos extras "Organization being observed", "Role being observed".
  - **Step 2 CategoriesStep** — Accordion das 17 categorias; cada pergunta com 3 botões `Effective / Not Effective / Not Assessed`. Ao marcar **Not Effective**, expande bloco de checkboxes de deficiências (≥1 obrigatório para avançar — validação Zod).
  - **Step 3 CloseStep** — Textarea "Comments: Explain your intervention" + Submit.
- `HistoryTable.tsx` — colunas Form Type / Date / Status; permite reabrir drafts.
- `ReportsDashboard.tsx` — filtros (Environment, Location, Vessel, Date Range) + gráfico (Recharts) dos "Not Effective" mais frequentes; gate por role.

### Offline-first (`src/features/evv/offline.ts`)
- `localforage` (já no projeto via offlineStorage) para persistir drafts em tempo real (debounce 500ms) e submissions `not_synced`.
- Cada submission tem `client_id` (uuid) para idempotência.
- Hook `useEvvSync()` — detecta `navigator.onLine`, faz upsert em lote em `evv_submissions` por `client_id`.
- Botão Sync na Home: estados via toast (sonner) "Synchronization ongoing" → "Synchronization completed".

### i18n
Novas chaves em `pt-BR.json` e `en.json` sob `evv.*` (zero strings hardcoded).

---

## 3. Design
Reaproveita tokens do design system existente (Navy Blue & White). Botões de rating em variantes semânticas (success/destructive/muted) sem cores cruas. Mobile-first: cards stack, touch targets ≥44px, accordion full-width.

---

## 4. Permissões
- Forms/History: qualquer usuário autenticado da org.
- Reports: `isAdmin || isAdminMaster || isPlatformOwner` (mesmo padrão de `obs-cards`).

---

## 5. Entregáveis no chat
1. **SQL bruto** (CREATE TABLE + GRANT + RLS + seed) para colar no Dashboard.
2. **Comando** `supabase gen types typescript --project-id ovugummbxablwmbpbbhj > src/integrations/supabase/types.ts`.
3. Código React/TS completo no projeto.

---

## Fora de escopo nesta primeira entrega
- SBM SSO real (usa auth existente; "Your Role" é select manual).
- Conteúdo completo das 14 categorias LSR restantes (apenas placeholders editáveis; 3 obrigatórias do spec entregues completas).
- Export PDF do report (pode vir em iteração futura).

Confirma para eu seguir com a implementação?
