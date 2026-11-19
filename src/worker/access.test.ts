import { SignJWT, generateKeyPair, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizeTeamDomain, verifyAccessJwt, type AccessConfig } from "./access";

const config: AccessConfig = {
  teamDomain: "meutime.cloudflareaccess.com",
  aud: "aud-tag-123",
  ownerEmail: "dono@example.com",
};

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let otherKeys: Awaited<ReturnType<typeof generateKeyPair>>;
// Simula o JWKS do Access: devolve sempre a chave pública "do Cloudflare".
const getKey = async () => keys.publicKey;

beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");
});

async function sign(
  overrides: JWTPayload = {},
  opts: { key?: CryptoKey; exp?: string | number; iss?: string; aud?: string } = {},
) {
  return new SignJWT({ email: "dono@example.com", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? `https://${config.teamDomain}`)
    .setAudience(opts.aud ?? config.aud)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? keys.privateKey);
}

describe("verifyAccessJwt", () => {
  it("aceita um token válido do dono", async () => {
    expect(await verifyAccessJwt(await sign(), config, getKey)).toEqual({ email: "dono@example.com" });
  });

  it("ignora diferença de maiúsculas no e-mail", async () => {
    const token = await sign({ email: "Dono@Example.COM" });
    expect(await verifyAccessJwt(token, config, getKey)).not.toBeNull();
  });

  it("aceita team domain com https:// e barra final na config", async () => {
    const cfg = { ...config, teamDomain: "https://meutime.cloudflareaccess.com/" };
    expect(await verifyAccessJwt(await sign(), cfg, getKey)).not.toBeNull();
  });

  it("recusa e-mail diferente do dono", async () => {
    expect(await verifyAccessJwt(await sign({ email: "outro@example.com" }), config, getKey)).toBeNull();
  });

  it("recusa token sem e-mail", async () => {
    expect(await verifyAccessJwt(await sign({ email: undefined }), config, getKey)).toBeNull();
  });

  it("recusa audience errada", async () => {
    expect(await verifyAccessJwt(await sign({}, { aud: "outra-app" }), config, getKey)).toBeNull();
  });

  it("recusa issuer errado", async () => {
    const token = await sign({}, { iss: "https://invasor.cloudflareaccess.com" });
    expect(await verifyAccessJwt(token, config, getKey)).toBeNull();
  });

  it("recusa token expirado", async () => {
    const token = await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 });
    expect(await verifyAccessJwt(token, config, getKey)).toBeNull();
  });

  it("recusa assinatura de outra chave", async () => {
    const token = await sign({}, { key: otherKeys.privateKey });
    expect(await verifyAccessJwt(token, config, getKey)).toBeNull();
  });

  it("recusa token adulterado", async () => {
    const [h, , s] = (await sign()).split(".");
    const forgedPayload = btoa(JSON.stringify({ email: "dono@example.com", aud: config.aud, iss: `https://${config.teamDomain}`, exp: 9999999999 }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(await verifyAccessJwt(`${h}.${forgedPayload}.${s}`, config, getKey)).toBeNull();
  });

  it("recusa alg=none", async () => {
    const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
    const token = `${enc({ alg: "none" })}.${enc({ email: "dono@example.com", aud: config.aud, iss: `https://${config.teamDomain}`, exp: 9999999999 })}.`;
    expect(await verifyAccessJwt(token, config, getKey)).toBeNull();
  });

  it("recusa HS256 (confusão de algoritmo)", async () => {
    const token = await new SignJWT({ email: "dono@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(`https://${config.teamDomain}`)
      .setAudience(config.aud)
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("segredo"));
    expect(await verifyAccessJwt(token, config, getKey)).toBeNull();
  });

  it("recusa lixo no lugar do token", async () => {
    expect(await verifyAccessJwt("isto-nao-e-um-jwt", config, getKey)).toBeNull();
    expect(await verifyAccessJwt("", config, getKey)).toBeNull();
  });
});

describe("normalizeTeamDomain", () => {
  it("remove protocolo, espaços e barras finais", () => {
    expect(normalizeTeamDomain("  https://x.cloudflareaccess.com// ")).toBe("x.cloudflareaccess.com");
    expect(normalizeTeamDomain("x.cloudflareaccess.com")).toBe("x.cloudflareaccess.com");
  });
});
