# HSSE Connect - Especificacao Tecnica do Sistema

Versao do documento: 1.0  
Data de referencia: 29/07/2026  
Repositorio: `dev-brunopires/hsse-portal`  
Projeto Supabase: `ovugummbxablwmbpbbhj`  
Nome oficial do produto: `HSSE Connect`

## 1. Objetivo do Documento

Este documento consolida a especificacao tecnica e funcional do HSSE Connect para transferencia, auditoria, manutencao e evolucao por uma empresa de TI. Ele descreve a arquitetura atual, os principais modulos, regras de negocio, modelo de permissao, banco de dados, funcoes Supabase, pontos de seguranca, integracoes previstas e recomendacoes para continuidade.

O sistema e um portal web/PWA para gestao de HSSE em ambiente offshore, com foco inicial em operacoes SBM Offshore. A solucao centraliza gestao de equipamentos, inspecoes, certificados, manutencao, saude ocupacional, formularios V&V/eV&V, cartoes de observacao, auditoria, relatorios e administracao de usuarios/permissoes.

## 2. Visao Geral do Produto

HSSE Connect e uma aplicacao web responsiva com suporte PWA, desenvolvida para uso em desktop, tablet e celular. O produto foi pensado para operacoes offshore onde a disponibilidade de rede pode ser instavel, por isso existem mecanismos de cache, sincronizacao offline, persistencia local e recuperacao de sessoes.

Principais capacidades:

- Autenticacao segura via Supabase Auth.
- Organizacao corporativa fixa para operacao atual: SBM Offshore.
- Controle por roles globais e matriz granular de permissoes por modulo/pagina/acao.
- Gestao de embarcacoes, regioes e areas internas de navios.
- Inventario de equipamentos HSSE com certificados, vencimentos, inspecoes, manutencoes e relatorios.
- Formularios V&V/eV&V configuraveis com topicos, subtopicos, checklists, anexos, assinatura, historico, revisao e relatorios.
- Cartao de Observacao com IA para classificacao e analise de bases historicas.
- Novo formulario estruturado de Observacao de Seguranca baseado em cartoes BCO/PSO.
- Heat Stress e Health Check.
- Auditoria de alteracoes.
- PWA com fluxo mobile, navegacao por secoes e suporte a cache/offline.

## 3. Stack Tecnica

Frontend:

- React 18.
- TypeScript.
- Vite 8.
- React Router DOM.
- TanStack React Query.
- Tailwind CSS.
- Radix UI / shadcn-style components.
- Lucide React para icones.
- i18next / react-i18next para dual language.
- Framer Motion para transicoes.
- Recharts para graficos.
- jsPDF, jspdf-autotable e html2canvas para relatorios PDF.
- SheetJS `xlsx` para importacao/exportacao Excel.
- vite-plugin-pwa para PWA.

Backend:

- Supabase Auth.
- Supabase Postgres.
- Supabase Row Level Security.
- Supabase Storage.
- Supabase Edge Functions.
- Supabase RPCs SQL.

### 3.1 Linguagens de Programacao e Marcacao

- TypeScript: linguagem principal do frontend React e das Edge Functions Supabase.
- JavaScript: ecossistema/runtime do frontend, bibliotecas Vite/React e scripts de build.
- SQL/PostgreSQL: schema, RLS, migrations, views, funcoes RPC e regras de acesso no banco.
- Deno TypeScript: runtime das Supabase Edge Functions.
- HTML/CSS: estrutura gerada pela SPA e estilizacao via Tailwind CSS.
- JSON: arquivos de traducao, manifest PWA, payloads de APIs e campos estruturados no banco.

### 3.2 Banco de Dados

- Tipo: banco relacional PostgreSQL gerenciado pelo Supabase.
- Recursos usados: tabelas relacionais, enums, indices, chaves estrangeiras, JSONB, arrays, funcoes SQL, triggers, views/RPCs e Row Level Security.
- Escopo de dados: multi-tenant por `organization_id`, com operacao atual centralizada na organizacao SBM Offshore.
- Armazenamento offline: IndexedDB no navegador para cache operacional e fila de acoes pendentes.
- Armazenamento de arquivos: Supabase Storage para anexos, certificados, fotos, logos e documentos.

### 3.3 APIs e Servicos

- Supabase Auth API: login, sessoes, refresh token, criacao e administracao de usuarios via Edge Functions.
- Supabase PostgREST/Data API: leitura e escrita das tabelas do schema `public`, sempre condicionada por RLS.
- Supabase RPC API: chamadas a funcoes como `get_my_access_context`, `get_user_role`, `get_user_ship_ids`, `user_has_ship_access` e funcoes de dashboard.
- Supabase Edge Functions API: endpoints server-side para criacao/exclusao/reset de usuarios, IA, importacao, health check, telemetria e integracoes.
- Supabase Storage API: upload/download de documentos, imagens, anexos e logos.
- API de IA: usada pela Edge Function `classify-obs-cards` para classificacao de cartoes de observacao.
- GitHub API/Repositorio: versionamento e historico de alteracoes.
- Vercel: build e publicacao do frontend.
- APIs futuras previstas: OneVision para V&V/PTW e IFS/CMMS para equipamentos/ordens de servico.

Deploy:

- GitHub como repositorio fonte.
- Branch principal atual: `main`.
- Vercel para deploy web.
- Projeto Supabase externo fixo no frontend: `https://ovugummbxablwmbpbbhj.supabase.co`.

## 4. Estrutura de Aplicacao

Arquivos centrais:

- `src/App.tsx`: composicao de providers, rotas publicas/protegidas e lazy loading.
- `src/integrations/supabase/client.ts`: cliente Supabase apontando para o projeto atual.
- `src/contexts/AuthContext.tsx`: sessao, perfil, role, platform owner e refresh de autenticacao.
- `src/contexts/OrganizationContext.tsx`: organizacao por subdominio, querystring ou membership do usuario.
- `src/contexts/ShipFilterContext.tsx`: filtro global de embarcacao.
- `src/config/accessControl.ts`: matriz de modulos, paginas e acoes.
- `src/hooks/useAccess.ts`: avaliacao de permissao no frontend.
- `src/hooks/useOfflineSync.ts`: sincronizacao/cache offline.
- `src/hooks/useUserShips.ts`: acesso a navios, incluindo admin/admin_master com todos os navios da organizacao.
- `src/i18n/locales/pt-BR.json` e `src/i18n/locales/en.json`: traducoes.

Providers principais:

- `QueryClientProvider`: cache e sincronizacao de chamadas.
- `ThemeProvider`: tema claro/escuro.
- `AuthProvider`: autenticacao e perfil.
- `LanguageProvider`: idioma.
- `OrganizationProvider`: contexto organizacional.
- `ShipFilterProvider`: filtro de navio.
- `OnboardingProvider`: onboarding.
- `ChunkErrorBoundary`: resiliencia a falhas de carregamento de chunks.

## 5. Rotas e Modulos

Rotas publicas:

- `/auth`: login.
- `/auth/reset-password`: redefinicao de senha.

Rotas protegidas principais:

- `/`: pagina inicial/navegacao por secoes.
- `/equipment-dashboard`: dashboard de gestao de equipamentos.
- `/equipment`: inventario/listagem de equipamentos.
- `/inspections`: inspecoes.
- `/reports`: relatorios consolidados.
- `/alerts`: alertas.
- `/pending`: recomendacoes/pendencias.
- `/maintenance`: manutencao.
- `/certificates`: certificados.
- `/categories`: categorias e templates de checklist.
- `/users`: usuarios, roles, navios, regioes e acessos.
- `/settings`: configuracoes.
- `/audit-log`: log de auditoria.
- `/profile`: perfil do usuario.
- `/offline`: dados offline.
- `/diagnostics`: diagnosticos.
- `/health-check`: health check.
- `/heat-stress`: heat stress.
- `/obs-cards`: Observation Card com IA.
- `/obs-cards/safety-observation`: formulario de Observacao de Seguranca.
- `/obs-cards/reports`: relatorios de Observacao de Seguranca.
- `/obs-cards/upload`: upload de bases de cartao de observacao.
- `/obs-cards/datasets`: bases/datasets de cartoes.
- `/evv`: home V&V.
- `/evv/forms`: seletor de formularios.
- `/evv/forms/:formType`: wizard de formulario V&V.
- `/evv/history`: historico V&V.
- `/evv/history/:id`: detalhe de submissao V&V.
- `/evv/review`: fila de revisao V&V.
- `/evv/reports`: relatorios V&V.
- `/evv/templates`: administracao de templates V&V.
- `/platform-admin`: administracao de plataforma.

## 6. Modelo de Autenticacao e Autorizacao

### 6.1 Autenticacao

A autenticacao e feita via Supabase Auth. O frontend usa persistencia em `localStorage`, refresh automatico de token e verificacoes adicionais quando a aba volta ao foco ou a conexao retorna.

Funcionalidades:

- Login com email e senha.
- Reset de senha via Edge Function.
- Criacao de usuarios via Edge Function para evitar alterar a sessao do administrador logado.
- Auto-confirmacao de email na criacao administrativa.
- Perfil complementar em `profiles`.

### 6.2 Roles Globais

Roles suportadas:

- `admin_master`: acesso amplo de administracao.
- `admin`: administracao operacional.
- `supervisor`: supervisao, revisao e aprovacao conforme modulo.
- `technician`: criacao/edicao operacional.
- `viewer`: visualizacao e criacao limitada.

O frontend considera `admin` e `admin_master` como acesso total por padrao. `platform_owner` e uma camada acima, armazenada em `platform_owners`.

### 6.3 Matriz Granular de Permissao

As permissoes granulares sao controladas por:

- `app_modules`
- `app_module_pages`
- `user_module_permissions`
- `access_profiles`
- `access_profile_permissions`
- `user_access_profiles`

Acoes suportadas:

- `view`
- `create`
- `edit`
- `delete`
- `approve`
- `export`
- `admin`

No frontend, a avaliacao e feita por `useAccess()`. Se existir permissao explicita para o usuario, ela passa a reger o acesso granular. Se nao houver permissao explicita, aplica-se a regra padrao por role.

### 6.4 Organizacao

A operacao atual foi consolidada para SBM Offshore:

- Organizacao SBM: `00000000-0000-0000-0000-000000000001`.
- Criacao de usuario e restringida para SBM no Edge Function `create-user`.
- Usuarios devem ter registro em `profiles`, `user_roles` e `user_organizations`.

## 7. Modulo de Gestao de Equipamentos

Objetivo: controlar inventario, validade, inspecoes e documentacao de equipamentos HSSE por navio/categoria.

Funcionalidades:

- Cadastro, edicao, exclusao e listagem de equipamentos.
- Campos de identificacao: codigo interno, nome, categoria, tipo, fabricante, modelo, serial, unidade, localizacao, capacidade.
- Datas: fabricacao, aquisicao, validade, vencimento de certificado, ultima/proxima inspecao, teste hidrostatico, calibracao.
- Status operacional.
- Filtro por navio, categoria, status e busca textual.
- Importacao/exportacao de equipamentos.
- QR Code/scanner.
- Relacionamento entre equipamentos pai/filho.
- Transferencia de equipamentos entre navios.
- Upload e gestao de documentos.
- Dashboard com KPIs, graficos, certificados vencendo e pendencias.

Tabelas principais:

- `equipment`
- `categories`
- `checklist_templates`
- `checklist_template_items`
- `equipment_documents`
- `equipment_relationships`
- `equipment_transfers`
- `ships`
- `ship_areas`
- `regions`

## 8. Modulo de Inspecoes

Objetivo: registrar inspecoes operacionais por equipamento/categoria e gerar pendencias/recomendacoes.

Funcionalidades:

- Criacao de inspecoes vinculadas a equipamentos.
- Checklists por categoria/template.
- Registro de conformidades, nao conformidades, recomendacoes e observacoes.
- Captura/upload de fotos.
- Assinatura manual e automatica conforme perfil.
- Alertas de inspeoes vencidas ou proximas.
- Pendencias automaticas para reinspecao/carryover.
- Historico e exportacao.

Tabelas relacionadas:

- `inspections` e tabelas auxiliares de itens/fotos, conforme schema Supabase gerado.
- `pending_inspections`
- `equipment`
- `categories`
- `profiles`
- `audit_logs`

## 9. Modulo de Certificados

Objetivo: controlar certificados, validade, renovacoes e documentacao vinculada a equipamentos.

Funcionalidades:

- Cadastro de certificados por equipamento.
- Tipos: certificado, documento, licenca ou tipos customizados.
- Campos: numero, emissor, emissao, validade, renovacao, arquivo, status e notas.
- Renovacao individual e em lote.
- Historico de renovacoes.
- Indicadores de vencidos/a vencer.
- Exportacao e relatorios.

Tabelas principais:

- `certificates`
- `certificate_renewals`
- `equipment`

## 10. Modulo de Manutencao

Objetivo: registrar solicitacoes, planos e acompanhamento de manutencao de equipamentos.

Funcionalidades:

- Criacao de solicitacoes de manutencao.
- Vinculo a equipamento/navio.
- Status, prioridade, responsavel, datas e observacoes.
- Dialogs de detalhe, edicao e planejamento.
- Relatorios e dashboard de tendencias.

Tabelas relacionadas:

- `maintenance_requests` e estruturas correlatas no schema.
- `equipment`
- `ships`
- `profiles`

## 11. Modulo V&V / eV&V

Objetivo: digitalizar e padronizar o processo de Verification & Validation, permitindo registro estruturado, evidencias, revisao e relatorios.

### 11.1 Estrutura Funcional

O V&V e composto por:

- Home do modulo.
- Seletor de formularios.
- Wizard paginado.
- Historico de registros.
- Detalhe da submissao.
- Fila de revisao por supervisores/admins.
- Relatorios.
- Administracao de templates.

### 11.2 Formularios e Templates

A estrutura de templates suporta:

- Formularios.
- Topicos.
- Subtopicos.
- Checklists.
- Itens obrigatorios/opcionais.
- Textos bilinguais.
- Regras por tipo de formulario.

O objetivo atual e permitir que a area crie temas como:

- Trabalho em altura.
- Acesso por corda.
- Checklist de conformidade de acesso por corda.
- Outros formularios operacionais V&V.

### 11.3 Campos de Escopo

Campos principais do escopo V&V:

- Ambiente.
- Area geografica/projeto.
- Organizacao.
- Departamento.
- Data e hora da visita.
- Site/Vessel.
- Localizacao no navio, usando areas cadastradas no padrao do cadastro de equipamentos.
- Permissao de Trabalho envolvida.
- Numero da Permissao de Trabalho.
- Atividade critica.
- Lista de atividades criticas vinculadas.
- Descricao da tarefa.

### 11.4 Fluxo de Submissao

Estados esperados:

- Rascunho.
- Pendente de revisao.
- Aprovado/concluido.
- Rejeitado.

O fluxo inclui:

- Preenchimento em wizard.
- Validacao de campos obrigatorios com indicacao visual.
- Anexos.
- Comentarios.
- Assinatura automatica do usuario quando configurada.
- Envio para revisao quando aplicavel.
- Revisao por supervisor/admin.
- Historico e relatorio PDF.

### 11.5 Regras de Revisao

- Supervisores, admins e admin_master podem revisar, conforme permissao.
- O sistema possui protecao de revisao "four eyes" no banco, evitando que o proprio criador revise quando a regra exigir independencia.
- Revisores podem aprovar ou rejeitar registros.
- Status e dados de revisao devem aparecer no historico, detalhe e relatorios.

Tabelas principais:

- `evv_submissions`
- `evv_attachments`
- Tabelas de templates V&V, quando presentes no schema.
- `profiles`
- `ships`
- `ship_areas`
- `audit_logs`

## 12. Modulo Observation Card com IA

Objetivo: importar bases historicas de cartoes de observacao e aplicar analise assistida por IA com criterios de seguranca senior.

Funcionalidades:

- Upload de planilhas de cartao de observacao.
- Criacao e gestao de datasets.
- Classificacao IA por lote.
- Reclassificacao completa ou filtrada.
- Indicador de processamento com progresso e percentual.
- Dashboards de risco, categoria, criticidade e status.
- Exportacao de relatorios.

Campos/analises IA:

- Categoria IA.
- Nivel de risco IA.
- Raciocinio/justificativa.
- Alinhamento com status safe/unsafe.
- Confianca.
- Score de criticidade.
- Necessidade de follow-up.
- Qualidade da acao tomada.
- Falha de barreira.
- Acao recomendada.

Edge Functions relacionadas:

- `obs-cards-import`
- `classify-obs-cards`

Tabelas relacionadas:

- `obs_card_datasets`
- `obs_cards`

## 13. Modulo Observacao de Seguranca

Objetivo: substituir/expandir o uso de cartoes fisicos por um formulario digital completo de observacao de seguranca.

Modelos contemplados:

- BCO: comportamento e condicoes.
- PSO: seguranca de processo.

Campos principais:

- Navio.
- Area/localizacao no navio.
- Data/hora.
- Turno.
- Tipo de atividade.
- Tipo de observacao.
- Categoria de risco.
- Fonte de energia.
- Pessoas expostas.
- Consequencia potencial.
- Severidade.
- Probabilidade.
- Nivel de risco.
- Risco residual apos acao.
- Stop Work.
- Potencial de fatalidade.
- Descricao da observacao.
- Percepcao de risco.
- Acao imediata.
- Pessoa notificada.
- Acao recomendada.
- Responsavel.
- Prazo.
- Follow-up requerido.
- CMMS requerido.
- Investigacao requerida.
- Compartilhar em TBT.
- Cartao indicado.
- Aprendizado.

Campos especificos BCO:

- Localizacao fisica.
- Checks de comportamento: PPE, ferramentas/equipamentos, manuseio manual, procedimentos, preparacao, comunicacao, stop work/intervencao.
- Checks de condicao: SIMOPS, mudanca no ambiente, acesso/egresso, housekeeping, slips/trips, trabalho em altura, objetos caidos, cabos, ventilacao, ruido, iluminacao, quimicos, barreiras/sinalizacoes.
- Checks de equipamento: eletrico, andaime, lifting/rigging, solda/corte, ferramentas, condicao de ferramentas/equipamentos, isolamentos.

Campos especificos PSO:

- Modo operacional.
- Manager site visit.
- Weeps and seeps.
- Tipo e volume.
- Local da fuga/vazamento.
- Causa principal.
- Salvaguardas principais de seguranca de processo.
- Process Safety Fundamentals.

Tabelas principais:

- `safety_observations`
- `ships`
- `ship_areas`
- `profiles`

## 14. Modulo Heat Stress

Objetivo: digitalizar planilhas atuais de Heat Stress para registro e controle de dados de estresse termico.

Funcionalidades:

- Formulario paginado no mesmo padrao visual do V&V.
- Captura de dados de ambiente, navio, area, data/hora, trabalhadores, exposicao, medico/saude e medicoes.
- Comparacao com estrutura de planilha operacional.
- Relatorios e PDF.
- Integracao com navio e area cadastrada.

Tabela principal:

- `heat_stress_records` ou tabela equivalente criada pela migration `20260707091343_add_heat_stress_details.sql`.

## 15. Modulo Health Check

Objetivo: acompanhar saude do sistema e/ou checks operacionais de saude conforme implementacao atual.

Funcionalidades:

- Pagina de health check.
- Cards de status/progresso.
- Historico de checks.
- Edge Function `health-check` para verificacoes administrativas.

## 16. Modulo Usuarios e Administracao

Objetivo: administrar usuarios, roles, organizacao, navios, regioes, perfis e permissoes.

Funcionalidades:

- Listagem de usuarios.
- Criacao de usuarios por Edge Function `create-user`.
- Edicao de perfil/role.
- Exclusao via Edge Function `delete-user`.
- Reset de senha via Edge Function `reset-user-password`.
- Associacao de navios para perfis operacionais.
- Admin/admin_master com acesso automatico a todos os navios da organizacao.
- Gestao granular de permissoes por modulo/pagina/acao.
- Gestao de regioes e navios.
- Campo de departamento/setor no perfil.

Regras importantes:

- O sistema atual esta bloqueado para criacao de usuarios na organizacao SBM.
- `admin_master` pode criar `admin` e `admin_master`.
- `admin` nao deve criar usuarios com role igual ou superior.
- Criacao administrativa nao deve trocar a sessao do usuario logado.

Tabelas principais:

- `profiles`
- `user_roles`
- `user_organizations`
- `user_ships`
- `platform_owners`
- `organizations`
- `regions`
- `ships`
- `user_module_permissions`
- `access_profiles`
- `access_profile_permissions`
- `user_access_profiles`

## 17. Modulo Auditoria

Objetivo: manter rastreabilidade das alteracoes relevantes do sistema.

Funcionalidades:

- Pagina de log de auditoria.
- Filtros por usuario, embarcacao, tipo e acao.
- Cards de resumo.
- Exportacao.
- Campo `organization_id` para escopo correto.
- Suporte a reversao quando implementado.

Tabela principal:

- `audit_logs`

Campos principais:

- `table_name`
- `record_id`
- `action`
- `old_data`
- `new_data`
- `changed_fields`
- `user_id`
- `user_name`
- `organization_id`
- `created_at`
- dados de reversao

## 18. PWA, Mobile e Offline

O app e PWA e deve funcionar em desktop, tablet, celular e instalacao mobile.

Recursos:

- Service Worker via `vite-plugin-pwa`.
- Manifest web.
- Cache de assets.
- Cache de dados via React Query e utilitarios offline.
- Indicadores de sincronizacao.
- Pagina de dados offline.
- Pull-to-refresh.
- Layout mobile com pagina inicial de secoes.
- Barra inferior mobile limitada a contexto de gestao de equipamentos, conforme ajuste recente.

Pontos de atencao:

- Service Worker pode manter versao antiga apos deploy. Em testes de producao, orientar logout/login e refresh completo.
- Fluxos offline devem ser testados por modulo critico: equipamentos, inspecoes, V&V e observacoes.
- Dados sensiveis offline devem ser tratados com politica corporativa clara.

## 19. Internacionalizacao

Idiomas atuais:

- Portugues brasileiro: `pt-BR`.
- Ingles: `en`.

Arquivos:

- `src/i18n/locales/pt-BR.json`
- `src/i18n/locales/en.json`

Regras:

- Novas funcionalidades devem registrar chaves nos dois idiomas.
- Evitar texto hardcoded em componentes.
- Exportacoes/PDFs tambem devem respeitar idioma ativo.
- V&V e Observation Card foram revisados parcialmente; ainda recomenda-se uma rodada QA completa por tela.

## 20. Edge Functions Supabase

Funcoes presentes:

- `create-user`: cria usuarios no Auth, profile, role, membership e navios; restringe organizacao SBM.
- `delete-user`: remove usuario e registros associados conforme permissao.
- `reset-user-password`: altera senha de usuario alvo sem depender do fluxo publico de reset.
- `classify-obs-cards`: classifica cartoes de observacao com IA.
- `obs-cards-import`: importa planilhas de cartoes.
- `ifs-integration`: base para integracao IFS/equipamentos.
- `check-inspection-deadlines`: verifica prazos de inspecao.
- `client-telemetry`: registra telemetria do cliente.
- `health-check`: verifica saude do backend.

Recomendacoes:

- Todas devem manter `verify_jwt = true`, salvo endpoints estritamente publicos.
- Nunca expor `service_role` no frontend.
- Padronizar retornos de erro em portugues/ingles para exibicao no app.
- Adicionar logs estruturados para troubleshooting.
- Aplicar rate limiting nos endpoints sensiveis.

## 21. RPCs e Funcoes SQL Relevantes

Funcoes de acesso:

- `get_my_access_context()`: retorna role e navios acessiveis do usuario.
- `get_user_role(_user_id uuid)`: fallback de role do usuario.
- `get_user_ship_ids(_user_id uuid)`: fallback de navios atribuidos.
- `user_has_ship_access(_user_id uuid, _ship_id uuid)`: valida acesso a navio.
- `user_belongs_to_organization(_user_id uuid, _organization_id uuid)`: valida membership.
- `has_role(_user_id uuid, _role app_role)`: valida role.
- `is_admin_master(_user_id uuid)`: valida admin master.
- `is_platform_owner(_user_id uuid)`: valida dono de plataforma.

RPCs de dashboard e relatorios tambem existem no schema conforme migrations anteriores.

## 22. Seguranca

Camadas atuais:

- Supabase Auth.
- RLS em tabelas publicas.
- Funcoes SQL com `SECURITY DEFINER` para operacoes controladas.
- Organizacao como escopo de dados.
- Permissoes por role e por matriz granular.
- Edge Functions com JWT.
- CSP em `index.html`, `vercel.json` e `_headers`.
- Separacao de `publishable key` no frontend e `service_role` somente em Edge Functions.
- Auditoria em `audit_logs`.

Pontos ja tratados:

- Projeto Supabase atualizado para `ovugummbxablwmbpbbhj`.
- `create-user` usa Edge Function e nao altera a sessao do admin.
- Criacao de usuarios restrita a SBM.
- `admin_master` corrigido para operar acima de `admin`.
- Front corrigido para carregar multiplas roles e escolher a mais alta.
- Admin/admin_master corrigidos para carregar todos os navios acessiveis sem depender de `user_ships`.

Recomendacoes de seguranca para empresa de TI:

- Revisar todas as policies RLS com matriz de acesso final.
- Garantir que toda tabela exposta tenha RLS ativo.
- Remover ou restringir views que possam bypassar RLS; usar `security_invoker` quando aplicavel.
- Revisar funcoes `SECURITY DEFINER`, search_path e grants.
- Centralizar rate limit em Edge Functions sensiveis.
- Definir politica de expiracao de JWT/sessao.
- Revisar armazenamento offline de dados sensiveis.
- Implementar backup/restore testado.
- Criar ambientes separados: dev, homologacao e producao.
- Criar monitoramento de erros frontend/backend.
- Revisar CSP e dominios permitidos antes de novas integracoes.

## 23. Integracoes Atuais e Previstas

Atuais/parciais:

- Supabase.
- GitHub/Vercel.
- Importacao Excel.
- Exportacao PDF/Excel.
- IA para cartoes de observacao.
- Estrutura inicial de IFS integration.

Previstas:

- OneVision para V&V:
  - buscar descricao da tarefa automaticamente;
  - preencher campo de task description;
  - vincular numero de Permissao de Trabalho;
  - futuramente consultar dados de PTW.
- IFS/CMMS:
  - sincronizar equipamentos;
  - abrir/consultar ordens de servico;
  - relacionar observacoes com CMMS.

## 24. Deploy e Operacao

Fluxo atual:

1. Desenvolvimento local no repositorio.
2. Commit Git.
3. Push para `main`.
4. Vercel detecta alteracao e publica.
5. Supabase Edge Functions e migrations devem ser aplicadas separadamente quando houver mudanca backend.

Comandos principais:

```bash
npm install --legacy-peer-deps
npm run dev
npx tsc -p tsconfig.app.json --noEmit
npm run build
npm run lint
```

Observacao:

- `npm run lint` global historicamente possui divida tecnica antiga no projeto. Validar pelo menos arquivos alterados e `tsc/build` antes de deploy.

## 25. Qualidade, Testes e Observabilidade

Testes manuais recomendados por release:

- Login/logout.
- Refresh completo e PWA mobile.
- Troca de idioma PT/EN.
- Criacao de usuario.
- Reset de senha.
- Acesso por role: admin_master, admin, supervisor, technician, viewer.
- Acesso por navio.
- Cadastro/edicao/exclusao de equipamento.
- Inspecao e pendencias.
- Certificados e renovacao.
- V&V: formulario, rascunho, envio, revisao, historico, detalhe, PDF.
- Observation Card: upload, classificacao IA, progresso, dashboard.
- Observacao de Seguranca: formulario, relatorio, PDF.
- Heat Stress.
- Auditoria.
- Offline/sync.

Observabilidade recomendada:

- Logs estruturados de Edge Functions.
- Monitoramento de erro frontend.
- Dashboards Supabase para latencia e erros.
- Alertas para falhas de Edge Function.
- Auditoria de operacoes administrativas.

## 26. Principais Riscos Tecnicos

- Dependencia de cache/PWA gerando percepcao de versao antiga apos deploy.
- Dados offline sensiveis sem politica corporativa formal.
- Algumas traducoes e PDFs podem ainda ter texto hardcoded.
- Lint global com divida tecnica.
- Chunk size alto no build, recomendando code splitting adicional.
- Necessidade de separar ambiente de producao/homologacao.
- Edge Functions devem ser mantidas sincronizadas com migrations.
- Integracoes OneVision/IFS ainda nao estao fechadas tecnicamente.

## 27. Backlog Recomendado para Fechamento

Prioridade alta:

- Revisao 360 de RLS, funcoes `SECURITY DEFINER`, storage e grants.
- Homologacao completa de usuarios/permissoes.
- Teste mobile/PWA em iOS e Android.
- Teste offline com perda real de rede.
- QA de V&V completo: templates, wizard, assinatura, revisao, relatorios.
- QA de Observation Card e Observacao de Seguranca.
- Revisao completa PT/EN em telas e PDFs.
- Monitoramento de Edge Functions.

Prioridade media:

- Limpeza do lint global.
- Otimizacao de chunks/bundle.
- Criar testes automatizados unitarios e E2E.
- Melhorar docs de migrations e runbooks.
- Criar homologacao separada.

Prioridade futura:

- Integracao OneVision.
- Integracao IFS/CMMS.
- Dashboards executivos avancados.
- Templates corporativos reutilizaveis por area/navio.
- Workflow avancado de aprovacao e assinatura.

## 28. Entregaveis para Empresa de TI

Ao assumir o projeto, a empresa de TI deve solicitar/acessar:

- Repositorio GitHub.
- Projeto Supabase.
- Projeto Vercel.
- Variaveis e secrets de Edge Functions.
- Politica corporativa de acesso e perfis.
- Planilhas/modelos oficiais de V&V, BCO, PSO e Heat Stress.
- Contatos tecnicos para OneVision/IFS/CMMS.
- Ambiente de homologacao.
- Lista de usuarios-chave para UAT.

## 29. Glossario

- HSSE: Health, Safety, Security and Environment.
- V&V/eV&V: Verification and Validation, processo de verificacao/validacao em campo.
- BCO: Behaviour and Condition Observation.
- PSO: Process Safety Observation.
- PTW: Permit to Work.
- CMMS: Computerized Maintenance Management System.
- RLS: Row Level Security.
- PWA: Progressive Web App.
- SBM: SBM Offshore.

## 30. Conclusao

O HSSE Connect ja possui uma base funcional ampla, com arquitetura moderna em React/Supabase, controle de acesso, operacao por organizacao, modulos de equipamentos, saude, V&V, observacoes, auditoria e relatorios. Para encerramento e transferencia segura, a prioridade deve ser estabilizar permissoes, validar RLS, homologar mobile/offline, concluir QA bilinguistico e documentar operacao/deploy.

Este documento deve ser tratado como baseline tecnico inicial. A empresa de TI deve complementa-lo com diagramas de arquitetura, ERD atualizado, matriz final de permissoes aprovada pela area de negocio e plano de sustentacao.
