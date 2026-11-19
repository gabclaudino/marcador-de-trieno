import { createMiddleware } from "hono/factory";

export type AuthVariables = { email: string };

/**
 * Middleware de autenticação das rotas /api/*.
 *
 * - Dev local: com DEV_BYPASS_AUTH="true" (definida em .dev.vars, que não vai
 *   para o deploy) a requisição passa. NUNCA definir essa var em produção.
 * - Caso contrário: falha fechada (401).
 *
 * TODO (Fase 10): validar o header `Cf-Access-Jwt-Assertion` com `jose`
 * (assinatura via JWKS do team domain, `aud`, `iss` e `email === OWNER_EMAIL`).
 * Até lá, qualquer requisição sem bypass é recusada, mesmo com o header.
 */
export const auth = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  if (c.env.DEV_BYPASS_AUTH === "true") {
    c.set("email", "dev@localhost");
    return next();
  }

  return c.json({ error: "unauthorized" }, 401);
});
