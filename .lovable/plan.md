## Objetivo

Refinar o módulo Obs Cards em 4 frentes: gráficos mais ricos, exportação PDF setorizada (padrão app), agregação temporal por mês/ano e classificação IA mais detalhada (eliminar "Outros").

---

## 1. Eliminar "Outros" — IA mais granular

**Problema:** muitos cards caem em `Other` porque a taxonomia atual é genérica e o prompt aceita "Other" como saída válida.

**Mudanças em `supabase/functions/classify-obs-cards/index.ts`:**

- Expandir taxonomia para refletir **tipos de risco HSSE reais** (não só temas):
  - Risco físico: Queda de altura, Queda de objetos, Esmagamento/Prensagem, Impacto/Choque mecânico, Corte/Perfuração, Escorregão e tropeço.
  - Risco químico: Exposição a produtos químicos, Vazamento/Derramamento.
  - Risco elétrico: Choque elétrico, Arco elétrico.
  - Risco térmico: Queimadura/Fogo, Estresse térmico.
  - Risco ergonômico: Postura/Esforço repetitivo, Levantamento manual.
  - Risco de processo: Pressão/Liberação de energia, Atmosfera explosiva.
  - Risco operacional: EPI ausente/inadequado, Permissão de trabalho, Sinalização/Isolamento, Içamento/Rigging, Espaço confinado, Trabalho a quente.
  - Risco ambiental: Vazamento ao mar, Resíduos.
  - Comportamental: Ato inseguro, Falta de atenção.
  - Organização: Housekeeping, Ferramenta/Equipamento inadequado.
- **Remover `Other` do enum.** Forçar o modelo a escolher a categoria mais provável.
- Reforçar prompt: "NUNCA retorne categoria genérica. Sempre identifique o tipo de risco mais provável com base no contexto."
- Adicionar campo `ai_risk_level` (`low`/`medium`/`high`/`critical`) e `ai_reasoning` curto (1 frase) no tool schema — alimenta detalhamento.
- Trocar modelo para `google/gemini-2.5-flash` (mais preciso que `flash-lite`) e reduzir batch para 25 (melhor qualidade).
- Reprocessamento: novo botão "Reclassificar tudo" que zera `ai_category` antes de rodar.

**Migration:** adicionar colunas `ai_risk_level text` e `ai_reasoning text` em `obs_cards`. Entregue como SQL bruto + comando CLI no chat (backend externo `ovugummbxablwmbpbbhj`).

---

## 2. Visão temporal mês/ano

**Problema:** datas vêm por dia, gráfico "Tendência mensal" funciona, mas filtros e detalhamento mostram granularidade diária.

**Mudanças em `ObsCardsDashboard.tsx`:**

- Novo filtro **"Período"**: `Mês/Ano` (default) | `Trimestre` | `Ano`.
- Toda agregação temporal (`monthly`, tendências, séries) respeita o seletor.
- Eixo X formatado humanizado: `Jan/2025`, `Q1 2025`, `2025`.
- Em cards/tabelas que exibem data individual, mostrar apenas mês/ano via `formatMonthYear()` em `src/utils/dateFormat.ts` (adicionar helper se não existir).
- Remover qualquer referência a `due_date` diária em KPIs — converter "Atrasados" para "Atrasados neste mês".

---

## 3. Gráficos melhores

**Mudanças em `ObsCardsDashboard.tsx`:**

- Substituir Pies simples por **donut com label central** (total no meio).
- Tendência mensal: trocar `LineChart` por `AreaChart` empilhado com gradiente (BCO vs PSO) + linha de tendência.
- "Por categoria": ordenar desc, top 12, com barras horizontais + valores ao final.
- Novo gráfico **"Heatmap Área × Tipo de Risco"** (matriz colorida) no tab Áreas.
- Novo gráfico **"Severidade ao longo do tempo"** (stacked bar mensal: low/medium/high/critical).
- KPI cards: adicionar mini-sparkline (últimos 6 meses) nos principais.
- Cores via tokens semânticos do `index.css` (não hardcoded HSL).

---

## 4. Exportação PDF setorizada

**Padrão do app:** seguir `src/utils/pdfExport.ts` (ou similar usado em relatórios atuais — A4, header com logo branding, footer com data/usuário, fontes 8pt, fotos Base64 — memória `padrao-metadados-e-layout-relatorios`).

**Novo arquivo `src/utils/obsCardsPdfExport.ts`:**

- Função `exportObsCardsDashboardPDF({ dataset, cards, filters, sector? })`:
  - **Capa:** logo da organização, título "Relatório Obs Cards — {Setor}", período, filtros aplicados, total.
  - **Sumário executivo:** KPIs em grid.
  - **Por tipo de risco:** ranking + gráfico de barras.
  - **Por área/setor:** uma seção por área (quebra de página) com KPIs locais, top 5 riscos, lista de cards UNSAFE em aberto.
  - **Tendência mensal:** gráfico + tabela.
  - **Apêndice:** lista completa de cards filtrados.
- Gráficos renderizados via `html2canvas` em containers off-screen (pattern já usado no app) OU SVG → PNG do recharts.

**UI:**

- Botão "Exportar PDF" no `PageHeader` do dashboard com dropdown:
  - "Relatório consolidado"
  - "Relatório por setor" → submenu lista cada área/departamento → gera PDF específico ou ZIP com um PDF por setor.

---

## Detalhes técnicos

- **Backend externo:** todas as alterações de schema (`ai_risk_level`, `ai_reasoning`) e deploy da função `classify-obs-cards` serão entregues como SQL bruto + comandos CLI para você aplicar manualmente no projeto `ovugummbxablwmbpbbhj`. Após migration, comando `supabase gen types typescript --project-id ovugummbxablwmbpbbhj` para regenerar `types.ts`.
- **i18n:** todos os novos labels em `src/locales/{pt,en,es}/translation.json` sob `obsCards.*`.
- **Sem alterações de layout fora de Obs Cards.** Mantém UI/UX, espaçamentos, tipografia, navegação.
- **Loader:** componente `Spinner` padrão (memória loader-spinner-standard).
- **Datas:** somente helpers de `src/utils/dateFormat.ts`.

---

## Entregas nesta ordem

1. Migration SQL + redeploy da edge function (com nova taxonomia, sem "Outros", com risk_level/reasoning).
2. Frontend: filtro de período, gráficos melhorados, novos charts.
3. Exportação PDF (consolidado + por setor).
4. i18n completo para tudo acima.
