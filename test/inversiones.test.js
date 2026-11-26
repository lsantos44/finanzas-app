import { describe, it, expect } from "vitest";
import { analizarInversiones, curvaDe, curvaReferencia, destacadosPeriodo, indiceEn, resultadoPeriodo, aportacionesDe, cierreEn, precioEUR, unidadesBase, normalizarPosiciones, simbolosDe } from "../src/inversiones.js";

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
      { id: "x", nombre: "Con historia", entidad: "Uno", tipo: "accion", simbolo: "TEF.MC", participaciones: 10, coste: 30, alta: "2026-11-24", compra: "2026-11-20" },
      { id: "y", nombre: "Un solo dato", entidad: "Dos", tipo: "fondo", simbolo: "SOLO", participaciones: 2, coste: 100, alta: "2026-11-24", compra: "2026-11-23" },
    ] };
    const r = analizarInversiones(inv, d, []);
    expect(r.serie.map((p) => p.d)).toEqual(["2026-11-20", "2026-11-23", "2026-11-24"]);
    // Antes de comprarlo, un producto no está en tu cartera.
    expect(r.serie[0].porEntidad).toEqual({ Uno: 35, Dos: 0 });
    expect(r.serie[1].porEntidad.Dos).toBe(100);
    expect(r.serie.at(-1).valor).toBeCloseTo(34.04 + 100, 6);
  });
});

import { fusionarPosiciones } from "../src/inversiones.js";
describe("actualizar con una lista", () => {
  it("sustituye lo que coincide por ISIN o nombre, conserva su identidad y añade lo nuevo", () => {
    const antes = [
      { id: "a", nombre: "Fondo Uno", entidad: "Banco", tipo: "fondo", valorAlta: 1000, alta: "2026-11-24" },
      { id: "b", nombre: "Fondo Dos", entidad: "Banco", tipo: "fondo", isin: "XX0000000001", valorAlta: 500, alta: "2026-11-24", robo: true, pesoObjetivo: 50 },
    ];
    const nuevas = normalizarPosiciones([
      { nombre: "fondo uno", entidad: "Banco", tipo: "fondo", isin: "XX0000000002", simbolo: "0PUNO.F", participaciones: 10, coste: 900, revisado: true },
      { nombre: "Otro nombre", entidad: "Banco", tipo: "fondo", isin: "XX0000000001", participaciones: 5, coste: 450 },
      { nombre: "Fondo Tres", entidad: "Banco", tipo: "fondo", participaciones: 1, coste: 10 },
    ], "2026-11-26");
    const r = fusionarPosiciones(antes, nuevas);
    expect(r).toMatchObject({ actualizadas: 2, añadidas: 1 });
    expect(r.posiciones[0]).toMatchObject({ id: "a", simbolo: "0PUNO.F", participaciones: 10, coste: 900, revisado: true });
    expect(r.posiciones[0].valorAlta).toBeUndefined();
    expect(r.posiciones[1]).toMatchObject({ id: "b", participaciones: 5, robo: true, pesoObjetivo: 50 });
    expect(r.posiciones).toHaveLength(3);
  });
});

import { rentabilidadTWR } from "../src/inversiones.js";
describe("rentabilidad de un periodo (ponderada por tiempo)", () => {
  it("una aportación no cuenta como ganancia", () => {
    // 1.000 € que suben un 10 %, luego entran 500 € y el conjunto sube otro 10 %.
    const serie = [
      { d: "2026-01-01", valor: 1000, flujo: 0 },
      { d: "2026-02-01", valor: 1100, flujo: 0 },
      { d: "2026-02-02", valor: 1600, flujo: 500 },
      { d: "2026-03-01", valor: 1760, flujo: 0 },
    ];
    expect(rentabilidadTWR(serie).r).toBeCloseTo(0.21, 10); // 1,1 × 1,1 − 1, no 1760/1000 − 1
    expect(rentabilidadTWR(serie, { desde: "2026-02-01" }).r).toBeCloseTo(0.1, 10);
  });
  it("el coste se puede dar como coste medio por participación, como en las entidades", () => {
    const [p] = normalizarPosiciones([{ nombre: "F", tipo: "fondo", participaciones: 1234.567, costeMedio: "12,3456" }], "2026-11-26");
    expect(p.coste).toBeCloseTo(15241.47, 2);
  });
});

describe("números como los muestran las entidades", () => {
  it("entiende coma decimal, punto decimal y punto de millar", () => {
    const leer = (v) => normalizarPosiciones([{ nombre: "F", tipo: "fondo", participaciones: v }], "2026-11-26")[0].participaciones;
    expect(leer("1.234,567")).toBeCloseTo(1234.567, 6);
    expect(leer("45,6789")).toBeCloseTo(45.6789, 6);
    expect(leer("12.3456")).toBeCloseTo(12.3456, 6);
    expect(leer("1234.5600")).toBeCloseTo(1234.56, 6);
    expect(leer("2.500")).toBe(2500);
    expect(leer("1.234.567,5")).toBeCloseTo(1234567.5, 6);
  });
});

describe("recalibrar la cartera automatizada", () => {
  it("las aportaciones anteriores a los datos de un fondo no se suman dos veces", () => {
    const inv = {
      posiciones: [
        // Recalibrado el 27/11 con los datos de la entidad (ya incluye lo comprado el 27).
        { id: "a", nombre: "Fondo A", entidad: "Roboadvisor", tipo: "fondo", simbolo: "F1", participaciones: 131.25, coste: 1375, alta: "2026-11-27", robo: true, pesoObjetivo: 75 },
        // Sin recalibrar: sigue recibiendo su parte.
        { id: "b", nombre: "Fondo B", entidad: "Roboadvisor", tipo: "fondo", simbolo: "F2", valorAlta: 400, coste: 400, alta: "2026-11-24", robo: true, pesoObjetivo: 25 },
      ],
      aportacion: { patron: "TRANSF PERIODICA", importe: 500, desde: "2026-11-24" },
    };
    const movs = [{ id: 1, date: new Date("2026-11-25T12:00:00"), pattern: "TRANSF PERIODICA", amount: -500 }];
    const r = analizarInversiones(inv, datos, movs);
    expect(r.filas[0].unidades).toBeCloseTo(131.25, 6);
    expect(r.filas[0].coste).toBeCloseTo(1375, 6);
    expect(r.filas[1].unidades).toBeCloseTo(20 + 125 / 20, 6);
  });
});

import { posicionesDeCapturas } from "../src/inversiones.js";
describe("posiciones leídas de capturas", () => {
  it("convierte lo leído en posiciones revisables, con coste en euros y sin inventar", () => {
    const leido = { entidad: "Mi bróker", posiciones: [
      { nombre: "Acción Uno", ticker: "uno", tipo: "accion", participaciones: "7", coste: "1.234,56", valor: "1.000,00", costeMedio: "200,5" },
      { nombre: "Fondo Dos", isin: "IE00TEST0001", participaciones: "12,5", costeMedio: "10.5" },
      { nombre: "Fondo Tres", valor: "2.000" },
      { nombre: "Sin datos" },
    ] };
    const r = posicionesDeCapturas(leido, "", "2026-11-26");
    expect(r[0].p).toMatchObject({ nombre: "Acción Uno", entidad: "Mi bróker", tipo: "accion", ticker: "UNO", participaciones: 7, coste: 1234.56 });
    expect(r[1].p).toMatchObject({ tipo: "fondo", isin: "IE00TEST0001", participaciones: 12.5, coste: 131.25 });
    expect(r[2].p).toMatchObject({ valorAlta: 2000, coste: null });
    expect(r[3]).toMatchObject({ p: null, incluir: false });
    expect(r[3].error).toMatch(/participaciones o valor/);
  });
});

describe("actualizar sin duplicar lo que se llama distinto", () => {
  it("reconoce el mismo valor por ticker o por nombre más largo en la misma plataforma, y conserva su cotización", () => {
    const antes = [
      { id: "s", nombre: "Acme", entidad: "Bróker", tipo: "accion", simbolo: "ACM.PA", participaciones: 10, coste: 100, alta: "2026-11-24", revisado: true },
      { id: "v", nombre: "Vértice", entidad: "Bróker", tipo: "accion", simbolo: "VTX", participaciones: 2, coste: 50, alta: "2026-11-24" },
      { id: "o", nombre: "Acme", entidad: "Otro banco", tipo: "accion", simbolo: "ACM", participaciones: 1, coste: 9, alta: "2026-11-24" },
    ];
    const nuevas = normalizarPosiciones([
      { nombre: "Acme SA", entidad: "Bróker", tipo: "accion", ticker: "ACM", participaciones: 12, coste: 130 },
      { nombre: "Vertice Holdings Class A", entidad: "Bróker", tipo: "accion", ticker: "VTX", participaciones: 3, coste: 80 },
    ], "2026-11-27");
    const r = fusionarPosiciones(antes, nuevas);
    expect(r).toMatchObject({ actualizadas: 2, añadidas: 0 });
    expect(r.posiciones[0]).toMatchObject({ id: "s", nombre: "Acme", simbolo: "ACM.PA", revisado: true, participaciones: 12, coste: 130 });
    expect(r.posiciones[1]).toMatchObject({ id: "v", nombre: "Vértice", simbolo: "VTX", participaciones: 3 });
    expect(r.posiciones[2]).toMatchObject({ id: "o", participaciones: 1 });
  });
});

describe("desde que entraste", () => {
  it("una posición cuenta desde su compra, con lo invertido desde ese día", () => {
    const inv = { posiciones: [{ id: "x", nombre: "Acción", entidad: "Uno", tipo: "accion", simbolo: "TEF.MC", participaciones: 10, coste: 35, alta: "2026-11-24", compra: "2026-11-23" }] };
    const r = analizarInversiones(inv, datos, []);
    expect(r.serie[0].d).toBe("2026-11-23");
    expect(r.serie.map((p) => p.invertido)).toEqual([35, 35]);
    expect(r.filas[0]).toMatchObject({ entrada: "2026-11-23", compraConocida: true });
  });
  it("sin fecha de compra, se da por hecho que lo tenías desde antes, con lo de hoy", () => {
    const inv = { posiciones: [{ id: "x", nombre: "Acción", entidad: "Uno", tipo: "accion", simbolo: "TEF.MC", participaciones: 10, coste: 35, alta: "2026-11-24" }] };
    const r = analizarInversiones(inv, datos, []);
    expect(r.serie.map((p) => p.d)).toEqual(["2026-11-20", "2026-11-23", "2026-11-24"]);
    expect(r.serie[0].porPos.x).toBeCloseTo(35, 6);
    expect(r.filas[0].compraConocida).toBe(false);
  });
  it("la cartera automatizada se reconstruye con las transferencias anteriores y cuadra con tus datos", () => {
    const inv = {
      posiciones: [
        { id: "a", nombre: "Fondo A", entidad: "Robo", tipo: "fondo", simbolo: "F1", participaciones: 150, coste: 1500, alta: "2026-11-27", robo: true, pesoObjetivo: 50 },
        { id: "b", nombre: "Fondo B", entidad: "Robo", tipo: "fondo", simbolo: "F2", participaciones: 60, coste: 1200, alta: "2026-11-27", robo: true, pesoObjetivo: 50 },
      ],
      aportacion: { patron: "TRANSF ROBO", importe: 500, desde: "2026-11-27" },
    };
    const movs = [
      { id: 1, date: new Date("2026-11-18T12:00:00"), pattern: "TRANSF ROBO", amount: -500 },
      { id: 2, date: new Date("2026-11-21T12:00:00"), pattern: "TRANSF ROBO", amount: -500 },
    ];
    const r = analizarInversiones(inv, datos, movs);
    // Hoy coincide exactamente con tus datos…
    expect(r.filas[0]).toMatchObject({ unidades: 150, coste: 1500 });
    expect(r.filas[1].unidades).toBeCloseTo(60, 9);
    expect(r.filas[0].entrada).toBe("2026-11-20");
    // …y antes iba creciendo con cada transferencia.
    const inv20 = r.serie.find((p) => p.d === "2026-11-20").invPos.a, inv23 = r.serie.find((p) => p.d === "2026-11-23").invPos.a;
    expect(inv20).toBeGreaterThan(0);
    expect(inv23).toBeCloseTo(1500, 6);
    expect(inv20).toBeLessThan(inv23);
  });
});

import { actualizarCampos, leerFecha } from "../src/inversiones.js";
describe("actualizar solo algunos datos", () => {
  it("pone la fecha de compra sin tocar participaciones ni coste, y avisa de lo que no encuentra", () => {
    const antes = [
      { id: "a", nombre: "Fondo Uno", entidad: "Banco", tipo: "fondo", isin: "XX0000000001", participaciones: 10, coste: 100, alta: "2026-11-24" },
      { id: "b", nombre: "Fondo Dos", entidad: "Banco", tipo: "fondo", participaciones: 5, coste: 50, alta: "2026-11-24" },
    ];
    const r = actualizarCampos(antes, [
      { isin: "XX0000000001", compra: "09/03/2026" },
      { nombre: "Fondo Dos", compra: "2026-04-21", costeMedio: "11,5" },
      { nombre: "No existe", compra: "2026-01-01" },
    ]);
    expect(r.actualizadas).toBe(2);
    expect(r.sinEncontrar).toEqual(["No existe"]);
    expect(r.posiciones[0]).toMatchObject({ compra: "2026-03-09", participaciones: 10, coste: 100, alta: "2026-11-24" });
    expect(r.posiciones[1]).toMatchObject({ compra: "2026-04-21", coste: 57.5 });
  });
  it("entiende las fechas como se escriben", () => {
    expect(leerFecha("09/03/2026")).toBe("2026-03-09");
    expect(leerFecha("1-7-2026")).toBe("2026-07-01");
    expect(leerFecha("julio")).toBeNull();
  });
});

describe("ganas/pierdes en el tiempo", () => {
  it("el último punto coincide con la plusvalía: los productos sin coste no cuentan", () => {
    const inv = { posiciones: [
      { id: "x", nombre: "Con coste", entidad: "Uno", tipo: "accion", simbolo: "TEF.MC", participaciones: 10, coste: 30, alta: "2026-11-24", compra: "2026-11-20" },
      { id: "y", nombre: "Sin coste", entidad: "Uno", tipo: "accion", simbolo: "COHR", participaciones: 5, coste: null, alta: "2026-11-24", compra: "2026-11-20" },
    ] };
    const r = analizarInversiones(inv, datos, []);
    const u = r.serie[r.serie.length - 1];
    expect(u.valorCC / u.invertido - 1).toBeCloseTo(r.resultadoPct, 10);
    expect(u.ccEntidad.Uno / u.invEntidad.Uno - 1).toBeCloseTo(r.porEntidad[0].resultadoPct, 10);
  });
});

describe("resultado de un periodo, qué lo explica y frente al mercado (datos inventados)", () => {
  const d = {
    series: {
      A: [["2026-01-02", 10], ["2026-02-02", 10], ["2026-03-02", 12], ["2026-04-01", 11]],
      B: [["2026-01-02", 50], ["2026-02-02", 50], ["2026-03-02", 45], ["2026-04-01", 55]],
      IDX: [["2026-01-02", 100], ["2026-02-02", 100], ["2026-03-02", 110], ["2026-04-01", 120]],
    },
    meta: { A: { divisa: "EUR" }, B: { divisa: "EUR" }, IDX: { divisa: "EUR" } },
  };
  const inv = { posiciones: [
    { id: "a", nombre: "Fondo A", entidad: "X", tipo: "fondo", simbolo: "A", participaciones: 100, coste: 1000, alta: "2026-04-01", compra: "2026-01-02" },
    { id: "b", nombre: "Acción B", entidad: "Y", tipo: "accion", simbolo: "B", participaciones: 20, coste: 1000, alta: "2026-04-01", compra: "2026-02-02" },
  ] };
  const r = analizarInversiones(inv, d, []);
  const curva = curvaDe(r.serie, ["a", "b"]);

  it("con «Todo» es la plusvalía: valor − invertido", () => {
    const t = resultadoPeriodo(curva, -1);
    expect(t.ganancia).toBeCloseTo(100 * 11 + 20 * 55 - 2000, 6);
    expect(t.pct).toBeCloseTo((1100 + 1100) / 2000 - 1, 6);
  });
  it("en un periodo descuenta el dinero que entró (la compra de B no es ganancia)", () => {
    const i0 = indiceEn(r.serie, "2026-01-31"); // empieza el 2 de enero
    const t = resultadoPeriodo(curva, i0);
    // A: de 1000 a 1100 (+100). B: compró 1000 € y vale 1100 (+100).
    expect(t.ganancia).toBeCloseTo(200, 6);
    const i1 = indiceEn(r.serie, "2026-03-02");
    const u = resultadoPeriodo(curva, i1); // del 2 mar al 1 abr: A −100, B +200
    expect(u.ganancia).toBeCloseTo(100, 6);
    expect(u.pct).toBeCloseTo(100 / (1200 + 900), 6);
  });
  it("lo de cada producto suma el total", () => {
    const i0 = indiceEn(r.serie, "2026-03-02");
    const ga = resultadoPeriodo(curvaDe(r.serie, ["a"]), i0).ganancia, gb = resultadoPeriodo(curvaDe(r.serie, ["b"]), i0).ganancia;
    expect(ga).toBeCloseTo(-100, 6); expect(gb).toBeCloseTo(200, 6);
    expect(ga + gb).toBeCloseTo(resultadoPeriodo(curva, i0).ganancia, 6);
  });
  it("frente al índice: el mismo dinero, los mismos días", () => {
    const ref = curvaReferencia(r.serie, ["a", "b"], r.contribuciones, d, "IDX");
    const t = resultadoPeriodo(ref, -1);
    // 1000 € el 2 ene a 100 (10 u) y 1000 € el 2 feb a 100 (10 u): 20 u × 120 = 2400.
    expect(t.ganancia).toBeCloseTo(400, 6);
    expect(curvaReferencia(r.serie, ["a"], r.contribuciones, d, "NO")).toBeNull();
  });
  it("lo destacable: el máximo alcanzado y el mejor y peor día", () => {
    const res = resultadoPeriodo(curva, -1);
    const x = destacadosPeriodo(r.serie, -1, res);
    expect(x.max.d).toBe("2026-04-01");
    expect(x.mejor.g).toBeCloseTo(100, 6); // +100 el 2 mar y +100 el 1 abr
    expect(x.peor.g).toBeCloseTo(0, 6); // el día que entró B no se ganó ni perdió
  });
});

describe("sin fecha de compra: en «Todo» la plusvalía; en un periodo, lo que se movió el precio", () => {
  const d = { series: { A: [["2026-01-02", 10], ["2026-02-02", 12], ["2026-03-02", 12]] }, meta: { A: { divisa: "EUR" } } };
  const inv = { posiciones: [{ id: "a", nombre: "A", entidad: "X", tipo: "fondo", simbolo: "A", participaciones: 100, coste: 900, alta: "2026-02-02" }] };
  const r = analizarInversiones(inv, d, []);
  it("en «Todo» es la plusvalía; en un periodo, participaciones × lo que se movió el precio", () => {
    expect(resultadoPeriodo(curvaDe(r.serie, ["a"], true), -1).ganancia).toBeCloseTo(300, 6);
    expect(resultadoPeriodo(curvaDe(r.serie, ["a"], false), indiceEn(r.serie, "2026-01-31")).ganancia).toBeCloseTo(200, 6);
    expect(resultadoPeriodo(curvaDe(r.serie, ["a"], false), indiceEn(r.serie, "2026-02-02")).ganancia).toBeCloseTo(0, 6);
  });
});
