/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origine del backend in produzione; vuota in sviluppo (proxy di Vite) e dietro un reverse proxy */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
