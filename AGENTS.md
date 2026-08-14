# AGENTS.md

Regras de trabalho neste repositório. Valem para qualquer agente de IA.
Este é o resumo imperativo. Para o **porquê** de cada regra, com exemplos:

- `CLAUDE.md` — referência técnica: comandos, módulos, estrutura, env vars
- `docs/CONVENTIONS.md` — padrões de componente e fluxo de versionamento
- `docs/adr/` — decisões de arquitetura já tomadas, uma por arquivo
- `docs/ARQUITETURA.md` — visão geral do sistema, status por módulo

## Stack

Backend: NestJS · Prisma · PostgreSQL.
Frontend: Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui.
Sem testes automatizados no frontend ainda: valide com `npm run typecheck`,
`npm run lint`, `npm run build` e o navegador. Backend tem testes — rode
`npm run -w backend test` antes de propor qualquer PR que toque nele.

## Componentes (frontend)

- Copy estático de UI (título, empty state, texto de botão) nunca vive dentro
  do componente — vai em `app/**/<rota>.data.ts`. Sem exceção de tamanho.
- Dado dinâmico de aplicação (paciente, atendimento, prontuário) vem por
  Server Action, nunca por `.data.ts`.
- Props de conteúdo são obrigatórias, sem default. Só prop de layout
  (`variant`) pode ter default.
- Se a variação cabe num `cva()`, é variante. Se muda a árvore HTML, é
  componente novo.
- Componente nasce colocado dentro do módulo que o usa
  (`app/(auth)/plataforma/<modulo>/`). Só sobe pra `components/shared/` quando
  um **segundo** módulo precisa dele de verdade.
- Página de listagem usa `components/templates/list-page.tsx`. Página de
  registro usa `components/templates/detail-page.tsx`.
- Toda leitura/escrita de dado no frontend passa por Server Action. Route
  Handlers existem só para o NextAuth. Nenhuma env var `NEXT_PUBLIC_` além do
  que o NextAuth exige.

## Onde cada componente mora

| Pasta | O que entra |
| --- | --- |
| `components/ui/` | primitivos shadcn/ui |
| `components/layout/` | só chrome global (sidebar, header) |
| `components/forms/` | `fields/` + `form-layout` + formulários concretos |
| `components/sheets/` | modais de ação (`sheet-[nome].tsx`) |
| `components/templates/` | `list-page.tsx`, `detail-page.tsx` |
| `components/shared/` | promovido só após uso em 2+ módulos |
| `app/**/<modulo>/*.tsx` (fora `page.tsx`) | componente específico daquele módulo |

## Fornecedores (analytics, flags)

Nunca importar SDK de fornecedor direto em página ou componente — sempre atrás
de uma interface própria em `lib/`. Relevante em especial pra qualquer dado
tocando prontuário/paciente (LGPD).

## Idioma

Inglês: código, nomes de arquivo, componentes, comentários.
Português: rotas e todo copy/conteúdo voltado ao usuário.

## Backend (NestJS)

Lógica de negócio migra para classes de domínio (`Atendimento`, `Prontuario`
com `fromPrisma()`/`fromJSON()`) — ver `docs/adr/` e `CLAUDE.md` para o estado
atual disso. Todo endpoint novo em modelo com `id_Clinica` deve respeitar o
escopo de tenant — não confiar em lembrar disso, usar o mecanismo de
enforcement quando existir.

## Git e versionamento

- `feature/*` / `fix/*` nascem de `development` → PR com **squash**.
- `development` → `release/x.y.z` quando pronto pra congelar uma versão.
- `release/*` → `main` **e** → `development`: merge normal, **nunca** squash.
- `hotfix/*` nasce de `main`, volta pra `main` **e** `development`.
- Commits seguem Conventional Commits (`feat:`, `fix:`, `BREAKING CHANGE:`) —
  ver issue #74 e `docs/CONVENTIONS.md` seção 11 para o fluxo completo.
- Versão se marca com tag, gerada na branch `release/*`.
- **Nunca** `git reset --hard` ou `push --force` em `development` ou `main`.
- **Não commite sem o Pedro pedir explicitamente.**
