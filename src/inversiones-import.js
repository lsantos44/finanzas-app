/* ============================================================
   IMPORTAR EL ARCHIVO DE TU BRÓKER (sin interfaz; pruebas en test/inversiones-import.test.js)
   ============================================================
   Del CSV o Excel de operaciones que descarga cualquier bróker o gestora (DEGIRO, Revolut,
   Interactive Brokers, MyInvestor, Trade Republic, tu banco…) saca cada compra y venta con su
   fecha, cantidad e importe, y las agrupa por producto. Con eso:
   - lo que tienes y lo que te costó salen exactos (también si compraste en varias veces);
   - la evolución empieza en tu primera compra, sin tener que decir la fecha;
   - las ventas dan las ganancias y pérdidas para la Renta (src/fiscal-inversiones.js).
   No se adivina nada: las columnas se reconocen por su nombre (en español o inglés) y lo que no se
   entiende se cuenta como «filas saltadas», nunca se inventa.

   Operación: { fecha: "AAAA-MM-DD", u: participaciones (+ compra, − venta), importe: lo que pagaste
   (compra) o recibiste (venta) con comisiones, siempre positivo, divisa, comision?, traspaso? } */

const QUITA_ACENTOS = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s) => QUITA_ACENTOS(s).toLowerCase().replace(/\s+/g, " ").trim();

// Qué significa cada columna, por su cabecera. El orden importa: la primera que encaja gana.
const COLUMNAS = {
  fecha: [/^(fecha( de (la )?(operacion|orden|ejecucion|valor|liquidacion))?|date|datum|trade ?date|fecha operacion|fecha valor|time|tradedate)$/, /^(fecha|date)/],
  nombre: [/^(producto|product|nombre( del (fondo|producto|valor))?|name|instrumento|instrument|descripcion|description|fondo|security|activo|valor\/fondo|titulo)$/, /(producto|nombre|description|instrument)/],
  isin: [/^isin( code)?$/, /isin/],
  ticker: [/^(ticker|simbolo|symbol|codigo|code)$/],
  bolsa: [/^(bolsa( de referencia)?|reference exchange|exchange|mercado|listing exchange)$/, /^(centro de ejecucion|venue)$/],
  tipo: [/^(tipo( de)? (operacion|orden|movimiento)|tipo|type|operacion|movimiento|side|buy\/sell|transaction type|clase de operacion|naturaleza)$/],
  cantidad: [/^(numero|cantidad|quantity|participaciones|n(º|o)? ?(de )?(titulos|participaciones|acciones)|titulos|acciones|shares|units|qty|unidades|stuck|anzahl)$/, /(participaciones|cantidad|quantity|shares)/],
  precio: [/^(precio|price|price per share|precio (unitario|de ejecucion|por (accion|participacion))|valor liquidativo|nav|tradeprice|cotizacion)$/, /^(precio|price)/],
  total: [/^(total|total amount|importe( neto| total| bruto| efectivo)?|amount|efectivo|netcash|net amount|importe en eur|total \(eur\)|total eur|betrag)$/, /^(importe|total|amount)/],
  valor: [/^(valor|value|valor local|local value)$/],
  comision: [/(costes de transaccion|comision|fee|commission|ibcommission|gastos)/],
  divisa: [/^(divisa|currency|moneda|currencyprimary)$/],
  cambio: [/^(tipo de cambio|fx rate|exchange rate|fxratetobase)$/],
};
const TIPO_VENTA = /(venta|vender|sell|sale|reembolso|redemption|verkauf|traspaso (de )?salida|salida por traspaso|transfer out)/;
const TIPO_COMPRA = /(compra|comprar|buy|purchase|suscripcion|subscription|kauf|traspaso (de )?entrada|entrada por traspaso|transfer in|aportacion|savings plan|sparplan)/;
const TIPO_TRASPASO = /(traspaso|transfer (in|out))/;
// Lo que no es compraventa: se salta (y se cuenta). Dividendos, ingresos, comisiones de custodia…
const TIPO_OTRO = /(dividend|dividendo|cupon|interes|interest|top-?up|deposit|ingreso|retirada|withdraw|custody|custodia|fee$|tax|impuesto|split|cash|efectivo|flatex|reparto|fx|cambio de divisa)/;

// Número tal como lo escriben los brókers: «-1.234,56», «1,234.56», «$1,234.56», «USD 12.5», «12,5 €».
// `europeo`: el archivo usa coma decimal (se decide mirando todo el archivo, ver formatoDe).
export function numero(x, europeo = true) {
  if (typeof x === "number") return isFinite(x) ? x : null;
  let t = String(x ?? "").trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || /^-|^−|-$/.test(t.replace(/[^\d.,()−-]/g, "").trim());
  t = t.replace(/[^\d.,]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const c = t.lastIndexOf(","), p = t.lastIndexOf(".");
  if (c >= 0 && p >= 0) t = c > p ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (c >= 0) t = !europeo && /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : (t.match(/,/g).length > 1 ? t.replace(/,/g, "") : t.replace(",", "."));
  else if (p >= 0 && (t.match(/\./g).length > 1 || (europeo && /^\d{1,3}\.\d{3}$/.test(t)))) t = t.replace(/\./g, "");
  const n = Number(t);
  return isFinite(n) ? (neg ? -Math.abs(n) : n) : null;
}

// ¿Coma decimal? Si alguna cifra del archivo acaba en «,dd» (o «,dddd») sin punto detrás, sí.
export function formatoDe(filas) {
  let eu = 0, us = 0;
  for (const r of filas.slice(0, 200)) for (const c of r) {
    const t = String(c || "").trim();
    if (/^-?[\d.]*\d,\d{1,6}$/.test(t)) eu++;
    else if (/^-?[\d,]*\d\.\d{1,6}$/.test(t) && !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(t)) us++;
  }
  return eu >= us;
}

// Fecha: 2026-07-16, 2026-07-16T10:00:00Z, 16/07/2026, 16-07-2026, 16.07.2026, 16/07/26, 20260716.
export function fecha(x) {
  const t = String(x ?? "").trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = t.match(/^(\d{4})(\d{2})(\d{2})(;|$|\s)/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// La fila de cabecera: la primera (de las 30 primeras) donde se reconocen fecha, cantidad o importe,
// y producto o ISIN.
function buscarCabecera(filas) {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const m = mapear(filas[i]);
    if (m.fecha != null && (m.cantidad != null || m.total != null) && (m.nombre != null || m.isin != null || m.ticker != null)) return { i, m };
  }
  return null;
}

export function mapear(cab) {
  const h = cab.map(norm);
  const m = {};
  for (const [k, pats] of Object.entries(COLUMNAS)) {
    for (const re of pats) {
      const i = h.findIndex((x, j) => x && re.test(x) && !Object.values(m).includes(j));
      if (i >= 0) { m[k] = i; break; }
    }
  }
  // Las columnas sin nombre que siguen a un importe son su divisa (así lo exporta DEGIRO).
  m.divisaDe = {};
  for (const k of ["precio", "total", "valor", "comision"]) if (m[k] != null && !h[m[k] + 1]) m.divisaDe[k] = m[k] + 1;
  return m;
}

const BROKERS = [
  { nombre: "DEGIRO", es: (h) => h.includes("isin") && (h.some((x) => /^(id orden|order id)$/.test(x)) || h.some((x) => /centro de ejecucion|venue/.test(x))) },
  { nombre: "Revolut", es: (h) => h.includes("price per share") && h.includes("total amount") },
  { nombre: "Interactive Brokers", es: (h) => h.some((x) => /^(tradeprice|ibcommission|netcash)$/.test(x)) },
  { nombre: "Trade Republic", es: (h) => h.some((x) => /trade republic/.test(x)) },
  { nombre: "MyInvestor", es: (h) => h.some((x) => /myinvestor/.test(x)) },
];

/* Filas (de un CSV o Excel) → { broker, operaciones: [{ nombre, isin, ticker, bolsa, ...op }],
   saltadas: [{ fila, motivo }], cabecera }. Lanza un error claro si no reconoce el archivo. */
export function leerOperaciones(filas) {
  if (!Array.isArray(filas) || !filas.length) throw new Error("El archivo está vacío.");
  const cab = buscarCabecera(filas);
  if (!cab) throw new Error("No reconozco las columnas de este archivo. Necesito al menos la fecha, el producto (o ISIN) y la cantidad o el importe de cada operación.");
  const { i: ic, m } = cab;
  const h = filas[ic].map(norm);
  const broker = BROKERS.find((b) => b.es(h))?.nombre || null;
  const eu = formatoDe(filas.slice(ic + 1));
  const celda = (r, k) => (m[k] != null ? r[m[k]] : "");
  const operaciones = [], saltadas = [];
  for (let k = ic + 1; k < filas.length; k++) {
    const r = filas[k];
    if (!r || !r.some((c) => String(c || "").trim())) continue;
    const f = fecha(celda(r, "fecha"));
    const tipoTxt = norm(celda(r, "tipo"));
    const nombre = String(celda(r, "nombre") || "").trim();
    const isin = String(celda(r, "isin") || "").trim().toUpperCase();
    const ticker = String(celda(r, "ticker") || "").trim().toUpperCase();
    if (!f) { saltadas.push({ fila: k + 1, motivo: "sin fecha" }); continue; }
    if (!nombre && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) && !ticker) { saltadas.push({ fila: k + 1, motivo: tipoTxt || "sin producto" }); continue; }
    if (tipoTxt && TIPO_OTRO.test(tipoTxt) && !TIPO_COMPRA.test(tipoTxt) && !TIPO_VENTA.test(tipoTxt)) { saltadas.push({ fila: k + 1, motivo: tipoTxt }); continue; }
    let u = numero(celda(r, "cantidad"), eu);
    const precio = numero(celda(r, "precio"), eu);
    let total = numero(celda(r, "total"), eu);
    if (total == null) total = numero(celda(r, "valor"), eu);
    const comision = Math.abs(numero(celda(r, "comision"), eu) || 0);
    // ¿Compra o venta? Por el tipo; si no lo hay, por el signo de la cantidad o del importe
    // (en DEGIRO las ventas tienen cantidad negativa y las compras importe negativo).
    let venta = null;
    if (tipoTxt && TIPO_VENTA.test(tipoTxt)) venta = true;
    else if (tipoTxt && TIPO_COMPRA.test(tipoTxt)) venta = false;
    else if (u != null && u < 0) venta = true;
    else venta = false;
    if (u == null && total != null && precio) u = Math.abs(total) / precio;
    if (u == null || !isFinite(u) || Math.abs(u) < 1e-9) { saltadas.push({ fila: k + 1, motivo: "sin cantidad" }); continue; }
    u = Math.abs(u);
    // Importe: el total (con comisiones) si lo hay; si no, cantidad × precio ± comisión.
    let importe = total != null ? Math.abs(total) : precio != null ? u * precio + (venta ? -comision : comision) : null;
    if (importe == null || !(importe > 0)) { saltadas.push({ fila: k + 1, motivo: "sin importe" }); continue; }
    // Divisa del importe: la columna de divisa del total (DEGIRO), la de divisa general o EUR.
    const div = (m.divisaDe.total != null ? r[m.divisaDe.total] : m.divisaDe.valor != null && m.total == null ? r[m.divisaDe.valor] : celda(r, "divisa")) || "EUR";
    const divisa = /^[A-Z]{3}$/.test(String(div).trim().toUpperCase()) ? String(div).trim().toUpperCase() : "EUR";
    const op = { fecha: f, u: venta ? -u : u, importe: Math.round(importe * 100) / 100, divisa };
    if (comision) op.comision = Math.round(comision * 100) / 100;
    if (tipoTxt && TIPO_TRASPASO.test(tipoTxt)) op.traspaso = true;
    operaciones.push({ nombre, isin: /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) ? isin : "", ticker, bolsa: String(celda(r, "bolsa") || "").trim(), ...op });
  }
  if (!operaciones.length) throw new Error(`No he encontrado compras ni ventas en el archivo${saltadas.length ? ` (${saltadas.length} filas que no lo son: dividendos, ingresos, comisiones…)` : ""}.`);
  return { broker, operaciones, saltadas, cabecera: filas[ic] };
}

const PARECE_FONDO = /\b(fund|fondo|fonds|fi\b|f\.i\.|sicav|class [a-z0-9]|clase [a-z0-9]|r eur|i eur|a eur|lc\b|acc eur|eur acc|cap\b|plan de pensiones|pp\b)/i;

/* Operaciones → posiciones (una por producto: ISIN, ticker o nombre), con sus participaciones,
   lo que te costó lo que aún tienes (FIFO, como Hacienda) y la fecha de la primera compra. Lo
   vendido del todo queda como posición cerrada (participaciones 0) para la Renta. */
export function posicionesDeOperaciones(operaciones, entidad, broker = null) {
  const grupos = new Map();
  for (const o of operaciones) {
    const k = o.isin || (o.ticker && "T:" + o.ticker) || "N:" + norm(o.nombre);
    if (!grupos.has(k)) grupos.set(k, { nombre: o.nombre, isin: o.isin, ticker: o.ticker, bolsa: o.bolsa, ops: [] });
    const g = grupos.get(k);
    if (!g.nombre && o.nombre) g.nombre = o.nombre;
    g.ops.push({ fecha: o.fecha, u: o.u, importe: o.importe, divisa: o.divisa, ...(o.comision ? { comision: o.comision } : {}), ...(o.traspaso ? { traspaso: true } : {}) });
  }
  const out = [];
  for (const g of grupos.values()) {
    g.ops.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : b.u - a.u));
    const { unidades, coste } = fifo(g.ops);
    const tipo = broker === "DEGIRO" || broker === "Revolut" || broker === "Interactive Brokers" || /\betf\b/i.test(g.nombre) ? "accion" : PARECE_FONDO.test(g.nombre) ? "fondo" : g.ticker && !g.isin ? "accion" : "fondo";
    const p = {
      nombre: (g.nombre || g.isin || g.ticker).slice(0, 80), entidad: entidad || broker || "Sin entidad", tipo,
      participaciones: Math.round(unidades * 1e6) / 1e6, coste: Math.round(coste * 100) / 100,
      compra: g.ops.find((o) => o.u > 0)?.fecha || g.ops[0].fecha, ops: g.ops,
    };
    // Sin precio automático (aún sin servidor), su valor es el de la última operación.
    const ult = [...g.ops].reverse().find((o) => (o.divisa || "EUR") === "EUR");
    if (ult && p.participaciones > 0) p.valorAlta = Math.round((ult.importe / Math.abs(ult.u)) * p.participaciones * 100) / 100;
    if (g.isin) p.isin = g.isin;
    if (g.ticker) p.ticker = g.ticker;
    if (g.bolsa) p.bolsa = g.bolsa;
    out.push(p);
  }
  return out.sort((a, b) => (b.participaciones > 0) - (a.participaciones > 0) || b.coste - a.coste);
}

// Lo que queda tras las ventas, gastando primero lo más antiguo (FIFO). Importes en su divisa.
export function fifo(ops) {
  const cola = [];
  let vendidoSinCompra = 0;
  for (const o of ops) {
    if (o.u > 0) cola.push({ u: o.u, c: o.importe });
    else {
      let q = -o.u;
      while (q > 1e-9 && cola.length) {
        const l = cola[0], t = Math.min(q, l.u), c = (l.c * t) / l.u;
        l.u -= t; l.c -= c; q -= t;
        if (l.u < 1e-9) cola.shift();
      }
      vendidoSinCompra += q;
    }
  }
  return { unidades: cola.reduce((t, l) => t + l.u, 0), coste: cola.reduce((t, l) => t + l.c, 0), vendidoSinCompra };
}
