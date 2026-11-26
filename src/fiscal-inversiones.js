/* ============================================================
   INVERSIONES Y RENTA (España) — sin interfaz; pruebas en test/fiscal-inversiones.test.js
   ============================================================
   Estimación de lo que tus ventas suman a la declaración de la Renta, con las reglas de Hacienda:
   - Ganancia o pérdida = lo que recibiste al vender (menos comisiones) − lo que te costó (con
     comisiones). Se vende primero lo más antiguo (FIFO, art. 37.2 LIRPF).
   - Importes en euros al cambio del día de cada operación.
   - Traspasos entre fondos: no tributan; el fondo nuevo hereda el coste y la antigüedad (art. 94).
   - Regla de los dos meses (art. 33.5.f): una pérdida no cuenta si recompraste el mismo valor dos
     meses antes o después (un año si no cotiza en bolsa, como un fondo); se aplaza hasta vender eso.
   - Ganancias y pérdidas se compensan en el año; si sale negativo, se compensa en los 4 siguientes.
   - Tipos del ahorro (2025 en adelante): 19 % hasta 6.000 €, 21 % hasta 50.000, 23 % hasta
     200.000, 27 % hasta 300.000 y 30 % a partir de ahí.
   Es una estimación para planificar: no incluye dividendos, intereses ni otras ganancias que
   también van a la base del ahorro. No es asesoramiento fiscal. */

import { aEuros } from "./inversiones.js";

export const TRAMOS_AHORRO = [[6000, 0.19], [50000, 0.21], [200000, 0.23], [300000, 0.27], [Infinity, 0.3]];

// Impuesto de una base del ahorro (positiva), por tramos.
export function impuestoAhorro(base) {
  if (!(base > 0)) return 0;
  let t = 0, prev = 0;
  for (const [hasta, tipo] of TRAMOS_AHORRO) {
    if (base <= prev) break;
    t += (Math.min(base, hasta) - prev) * tipo;
    prev = hasta;
  }
  return t;
}
// Lo que añade al impuesto una ganancia extra sobre lo que ya tienes en el año.
export const impuestoExtra = (yaTienes, extra) => impuestoAhorro(Math.max(0, yaTienes + extra)) - impuestoAhorro(Math.max(0, yaTienes));

const enEuros = (o, datos) => (o.divisa && o.divisa !== "EUR" ? aEuros(o.importe, o.divisa, o.fecha, datos) ?? o.importe : o.importe);
const sumarMeses = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

/* Todas las ventas de tus posiciones con operaciones, con su resultado. Los traspasos de salida
   no son ventas: su coste y sus fechas pasan al fondo que recibe el traspaso (el de entrada más
   cercano en fecha, de la misma plataforma). */
export function ventasFIFO(posiciones, datos) {
  const conOps = (posiciones || []).filter((p) => p.ops?.length);
  // Traspasos: los lotes que salen esperan a la entrada correspondiente.
  const pendientes = []; // { entidad, fecha, lotes:[{fecha, u?, c}] }
  const todas = conOps.flatMap((p) => p.ops.map((o) => ({ p, o }))).sort((a, b) => (a.o.fecha < b.o.fecha ? -1 : a.o.fecha > b.o.fecha ? 1 : a.o.u - b.o.u));
  const colas = new Map();
  const ventas = [];
  for (const { p, o } of todas) {
    if (!colas.has(p)) colas.set(p, []);
    const cola = colas.get(p);
    const imp = enEuros(o, datos);
    if (o.u > 0) {
      // Entrada por traspaso: hereda los lotes del fondo de origen (coste y fecha originales).
      const ix = o.traspaso ? pendientes.findIndex((t) => t.entidad === p.entidad && Math.abs(new Date(t.fecha) - new Date(o.fecha)) <= 15 * 86400000) : -1;
      if (ix >= 0) {
        const t = pendientes.splice(ix, 1)[0];
        const totalC = t.lotes.reduce((x, l) => x + l.c, 0);
        for (const l of t.lotes) cola.push({ fecha: l.fecha, u: totalC ? (o.u * l.c) / totalC : o.u / t.lotes.length, c: l.c });
      } else cola.push({ fecha: o.fecha, u: o.u, c: imp });
      continue;
    }
    // Salida: se consumen los lotes más antiguos.
    let q = -o.u;
    const usados = [];
    while (q > 1e-9 && cola.length) {
      const l = cola[0], t = Math.min(q, l.u), c = (l.c * t) / l.u;
      usados.push({ fecha: l.fecha, u: t, c });
      l.u -= t; l.c -= c; q -= t;
      if (l.u < 1e-9) cola.shift();
    }
    if (o.traspaso) { pendientes.push({ entidad: p.entidad, fecha: o.fecha, lotes: usados }); continue; }
    const adquisicion = usados.reduce((x, l) => x + l.c, 0);
    ventas.push({
      id: p.id, nombre: p.nombre, isin: p.isin || "", tipo: p.tipo, entidad: p.entidad, fecha: o.fecha,
      unidades: -o.u, transmision: imp, adquisicion, ganancia: imp - adquisicion,
      compras: usados.map((l) => l.fecha), sinCompra: q > 1e-6 ? q : 0,
    });
  }
  // Regla de los dos meses: pérdida con recompra del mismo valor cerca de la venta.
  for (const v of ventas) {
    if (!(v.ganancia < 0)) continue;
    const meses = v.tipo === "fondo" ? 12 : 2;
    const desde = sumarMeses(v.fecha, -meses), hasta = sumarMeses(v.fecha, meses);
    const p = conOps.find((x) => x.id === v.id);
    const recompra = (p?.ops || []).find((o) => o.u > 0 && !o.traspaso && o.fecha >= desde && o.fecha <= hasta && !v.compras.includes(o.fecha));
    if (recompra) v.diferida = { fecha: recompra.fecha, meses };
  }
  return ventas;
}

/* Resumen de un año: ganancias, pérdidas (sin las aplazadas por la regla de los dos meses),
   saldo, compensación con pérdidas de los 4 años anteriores y el impuesto estimado. */
export function resumenAnual(ventas, anio) {
  const porAnio = {};
  for (const v of ventas) { const a = Number(v.fecha.slice(0, 4)); (porAnio[a] ||= []).push(v); }
  // Pérdidas netas de años anteriores que quedan por compensar (4 años).
  const pendientes = [];
  let resultado = null;
  for (const a of Object.keys(porAnio).map(Number).concat(anio).filter((x, i, arr) => arr.indexOf(x) === i).sort()) {
    if (a > anio) break;
    const vs = porAnio[a] || [];
    const ganancias = vs.filter((v) => v.ganancia > 0).reduce((t, v) => t + v.ganancia, 0);
    const perdidas = vs.filter((v) => v.ganancia < 0 && !v.diferida).reduce((t, v) => t + v.ganancia, 0);
    const aplazadas = vs.filter((v) => v.ganancia < 0 && v.diferida).reduce((t, v) => t + v.ganancia, 0);
    let saldo = ganancias + perdidas;
    let compensado = 0;
    for (const pd of pendientes) {
      if (saldo <= 0) break;
      if (a - pd.anio > 4 || pd.queda >= 0) continue;
      const usa = Math.min(saldo, -pd.queda);
      pd.queda += usa; saldo -= usa; compensado += usa;
    }
    if (saldo < 0) pendientes.push({ anio: a, queda: saldo });
    if (a === anio) {
      resultado = {
        anio, ventas: vs, ganancias, perdidas, aplazadas, saldo: ganancias + perdidas, compensado,
        base: Math.max(0, saldo), impuesto: impuestoAhorro(Math.max(0, saldo)),
        aCompensar: pendientes.filter((pd) => pd.queda < 0 && anio - pd.anio < 4).map((pd) => ({ anio: pd.anio, queda: -pd.queda })),
      };
    }
  }
  return resultado;
}

/* «Si vendieras hoy»: para cada posición, la ganancia o pérdida latente (con su coste FIFO) y lo
   que cambiaría tu impuesto de este año. Y las pérdidas que podrías realizar para compensar lo que
   ya has ganado (sin recomprar en dos meses, o en un año si es un fondo). */
export function simularVentas(filas, baseAnio) {
  const out = filas.filter((f) => f.coste != null && f.valor > 0).map((f) => {
    const latente = f.valor - f.coste;
    return { f, latente, impuesto: impuestoExtra(baseAnio, latente), fondo: f.p.tipo === "fondo" };
  });
  const perdidas = out.filter((x) => x.latente < -1).sort((a, b) => a.latente - b.latente);
  let queda = baseAnio, ahorro = 0;
  const cosecha = [];
  for (const x of perdidas) {
    if (queda <= 0) break;
    const usa = Math.min(queda, -x.latente);
    const ah = impuestoAhorro(queda) - impuestoAhorro(queda - usa);
    cosecha.push({ ...x, compensa: usa, ahorro: ah });
    queda -= usa; ahorro += ah;
  }
  return { posiciones: out.sort((a, b) => b.latente - a.latente), cosecha, ahorro };
}

// CSV de las ventas de un año, para tu gestor o para revisar el borrador.
export function csvVentas(ventas) {
  const n = (x) => (Math.round(x * 100) / 100).toFixed(2).replace(".", ",");
  const filas = [["Fecha de venta", "Producto", "ISIN", "Plataforma", "Participaciones", "Valor de transmisión (€)", "Valor de adquisición (€)", "Ganancia o pérdida (€)", "Fechas de compra", "Aviso"]];
  for (const v of ventas) filas.push([v.fecha, v.nombre, v.isin, v.entidad, String(v.unidades).replace(".", ","), n(v.transmision), n(v.adquisicion), n(v.ganancia), [...new Set(v.compras)].join(" "), v.diferida ? `Regla de los ${v.diferida.meses === 2 ? "2 meses" : "12 meses"}: recompra el ${v.diferida.fecha}` : ""]);
  return filas.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(";")).join("\n");
}
