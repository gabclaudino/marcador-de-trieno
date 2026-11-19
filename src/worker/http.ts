import type { Context } from "hono";
import type { ZodType } from "zod";

type Result<T> = { ok: true; data: T } | { ok: false; res: Response };

/** Lê o corpo JSON e valida com Zod. Falha -> 400. */
export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<Result<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, res: c.json({ error: "invalid_json" }, 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      res: c.json({ error: "validation", issues: parsed.error.issues }, 400),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Lê o parâmetro de rota `:id` como inteiro positivo. Falha -> 400. */
export function parseId(c: Context, param = "id"): Result<number> {
  const raw = c.req.param(param);
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, res: c.json({ error: "invalid_id" }, 400) };
  }
  return { ok: true, data: n };
}

/**
 * Monta um UPDATE parcial. Os nomes de coluna vêm sempre de `columns`
 * (lista fixa no código); os valores vão como parâmetros (bind).
 */
export function buildUpdate(
  table: string,
  columns: readonly string[],
  values: Record<string, unknown>,
): { sql: string; binds: unknown[] } | null {
  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const col of columns) {
    if (values[col] === undefined) continue;
    sets.push(`${col} = ?`);
    const v = values[col];
    binds.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
  }
  if (sets.length === 0) return null;
  return { sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, binds };
}
