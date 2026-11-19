import { Link, Outlet, useMatch } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function Layout() {
  // Resultados usa mais largura no PC (gráfico e sessões lado a lado).
  const wide = useMatch("/workouts/:id/results") !== null;

  return (
    <>
      <header className="navbar bg-base-200 border-b border-base-300 px-4">
        <Link to="/" className="flex-1 min-h-11 flex items-center text-lg font-bold">
          Marcador de Treino
        </Link>
        <ThemeToggle />
      </header>
      <main
        className={`mx-auto w-full p-4 pb-10 md:pt-8 ${wide ? "max-w-5xl" : "max-w-180"}`}
      >
        <Outlet />
      </main>
    </>
  );
}
