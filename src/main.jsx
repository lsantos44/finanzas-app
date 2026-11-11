import React from "react";
import { createRoot } from "react-dom/client";
// Inter servida desde la propia web: cargarla de Google le enviaba la IP de cada visita.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import App from "./App.jsx";

// Sin StrictMode a propósito: en desarrollo monta y desmonta cada efecto dos veces,
// y useBackClose empuja/consume entradas del historial dentro de un efecto. El doble
// montaje produce saltos de "atrás" que no ocurren en producción y despistan al mirar.
createRoot(document.getElementById("root")).render(<App />);
