import { C, aiExplicarInversiones, fmtE0, nfNum, tnum } from "../core.js";
import { Btn, Card, Seg } from "../ui/comunes.jsx";
import { REFERENCIAS, curvaDe, curvaReferencia, destacadosPeriodo, divisaDe, indiceEn, resultadoPeriodo, sumarDias } from "../inversiones.js";
import { AlertTriangle, Coins, Flag, PieChart as IconoTarta, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";

/* ============================================================
   INVERSIONES · PANEL
   ============================================================
   Todo gira alrededor de UNA pregunta: «¿cuánto he ganado o perdido en este periodo, y por qué?».
   - Periodo: 1S, 1M, 3M, este año, 1A o todo. Si entraste después del inicio, cuenta desde que
     entraste (antes no tenías nada que ganar ni perder).
   - Ganancia del periodo = valor al final − valor al principio − lo que pusiste entre medias.
     Con «Todo» es exactamente la plusvalía de tu entidad (valor − invertido).
   - Qué la explica: lo que ha sumado o restado cada plataforma o producto en ese mismo periodo.
   - Frente al mercado: el mismo dinero, los mismos días, en un índice.
   Las fórmulas están en src/inversiones.js (resultadoPeriodo, curvaReferencia). */

export const PERIODOS = [
  { v: "1s", l: "1S", largo: "esta semana", dias: 7 },
  { v: "1m", l: "1M", largo: "el último mes", dias: 30 },
  { v: "3m", l: "3M", largo: "los últimos 3 meses", dias: 91 },
  { v: "ytd", l: "Año", largo: "lo que va de año" },
  { v: "1a", l: "1A", largo: "el último año", dias: 365 },
  { v: "max", l: "Total", largo: "en total" },
];
const REF_KEY = "finz:inv-referencia";
const leerRef = () => { try { const v = localStorage.getItem(REF_KEY); return v === "" ? "" : v || REFERENCIAS[0].simbolo; } catch { return REFERENCIAS[0].simbolo; } };
const guardarRef = (v) => { try { localStorage.setItem(REF_KEY, v); } catch { /* solo es una preferencia */ } };

export const pct = (v, signo = true, dec = 2) => (v == null || !isFinite(v) ? "–" : `${signo && v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: dec, minimumFractionDigits: dec })} %`);
export const eur0 = (v, signo = true) => (v == null || !isFinite(v) ? "–" : `${signo && v > 0.5 ? "+" : ""}${fmtE0(v)}`);
export const colorDe = (v) => (v == null || Math.abs(v) < 1e-9 ? C.muted : v > 0 ? C.income : C.expense);
export const fechaCorta = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
export const fechaLarga = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "");
// Colores de las series: distinguibles en claro y en oscuro (los mismos que el resto de la pestaña).
const PALETA = ["#2F7DE1", "#16A34A", "#E0A100", "#8B5CF6", "#E5484D", "#0EA5A4", "#EA6A2A", "#64748B"];
const ejeY = (v) => (Math.abs(v) >= 10000 ? nfNum.format(Math.round(v / 1000)) + "k" : nfNum.format(Math.round(v)));

// Dónde empieza el periodo en la serie: el último cierre en o antes de su primer día (−1 = todo).
export function inicioDe(serie, periodo) {
  if (!serie.length || periodo === "max") return -1;
  const fin = serie[serie.length - 1].d;
  const p = PERIODOS.find((x) => x.v === periodo);
  const desde = periodo === "ytd" ? `${Number(fin.slice(0, 4)) - 1}-12-31` : sumarDias(fin, -(p?.dias || 30));
  return indiceEn(serie, desde);
}

/* Todo lo de un periodo para un conjunto de productos: resultado, desde cuándo cuenta de verdad
   (si entraste después del inicio), la curva para el gráfico y lo destacable. */
// Con «Todo», el resultado es la plusvalía: solo cuenta lo que tiene coste (sin coste no se sabe).
export const idsConCoste = (a, ids, i0) => (i0 < 0 ? ids.filter((id) => a.filas.find((f) => f.p.id === id)?.coste != null) : ids);

export function usePeriodo(a, ids, periodo) {
  return useMemo(() => {
    const serie = a.serie;
    const i0 = inicioDe(serie, periodo);
    const idsG = idsConCoste(a, ids, i0);
    const cg = curvaDe(serie, idsG, i0 < 0);
    const curva = { ...cg, V: curvaDe(serie, ids).V };
    const res = resultadoPeriodo(cg, i0);
    // Primer día con algo tuyo dentro del periodo: el gráfico empieza ahí, no con ceros.
    let iVer = Math.max(0, i0);
    while (iVer < serie.length - 1 && !((idsG.length ? cg.V : curva.V)[iVer] > 0)) iVer++;
    const entraDespues = i0 < 0 || !(curva.V[i0] > 0);
    return { serie, curva, i0, iVer, res, idsG, entraDespues, desde: serie[iVer]?.d || null, hasta: serie[serie.length - 1]?.d || null, dest: destacadosPeriodo(serie, i0, res), puntos: serie.length - iVer };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, ids.join(), periodo]);
}

export const textoPeriodo = (per, periodo) => {
  const p = PERIODOS.find((x) => x.v === periodo);
  if (periodo === "max") return "en total (valor hoy − lo invertido)";
  if (per.entraDespues) return `desde que entraste (${fechaCorta(per.desde)})`;
  return `en ${p.largo}`;
};

/* ---------- La tarjeta principal: valor, resultado del periodo y el gráfico ---------- */
export function Panel({ a, ids, nombre, periodo, setPeriodo, referencia, setReferencia, cifras, accion, vacio }) {
  const [sobre, setSobre] = useState(null); // índice del día que señalas en el gráfico
  const per = usePeriodo(a, ids, periodo);
  const ref = useMemo(() => (referencia ? curvaReferencia(per.serie, per.idsG, a.contribuciones, a.datos, referencia, per.i0 < 0) : null), [per.serie, per.i0, per.idsG.join(), referencia, a]); // eslint-disable-line react-hooks/exhaustive-deps
  const resRef = ref ? resultadoPeriodo(ref, per.i0) : null;

  const off = Math.max(0, per.i0);
  const datos = useMemo(() => {
    const out = [];
    const paso = Math.max(1, Math.ceil((per.serie.length - per.iVer) / 240));
    for (let i = per.iVer; i < per.serie.length; i++) {
      if ((i - per.iVer) % paso && i !== per.serie.length - 1) continue;
      const k = i - off;
      out.push({ i, d: per.serie[i].d, et: fechaCorta(per.serie[i].d), v: per.curva.V[i], g: per.res.g[k] ?? null, ref: resRef?.g[k] ?? null });
    }
    return out;
  }, [per, resRef, off]);

  const h = sobre != null ? datos.find((x) => x.i === sobre) : null;
  const gan = h ? per.res.g[h.i - off] : per.res.ganancia;
  const ganPct = h ? per.res.r[h.i - off] : per.res.pct;
  const gRef = h ? h.ref : resRef?.ganancia;
  const valor = h ? h.v : per.curva.V[per.curva.V.length - 1] || 0;
  const color = colorDe(per.res.ganancia);
  const corto = per.puntos < 4;
  const mover = (st) => setSobre(st?.activePayload?.[0]?.payload?.i ?? null);
  const dif = gan != null && gRef != null ? gan - gRef : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-500">{nombre}{h ? ` · ${fechaLarga(h.d)}` : ""}</div>
          <div className="text-3xl font-semibold tracking-tight" style={tnum}>{fmtE0(valor)}</div>
          <div className="mt-0.5 text-sm font-medium" style={{ ...tnum, color: colorDe(gan) }}>
            {eur0(gan)} ({pct(ganPct)}) <span className="font-normal text-slate-500">{h ? "hasta ese día" : textoPeriodo(per, periodo)}</span>
          </div>
        </div>
        {accion}
      </div>

      {/* Frente al mercado, en una línea: el mismo dinero, los mismos días, en un índice. */}
      {!corto && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500" style={tnum}>
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: C.muted }} aria-hidden="true" />
          <select aria-label="Comparar con" value={referencia} onChange={(e) => { setReferencia(e.target.value); guardarRef(e.target.value); }}
            className="w-auto max-w-[9.5rem] rounded border-0 bg-transparent py-0 pl-0 pr-6 text-xs font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {REFERENCIAS.map((x) => <option key={x.simbolo} value={x.simbolo}>{x.nombre}</option>)}
            <option value="">Sin comparar</option>
          </select>
          {referencia && (gRef == null ? <span>cargando…</span> : <>
            <span style={{ color: colorDe(gRef) }}>{eur0(gRef)}</span>
            {dif != null && Math.abs(dif) >= 1 && <span>· vas <strong style={{ color: colorDe(dif) }}>{fmtE0(Math.abs(dif))} {dif > 0 ? "por delante" : "por detrás"}</strong></span>}
          </>)}
        </div>
      )}

      <div className="mt-3" style={{ height: 200 }} onMouseLeave={() => setSobre(null)}>
        {corto ? vacio : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datos} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} onMouseMove={mover} onTouchMove={mover} onMouseLeave={() => setSobre(null)} onTouchEnd={() => setSobre(null)}>
              <defs>
                <linearGradient id="gradPanel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={C.line} />
              <XAxis dataKey="et" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={44} />
              <YAxis orientation="right" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} tickFormatter={ejeY} />
              <Tooltip content={() => null} cursor={{ stroke: C.lineStrong, strokeDasharray: "3 3" }} />
              <ReferenceLine y={0} stroke={C.lineStrong} />
              <Area type="monotone" dataKey="g" stroke={color} strokeWidth={2} fill="url(#gradPanel)" baseValue={0} isAnimationActive={false} />
              {ref && <Line type="monotone" dataKey="ref" stroke={C.muted} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2"><Seg ariaLabel="Periodo" value={periodo} onChange={(v) => { setPeriodo(v); setSobre(null); }} options={PERIODOS} /></div>
      {cifras}
    </Card>
  );
}

/* ---------- Reparto: dónde está tu dinero (plataforma, tipo o divisa) ---------- */
export function Reparto({ filas, datos, onAbrir }) {
  const [por, setPor] = useState("entidad");
  const [dentro, setDentro] = useState(null); // grupo abierto (drill down): sus productos
  const grupoDe = (f) => (por === "entidad" ? f.p.entidad || "Sin entidad" : por === "tipo" ? (f.p.tipo === "accion" ? "Acciones y ETF" : f.p.robo ? "Fondos indexados" : "Fondos") : divisaDe(f.p, datos));
  const grupos = useMemo(() => {
    const m = new Map();
    for (const f of filas) m.set(grupoDe(f), (m.get(grupoDe(f)) || 0) + f.valor);
    const total = [...m.values()].reduce((t, v) => t + v, 0);
    return [...m.entries()].map(([nombre, valor]) => ({ k: nombre, nombre, valor, peso: total ? valor / total : 0 })).sort((x, y) => y.valor - x.valor).map((g, i) => ({ ...g, color: PALETA[i % PALETA.length] }));
  }, [filas, datos, por]); // eslint-disable-line react-hooks/exhaustive-deps
  // Dentro de un grupo: sus productos, en tonos de su color.
  const g0 = dentro ? grupos.find((g) => g.k === dentro) : null;
  const items = useMemo(() => {
    if (!g0) return grupos;
    const fs = filas.filter((f) => grupoDe(f) === g0.k).sort((x, y) => y.valor - x.valor);
    const total = fs.reduce((t, f) => t + f.valor, 0);
    return fs.map((f, i) => ({ k: f.p.id, id: f.p.id, nombre: f.p.nombre, valor: f.valor, peso: total ? f.valor / total : 0, color: g0.color, opacidad: Math.max(0.35, 1 - i * (0.65 / Math.max(1, fs.length - 1))) }));
  }, [g0, grupos, filas]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!grupos.length) return null;
  const total = items.reduce((t, x) => t + x.valor, 0);
  const elegir = (x) => (x.id ? onAbrir?.(x.id) : setDentro(x.k));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 text-sm font-semibold">
          {g0 && <button type="button" onClick={() => setDentro(null)} aria-label="Volver al reparto" className="rounded-md px-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">‹</button>}
          <span className="truncate">{g0 ? g0.nombre : "Dónde está tu dinero"}</span>
        </h3>
        {!g0 && <Seg ariaLabel="Repartir por" value={por} onChange={(v) => { setPor(v); setDentro(null); }} options={[{ v: "entidad", l: "Plataforma" }, { v: "tipo", l: "Tipo" }, { v: "divisa", l: "Divisa" }]} />}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="valor" nameKey="nombre" innerRadius={38} outerRadius={58} paddingAngle={items.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}
                onClick={(d) => d?.payload && elegir(d.payload)} style={{ cursor: "pointer" }}>
                {items.map((x) => <Cell key={x.k} fill={x.color} fillOpacity={x.opacidad ?? 1} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* En el centro, el total de lo que se ve. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" style={tnum}>
            <span className="text-xs font-semibold leading-tight">{fmtE0(total)}{g0 && <span className="block text-[10px] font-normal text-slate-500">{pct(g0.peso, false, 0)} del total</span>}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1 text-sm">
          {items.map((x) => (
            <li key={x.k}>
              <button type="button" onClick={() => elegir(x)} className="flex w-full items-start gap-1.5 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={tnum}>
                <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: x.color, opacity: x.opacidad ?? 1 }} />
                <span className="min-w-0 flex-1"><span className="block leading-snug">{x.nombre}</span><span className="block text-xs text-slate-500"><strong className="text-slate-700">{pct(x.peso, false, 0)}</strong> · {fmtE0(x.valor)}</span></span>
                <span className="mt-0.5 text-slate-400" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* ---------- Qué ha movido tu cartera: lo que suma o resta cada parte en el periodo ---------- */
export function QueHaMovido({ a, partes, periodo, onElegir, ai, aiOn, filasPorId, control, volver }) {
  const per = usePeriodo(a, partes.flatMap((x) => x.ids), periodo);
  const filas = useMemo(() => partes.map((x) => {
    const idsG = idsConCoste(a, x.ids, per.i0);
    const c = curvaDe(a.serie, idsG, per.i0 < 0);
    const r = resultadoPeriodo(c, per.i0);
    // Si esta parte entró después de que empiece el periodo, cuenta desde ese día: se dice en la fila.
    let iE = Math.max(0, per.i0);
    while (iE < a.serie.length - 1 && !(c.V[iE] > 0)) iE++;
    const desde = per.i0 >= 0 && !(c.V[per.i0] > 0) ? a.serie[iE]?.d : null;
    return { ...x, g: r.ganancia ?? 0, r: idsG.length ? r.pct : null, sinCoste: !idsG.length, desde };
  }).sort((x, y) => y.g - x.g), [partes, a.serie, per.i0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!filas.length) return null;
  const max = Math.max(...filas.map((x) => Math.abs(x.g)), 1);
  const total = per.res.ganancia;
  const p = PERIODOS.find((x) => x.v === periodo);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1 text-sm font-semibold">
          {volver && <button type="button" onClick={volver.onClick} className="rounded-md px-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Volver a ${volver.a}`}>‹</button>}
          <span className="truncate">Qué explica tu resultado{volver ? ` · ${volver.aqui}` : ""}</span>
        </h3>{control}
      </div>
      <p className="mt-1 text-sm text-slate-600" style={tnum}>
        {periodo === "max" ? "En total" : p.largo.replace(/^./, (c) => c.toUpperCase())} {total >= 0 ? "has ganado" : "has perdido"} <strong style={{ color: colorDe(total) }}>{fmtE0(Math.abs(total || 0))}</strong>. Así se reparte:
      </p>
      <div className="mt-3 space-y-3">
        {filas.map((x) => (
          <button key={x.k} type="button" onClick={() => onElegir(x)} className="block w-full rounded-lg text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                {x.color && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />}
                <span className="truncate">{x.nombre}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-semibold" style={{ ...tnum, color: colorDe(x.g) }}>{eur0(x.g)}<span className="text-slate-400" aria-hidden="true">›</span></span>
            </span>
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: C.line }} aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (Math.abs(x.g) / max) * 100)}%`, background: x.g >= 0 ? C.income : C.expense }} />
              </span>
              <span className="w-32 shrink-0 text-right text-[11px] text-slate-500" style={tnum}>
                {x.sinCoste ? "sin coste" : `${pct(x.r, true, 1)}${x.desde ? ` · desde ${fechaCorta(x.desde)}` : ""}`}
              </span>
            </span>
          </button>
        ))}
      </div>
      {aiOn && <PorQue a={a} periodo={periodo} per={per} ai={ai} filasPorId={filasPorId} ids={partes.flatMap((x) => x.ids)} />}
    </Card>
  );
}

/* ---------- «¿Por qué?»: la IA busca las noticias que explican los movimientos ---------- */
const IA_KEY = "finz:inv-ia:v1";
function PorQue({ a, per, ai, filasPorId, ids }) {
  const items = useMemo(() => ids.map((id) => {
    const r = resultadoPeriodo(curvaDe(a.serie, [id], per.i0 < 0), per.i0);
    const f = filasPorId[id];
    return f && r.pct != null ? { nombre: f.p.nombre, ticker: f.p.simbolo, isin: f.p.isin, tipo: f.p.tipo, pct: r.pct, g: Math.abs(r.ganancia || 0) } : null;
  }).filter(Boolean).sort((x, y) => y.g - x.g).slice(0, 6), [ids.join(), per, a.serie]); // eslint-disable-line react-hooks/exhaustive-deps
  const clave = `${per.desde}|${per.hasta}|${items.map((x) => x.nombre).join(",")}`;
  const [estado, setEstado] = useState(() => { try { const c = JSON.parse(localStorage.getItem(IA_KEY) || "null"); return c?.clave === clave ? { texto: c.texto } : null; } catch { return null; } });
  const [cargando, setCargando] = useState(false);
  const actual = estado && (estado.clave === undefined || estado.clave === clave) ? estado : null;
  const pedir = async () => {
    setCargando(true);
    try {
      const r = await aiExplicarInversiones(ai, { desde: fechaLarga(per.desde), hasta: fechaLarga(per.hasta), items });
      setEstado({ texto: r.texto, clave });
      try { localStorage.setItem(IA_KEY, JSON.stringify({ clave, texto: r.texto })); } catch { /* sin espacio */ }
    } catch (e) { setEstado({ error: e.message, clave }); }
    finally { setCargando(false); }
  };
  if (!items.length) return null;
  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: C.line }}>
      {actual?.texto ? (
        <div className="text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.accent }}><Sparkles size={13} /> Por qué se ha movido</div>
          <TextoIA texto={actual.texto} />
          <p className="mt-1.5 text-[10px] text-slate-400">Resumen de la IA con búsqueda web: puede equivocarse. No es una recomendación. <button type="button" className="underline" onClick={pedir} disabled={cargando}>{cargando ? "Buscando…" : "Volver a preguntar"}</button></p>
        </div>
      ) : (
        <>
          <Btn size="sm" onClick={pedir} disabled={cargando}>{cargando ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} {cargando ? "Buscando noticias…" : "¿Por qué se ha movido? Pregunta a la IA"}</Btn>
          <p className="mt-1 text-[10px] text-slate-400">Busca en la web las noticias del periodo. Solo envía nombres y porcentajes, nunca tus importes. Gasta unos céntimos de tu proveedor de IA.</p>
          {actual?.error && <p className="mt-1 text-xs" style={{ color: C.expense }}>{actual.error}</p>}
        </>
      )}
    </div>
  );
}

// Markdown mínimo de la IA: párrafos, viñetas y **negrita**. Sin HTML: todo es texto.
function TextoIA({ texto }) {
  const negrita = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (/^\*\*[^*]+\*\*$/.test(x) ? <strong key={i}>{x.slice(2, -2)}</strong> : x));
  const lineas = String(texto).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-1 text-slate-700">
      {lineas.map((l, i) => (/^[-*•]\s+/.test(l)
        ? <p key={i} className="flex gap-1.5"><span className="text-slate-400">•</span><span>{negrita(l.replace(/^[-*•]\s+/, ""))}</span></p>
        : <p key={i}>{negrita(l.replace(/^#+\s*/, ""))}</p>))}
    </div>
  );
}

export const referenciaInicial = leerRef;

/* ---------- Lo destacable: frases cortas con lo que importa del periodo y de tu cartera ---------- */
export function Destacados({ a, ids, periodo, filas, datos, onFecha, onBuscar }) {
  const per = usePeriodo(a, ids, periodo);
  const items = [];
  const { max, mejor, peor } = per.dest;
  const hoy = per.res.ganancia;
  if (max && hoy != null && max.g - hoy > Math.max(50, Math.abs(per.res.inicio + per.res.puesto) * 0.01) && max.d !== per.hasta)
    items.push({ icon: Flag, color: C.warn, t: <>Máximo del periodo: <strong>{eur0(max.g)}</strong> el {fechaCorta(max.d)} (hoy {eur0(hoy)}).</> });
  if ((mejor && mejor.g > 0.5) || (peor && peor.g < -0.5))
    items.push({ icon: TrendingUp, color: C.muted, t: <>{mejor && mejor.g > 0.5 && <>Mejor día <strong style={{ color: C.income }}>{eur0(mejor.g)}</strong> ({fechaCorta(mejor.d)})</>}{mejor && mejor.g > 0.5 && peor && peor.g < -0.5 && " · "}{peor && peor.g < -0.5 && <>peor <strong style={{ color: C.expense }}>{eur0(peor.g)}</strong> ({fechaCorta(peor.d)})</>}</> });
  // Divisas: lo que cotiza fuera del euro se mueve también con el tipo de cambio.
  const total = filas.reduce((t, f) => t + f.valor, 0);
  const porDiv = {};
  for (const f of filas) { const d = divisaDe(f.p, datos); if (d !== "EUR") porDiv[d] = (porDiv[d] || 0) + f.valor; }
  for (const [d, v] of Object.entries(porDiv).sort((x, y) => y[1] - x[1]).slice(0, 2)) {
    if (total && v / total > 0.05) items.push({ icon: Coins, color: C.accent, t: <>{pct(v / total, false, 0)} en {d === "USD" ? "dólares" : d}: si el {d === "USD" ? "dólar" : d} cae un 5 %, unos <strong>−{fmtE0(v * 0.05)}</strong>.</> });
  }
  // Concentración: cuánto pesan tus 3 productos más grandes.
  if (filas.length > 4 && total) {
    const top = [...filas].sort((x, y) => y.valor - x.valor).slice(0, 3);
    const peso = top.reduce((t, f) => t + f.valor, 0) / total;
    if (peso > 0.6) items.push({ icon: IconoTarta, color: C.accent, t: <>3 productos son el <strong>{pct(peso, false, 0)}</strong>: {top.map((f) => f.p.nombre).join(", ")}.</> });
  }
  const sinFecha = filas.filter((f) => !f.compraConocida && !f.sinPrecio);
  if (sinFecha.length) items.push({ icon: AlertTriangle, color: C.muted, t: <>{sinFecha.length === 1 ? `«${sinFecha[0].p.nombre}»` : `${sinFecha.length} productos`} sin fecha de compra: cuentan como si los tuvieras desde antes. <button type="button" className="underline" onClick={() => onFecha(sinFecha[0].p.id)}>Poner fecha</button></> });
  for (const f of filas.filter((x) => x.sinPrecio)) items.push({ icon: AlertTriangle, color: C.expense, t: <>«{f.p.nombre}» sin precio automático: vale lo que pusiste. <button type="button" className="underline" onClick={() => onBuscar(f.p)}>Buscar su cotización</button></> });
  if (!items.length) return null;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Lo destacable</h3>
      <ul className="mt-2 space-y-2">
        {items.map((x, i) => { const I = x.icon; return <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><I size={15} className="mt-0.5 shrink-0" style={{ color: x.color }} /><span style={tnum}>{x.t}</span></li>; })}
      </ul>
    </Card>
  );
}

// Sin historia propia todavía (p. ej. sin fecha de compra): qué falta y cómo ha ido el precio.
export function SinHistoria({ a, ids, desde, robo, candidato, onUsarAportacion, onFecha, primerId }) {
  const s = useMemo(() => {
    const pts = a.serie.slice(-260).map((p) => ({ et: fechaCorta(p.d), v: ids.reduce((t, id) => t + (p.porPosBase?.[id] || 0), 0) }));
    const b = pts.find((x) => x.v > 0)?.v;
    return b ? pts.map((x) => ({ ...x, r: (x.v / b - 1) * 100 })) : [];
  }, [a.serie, ids.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = s.length ? s[s.length - 1].r / 100 : null;
  return (
    <div className="flex h-full flex-col">
      <p className="text-xs text-slate-600">Solo sé lo que tienes aquí desde el {fechaLarga(desde)}, así que aún no hay evolución tuya que dibujar.{" "}
        {robo && candidato ? <>Si usas tus transferencias de {fmtE0(candidato.importe)}, la reconstruyo desde tu primera aportación. <button type="button" className="font-medium underline" style={{ color: C.accent }} onClick={onUsarAportacion}>Usarlas</button></>
          : <>Pon la fecha de compra y la verás desde entonces. <button type="button" className="font-medium underline" style={{ color: C.accent }} onClick={() => onFecha(primerId)}>Poner fecha</button></>}
      </p>
      {s.length > 1 && (
        <>
          <p className="mt-2 text-[11px] text-slate-500" style={tnum}>Mientras, el precio de lo que tienes en el último año: <strong style={{ color: colorDe(r) }}>{pct(r)}</strong></p>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={s} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="et" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={44} />
                <YAxis hide domain={["auto", "auto"]} />
                <Line type="monotone" dataKey="r" stroke={C.muted} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
