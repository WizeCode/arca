-- Row-Level Security (ADR 0001, seção 5)
--
-- Reforça no banco o isolamento de tenant que a Prisma Client Extension
-- (tenant.extension.ts) já aplica na camada de aplicação, usando o mesmo
-- valor de sessão que a extension seta via set_config('app.current_clinica_id', ...).
--
-- A policy confia no valor de app.current_clinica_id sem reconsultar a tabela
-- Usuario, porque jwt.strategy.ts já rejeita qualquer requisição em que o
-- clinicaId do token não bate com o id_Clinica atual do usuário no banco —
-- isso fecha a janela de "token desatualizado" uma camada antes. A alternativa
-- mais rigorosa (função SECURITY DEFINER reconferindo a clínica do usuário a
-- cada query) é desnecessária dado esse controle já existente.
--
-- FORCE ROW LEVEL SECURITY garante que a policy vale mesmo para o dono da
-- tabela; a role usada pela aplicação (arca_app) não é a dona da tabela
-- (ver migração grant_arca_app_privileges), mas FORCE remove a dependência
-- implícita nesse detalhe de provisionamento.

ALTER TABLE "USUARIOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "USUARIOS" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "USUARIOS"
  USING ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid)
  WITH CHECK ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid);

ALTER TABLE "LISTA_ESPERA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LISTA_ESPERA" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "LISTA_ESPERA"
  USING ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid)
  WITH CHECK ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid);

ALTER TABLE "ATENDIMENTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ATENDIMENTOS" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "ATENDIMENTOS"
  USING ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid)
  WITH CHECK ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid);

ALTER TABLE "REGISTRO_CLINICOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "REGISTRO_CLINICOS" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "REGISTRO_CLINICOS"
  USING ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid)
  WITH CHECK ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid);

ALTER TABLE "LOGS_AUDITORIA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LOGS_AUDITORIA" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "LOGS_AUDITORIA"
  USING ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid)
  WITH CHECK ("ID_Clinica" = current_setting('app.current_clinica_id', true)::uuid);
