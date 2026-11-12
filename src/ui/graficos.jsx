import { C, catColor, fmtDate, fmtDateShort, fmtE, fmtE0, fmtPct, nfNum, shadeRamp, tnum } from "../core.js";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* ============================================================
   GRÁFICOS
   ============================================================ */
/* Donut con drill-down JERÁRQUICO: categorías → comercios → lista de movimientos.
   Antes, clicar una categoría saltaba directo a la lista (confundía). Ahora al pulsar
   una categoría se abre el MISMO gráfico con el desglose por comercio; solo el último
   paso (un comercio concreto) va a la lista. `parts` trae los movimientos ya expandidos
   ({cat, amount, mov}); si no se pasa, se mantiene el comportamiento antiguo. */
function DonutCategories({ byCat, total, onDrill, parts, selectedCat, onHover, income, extraTotal = 0, extraIds = [] }) {
  const [focus, setFocus] = useState(null); // categoría en la que hemos entrado, o null

  // Vista actual: categorías (nivel 0) o comercios de `focus` (nivel 1).
  const view = useMemo(() => {
    if (!focus) {
      // Una categoría puede quedar en negativo en un periodo si las devoluciones superan a
      // las compras: no se pinta como porción (un arco negativo no tiene sentido), pero el
      // total del centro sí la descuenta.
      const entries = [...byCat.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ key: name, name, value }));
      return { entries, viewTotal: total, level: "cat" };
    }
    const map = new Map();
    for (const p of parts || []) {
      // Ingresos = importes positivos; gastos = negativos.
      if (p.cat !== focus || (income ? p.amount <= 0 : p.amount >= 0)) continue;
      const k = p.mov.pattern;
      if (!map.has(k)) map.set(k, { key: k, name: p.mov.concept.slice(0, 30), value: 0, ids: [] });
      const e = map.get(k);
      e.value += income ? p.amount : -p.amount;
      e.ids.push(p.mov.id); // qué movimientos componen exactamente esta porción
    }
    const entries = [...map.values()].sort((a, b) => b.value - a.value);
    return { entries, viewTotal: entries.reduce((s, e) => s + e.value, 0), level: "merchant" };
  }, [focus, byCat, total, parts, income]);

  const { entries, viewTotal, level } = view;
  const canDrillIn = !!parts; // hay datos para bajar un nivel

  if (entries.length === 0) return <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">{income ? "Sin ingresos en este periodo." : "Sin gastos en este periodo."}</div>;

  // Antes se agrupaba todo lo que pasara de 9 en una porción gris "Otras" que, además, ignoraba
  // el clic. En una vista anual ese trozo era enorme y parecía la app rota. Se pintan TODAS las
  // categorías: cada porción es suya y se puede pulsar. La lista de la derecha sigue llevando el
  // detalle para las porciones finas.
  const chartData = entries;

  // En nivel 1, degradado del tono de la categoría (más intenso = más importante).
  const ramp = level === "merchant" ? shadeRamp(catColor(focus), entries.length) : null;
  const sliceColor = (d, i) => (level === "cat" ? catColor(d.name) : (ramp[i] || catColor(focus)));
  const sliceOpacity = (d) => (level === "cat" && selectedCat && selectedCat !== d.name ? 0.35 : 1);

  const activate = (d) => {
    if (!d || !d.key) return;
    if (level === "cat") {
      if (canDrillIn) setFocus(d.key);            // entra al desglose por comercio
      else onDrill({ type: "cat", key: d.key, label: d.key });
    } else {
      // El detalle es EXACTAMENTE lo que suma esta porción, no toda la subcategoría:
      // si la porción son 2 movimientos, se ven esos 2; si es uno, ese uno.
      onDrill({ type: "ids", ids: d.ids, label: d.name });
    }
  };

  return (
    <div>
      {focus && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setFocus(null)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <ChevronLeft size={14} /> Todas las categorías
          </button>
          <button type="button" onClick={() => onDrill({ type: "cat", key: focus, label: focus })} className="text-xs font-medium hover:underline" style={{ color: C.accent }}>
            Ver movimientos de {focus}
          </button>
        </div>
      )}
      <div className="grid items-center gap-2 sm:grid-cols-[200px_1fr]">
        <div className="relative" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={1.5}
                stroke={C.surface} strokeWidth={2} onClick={activate}>
                {chartData.map((d, i) => (
                  <Cell key={d.key} fill={sliceColor(d, i)} cursor="pointer" opacity={sliceOpacity(d, i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Esta capa cubre TODO el gráfico (inset-0), anillo incluido. Sin pointer-events-none
              se traga los clics de las porciones y el anillo entero deja de responder: solo el
              subtítulo vuelve a capturarlos, con pointer-events-auto. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="max-w-[110px] truncate text-[11px] text-slate-400">{focus || (income ? "Ingresos" : "Gasto")}</span>
            <span className="text-lg font-semibold" style={tnum}>{fmtE0(viewTotal)}</span>
            {/* Los extraordinarios no entran en el anillo (distorsionarían medias y proyecciones),
                pero salieron de la cuenta igual. Sin esta línea el total del centro no cuadra con
                el dinero real del periodo y no hay forma de saber que faltan. */}
            {!focus && extraTotal > 0 && (
              <button type="button" onClick={() => extraIds.length && onDrill({ type: "ids", ids: extraIds, label: income ? "Ingresos extraordinarios" : "Gastos extraordinarios" })}
                className="pointer-events-auto mt-0.5 flex max-w-[118px] items-center gap-1 rounded px-1 text-[10px] font-medium leading-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ color: C.extra }} title={`Con extraordinarios: ${fmtE0(viewTotal + extraTotal)}. Pulsa para verlos.`}>
                <Star size={9} className="shrink-0" fill="currentColor" />
                <span className="truncate">+{fmtE0(extraTotal)} extra</span>
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[220px] space-y-0.5 overflow-y-auto pr-1">
          {entries.map((e, i) => (
            <button key={e.key} type="button" onClick={() => activate(e)}
              onMouseEnter={() => level === "cat" && onHover?.(e.name)} onMouseLeave={() => level === "cat" && onHover?.(null)}
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: sliceColor(e, i), opacity: sliceOpacity(e, i) }} />
              <span className="flex-1 truncate text-sm">{e.name}</span>
              <span className="text-sm font-medium" style={tnum}>{fmtE0(e.value)}</span>
              <span className="w-11 text-right text-xs text-slate-400" style={tnum}>{viewTotal > 0 ? fmtPct(e.value / viewTotal) : "–"}</span>
              <ChevronRight size={13} className="text-slate-300 transition-colors group-hover:text-slate-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedTime({ buckets, topCats, isDay, onPick }) {
  if (!buckets.length) return <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">Sin datos en el rango.</div>;
  const keys = [...topCats, "Resto"];
  const TT = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const tot = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.line, minWidth: 160 }}>
        <div className="mb-1 font-semibold">{label}</div>
        {payload.filter((p) => p.value > 0).reverse().map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3" style={tnum}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: p.fill }} />{p.dataKey}</span>
            <span>{fmtE0(p.value)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t pt-1 font-medium" style={{ ...tnum, borderColor: C.line }}><span>Total</span><span>{fmtE0(tot)}</span></div>
        {!isDay && <div className="mt-1 text-[10px] text-slate-400">Pulsa para filtrar este periodo</div>}
      </div>
    );
  };
  return (
    <div style={{ height: 248 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 6, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%"
          onClick={(e) => { if (!isDay && e?.activeLabel && onPick) onPick(e.activeLabel); }}>
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => nfNum.format(v) + "€"} />
          <Tooltip content={<TT />} cursor={{ fill: "rgba(67,56,202,.06)" }} />
          {/* Trazo de 2 px del color de la superficie entre segmentos apilados: es lo que
              hace legible la pila cuando dos categorías comparten supra-categoría. */}
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={k === "Resto" ? C.lineStrong : catColor(k)}
              stroke={C.surface} strokeWidth={2}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} cursor={!isDay ? "pointer" : "default"} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================
   APLICACIÓN PRINCIPAL
   ============================================================ */
/* ============================================================
   EVOLUCIÓN DEL SALDO
   ============================================================ */
function SaldoChart({ serie }) {
  const data = useMemo(() => {
    if (!serie || serie.length < 2) return null;
    const step = Math.max(1, Math.ceil(serie.length / 240));
    const ds = serie.filter((_, i) => i % step === 0 || i === serie.length - 1);
    return ds.map((p) => ({ ...p, label: fmtDateShort(new Date(p.d)) }));
  }, [serie]);
  if (!data) return null;
  const TT = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.line }}>
        <div className="font-medium">{fmtDate(new Date(p.d))}</div>
        <div className="mt-0.5 font-semibold" style={tnum}>{fmtE(p.saldo)}</div>
      </div>
    );
  };
  return (
    <div style={{ height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.navy2} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.navy2} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={48} />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => nfNum.format(v) + "€"} domain={["auto", "auto"]} />
          <Tooltip content={<TT />} cursor={{ stroke: C.lineStrong }} />
          <Area type="monotone" dataKey="saldo" stroke={C.navy2} strokeWidth={2} fill="url(#gradSaldo)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export {
  DonutCategories,
  StackedTime,
  SaldoChart,
};
