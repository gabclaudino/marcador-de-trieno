import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AccessConfig = {
  /** Ex.: "meutime.cloudflareaccess.com" (aceita com https:// e barra final). */
  teamDomain: string;
  /** AUD tag da Access application. */
  aud: string;
  /** E-mail do único usuário autorizado. */
  ownerEmail: string;
};

export function normalizeTeamDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

// Um conjunto de chaves por team domain, reaproveitado enquanto o isolate viver
// (o jose faz cache e renova as chaves sozinho quando o `kid` muda).
const jwksCache = new Map<string, JWTVerifyGetKey>();

export function jwksFor(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Valida o JWT do Cloudflare Access (`Cf-Access-Jwt-Assertion`):
 * assinatura (RS256), `iss`, `aud`, expiração e `email` == dono.
 * Qualquer falha devolve null.
 */
export async function verifyAccessJwt(
  token: string,
  config: AccessConfig,
  getKey?: JWTVerifyGetKey,
): Promise<{ email: string } | null> {
  const team = normalizeTeamDomain(config.teamDomain);
  try {
    const { payload } = await jwtVerify(token, getKey ?? jwksFor(team), {
      issuer: `https://${team}`,
      audience: config.aud,
      algorithms: ["RS256"],
    });

    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email || email.toLowerCase() !== config.ownerEmail.trim().toLowerCase()) return null;
    return { email };
  } catch {
    return null;
  }
}
