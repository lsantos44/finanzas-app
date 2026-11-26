import { C, aiLeerCapturas, fmtE, fmtE0, nfNum, tnum } from "../core.js";
import { Btn, Card, Modal, Seg } from "../ui/comunes.jsx";
import { Bienvenida, ImportarArchivo, ListaOperaciones, Renta } from "./inversiones-extra.jsx";
import { carteraEjemplo, conEjemplo, esEjemplo } from "../inversiones-ejemplo.js";
import { Destacados, Panel, QueHaMovido, Reparto, SinHistoria, referenciaInicial } from "./inversiones-panel.jsx";
import { REFERENCIAS, actualizarCampos, analizarInversiones, candidatosAportacion, fusionarPosiciones, normalizarPosiciones, posicionesDeCapturas, serieEUR, simbolosDe, dia, sumarDias, divisaDe } from "../inversiones.js";
import { AlertTriangle, Camera, FileSpreadsheet, ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Repeat, Search, Trash2, Upload } from "lucide-react";
import { Area, CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function Cifra({ label, children, sub, color }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold" style={{ ...tnum, color: color || C.ink }}>{children}</div>
      {sub && <div className="text-xs" style={{ ...tnum, color: color || C.muted }}>{sub}</div>}
    </div>
  );
}

function GraficoEvolucion({ serie, conInvertido, referencia, marca, alto = 200 }) {
  const [rango, setRango] = useState(365);
  const datos = useMemo(() => {
    if (!serie?.length) return [];
    const desde = rango ? sumarDias(serie[serie.length - 1].d, -rango) : "0000-00-00";
    const s = serie.filter((p) => p.d >= desde);
    const paso = Math.max(1, Math.ceil(s.length / 260));
    return s.filter((_, i) => i % paso === 0 || i === s.length - 1).map((p) => ({ ...p, et: fechaCorta(p.d) }));
  }, [serie, rango]);
  if (datos.length < 2) return <p className="py-8 text-center text-sm text-slate-400">El gráfico aparecerá cuando lleguen los precios.</p>;
  // Variación del precio en el periodo (en la ficha la serie es el precio del producto).
  const rPeriodo = datos[0].valor ? datos[datos.length - 1].valor / datos[0].valor - 1 : null;
  const sube = (rPeriodo ?? 0) >= 0;
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
        <span className="text-xs font-medium" style={{ ...tnum, color }}>{pct(rPeriodo)} en el periodo</span>
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
            {marca && datos.some((p) => p.d >= marca) && <ReferenceLine x={datos.find((p) => p.d >= marca).et} stroke={C.accent} strokeDasharray="3 3" label={{ value: "Entraste", position: "insideTopRight", fontSize: 10, fill: C.accent }} />}
            {referencia != null && <ReferenceLine y={referencia} ifOverflow="extendDomain" stroke={C.muted} strokeDasharray="4 3" label={{ value: "Tu precio medio", position: "insideTopLeft", fontSize: 10, fill: C.muted }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Cuánto ganas o pierdes con cada producto, de un vistazo: barra verde o roja (llena al ±50 %).
function BarraPct({ v }) {
  if (v == null || !isFinite(v)) return null;
  return (
    <div className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full" style={{ background: C.line }} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.min(1, Math.abs(v) / 0.5) * 100)}%`, background: v >= 0 ? C.income : C.expense }} />
    </div>
  );
}

// Importe en una divisa («89,50 US$»); los peniques británicos, como «p».
const enDivisa = (v, div) => {
  if (v == null) return "–";
  if (div === "GBp" || div === "GBX") return `${v.toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} p`;
  try { return v.toLocaleString("es-ES", { style: "currency", currency: div, maximumFractionDigits: 2, minimumFractionDigits: 2 }); } catch { return `${v.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${div}`; }
};
// Precio de compra (medio) o de hoy: en la divisa de la acción si se saben los dos; si no, en euros
// los dos (para que se puedan comparar).
const nativos = (f) => f.precioMedioNativo != null && f.precioNativo != null;
const precioEn = (f, compra) => (nativos(f) ? enDivisa(compra ? f.precioMedioNativo : f.precioNativo, f.divisa) : fmtE(compra ? f.precioMedio : f.precio));

function FilaPosicion({ f, datos, onAbrir }) {
  return (
    <button type="button" onClick={() => onAbrir(f.p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{f.p.nombre}</div>
        {/* A cuánto compraste (precio medio por acción o participación; en fondos, el valor
            liquidativo) y a cuánto está, en su divisa si no es el euro. Debajo, cuántas tienes. */}
        {f.sinPrecio ? <div className="truncate text-xs" style={{ color: C.expense }}>Sin precio automático</div>
          : f.precioMedio != null ? (
            <div className="truncate text-xs" style={tnum}>
              {precioEn(f, true)}<span className="text-slate-400"> → </span><span className="font-medium" style={{ color: colorDe(f.resultadoPct) }}>{precioEn(f, false)}</span>
            </div>
          ) : <div className="truncate text-xs" style={tnum}>{precioEn(f, false)}</div>}
        {!f.sinPrecio && (
          <div className="truncate text-[11px] text-slate-500" style={tnum}>
            {nfNum.format(Math.round(f.unidades * 1000) / 1000)} {f.p.tipo === "accion" ? "acc." : "part."}{f.fechaPrecio ? ` · ${fechaCorta(f.fechaPrecio)}` : ""}
          </div>
        )}
      </div>
      <BarraPct v={f.resultadoPct} />
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold" style={tnum}>{fmtE0(f.valor)}</div>
        {/* Lo que ganas o pierdes desde que lo compraste (como el total del grupo); sin coste, el último cambio. */}
        <div className="text-xs" style={{ ...tnum, color: colorDe(f.resultado ?? f.hoyPct) }}>{f.resultado != null ? `${eur(Math.round(f.resultado), true).replace(/,00(?=\s?€)/, "")} · ${pct(f.resultadoPct)}` : f.hoyPct == null ? "–" : `${pct(f.hoyPct)} últ.`}</div>
      </div>
    </button>
  );
}

function Grupo({ g, datos, onAbrir, nota, solo }) {
  // Plegado: se ve el total de la plataforma; el detalle, al tocar (abierto si es la única).
  const [abierto, setAbierto] = useState(Boolean(solo));
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

function Detalle({ f, datos, onClose, onEditar, onBorrar, onFecha }) {
  const serie = useMemo(() => serieEUR(f.p, datos).map(([d, v]) => ({ d, valor: v })), [f, datos]);
  const div = divisaDe(f.p, datos);
  const desdeEntrada = useMemo(() => { const ini = serie.filter((x) => x.d <= f.entrada).pop() || serie[0]; return ini && f.precio ? f.precio / ini.valor - 1 : null; }, [serie, f]);
  return (
    <Modal title={f.p.nombre} subtitle={[f.p.entidad, f.p.tipo === "accion" ? "Acción" : "Fondo", f.p.simbolo || f.p.isin].filter(Boolean).join(" · ")} onClose={onClose} wide
      footer={<div className="flex flex-wrap gap-2"><Btn onClick={onEditar}><Pencil size={14} /> Editar</Btn><Btn onClick={onBorrar}><Trash2 size={14} /> Quitar</Btn><Btn onClick={onClose} className="ml-auto">Cerrar</Btn></div>}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Cifra label="Valor">{fmtE(f.valor)}</Cifra>
        <Cifra label="Último cambio" color={colorDe(f.hoy)} sub={pct(f.hoyPct)}>{eur(f.hoy, true)}</Cifra>
        <Cifra label="Ganas desde tu compra" color={colorDe(f.resultado)} sub={f.resultado == null ? "falta el coste" : pct(f.resultadoPct)}>{f.resultado == null ? "–" : eur(f.resultado, true)}</Cifra>
        <Cifra label="Peso en tu cartera">{pct(f.peso, false)}</Cifra>
      </div>
      {f.precio != null && f.precioMedio != null && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: C.line, ...tnum }}>
          <span><span className="block text-[11px] uppercase tracking-wide text-slate-500">Compraste a</span><span className="font-semibold">{precioEn(f, true)}</span></span>
          <span className="text-slate-400" aria-hidden="true">→</span>
          <span className="text-right"><span className="block text-[11px] uppercase tracking-wide text-slate-500">Hoy está a</span><span className="font-semibold" style={{ color: colorDe(f.resultadoPct) }}>{precioEn(f, false)}</span></span>
        </div>
      )}
      {/* Dos preguntas distintas: cómo te ha ido a ti (desde tu compra, con tu precio medio) y cómo
          ha ido el producto (su precio en cualquier periodo, lo tuvieras o no). */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3" style={{ borderColor: C.line }}>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Tu posición</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: colorDe(f.resultadoPct) }}>{pct(f.resultadoPct)}</div>
          <div className="text-[11px] text-slate-500">desde que entraste{f.compraConocida ? ` (${fechaCorta(f.entrada)})` : ""}, con tu precio medio</div>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: C.line }}>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">El producto</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: colorDe(desdeEntrada) }}>{pct(desdeEntrada)}</div>
          <div className="text-[11px] text-slate-500">su precio en ese mismo tiempo</div>
        </div>
      </div>
      <div className="mt-4"><GraficoEvolucion serie={serie} referencia={f.precioMedio} marca={f.compraConocida ? f.entrada : null} alto={210} /></div>
      <ListaOperaciones ops={f.p.ops} />
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">Precio del producto</div>
      <div className="mt-1 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[["1 semana", f.var.s], ["1 mes", f.var.m], ["Este año", f.var.ytd], ["1 año", f.var.a]].map(([l, v]) => (
          <div key={l} className="rounded-xl border px-2 py-2" style={{ borderColor: C.line }}>
            <div className="text-[11px] text-slate-500">{l}</div>
            <div className="text-sm font-semibold" style={{ ...tnum, color: colorDe(v) }}>{pct(v)}</div>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500"><label htmlFor="inv-compra">En cartera desde</label></dt>
        <dd className="text-right"><input id="inv-compra" type="date" value={f.p.compra || ""} max={dia(new Date())} onChange={(e) => onFecha(f.p.id, e.target.value || null)}
          className="rounded-md border px-1.5 py-0.5 text-sm" style={{ borderColor: f.p.compra ? C.line : C.expense }} />{!f.p.compra && <span className="block text-[11px]" style={{ color: C.expense }}>Pon la fecha de tu primera compra</span>}</dd>
        <dt className="text-slate-500">Participaciones</dt><dd className="text-right" style={tnum}>{nfNum.format(Math.round(f.unidades * 10000) / 10000)}</dd>
        <dt className="text-slate-500">Precio hoy ({fechaLarga(f.fechaPrecio) || "sin datos"})</dt><dd className="text-right" style={tnum}>{f.precio == null ? "–" : fmtE(f.precio)}{div !== "EUR" && f.precioNativo != null ? ` · ${enDivisa(f.precioNativo, div)}` : ""}</dd>
        <dt className="text-slate-500">Precio medio de compra</dt><dd className="text-right" style={tnum}>{f.precioMedio == null ? "–" : fmtE(f.precioMedio)}{div !== "EUR" && f.precioMedioNativo != null ? ` · ${enDivisa(f.precioMedioNativo, div)}` : ""}</dd>
        {f.precio != null && f.precioMedio != null && <><dt className="text-slate-500">Diferencia por {f.p.tipo === "accion" ? "acción" : "participación"}</dt><dd className="text-right" style={{ ...tnum, color: colorDe(f.precio - f.precioMedio) }}>{eur(f.precio - f.precioMedio, true)} ({pct(f.precio / f.precioMedio - 1)})</dd></>}
        <dt className="text-slate-500">Invertido</dt><dd className="text-right" style={tnum}>{f.coste == null ? "–" : fmtE(f.coste)}{f.aportado ? ` (${fmtE0(f.aportado)} en aportaciones)` : ""}</dd>
      </dl>
      {f.error && <p className="mt-3 text-xs" style={{ color: C.expense }}>No se pudo actualizar el precio: {f.error}. Edita la posición para elegir otra cotización.</p>}
    </Modal>
  );
}

/* Añadir o editar un producto, en dos pasos: 1) buscarlo (nombre, ISIN o ticker); 2) cuántas
   tienes y a qué precio medio (o cuánto invertiste), y en qué plataforma. Lo demás, en «Más». */
function Editor({ inicial, entidades, servidor, onGuardar, onClose }) {
  const nuevo = !inicial?.id;
  const [paso, setPaso] = useState(nuevo && !inicial?.simbolo ? 1 : 2);
  const [p, setP] = useState(() => ({ tipo: "fondo", entidad: entidades.length === 1 ? entidades[0] : "", ...inicial }));
  const [q, setQ] = useState(inicial?.isin || "");
  const [res, setRes] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [err, setErr] = useState(null);
  const [sinUnidades, setSinUnidades] = useState(!(inicial?.participaciones > 0) && inicial?.valorAlta > 0);
  const [costeModo, setCosteModo] = useState("medio");
  const [costeMedio, setCosteMedio] = useState(() => (inicial?.coste && inicial?.participaciones ? String(Math.round((inicial.coste / inicial.participaciones) * 10000) / 10000).replace(".", ",") : ""));
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const buscar = async () => {
    if (!q.trim()) return;
    setErr(null); setRes(null); setBuscando(true);
    try { const d = await servidor.get("/inversiones/buscar?q=" + encodeURIComponent(q.trim())); setRes(d.resultados || []); }
    catch (e) { setErr("No se pudo buscar: " + e.message); }
    finally { setBuscando(false); }
  };
  const elegir = (r) => {
    const isin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(q.trim().toUpperCase()) ? q.trim().toUpperCase() : p.isin;
    setP((x) => ({ ...x, simbolo: r.simbolo, revisado: true, nombre: x.id ? x.nombre : r.nombre, tipo: r.tipo === "EQUITY" ? "accion" : r.tipo === "MUTUALFUND" ? "fondo" : x.tipo, isin }));
    setPaso(2);
  };
  const ok = () => {
    try {
      const datos = { ...p,
        participaciones: sinUnidades ? null : p.participaciones,
        valorAlta: sinUnidades ? p.valorAlta : null,
        coste: costeModo === "total" ? p.coste : null,
        costeMedio: costeModo === "medio" && !sinUnidades ? costeMedio : null };
      if (costeModo === "medio" && sinUnidades) datos.coste = p.coste;
      const [n] = normalizarPosiciones([datos], dia(new Date()));
      onGuardar({ ...n, id: inicial?.id || n.id });
    } catch (e) { setErr(e.message); }
  };
  const campo = "mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return (
    <Modal title={nuevo ? "Añadir producto" : "Editar producto"} subtitle={paso === 1 ? "Paso 1 de 2 · búscalo" : nuevo ? "Paso 2 de 2 · cuánto tienes" : p.nombre} onClose={onClose}
      footer={paso === 1
        ? <div className="flex gap-2"><Btn onClick={() => { set("simbolo", undefined); setPaso(2); }}>No lo encuentro</Btn><Btn onClick={onClose} className="ml-auto">Cancelar</Btn></div>
        : <div className="flex gap-2"><Btn kind="primary" onClick={ok}>Guardar</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      {paso === 1 ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} aria-label="Buscar producto"
              placeholder="Nombre, ISIN o ticker" className={campo + " mt-0 flex-1"} style={{ borderColor: C.line }} />
            <Btn kind="primary" onClick={buscar} disabled={!q.trim() || !servidor.listo || buscando}><Search size={14} /> {buscando ? "Buscando" : "Buscar"}</Btn>
          </div>
          {!servidor.listo && <p className="text-xs text-slate-500">Para buscar cotizaciones necesitas tu servidor conectado.</p>}
          {res && (res.length ? (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.line }}>
              {res.map((r) => (
                <button key={r.simbolo} type="button" onClick={() => elegir(r)}
                  className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50" style={{ borderColor: C.line }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.nombre}</span>
                    <span className="block text-xs text-slate-500">{r.tipo === "MUTUALFUND" ? "Fondo" : r.tipo === "EQUITY" ? "Acción" : r.tipo || "?"} · {r.simbolo}{r.bolsa ? ` · ${r.bolsa}` : ""}</span>
                  </span>
                  {r.puntos != null && (r.puntos >= 10
                    ? <span className="shrink-0 text-[11px]" style={{ color: C.income }}>con precios</span>
                    : <span className="shrink-0 text-[11px]" style={{ color: C.expense }}>sin precios</span>)}
                  <ChevronRight size={14} className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">Sin resultados. Prueba con el ISIN (está en la ficha del producto en tu banco).</p>)}
          {err && <p className="text-xs" style={{ color: C.expense }}>{err}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line }}>
            <div className="min-w-0 flex-1">
              <input value={p.nombre || ""} onChange={(e) => set("nombre", e.target.value)} aria-label="Nombre" placeholder="Nombre del producto" className="w-full bg-transparent text-sm font-medium focus:outline-none" />
              <div className="text-xs text-slate-500">{p.simbolo ? `Precio automático · ${p.simbolo}` : "Sin precio automático: se usará el valor que pongas"}</div>
            </div>
            <Btn size="sm" onClick={() => setPaso(1)}>{p.simbolo ? "Cambiar" : "Buscar"}</Btn>
          </div>

          <label className="block text-sm font-medium">¿Cuántas tienes?
            {!sinUnidades
              ? <input inputMode="decimal" value={p.participaciones ?? ""} onChange={(e) => set("participaciones", e.target.value)} placeholder="Nº de acciones o participaciones" className={campo + " font-normal"} style={{ borderColor: C.line }} />
              : <input inputMode="decimal" value={p.valorAlta ?? ""} onChange={(e) => set("valorAlta", e.target.value)} placeholder="Valor actual en euros" className={campo + " font-normal"} style={{ borderColor: C.line }} />}
            <button type="button" className="mt-1 text-xs font-normal text-slate-500 underline" onClick={() => setSinUnidades((x) => !x)}>{sinUnidades ? "Sé el número de participaciones" : "No lo sé: pondré su valor actual"}</button>
          </label>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">¿Cuánto te costó?</span>
              {!sinUnidades && <Seg ariaLabel="Cómo indicar el coste" value={costeModo} onChange={setCosteModo} options={[{ v: "medio", l: "Precio medio" }, { v: "total", l: "Total" }]} />}
            </div>
            {costeModo === "medio" && !sinUnidades
              ? <input inputMode="decimal" value={costeMedio} onChange={(e) => setCosteMedio(e.target.value)} aria-label="Precio medio de compra en euros" placeholder="Precio medio de compra (€ por participación)" className={campo} style={{ borderColor: C.line }} />
              : <input inputMode="decimal" value={p.coste ?? ""} onChange={(e) => set("coste", e.target.value)} aria-label="Total invertido en euros" placeholder="Total invertido (€)" className={campo} style={{ borderColor: C.line }} />}
            <p className="mt-1 text-[11px] text-slate-400">Está en la ficha del producto en tu entidad («coste medio», «BEP», «invertido»). Opcional: sin él no se calcula lo que ganas.</p>
          </div>

          <label className="block text-sm font-medium">¿Desde cuándo lo tienes?
            <input type="date" value={p.compra || ""} max={dia(new Date())} onChange={(e) => set("compra", e.target.value || undefined)} className={campo + " font-normal"} style={{ borderColor: C.line }} />
            <span className="mt-1 block text-[11px] font-normal text-slate-400">Fecha de tu primera compra. Tu rentabilidad se cuenta desde ese día. Opcional.</span>
          </label>

          <div>
            <span className="text-sm font-medium">Plataforma</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {entidades.map((e) => (
                <button key={e} type="button" onClick={() => set("entidad", e)} aria-pressed={p.entidad === e}
                  className="rounded-full border px-3 py-1 text-xs" style={p.entidad === e ? { borderColor: C.accent, color: C.accent, background: C.accentSoft } : { borderColor: C.line }}>{e}</button>
              ))}
            </div>
            <input value={entidades.includes(p.entidad) ? "" : p.entidad || ""} onChange={(e) => set("entidad", e.target.value)} placeholder={entidades.length ? "u otra nueva…" : "Banco, bróker…"} aria-label="Otra plataforma" className={campo} style={{ borderColor: C.line }} />
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">Más opciones</summary>
            <div className="mt-2 space-y-2">
              <label className="block text-xs text-slate-600">Tipo
                <select value={p.tipo} onChange={(e) => set("tipo", e.target.value)} className={campo} style={{ borderColor: C.line }}><option value="fondo">Fondo</option><option value="accion">Acción o ETF</option></select>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={!!p.robo} onChange={(e) => set("robo", e.target.checked)} /> Parte de una cartera automatizada con aportaciones periódicas</label>
              {p.robo && <label className="block text-xs text-slate-600">Peso objetivo en la cartera (%)<input inputMode="decimal" value={p.pesoObjetivo ?? ""} onChange={(e) => set("pesoObjetivo", e.target.value)} className={campo} style={{ borderColor: C.line }} /></label>}
            </div>
          </details>
          {err && <p className="text-xs" style={{ color: C.expense }}>{err}</p>}
        </div>
      )}
    </Modal>
  );
}

/* Cargar posiciones desde capturas de la app de tu banco o bróker: la IA las lee, tú revisas. */
const aJpeg = (file) => new Promise((ok, mal) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    ok({ tipo: "image/jpeg", base64: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
  };
  img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No se pudo abrir la imagen " + file.name)); };
  img.src = url;
});

function DesdeCapturas({ ai, aiOn, entidades, onGuardar, onClose }) {
  const [imagenes, setImagenes] = useState([]);
  const [entidad, setEntidad] = useState("");
  const [filas, setFilas] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [err, setErr] = useState(null);
  const elegir = async (files) => {
    setErr(null);
    try { const nuevas = await Promise.all([...files].slice(0, 8).map(aJpeg)); setImagenes((x) => [...x, ...nuevas].slice(0, 8)); }
    catch (e) { setErr(e.message); }
  };
  const leer = async () => {
    setLeyendo(true); setErr(null);
    try {
      const leido = await aiLeerCapturas(ai, imagenes);
      setEntidad((e) => e || leido.entidad || "");
      setFilas(posicionesDeCapturas(leido, entidad || leido.entidad, dia(new Date())));
    } catch (e) { setErr("No se han podido leer: " + e.message); }
    finally { setLeyendo(false); }
  };
  const guardar = () => onGuardar(filas.filter((f) => f.incluir && f.p).map((f) => ({ ...f.p, entidad: entidad || f.p.entidad })));
  const n = filas ? filas.filter((f) => f.incluir && f.p).length : 0;
  return (
    <Modal title="Cargar desde capturas" subtitle="De la app de tu banco o bróker" onClose={onClose}
      footer={filas
        ? <div className="flex gap-2"><Btn kind="primary" onClick={guardar} disabled={!n}>Guardar {n} {n === 1 ? "producto" : "productos"}</Btn><Btn onClick={() => setFilas(null)}>Atrás</Btn></div>
        : <div className="flex gap-2"><Btn kind="primary" onClick={leer} disabled={!imagenes.length || leyendo || !aiOn}>{leyendo ? "Leyendo…" : "Leer con IA"}</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      {!aiOn ? <p className="text-sm text-slate-600">Para leer capturas activa la IA en Ajustes → Inteligencia artificial. Sin ella puedes añadir cada producto con «Buscar».</p> : !filas ? (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">Haz capturas de la ficha de cada producto (o de la cartera) donde se vean el nº de participaciones y el coste o la ganancia. La IA las lee y tú revisas antes de guardar.</p>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-5 text-center" style={{ borderColor: C.lineStrong }}>
            <Upload size={18} className="text-slate-400" />
            <span className="font-medium">{imagenes.length ? `${imagenes.length} ${imagenes.length === 1 ? "captura" : "capturas"} · añadir más` : "Elegir capturas"}</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { elegir(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="block text-xs text-slate-600">Plataforma (si no se ve en las capturas)
            <input value={entidad} onChange={(e) => setEntidad(e.target.value)} list="inv-ent-capt" placeholder="Banco, bróker…" className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm" style={{ borderColor: C.line }} />
            <datalist id="inv-ent-capt">{entidades.map((e) => <option key={e} value={e} />)}</datalist>
          </label>
          <p className="text-[11px] text-slate-400">Las capturas se envían a tu proveedor de IA solo para leerlas; la app no las guarda.</p>
          {err && <p className="text-xs" style={{ color: C.expense }}>{err}</p>}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <label className="block text-xs text-slate-600">Plataforma
            <input value={entidad} onChange={(e) => setEntidad(e.target.value)} className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm" style={{ borderColor: C.line }} />
          </label>
          <p className="text-xs text-slate-500">Revisa lo leído. Si ya lo tenías (mismo ISIN o nombre), se actualiza; si no, se añade.</p>
          {filas.map((f, i) => (
            <label key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${f.p ? "" : "opacity-60"}`} style={{ borderColor: C.line }}>
              <input type="checkbox" className="mt-1 accent-blue-600" disabled={!f.p} checked={f.incluir}
                onChange={(e) => setFilas((xs) => xs.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.fila.nombre || "(sin nombre)"}</span>
                <span className="block text-xs text-slate-500" style={tnum}>
                  {f.p ? <>
                    {f.p.participaciones ? `${nfNum.format(f.p.participaciones)} part.` : `valor ${fmtE0(f.p.valorAlta)}`}
                    {" · "}{f.p.coste != null ? `invertido ${fmtE(f.p.coste)}` : "sin coste"}
                    {f.fila.isin ? ` · ${f.fila.isin}` : f.fila.ticker ? ` · ${f.fila.ticker}` : ""}
                  </> : <span style={{ color: C.expense }}>{f.error}</span>}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Importar({ onImportar, onClose }) {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState(null);
  const ir = (reemplazar) => {
    try {
      const j = JSON.parse(txt);
      const todos = Array.isArray(j) ? j : j.posiciones;
      if (!Array.isArray(todos)) throw new Error("Se esperaba una lista.");
      // Sin participaciones ni valor: solo cambia algunos datos (p. ej. la fecha de compra) de lo que ya tienes.
      const tieneCantidad = (x) => x && (x.participaciones != null || x.valorAlta != null);
      const lista = normalizarPosiciones(todos.filter(tieneCantidad), dia(new Date()));
      onImportar(lista, reemplazar, Array.isArray(j) ? null : j.aportacion || null, reemplazar ? [] : todos.filter((x) => !tieneCantidad(x)));
    } catch (e) { setErr(e instanceof SyntaxError ? "El texto no es un JSON válido." : e.message); }
  };
  return (
    <Modal title="Importar posiciones" subtitle="Pega la lista en formato JSON" onClose={onClose}
      footer={<div className="flex flex-wrap gap-2"><Btn kind="primary" onClick={() => ir(false)} disabled={!txt.trim()}>Actualizar y añadir</Btn><Btn onClick={() => ir(true)} disabled={!txt.trim()}>Reemplazar todo</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      <p className="mb-2 text-xs text-slate-500">«Actualizar y añadir» cambia los productos que ya tienes (mismo ISIN o mismo nombre) y añade los nuevos. «Reemplazar todo» borra la lista actual.</p>
      <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setErr(null); }} rows={10} aria-label="Posiciones en JSON"
        className="w-full rounded-lg border p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}
        placeholder='[{"nombre":"Apple","entidad":"Mi bróker","tipo":"accion","isin":"US0378331005","participaciones":10,"costeMedio":150}]' />
      {err && <p className="mt-2 text-xs" style={{ color: C.expense }}>{err}</p>}
    </Modal>
  );
}

function Aportacion({ inv, movs, onGuardar, onClose }) {
  const candidatos = useMemo(() => candidatosAportacion(movs), [movs]);
  const robo = inv.posiciones.filter((p) => p.robo);
  const desde = robo.reduce((mx, p) => (p.alta > mx ? p.alta : mx), "0000-00-00");
  return (
    <Modal title="Aportación mensual" subtitle="Solo para carteras automatizadas (robo-advisor)" onClose={onClose}
      footer={<div className="flex gap-2">{inv.aportacion && <Btn onClick={() => onGuardar(null)}>Quitar</Btn>}<Btn onClick={onClose} className="ml-auto">Cerrar</Btn></div>}>
      {!robo.length ? <p className="text-sm text-slate-600">Primero marca como «cartera automatizada» los fondos que la forman (al editarlos).</p> : (
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">Si cada mes transfieres dinero a tu cartera automatizada, elige aquí esa transferencia de tu banco. Así no tienes que actualizar participaciones: cada transferencia posterior al {fechaLarga(desde)} se suma sola a los {robo.length} fondos de la cartera, repartida según su peso. Si no aportas cada mes, no necesitas esto.</p>
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

export function InversionesTab({ inversiones, setInversiones, movs, servidor, ai, aiOn }) {
  const inv = useMemo(() => inversiones || { posiciones: [], aportacion: null }, [inversiones]);
  const [datos, setDatos] = useState(() => leer(PRECIOS_KEY) || { series: {}, meta: {} });
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [vista, setVista] = useState("entidad");
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null);
  const [importando, setImportando] = useState(false);
  const [aportando, setAportando] = useState(false);
  const [nota, setNota] = useState(null);
  const [capturas, setCapturas] = useState(false);
  // Qué estás mirando: todo, una plataforma o un producto. Manda en la tarjeta, la gráfica y las listas.
  const [nivel, setNivel] = useState({ e: null, id: null });
  const [periodo, setPeriodo] = useState("1m");
  const [referencia, setReferencia] = useState(referenciaInicial);
  const [desglose, setDesglose] = useState("entidad");
  const [subiendo, setSubiendo] = useState(false); // importar el archivo del bróker
  const [seccion, setSeccion] = useState("cartera"); // cartera | renta

  const traer = useCallback(async () => {
    const d = await servidor.get("/inversiones/precios?desde=" + sumarDias(dia(new Date()), -800));
    const v = { series: d.series || {}, meta: d.meta || {}, ts: Date.now() };
    setDatos(v); guardar(PRECIOS_KEY, v);
  }, [servidor]);

  // Lo que hay que seguir: se lo dice al servidor cuando cambia, y trae precios si son viejos.
  // Además de lo tuyo, los índices con los que comparar (fondos indexados en euros).
  const simbolos = [...simbolosDe(inv), ...(inv.posiciones.length ? REFERENCIAS.map((r) => r.simbolo) : [])].sort().join(",");
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
            const r = await servidor.get(`/inversiones/resolver?isin=${encodeURIComponent(p.isin || "")}&nombre=${encodeURIComponent(p.nombre || "")}&tipo=${p.tipo}&ticker=${encodeURIComponent(p.ticker || "")}&bolsa=${encodeURIComponent(p.bolsa || "")}`);
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

  // Con la cartera de ejemplo, sus precios inventados se suman a los de tu servidor.
  const datosA = useMemo(() => conEjemplo(datos, inv), [datos, inv]);
  const a = useMemo(() => analizarInversiones(inv, datosA, movs), [inv, datosA, movs]);
  const ejemplo = esEjemplo(inv);
  const importarArchivo = (lista) => {
    try {
      const norm = normalizarPosiciones(lista, dia(new Date()));
      // Al traer lo tuyo, la cartera de ejemplo se va.
      if (ejemplo) setInversiones((x) => ({ ...x, posiciones: x.posiciones.filter((p) => !p.ejemplo) }));
      importar(norm, false, null);
      setSubiendo(false);
    } catch (e) { setAviso("No se pudo importar: " + e.message); setSubiendo(false); }
  };
  const entidades = [...new Set(inv.posiciones.map((p) => p.entidad).filter(Boolean))];
  const filaAbierta = a.filas.find((f) => f.p.id === abierta);
  const entidadDe = (p) => p.entidad || "Sin entidad";
  const selFilas = nivel.id ? a.filas.filter((f) => f.p.id === nivel.id) : nivel.e ? a.filas.filter((f) => entidadDe(f.p) === nivel.e) : a.filas;
  const sel = (() => {
    const valor = selFilas.reduce((x, f) => x + f.valor, 0), hoy = selFilas.reduce((x, f) => x + (f.hoy || 0), 0);
    const cc = selFilas.filter((f) => f.coste != null);
    const invertido = cc.reduce((x, f) => x + f.coste, 0), valorCC = cc.reduce((x, f) => x + f.valor, 0);
    return { valor, hoy, hoyPct: valor - hoy ? hoy / (valor - hoy) : null, invertido, ganancia: cc.length ? valorCC - invertido : null, gananciaPct: invertido ? valorCC / invertido - 1 : null, sinCoste: selFilas.length - cc.length };
  })();
  const nombreSel = nivel.id ? selFilas[0]?.p.nombre : nivel.e || "Todas tus inversiones";
  const selIds = selFilas.map((f) => f.p.id);
  const filasPorId = Object.fromEntries(a.filas.map((f) => [f.p.id, f]));
  const entradaSel = selFilas.reduce((mn, f) => (f.entrada && f.entrada < mn ? f.entrada : mn), "9999-12-31");
  // Qué se desglosa en «Qué explica tu resultado»: plataformas (o todos los productos) o los productos de la elegida.
  const partesMov = nivel.id ? [] : !nivel.e && desglose === "entidad"
    ? a.porEntidad.map((g, i) => ({ k: g.nombre, nombre: g.nombre, entidad: g.nombre, ids: g.filas.map((f) => f.p.id), color: PALETA[i % PALETA.length] }))
    : selFilas.map((f) => ({ k: f.p.id, nombre: f.p.nombre, pos: f.p.id, ids: [f.p.id] }));
  const ultimaFecha = selFilas.reduce((mx, f) => (f.fechaPrecio && f.fechaPrecio > mx ? f.fechaPrecio : mx), "");
  const guardarPos = (p) => { setInversiones((x) => ({ ...x, posiciones: x.posiciones.some((q) => q.id === p.id) ? x.posiciones.map((q) => (q.id === p.id ? p : q)) : [...x.posiciones, p] })); setEditando(null); };
  const borrar = (id) => { if (window.confirm("¿Quitar esta posición de tus inversiones?")) { setInversiones((x) => ({ ...x, posiciones: x.posiciones.filter((p) => p.id !== id) })); setAbierta(null); } };
  const importar = (lista, reemplazar, aportacion, parciales = []) => {
    const r = reemplazar ? null : fusionarPosiciones(inv.posiciones, lista);
    const rp = parciales.length ? actualizarCampos(reemplazar ? lista : r.posiciones, parciales) : null;
    setInversiones((x) => {
      const base = reemplazar ? lista : fusionarPosiciones(x.posiciones, lista).posiciones;
      return { posiciones: parciales.length ? actualizarCampos(base, parciales).posiciones : base, aportacion: aportacion || x.aportacion || null };
    });
    setAviso(null);
    const partes = [];
    if (reemplazar) partes.push(`Lista sustituida: ${lista.length} productos.`);
    else if (lista.length) partes.push(`${r.actualizadas} ${r.actualizadas === 1 ? "producto actualizado" : "productos actualizados"} y ${r.añadidas} ${r.añadidas === 1 ? "añadido" : "añadidos"}.`);
    if (rp) partes.push(`${rp.actualizadas} con datos cambiados${rp.sinEncontrar.length ? `; no encontrados: ${rp.sinEncontrar.join(", ")}` : ""}.`);
    setNota(partes.join(" "));
    setImportando(false);
  };

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
    <p className="flex items-start gap-2 text-xs text-slate-500"><Repeat size={13} className="mt-0.5 shrink-0" />Si aportas cada mes, clasifica esas transferencias como «Ahorro e inversión» y elígela en <button type="button" className="underline" onClick={() => setAportando(true)}>Aportación mensual</button>: se sumarán solas.</p>
  ));

  return (
    <div className="space-y-4">
      {!servidor.listo && !esEjemplo(inv) && <Card className="p-4 text-sm text-slate-600">Para que los precios se actualicen solos necesitas tu servidor conectado (Ajustes → Tus datos y sincronización). Puedes importar igual: hasta entonces verás el valor de tu última operación.</Card>}
      {servidor.listo && !servidor.rasgo && <Card className="p-4 text-sm text-slate-600">Tu servidor aún no sabe traer precios: se actualiza solo en unos minutos si lo publicas desde GitHub. Mientras, puedes ir añadiendo tus posiciones.</Card>}
      {aviso && <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{aviso}</div>}
      {nota && <div role="status" className="flex items-start justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: C.line, background: C.surface }}><span>{nota}</span><button type="button" className="text-xs underline" onClick={() => setNota(null)}>Cerrar</button></div>}

      {!inv.posiciones.length ? (
        <Bienvenida aiOn={aiOn} onImportar={() => setSubiendo(true)} onCapturas={() => setCapturas(true)} onAnadir={() => setEditando({})}
          onEjemplo={() => setInversiones({ posiciones: carteraEjemplo(), aportacion: null })} onPegar={() => setImportando(true)} />
      ) : (
        <>
          {ejemplo && (
            <div role="status" className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: C.accent, background: C.accentSoft }}>
              <span>Es una <strong>cartera de ejemplo</strong> con precios inventados. Explórala y, cuando quieras, trae la tuya.</span>
              <span className="flex shrink-0 gap-1.5"><Btn size="sm" kind="primary" onClick={() => setSubiendo(true)}>Traer la mía</Btn><Btn size="sm" onClick={() => setInversiones((x) => ({ ...x, posiciones: x.posiciones.filter((p) => !p.ejemplo) }))}>Quitar</Btn></span>
            </div>
          )}
          <Seg ariaLabel="Sección" value={seccion} onChange={setSeccion} options={[{ v: "cartera", l: "Tu cartera" }, { v: "renta", l: "Impuestos (Renta)" }]} />
          {seccion === "renta" ? <Renta inv={inv} filas={a.filas} datos={datosA} onImportar={() => setSubiendo(true)} /> : (<>
          {/* Filtro: plataforma y producto. Todo lo de debajo se refiere a lo elegido. */}
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Plataforma" value={nivel.e || ""} onChange={(e) => setNivel({ e: e.target.value || null, id: null })}
              className="min-w-0 rounded-lg border bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <option value="">Plataformas: todas</option>
              {a.porEntidad.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
            </select>
            <select aria-label="Producto" value={nivel.id || ""} onChange={(e) => { const f = a.filas.find((x) => x.p.id === e.target.value); setNivel(f ? { e: entidadDe(f.p), id: f.p.id } : { e: nivel.e, id: null }); }}
              className="min-w-0 rounded-lg border bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <option value="">Productos: todos</option>
              {(nivel.e ? a.filas.filter((f) => entidadDe(f.p) === nivel.e) : a.filas).map((f) => <option key={f.p.id} value={f.p.id}>{f.p.nombre}</option>)}
            </select>
          </div>

          <Panel a={a} ids={selIds} nombre={nombreSel} periodo={periodo} setPeriodo={setPeriodo} referencia={referencia} setReferencia={setReferencia}
            accion={<Btn size="sm" onClick={actualizar} disabled={cargando || !servidor.listo || !servidor.rasgo} title="Pedir los últimos precios ahora"><RefreshCw size={13} className={cargando ? "animate-spin" : ""} /> {cargando ? "Actualizando" : "Actualizar"}</Btn>}
            vacio={<SinHistoria a={a} ids={selIds} desde={entradaSel} robo={selFilas.some((f) => f.p.robo) && !inv.aportacion} candidato={candidato} onUsarAportacion={() => candidato && usarAportacion(candidato)} onFecha={setAbierta} primerId={selFilas.find((f) => !f.compraConocida)?.p.id || selIds[0]} />}
            cifras={
              <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3" style={{ borderColor: C.line }}>
                <Cifra label="Invertido">{sel.invertido ? fmtE0(sel.invertido) : "–"}</Cifra>
                <Cifra label="Ganas en total" color={colorDe(sel.ganancia)} sub={sel.ganancia == null ? "falta el coste" : pct(sel.gananciaPct)}>{sel.ganancia == null ? "–" : eur(Math.round(sel.ganancia), true).replace(/,00(?=\s?€)/, "")}</Cifra>
                <Cifra label="Últ. sesión" color={colorDe(sel.hoy)} sub={`${pct(sel.hoyPct)}${ultimaFecha ? ` · ${fechaCorta(ultimaFecha)}` : ""}`}>{eur(Math.round(sel.hoy), true).replace(/,00(?=\s?€)/, "")}</Cifra>
              </div>
            } />
          {!nivel.id && <Reparto filas={selFilas} datos={datosA} />}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Seg ariaLabel="Agrupar por" value={vista} onChange={setVista} options={[{ v: "entidad", l: "Por plataforma" }, { v: "tipo", l: "Por tipo" }]} />
            <div className="ml-auto flex gap-1.5">
              <Btn size="sm" onClick={() => setSubiendo(true)} title="Importar el archivo de operaciones de tu bróker"><FileSpreadsheet size={14} /> Importar</Btn>
              <Btn size="sm" onClick={() => setCapturas(true)} title="Cargar o actualizar desde capturas de tu banco"><Camera size={14} /></Btn>
              <Btn size="sm" kind="primary" onClick={() => setEditando({})}><Plus size={14} /> Añadir</Btn>
            </div>
          </div>
          {(vista === "entidad" ? a.porEntidad : a.porTipo)
            .map((g) => (nivel.e ? { ...g, filas: g.filas.filter((f) => selFilas.includes(f)) } : g)).filter((g) => g.filas.length)
            .map((g, _i, todos) => <Grupo key={g.nombre} g={g} solo={todos.length === 1} datos={datosA} onAbrir={setAbierta} nota={vista === "entidad" && g.nombre === entidadRobo ? notaRobo : null} />)}

          <QueHaMovido a={a} periodo={periodo} partes={partesMov} filasPorId={filasPorId} ai={ai} aiOn={aiOn}
            control={!nivel.e && a.porEntidad.length > 1 && <Seg ariaLabel="Desglosar por" value={desglose} onChange={setDesglose} options={[{ v: "entidad", l: "Plataformas" }, { v: "producto", l: "Productos" }]} />}
            volver={nivel.e && !nivel.id ? { a: "todas las plataformas", aqui: nivel.e, onClick: () => setNivel({ e: null, id: null }) } : null}
            onElegir={(x) => (x.pos ? setAbierta(x.pos) : setNivel({ e: x.entidad, id: null }))} />
          <Destacados a={a} ids={selIds} periodo={periodo} filas={selFilas} datos={datosA} onFecha={setAbierta} onBuscar={setEditando} />

          <details className="rounded-2xl border bg-white px-4 py-3 text-sm" style={{ borderColor: C.line }}>
            <summary className="cursor-pointer font-semibold">¿Cómo se calcula?</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-600">
              <li><strong>Ganas en total</strong> = valor hoy − lo invertido. Coincide con tu entidad si tienes las mismas participaciones y el mismo coste (importa su archivo o captura su ficha).</li>
              <li><strong>Resultado de un periodo</strong> = valor al final − al principio − lo que pusiste entre medias. Lo que compraste dentro del periodo cuenta desde ese día.</li>
              <li><strong>Precios</strong>: acciones cada media hora en horario de bolsa; fondos una vez al día, con 1–2 días de retraso (por eso a veces no cuadra al céntimo con tu banco).</li>
              <li>Todo el detalle, en <a className="underline" href="https://github.com/lsantos44/finanzas-app/blob/main/docs/INVERSIONES.md" target="_blank" rel="noopener noreferrer">la guía de Inversiones</a>.</li>
            </ul>
          </details>

          {robo.length > 0 && <div><Btn size="sm" onClick={() => setAportando(true)}><Repeat size={13} /> Aportación mensual{inv.aportacion ? ` · ${fmtE0(inv.aportacion.importe)}` : ""}</Btn></div>}
          </>)}
        </>
      )}

      {subiendo && <ImportarArchivo entidades={entidades} onImportar={importarArchivo} onClose={() => setSubiendo(false)} onCapturas={() => { setSubiendo(false); setCapturas(true); }} onPegar={() => { setSubiendo(false); setImportando(true); }} />}
      {filaAbierta && <Detalle f={filaAbierta} datos={datosA} onFecha={(id, fecha) => setInversiones((x) => ({ ...x, posiciones: x.posiciones.map((q) => (q.id === id ? (fecha ? { ...q, compra: fecha } : (({ compra, ...r }) => r)(q)) : q)) }))} onClose={() => setAbierta(null)} onEditar={() => { setEditando(filaAbierta.p); setAbierta(null); }} onBorrar={() => borrar(filaAbierta.p.id)} />}
      {editando && <Editor inicial={editando} entidades={entidades} servidor={servidor} onGuardar={guardarPos} onClose={() => setEditando(null)} />}
      {importando && <Importar onImportar={importar} onClose={() => setImportando(false)} />}
      {capturas && <DesdeCapturas ai={ai} aiOn={aiOn} entidades={entidades} onClose={() => setCapturas(false)} onGuardar={(lista) => { importar(lista, false, null); setCapturas(false); }} />}
      {aportando && <Aportacion inv={inv} movs={movs} onGuardar={(ap) => { setInversiones((x) => ({ ...x, aportacion: ap })); setAportando(false); }} onClose={() => setAportando(false)} />}
    </div>
  );
}
