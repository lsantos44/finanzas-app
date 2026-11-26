/* Cartera de EJEMPLO para probar la pestaña Inversiones sin datos propios ni servidor: productos
   ficticios con precios inventados (generados aquí, siempre iguales), compras mensuales, una venta
   con ganancia y otra con pérdida para ver también la parte de la Renta. Sus símbolos empiezan por
   «DEMO:», así que nunca se piden a ningún servidor. */
import { REFERENCIAS, sumarDias, dia } from "./inversiones.js";

const PRODUCTOS = [
  { simbolo: "DEMO:MUNDO", nombre: "Fondo indexado mundial (ejemplo)", entidad: "Gestora de ejemplo", tipo: "fondo", p0: 20, deriva: 0.00035, vol: 0.008, semilla: 7 },
  { simbolo: "DEMO:TEC", nombre: "Tecnológica Ejemplo", entidad: "Bróker de ejemplo", tipo: "accion", p0: 80, deriva: 0.0007, vol: 0.022, semilla: 11 },
  { simbolo: "DEMO:ENE", nombre: "Energía Ejemplo", entidad: "Bróker de ejemplo", tipo: "accion", p0: 30, deriva: -0.0004, vol: 0.018, semilla: 23 },
  { simbolo: "DEMO:RF", nombre: "Fondo de renta fija (ejemplo)", entidad: "Gestora de ejemplo", tipo: "fondo", p0: 100, deriva: -0.00012, vol: 0.002, semilla: 31 },
];

// Paseo aleatorio con semilla: los mismos precios cada vez que se abre.
function serie(p, desde, hasta) {
  let x = p.semilla * 2654435761 % 4294967296;
  const rnd = () => { x = (1103515245 * x + 12345) % 2147483648; return x / 2147483648; };
  const out = [];
  let v = p.p0;
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const wd = new Date(f + "T12:00:00Z").getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const z = (rnd() + rnd() + rnd() - 1.5) * 2; // ~normal
    v = Math.max(0.5, v * (1 + p.deriva + p.vol * z));
    out.push([f, Math.round(v * 10000) / 10000]);
  }
  return out;
}

export function seriesEjemplo(hoy = dia(new Date())) {
  const desde = sumarDias(hoy, -760);
  const series = {}, meta = {};
  for (const p of PRODUCTOS) { series[p.simbolo] = serie(p, desde, hoy); meta[p.simbolo] = { divisa: "EUR" }; }
  return { series, meta };
}

const precioEn = (s, f) => { let r = s[0][1]; for (const [d, v] of s) { if (d > f) break; r = v; } return r; };

export function carteraEjemplo(hoy = dia(new Date())) {
  const { series } = seriesEjemplo(hoy);
  const op = (sim, f, importe) => { const pr = precioEn(series[sim], f); return { fecha: f, u: Math.round((importe / pr) * 10000) / 10000, importe }; };
  const venta = (sim, f, u) => ({ fecha: f, u: -u, importe: Math.round(u * precioEn(series[sim], f) * 100) / 100 });
  const ops = { "DEMO:MUNDO": [], "DEMO:TEC": [], "DEMO:ENE": [], "DEMO:RF": [] };
  // Aportación mensual de 300 € al fondo mundial durante los últimos 22 meses.
  for (let m = 22; m >= 1; m--) ops["DEMO:MUNDO"].push(op("DEMO:MUNDO", sumarDias(hoy, -m * 30), 300));
  ops["DEMO:TEC"].push(op("DEMO:TEC", sumarDias(hoy, -600), 2000), op("DEMO:TEC", sumarDias(hoy, -400), 1500));
  ops["DEMO:TEC"].push(venta("DEMO:TEC", sumarDias(hoy, -40), Math.round(ops["DEMO:TEC"][0].u * 0.5 * 10000) / 10000));
  ops["DEMO:ENE"].push(op("DEMO:ENE", sumarDias(hoy, -500), 2500));
  ops["DEMO:RF"].push(op("DEMO:RF", sumarDias(hoy, -700), 5000));
  ops["DEMO:RF"].push(venta("DEMO:RF", sumarDias(hoy, -200), Math.round(ops["DEMO:RF"][0].u * 0.4 * 10000) / 10000));
  return PRODUCTOS.map((p, i) => {
    const o = ops[p.simbolo];
    const neto = Math.round(o.reduce((t, x) => t + x.u, 0) * 1e6) / 1e6;
    return { id: "ejemplo" + i, nombre: p.nombre, entidad: p.entidad, tipo: p.tipo, simbolo: p.simbolo, revisado: true, ejemplo: true,
      participaciones: neto, coste: 1, compra: o[0].fecha, alta: hoy, ops: o };
  });
}

export const esEjemplo = (inv) => (inv?.posiciones || []).some((p) => p.ejemplo || p.simbolo?.startsWith("DEMO:"));

// Precios del ejemplo añadidos a los de tu servidor (solo si hay productos de ejemplo).
// Con la cartera de ejemplo también se inventan los índices de comparación si no hay servidor que
// los traiga (si los hay, se usan los de verdad).
export function conEjemplo(datos, inv) {
  if (!esEjemplo(inv)) return datos;
  const e = seriesEjemplo();
  const hoy = dia(new Date());
  REFERENCIAS.forEach((r, i) => {
    if ((datos?.series?.[r.simbolo] || []).length) return;
    e.series[r.simbolo] = serie({ p0: 100, deriva: 0.0004, vol: 0.009, semilla: 41 + i }, sumarDias(hoy, -760), hoy);
    e.meta[r.simbolo] = { divisa: "EUR" };
  });
  return { ...datos, series: { ...(datos?.series || {}), ...e.series }, meta: { ...(datos?.meta || {}), ...e.meta } };
}
