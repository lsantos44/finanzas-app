// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { makeAccessLink, abrirAcceso, parseAccessLink } from "../src/App.jsx";

describe("enlace de acceso cifrado", () => {
  it("ida y vuelta con la clave correcta; falla con otra", async () => {
    const link = await makeAccessLink("https://finanzas.ejemplo.workers.dev", "token-secreto-123", "clave larga 123");
    expect(link).not.toContain("token-secreto-123");
    const p = parseAccessLink(link);
    expect(p.u).toBe("https://finanzas.ejemplo.workers.dev");
    expect(await abrirAcceso(p.cif, "clave larga 123")).toBe("token-secreto-123");
    await expect(abrirAcceso(p.cif, "otra clave")).rejects.toThrow();
  }, 30000);
  it("rechaza basura y URLs que no son http(s)", () => {
    expect(parseAccessLink("hola")).toBeNull();
    const bad = btoa(JSON.stringify({ u: "javascript:alert(1)", t: "x" }));
    expect(parseAccessLink("#acceso=" + bad)).toBeNull();
  });
});
