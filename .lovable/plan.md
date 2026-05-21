# Reestruturação da Sidebar — Portal de HSSE

Transformar o sistema em **Portal de HSSE** com duas categorias agrupadas (colapsáveis) na sidebar, mantendo todas as funcionalidades atuais dentro de "Gestão de Equipamentos" e preparando o caminho para "Gestão de Saúde > Heat Stress".

## Mudanças

### 1. Traduções (`src/i18n/locales/pt-BR.json` e `en.json`)
Em `navigation`:
- `appTitle`: "Portal de HSSE" (ambos idiomas)
- `groupEquipment`: "Gestão de Equipamentos" / "Equipment Management"
- `groupHealth`: "Gestão de Saúde" / "Health Management"
- `heatStress`: "Heat Stress" (ambos)

### 2. `src/components/layout/AppSidebar.tsx`
- Criar componente interno `NavGroup` (header colapsável com chevron, igual ao padrão da imagem de referência)
- Agrupar os itens existentes (Dashboard, Equipamentos, Inspeções, Manutenção, Certificados, Recomendações Pendentes, Relatórios, Alertas, Categorias, Supervisor) dentro de **Gestão de Equipamentos** (aberto por padrão)
- Adicionar grupo **Gestão de Saúde** (aberto por padrão) contendo apenas **Heat Stress** (ícone `Thermometer`, rota `/heat-stress`)
- Manter seção admin (Users, Audit Log, Health Check, Platform Admin) fora dos grupos, como hoje
- Título "Portal de HSSE" já vem automático via `SystemLogo` (que lê `navigation.appTitle`)
- Quando `collapsed`, os labels de grupo somem (mantém só ícones, igual à lógica existente)

### 3. `src/components/layout/MobileSidebar.tsx`
- Mesma estrutura de grupos colapsáveis (Gestão de Equipamentos + Gestão de Saúde com Heat Stress)

### 4. `src/pages/HeatStress.tsx` (novo, placeholder mínimo)
- Página com apenas `PageHeader` mostrando título "Heat Stress" e mensagem "Em breve" / "Coming soon" (i18n)
- Sem conteúdo funcional, conforme solicitado — apenas para o atalho não cair em 404

### 5. `src/App.tsx`
- Registrar rota `/heat-stress` (lazy) dentro de `AppLayout` + `ProtectedRoute`

## Fora de escopo
- Lógica de heat stress (cálculos, formulários, dados)
- Mudanças no header, no onboarding ou em outras páginas
- Migração de dados ou backend
