import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export default function Home() {
  const ping = useQuery({ queryKey: ["ping"], queryFn: api.ping });

  return (
    <main className="container">
      <h1>Marcador de Treino</h1>
      <p>
        API:{" "}
        {ping.isPending
          ? "verificando..."
          : ping.isError
            ? "erro"
            : `ok (${ping.data.time})`}
      </p>
    </main>
  );
}
