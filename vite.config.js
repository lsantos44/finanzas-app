import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Genera /sw.js con la lista de archivos de ESTA compilación, para que el dispositivo guarde una
// copia del programa y la app abra aunque Cloudflare no responda. De las fuentes solo se guardan
// los alfabetos latinos: el resto (cirílico, griego…) no lo usa la app.
// Marca de compilación: la app la muestra en Ajustes y la compara con /version.txt para saber si
// el móvil sigue con una versión anterior abierta.
const SELLO = new Date().toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function copiaSinConexion() {
  return {
    name: "copia-sin-conexion",
    apply: "build",
    generateBundle(_opts, bundle) {
      const propios = Object.keys(bundle).filter((f) =>
        f !== "index.html" && !f.endsWith(".map") && (!/\.woff2?$/.test(f) || /inter-latin(-ext)?-\d+-normal-.*\.woff2$/.test(f)));
      const archivos = ["/", "/arranque.js", "/favicon.svg", "/privacidad.html", ...propios.map((f) => "/" + f)];
      const version = createHash("sha256").update(Object.keys(bundle).sort().join("|")).digest("hex").slice(0, 12);
      const plantilla = readFileSync(new URL("./build/sw.js", import.meta.url), "utf8");
      this.emitFile({ type: "asset", fileName: "version.txt", source: SELLO });
      this.emitFile({ type: "asset", fileName: "sw.js", source: plantilla.replace('"__VERSION__"', JSON.stringify(version)).replace("= __ARCHIVOS__;", "= " + JSON.stringify(archivos) + ";") });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copiaSinConexion()],
  server: { open: true },
  // Marca de compilación: la app la muestra en Ajustes para poder distinguir "el arreglo no
  // funciona" de "el navegador sirve un build viejo" sin gastar despliegues en adivinar.
  define: {
    __BUILD__: JSON.stringify(SELLO),
  },
});
