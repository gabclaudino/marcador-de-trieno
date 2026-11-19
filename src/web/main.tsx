import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import EditWorkout from "./pages/EditWorkout";
import RunWorkout from "./pages/RunWorkout";
import { registerSW } from "virtual:pwa-register";
import "./styles.css";

// Service worker (só existe no build de produção).
registerSW({ immediate: true });

// Resultados traz o Recharts (pesado): carregado só quando a tela é aberta.
const Results = lazy(() => import("./pages/Results"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/workouts/:id/edit" element={<EditWorkout />} />
            <Route path="/workouts/:id/run" element={<RunWorkout />} />
            <Route
              path="/workouts/:id/results"
              element={
                <Suspense fallback={<p className="opacity-60">Carregando...</p>}>
                  <Results />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
