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
export function calcularLotes(inv, datos, aportes, previas = []) {
  const lotes = {};
  const robo = inv.posiciones.filter((p) => p.robo);
  const pesosObj = robo.map((p) => (p.pesoObjetivo > 0 ? p.pesoObjetivo : 0));
  // Lo que tienes cuenta desde que lo compraste (`compra`) o, si no se sabe, desde la fecha de tus
  // datos (`alta`): antes no estaba en tu cartera. Nunca hacia atrás.
  for (const p of inv.posiciones) {
    const desde = p.compra && (!p.alta || p.compra <= p.alta) ? p.compra : p.alta || "0000-00-00";
    lotes[p.id] = [{ fecha: desde, unidades: unidadesBase(p, datos) ?? 0, coste: p.coste ?? 0, base: true }];
  }
  // Cartera automatizada: lo que tenías en la fecha de tus datos se compró con las aportaciones
  // anteriores (tus transferencias). Se reparte en ellas según los pesos objetivo y se ajusta para
  // que el total coincida con tus participaciones y lo invertido.
  const tot = pesosObj.reduce((x, y) => x + y, 0);
  if (robo.length && previas.length && tot) {
    robo.forEach((p, i) => {
      const base = lotes[p.id][0];
      const raw = [];
      for (const a of previas) {
        const fe = sumarDias(a.fecha, 2);
        if ((p.alta && fe > p.alta) || (p.compra && a.fecha < p.compra)) continue;
        const imp = (a.importe * pesosObj[i]) / tot;
        const pr = precioEUR(p, fe, datos);
        if (imp > 0 && pr) raw.push({ fecha: fe, u: imp / pr, c: imp });
      }
      const su = raw.reduce((x, r) => x + r.u, 0), sc = raw.reduce((x, r) => x + r.c, 0);
      if (su > 0 && base.unidades > 0) lotes[p.id] = raw.map((r) => ({ fecha: r.fecha, unidades: (r.u * base.unidades) / su, coste: sc ? (r.c * base.coste) / sc : 0, base: true }));
    });
  }
  for (const a of aportes) {
    const fe = sumarDias(a.fecha, 2);
    let pesos = pesosObj;
    if (!pesos.some(Boolean)) pesos = robo.map((p) => { const pr = precioEUR(p, fe, datos); return pr ? unidadesEn(lotes[p.id], fe) * pr : 0; });
    const t = pesos.reduce((x, y) => x + y, 0);
    if (!t) continue;
    robo.forEach((p, i) => {
      // Las participaciones de alta ya incluyen lo comprado hasta esa fecha: si recalibras con
      // los datos de tu entidad, las aportaciones anteriores no se vuelven a sumar.
      if (p.alta && fe <= p.alta) return;
      const imp = (a.importe * pesos[i]) / t;
      const pr = precioEUR(p, fe, datos);
      if (imp > 0 && pr) lotes[p.id].push({ fecha: fe, unidades: imp / pr, coste: imp, aporte: true });
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

function variacionDesde(serie, fecha) {
  if (!serie.length) return null;
  const ref = cierreEn(serie, fecha);
  return ref ? serie[serie.length - 1][1] / ref - 1 : null;
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
  const previas = inv?.aportacion ? aportacionesDe(movs, { ...inv.aportacion, desde: "0000-00-00" }).filter((a) => a.fecha <= (inv.aportacion.desde || "0000-00-00")) : [];
  const lotes = calcularLotes({ posiciones }, datos, aportes, previas);

  const filas = posiciones.map((p) => {
    const s = serieEUR(p, datos);
    const ls = lotes[p.id];
    const unidades = unidadesEn(ls, "9999-12-31");
    const aportado = ls.filter((l) => l.aporte).reduce((x, l) => x + l.coste, 0);
    const coste = p.coste == null ? null : ls.reduce((x, l) => x + l.coste, 0);
    const entrada = ls.reduce((mn, l) => (l.fecha < mn ? l.fecha : mn), "9999-12-31");
    const sinPrecio = !s.length;
    const precio = sinPrecio ? null : s[s.length - 1][1];
    const precioAnt = s.length > 1 ? s[s.length - 2][1] : null;
    const valor = sinPrecio ? (p.valorAlta || 0) : unidades * precio;
    const hoy = precio != null && precioAnt != null ? unidades * (precio - precioAnt) : null;
    return {
      p, unidades, precio, valor, coste, aportado, sinPrecio, entrada, compraConocida: Boolean(p.compra || (p.robo && ls.length > 1 && ls[0].fecha < (p.alta || ""))),
      fechaPrecio: sinPrecio ? null : s[s.length - 1][0],
      hoy, hoyPct: precioAnt ? precio / precioAnt - 1 : null,
      resultado: coste != null ? valor - coste : null,
      resultadoPct: coste ? valor / coste - 1 : null,
      precioMedio: coste != null && unidades ? coste / unidades : null,
      var: { s: variacion(s, 7), m: variacion(s, 30), a: variacion(s, 365), ytd: variacionDesde(s, `${(s.length ? s[s.length - 1][0] : "0000").slice(0, 4) - 1}-12-31`) },
      puntos: s.length,
      mercado: p.simbolo ? datos?.meta?.[p.simbolo]?.mercado || null : null,
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

  // Evolución: desde el primer día con precios de las posiciones con historial. Antes de su primer
  // precio, una posición cuenta con ese primer precio (así un fondo recién listado no deja el
  // gráfico vacío); sin precio automático, con el valor que se puso al darla de alta.
  const conHist = posiciones.filter((p) => (datos?.series?.[p.simbolo] || []).length >= 2);
  const conAlgo = posiciones.filter((p) => (datos?.series?.[p.simbolo] || []).length > 0);
  const inicio = conHist.length ? conHist.reduce((mn, p) => { const f = datos.series[p.simbolo][0][0]; return f < mn ? f : mn; }, "9999-12-31") : null;
  // …y desde que entraste en la primera: antes no tenías nada que valorar.
  const entradaMin = posiciones.reduce((mn, p) => lotes[p.id].reduce((m2, l) => (l.fecha < m2 ? l.fecha : m2), mn), "9999-12-31");
  const desdeSerie = inicio && entradaMin > inicio ? entradaMin : inicio;
  const fechasTodas = inicio ? [...new Set(conHist.flatMap((p) => datos.series[p.simbolo].map((x) => x[0])))].sort() : [];
  // El último día con precio en o antes de la entrada, para que la serie arranque en la entrada.
  const iArranque = fechasTodas.reduce((k, f, i) => (f <= desdeSerie ? i : k), 0);
  const fechas = fechasTodas.slice(iArranque);
  const primero = {};
  for (const p of conAlgo) { const s0 = datos.series[p.simbolo][0]; primero[p.id] = precioEUR(p, s0[0], datos); }
  const entidadDe = (p) => p.entidad || "Sin entidad";
  // Aportaciones (flujos) por fecha del gráfico: cada una cae en el primer día con precios en o
  // después de su fecha. Hacen falta para que la rentabilidad no cuente el dinero nuevo como ganancia.
  const flujos = new Map();
  for (const p of posiciones) {
    // Cada compra (la de entrada y cada aportación) es dinero que entra, no ganancia.
    for (const l of lotes[p.id]) {
      const f = fechas.find((x) => x >= l.fecha);
      if (!f) continue;
      const o = flujos.get(f) || { total: 0, porEntidad: {}, porPos: {} };
      const x = l.unidades * (precioEUR(p, f, datos) ?? 0);
      o.total += x;
      o.porEntidad[entidadDe(p)] = (o.porEntidad[entidadDe(p)] || 0) + x;
      o.porPos[p.id] = (o.porPos[p.id] || 0) + x;
      flujos.set(f, o);
    }
  }
  const serie = fechas.map((f) => {
    const porPos = {}, porEntidad = {}, porEntidadBase = {}, porPosBase = {}, invPos = {}, invEntidad = {}, ccEntidad = {};
    let v = 0, inv2 = 0, vcc = 0;
    for (const p of posiciones) {
      let x, xb;
      // x: lo que valía tu posición ese día (0 antes de entrar). xb: lo que valdría lo que tienes hoy
      // (para ver cómo ha ido el precio del producto, aunque entonces no lo tuvieras).
      if (conAlgo.includes(p)) { const pr = precioEUR(p, f, datos) ?? primero[p.id] ?? 0; x = unidadesEn(lotes[p.id], f) * pr; xb = unidadesEn(lotes[p.id], "9999-12-31") * pr; }
      else { xb = p.valorAlta || 0; x = f >= lotes[p.id][0].fecha ? xb : 0; }
      const e = entidadDe(p);
      porPos[p.id] = x; porPosBase[p.id] = xb; porEntidad[e] = (porEntidad[e] || 0) + x; v += x;
      // Sin aportaciones: para comparar rentabilidades, que el dinero nuevo no parezca ganancia.
      porEntidadBase[e] = (porEntidadBase[e] || 0) + xb;
      // Solo lo que tiene coste entra en «lo que ganas o pierdes» (valor y lo invertido, a la par).
      if (p.coste != null) { vcc += x; ccEntidad[e] = (ccEntidad[e] || 0) + x; }
      if (p.coste != null) {
        let ip = 0;
        for (const l of lotes[p.id]) if (l.fecha <= f) ip += l.coste;
        inv2 += ip; invPos[p.id] = ip; invEntidad[e] = (invEntidad[e] || 0) + ip;
      }
    }
    return { d: f, valor: v, invertido: inv2, valorCC: vcc, ccEntidad, porPos, porEntidad, porEntidadBase, porPosBase, invPos, invEntidad, flujo: flujos.get(f)?.total || 0, flujoEntidad: flujos.get(f)?.porEntidad || {}, flujoPos: flujos.get(f)?.porPos || {} };
  });

  // Lo que más se ha movido en su último cambio.
  const movidos = filas.filter((f) => f.hoyPct != null).sort((x, y) => Math.abs(y.hoyPct) - Math.abs(x.hoyPct)).slice(0, 4);

  return {
    filas, total, hoy, hoyPct: total - hoy ? hoy / (total - hoy) : null,
    costeTotal, resultado: conCoste.length ? valorConCoste - costeTotal : null,
    resultadoPct: costeTotal ? valorConCoste / costeTotal - 1 : null,
    sinCoste: filas.filter((f) => f.coste == null).length,
    porEntidad: agrupar((f) => f.p.entidad || "Sin entidad"),
    porTipo: agrupar((f) => (f.p.tipo === "accion" ? "Acciones" : f.p.robo ? "Fondos indexados" : "Fondos")),
    aportes, serie, movidos,
    ytd: serie.length > 1 ? rentabilidadTWR(serie, { desde: `${serie[serie.length - 1].d.slice(0, 4) - 1}-12-31` }).r : null,
    horaAcciones: filas.reduce((mx, f) => (f.p.tipo === "accion" && f.mercado > mx ? f.mercado : mx), 0),
    fechaPrecios: filas.reduce((mx, f) => (f.fechaPrecio && f.fechaPrecio > mx ? f.fechaPrecio : mx), ""),
  };
}

// Símbolos que el servidor tiene que seguir.
export const simbolosDe = (inv) => [...new Set((inv?.posiciones || []).map((p) => p.simbolo).filter(Boolean))];

// Importación de posiciones (texto JSON): valida y normaliza, sin aceptar campos raros.
// Fecha como la escribe la gente o la muestran las entidades: 2026-03-09, 09/03/2026, 09-03-2026.
export function leerFecha(x) {
  const t = String(x || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// Números como los escriben las entidades: «1.234,567» (español), «12.3456» o «1234.5600» (punto
// decimal, como en la ficha de algunas entidades) y «2.500» (millar). Un único punto seguido de exactamente
// tres cifras se toma como separador de millares; si no, como decimal.
export function leerNumero(x) {
  if (typeof x === "number") return isFinite(x) ? x : null;
  if (typeof x !== "string" || !x.trim()) return null;
  let t = x.trim().replace(/[\s€]/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if ((t.match(/\./g) || []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return isFinite(n) ? n : null;
}

export function normalizarPosiciones(lista, hoy) {
  if (!Array.isArray(lista)) throw new Error("Se esperaba una lista de posiciones.");
  const num = leerNumero;
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
    if (x.ticker) p.ticker = String(x.ticker).toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
    if (x.bolsa) p.bolsa = String(x.bolsa).slice(0, 60);
    // Desde cuándo lo tienes (primera compra): la evolución de tu posición empieza ese día.
    const compra = leerFecha(x.compra);
    if (compra) p.compra = compra;
    if (x.divisa) p.divisa = String(x.divisa).slice(0, 3);
    const part = num(x.participaciones), val = num(x.valorAlta), peso = num(x.pesoObjetivo);
    // Coste: el total invertido o, como lo dan las entidades, el coste (precio) medio por participación.
    const costeMedio = num(x.costeMedio);
    const coste = num(x.coste) ?? (costeMedio > 0 && part > 0 ? Math.round(costeMedio * part * 100) / 100 : null);
    if (part > 0) p.participaciones = part;
    if (val > 0) p.valorAlta = val;
    if (!(p.participaciones > 0) && !(p.valorAlta > 0)) throw new Error(`«${p.nombre}»: indica participaciones o valor actual.`);
    p.coste = coste > 0 ? coste : null;
    if (x.robo) p.robo = true;
    // Cotización ya revisada (elegida a mano o por el servidor): no se vuelve a buscar sola.
    if (x.revisado) p.revisado = true;
    if (x.buscado) p.buscado = true;
    if (peso > 0) p.pesoObjetivo = peso;
    return p;
  });
}

// Transferencias que parecen aportaciones periódicas: de «Ahorro e inversión», repetidas con el
// mismo concepto e importe en el último año. La más frecuente primero.
export function candidatosAportacion(movs) {
  const desde = dia(new Date(Date.now() - 400 * 86400000));
  const m = new Map();
  for (const x of movs || []) {
    if (x.omit || !(x.amount < 0) || x.category !== "Ahorro e inversión" || dia(x.date) < desde) continue;
    const imp = Math.round(Math.abs(x.amount));
    const k = x.pattern + "|" + imp;
    if (!m.has(k)) m.set(k, { patron: x.pattern, concepto: x.concept, importe: imp, n: 0, ultima: "" });
    const c = m.get(k); c.n++; if (dia(x.date) > c.ultima) c.ultima = dia(x.date);
  }
  return [...m.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n || b.importe - a.importe);
}

// Actualizar con una lista: lo que ya existe (mismo ISIN, mismo nombre o misma cotización) se
// sustituye conservando su identidad; lo nuevo se añade. Así recalibrar no duplica posiciones.
export function fusionarPosiciones(existentes, nuevas) {
  const out = [...(existentes || [])];
  let actualizadas = 0, añadidas = 0;
  for (const n of nuevas) {
    const i = buscarIgual(out, n);
    if (i >= 0) {
      const v = out[i];
      // Se conserva el nombre que ya usabas y la cotización ya elegida, salvo que la lista traiga otra;
      // y un dato que la lista no trae (coste, fecha de compra) no borra el que ya había.
      out[i] = { ...v, ...n, id: v.id, nombre: n.isin && n.isin === v.isin ? n.nombre : v.nombre, simbolo: n.simbolo || v.simbolo, revisado: n.simbolo ? n.revisado : v.revisado,
        coste: n.coste ?? v.coste, compra: n.compra || v.compra, alta: n.alta || v.alta, robo: n.robo ?? v.robo, pesoObjetivo: n.pesoObjetivo ?? v.pesoObjetivo };
      if (!out[i].compra) delete out[i].compra;
      // Si ahora se sabe el número de participaciones, el valor de alta ya no hace falta (y al revés).
      if (n.participaciones > 0) delete out[i].valorAlta;
      else if (n.valorAlta > 0) delete out[i].participaciones;
      actualizadas++;
    } else { out.push(n); añadidas++; }
  }
  return { posiciones: out, actualizadas, añadidas };
}

// ¿Cuál de las posiciones es la misma que n? Por ISIN, por nombre, por cotización y plataforma, o
// dentro de la misma plataforma por ticker o porque un nombre contiene al otro.
function buscarIgual(out, n) {
  const norm = (t) => String(t || "").trim().toLowerCase();
  {
    const misma = (p) => !n.entidad || norm(p.entidad) === norm(n.entidad);
    // El mismo valor con otro nombre («Soitec» y «Soitec SA»): por ticker (VRT ↔ VRT, SOI ↔ SOI.PA)
    // o porque un nombre contiene al otro, dentro de la misma plataforma.
    const porTicker = (p) => n.ticker && p.simbolo && (p.simbolo === n.ticker || p.simbolo.startsWith(n.ticker + ".") || p.ticker === n.ticker);
    const contiene = (a, b) => a.length >= 4 && b.length >= 4 && (a.startsWith(b + " ") || b.startsWith(a + " ") || a === b);
    const i = out.findIndex((p) => (n.isin && p.isin && n.isin === p.isin) || norm(p.nombre) === norm(n.nombre)
      || (n.simbolo && p.simbolo === n.simbolo && misma(p))
      || (misma(p) && (porTicker(p) || contiene(norm(p.nombre), norm(n.nombre)))));
    return i;
  }
}

/* Actualizar solo algunos datos (p. ej. la fecha de compra) de productos que ya tienes: cada
   elemento dice cuál es (ISIN o nombre, y si quieres plataforma o ticker) y qué cambia. */
export function actualizarCampos(existentes, cambios) {
  const out = [...(existentes || [])];
  let actualizadas = 0;
  const sinEncontrar = [];
  for (const c of cambios || []) {
    const n = { nombre: c.nombre, isin: c.isin ? String(c.isin).toUpperCase() : undefined, entidad: c.entidad, ticker: c.ticker ? String(c.ticker).toUpperCase() : undefined };
    const i = buscarIgual(out, n);
    if (i < 0) { sinEncontrar.push(c.nombre || c.isin || "?"); continue; }
    const v = { ...out[i] };
    const compra = leerFecha(c.compra);
    if (compra) v.compra = compra;
    for (const k of ["isin", "ticker", "bolsa"]) if (c[k]) v[k] = String(c[k]);
    const coste = leerNumero(c.coste), medio = leerNumero(c.costeMedio);
    if (coste > 0) v.coste = coste;
    else if (medio > 0 && v.participaciones > 0) v.coste = Math.round(medio * v.participaciones * 100) / 100;
    out[i] = v; actualizadas++;
  }
  return { posiciones: out, actualizadas, sinEncontrar };
}

/* Rentabilidad de un periodo, ponderada por tiempo (TWR, el estándar de gestoras y
   robo-advisors): se encadenan las variaciones de cada día descontando el dinero que entra ese día,
   así una aportación no cuenta como ganancia.  r = Π (V_t − F_t) / V_{t−1} − 1.
   Sin aportaciones equivale a valor final / valor inicial − 1. Devuelve también el índice (1 = inicio)
   para dibujarlo. Con `entidad`, solo esa plataforma. */
export function rentabilidadTWR(serie, { desde = "0000-00-00", entidad = null, pos = null } = {}) {
  if (!serie || serie.length < 2) return { r: null, indice: [] };
  const val = (p) => (pos ? p.porPos?.[pos] ?? 0 : entidad ? p.porEntidad?.[entidad] ?? 0 : p.valor);
  const flu = (p) => (pos ? p.flujoPos?.[pos] ?? 0 : entidad ? p.flujoEntidad?.[entidad] ?? 0 : p.flujo ?? 0);
  let base = 0;
  for (let i = 0; i < serie.length; i++) { if (serie[i].d <= desde) base = i; else break; }
  let idx = 1;
  const indice = [[serie[base].d, 1]];
  for (let i = base + 1; i < serie.length; i++) {
    const prev = val(serie[i - 1]);
    if (prev > 0) idx *= (val(serie[i]) - flu(serie[i])) / prev;
    indice.push([serie[i].d, idx]);
  }
  return { r: idx - 1, indice };
}

// Lo que la IA lee de unas capturas → posiciones listas para revisar. Si no se ve el número de
// participaciones, se toma el valor actual; si no hay ni eso, la fila queda para completarla.
export function posicionesDeCapturas(leido, entidad, hoy) {
  return (leido?.posiciones || []).map((x, i) => {
    const tipo = x.tipo === "accion" || x.tipo === "fondo" ? x.tipo : (x.ticker && !x.isin?.startsWith?.("IE") ? "accion" : "fondo");
    const fila = { nombre: String(x.nombre || "").trim(), entidad: entidad || leido.entidad || "Sin entidad", tipo, isin: x.isin || undefined, ticker: x.ticker || undefined, bolsa: x.bolsa || undefined,
      participaciones: x.participaciones ?? null, coste: x.coste ?? null, costeMedio: x.coste ? null : x.costeMedio ?? null, valorAlta: x.participaciones ? null : x.valor ?? null, alta: hoy };
    let p = null, error = null;
    try { [p] = normalizarPosiciones([fila], hoy); } catch (e) { error = e.message; }
    return { i, fila, p, error, valor: x.valor ?? null, incluir: !!p };
  });
}
