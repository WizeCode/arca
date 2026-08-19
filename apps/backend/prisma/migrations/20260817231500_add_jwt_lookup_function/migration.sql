-- Lookup por id_User vs. FORCE ROW LEVEL SECURITY (ADR 0001, seção 5 — jwt.strategy.ts)
--
-- jwt.strategy.ts#validate tem o mesmo problema estrutural que
-- auth.service.ts#validateUser (ver add_login_lookup_function): busca o
-- Usuario por id_User via PrismaService cru pra DESCOBRIR o id_Clinica atual
-- e comparar com o clinicaId do token — não há app.current_clinica_id
-- possível de setar antes dessa consulta, porque é ela quem estabeleceria
-- esse valor. Com FORCE ROW LEVEL SECURITY em USUARIOS, a policy
-- tenant_isolation bloqueia a busca (0 linhas) pra qualquer request
-- autenticado, mesmo com token válido de usuário ativo.
--
-- Mesmo padrão de add_login_lookup_function e scope_arca_auth_rls_policy:
-- função SECURITY DEFINER estreita, dona por arca_auth (NOBYPASSRLS, só
-- enxerga USUARIOS via a policy auth_lookup já existente — nenhum GRANT novo
-- de tabela necessário aqui). Retorna só isActive e id_Clinica: é só o que
-- jwt.strategy.ts#validate usa: a lógica de comparação clinicaId/isActive em
-- si não muda, só a forma de buscar o usuário.

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
