# HSSE Connect

Portal web/PWA para gestao de HSSE, com modulos de equipamentos, inspecoes, certificados, manutencao, saude, V&V, cartoes de observacao, auditoria, relatorios e administracao de usuarios.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI / shadcn-style components
- TanStack React Query
- Supabase Auth, Postgres, Storage, RPCs e Edge Functions
- Vercel para deploy

## Requisitos

- Node.js
- npm

## Desenvolvimento local

```bash
npm install --legacy-peer-deps
npm run dev
```

O servidor local usa a porta `8080`.

## Validacao

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

## Supabase

O frontend esta apontado para o projeto Supabase atual:

```text
ovugummbxablwmbpbbhj
```

As Edge Functions ficam em `supabase/functions`.

## Documentacao

A especificacao tecnica de handover esta em:

```text
docs/especificacao-tecnica-hsse-connect.md
```
