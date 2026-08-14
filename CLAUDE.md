# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ARCA** is a multi-tenant psychology clinic management SaaS (Brazilian Portuguese UI) built as a Turborepo monorepo with two apps:

- `apps/backend` — NestJS REST API on port 3333
- `apps/frontend` — Next.js 15 web app on port 3000, currently under active rebuild

Domain: patient waitlist, therapy sessions (atendimentos), medical records (prontuários), audit logging, and role-based access for estagiários (interns) and supervisors. This originated as an academic thesis project but is now developed as a commercial product (co-founded at WizeCode) — treat technical decisions as production-grade, not academic-scope.

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
npm run -w backend test:e2e       # E2E tests (uses test/jest-e2e.json)
npm run -w backend db:seed        # Seed database
```

To run a single test file:

```bash
cd apps/backend && npx jest src/path/to/file.spec.ts
```

### Database (from `apps/backend/`)

```bash
npx prisma migrate dev            # Apply migrations
npx prisma migrate deploy         # Deploy to production
npx prisma studio                 # Open Prisma Studio UI
npx prisma generate               # Regenerate Prisma client
```

## Architecture

### Backend (NestJS)

Standard NestJS modular architecture. Each domain is a self-contained module in `apps/backend/src/`:

| Module            | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `auth/`           | JWT + Local strategies, Passport guards, login endpoint   |
| `users/`          | User CRUD (estagiários/supervisors)                       |
| `waitlist/`       | Patient waiting list (lista de espera)                    |
| `session/`        | Therapy sessions (atendimentos)                           |
| `medical_record/` | Session records (prontuários) with encryption             |
| `audit/`          | Audit log — global interceptor captures all operations    |
| `crypto/`         | AES encryption service used by medical_record             |
| `pdf/`            | PDF generation from templates                             |
| `prisma/`         | PrismaService (extends PrismaClient with lifecycle hooks) |

**Key patterns:**

- All input validation via class-validator DTOs
- `AuditInterceptor` is registered globally — logs user, action, entity, IP, timestamp to `LogAuditoria` table
- Role-based access controlled via `roleId` on `Usuario` model
- Medical record `conteudo` field is encrypted at rest using `CryptoService`

**Domain entities (planned, not yet in codebase):** the intended direction is to move business logic out of services operating on raw Prisma types and into rich domain classes (e.g. `Atendimento`, `Prontuario`) with factory methods (`fromPrisma()`, `fromJSON()`). Prisma models stay data-only. As of the last audit, this pattern hasn't landed in `apps/backend/src` yet — check before assuming it's implemented. A shared `packages/domain` Turborepo package is the candidate home for this once it exists on both frontend and backend.

**Medical record types** (DTOs in `medical_record/dto/`):

- `triagem` — initial triage record
- `evolucao` — session evolution note
- `alta` — discharge report
- `encaminhamento` — referral

### Frontend (Next.js 15 App Router) — actively being rebuilt from scratch

The pre-rebuild frontend (last state at commit `2c62150476c92fdabc61459f2bca6f691bc7965b`) is kept **only as a business-logic reference** — its routes and components below are historical, not current.

**Locked-in architecture decisions for the rebuild:**

- Server Actions for all data fetching/mutations (no client-side data-fetching hooks hitting the backend directly)
- Route Handlers used exclusively for NextAuth (`app/api/auth/[...nextauth]/route.ts`)
- No `NEXT_PUBLIC_` env vars except what NextAuth itself requires
- Authenticated app lives under `/plataforma/*`
- Route groups: `(auth)` for authenticated routes, `(external)` for public routes

**Current structure (as of last audit):**

```text
app/
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   └── plataforma/
│       ├── layout.tsx     # Sidebar shell, role-based nav filtering
│       └── page.tsx       # Dashboard — currently a skeleton/placeholder
├── (external)/            # Public routes
├── api/
│   └── auth/[...nextauth]/route.ts
└── globals.css
```

Only the platform shell exists so far (sidebar, route-protection middleware, empty dashboard). No domain modules (pacientes, atendimentos, waitlist, etc.) have been migrated into the new structure yet — that work is tracked incrementally via GitHub milestones M0–M12, one `feat:` issue per module. Check open issues/milestones for what's next rather than assuming from this file.

Authentication uses **NextAuth v4** with a Credentials provider that calls the backend `/auth/login` endpoint. The JWT token from the backend is stored in the NextAuth session.

- `middleware.ts` — protects `/plataforma/*` routes, enforces role-based redirects
- `components/ui/` — shadcn/ui components (new-york style, neutral base, lucide icons)

**Auth flow:** Login form → NextAuth CredentialsProvider → backend `/auth/login` → JWT stored in session → Server Actions read the session server-side to authenticate backend calls.

**Historical route structure (pre-rebuild, reference only — do not build against this):**

```text
app/
├── login/
├── lista-espera/
│   ├── cadastro/
│   └── consulta/
└── dashboard/                       # superseded by /plataforma
    ├── agenda/
    ├── atendimento/cadastro/
    ├── auditoria/
    ├── fluxo-atendimento/
    ├── lista-espera/cadastro/
    ├── pacientes/[id]/
    ├── perfil/
    ├── relatorios/
    │   ├── psicoterapia/[id]/
    │   └── triagem/[id]/
    ├── unauthorized/
    └── usuarios/cadastro/
```

**Auth components** (`components/auth/`, pre-rebuild reference):

- `ConditionalRender.tsx` — renders children only if user has required role
- `ProtectedRoute.tsx` — client-side route guard
- `withRoleProtection.tsx` — HOC for role-based page protection

### Database Schema (Prisma / PostgreSQL)

Core entities:

- `Usuario` — clinic users with `roleId`, `CRP` (psychologist registration number), `isActive`
- `ListaEspera` — patients on the waiting list with demographic data
- `Atendimento` — therapy session linking an intern + supervisor + patient
- `Prontuario` — session notes/medical record attached to an `Atendimento` (content encrypted)
- `LogAuditoria` — immutable audit trail with action type, affected entity, IP, JSON details

Several lookup/enum tables: `Role`, `Genero`, `Etnia`, `Escolaridade`, `StatusListaEspera`, `StatusAtendimento`, `TipoAtendimento`, `StatusProntuario`, `TipoProntuario`.

## Domain Knowledge

### Clinical Workflow (Fluxo de Atendimento)

Understanding this flow is essential — the entire system models it:

1. **Em Espera** — Patient self-registers on the public waitlist. Receives a random UUID to check their position. CPF prevents duplicate registrations.
2. **Em Triagem** — Secretary schedules a triage session (`TipoAtendimento = triagem`). Intern fills the triage report (`Prontuario` type `triagem`). Supervisor reviews and decides:
   - **Encaminhamento interno** → patient moves to psychotherapy queue
   - **Encaminhamento externo** → referral document (PDF) generated, patient exits system
3. **Triagem Aprovada / Aguardando Psicoterapia** — Patient approved for psychotherapy, waiting for session scheduling.
4. **Em Psicoterapia** — Secretary schedules recurring psychotherapy sessions. After each session, intern fills an evolution report (`evolucao`). Supervisor approves each report.
5. **Alta / Encaminhado** — Supervisor generates discharge (`alta`) or referral (`encaminhamento`) document (PDF), patient exits the system.

### User Roles and Access Control

Four roles with decreasing privileges (stored as `roleId` on `Usuario`):

| Role         | PT Name     | Key Permissions                                                                    |
| ------------ | ----------- | ---------------------------------------------------------------------------------- |
| `ADMIN`      | Coordenador | Full access including audit logs, fluxo-atendimento dashboard, user management     |
| `SECRETARIO` | Secretário  | Schedule sessions, manage waitlist, view fluxo-atendimento, manage patients        |
| `SUPERVISOR` | Supervisor  | Approve/reject intern reports, generate alta/encaminhamento, see own patients only |
| `ESTAGIARIO` | Estagiário  | Fill session reports, see own patients only                                        |

Critical access rules:

- **Audit logs**: Coordinator only
- **Fluxo de atendimento**: Coordinator + Secretary only
- **Patient visibility**: Coordinator/Secretary see all patients; Supervisor/Estagiário see only their assigned patients
- **User creation**: A user can only create users with a role equal to or lower than their own
- **Waitlist**: All internal roles can read/edit; public can self-register and check position
- **Multi-tenancy**: no authenticated user should be able to reach another tenant's resources by substituting an ID — this is the highest-priority security gap to keep re-verifying (BOLA) as new endpoints are built

### Regulatory Context

- The system follows **CFP Resolution n.º 06/2019** for psychological document formats
- **LGPD** (Brazilian data protection law) compliance is enforced via the `LogAuditoria` table
- Supervisors must have a **CRP** (Conselho Regional de Psicologia registration number) stored on their user record
- The `pdf/` module generates official documents (PEP, alta, encaminhamento) that follow CFP standards

## Environment Variables

**Backend** (`apps/backend/.env`):

```text
DATABASE_URL=           # Supabase connection pooling URL
DIRECT_URL=             # Direct URL for Prisma migrations
JWT_SECRET=
JWT_TTL=5h
JWT_TOKEN_AUDIENCE=arca_api
JWT_TOKEN_ISSUER=arca_server
ENCRYPTION_KEY=         # AES key for medical record encryption
```

**Frontend** (`apps/frontend/.env`):

```text
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
API_URL=http://localhost:3333   # or http://arca_backend:3333 in Docker
```

## Prisma Notes

The repo has a `prisma.config.ts` at `apps/backend/prisma.config.ts` (Prisma 6 config format). Migrations live in `apps/backend/prisma/migrations/`. Always run Prisma CLI commands from `apps/backend/`.
