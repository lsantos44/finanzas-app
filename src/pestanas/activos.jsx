import { C, CATEGORIES_GASTO, CATEGORIES_INGRESO, EMOJI_CHOICES, GROUP_COLORS, GROUP_EMOJI, RENTA_CONCEPTO, RENTA_CUOTA, RENTA_REVISAR, TIPOS_ACTIVO, calcImputacion, calcRentaInmueble, catColor, fmtE0, fmtPct, monthsCoveredOf, movInGroup, r2, rentaConceptos, tipoActivo, tnum } from "../core.js";
import { Btn, Card, Modal, Seg, useBackClose } from "../ui/comunes.jsx";
import { ArrowDownRight, ArrowUpRight, Car, ChevronRight, Download, FileText, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

/* ============================================================
   PESTAÑA ACTIVOS
   ============================================================ */
// Campo numérico de la ficha fiscal (vacío = sin dato).
function CampoFicha({ label, value, onChange, suf, ayuda, step = "any" }) {
  return (
    <label className="block text-xs text-slate-600">
      <span className="font-medium">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <input type="number" inputMode="decimal" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="w-full min-w-0 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
        {suf && <span className="text-slate-400">{suf}</span>}
      </span>
      {ayuda && <span className="mt-0.5 block text-[11px] text-slate-500">{ayuda}</span>}
    </label>
  );
}

function AssetModal({ asset, allAssets = [], onSave, onDelete, onClose }) {
  const [name, setName] = useState(asset?.name || "");
  const [fiscal, setFiscal] = useState(asset?.fiscal || {});
  const setF = (k, v) => setFiscal((f) => ({ ...f, [k]: v }));
  const anioRenta = new Date().getFullYear() - 1; // la renta que se declara ahora es la del año pasado
  // Categorías que ya usa otro activo: un gasto solo puede ir a uno (el primero de la lista).
  const enOtro = (c) => allAssets.find((a) => a.id !== asset?.id && (a.categories || []).includes(c));
  const [emoji, setEmoji] = useState(asset?.emoji || "📦");
  const [cats, setCats] = useState(new Set(asset?.categories || []));
  const [value, setValue] = useState(asset?.value != null ? String(asset.value) : "");
  const [uso, setUso] = useState(asset?.uso || "otro"); // alquiler | vivienda | segunda | otro
  const [tipo, setTipo] = useState(asset?.tipo || "");  // vacío = deducido
  return (
    <Modal title={asset ? "Editar activo" : "Nuevo activo"} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div><label className="text-xs font-medium text-slate-600">Icono</label>
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 block rounded-lg border bg-white px-2 py-1.5 text-lg" style={{ borderColor: C.line }}>{EMOJI_CHOICES.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="flex-1"><label className="text-xs font-medium text-slate-600">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coche, Casa, Segunda residencia…" className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} /></div>
        </div>
        <label className="block text-xs font-medium text-slate-600">Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
            <option value="">Automático ({TIPOS_ACTIVO.find((t) => t.v === tipoActivo({ name, emoji, uso }))?.l})</option>
            {TIPOS_ACTIVO.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Para ver juntos, por ejemplo, todos tus vehículos o todos tus inmuebles.</span>
        </label>
        <div>
          <label className="text-xs font-medium text-slate-600">Uso</label>
          <p className="mb-1.5 mt-0.5 text-xs text-slate-400">Para el informe por inmueble: distingue lo que alquilas de tu vivienda.</p>
          <Seg ariaLabel="Uso del activo" value={uso} onChange={setUso}
            options={[{ v: "alquiler", l: "🔑 En alquiler" }, { v: "vivienda", l: "🏠 Vivienda habitual" }, { v: "segunda", l: "🏖️ Sin alquilar" }, { v: "otro", l: "Otro" }]} />
          {uso === "vivienda" && <p className="mt-1 text-[11px] text-slate-500">Los recibos de luz, agua, comunidad o IBI que reconozca la app irán a este activo.</p>}
        </div>
        {(uso === "alquiler" || uso === "segunda") && (
          <details className="rounded-xl border p-3" style={{ borderColor: C.line }} open={!asset?.fiscal}>
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">Ficha fiscal para la renta <span className="font-normal text-slate-500">(con ella la app calcula amortización, reducción e imputación)</span></summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="col-span-2 block text-xs text-slate-600"><span className="font-medium">Referencia catastral</span>
                <input value={fiscal.refCatastral || ""} onChange={(e) => setF("refCatastral", e.target.value || undefined)} placeholder="Está en el recibo del IBI"
                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} /></label>
              <CampoFicha label="Tu titularidad" suf="%" value={fiscal.titularidad} onChange={(v) => setF("titularidad", v)} ayuda="100 si es solo tuyo" />
              <CampoFicha label="Valor catastral" suf="€" value={fiscal.valorCatastral} onChange={(v) => setF("valorCatastral", v)} ayuda="Recibo del IBI" />
              {uso === "alquiler" && <>
                <CampoFicha label="Días alquilado al año" value={fiscal.diasArrendado} step="1" onChange={(v) => setF("diasArrendado", v)} ayuda="365 si todo el año" />
                <CampoFicha label="Construcción" suf="%" value={fiscal.pctConstruccion} onChange={(v) => setF("pctConstruccion", v)} ayuda="Valor catastral de la construcción ÷ total" />
                <CampoFicha label="Coste de compra" suf="€" value={fiscal.coste} onChange={(v) => setF("coste", v)} ayuda="Precio más gastos e impuestos" />
                <label className="block text-xs text-slate-600"><span className="font-medium">Reducción</span>
                  <select value={fiscal.reduccion ?? ""} onChange={(e) => setF("reduccion", e.target.value === "" ? undefined : Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
                    <option value="">Sin indicar</option>
                    <option value="0">0 % (no es vivienda)</option>
                    <option value="60">60 % (contrato antes del 26/05/2023, o con obras de rehabilitación)</option>
                    <option value="50">50 % (contrato desde el 26/05/2023)</option>
                    <option value="70">70 % (joven en zona tensionada / vivienda pública)</option>
                    <option value="90">90 % (rebaja de renta en zona tensionada)</option>
                  </select>
                  <span className="mt-0.5 block text-[11px] text-slate-500">Depende de la fecha y tipo de contrato</span></label>
                <CampoFicha label={`Intereses del préstamo ${anioRenta}`} suf="€" value={fiscal.intereses?.[anioRenta]} onChange={(v) => setFiscal((f) => ({ ...f, intereses: { ...(f.intereses || {}), [anioRenta]: v } }))} ayuda="Certificado del banco; 0 si no hay" />
              </>}
              <label className="col-span-2 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" className="accent-blue-600" checked={!!fiscal.catastralRevisado} onChange={(e) => setF("catastralRevisado", e.target.checked)} />
                Valor catastral revisado en los últimos 10 años (imputa el 1,1 % en vez del 2 %)
              </label>
            </div>
          </details>
        )}
        <div>
          <label className="text-xs font-medium text-slate-600">Valoración actual <span className="font-normal text-slate-400">(opcional)</span></label>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ej. 180000" className="w-40 rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-sm text-slate-400">€</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">El valor de mercado del piso, el coche o tu posición. Un CSV no lo trae; con él la app calcula tu patrimonio y la rentabilidad real (rendimiento anual sobre el valor).</p>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Categorías que agrupa</div>
          <p className="mb-2 mt-0.5 text-xs text-slate-400">Todo gasto de estas categorías cuenta para el activo, salvo que un movimiento tenga otro activo asignado a mano.</p>
          <div className="grid max-h-56 grid-cols-2 gap-x-3 overflow-y-auto rounded-xl border p-2" style={{ borderColor: C.line }}>
            {/* Gastos y, debajo, ingresos: el alquiler cobrado también tiene que poder ir al piso por
                categoría (antes solo se podía asignar movimiento a movimiento). */}
            {[...CATEGORIES_GASTO, ...CATEGORIES_INGRESO].map((c, i) => (
              <label key={c} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 ${i === CATEGORIES_GASTO.length ? "col-span-2 mt-1 border-t pt-2" : ""}`} style={i === CATEGORIES_GASTO.length ? { borderColor: C.line } : undefined}>
                <input type="checkbox" className="accent-blue-600" checked={cats.has(c)} onChange={(e) => { const s = new Set(cats); e.target.checked ? s.add(c) : s.delete(c); setCats(s); }} />
                <span className="min-w-0">{c}{cats.has(c) && enOtro(c) && <span className="block text-[10px] leading-tight" style={{ color: C.warn }}>también en «{enOtro(c).name}»</span>}</span>
              </label>
            ))}
          </div>
          {[...cats].some(enOtro) && <p className="mt-1 text-[11px]" style={{ color: C.warn }}>Una categoría compartida va entera al primer activo de la lista. Para repartir, asigna el activo a mano en cada movimiento.</p>}
        </div>
        <div className="flex justify-between gap-2">
          {asset ? <Btn kind="danger" onClick={onDelete}><Trash2 size={14} /> Eliminar</Btn> : <span />}
          <div className="flex gap-2"><Btn onClick={onClose}>Cancelar</Btn><Btn kind="primary" disabled={!name.trim()} onClick={() => { const v = parseFloat(String(value).replace(",", ".")); onSave({ name: name.trim(), emoji, categories: [...cats], value: isFinite(v) && v > 0 ? v : undefined, uso, tipo: tipo || undefined, ...((uso === "alquiler" || uso === "segunda") ? { fiscal } : {}) }); }}>Guardar</Btn></div>
        </div>
      </div>
    </Modal>
  );
}

/* Informe por inmueble para el periodo seleccionado (un año natural = informe anual, útil
   para la renta). Por cada activo «en alquiler»: alquiler cobrado, gastos desglosados por
   categoría y rendimiento neto. La vivienda habitual se muestra aparte (no es rendimiento
   de alquiler). Es orientativo: no sustituye al asesoramiento fiscal. */
function RentaReport({ assets, agg, periodLabel, onClose }) {
  const anio = Number((/^Año (\d{4})$/.exec(periodLabel || "") || [])[1]) || null;
  const rows = assets.map((a) => {
    const ingreso = agg.byAssetIncome.get(a.name) || 0;
    const gasto = agg.byAsset.get(a.name) || 0;
    const cats = [...(agg.byAssetCat.get(a.name) || new Map()).entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    // La cuota del préstamo se muestra pero no se resta: el capital no es gasto deducible.
    const cuota = cats.filter(([c]) => RENTA_CONCEPTO[c] === RENTA_CUOTA).reduce((t, [, v]) => t + v, 0);
    const conceptos = rentaConceptos(cats);
    const reparacion = conceptos.find(([ap]) => ap === "Reparación y conservación")?.[1].total || 0;
    const calc = anio && a.uso === "alquiler" ? calcRentaInmueble({ ingreso, gastoDeducible: gasto - cuota, reparacion, fiscal: a.fiscal || {}, anio }) : null;
    return { a, ingreso, gasto, cuota, neto: ingreso - (gasto - cuota), cats, conceptos, calc };
  });
  const alquiler = rows.filter((r) => r.a.uso === "alquiler");
  const anual = /^Año \d{4}$/.test(periodLabel || "");
  const vivienda = rows.filter((r) => r.a.uso === "vivienda");
  const segunda = rows.filter((r) => r.a.uso === "segunda");
  const totIng = alquiler.reduce((s, r) => s + r.ingreso, 0);
  const totGas = alquiler.reduce((s, r) => s + r.gasto - r.cuota, 0); // sin la cuota del préstamo (capital)

  // CSV para Excel (punto y coma, coma decimal, BOM): una fila por apartado de Renta Web, más
  // los datos que la app no puede saber y Renta Web te va a pedir igualmente.
  const exportar = () => {
    const num = (v) => r2(v).toFixed(2).replace(".", ",");
    // Una celda que empieza por = + - @ la ejecuta Excel como fórmula: un nombre de inmueble como
    // «=HYPERLINK(…)» (o uno llegado en una copia ajena) se ejecutaría al abrir el archivo.
    // Los importes van sin tocar (un negativo como «-12,50» lleva «-» legítimo).
    const esc = (v) => {
      let t = String(v);
      if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(,\d+)?$/.test(t)) t = "'" + t;
      return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = [["Periodo", "Inmueble", "Apartado de Renta Web", "Importe (€)", "Origen en la app", "Qué revisar"]];
    for (const r of segunda) {
      const im = anio ? calcImputacion({ fiscal: r.a.fiscal || {}, anio }) : null;
      filas.push([periodLabel, r.a.name, "Imputación de rentas inmobiliarias", im && !im.falta ? num(im.imputacion) : "", "Inmueble sin alquilar", im?.falta ? "Completar: valor catastral en la ficha fiscal" : ""]);
    }
    for (const r of alquiler) {
      const f = (ap, imp, orig = "", rev = "") => filas.push([periodLabel, r.a.name, ap, imp, orig, rev]);
      const fi = r.a.fiscal || {}, c = r.calc;
      f("Referencia catastral", fi.refCatastral || "", "", fi.refCatastral ? "" : "Completar: está en el recibo del IBI");
      f("Porcentaje de titularidad", fi.titularidad != null ? num(fi.titularidad) : "", "", fi.titularidad != null ? "" : "Completar: si es a medias, cada titular declara su parte");
      f("Días arrendado en el año", fi.diasArrendado != null ? String(fi.diasArrendado) : "", "", fi.diasArrendado != null ? "" : "Completar: los gastos de días sin alquilar no son deducibles");
      f("NIF del inquilino y fecha del contrato", "", "", "Completar: la fecha decide la reducción (50-90 % en contratos desde el 26/05/2023; 60 % antes)");
      f("Ingresos íntegros", num(r.ingreso), "Ingresos asignados al inmueble");
      for (const [ap, e] of r.conceptos) f(ap, num(e.total), e.cats.join(", "), RENTA_REVISAR[ap] || "");
      if (c && c.amortizacion != null) f("Amortización del inmueble", num(c.amortizacion), "3 % × mayor(coste, valor catastral) × % construcción × días");
      else f("Amortización del inmueble", "", "", "Completar: 3 % del mayor entre precio de compra (con gastos) y valor catastral, solo la construcción, sin el suelo (o rellena la ficha fiscal del activo)");
      if (r.cuota > 0 && !(c && fi.intereses?.[anio] != null)) f("Intereses y gastos de financiación (de la cuota)", "", "", `Completar: solo los intereses de los ${num(r.cuota)} € de cuotas; el capital no se deduce`);
      if (c && !c.faltan.length) {
        f("Intereses + reparación deducibles (con límite)", num(c.interesesYReparacion), "", c.exceso > 0 ? `Exceso de ${num(c.exceso)} €: se arrastra a los 4 años siguientes` : "");
        f("Rendimiento neto", num(c.neto), "Calculado con la ficha fiscal");
        f(`Reducción (${c.pctReduccion} %)`, num(c.reduccion));
        f("Rendimiento neto reducido", num(c.netoReducido));
        if (c.titularidad !== 100) f(`Tu parte (${num(c.titularidad)} %)`, num(c.tuParte));
        if (c.imputacion > 0) f("Imputación de rentas (días sin alquilar)", num(c.imputacion));
      } else {
        f(r.cuota > 0 ? "Rendimiento neto (sin la cuota ni la amortización; resta los intereses)" : "Rendimiento neto (antes de amortización y reducción)", num(r.neto), "", c?.faltan.length ? "Falta en la ficha fiscal: " + c.faltan.join(", ") : "");
      }
    }
    try {
      const csv = "\ufeff" + filas.map((l) => l.map(esc).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `renta-inmuebles-${(periodLabel || "").replace(/[^\w-]+/g, "_")}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* noop */ }
  };

  return (
    <Modal title="Informe por inmueble" subtitle={periodLabel} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-md text-xs text-slate-500">Rendimiento de cada inmueble <span className="font-medium">en el periodo seleccionado</span>. Elige un año arriba para el informe anual de la renta.</p>
          <Btn kind="primary" onClick={exportar} disabled={!alquiler.length && !segunda.length}><Download size={14} /> Exportar para la renta</Btn>
        </div>
        {!anual && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: C.warnSoft, color: C.warn }}>
            La renta se declara por año natural y ahora tienes elegido «{periodLabel}». Elige arriba un año completo antes de exportar.
          </p>
        )}

        {alquiler.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">
            Ningún activo marcado como <span className="font-medium">«En alquiler»</span>. Edita tus inmuebles (icono ✏️) y pon su uso para que aparezcan aquí.
          </Card>
        ) : alquiler.map(({ a, ingreso, gasto, neto, conceptos, calc }) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold"><span className="mr-1.5">{a.emoji}</span>{a.name}</h3>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.accentSoft, color: C.accent }}>🔑 En alquiler</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Alquiler cobrado</div><div className="text-lg font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(ingreso)}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div><div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(gasto)}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div><div className="text-lg font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</div></div>
            </div>
            {calc && (
              <div className="mt-3 rounded-lg p-2.5 text-xs" style={{ background: C.surfaceAlt }}>
                <div className="mb-1 font-semibold text-slate-700">Cálculo para la renta {anio}</div>
                {calc.faltan.length > 0 ? (
                  <p style={{ color: C.warn }}>Para calcularlo, completa en la ficha fiscal del activo (✏️): {calc.faltan.join(", ")}.</p>
                ) : (
                  <div className="space-y-0.5" style={tnum}>
                    {[["Ingresos íntegros", calc.ingreso], [`Gastos (${calc.dias} de ${calc.diasAnio} días alquilado)`, -calc.gastos], ["Intereses + reparación (con límite)", -calc.interesesYReparacion], ["Amortización", -calc.amortizacion], ["Rendimiento neto", calc.neto], [`Reducción ${calc.pctReduccion} %`, -calc.reduccion], ["Rendimiento neto reducido", calc.netoReducido], ...(calc.titularidad !== 100 ? [[`Tu parte (${calc.titularidad} %)`, calc.tuParte]] : []), ...(calc.imputacion > 0 ? [["Imputación por días sin alquilar", calc.imputacion]] : [])].map(([l, v]) => (
                      <div key={l} className="flex justify-between gap-2"><span className="text-slate-600">{l}</span><span className="font-medium text-slate-700">{fmtE0(v)}</span></div>
                    ))}
                    {calc.exceso > 0 && <p className="pt-1" style={{ color: C.warn }}>Intereses y reparación superan los ingresos en {fmtE0(calc.exceso)}: ese exceso se deduce en los 4 años siguientes.</p>}
                  </div>
                )}
              </div>
            )}
            {conceptos.length > 0 && (
              <div className="mt-3 border-t pt-2" style={{ borderColor: C.line }}>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Gastos por apartado de Renta Web</div>
                <div className="space-y-1.5">
                  {conceptos.map(([ap, e]) => (
                    <div key={ap} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{ap}</span>
                        <span className="shrink-0 font-medium text-slate-600" style={tnum}>{fmtE0(e.total)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{e.cats.join(" · ")}{RENTA_REVISAR[ap] ? ` — ${RENTA_REVISAR[ap]}` : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}

        {alquiler.length > 1 && (
          <Card className="p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total alquileres</span>
              <span style={{ ...tnum, color: totIng - totGas >= 0 ? C.income : C.expense }}>{totIng - totGas >= 0 ? "+" : ""}{fmtE0(totIng - totGas)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500" style={tnum}>Ingresos {fmtE0(totIng)} · Gastos {fmtE0(totGas)}</div>
          </Card>
        )}

        {anio && segunda.map(({ a }) => {
          const im = calcImputacion({ fiscal: a.fiscal || {}, anio });
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold"><span className="mr-1.5">{a.emoji}</span>{a.name}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">🏖️ Sin alquilar</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{im.falta ? <span style={{ color: C.warn }}>Pon el valor catastral en su ficha fiscal (✏️) para calcular la imputación de rentas.</span> : <>Imputación de rentas {anio}: <strong style={tnum}>{fmtE0(im.imputacion)}</strong> (se suma a tu base general).</>}</p>
            </Card>
          );
        })}

        {vivienda.map(({ a, gasto }) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold"><span className="mr-1.5">{a.emoji}</span>{a.name}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">🏠 Vivienda habitual</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Gastos del periodo: <span className="font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(gasto)}</span>. No genera rendimiento de alquiler.</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">La hipoteca de la vivienda habitual solo desgrava por el <span className="font-medium">régimen transitorio</span> (compra anterior a 2013 y deducción ya aplicada). Compruébalo con tu gestor.</p>
          </Card>
        ))}

        <p className="text-[11px] leading-relaxed text-slate-400">Cifras orientativas a partir de tus movimientos del periodo. El archivo exportado añade lo que Renta Web te pedirá y la app no sabe (referencia catastral, días alquilado, amortización, reducción). No sustituye al asesoramiento fiscal.</p>
      </div>
    </Modal>
  );
}

function ActivosTab({ assets, setAssets, agg, rentaAgg, allAgg, onDrill, periodLabel, onRenameAsset, onDeleteAsset }) {
  const [report, setReport] = useState(false);
  useBackClose(report, () => setReport(false));
  const [editing, setEditing] = useState(null);
  useBackClose(!!editing, () => setEditing(null));
  const save = (data) => {
    if (editing === "new") setAssets((as) => [...as, { id: "a" + Date.now(), ...data }]);
    else {
      if (data.name !== editing.name) onRenameAsset?.(editing.name, data.name);
      setAssets((as) => as.map((a) => (a.id === editing.id ? { ...a, ...data } : a)));
    }
    setEditing(null);
  };
  // Resumen por activo en el PERIODO (real, no proyectado), para el vistazo rápido.
  // La rentabilidad, en cambio, es anual y sobre el valor: la misma neta proyectada que enseña
  // la tarjeta de cada activo, para que tabla y tarjeta no digan cosas distintas.
  // Anualizado con el periodo DEL ACTIVO (de su primer a su último movimiento), no con el de
  // todos tus datos: un piso alquilado hace 6 meses, con 3 años de extractos, salía ~6 veces bajo.
  const factorDe = (a) => {
    const rg = allAgg.byAssetRange?.get(a.name);
    return rg ? 12 / Math.max(1, monthsCoveredOf(rg[0], rg[1])) : allAgg.annualFactor;
  };
  const resumen = assets.map((a) => {
    const gasto = agg.byAsset.get(a.name) || 0;
    const ingreso = agg.byAssetIncome.get(a.name) || 0;
    const netoAnual = ((allAgg.byAssetIncome.get(a.name) || 0) - (allAgg.byAsset.get(a.name) || 0)) * factorDe(a);
    return { a, gasto, ingreso, neto: ingreso - gasto, netoAnual, rent: a.value ? netoAnual / a.value : null };
  }).sort((x, y) => y.neto - x.neto);
  const totIng = resumen.reduce((s, r) => s + r.ingreso, 0);
  const totGas = resumen.reduce((s, r) => s + r.gasto, 0);
  const valorados = resumen.filter((r) => r.a.value);
  const totValor = valorados.reduce((s, r) => s + r.a.value, 0);
  const totRent = totValor ? valorados.reduce((s, r) => s + r.netoAnual, 0) / totValor : null;

  // Selección de activos para ver su subtotal («todos los alquileres», «todos los vehículos»…).
  // Se recalcula sola al cambiar el periodo o los datos, y se recuerda en este navegador.
  const [sel, setSelRaw] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem("finz:activos-sel") || "[]")); } catch { return new Set(); } });
  const setSel = (next) => { setSelRaw(next); try { localStorage.setItem("finz:activos-sel", JSON.stringify([...next])); } catch { /* sin almacenamiento */ } };
  const toggleSel = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const atajos = [
    ...(assets.some((a) => a.uso === "alquiler") ? [{ l: "🔑 Alquileres", ids: assets.filter((a) => a.uso === "alquiler").map((a) => a.id) }] : []),
    ...TIPOS_ACTIVO.map((t) => ({ l: t.l, ids: assets.filter((a) => tipoActivo(a) === t.v).map((a) => a.id) })).filter((x) => x.ids.length),
  ];
  const mismo = (ids) => ids.length === sel.size && ids.every((id) => sel.has(id));
  const elegidos = resumen.filter((r) => sel.has(r.a.id));
  const sub = elegidos.length ? (() => {
    const ing = elegidos.reduce((t, r) => t + r.ingreso, 0), gas = elegidos.reduce((t, r) => t + r.gasto, 0);
    const conValor = elegidos.filter((r) => r.a.value);
    const valor = conValor.reduce((t, r) => t + r.a.value, 0);
    return { n: elegidos.length, ing, gas, neto: ing - gas, netoAnual: elegidos.reduce((t, r) => t + r.netoAnual, 0), valor, rent: valor ? conValor.reduce((t, r) => t + r.netoAnual, 0) / valor : null, sinValor: elegidos.length - conValor.length };
  })() : null;

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Un activo agrupa lo que ingresa y cuesta algo tuyo (un piso en alquiler, el coche, la mascota…). Abajo, el detalle y la proyección anual de cada uno.</p>
        <div className="flex flex-wrap items-center gap-2">
          {assets.some((a) => a.uso === "alquiler" || a.uso === "segunda") && <Btn onClick={() => setReport(true)}><FileText size={15} /> Informe por inmueble</Btn>}
          <Btn kind="primary" onClick={() => setEditing("new")}><Plus size={15} /> Nuevo activo</Btn>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card className="p-10 text-center"><Car size={28} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Aún no tienes activos. Crea uno (por ejemplo «Coche») y elige qué categorías agrupa.</p></Card>
      ) : (<>
        {/* Atajos de selección y subtotal de lo seleccionado. */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Seleccionar activos">
          <span className="text-xs text-slate-500">Sumar:</span>
          {atajos.map((x) => (
            <button key={x.l} type="button" onClick={() => setSel(mismo(x.ids) ? new Set() : new Set(x.ids))} aria-pressed={mismo(x.ids)}
              className="rounded-full border px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={mismo(x.ids) ? { background: C.accent, color: "#fff", borderColor: C.accent } : { borderColor: C.line, color: C.ink }}>
              {x.l} <span className="opacity-70">{x.ids.length}</span>
            </button>
          ))}
          {sel.size > 0 && <button type="button" onClick={() => setSel(new Set())} className="px-1.5 text-xs text-slate-500 hover:underline">Quitar selección</button>}
        </div>
        {sub && (
          <Card className="p-3" style={{ borderColor: C.accent }}>
            <div className="mb-1.5 text-xs font-semibold text-slate-700">{sub.n === 1 ? "1 activo seleccionado" : `${sub.n} activos seleccionados`} <span className="font-normal text-slate-500">· {periodLabel}</span></div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4" style={tnum}>
              <div><div className="text-[11px] text-slate-500">Ingresos</div><div className="font-semibold" style={{ color: C.income }}>{fmtE0(sub.ing)}</div></div>
              <div><div className="text-[11px] text-slate-500">Gastos</div><div className="font-semibold" style={{ color: C.expense }}>{fmtE0(sub.gas)}</div></div>
              <div><div className="text-[11px] text-slate-500">Neto del periodo</div><div className="font-semibold" style={{ color: sub.neto >= 0 ? C.income : C.expense }}>{sub.neto >= 0 ? "+" : ""}{fmtE0(sub.neto)}</div></div>
              <div><div className="text-[11px] text-slate-500">Neto al año (estimado)</div><div className="font-semibold" style={{ color: sub.netoAnual >= 0 ? C.income : C.expense }}>{sub.netoAnual >= 0 ? "+" : ""}{fmtE0(sub.netoAnual)}</div></div>
              {sub.valor > 0 && <div><div className="text-[11px] text-slate-500">Valor</div><div className="font-semibold">{fmtE0(sub.valor)}</div></div>}
              {sub.rent != null && <div><div className="text-[11px] text-slate-500">Rent. neta/año</div><div className="font-semibold" style={{ color: sub.rent >= 0 ? C.income : C.expense }}>{fmtPct(sub.rent)}</div></div>}
            </div>
            {sub.sinValor > 0 && sub.valor > 0 && <p className="mt-1.5 text-[11px] text-slate-500">La rentabilidad solo incluye los que tienen valor ({sub.n - sub.sinValor} de {sub.n}).</p>}
          </Card>
        )}

        {/* Tabla resumen: todos los activos de un vistazo, ingresos y gastos por separado.
            Cada celda de importe lleva a sus movimientos (por signo). */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-400" style={{ borderColor: C.line }}>
                  <th className="w-8 py-2 pl-3"><input type="checkbox" className="accent-blue-600" aria-label="Seleccionar todos" checked={sel.size > 0 && assets.every((a) => sel.has(a.id))} onChange={(e) => setSel(e.target.checked ? new Set(assets.map((a) => a.id)) : new Set())} /></th>
                  <th className="px-3 py-2 text-left font-medium">Activo</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                  <th className="px-3 py-2 text-right font-medium">Gastos</th>
                  <th className="px-3 py-2 text-right font-medium">Neto</th>
                  <th className="px-3 py-2 text-right font-medium" title="Rendimiento neto anual sobre el valor del activo">Rent. neta/año</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map(({ a, gasto, ingreso, neto, rent }) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: C.line, ...(sel.has(a.id) ? { background: C.accentSoft } : {}) }}>
                    <td className="py-2 pl-3"><input type="checkbox" className="accent-blue-600" aria-label={`Seleccionar ${a.name}`} checked={sel.has(a.id)} onChange={() => toggleSel(a.id)} /></td>
                    <td className="px-3 py-2"><button type="button" onClick={() => setEditing(a)} className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" title="Ver / editar este activo"><span className="mr-1.5">{a.emoji}</span>{a.name}</button></td>
                    <td className="px-3 py-2 text-right" style={tnum}>
                      {ingreso > 0
                        ? <button type="button" onClick={() => onDrill({ type: "asset", key: a.name, sign: "in", label: `${a.emoji} ${a.name} · ingresos` })} className="font-medium hover:underline" style={{ color: C.income }}>{fmtE0(ingreso)}</button>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-3 py-2 text-right" style={tnum}>
                      {gasto > 0
                        ? <button type="button" onClick={() => onDrill({ type: "asset", key: a.name, sign: "out", label: `${a.emoji} ${a.name} · gastos` })} className="font-medium hover:underline" style={{ color: C.expense }}>{fmtE0(gasto)}</button>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</td>
                    <td className="px-3 py-2 text-right" style={tnum}>
                      {rent == null
                        ? <button type="button" onClick={() => setEditing(a)} className="text-[11px] text-slate-400 hover:underline" title="Pon su valoración para calcular la rentabilidad">sin valor</button>
                        : <span className="font-medium" style={{ color: rent >= 0 ? C.income : C.expense }}>{fmtPct(rent)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {sub && sub.n < assets.length && (
                  <tr className="border-t font-semibold" style={{ borderColor: C.lineStrong, background: C.accentSoft }}>
                    <td />
                    <td className="px-3 py-2 text-left" style={{ color: C.accent }}>Seleccionados ({sub.n})</td>
                    <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.income }}>{fmtE0(sub.ing)}</td>
                    <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.expense }}>{fmtE0(sub.gas)}</td>
                    <td className="px-3 py-2 text-right" style={{ ...tnum, color: sub.neto >= 0 ? C.income : C.expense }}>{sub.neto >= 0 ? "+" : ""}{fmtE0(sub.neto)}</td>
                    <td className="px-3 py-2 text-right" style={tnum}>{sub.rent == null ? <span className="text-slate-300">–</span> : <span style={{ color: sub.rent >= 0 ? C.income : C.expense }}>{fmtPct(sub.rent)}</span>}</td>
                  </tr>
                )}
                <tr className="border-t font-semibold" style={{ borderColor: C.lineStrong }}>
                  <td />
                  <td className="px-3 py-2 text-left text-slate-500">Total</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.income }}>{fmtE0(totIng)}</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.expense }}>{fmtE0(totGas)}</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: totIng - totGas >= 0 ? C.income : C.expense }}>{totIng - totGas >= 0 ? "+" : ""}{fmtE0(totIng - totGas)}</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: (totRent || 0) >= 0 ? C.income : C.expense }}>{totRent == null ? <span className="text-slate-300">–</span> : fmtPct(totRent)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="border-t px-3 py-1.5 text-[11px] text-slate-400" style={{ borderColor: C.line }}>Importes del periodo seleccionado; la rentabilidad, anual sobre el valor del activo. Toca un importe para ver sus movimientos.</div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {assets.map((a) => {
            const real = agg.byAsset.get(a.name) || 0;
            const full = allAgg.byAsset.get(a.name) || 0;
            const factorA = factorDe(a);
            const proj = full * factorA;
            const incomeFull = allAgg.byAssetIncome.get(a.name) || 0;
            const incomeProj = incomeFull * factorA;
            const ingresoReal = agg.byAssetIncome.get(a.name) || 0;
            const netoReal = ingresoReal - real;
            const netProj = incomeProj - proj;
            // Composición del gasto del PERIODO (coherente con las cifras de arriba),
            // no el histórico anualizado: cada categoría como parte del 100% del gasto.
            const desglose = [...(agg.byAssetCat.get(a.name) || new Map()).entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
            const maxIG = Math.max(ingresoReal, real, 1);
            const grossYield = a.value ? incomeProj / a.value : null;
            const netYield = a.value ? netProj / a.value : null;
            const costPct = a.value ? proj / a.value : null;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5"><span className="text-2xl">{a.emoji}</span><div><h3 className="font-semibold">{a.name}</h3><p className="text-xs text-slate-400">{a.categories.length ? a.categories.join(" · ") : "Solo movimientos asignados a mano"}</p></div></div>
                  <button type="button" onClick={() => setEditing(a)} aria-label={`Editar ${a.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>
                </div>

                {/* Lo primero y en grande: lo que entra y lo que sale en el periodo. */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos actuales</div>
                    <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: ingresoReal > 0 ? C.income : C.faint }}>{fmtE0(ingresoReal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos actuales</div>
                    <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: real > 0 ? C.expense : C.faint }}>{fmtE0(real)}</div>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">Neto del periodo: <span className="font-semibold" style={{ ...tnum, color: netoReal >= 0 ? C.income : C.expense }}>{netoReal >= 0 ? "+" : ""}{fmtE0(netoReal)}</span></div>

                {a.value != null && (
                  <div className="mt-4 rounded-xl p-3" style={{ background: C.accentSoft }}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor actual</span>
                      <span className="text-lg font-semibold" style={{ ...tnum, color: C.accent }}>{fmtE0(a.value)}</span>
                    </div>
                    {incomeProj > 0 ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg p-2" style={{ background: C.surface }}>
                          <div className="text-[10px] font-medium uppercase text-slate-400">Rent. bruta</div>
                          <div className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtPct(grossYield)}</div>
                          <div className="text-[10px] text-slate-400" style={tnum}>{fmtE0(incomeProj)}/año</div>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: C.surface }}>
                          <div className="text-[10px] font-medium uppercase text-slate-400">Rent. neta</div>
                          <div className="text-sm font-semibold" style={{ ...tnum, color: netYield >= 0 ? C.income : C.expense }}>{fmtPct(netYield)}</div>
                          <div className="text-[10px] text-slate-400" style={tnum}>{fmtE0(netProj)}/año</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-slate-500" style={tnum}>Cuesta mantenerlo <span className="font-semibold" style={{ color: C.expense }}>{fmtPct(costPct)}</span> de su valor al año ({fmtE0(proj)}/año)</div>
                    )}
                  </div>
                )}
                {/* Ingresos vs gastos del periodo, en barra, para compararlos de un vistazo. */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-slate-500">Ingresos</span>
                    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(ingresoReal / maxIG) * 100}%`, background: C.income }} /></span>
                    <span className="w-16 shrink-0 text-right font-medium" style={{ ...tnum, color: ingresoReal > 0 ? C.income : C.faint }}>{fmtE0(ingresoReal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-slate-500">Gastos</span>
                    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(real / maxIG) * 100}%`, background: C.expense }} /></span>
                    <span className="w-16 shrink-0 text-right font-medium" style={{ ...tnum, color: real > 0 ? C.expense : C.faint }}>{fmtE0(real)}</span>
                  </div>
                </div>

                {/* Composición del 100 % del gasto: una barra apilada por categoría + leyenda
                    con importe y % (comunidad, impuestos…). Sustituye a la barra incremental. */}
                {desglose.length > 0 && real > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Cómo se compone el gasto</div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="Composición del gasto por categoría">
                      {desglose.map(([cat, v]) => <div key={cat} style={{ width: `${(v / real) * 100}%`, background: catColor(cat) }} title={`${cat}: ${fmtE0(v)} (${Math.round((v / real) * 100)} %)`} />)}
                    </div>
                    <div className="mt-2 space-y-1">
                      {desglose.slice(0, 6).map(([cat, v]) => (
                        <div key={cat} className="flex items-center gap-2 text-xs">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(cat) }} />
                          <span className="min-w-0 flex-1 truncate text-slate-600">{cat}</span>
                          <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / real) * 100)} %</span>
                          <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                        </div>
                      ))}
                      {desglose.length > 6 && <div className="pl-4 text-[11px] text-slate-400">y {desglose.length - 6} categorías más</div>}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {incomeProj > 0 && <Btn size="sm" onClick={() => onDrill({ type: "asset", key: a.name, sign: "in", label: `${a.emoji} ${a.name} · ingresos` })}><ArrowUpRight size={13} /> Ingresos</Btn>}
                  {real > 0 && <Btn size="sm" onClick={() => onDrill({ type: "asset", key: a.name, sign: "out", label: `${a.emoji} ${a.name} · gastos` })}><ArrowDownRight size={13} /> Gastos</Btn>}
                  <Btn size="sm" kind="subtle" onClick={() => onDrill({ type: "asset", key: a.name, label: `${a.emoji} ${a.name}` })}>Todo <ChevronRight size={13} /></Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </>)}
      {editing && <AssetModal asset={editing === "new" ? null : editing} allAssets={assets} onClose={() => setEditing(null)} onSave={save} onDelete={() => { if (onDeleteAsset ? onDeleteAsset(editing) : true) setEditing(null); }} />}
      {report && <RentaReport assets={assets} agg={rentaAgg || agg} periodLabel={periodLabel} onClose={() => setReport(false)} />}
    </div>
  );
}

/* ============================================================
   PESTAÑA GRUPOS DE GASTO
   ============================================================ */
function GroupModal({ group, movsAll, onSave, onDelete, onClose }) {
  const [name, setName] = useState(group?.name || "");
  const [emoji, setEmoji] = useState(group?.emoji || "🏷️");
  const [color, setColor] = useState(group?.color || GROUP_COLORS[0]);
  const [keywords, setKeywords] = useState(group?.keywords || []);
  const [kwInput, setKwInput] = useState("");
  const draft = { ...group, name, emoji, color, keywords, movementIds: group?.movementIds || [], excludedIds: group?.excludedIds || [] };
  const matched = useMemo(() => movsAll.filter((m) => m.amount < 0 && movInGroup(m, draft)), [movsAll, name, keywords, color]);
  const matchedTotal = matched.reduce((s, m) => s - m.amount, 0);
  const addKw = () => { const v = kwInput.trim().toUpperCase(); if (v && !keywords.includes(v)) setKeywords([...keywords, v]); setKwInput(""); };
  return (
    <Modal title={group ? "Editar etiqueta" : "Nueva etiqueta"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium text-slate-600">Icono</label>
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 block rounded-lg border bg-white px-2 py-1.5 text-lg" style={{ borderColor: C.line }}>{[emoji, ...GROUP_EMOJI.filter((x) => x !== emoji)].map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="min-w-[160px] flex-1"><label className="text-xs font-medium text-slate-600">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maratones, Vacaciones verano, Boda…" className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} /></div>
          <div><label className="text-xs font-medium text-slate-600">Color</label>
            <div className="mt-1.5 flex gap-1.5">{GROUP_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 scale-110" : ""}`} style={{ background: c }} aria-label="color" />)}</div></div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Palabras clave (asignación automática)</div>
          <p className="mb-2 mt-0.5 text-xs text-slate-400">Cualquier movimiento cuyo concepto contenga una de estas palabras lleva la etiqueta. Útil para «pádel», «maratón»… Y además puedes añadir movimientos sueltos a mano desde cualquier gráfico.</p>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border p-2" style={{ borderColor: C.line }}>
            {keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{k}<button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="text-slate-400 hover:text-slate-700"><X size={11} /></button></span>
            ))}
            <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }} placeholder="Escribe y pulsa Enter" className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none" />
          </div>
        </div>
        <Card className="bg-slate-50 p-3" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Coinciden ahora</span><span className="font-semibold" style={tnum}>{matched.length} movimientos · {fmtE0(matchedTotal)}</span></div>
          {matched.length > 0 && <div className="mt-2 max-h-28 space-y-0.5 overflow-y-auto">{matched.slice(0, 8).map((m) => <div key={m.id} className="flex justify-between text-xs text-slate-500" style={tnum}><span className="truncate pr-2">{m.concept}</span><span>{fmtE0(-m.amount)}</span></div>)}{matched.length > 8 && <div className="text-xs text-slate-400">y {matched.length - 8} más…</div>}</div>}
        </Card>
        <div className="flex justify-between gap-2">
          {group ? <Btn kind="danger" onClick={onDelete}><Trash2 size={14} /> Eliminar</Btn> : <span />}
          <div className="flex gap-2"><Btn onClick={onClose}>Cancelar</Btn><Btn kind="primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), emoji, color, keywords })}>Guardar</Btn></div>
        </div>
      </div>
    </Modal>
  );
}

function GruposTab({ groups, setGroups, groupStats, allGroupStats, movsAll, annualFactor, mesesData, onDrill }) {
  const [editing, setEditing] = useState(null);
  useBackClose(!!editing, () => setEditing(null));
  const save = (data) => {
    if (editing === "new") setGroups((gs) => [...gs, { id: "g" + Date.now(), movementIds: [], excludedIds: [], ...data }]);
    else setGroups((gs) => gs.map((g) => (g.id === editing.id ? { ...g, ...data } : g)));
    setEditing(null);
  };
  const ordered = [...groups].sort((a, b) => (allGroupStats.get(b.id)?.total || 0) - (allGroupStats.get(a.id)?.total || 0));
  // Desglose por apodo dentro de cada etiqueta: el apodo agrupa (varios "Impuestos"
  // suman) y así vemos qué % de una etiqueta como «Herencia» es realmente impuestos.
  const notesByGroup = useMemo(() => {
    const res = new Map();
    for (const g of groups) {
      const agg = new Map(); let total = 0;
      for (const m of movsAll) {
        if (m.amount >= 0 || !movInGroup(m, g)) continue;
        const v = -m.amount; total += v;
        const key = m.note || null;
        agg.set(key, (agg.get(key) || 0) + v);
      }
      const entries = [...agg.entries()].sort((a, b) => b[1] - a[1]);
      res.set(g.id, { total, entries, hasNotes: entries.some(([k]) => k) });
    }
    return res;
  }, [groups, movsAll]);
  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Una etiqueta reúne gastos sueltos de <strong>varias categorías</strong> bajo un tema: tu pádel (pistas + ropa + hoteles), un maratón, unas vacaciones… Se asigna por palabra clave, a mano desde cualquier gráfico, o pidiéndoselo al asistente.</p>
        <Btn kind="primary" onClick={() => setEditing("new")}><Plus size={15} /> Nueva etiqueta</Btn>
      </div>
      {groups.length === 0 ? (
        <Card className="p-10 text-center"><Tag size={28} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Crea tu primera etiqueta. Por ejemplo «Pádel» con las palabras clave <span className="font-medium">pádel</span> y <span className="font-medium">pista</span>, o pídesela al asistente.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ordered.map((g) => {
            const sp = groupStats.get(g.id) || { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map() };
            const all = allGroupStats.get(g.id) || { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map(), byYear: new Map() };
            const neto = sp.ingreso - sp.gasto;
            const desglose = [...all.byCat.entries()].sort((a, b) => b[1] - a[1]);
            const maxD = desglose[0]?.[1] || 1;
            const years = [...all.byYear.entries()].sort();
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="h-1.5" style={{ background: g.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5"><span className="text-2xl">{g.emoji}</span><div><h3 className="font-semibold">{g.name}</h3><p className="text-xs text-slate-400">{all.count} movimientos en total{g.keywords?.length ? ` · ${g.keywords.length} palabra${g.keywords.length > 1 ? "s" : ""} clave` : ""}</p></div></div>
                    <button type="button" onClick={() => setEditing(g)} aria-label={`Editar ${g.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex gap-5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos</div>
                        <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: sp.ingreso > 0 ? C.income : C.faint }}>{fmtE0(sp.ingreso)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div>
                        <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: sp.gasto > 0 ? C.expense : C.faint }}>{fmtE0(sp.gasto)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div>
                      <div className="text-base font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</div>
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{sp.count} mov. en el periodo</div>
                  {desglose.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Desglose por categoría (histórico)</div>
                      {desglose.slice(0, 5).map(([cat, v]) => (
                        <div key={cat} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate text-slate-600">{cat}</span>
                          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(v / maxD) * 100}%`, background: catColor(cat) }} /></span>
                          <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const nb = notesByGroup.get(g.id);
                    if (!nb || !nb.hasNotes || nb.total <= 0) return null;
                    return (
                      <div className="mt-4 space-y-1.5">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Desglose por apodo</div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Composición por apodo">
                          {nb.entries.map(([k, v], i) => <div key={k ?? "_"} style={{ width: `${(v / nb.total) * 100}%`, background: k ? GROUP_COLORS[i % GROUP_COLORS.length] : C.faint }} title={`${k || "sin apodo"}: ${fmtE0(v)} (${Math.round((v / nb.total) * 100)} %)`} />)}
                        </div>
                        {nb.entries.slice(0, 6).map(([k, v], i) => (
                          <div key={k ?? "_"} className="flex items-center gap-2 text-xs">
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: k ? GROUP_COLORS[i % GROUP_COLORS.length] : C.faint }} />
                            <span className="min-w-0 flex-1 truncate text-slate-600">{k || <span className="text-slate-400">sin apodo</span>}</span>
                            <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / nb.total) * 100)} %</span>
                            <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {years.length > 1 && <div className="mt-3 flex flex-wrap gap-2 text-xs">{years.map(([y, v]) => <span key={y} className="rounded-md bg-slate-100 px-2 py-1" style={tnum}>{y}: <span className="font-medium">{fmtE0(v)}</span></span>)}</div>}
                  <div className="mt-4"><Btn onClick={() => onDrill({ type: "group", key: g.id, label: `${g.emoji} ${g.name}` })}>Ver y editar movimientos <ChevronRight size={14} /></Btn></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <GroupModal group={editing === "new" ? null : editing} movsAll={movsAll} onClose={() => setEditing(null)} onSave={save} onDelete={() => { setGroups((gs) => gs.filter((g) => g.id !== editing.id)); setEditing(null); }} />}
    </div>
  );
}

export {
  CampoFicha,
  AssetModal,
  RentaReport,
  ActivosTab,
  GroupModal,
  GruposTab,
};
