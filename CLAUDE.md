# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Refactoring Context

The frontend is a **complete rewrite** of a previous version. The old code is preserved at commit
`2c62150476c92fdabc61459f2bca6f691bc7965b` on the `development` branch and serves as a
**functional reference** — not code to reuse.

When implementing any frontend feature, check whether it existed in the old project first:

```bash
git show 2c62150476c92fdabc61459f2bca6f691bc7965b:apps/frontend/app/dashboard/
```

### Why the rewrite

The old frontend was built with heavy AI assistance during a TCC (undergraduate thesis) and
accumulated significant technical debt:
- No Server Actions — all API calls via a client-side Axios instance
- No route groups — flat `/dashboard/*` structure with no layout separation
- Role-based access via HOCs and Context — replaced by `use-role.ts` hook + Server Actions
- Inconsistent TypeScript — loose typing throughout

### What existed in the old project

All major modules had working implementations. The business logic is correct and tested.
When rebuilding a module, the old code answers **"what does this feature do?"** — the new code
answers **"how should it be built?"**.

| Old route | Module | Status in rewrite |
|---|---|---|
| `/lista-espera/cadastro` | M2 · Área Pública | In progress (#89) |
| `/dashboard/lista-espera` | M4 · Lista de Espera | In progress (#89) |
| `/dashboard/agenda` | M5 · Agenda | Pending |
| `/dashboard/atendimento` + `/cadastro` | M6 · Atendimentos | Issues #101, #102, #103 |
| `/dashboard/relatorios` + sub-routes | M7 · Prontuários | Pending |
| `/dashboard/pacientes` + `/[id]` | M8 · Pacientes | Pending |
| `/dashboard/fluxo-atendimento` | M9 · Fluxo de Atendimento | Pending |
| `/dashboard/usuarios` | M10 · Usuários | Pending |
| `/dashboard/auditoria` | M11 · Auditoria | Pending |
| `/dashboard/perfil` | M12 · Perfil | Pending |

### Architecture changes (old → new)

| Concern | Old | New |
|---|---|---|
| Data fetching | Axios client with Bearer interceptor | Server Actions via `auth()` |
| Route protection | `middleware.ts` on `/dashboard/*` | `proxy.ts` on `/plataforma/*` |
| Layout separation | Flat routes | Route groups: `(auth)`, `(external)`, `(internal)` |
| Role access control | HOCs, `ConditionalRender`, `ProtectedRoute` | `use-role.ts` hook |
| Session creation | Dedicated route `/atendimento/cadastro` | `SheetAgendarSessao` component |
| Auth config | Inline in route handler | Extracted to `lib/auth.ts` |
| Internal route base | `/dashboard` | `/plataforma` |

---

## Project Overview

**ARCA** is a psychology clinic management SaaS built as a Turborepo monorepo with two apps:

- `apps/backend` — NestJS REST API on port 3333 — **complete, do not modify**
- `apps/frontend` — Next.js 15 web app on port 3000 — **active development**

Domain: patient waitlist, therapy sessions (atendimentos), medical records (prontuários), audit
logging, and role-based access for estagiários (interns) and supervisors.

---

## Commands

### Root (runs both apps via Turborepo)

```bash
npm run dev          # Start backend (port 3333) + frontend (port 3000) concurrently
npm run build        # Build all apps
npm run lint         # Lint all apps
npm run format       # Prettier format all TS/TSX/MD files
npm run check-types  # TypeScript type checking across all apps
```

### Backend only

```bash
npm run -w backend start:dev      # Watch mode dev server
npm run -w backend test           # Run unit tests
npm run -w backend test:watch     # Watch mode tests
npm run -w backend test:cov       # Coverage report
npm run -w backend test:e2e       # E2E tests
npm run -w backend db:seed        # Seed database
```

### Database (from `apps/backend/`)

```bash
npx prisma migrate dev            # Apply migrations
npx prisma migrate deploy         # Deploy to production
npx prisma studio                 # Open Prisma Studio UI
npx prisma generate               # Regenerate Prisma client
```

---

## Architecture

### Backend (NestJS)

The backend is **finalized**. Do not modify backend code unless explicitly asked.

Each domain is a self-contained module in `apps/backend/src/`:

| Module | Purpose |
|---|---|
| `auth/` | JWT + Local strategies, Passport guards, login endpoint |
| `users/` | User CRUD (estagiários/supervisors) |
| `waitlist/` | Patient waiting list (lista de espera) |
| `session/` | Therapy sessions (atendimentos) |
| `medical_record/` | Session records (prontuários) with encryption |
| `audit/` | Audit log — global interceptor captures all operations |
| `crypto/` | AES encryption service used by medical_record |
| `pdf/` | PDF generation from templates |
| `prisma/` | PrismaService (extends PrismaClient with lifecycle hooks) |

**Key patterns:**
- All input validation via class-validator DTOs
- `AuditInterceptor` registered globally — logs user, action, entity, IP, timestamp to `LogAuditoria`
- Role-based access controlled via `roleId` on `Usuario` model
- Medical record `conteudo` field encrypted at rest via `CryptoService`

**Medical record types** (DTOs in `medical_record/dto/`):
- `triagem` — initial triage record
- `evolucao` — session evolution note
- `alta` — discharge report
- `encaminhamento` — referral

---

### Frontend (Next.js 15 App Router)

Authentication uses **NextAuth v4** with a Credentials provider that calls the backend
`/auth/login` endpoint. The JWT token is stored in the NextAuth session and accessed
server-side via `auth()` — never exposed to the client.

**Key files:**
- `proxy.ts` — Next.js middleware, protects `/plataforma/*` (unauthenticated → `/login`)
- `lib/auth.ts` — NextAuth configuration (CredentialsProvider, JWT/session callbacks)
- `lib/types.ts` — shared domain types
- `lib/roles.ts` — role constants (`Role.ADMIN`, `Role.SECRETARIO`, etc.)
- `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler (required for OAuth callbacks)
- `components/ui/` — shadcn/ui components (new-york style, neutral base, lucide icons)

**Auth flow:**
Login form → NextAuth CredentialsProvider → backend `POST /auth/login` → JWT stored in
server-side session → Server Actions read token via `auth()` and pass it as `Authorization: Bearer`
to the backend.

**Data fetching pattern — Server Actions only:**
All backend calls use Server Actions (`'use server'`). There is no client-side API instance.
Route Handlers are used **exclusively** for NextAuth.

```ts
'use server'
import { auth } from '@/lib/auth'

export async function getWaitlist() {
  const session = await auth()
  const res = await fetch(`${process.env.API_URL}/waitlist`, {
    headers: { Authorization: `Bearer ${session?.token}` }
  })
  return res.json()
}
```

**Route structure:**

```
app/
├── (auth)/                         # Layout: centered card, no sidebar
│   └── login/                      # /login
├── (external)/                     # Layout: public header + footer
│   ├── page.tsx                    # / (home)
│   ├── inscrever-se/               # /inscrever-se
│   └── consultar/                  # /consultar
├── (internal)/                     # Layout: sidebar (ApplicationShell), protected
│   └── plataforma/
│       ├── page.tsx                # /plataforma (dashboard)
│       ├── lista-espera/           # /plataforma/lista-espera
│       │   └── [id]/               # /plataforma/lista-espera/[id]
│       ├── atendimentos/           # /plataforma/atendimentos
│       │   └── [id]/               # /plataforma/atendimentos/[id]
│       ├── agenda/                 # /plataforma/agenda
│       ├── pacientes/              # /plataforma/pacientes
│       │   └── [id]/               # /plataforma/pacientes/[id]
│       ├── fluxo-atendimento/      # /plataforma/fluxo-atendimento
│       ├── usuarios/               # /plataforma/usuarios
│       ├── auditoria/              # /plataforma/auditoria
│       └── perfil/                 # /plataforma/perfil
└── api/
    └── auth/[...nextauth]/         # NextAuth route handler only
```

**Role-based access:**
- `hooks/use-role.ts` — client hook that reads `session.user.roleId`
- Conditional rendering uses the hook directly — no HOC or wrapper components
- Server-side access control enforced within Server Actions and by the backend

**Component naming conventions:**
- Form components: `components/forms/form-[name].tsx`, PascalCase export (e.g. `FormLogin`)
- Sheet components: `components/sheets/sheet-[name].tsx`
- Layout components: `components/layout/[name].tsx`
- Page-scoped components: colocated in the route folder (e.g. `waitlist-table.tsx` alongside `page.tsx`)

---

## Domain Knowledge

### Clinical Workflow (Fluxo de Atendimento)

Understanding this flow is essential — the entire system models it:

1. **Em Espera** — Patient self-registers on the public waitlist. Receives a random UUID to check
   their position. CPF prevents duplicate registrations.
2. **Em Triagem** — Secretary schedules a triage session (`TipoAtendimento = triagem`). Intern
   fills the triage report (`Prontuario` type `triagem`). Supervisor reviews and decides:
   - **Encaminhamento interno** → patient moves to psychotherapy queue
   - **Encaminhamento externo** → referral document (PDF) generated, patient exits system
3. **Triagem Aprovada / Aguardando Psicoterapia** — Patient approved for psychotherapy, waiting
   for session scheduling.
4. **Em Psicoterapia** — Secretary schedules recurring psychotherapy sessions. After each session,
   intern fills an evolution report (`evolucao`). Supervisor approves each report.
5. **Alta / Encaminhado** — Supervisor generates discharge (`alta`) or referral (`encaminhamento`)
   document (PDF), patient exits the system.

### User Roles and Access Control

Four roles with decreasing privileges (stored as `roleId` on `Usuario`):

| Role | PT Name | Key Permissions |
|---|---|---|
| `ADMIN` | Coordenador | Full access including audit logs, fluxo-atendimento, user management |
| `SECRETARIO` | Secretário | Schedule sessions, manage waitlist, view fluxo-atendimento, manage patients |
| `SUPERVISOR` | Supervisor | Approve/reject intern reports, generate alta/encaminhamento, own patients only |
| `ESTAGIARIO` | Estagiário | Fill session reports, own patients only |

Critical access rules:
- **Audit logs** (`/plataforma/auditoria`): Coordinator only
- **Fluxo de atendimento** (`/plataforma/fluxo-atendimento`): Coordinator + Secretary only
- **Patient visibility**: Coordinator/Secretary see all; Supervisor/Estagiário see only assigned
- **User creation**: A user can only create roles equal to or lower than their own
- **Waitlist**: All internal roles can read/edit; public can self-register and check position

### Regulatory Context

- The system follows **CFP Resolution n.º 06/2019** for psychological document formats
- **LGPD** (Brazilian data protection law) compliance enforced via the `LogAuditoria` table
- Supervisors must have a **CRP** (Conselho Regional de Psicologia number) on their user record
- The `pdf/` module generates official documents (PEP, alta, encaminhamento) per CFP standards

---

## Environment Variables

**Backend** (`apps/backend/.env`):

```
DATABASE_URL=           # Supabase connection pooling URL
DIRECT_URL=             # Direct URL for Prisma migrations
JWT_SECRET=
JWT_TTL=5h
JWT_TOKEN_AUDIENCE=arca_api
JWT_TOKEN_ISSUER=arca_server
ENCRYPTION_KEY=         # AES key for medical record encryption
```

**Frontend** (`apps/frontend/.env`):

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
API_URL=http://localhost:3333   # or http://arca_backend:3333 in Docker
```

`API_URL` is server-only — never use `NEXT_PUBLIC_API_URL`.

---

## Prisma Notes

The repo has a `prisma.config.ts` at `apps/backend/prisma.config.ts` (Prisma 6 config format).
Migrations live in `apps/backend/prisma/migrations/`.
Always run Prisma CLI commands from `apps/backend/`.