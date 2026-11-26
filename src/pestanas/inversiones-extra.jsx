import { C, decodeBuffer, detectDelimiter, fmtE, fmtE0, isSpreadsheetFile, nfNum, spreadsheetToRows, tnum, tokenizeCSV } from "../core.js";
import { Btn, Card, Modal } from "../ui/comunes.jsx";
import { leerOperaciones, posicionesDeOperaciones } from "../inversiones-import.js";
import { csvVentas, impuestoAhorro, resumenAnual, simularVentas, ventasFIFO } from "../fiscal-inversiones.js";
import { AlertTriangle, Camera, Download, FileSpreadsheet, Lightbulb, Plus, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

/* ============================================================
   INVERSIONES · importar el archivo del bróker, Renta y primer uso
   ============================================================ */

const pct = (v) => (v == null || !isFinite(v) ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`);
const eur0 = (v) => (v == null || !isFinite(v) ? "–" : `${v > 0.5 ? "+" : ""}${fmtE0(v)}`);
const colorDe = (v) => (v == null || Math.abs(v) < 0.5 ? C.muted : v > 0 ? C.income : C.expense);
const fechaCorta = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" }) : "");

// Dónde se descarga el archivo de operaciones en cada sitio. Si tu entidad no deja exportar,
// las capturas con IA o añadir a mano.
export const COMO_DESCARGAR = [
  { b: "DEGIRO", t: "En la web: Actividad → Transacciones. Pon como fecha de inicio el día de tu primera compra y pulsa Exportar → CSV." },
  { b: "Revolut", t: "Inversiones → … → Documentos → Extracto de la cuenta de valores (Excel o CSV), desde el principio." },
  { b: "Interactive Brokers", t: "Informes → Flex Queries → una consulta de «Trades» en CSV, desde que abriste la cuenta." },
  { b: "Trade Republic, MyInvestor, tu banco…", t: "Busca en el histórico de operaciones u órdenes la opción Exportar o Descargar (CSV o Excel). Si no la hay, usa las capturas." },
];

async function filasDeArchivo(file) {
  const buf = await file.arrayBuffer();
  if (isSpreadsheetFile(file)) return spreadsheetToRows(buf);
  const txt = decodeBuffer(buf);
  return tokenizeCSV(txt, detectDelimiter(txt));
}

/* ---------- Importar el archivo de operaciones ---------- */
export function ImportarArchivo({ entidades, onImportar, onClose, onCapturas }) {
  const [leido, setLeido] = useState(null);
  const [err, setErr] = useState(null);
  const [entidad, setEntidad] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const ref = useRef(null);
  const elegir = async (file) => {
    if (!file) return;
    setErr(null); setLeido(null); setLeyendo(true);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("El archivo es demasiado grande (más de 15 MB).");
      const r = leerOperaciones(await filasDeArchivo(file));
      setLeido({ ...r, archivo: file.name });
      setEntidad((e) => e || r.broker || "");
    } catch (e) { setErr(e.message); }
    finally { setLeyendo(false); if (ref.current) ref.current.value = ""; }
  };
  const posiciones = useMemo(() => (leido ? posicionesDeOperaciones(leido.operaciones, entidad.trim() || leido.broker || "Mi bróker", leido.broker) : []), [leido, entidad]);
  const abiertas = posiciones.filter((p) => p.participaciones > 1e-9), cerradas = posiciones.filter((p) => !(p.participaciones > 1e-9));
  const motivos = useMemo(() => {
    const m = {};
    for (const s of leido?.saltadas || []) m[s.motivo] = (m[s.motivo] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [leido]);
  const rango = leido ? [leido.operaciones.reduce((m, o) => (o.fecha < m ? o.fecha : m), "9999"), leido.operaciones.reduce((m, o) => (o.fecha > m ? o.fecha : m), "")] : null;

  return (
    <Modal title="Importar de tu bróker" subtitle="El archivo de operaciones (CSV o Excel)" onClose={onClose} wide
      footer={<div className="flex flex-wrap gap-2">
        {leido && <Btn kind="primary" onClick={() => onImportar(posiciones)} disabled={!posiciones.length}><Upload size={14} /> Importar {posiciones.length} {posiciones.length === 1 ? "producto" : "productos"}</Btn>}
        <Btn onClick={onClose} className="ml-auto">Cancelar</Btn></div>}>
      <input ref={ref} type="file" accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} aria-label="Archivo de operaciones" />
      {!leido ? (
        <div className="space-y-4">
          <button type="button" onClick={() => ref.current?.click()} disabled={leyendo}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }}>
            <FileSpreadsheet size={28} style={{ color: C.accent }} />
            <span className="font-medium">{leyendo ? "Leyendo…" : "Elegir el archivo"}</span>
            <span className="text-xs text-slate-500">CSV o Excel con tus compras y ventas. Se lee aquí, en tu dispositivo: no se envía a nadie.</span>
          </button>
          {err && <p className="flex items-start gap-2 text-sm" style={{ color: C.expense }}><AlertTriangle size={15} className="mt-0.5 shrink-0" />{err}</p>}
          <div>
            <h4 className="text-sm font-semibold">¿Dónde lo descargo?</h4>
            <dl className="mt-2 space-y-2 text-sm">
              {COMO_DESCARGAR.map((x) => <div key={x.b}><dt className="font-medium">{x.b}</dt><dd className="text-slate-600">{x.t}</dd></div>)}
            </dl>
            <p className="mt-3 text-xs text-slate-500">Mejor el histórico completo (desde tu primera compra): así salen bien lo que te costó cada cosa y las ganancias de cada venta. Si lo vuelves a importar más adelante, se actualiza sin duplicar.
              {onCapturas && <> ¿Tu entidad no deja exportar? <button type="button" className="underline" onClick={onCapturas}>Usa capturas de pantalla</button>.</>}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: C.line, background: C.surface }}>
            <div className="font-medium">{leido.broker ? `Archivo de ${leido.broker}` : "Archivo leído"} · {leido.archivo}</div>
            <div className="text-xs text-slate-500" style={tnum}>
              {nfNum.format(leido.operaciones.length)} operaciones del {fechaCorta(rango[0])} al {fechaCorta(rango[1])}
              {leido.saltadas.length > 0 && <> · {leido.saltadas.length} filas que no son compraventas ({motivos.map(([k, n]) => `${k} ${n}`).join(", ")})</>}
            </div>
          </div>
          <label className="block text-sm">
            <span className="font-medium">¿En qué plataforma está?</span>
            <input value={entidad} onChange={(e) => setEntidad(e.target.value)} list="inv-entidades" placeholder="DEGIRO, MyInvestor, tu banco…"
              className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
            <datalist id="inv-entidades">{entidades.map((e) => <option key={e} value={e} />)}</datalist>
          </label>
          <div>
            <h4 className="text-sm font-semibold">Lo que tienes ({abiertas.length})</h4>
            <div className="mt-1 divide-y text-sm" style={{ borderColor: C.line }}>
              {abiertas.map((p) => (
                <div key={p.isin || p.ticker || p.nombre} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.nombre}</div>
                    <div className="truncate text-xs text-slate-500" style={tnum}>{p.isin || p.ticker} · {p.ops.length} {p.ops.length === 1 ? "operación" : "operaciones"} · desde {fechaCorta(p.compra)}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs" style={tnum}>
                    <div className="font-semibold">{nfNum.format(Math.round(p.participaciones * 10000) / 10000)} {p.tipo === "fondo" ? "part." : "acc."}</div>
                    <div className="text-slate-500">te costaron {fmtE0(p.coste)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {cerradas.length > 0 && <p className="text-xs text-slate-500">Y {cerradas.length} {cerradas.length === 1 ? "producto vendido" : "productos vendidos"} del todo ({cerradas.slice(0, 3).map((p) => p.nombre).join(", ")}{cerradas.length > 3 ? "…" : ""}): no salen en tu cartera, pero sus ventas cuentan en la Renta.</p>}
          <p className="text-xs text-slate-500">Si ya tenías alguno (mismo ISIN o nombre en esta plataforma), se actualiza: participaciones, coste y fechas pasan a ser las del archivo. Los precios llegarán de tu servidor.</p>
          <button type="button" className="text-xs underline" onClick={() => { setLeido(null); setErr(null); }}>Elegir otro archivo</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Renta: ganancias y pérdidas de tus ventas, y qué pasaría si vendes ---------- */
export function Renta({ inv, filas, datos, onImportar }) {
  const ventas = useMemo(() => ventasFIFO(inv.posiciones, datos), [inv.posiciones, datos]);
  const hoyA = new Date().getFullYear();
  const anios = [...new Set([hoyA, ...ventas.map((v) => Number(v.fecha.slice(0, 4)))])].sort((a, b) => b - a);
  const [anio, setAnio] = useState(hoyA);
  const r = useMemo(() => resumenAnual(ventas, anio), [ventas, anio]);
  const sim = useMemo(() => simularVentas(filas, resumenAnual(ventas, hoyA)?.base || 0), [filas, ventas, hoyA]);
  const conOps = inv.posiciones.some((p) => p.ops?.length);
  const descargar = () => {
    const blob = new Blob(["﻿" + csvVentas(r.ventas)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `ventas-inversiones-${anio}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="space-y-4">
      {!conOps && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Para calcular tu Renta necesito tus ventas</h3>
          <p className="mt-1 text-sm text-slate-600">Importa el archivo de operaciones de tu bróker y verás las ganancias y pérdidas de cada año, como las calcula Hacienda. Mientras, abajo tienes lo que pasaría si vendieras hoy.</p>
          <Btn size="sm" kind="primary" className="mt-3" onClick={onImportar}><Upload size={13} /> Importar de tu bróker</Btn>
        </Card>
      )}

      {conOps && r && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Renta {anio}: tus ventas</h3>
            <select aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="rounded-lg border bg-white px-2 py-1 text-xs" style={{ borderColor: C.line }}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {!r.ventas.length ? <p className="mt-2 text-sm text-slate-500">En {anio} no has vendido nada{anio === hoyA ? " todavía" : ""}: no hay ganancias ni pérdidas que declarar por tus inversiones.</p> : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Dato l="Ganancias" v={eur0(r.ganancias)} c={C.income} />
                <Dato l="Pérdidas" v={eur0(r.perdidas)} c={r.perdidas ? C.expense : C.muted} />
                <Dato l="Saldo" v={eur0(r.saldo)} c={colorDe(r.saldo)} />
                <Dato l="Impuesto estimado" v={fmtE0(r.impuesto)} sub={r.base > 0 ? `${pct(r.impuesto / r.base).replace("+", "")} de media` : "nada que pagar"} />
              </div>
              {r.compensado > 0 && <p className="mt-2 text-xs text-slate-600">Se compensan {fmtE0(r.compensado)} de pérdidas de años anteriores.</p>}
              {r.saldo < 0 && <p className="mt-2 text-xs text-slate-600">Saldo negativo: estos {fmtE0(-r.saldo)} se pueden compensar con ganancias de los próximos 4 años.</p>}
              {r.aplazadas < 0 && <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: C.warn }}><AlertTriangle size={13} className="mt-0.5 shrink-0" />{fmtE0(-r.aplazadas)} de pérdidas no cuentan aún: recompraste lo mismo poco antes o después de vender (regla de los dos meses). Contarán cuando vendas eso.</p>}
              {r.aCompensar.length > 0 && <p className="mt-2 text-xs text-slate-500">Te quedan por compensar: {r.aCompensar.map((x) => `${fmtE0(x.queda)} de ${x.anio}`).join(", ")}.</p>}
              <div className="mt-3 divide-y text-sm" style={{ borderColor: C.line }}>
                {r.ventas.map((v, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{v.nombre}</div>
                      <div className="text-xs text-slate-500" style={tnum}>{fechaCorta(v.fecha)} · vendiste por {fmtE(v.transmision)}, te costó {fmtE(v.adquisicion)}</div>
                      {v.diferida && <div className="text-[11px]" style={{ color: C.warn }}>Aplazada: recompra el {fechaCorta(v.diferida.fecha)}</div>}
                      {v.sinCompra > 0 && <div className="text-[11px]" style={{ color: C.expense }}>Faltan compras en el archivo: importa el histórico completo.</div>}
                    </div>
                    <div className="shrink-0 font-semibold" style={{ ...tnum, color: colorDe(v.ganancia) }}>{eur0(v.ganancia)}</div>
                  </div>
                ))}
              </div>
              <Btn size="sm" className="mt-3" onClick={descargar}><Download size={13} /> Descargar para tu gestor (CSV)</Btn>
            </>
          )}
        </Card>
      )}

      {sim.cosecha.length > 0 && sim.ahorro >= 5 && (
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Lightbulb size={15} style={{ color: C.warn }} /> Puedes pagar menos este año</h3>
          <p className="mt-1 text-sm text-slate-600" style={tnum}>Este año llevas <strong>{eur0(resumenAnual(ventas, hoyA)?.base || 0)}</strong> de ganancias. Si vendes antes del 31 de diciembre algo que va en pérdidas, esa pérdida las compensa:</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {sim.cosecha.map((x) => <li key={x.f.p.id} className="flex justify-between gap-3" style={tnum}><span className="min-w-0 truncate">{x.f.p.nombre} <span className="text-slate-500">({eur0(x.latente)})</span></span><span className="shrink-0 font-medium" style={{ color: C.income }}>ahorras ~{fmtE0(x.ahorro)}</span></li>)}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">Si vuelves a comprar lo mismo en los 2 meses siguientes (12 si es un fondo que no cotiza), la pérdida no cuenta. Entre fondos, un traspaso no tributa y no realiza ni ganancia ni pérdida.</p>
        </Card>
      )}

      {sim.posiciones.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Si vendieras hoy</h3>
          <p className="mt-0.5 text-xs text-slate-500">Lo que ganarías o perderías con cada producto y lo que añadiría a tu impuesto de {hoyA}, sumado a lo que ya has vendido.</p>
          <div className="mt-2 divide-y text-sm" style={{ borderColor: C.line }}>
            {sim.posiciones.map((x) => (
              <div key={x.f.p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{x.f.p.nombre}{x.fondo && <span className="block text-[11px] text-slate-400">Fondo: traspasándolo a otro fondo no pagas nada</span>}</span>
                <span className="shrink-0 text-right" style={tnum}>
                  <span className="block font-semibold" style={{ color: colorDe(x.latente) }}>{eur0(x.latente)}</span>
                  <span className="block text-[11px] text-slate-500">{x.impuesto > 0.5 ? `pagarías ~${fmtE0(x.impuesto)}` : x.latente < 0 ? "compensa ganancias" : "sin impuesto"}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="px-1 text-[11px] leading-snug text-slate-400">Estimación con las reglas generales del IRPF (tipos del ahorro {(impuestoAhorro(1) * 100).toFixed(0)}–30 %, FIFO, regla de los dos meses, traspasos entre fondos y compensación de 4 años). No incluye dividendos ni intereses ni otras ganancias de tu base del ahorro, ni normas forales. No es asesoramiento fiscal: compruébalo con tu borrador o con tu gestor.</p>
    </div>
  );
}

function Dato({ l, v, c, sub }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: C.line }}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{l}</div>
      <div className="text-base font-semibold" style={{ ...tnum, color: c || C.ink }}>{v}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/* ---------- Primer uso: tres pasos y tres maneras de empezar ---------- */
export function Bienvenida({ aiOn, onImportar, onCapturas, onAnadir, onEjemplo, onPegar }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Todas tus inversiones, en un solo sitio</h2>
      <p className="mt-1 text-sm text-slate-600">Fondos, acciones y ETF de todas tus plataformas juntos, con su precio al día, lo que ganas de verdad (descontando lo que pones), cómo vas frente al mercado y lo que te tocaría pagar en la Renta.</p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {[["1", "Trae tus operaciones", "El archivo de tu bróker, capturas o a mano."], ["2", "Revisa", "Te enseño lo que he entendido antes de guardar."], ["3", "Listo", "Los precios se actualizan solos cada día."]].map(([n, t, d]) => (
          <li key={n} className="flex gap-2 rounded-xl border p-3" style={{ borderColor: C.line }}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: C.accent }}>{n}</span>
            <span className="text-sm"><span className="font-medium">{t}</span><span className="block text-xs text-slate-500">{d}</span></span>
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-2">
        <button type="button" onClick={onImportar} className="flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.accent }}>
          <FileSpreadsheet size={22} style={{ color: C.accent }} className="shrink-0" />
          <span className="min-w-0"><span className="block font-medium">Importar el archivo de tu bróker <span className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: C.accent }}>RECOMENDADO</span></span>
            <span className="block text-xs text-slate-500">DEGIRO, Revolut, Interactive Brokers, MyInvestor, Trade Republic, tu banco… Cada compra y venta exacta, sin teclear.</span></span>
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCapturas} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
            <Camera size={20} className="shrink-0 text-slate-500" />
            <span><span className="block text-sm font-medium">Desde capturas</span><span className="block text-xs text-slate-500">{aiOn ? "La IA lee tus pantallas del banco." : "Necesita la IA activada (Ajustes)."}</span></span>
          </button>
          <button type="button" onClick={onAnadir} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
            <Plus size={20} className="shrink-0 text-slate-500" />
            <span><span className="block text-sm font-medium">Añadir a mano</span><span className="block text-xs text-slate-500">Busca el producto y di cuántas tienes.</span></span>
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: C.line }}>
        <button type="button" onClick={onEjemplo} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: C.accent }}><Sparkles size={14} /> Ver una cartera de ejemplo</button>
        <button type="button" onClick={onPegar} className="text-xs text-slate-500 underline">Pegar una lista (JSON)</button>
      </div>
    </Card>
  );
}

// Las operaciones de un producto, en su ficha: para ver de dónde salen las cifras.
export function ListaOperaciones({ ops }) {
  if (!ops?.length) return null;
  return (
    <details className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: C.line }}>
      <summary className="cursor-pointer font-medium">Tus operaciones ({ops.length})</summary>
      <div className="mt-2 max-h-56 divide-y overflow-y-auto" style={{ borderColor: C.line }}>
        {[...ops].reverse().map((o, i) => (
          <div key={i} className="flex justify-between gap-3 py-1.5 text-xs" style={tnum}>
            <span>{fechaCorta(o.fecha)} · <span style={{ color: o.u > 0 ? C.income : C.expense }}>{o.traspaso ? "Traspaso" : o.u > 0 ? "Compra" : "Venta"}</span> {nfNum.format(Math.abs(o.u))}</span>
            <span>{o.importe.toLocaleString("es-ES", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} {o.divisa || "EUR"}{o.comision ? ` (comisión ${o.comision.toLocaleString("es-ES")})` : ""}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
