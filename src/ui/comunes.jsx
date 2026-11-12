import { C, EMOJI_CHOICES, GASTO_SORTED, INGRESO_SORTED, TRANSFER_SORTED, fmtE, fmtPct, lockBodyScroll, overlayStack, tnum, tryHistory, unlockBodyScroll } from "../core.js";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Minus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ============================================================
   ÁTOMOS DE INTERFAZ
   ============================================================ */
function Btn({ children, onClick, kind = "ghost", size = "md", disabled, className = "", title, active }) {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const base = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${sz}`;
  const kinds = {
    primary: "text-white shadow-sm hover:shadow",
    ghost: "border hover:bg-slate-50 active:bg-slate-100",
    subtle: "hover:bg-slate-100 text-slate-600",
    danger: "border border-rose-200 text-rose-700 hover:bg-rose-50",
  };
  const style = kind === "primary" ? { background: C.accent } : kind === "ghost" ? { borderColor: active ? C.accent : C.line, color: active ? C.accent : C.ink2, background: active ? C.accentSoft : undefined } : {};
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={style} className={`${base} ${kinds[kind]} ${className}`}>
      {children}
    </button>
  );
}
function Card({ children, className = "", style, pad = true }) {
  return <div className={`rounded-2xl border bg-white ${pad ? "" : ""} ${className}`} style={{ borderColor: C.line, boxShadow: "0 1px 2px rgba(16,16,20,.04)", ...style }}>{children}</div>;
}

function Modal({ title, subtitle, onClose, children, wide, footer }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", h);
    lockBodyScroll();
    return () => { window.removeEventListener("keydown", h); unlockBodyScroll(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div className={`relative flex w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl anim-sheet`}>
        <div className="flex shrink-0 items-center gap-2 border-b bg-white px-3 py-2.5 sm:px-5 sm:py-3" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">{children}</div>
        <div className="shrink-0 border-t bg-white px-5 py-3" style={{ borderColor: C.line, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          {footer || <Btn onClick={onClose} className="w-full justify-center sm:w-auto">Cerrar</Btn>}
        </div>
      </div>
    </div>
  );
}
function Seg({ options, value, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex shrink-0 rounded-lg border p-0.5" style={{ borderColor: C.line, background: C.bg }}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value === o.v ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
function MultiSelect({ label, options, groups, selected, onChange, icon, className = "" }) {
  const [open, setOpen] = useState(false);
  const n = selected.size;
  const toggle = (o, checked) => { const s = new Set(selected); checked ? s.add(o) : s.delete(o); onChange(s); };
  const Item = (o) => (
    <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
      <input type="checkbox" className="accent-blue-600" checked={selected.has(o)} onChange={(e) => toggle(o, e.target.checked)} />
      <span className="truncate">{o}</span>
    </label>
  );
  // `groups` = [{label, items}] pinta cabeceras (gasto/ingreso/transferencia); si no, lista plana.
  const empty = groups ? !groups.some((g) => g.items.length) : options.length === 0;
  return (
    <div className={`relative ${className}`}>
      <Btn onClick={() => setOpen(!open)} active={n > 0} className="w-full justify-center sm:w-auto">{icon && <span className="hidden sm:inline-flex">{icon}</span>}<span className="truncate">{label}{n > 0 ? ` · ${n}` : ""}</span> <ChevronDown size={13} className="shrink-0" /></Btn>
      {open && (
        <>
          {/* En móvil, hoja inferior fija: la barra de filtros tiene overflow-x-auto y
              recortaba el desplegable absoluto. En escritorio, popover normal. */}
          <div className="fixed inset-0 z-50 bg-slate-900/25 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:max-h-72 sm:w-60 sm:rounded-xl sm:shadow-xl" style={{ borderColor: C.line, paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-1 flex items-center justify-between px-2 sm:hidden">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {n > 0 && <button type="button" className="mb-1 w-full rounded-md px-2 py-1 text-left text-xs text-blue-700 hover:bg-slate-50" onClick={() => onChange(new Set())}>Quitar filtro</button>}
            {groups
              ? groups.filter((g) => g.items.length).map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>
                    {g.items.map(Item)}
                  </div>
                ))
              : options.map(Item)}
            {empty && <div className="px-2 py-1 text-sm text-slate-500">Sin opciones</div>}
          </div>
        </>
      )}
    </div>
  );
}
function CatSelect({ value, onChange, className = "", allowEmpty, ariaLabel = "Categoría" }) {
  return (
    <select aria-label={ariaLabel} value={value || ""} onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`} style={{ borderColor: C.line }}>
      {allowEmpty && <option value="">— Elegir —</option>}
      <optgroup label="Ingresos">
        {INGRESO_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Gastos">
        {GASTO_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Transferencias">
        {TRANSFER_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </select>
  );
}
function AssetSelect({ value, onChange, assets, onCreateAsset, className = "" }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const create = () => {
    const nm = name.trim();
    if (!nm) return;
    const exists = assets.find((a) => a.name.toLowerCase() === nm.toLowerCase());
    if (exists) { onChange(exists.name); setCreating(false); setName(""); return; }
    onCreateAsset?.({ name: nm, emoji });
    onChange(nm);
    setCreating(false); setName(""); setEmoji("📦");
  };
  if (creating) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Icono del activo"
          className="rounded-lg border bg-white px-1.5 py-1.5 text-sm" style={{ borderColor: C.line }}>
          {EMOJI_CHOICES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nombre del activo"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") setCreating(false); }}
          className="w-32 rounded-lg border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
        <button type="button" onClick={create} aria-label="Guardar activo" className="rounded-lg px-2 py-1.5 text-sm text-white" style={{ background: C.accent }}><Check size={14} /></button>
        <button type="button" onClick={() => { setCreating(false); setName(""); }} aria-label="Cancelar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
      </div>
    );
  }
  return (
    <select aria-label="Activo" value={value ?? ""} onChange={(e) => { if (e.target.value === "__new__") { setCreating(true); } else { onChange(e.target.value || null); } }}
      className={`rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`} style={{ borderColor: C.line }}>
      <option value="">Sin activo</option>
      {assets.map((a) => <option key={a.id} value={a.name}>{a.emoji} {a.name}</option>)}
      {onCreateAsset && <option value="__new__">➕ Crear activo…</option>}
    </select>
  );
}

function Money({ v, bold, size = "text-sm", positive }) {
  const color = positive ? C.income : v >= 0 ? C.income : C.ink;
  return <span className={`${size} ${bold ? "font-semibold" : ""}`} style={{ ...tnum, color }}>{v >= 0 ? "+" : ""}{fmtE(v)}</span>;
}
function Spinner({ label }) {
  return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {label}</div>;
}
function Pill({ children, color, soft }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: soft, color }}>{children}</span>;
}



function HBar({ pct, color }) {
  return (
    <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </span>
  );
}

/* ============================================================
   EVOLUCIÓN DE RECIBOS (subidas y bajadas)
   ============================================================ */
function DeltaBadge({ d }) {
  if (d === null || d === undefined) return <span className="text-xs text-slate-300">–</span>;
  const up = d >= 0.03, down = d <= -0.03;
  const color = up ? C.expense : down ? C.income : C.muted;
  const soft = up ? C.expenseSoft : down ? C.incomeSoft : C.surfaceAlt;
  const I = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ ...tnum, color, background: soft }}>
      <I size={11} /> {d > 0 ? "+" : ""}{fmtPct(d)}
    </span>
  );
}

/* ============================================================
   AJUSTES (datos, copia de seguridad, borrado)
   ============================================================ */
// Grupo plegable de Ajustes. Enseña su estado en la cabecera (un punto de color y una frase)
// para que quien llega nuevo vea de un vistazo qué tiene configurado y qué le falta, sin
// abrirlos uno a uno. Solo el primero viene abierto.
function Grupo({ titulo, estado, ok, abierto = false, forzar = false, children }) {
  const [open, setOpen] = useState(abierto);
  // `forzar` permite abrirlo desde Primeros pasos: sin esto, pulsar «Configurar» no haría
  // nada visible porque el grupo guarda su propio estado.
  useEffect(() => { if (forzar) setOpen(true); }, [forzar]);
  return (
    <section className="rounded-xl border" style={{ borderColor: C.line, background: C.surface }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <ChevronRight size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
          {estado && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              {ok !== undefined && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ok ? "#4ade80" : C.lineStrong }} />}
              <span className="truncate">{estado}</span>
            </span>
          )}
        </span>
      </button>
      {open && <div className="space-y-5 border-t px-3 pb-4 pt-4" style={{ borderColor: C.line }}>{children}</div>}
    </section>
  );
}

let overlaySeq = 0;
let selfPops = 0; // popstate provocados por nuestro propio history.back()
let popBound = false;

function bindPopstate() {
  if (popBound || typeof window === "undefined") return;
  popBound = true;
  window.addEventListener("popstate", () => {
    if (selfPops > 0) { selfPops--; return; }
    const top = overlayStack.pop();
    if (top) top.close();
  });
}

function useBackClose(isOpen, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    bindPopstate();
    const entry = { id: ++overlaySeq, close: () => closeRef.current?.() };
    overlayStack.push(entry);
    const pushed = tryHistory(() => window.history.pushState({ overlay: entry.id }, ""));
    return () => {
      const i = overlayStack.indexOf(entry);
      const wasTop = i === overlayStack.length - 1;
      if (i >= 0) overlayStack.splice(i, 1);
      // Cerrado por la X / Escape / clic fuera: consumimos nuestra propia entrada.
      // Si lo cerró el "atrás", popstate ya lo sacó de la pila y no hay nada que consumir.
      if (pushed && i >= 0 && wasTop && window.history.state?.overlay === entry.id) {
        selfPops++;
        if (!tryHistory(() => window.history.back())) selfPops--;
      }
    };
  }, [isOpen]);
}

export {
  Btn,
  Card,
  Modal,
  Seg,
  MultiSelect,
  CatSelect,
  AssetSelect,
  Money,
  Spinner,
  Pill,
  HBar,
  DeltaBadge,
  Grupo,
  overlaySeq,
  selfPops,
  popBound,
  bindPopstate,
  useBackClose,
};
