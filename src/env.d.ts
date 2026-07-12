/// <reference types="astro/client" />

declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
  }
}

export {};
