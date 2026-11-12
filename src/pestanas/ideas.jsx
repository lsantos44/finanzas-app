import { KPI, MiniSpark } from "../ui/graficos.jsx";
import { C, CATEGORIES, CATEGORIES_GASTO, INGRESO_SET, STALE_GAP, TRANSFER_SET, catColor, fmtDate, fmtE, fmtE0, fmtPct, monthKey, monthLabelLong, nfNum, tnum } from "../core.js";
import { Btn, Card, DeltaBadge, Seg } from "../ui/comunes.jsx";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Filter, PiggyBank, RefreshCw, Sparkles, TrendingUp, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";

// Tesela de resumen (una cifra grande + contexto), para el vistazo de la pestaña Ideas.
function IdeaStat({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: C.line }}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ ...tnum, color: color || C.ink }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
// Fila compacta de una línea (nombre + meta a la izquierda, cifra a la derecha), clicable.
function IdeaRow({ onClick, title, meta, figure, figureColor, warn }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${onClick ? "hover:bg-slate-50" : "cursor-default"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}>
      {warn && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.warn }} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{title}</span>
        {meta && <span className="block truncate text-xs text-slate-400">{meta}</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold" style={{ ...tnum, color: figureColor || C.ink }}>{figure}</span>
      {onClick && <ChevronRight size={13} className="mt-0.5 shrink-0 text-slate-300" />}
    </button>
  );
}

function InteligenciaTab({ movs, agg, allAgg, recurring, receiptTrends, outlierMovs, reducible, onDrill }) {
  const lastData = useMemo(() => (movs.length ? movs.reduce((a, m) => (m.date > a ? m.date : a), movs[0].date) : new Date()), [movs]);
  const af = allAgg.annualFactor || 1;

  // 1) Recibos y suscripciones que suben (interanual o mes a mes) con impacto material
  const subiendo = receiptTrends.filter((t) => t.annualImpact > 15 && (t.deltaYoY ?? t.deltaMoM ?? 0) > 0.05).slice(0, 6);

  // 2) Recurrentes. Hipoteca, préstamos, alquiler y comunidad NO son suscripciones:
  // van a su propio bloque. El resto (streaming, cuotas, recibos) sí.
  const LOAN_RE = /HIPOTEC|PRESTAMO|^PREST|^PRES\b/;
  const isLoanHousing = (r) => r.category === "Vivienda" || r.category === "Hipoteca y préstamos" || LOAN_RE.test(r.pattern);
  const recAll = recurring.map((r) => ({ ...r, stale: (lastData - r.lastDate) / 86400000 > (STALE_GAP[r.cadence] || 400) }));
  const subs = recAll.filter((r) => !isLoanHousing(r));
  const prestamos = recAll.filter((r) => isLoanHousing(r)).sort((a, b) => b.annual - a.annual);
  const subsAnnual = subs.reduce((s, r) => s + r.annual, 0);
  const prestamosAnnual = prestamos.reduce((s, r) => s + r.annual, 0);
  const posiblesBajas = subs.filter((r) => r.stale).slice(0, 6);

  // 3) Gasto hormiga: cargos pequeños que, sumados, pesan
  const hormiga = movs.filter((m) => m.amount < 0 && !m.extra && -m.amount <= 12);
  const hormigaTot = hormiga.reduce((s, m) => s - m.amount, 0);

  // 4) Gasto atípico reciente (fuera de tu media en su categoría)
  const atipicos = [...outlierMovs].sort((a, b) => b.date - a.date).slice(0, 5);

  // 5) Idea de ahorro: recorte sobre lo que tú marcas como reducible
  let reducibleTot = 0;
  for (const [cat, v] of agg.byCat) if (reducible.has(cat)) reducibleTot += v;
  const ahorroIdea = reducibleTot * 0.2 * af;

  // 6) Ahorro e inversión: lo aportado en el periodo (traspasos entre cuentas, fondos…)
  const inversion = [...(agg.byInternoCat || new Map()).entries()].sort((a, b) => b[1] - a[1]);
  const inversionTot = agg.interno || 0;
  const subiendoImpact = subiendo.reduce((s, t) => s + t.annualImpact, 0);
  const subsSorted = [...subs].sort((a, b) => Number(b.stale) - Number(a.stale) || b.annual - a.annual);

  const nada = !subiendo.length && !subs.length && !prestamos.length && !atipicos.length && reducibleTot <= 0 && inversionTot <= 0;

  const Sec = ({ icon, title, total, totalColor, children, extra }) => (
    <Card className="p-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</h2>
        {total != null && <span className="text-sm font-semibold" style={{ ...tnum, color: totalColor || C.ink }}>{total}</span>}
      </div>
      <div className="-mx-2">{children}</div>
      {extra}
    </Card>
  );

  return (
    <div className="space-y-4 anim-rise">
      <p className="text-sm text-slate-500">Detección automática sobre tus datos, en tu navegador. Sin coste. Para preguntas en lenguaje natural, usa el <span className="font-medium">Asistente</span>.</p>

      {nada ? (
        <Card className="p-10 text-center"><Sparkles size={26} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Aún no hay suficientes datos para sacar conclusiones. Importa más meses y vuelve.</p></Card>
      ) : (
        <>
          {/* Vistazo: cuatro cifras que resumen la pestaña */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <IdeaStat label="Suscripciones" value={`${fmtE0(subsAnnual)}/año`} color={C.expense}
              sub={posiblesBajas.length ? `${posiblesBajas.length} posible${posiblesBajas.length > 1 ? "s" : ""} baja${posiblesBajas.length > 1 ? "s" : ""}` : `${subs.length} activas`} />
            <IdeaStat label="Recibos subiendo" value={subiendo.length ? `+${fmtE0(subiendoImpact)}/año` : "—"} color={subiendo.length ? C.warn : C.faint}
              sub={subiendo.length ? `${subiendo.length} recibo${subiendo.length > 1 ? "s" : ""}` : "ninguno"} />
            <IdeaStat label="Gasto hormiga" value={fmtE0(hormigaTot)} sub={`${nfNum.format(hormiga.length)} cargos ≤ 12 €`} />
            <IdeaStat label="Ahorro potencial" value={`${fmtE0(ahorroIdea)}/año`} color={C.income} sub="recortando 20 % reducible" />
          </div>

          {/* Detalle en dos columnas, filas de una línea */}
          <div className="grid gap-4 lg:grid-cols-2">
            {subiendo.length > 0 && (
              <Sec icon={<TrendingUp size={15} style={{ color: C.warn }} />} title="Recibos subiendo" total={`+${fmtE0(subiendoImpact)}/año`} totalColor={C.warn}>
                {subiendo.map((t) => (
                  <IdeaRow key={t.pattern} warn title={t.label.slice(0, 34)} meta={`${fmtPct(t.deltaYoY ?? t.deltaMoM ?? 0)} · ${fmtE0(t.last)}/mes`}
                    figure={`+${fmtE0(t.annualImpact)}`} figureColor={C.warn} onClick={() => onDrill({ type: "pattern", key: t.pattern, label: t.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {subs.length > 0 && (
              <Sec icon={<RefreshCw size={15} style={{ color: C.accent }} />} title="Suscripciones" total={`${fmtE0(subsAnnual)}/año`} totalColor={C.expense}
                extra={subsSorted.length > 5 && <div className="px-2 pt-1 text-[11px] text-slate-400">y {subsSorted.length - 5} más</div>}>
                {subsSorted.slice(0, 5).map((r) => (
                  <IdeaRow key={r.pattern} warn={r.stale} title={r.label.slice(0, 34)} meta={r.stale ? `posible baja · sin cargos desde ${fmtDate(r.lastDate)}` : `${r.cadence} · ${fmtE0(r.avgAmount)}`}
                    figure={`${fmtE0(r.annual)}/año`} figureColor={r.stale ? C.warn : C.ink} onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {prestamos.length > 0 && (
              <Sec icon={<Wallet size={15} style={{ color: C.expense }} />} title="Préstamos y vivienda" total={`${fmtE0(prestamosAnnual)}/año`} totalColor={C.expense}>
                {prestamos.slice(0, 5).map((r) => (
                  <IdeaRow key={r.pattern} title={r.label.slice(0, 34)} meta={`${r.cadence} · ${fmtE0(r.avgAmount)}`}
                    figure={`${fmtE0(r.annual)}/año`} onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {atipicos.length > 0 && (
              <Sec icon={<AlertTriangle size={15} style={{ color: C.warn }} />} title="Gastos fuera de lo normal">
                {atipicos.map((m) => (
                  <IdeaRow key={m.id} warn title={m.concept.slice(0, 34)} meta={`${fmtDate(m.date)} · ${m.category || "Otros"}`}
                    figure={fmtE0(-m.amount)} figureColor={C.expense} onClick={() => onDrill({ type: "ids", ids: [m.id], label: m.concept.slice(0, 42) })} />
                ))}
              </Sec>
            )}
          </div>

          {(reducibleTot > 0 || inversionTot > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {reducibleTot > 0 && (
                <Card className="p-4">
                  <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> Idea de ahorro</h2>
                  <p className="text-xs text-slate-500">Has gastado <span className="font-semibold">{fmtE0(reducibleTot)}</span> en categorías reducibles. Recortando un 20 % ahorrarías <span className="font-semibold" style={{ color: C.income }}>{fmtE0(ahorroIdea)}/año</span>. Ajusta qué es reducible en <span className="font-medium">Plan</span>.</p>
                </Card>
              )}
              {inversionTot > 0 && (
                <Card className="p-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> Ahorro e inversión</h2>
                    <span className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(inversionTot)}</span>
                  </div>
                  <div className="space-y-1">
                    {inversion.map(([cat, v]) => (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-slate-600">{cat}</span>
                        <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / inversionTot) * 100)} %</span>
                        <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   PESTAÑA AHORRO
   ============================================================ */
function AhorroTab({ agg, reducible, setReducible, recurring, onDrill }) {
  const [cut, setCut] = useState(20);
  const [showConfig, setShowConfig] = useState(false);
  const { ingresos, gasto, byCat } = agg;
  const ahorro = ingresos - gasto;
  const tasa = ingresos > 0 ? ahorro / ingresos : 0;
  let reducibleTotal = 0, esencialTotal = 0;
  for (const [cat, v] of byCat) (reducible.has(cat) ? (reducibleTotal += v) : (esencialTotal += v));
  const potencial = ahorro + (reducibleTotal * cut) / 100;
  const tasaPot = ingresos > 0 ? potencial / ingresos : 0;
  const pct = (v) => (ingresos > 0 ? Math.max(0, Math.min(100, (v / ingresos) * 100)) : 0);
  const recList = recurring.map((r) => ({ ...r, revisable: reducible.has(r.category) }));

  return (
    <div className="space-y-4 anim-rise">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Ingresos" value={fmtE0(ingresos)} color={C.income} icon={<ArrowUpRight size={15} />} />
        <KPI label="Gastos" value={fmtE0(gasto)} color={C.expense} icon={<ArrowDownRight size={15} />} />
        <KPI label="Ahorro real" value={fmtE0(ahorro)} color={ahorro >= 0 ? C.income : C.expense} icon={<PiggyBank size={15} />}
          sub={ingresos > 0 ? `Tasa de ahorro: ${fmtPct(tasa)}` : "Sin ingresos en el periodo"} />
        <KPI label="Gasto reducible" value={fmtE0(reducibleTotal)} icon={<Filter size={15} />} sub={`${[...reducible].length} categorías marcadas`} />
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">A dónde va cada euro</h2>
        <p className="mb-3 text-xs text-slate-400">Reparto de los ingresos del periodo.</p>
        {ingresos <= 0 ? (
          <p className="py-3 text-sm text-slate-500">No hay ingresos en el periodo seleccionado, así que no se puede repartir el euro. Amplía el periodo.</p>
        ) : (
          <>
            <div className="flex h-7 w-full overflow-hidden rounded-lg" role="img"
              aria-label={`Esencial ${Math.round(pct(esencialTotal))} %, reducible ${Math.round(pct(reducibleTotal))} %, ahorro ${Math.round(pct(Math.max(0, ahorro)))} %`}>
              <div style={{ width: `${pct(esencialTotal)}%`, background: C.ink2 }} title="Esencial" />
              <div style={{ width: `${pct(reducibleTotal)}%`, background: C.warn }} title="Reducible" />
              <div style={{ width: `${pct(Math.max(0, ahorro))}%`, background: C.income }} title="Ahorro" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={tnum}>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.ink2 }} />Esencial {fmtE0(esencialTotal)} ({fmtPct(esencialTotal / ingresos)})</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.warn }} />Reducible {fmtE0(reducibleTotal)} ({fmtPct(reducibleTotal / ingresos)})</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.income }} />Ahorro {fmtE0(Math.max(0, ahorro))} ({fmtPct(Math.max(0, tasa))})</span>
            </div>
            {ahorro < 0 && <p className="mt-2 text-xs" style={{ color: C.expense }}>En este periodo gastas más de lo que ingresas ({fmtE(ahorro)}).</p>}
          </>
        )}
        <div className="mt-3 border-t pt-3" style={{ borderColor: C.line }}>
          <button type="button" onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1 rounded text-xs font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {showConfig ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Elegir qué categorías son reducibles
          </button>
          {showConfig && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
              {CATEGORIES_GASTO.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="accent-blue-600" checked={reducible.has(c)}
                    onChange={(e) => { const s = new Set(reducible); e.target.checked ? s.add(c) : s.delete(c); setReducible(s); }} />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Ahorro potencial</h2>
        <p className="mb-3 text-xs text-slate-400">¿Y si recortas parte del gasto reducible de este periodo?</p>
        <div className="flex flex-wrap items-center gap-4">
          <input type="range" min={0} max={100} step={5} value={cut} onChange={(e) => setCut(+e.target.value)}
            aria-label="Porcentaje de recorte del gasto reducible" className="w-full max-w-xs accent-blue-600" />
          <span className="text-sm font-medium" style={tnum}>Recorte del {cut} %</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <div className="text-xs text-slate-500">Ahorrarías</div>
            <div className="text-xl font-semibold" style={{ ...tnum, color: C.income }}>{fmtE(potencial)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Nueva tasa de ahorro</div>
            <div className="text-xl font-semibold" style={tnum}>{ingresos > 0 ? fmtPct(tasaPot) : "–"}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400" style={tnum}>+{fmtE((reducibleTotal * cut) / 100)} respecto al ahorro actual.</p>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Partidas que comprometen el ahorro</h2>
        <p className="mb-2 text-xs text-slate-400">Gastos recurrentes detectados en todo tu histórico, anualizados y de mayor a menor. Los «revisables» pertenecen a categorías reducibles.</p>
        {recList.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No se han detectado cargos recurrentes todavía. Hacen falta al menos 2–3 repeticiones del mismo emisor.</p>
        ) : (
          <div>
            {recList.map((r) => (
              <button key={r.pattern} type="button" onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label })}
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-1 py-2 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ borderColor: C.line }}>
                <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                {r.revisable && <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: C.warnSoft, color: C.warn }}>revisable</span>}
                <span className="text-xs text-slate-400">{r.category} · {r.cadence} · {fmtE(r.avgAmount)}</span>
                <span className="w-24 text-right text-sm font-semibold" style={tnum}>{fmtE0(r.annual)}/año</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   PESTAÑA PRESUPUESTO
   ============================================================ */
function PresupuestoTab({ budgets, setBudgets, movs, monthsAvail, allAgg, onDrill }) {
  const lastMonth = monthsAvail[monthsAvail.length - 1] || null;
  const gastoMes = useMemo(() => {
    const map = new Map();
    if (!lastMonth) return map;
    for (const m of movs) {
      if (monthKey(m.date) !== lastMonth) continue;
      const parts = m.splits?.length
        ? m.splits.map((s) => ({ cat: s.cat, amount: (m.amount * s.pct) / 100 }))
        : [{ cat: m.category || "Otros", amount: m.amount }];
      for (const p of parts) { if (p.amount >= 0) continue; map.set(p.cat, (map.get(p.cat) || 0) - p.amount); }
    }
    return map;
  }, [movs, lastMonth]);
  const media = (cat) => (allAgg ? (allAgg.byCat.get(cat) || 0) / allAgg.mesesData : 0);
  const suggest = (cat) => Math.max(5, Math.ceil(media(cat) / 5) * 5);
  const entries = Object.entries(budgets).filter(([, v]) => v > 0);
  const budgetedCats = new Set(entries.map(([c]) => c));
  const totalBudget = entries.reduce((s, [, v]) => s + v, 0);
  const totalSpent = entries.reduce((s, [c]) => s + (gastoMes.get(c) || 0), 0);
  const overCount = entries.filter(([c, v]) => (gastoMes.get(c) || 0) > v).length;
  const globalPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const globalColor = globalPct > 1 ? C.expense : globalPct > 0.75 ? C.warn : C.teal;
  const candidates = CATEGORIES.filter((c) => !INGRESO_SET.has(c) && !budgetedCats.has(c))
    .sort((a, b) => media(b) - media(a));
  const suggestAll = () => {
    const b = { ...budgets };
    for (const c of CATEGORIES) {
      if (INGRESO_SET.has(c) || TRANSFER_SET.has(c) || c === "Otros") continue;
      const m = media(c);
      if (m >= 10) b[c] = suggest(c);
    }
    setBudgets(b);
  };
  const setB = (cat, v) => setBudgets((b) => { const n = { ...b }; if (v > 0) n[cat] = v; else delete n[cat]; return n; });

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Fija un límite mensual por categoría y controla cómo vas. El progreso se calcula sobre <strong>{lastMonth ? monthLabelLong(lastMonth) : "el último mes"}</strong> (tu último mes con datos).</p>
        <Btn kind="primary" onClick={suggestAll}><Sparkles size={14} /> Sugerir según mi histórico</Btn>
      </div>

      {entries.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 pb-4 pt-5" style={{ background: `linear-gradient(140deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
            <div className="flex flex-wrap items-end justify-between gap-3 text-white">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">Presupuesto de {lastMonth ? monthLabelLong(lastMonth) : "–"}</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight" style={tnum}>{fmtE0(totalSpent)}<span className="text-lg font-medium text-white/60"> / {fmtE0(totalBudget)}</span></div>
              </div>
              <div className="text-right text-sm" style={tnum}>
                {totalSpent <= totalBudget
                  ? <span className="font-medium" style={{ color: "#7BE0C8" }}>Te quedan {fmtE0(totalBudget - totalSpent)}</span>
                  : <span className="font-medium" style={{ color: "#FFB3B8" }}>Superado en {fmtE0(totalSpent - totalBudget)}</span>}
                <div className="mt-0.5 text-xs text-white/60">{overCount > 0 ? `${overCount} ${overCount === 1 ? "categoría superada" : "categorías superadas"}` : "Todo bajo control"}</div>
              </div>
            </div>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div style={{ width: `${Math.min(100, globalPct * 100)}%`, background: globalColor, transition: "width .4s" }} />
            </div>
          </div>
          <div>
            {entries.sort((a, b) => (gastoMes.get(b[0]) || 0) / b[1] - (gastoMes.get(a[0]) || 0) / a[1]).map(([cat, budget]) => {
              const spent = gastoMes.get(cat) || 0;
              const pct = spent / budget;
              const color = pct > 1 ? C.expense : pct > 0.75 ? C.warn : C.teal;
              return (
                <div key={cat} className="border-b px-4 py-3 last:border-0" style={{ borderColor: C.line }}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catColor(cat) }} />
                    <button type="button" onClick={() => onDrill({ type: "cat", key: cat, label: cat })} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{cat}</button>
                    <span className="text-sm" style={tnum}><span className="font-semibold" style={{ color }}>{fmtE0(spent)}</span><span className="text-slate-400"> / </span></span>
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <input type="number" min={0} step={5} value={budget} aria-label={`Presupuesto de ${cat}`}
                        onChange={(e) => setB(cat, Math.max(0, +e.target.value || 0))}
                        className="w-20 rounded-lg border px-2 py-1 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        style={{ ...tnum, borderColor: C.line }} /> €
                    </span>
                    <button type="button" onClick={() => setB(cat, 0)} aria-label={`Quitar presupuesto de ${cat}`} className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"><X size={13} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div style={{ width: `${Math.min(100, pct * 100)}%`, background: color, transition: "width .4s" }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs" style={{ ...tnum, color: pct > 1 ? C.expense : C.muted }}>
                      {pct > 1 ? `+${fmtE0(spent - budget)} extra` : `${fmtPct(pct)} usado`}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400" style={tnum}>Tu media histórica: {fmtE0(media(cat))}/mes</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold">{entries.length ? "Añadir otra categoría" : "Empieza a presupuestar"}</h3>
        <p className="mt-0.5 text-xs text-slate-500">Elige una categoría: se propone tu media mensual redondeada, y luego la ajustas.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {candidates.slice(0, 12).map((c) => (
            <button key={c} type="button" onClick={() => setB(c, suggest(c))}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <span className="h-2 w-2 rounded-sm" style={{ background: catColor(c) }} />{c}
              {media(c) >= 1 && <span className="text-slate-400" style={tnum}>~{fmtE0(media(c))}</span>}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UpcomingCard({ upcoming, onDrill }) {
  if (!upcoming || !upcoming.items.length) return null;
  const fmtDay = (d) => new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3" style={{ borderColor: C.line }}>
        <div>
          <h2 className="text-sm font-semibold">Próximos cargos estimados</h2>
          <p className="text-xs text-slate-400">En los {upcoming.horizonDays} días siguientes a tus últimos datos ({fmtDate(upcoming.base)})</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(upcoming.total)}</div>
          <div className="text-[11px] text-slate-400">{upcoming.items.length} cargos previstos</div>
        </div>
      </div>
      {upcoming.items.map((it, i) => (
        <button key={it.pattern + i} type="button" onClick={() => onDrill({ type: "pattern", key: it.pattern, label: it.label.slice(0, 42) })}
          className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
          <span className="w-[74px] shrink-0 text-xs font-medium text-slate-500" style={tnum}>{fmtDay(it.date)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{it.label}</span>
            <span className="text-[11px] text-slate-400">{it.category} · {it.cadence}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold" style={tnum}>{it.variable ? "~" : ""}{fmtE0(it.amount)}</span>
        </button>
      ))}
      <p className="px-4 py-2 text-[11px] text-slate-400">Estimación según la fecha habitual y el último importe de cada recibo (media reciente en los variables, marcados con ~). No es información del banco.</p>
    </Card>
  );
}

function ReceiptTrendsCard({ trends, onDrill }) {
  const [shown, setShown] = useState(8);
  if (!trends.length) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Evolución de tus recibos</h2>
        <p className="mt-1 text-sm text-slate-500">Aún no hay recibos con historial suficiente (hacen falta al menos 3 meses del mismo recibo).</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-3" style={{ borderColor: C.line }}>
        <h2 className="text-sm font-semibold">Evolución de tus recibos</h2>
        <p className="text-xs text-slate-400">Último cargo comparado con el mes anterior (Δ mes) y con el mismo mes del año pasado (Δ año). El impacto anual estima cuánto suma o resta la variación en 12 meses.</p>
      </div>
      <div className="hidden gap-2 border-b px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:flex" style={{ borderColor: C.line }}>
        <span className="flex-1">Recibo</span><span className="w-[88px]">Tendencia</span><span className="w-16 text-right">Último</span><span className="w-16 text-center">Δ mes</span><span className="w-16 text-center">Δ año</span><span className="w-20 text-right">Impacto/año</span>
      </div>
      {trends.slice(0, shown).map((t) => (
        <button key={t.pattern} type="button" onClick={() => onDrill({ type: "pattern", key: t.pattern, label: t.label.slice(0, 42) })}
          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-sm">{t.label}</span>
              {t.kind === "variable" && <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">variable</span>}
            </span>
            <span className="text-[11px] text-slate-400">{t.category} · {t.months} meses</span>
          </span>
          <span className="w-[88px] shrink-0"><MiniSpark data={t.serie} color={t.annualImpact >= 0 ? C.expense : C.income} /></span>
          <span className="w-16 shrink-0 text-right text-sm font-semibold" style={tnum}>{fmtE0(t.last)}</span>
          <span className="w-16 shrink-0 text-center"><DeltaBadge d={t.deltaMoM} /></span>
          <span className="w-16 shrink-0 text-center"><DeltaBadge d={t.deltaYoY} /></span>
          <span className="w-20 shrink-0 text-right text-sm font-medium" style={{ ...tnum, color: t.annualImpact > 1 ? C.expense : t.annualImpact < -1 ? C.income : C.muted }}>
            {t.annualImpact > 0 ? "+" : ""}{fmtE0(t.annualImpact)}
          </span>
        </button>
      ))}
      {trends.length > shown && <div className="p-3 text-center"><Btn onClick={() => setShown(shown + 12)}>Mostrar más ({trends.length - shown})</Btn></div>}
    </Card>
  );
}

/* ============================================================
   PESTAÑA PLAN (Presupuesto · Recibos · Ahorro)
   ============================================================ */
function PlanTab({ budgets, setBudgets, movs, monthsAvail, allAgg, agg, reducible, setReducible, recurring, receiptTrends, upcoming, onDrill }) {
  const [view, setView] = useState("presupuesto");
  const risingCount = receiptTrends.filter((t) => (t.deltaYoY ?? t.deltaMoM ?? 0) >= 0.03).length;
  return (
    <div className="anim-rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Seg ariaLabel="Sección del plan" value={view} onChange={setView}
          options={[{ v: "presupuesto", l: "Presupuesto" }, { v: "recibos", l: "Recibos" }, { v: "ahorro", l: "Ahorro" }]} />
        {view !== "recibos" && risingCount > 0 && (
          <button type="button" onClick={() => setView("recibos")} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ color: C.expense, background: C.expenseSoft }}>
            <TrendingUp size={11} /> {risingCount} {risingCount === 1 ? "recibo ha subido" : "recibos han subido"}
          </button>
        )}
      </div>
      {view === "presupuesto" && <PresupuestoTab budgets={budgets} setBudgets={setBudgets} movs={movs} monthsAvail={monthsAvail} allAgg={allAgg} onDrill={onDrill} />}
      {view === "recibos" && (
        <div className="space-y-4">
          <UpcomingCard upcoming={upcoming} onDrill={onDrill} />
          <ReceiptTrendsCard trends={receiptTrends} onDrill={onDrill} />
        </div>
      )}
      {view === "ahorro" && <AhorroTab agg={agg} reducible={reducible} setReducible={setReducible} recurring={recurring} onDrill={onDrill} />}
    </div>
  );
}

export {
  IdeaStat,
  IdeaRow,
  InteligenciaTab,
  AhorroTab,
  PresupuestoTab,
  UpcomingCard,
  ReceiptTrendsCard,
  PlanTab,
};
