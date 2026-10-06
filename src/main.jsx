import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Sin StrictMode a propósito: en desarrollo monta y desmonta cada efecto dos veces,
// y useBackClose empuja/consume entradas del historial dentro de un efecto. El doble
// montaje produce saltos de "atrás" que no ocurren en producción y despistan al mirar.
createRoot(document.getElementById("root")).render(<App />);
