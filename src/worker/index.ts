import { Hono } from "hono";
import { auth, type AuthVariables } from "./auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Toda a API exige autenticação.
app.use("/api/*", auth);

app.get("/api/ping", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
