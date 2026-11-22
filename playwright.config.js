import { defineConfig, devices } from "@playwright/test";

// Prueba de humo en navegador real sobre la app compilada (vite preview).
export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  // En CI se descarga el navegador; aquí se puede apuntar a uno ya instalado con PW_CHROMIUM.
  // Sin service worker salvo en la prueba que lo mide: con él, page.route no ve todas las peticiones.
  use: { baseURL: "http://localhost:4173", serviceWorkers: "block", ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}) },
  projects: [
    { name: "movil", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "escritorio", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: { command: "npx vite preview --port 4173 --strictPort", url: "http://localhost:4173", reuseExistingServer: true, timeout: 60000 },
});
