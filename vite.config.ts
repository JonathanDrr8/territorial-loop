import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

const PKG_URL = new URL('./package.json', import.meta.url)
const readPkgVersion = (): string =>
  (JSON.parse(readFileSync(PKG_URL, 'utf8')) as { version: string }).version

/**
 * Stellt die App-Version als virtuelles Modul `virtual:app-version` bereit, das `package.json`
 * bei jedem Laden FRISCH liest — statt sie wie ein `define` einmalig beim Dev-Server-Start
 * einzubrennen. So zeigt der laufende Dev-Server (fester Port 5173) nach einem Versions-Bump
 * sofort die neue Nummer, ohne Neustart: ein Watcher auf `package.json` schickt ein HMR-Reload.
 * Im Production-Build wird der Wert ganz normal zur Build-Zeit eingebacken.
 */
function appVersionPlugin(): Plugin {
  const virtualId = 'virtual:app-version'
  const resolvedId = '\0' + virtualId
  return {
    name: 'territorial-loop:app-version',
    resolveId(id) {
      if (id === virtualId) return resolvedId
      return null
    },
    load(id) {
      if (id === resolvedId) return `export const APP_VERSION = ${JSON.stringify(readPkgVersion())}`
      return null
    },
    configureServer(server) {
      const pkgPath = fileURLToPath(PKG_URL)
      server.watcher.add(pkgPath)
      server.watcher.on('change', (file) => {
        if (file !== pkgPath) return
        const mod = server.moduleGraph.getModuleById(resolvedId)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

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
  plugins: [appVersionPlugin(), lockstepServerPlugin()],
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
