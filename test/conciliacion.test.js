import { describe, it, expect } from "vitest";
import { conciliar } from "../src/App.jsx";

const conn = { aspsp: "CaixaBank" };
let id = 1;
const m = (dia, amount, bs, extra = {}) => ({ id: id++, bankId: "b" + id, file: "CaixaBank", date: new Date(dia + "T12:00:00"), amount, bs, ...extra });

describe("conciliación de saldos", () => {
  it("cuadra aunque dentro del día vengan desordenados", () => {
    const movs = [m("2026-11-01", -10, 990), m("2026-11-02", -5, 980), m("2026-11-02", -5, 985), m("2026-11-03", 100, 1080)];
    expect(conciliar(movs, conn)).toMatchObject({ dias: 3, descuadres: [] });
  });
  it("detecta un movimiento que falta y dice cuánto y desde cuándo", () => {
    // El 02/11 el banco dice 950 tras un cargo de -10, pero el día anterior cerró en 990: faltan 30 €.
    const movs = [m("2026-11-01", -10, 990), m("2026-11-02", -10, 950), m("2026-11-03", -50, 900)];
    expect(conciliar(movs, conn).descuadres).toEqual([{ dia: "2026-11-02", diferencia: -30 }]);
  });
  it("detecta un duplicado", () => {
    const movs = [m("2026-11-01", -10, 990), m("2026-11-02", -20, 970), m("2026-11-02", -20, 970)];
    expect(conciliar(movs, conn).descuadres[0]).toMatchObject({ dia: "2026-11-02", diferencia: 20 });
  });
  it("sin saldos del banco: null", () => {
    expect(conciliar([{ ...m("2026-11-01", -10, 990), bs: undefined }], conn)).toBeNull();
  });
});
