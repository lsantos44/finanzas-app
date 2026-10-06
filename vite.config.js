import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { open: true },
  // Marca de compilación: la app la muestra en Ajustes para poder distinguir "el arreglo no
  // funciona" de "el navegador sirve un build viejo" sin gastar despliegues en adivinar.
  define: {
    __BUILD__: JSON.stringify(
      new Date().toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    ),
  },
});
