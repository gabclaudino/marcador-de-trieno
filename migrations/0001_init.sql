PRAGMA foreign_keys = ON;

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 20),
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  performed_at TEXT NOT NULL            -- ISO 8601 UTC
);

CREATE TABLE session_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
  UNIQUE (session_id, exercise_id, set_number)
);

CREATE INDEX idx_we_workout ON workout_exercises(workout_id, position);
CREATE INDEX idx_sessions_workout ON sessions(workout_id, performed_at DESC);
CREATE INDEX idx_sets_session ON session_sets(session_id);
