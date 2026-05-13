## Objetivo

Expandir o tour de onboarding para cobrir todas as páginas principais do menu lateral e corrigir o passo "Your Profile" que hoje aponta para um seletor inexistente — ele deve destacar o botão de perfil no canto superior direito do header.

## Mudanças

### 1. Adicionar `data-tour` no botão de perfil do header
**Arquivo:** `src/components/layout/Header.tsx` (linha ~825)

Adicionar `data-tour="profile"` no `<Button>` do `DropdownMenuTrigger` do User Menu (atualmente sem âncora). Assim o passo "Your Profile / Seu Perfil" do tour vai apontar para o avatar/dropdown do usuário no header.

### 2. Adicionar `data-tour` nas páginas que faltam no sidebar
**Arquivo:** `src/components/layout/AppSidebar.tsx`

Envolver os `NavItem` que ainda não têm âncora com `<div data-tour="...">`:
- `certificates` (linha 114)
- `pending-recommendations` (linha 115)
- `categories` (linha 122)
- `supervisor` (linha 123)
- `users` (linha 129, admin)
- `audit-log` (linha 130, admin)
- `health-check` (linha 135, admin master/platform owner)

### 3. Expandir os passos do tour
**Arquivo:** `src/hooks/useOnboarding.ts`

Reordenar e adicionar passos seguindo a ordem do menu. Cada passo verifica `document.querySelector(element)` antes de incluir, para pular itens não visíveis ao role do usuário (ex.: `users`, `audit-log`, `health-check` só aparecem para admin/admin master). Construir os steps dinamicamente filtrando os elementos presentes no DOM.

Nova ordem de passos:
1. Sidebar (intro)
2. Dashboard
3. Equipment
4. Inspections
5. Maintenance *(novo)*
6. Certificates *(novo)*
7. Pending Recommendations *(novo)*
8. Reports
9. Alerts
10. Categories *(novo)*
11. Supervisor *(novo)*
12. Users *(novo, admin)*
13. Audit Log *(novo, admin)*
14. Health Check *(novo, admin master/platform owner)*
15. Profile (agora aponta corretamente para o botão no header)
16. Digital Signature (mantido)
17. Keyboard Shortcuts (mantido)
18. Ready to Start (mantido)

Corrigir também o passo "Profile" para usar `side: 'bottom'` e `align: 'end'`, já que o alvo está no canto superior direito.

### 4. Traduções
**Arquivos:** `src/i18n/locales/pt-BR.json` e `src/i18n/locales/en.json`

Adicionar em `onboarding.*` as chaves novas (com title + description curtos para cada um):
- `maintenance` / `maintenanceDesc`
- `certificates` / `certificatesDesc`
- `pendingRecommendations` / `pendingRecommendationsDesc`
- `categories` / `categoriesDesc`
- `supervisor` / `supervisorDesc`
- `users` / `usersDesc`
- `auditLog` / `auditLogDesc`
- `healthCheck` / `healthCheckDesc`

Manter tom curto e instrutivo, consistente com os textos existentes, em PT-BR e EN.

## Notas técnicas

- Os passos com `element` que não existirem no DOM (role sem permissão) serão filtrados antes de inicializar o `driver()`, evitando popovers vazios.
- Nenhuma mudança de lógica de negócio; apenas UI/UX e i18n.
- Sem alterações em rotas, RLS, ou dados.
