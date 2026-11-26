import { describe, it, expect } from "vitest";
import { leerOperaciones, posicionesDeOperaciones, numero, fecha, fifo } from "../src/inversiones-import.js";
import { analizarInversiones, normalizarPosiciones } from "../src/inversiones.js";
import { ventasFIFO, resumenAnual, impuestoAhorro, simularVentas, csvVentas } from "../src/fiscal-inversiones.js";

// Todos los datos son inventados.
const csv = (t) => t.trim().split("\n").map((l) => l.split(";"));

describe("leer números y fechas como los escriben los brókers", () => {
  it("números", () => {
    expect(numero("-1.234,56")).toBeCloseTo(-1234.56);
    expect(numero("1,234.56", false)).toBeCloseTo(1234.56);
    expect(numero("$1,234.56", false)).toBeCloseTo(1234.56);
    expect(numero("USD -12.5", false)).toBeCloseTo(-12.5);
    expect(numero("12,5 €")).toBeCloseTo(12.5);
    expect(numero("1.250")).toBe(1250);
    expect(numero("")).toBeNull();
  });
  it("fechas", () => {
    expect(fecha("16-07-2026")).toBe("2026-07-16");
    expect(fecha("2026-07-16T10:00:00.000Z")).toBe("2026-07-16");
    expect(fecha("16/07/26")).toBe("2026-07-16");
    expect(fecha("hola")).toBeNull();
  });
});

describe("archivo tipo DEGIRO (transacciones)", () => {
  const filas = csv(`
Fecha;Hora;Producto;ISIN;Bolsa de referencia;Centro de ejecución;Número;Precio;;Valor local;;Valor;;Tipo de cambio;Costes de transacción y/o externos;;Total;;ID Orden
03-03-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;10;100,00;USD;-1000,00;USD;-900,00;EUR;1,1111;-2,00;EUR;-902,00;EUR;a1
04-05-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;5;120,00;USD;-600,00;USD;-540,00;EUR;1,1111;-2,00;EUR;-542,00;EUR;a2
10-09-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;-12;130,00;USD;1560,00;USD;1400,00;EUR;1,1143;-2,00;EUR;1398,00;EUR;a3
11-09-2026;10:00;OTRA SA;ES0000000002;MAD;XMAD;20;10,00;EUR;-200,00;EUR;-200,00;EUR;;-1,00;EUR;-201,00;EUR;a4
`);
  const r = leerOperaciones(filas);
  it("reconoce el bróker y cada compra y venta, con el total en euros y comisiones", () => {
    expect(r.broker).toBe("DEGIRO");
    expect(r.operaciones).toHaveLength(4);
    expect(r.operaciones[0]).toMatchObject({ fecha: "2026-03-03", u: 10, importe: 902, divisa: "EUR", comision: 2, isin: "US0000000001" });
    expect(r.operaciones[2]).toMatchObject({ u: -12, importe: 1398 });
  });
  const ps = posicionesDeOperaciones(r.operaciones, "Mi bróker", r.broker);
  it("agrupa por producto: participaciones, coste FIFO y primera compra", () => {
    const acme = ps.find((p) => p.isin === "US0000000001");
    expect(acme.participaciones).toBeCloseTo(3);
    // Quedan 3 de la 2ª compra (5 a 542 €): 3/5 × 542 = 325,20
    expect(acme.coste).toBeCloseTo(325.2, 2);
    expect(acme).toMatchObject({ compra: "2026-03-03", entidad: "Mi bróker", tipo: "accion" });
  });
  it("las ventas dan su ganancia FIFO para la Renta", () => {
    const pos = normalizarPosiciones(ps, "2026-11-26");
    const v = ventasFIFO(pos, { series: {}, meta: {} });
    expect(v).toHaveLength(1);
    // 10 de la 1ª (902) + 2 de la 2ª (2/5 × 542 = 216,80) = 1118,80 → 1398 − 1118,80 = 279,20
    expect(v[0].adquisicion).toBeCloseTo(1118.8, 2);
    expect(v[0].ganancia).toBeCloseTo(279.2, 2);
    const a = resumenAnual(v, 2026);
    expect(a.saldo).toBeCloseTo(279.2, 2);
    expect(a.impuesto).toBeCloseTo(279.2 * 0.19, 2);
    expect(csvVentas(v)).toContain("279,20");
  });
  it("la cartera usa los lotes: valor con lo que queda, ganancia del periodo sin contar lo puesto", () => {
    const pos = normalizarPosiciones(ps, "2026-11-26").map((p, i) => ({ ...p, simbolo: ["ACM", "OTR"][i] }));
    const datos = { series: { ACM: [["2026-03-03", 90], ["2026-09-10", 126], ["2026-11-20", 120]], OTR: [["2026-09-11", 10], ["2026-11-20", 11]] }, meta: { ACM: { divisa: "EUR" }, OTR: { divisa: "EUR" } } };
    const an = analizarInversiones({ posiciones: pos }, datos, []);
    const acme = an.filas.find((f) => f.p.simbolo === "ACM");
    expect(acme.unidades).toBeCloseTo(3);
    expect(acme.valor).toBeCloseTo(360);
    expect(acme.coste).toBeCloseTo(325.2, 2);
    expect(an.serie[0].d).toBe("2026-03-03");
  });
});

describe("archivo tipo Revolut y archivo genérico de fondos", () => {
  it("Revolut: tipos en inglés, importes con símbolo; salta lo que no es compraventa", () => {
    const filas = [
      ["Date", "Ticker", "Type", "Quantity", "Price per share", "Total Amount", "Currency", "FX Rate"],
      ["2026-01-10T15:00:00Z", "", "CASH TOP-UP", "", "", "$500", "USD", "1.1"],
      ["2026-01-11T15:00:00Z", "ACM", "BUY - MARKET", "2", "$100", "$200", "USD", "1.1"],
      ["2026-02-11T15:00:00Z", "ACM", "DIVIDEND", "", "", "$1.5", "USD", "1.1"],
      ["2026-03-11T15:00:00Z", "ACM", "SELL - MARKET", "1", "$120", "$120", "USD", "1.1"],
    ];
    const r = leerOperaciones(filas);
    expect(r.broker).toBe("Revolut");
    expect(r.operaciones.map((o) => o.u)).toEqual([2, -1]);
    expect(r.operaciones[0]).toMatchObject({ importe: 200, divisa: "USD", ticker: "ACM" });
    expect(r.saltadas.length).toBe(2);
  });
  it("gestora en español con traspaso: no tributa y el fondo nuevo hereda el coste", () => {
    const filas = csv(`
Mis órdenes de fondos
Fecha de la orden;Nombre del fondo;ISIN;Tipo de operación;Participaciones;Importe
02/01/2025;Fondo Uno R;ES0000000003;Suscripción;100;1.000,00
02/06/2026;Fondo Uno R;ES0000000003;Traspaso salida;100;1.300,00
03/06/2026;Fondo Dos A;LU0000000004;Traspaso entrada;50;1.300,00
01/10/2026;Fondo Dos A;LU0000000004;Reembolso;50;1.400,00
`);
    const r = leerOperaciones(filas);
    expect(r.operaciones).toHaveLength(4);
    const ps = normalizarPosiciones(posicionesDeOperaciones(r.operaciones, "Gestora", r.broker), "2026-11-26");
    expect(ps.every((p) => p.tipo === "fondo")).toBe(true);
    const v = ventasFIFO(ps, { series: {}, meta: {} });
    // Solo el reembolso tributa, con el coste original (1.000 €) y su fecha de 2025.
    expect(v).toHaveLength(1);
    expect(v[0].adquisicion).toBeCloseTo(1000);
    expect(v[0].ganancia).toBeCloseTo(400);
    expect(v[0].compras).toEqual(["2025-01-02"]);
  });
  it("sin columnas reconocibles, lo dice claro", () => {
    expect(() => leerOperaciones([["a", "b"], ["1", "2"]])).toThrow(/No reconozco las columnas/);
  });
});

describe("Renta: tramos, compensación, regla de los dos meses y simulador", () => {
  it("tramos del ahorro", () => {
    expect(impuestoAhorro(6000)).toBeCloseTo(1140);
    expect(impuestoAhorro(10000)).toBeCloseTo(1140 + 4000 * 0.21);
    expect(impuestoAhorro(-5)).toBe(0);
  });
  it("una pérdida con recompra en dos meses se aplaza; las pérdidas de un año se compensan después", () => {
    const p = { id: "a", nombre: "Acme", entidad: "B", tipo: "accion", ops: [
      { fecha: "2025-01-10", u: 10, importe: 1000 }, { fecha: "2025-06-10", u: -10, importe: 700 },
      { fecha: "2026-01-10", u: 10, importe: 700 }, { fecha: "2026-02-01", u: -5, importe: 300 }, { fecha: "2026-03-01", u: 5, importe: 250 },
      { fecha: "2026-10-01", u: -10, importe: 900 },
    ] };
    const v = ventasFIFO([p], { series: {}, meta: {} });
    expect(v[0].ganancia).toBeCloseTo(-300);
    expect(v[0].diferida).toBeUndefined();
    expect(v[1].ganancia).toBeCloseTo(-50); // vende 5 a 300 que costaron 350
    expect(v[1].diferida).toMatchObject({ fecha: "2026-03-01" });
    const a = resumenAnual(v, 2026);
    // 2026: vende 10 por 900 que costaron 5 × 70 + 5 × 50 = 600 → +300; la pérdida de −50 se
    // aplaza; los −300 de 2025 compensan esa ganancia entera.
    expect(v[2].ganancia).toBeCloseTo(300);
    expect(a.aplazadas).toBeCloseTo(-50);
    expect(a.compensado).toBeCloseTo(300);
    expect(a.base).toBe(0);
    expect(a.aCompensar).toEqual([]);
    expect(resumenAnual(v, 2025).aCompensar).toEqual([{ anio: 2025, queda: 300 }]);
  });
  it("simulador: impuesto si vendieras y pérdidas que compensan lo ganado", () => {
    const filas = [
      { p: { tipo: "accion" }, valor: 1500, coste: 1000 },
      { p: { tipo: "fondo" }, valor: 800, coste: 1000 },
    ];
    const s = simularVentas(filas, 1000);
    expect(s.posiciones[0].impuesto).toBeCloseTo(500 * 0.19);
    expect(s.cosecha[0].compensa).toBeCloseTo(200);
    expect(s.ahorro).toBeCloseTo(200 * 0.19);
  });
});

it("FIFO con ventas de más no inventa coste", () => {
  expect(fifo([{ u: 1, importe: 10 }, { u: -2, importe: 30 }]).vendidoSinCompra).toBeCloseTo(1);
});
