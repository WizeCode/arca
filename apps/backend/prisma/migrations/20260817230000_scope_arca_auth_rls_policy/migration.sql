-- Restringe o privilégio de arca_auth de BYPASSRLS geral para uma policy
-- escopada só em USUARIOS (ADR 0001, seção 5 — refinamento pós add_login_lookup_function)
--
-- A migração add_login_lookup_function deu BYPASSRLS a arca_auth pra que a
-- função SECURITY DEFINER buscar_usuario_login pudesse ler USUARIOS sem
-- app.current_clinica_id setado. BYPASSRLS funciona, mas é mais amplo que o
-- necessário: ignora RLS em QUALQUER tabela presente ou futura, não só
-- USUARIOS — se buscar_usuario_login um dia ganhar mais uma consulta a outra
-- tabela tenant-scoped, ou se qualquer coisa reconectar como arca_auth, o
-- bypass vale ali também, sem ficar visível em pg_policies.
--
-- Um design anterior (nunca chegou a ser commitado, recuperado de um blob
-- órfão do git: migração create_auth_lookup_role + serviço
-- AuthPrismaService) já apontava pro alternativa certa: role sem BYPASSRLS,
-- com uma policy de RLS explícita liberando SELECT só em USUARIOS pra ela.
-- Essa migração aplica exatamente essa parte do design (NOBYPASSRLS + policy
-- auth_lookup) — sem reintroduzir a conexão Prisma dedicada
-- (AuthPrismaService/AUTH_DATABASE_URL), que fica como refinamento futuro
-- caso algum dia se justifique um pool de conexão separado.
--
-- buscar_usuario_login continua funcionando idêntico: é SECURITY DEFINER,
-- roda com o privilégio de quem é dona da função (arca_auth) independente de
-- quem chamou (arca_app via EXECUTE) — e agora essa role só enxerga
-- exatamente USUARIOS, nunca ganha acesso a nenhuma outra tabela por engano.

ALTER ROLE arca_auth WITH NOBYPASSRLS;

CREATE POLICY auth_lookup ON "USUARIOS"
  FOR SELECT
  TO arca_auth
  USING (true);
