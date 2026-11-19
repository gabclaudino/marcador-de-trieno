import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/ping", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
