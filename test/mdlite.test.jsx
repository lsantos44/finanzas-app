import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MDLite } from "../src/pestanas/asistente.jsx";

const html = (t) => renderToStaticMarkup(<MDLite text={t} />);

describe("respuestas del asistente", () => {
  it("dibuja las tablas en vez de enseñar las barras", () => {
    const h = html("| Categoría | Gasto |\n|---|---:|\n| Supermercado | 365 € |\n| Compras | 160 € |");
    expect(h).toContain("<table");
    expect(h).toContain("Supermercado");
    expect(h).not.toContain("|");
  });
  it("conserva la numeración de las listas", () => {
    const h = html("1. Primero\n2. Segundo");
    expect(h).toContain("1.");
    expect(h).toContain("2.");
  });
  it("nunca convierte texto en HTML (sin inyección)", () => {
    const h = html("<img src=x onerror=alert(1)> **negrita**");
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img");
    expect(h).toContain("<strong>negrita</strong>");
  });
});
