import { describe, it, expect } from "vitest";
import { computeBankSaldo } from "../src/core.js";

const D = (s) => new Date(s + "T12:00:00");
const T = (h) => new Date(`2026-11-11T${h}:00`).getTime();
const conn = { aspsp: "CaixaBank", balance: 1200, balanceAt: "2026-11-11", balanceBooked: 1210, balanceBookedAt: "2026-11-10", balanceRead: T("09:00") };
const manual = { bankId: "m", file: "CaixaBank", date: D("2026-11-11"), amount: -10, bs: 1210, at: T("08:59") };

describe("saldo al día", () => {
  it("sin movimientos nuevos: el saldo leído", () => {
    expect(computeBankSaldo([conn], [manual])).toMatchObject({ amount: 1200, estimado: false });
  });
  it("movimiento del mismo día llegado después: su saldo", () => {
    const tarde = { bankId: "t", file: "CaixaBank", date: D("2026-11-11"), amount: -40, bs: 1160, at: T("15:00") };
    expect(computeBankSaldo([conn], [manual, tarde])).toMatchObject({ amount: 1160, estimado: false });
  });
  it("sin saldo en el movimiento: contable + movimientos posteriores", () => {
    const sig = { bankId: "n", file: "CaixaBank", date: D("2026-11-12"), amount: -40, at: T("23:00") + 86400000 };
    expect(computeBankSaldo([conn], [manual, sig])).toMatchObject({ amount: 1160, estimado: true });
  });
  it("los movimientos de Excel no cuentan", () => {
    const excel = { file: "extracto.xlsx", date: D("2026-11-12"), amount: -999 };
    expect(computeBankSaldo([conn], [manual, excel]).amount).toBe(1200);
  });
  it("sin conexiones con saldo: null", () => {
    expect(computeBankSaldo([], [])).toBeNull();
  });
});
