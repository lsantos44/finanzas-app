import { describe, it, expect } from "vitest";
import { analizarInversiones, aportacionesDe, cierreEn, precioEUR, unidadesBase, normalizarPosiciones, simbolosDe } from "../src/inversiones.js";

const datos = {
  series: {
    "TEF.MC": [["2026-11-20", 3.5], ["2026-11-23", 3.4], ["2026-11-24", 3.404]],
    COHR: [["2026-11-20", 200], ["2026-11-24", 196.24]],
    "EURUSD=X": [["2026-11-20", 1.1], ["2026-11-24", 1.0964]],
    F1: [["2026-11-20", 10], ["2026-11-23", 10], ["2026-11-24", 11], ["2026-11-27", 12]],
    F2: [["2026-11-20", 20], ["2026-11-23", 20], ["2026-11-24", 20], ["2026-11-27", 20]],
  },
  meta: { "TEF.MC": { divisa: "EUR" }, COHR: { divisa: "USD" }, F1: { divisa: "EUR" }, F2: { divisa: "EUR" } },
};

describe("precios", () => {
  it("toma el último cierre en esa fecha o antes", () => {
    expect(cierreEn(datos.series["TEF.MC"], "2026-11-22")).toBe(3.5);
    expect(cierreEn(datos.series["TEF.MC"], "2026-11-19")).toBeNull();
  });
  it("pasa los dólares a euros con el cambio del día", () => {
    expect(precioEUR({ simbolo: "COHR" }, "2026-11-24", datos)).toBeCloseTo(196.24 / 1.0964, 6);
  });
  it("si solo se sabe el valor, deduce las participaciones con el precio del día de alta", () => {
    expect(unidadesBase({ simbolo: "F1", valorAlta: 1100, alta: "2026-11-24" }, datos)).toBeCloseTo(100, 6);
  });
});

describe("cartera", () => {
  const inv = {
    posiciones: [
      { id: "tef", nombre: "Telefónica", entidad: "Plan de empleados", tipo: "accion", simbolo: "TEF.MC", participaciones: 1000, coste: null, alta: "2026-11-24" },
      { id: "cohr", nombre: "Coherent", entidad: "Bróker", tipo: "accion", simbolo: "COHR", participaciones: 5, coste: 1000, alta: "2026-11-24" },
    ],
  };
  const r = analizarInversiones(inv, datos, []);
  it("valora cada posición y el total", () => {
    expect(r.filas[0].valor).toBeCloseTo(3404, 6);
    expect(r.filas[1].valor).toBeCloseTo((5 * 196.24) / 1.0964, 6);
    expect(r.total).toBeCloseTo(r.filas[0].valor + r.filas[1].valor, 6);
  });
  it("sin coste no inventa resultado; con coste, sí", () => {
    expect(r.filas[0].resultado).toBeNull();
    expect(r.filas[1].resultado).toBeCloseTo((5 * 196.24) / 1.0964 - 1000, 6);
    expect(r.sinCoste).toBe(1);
  });
  it("cambio del día por posición y agrupado por entidad", () => {
    expect(r.filas[0].hoy).toBeCloseTo(1000 * 0.004, 6);
    expect(r.porEntidad.map((g) => g.nombre)).toEqual(["Plan de empleados", "Bróker"]);
  });
  it("símbolos a seguir sin repetir", () => {
    expect(simbolosDe({ posiciones: [...inv.posiciones, { simbolo: "COHR" }] })).toEqual(["TEF.MC", "COHR"]);
  });
});

describe("aportaciones a la cartera automatizada", () => {
  const inv = {
    posiciones: [
      { id: "a", nombre: "Fondo A", entidad: "Roboadvisor", tipo: "fondo", simbolo: "F1", valorAlta: 1100, coste: 1000, alta: "2026-11-24", robo: true, pesoObjetivo: 75 },
      { id: "b", nombre: "Fondo B", entidad: "Roboadvisor", tipo: "fondo", simbolo: "F2", valorAlta: 400, coste: 400, alta: "2026-11-24", robo: true, pesoObjetivo: 25 },
    ],
    aportacion: { patron: "TRANSF PERIODICA", importe: 500, desde: "2026-11-24" },
  };
  const movs = [
    { id: 1, date: new Date("2026-11-25T12:00:00"), pattern: "TRANSF PERIODICA", amount: -500 },
    { id: 2, date: new Date("2026-11-25T12:00:00"), pattern: "TRANSF PERIODICA", amount: -85 }, // el garaje: no
    { id: 3, date: new Date("2026-11-10T12:00:00"), pattern: "TRANSF PERIODICA", amount: -500 }, // ya incluido en el alta
  ];
  it("solo cuenta las transferencias de ese importe posteriores al alta", () => {
    expect(aportacionesDe(movs, inv.aportacion)).toEqual([{ fecha: "2026-11-25", importe: 500 }]);
  });
  it("reparte cada aportación según los pesos objetivo, al precio de dos días después", () => {
    const r = analizarInversiones(inv, datos, movs);
    const [a, b] = r.filas;
    expect(a.unidades).toBeCloseTo(100 + 375 / 12, 6);
    expect(b.unidades).toBeCloseTo(20 + 125 / 20, 6);
    expect(a.coste).toBeCloseTo(1375, 6);
    expect(r.serie.at(-1).invertido).toBeCloseTo(1900, 6);
  });
});

describe("importar posiciones", () => {
  it("normaliza y valida", () => {
    const [p] = normalizarPosiciones([{ nombre: "ASML", entidad: "Bróker", tipo: "accion", simbolo: "ASML.AS", participaciones: "2", coste: "1.234,50" }], "2026-11-24");
    expect(p).toMatchObject({ nombre: "ASML", tipo: "accion", participaciones: 2, coste: 1234.5, alta: "2026-11-24" });
    expect(() => normalizarPosiciones([{ nombre: "X" }], "2026-11-24")).toThrow(/participaciones o valor/);
  });
});

describe("evolución", () => {
  it("un producto con un solo precio no deja el gráfico vacío, y se desglosa por entidad", () => {
    const d = { series: { ...datos.series, SOLO: [["2026-11-24", 50]] }, meta: { ...datos.meta, SOLO: { divisa: "EUR" } } };
    const inv = { posiciones: [
      { id: "x", nombre: "Con historia", entidad: "Uno", tipo: "accion", simbolo: "TEF.MC", participaciones: 10, coste: 30, alta: "2026-11-24" },
      { id: "y", nombre: "Un solo dato", entidad: "Dos", tipo: "fondo", simbolo: "SOLO", participaciones: 2, coste: 100, alta: "2026-11-24" },
    ] };
    const r = analizarInversiones(inv, d, []);
    expect(r.serie.map((p) => p.d)).toEqual(["2026-11-20", "2026-11-23", "2026-11-24"]);
    expect(r.serie[0].porEntidad).toEqual({ Uno: 35, Dos: 100 });
    expect(r.serie.at(-1).valor).toBeCloseTo(34.04 + 100, 6);
  });
});
