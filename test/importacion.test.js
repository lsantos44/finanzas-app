import { describe, it, expect } from "vitest";
import { parseEsNumber, parseDateAny, detectDelimiter, tokenizeCSV, analyzeRows, buildMovements } from "../src/core.js";

describe("importes y fechas", () => {
  it("números en formato español y signos", () => {
    expect(parseEsNumber("1.234,56")).toBe(1234.56);
    expect(parseEsNumber("-85,00")).toBe(-85);
    expect(parseEsNumber("−85,00")).toBe(-85); // signo menos unicode
    expect(parseEsNumber("12.5")).toBe(12.5);
  });
  it("fechas dd/mm/aaaa", () => {
    const d = parseDateAny("03/11/2026");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 3]);
    expect(parseDateAny("31/02/2026")).toBeNull();
  });
});

describe("CSV de banco", () => {
  const csv = "Fecha;Concepto;Importe;Saldo\n03/11/2026;COMPRA TARJ. MERCADONA;-40,10;1.159,90\n04/11/2026;NOMINA ACME;2.100,00;3.259,90\n";
  it("detecta columnas y construye movimientos con signo", () => {
    const rows = tokenizeCSV(csv, detectDelimiter(csv));
    const a = analyzeRows(rows);
    const { movs } = buildMovements(rows, a.dataStart, a.cols, "test.csv");
    expect(movs.map((m) => m.amount)).toEqual([-40.1, 2100]);
  });
  it("columnas separadas de cargo y abono", () => {
    const t = "Fecha;Concepto;Cargo;Abono\n03/11/2026;RECIBO LUZ;55,20;\n04/11/2026;NOMINA;;2.000,00\n";
    const rows = tokenizeCSV(t, detectDelimiter(t));
    const a = analyzeRows(rows);
    const { movs } = buildMovements(rows, a.dataStart, a.cols, "t.csv");
    expect(movs.map((m) => m.amount)).toEqual([-55.2, 2000]);
  });
  it("columna de signo D/H", () => {
    const t = "Fecha;Concepto;Importe;D/H\n03/11/2026;RECIBO LUZ;55,20;D\n04/11/2026;NOMINA;2.000,00;H\n05/11/2026;CAFE;2,00;D\n";
    const rows = tokenizeCSV(t, detectDelimiter(t));
    const a = analyzeRows(rows);
    const { movs } = buildMovements(rows, a.dataStart, a.cols, "t.csv");
    expect(movs.map((m) => m.amount)).toEqual([-55.2, 2000, -2]);
  });
});
