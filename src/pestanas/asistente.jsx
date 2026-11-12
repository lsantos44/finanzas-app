import { C, aiChatWithTools, aiProviderLabel, buildAgentTools, buildAssistantSystem, convTitle, fmtE0, runAgentTool, stripAccents, tnum } from "../core.js";
import { Btn, Card } from "../ui/comunes.jsx";
import { Bot, Check, ChevronDown, Menu, Plus, Search, Send, Settings, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   PESTAÑA ASISTENTE
   ============================================================ */
/* Markdown ligero para respuestas del asistente (negrita, cursiva, código, listas, títulos) */
function mdInline(text, keyBase) {
  const out = [];
  let rest = String(text);
  let k = 0;
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${keyBase}-${k++}`} className="rounded bg-slate-100 px-1 text-[0.92em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}
// Markdown mínimo y SIN HTML (todo pasa por mdInline, que solo genera texto, negrita y código):
// párrafos, títulos, listas (con su numeración) y tablas. Las tablas las pide el propio prompt
// del asistente, y antes salían como líneas con barras «|».
function MDLite({ text }) {
  const lines = String(text || "").split("\n");
  const out = [];
  const celdas = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // Tabla: cabecera | separador (---) | filas
    if (t.startsWith("|") && /^\|?\s*:?-{2,}/.test((lines[i + 1] || "").trim())) {
      const cab = celdas(t);
      const filas = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) { filas.push(celdas(lines[j])); j++; }
      const num = (c) => /^[-+]?[\d.,]+\s*(€|%)?$/.test(c);
      out.push(
        <div key={i} className="-mx-1 overflow-x-auto">
          <table className="my-1 w-full text-xs">
            <thead><tr className="border-b" style={{ borderColor: C.line }}>{cab.map((c, k) => <th key={k} className="px-1.5 py-1 text-left font-semibold text-slate-600">{mdInline(c, `${i}h${k}`)}</th>)}</tr></thead>
            <tbody>{filas.map((f, r) => <tr key={r} className="border-b last:border-0" style={{ borderColor: C.line }}>{f.map((c, k) => <td key={k} className={`px-1.5 py-1 ${num(c) ? "text-right" : ""}`} style={num(c) ? tnum : undefined}>{mdInline(c, `${i}r${r}c${k}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }
    if (!t) { out.push(<div key={i} className="h-1" />); continue; }
    const mNum = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (mNum) { out.push(<div key={i} className="flex gap-1.5 pl-1"><span className="shrink-0 text-slate-500" style={tnum}>{mNum[1]}.</span><span className="min-w-0 flex-1">{mdInline(mNum[2], i)}</span></div>); continue; }
    const mList = t.match(/^[-•*]\s+(.*)$/);
    if (mList) { out.push(<div key={i} className="flex gap-1.5 pl-1"><span className="shrink-0 text-slate-400">•</span><span className="min-w-0 flex-1">{mdInline(mList[1], i)}</span></div>); continue; }
    const mHead = t.match(/^#{1,4}\s+(.*)$/);
    if (mHead) { out.push(<div key={i} className="font-semibold">{mdInline(mHead[1], i)}</div>); continue; }
    out.push(<div key={i}>{mdInline(lines[i], i)}</div>);
  }
  return <div className="space-y-1">{out}</div>;
}

function TraceSummary({ trace }) {
  const [open, setOpen] = useState(false);
  if (!trace?.length) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Search size={11} /> {trace.length} {trace.length === 1 ? "consulta en tu dispositivo" : "consultas en tu dispositivo"}
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
          {trace.map((t, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-semibold text-slate-600">{t.name}</span>
              <span className="truncate font-mono text-[10px] text-slate-400" style={{ maxWidth: "16rem" }}>{t.argsTxt}</span>
              <span>→ {t.resumen}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProposalCard({ p, created, onCreate }) {
  const isReclass = p.kind === "reclass";
  return (
    <div className="mt-2 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {isReclass ? (
            <>
              <div className="text-sm font-semibold">Reclasificar {p.count} {p.count === 1 ? "movimiento" : "movimientos"} → <span style={{ color: C.accent }}>{p.categoria}</span></div>
              {p.fromCats?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.fromCats.map((f) => <span key={f.c} className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{f.c} ({f.n})</span>)}
                </div>
              )}
              {p.sample?.length > 0 && <div className="mt-1 truncate text-[11px] text-slate-400">p. ej. {p.sample.join(" · ")}</div>}
              {p.patrones?.length > 0 && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Se recordará como regla para {p.patrones.length === 1 ? <strong>{p.patrones[0]}</strong> : <>{p.patrones.length} comercios</>}, para que no vuelva a preguntártelo.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">{p.emoji} Etiqueta «{p.nombre}»</div>
              <div className="text-xs text-slate-500" style={tnum}>{p.count} movimientos · {fmtE0(p.gasto)} de gasto</div>
              {p.keywords.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.keywords.map((k) => <span key={k} className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{k}</span>)}
                </div>
              )}
            </>
          )}
        </div>
        {created
          ? <span className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium" style={{ color: C.income, background: C.incomeSoft }}><Check size={14} /> {isReclass ? "Aplicada" : "Creada"}</span>
          : <Btn kind="primary" onClick={onCreate}>{isReclass ? <><Check size={14} /> Aplicar</> : <><Plus size={14} /> Crear etiqueta</>}</Btn>}
      </div>
    </div>
  );
}

function AsistenteTab({ aiOn, setAiOn, hasData, ctx, ai, aiDetail, onCreateProposal, onApplyReclassify, onOpenSettings, msgs, setMsgs, conversations, activeId, onNewChat, onSelectChat, onDeleteChat }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convMenu, setConvMenu] = useState(false);
  const [convQuery, setConvQuery] = useState("");
  const endRef = useRef(null);
  const taRef = useRef(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";                                  // medir desde cero
    el.style.height = Math.min(el.scrollHeight, 220) + "px";   // y crecer hasta un tope
  }, [input]);
  const activeTitle = convTitle((conversations || []).find((c) => c.id === activeId) || { msgs });
  const sortedConvs = [...(conversations || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const cerca = d.scrollHeight - d.scrollTop - d.clientHeight < 140;
      atBottomRef.current = cerca;
      setShowJump(!cerca);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Scroll al final REAL de la pagina, no a un elemento: scrollIntoView aterrizaba a media
  // altura porque se ejecutaba antes de que el hilo terminara de maquetarse.
  const irAlFinal = useCallback((suave) => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave ? "smooth" : "auto" });
  }, []);
  useEffect(() => {
    // Abrir o cambiar de conversacion aterriza en el ultimo mensaje, y sin animacion: con el
    // hilo mas alto que la pantalla, arrancar arriba obliga a bajar a mano cada vez. Dos frames
    // de espera para medir la altura ya maquetada.
    atBottomRef.current = true;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => irAlFinal(false)));
    return () => cancelAnimationFrame(r);
  }, [activeId, irAlFinal]);
  useEffect(() => {
    if (!atBottomRef.current) return; // estas leyendo historial: no te muevo el suelo
    const r = requestAnimationFrame(() => irAlFinal(true));
    return () => cancelAnimationFrame(r);
  }, [msgs, busy, irAlFinal]);

  const suggestions = [
    // Revisar movimientos uno a uno necesita el acceso a detalle (las herramientas de reclasificar).
    ...(aiDetail ? ["Revisa mis movimientos sin categorizar y propón cómo clasificarlos"] : ["¿Cuánto he gastado este año por categoría y cómo va frente al año pasado?"]),
    "¿Qué recibos me han subido y cuánto suponen al año?",
    "Etiqueta como Pádel todo mi gasto en pádel",
    "¿En qué comercios gasté más el mes pasado?",
  ];

  const resumen = (name, out) => {
    if (out?.error) return "error: " + out.error;
    if (name === "consultar") return `${out.total?.movimientos ?? 0} movs${out.resultado ? ` · ${out.resultado.length} filas` : ""}`;
    if (name === "ver_movimientos") return `${out.mostrados}/${out.encontrados} movimientos`;
    if (name === "evolucion_recibo") return out.recibos ? `${out.recibos.length} recibos` : out.serie_mensual ? `${out.serie_mensual.length} meses` : "sin datos";
    if (name === "proponer_etiqueta") return out.coincidencias != null ? `${out.coincidencias} coincidencias` : "propuesta";
    if (name === "proponer_reclasificacion") return out.coincidencias != null ? `${out.coincidencias} a reclasificar` : "propuesta";
    return "ok";
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy || !aiOn) return;
    setInput("");
    const history = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    const convId = activeId;
    setMsgs((ms) => [...ms, { role: "user", content: q }], convId);
    setBusy(true);
    const trace = [];
    const proposals = [];
    try {
      const system = buildAssistantSystem(ctx, aiDetail);
      const tools = buildAgentTools(aiDetail);
      // Si una herramienta falla, el modelo recibe el error y puede seguir; antes se perdía la respuesta entera.
      const runTool = (n, a) => {
        try { return runAgentTool({ ...ctx, detail: !!aiDetail }, n, a, { onProposal: (ui) => proposals.push(ui) }); } catch (e) { return { error: "La herramienta falló: " + ((e && e.message) || e) }; }
      };
      const onTrace = (n, a, out) => trace.push({ name: n, argsTxt: JSON.stringify(a), resumen: resumen(n, out) });
      const reply = await aiChatWithTools(ai, {
        system, tools, runTool, onTrace,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((ms) => [...ms, { role: "assistant", content: reply, trace, proposals }], convId);
    } catch (e) {
      const isNet = /failed to fetch|networkerror|load failed/i.test(e.message);
      const custom = ai && ai.provider !== "claude";
      const content = /\b401\b/.test(e.message) && !custom
        ? "El proveedor «Claude (integrado)» solo funciona dentro de claude.ai. Elige un proveedor con tu propia clave en Ajustes → Inteligencia artificial."
        : isNet && custom
          ? `No he podido conectar con ${aiProviderLabel(ai)}. Revisa la dirección del proveedor y tu conexión, y vuelve a intentarlo.`
          : "No he podido conectar con el asistente (" + e.message + "). Inténtalo de nuevo.";
      setMsgs((ms) => [...ms, { role: "assistant", content, error: true, trace, proposals: [] }], convId);
    } finally { setBusy(false); }
  };

  if (!hasData) return <Card className="p-10 text-center text-sm text-slate-500">Aún no hay movimientos. Conecta tu banco o importa un archivo para poder preguntar sobre tus datos.</Card>;

  const convsFiltradas = convQuery.trim()
    ? sortedConvs.filter((c) => stripAccents(convTitle(c).toLowerCase()).includes(stripAccents(convQuery.trim().toLowerCase())))
    : sortedConvs;

  return (
    <div className="mx-auto flex max-w-2xl flex-col anim-rise" style={{ minHeight: "60vh" }}>
      {/* Barra fija. Antes la cabecera scrolleaba con los mensajes y para cambiar de
          conversación había que subir hasta arriba del todo. */}
      <div className="chat-bar -mx-1 mb-3 flex items-center gap-1 border-b bg-white px-1 py-2" style={{ borderColor: C.line }}>
        <button type="button" onClick={() => setConvMenu(true)} aria-label="Conversaciones"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Menu size={17} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={activeTitle}>{activeTitle}</span>
        <button type="button" onClick={onNewChat} aria-label="Nueva conversación"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Plus size={17} />
        </button>
        <button type="button" onClick={onOpenSettings} aria-label="Ajustes del asistente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Settings size={16} />
        </button>
      </div>

      {convMenu && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => setConvMenu(false)} />
          <div className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-r bg-white shadow-2xl anim-drawer" style={{ borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: C.line }}>
              <span className="text-sm font-semibold">Conversaciones</span>
              <button type="button" onClick={() => setConvMenu(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
            </div>
            <button type="button" onClick={() => { onNewChat(); setConvMenu(false); }}
              className="mx-2 mt-2 flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ background: C.accent }}>
              <Plus size={15} /> Nueva conversación
            </button>
            {/* Buscador: con muchas conversaciones, recorrer la lista a ojo no escala. */}
            {sortedConvs.length > 6 && (
              <div className="mx-2 mt-2 flex items-center gap-1.5 rounded-lg border px-2" style={{ borderColor: C.line }}>
                <Search size={13} className="shrink-0 text-slate-400" />
                <input value={convQuery} onChange={(e) => setConvQuery(e.target.value)} aria-label="Buscar conversación" placeholder="Buscar conversación"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm focus:outline-none" />
                {convQuery && <button type="button" onClick={() => setConvQuery("")} aria-label="Limpiar" className="shrink-0 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
              </div>
            )}
            <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
              {convsFiltradas.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Ninguna conversación coincide.</p>}
              {convsFiltradas.map((c) => (
                <div key={c.id} className={`mb-1 flex items-center gap-1 rounded-lg ${c.id === activeId ? "" : "hover:bg-slate-50"}`} style={c.id === activeId ? { background: C.accentSoft } : undefined}>
                  <button type="button" onClick={() => { onSelectChat(c.id); setConvMenu(false); }} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                    <span className="block truncate text-sm" style={c.id === activeId ? { color: C.accent, fontWeight: 600 } : { color: C.ink }}>{convTitle(c)}</span>
                    <span className="block text-[11px] text-slate-400">{c.msgs.length} mensajes{c.updatedAt ? " · " + new Date(c.updatedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : ""}</span>
                  </button>
                  <button type="button" onClick={() => onDeleteChat(c.id)} aria-label="Borrar conversación" className="mr-1 shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* El interruptor y la nota de privacidad ocupaban sitio fijo en cada scroll pese a ser
          cosa de una vez. El interruptor ya vive en Ajustes; aquí solo aparece si hace falta. */}
      {!aiOn && (
        <Card className="mb-3 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
            Activar el asistente
          </label>
          <p className="mt-1.5 text-xs text-slate-400">
            Tus datos se consultan <strong>en tu dispositivo</strong>: el proveedor solo ve tu pregunta y los resultados de cada consulta.
          </p>
        </Card>
      )}

      <div className="flex-1 space-y-4 pb-3">
        {msgs.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.accentSoft, color: C.accent }}><Bot size={26} /></div>
            <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">Pregunta con detalle: totales, evoluciones, recibos que suben, netos por activo… o pídeme etiquetar un tipo de gasto.</p>
            <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={!aiOn || busy}
                  className="rounded-xl border bg-white px-3.5 py-2.5 text-left text-[13px] leading-snug text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, mi) => {
          const user = m.role === "user";
          return (
            <div key={mi} className={`flex items-start gap-2 ${user ? "justify-end" : "justify-start"}`}>
              {!user && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: m.error ? "#FEE2E2" : C.accentSoft, color: m.error ? "#B91C1C" : C.accent }}>
                  <Bot size={15} />
                </div>
              )}
              <div className={`max-w-[84%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${user ? "rounded-2xl rounded-br-md text-white" : "rounded-2xl rounded-bl-md"}`}
                style={user ? { background: C.accent } : { background: C.surface, border: `1px solid ${m.error ? "#FECDD3" : C.line}` }}>
                {user ? <div className="whitespace-pre-wrap">{m.content}</div> : <MDLite text={m.content} />}
                {!user && <TraceSummary trace={m.trace} />}
                {/* «Aplicada» se guarda en el propio mensaje: sobrevive a recargar y no se confunde
                    entre conversaciones (antes era un estado local por posición). */}
                {!user && (m.proposals || []).map((p, pi) => (
                  <ProposalCard key={mi + "-" + pi} p={p} created={!!p.aplicada}
                    onCreate={() => {
                      const ok = (p.kind === "reclass" ? onApplyReclassify : onCreateProposal)(p);
                      if (ok === false) return;
                      setMsgs((ms) => ms.map((x, i) => (i === mi ? { ...x, proposals: x.proposals.map((q, j) => (j === pi ? { ...q, aplicada: true } : q)) } : x)), activeId);
                    }} />
                ))}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex items-end gap-2 justify-start">
            <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: C.accentSoft, color: C.accent }}><Bot size={15} /></div>
            <div className="rounded-2xl rounded-bl-md border px-3.5 py-3 shadow-sm" style={{ borderColor: C.line, background: C.surface }}>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
                </span>
                Consultando tus datos…
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-dock mt-3">
        {showJump && msgs.length > 0 && (
          <div className="pointer-events-none flex justify-center pb-2">
            <button type="button" onClick={() => irAlFinal(true)} aria-label="Ir al último mensaje"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border bg-white text-slate-500 shadow-md transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ borderColor: C.line }}>
              <ChevronDown size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm" style={{ borderColor: C.lineStrong }}>
          <textarea ref={taRef} value={input} rows={1} aria-label="Pregunta al asistente" placeholder={aiOn ? "Pregunta a tus datos…" : "Activa el asistente para preguntar"} disabled={!aiOn || busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="min-h-[2.5rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => send()} disabled={!aiOn || busy || !input.trim()} aria-label="Enviar pregunta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: C.accent }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export {
  mdInline,
  MDLite,
  TraceSummary,
  ProposalCard,
  AsistenteTab,
};
