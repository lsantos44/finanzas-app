import { describe, it, expect } from "vitest";
import { classifyForImport, learnedRule, DEFAULT_RULES, PRIO, normalizePattern, viviendaPorDefecto, VIVIENDA } from "../src/App.jsx";
import { mk } from "./helpers.js";

const cat = (dec, m) => dec.get(m.id).cat;

describe("transferencias: lo aprendido va atado al importe", () => {
  for (const concepto of ["TRANSF. PERIODICA", "TRANSFER INMEDIATA", "ANA PEREZ GOMEZ", "Movimiento"]) {
    it(`85 € garaje y 500 € fondos no se mezclan (${concepto})`, () => {
      const hist = [];
      for (let mes = 3; mes < 9; mes++) hist.push(mk(concepto, -85, new Date(2026, mes, 3), "Parking"));
      for (let mes = 6; mes < 9; mes++) hist.push(mk(concepto, -500, new Date(2026, mes, 5), "Ahorro e inversión"));
      // Regla vieja sin importe (la que causaba el error) sigue guardada.
      const vieja = { k: normalizePattern(concepto), cat: "Ahorro e inversión", prio: PRIO.personal, scope: "personal" };
      const fresh = [mk(concepto, -85, new Date(2026, 9, 3)), mk(concepto, -500, new Date(2026, 9, 5))];
      const dec = classifyForImport(fresh, hist, [vieja, ...DEFAULT_RULES]);
      expect(cat(dec, fresh[0])).toBe("Parking");
      expect(cat(dec, fresh[1])).toBe("Ahorro e inversión");
    });
  }

  it("las reglas aprendidas llevan rango de importe y no se pisan", () => {
    const c = "TRANSF. PERIODICA";
    const p85 = mk(c, -85, "2026-06-03", "Parking"), p500 = mk(c, -500, "2026-06-05", "Ahorro e inversión");
    const r85 = learnedRule(p85, "Parking"), r500 = learnedRule(p500, "Ahorro e inversión");
    expect(r85).toMatchObject({ sign: "-", min: 72.25, max: 97.75 });
    expect(r500).toMatchObject({ sign: "-", min: 425, max: 575 });
    const fresh = [mk(c, -85, "2026-07-03"), mk(c, -510, "2026-07-05"), mk(c, -1200, "2026-07-09")];
    const dec = classifyForImport(fresh, [p85, p500], [r500, r85, ...DEFAULT_RULES]);
    expect(cat(dec, fresh[0])).toBe("Parking");
    expect(cat(dec, fresh[1])).toBe("Ahorro e inversión");
    expect(dec.get(fresh[2].id).confirmed).toBe(false); // importe desconocido: pendiente
  });

  it("sin regla, una transferencia nueva no se adivina por la fase del mes", () => {
    const c = "TRANSF. PERIODICA";
    const hist = Array.from({ length: 6 }, (_, i) => mk(c, -85, new Date(2026, i, 3), "Parking"));
    const fresh = [mk(c, -500, new Date(2026, 7, 5))];
    const dec = classifyForImport(fresh, hist, DEFAULT_RULES);
    expect(dec.get(fresh[0].id).confirmed).toBe(false);
    expect(cat(dec, fresh[0])).not.toBe("Parking");
  });

  it("un comercio normal aprende sin importe", () => {
    const sup = [mk("MERCADONA", -5, "2026-01-01", "Supermercado"), mk("MERCADONA", -120, "2026-01-02", "Supermercado")];
    expect(learnedRule(sup[0], "Supermercado", undefined, sup)).toEqual({ k: "MERCADONA", cat: "Supermercado", prio: PRIO.personal, scope: "personal" });
  });
});

describe("reglas básicas", () => {
  it("clasifica comercios conocidos", () => {
    const fresh = [mk("COMPRA TARJ. MERCADONA LA REMO", -40, "2026-01-05"), mk("NOMINA ACME SL", 2100, "2026-01-28")];
    const dec = classifyForImport(fresh, [], DEFAULT_RULES);
    expect(cat(dec, fresh[0])).toBe("Supermercado");
    expect(cat(dec, fresh[1])).toBe("Nómina y pensión");
  });
  it("un restaurante caro no es Restauración (tope de importe)", () => {
    const fresh = [mk("ASADOR EL TORO", -3000, "2026-01-05")];
    const dec = classifyForImport(fresh, [], DEFAULT_RULES);
    expect(cat(dec, fresh[0])).not.toBe("Restauración");
  });
});

describe("vivienda: un papel, no el nombre de un piso", () => {
  it("las reglas de fábrica no llevan nombres propios de activos", () => {
    const nombres = new Set(DEFAULT_RULES.map((r) => r.asset).filter(Boolean));
    expect([...nombres].sort()).toEqual([...nombres].filter((n) => n === VIVIENDA || /^(Coche|Mascota)$/.test(n)).sort());
  });
  it("los recibos van al activo marcado como vivienda, al de tu historial o a «Casa»", () => {
    const f = [mk("RECIBO IBERDROLA CLIENTES", -60, "2026-11-03")];
    const conVivienda = classifyForImport(f, [], DEFAULT_RULES, { vivienda: viviendaPorDefecto([{ name: "Piso Centro", uso: "vivienda" }], []) });
    expect(conVivienda.get(f[0].id).asset).toBe("Piso Centro");
    const hist = [{ ...mk("RECIBO ENDESA", -50, "2026-10-03", "Suministros"), assetName: "Mi Piso" }];
    expect(viviendaPorDefecto([], hist)).toBe("Mi Piso");
    expect(viviendaPorDefecto([], [])).toBe("Casa");
  });
});
