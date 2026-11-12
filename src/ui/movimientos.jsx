import { C, CAT_FILTER_GROUPS, IMPORT_CURRENCIES, WEB_SEARCH_USD, aiCategorizePatterns, aiSupportsWeb, estimateWebCostUSD, expandParts, fmtDate, fmtE, identifiesMerchant, isProcessorPattern, isRefund, lockBodyScroll, monthKey, monthLabelLong, movInGroup, needsAmount, nfNum, orderByInfoGain, stripAccents, tnum, toDateInput, unlockBodyScroll } from "../core.js";
import { AssetSelect, Btn, Card, CatSelect, Modal, Money, MultiSelect, Pill, Seg } from "./comunes.jsx";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Loader2, Pencil, Plus, Scissors, Search, Sparkles, Star, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function MovEditModal({ initial, assets, onCreateAsset, onSave, onClose }) {
  const isNew = !initial;
  const [tipo, setTipo] = useState(initial ? (initial.amount >= 0 ? "ingreso" : "gasto") : "gasto");
  const [amountTxt, setAmountTxt] = useState(initial ? String(Math.abs(initial.amount)).replace(".", ",") : "");
  const [dateTxt, setDateTxt] = useState(toDateInput(initial?.date instanceof Date && !isNaN(initial.date) ? initial.date : new Date()));
  const [concept, setConcept] = useState(initial?.concept || "");
  const [category, setCategory] = useState(initial?.splits ? initial.splits[0].cat : (initial?.category || null));
  const [assetName, setAssetName] = useState(initial?.assetName ? initial.assetName : "");
  const [err, setErr] = useState(null);

  const save = () => {
    const mag = Math.abs(parseFloat((amountTxt || "").replace(/\s|\./g, "").replace(",", ".")));
    if (!isFinite(mag) || mag === 0) { setErr("Pon un importe mayor que cero."); return; }
    const [y, m, d] = dateTxt.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    if (isNaN(date)) { setErr("La fecha no es válida."); return; }
    const amount = Math.round((tipo === "gasto" ? -mag : mag) * 100) / 100;
    onSave({ date, amount, concept: concept.trim() || "Sin concepto", category, assetName: assetName || undefined });
    onClose();
  };

  const Label = ({ children }) => <label className="mb-1 block text-xs font-semibold text-slate-500">{children}</label>;
  return (
    <Modal title={isNew ? "Nuevo movimiento" : "Editar movimiento"} subtitle={isNew ? "Añade un gasto o ingreso a mano" : "Corrige los datos de este movimiento"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Tipo</Label>
          <Seg ariaLabel="Tipo de movimiento" value={tipo} onChange={setTipo}
            options={[{ v: "gasto", l: "Gasto" }, { v: "ingreso", l: "Ingreso" }]} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[8rem] flex-1">
            <Label>Importe (€)</Label>
            <input value={amountTxt} onChange={(e) => setAmountTxt(e.target.value)} autoFocus={isNew} inputMode="decimal" placeholder="0,00"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
          </div>
          <div className="min-w-[8rem] flex-1">
            <Label>Fecha</Label>
            <input type="date" value={dateTxt} onChange={(e) => setDateTxt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
          </div>
        </div>
        <div>
          <Label>Concepto</Label>
          <input value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={120} placeholder="p. ej. Compra en efectivo, Alquiler cobrado en mano…"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[8rem] flex-1">
            <Label>Categoría</Label>
            <CatSelect value={category} allowEmpty onChange={setCategory} className="w-full" />
          </div>
          <div className="min-w-[8rem] flex-1">
            <Label>Activo (opcional)</Label>
            <AssetSelect value={assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => setAssetName(v || "")} className="w-full" />
          </div>
        </div>
        {initial?.splits && <p className="text-[11px] text-amber-600">Este movimiento estaba dividido en varias categorías; al guardar aquí se aplicará una sola categoría.</p>}
        {err && <p className="text-xs font-medium" style={{ color: C.expense }}>{err}</p>}
        <Btn kind="primary" onClick={save} className="w-full justify-center">{isNew ? "Añadir movimiento" : "Guardar cambios"}</Btn>
      </div>
    </Modal>
  );
}

/* Panel de pendientes: clasificas con calma los movimientos que quedaron sin
   confirmar. A diferencia del viejo muro, no bloquea, y un movimiento NO se
   marca como resuelto al vuelo: eliges categoría y activo, y al pulsar
   "Guardar cambios" se aplican juntos (así no desaparece antes de asignarle
   también el activo). */
function PendientesPanel({ movsPend, amb, assets, setAssets, applyPending, aiOn, ai, autoRanRef, onClose, tagGroups, onToggleGroup, onCreateGroup, onRecat, onReasset, onNote, onNoteAll, onSetAmount, onDelete }) {
  const [edits, setEdits] = useState({}); // pattern -> { cat, asset }
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiNote, setAiNote] = useState(null);
  const [unresolved, setUnresolved] = useState([]); // comercios que la IA no supo resolver sin web
  const [webDone, setWebDone] = useState(false);
  const [open, setOpen] = useState(null);       // patrón desplegado a segundo nivel
  const [noting, setNoting] = useState(null);   // id de movimiento cuyo apodo editas
  const [noteText, setNoteText] = useState("");
  const [gNoting, setGNoting] = useState(null); // patrón cuyo apodo (a todos) editas
  const [gNoteText, setGNoteText] = useState("");
  const [amtEdit, setAmtEdit] = useState(null);
  const [amtText, setAmtText] = useState("");
  const [amtCur, setAmtCur] = useState("EUR");
  const [amtRate, setAmtRate] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const createAssetLocal2 = ({ name, emoji }) => setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || "📦", categories: [] }]));
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => { const sign = m.amount < 0 ? -1 : 1; const v = parseFloat((amtText || "").replace(",", ".")) * sign; if (!isFinite(v) || v === 0) return; onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null); setAmtEdit(null); };

  // Agrupar pendientes por patrón (mismo comercio → una fila)
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of movsPend) {
      // Transferencias: una fila por importe. Juntas, la del parking y la de los fondos
      // compartían fila y una sola elección clasificaba las dos.
      const porImporte = needsAmount(m, amb);
      const key = porImporte ? `${m.pattern}|${Math.round(m.amount)}` : m.pattern;
      if (!map.has(key)) map.set(key, { key, pattern: m.pattern, sample: m.concept, mov: porImporte ? m : null, count: 0, total: 0, cat: m.category, ids: [] });
      const g = map.get(key);
      g.count++; g.total += m.amount; g.ids.push(m.id);
    }
    return orderByInfoGain([...map.values()]);
  }, [movsPend, amb]);

  const createAssetLocal = ({ name, emoji }) => {
    setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || "📦", categories: [] }]));
  };
  const setEdit = (pattern, patch) => setEdits((e) => ({ ...e, [pattern]: { ...e[pattern], ...patch } }));
  const touched = Object.keys(edits).filter((p) => edits[p] && (edits[p].cat || edits[p].asset !== undefined));

  const applySuggestions = (map) => setEdits((e) => {
    const next = { ...e };
    for (const g of groups) if (map[g.pattern] && !(next[g.key]?.cat)) next[g.key] = { ...next[g.key], cat: map[g.pattern], _ai: true };
    return next;
  });

  const describeError = (err) => {
    const custom = ai && ai.provider !== "claude";
    const net = /failed to fetch|networkerror|load failed/i.test(err.message);
    if (/\b401\b/.test(err.message) && !custom) {
      return "«Claude (integrado)» solo funciona dentro de claude.ai. En esta app necesitas configurar un proveedor propio en Ajustes → Inteligencia artificial.";
    }
    return net && custom
      ? "No he podido conectar con tu proveedor de IA. Revisa la URL y la clave en Ajustes."
      : "La sugerencia con IA no ha funcionado: " + err.message + ".";
  };

  /* Pasada 1: barata y sin internet. Un modelo pequeño mira el nombre del comercio y
     lo etiqueta. Resuelve la gran mayoría; lo que no sepa vuelve en `unresolved`.
     silent: en el disparo automático no gritamos un error rojo si la IA no responde. */
  const runAI = async (silent = false) => {
    setAiBusy(true); setAiError(null); setAiNote(null);
    try {
      // Sin las operaciones genéricas: la IA no puede saber para qué es una "TRANSFER INMEDIATA".
      const payload = [...new Map(groups.filter((g) => identifiesMerchant(g.pattern)).slice(0, 200).map((g) => [g.pattern, { pattern: g.pattern, sign: g.total > 0 ? 1 : -1 }])).values()];
      const { map, unresolved: left } = await aiCategorizePatterns(payload, false, ai);
      if (Object.keys(map).length === 0) { if (!silent) setAiError("La IA no reconoció ninguno de estos comercios. Clasifícalos a mano."); return; }
      applySuggestions(map);
      setUnresolved(left);
      setWebDone(false);
      const n = Object.keys(map).length - left.length;
      setAiNote(`${n} de ${payload.length} comercios reconocidos sin salir a internet.`);
    } catch (err) {
      // En el disparo automático no gritamos en rojo, pero callarse del todo deja al
      // usuario sin saber por qué no hay sugerencias. Un aviso discreto y accionable.
      if (silent) {
        setAiNote("Sin sugerencias automáticas: no hay ningún proveedor de IA disponible. Configúralo en Ajustes → Inteligencia artificial.");
        return;
      }
      setAiError(describeError(err));
    } finally { setAiBusy(false); }
  };

  /* Pasada 2: solo sobre el residuo, y con la web. Aquí sí hay tasa por búsqueda,
     así que es una decisión explícita del usuario y con el coste estimado delante. */
  const runWebAI = async () => {
    if (!unresolved.length) return;
    setAiBusy(true); setAiError(null); setAiNote(null);
    try {
      const byPattern = new Map(groups.map((g) => [g.pattern, g]));
      const payload = unresolved.map((p) => ({ pattern: p, sign: (byPattern.get(p)?.total ?? -1) > 0 ? 1 : -1 }));
      const { map, unresolved: left, searches } = await aiCategorizePatterns(payload, true, ai);
      applySuggestions(map);
      setUnresolved(left);
      setWebDone(true);
      const found = payload.length - left.length;
      setAiNote(`${found} de ${payload.length} identificados con ${searches || "algunas"} búsquedas web. El resto, a mano.`);
    } catch (err) {
      setAiError(describeError(err));
    } finally { setAiBusy(false); }
  };

  /* Una sola vez por SESIÓN, no por apertura del panel: `autoRanRef` vive en App.
     Con un ref local, cerrar y reabrir "por clasificar" repetía la ronda entera
     (y con búsqueda web eso eran euros, no céntimos). */
  useEffect(() => {
    if (!aiOn || autoRanRef.current || groups.length === 0) return;
    autoRanRef.current = true;
    runAI(true);
  }, [aiOn, groups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { lockBodyScroll(); return unlockBodyScroll; }, []);

  const save = () => {
    const changes = [];
    for (const g of groups) {
      const e = edits[g.key];
      if (!e || (!e.cat && e.asset === undefined)) continue;
      changes.push({ pattern: g.pattern, cat: e.cat || g.cat, asset: e.asset, fromAI: !!e._ai, ...(g.mov ? { ids: g.ids, mov: g.mov } : {}) });
    }
    applyPending(changes);
    onClose();
  };

  if (!movsPend.length) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <Card className="w-full max-w-md p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <Check size={28} className="mx-auto" style={{ color: C.income }} />
          <h2 className="mt-2 text-lg font-semibold">Todo clasificado</h2>
          <p className="mt-1 text-sm text-slate-500">No tienes movimientos pendientes de revisar.</p>
          <Btn kind="primary" className="mt-4" onClick={onClose}>Cerrar</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Movimientos por clasificar</h2>
            <p className="text-xs text-slate-500">{nfNum.format(movsPend.length)} movimientos en {groups.length} comercios. Lo que clasifiques se guarda como regla: no te lo volveré a preguntar en las próximas cargas.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>

        {aiOn && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2" style={{ borderColor: C.line }}>
            <Btn onClick={() => runAI()} disabled={aiBusy}>
              {aiBusy ? <><Loader2 size={14} className="animate-spin" /> Clasificando…</> : <><Sparkles size={14} /> Volver a sugerir</>}
            </Btn>

            {/* Segunda pasada, solo sobre lo que la primera no supo. La tasa por búsqueda
                es real ($10/1.000), así que la enseñamos antes de que el usuario decida. */}
            {!aiBusy && unresolved.length > 0 && !webDone && aiSupportsWeb(ai) && (() => {
              const { searches, usd } = estimateWebCostUSD(unresolved.length);
              return (
                <Btn onClick={runWebAI} title={`Hasta ${searches} búsquedas a $${WEB_SEARCH_USD} cada una, más los tokens de los resultados`}>
                  <Search size={14} /> Buscar en la web los {unresolved.length} desconocidos
                  <span className="ml-1 text-slate-400">≈ ${usd.toFixed(2)}</span>
                </Btn>
              );
            })()}

            {aiNote && !aiError && <span className="text-xs text-slate-500">{aiNote}</span>}
            {aiError && <span className="w-full text-xs text-rose-600">{aiError}</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ touchAction: "pan-y" }}>
          {groups.map((g) => {
            const e = edits[g.key] || {};
            const cat = e.cat ?? "";
            const asset = e.asset;
            const isOpen = open === g.key;
            const mine = isOpen ? movsPend.filter((m) => g.ids.includes(m.id)).sort((a, b) => b.date - a.date) : null;
            const noteVals = new Set();
            for (const m of movsPend) if (m.pattern === g.pattern && m.note) noteVals.add(m.note);
            const gNote = noteVals.size === 1 ? [...noteVals][0] : null;
            const gMixed = noteVals.size > 1;
            return (
              <div key={g.key} className="border-b px-4 py-3" style={{ borderColor: C.line }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.key)} className="flex w-full items-start gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium" title={g.sample}>{g.sample}</div>
                    <div className="mt-0.5 text-xs text-slate-500" style={tnum}>
                      {g.count} {g.count === 1 ? "movimiento" : "movimientos"} · {fmtE(g.total)}
                      {e._ai && <span className="ml-2 inline-flex items-center gap-0.5 text-blue-700"><Sparkles size={11} /> IA</span>}
                      {noteVals.size > 0 && <span className="ml-2">🏷️ {noteVals.size === 1 ? gNote : "varios"}</span>}
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CatSelect value={cat} allowEmpty onChange={(v) => setEdit(g.key, { cat: v, _ai: false })} className="min-w-0 flex-1 basis-[45%] sm:basis-auto" />
                  <AssetSelect value={asset ?? ""} assets={assets} onCreateAsset={createAssetLocal} onChange={(v) => setEdit(g.key, { asset: v })} className="min-w-0 flex-1 basis-[45%] sm:basis-auto" />
                  {onToggleGroup && <GroupTags mov={{ id: g.ids[0], pattern: g.pattern }} groups={tagGroups || []} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />}
                  {onNoteAll && <button type="button" onClick={() => { setGNoting(gNoting === g.key ? null : g.key); setGNoteText(gNote || ""); }} className="rounded-lg border px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }}>{gNote || gMixed ? `🏷️ ${gNote || "varios"}` : "+ apodo a todos"}</button>}
                </div>
                {onNoteAll && gNoting === g.key && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={gNoteText} onChange={(ev) => setGNoteText(ev.target.value)} autoFocus maxLength={40}
                      placeholder={`Apodo para los ${g.count} movimientos`}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { onNoteAll({ pattern: g.pattern }, gNoteText); setGNoting(null); } if (ev.key === "Escape") setGNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNoteAll({ pattern: g.pattern }, gNoteText); setGNoting(null); }}>Aplicar a todos</Btn>
                    {(gNote || gMixed) && <button type="button" onClick={() => { onNoteAll({ pattern: g.pattern }, ""); setGNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
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
                            </div>
                            {m.note && noting !== m.id && <button type="button" onClick={() => { setNoting(m.id); setNoteText(m.note); }} className="mt-0.5 inline-flex max-w-full items-center rounded px-1 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }}><span className="truncate">🏷️ {m.note}</span></button>}
                          </div>
                          {onSetAmount
                            ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500"><Money v={m.amount} bold /></button>
                            : <Money v={m.amount} bold />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {onRecat && <CatSelect value={m.category} allowEmpty onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-40" />}
                          {onReasset && <AssetSelect value={m.assetName === undefined ? "" : m.assetName} assets={assets} onCreateAsset={createAssetLocal2} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-32" />}
                          <GroupTags mov={m} groups={tagGroups || []} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                          {onNote && noting !== m.id && !m.note && <button type="button" onClick={() => { setNoting(m.id); setNoteText(""); }} className="text-[11px] text-slate-400 hover:text-blue-600">+ apodo</button>}
                          {onDelete && (confirmDel === m.id
                            ? <span className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                                <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                              </span>
                            : <button type="button" onClick={() => setConfirmDel(m.id)} title="Enviar a la papelera" aria-label="Enviar a la papelera" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>)}
                        </div>
                        {onSetAmount && amtEdit === m.id && (
                          <div className="mt-1.5 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.bg }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500">Importe</span>
                              <input value={amtText} onChange={(ev) => setAmtText(ev.target.value)} autoFocus inputMode="decimal"
                                onKeyDown={(ev) => { if (ev.key === "Enter") saveAmt(m); if (ev.key === "Escape") setAmtEdit(null); }}
                                className="w-24 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: C.line }} />
                              <span className="text-xs text-slate-500">€ {m.amount < 0 ? "(gasto)" : "(ingreso)"}</span>
                              <Btn size="sm" kind="primary" onClick={() => saveAmt(m)}>Guardar</Btn>
                              <button type="button" onClick={() => setAmtEdit(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>Cancelar</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span>o convierte desde</span>
                              <select value={amtCur} onChange={(ev) => { setAmtCur(ev.target.value); if (ev.target.value === "EUR") setAmtText(Math.abs(m.amount).toFixed(2)); }} className="rounded-lg border bg-white px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }}>
                                {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {amtCur !== "EUR" && <>
                                <span style={tnum}>1 {amtCur} =</span>
                                <input value={amtRate} onChange={(ev) => { setAmtRate(ev.target.value); const r = parseFloat((ev.target.value || "").replace(",", ".")); if (isFinite(r) && r > 0) setAmtText((Math.abs(m.amount) * r).toFixed(2)); }} inputMode="decimal" placeholder="0,086" className="w-16 rounded-lg border px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }} />
                                <span>€</span>
                              </>}
                            </div>
                          </div>
                        )}
                        {onNote && noting === m.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input value={noteText} onChange={(ev) => setNoteText(ev.target.value)} autoFocus maxLength={40}
                              placeholder="Apodo o nota"
                              onKeyDown={(ev) => { if (ev.key === "Enter") { onNote(m, noteText); setNoting(null); } if (ev.key === "Escape") setNoting(null); }}
                              className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                            <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                            {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Trash2 size={13} /></button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3" style={{ borderColor: C.line }}>
          <span className="text-xs text-slate-500">{touched.length > 0 ? `${touched.length} ${touched.length === 1 ? "comercio listo" : "comercios listos"}` : "Sin cambios todavía"}</span>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Cerrar</Btn>
            <Btn kind="primary" onClick={save} disabled={touched.length === 0}><Check size={14} /> Guardar cambios</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function FiltersBar({ filters, setFilters, monthsAvail, yearsAvail, assets, groups }) {
  const f = filters;
  const set = (patch) => setFilters({ ...f, ...patch });
  const lastMonth = monthsAvail[monthsAvail.length - 1];
  const prevMonth = monthsAvail[monthsAvail.length - 2];
  return (
    // En móvil, dos filas fijas: arriba el periodo y abajo los filtros. Antes era una sola fila
    // que se desplazaba de lado sin ninguna pista, y la mitad de las opciones no se veían.
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
     <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Seg ariaLabel="Periodo" value={f.periodType} onChange={(v) => set({ periodType: v, ...(v === "month" && !f.month ? { month: lastMonth } : {}) })}
        options={[{ v: "all", l: "Todo" }, { v: "year", l: "Año" }, { v: "month", l: "Mes" }, { v: "custom", l: "Rango" }]} />
      {f.periodType === "year" && (
        <select value={f.year} onChange={(e) => set({ year: +e.target.value })} aria-label="Año" className="shrink-0 rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line, ...tnum }}>
          {yearsAvail.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
      {f.periodType === "month" && (
        <>
          <select value={f.month} onChange={(e) => set({ month: e.target.value })} aria-label="Mes" className="min-w-0 shrink rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
            {monthsAvail.map((m) => <option key={m} value={m}>{monthLabelLong(m)}</option>)}
          </select>
          {/* En el móvil sobran: el desplegable ya elige el mes. */}
          <span className="hidden gap-2 sm:flex">
            <Btn size="sm" kind="subtle" className="shrink-0" onClick={() => set({ month: lastMonth })} disabled={!lastMonth}>Último mes</Btn>
            <Btn size="sm" kind="subtle" className="shrink-0" onClick={() => set({ month: prevMonth })} disabled={!prevMonth}>Mes anterior</Btn>
          </span>
        </>
      )}
      {f.periodType === "custom" && (
        <div className="flex shrink-0 items-center gap-1.5 text-sm">
          <input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="Desde" className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
          <span className="text-slate-400">–</span>
          <input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="Hasta" className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
        </div>
      )}
     </div>
      {/* En el móvil, los filtros en una sola fila a partes iguales. */}
      <div className="grid auto-cols-fr grid-flow-col gap-1.5 sm:ml-auto sm:flex sm:gap-2">
        <MultiSelect label="Categorías" icon={<Filter size={13} />} groups={CAT_FILTER_GROUPS} selected={f.cats} onChange={(s) => set({ cats: s })} />
        {assets.length > 0 && <MultiSelect label="Activos" options={assets.map((a) => a.name)} selected={f.assetsSel} onChange={(s) => set({ assetsSel: s })} />}
        {groups.length > 0 && <MultiSelect label="Grupos" icon={<Tag size={13} />} options={groups.map((g) => g.name)} selected={f.groupsSel} onChange={(s) => set({ groupsSel: s })} />}
      </div>
    </div>
  );
}

/* ============================================================
   DRILL-DOWN (corrección por contexto + etiquetado de grupos)
   ============================================================ */
function SplitEditor({ mov, onSave, onCancel }) {
  const [pct, setPct] = useState(mov.splits?.[0]?.pct ?? 50);
  const [catA, setCatA] = useState(mov.splits?.[0]?.cat ?? mov.category ?? "Otros");
  const [catB, setCatB] = useState(mov.splits?.[1]?.cat ?? "Otros");
  return (
    <div className="mt-2 rounded-xl border bg-slate-50 p-3" style={{ borderColor: C.line }}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CatSelect value={catA} onChange={setCatA} className="w-40" />
        <input type="number" min={1} max={99} value={pct} aria-label="Porcentaje" onChange={(e) => setPct(Math.min(99, Math.max(1, +e.target.value || 1)))} className="w-16 rounded-lg border px-2 py-1 text-sm" style={{ ...tnum, borderColor: C.line }} />
        <span className="text-xs text-slate-500">%</span><span className="text-slate-400">+</span>
        <CatSelect value={catB} onChange={setCatB} className="w-40" /><span className="text-xs text-slate-500" style={tnum}>{100 - pct} %</span>
      </div>
      <div className="mt-2 text-xs text-slate-500" style={tnum}>{fmtE((mov.amount * pct) / 100)} · {fmtE((mov.amount * (100 - pct)) / 100)}</div>
      <div className="mt-2 flex gap-2">
        <Btn size="sm" kind="primary" onClick={() => onSave([{ pct, cat: catA }, { pct: 100 - pct, cat: catB }])}>Guardar división</Btn>
        {mov.splits && <Btn size="sm" onClick={() => onSave(null)}>Quitar</Btn>}
        <Btn size="sm" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

function GroupTags({ mov, groups, onToggle, onCreateGroup }) {
  const [open, setOpen] = useState(false);
  const inGroups = groups.filter((g) => movInGroup(mov, g));
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
        <Tag size={12} /> {inGroups.length ? `${inGroups.length} etiqueta${inGroups.length > 1 ? "s" : ""}` : "Etiquetar"} <ChevronDown size={11} />
      </button>
      {open && (
        <>
          {/* En móvil, hoja inferior fija (no se recorta dentro de listas con scroll);
              en escritorio, popover normal a la derecha del botón. */}
          <div className="fixed inset-0 z-50 bg-slate-900/25 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:w-56 sm:max-h-none sm:rounded-xl sm:shadow-xl" style={{ borderColor: C.line, paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-1 flex items-center justify-between px-2 sm:hidden">
              <span className="text-xs font-semibold text-slate-500">Etiquetas de «{(mov.concept || mov.pattern || "").slice(0, 22)}»</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {groups.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-500">No hay etiquetas todavía.</div>}
            {groups.map((g) => {
              const inIt = movInGroup(mov, g);
              const byKw = g.keywords?.some((k) => k && stripAccents(mov.pattern.toUpperCase()).includes(stripAccents(k.toUpperCase())));
              return (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={inIt} onChange={() => onToggle(mov, g)} />
                  <span>{g.emoji}</span><span className="flex-1 truncate">{g.name}</span>
                  {byKw && inIt && <span className="text-[10px] text-slate-400" title="Coincide por palabra clave">auto</span>}
                </label>
              );
            })}
            <button type="button" onClick={() => { setOpen(false); onCreateGroup(mov); }} className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
              <Plus size={13} /> Nueva etiqueta con este gasto
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DrillPanel({ drill, movs, assets, groups, outliers, onClose, onRecat, onReasset, onReassetAll, onToggleGroup, onCreateGroup, onCreateAsset, onToggleExtra, onNote, onDelete, onSetAmount, onEditMov, onSplit }) {
  const [shown, setShown] = useState(60);
  const [dividiendo, setDividiendo] = useState(null); // id del movimiento que se está dividiendo
  const [noting, setNoting] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [amtEdit, setAmtEdit] = useState(null);   // id del movimiento cuyo importe editas
  const [amtText, setAmtText] = useState("");      // importe en € (valor absoluto)
  const [amtCur, setAmtCur] = useState("EUR");     // divisa desde la que convertir
  const [amtRate, setAmtRate] = useState("");      // tasa de conversión
  const [q, setQ] = useState("");
  const [signSel, setSignSel] = useState("todos"); // todos | in (ingresos) | out (gastos)
  const [amtMin, setAmtMin] = useState("");        // importe (valor absoluto) desde
  const [amtMax, setAmtMax] = useState("");        // importe (valor absoluto) hasta
  const isSearch = drill.type === "search";
  // Como el resto de diálogos: bloquea la página de detrás y se cierra con Escape. Sin esto, en
  // el iPhone, deslizar dentro del panel movía la página de debajo, que es más ancha que la
  // pantalla (la barra de filtros), y todo se desplazaba de lado.
  const cerrarRef = useRef(onClose);
  cerrarRef.current = onClose;
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") cerrarRef.current?.(); };
    window.addEventListener("keydown", h);
    lockBodyScroll();
    return () => { window.removeEventListener("keydown", h); unlockBodyScroll(); };
  }, []);
  useEffect(() => { setShown(60); setNoting(null); setConfirmDel(null); setAmtEdit(null); setQ(""); setSignSel("todos"); setAmtMin(""); setAmtMax(""); }, [drill?.key, drill?.type, drill?.label]);
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => {
    const sign = m.amount < 0 ? -1 : 1;
    const v = parseFloat((amtText || "").replace(",", ".")) * sign;
    if (!isFinite(v) || v === 0) return;
    onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null);
    setAmtEdit(null);
  };
  const list = useMemo(() => {
    const idset = drill.ids ? new Set(drill.ids) : null;
    const match = (m) => {
      if (idset) return idset.has(m.id);
      // Un drill puede acotarse a un mes: "Dónde más fue" del cierre quiere ESOS cargos
      // del mes, no toda la categoría en el histórico (que confunde más que aclara).
      if (drill.month && monthKey(m.date) !== drill.month) return false;
      // …y por signo: en Activos quieres ver los ingresos y los gastos por separado.
      if (drill.sign === "in" && !(m.amount > 0)) return false;
      if (drill.sign === "out" && !(m.amount < 0)) return false;
      if (drill.type === "cat") return expandParts(m, assets).some((p) => p.cat === drill.key);
      if (drill.type === "asset") return expandParts(m, assets).some((p) => p.asset === drill.key);
      if (drill.type === "group") { const g = groups.find((x) => x.id === drill.key); return g ? movInGroup(m, g) : false; }
      if (drill.type === "pattern") return m.pattern === drill.key;
      if (drill.type === "atipicos") return outliers.has(m.id);
      if (drill.type === "search") {
        const t = stripAccents(q.trim().toUpperCase());
        const min = parseFloat((amtMin || "").replace(",", "."));
        const max = parseFloat((amtMax || "").replace(",", "."));
        const hasMin = isFinite(min), hasMax = isFinite(max);
        // Sin ningún filtro no mostramos nada (evita volcar todo el histórico sin querer).
        if (!t && signSel === "todos" && !hasMin && !hasMax) return false;
        if (t && !stripAccents((m.concept + " " + m.pattern).toUpperCase()).includes(t)) return false;
        if (signSel === "in" && !(m.amount > 0)) return false;
        if (signSel === "out" && !(m.amount < 0)) return false;
        const abs = Math.abs(m.amount);
        if (hasMin && abs < min) return false;
        if (hasMax && abs > max) return false;
        return true;
      }
      return false;
    };
    const out = movs.filter(match);
    return isSearch ? out.sort((a, b) => b.date - a.date) : out.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [drill, movs, assets, groups, outliers, q, signSel, amtMin, amtMax, isSearch]);
  const total = list.reduce((s, m) => s + m.amount, 0);
  // La categoría se puede corregir desde cualquier drill: en Análisis ves los cargos
  // de un comercio (p. ej. PayPal) y a veces uno no es lo que el resto — hay que poder
  // recolocarlo ahí mismo, no solo ponerle activo o etiqueta.
  const showCat = true;

  return (
    <div className="fixed inset-0 z-40 flex justify-end overflow-hidden overscroll-none">
      <div className="absolute inset-0 bg-slate-900/30 anim-fade" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-x-hidden bg-white shadow-2xl anim-slide" role="dialog" aria-modal="true" aria-label={`Movimientos de ${drill.label}`}>
        <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{drill.label}</h2>
            <p className="text-xs text-slate-500" style={tnum}>{list.length} movimientos · <span style={{ color: total < 0 ? C.expense : C.income }}>{fmtE(total)}</span></p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        {isSearch ? (
          <div className="border-b px-4 py-2.5" style={{ borderColor: C.line }}>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.lineStrong }}>
              <Search size={15} className="shrink-0 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Buscar movimientos"
                placeholder="Comercio o concepto (p. ej. taller, netflix, bizum…)"
                className="w-full bg-transparent text-sm focus:outline-none" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Seg ariaLabel="Ingresos o gastos" value={signSel} onChange={setSignSel}
                options={[{ v: "todos", l: "Todos" }, { v: "in", l: "Ingresos" }, { v: "out", l: "Gastos" }]} />
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
            <p className="mt-1.5 text-[11px] text-slate-400">Busca por texto, por importe (valor absoluto) y por ingresos/gastos, dentro del periodo de arriba. Corrige o etiqueta desde los resultados.</p>
          </div>
        ) : (
          <p className="border-b px-4 py-2 text-xs text-slate-500" style={{ borderColor: C.line }}>Corrige aquí lo que esté mal: la categoría se aplica a movimientos similares. Usa <span className="font-medium">Etiquetar</span> para tus clusters (pádel, maratones, vacaciones…).</p>
        )}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ touchAction: "pan-y" }}>
          {list.slice(0, shown).map((m) => {
            // "Otros" = movimientos del mismo comercio distintos de este (los que una
            // acción "aplicar a todos" tocaría de verdad). No contamos el actual: así el
            // aviso dice lo que ves ("y otro más"), no un total que incluye este.
            const proc = isProcessorPattern(m.pattern);
            // En pasarelas cada cargo es un comercio distinto: sin cambios en bloque.
            const others = proc ? [] : movs.filter((x) => x.pattern === m.pattern && x.id !== m.id);
            const myAsset = m.assetName === undefined ? null : m.assetName;
            const othersToAsset = myAsset ? others.filter((x) => (x.assetName === undefined ? null : x.assetName) !== myAsset) : [];
            return (
              <div key={m.id} className="border-b px-4 py-2.5 last:border-0" style={{ borderColor: C.line }}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm" title={m.concept}>{m.concept}</div>
                    <div className="text-xs text-slate-500" style={tnum}>{fmtDate(m.date)}
                      {m.currency && (m.origAmount != null
                        ? <span className="ml-2 text-slate-400">· orig {Math.abs(m.origAmount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency}</span>
                        : <span className="ml-2 font-medium" style={{ color: C.warn }}>· importe en {m.currency}: conviértelo a euros</span>)}
                      {outliers.has(m.id) && <span className="ml-2"><Pill color={C.warn} soft={C.warnSoft}>atípico</Pill></span>}
                      {m.splits && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">dividido</span>}
                      {isRefund(m) && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700" title="Devolución: resta del gasto de su categoría, no cuenta como ingreso">devolución</span>}
                      {m.extra && <span className="ml-2"><Pill color={C.accent} soft="rgba(99,102,241,.12)">extraordinario</Pill></span>}
                    </div>
                    {onNote && (m.note
                      ? <button type="button" onClick={() => { setNoting(noting === m.id ? null : m.id); setNoteText(m.note); }} className="mt-1 inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }} title="Editar apodo o nota"><span className="truncate">🏷️ {m.note}</span></button>
                      : <button type="button" onClick={() => { setNoting(noting === m.id ? null : m.id); setNoteText(""); }} className="mt-1 block text-[11px] text-slate-400 hover:text-blue-600">+ apodo / nota</button>)}
                  </div>
                  {onSetAmount
                    ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Money v={m.amount} bold /></button>
                    : <Money v={m.amount} bold />}
                </div>
                {/* En 360 px los anchos fijos (w-40 + w-32) se salían del panel: en móvil
                    cada selector ocupa media fila, y los iconos suben a 40 px de zona táctil. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {showCat && <CatSelect value={m.splits ? m.splits[0].cat : m.category} onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:w-40 sm:flex-none sm:basis-auto" />}
                  <AssetSelect value={m.assetName === undefined ? (expandParts(m, assets)[0].asset ?? "") : m.assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:w-32 sm:flex-none sm:basis-auto" />
                  <GroupTags mov={m} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                  {onToggleExtra && <button type="button" onClick={() => onToggleExtra(m)} aria-label={m.extra ? "Quitar de extraordinarios" : "Marcar como extraordinario"} title={m.extra ? "Quitar de extraordinarios (vuelve al análisis)" : "Marcar como extraordinario (fuera de medias, proyecciones y comparativas)"} className={`shrink-0 rounded-lg p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${m.extra ? "text-white" : "text-slate-500 hover:bg-slate-100"}`} style={m.extra ? { background: C.accent } : undefined}><Star size={15} /></button>}
                  {onSplit && <button type="button" onClick={() => setDividiendo(dividiendo === m.id ? null : m.id)} title="Dividir entre dos categorías (p. ej. una compra mitad súper, mitad hogar)" aria-label="Dividir movimiento" aria-expanded={dividiendo === m.id} className="shrink-0 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Scissors size={16} /></button>}
                  {onEditMov && <button type="button" onClick={() => onEditMov(m)} title="Editar fecha, importe o concepto" aria-label="Editar movimiento" className="shrink-0 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>}
                  {onDelete && (confirmDel === m.id
                    ? <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                        <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1.5 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                      </span>
                    : <button type="button" onClick={() => setConfirmDel(m.id)} title="Borrar movimiento (no lo quiero analizar)" aria-label="Borrar movimiento" className="shrink-0 rounded-lg p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={15} /></button>)}
                </div>
                {onSplit && dividiendo === m.id && <SplitEditor mov={m} onSave={(sp) => { onSplit(m, sp); setDividiendo(null); }} onCancel={() => setDividiendo(null)} />}
                {othersToAsset.length > 0 && onReassetAll && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Este activo está solo en este movimiento.{" "}
                    <button type="button" onClick={() => onReassetAll(m, m.assetName)} className="font-medium text-blue-600 hover:underline">Aplicar {othersToAsset.length === 1 ? "también al otro" : `también a los otros ${othersToAsset.length}`} de «{m.pattern}»</button>
                  </div>
                )}
                {showCat && others.length > 0 && !proc && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    El cambio de categoría afecta solo a este movimiento.{" "}
                    <button type="button" onClick={() => onRecat(m, m.splits ? m.splits[0].cat : (m.category || "Otros"), true)} className="font-medium text-blue-600 hover:underline">Aplicar «{m.splits ? m.splits[0].cat : (m.category || "Otros")}» {others.length === 1 ? "también al otro" : `también a los otros ${others.length}`} de «{m.pattern}»</button>
                  </div>
                )}
                {showCat && proc && <div className="mt-1 text-[11px] text-slate-400">«{m.pattern}» agrupa comercios distintos: el cambio afecta solo a este cargo.</div>}
                {onNote && noting === m.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus maxLength={40}
                      placeholder="Apodo o nota (p. ej. «Impuestos», «reforma baño»)"
                      onKeyDown={(e) => { if (e.key === "Enter") { onNote(m, noteText); setNoting(null); } if (e.key === "Escape") setNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                    {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" title="Quitar apodo" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
                {onSetAmount && amtEdit === m.id && (
                  <div className="mt-2 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.surfaceAlt }}>
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
                        <span>€ · sobre el original {Math.abs(m.amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {amtCur}</span>
                      </>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {list.length > shown && <div className="p-3 text-center"><Btn onClick={() => setShown(shown + 100)}>Mostrar más ({nfNum.format(list.length - shown)})</Btn></div>}
          {list.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {isSearch ? (q.trim() ? "Nada coincide en el periodo seleccionado. Prueba con menos letras o cambia el periodo." : "Escribe arriba para buscar en tus movimientos.") : "No hay movimientos aquí con los filtros actuales."}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export {
  MovEditModal,
  PendientesPanel,
  FiltersBar,
  SplitEditor,
  GroupTags,
  DrillPanel,
};
