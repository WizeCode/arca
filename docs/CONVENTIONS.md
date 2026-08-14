# Convenções de Componentes e Versionamento

> Como estruturamos componentes, páginas e o fluxo de release neste projeto — e
> por quê. Adaptado do padrão usado no site institucional da WizeCode para o
> contexto do ARCA (SaaS de dado dinâmico, não site de conteúdo). Leia antes de
> criar um componente novo, uma página nova, ou abrir um PR.

Documentação relacionada: `CLAUDE.md` (referência técnica — comandos, módulos,
env vars), `docs/ARQUITETURA.md` (visão geral do sistema), `docs/adr/` (decisões
de arquitetura já tomadas).

---

## 1. O princípio central — com uma diferença importante do site

No site institucional, "conteúdo" é só texto de marketing, e ele é sempre
estático. No ARCA, existem **dois tipos de conteúdo**, e a regra muda pra cada
um:

| Tipo | Exemplo | Onde mora |
|---|---|---|
| **Copy estático de UI** | Título da página, texto de empty state, label de botão | `[modulo].data.ts`, igual ao site |
| **Dado dinâmico de aplicação** | Paciente, atendimento, prontuário, lista de espera | Vem via Server Action, nunca em `.data.ts` |

Confundir os dois é o erro mais fácil de cometer vindo do padrão do site — lá,
tudo que aparece na tela é conteúdo estático. Aqui, a maior parte da tela é dado
vivo do banco.

A mentalidade que continua igual: **um componente é uma função que você chama,
não um template que você edita.** Se você abrir um componente pra trocar um
texto fixo, ele virou template — o sintoma clássico do shadcn/ui quando alguém
edita o valor padrão em vez de passar por prop.

```tsx
// ❌ Copy fixo dentro do componente
const EmptyState = () => <p>Nenhum paciente na lista de espera</p>

// ✅ Copy vem de fora — de um .data.ts, não do componente
const EmptyState = ({ title }: EmptyStateProps) => <p>{title}</p>
```

---

## 2. A linha entre copy estático, dado dinâmico e componente

| Vai para `[modulo].data.ts` (copy estático) | Vem de Server Action (dado dinâmico) | Fica no componente (estrutura) |
|---|---|---|
| Título da página, subtítulos | Lista de pacientes, atendimentos | Arranjo/layout (`flex`, `grid`) |
| Texto de empty state | Status de um atendimento | Tipografia e espaçamento do esqueleto |
| Label de botão, placeholder de campo | Conteúdo de um prontuário | Animações e transições |
| Texto de confirmação/erro genérico | Resultado de uma busca/filtro | Comportamento (ex: qual aba está ativa) |

**Casos de borda:**

- **Mensagem de validação de formulário** (`"CPF inválido"`) é copy estático →
  `.data.ts` ou schema do Zod, nunca hardcoded no componente de campo.
- **Nome do paciente exibido no header do prontuário** é dado dinâmico → vem via
  prop, alimentada por Server Action, nunca por `.data.ts`.
- **A cor de um badge de status** (`Em Triagem` = amarelo) é regra de negócio,
  não copy nem dado do backend → fica no componente, como mapeamento
  `status → variant` do `cva()` (seção 5).

Regra de bolso: **se pode mudar sem redeploy, é dado dinâmico. Se só muda quando
alguém edita o código, é copy estático.**

---

## 3. Props obrigatórias, sem valor padrão

Componentes de layout, template e sheet **não** definem default de conteúdo. Só
prop de **variação de layout** pode ter default.

```tsx
// ❌ Default esconde erro de integração — a página esqueceu de passar o nome
interface PatientHeaderProps {
  nome?: string
}
const PatientHeader = ({ nome = "Paciente" }: PatientHeaderProps) => ...

// ✅ Obrigatória — se a Server Action falhar em popular isso, o TS reclama
interface PatientHeaderProps {
  nome: string
  variant?: "compact" | "full"   // ok: default de layout
}
const PatientHeader = ({ nome, variant = "full" }: PatientHeaderProps) => ...
```

---

## 4. Onde o copy estático mora: `[modulo].data.ts`

Todo copy estático de uma rota vive num módulo co-localizado — sem exceção de
tamanho, mesmo um título de uma linha.

```text
app/(auth)/plataforma/
  lista-espera/
    page.tsx                 ← compõe a página
    lista-espera.data.ts     ← copy estático desta rota (títulos, empty state)
    patient-row.tsx          ← componente específico deste módulo
```

```ts
// lista-espera.data.ts — só copy, nunca dado de paciente
export const listaEspera = {
  titulo: "Lista de Espera",
  emptyState: {
    titulo: "Nenhum paciente aguardando",
    descricao: "Cadastros públicos aparecem aqui automaticamente.",
  },
  botaoNovo: "Adicionar à lista",
}
```

```tsx
// page.tsx — busca dado dinâmico via Server Action, injeta copy do .data.ts
import { listaEspera } from "./lista-espera.data"
import { getListaEspera } from "./actions"

export default async function Page() {
  const pacientes = await getListaEspera()   // dado dinâmico, direto do backend

  return (
    <ListPage
      title={listaEspera.titulo}             // copy estático
      data={pacientes}                       // dado dinâmico
      emptyState={listaEspera.emptyState}
    />
  )
}
```

Ícone referenciado em copy estático segue registro central (`lib/icons.ts`),
igual ao site — nunca importe o componente de ícone direto no `.data.ts`, porque
Server → Client não passa função/JSX pela fronteira.

---

## 5. Variante ou componente novo? O teste do CVA

> **Se a variação cabe num `cva()`, é variante. Se muda a árvore HTML, é
> componente novo.**

```tsx
// StatusBadge — cabe no CVA: só muda cor/fundo por status
const statusVariants = cva("rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    status: {
      em_espera: "bg-muted text-muted-foreground",
      em_triagem: "bg-amber-100 text-amber-800",
      em_psicoterapia: "bg-blue-100 text-blue-800",
      alta: "bg-green-100 text-green-800",
    },
  },
})
```

Se a variante muda a árvore — por exemplo, um cartão de paciente que em um
contexto mostra ações (editar, arquivar) e em outro não — não force isso num
`cva()` com `if` escondido. São dois componentes: `PatientCard` e
`PatientCardCompact`, compartilhando o miolo se fizer sentido.

Use `cva()` + `VariantProps` (não digite a união à mão) e componha com `cn()`.
**Nunca `!important`.**

---

## 6. Estrutura de arquivos

```text
components/
  ui/            ← primitivos shadcn/ui (não editar por conteúdo)
  layout/        ← só chrome GLOBAL: sidebar, header, shell de proteção de rota
  forms/
    fields/              ← primitivos de campo compartilhados
    form-layout.tsx      ← espaçamento comum a todo formulário
    form-[nome].tsx      ← formulários concretos (cadastro-paciente, triagem...)
  sheets/
    sheet-[nome].tsx     ← modais de ação (SheetAgendarSessao etc.)
  templates/
    list-page.tsx        ← título + filtro + tabela + paginação
    detail-page.tsx       ← header do registro + abas
  shared/        ← só o que já foi usado em 2+ módulos — nunca cria aqui de saída

app/(auth)/plataforma/
  pacientes/
    page.tsx
    patient-header.tsx    ← específico deste módulo, colocado aqui
    pacientes.data.ts
  atendimentos/
    page.tsx
    atendimento-card.tsx
    atendimentos.data.ts
```

**A regra de cada gaveta:**

- `ui/` — primitivos shadcn, intocados por conteúdo.
- `layout/` — só o que serve **qualquer** página autenticada. Se um componente
  só faz sentido em um módulo, ele não é layout.
- `forms/` — campos e espaçamento centralizados; cada formulário concreto tem
  validação própria (Zod), mas nenhum redefine espaçamento na mão.
- `sheets/` — ação que abre sobre a página atual em vez de navegar pra uma rota
  nova. É o padrão preferido do ARCA para criar/editar (ex: `SheetAgendarSessao`
  no lugar de `/atendimento/cadastro`).
- `templates/` — os dois formatos de página que já se repetem no fluxo clínico
  (ver seção 7). Predefinidos agora porque o formato já existe, testado, no
  frontend antigo (commit `2c62150476c92fdabc61459f2bca6f691bc7965b`) — não é
  abstração adivinhada.
- `shared/` — promoção, não ponto de partida. Um componente nasce dentro do
  módulo (`app/**/[modulo]/`); só sobe pra cá quando um **segundo** módulo
  precisa dele de verdade.

---

## 7. Os dois templates

```tsx
// components/templates/list-page.tsx
/** Título + ação + filtro + tabela + paginação. Usa em qualquer módulo de listagem. */
interface ListPageProps<T> {
  title: string
  actions?: React.ReactNode        // ex: botão que abre um Sheet de criação
  filters?: React.ReactNode        // barra de filtro, específica de cada módulo
  columns: ColumnDef<T>[]
  data: T[]
  emptyState?: { titulo: string; descricao: string }
}
```

```tsx
// components/templates/detail-page.tsx
/** Header do registro + abas de conteúdo. Usa em qualquer módulo de detalhe. */
interface DetailPageProps {
  header: React.ReactNode          // resumo do registro (paciente, atendimento...)
  tabs: { label: string; content: React.ReactNode }[]
  actions?: React.ReactNode        // ex: "Gerar Alta" — abre Sheet ou Server Action
}
```

Uso mapeado:

| Template | Módulos |
|---|---|
| `ListPage` | Lista de Espera, Agenda, Atendimentos, Pacientes, Admin/Usuários |
| `DetailPage` | Paciente, Atendimento, Prontuário |

---

## 8. Idioma e comentários

- **Inglês:** nome de arquivo, componente, prop, variável, função, comentário.
- **Português:** rota e todo copy/conteúdo voltado ao usuário — igual ao que já
  está em `CLAUDE.md`.
- **Comentários curtos.** Não explique o óbvio; comente restrição e motivo.
  JSDoc no topo de templates, sheets e componentes de módulo complexos.

---

## 9. Ordem de classes Tailwind

Automática via `prettier-plugin-tailwindcss` (adicionar ao projeto se ainda não
estiver configurado, com `cn`/`cva` em `tailwindFunctions`). Ninguém ordena
classe na mão; `npm run format` resolve.

---

## 10. Fronteiras com fornecedores (analytics, flags)

Mesma regra do site, com stakes maiores aqui: **fornecedor de infraestrutura
nunca é importado direto numa página ou componente.** Sempre atrás de uma
interface que o app define, em `lib/`.

```text
lib/analytics/
  types.ts             ← contrato: Analytics.track(event, props)
  adapters/posthog.ts  ← traduz track() → posthog.capture()
  index.ts             ← escolhe o adaptador
```

No site isso é sobre não travar em um vendor. No ARCA é sobre **compliance**:
se o PostHog (avaliado em março para session replay) entrar em produção, essa
interface é o único lugar que decide o que é enviado pra fora — nenhum
componente que renderiza dado de prontuário deve saber que analytics existe.
ESLint barra `posthog-js` fora de `lib/analytics/adapters/` e do provider de
boot, igual ao site.

---

## 11. Fluxo de Git e versionamento

Duas diferenças em relação ao site: o ARCA **é** produto versionado (então usa
`release/*`, que o site deliberadamente não usa), e o versionamento é
automatizado via Conventional Commits — retomando a proposta já aberta na
[issue #74](https://github.com/pedrokourly/arca/issues/74).

| Merge | Como | Por quê |
|---|---|---|
| `feature/*` / `fix/*` → `development` | PR com **squash** | Cada feature vira um commit limpo |
| `development` → `release/x.y.z` | Branch nova, quando pronto pra congelar | Estabiliza enquanto `development` segue pra próxima versão |
| `release/*` → `main` | PR com **merge normal** (nunca squash) | Preserva ancestralidade — squash aqui gera conflito `add/add` no ciclo seguinte |
| `release/*` → `development` | PR com **merge normal** | Sincroniza a versão e o changelog gerados de volta pra `development` |
| `hotfix/*` → `main` **e** `development` | PR em cada uma | A correção precisa existir nas duas |

**Regras:**

- Nada de commit direto em `main` ou `development`. Sempre PR, sempre revisado.
- `feature/*`/`fix/*` nascem de `development`. `hotfix/*` nasce de `main`.
- Branch pequena e de vida curta.
- **Nunca** `reset --hard` / `push --force` em `development` ou `main`.

**Versionamento automático (na branch `release/*`):**

1. Commits seguem Conventional Commits (`feat:`, `fix:`, `BREAKING CHANGE:`),
   validados por `commitlint` + hook do `husky`
2. `commitizen` guia a escrita da mensagem (`npm run commit`)
3. Na `release/*`, rodar a ferramenta de release (`standard-version` ou
   `release-it`): analisa os commits desde a última tag, faz bump de versão
   (`patch`/`minor`/`major`), atualiza `CHANGELOG.md`, cria a tag
4. Versão é única pro monorepo inteiro (backend + frontend juntos), marcada no
   `package.json` raiz — não versiona os dois apps separadamente

| Tipo de commit | Impacto na versão |
|---|---|
| `fix` | patch |
| `feat` | minor |
| `BREAKING CHANGE` | major |
| `chore`, `docs`, `refactor`, `test` | nenhum |

---

## Checklist de code review

- [ ] Copy estático está em `[modulo].data.ts`; dado dinâmico vem de Server Action
- [ ] Props de conteúdo são obrigatórias; só prop de layout tem default
- [ ] Variante cabe num `cva()`. Se muda a árvore HTML, é componente novo
- [ ] Componente está na gaveta certa — e só está em `shared/` se um 2º módulo já usa
- [ ] `page.tsx` lê como composição, não tem lógica de negócio embutida
- [ ] Código/props/comentários em inglês; copy e rotas em português
- [ ] Fornecedor de analytics não é importado direto na UI
- [ ] Mensagem de commit segue Conventional Commits
- [ ] PR segue o fluxo da seção 11 (squash pra `development`, merge normal daí pra frente)