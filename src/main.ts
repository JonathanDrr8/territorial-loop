// Entry-Point für territorial-loop
// Wird in der Architektur-Phase (Phase B) mit Inhalt gefüllt.
// Aktuell nur Platzhalter, damit Vite einen Build erstellen kann.

console.info('[territorial-loop] Boot — Architektur-Phase ausstehend')

const root = document.getElementById('game')
if (root) {
  root.style.color = '#888'
  root.style.fontFamily = 'system-ui, sans-serif'
  root.style.display = 'flex'
  root.style.alignItems = 'center'
  root.style.justifyContent = 'center'
  root.textContent =
    'territorial-loop — Setup abgeschlossen. Konzept- und Architektur-Phase folgen.'
}
