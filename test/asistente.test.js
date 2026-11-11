import { describe, it, expect } from "vitest";
import { runQuery } from "../src/App.jsx";

const D = (s) => new Date(s + "T12:00:00");
const mov = (id, concept, amount, date, category, extra = {}) => ({ id, concept, pattern: concept, amount, date: D(date), category, confirmed: true, ...extra });
const ctx = (movs) => ({ movs, assets: [{ name: "Coche", categories: ["Combustible"] }], groups: [], budgets: {} });

describe("el asistente cuenta igual que la app", () => {
  const movs = [
    mov(1, "MERCADONA", -100, "2026-10-02", "Supermercado"),
    mov(2, "AMAZON", -50, "2026-10-03", "Compras"),
    mov(3, "AMAZON", 20, "2026-10-08", "Compras"), // devolución: resta del gasto
    mov(4, "NOMINA", 2000, "2026-10-28", "Nómina y pensión"),
    mov(5, "MYINVESTOR", -500, "2026-10-05", "Ahorro e inversión"), // traspaso: ni gasto ni ingreso
    mov(6, "HERENCIA", 10000, "2026-10-10", "Otros ingresos", { extra: true }), // extraordinario: fuera
    mov(7, "REPSOL", -60, "2026-10-12", null, { splits: [{ cat: "Combustible", pct: 50 }, { cat: "Supermercado", pct: 50 }] }),
  ];
  it("totales: devoluciones restan, traspasos y extraordinarios no cuentan", () => {
    const { total } = runQuery(ctx(movs), {});
    expect(total.gasto).toBe(190); // 100 + 50 - 20 (devolución) + 60 (Repsol, repartido)
    expect(total.ingreso).toBe(2000);
    expect(total.traspasos_internos).toBe(500);
  });
  it("filtrar por categoría suma solo su parte de un reparto", () => {
    expect(runQuery(ctx(movs), { categorias: ["Combustible"] }).total.gasto).toBe(30);
    expect(runQuery(ctx(movs), { categorias: ["Compras"] }).total.gasto).toBe(30);
  });
  it("agrupar por categoría da las mismas cifras", () => {
    const filas = Object.fromEntries(runQuery(ctx(movs), { agrupar_por: "categoria" }).resultado.map((f) => [f.clave, f.gasto]));
    expect(filas).toMatchObject({ Supermercado: 130, Compras: 30, Combustible: 30 });
    expect(filas["Ahorro e inversión"]).toBeUndefined();
  });
  it("con incluir_extraordinarios sí cuenta la herencia", () => {
    expect(runQuery(ctx(movs), { incluir_extraordinarios: true }).total.ingreso).toBe(12000);
  });
});
