# ADR 0001: Estratégia de Multi-tenancy — Isolamento no Schema Agora, Features Depois

**Status:** Aceito
**Data:** 2026-08-14

## Contexto

O ARCA é projetado para atender múltiplas clínicas de psicologia (multi-tenant). Durante o rebuild do frontend, surgiu a questão: vale a pena construir multi-tenancy completo agora, sem nenhum cliente pagante ainda, ou isso é complexidade prematura?

Duas coisas distintas estavam sendo tratadas como uma só:

1. **Isolamento de dados no schema** — cada registro pertencer a uma clínica, e toda query respeitar essa fronteira.
2. **Features de produto multi-tenant** — onboarding self-serve de clínica, painel de gestão de tenant, billing por tenant, configuração por clínica.

A primeira é barata para implementar agora (banco ainda vazio, sem dado de paciente real). A segunda é trabalho real, e melhor guiado por necessidades de clientes reais do que por suposição.

Retrofitar (1) depois que já existe dado de paciente em produção é significativamente mais arriscado: exige migração de schema com sistema no ar, revisão de toda query existente para garantir que nenhuma ficou sem o filtro de tenant, e qualquer query esquecida vira uma falha de BOLA — nesse caso, uma clínica potencialmente acessando prontuário de paciente de outra clínica, o que é também um incidente de LGPD.

## Decisão

Implementar isolamento de dados no schema agora:

- Novo modelo `Clinica`.
- Campo `id_Clinica` em `Usuario`, `ListaEspera`, `Atendimento`, `Prontuario` e `LogAuditoria`.
- Tabelas de apoio (`Role`, `Genero`, `Etnia`, `Escolaridade`, `StatusX`/`TipoX`) permanecem globais, não escopadas por clínica.
- Enforcement estrutural via Prisma Client Extension que injeta o filtro de `id_Clinica` automaticamente a partir do contexto da requisição, evitando depender de lembrar de filtrar manualmente em cada service.
- `clinicaId` como claim no JWT, definido no login.

Features de produto multi-tenant (onboarding, painel de gestão, billing, configuração por clínica) ficam explicitamente fora de escopo até haver 2+ clientes reais.

## Consequências

**Positivas:**
- Nenhuma migração de retrofit dolorosa quando o primeiro cliente real chegar.
- O gap de segurança nº 1 do projeto (BOLA multi-tenant) é endereçado pela raiz, não por vigilância manual em cada endpoint.
- Trabalho adicional imediato é pequeno (uma tabela nova, uma coluna em cinco modelos, uma extension).

**Negativas / trade-offs:**
- Todo endpoint que já existe precisa ser revisado para passar a respeitar o escopo de clínica — trabalho pontual, mas não zero.
- Sem uma segunda clínica real ainda, há risco de over-engineering se a modelagem de `Clinica` for além do necessário — por isso o escopo aqui é deliberadamente mínimo (id, nome, slug, isActive).

## Alternativas consideradas

- **Multi-tenancy completo agora** (painel de gestão, onboarding self-serve incluídos): rejeitado por complexidade prematura sem clientes reais para validar os requisitos.
- **Adiar tudo, single-tenant por enquanto**: rejeitado pelo risco de retrofit em produção com dado sensível de paciente já existente.