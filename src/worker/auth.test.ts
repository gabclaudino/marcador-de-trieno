import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { auth, type AuthVariables } from "./auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
app.use("/api/*", auth);
app.get("/api/ping", (c) => c.json({ ok: true, email: c.get("email") }));

const configured = {
  ACCESS_TEAM_DOMAIN: "meutime.cloudflareaccess.com",
  ACCESS_AUD: "aud-tag-123",
  OWNER_EMAIL: "dono@example.com",
};
const env = (extra: Record<string, string> = {}) => ({ ...configured, ...extra }) as unknown as Env;

describe("auth middleware", () => {
  it("bypass de dev funciona em localhost", async () => {
    const res = await app.request("http://localhost:5173/api/ping", {}, env({ DEV_BYPASS_AUTH: "true" }));
    expect(res.status).toBe(200);
  });

  it("bypass de dev funciona em 127.0.0.1", async () => {
    const res = await app.request("http://127.0.0.1:8787/api/ping", {}, env({ DEV_BYPASS_AUTH: "true" }));
    expect(res.status).toBe(200);
  });

  it("bypass é IGNORADO em host de produção, mesmo com a var ligada", async () => {
    const res = await app.request("https://treino.example.com/api/ping", {}, env({ DEV_BYPASS_AUTH: "true" }));
    expect(res.status).toBe(401);
  });

  it("recusa host que apenas contém 'localhost' no nome", async () => {
    const res = await app.request("https://localhost.evil.com/api/ping", {}, env({ DEV_BYPASS_AUTH: "true" }));
    expect(res.status).toBe(401);
  });

  it("sem bypass e sem header: 401", async () => {
    const res = await app.request("https://treino.example.com/api/ping", {}, env());
    expect(res.status).toBe(401);
  });

  it("header com token inválido: 401", async () => {
    const res = await app.request(
      "https://treino.example.com/api/ping",
      { headers: { "Cf-Access-Jwt-Assertion": "x.y.z" } },
      env(),
    );
    expect(res.status).toBe(401);
  });

  it("sem configuração do Access: 401 (falha fechada), mesmo com header", async () => {
    const res = await app.request(
      "https://treino.example.com/api/ping",
      { headers: { "Cf-Access-Jwt-Assertion": "x.y.z" } },
      env({ ACCESS_AUD: "" }),
    );
    expect(res.status).toBe(401);
  });
});
