/* ============================================================
   INVERSIONES: cálculos (sin interfaz, con pruebas en test/inversiones.test.js)
   ============================================================
   Qué tienes (posiciones) vive en tu configuración y se sincroniza como el resto. Los precios
   vienen de tu servidor (/inversiones/precios), que los baja cada noche de Yahoo Finance.

   Posición: { id, nombre, entidad, tipo: "accion" | "fondo", isin?, simbolo?, divisa?,
               participaciones?, valorAlta?, coste?, alta: "AAAA-MM-DD", robo?, pesoObjetivo? }
   - participaciones o, si no se saben (los fondos muestran el valor, no las participaciones),
     valorAlta: se convierte en participaciones con el precio del día de alta.
   - coste: lo que pusiste en euros (null si no se sabe: entonces no hay resultado).
   - robo: forma parte de una cartera automatizada que recibe aportaciones periódicas; cada
     aportación se reparte según pesoObjetivo (o, sin él, según el valor de cada fondo).
   Aportación: { patron, importe, desde } → las transferencias con ese concepto y ese importe
   (±15 %) posteriores a «desde» son aportaciones a la cartera automatizada. */

export const INV_VACIO = { posiciones: [], aportacion: null };

export const dia = (d) => (typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
export const sumarDias = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Último cierre en esa fecha o antes (las series vienen ordenadas por fecha).
export function cierreEn(serie, fecha) {
  if (!serie || !serie.length) return null;
  let lo = 0, hi = serie.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (serie[m][0] <= fecha) { r = m; lo = m + 1; } else hi = m - 1; }
  return r >= 0 ? serie[r][1] : null;
}

export const divisaDe = (p, datos) => datos?.meta?.[p.simbolo]?.divisa || p.divisa || "EUR";

// Precio en euros con el cambio del BCE-Yahoo de ese día (EURUSD=X son dólares por euro).
export function aEuros(precio, divisa, fecha, datos) {
  if (precio == null) return null;
  if (!divisa || divisa === "EUR") return precio;
  let d = divisa, f = 1;
  if (divisa === "GBp" || divisa === "GBX") { d = "GBP"; f = 100; }
  const fx = cierreEn(datos?.series?.[`EUR${d}=X`], fecha);
  return fx ? precio / f / fx : null;
}

export function precioEUR(p, fecha, datos) {
  if (!p.simbolo) return null;
  return aEuros(cierreEn(datos?.series?.[p.simbolo], fecha), divisaDe(p, datos), fecha, datos);
}

export function unidadesBase(p, datos) {
  if (p.participaciones > 0) return p.participaciones;
  if (p.valorAlta > 0) {
    const pr = precioEUR(p, p.alta || "9999-12-31", datos) ?? precioEUR(p, "9999-12-31", datos);
    return pr ? p.valorAlta / pr : null;
  }
  return null;
}

export function aportacionesDe(movs, aportacion) {
  if (!aportacion?.patron || !(aportacion.importe > 0)) return [];
  const desde = aportacion.desde || "0000-00-00";
  return (movs || [])
    .filter((m) => !m.omit && m.amount < 0 && m.pattern === aportacion.patron
      && Math.abs(Math.abs(m.amount) - aportacion.importe) <= aportacion.importe * 0.15 && dia(m.date) > desde)
    .map((m) => ({ fecha: dia(m.date), importe: Math.abs(m.amount) }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

const unidadesEn = (lotes, f) => lotes.reduce((s, l) => (l.fecha <= f ? s + l.unidades : s), 0);

// Participaciones de cada posición a lo largo del tiempo, en lotes: el de partida (vale para
// todas las fechas: lo que tienes hoy, hacia atrás) y uno por cada aportación repartida.
// La gestora compra unos días después de la transferencia: se usa el precio de dos días más tarde.
export function calcularLotes(inv, datos, aportes) {
  const lotes = {};
  for (const p of inv.posiciones) lotes[p.id] = [{ fecha: "0000-00-00", unidades: unidadesBase(p, datos) ?? 0, coste: p.coste ?? null, base: true }];
  const robo = inv.posiciones.filter((p) => p.robo);
  for (const a of aportes) {
    const fe = sumarDias(a.fecha, 2);
    let pesos = robo.map((p) => (p.pesoObjetivo > 0 ? p.pesoObjetivo : 0));
    if (!pesos.some(Boolean)) pesos = robo.map((p) => { const pr = precioEUR(p, fe, datos); return pr ? unidadesEn(lotes[p.id], fe) * pr : 0; });
    const tot = pesos.reduce((s, x) => s + x, 0);
    if (!tot) continue;
    robo.forEach((p, i) => {
      const imp = (a.importe * pesos[i]) / tot;
      const pr = precioEUR(p, fe, datos);
      if (imp > 0 && pr) lotes[p.id].push({ fecha: fe, unidades: imp / pr, coste: imp });
    });
  }
  return lotes;
}

// Precio en euros de una posición a lo largo del tiempo (para su gráfico).
export function serieEUR(p, datos, desde = "0000-00-00") {
  const s = datos?.series?.[p.simbolo] || [];
  const out = [];
  for (const [f] of s) { if (f < desde) continue; const v = precioEUR(p, f, datos); if (v != null) out.push([f, v]); }
  return out;
}

function variacion(serie, dias) {
  if (!serie.length) return null;
  const [fu, vu] = serie[serie.length - 1];
  const ref = cierreEn(serie, sumarDias(fu, -dias));
  return ref ? vu / ref - 1 : null;
}

/* Todo lo que enseña la pestaña, a partir de posiciones, precios y movimientos. */
export function analizarInversiones(inv, datos, movs) {
  const posiciones = inv?.posiciones || [];
  const aportes = aportacionesDe(movs, inv?.aportacion);
  const lotes = calcularLotes({ posiciones }, datos, aportes);

  const filas = posiciones.map((p) => {
    const s = serieEUR(p, datos);
    const ls = lotes[p.id];
    const unidades = unidadesEn(ls, "9999-12-31");
    const costeBase = ls[0].coste;
    const aportado = ls.slice(1).reduce((x, l) => x + l.coste, 0);
    const coste = costeBase == null ? null : costeBase + aportado;
    const sinPrecio = !s.length;
    const precio = sinPrecio ? null : s[s.length - 1][1];
    const precioAnt = s.length > 1 ? s[s.length - 2][1] : null;
    const valor = sinPrecio ? (p.valorAlta || 0) : unidades * precio;
    const hoy = precio != null && precioAnt != null ? unidades * (precio - precioAnt) : null;
    return {
      p, unidades, precio, valor, coste, aportado, sinPrecio,
      fechaPrecio: sinPrecio ? null : s[s.length - 1][0],
      hoy, hoyPct: precioAnt ? precio / precioAnt - 1 : null,
      resultado: coste != null ? valor - coste : null,
      resultadoPct: coste ? valor / coste - 1 : null,
      precioMedio: coste != null && unidades ? coste / unidades : null,
      var: { s: variacion(s, 7), m: variacion(s, 30), a: variacion(s, 365) },
      error: p.simbolo ? datos?.meta?.[p.simbolo]?.error || null : null,
    };
  });

  const total = filas.reduce((x, f) => x + f.valor, 0);
  for (const f of filas) f.peso = total ? f.valor / total : 0;
  const conCoste = filas.filter((f) => f.coste != null);
  const costeTotal = conCoste.reduce((x, f) => x + f.coste, 0);
  const valorConCoste = conCoste.reduce((x, f) => x + f.valor, 0);
  const hoy = filas.reduce((x, f) => x + (f.hoy || 0), 0);

  const agrupar = (clave) => {
    const m = new Map();
    for (const f of filas) {
      const k = clave(f);
      if (!m.has(k)) m.set(k, { nombre: k, filas: [], valor: 0, hoy: 0, coste: 0, valorConCoste: 0 });
      const g = m.get(k);
      g.filas.push(f); g.valor += f.valor; g.hoy += f.hoy || 0;
      if (f.coste != null) { g.coste += f.coste; g.valorConCoste += f.valor; }
    }
    return [...m.values()].map((g) => ({ ...g, peso: total ? g.valor / total : 0, resultado: g.coste ? g.valorConCoste - g.coste : null, resultadoPct: g.coste ? g.valorConCoste / g.coste - 1 : null }))
      .sort((a, b) => b.valor - a.valor);
  };

  // Evolución del total: desde que todas las posiciones con precio tienen datos.
  const conPrecio = posiciones.filter((p) => (datos?.series?.[p.simbolo] || []).length);
  const inicio = conPrecio.reduce((mx, p) => { const f = datos.series[p.simbolo][0][0]; return f > mx ? f : mx; }, "0000-00-00");
  const fechas = [...new Set(conPrecio.flatMap((p) => datos.series[p.simbolo].map((x) => x[0])))].filter((f) => f >= inicio).sort();
  const fijo = posiciones.filter((p) => !(datos?.series?.[p.simbolo] || []).length).reduce((x, p) => x + (p.valorAlta || 0), 0);
  const costeFijo = filas.filter((f) => f.coste != null).reduce((x, f) => x + (lotes[f.p.id][0].coste || 0), 0);
  const serie = fechas.map((f) => {
    let v = fijo, inv2 = costeFijo;
    for (const p of conPrecio) { const pr = precioEUR(p, f, datos); if (pr) v += unidadesEn(lotes[p.id], f) * pr; }
    for (const p of posiciones) for (const l of lotes[p.id].slice(1)) if (l.fecha <= f && lotes[p.id][0].coste != null) inv2 += l.coste;
    return { d: f, valor: v, invertido: inv2 };
  });

  return {
    filas, total, hoy, hoyPct: total - hoy ? hoy / (total - hoy) : null,
    costeTotal, resultado: conCoste.length ? valorConCoste - costeTotal : null,
    resultadoPct: costeTotal ? valorConCoste / costeTotal - 1 : null,
    sinCoste: filas.filter((f) => f.coste == null).length,
    porEntidad: agrupar((f) => f.p.entidad || "Sin entidad"),
    porTipo: agrupar((f) => (f.p.tipo === "accion" ? "Acciones" : f.p.robo ? "Fondos indexados" : "Fondos")),
    aportes, serie,
    fechaPrecios: filas.reduce((mx, f) => (f.fechaPrecio && f.fechaPrecio > mx ? f.fechaPrecio : mx), ""),
  };
}

// Símbolos que el servidor tiene que seguir.
export const simbolosDe = (inv) => [...new Set((inv?.posiciones || []).map((p) => p.simbolo).filter(Boolean))];

// Importación de posiciones (texto JSON): valida y normaliza, sin aceptar campos raros.
export function normalizarPosiciones(lista, hoy) {
  if (!Array.isArray(lista)) throw new Error("Se esperaba una lista de posiciones.");
  const num = (x) => (typeof x === "number" && isFinite(x) ? x : typeof x === "string" && x.trim() ? Number(x.replace(/\./g, "").replace(",", ".")) : null);
  return lista.map((x, i) => {
    if (!x || typeof x !== "object" || !x.nombre) throw new Error(`La posición ${i + 1} no tiene nombre.`);
    const p = {
      id: String(x.id || "inv" + Date.now().toString(36) + i),
      nombre: String(x.nombre).slice(0, 80),
      entidad: String(x.entidad || "Sin entidad").slice(0, 40),
      tipo: x.tipo === "accion" ? "accion" : "fondo",
      alta: /^\d{4}-\d{2}-\d{2}$/.test(x.alta || "") ? x.alta : hoy,
    };
    if (x.isin) p.isin = String(x.isin).toUpperCase().slice(0, 12);
    if (x.simbolo) p.simbolo = String(x.simbolo).slice(0, 40);
    if (x.divisa) p.divisa = String(x.divisa).slice(0, 3);
    const part = num(x.participaciones), val = num(x.valorAlta), coste = num(x.coste), peso = num(x.pesoObjetivo);
    if (part > 0) p.participaciones = part;
    if (val > 0) p.valorAlta = val;
    if (!(p.participaciones > 0) && !(p.valorAlta > 0)) throw new Error(`«${p.nombre}»: indica participaciones o valor actual.`);
    p.coste = coste > 0 ? coste : null;
    if (x.robo) p.robo = true;
    if (peso > 0) p.pesoObjetivo = peso;
    return p;
  });
}
