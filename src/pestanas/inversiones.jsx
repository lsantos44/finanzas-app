import { C, fmtE, fmtE0, nfNum, tnum } from "../core.js";
import { Btn, Card, Modal, Seg } from "../ui/comunes.jsx";
import { analizarInversiones, candidatosAportacion, fusionarPosiciones, normalizarPosiciones, serieEUR, simbolosDe, dia, sumarDias, divisaDe } from "../inversiones.js";
import { AlertTriangle, ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Repeat, Search, Trash2, Upload, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ============================================================
   PESTAÑA INVERSIONES
   ============================================================
   Qué tienes lo guardas tú (posiciones, en tu configuración); los precios llegan solos cada
   noche desde tu servidor. La lógica de cálculo está en src/inversiones.js. */

const PRECIOS_KEY = "finz:precios:v1";
const SEGUIDOS_KEY = "finz:inv-seguidos";
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio: se vuelve a pedir */ } };

const pct = (v, signo = true) => (v == null || !isFinite(v) ? "–" : `${signo && v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`);
const eur = (v, signo = false) => (v == null ? "–" : `${signo && v > 0 ? "+" : ""}${fmtE(v)}`);
const colorDe = (v) => (v == null || Math.abs(v) < 1e-9 ? C.muted : v > 0 ? C.income : C.expense);
const fechaCorta = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "");
const fechaLarga = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "");
const RANGOS = [{ v: 30, l: "1M" }, { v: 182, l: "6M" }, { v: 365, l: "1A" }, { v: 0, l: "Todo" }];
// Colores de las series (entidades, productos): distinguibles en claro y en oscuro.
const PALETA = ["#2F7DE1", "#16A34A", "#E0A100", "#8B5CF6", "#E5484D", "#0EA5A4", "#EA6A2A", "#64748B"];
const recortar = (serie, rango) => {
  if (!serie?.length) return [];
  const desde = rango ? sumarDias(serie[serie.length - 1].d, -rango) : "0000-00-00";
  const s = serie.filter((p) => p.d >= desde);
  const paso = Math.max(1, Math.ceil(s.length / 260));
  return s.filter((_, i) => i % paso === 0 || i === s.length - 1).map((p) => ({ ...p, et: fechaCorta(p.d) }));
};
const ejeY = (v) => (Math.abs(v) >= 10000 ? nfNum.format(Math.round(v / 1000)) + "k" : nfNum.format(Math.round(v * 100) / 100));

function Cifra({ label, children, sub, color }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold" style={{ ...tnum, color: color || C.ink }}>{children}</div>
      {sub && <div className="text-xs" style={{ ...tnum, color: color || C.muted }}>{sub}</div>}
    </div>
  );
}

function GraficoEvolucion({ serie, conInvertido, referencia, alto = 200 }) {
  const [rango, setRango] = useState(365);
  const datos = useMemo(() => {
    if (!serie?.length) return [];
    const desde = rango ? sumarDias(serie[serie.length - 1].d, -rango) : "0000-00-00";
    const s = serie.filter((p) => p.d >= desde);
    const paso = Math.max(1, Math.ceil(s.length / 260));
    return s.filter((_, i) => i % paso === 0 || i === s.length - 1).map((p) => ({ ...p, et: fechaCorta(p.d) }));
  }, [serie, rango]);
  if (datos.length < 2) return <p className="py-8 text-center text-sm text-slate-400">El gráfico aparecerá cuando lleguen los precios.</p>;
  const ini = datos[0].valor, fin = datos[datos.length - 1].valor;
  const sube = fin >= ini;
  const color = sube ? C.income : C.expense;
  const TT = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.line }}>
        <div className="font-medium">{fechaLarga(p.d)}</div>
        <div className="mt-0.5 font-semibold" style={tnum}>{fmtE(p.valor)}</div>
        {conInvertido && p.invertido != null && <div className="text-slate-500" style={tnum}>Invertido {fmtE0(p.invertido)}</div>}
      </div>
    );
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ ...tnum, color }}>{pct(ini ? fin / ini - 1 : null)} en el periodo</span>
        <Seg ariaLabel="Periodo del gráfico" value={rango} onChange={setRango} options={RANGOS} />
      </div>
      <div style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datos} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradInv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="et" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={48} />
            <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={58} domain={["auto", "auto"]}
              tickFormatter={(v) => (Math.abs(v) >= 10000 ? nfNum.format(Math.round(v / 1000)) + "k" : nfNum.format(Math.round(v * 100) / 100))} />
            <Tooltip content={<TT />} cursor={{ stroke: C.lineStrong }} />
            <Area type="monotone" dataKey="valor" stroke={color} strokeWidth={2} fill="url(#gradInv)" isAnimationActive={false} />
            {conInvertido && <Line type="stepAfter" dataKey="invertido" stroke={C.muted} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
            {referencia != null && <ReferenceLine y={referencia} ifOverflow="extendDomain" stroke={C.muted} strokeDasharray="4 3" label={{ value: "Tu precio medio", position: "insideTopLeft", fontSize: 10, fill: C.muted }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* Evolución de la cartera, de tres formas: el total (con lo invertido), cómo se reparte por
   plataforma a lo largo del tiempo, y comparando la rentabilidad de plataformas y productos
   (en %, desde el inicio del periodo, sin contar el dinero nuevo como ganancia). */
function EvolucionCartera({ a, inv, datos }) {
  const [modo, setModo] = useState("total");
  const [rango, setRango] = useState(365);
  const entidades = a.porEntidad.map((g) => g.nombre);
  const [elegidos, setElegidos] = useState(() => entidades.map((e) => "e:" + e));
  const datosR = useMemo(() => recortar(a.serie, rango), [a.serie, rango]);

  const comparacion = useMemo(() => {
    if (modo !== "comparar" || datosR.length < 2) return { filas: [], claves: [] };
    const claves = elegidos.slice(0, 8);
    const series = {};
    for (const k of claves) {
      if (k.startsWith("e:")) series[k] = datosR.map((p) => p.porEntidadBase?.[k.slice(2)] ?? null);
      else {
        const pos = inv.posiciones.find((p) => p.id === k.slice(2));
        const s = pos ? serieEUR(pos, datos) : [];
        const mapa = new Map(s);
        let ult = null;
        series[k] = datosR.map((p) => { if (mapa.has(p.d)) ult = mapa.get(p.d); return ult; });
      }
    }
    const filas = datosR.map((p, i) => {
      const o = { d: p.d, et: p.et };
      for (const k of claves) { const base = series[k].find((x) => x); const v = series[k][i]; o[k] = base && v ? (v / base - 1) * 100 : null; }
      return o;
    });
    return { filas, claves };
  }, [modo, datosR, elegidos, inv.posiciones, datos]);

  const nombreDe = (k) => (k.startsWith("e:") ? k.slice(2) : inv.posiciones.find((p) => p.id === k.slice(2))?.nombre || "?");
  // Un color fijo por plataforma (el mismo que en «Por plataforma» y en la barra de reparto) y
  // por producto, aunque cambie qué se compara.
  const colorDe2 = (k) => {
    if (k.startsWith("e:")) return PALETA[Math.max(0, entidades.indexOf(k.slice(2))) % PALETA.length];
    return PALETA[(entidades.length + Math.max(0, inv.posiciones.findIndex((p) => p.id === k.slice(2)))) % PALETA.length];
  };
  const alternar = (k) => setElegidos((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k].slice(-8)));

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Evolución</h3>
        <Seg ariaLabel="Qué ver en el gráfico" value={modo} onChange={setModo} options={[{ v: "total", l: "Total" }, { v: "entidad", l: "Por plataforma" }, { v: "comparar", l: "Comparar" }]} />
      </div>
      {modo === "total" && (
        <>
          <p className="mb-2 text-xs text-slate-500">Con lo que tienes hoy, hacia atrás{inv.aportacion ? ", sumando cada aportación desde que llega" : ""}. La línea discontinua es lo invertido.</p>
          <GraficoEvolucion serie={a.serie} conInvertido={a.costeTotal > 0} />
        </>
      )}
      {modo !== "total" && (
        <div className="mb-2 flex justify-end"><Seg ariaLabel="Periodo del gráfico" value={rango} onChange={setRango} options={RANGOS} /></div>
      )}
      {modo === "entidad" && (datosR.length < 2 ? <p className="py-8 text-center text-sm text-slate-400">El gráfico aparecerá cuando lleguen los precios.</p> : (
        <>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datosR.map((p) => ({ et: p.et, d: p.d, ...p.porEntidad }))} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="et" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={48} />
                <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={58} tickFormatter={ejeY} />
                <Tooltip formatter={(v, n) => [fmtE0(v), n]} labelFormatter={(_, pl) => fechaLarga(pl?.[0]?.payload?.d)} contentStyle={{ borderRadius: 12, borderColor: C.line, fontSize: 12 }} />
                {[...entidades].reverse().map((e) => { const i = entidades.indexOf(e); return <Area key={e} type="monotone" dataKey={e} stackId="1" stroke={PALETA[i % PALETA.length]} fill={PALETA[i % PALETA.length]} fillOpacity={0.35} isAnimationActive={false} />; })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {a.porEntidad.map((g, i) => <span key={g.nombre} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />{g.nombre} · {fmtE0(g.valor)}</span>)}
          </div>
        </>
      ))}
      {modo === "comparar" && (
        <>
          <p className="mb-2 text-xs text-slate-500">Rentabilidad en el periodo: plataformas (sin contar las aportaciones como ganancia) y productos (su precio). Toca para añadir o quitar.</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[...entidades.map((e) => "e:" + e), ...inv.posiciones.map((p) => "p:" + p.id)].map((k) => {
              const on = elegidos.includes(k);
              return (
                <button key={k} type="button" onClick={() => alternar(k)} aria-pressed={on}
                  className={`max-w-[12rem] truncate rounded-full border px-2.5 py-1 text-xs ${k.startsWith("e:") ? "font-semibold" : ""}`}
                  style={on ? { borderColor: colorDe2(k), color: colorDe2(k), background: C.surfaceAlt } : { borderColor: C.line, color: C.muted }}>
                  {nombreDe(k)}
                </button>
              );
            })}
          </div>
          {comparacion.filas.length < 2 || !comparacion.claves.length ? <p className="py-8 text-center text-sm text-slate-400">Elige qué comparar.</p> : (
            <>
              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparacion.filas} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={C.line} />
                    <XAxis dataKey="et" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={48} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v)}%`} />
                    <ReferenceLine y={0} stroke={C.lineStrong} />
                    <Tooltip formatter={(v, k) => [pct(v / 100), nombreDe(k)]} labelFormatter={(_, pl) => fechaLarga(pl?.[0]?.payload?.d)} contentStyle={{ borderRadius: 12, borderColor: C.line, fontSize: 12 }} />
                    {comparacion.claves.map((k) => <Line key={k} type="monotone" dataKey={k} stroke={colorDe2(k)} strokeWidth={k.startsWith("e:") ? 2.25 : 1.5} dot={false} connectNulls isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {comparacion.claves.map((k) => { const ult = comparacion.filas[comparacion.filas.length - 1][k]; return (
                  <span key={k} className="flex min-w-0 items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorDe2(k) }} /><span className="truncate">{nombreDe(k)}</span><span className="ml-auto shrink-0 font-semibold" style={{ ...tnum, color: colorDe(ult) }}>{ult == null ? "–" : pct(ult / 100)}</span></span>
                ); })}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Reparto({ grupos, total }) {
  if (!total) return null;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: C.line }} role="img" aria-label={grupos.map((g) => `${g.nombre} ${pct(g.peso, false)}`).join(", ")}>
        {grupos.map((g, i) => <div key={g.nombre} style={{ width: `${g.peso * 100}%`, background: PALETA[i % PALETA.length] }} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {grupos.map((g, i) => <span key={g.nombre} className="inline-flex items-center gap-1" style={tnum}><span className="inline-block h-2 w-2 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />{g.nombre} {pct(g.peso, false)}</span>)}
      </div>
    </div>
  );
}

function Mini({ serie }) {
  if (!serie || serie.length < 2) return null;
  const s = serie.slice(-60).map(([d, v]) => ({ d, v }));
  const color = s[s.length - 1].v >= s[0].v ? C.income : C.expense;
  return (
    <div style={{ height: 28, width: 72 }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={s} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="none" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function FilaPosicion({ f, datos, onAbrir }) {
  return (
    <button type="button" onClick={() => onAbrir(f.p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{f.p.nombre}</div>
        <div className="truncate text-xs text-slate-500" style={tnum}>
          {f.sinPrecio ? <span style={{ color: C.expense }}>Sin precio automático</span>
            : <>{nfNum.format(Math.round(f.unidades * 1000) / 1000)} × {fmtE(f.precio)}{f.fechaPrecio ? ` · ${fechaCorta(f.fechaPrecio)}` : ""}</>}
        </div>
      </div>
      <Mini serie={serieEUR(f.p, datos)} />
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold" style={tnum}>{fmtE0(f.valor)}</div>
        <div className="text-xs" style={{ ...tnum, color: colorDe(f.hoyPct) }}>{f.hoyPct == null ? "–" : pct(f.hoyPct)}</div>
      </div>
    </button>
  );
}

function Grupo({ g, datos, onAbrir, nota }) {
  const [abierto, setAbierto] = useState(true);
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
        {abierto ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{g.nombre}</div>
          <div className="text-xs text-slate-500" style={tnum}>{pct(g.peso, false)} del total · {g.filas.length} {g.filas.length === 1 ? "producto" : "productos"}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold" style={tnum}>{fmtE0(g.valor)}</div>
          <div className="text-xs" style={{ ...tnum, color: colorDe(g.resultado) }}>{g.resultado == null ? "sin coste" : `${eur(g.resultado, true)} (${pct(g.resultadoPct)})`}</div>
        </div>
      </button>
      {abierto && <div className="divide-y border-t" style={{ borderColor: C.line }}>{g.filas.map((f) => <FilaPosicion key={f.p.id} f={f} datos={datos} onAbrir={onAbrir} />)}</div>}
      {abierto && nota && <div className="border-t px-4 py-2.5" style={{ borderColor: C.line }}>{nota}</div>}
    </Card>
  );
}

function Detalle({ f, datos, onClose, onEditar, onBorrar }) {
  const serie = useMemo(() => serieEUR(f.p, datos).map(([d, v]) => ({ d, valor: v })), [f, datos]);
  const div = divisaDe(f.p, datos);
  return (
    <Modal title={f.p.nombre} subtitle={[f.p.entidad, f.p.tipo === "accion" ? "Acción" : "Fondo", f.p.simbolo || f.p.isin].filter(Boolean).join(" · ")} onClose={onClose} wide
      footer={<div className="flex flex-wrap gap-2"><Btn onClick={onEditar}><Pencil size={14} /> Editar</Btn><Btn onClick={onBorrar}><Trash2 size={14} /> Quitar</Btn><Btn onClick={onClose} className="ml-auto">Cerrar</Btn></div>}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Cifra label="Valor">{fmtE(f.valor)}</Cifra>
        <Cifra label="Último cambio" color={colorDe(f.hoy)} sub={pct(f.hoyPct)}>{eur(f.hoy, true)}</Cifra>
        <Cifra label="Resultado" color={colorDe(f.resultado)} sub={f.resultado == null ? "falta el coste" : pct(f.resultadoPct)}>{f.resultado == null ? "–" : eur(f.resultado, true)}</Cifra>
        <Cifra label="Peso en tu cartera">{pct(f.peso, false)}</Cifra>
      </div>
      <div className="mt-4"><GraficoEvolucion serie={serie} referencia={f.precioMedio} alto={210} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[["1 semana", f.var.s], ["1 mes", f.var.m], ["Este año", f.var.ytd], ["1 año", f.var.a]].map(([l, v]) => (
          <div key={l} className="rounded-xl border px-2 py-2" style={{ borderColor: C.line }}>
            <div className="text-[11px] text-slate-500">{l}</div>
            <div className="text-sm font-semibold" style={{ ...tnum, color: colorDe(v) }}>{pct(v)}</div>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Participaciones</dt><dd className="text-right" style={tnum}>{nfNum.format(Math.round(f.unidades * 10000) / 10000)}</dd>
        <dt className="text-slate-500">Precio ({fechaLarga(f.fechaPrecio) || "sin datos"})</dt><dd className="text-right" style={tnum}>{f.precio == null ? "–" : fmtE(f.precio)}{div !== "EUR" ? ` (en ${div})` : ""}</dd>
        <dt className="text-slate-500">Precio medio de compra</dt><dd className="text-right" style={tnum}>{f.precioMedio == null ? "–" : fmtE(f.precioMedio)}</dd>
        <dt className="text-slate-500">Invertido</dt><dd className="text-right" style={tnum}>{f.coste == null ? "–" : fmtE(f.coste)}{f.aportado ? ` (${fmtE0(f.aportado)} en aportaciones)` : ""}</dd>
      </dl>
      {f.error && <p className="mt-3 text-xs" style={{ color: C.expense }}>No se pudo actualizar el precio: {f.error}. Edita la posición para elegir otra cotización.</p>}
    </Modal>
  );
}

function Editor({ inicial, entidades, servidor, onGuardar, onClose }) {
  const [p, setP] = useState(() => ({ tipo: "fondo", entidad: "", ...inicial }));
  const [modo, setModo] = useState(inicial?.participaciones > 0 ? "unidades" : "valor");
  const [q, setQ] = useState(inicial?.isin || inicial?.simbolo || "");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const buscar = async () => {
    setErr(null); setRes(null);
    try { const d = await servidor.get("/inversiones/buscar?q=" + encodeURIComponent(q.trim())); setRes(d.resultados || []); }
    catch (e) { setErr("No se pudo buscar: " + e.message); }
  };
  const ok = () => {
    try {
      const [n] = normalizarPosiciones([{ ...p, participaciones: modo === "unidades" ? p.participaciones : null, valorAlta: modo === "valor" ? p.valorAlta : null }], dia(new Date()));
      onGuardar({ ...n, id: inicial?.id || n.id });
    } catch (e) { setErr(e.message); }
  };
  const campo = "mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return (
    <Modal title={inicial?.id ? "Editar posición" : "Añadir posición"} onClose={onClose}
      footer={<div className="flex gap-2"><Btn kind="primary" onClick={ok}>Guardar</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      <div className="space-y-3">
        <label className="block text-xs text-slate-600">Busca por ISIN, ticker o nombre
          <div className="mt-0.5 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="IE00BYX5N771, TEF.MC…" className={campo + " flex-1"} style={{ borderColor: C.line }} />
            <Btn onClick={buscar} disabled={!q.trim() || !servidor.listo}><Search size={14} /> Buscar</Btn>
          </div>
        </label>
        {res && (res.length ? (
          <div className="max-h-48 overflow-y-auto rounded-lg border" style={{ borderColor: C.line }}>
            {res.map((r) => (
              <button key={r.simbolo} type="button" onClick={() => { setP((x) => ({ ...x, simbolo: r.simbolo, revisado: true, nombre: x.nombre || r.nombre, tipo: r.tipo === "EQUITY" ? "accion" : x.tipo, isin: /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(q.trim().toUpperCase()) ? q.trim().toUpperCase() : x.isin })); setRes(null); }}
                className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50" style={{ borderColor: C.line }}>
                <span className="font-medium">{r.nombre}</span>
                <span className="block text-xs text-slate-500">{r.simbolo} · {r.tipo === "MUTUALFUND" ? "Fondo" : r.tipo === "EQUITY" ? "Acción" : r.tipo || "?"} · {r.bolsa || ""}
                  {r.puntos != null && (r.puntos >= 10 ? <span style={{ color: C.income }}> · con historial</span> : <span style={{ color: C.expense }}> · sin historial de precios</span>)}</span>
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-slate-500">Sin resultados. Prueba con el ISIN o con otro nombre.</p>)}
        {p.simbolo && <p className="text-xs text-slate-500">Cotización: <strong>{p.simbolo}</strong></p>}
        <label className="block text-xs text-slate-600">Nombre<input value={p.nombre || ""} onChange={(e) => set("nombre", e.target.value)} className={campo} style={{ borderColor: C.line }} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-600">Entidad
            <input value={p.entidad || ""} onChange={(e) => set("entidad", e.target.value)} list="inv-entidades" className={campo} style={{ borderColor: C.line }} />
            <datalist id="inv-entidades">{entidades.map((e) => <option key={e} value={e} />)}</datalist>
          </label>
          <label className="block text-xs text-slate-600">Tipo
            <select value={p.tipo} onChange={(e) => set("tipo", e.target.value)} className={campo} style={{ borderColor: C.line }}>
              <option value="fondo">Fondo</option><option value="accion">Acción</option>
            </select>
          </label>
        </div>
        <div>
          <Seg ariaLabel="Qué sabes de la posición" value={modo} onChange={setModo} options={[{ v: "valor", l: "Sé su valor" }, { v: "unidades", l: "Sé las participaciones" }]} />
          {modo === "valor"
            ? <label className="mt-2 block text-xs text-slate-600">Valor actual (€), como lo muestra tu entidad<input inputMode="decimal" value={p.valorAlta ?? ""} onChange={(e) => set("valorAlta", e.target.value)} className={campo} style={{ borderColor: C.line }} /></label>
            : <label className="mt-2 block text-xs text-slate-600">Número de acciones o participaciones<input inputMode="decimal" value={p.participaciones ?? ""} onChange={(e) => set("participaciones", e.target.value)} className={campo} style={{ borderColor: C.line }} /></label>}
        </div>
        <label className="block text-xs text-slate-600">Lo que invertiste en total (€), opcional<input inputMode="decimal" value={p.coste ?? ""} onChange={(e) => set("coste", e.target.value)} className={campo} style={{ borderColor: C.line }} />
          <span className="mt-0.5 block text-[11px] text-slate-400">Si tu entidad da la plusvalía, es el valor menos la plusvalía. Sin esto no se calcula el resultado.</span></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={!!p.robo} onChange={(e) => set("robo", e.target.checked)} /> Es parte de una cartera automatizada con aportaciones periódicas</label>
        {p.robo && <label className="block text-xs text-slate-600">Peso objetivo en la cartera (%)<input inputMode="decimal" value={p.pesoObjetivo ?? ""} onChange={(e) => set("pesoObjetivo", e.target.value)} className={campo} style={{ borderColor: C.line }} /></label>}
        {err && <p className="text-xs" style={{ color: C.expense }}>{err}</p>}
      </div>
    </Modal>
  );
}

function Importar({ onImportar, onClose }) {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState(null);
  const ir = (reemplazar) => {
    try {
      const j = JSON.parse(txt);
      const lista = normalizarPosiciones(Array.isArray(j) ? j : j.posiciones, dia(new Date()));
      onImportar(lista, reemplazar, Array.isArray(j) ? null : j.aportacion || null);
    } catch (e) { setErr(e instanceof SyntaxError ? "El texto no es un JSON válido." : e.message); }
  };
  return (
    <Modal title="Importar posiciones" subtitle="Pega la lista en formato JSON" onClose={onClose}
      footer={<div className="flex flex-wrap gap-2"><Btn kind="primary" onClick={() => ir(false)} disabled={!txt.trim()}>Actualizar y añadir</Btn><Btn onClick={() => ir(true)} disabled={!txt.trim()}>Reemplazar todo</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      <p className="mb-2 text-xs text-slate-500">«Actualizar y añadir» cambia los productos que ya tienes (mismo ISIN o mismo nombre) y añade los nuevos. «Reemplazar todo» borra la lista actual.</p>
      <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setErr(null); }} rows={10} aria-label="Posiciones en JSON"
        className="w-full rounded-lg border p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}
        placeholder='[{"nombre":"Apple","entidad":"Mi bróker","tipo":"accion","simbolo":"AAPL","participaciones":10,"coste":1500}]' />
      {err && <p className="mt-2 text-xs" style={{ color: C.expense }}>{err}</p>}
    </Modal>
  );
}

function Aportacion({ inv, movs, onGuardar, onClose }) {
  const candidatos = useMemo(() => candidatosAportacion(movs), [movs]);
  const robo = inv.posiciones.filter((p) => p.robo);
  const desde = robo.reduce((mx, p) => (p.alta > mx ? p.alta : mx), "0000-00-00");
  return (
    <Modal title="Aportación periódica" subtitle="Para que la cartera automatizada crezca sola" onClose={onClose}
      footer={<div className="flex gap-2">{inv.aportacion && <Btn onClick={() => onGuardar(null)}>Quitar</Btn>}<Btn onClick={onClose} className="ml-auto">Cerrar</Btn></div>}>
      {!robo.length ? <p className="text-sm text-slate-600">Primero marca como «cartera automatizada» los fondos que la forman (al editarlos).</p> : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">Elige la transferencia con la que aportas. Cada una posterior al {fechaLarga(desde)} se repartirá entre los {robo.length} fondos de la cartera según su peso objetivo.</p>
          {candidatos.length ? candidatos.map((c) => {
            const activo = inv.aportacion?.patron === c.patron && inv.aportacion?.importe === c.importe;
            return (
              <button key={c.patron + c.importe} type="button" onClick={() => onGuardar({ patron: c.patron, importe: c.importe, desde })}
                className="block w-full rounded-xl border px-3 py-2 text-left hover:bg-slate-50" style={{ borderColor: activo ? C.accent : C.line }}>
                <span className="font-medium">{c.concepto}</span> <span style={tnum}>· {fmtE0(c.importe)}</span>
                <span className="block text-xs text-slate-500">{c.n} veces en el último año · última el {fechaLarga(c.ultima)}{activo ? " · elegida" : ""}</span>
              </button>
            );
          }) : <p className="text-slate-500">No encuentro transferencias repetidas en «Ahorro e inversión». Clasifica allí tus aportaciones y vuelve aquí.</p>}
        </div>
      )}
    </Modal>
  );
}

export function InversionesTab({ inversiones, setInversiones, movs, servidor }) {
  const inv = inversiones || { posiciones: [], aportacion: null };
  const [datos, setDatos] = useState(() => leer(PRECIOS_KEY) || { series: {}, meta: {} });
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [vista, setVista] = useState("entidad");
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(false);
  const [aportando, setAportando] = useState(false);
  const [nota, setNota] = useState(null);

  const traer = useCallback(async () => {
    const d = await servidor.get("/inversiones/precios?desde=" + sumarDias(dia(new Date()), -800));
    const v = { series: d.series || {}, meta: d.meta || {}, ts: Date.now() };
    setDatos(v); guardar(PRECIOS_KEY, v);
  }, [servidor]);

  // Lo que hay que seguir: se lo dice al servidor cuando cambia, y trae precios si son viejos.
  const simbolos = simbolosDe(inv).sort().join(",");
  useEffect(() => {
    if (!servidor.listo || !servidor.rasgo) return;
    let vivo = true;
    (async () => {
      try {
        setCargando(true);
        if (simbolos && leer(SEGUIDOS_KEY) !== simbolos) {
          await servidor.post("/inversiones/seguir", { simbolos: simbolos.split(",") });
          guardar(SEGUIDOS_KEY, simbolos);
          await traer();
        } else if (simbolos && (!datos.ts || Date.now() - datos.ts > 10 * 60000)) await traer();
        if (vivo) setAviso(null);
      } catch (e) { if (vivo) setAviso("No se pudieron traer los precios: " + e.message + ". Se muestran los últimos guardados."); }
      finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simbolos, servidor.listo, servidor.rasgo]);

  // Cotización de cada producto, elegida sola: los que no tienen (importados con ISIN o solo con
  // nombre) y los que tienen una sin historial (un listado de bolsa con un único dato). Se intenta
  // una vez por producto; si no se encuentra, queda con el valor que se puso.
  const conResolver = servidor.rasgos?.includes("inversiones-intradia");
  useEffect(() => {
    if (!servidor.listo || !servidor.rasgo) return;
    const pend = inv.posiciones.filter((p) => !p.revisado && (
      (!p.simbolo && !p.buscado && (p.isin || (conResolver && p.nombre)))
      || (conResolver && p.simbolo && datos.meta?.[p.simbolo] && (datos.series?.[p.simbolo] || []).length < 10)));
    if (!pend.length) return;
    let vivo = true;
    (async () => {
      const cambios = {};
      for (const p of pend) {
        try {
          if (conResolver) {
            const r = await servidor.get(`/inversiones/resolver?isin=${encodeURIComponent(p.isin || "")}&nombre=${encodeURIComponent(p.nombre || "")}&tipo=${p.tipo}`);
            cambios[p.id] = r.simbolo ? { simbolo: r.simbolo, revisado: true } : { revisado: true, buscado: true };
          } else {
            const d = await servidor.get("/inversiones/buscar?q=" + encodeURIComponent(p.isin));
            const r = (d.resultados || []).find((x) => x.tipo === (p.tipo === "accion" ? "EQUITY" : "MUTUALFUND")) || (d.resultados || [])[0];
            cambios[p.id] = r ? { simbolo: r.simbolo } : { buscado: true };
          }
        } catch { /* sin conexión: se reintenta la próxima vez */ }
      }
      if (vivo && Object.keys(cambios).length) setInversiones((x) => ({ ...x, posiciones: x.posiciones.map((p) => (cambios[p.id] ? { ...p, ...cambios[p.id] } : p)) }));
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.posiciones.map((p) => p.id + (p.simbolo || "") + (p.revisado ? 1 : 0) + (p.buscado ? 1 : 0)).join(), datos.ts, servidor.listo, servidor.rasgo, conResolver]);

  // Mientras la pestaña está abierta: precios nuevos cada 10 minutos y al volver a ella. Es solo
  // leer de tu servidor, que los renueva cada media hora en horario de bolsa.
  useEffect(() => {
    if (!servidor.listo || !servidor.rasgo || !simbolos) return;
    const refrescar = () => { if (document.visibilityState === "visible" && Date.now() - (leer(PRECIOS_KEY)?.ts || 0) > 10 * 60000) traer().catch(() => {}); };
    const t = setInterval(refrescar, 60000);
    document.addEventListener("visibilitychange", refrescar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refrescar); };
  }, [servidor.listo, servidor.rasgo, simbolos, traer]);

  const actualizar = async () => {
    setCargando(true); setAviso(null);
    try { await servidor.post("/inversiones/actualizar", {}); await traer(); }
    catch (e) { setAviso("No se pudieron actualizar: " + e.message); }
    finally { setCargando(false); }
  };

  const a = useMemo(() => analizarInversiones(inv, datos, movs), [inv, datos, movs]);
  const entidades = [...new Set(inv.posiciones.map((p) => p.entidad).filter(Boolean))];
  const filaAbierta = a.filas.find((f) => f.p.id === abierta);
  const guardarPos = (p) => { setInversiones((x) => ({ ...x, posiciones: x.posiciones.some((q) => q.id === p.id) ? x.posiciones.map((q) => (q.id === p.id ? p : q)) : [...x.posiciones, p] })); setEditando(null); };
  const borrar = (id) => { if (window.confirm("¿Quitar esta posición de tus inversiones?")) { setInversiones((x) => ({ ...x, posiciones: x.posiciones.filter((p) => p.id !== id) })); setAbierta(null); } };
  const importar = (lista, reemplazar, aportacion) => {
    const r = reemplazar ? null : fusionarPosiciones(inv.posiciones, lista);
    setInversiones((x) => ({ posiciones: reemplazar ? lista : fusionarPosiciones(x.posiciones, lista).posiciones, aportacion: aportacion || x.aportacion || null }));
    setAviso(null);
    setNota(reemplazar ? `Lista sustituida: ${lista.length} productos.` : `${r.actualizadas} ${r.actualizadas === 1 ? "producto actualizado" : "productos actualizados"} y ${r.añadidas} ${r.añadidas === 1 ? "añadido" : "añadidos"}.`);
    setImportando(false);
  };

  const avisosCartera = [];
  for (const g of a.porEntidad) if (g.peso > 0.5 && a.porEntidad.length > 1) avisosCartera.push(`El ${pct(g.peso, false)} de lo invertido está en ${g.nombre}.`);
  // Un producto que ya es toda su entidad no repite el aviso.
  const solos = new Set(a.porEntidad.filter((g) => g.filas.length === 1 && g.peso > 0.5 && a.porEntidad.length > 1).map((g) => g.filas[0].p.id));
  for (const f of a.filas) if (f.peso > 0.25 && !solos.has(f.p.id)) avisosCartera.push(`«${f.p.nombre}» pesa el ${pct(f.peso, false)} de tu cartera.`);
  const sinPrecio = a.filas.filter((f) => f.sinPrecio);
  const robo = inv.posiciones.filter((p) => p.robo);
  const entidadRobo = robo[0]?.entidad || null;
  const candidato = useMemo(() => (robo.length && !inv.aportacion ? candidatosAportacion(movs)[0] || null : null), [robo.length, inv.aportacion, movs]);
  const desdeRobo = robo.reduce((mx, p) => (p.alta > mx ? p.alta : mx), "0000-00-00");
  const usarAportacion = (c) => setInversiones((x) => ({ ...x, aportacion: { patron: c.patron, importe: c.importe, desde: desdeRobo } }));
  const notaRobo = entidadRobo && (inv.aportacion ? (
    <p className="flex items-start gap-2 text-xs text-slate-600"><Repeat size={13} className="mt-0.5 shrink-0" />
      <span>Aportación automática de <strong style={tnum}>{fmtE0(inv.aportacion.importe)}</strong>: cada transferencia se reparte entre los {robo.length} fondos según su peso.
        {a.aportes.length ? ` Sumadas ${a.aportes.length} (${fmtE0(a.aportes.reduce((x, y) => x + y.importe, 0))}), la última el ${fechaLarga(a.aportes[a.aportes.length - 1].fecha)}.` : ` Aún ninguna desde el ${fechaLarga(inv.aportacion.desde)}: se sumará la próxima.`}
        {" "}<button type="button" className="underline" onClick={() => setAportando(true)}>Cambiar</button></span></p>
  ) : candidato ? (
    <div className="text-xs text-slate-600">
      <p className="flex items-start gap-2"><Repeat size={13} className="mt-0.5 shrink-0" /><span>¿Tu aportación mensual a esta cartera es <strong>«{candidato.concepto}» de {fmtE0(candidato.importe)}</strong>? La has hecho {candidato.n} veces en el último año. Si la usas, cada una se sumará sola, repartida entre los fondos.</span></p>
      <div className="mt-2 flex gap-2 pl-5"><Btn size="sm" kind="primary" onClick={() => usarAportacion(candidato)}>Sí, usarla</Btn><Btn size="sm" onClick={() => setAportando(true)}>Elegir otra</Btn></div>
    </div>
  ) : (
    <p className="flex items-start gap-2 text-xs text-slate-500"><Repeat size={13} className="mt-0.5 shrink-0" />Si aportas cada mes, clasifica esas transferencias como «Ahorro e inversión» y elígela en <button type="button" className="underline" onClick={() => setAportando(true)}>Aportación periódica</button>: se sumarán solas.</p>
  ));

  return (
    <div className="space-y-4">
      {!servidor.listo && <Card className="p-4 text-sm text-slate-600">Para que los precios se actualicen solos necesitas tu servidor conectado (Ajustes → Tus datos y sincronización).</Card>}
      {servidor.listo && !servidor.rasgo && <Card className="p-4 text-sm text-slate-600">Tu servidor aún no sabe traer precios: se actualiza solo en unos minutos si lo publicas desde GitHub. Mientras, puedes ir añadiendo tus posiciones.</Card>}
      {aviso && <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{aviso}</div>}
      {nota && <div role="status" className="flex items-start justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: C.line, background: C.surface }}><span>{nota}</span><button type="button" className="text-xs underline" onClick={() => setNota(null)}>Cerrar</button></div>}

      {!inv.posiciones.length ? (
        <Card className="p-6 text-center">
          <Wallet size={28} className="mx-auto text-slate-400" />
          <h2 className="mt-2 text-lg font-semibold">Tus inversiones, al día solas</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Añade tus acciones y fondos una vez. Cada noche tu servidor trae los precios de cierre y aquí ves cuánto valen, cómo evolucionan y cuánto ganas o pierdes.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Btn kind="primary" onClick={() => setEditando({})}><Plus size={14} /> Añadir posición</Btn>
            <Btn onClick={() => setImportando(true)}><Upload size={14} /> Importar lista</Btn>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor de tus inversiones</div>
                <div className="mt-0.5 text-3xl font-semibold" style={tnum}>{fmtE0(a.total)}</div>
              </div>
              <Btn size="sm" onClick={actualizar} disabled={cargando || !servidor.listo || !servidor.rasgo} title="Pedir los últimos precios ahora">
                <RefreshCw size={13} className={cargando ? "animate-spin" : ""} /> {cargando ? "Actualizando" : "Actualizar"}
              </Btn>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <Cifra label="Último cambio" color={colorDe(a.hoy)} sub={pct(a.hoyPct)}>{eur(a.hoy, true)}</Cifra>
              <Cifra label="Resultado" color={colorDe(a.resultado)} sub={a.resultado == null ? "añade el coste" : `${pct(a.resultadoPct)} sobre ${fmtE0(a.costeTotal)}${a.sinCoste ? ` · ${a.sinCoste} sin coste` : ""}`}>{a.resultado == null ? "–" : eur(a.resultado, true)}</Cifra>
            </div>
            <div className="mt-3"><Reparto grupos={a.porEntidad} total={a.total} /></div>
            <p className="mt-3 text-[11px] text-slate-400">{a.fechaPrecios
              ? <>{a.ytd != null && <>En lo que va de año: <span style={{ ...tnum, color: colorDe(a.ytd) }}>{pct(a.ytd)}</span>. </>}
                  {a.horaAcciones ? `Acciones actualizadas ${new Date(a.horaAcciones).toLocaleString("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" })} (con 15 min de retraso). ` : ""}
                  Fondos al {fechaLarga(a.filas.filter((f) => f.p.tipo !== "accion" && f.fechaPrecio).reduce((mx, f) => (f.fechaPrecio > mx ? f.fechaPrecio : mx), "") || a.fechaPrecios)}: publican su valor una vez al día.</>
              : "Aún no hay precios: llegarán en cuanto tu servidor los descargue."}</p>
          </Card>

          <EvolucionCartera a={a} inv={inv} datos={datos} />

          {a.movidos.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Lo que más se ha movido</h3>
              <div className="mt-2 divide-y" style={{ borderColor: C.line }}>
                {a.movidos.map((f) => (
                  <button key={f.p.id} type="button" onClick={() => setAbierta(f.p.id)} className="flex w-full items-center gap-2 py-2 text-left text-sm">
                    <span className="min-w-0 flex-1 truncate">{f.p.nombre}</span>
                    <span className="shrink-0 text-xs text-slate-500" style={tnum}>{eur(f.hoy, true)}</span>
                    <span className="w-16 shrink-0 text-right font-semibold" style={{ ...tnum, color: colorDe(f.hoyPct) }}>{pct(f.hoyPct)}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <Seg ariaLabel="Agrupar por" value={vista} onChange={setVista} options={[{ v: "entidad", l: "Por plataforma" }, { v: "tipo", l: "Por tipo" }]} />
            <Btn size="sm" onClick={() => setEditando({})}><Plus size={14} /> Añadir</Btn>
          </div>
          {(vista === "entidad" ? a.porEntidad : a.porTipo).map((g) => <Grupo key={g.nombre} g={g} datos={datos} onAbrir={setAbierta} nota={vista === "entidad" && g.nombre === entidadRobo ? notaRobo : null} />)}

          {(avisosCartera.length > 0 || sinPrecio.length > 0) && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold">A tener en cuenta</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {avisosCartera.map((t) => <li key={t}>{t}</li>)}
                {sinPrecio.map((f) => <li key={f.p.id}>«{f.p.nombre}» no tiene precio automático: se cuenta con el valor que pusiste.{" "}
                  <button type="button" className="underline" onClick={() => setEditando(f.p)}>Buscar su cotización</button>{f.p.isin ? "" : " (con el ISIN es más fácil de encontrar)"}.</li>)}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => setAportando(true)}>Aportación periódica{inv.aportacion ? ` · ${fmtE0(inv.aportacion.importe)}` : ""}</Btn>
            <Btn size="sm" onClick={() => setImportando(true)}><Upload size={13} /> Importar</Btn>
          </div>
        </>
      )}

      {filaAbierta && <Detalle f={filaAbierta} datos={datos} onClose={() => setAbierta(null)} onEditar={() => { setEditando(filaAbierta.p); setAbierta(null); }} onBorrar={() => borrar(filaAbierta.p.id)} />}
      {editando && <Editor inicial={editando} entidades={entidades} servidor={servidor} onGuardar={guardarPos} onClose={() => setEditando(null)} />}
      {importando && <Importar onImportar={importar} onClose={() => setImportando(false)} />}
      {aportando && <Aportacion inv={inv} movs={movs} onGuardar={(ap) => { setInversiones((x) => ({ ...x, aportacion: ap })); setAportando(false); }} onClose={() => setAportando(false)} />}
    </div>
  );
}
