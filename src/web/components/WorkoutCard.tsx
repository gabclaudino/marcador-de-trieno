import { Link } from "react-router-dom";
import type { WorkoutListItem } from "../../shared/schemas";
import { formatDate } from "../format";

export default function WorkoutCard({ workout }: { workout: WorkoutListItem }) {
  return (
    <li className="card">
      <Link to={`/workouts/${workout.id}/run`} className="card-main">
        <span className="card-title">{workout.name}</span>
        <span className="card-sub">
          {workout.last_performed_at
            ? `Último treino: ${formatDate(workout.last_performed_at)}`
            : "Nunca realizado"}
        </span>
      </Link>
      <Link
        to={`/workouts/${workout.id}/edit`}
        className="icon-btn"
        aria-label={`Editar ${workout.name}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </Link>
    </li>
  );
}
