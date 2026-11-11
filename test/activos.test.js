import { describe, it, expect } from "vitest";
import { tipoActivo } from "../src/App.jsx";

describe("tipo de activo", () => {
  it("se deduce del uso, el icono y el nombre", () => {
    expect(tipoActivo({ name: "Piso Centro", uso: "alquiler" })).toBe("inmueble");
    expect(tipoActivo({ name: "Coche", emoji: "🚗" })).toBe("vehiculo");
    expect(tipoActivo({ name: "Moto de Ana", emoji: "📦" })).toBe("vehiculo");
    expect(tipoActivo({ name: "Fondos MyInvestor" })).toBe("inversion");
    expect(tipoActivo({ name: "Mascota", emoji: "🐾" })).toBe("mascota");
    expect(tipoActivo({ name: "Guitarra", emoji: "🎸" })).toBe("otro");
  });
  it("el tipo elegido a mano manda", () => {
    expect(tipoActivo({ name: "Coche", emoji: "🚗", tipo: "inversion" })).toBe("inversion");
  });
});
