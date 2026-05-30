/// <reference types="vite/client" />

/** App-Version aus package.json (virtuelles Modul, siehe vite.config.ts `appVersionPlugin`). */
declare module 'virtual:app-version' {
  export const APP_VERSION: string
}
