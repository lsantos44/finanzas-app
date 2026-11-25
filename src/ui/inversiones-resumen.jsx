import { C, fmtE0, tnum } from "../core.js";
import { Card } from "./comunes.jsx";
import { analizarInversiones } from "../inversiones.js";
import { ChevronRight, LineChart } from "lucide-react";
import { useMemo } from "react";

/* Tarjeta de Inversiones en Resumen: valor, lo que ganas o pierdes desde que compraste y el
   movimiento de hoy, con los precios que la pestaña Inversiones dejó guardados. Sin gráficos
   (no carga recharts). */
const leerPrecios = () => { try { return JSON.parse(localStorage.getItem("finz:precios:v1") || "null"); } catch { return null; } };
const pct = (v) => (v == null || !isFinite(v) ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`);
const color = (v) => (v == null || Math.abs(v) < 1e-9 ? C.muted : v > 0 ? C.income : C.expense);
const signo = (v) => `${v > 0 ? "+" : ""}${fmtE0(v)}`;

export function TarjetaInversiones({ inversiones, movs, onAbrir }) {
  const a = useMemo(() => (inversiones?.posiciones?.length ? analizarInversiones(inversiones, leerPrecios() || { series: {}, meta: {} }, movs) : null), [inversiones, movs]);
  if (!a) return null;
  return (
    <Card className="mb-4 overflow-hidden">
      <button type="button" onClick={onAbrir} className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: C.accentSoft, color: C.accent }}><LineChart size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Inversiones</div>
          <div className="text-xl font-semibold" style={tnum}>{fmtE0(a.total)}</div>
          <div className="text-xs" style={tnum}>
            {a.resultado != null && <><span className="text-slate-500">Ganas/pierdes </span><span style={{ color: color(a.resultado) }}>{signo(a.resultado)} ({pct(a.resultadoPct)})</span></>}
            {a.resultado != null && " · "}<span className="text-slate-500">último cambio </span><span style={{ color: color(a.hoy) }}>{signo(a.hoy)}</span>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-slate-400" />
      </button>
    </Card>
  );
}
