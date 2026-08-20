# ADR 0002: Banco de Dados em Nuvem Gerenciada, Não Self-Hosted

**Status:** Superado por ADR 0003
**Data:** 2026-08-14

## Contexto

Ao revisar a stack, surgiu a dúvida se o Postgres deveria continuar em nuvem
gerenciada (Supabase, já em uso) ou migrar para self-hosted na infraestrutura
Coolify que a WizeCode já opera.

Ao aprofundar, ficou claro que essa infraestrutura Coolify atual é uma máquina
residencial: sem redundância, sem segurança além da rede doméstica, e sem
garantia de disponibilidade — se o hardware falhar, a recuperação depende
inteiramente de backup. Isso é adequado para ambiente de desenvolvimento e para
os usos internos atuais da empresa, mas não para armazenar o dado mais sensível
do sistema.

O ARCA processa prontuário psicológico — dado sensível por definição na LGPD
(Art. 5º, II), que exige medidas de segurança técnicas e administrativas
compatíveis (Art. 46). Hospedar esse dado numa máquina doméstica sem
redundância não atende esse padrão a partir do momento em que exista paciente
real no sistema.

## Decisão

Manter o banco de dados em nuvem gerenciada — Supabase, já em uso — em vez de
self-hosted na infraestrutura Coolify atual. Confirmar que o projeto está
provisionado na região São Paulo, para latência e para manter o processamento
do dado dentro do Brasil.

Este ADR cobre especificamente o **banco de dados**. Onde a aplicação em si
(backend e frontend) roda em produção não está decidido aqui — hoje ambos
também rodam no mesmo Coolify doméstico, e essa é uma decisão maior, separada,
que precisa ser revisitada antes de o ARCA atender uma clínica real (ver
Consequências).

## Consequências

**Positivas:**
- Backup e disponibilidade do dado mais sensível do sistema deixam de depender
  de uma máquina residencial
- Zero curva de aprendizado — a solução já está em uso e funcionando
- Região São Paulo mantém o dado no Brasil

**Negativas / trade-offs:**
- Dependência de um vendor externo para o componente mais crítico do sistema
- Custo escala com uso, diferente da infraestrutura própria já paga

**Em aberto (fora do escopo deste ADR):**
- O backend e o frontend do ARCA ainda rodam na infraestrutura Coolify
  doméstica. Isso precisa de uma decisão própria sobre onde a aplicação roda em
  produção — VPS, cloud gerenciada, ou outra opção — antes de qualquer clínica
  real depender do sistema no ar.

## Alternativas consideradas

- **Self-hosted no Coolify atual**: rejeitado — a infraestrutura real por trás
  do Coolify hoje (hardware residencial) não oferece garantia de segurança ou
  disponibilidade compatível com dado sensível de saúde sob LGPD.
