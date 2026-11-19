import { describe, expect, it } from "vitest";
import {
  CreateSessionSchema,
  MAX_REORDER_IDS,
  MAX_SETS_PER_SESSION,
  ReorderSchema,
} from "./schemas";

const when = "2026-11-19T10:00:00Z";
const makeSets = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    exercise_id: Math.floor(i / 20) + 1,
    set_number: (i % 20) + 1,
    reps: 10,
    weight_kg: 50,
  }));

describe("limites de tamanho dos schemas", () => {
  it("aceita uma sessão no limite de séries", () => {
    const r = CreateSessionSchema.safeParse({ performed_at: when, sets: makeSets(MAX_SETS_PER_SESSION) });
    expect(r.success).toBe(true);
  });

  it("recusa sessão acima do limite de séries", () => {
    const r = CreateSessionSchema.safeParse({ performed_at: when, sets: makeSets(MAX_SETS_PER_SESSION + 1) });
    expect(r.success).toBe(false);
  });

  it("recusa reps e carga absurdas", () => {
    const base = { exercise_id: 1, set_number: 1 };
    const tooManyReps = CreateSessionSchema.safeParse({ performed_at: when, sets: [{ ...base, reps: 1e9, weight_kg: 10 }] });
    const tooHeavy = CreateSessionSchema.safeParse({ performed_at: when, sets: [{ ...base, reps: 10, weight_kg: 1e9 }] });
    expect(tooManyReps.success).toBe(false);
    expect(tooHeavy.success).toBe(false);
  });

  it("recusa séries duplicadas e valores negativos", () => {
    const dup = CreateSessionSchema.safeParse({ performed_at: when, sets: [...makeSets(1), ...makeSets(1)] });
    const neg = CreateSessionSchema.safeParse({ performed_at: when, sets: [{ exercise_id: 1, set_number: 1, reps: -1, weight_kg: 10 }] });
    expect(dup.success).toBe(false);
    expect(neg.success).toBe(false);
  });

  it("reordenação: aceita no limite e recusa acima, vazio ou repetido", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    expect(ReorderSchema.safeParse({ ids: ids(MAX_REORDER_IDS) }).success).toBe(true);
    expect(ReorderSchema.safeParse({ ids: ids(MAX_REORDER_IDS + 1) }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [1, 1] }).success).toBe(false);
  });
});
