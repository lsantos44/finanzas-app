import { C, INTERNAL_SET, MACRO_EMOJI, buildHierarchy, buildRecap, catColor, fmtDateShort, fmtE, fmtE0, fmtMonths, fmtPct, isRefundPart, macroColor, monthKey, monthLabelLong, nfNum, tnum } from "../core.js";
import { Btn, Card, HBar, Seg } from "../ui/comunes.jsx";
import { DonutCategories, KPI, SaldoChart, StackedTime } from "../ui/graficos.jsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, PiggyBank, Search, Star, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/* ============================================================
   PESTAÑA RESUMEN
   ============================================================ */
function AlertsCard({ alerts, onDrill, onOpenPending, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.line }}>
        <AlertTriangle size={15} style={{ color: C.warn }} />
        <h2 className="text-sm font-semibold">Avisos</h2>
        <span className="text-xs text-slate-400">{alerts.length === 1 ? "1 cosa que mirar" : `${alerts.length} cosas que mirar`}</span>
      </div>
      {alerts.map((a, i) => (
        <div key={a.id || i} className="flex items-start gap-1 border-b px-4 py-2.5 last:border-0" style={{ borderColor: C.line }}>
          {/* Los avisos miran todo tu histórico: su detalle también (con el periodo elegido salía vacío). */}
          <button type="button" onClick={() => (a.openPending ? onOpenPending?.() : a.drill && onDrill({ ...a.drill, todo: true }))}
            className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg py-0.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.sev === "alta" ? C.expense : a.sev === "baja" ? C.accent : C.warn }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{a.titulo}</span>
              <span className="block text-xs text-slate-500">{a.detalle}</span>
            </span>
            <ChevronRight size={14} className="mt-1 shrink-0 text-slate-300" />
          </button>
          {onDismiss && <button type="button" onClick={() => onDismiss(a)} aria-label="Marcar como visto" title="Marcar como visto (lo oculta)" className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={14} /></button>}
        </div>
      ))}
    </Card>
  );
}

function CierreMesCard({ cierre, onDrill }) {
  if (!cierre) return null;
  const mesTxt = monthLabelLong(cierre.mesKey);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.line }}>
        <CalendarDays size={15} style={{ color: C.accent }} />
        <h2 className="text-sm font-semibold">Resumen de {mesTxt}</h2>
      </div>
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: C.line }}>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(cierre.ingreso)}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(cierre.gasto)}</div>
          {cierre.deltaGasto !== null && (
            <div className="mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ ...tnum, background: cierre.deltaGasto > 0 ? C.expenseSoft : C.incomeSoft, color: cierre.deltaGasto > 0 ? C.expense : C.income }}>
              {cierre.deltaGasto > 0 ? "▲ +" : "▼ "}{fmtPct(Math.abs(cierre.deltaGasto))} vs {monthLabelLong(cierre.prevKey).split(" de ")[0]}
            </div>
          )}
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ahorrado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: cierre.neto >= 0 ? C.income : C.expense }}>{cierre.neto >= 0 ? "+" : ""}{fmtE0(cierre.neto)}</div>
          {cierre.ingreso > 0 && <div className="text-xs text-slate-400">{fmtPct(cierre.neto / cierre.ingreso)} de lo ingresado</div>}
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Saldo actual{cierre.saldoReal ? <span className="ml-1 rounded-full px-1.5 py-px text-[9px] font-semibold" style={{ background: C.accentSoft, color: C.accent }} title={cierre.saldoEstimado ? "Último saldo leído del banco más los movimientos que han llegado después" : "Leído del banco"}>{cierre.saldoEstimado ? "banco + movimientos" : "banco"}</span> : ""}</div>
          {cierre.saldoNow != null
            ? <div className="text-2xl font-bold tracking-tight" style={{ ...tnum, color: cierre.saldoNow >= 0 ? C.ink : C.expense }}>{fmtE0(cierre.saldoNow)}</div>
            : <div className="text-sm text-slate-400">Sin datos de saldo</div>}
        </div>
      </div>
      {(cierre.topCats.length > 0 || cierre.subidas.length > 0) && (
        <div className="border-t px-4 py-3" style={{ borderColor: C.line }}>
          {cierre.topCats.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-slate-400">Donde más fue:</span>
              {cierre.topCats.map((c) => (
                <button key={c.cat} type="button" onClick={() => onDrill({ type: "cat", key: c.cat, label: `${c.cat} · ${monthLabelLong(cierre.mesKey)}`, month: cierre.mesKey })} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ background: C.expenseSoft, color: C.expense }}>
                  {c.cat} {fmtE0(c.v)}
                </button>
              ))}
            </div>
          )}
          {cierre.subidas.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-slate-400">Se encareció:</span>
              {cierre.subidas.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium" style={{ background: C.warnSoft, color: C.warn }}>
                  <TrendingUp size={10} /> {s.label.slice(0, 22)} ({s.annualImpact > 0 ? "+" : ""}{fmtE0(s.annualImpact)}/año)
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* Recap mensual conversacional (tono neutro). Mes en curso por defecto; flechas para cambiar. */
function MonthRecap({ movs, onDrill }) {
  const months = useMemo(() => {
    const s = new Set();
    for (const m of movs) if (!m.omit) s.add(monthKey(m.date));
    return [...s].sort();
  }, [movs]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(Math.max(0, months.length - 1)); }, [months.length]);
  if (!months.length) return <Card className="p-8 text-center text-sm text-slate-500">Aún no hay datos para el recap.</Card>;
  const pos = Math.min(idx, months.length - 1);
  const mKey = months[pos];
  const r = buildRecap(movs, mKey);
  const mesTxt = monthLabelLong(mKey);
  const mesPrevTxt = monthLabelLong(r.prevKey).split(" de ")[0];
  const maxBar = Math.max(1, ...r.topCats.flatMap((c) => [c.v, c.prev]));
  const frase1 = r.neto >= 0
    ? `En ${mesTxt} ingresaste ${fmtE0(r.ingreso)} y gastaste ${fmtE0(r.gasto)}: te quedaron ${fmtE0(r.neto)}.`
    : `En ${mesTxt} gastaste ${fmtE0(r.gasto)} e ingresaste ${fmtE0(r.ingreso)}: gastaste ${fmtE0(-r.neto)} más de lo que entró.`;
  const frase2 = r.deltaGasto != null
    ? `Gastaste un ${fmtPct(Math.abs(r.deltaGasto))} ${r.deltaGasto >= 0 ? "más" : "menos"} que en ${mesPrevTxt}${r.topRise && r.topRise.rise > 0 ? `, sobre todo en ${r.topRise.cat}` : ""}.`
    : null;
  const arrow = "flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return (
    <div className="space-y-4 anim-rise">
      <div className="flex items-center justify-center gap-4">
        <button type="button" aria-label="Mes anterior" disabled={pos <= 0} onClick={() => setIdx(pos - 1)} className={arrow} style={{ borderColor: C.lineStrong, color: C.ink2 }}>‹</button>
        <span className="min-w-[9rem] text-center text-sm font-semibold">{mesTxt}</span>
        <button type="button" aria-label="Mes siguiente" disabled={pos >= months.length - 1} onClick={() => setIdx(pos + 1)} className={arrow} style={{ borderColor: C.lineStrong, color: C.ink2 }}>›</button>
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: C.accent }}>✦</div>
          <h2 className="text-sm font-semibold">Tu resumen de {mesTxt.split(" de ")[0]}</h2>
        </div>
        <p className="text-sm">{frase1}</p>
        {frase2 && <p className="mt-1.5 text-sm">{frase2}</p>}
        <p className="mt-1.5 text-xs text-slate-400">Los traspasos entre cuentas y el ahorro no cuentan aquí.</p>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos</div><div className="text-lg font-bold" style={{ ...tnum, color: C.income }}>{fmtE0(r.ingreso)}</div></Card>
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div><div className="text-lg font-bold" style={{ ...tnum, color: C.expense }}>{fmtE0(r.gasto)}</div></Card>
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div><div className="text-lg font-bold" style={{ ...tnum, color: r.neto >= 0 ? C.income : C.expense }}>{r.neto >= 0 ? "+" : ""}{fmtE0(r.neto)}</div></Card>
      </div>
      {r.topCats.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Dónde más se fue <span className="font-normal text-slate-400">· vs {mesPrevTxt}</span></h2>
          <div className="space-y-3">
            {r.topCats.map((c) => {
              const d = c.prev > 0 ? (c.v - c.prev) / c.prev : null;
              return (
                <button key={c.cat} type="button" onClick={() => onDrill({ type: "cat", key: c.cat, label: `${c.cat} · ${mesTxt}`, month: mKey })} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{c.cat}</span>
                    <span style={tnum}><b>{fmtE0(c.v)}</b>{d != null && <span className="ml-1.5 text-xs font-semibold" style={{ color: d >= 0 ? C.expense : C.income }}>{d >= 0 ? "▲" : "▼"}{fmtPct(Math.abs(d))}</span>}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.v / maxBar) * 100)}%`, background: C.expense }} /></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, (c.prev / maxBar) * 100)}%`, background: C.lineStrong }} /></div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="inline-block h-2 w-4 rounded-full" style={{ background: C.expense }} /> {mesTxt.split(" de ")[0]} · <span className="inline-block h-2 w-4 rounded-full" style={{ background: C.lineStrong }} /> {mesPrevTxt}</div>
        </Card>
      )}
    </div>
  );
}

/* Calendario de gasto del mes: una fila por semana (lunes→domingo), intensidad = gasto del día.
   Revela hábitos (findes, día de cobro) que un donut no ve. Excluye internos (traspasos/ahorro). */
function GastoCalendar({ movs, meses, mesFiltro, onPickMes, onDrill }) {
  // El mes que se pinta sale del FILTRO, y las flechas mueven el filtro, para que calendario y
  // resto de la pestaña no puedan contradecirse.
  const [modo, setModo] = useState("neto"); // neto | gasto | ingreso
  const mesesConDatos = useMemo(() => {
    const s = new Set();
    for (const mv of movs) if (mv.date instanceof Date && !isNaN(mv.date)) s.add(monthKey(mv.date));
    return [...s].sort();
  }, [movs]);
  const mk = mesFiltro || mesesConDatos[mesesConDatos.length - 1];

  const { byDay, maxG, maxI, maxPos, maxNeg } = useMemo(() => {
    const map = new Map();
    if (!mk) return { byDay: map, maxG: 1, maxI: 1, maxPos: 1, maxNeg: 1 };
    const [yy, mm] = mk.split("-").map(Number);
    for (const mv of movs) {
      const d = mv.date;
      if (!(d instanceof Date) || d.getFullYear() !== yy || d.getMonth() !== mm - 1) continue;
      if (INTERNAL_SET.has(mv.category || "Otros")) continue;
      // Extraordinarios y papelera fuera, igual que en el resto de agregados: un cargo puntual
      // grande saturaba la escala de color y dejaba los demás días en blanco.
      if (mv.extra || mv.omit) continue;
      const day = d.getDate();
      const e = map.get(day) || { g: 0, i: 0, ids: [] };
      if (mv.amount < 0) e.g += -mv.amount; else e.i += mv.amount;
      e.ids.push(mv.id);
      map.set(day, e);
    }
    const vals = [...map.values()];
    const mx = (arr) => (arr.length ? Math.max(...arr) : 1);
    return {
      byDay: map,
      maxG: mx(vals.map((v) => v.g).filter((x) => x > 0)),
      maxI: mx(vals.map((v) => v.i).filter((x) => x > 0)),
      // Escalas independientes para positivo y negativo: con una sola, un día de nómina fija el
      // máximo y todos los días de gasto normal quedan prácticamente incoloros.
      maxPos: mx(vals.map((v) => v.i - v.g).filter((x) => x > 0)),
      maxNeg: mx(vals.map((v) => v.g - v.i).filter((x) => x > 0)),
    };
  }, [movs, mk]);

  if (!mk) return null;
  const [y, m] = mk.split("-").map(Number);
  const lista = meses && meses.length ? meses : mesesConDatos;
  const idx = lista.indexOf(mk);
  const anterior = idx > 0 ? lista[idx - 1] : null;
  const siguiente = idx >= 0 && idx < lista.length - 1 ? lista[idx + 1] : null;
  const dim = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes = 0
  const cells = [];
  for (let k = 0; k < firstDow; k++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const escala = (v, max) => (v <= 0 ? 0 : v < max * 0.25 ? 25 : v < max * 0.5 ? 48 : v < max * 0.75 ? 72 : 100);
  const tint = (base, p) => (p === 0 ? C.line : `color-mix(in srgb, ${base} ${p}%, ${C.line})`);
  // Color de la celda según el modo. En "neto" manda el signo del día: uno con 2.700 € de
  // ingreso y 650 € de gasto cierra en verde, no en rojo intenso por el gasto.
  const pinta = (e) => {
    if (!e) return { p: 0, base: C.expense };
    if (modo === "gasto") return { p: escala(e.g, maxG), base: C.expense };
    if (modo === "ingreso") return { p: escala(e.i, maxI), base: C.income };
    const neto = e.i - e.g;
    if (neto > 0) return { p: escala(neto, maxPos), base: C.income };
    if (neto < 0) return { p: escala(-neto, maxNeg), base: C.expense };
    return { p: 0, base: C.expense };
  };

  const totalG = [...byDay.values()].reduce((s, e) => s + e.g, 0);
  const totalI = [...byDay.values()].reduce((s, e) => s + e.i, 0);
  const Flecha = ({ destino, atras }) => (
    <button type="button" onClick={() => destino && onPickMes && onPickMes(destino)} disabled={!destino || !onPickMes}
      aria-label={atras ? "Mes anterior" : "Mes siguiente"}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {atras ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
  const rampa = (base) => [25, 48, 72, 100].map((p) => <span key={p} className="inline-block h-3 w-3 rounded-sm" style={{ background: tint(base, p) }} />);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">Calendario · {monthLabelLong(mk)}</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Flecha destino={anterior} atras />
          <Flecha destino={siguiente} />
        </div>
      </div>
      <div className="mb-3 mt-1.5 flex flex-wrap items-center gap-2">
        <Seg ariaLabel="Qué colorea el calendario" value={modo} onChange={setModo}
          options={[{ v: "neto", l: "Neto" }, { v: "gasto", l: "Gasto" }, { v: "ingreso", l: "Ingreso" }]} />
        <span className="text-xs text-slate-500" style={tnum}>
          {fmtE0(totalG)} gasto · {fmtE0(totalI)} ingreso · neto {fmtE0(totalI - totalG)}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, k) => <div key={k} className="text-[10px] font-semibold text-slate-400">{d}</div>)}
        {cells.map((d, k) => {
          if (d == null) return <div key={"e" + k} />;
          const e = byDay.get(d);
          const { p, base } = pinta(e);
          const partes = [];
          if (e && e.g > 0) partes.push("gasto " + fmtE0(e.g));
          if (e && e.i > 0) partes.push("ingreso " + fmtE0(e.i));
          if (e && e.g > 0 && e.i > 0) partes.push("neto " + fmtE0(e.i - e.g));
          const title = `${d} de ${monthLabelLong(mk)}` + (partes.length ? " · " + partes.join(" · ") : " · sin movimientos");
          const estilo = { ...tnum, background: tint(base, p), color: p >= 72 ? "#fff" : C.ink2 };
          // El punto solo cuando el color de la celda NO cuenta ya que hubo ingreso: así un día
          // que cierra en negativo pero tuvo ingresos no esconde ese dato.
          const marca = e && e.i > 0 && base !== C.income
            ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: C.income }} />
            : null;
          if (!e) return <div key={d} title={title} className="relative flex aspect-square items-center justify-center rounded-md text-[10px] font-medium" style={estilo}>{d}</div>;
          return (
            <button key={d} type="button" title={title} aria-label={title}
              onClick={() => onDrill({ type: "ids", ids: e.ids, label: `${d} de ${monthLabelLong(mk)}` })}
              className="relative flex aspect-square items-center justify-center rounded-md text-[10px] font-medium transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={estilo}>{d}{marca}</button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {modo !== "ingreso" && <span className="inline-flex items-center gap-1.5">{modo === "neto" ? "Cierra en rojo" : "Menos gasto"} {rampa(C.expense)} más</span>}
        {modo !== "gasto" && <span className="inline-flex items-center gap-1.5">{modo === "neto" ? "Cierra en verde" : "Menos ingreso"} {rampa(C.income)} más</span>}
        {modo !== "ingreso" && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.income }} /> hubo ingreso</span>}
        <span>Pulsa un día para ver sus movimientos.</span>
      </div>
    </Card>
  );
}

/* Los extraordinarios se excluyen de TODOS los agregados (medias, proyecciones, cierre,
   calendario…), que es justo para lo que sirve la marca. Pero al no aparecer en ninguna parte
   se volvian invisibles: el dinero desaparecia del analisis sin dejar rastro. Esta tarjeta los
   contabiliza aparte, sin contaminar las medias, y deja abrirlos. */
function ExtraordinariosCard({ movs, onDrill }) {
  const extras = useMemo(() => movs.filter((m) => m.extra), [movs]);
  if (!extras.length) return null;
  const gasto = extras.reduce((sx, m) => (m.amount < 0 ? sx - m.amount : sx), 0);
  const ingreso = extras.reduce((sx, m) => (m.amount > 0 ? sx + m.amount : sx), 0);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Star size={14} style={{ color: C.accent }} /> Extraordinarios del periodo
          </h2>
          <p className="mt-0.5 text-xs text-slate-500" style={tnum}>
            {extras.length} {extras.length === 1 ? "movimiento" : "movimientos"}
            {gasto > 0 ? ` · ${fmtE0(gasto)} de gasto` : ""}
            {ingreso > 0 ? ` · ${fmtE0(ingreso)} de ingreso` : ""}
          </p>
        </div>
        <Btn size="sm" onClick={() => onDrill({ type: "ids", ids: extras.map((m) => m.id), label: "Movimientos extraordinarios" })}>Ver y editar</Btn>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Quedan fuera de medias, proyecciones, comparativas y del calendario, para que un cargo puntual
        no distorsione tu gasto habitual. Aquí los tienes contabilizados aparte: pulsa la estrella de
        un movimiento para devolverlo al análisis.
      </p>
    </Card>
  );
}

function ResumenTab({ agg, allAgg, granularity, setGranularity, onDrill, onPickMonth, outlierMovs, recurring, monthlySpark, saldoSerie, momDelta, alerts, cierre, onOpenPending, onDismissAlert }) {
  const { gasto, ingresos, interno = 0, byInternoCat, byCat, byAsset, buckets, topCats, rangeDays, mediaMensual, gastoProj, mesesData } = agg;
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  // Ingresos por categoría, para su propio donut (mismo componente, modo income).
  const byCatIncome = useMemo(() => {
    const m = new Map();
    for (const p of agg.parts || []) if (p.amount > 0 && !INTERNAL_SET.has(p.cat) && !isRefundPart(p)) m.set(p.cat, (m.get(p.cat) || 0) + p.amount);
    return m;
  }, [agg.parts]);
  const isDay = rangeDays <= 32;
  // Ahorro = lo que ingresas menos lo que consumes. El dinero movido a ahorro/inversión
  // NO es gasto: es parte de cómo colocas ese ahorro, así que no resta aquí.
  const ahorro = ingresos - gasto;
  return (
    <div className="space-y-4 anim-rise">
      <CierreMesCard cierre={cierre} onDrill={onDrill} />
      <AlertsCard alerts={alerts || []} onDrill={onDrill} onOpenPending={onOpenPending} onDismiss={onDismissAlert} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Gasto del periodo" value={fmtE0(gasto)} color={C.expense} icon={<ArrowDownRight size={15} />}
          spark={monthlySpark} sparkColor={C.expense}
          sub={momDelta ? `${momDelta.delta >= 0 ? "▲ +" : "▼ "}${fmtPct(Math.abs(momDelta.delta))} vs ${monthLabelLong(momDelta.prevKey)}` : `Proyección 12 m: ${fmtE0(gastoProj)} · ${fmtMonths(mesesData)} m de datos`} />
        <KPI label="Ingresos" value={fmtE0(ingresos)} color={C.income} icon={<ArrowUpRight size={15} />} sub={`Media de gasto: ${fmtE0(mediaMensual)}/mes`} />
        <KPI label="Ahorro del periodo" value={fmtE0(ahorro)} color={ahorro >= 0 ? C.income : C.expense} icon={<PiggyBank size={15} />}
          sub={`${ingresos > 0 ? `Tasa: ${fmtPct(ahorro / ingresos)}` : "Sin ingresos"}${interno > 0 ? ` · ${fmtE0(interno)} a ahorro/inversión` : ""}`} />
        <KPI label="Mayor categoría" value={topCat ? topCat[0] : "–"} icon={<TrendingUp size={15} />} sub={topCat ? `${fmtE0(topCat[1])} en el periodo` : "Sin gastos"} />
      </div>

      {/* 1) Ingresos por categoría (mismo donut, modo ingresos) */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ingresos por categoría</h2>
          <span className="text-xs text-slate-400">Pulsa para ver el detalle</span>
        </div>
        <DonutCategories byCat={byCatIncome} total={ingresos} onDrill={onDrill} parts={agg.parts} income
          extraTotal={agg.extraIngreso || 0} extraIds={agg.extraIngresoIds || []} />
      </Card>

      {/* 1b) A ahorro e inversión (traspasos internos: no son gasto) */}
      {interno > 0 && byInternoCat && (
        <Card className="p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> A ahorro e inversión</h2>
            <span className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(interno)}</span>
          </div>
          <p className="mb-2 text-xs text-slate-400">Dinero que has movido a ahorro/inversión u otras cuentas en el periodo. No es gasto: es cómo colocas lo que ahorras.</p>
          <div className="space-y-1">
            {[...byInternoCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
              <button key={cat} type="button" onClick={() => onDrill({ type: "cat", key: cat, label: cat })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catColor(cat) }} /> {cat}</span>
                <span className="font-medium" style={tnum}>{fmtE0(v)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 2) Gasto por categoría */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Gasto por categoría</h2>
          <span className="text-xs text-slate-400">Pulsa para ver y corregir</span>
        </div>
        <DonutCategories byCat={byCat} total={gasto} onDrill={onDrill} parts={agg.parts}
          extraTotal={agg.extraGasto || 0} extraIds={agg.extraGastoIds || []} />
      </Card>

      {/* 3) Evolución del gasto */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-semibold">Evolución del gasto</h2><p className="text-xs text-slate-400">{isDay ? "Por día" : "Apilado por categoría · pulsa un periodo para filtrarlo"}</p></div>
          {!isDay && <Seg ariaLabel="Granularidad" value={granularity} onChange={setGranularity} options={[{ v: "month", l: "Mensual" }, { v: "year", l: "Anual" }]} />}
        </div>
        <StackedTime buckets={buckets} topCats={topCats} isDay={isDay} onPick={onPickMonth} />
      </Card>

      {/* 4) Gasto por activo */}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Gasto por activo</h2>
        {byAsset.size === 0 ? <p className="py-6 text-center text-sm text-slate-500">Sin gastos asignados a activos. Créalos en la pestaña Activos.</p> : (
          <div className="space-y-1">
            {[...byAsset.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => {
              const a = allAgg.assets.find((x) => x.name === name);
              return (
                <button key={name} type="button" onClick={() => onDrill({ type: "asset", key: name, label: `${a?.emoji || ""} ${name}` })}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className="flex items-center gap-2">{a?.emoji} {name}</span>
                  <span className="font-medium" style={tnum}>{fmtE0(v)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 5) Evolución del saldo */}
      {saldoSerie && (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Evolución del saldo</h2>
            <span className="text-xs text-slate-400" style={tnum}>Ahora: {fmtE(saldoSerie[saldoSerie.length - 1].saldo)}</span>
          </div>
          <SaldoChart serie={saldoSerie} />
        </Card>
      )}

      {/* 6) Gastos atípicos */}
      <Card className="p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle size={14} style={{ color: C.warn }} /> Gastos atípicos</h2>
        <p className="mb-2 text-xs text-slate-400">Cargos muy por encima de tu media en su categoría, dentro del periodo elegido.</p>
        {outlierMovs.length === 0 ? <p className="py-2 text-sm text-slate-500">Nada fuera de lo habitual. 👌</p> : (
          <div className="space-y-1">
            {outlierMovs.slice(0, 6).map((m) => (
              <button key={m.id} type="button" onClick={() => onDrill({ type: "pattern", key: m.pattern, label: m.concept.slice(0, 42) })}
                className="flex w-full items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.concept}</span>
                  <span className="block truncate text-xs text-slate-400" style={tnum}>{fmtDateShort(m.date)}{m._out?.ratio >= 1.5 && <span style={{ color: C.warn }}> · ≈{nfNum.format(Math.round(m._out.ratio * 10) / 10)}× tu media en {m._out.cat}</span>}</span>
                </span>
                <span className="shrink-0 font-medium" style={{ ...tnum, color: C.expense }}>{fmtE0(m.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function HierarchyExplorer({ parts, assets, onDrill }) {
  const [kind, setKind] = useState("gastos");
  const [group, setGroup] = useState("tipo");
  const [open, setOpen] = useState(() => new Set());
  const { total, tree } = useMemo(() => buildHierarchy(parts, kind, group), [parts, kind, group]);
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const assetEmoji = (name) => assets.find((a) => a.name === name)?.emoji || "";
  const l1Sorted = [...tree.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxL1 = l1Sorted[0]?.[1].total || 1;
  // Nivel 1: el tono de la supra-categoría, para que la jerarquía se lea en el color
  // (macro arriba, su rampa de luminosidad debajo). Agrupando por activo no hay macro.
  const barColorOf = (l1) =>
    kind === "ingresos" ? C.income
    : group === "activo" ? C.navy2
    : macroColor(l1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Seg ariaLabel="Tipo de flujo" value={kind} onChange={(v) => { setKind(v); setOpen(new Set()); }}
          options={[{ v: "gastos", l: "Gastos" }, { v: "ingresos", l: "Ingresos" }]} />
        {kind === "gastos" && (
          <Seg ariaLabel="Agrupación" value={group} onChange={(v) => { setGroup(v); setOpen(new Set()); }}
            options={[{ v: "tipo", l: "Por categoría" }, { v: "activo", l: "Por activo" }]} />
        )}
      </div>
      {l1Sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Sin {kind} en este periodo.</p>
      ) : (
        <div className="space-y-0.5">
          {l1Sorted.map(([l1, n1]) => {
            const k1 = `1|${l1}`;
            const isOpen1 = open.has(k1);
            const l2Sorted = [...n1.children.entries()].sort((a, b) => b[1].total - a[1].total);
            return (
              <div key={l1}>
                <button type="button" onClick={() => toggle(k1)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen1 ? "rotate(90deg)" : "none" }} />
                  <span className="w-40 shrink-0 truncate text-sm font-medium sm:w-52">
                    {group === "activo" && kind === "gastos" ? `${assetEmoji(l1)} ${l1}`.trim() : kind === "gastos" ? `${MACRO_EMOJI[l1] || ""} ${l1}`.trim() : l1}
                  </span>
                  <span className="hidden flex-1 sm:block"><HBar pct={n1.total / maxL1} color={barColorOf(l1)} /></span>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold" style={tnum}>{fmtE0(n1.total)}</span>
                  <span className="w-11 shrink-0 text-right text-xs text-slate-400" style={tnum}>{total > 0 ? fmtPct(n1.total / total) : "–"}</span>
                </button>
                {isOpen1 && l2Sorted.map(([l2, n2]) => {
                  const k2 = `2|${l1}|${l2}`;
                  const isLeaf2 = kind === "ingresos";
                  const isOpen2 = open.has(k2);
                  const l3Sorted = [...n2.children.entries()].sort((a, b) => b[1].total - a[1].total);
                  return (
                    <div key={l2}>
                      <button type="button"
                        onClick={() => isLeaf2 ? onDrill({ type: "pattern", key: l2, label: n2.sample.slice(0, 42) }) : toggle(k2)}
                        className="flex w-full items-center gap-2 rounded-lg py-1.5 pl-8 pr-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {isLeaf2
                          ? <Search size={12} className="shrink-0 text-slate-300" />
                          : <ChevronRight size={13} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen2 ? "rotate(90deg)" : "none" }} />}
                        <span className="flex items-center gap-1.5 truncate text-sm text-slate-700" style={{ width: "11.5rem" }}>
                          {!isLeaf2 && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: catColor(l2) }} />}
                          <span className="truncate">{isLeaf2 ? n2.sample.slice(0, 40) : l2}</span>
                        </span>
                        <span className="hidden flex-1 sm:block"><HBar pct={n2.total / n1.total} color={isLeaf2 ? C.income : catColor(l2)} /></span>
                        <span className="w-20 shrink-0 text-right text-sm" style={tnum}>{fmtE0(n2.total)}</span>
                        <span className="w-11 shrink-0 text-right text-xs text-slate-400" style={tnum}>{fmtPct(n2.total / n1.total)}</span>
                      </button>
                      {isOpen2 && (
                        <>
                          {l3Sorted.slice(0, 12).map(([l3, n3]) => (
                            <button key={l3} type="button" onClick={() => onDrill({ type: "pattern", key: l3, label: n3.sample.slice(0, 42) })}
                              className="flex w-full items-center gap-2 rounded-lg py-1 pl-14 pr-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                              <Search size={11} className="shrink-0 text-slate-300" />
                              <span className="flex-1 truncate text-xs text-slate-600">{n3.sample.slice(0, 46)}</span>
                              <span className="shrink-0 text-xs text-slate-400" style={tnum}>×{n3.count}</span>
                              <span className="w-20 shrink-0 text-right text-xs font-medium" style={tnum}>{fmtE0(n3.total)}</span>
                            </button>
                          ))}
                          {l3Sorted.length > 12 && (
                            <button type="button" onClick={() => onDrill({ type: "cat", key: l2, label: l2 })}
                              className="w-full rounded-lg py-1 pl-14 pr-2 text-left text-xs text-blue-700 hover:bg-blue-50">
                              Ver los {l3Sorted.length - 12} comercios restantes en el detalle →
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export {
  AlertsCard,
  CierreMesCard,
  MonthRecap,
  GastoCalendar,
  ExtraordinariosCard,
  ResumenTab,
  HierarchyExplorer,
};
