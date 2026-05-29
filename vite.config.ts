import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const pkgVersion: string = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

/** Lockstep-Server-Port (Default des Mehrspieler-Dialogs: ws://localhost:8787). */
const LOCKSTEP_PORT = 8787

/**
 * Startet den Lockstep-Server (ADR-0009) automatisch zusammen mit dem Vite-Dev-Server, damit
 * Mehrspieler ohne zweites Terminal („npm run server") läuft. Nur im Dev-Modus (`serve`).
 * Ist der Port schon belegt (manuell gestarteter Server), wird das toleriert statt Vite zu
 * crashen. Für ein echtes Deployment bleibt `npm run server` der eigenständige Weg.
 */
function lockstepServerPlugin(): Plugin {
  let close: (() => Promise<void>) | null = null
  return {
    name: 'territorial-loop:lockstep-server',
    apply: 'serve',
    async configureServer(vite) {
      const { startServer } = await import('./server/server')
      try {
        const running = await startServer(LOCKSTEP_PORT)
        close = running.close
        vite.config.logger.info(
          `  ➜  Lockstep:  ws://localhost:${String(LOCKSTEP_PORT)} (Mehrspieler bereit)`,
        )
      } catch {
        vite.config.logger.warn(
          `  ➜  Lockstep:  Port ${String(LOCKSTEP_PORT)} belegt — nutze den bereits laufenden Server`,
        )
      }
      vite.httpServer?.once('close', () => {
        void close?.()
      })
    },
  }
}

export default defineConfig({
  define: {
    // App-Version aus package.json in den Client-Build backen (Anzeige im Menü).
    __APP_VERSION__: JSON.stringify(pkgVersion),
  },
  plugins: [lockstepServerPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['seedrandom'],
  },
})
