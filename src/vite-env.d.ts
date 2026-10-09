/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origine del backend in produzione; vuota in sviluppo (proxy di Vite) e dietro un reverse proxy */
  readonly VITE_API_URL?: string;
  /** Chiave della Maps Static API (esposta da `envPrefix` in vite.config.ts); assente o vuota → mappa schematica al posto dell'immagine */
  readonly MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
