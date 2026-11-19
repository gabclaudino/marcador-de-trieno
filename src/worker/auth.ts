import { createMiddleware } from "hono/factory";
import { normalizeTeamDomain, verifyAccessJwt } from "./access";

export type AuthVariables = { email: string };

/** O bypass de dev só vale quando a requisição chega por um host local. */
function isLocalHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
}

/**
 * Middleware de autenticação das rotas /api/*.
 *
 * - Dev local: com DEV_BYPASS_AUTH="true" (em .dev.vars, que não vai para o
 *   deploy) E host local, a requisição passa. Em qualquer outro host o bypass
 *   é ignorado, mesmo que a var seja definida por engano em produção.
 * - Produção: valida o header `Cf-Access-Jwt-Assertion` (assinatura, aud, iss e
 *   e-mail do dono). Qualquer falha -> 401. Sem configuração -> 401 (falha fechada).
 */
export const auth = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  if (c.env.DEV_BYPASS_AUTH === "true" && isLocalHost(c.req.url)) {
    c.set("email", "dev@localhost");
    return next();
  }

  const teamDomain = normalizeTeamDomain(c.env.ACCESS_TEAM_DOMAIN ?? "");
  const aud = (c.env.ACCESS_AUD ?? "").trim();
  const ownerEmail = (c.env.OWNER_EMAIL ?? "").trim();
  if (!teamDomain || !aud || !ownerEmail) {
    console.error("auth: ACCESS_TEAM_DOMAIN, ACCESS_AUD e OWNER_EMAIL precisam estar configurados");
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const user = await verifyAccessJwt(token, { teamDomain, aud, ownerEmail });
  if (!user) return c.json({ error: "unauthorized" }, 401);

  c.set("email", user.email);
  return next();
});
