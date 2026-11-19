import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export default function AddExerciseForm({ workoutId }: { workoutId: number }) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: (v: { name: string; target_sets: number }) => api.createExercise(workoutId, v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workout", workoutId] }),
    // Em caso de erro, devolve o texto ao campo (se ainda estiver vazio) para tentar de novo.
    onError: (_e, vars) => setName((current) => current || vars.name),
  });

  const setsNum = Number(sets);
  const setsValid = Number.isInteger(setsNum) && setsNum >= 1 && setsNum <= 20;
  const canSubmit = name.trim() !== "" && setsValid;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    add.mutate({ name: name.trim(), target_sets: setsNum });
    setName(""); // limpa já: permite digitar o próximo enquanto o envio termina
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        className="input"
        placeholder="Novo exercício (ex.: Supino reto)"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Nome do novo exercício"
      />
      <div className="ex-controls">
        <label className="sets-field">
          <span className="muted">Séries</span>
          <input
            className="input input-num"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          Adicionar
        </button>
      </div>
      {add.isError && <p className="error">Não foi possível adicionar o exercício.</p>}
    </form>
  );
}
