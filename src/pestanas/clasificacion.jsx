import { C, IMPORT_CURRENCIES, expandParts, fmtDate, fmtE, isProcessorPattern, isRefund, movInGroup, nfNum, stripAccents, tnum } from "../core.js";
import { AssetSelect, Btn, Card, CatSelect, Money, Pill, Seg } from "../ui/comunes.jsx";
import { GroupTags } from "../ui/movimientos.jsx";
import { Check, ChevronRight, ClipboardList, Pencil, Plus, Search, Star, Tag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

/* ============================================================
   PESTAÑA CLASIFICACIÓN — ver y completar cómo quedó todo
   ============================================================ */
function ClasificacionTab({ movs, assets, groups, onRecat, onReasset, onReassetAll, onToggleGroup, onCreateGroup, onCreateAsset, onNote, onNoteAll, onToggleExtra, onDelete, onSetAmount, outliers, onOpenPending, onNewMov, onEditMov }) {
  const [filter, setFilter] = useState("todos"); // todos | pend | ok
  const [q, setQ] = useState("");
  const [signSel, setSignSel] = useState("todos"); // todos | in | out
  const [extraSel, setExtraSel] = useState("todos"); // todos | si | no
  const [amtMin, setAmtMin] = useState("");
  const [amtMax, setAmtMax] = useState("");
  const [shown, setShown] = useState(80);
  const [open, setOpen] = useState(null);      // patrón expandido
  const [noting, setNoting] = useState(null);  // id de movimiento cuyo apodo editas
  const [noteText, setNoteText] = useState("");
  const [gNoting, setGNoting] = useState(null); // patrón cuyo apodo (a todos) editas
  const [gNoteText, setGNoteText] = useState("");
  const [amtEdit, setAmtEdit] = useState(null); // id del movimiento cuyo importe editas
  const [amtText, setAmtText] = useState("");
  const [amtCur, setAmtCur] = useState("EUR");
  const [amtRate, setAmtRate] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => { const sign = m.amount < 0 ? -1 : 1; const v = parseFloat((amtText || "").replace(",", ".")) * sign; if (!isFinite(v) || v === 0) return; onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null); setAmtEdit(null); };

  // Un comercio (patrón) por fila: es la unidad en la que de verdad se clasifica.
  const rows = useMemo(() => {
    const map = new Map();
    for (const m of movs) {
      let g = map.get(m.pattern);
      if (!g) { g = { pattern: m.pattern, sample: m.concept, count: 0, total: 0, cats: new Set(), assets: new Set(), pend: 0, notes: 0, noteVals: new Set(), rep: m, hasIn: false, hasOut: false, hasExtra: false, absList: [] }; map.set(m.pattern, g); }
      g.count++; g.total += m.amount;
      if (m.amount > 0) g.hasIn = true; else if (m.amount < 0) g.hasOut = true;
      if (m.extra) g.hasExtra = true;
      g.absList.push(Math.abs(m.amount));
      g.cats.add(m.splits ? "· dividido" : (m.category || "Otros"));
      g.assets.add(m.assetName === undefined ? "·auto" : (m.assetName || ""));
      if (m.confirmed === false) g.pend++;
      if (m.note) { g.notes++; g.noteVals.add(m.note); }
    }
    const arr = [...map.values()];
    for (const g of arr) { g.tags = groups.filter((gr) => movInGroup(g.rep, gr)).length; g.proc = isProcessorPattern(g.pattern); }
    return arr.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [movs, groups]);

  const totalPend = rows.reduce((s, g) => s + g.pend, 0);
  const filtered = useMemo(() => {
    const t = stripAccents(q.trim().toUpperCase());
    const min = parseFloat((amtMin || "").replace(",", ".")); const hasMin = isFinite(min);
    const max = parseFloat((amtMax || "").replace(",", ".")); const hasMax = isFinite(max);
    return rows.filter((g) => {
      if (filter === "pend" && g.pend === 0) return false;
      if (filter === "ok" && g.pend > 0) return false;
      if (t && !stripAccents((g.sample + " " + g.pattern).toUpperCase()).includes(t)) return false;
      if (signSel === "in" && !g.hasIn) return false;
      if (signSel === "out" && !g.hasOut) return false;
      // Los extraordinarios quedan fuera de todos los agregados, asi que sin un filtro
      // propio no habia forma de reencontrarlos para revisarlos o desmarcarlos.
      if (extraSel === "si" && !g.hasExtra) return false;
      if (extraSel === "no" && g.hasExtra) return false;
      // Importe: se queda el comercio que tenga ALGÚN movimiento en el rango (valor absoluto).
      if ((hasMin || hasMax) && !g.absList.some((a) => (!hasMin || a >= min) && (!hasMax || a <= max))) return false;
      return true;
    });
  }, [rows, filter, q, signSel, extraSel, amtMin, amtMax]);

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Cómo ha quedado clasificado cada comercio. Corrige la <strong>categoría</strong>, el <strong>activo</strong> o la <strong>etiqueta</strong> y se aplica a todos sus movimientos. <strong>Despliega un comercio</strong> para editarlos uno a uno: ahí puedes pulsar el importe para corregirlo o convertirlo desde otra divisa. Lo <span className="font-medium" style={{ color: C.warn }}>por revisar</span> es lo que aún no has confirmado.</p>
        <div className="flex flex-wrap items-center gap-2">
          {onNewMov && <Btn onClick={onNewMov}><Plus size={15} /> Nuevo movimiento</Btn>}
          {totalPend > 0 && <Btn kind="primary" onClick={onOpenPending}><ClipboardList size={15} /> Revisar {nfNum.format(totalPend)} pendientes</Btn>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: C.line }}>
          <Seg ariaLabel="Filtro de estado" value={filter} onChange={setFilter}
            options={[{ v: "todos", l: "Todos" }, { v: "pend", l: "Por revisar" }, { v: "ok", l: "Confirmados" }]} />
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border px-3 py-1.5" style={{ borderColor: C.lineStrong }}>
            <Search size={14} className="shrink-0 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar comercio o concepto" placeholder="Buscar comercio o concepto…" className="w-full bg-transparent text-sm focus:outline-none" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
          </div>
          <Seg ariaLabel="Ingresos o gastos" value={signSel} onChange={setSignSel}
            options={[{ v: "todos", l: "Todos" }, { v: "in", l: "Ingresos" }, { v: "out", l: "Gastos" }]} />
          <Seg ariaLabel="Extraordinarios" value={extraSel} onChange={setExtraSel}
            options={[{ v: "todos", l: "Todos" }, { v: "si", l: "⭐ Solo extra." }, { v: "no", l: "Sin extra." }]} />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Importe €</span>
            <input value={amtMin} onChange={(e) => setAmtMin(e.target.value)} inputMode="decimal" aria-label="Importe desde" placeholder="desde"
              className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-slate-300">–</span>
            <input value={amtMax} onChange={(e) => setAmtMax(e.target.value)} inputMode="decimal" aria-label="Importe hasta" placeholder="hasta"
              className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            {(amtMin || amtMax) && <button type="button" onClick={() => { setAmtMin(""); setAmtMax(""); }} aria-label="Limpiar importe" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: C.line }}>
          {filtered.slice(0, shown).map((g) => {
            const cat = g.cats.size === 1 ? [...g.cats][0] : "";
            const asset = g.assets.size === 1 ? [...g.assets][0] : "";
            const assetVal = asset === "·auto" ? "" : asset;
            const gNote = g.noteVals.size === 1 ? [...g.noteVals][0] : null; // apodo común
            const gMixed = g.noteVals.size > 1;                              // apodos distintos
            const isOpen = open === g.pattern;
            const mine = isOpen ? movs.filter((m) => m.pattern === g.pattern).sort((a, b) => b.date - a.date) : null;
            return (
              <div key={g.pattern} className="px-3 py-2.5" style={{ borderColor: C.line }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.pattern)} className="flex w-full items-baseline justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                      <span className="min-w-0 break-words text-sm font-medium" title={g.sample}>{g.sample}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[22px] text-xs text-slate-500" style={tnum}>
                      <span>{g.count} {g.count === 1 ? "mov." : "movs."} · {fmtE(g.total)}</span>
                      {g.pend > 0
                        ? <Pill color={C.warn} soft={C.warnSoft}>{g.pend === g.count ? "por revisar" : `${g.pend} por revisar`}</Pill>
                        : <span className="inline-flex items-center gap-0.5" style={{ color: C.income }}><Check size={11} /> confirmado</span>}
                      {g.tags > 0 && <span className="inline-flex items-center gap-0.5 text-slate-400"><Tag size={10} /> {g.tags}</span>}
                      {g.notes > 0 && <span className="inline-flex items-center gap-0.5 text-slate-400">🏷️ {g.notes}</span>}
                      {g.proc && <span className="text-slate-400">· pasarela (cargo a cargo)</span>}
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CatSelect value={cat === "· dividido" ? "" : cat} allowEmpty onChange={(v) => onRecat(g.rep, v, !g.proc)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-44" />
                  <AssetSelect value={assetVal} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReassetAll(g.rep, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-36" />
                  <GroupTags mov={g.rep} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                  {onNoteAll && (gNote
                    ? <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(gNote); }} className="inline-flex max-w-[140px] items-center rounded-lg px-2 py-1 text-xs font-medium" style={{ background: C.accentSoft, color: C.accent }} title="Editar apodo de todos"><span className="truncate">🏷️ {gNote}</span></button>
                    : gMixed
                      ? <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(""); }} className="rounded-lg border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }} title="Hay varios apodos; unifícalos">🏷️ varios</button>
                      : <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(""); }} className="rounded-lg border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }}>+ apodo a todos</button>)}
                </div>
                {onNoteAll && gNoting === g.key && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={gNoteText} onChange={(e) => setGNoteText(e.target.value)} autoFocus maxLength={40}
                      placeholder={`Apodo para los ${g.count} movimientos de este comercio`}
                      onKeyDown={(e) => { if (e.key === "Enter") { onNoteAll(g.rep, gNoteText); setGNoting(null); } if (e.key === "Escape") setGNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNoteAll(g.rep, gNoteText); setGNoting(null); }}>Aplicar a todos</Btn>
                    {(gNote || gMixed) && <button type="button" onClick={() => { onNoteAll(g.rep, ""); setGNoting(null); }} aria-label="Quitar apodo de todos" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
                {!isOpen && g.cats.size > 1 && <div className="mt-1 text-[11px] text-slate-400">Varias categorías en este comercio ({[...g.cats].filter((c) => c !== "· dividido").slice(0, 3).join(", ")}…). Ábrelo para revisarlas una a una; elegir arriba una las unifica.</div>}
                {isOpen && (
                  <div className="mt-2 space-y-1 rounded-lg border p-2" style={{ borderColor: C.line, background: C.surface }}>
                    <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{mine.length} movimientos · corrige o apoda uno a uno</div>
                    {mine.map((m) => (
                      <div key={m.id} className="rounded-md px-1.5 py-1.5 hover:bg-slate-50">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-500" style={tnum}>{fmtDate(m.date)}
                              {m.currency && (m.origAmount != null
                                ? <span className="ml-1.5 text-slate-400">· orig {Math.abs(m.origAmount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency}</span>
                                : <span className="ml-1.5 font-medium" style={{ color: C.warn }}>· importe en {m.currency}: conviértelo a euros</span>)}
                              {m.confirmed === false && <span className="ml-1.5"><Pill color={C.warn} soft={C.warnSoft}>por revisar</Pill></span>}
                              {isRefund(m) && <span className="ml-1.5 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700" title="Devolución: resta del gasto de su categoría, no cuenta como ingreso">devolución</span>}
                              {m.extra && <span className="ml-1.5 rounded px-1 py-0.5 text-[10px]" style={{ background: C.accentSoft, color: C.accent }}>extraordinario</span>}
                              {outliers?.has?.(m.id) && <span className="ml-1.5"><Pill color={C.warn} soft={C.warnSoft}>atípico</Pill></span>}
                            </div>
                            {m.note && noting !== m.id && <button type="button" onClick={() => { setNoting(m.id); setNoteText(m.note); }} className="mt-0.5 inline-flex max-w-full items-center rounded px-1 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }}><span className="truncate">🏷️ {m.note}</span></button>}
                          </div>
                          {onSetAmount
                            ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500"><Money v={m.amount} bold /></button>
                            : <Money v={m.amount} bold />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <CatSelect value={m.splits ? m.splits[0].cat : m.category} onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-40" />
                          {onReasset && <AssetSelect value={m.assetName === undefined ? (expandParts(m, assets)[0].asset ?? "") : m.assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-32" />}
                          <GroupTags mov={m} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                          {onNote && noting !== m.id && !m.note && <button type="button" onClick={() => { setNoting(m.id); setNoteText(""); }} className="text-[11px] text-slate-400 hover:text-blue-600">+ apodo</button>}
                          {onToggleExtra && <button type="button" onClick={() => onToggleExtra(m)} title={m.extra ? "Quitar de extraordinarios" : "Marcar como extraordinario"} className={`shrink-0 rounded-lg p-2 ${m.extra ? "text-white" : "text-slate-400 hover:bg-slate-100"}`} style={m.extra ? { background: C.accent } : undefined}><Star size={13} /></button>}
                          {onEditMov && <button type="button" onClick={() => onEditMov(m)} title="Editar fecha, importe o concepto" aria-label="Editar movimiento" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil size={13} /></button>}
                          {onDelete && (confirmDel === m.id
                            ? <span className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                                <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                              </span>
                            : <button type="button" onClick={() => setConfirmDel(m.id)} title="Enviar a la papelera" aria-label="Enviar a la papelera" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>)}
                        </div>
                        {onNote && noting === m.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus maxLength={40}
                              placeholder="Apodo o nota (p. ej. «Impuestos»)"
                              onKeyDown={(e) => { if (e.key === "Enter") { onNote(m, noteText); setNoting(null); } if (e.key === "Escape") setNoting(null); }}
                              className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                            <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                            {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Trash2 size={13} /></button>}
                          </div>
                        )}
                        {onSetAmount && amtEdit === m.id && (
                          <div className="mt-1.5 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.bg }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500">Importe</span>
                              <input value={amtText} onChange={(e) => setAmtText(e.target.value)} autoFocus inputMode="decimal"
                                onKeyDown={(e) => { if (e.key === "Enter") saveAmt(m); if (e.key === "Escape") setAmtEdit(null); }}
                                className="w-24 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: C.line }} />
                              <span className="text-xs text-slate-500">€ {m.amount < 0 ? "(gasto)" : "(ingreso)"}</span>
                              <Btn size="sm" kind="primary" onClick={() => saveAmt(m)}>Guardar</Btn>
                              <button type="button" onClick={() => setAmtEdit(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>Cancelar</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span>o convierte desde</span>
                              <select value={amtCur} onChange={(e) => { setAmtCur(e.target.value); if (e.target.value === "EUR") setAmtText(Math.abs(m.amount).toFixed(2)); }} className="rounded-lg border bg-white px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }}>
                                {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {amtCur !== "EUR" && <>
                                <span style={tnum}>1 {amtCur} =</span>
                                <input value={amtRate} onChange={(e) => { setAmtRate(e.target.value); const r = parseFloat((e.target.value || "").replace(",", ".")); if (isFinite(r) && r > 0) setAmtText((Math.abs(m.amount) * r).toFixed(2)); }} inputMode="decimal" placeholder="0,086" className="w-16 rounded-lg border px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }} />
                                <span>€ · orig {Math.abs(m.amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nada coincide con este filtro.</p>}
        </div>
        {filtered.length > shown && <div className="border-t p-3 text-center" style={{ borderColor: C.line }}><Btn onClick={() => setShown(shown + 100)}>Mostrar más ({nfNum.format(filtered.length - shown)})</Btn></div>}
      </Card>
    </div>
  );
}

export {
  ClasificacionTab,
};
