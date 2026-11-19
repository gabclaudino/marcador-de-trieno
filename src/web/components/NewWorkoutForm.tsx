import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function NewWorkoutForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const create = useMutation({
    mutationFn: (n: string) => api.createWorkout({ name: n }),
    onSuccess: (workout) => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      setName("");
      setOpen(false);
      navigate(`/workouts/${workout.id}/edit`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) create.mutate(trimmed);
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-block" onClick={() => setOpen(true)}>
        + Novo treino
      </button>
    );
  }

  return (
    <form className="new-form" onSubmit={submit}>
      <input
        className="input"
        autoFocus
        placeholder="Ex.: Peito + Tríceps + Ombro"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Nome do treino"
      />
      <div className="row">
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!name.trim() || create.isPending}
        >
          {create.isPending ? "Criando..." : "Criar"}
        </button>
      </div>
      {create.isError && <p className="error">Não foi possível criar o treino.</p>}
    </form>
  );
}
