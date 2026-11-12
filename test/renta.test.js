import { describe, it, expect } from "vitest";
import { calcRentaInmueble, calcImputacion } from "../src/core.js";

const ficha = { titularidad: 50, diasArrendado: 365, valorCatastral: 100000, pctConstruccion: 60, coste: 150000, reduccion: 60, intereses: { 2025: 2000 }, catastralRevisado: true };

describe("renta de un inmueble alquilado", () => {
  it("año completo: amortización, límite, reducción y parte del titular", () => {
    const r = calcRentaInmueble({ ingreso: 9000, gastoDeducible: 1500, reparacion: 500, fiscal: ficha, anio: 2025 });
    // amortización: 3 % de max(100.000, 150.000) × 60 % = 2.700
    expect(r.amortizacion).toBe(2700);
    // neto = 9.000 − 1.000 (otros gastos) − 2.500 (intereses 2.000 + reparación 500) − 2.700 = 2.800
    expect(r.neto).toBe(2800);
    expect(r.reduccion).toBe(1680); // 60 %
    expect(r.netoReducido).toBe(1120);
    expect(r.tuParte).toBe(560); // 50 % de titularidad
    expect(r.faltan).toEqual([]);
  });
  it("intereses + reparación no pueden superar los ingresos: el exceso se arrastra", () => {
    const r = calcRentaInmueble({ ingreso: 2000, gastoDeducible: 1500, reparacion: 1500, fiscal: { ...ficha, intereses: { 2025: 3000 } }, anio: 2025 });
    expect(r.interesesYReparacion).toBe(2000);
    expect(r.exceso).toBe(2500);
  });
  it("sin alquilar todo el año: gastos prorrateados e imputación por el resto", () => {
    const r = calcRentaInmueble({ ingreso: 4500, gastoDeducible: 730, reparacion: 0, fiscal: { ...ficha, diasArrendado: 182.5 }, anio: 2025 });
    expect(r.gastos).toBe(365); // la mitad
    expect(r.imputacion).toBe(275); // 1,1 % de 100.000 × medio año × 50 %
  });
  it("con un rendimiento negativo no hay reducción, y avisa de lo que falta", () => {
    const r = calcRentaInmueble({ ingreso: 1000, gastoDeducible: 3000, fiscal: {}, anio: 2024 });
    expect(r.reduccion).toBe(0);
    expect(r.diasAnio).toBe(366);
    expect(r.faltan.length).toBe(4);
  });
  it("imputación de una segunda vivienda", () => {
    expect(calcImputacion({ fiscal: { valorCatastral: 80000, catastralRevisado: false, titularidad: 100 }, anio: 2025 }).imputacion).toBe(1600);
  });
});
