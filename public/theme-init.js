// Aplica o tema salvo antes do React montar, para não piscar.
// Fica em arquivo próprio (e não inline no HTML) para a CSP poder usar script-src 'self'.
try {
  var t = localStorage.getItem("theme") === "dark" ? "dark" : "emerald";
  document.documentElement.setAttribute("data-theme", t);
  if (t === "dark") {
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#1d232a");
  }
} catch (e) {
  /* armazenamento indisponível: fica no tema padrão */
}
