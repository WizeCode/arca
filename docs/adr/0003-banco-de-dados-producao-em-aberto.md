# ADR 0003: Banco de Dados — Self-Hosted em Teste, Produção Decidida por Custo

**Status:** Aceito
**Data:** 2026-08-17
**Supera:** ADR 0002 (banco de dados em nuvem gerenciada)

## Contexto

A ADR 0002 decidiu manter o banco em Supabase, partindo do princípio de que a
infraestrutura Coolify em uso era a mesma que hospedava produção — um PC
residencial, sem redundância, inadequado pra dado sensível de saúde sob LGPD.

Essa premissa era imprecisa. O ambiente self-hosted atual (`arca`, no mesmo
servidor Postgres que `chatwoot`, `n8n`, `automacoes`) é especificamente um
ambiente de **teste**, sem dado real de paciente. A preocupação original da
ADR 0002 — infraestrutura inadequada pra dado sensível — não se aplica a um
ambiente sem dado sensível nele. A migração pro Supabase nunca chegou a ser
executada, só decidida no papel.

Além disso, o ARCA não usa nenhum recurso específico do Supabase (Auth,
Storage, Realtime, APIs geradas) — autenticação é JWT própria. Ele funciona,
na prática, só como Postgres gerenciado. Isso abre a pergunta: pra produção,
faz sentido pagar pela superfície de produto do Supabase, ou um Postgres puro
resolve, mais barato?

## Decisão

**Ambiente de teste:** self-hosted no Coolify atual é aceitável, sem
ressalva. Não guarda dado sensível real, então o risco que motivou a ADR 0002
não existe aqui.

**Banco de produção:** decisão adiada — critério definido é **Postgres puro,
pela opção mais barata pra um workload sempre ativo** (não intermitente).
Pesquisa de mercado feita hoje aponta a ordem provável de custo pra esse
perfil, sem fechar a escolha:

1. **Self-hosted numa VPS de nuvem real** (Hetzner, DigitalOcean) — menor
   custo bruto. Diferente do PC doméstico: infraestrutura de datacenter, com
   redundância de energia/rede. Exige Pedro assumir backup, patch e
   segurança manualmente.
2. **DigitalOcean Managed PostgreSQL** — totalmente gerenciado (backup
   automático incluso), ainda na faixa mais barata do mercado. Provável
   melhor equilíbrio custo/operação.
3. **Neon** — melhor simplicidade de conexão (string Postgres pura, sem
   plataforma), mas cobra por hora de computação ativa — vantajoso pra
   workload intermitente (ambiente de teste/staging), desvantajoso pra banco
   de produção sempre ligado.
4. **Supabase** — sem vantagem de custo identificada sobre as opções acima,
   e carrega superfície de produto (Auth, Storage, Realtime) que o ARCA não
   usa.

## Consequências

**Positivas:**
- Ambiente de teste segue exatamente como está, sem trabalho de migração
  desnecessário
- Decisão de produção fica ancorada em critério explícito (custo, Postgres
  puro) em vez de reaberta do zero quando chegar a hora
- Evita pagar por recursos do Supabase que nunca foram usados

**Negativas / em aberto:**
- Escolha final de produção não está fechada — precisa ser revisitada antes
  do primeiro cliente real, com preço então atual (mercado de Postgres
  gerenciado muda rápido)
- Se a escolha for self-hosted em VPS, Pedro assume responsabilidade
  operacional (backup, patch, monitoramento) que um serviço gerenciado
  absorveria

## Alternativas consideradas

- **Manter a decisão da ADR 0002 (Supabase fechado)**: superada — a premissa
  que a motivou (infra de teste = infra de produção) não é real, e não há
  vantagem de custo clara do Supabase sobre alternativas mais simples dado
  o uso atual do ARCA.
