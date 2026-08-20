-- Clínica desativada precisa bloquear login e revalidação de JWT dos seus usuários, não só
-- filtrar dados via RLS (que só entra em cena depois que já existe um clinicaId no contexto).
-- CREATE OR REPLACE preserva owner/grants das próprias funções, mas o corpo passa a ler
-- CLINICAS agora — como as funções são SECURITY DEFINER, isso roda com os privilégios de
-- arca_auth, que nunca teve GRANT em CLINICAS (só em USUARIOS, migration
-- 20260816220000_tenant_row_level_security). Sem o GRANT abaixo, todo login e toda
-- revalidação de JWT quebra com "permission denied for table CLINICAS".

GRANT SELECT ON public."CLINICAS" TO arca_auth;

CREATE OR REPLACE FUNCTION public.buscar_usuario_login(p_email VARCHAR)
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
  SELECT u."ID_User", u.nome, u.email, u."SenhaHash", u."ID_Role", u."ID_Clinica"
  FROM public."USUARIOS" u
  JOIN public."CLINICAS" c ON c."ID_Clinica" = u."ID_Clinica"
  WHERE u.email = p_email AND u."isActive" = true AND c."isActive" = true;
$$;

CREATE OR REPLACE FUNCTION public.buscar_usuario_por_id(p_id_user UUID)
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
  SELECT u."ID_User", u."isActive", u."ID_Clinica"
  FROM public."USUARIOS" u
  JOIN public."CLINICAS" c ON c."ID_Clinica" = u."ID_Clinica"
  WHERE u."ID_User" = p_id_user AND c."isActive" = true;
$$;
