/** ISO 8601 (UTC) -> dd/mm/aaaa no fuso do dispositivo. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}
