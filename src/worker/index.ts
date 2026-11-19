import { Hono } from "hono";
import { auth, type AuthVariables } from "./auth";
import { exercises } from "./routes/exercises";
import { workouts } from "./routes/workouts";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Toda a API exige autenticação.
app.use("/api/*", auth);

app.get("/api/ping", (c) => c.json({ ok: true, time: new Date().toISOString() }));

app.route("/api/workouts", workouts);
app.route("/api/exercises", exercises);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
