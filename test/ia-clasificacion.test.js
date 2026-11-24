import { describe, it, expect, vi, afterEach } from "vitest";
import { aiCategorizePatterns, aiEjemplos, classifyForImport, rebuildRules, DEFAULT_RULES, PRIO } from "../src/core.js";
import { mk } from "./helpers.js";

const proveedor = { provider: "openai", baseUrl: "https://ia.example/v1", model: "un-modelo", apiKey: "k" };
const responde = (obj) => {
  const llamadas = [];
  globalThis.fetch = vi.fn(async (_url, opts) => {
    llamadas.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: "stop" }] }) };
  });
  return llamadas;
};
afterEach(() => { delete globalThis.fetch; });

describe("sugerencias de la IA", () => {
  it("«Otros» es abstención: no se sugiere y queda por resolver", async () => {
    responde({ "MERCADONA VALENCIA": "Supermercado", "XJ COSAS SL": "Otros" });
    const { map, unresolved } = await aiCategorizePatterns([{ pattern: "MERCADONA VALENCIA", sign: -1 }, { pattern: "XJ COSAS SL", sign: -1 }], false, proveedor);
    expect(map).toEqual({ "MERCADONA VALENCIA": "Supermercado" });
    expect(unresolved).toEqual(["XJ COSAS SL"]);
  });

  it("acepta claves con mayúsculas o acentos cambiados", async () => {
    responde({ "Farmacia López": "Salud" });
    const { map } = await aiCategorizePatterns([{ pattern: "FARMACIA LOPEZ", sign: -1 }], false, proveedor);
    expect(map["FARMACIA LOPEZ"]).toBe("Salud");
  });

  it("manda tus ejemplos y deja margen a los modelos que razonan", async () => {
    const llamadas = responde({ "BAR EL PUERTO": "Restauración" });
    await aiCategorizePatterns([{ pattern: "BAR EL PUERTO", sign: -1 }], false, proveedor, [{ pattern: "CAFETERIA SOL", cat: "Restauración" }]);
    expect(llamadas[0].messages[1].content).toContain("CAFETERIA SOL → Restauración");
    expect(llamadas[0].max_tokens).toBeGreaterThanOrEqual(4000);
  });

  it("los ejemplos son comercios, no transferencias ni «Otros»", () => {
    const hist = [
      mk("MERCADONA VALENCIA", -40, "2026-10-01", "Supermercado"),
      mk("MERCADONA VALENCIA", -30, "2026-10-08", "Supermercado"),
      mk("TRANSFERENCIA A ANA PEREZ", -50, "2026-10-02", "Regalos"),
      mk("TIENDA RARA", -12, "2026-10-03", "Otros"),
    ];
    const ej = aiEjemplos(hist);
    expect(ej).toEqual([{ pattern: hist[0].pattern, cat: "Supermercado" }]);
  });
});

describe("«Otros» no se aprende", () => {
  it("al venir de la v4 se apagan las reglas tuyas que mandaban a «Otros», sin borrarlas", () => {
    const r = rebuildRules([{ k: "XJ COSAS", cat: "Otros", prio: PRIO.personal }, { k: "LIDL", cat: "Supermercado", prio: PRIO.personal }], [], 4);
    const propias = r.filter((x) => x.scope === "personal");
    expect(propias.find((x) => x.k === "XJ COSAS").active).toBe(false);
    expect(propias.find((x) => x.k === "LIDL").active).not.toBe(false);
    // Si la reactivas, se respeta.
    const v5 = rebuildRules([{ k: "XJ COSAS", cat: "Otros", prio: PRIO.personal }], [], 5);
    expect(v5.find((x) => x.k === "XJ COSAS").active).not.toBe(false);
  });

  it("con la IA encendida, una compra pequeña sin pista se pregunta en vez de quedarse en «Otros»", () => {
    const f = [mk("TIENDA DESCONOCIDA SL", -6, "2026-11-10")];
    expect(classifyForImport(f, [], DEFAULT_RULES).get(f[0].id).confirmed).toBe(true);
    expect(classifyForImport(f, [], DEFAULT_RULES, { preguntarSinPista: true }).get(f[0].id).confirmed).toBe(false);
  });
});

import { firmaSync } from "../src/core.js";
describe("huella de sincronización", () => {
  it("solo cuentan la configuración y los movimientos", () => {
    const base = { cfg: { a: 1 }, movs: { v: 1, movs: [{ id: 1 }] } };
    expect(firmaSync({ ...base, envio: "x", updatedAt: 1, bank: { t: 1 } })).toBe(firmaSync({ ...base, envio: "y", updatedAt: 2 }));
    expect(firmaSync({ ...base, movs: { v: 1, movs: [{ id: 1, confirmed: true }] } })).not.toBe(firmaSync(base));
  });
});

import { aiSupportsWeb } from "../src/core.js";
describe("pistas y búsqueda web", () => {
  const openrouter = { provider: "openai_compat", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-haiku-5.5", apiKey: "k" };
  it("la IA recibe el importe típico de cada comercio", async () => {
    const llamadas = responde({ "CASA MAESTRANZA": "Restauración" });
    await aiCategorizePatterns([{ pattern: "CASA MAESTRANZA", sign: -1, importe: 5.4 }], false, proveedor);
    expect(llamadas[0].messages[1].content).toContain("CASA MAESTRANZA | gasto | ~5,40 € por movimiento");
    expect(llamadas[0].plugins).toBeUndefined();
  });
  it("con OpenRouter, «Buscar en la web» activa su búsqueda", async () => {
    expect(aiSupportsWeb(openrouter)).toBe(true);
    expect(aiSupportsWeb(proveedor)).toBe(false);
    const llamadas = responde({ "TOR GEST SAS": "Parking" });
    const { map, searches } = await aiCategorizePatterns([{ pattern: "TOR GEST SAS", sign: -1, importe: 6.9 }], true, openrouter);
    expect(llamadas[0].plugins).toEqual([{ id: "web", max_results: 3 }]);
    expect(map["TOR GEST SAS"]).toBe("Parking");
    expect(searches).toBe(1);
  });
});
