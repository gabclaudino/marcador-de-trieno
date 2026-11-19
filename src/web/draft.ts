/** Valores digitados de uma série (como texto, exatamente o que está no campo). */
export type SetValues = { reps: string; weight: string };

/** Rascunho da sessão em andamento: chave `${exerciseId}:${setNumber}`. */
export type Draft = Record<string, SetValues>;

const storageKey = (workoutId: number) => `draft:workout:${workoutId}`;

export const setKey = (exerciseId: number, setNumber: number) => `${exerciseId}:${setNumber}`;

export function loadDraft(workoutId: number): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(workoutId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

    const draft: Draft = {};
    for (const [k, v] of Object.entries(parsed)) {
      const val = v as Partial<SetValues> | null;
      if (val && typeof val.reps === "string" && typeof val.weight === "string") {
        draft[k] = { reps: val.reps, weight: val.weight };
      }
    }
    return Object.keys(draft).length > 0 ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(workoutId: number, draft: Draft): void {
  try {
    localStorage.setItem(storageKey(workoutId), JSON.stringify(draft));
  } catch {
    /* armazenamento indisponível: segue sem rascunho */
  }
}

export function clearDraft(workoutId: number): void {
  try {
    localStorage.removeItem(storageKey(workoutId));
  } catch {
    /* ignora */
  }
}
