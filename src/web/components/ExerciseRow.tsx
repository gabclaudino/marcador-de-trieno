import { useState } from "react";
import type { Exercise, UpdateExercise } from "../../shared/schemas";

type Props = {
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onUpdate: (id: number, data: UpdateExercise, onFail: () => void) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onRemove: (exercise: Exercise) => void;
};

export default function ExerciseRow({
  exercise,
  isFirst,
  isLast,
  disabled,
  onUpdate,
  onMove,
  onRemove,
}: Props) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(String(exercise.target_sets));

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) return setName(exercise.name);
    if (trimmed === exercise.name) return setName(trimmed);
    setName(trimmed);
    onUpdate(exercise.id, { name: trimmed }, () => setName(exercise.name));
  }

  function commitSets() {
    const n = Number(sets);
    if (!Number.isInteger(n) || n < 1 || n > 20) return setSets(String(exercise.target_sets));
    if (n === exercise.target_sets) return;
    onUpdate(exercise.id, { target_sets: n }, () => setSets(String(exercise.target_sets)));
  }

  return (
    <li className="ex-row">
      <input
        className="input"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label="Nome do exercício"
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
            onBlur={commitSets}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
        <div className="ex-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onMove(exercise.id, -1)}
            disabled={disabled || isFirst}
            aria-label={`Subir ${exercise.name}`}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => onMove(exercise.id, 1)}
            disabled={disabled || isLast}
            aria-label={`Descer ${exercise.name}`}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-icon btn-danger"
            onClick={() => onRemove(exercise)}
            disabled={disabled}
            aria-label={`Remover ${exercise.name}`}
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
