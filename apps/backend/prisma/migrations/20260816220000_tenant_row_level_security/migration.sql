-- Role de runtime da aplicação (arca_app) e role de bypass estreito de login (arca_auth)
-- precisam já existir no cluster antes desta migration rodar — provisionamento de role é
-- passo de infra, não de migration (roles são cluster-wide, credenciais não entram em versionamento).

GRANT USAGE ON SCHEMA public TO arca_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO arca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO arca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO arca_app;

-- Isolamento por tenant (ADR 0001, seção 5): a policy confia em app.current_clinica_id, que
-- tenant.extension.ts seta via set_config antes de cada query. NULLIF trata o caso em que o
-- Postgres reverte set_config(is_local=true) para '' (não NULL) ao fim da transação, quando a
-- GUC nunca tinha sido setada nessa conexão antes — sem isso, uma query fora da extension
-- (ex: SQL direto) numa conexão que já rodou uma query de tenant lançaria erro de cast em vez
-- de simplesmente não bater com nenhuma linha.
-- FORCE garante que a policy vale mesmo para o dono da tabela, não só para arca_app.

ALTER TABLE "USUARIOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "USUARIOS" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "USUARIOS"
  USING ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid)
  WITH CHECK ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid);

ALTER TABLE "LISTA_ESPERA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LISTA_ESPERA" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LISTA_ESPERA"
  USING ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid)
  WITH CHECK ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid);

ALTER TABLE "ATENDIMENTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ATENDIMENTOS" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ATENDIMENTOS"
  USING ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid)
  WITH CHECK ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid);

ALTER TABLE "REGISTRO_CLINICOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "REGISTRO_CLINICOS" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "REGISTRO_CLINICOS"
  USING ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid)
  WITH CHECK ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid);

ALTER TABLE "LOGS_AUDITORIA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LOGS_AUDITORIA" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LOGS_AUDITORIA"
  USING ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid)
  WITH CHECK ("ID_Clinica" = NULLIF(current_setting('app.current_clinica_id', true), '')::uuid);

-- Login (por e-mail) e validação de JWT (por id_User) precisam ler USUARIOS antes de saber
-- a clínica atual — não há app.current_clinica_id possível de setar nessas duas buscas,
-- porque são elas quem descobrem a clínica. arca_auth é NOBYPASSRLS e só enxerga USUARIOS via
-- a policy auth_lookup abaixo, então nenhuma outra query da aplicação (que roda como arca_app)
-- ganha esse acesso por engano.

GRANT USAGE ON SCHEMA public TO arca_auth;
GRANT SELECT ON public."USUARIOS" TO arca_auth;
ALTER ROLE arca_auth WITH NOBYPASSRLS;

CREATE POLICY auth_lookup ON "USUARIOS"
  FOR SELECT
  TO arca_auth
  USING (true);

CREATE FUNCTION public.buscar_usuario_login(p_email VARCHAR)
RETURNS TABLE (
  id_user    UUID,
  nome       VARCHAR,
  email      VARCHAR,
  senha_hash VARCHAR,
  role_id    SMALLINT,
  id_clinica UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "ID_User", nome, email, "SenhaHash", "ID_Role", "ID_Clinica"
  FROM public."USUARIOS"
  WHERE email = p_email AND "isActive" = true;
$$;

ALTER FUNCTION public.buscar_usuario_login(VARCHAR) OWNER TO arca_auth;
REVOKE ALL ON FUNCTION public.buscar_usuario_login(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_login(VARCHAR) TO arca_app;

CREATE FUNCTION public.buscar_usuario_por_id(p_id_user UUID)
RETURNS TABLE (
  id_user    UUID,
  is_active  BOOLEAN,
  id_clinica UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "ID_User", "isActive", "ID_Clinica"
  FROM public."USUARIOS"
  WHERE "ID_User" = p_id_user;
$$;

ALTER FUNCTION public.buscar_usuario_por_id(UUID) OWNER TO arca_auth;
REVOKE ALL ON FUNCTION public.buscar_usuario_por_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_id(UUID) TO arca_app;
