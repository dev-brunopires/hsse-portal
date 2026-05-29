## Criar usuário Admin Master

**Email:** bruno.junior@sbmoffshore.com

### O que será feito

1. **Criar o usuário no sistema de autenticação** com email/senha (email auto-confirmado para acesso imediato).
2. **Atribuir o papel `admin_master`** na tabela `user_roles`.
3. **Registrar como Platform Owner** na tabela `platform_owners` (acesso multi-tenant total).
4. **Criar/vincular a uma organização padrão** em `user_organizations` para que o login funcione no contexto multi-tenant.
5. O perfil em `profiles` será criado automaticamente pelo trigger `handle_new_user`.

### Pendência — preciso de 1 informação

Qual senha inicial você quer usar? Sugiro algo temporário forte como `SBM@Admin2026!` que você troca no primeiro login. Confirma essa ou me passa outra.

Após sua confirmação, executo a criação e te entrego as credenciais para login em `/auth`.