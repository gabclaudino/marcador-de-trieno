import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Gera os PNGs/ICO a partir de public/icon.svg: `npm run pwa:icons`.
// Os arquivos gerados ficam em public/ e são versionados (não rodam no build).
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    // Sem borda: o ícone já tem fundo sólido até a borda.
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    // Fundo da área de segurança do "maskable" e do ícone da Apple = cor do ícone.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#059669" } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: "#059669" } },
  },
  images: ["public/icon.svg"],
});
