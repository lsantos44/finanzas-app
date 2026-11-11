import { describe, it, expect } from "vitest";
import { classifyForImport, learnedRule, DEFAULT_RULES, deserializeMovs } from "../src/App.jsx";
import { mk } from "./helpers.js";

const cat = (dec, m) => dec.get(m.id).cat;

describe("devoluciones: restan del gasto en vez de contar como ingreso", () => {
  it("con marca de devolución o de tarjeta", () => {
    const f = [
      mk("DEVOLUCION COMPRA TARJ. AMAZON EU SARL", 25.99, "2026-10-03"),
      mk("COMPRA TARJ. AMAZON.ES 1234", 19.5, "2026-10-04"),
      mk("DEVOLUCION RECIBO IBERDROLA CLIENTES", 42.1, "2026-10-05"),
      mk("DEVOLUCION COMPRA TARJ. RESTAURANTE CASA PEPE", 30, "2026-10-06"),
    ];
    const dec = classifyForImport(f, [], DEFAULT_RULES);
    expect(f.map((m) => cat(dec, m))).toEqual(["Compras", "Compras", "Suministros", "Restauración"]);
  });

  it("sin marca, de un comercio conocido o por transferencia de una empresa conocida", () => {
    const f = [mk("AMAZON EU SARL", 25.99, "2026-11-01"), mk("ENDESA ENERGIA SAU", 12, "2026-11-02"), mk("TRANSFERENCIA DE IBERDROLA CLIENTES SAU", 40, "2026-11-03")];
    const dec = classifyForImport(f, [], DEFAULT_RULES);
    expect(f.map((m) => cat(dec, m))).toEqual(["Compras", "Suministros", "Suministros"]);
  });

  it("siguen siendo ingreso: nómina, alquiler, intereses, Hacienda, ayudas, personas, Bizum", () => {
    const f = [
      mk("NOMINA ACME SL", 2100, "2026-10-28"), mk("TRANSFERENCIA RECIBIDA PEREZ ALQUILER PISO", 700, "2026-10-01"),
      mk("INTERESES CUENTA", 3, "2026-10-30"), mk("DEVOLUCION HACIENDA IRPF", 600, "2026-10-12"),
      mk("AYUDA ALQUILER JOVEN", 250, "2026-10-10"), mk("TRANSFERENCIA DE JUAN GARCIA", 50, "2026-10-03"), mk("BIZUM DE ANA", 20, "2026-10-03"),
    ];
    const dec = classifyForImport(f, [], DEFAULT_RULES);
    expect(f.map((m) => cat(dec, m))).toEqual(["Nómina y pensión", "Alquileres cobrados", "Inversiones", "Devoluciones y ayudas", "Devoluciones y ayudas", "Otros ingresos", "Bizum"]);
  });

  it("mismo concepto que un cargo ya clasificado: va a esa categoría, salvo si supera lo cargado", () => {
    const hist = [mk("COMPRA TARJ. TIENDA RARA ONLINE 4411", -59.9, "2026-11-01", "Ropa"), mk("RECIBO COOPERATIVA ELECTRICA DEL VALLE", -48, "2026-11-03", "Suministros")];
    const f = [mk("COMPRA TARJ. TIENDA RARA ONLINE 4411", 59.9, "2026-11-10"), mk("RECIBO COOPERATIVA ELECTRICA DEL VALLE", 12.5, "2026-11-11"), mk("RECIBO COOPERATIVA ELECTRICA DEL VALLE", 400, "2026-11-11")];
    const dec = classifyForImport(f, hist, DEFAULT_RULES);
    expect(f.map((m) => cat(dec, m))).toEqual(["Ropa", "Suministros", "Otros ingresos"]);
  });

  it("corregir una devolución enseña para la siguiente sin romper la regla de los cargos", () => {
    const prev = mk("ACME SUMINISTROS DEL SUR", 33, "2026-11-01", "Suministros");
    const nr = learnedRule(prev, "Suministros");
    expect(nr.sign).toBe("+");
    const cargos = { k: prev.pattern, cat: "Suministros", prio: 95, scope: "personal" };
    const f = [mk("ACME SUMINISTROS DEL SUR", 21, "2026-11-20"), mk("ACME SUMINISTROS DEL SUR", -60, "2026-11-20")];
    const dec = classifyForImport(f, [prev], [nr, cargos, ...DEFAULT_RULES]);
    expect(f.map((m) => cat(dec, m))).toEqual(["Suministros", "Suministros"]);
  });

  it("migración al cargar: una sola vez por movimiento", () => {
    const raw = (dv) => JSON.stringify({ v: 1, movs: [{ id: 1, concept: "DEVOLUCION COMPRA TARJ. AMAZON EU SARL", pattern: "DEVOLUCION COMPRA TARJ AMAZON EU SARL", amount: 25.99, date: "2026-10-03T00:00:00Z", category: "Devoluciones y ayudas", ...(dv ? { dv } : {}) }] });
    expect(deserializeMovs(raw())[0].category).toBe("Compras");
    expect(deserializeMovs(raw(2))[0].category).toBe("Devoluciones y ayudas"); // ya revisado: se respeta
  });
});

describe("hipoteca: categoría propia", () => {
  it("las cuotas nuevas van a «Hipoteca y préstamos» y las guardadas como Vivienda se migran", () => {
    const f = [mk("RECIBO CUOTA HIPOTECA 1234", -650, "2026-11-01")];
    expect(classifyForImport(f, [], DEFAULT_RULES).get(f[0].id).cat).toBe("Hipoteca y préstamos");
    const raw = JSON.stringify({ v: 1, movs: [
      { id: 1, concept: "PRESTAMO HIPOTECARIO", pattern: "PRESTAMO HIPOTECARIO", amount: -650, date: "2026-10-01T12:00:00Z", category: "Vivienda" },
      { id: 2, concept: "COMUNIDAD PROPIETARIOS", pattern: "COMUNIDAD PROPIETARIOS", amount: -60, date: "2026-10-01T12:00:00Z", category: "Vivienda" },
    ] });
    expect(deserializeMovs(raw).map((m) => m.category)).toEqual(["Hipoteca y préstamos", "Vivienda"]);
  });
});
