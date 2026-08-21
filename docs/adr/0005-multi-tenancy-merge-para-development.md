# ADR 0005: Multi-Tenancy — Merge para `development` Antes da 2ª Clínica Real

**Status:** Aceito
**Data:** 2026-08-20
**Relacionado a:** ADR 0001 (não supera — a decisão de arquitetura continua de pé), ADR 0004 (supera a parte da decisão de adiar o merge)

## Contexto

A ADR 0004 decidiu manter a implementação completa de multi-tenancy (schema,
extension, RLS) preservada na branch `107-...-adr-001`, sem merge para
`development`, até existir uma segunda clínica real confirmada — o
argumento era não carregar complexidade operacional de RLS/CLS em produção
pra servir exatamente um tenant, sem benefício imediato.

A própria ADR 0004 já previa que, ao retomar esse trabalho, seria
necessário revisar a arquitetura de novo antes de aplicar, porque parte da
implementação poderia estar obsoleta. Essa revisão aconteceu antes do
prazo esperado (não por causa de uma segunda clínica real, mas por decisão
deliberada de assumir o risco agora) e encontrou dois problemas reais:

1. **Cadastro público na lista de espera** (`WaitlistService.resolveClinicaAtivaContext`)
   resolvia a clínica do tenant fazendo `findFirstOrThrow({ isActive: true })`
   — com uma segunda clínica ativa, a resolução de tenant pra um paciente se
   autocadastrando virava não-determinística, um bug silencioso de
   isolamento de dados. Corrigido: a clínica agora é resolvida por slug
   explícito na rota (`/waitlist/:clinicaSlug/...`), não mais inferida.

2. **Clínica desativada não bloqueava login nem revalidação de JWT** —
   `buscar_usuario_login` e `buscar_usuario_por_id` (funções `SECURITY
   DEFINER` que existem justamente para descobrir a clínica do usuário
   antes de haver `app.current_clinica_id` na conexão) checavam apenas
   `Usuario.isActive`, nunca `Clinica.isActive`. Corrigido via `JOIN` com
   `CLINICAS` nas duas funções (migration
   `20260820120000_clinica_isactive_gate_auth_lookups`), incluindo o
   `GRANT SELECT` em `CLINICAS` pra role `arca_auth` que faltava (sem ele,
   login e JWT quebravam globalmente com "permission denied for table
   CLINICAS" — encontrado rodando a suíte e2e completa após a mudança).

Com os dois corrigidos e a suíte e2e completa (incluindo
`access-control`, `login-lookup-rls`, `jwt-lookup-rls`) passando contra
Postgres real, o mecanismo de isolamento por tenant (RLS + extension +
JWT com cross-check) está genuinamente pronto pra mais de uma clínica —
não só pra uma, como estava quando a ADR 0004 foi escrita.

## Decisão

Mergear a branch `107-adicionar-modelo-clinica-e-clinicaid-no-schema-adr-001`
para `development` agora, antes de uma segunda clínica real confirmada —
revertendo a decisão de adiamento da ADR 0004. A clínica única em produção
continua operando normalmente sob RLS (uma linha em `CLINICAS`, todo
mundo nela), e a complexidade operacional de RLS/CLS passa a ser
carregada a partir de agora, não só quando a segunda clínica aparecer.

## Consequências

**Positivas:**

- O gap de isolamento no cadastro público (item 1) deixa de ser uma bomba
  relógio — não dependia de uma segunda clínica pra virar um problema real
  de dados, só ainda não tinha sido acionado.
- Nenhum retrofit de última hora quando a segunda clínica realmente
  aparecer — o caminho já foi testado ponta a ponta.

**Negativas / trade-offs:**

- Complexidade operacional (RLS, CLS, roles extras) passa a existir em
  produção sem uma segunda clínica pra justificar o custo imediato — risco
  que a ADR 0004 apontou e que aqui é conscientemente aceito.
- `development` deixa de ser single-tenant; qualquer trabalho futuro em
  cima dela precisa estar ciente do contexto de tenant (CLS/JWT) mesmo
  operando com uma clínica só.

**Pendências conhecidas, não resolvidas por esta ADR:**

- `prisma/seed.ts` ainda não popula um banco novo do zero com `FORCE ROW
  LEVEL SECURITY` ativo usando a role normal da aplicação (mesmo apontamento
  da ADR 0004, mitigado só no ambiente de teste via `global-setup.ts`
  rodando o seed como role superuser). Isso bloqueia provisionamento de um
  ambiente novo — inclusive uma eventual recriação do banco de produção.
  Prioridade antes de depender disso operacionalmente.
- Não existe endpoint pra criar uma clínica nova nem para provisionar o
  primeiro admin dela — inserir a segunda clínica continua exigindo acesso
  direto ao banco (`DIRECT_URL`/role superuser, ou `SET
  app.current_clinica_id` manual antes do insert, já que `USUARIOS` tem
  `FORCE ROW LEVEL SECURITY`). Onboarding self-serve de clínica continua
  fora de escopo (ADR 0001), mas o caminho manual precisa estar documentado
  antes de ser usado de verdade.

## Alternativas consideradas

- **Manter adiado até a 2ª clínica real (reafirmar ADR 0004)**: rejeitado
  — decisão de produto de assumir o risco agora, não uma reavaliação
  técnica; os dois bugs de isolamento encontrados nesta revisão reforçam
  que valia a pena revisar cedo, mas não eram, por si só, motivo pra
  adiar mais — foram corrigidos.
- **Merge parcial (só as correções não-tenant, manter RLS/extension fora)**:
  rejeitado — deixaria o cadastro público e o RLS de tenant fora de sync,
  sem reduzir de fato a complexidade adiada, só adiando de novo.
