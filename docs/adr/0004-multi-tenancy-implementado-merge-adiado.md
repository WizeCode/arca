# ADR 0004: Multi-Tenancy Implementado e Validado, Merge Adiado

**Status:** Aceito
**Data:** 2026-08-18
**Relacionado a:** ADR 0001 (não supera — a decisão de arquitetura continua de pé, isto documenta o momento do deploy)

## Contexto

A ADR 0001 decidiu implementar isolamento multi-tenant agora, com o banco
ainda vazio, para evitar um retrofit caro e arriscado depois — com dado
real de paciente em produção. A issue #107 executou essa decisão por
completo: schema com `Clinica`/`id_Clinica`, `clinicaId` no JWT com
verificação cruzada contra o banco, Prisma Client Extension
(`tenant.extension.ts`) com enforcement automático e `$tenantTransaction`,
Row-Level Security ativo nas 5 tabelas escopadas, e uma função
`SECURITY DEFINER` (role `arca_auth`, escopada por policy, sem
`BYPASSRLS` geral) resolvendo o conflito entre RLS e a busca de
credenciais de login/JWT.

No processo, dois bugs reais foram encontrados e corrigidos com teste de
integração contra Postgres real: `$tenantTransaction` abrindo transação no
client errado (não carimbava `id_Clinica` dentro dela), e RLS bloqueando
o próprio login por falta de `set_config` na busca por e-mail. Ambos
documentados nos testes `login-lookup-rls.e2e-spec.ts` e
`jwt-lookup-rls.e2e-spec.ts`.

Apesar da implementação completa e validada, o ARCA continua com uma
única clínica real em uso. Não há segunda clínica onboardando ainda —
o pré-requisito que a própria ADR 0001 e a seção 8 do `ARQUITETURA.md`
já registravam para justificar o trabalho de produto multi-tenant
(seleção de clínica, personalização, etc.) também vale aqui: sem um
segundo consumidor real, carregar a complexidade operacional de RLS/CLS/
extension em produção, para servir exatamente um tenant, é custo sem
benefício imediato.

## Decisão

Manter a implementação completa na branch
`107-adicionar-modelo-clinica-e-clinicaid-no-schema-adr-001`, sem merge
para `development`, até existir uma segunda clínica real confirmada.
`development` permanece single-tenant enquanto isso.

Correções que também se aplicam ao estado atual (single-tenant) — como o
fix do CRP truncado no seed, encontrado no caminho — são aplicadas nos
dois lugares (cherry-pick), não só na branch de tenant.

## Consequências

**Positivas:**
- O trabalho caro (desenho, implementação, e principalmente debugar RLS/
  CLS/extension até funcionar ponta a ponta) já está pago como
  **referência** — a policy de RLS, o padrão da função `SECURITY
  DEFINER`, os dois bugs reais e como foram resolvidos continuam válidos
  como ponto de partida, mesmo que a aplicação literal do código exija
  revisão (ver nota abaixo)
- `development` continua simples enquanto só uma clínica usa o sistema,
  sem complexidade operacional carregada à toa

**Negativas:**
- A branch diverge de `development` com o tempo — outro trabalho feito
  numa não reflete automaticamente na outra, exigindo rebase/merge
  cuidadoso quando chegar a hora
- Fix que vale pros dois estados precisa ser replicado manualmente
  (cherry-pick), com risco de esquecimento se não for disciplinado

**Pendência conhecida, não resolvida — prioridade antes do merge final:**
`prisma/seed.ts` roda com um `PrismaClient` cru, sem `set_config`, e não
consegue popular um banco novo do zero com `FORCE ROW LEVEL SECURITY`
ativo usando a role normal da aplicação. Isso bloqueia qualquer
provisionamento futuro de ambiente novo a partir dessa branch — inclusive
se um dia for preciso recriar o banco atual do zero, não só no cenário de
segunda clínica. Não deixar isso esquecido junto com o resto.

## Nota para retomada futura

A expectativa é voltar a este trabalho depois que o ARCA passar por uma
clínica de testes real em produção single-tenant. Nesse meio tempo, é
provável que bastante coisa mude — tanto em `development` quanto no
entendimento real do negócio, validado com uso de verdade. Por isso, a
branch preservada não deve ser tratada como um patch pronto pra aplicar
direto quando a segunda clínica aparecer: **antes de retomar, é necessário
revisar a arquitetura inteira novamente, pra confirmar que ela ainda
reflete a realidade do sistema naquele momento** — schema, regras de
negócio e decisões podem ter se movido o bastante pra tornar parte da
implementação obsoleta, mesmo que o raciocínio de fundo (RLS + extension
como defesa em profundidade) continue válido.

## Referência

Branch: `107-adicionar-modelo-clinica-e-clinicaid-no-schema-adr-001`

Contém: schema completo (Seções 1-2), `clinicaId` no JWT (Seção 3),
Prisma Client Extension + CLS (Seção 4), RLS nas 5 tabelas (Seção 5),
transações refatoradas (Seção 6), todos os endpoints migrados (Seção 7),
os dois fixes de RLS pós-Seção 7, e a suíte e2e (`access-control`,
`login-lookup-rls`, `jwt-lookup-rls`).

## Alternativas consideradas

- **Merge imediato para `development`**: rejeitado — adicionaria
  complexidade operacional de produção (RLS, CLS, roles extras) sem
  benefício correspondente enquanto existe só uma clínica.
- **Descartar a branch**: rejeitado — jogaria fora trabalho de
  implementação e debug já validado, reintroduzindo o custo de retrofit
  que a ADR 0001 existia especificamente para evitar.