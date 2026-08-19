-- Login lookup vs. FORCE ROW LEVEL SECURITY (ADR 0001, seção 5 — correção)
--
-- A migração enable_row_level_security justificou não usar uma função
-- SECURITY DEFINER com o argumento de que jwt.strategy.ts já reconfere a
-- clínica do usuário a cada request, fechando a janela de "token
-- desatualizado" sem precisar de uma função que reconsulta a clínica a cada
-- query. Esse argumento vale para toda rota autenticada, mas não cobre
-- auth.service.ts#validateUser: o login busca o Usuario por e-mail
-- exatamente para DESCOBRIR a clínica — não há app.current_clinica_id
-- possível de setar antes dessa consulta. Com FORCE ROW LEVEL SECURITY em
-- USUARIOS e nenhuma policy que dispense esse caso, a policy tenant_isolation
-- bloqueia a busca inteira e o login falha (0 linhas) mesmo para um usuário
-- existente e ativo.
--
-- A correção é uma função SECURITY DEFINER estreita — só essa consulta, só
-- essa tabela — de propriedade de uma role dedicada (arca_auth) diferente da
-- role de runtime da aplicação (arca_app). arca_auth precisa já existir no
-- cluster antes desta migração rodar, no mesmo padrão de provisionamento
-- documentado em grant_arca_app_privileges (roles são cluster-wide e credenciais
-- de login não entram em versionamento); se não existir, os comandos abaixo
-- falham alto em vez de deixar a aplicação falhar silenciosamente depois.
--
-- Isolar o BYPASSRLS em arca_auth (em vez de conceder a arca_app) é o que
-- garante que nenhuma outra query feita pela aplicação — todas rodam como
-- arca_app — ganha esse bypass. arca_app só ganha a permissão mínima de
-- executar esta função pontual; nenhuma tabela tenant-scoped fica acessível
-- via bypass fora dela.

ALTER ROLE arca_auth WITH BYPASSRLS;

GRANT USAGE ON SCHEMA public TO arca_auth;
GRANT SELECT ON public."USUARIOS" TO arca_auth;

CREATE FUNCTION public.buscar_usuario_login(p_email VARCHAR)
RETURNS TABLE (
  id_user     UUID,
  nome        VARCHAR,
  email       VARCHAR,
  senha_hash  VARCHAR,
  role_id     SMALLINT,
  id_clinica  UUID
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
