import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { Plus, X, AlertTriangle, Search, Wallet, Settings, ClipboardList, Sun, Moon } from "lucide-react";
import { ALL_TABS, ASSET_EMOJI, BANK_KEY, BUILD_STAMP, C, CATEGORIES, CHATS_KEY, DEFAULT_AI_CFG, DEFAULT_MATERIALIDAD, DEFAULT_REDUCIBLE, DEFAULT_RULES, ENTITY_STOP, GROUP_COLORS, INGRESO_SET, INTERNAL_SET, LLEGA_CON_ENLACE, PRIO, SAMPLE_GROUPS, SNAP_PREFIX, STORE, STORE_KEYS, SYNC_KEY, THEME, THEME_KEY, TOKENS, TRANSFER_SET, VIVIENDA, abrirAcceso, aiProviderLabel, ambKey, ambiguousPatterns, analyzeReceiptTrends, analyzeRows, applyCfg, auditRules, b64u, bankErrDetail, bankIsEmpty, buildAlerts, buildMonthClose, buildMovements, calcImputacion, calcRentaInmueble, classifyForImport, computeBankSaldo, computeOutliers, conciliar, daysBetween, decodeBuffer, dedupeAgainst, describePeriod, deserializeMovs, detectDelimiter, detectRecurring, expandParts, fmtAgo, fmtDate, fmtDateShort, genSampleCSV, identifiesMerchant, isConditional, isProcessorPattern, isRefundPart, isSpreadsheetFile, isoDay, learnedRule, leerAccesoGuardado, listSnapshots, loadBank, loadSync, makeAccessLink, matchRule, merchantEntity, mergeBank, missingIncome, monthKey, monthLabel, monthsCoveredOf, movInGroup, movKey, needsAmount, newConv, nfEUR, nfNum, normalizePattern, parseAccessLink, parseDateAny, parseEsNumber, r2c, rebuildRules, recordarAcceso, recoverBackupFromStore, refundFromHistory, refundIndex, ruleConditionsHold, ruleId, runQuery, saveBank, saveSync, serializeCfg, serializeMovs, setItemSeguro, setTema, shouldSnapshot, sortedRules, spreadsheetToRows, stripAccents, tipoActivo, tnum, tokenizeCSV, totalsOf, upcomingCharges, upcomingIncome, viviendaPorDefecto, writeSnapshot } from "./core.js";
import { ActivosTab, GruposTab } from "./pestanas/activos.jsx";
import { AsistenteTab, MDLite } from "./pestanas/asistente.jsx";
import { ClasificacionTab } from "./pestanas/clasificacion.jsx";
import { InteligenciaTab, PlanTab } from "./pestanas/ideas.jsx";
import { ExtraordinariosCard, GastoCalendar, HierarchyExplorer, MonthRecap, ResumenTab } from "./pestanas/resumen.jsx";
import { SettingsModal } from "./ui/ajustes.jsx";
import { Card, Seg, Spinner, useBackClose } from "./ui/comunes.jsx";
import { DrillPanel, FiltersBar, MovEditModal, PendientesPanel } from "./ui/movimientos.jsx";
import { AsistenteConexion, EmptyState, EntrarModal, MappingModal, ValidationModal, VueltaOtroNavegador } from "./ui/portada.jsx";

/* Exportaciones con nombre: no las usa la app, existen para que el banco de pruebas
   ejerza EL MOTOR REAL y no una copia suya que se desincronice con el tiempo. */
export {
  matchRule, ruleConditionsHold, sortedRules, ruleId, isConditional,
  DEFAULT_RULES, PRIO, DEFAULT_MATERIALIDAD,
  classifyForImport, dedupeAgainst, movKey, normalizePattern, auditRules, learnedRule, needsAmount, ambiguousPatterns,
  CATEGORIES, rebuildRules, deserializeMovs, tipoActivo, calcRentaInmueble, calcImputacion, conciliar, viviendaPorDefecto, VIVIENDA, computeBankSaldo, refundIndex, refundFromHistory,
  runQuery, totalsOf,
  MDLite,
  makeAccessLink, abrirAcceso, parseAccessLink, parseEsNumber, parseDateAny, tokenizeCSV, detectDelimiter, analyzeRows, buildMovements,
  buildMonthClose, missingIncome, upcomingIncome, upcomingCharges, detectRecurring, analyzeReceiptTrends,
};

let MOV_ID = 1;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error("Fallo de render capturado:", error, info); } catch { /* noop */ } }
  downloadBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(recoverBackupFromStore(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finanzas-copia-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* si ni esto funciona, quedan los snapshots */ }
  };
  render() {
    if (!this.state.error) return this.props.children;
    const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" };
    const card = { maxWidth: "440px", width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" };
    const btn = { display: "block", width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "10px" };
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Algo ha fallado al mostrar la app</h1>
          <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#94a3b8", margin: "0 0 4px" }}>
            Tranquilo: <strong style={{ color: "#e2e8f0" }}>tus datos siguen guardados</strong>, solo ha fallado la pantalla.
            Descarga una copia por seguridad y recarga.
          </p>
          <button style={{ ...btn, background: "#22c55e", color: "#052e16" }} onClick={this.downloadBackup}>Descargar copia de seguridad</button>
          <button style={{ ...btn, background: "#334155", color: "#e2e8f0" }} onClick={() => window.location.reload()}>Recargar la app</button>
          <p style={{ fontSize: "11px", color: "#64748b", margin: "14px 0 0", wordBreak: "break-word" }}>{String(this.state.error?.message || this.state.error)}</p>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}

function AppMain() {
  // El tema vive en un módulo (C y catColor lo leen durante el render). Lo escribimos
  // ANTES de setThemeState para que el re-render que provoca ya use los colores nuevos.
  const [theme, setThemeState] = useState(THEME);
  const setTheme = useCallback((t) => {
    setTema(t);
    try {
      document.documentElement.dataset.theme = t;
      window.localStorage?.setItem(THEME_KEY, t);
    } catch { /* almacenamiento bloqueado: el tema dura la sesión */ }
    setThemeState(t);
  }, []);

  const [movs, setMovs] = useState([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [assets, setAssets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reducible, setReducible] = useState(new Set(DEFAULT_REDUCIBLE));
  // Apagada hasta que la actives: nada sale hacia un proveedor de IA sin que lo hayas decidido.
  // (Quien ya la tenía activada la conserva: el valor guardado manda.)
  const [aiOn, setAiOn] = useState(false);
  const [ai, setAi] = useState(DEFAULT_AI_CFG);
  const [aiProfiles, setAiProfiles] = useState([]); // perfiles de IA guardados: {id,label,provider,baseUrl,model,apiKey}
  // Apagado por defecto: dar acceso al detalle línea a línea debe ser una decisión
  // consciente, no el arranque. El pie de la app afirma que solo ve agregados.
  const [aiDetail, setAiDetail] = useState(false);
  const [tab, setTab] = useState("resumen");
  // Pestañas que la persona ha ocultado en Ajustes. Resumen no se puede ocultar: es la portada.
  const [tabsOcultas, setTabsOcultas] = useState(() => { try { return JSON.parse(localStorage.getItem("finz:tabs-ocultas") || "[]"); } catch { return []; } });
  const toggleTab = useCallback((id) => setTabsOcultas((xs) => {
    const n = xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id];
    try { localStorage.setItem("finz:tabs-ocultas", JSON.stringify(n)); } catch { /* noop */ }
    return n;
  }), []);
  useEffect(() => { if (tabsOcultas.includes(tab)) setTab("resumen"); }, [tabsOcultas, tab]);
  // Dos pestañas combinan dos vistas con un conmutador interno, para aligerar el nav
  // (sobre todo en móvil): "Activos" ↔ "Etiquetas" e "Ideas" ↔ "Plan".
  const [subAct, setSubAct] = useState("activos");
  const [subIdea, setSubIdea] = useState("recap");
  // El chat vive en App (persiste al navegar y al recargar). Ahora son VARIAS conversaciones
  // con menú para navegar. Se migra el chat único anterior (finz:chat:v1) a la primera.
  const [chatStore, setChatStore] = useState(() => {
    try { const s = window.localStorage?.getItem(CHATS_KEY); if (s) { const p = JSON.parse(s); if (p && Array.isArray(p.convs) && p.convs.length) return p; } } catch { /* ignore */ }
    try { const old = JSON.parse(window.localStorage?.getItem("finz:chat:v1") || "[]"); if (Array.isArray(old) && old.length) { const c = { ...newConv(), msgs: old }; return { convs: [c], activeId: c.id }; } } catch { /* ignore */ }
    const c = newConv();
    return { convs: [c], activeId: c.id };
  });
  useEffect(() => {
    try { window.localStorage?.setItem(CHATS_KEY, JSON.stringify(chatStore)); } catch { /* cuota */ }
  }, [chatStore]);
  const activeConv = chatStore.convs.find((c) => c.id === chatStore.activeId) || chatStore.convs[0];
  const chatMsgs = activeConv ? activeConv.msgs : [];
  // `convId`: la conversación de la pregunta. Sin él, una respuesta que llegaba después de
  // cambiar de chat aparecía en el chat equivocado.
  const setChatMsgs = useCallback((arg, convId) => {
    setChatStore((store) => {
      const destino = convId || store.activeId;
      const convs = store.convs.map((c) => (c.id === destino ? { ...c, msgs: typeof arg === "function" ? arg(c.msgs) : arg, updatedAt: Date.now() } : c));
      return { ...store, convs };
    });
  }, []);
  const newChat = useCallback(() => setChatStore((store) => {
    const empty = store.convs.find((c) => c.msgs.length === 0);
    if (empty) return { ...store, activeId: empty.id };
    const c = newConv();
    return { convs: [c, ...store.convs], activeId: c.id };
  }), []);
  const selectChat = useCallback((id) => setChatStore((s) => ({ ...s, activeId: id })), []);
  const deleteChat = useCallback((id) => setChatStore((store) => {
    const convs = store.convs.filter((c) => c.id !== id);
    if (!convs.length) { const c = newConv(); return { convs: [c], activeId: c.id }; }
    return { convs, activeId: store.activeId === id ? convs[0].id : store.activeId };
  }), []);
  // Alto real de la cabecera, publicado como variable CSS: lo consume la barra fija del chat
  // para pegarse justo debajo en vez de solaparse. Ref de callback porque la cabecera no existe
  // en el primer render y un efecto con deps [] se quedaba con la referencia vacia.
  const headerRoRef = useRef(null);
  const headerRef = useCallback((el) => {
    headerRoRef.current?.disconnect();
    headerRoRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const publicar = () => document.documentElement.style.setProperty("--app-header-h", el.offsetHeight + "px");
    publicar();
    headerRoRef.current = new ResizeObserver(publicar);
    headerRoRef.current.observe(el);
  }, []);
  const [drill, setDrill] = useState(null);
  const [movEdit, setMovEdit] = useState(null); // null | { mode:"new" } | { mode:"edit", mov }
  const [granularity, setGranularity] = useState("month");
  const [imp, setImp] = useState(null);
  const [, setPendingNotice] = useState(0); // el aviso se muestra por otra vía; se conserva el setter
  const [pendingOpen, setPendingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ periodType: "month", year: new Date().getFullYear(), month: "", from: "", to: "", cats: new Set(), assetsSel: new Set(), groupsSel: new Set() });
  const sampleRef = useRef(false);
  // Vive en App, no en el panel: así cerrar y reabrir "por clasificar" no vuelve a
  // pagar la ronda de IA. Se rearma al importar un CSV nuevo (hay comercios nuevos).
  const aiAutoRanRef = useRef(false);
  const hasData = movs.length > 0;
  const movsPend = useMemo(() => movs.filter((m) => m.confirmed === false && !m.omit), [movs]);
  const ambPend = useMemo(() => ambiguousPatterns(movs), [movs]);

  // Botón atrás cierra overlays en vez de salir de la app (crucial en la PWA de iPhone)
  useBackClose(settingsOpen, () => setSettingsOpen(false));
  useBackClose(pendingOpen, () => setPendingOpen(false));
  useBackClose(!!drill, () => setDrill(null));

  /* ---------- Persistencia ---------- */
  const [budgets, setBudgets] = useState({});
  const [booted, setBooted] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const saveTimer = useRef(null);
  const lastSnapRef = useRef(0);
  // Se activa si al arrancar había una copia de movimientos que NO se pudo leer. Mientras
  // esté activo y el estado siga vacío, bloqueamos el autoguardado para no pisar esa copia
  // (recuperable vía snapshots) con un estado vacío. Se libera al importar o al borrar todo.
  const bootProtectRef = useRef(false);
  const [snapCount, setSnapCount] = useState(0);
  const [snapTooBig, setSnapTooBig] = useState(false);
  // Sin espacio en el navegador para la conexión bancaria o la sincronización: hay que verlo.
  useEffect(() => {
    const h = () => setSaveState("error");
    window.addEventListener("finz-cuota", h);
    return () => window.removeEventListener("finz-cuota", h);
  }, []);
  // Telemetría por regla: id -> { n, abs, last }. Y el umbral por debajo del cual
  // un movimiento no merece que te preguntemos.
  const [ruleStats, setRuleStats] = useState({});
  const [materialidad, setMaterialidad] = useState(DEFAULT_MATERIALIDAD);
  // Memoria comercio -> activo. Se aprende sola de lo que ya has asignado a mano y NO se borra
  // al eliminar movimientos: es lo que evita rehacer el trabajo tras una carga equivocada.
  const [assetMem, setAssetMem] = useState({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [cRaw, mRaw] = await Promise.all([STORE.get(STORE_KEYS.cfg), STORE.get(STORE_KEYS.movs)]);
        if (cancel) return;
        if (cRaw) {
          try { applyCfg(cRaw, { setAssets, setGroups, setBudgets, setReducible, setRules, setAiOn, setAi, setAiProfiles, setAiDetail, setRuleStats, setMaterialidad, setAssetMem }); } catch {
            // Antes se ignoraba y, un segundo después, el autoguardado escribía la configuración
            // de fábrica encima: reglas, activos, grupos y presupuestos perdidos sin aviso. Ahora
            // se guarda aparte tal cual (recuperable) y se avisa.
            setItemSeguro("finz:cfg:ilegible:" + Date.now(), cRaw);
            setError("Tu configuración guardada (reglas, activos, grupos) no se ha podido leer. He guardado una copia aparte; si la tienes en el servidor o en una copia .json, restáurala desde Ajustes.");
          }
        }
        if (mRaw) {
          try {
            const ms = deserializeMovs(mRaw);
            if (ms.length) {
              let mx = 0;
              for (const m of ms) if (typeof m.id === "number" && m.id > mx) mx = m.id;
              MOV_ID = mx + 1;
              setMovs(ms);
            } else {
              // Había copia pero no salió ningún movimiento útil: protege contra sobrescribir.
              bootProtectRef.current = true;
            }
          } catch { bootProtectRef.current = true; /* copia corrupta: no la pises */ }
        }
      } finally { if (!cancel) setBooted(true); }
    })();
    return () => { cancel = true; };
  }, []);

  // Inventario inicial de snapshots (para mostrar en Ajustes y no duplicar el diario)
  useEffect(() => {
    if (!booted) return;
    let cancel = false;
    (async () => {
      const snaps = await listSnapshots(STORE);
      if (cancel) return;
      setSnapCount(snaps.length);
      if (snaps.length) lastSnapRef.current = snaps[0];
    })();
    return () => { cancel = true; };
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    // No sobrescribas una copia que no se pudo leer con un estado vacío: espera a que el
    // usuario importe (movs > 0) o borre todo explícitamente. Los snapshots siguen intactos.
    if (bootProtectRef.current && movs.length === 0) { setSaveState("error"); return; }
    bootProtectRef.current = false;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const cfgStr = serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem });
        const movStr = serializeMovs(movs);
        const okC = await STORE.set(STORE_KEYS.cfg, cfgStr);
        const okM = await STORE.set(STORE_KEYS.movs, movStr);
        setSaveState(okC && okM ? "saved" : "error");
        // Snapshot diario de defensa (no bloquea el guardado principal)
        try {
          const now = Date.now();
          if (shouldSnapshot(lastSnapRef.current, now, movs.length)) {
            const snap = JSON.stringify({ app: "finanzas-personales", version: 3, exportado: new Date(now).toISOString(), cfg: JSON.parse(cfgStr), movs: JSON.parse(movStr) });
            const r = await writeSnapshot(STORE, snap, now);
            setSnapTooBig(!!r.skipped);
            if (!r.skipped) {
              lastSnapRef.current = now;
              setSnapCount((await listSnapshots(STORE)).length);
            }
          }
        } catch { /* el snapshot es best-effort */ }
      } catch { setSaveState("error"); }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [movs, rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, booted]);

  // Salvavidas: el guardado va con 900 ms de rebote y su cleanup cancela el timer.
  // Cerrar la app dentro de esa ventana perdía el último cambio. Al ocultarse la
  // página volcamos de inmediato lo que haya en curso.
  const stateRef = useRef(null);
  stateRef.current = { rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, movs, ruleStats, materialidad, assetMem };
  useEffect(() => {
    if (!booted) return;
    const flush = (force) => {
      if (!force && document.visibilityState !== "hidden") return;
      const s = stateRef.current;
      if (bootProtectRef.current && s.movs.length === 0) return; // no pises la copia protegida
      clearTimeout(saveTimer.current);
      try {
        STORE.set(STORE_KEYS.cfg, serializeCfg(s));
        STORE.set(STORE_KEYS.movs, serializeMovs(s.movs));
      } catch { /* al cerrar no hay a quién avisar */ }
    };
    const onVis = () => flush(false);
    const onHide = () => flush(true);
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onHide); };
  }, [booted]);

  // Aprende de lo que ya hay: por comercio, si todos los movimientos vivos con activo apuntan
  // al MISMO activo, se recuerda. Si discrepan (el taller que a veces es del coche y a veces de
  // la moto) no se toca, porque ahi no hay una respuesta unica. Las entradas no se borran cuando
  // desaparecen los movimientos: precisamente eso es lo que sobrevive a borrar una carga.
  useEffect(() => {
    if (!booted) return;
    const byPattern = new Map();
    for (const m of movs) {
      if (m.omit || !m.assetName || !m.pattern) continue;
      if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, new Set());
      byPattern.get(m.pattern).add(m.assetName);
    }
    setAssetMem((prev) => {
      let changed = false; const next = { ...prev };
      for (const [pat, set] of byPattern) {
        if (set.size !== 1) continue;
        const only = [...set][0];
        if (next[pat] !== only) { next[pat] = only; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [movs, booted]);

  const forgetAssetMem = useCallback((pattern) => setAssetMem((p) => { const n = { ...p }; delete n[pattern]; return n; }), []);
  const forgetAllAssetMem = useCallback(() => setAssetMem({}), []);

  // `servidor`: borrar también tu copia en el backend (y su historial y bandeja), revocar los
  // permisos del banco y olvidar aquí la conexión. Sin esto, «borrar todo» dejaba tus datos
  // en el servidor y volvían en la siguiente sincronización.
  const wipeAll = useCallback(async ({ servidor = false } = {}) => {
    if (servidor && bankBase()) {
      for (const c of loadBank().connections || []) {
        if (c.sessionId) { try { await bankFetch(`/bank/revoke?session=${encodeURIComponent(c.sessionId)}`, 15000); } catch { /* best-effort */ } }
      }
      try {
        const r = await fetch(bankBase() + "/store", { method: "DELETE", headers: bankHeaders() });
        if (!r.ok) throw new Error("el backend devolvió " + r.status);
      } catch (e) { setError("No se ha podido borrar tu copia del servidor (" + e.message + "). Lo de este dispositivo sí se ha borrado; vuelve a intentarlo desde Ajustes."); }
      try { window.localStorage.removeItem(BANK_KEY); window.localStorage.removeItem(SYNC_KEY); } catch { /* sin acceso */ }
      setBankCfg(loadBank()); setSyncCfg(loadSync());
    }
    try { window.localStorage.removeItem(CHATS_KEY); } catch { /* sin acceso */ }
    setChatStore(() => { const c = newConv(); return { convs: [c], activeId: c.id }; });
    bootProtectRef.current = false; // borrado explícito: deja de proteger la copia previa
    await STORE.del(STORE_KEYS.movs);
    await STORE.del(STORE_KEYS.cfg);
    try { for (const t of await listSnapshots(STORE)) await STORE.del(SNAP_PREFIX + t); } catch { /* best-effort */ }
    lastSnapRef.current = 0; setSnapCount(0);
    MOV_ID = 1;
    setMovs([]); setAssets([]); setGroups([]); setBudgets({});
    setRules(DEFAULT_RULES); setReducible(new Set(DEFAULT_REDUCIBLE));
    setRuleStats({}); setMaterialidad(DEFAULT_MATERIALIDAD); setAssetMem({});
    setAi(DEFAULT_AI_CFG); setAiProfiles([]); setAiDetail(false);
    setDrill(null); setImp(null); setPendingNotice(0); setError(null); setTab("resumen");
    setFilters((f) => ({ ...f, periodType: "all", month: "", from: "", to: "", cats: new Set(), assetsSel: new Set(), groupsSel: new Set() }));
  }, []);

  const exportJSON = useCallback(() => {
    try {
      const cfg = JSON.parse(serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem }));
      // Privacidad: la clave de API NO viaja en la copia exportada (podrías compartir el
      // archivo). Se queda solo en este navegador; al reimportar la vuelves a poner.
      if (cfg.ai) cfg.ai = { ...cfg.ai, apiKey: "" };
      if (Array.isArray(cfg.aiProfiles)) cfg.aiProfiles = cfg.aiProfiles.map((p) => ({ ...p, apiKey: "" }));
      const payload = {
        app: "finanzas-personales", version: 3, exportado: new Date().toISOString(),
        cfg,
        movs: JSON.parse(serializeMovs(movs)),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `finanzas-copia-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) { setError("No se pudo exportar la copia: " + e.message); }
  }, [rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, movs, ruleStats, materialidad, assetMem]);

  const applyBackupPayload = useCallback((p, { deArchivo = false } = {}) => {
    const ms = deserializeMovs(JSON.stringify(p.movs));
    // Un archivo puede venir de cualquiera (una «plantilla de reglas» compartida). No debe poder
    // cambiar a dónde van tus datos: ni el servidor ni el proveedor de IA ni si la IA está activa.
    const cfg = deArchivo ? { ...p.cfg, ai: undefined, aiProfiles: undefined, aiOn: undefined, aiDetail: undefined } : p.cfg;
    applyCfg(JSON.stringify(cfg), { setAssets, setGroups, setBudgets, setReducible, setRules, setAiOn, setAi, setAiProfiles, setAiDetail, setRuleStats, setMaterialidad, setAssetMem });
    // La config del banco viaja en las copias del servidor (no en las exportadas, que se comparten):
    // así conectas una vez y el resto de dispositivos hereda sesión, cuenta y token.
    // La copia del servidor puede ser ANTERIOR a la sesión bancaria que acabas de crear en este
    // dispositivo: al volver del banco se hace un arranque completo y el "traer" automático
    // llegaba después, borrando la sesión nueva (y a veces worker y token). Solo se aplica si
    // la copia es más reciente, y nunca si viene vacía habiendo config local.
    const merged = deArchivo ? null : mergeBank(loadBank(), p.bank);
    if (merged) { saveBank(merged); try { window.dispatchEvent(new Event("finz-bank-updated")); } catch { /* noop */ } }    let mx = 0;
    for (const m of ms) if (typeof m.id === "number" && m.id > mx) mx = m.id;
    MOV_ID = mx + 1;
    setMovs(ms);
    return ms.length;
  }, []);

  const importJSON = useCallback(async (file) => {
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      if (!p || !p.movs || !p.cfg) return { ok: false, text: "El archivo no parece una copia de esta aplicación." };
      const n = applyBackupPayload(p, { deArchivo: true });
      return { ok: true, text: `Copia restaurada: ${nfNum.format(n)} movimientos.` };
    } catch (e) { return { ok: false, text: "No se pudo importar: " + e.message }; }
  }, [applyBackupPayload]);

  /* ---------- Sincronización con tu Worker (D1) ---------- */
  const [syncCfg, setSyncCfg] = useState(loadSync);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [syncConflict, setSyncConflict] = useState(null); // { version, updatedAt }
  const persistSync = useCallback((patch) => setSyncCfg((c) => { const n = { ...c, ...patch }; saveSync(n); return n; }), []);

  // El cuerpo que se sube: mismo formato que la copia exportable, para poder restaurar entre ambas
  // y puedas volver atrás sin convertir nada.
  const syncPayload = useCallback(() => ({
    app: "finanzas-personales", version: 3, updatedAt: Date.now(),
    // Ni las claves de IA ni el token del backend van a la copia del servidor: quien consiga esa
    // copia (o el token) no debe llevarse además las llaves para usarlas en otro sitio.
    cfg: JSON.parse(serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai: { ...ai, apiKey: "" }, aiProfiles: (aiProfiles || []).map((p) => ({ ...p, apiKey: "" })), aiDetail, ruleStats, materialidad, assetMem })),
    movs: JSON.parse(serializeMovs(movs)),
    bank: { ...loadBank(), token: "" },
  }), [rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, movs]);

  const syncPush = useCallback(async ({ silent, force, payload } = {}) => {
    const url = bankBase();
    if (!url) { if (!silent) setSyncMsg({ kind: "err", text: "Pon la URL del backend (tu Worker) en la sección de arriba." }); return; }
    setSyncBusy(true); if (!silent) setSyncMsg(null);
    const t0 = Date.now();
    try {
      const base = force ? null : (Number(loadSync().version) || 0);
      // Con `force` hay que leer primero la versión real: subir a ciegas volvería a abrir la
      // puerta a pisar lo de otro dispositivo, que es justo lo que esto viene a cerrar.
      let baseVersion = base;
      if (force) {
        const cur = await bankFetch("/store", 25000);
        const curData = cur.ok ? await cur.json() : null;
        baseVersion = curData ? (Number(curData.version) || 0) : 0;
        // Red de seguridad contra el accidente más caro: subir a la fuerza desde un dispositivo
        // casi vacío (una ventana de incógnito, un móvil recién configurado) y arrasar la copia
        // buena. El rechazo por versión no cubre este caso, porque forzar lo salta a propósito.
        const aqui = stateRef.current?.movs?.length || 0;
        const alli = (curData?.payload?.movs?.movs || curData?.payload?.movs || []).length || 0;
        if (alli > 20 && aqui < alli / 2) {
          const seguir = window.confirm(
            [
              `Atención: en el servidor hay ${nfNum.format(alli)} movimientos y en este dispositivo solo ${nfNum.format(aqui)}.`,
              "Si subes, los del servidor se reemplazan por los de aquí. ¿Es lo que quieres?",
              "Si estás probando en una ventana nueva o en otro dispositivo, lo que buscas es «Traer», no «Subir».",
            ].join("\n\n")
          );
          if (!seguir) { setSyncMsg({ kind: "info", text: "Cancelado. No se ha subido nada." }); return; }
        }
      }
      const res = await fetch(url + "/store", {
        method: "PUT", headers: { ...bankHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion, payload: payload || syncPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSyncConflict({ version: data.version, updatedAt: data.updatedAt });
        setSyncMsg({ kind: "err", text: `Otro dispositivo guardó después que tú${data.updatedAt ? ` (${new Date(data.updatedAt).toLocaleString("es-ES")})` : ""}. No he subido nada: elige abajo qué conservar.` });
        return { conflict: true };
      }
      if (!res.ok) throw new Error(data.error || "el backend devolvió " + res.status);
      // Lo pendiente queda subido, salvo que hayas cambiado algo mientras tanto.
      const pend = Number(loadSync().pendiente) || 0;
      persistSync({ version: data.version, lastPush: Date.now(), ...(pend && pend <= t0 ? { pendiente: null } : {}) });
      setSyncConflict(null);
      if (!silent) setSyncMsg({ kind: "ok", text: `Guardado en tu Worker (versión ${data.version}).` });
      return { ok: true };
    } catch (e) { if (!silent) setSyncMsg({ kind: "err", text: "No se pudo guardar: " + e.message }); return { ok: false }; }
    finally { setSyncBusy(false); }
  }, [persistSync, syncPayload]);

  const syncPull = useCallback(async ({ silent, confirmReplace } = {}) => {
    const url = bankBase();
    if (!url) { if (!silent) setSyncMsg({ kind: "err", text: "Pon la URL del backend (tu Worker) en la sección de arriba." }); return; }
    setSyncBusy(true); if (!silent) setSyncMsg(null);
    try {
      const res = await bankFetch("/store", 30000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "el backend devolvió " + res.status);
      if (data.empty) { if (!silent) setSyncMsg({ kind: "info", text: "Tu Worker aún no tiene copia. Pulsa «Guardar» para crear la primera." }); return { ok: false, empty: true, text: "Tu backend responde, pero aún no tiene ninguna copia. Guárdala primero desde el dispositivo donde tienes tus datos." }; }
      // Traer REEMPLAZA lo local: se confirma siempre que haya algo que perder.
      const locales = stateRef.current?.movs?.length || 0;
      if (confirmReplace && locales && !window.confirm(`Vas a reemplazar los ${nfNum.format(locales)} movimientos de este dispositivo por la copia del servidor (versión ${data.version}).\n\n¿Continuar?`)) {
        setSyncMsg({ kind: "info", text: "Cancelado. No se ha tocado nada." });
        return { ok: false, text: "Cancelado. No se ha tocado nada." };
      }
      const n = applyBackupPayload(data.payload);
      persistSync({ version: data.version, lastPull: Date.now(), pendiente: null });
      setSyncConflict(null);
      if (!silent) setSyncMsg({ kind: "ok", text: `Traídos ${nfNum.format(n)} movimientos (versión ${data.version}).` });
      return { ok: true, n, version: data.version };
    } catch (e) { if (!silent) setSyncMsg({ kind: "err", text: "No se pudo traer: " + e.message }); return { ok: false, text: "No se pudo traer: " + e.message }; }
    finally { setSyncBusy(false); }
  }, [applyBackupPayload, persistSync]);

  // Historial del servidor: las 10 últimas versiones y una por día del último mes.
  const syncHistory = useCallback(async () => {
    try {
      const r = await bankFetch("/store/history", 20000);
      const d = await r.json().catch(() => ({}));
      return r.ok ? { versions: d.versions || [] } : { error: d.error || "el backend devolvió " + r.status };
    } catch (e) { return { error: e.message }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Recuperar una versión: sustituye lo de aquí y se guarda como versión nueva (la actual sigue
  // en el historial, así que recuperar también se puede deshacer).
  const syncRestore = useCallback(async (v) => {
    const d = new Date(v.updatedAt).toLocaleString("es-ES");
    if (!window.confirm(`Vas a recuperar la versión ${v.version} (${d}). Lo que tienes ahora se sustituye, pero queda en el historial por si quieres volver.\n\n¿Continuar?`)) return;
    setSyncBusy(true); setSyncMsg(null);
    try {
      const r = await bankFetch("/store/history?version=" + encodeURIComponent(v.version), 30000);
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.payload) throw new Error(data.error || "el backend devolvió " + r.status);
      syncSuppressRef.current = Date.now() + 6000;
      const n = applyBackupPayload(data.payload);
      setSyncBusy(false);
      // Se sube la versión recuperada tal cual (con la conexión bancaria de ahora, sin token):
      // syncPayload todavía tiene el estado de antes de recuperar y subiría eso.
      const p = await syncPush({ silent: true, payload: { ...data.payload, updatedAt: Date.now(), bank: { ...loadBank(), token: "" } } });
      setSyncMsg(p?.ok ? { kind: "ok", text: `Recuperada la versión ${v.version}: ${nfNum.format(n)} movimientos. Guardada como versión nueva.` }
        : { kind: "err", text: `Recuperada la versión ${v.version} en este dispositivo, pero no se ha podido guardar en el servidor: revisa el aviso de arriba.` });
    } catch (e) { setSyncMsg({ kind: "err", text: "No se pudo recuperar: " + e.message }); }
    finally { setSyncBusy(false); }
  }, [applyBackupPayload, syncPush]);

  const syncBootRef = useRef(false);
  const syncTimer = useRef(null);
  const syncSuppressRef = useRef(0); // ventana tras un "traer" en la que NO se re-sube

  // Traer al abrir, una sola vez. Si hay conflicto no se aplica nada: decide la persona.
  useEffect(() => {
    if (!booted || syncBootRef.current) return;
    if (!syncCfg.auto || !bankBase()) return;
    // Al volver del banco manda el estado de ESTE dispositivo: traer aquí lo pisaría, que es
    // el fallo que ya nos costó una sesión bancaria.
    try { if (new URLSearchParams(window.location.search).has("bank_session")) return; } catch { /* noop */ }
    syncBootRef.current = true;
    syncSuppressRef.current = Date.now() + 6000;
    // Si la última vez cerraste antes de que se subieran tus cambios, traer la copia del servidor
    // los borraría sin avisar (pasaba al cerrar en menos de 25 s, lo normal en el móvil). Se
    // suben primero; si otro dispositivo guardó entre medias, decides tú.
    if (loadSync().pendiente) {
      syncPush({ silent: true }).then((r) => {
        if (r?.conflict) setError("Tienes cambios de este dispositivo que no llegaron a subirse, y otro dispositivo ha guardado después. No se ha perdido nada: decide qué conservar en Ajustes → Sincronizar con tu backend.");
      });
      return;
    }
    syncPull({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, syncCfg.auto]);

  // Guardar tras cambiar, con mucha espera. Si hay un conflicto sin resolver no se reintenta
  // en bucle: se espera a que la persona decida.
  useEffect(() => {
    if (!booted || !syncCfg.auto || !bankBase() || syncConflict) return;
    if (Date.now() < syncSuppressRef.current) return;
    // Anotado en disco al momento: si cierras antes de los 25 s, al volver se sabe que hay que subir.
    persistSync({ pendiente: Date.now() });
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncPush({ silent: true }), 25000);
    return () => clearTimeout(syncTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs, rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, syncCfg.auto, syncConflict, booted]);

  // Al cerrar o esconder la pestaña, volcar lo pendiente: el temporizador de 25 s se cancela
  // al desmontar y perderiamos el ultimo cambio.
  useEffect(() => {
    if (!booted || !syncCfg.auto) return;
    const flush = () => {
      if (document.visibilityState !== "hidden" || !bankBase() || syncConflict) return;
      clearTimeout(syncTimer.current);
      syncPush({ silent: true });
    };
    window.addEventListener("visibilitychange", flush);
    return () => window.removeEventListener("visibilitychange", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, syncCfg.auto, syncConflict]);

  /* ---------- Conexión bancaria (Enable Banking, vía el Worker) — MULTI-BANCO ---------- */
  const [bankCfg, setBankCfg] = useState(loadBank);

  // Entrar con una cuenta que ya existe: guarda URL y token, trae la copia y deja la
  // sincronización automática encendida. Es lo que antes había que hacer en cuatro sitios
  // distintos, y lo que se olvidaba (la casilla de «automático» es de cada navegador y no
  // viaja con los datos). Al acabar, ofrece guardar el acceso en el gestor de contraseñas.
  // Al terminar de montar el backend en el asistente: sincronización automática encendida y
  // primera copia en el servidor. Sin esto el asistente acababa «bien» pero nada se guardaba
  // fuera, y el disparador del servidor no tenía ningún banco que revisar.
  const activarSync = useCallback(async () => {
    syncBootRef.current = true;
    syncSuppressRef.current = Date.now() + 6000;
    persistSync({ auto: true });
    const r = await syncPull({ silent: true, confirmReplace: true });
    if (r?.empty) await syncPush({ silent: true });
     
  }, [syncPull, syncPush, persistSync]);
  const [entrarOpen, setEntrarOpen] = useState(null); // null | { inicial?: {u,t}, auto?: bool }
  const entrar = useCallback(async (u, t) => {
    const prev = loadBank(), prevSync = loadSync();
    if (!/^https:\/\//.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u)) return { ok: false, text: "La dirección del backend debe empezar por https://." };
    // Cambiar de servidor manda tus datos a otro sitio: un enlace ajeno no debe poder hacerlo
    // sin que lo veas. Se enseña el servidor de antes y el nuevo.
    const host = (x) => { try { return new URL(x).host; } catch { return x; } };
    if (prev.workerUrl && prev.workerUrl !== u && !window.confirm(`Vas a cambiar tu servidor:\n\nAhora: ${host(prev.workerUrl)}\nNuevo: ${host(u)}\n\nHazlo solo si el enlace es tuyo y lo esperabas. Tus datos se guardarán en el nuevo servidor.`)) {
      return { ok: false, text: "Cancelado: sigues con tu servidor de siempre." };
    }
    // Mientras se comprueba, nada se sube solo; si algo falla, se deja todo como estaba.
    // saveBank no deja sustituir una config con datos por una vacía (su red de seguridad); aquí sí
    // hay que volver a la vacía de un dispositivo nuevo, así que se escribe directamente.
    const deshacer = (res) => { if (bankIsEmpty(prev)) setItemSeguro(BANK_KEY, JSON.stringify(prev)); else saveBank(prev); setBankCfg(loadBank()); persistSync(prevSync); return res; };
    syncBootRef.current = true;
    syncSuppressRef.current = Date.now() + 60000;
    clearTimeout(syncTimer.current);
    persistSync({ auto: false });
    // A disco ANTES de traer: syncPull lee la URL y el token de ahí, no del estado de React.
    saveBank({ ...prev, workerUrl: u, token: t || prev.token || "" });
    setBankCfg(loadBank());
    try {
      const st = await bankFetch("/store/status", 20000);
      if (st.status === 401) return deshacer({ ok: false, text: "El backend responde, pero el token no es correcto." });
      if (!st.ok) return deshacer({ ok: false, text: `El backend devolvió ${st.status}. Revisa la dirección.` });
    } catch (e) { return deshacer({ ok: false, text: "No se pudo contactar con el backend: " + e.message }); }
    const r = await syncPull({ confirmReplace: true });
    if (!r?.ok) return deshacer(r || { ok: false, text: "No se pudo traer la copia." });
    syncSuppressRef.current = Date.now() + 6000;
    persistSync({ auto: true });
    recordarAcceso(u, t);
    const nb = (loadBank().connections || []).length;
    return { ok: true, text: `Listo: ${nfNum.format(r.n)} ${r.n === 1 ? "movimiento traído" : "movimientos traídos"}${nb ? ` y ${nb} ${nb === 1 ? "banco heredado" : "bancos heredados"}` : ""}. La sincronización automática queda activada en este navegador.` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncPull, persistSync]);
  // Abrir el enlace personal de acceso. Se borra de la barra al momento: lleva el token.
  // Si este navegador ya está conectado a ese mismo backend, no hay nada que hacer.
  useEffect(() => {
    if (!booted) return;
    const p = parseAccessLink(window.location.hash);
    if (!p) return;
    try { window.history.replaceState({}, "", window.location.pathname + window.location.search); } catch { /* noop */ }
    const b = loadBank();
    if (!p.cif && b.workerUrl === p.u && b.token === p.t && loadSync().version) return;
    setEntrarOpen({ inicial: p });
  }, [booted]);
  // En un navegador vacío, si el gestor de contraseñas ya guarda tu acceso, se ofrece entrar con
  // un toque, como el «Continuar como…» de otras webs. Solo donde no hay nada que perder (sin
  // datos ni backend) y una vez por sesión, para no insistir a quien lo descarta.
  useEffect(() => {
    if (!booted || movs.length || loadBank().workerUrl || LLEGA_CON_ENLACE) return;
    try { if (sessionStorage.getItem("finz:onetap")) return; sessionStorage.setItem("finz:onetap", "1"); } catch { /* noop */ }
    leerAccesoGuardado().then((c) => { if (c) setEntrarOpen({ inicial: c, auto: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);
  // persistBank acepta un patch { ... } o una función (b) => nuevoEstado.
  const persistBank = useCallback((patchOrFn) => setBankCfg((b) => { const n = typeof patchOrFn === "function" ? patchOrFn(b) : { ...b, ...patchOrFn }; saveBank(n); return n; }), []);
  useEffect(() => { if (settingsOpen) setBankCfg(loadBank()); }, [settingsOpen]);
  // Última revisión automática del servidor (el cron del Worker). Se pregunta al arrancar y al
  // abrir Ajustes: es la única forma de saber si los movimientos siguen entrando con la app
  // cerrada, y la cabecera la necesita para no decir «hace 15 h» cuando el servidor revisó hace 2.
  const [cronInfo, setCronInfo] = useState(null); // null | { at, nuevos, errores, cuentas } | { viejo: true }
  useEffect(() => {
    if (!bankBase() || !(loadBank().connections || []).length) return;
    bankFetch("/store/cron", 15000).then((r) => (r.ok ? r.json() : null))
      // Un backend sin actualizar no conoce /store/cron y devuelve la copia de tus datos.
      .then((d) => setCronInfo(d && "at" in d ? d : { viejo: true }))
      .catch(() => setCronInfo(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, bankCfg.workerUrl]);
  // Versión del backend: cada persona tiene el suyo y no se actualiza solo. Si le faltan
  // capacidades que esta app usa, se avisa en Ajustes con qué gana al actualizarlo.
  const [backendInfo, setBackendInfo] = useState(null); // null | { version, rasgos } | { viejo: true }
  useEffect(() => {
    if (!settingsOpen || !bankBase()) return;
    fetch(bankBase() + "/version").then((r) => (r.ok ? r.json() : null))
      .then((d) => setBackendInfo(d && Array.isArray(d.rasgos) ? d : { viejo: true }))
      .catch(() => setBackendInfo(null));
     
  }, [settingsOpen, bankCfg.workerUrl]);
  // Diagnóstico para pedir ayuda: estado de la app SIN datos personales (ni importes, ni
  // conceptos, ni token, ni claves). Se copia al portapapeles.
  const diagnostico = () => {
    const b = loadBank(), sy = loadSync();
    const host = (() => { try { return new URL(b.workerUrl).host; } catch { return b.workerUrl ? "(dirección no válida)" : "(sin backend)"; } })();
    const fecha = (t) => (t ? new Date(t).toISOString() : null);
    return JSON.stringify({
      generado: new Date().toISOString(), app: BUILD_STAMP, navegador: navigator.userAgent, almacenamiento: STORE.kind, guardado: saveState,
      movimientos: movs.length, enPapelera: movs.filter((m) => m.omit).length, porRevisar: movs.filter((m) => m.confirmed === false && !m.omit).length,
      rango: dataRange ? [isoDay(dataRange[0]), isoDay(dataRange[1])] : null, activos: assets.length, reglasPropias: rules.filter((x) => x.scope === "personal").length,
      backend: { host, version: backendInfo?.version || (backendInfo?.viejo ? "antigua" : null), rasgos: backendInfo?.rasgos || null },
      sincronizacion: { automatica: !!sy.auto, version: sy.version || 0, pendiente: !!sy.pendiente, ultimaSubida: fecha(sy.lastPush), ultimaBajada: fecha(sy.lastPull), conflicto: !!syncConflict },
      bancos: (b.connections || []).map((c) => ({ banco: c.aspsp || "(sin nombre)", cuentaElegida: !!c.accountUid, ultimaConsulta: fecha(c.lastSync), ultimoMovimiento: c.lastNewest || null, caducado: !!c.expired, limiteDiario: c.limitedAt || null, error: c.lastError || null })),
      revisionAutomatica: cronInfo ? (cronInfo.viejo ? "backend antiguo" : { cuando: fecha(cronInfo.at), nuevos: cronInfo.nuevos, errores: cronInfo.errores, omitidas: cronInfo.omitidas }) : null,
      ia: { activa: !!aiOn, proveedor: ai?.provider, servidor: (() => { try { return ai?.baseUrl ? new URL(ai.baseUrl).host : null; } catch { return null; } })(), detalle: !!aiDetail },
    }, null, 2);
  };
  useEffect(() => {
    const h = () => setBankCfg(loadBank());
    window.addEventListener("finz-bank-updated", h);
    return () => window.removeEventListener("finz-bank-updated", h);
  }, []);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState(null);
  const [bankAspsps, setBankAspsps] = useState([]);          // lista de bancos del país cargado
  const [bankAccountsByConn, setBankAccountsByConn] = useState({}); // connId -> cuentas
  const [bankAddCountry, setBankAddCountry] = useState("ES");
  const [bankAddSel, setBankAddSel] = useState("");          // banco elegido para añadir
  const [bankDiag, setBankDiag] = useState(null);            // salida cruda del diagnóstico
  const [asistenteOpen, setAsistenteOpen] = useState(false); // asistente de conexión del backend
  const [bankAddPsu, setBankAddPsu] = useState("personal");  // titular: personal o empresa

  const [vueltaAjena, setVueltaAjena] = useState(null); // URL de vuelta del banco caída en otro navegador
  const [vueltaBanco, setVueltaBanco] = useState(null); // sesión recién traída del banco, por terminar de conectar
  // Al volver del banco, ?bank_session=… : creamos una conexión con el banco que estaba pendiente.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const sid = p.get("bank_session");
      if (!sid) return;
      // Se decide aquí, con lo que hay en disco: el updater de persistBank corre más tarde y
      // leer su resultado desde este ámbito daría siempre el valor viejo.
      const disk = loadBank();
      // Volver del banco a un navegador que no tiene tu backend: en el iPhone, la app del banco
      // abre el navegador predeterminado (Safari) aunque empezaras en otro. Aquí la sesión no
      // sirve de nada y antes se perdía en silencio: firmabas, «no volvía» y había que repetir.
      // Se deja el enlace intacto y se explica cómo llevarlo al navegador bueno.
      if (!disk.workerUrl) { setVueltaAjena(window.location.href); return; }
      // Un pending de hace horas es de un intento abandonado: usarlo hace que la sesión nueva
      // aterrice sobre la conexión que tocaba entonces y herede su cuenta caducada. La misma
      // regla tiene que valer aquí y dentro del updater, o el mensaje diría una cosa y el
      // estado haría otra.
      const isFresh = (pd) => !!pd && (!pd.at || Date.now() - pd.at < 30 * 60000);
      // Con backend actualizado la vuelta trae &n= (el código del pending): vale durante un día.
      // Sin él (backend antiguo), como antes: un pending de menos de media hora.
      const n = p.get("n");
      const pendOk = (pd) => !!pd && (n ? pd.nonce === n && Date.now() - (pd.at || 0) < 86400000 : isFresh(pd));
      // Una vuelta que esta app no ha pedido (enlace ajeno o reenviado) no toca tus bancos sin
      // preguntarte: antes bastaba un enlace para sustituir la sesión de tu único banco.
      if (!pendOk(disk.pending) && !window.confirm("Ha llegado una conexión bancaria que no has iniciado ahora desde esta app.\n\n¿Vienes de autorizar tu banco? Si no, pulsa Cancelar y no se cambiará nada.")) {
        p.delete("bank_session"); p.delete("n");
        window.history.replaceState({}, "", window.location.pathname + (p.toString() ? "?" + p.toString() : ""));
        return;
      }
      // Qué hacer con la sesión que llega. Antes, sin un pending fresco se creaba una conexión
      // llamada «Banco»: pasa si vuelves del banco en OTRO navegador (la app del banco abre el
      // predeterminado) o tardas más de media hora. Esa conexión viajaba por la sincronización y
      // al renovarla Enable Banking contestaba WRONG_ASPSP_PROVIDED, porque «Banco» no es un banco.
      // Ahora: pending fresco → lo que dice; si no, el nombre del pending viejo; y si no hay
      // nada pero solo tienes un banco, es casi seguro su renovación.
      const decide = (b) => {
        const conns = b.connections || [];
        if (pendOk(b.pending)) {
          const pd = b.pending;
          const target = pd.reconnectId && conns.some((c) => c.id === pd.reconnectId) ? pd.reconnectId : null;
          return { target, aspsp: pd.aspsp || "", country: pd.country || "ES", psu: pd.psu || "" };
        }
        if (b.pending?.aspsp) return { target: null, aspsp: b.pending.aspsp, country: b.pending.country || "ES", psu: b.pending.psu || "" };
        const named = conns.filter((c) => c.aspsp && c.aspsp !== "Banco");
        if (conns.length === 1) return { target: conns[0].id, aspsp: named[0]?.aspsp || "", country: conns[0].country || "ES", psu: conns[0].psu || "" };
        return { target: null, aspsp: "", country: "ES", psu: "" };
      };
      const plan = decide(disk);
      const renew = !!plan.target;
      persistBank((b) => {
        const d = decide(b);
        // Reconectar un banco que ya estaba: se cambia la sesión de esa misma conexión. Antes se
        // añadía una conexión nueva y quedaba la vieja (muerta) al lado, sincronizando en balde.
        // La cuenta elegida NO se conserva: los uid de Enable Banking son por sesión y al renovar
        // cambian, así que el uid viejo filtraba a cero cuentas y la sincronización moría con
        // «la sesión no contiene esa cuenta». Se limpia y se vuelve a elegir.
        if (d.target) return { ...b, pending: null, connections: (b.connections || []).map((c) => (c.id === d.target ? { ...c, ...(d.aspsp ? { aspsp: d.aspsp } : {}), sessionId: sid, accountUid: "", accountName: "", psu: d.psu || c.psu || "", sessionPsu: d.psu || "", lastError: null, lastErrorAt: null, expired: false } : c)) };
        const conn = { id: "bc" + Date.now() + Math.random().toString(36).slice(2, 5), aspsp: d.aspsp, country: d.country, psu: d.psu, sessionPsu: d.psu, sessionId: sid, accountUid: "", accountName: "", lastSync: null };
        return { ...b, connections: [...(b.connections || []), conn], pending: null };
      });
      p.delete("bank_session"); p.delete("n");
      window.history.replaceState({}, "", window.location.pathname + (p.toString() ? "?" + p.toString() : ""));
      // Lo que antes había que saber hacer a mano al volver: elegir la cuenta y sincronizar. Si
      // la sesión trae una sola cuenta (o es una renovación que se reencuentra por IBAN), se
      // hace solo; con varias, se cargan para que solo haya que elegir. Y la sincronización al
      // abrir queda encendida, que si no nadie la activa.
      // Se sigue cuando la app haya cargado tus datos (efecto «vueltaBanco», más abajo): hacerlo
      // aquí usaba las funciones del primer render, con la lista de movimientos aún vacía, así
      // que se clasificaba sin tus reglas y sin descartar lo que ya tenías de tus Excel.
      setVueltaBanco(sid);
      if (!plan.aspsp) setBankMsg({ kind: "err", text: "Has vuelto del banco, pero este navegador no sabe de qué banco era (¿empezaste en otro navegador?). La conexión funciona para sincronizar; si algún día hay que renovarla, quítala y añade tu banco de nuevo." });
      else setBankMsg({ kind: "ok", text: renew ? "Permiso renovado. La cuenta hay que volver a elegirla (al renovar cambian los identificadores): pulsa «Ver cuentas» y luego Sincronizar." : "Banco conectado. Elige la cuenta y sincroniza." });
      setSettingsOpen(true);
    } catch (e) { setBankMsg({ kind: "err", text: "Has vuelto del banco, pero no se ha podido guardar la conexión: " + ((e && e.message) || e) + ". Vuelve a intentarlo desde Ajustes → Banco." }); }
  }, [persistBank]);

  const bankHeaders = () => { const b = loadBank(); return b.token ? { Authorization: "Bearer " + b.token } : {}; };
  // Sin límite de tiempo, una petición que no vuelve dejaba `bankBusy` en true y el candado de
  // sincronización atascado: los botones Sincronizar y Reconectar quedaban muertos y parecía
  // que la app ignoraba los clics. Todo lo bancario pasa por aquí.
  const bankFetch = async (path, ms = 45000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      return await fetch(bankBase() + path, { headers: bankHeaders(), signal: ac.signal });
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`no hubo respuesta en ${Math.round(ms / 1000)} s; vuelve a intentarlo en un rato`);
      throw e;
    } finally { clearTimeout(t); }
  };
  const bankBase = () => (loadBank().workerUrl || "").replace(/\/+$/, "");

  const bankLoadAspsps = useCallback(async (country) => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    setBankBusy(true); setBankMsg(null);
    try {
      const res = await bankFetch(`/bank/aspsps?country=${encodeURIComponent(country || "ES")}`, 25000);
      if (!res.ok) throw new Error("el backend devolvió " + res.status);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.aspsps || []);
      const names = [...new Set(list.map((a) => a.name).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es"));
      setBankAspsps(names);
      setBankMsg({ kind: names.length ? "info" : "err", text: names.length ? `${names.length} bancos en ${country}. Elige el tuyo y pulsa Conectar.` : "No se han encontrado bancos para ese país." });
    } catch (e) { setBankMsg({ kind: "err", text: "No se pudieron cargar los bancos: " + e.message }); }
    finally { setBankBusy(false); }
  }, []);

  // Salida hacia el banco. `reconnectId` marca que volvemos a autorizar una conexión que ya
  // existe (renovar permiso) en vez de dar de alta otra.
  const bankStartAuth = useCallback((aspsp, country, reconnectId, psu) => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    if (!aspsp) { setBankMsg({ kind: "err", text: "Elige un banco de la lista." }); return; }
    const cty = (country || "ES").toUpperCase();
    // El pending tiene que estar EN DISCO antes de abandonar la página: persistBank solo
    // programa un cambio de estado y su updater (el que llama a saveBank) puede no llegar a
    // ejecutarse antes de la navegación. Por eso perdíamos el nombre del banco al volver.
    // `nonce`: código de un solo uso que el backend devuelve al volver (&n=). Solo una vuelta con
    // ese código es la que pediste; un enlace ?bank_session= que te manden no lo tiene.
    const nonce = b64u(crypto.getRandomValues(new Uint8Array(16)));
    const next = { ...loadBank(), pending: { aspsp, country: cty, reconnectId: reconnectId || null, psu: psu || "", at: Date.now(), nonce } };
    saveBank(next);
    setBankCfg(next);
    // El tipo de titular viaja en la URL: pedir "personal" sobre cuentas de empresa deja firmar
    // el consentimiento y luego revienta cada petición de datos con ASPSP_ERROR.
    window.location.href = `${url}/bank/auth?aspsp=${encodeURIComponent(aspsp)}&country=${encodeURIComponent(cty)}${psu ? `&psu=${encodeURIComponent(psu)}` : ""}&nonce=${nonce}`;
  }, []);

  const bankAddConnect = useCallback(() => bankStartAuth(bankAddSel, bankAddCountry, null, bankAddPsu), [bankStartAuth, bankAddSel, bankAddCountry, bankAddPsu]);
  const bankReconnect = useCallback((connId) => {
    const c = (loadBank().connections || []).find((x) => x.id === connId);
    if (!c) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    // Una conexión sin nombre de banco real no se puede renovar: Enable Banking necesita saber
    // a qué banco mandarte y respondería WRONG_ASPSP_PROVIDED.
    if (!c.aspsp || c.aspsp === "Banco") {
      setBankMsg({ kind: "err", text: "Esta conexión no guarda de qué banco es, así que no se puede renovar. Quítala con la papelera y añade tu banco en «Añadir banco»." });
      return;
    }
    // Reconectar renueva el permiso pasando otra vez por el banco y obliga a volver a elegir
    // la cuenta. En un dispositivo recién vinculado parece el botón de «conectar aquí», y no
    // lo es: la conexión ya viene heredada. Con una conexión sana, se pregunta antes.
    if (!c.expired && !c.lastError && c.accountUid && !window.confirm(
      `La conexión con ${c.aspsp} funciona y ya está disponible en este dispositivo: no hace falta reconectar.\n\nReconectar solo sirve cuando el permiso ha caducado (unos 90 días). Te llevará al banco a firmar otra vez y tendrás que volver a elegir la cuenta.\n\n¿Reconectar de todos modos?`
    )) return;
    bankStartAuth(c.aspsp, c.country, connId, c.psu || "");
  }, [bankStartAuth]);
  // Cambiar el tipo de titular de una conexión ya creada, para que Reconectar renueve bien.
  const bankSetPsu = useCallback((connId, psu) => persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, psu } : c)) })), [persistBank]);

  // Diagnóstico: pregunta al backend y enseña el estado y el cuerpo TAL CUAL. Es la única forma
  // de ver el error real de Enable Banking sin abrir la consola del navegador.
  const bankDiagnose = useCallback(async () => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    setBankBusy(true); setBankMsg(null);
    const probe = async (label, path) => {
      try {
        const r = await bankFetch(path, 30000);
        const body = (await r.text()).slice(0, 600).replace(/\s+/g, " ").trim();
        return `${label}: ${r.status} ${r.ok ? "OK" : "ERROR"} · ${body || "(sin cuerpo)"}`;
      } catch (e) { return `${label}: no se pudo conectar (${e.message})`; }
    };
    // El estado va primero: dice si el Worker ve el binding D1, el token y las credenciales.
    // Es lo que convierte "no me funciona" en un dato concreto.
    const lines = [await probe("configuración del Worker", "/store/status"), await probe("app Enable Banking", "/bank/ping"), await probe("bancos", "/bank/aspsps?country=ES")];
    for (const c of loadBank().connections || []) {
      // Lo PRIMERO, la configuración real de la conexión. Diagnosticar sin saber con qué se creó
      // la sesión viva lleva a probar dos veces lo mismo creyendo probar dos cosas distintas.
      lines.push(`config ${c.aspsp} · país=${c.country || "?"} · titular sesión=${c.sessionPsu || "desconocido"} · titular al reconectar=${c.psu || "personal"}`
        + ` · cuenta=${c.accountUid ? (c.accountName || c.accountUid.slice(0, 8)) : "todas"}${c.accountIban ? ` (IBAN ...${c.accountIban.slice(-6)})` : ""}`
        + ` · sesión=${c.sessionId ? c.sessionId.slice(0, 8) + "…" : "(ninguna)"}`);
      // La ficha del banco (validez máxima, psu_types, auth_methods) es lo que explica un
      // "invalid_request" al autorizar.
      lines.push(await probe(`ficha ${c.aspsp}`, `/bank/aspsp?name=${encodeURIComponent(c.aspsp || "")}&country=${encodeURIComponent(c.country || "ES")}`));
      lines.push(await probe(`cuentas ${c.aspsp}`, `/bank/accounts?session=${encodeURIComponent(c.sessionId)}`));
      // Se prueban varios valores del filtro de estado de una tacada: si el banco solo acepta
      // uno, una sola pulsación dice cuál, en vez de una ronda de despliegues por cada variante.
      const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      for (const st of ["BOOK", "ALL", "none"]) {
        lines.push(await probe(`movimientos ${c.aspsp} [estado=${st}]`, `/bank/transactions?session=${encodeURIComponent(c.sessionId)}&from=${desde}&tx_status=${st}`));
      }
    }
    setBankDiag(lines);
    setBankBusy(false);
  }, []);

  const bankLoadAccounts = useCallback(async (connId) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (!url || !conn || !conn.sessionId) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    setBankBusy(true); setBankMsg(null);
    try {
      const res = await bankFetch(`/bank/accounts?session=${encodeURIComponent(conn.sessionId)}`, 30000);
      if (!res.ok) throw new Error("el backend devolvió " + res.status);
      const data = await res.json();
      const list = Array.isArray(data.accounts) ? data.accounts : [];
      setBankAccountsByConn((m) => ({ ...m, [connId]: list }));
      // Al renovar el permiso los uid cambian y la cuenta elegida se queda huérfana. El IBAN sí
      // es estable: si lo tenemos guardado, se vuelve a enganchar sola en vez de obligarte a
      // reconocer tu cuenta entre identificadores opacos.
      let remap = null;
      if (!conn.accountUid && conn.accountIban) {
        const same = list.find((a) => a.iban && a.iban === conn.accountIban);
        if (same) { bankPickAccount(connId, same.uid, same.name || same.iban, same.iban); remap = same.name || same.iban; }
      }
      // Si el banco no da nombre ni IBAN, decirlo: si no, parece que la app no sabe leerlos.
      const opacas = list.filter((a) => !a.iban).length;
      setBankMsg({
        kind: "info",
        text: remap ? `Cuentas cargadas. He vuelto a seleccionar «${remap}» por su IBAN.`
          : `${list.length} cuentas de ${conn.aspsp}. Elige cuál seguir.` + (opacas ? ` El banco no da nombre ni IBAN para ${opacas === list.length ? "ellas" : `${opacas}`}: distínguelas por el saldo.` : ""),
      });
    } catch (e) { setBankMsg({ kind: "err", text: "No se pudieron cargar las cuentas: " + e.message }); }
    finally { setBankBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se guarda también el IBAN: los uid cambian en cada sesión, el IBAN no. Es lo que permite
  // reencontrar TU cuenta al renovar el permiso sin que tengas que adivinar entre hexadecimales.
  const bankPickAccount = useCallback((connId, uid, name, iban) => persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, accountUid: uid || "", accountName: name || "", accountIban: iban || (uid ? c.accountIban : "") || "" } : c)) })), [persistBank]);
  // Quitar un banco borraba solo la copia local y dejaba la sesión viva en Enable Banking y el
  // consentimiento colgado en el banco. Se revoca primero (sin bloquear: si falla, se quita igual).
  const bankRemoveConnection = useCallback(async (connId) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (url && conn?.sessionId) {
      try { await bankFetch(`/bank/revoke?session=${encodeURIComponent(conn.sessionId)}`, 15000); } catch { /* la limpieza remota es best-effort */ }
    }
    persistBank((b) => ({ ...b, connections: (b.connections || []).filter((c) => c.id !== connId) }));
  }, [persistBank]);

  // Ids de banco ya conocidos, en un ref. La deduplicación se hacía contra el `movs` capturado
  // al crear el callback: dos sincronizaciones solapadas (la automática al abrir no marca busy,
  // y tú pulsas Sincronizar) veían el mismo conjunto y metían lo mismo dos veces. El ref se
  // reconstruye con cada cambio de movs Y se amplía en el acto al aceptar movimientos, así la
  // segunda ingesta ve lo que acaba de entrar aunque React aún no haya vuelto a renderizar.
  const bankIdsRef = useRef(new Set());
  useEffect(() => { bankIdsRef.current = new Set(movs.filter((m) => m.bankId).map((m) => m.bankId)); }, [movs]);

  // Ingesta común: mapea, deduplica por id de banco, clasifica y añade. Devuelve nº nuevos.
  const ingestBankMovements = useCallback((list, sourceLabel) => {
    const existing = bankIdsRef.current;
    // Índice de movimientos NO bancarios (histórico manual / xlsx / CSV) por importe en céntimos,
    // para no duplicar contra ellos aunque el banco use otra fecha (±4 días) u otro concepto.
    // Así, si tu Excel llega hasta junio, el banco no vuelve a meter esos mismos movimientos.
    const nonBankByAmt = new Map();
    for (const m of movs) {
      if (m.bankId) continue;
      const cents = Math.round((Number(m.amount) || 0) * 100);
      const t = (m.date instanceof Date ? m.date : new Date(m.date)).getTime();
      if (!isNaN(t)) { if (!nonBankByAmt.has(cents)) nonBankByAmt.set(cents, []); nonBankByAmt.get(cents).push(t); }
    }
    const DAY = 86400000;
    const dupOfNonBank = (r) => {
      const arr = nonBankByAmt.get(Math.round((Number(r.amount) || 0) * 100));
      if (!arr) return false;
      const [y, mo, d] = String(r.date || "").split("-").map(Number);
      if (!(y && mo && d)) return false;
      const t = new Date(y, mo - 1, d, 12, 0, 0).getTime();
      // Cada movimiento de tu histórico solo puede «absorber» UNO del banco. Antes, dos cargos
      // reales del mismo importe en la misma semana (dos cafés, dos recargas) se descartaban
      // los dos si en tu Excel había uno solo.
      const i = arr.findIndex((t2) => Math.abs(t2 - t) <= 4 * DAY);
      if (i < 0) return false;
      arr.splice(i, 1);
      return true;
    };
    const fresh = list.filter((r) => {
      if (r.bankId && existing.has(r.bankId)) return false; // ya importado por el banco
      if (dupOfNonBank(r)) return false;                    // ya está en tu histórico (otra fuente)
      return true;
    }).map((r) => {
      const [y, mo, d] = String(r.date || "").split("-").map(Number);
      const sinFecha = !(y && mo && d);
      const date = sinFecha ? new Date() : new Date(y, mo - 1, d, 12, 0, 0);
      return {
        ...(sinFecha ? { sinFecha: true } : {}), // el banco no dio fecha: hoy, y a revisar
        id: MOV_ID++, date, concept: r.concept || "Sin concepto", amount: Math.round((Number(r.amount) || 0) * 100) / 100,
        saldo: null, pattern: normalizePattern(r.concept || ""), file: sourceLabel || "Banco", bankId: r.bankId || undefined,
        ...(typeof r.saldo === "number" && isFinite(r.saldo) ? { bs: r.saldo } : {}), // saldo tras el movimiento (banco)
        at: Date.now(), // cuándo llegó: decide si su saldo es más nuevo que el leído del banco
        category: null, assetName: undefined, splits: null, groupIds: [], confirmed: false,
        ...(r.accountUid ? { accountUid: r.accountUid } : {}),
        ...(r.currency && r.currency !== "EUR" ? { currency: r.currency } : {}),
      };
    });
    if (!fresh.length) return 0;
    for (const m of fresh) if (m.bankId) existing.add(m.bankId); // visible ya para la siguiente ingesta
    const dec = classifyForImport(fresh, movs, rules, { materialidad, assetMem, vivienda: viviendaPorDefecto(assets, movs) });
    // En otra moneda o sin fecha no se da por bueno: el importe se sumaría como si fueran euros
    // (o en un día que no es). Queda «por revisar», donde se puede convertir el importe.
    const applied = fresh.map((m) => { const x = dec.get(m.id); return { ...m, category: x.cat, assetName: x.asset || undefined, confirmed: m.currency || m.sinFecha ? false : x.confirmed }; });
    for (const n of new Set(applied.map((a) => a.assetName).filter(Boolean))) ensureAsset(n);
    setMovs((ms) => [...ms, ...applied]);
    const pend = applied.filter((m) => m.confirmed === false).length;
    if (pend > 0) { aiAutoRanRef.current = false; setPendingNotice(pend); }
    return fresh.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs, rules, materialidad, assetMem, assets]);

  // Candado: todas las sincronizaciones pasan por la misma cola. Es la segunda mitad de la
  // corrección de duplicados: aunque el ref de ids ya cierra la carrera, dos descargas
  // simultáneas del mismo banco siguen siendo trabajo tirado y peticiones de más al banco.
  // Resumen para la cabecera: cuándo fue la última sincronización y si algo está mal. Es lo que
  // evita tener que entrar en Ajustes para saber si el banco sigue vivo.
  const bankStatus = useMemo(() => {
    const conns = bankCfg.connections || [];
    if (!conns.length) return null;
    // Cuenta también la revisión del servidor si fue limpia: también consulta el banco.
    const cronOk = cronInfo && cronInfo.at && !(cronInfo.errores || []).length && !cronInfo.limite ? cronInfo.at : 0;
    const last = Math.max(cronOk, ...conns.map((c) => c.lastSync || 0));
    const expired = conns.some((c) => c.expired);
    const failed = conns.some((c) => c.lastError && (!c.lastSync || (c.lastErrorAt || 0) > c.lastSync));
    return { last, expired, failed, stale: last > 0 && Date.now() - last > 36 * 3600000 };
  }, [bankCfg, cronInfo]);

  const bankLockRef = useRef(Promise.resolve());
  const bankRunningRef = useRef(0);
  const bankSyncOne = useCallback((connId, opts = {}) => {
    // Si ya hay una sincronización en marcha (p. ej. la automática al abrir, que es silenciosa),
    // esta espera su turno. Antes esperaba sin decir nada y el botón parecía muerto.
    if (!opts.silent) { setBankBusy(true); if (bankRunningRef.current) setBankMsg({ kind: "info", text: "Ya se estaba sincronizando: en cuanto termine, sigo con la tuya." }); }
    const run = () => { bankRunningRef.current++; return bankSyncOneInner(connId, opts).finally(() => { bankRunningRef.current--; if (!opts.silent) setBankBusy(false); }); };
    const p = bankLockRef.current.then(run, run);
    bankLockRef.current = p.catch(() => {});
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestBankMovements, persistBank]);
  const bankSyncOneInner = async (connId, opts = {}) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (!url || !conn || !conn.sessionId) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    if (!opts.silent) { setBankBusy(true); setBankMsg(null); }
    try {
      // Los uid de cuenta cambian al renovar el permiso, así que tras reconectar la cuenta
      // elegida se queda sin uid. Antes eso equivalía a "todas las cuentas" y mezclaba los
      // movimientos de las dos. El IBAN sí es estable: se reencuentra por él, y si no se
      // consigue se PARA. Ampliar el alcance sin avisar no es una opción aceptable.
      let accUid = conn.accountUid || "";
      if (!accUid && conn.accountIban) {
        const ra = await bankFetch(`/bank/accounts?session=${encodeURIComponent(conn.sessionId)}`, 25000);
        if (!ra.ok) throw new Error("no se pudo comprobar qué cuenta sincronizar: el backend devolvió " + ra.status);
        const la = (await ra.json()).accounts || [];
        const match = la.find((a) => a.iban && a.iban === conn.accountIban);
        if (!match) throw new Error(`la cuenta que sigues (IBAN ...${conn.accountIban.slice(-6)}) no aparece en la sesión nueva. Pulsa «Ver cuentas» y vuelve a elegirla; no sincronizo para no mezclar las dos cuentas.`);
        accUid = match.uid;
        bankPickAccount(connId, match.uid, match.name || match.iban, match.iban);
      }
      const acc = accUid ? `&account=${encodeURIComponent(accUid)}` : "";
      // Ventana reciente (barata) siempre que ya haya llegado algo; histórico completo (dos años)
      // solo la primera vez. Antes el botón Sincronizar pedía siempre los dos años: con un banco
      // lento eso pasa del minuto y acababa en «el backend no respondió en 60 s» para traer, en
      // realidad, los movimientos de los últimos días. Lo ya bajado no se pierde: está en local.
      // Si la conexión lleva tiempo rota, 90 días fijos dejarían un agujero: ampliamos la ventana
      // hasta una semana antes del último movimiento que sí llegó.
      // A mano basta con lo nuevo: desde el último movimiento recibido, con margen (14 días como
      // mínimo, para que entren los que el banco confirma con retraso). Con 90 días CaixaBank
      // seguía tardando más del minuto en algunas horas.
      let days = opts.recentDays || (conn.lastNewest ? 14 : 0);
      if (days && conn.lastNewest) {
        const gap = Math.ceil((Date.now() - new Date(conn.lastNewest + "T12:00:00").getTime()) / 86400000) + 7;
        if (gap > days) days = gap;
      }
      const since = days ? `&from=${new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)}` : "";
      const res = await bankFetch(`/bank/transactions?session=${encodeURIComponent(conn.sessionId)}${acc}${since}`, 120000);
      if (!res.ok) throw Object.assign(new Error("HTTP " + res.status + (await bankErrDetail(res))), { httpStatus: res.status });
      const data = await res.json();
      const rows = Array.isArray(data.movements) ? data.movements : [];
      // El Worker devuelve `errors:[{uid,error}]` por cuenta. Si una cuenta falla y otra no,
      // el 200 es legítimo (hay datos), pero el fallo hay que contarlo igual.
      const errs = Array.isArray(data.errors) ? data.errors.map((x) => (x && x.error) || String(x)) : [];
      // Y el backend puede devolver 200 con el error dentro (sesión muerta en Enable Banking).
      // Sin esto la app cantaba «sin novedades» durante meses con el permiso caducado.
      const inner = data.error || data.message || errs[0] || (data.ok === false ? "el backend devolvió ok:false" : null);
      if (!rows.length && inner) throw Object.assign(new Error(String(inner)), { httpStatus: 200 });
      const n = ingestBankMovements(rows, conn.aspsp || "Banco");
      const noId = Number(data.noId) || 0;
      // Fecha del movimiento más reciente que ha devuelto el banco: es lo único que de verdad
      // dice hasta dónde llega la conexión (lastSync solo dice cuándo preguntamos).
      const newest = rows.reduce((mx, r) => (r.date && r.date > mx ? r.date : mx), "");
      // Saldo real de la cuenta (no rompe la sincronización si falla).
      let bal = null;
      try {
        const rb = await bankFetch(`/bank/balance?session=${encodeURIComponent(conn.sessionId)}${acc}`, 25000);
        if (rb.ok) {
          const jb = await rb.json();
          const b0 = (jb.balances || []).find((x) => x.amount != null);
          if (b0) bal = { amount: b0.amount, currency: b0.currency || "EUR", at: b0.at || null, booked: typeof b0.booked === "number" ? b0.booked : null, bookedAt: b0.bookedAt || null };
        }
      } catch { /* saldo opcional */ }
      persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, lastSync: Date.now(), lastCount: rows.length, lastNewest: newest || c.lastNewest || null, lastError: errs.length ? errs.join(" · ") : null, lastErrorAt: errs.length ? Date.now() : null, expired: false, ...(bal ? { balance: bal.amount, balanceCur: bal.currency, balanceAt: bal.at, balanceRead: Date.now(), balanceBooked: bal.booked, balanceBookedAt: bal.bookedAt } : {}) } : c)) }));
      // Distinguir «el banco no manda nada» de «llega pero ya lo tenías» es lo que permite
      // diagnosticar sin abrir la consola: por eso el mensaje dice ambas cifras.
      const detail = n ? `${nfNum.format(n)} movimientos nuevos de ${conn.aspsp}.`
        : rows.length ? `${conn.aspsp}: sin novedades (el banco devolvió ${nfNum.format(rows.length)} movimientos, todos repetidos${newest ? `; el más reciente es del ${newest}` : ""}).`
          : `${conn.aspsp}: el banco no ha devuelto ningún movimiento. Si esperabas movimientos nuevos, el permiso está caducado: pulsa Reconectar.`;
      // Sin referencia del banco la deduplicación es por contenido (cuenta+fecha+importe+concepto):
      // funciona, pero conviene saberlo si algún día aparece un repetido.
      const sinRef = noId ? ` ${nfNum.format(noId)} venían sin referencia del banco (deduplicados por contenido).` : "";
      if (!opts.silent || n || !rows.length) setBankMsg({ kind: rows.length || n ? "ok" : "err", text: detail + (bal ? ` Saldo: ${nfEUR.format(bal.amount)}.` : "") + sinRef });
    } catch (e) {
      // Antes el auto-sync silencioso se tragaba el error entero: la app parecía sana con la
      // conexión muerta. Ahora el fallo queda pegado a la conexión y se ve en Ajustes.
      // 429 (HUB046 en CaixaBank) es el límite diario de consultas que fija la normativa, no un
      // permiso caducado. Antes su texto («…exceeded for consent») lo hacía pasar por caducado y
      // la app invitaba a Reconectar, que gasta más consultas y no arregla nada.
      const limite = e.httpStatus === 429 || /HTTP 429|HUB046|exceeded/i.test(e.message || "");
      const expired = !limite && (e.httpStatus === 401 || e.httpStatus === 403 || e.httpStatus === 404 || /expired|caducad|invalid.*session|session.*(not found|invalid)|consent/i.test(e.message || ""));
      const texto = limite ? "el banco ha agotado las consultas que permite por hoy. Se reanuda solo mañana; no hace falta reconectar." : e.message;
      persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, lastError: texto, lastErrorAt: Date.now(), expired, limitedAt: limite ? Date.now() : c.limitedAt || null } : c)) }));
      if (!opts.silent) setBankMsg({ kind: "err", text: `${conn.aspsp}: ${texto}${expired ? " — el permiso ha caducado, pulsa Reconectar." : ""}` });
    }
    finally { if (!opts.silent) setBankBusy(false); }
  };

  // Recoge lo que el Worker ha bajado del banco mientras la app estaba cerrada y lo ingiere
  // con la clasificación de siempre (reglas, memoria de activos, deduplicación). Solo después
  // se vacía la bandeja, y solo lo que se ha leído: si el cron metió algo entre medias, se
  // queda para la próxima en vez de perderse.
  const bankDrainInbox = useCallback(async (opts = {}) => {
    const url = bankBase();
    if (!url) return 0;
    try {
      const res = await bankFetch("/store/inbox", 30000);
      if (!res.ok) return 0;
      const data = await res.json();
      const rows = Array.isArray(data.movements) ? data.movements : [];
      if (!rows.length) return 0;
      const porOrigen = new Map();
      for (const r of rows) {
        const k = r._origen || "Banco";
        if (!porOrigen.has(k)) porOrigen.set(k, []);
        porOrigen.get(k).push(r);
      }
      let n = 0;
      for (const [origen, lista] of porOrigen) n += ingestBankMovements(lista, origen);
      await fetch(url + "/store/inbox", {
        method: "PUT", headers: { ...bankHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bankIds: rows.map((r) => String(r.bankId)) }),
      });
      if (!opts.silent && n) setBankMsg({ kind: "ok", text: `${nfNum.format(n)} movimientos nuevos que el servidor había bajado por su cuenta.` });
      return n;
    } catch { return 0; }
  }, [ingestBankMovements]);

  const bankSyncAll = useCallback(async (opts = {}) => {
    const conns = loadBank().connections || [];
    if (!conns.length) { if (!opts.silent) setBankMsg({ kind: "err", text: "No hay bancos conectados." }); return; }
    const hoy = new Date().toDateString();
    for (const c of conns) {
      // En automático no se insiste con un banco que hoy ya dijo «límite agotado»: cada intento
      // fallido también cuenta. A mano sí se intenta (puede que lo acepte con la app delante).
      if (opts.silent && c.limitedAt && new Date(c.limitedAt).toDateString() === hoy) continue;
      await bankSyncOne(c.id, opts); // secuencial
    }
  }, [bankSyncOne]);

  // Al volver del banco: elegir la cuenta y sincronizar, que antes había que saber hacer a mano.
  // Con una sola cuenta (o una renovación que se reencuentra por IBAN) se hace solo; con varias,
  // se cargan para elegir. Espera a `booted` para trabajar con tus datos y tus reglas ya cargados.
  useEffect(() => {
    if (!booted || !vueltaBanco) return;
    const sid = vueltaBanco;
    setVueltaBanco(null);
    (async () => {
      const conn = (loadBank().connections || []).find((c) => c.sessionId === sid);
      if (!conn) return;
      persistBank((b) => ({ ...b, auto: true }));
      if (conn.accountIban) { bankSyncOne(conn.id); return; }
      try {
        const r = await bankFetch(`/bank/accounts?session=${encodeURIComponent(sid)}`, 30000);
        const list = r.ok ? ((await r.json()).accounts || []) : [];
        setBankAccountsByConn((m) => ({ ...m, [conn.id]: list }));
        if (list.length === 1) {
          bankPickAccount(conn.id, list[0].uid, list[0].name || list[0].iban, list[0].iban);
          setBankMsg({ kind: "ok", text: "Banco conectado. Bajando tus movimientos…" });
          setTimeout(() => bankSyncOne(conn.id), 300);
        } else if (list.length > 1) {
          setBankMsg({ kind: "info", text: `Banco conectado. Tienes ${list.length} cuentas: elige en el desplegable cuál seguir y pulsa Sincronizar.` });
        } else if (!r.ok) {
          setBankMsg({ kind: "err", text: `Banco conectado, pero no he podido ver tus cuentas (el backend respondió ${r.status}). Pulsa «Ver cuentas» y luego Sincronizar.` });
        }
      } catch (e) { setBankMsg({ kind: "err", text: "Banco conectado, pero no he podido ver tus cuentas: " + e.message + ". Pulsa «Ver cuentas» y luego Sincronizar." }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, vueltaBanco]);

  // Sincronización automática al abrir: si está activada y hace >12 h de la última, baja lo reciente
  // (ventana de 90 días, barata) de todos los bancos, en silencio. La dedup evita duplicados.
  const bankAutoRef = useRef(false);
  const bankInboxRef = useRef(false);
  useEffect(() => {
    // Esperar a `booted` es obligatorio: antes esto arrancaba con el efecto de montaje y la
    // ingesta se hacía contra `movs` vacío, así que ni deduplicaba por bankId ni contra el
    // histórico, y encima el setMovs(ms) de la carga podía llegar después y borrar lo bajado.
    if (!booted || bankAutoRef.current) return; // solo un intento por carga
    const b = loadBank();
    if (!(b.connections || []).length || !b.workerUrl) return;
    // La bandeja (lo que el servidor bajó con la app cerrada) se recoge SIEMPRE al abrir: no
    // cuesta ninguna consulta al banco. Antes solo se miraba una vez cada 12 h, y al entrar no
    // aparecía lo que el servidor ya tenía.
    if (!bankInboxRef.current) { bankInboxRef.current = true; bankDrainInbox({ silent: true }); }
    if (!b.auto) return;
    const hoy = new Date().toDateString();
    if ((b.connections || []).every((c) => c.limitedAt && new Date(c.limitedAt).toDateString() === hoy)) return; // límite del banco: mañana
    if (b.lastAuto && Date.now() - b.lastAuto < 12 * 3600000) return; // como mucho cada 12 h
    bankAutoRef.current = true;
    // El sello se pone al terminar, no antes: si el intento falla, no bloquea 12 h el siguiente.
    // La bandeja va primero: es lo que el servidor ya bajó por su cuenta, no cuesta ninguna
    // llamada al banco y suele traer todo lo pendiente.
    bankDrainInbox({ silent: true })
      .then(() => bankSyncAll({ silent: true, recentDays: 14 }))
      .finally(() => persistBank((prev) => ({ ...prev, lastAuto: Date.now() })));
    // También depende de la config del banco: en el móvil llega del servidor DESPUÉS de arrancar,
    // y con solo [booted] el efecto ya había pasado y no volvía a intentarlo en toda la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, bankCfg.auto, (bankCfg.connections || []).length]);

  // Copias de seguridad automáticas (snapshots): listar y restaurar
  const listSnaps = useCallback(async () => {
    const ts = await listSnapshots(STORE);
    const out = [];
    for (const t of ts) {
      const raw = await STORE.get(SNAP_PREFIX + t);
      let movsN = null;
      try { movsN = JSON.parse(raw)?.movs?.movs?.length ?? null; } catch { /* ignore */ }
      out.push({ ts, movs: movsN });
    }
    return out;
  }, []);
  const restoreSnapshot = useCallback(async (ts) => {
    try {
      const raw = await STORE.get(SNAP_PREFIX + ts);
      if (!raw) return { ok: false, text: "Esa copia ya no está disponible." };
      const p = JSON.parse(raw);
      const n = applyBackupPayload(p);
      return { ok: true, text: `Restaurada la copia del ${new Date(ts).toLocaleString("es-ES")}: ${nfNum.format(n)} movimientos.` };
    } catch (e) { return { ok: false, text: "No se pudo restaurar: " + e.message }; }
  }, [applyBackupPayload]);

  // Gobierno de reglas: auditoría en vivo y baja lógica.
  const rulesAudit = useCallback(() => auditRules(rules, movs, ruleStats), [rules, movs, ruleStats]);
  /* Apagar, no borrar. Borrar una regla de fábrica no servía de nada (al recargar se
     reconstruía desde DEFAULT_RULES) y borrar una tuya perdía su historial de uso.
     Una regla apagada se puede volver a encender. */
  const toggleRule = useCallback((id, active) => {
    setRules((rs) => rs.map((r) => (ruleId(r) === id ? { ...r, active } : r)));
  }, []);
  const removeCustomRule = useCallback((id) => {
    setRules((rs) => rs.filter((r) => !(ruleId(r) === id && r.scope === "personal")));
    setRuleStats((s) => { const n = { ...s }; delete n[id]; return n; });
  }, []);
  // Cambiar la categoría de una regla PERSONAL (para resolver una regla "en conflicto" con
  // un clic: dejarla apuntando a donde de verdad clasificas ahora).
  const updateRuleCat = useCallback((id, cat) => {
    if (!cat) return;
    setRules((rs) => rs.map((r) => (ruleId(r) === id && r.scope === "personal" ? { ...r, cat } : r)));
  }, []);

  /* ---------- Perfiles de IA (varias claves/modelos, cambio rápido) ---------- */
  const saveAiProfile = useCallback((label) => {
    const name = (label || "").trim() || aiProviderLabel(ai);
    const prof = { id: "aip" + Date.now(), label: name, provider: ai.provider, baseUrl: ai.baseUrl || "", model: ai.model || "", apiKey: ai.apiKey || "" };
    // Si ya hay un perfil con esa etiqueta, lo reemplaza (guardar de nuevo = actualizar).
    setAiProfiles((ps) => [...ps.filter((p) => p.label.toLowerCase() !== name.toLowerCase()), prof]);
  }, [ai]);
  const activateAiProfile = useCallback((prof) => {
    setAi({ provider: prof.provider || "claude", baseUrl: prof.baseUrl || "", model: prof.model || "", apiKey: prof.apiKey || "" });
    setAiOn(true);
  }, []);
  const deleteAiProfile = useCallback((id) => setAiProfiles((ps) => ps.filter((p) => p.id !== id)), []);

  /* ---------- Importación ---------- */
  const ensureAsset = useCallback((name) => {
    setAssets((as) => (as.some((a) => a.name === name) ? as : [...as, { id: "a" + Date.now() + name, name, emoji: ASSET_EMOJI[name] || "📦", categories: [] }]));
  }, []);
  const createAsset = useCallback(({ name, emoji }) => {
    setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || ASSET_EMOJI[name] || "📦", categories: [] }]));
  }, []);

  const startImport = useCallback((text, fileName, isSample) => {
    setError(null);
    sampleRef.current = !!isSample;
    setImp({ phase: "parsing", fileName });
    setTimeout(() => {
      try {
        // Un Excel llega ya convertido en filas; un CSV hay que trocearlo.
        const rows = Array.isArray(text) ? text : tokenizeCSV(text, detectDelimiter(text));
        if (rows.length < 2) throw new Error("El archivo está vacío o no tiene movimientos.");
        const analysis = analyzeRows(rows);
        if (analysis.error) throw new Error(analysis.error);
        if (!analysis.ok) { setImp({ phase: "mapping", fileName, rows, analysis }); return; }
        finishParse(rows, analysis.dataStart, analysis.cols, fileName, analysis);
      } catch (e) {
        setImp(null);
        setError(e.message + " Prueba a exportar de nuevo el extracto (CSV o Excel) o usa el mapeo manual.");
      }
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs]);

  const finishParse = (rows, dataStart, cols, fileName, analysis) => {
    const { movs: parsed, skipped, mismatches } = buildMovements(rows, dataStart, cols, fileName);
    if (parsed.length === 0) {
      const totalRows = Math.max(0, rows.length - dataStart);
      let sinFecha = 0, sinImporte = 0;
      for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        if (!parseDateAny(r[cols.date])) { sinFecha++; continue; }
        const amt = cols.amount >= 0 ? parseEsNumber(r[cols.amount])
          : (cols.cargo >= 0 ? parseEsNumber(r[cols.cargo]) : null) ?? (cols.abono >= 0 ? parseEsNumber(r[cols.abono]) : null);
        if (amt === null) sinImporte++;
      }
      const motivo = sinFecha >= sinImporte
        ? "la columna de Fecha no tiene un formato reconocible (usa DD/MM/AAAA o AAAA-MM-DD)"
        : "la columna de Importe no contiene números válidos";
      setImp({
        phase: "mapping", fileName, rows,
        analysis: analysis || { cols, headerIdx: dataStart - 1 },
        mapError: `Se han leído ${totalRows} filas con estas columnas, pero ninguna da un movimiento válido: ${motivo}. Revisa la asignación de columnas y la fila de cabecera.`,
      });
      return;
    }
    const { fresh, dupes } = dedupeAgainst(movs, parsed);
    setImp({ phase: "validate", fileName, rows, val: { movs: fresh, skipped, mismatches, fileName, dupes }, cols, dataStart });
  };

  const handleFiles = async (fileList) => {
    const file = fileList[0];
    if (!file) return;
    setError(null);
    // Una copia de seguridad (.json) no es un extracto: pasarla por el lector de CSV producía
    // un error sin sentido. Se detecta y se restaura por su camino.
    if (/\.json$/i.test(file.name) || file.type === "application/json") {
      const r = await importJSON(file);
      if (!r.ok) setError(r.text);
      return;
    }
    setImp({ phase: "parsing", fileName: file.name });
    try {
      const buf = await file.arrayBuffer();
      if (isSpreadsheetFile(file)) {
        const rows = await spreadsheetToRows(buf);
        if (!rows.length) throw new Error("el Excel no tiene ninguna hoja con datos");
        startImport(rows, file.name, false);
      } else {
        startImport(decodeBuffer(buf), file.name, false);
      }
    } catch (e) {
      setImp(null);
      setError("No se pudo leer el archivo: " + e.message);
    }
  };

  const loadSample = () => startImport(genSampleCSV(), "ejemplo-banco.csv", true);

  // Importar SIN muro: clasifica todo y lleva directo al dashboard.
  // Lo de alta confianza queda confirmado; lo dudoso entra como "por revisar"
  // (confirmed:false) y se resuelve con calma desde la vista de pendientes.
  const applyImport = (conv) => {
    try {
      // Conversión de divisa (tasa manual del paso de comprobación): pasamos los importes
      // a € ANTES de clasificar (las reglas por importe son en €), guardamos el original,
      // y quitamos el saldo extranjero para no mezclarlo con el balance del banco en €.
      const rate = conv && conv.rate && conv.rate !== 1 ? conv.rate : 1;
      const fresh = imp.val.movs.map((m) => {
        const base = { ...m, id: MOV_ID++ };
        if (rate !== 1) {
          base.origAmount = m.amount;
          base.currency = conv.currency;
          base.amount = Math.round(m.amount * rate * 100) / 100;
          base.saldo = null;
        }
        return base;
      });
      const decByMov = classifyForImport(fresh, movs, rules, { materialidad, assetMem, vivienda: viviendaPorDefecto(assets, movs) });
      // Aplicar a los movimientos
      const assetNames = new Set();
      const applied = fresh.map((m) => {
        const d = decByMov.get(m.id);
        if (d.asset) assetNames.add(d.asset);
        return { ...m, category: d.cat, assetName: d.asset || undefined, confirmed: d.confirmed };
      });
      for (const n of assetNames) ensureAsset(n);

      // Telemetría por regla: cuántas veces disparó, cuánto dinero clasificó y cuándo.
      // Sin esto, auditar una regla solo dice "coincide con N movimientos"; con esto
      // dice "esta regla ha colocado 4.722 €", que es lo que de verdad importa.
      setRuleStats((prev) => {
        const next = { ...prev };
        for (const m of fresh) {
          const d = decByMov.get(m.id);
          if (!d?.rule) continue;
          const id = ruleId(d.rule);
          const s = next[id] || { n: 0, abs: 0, last: null };
          const t = m.date.getTime();
          next[id] = { n: s.n + 1, abs: r2c(s.abs + Math.abs(m.amount)), last: s.last && s.last > t ? s.last : t };
        }
        return next;
      });

      // Destilar reglas solo de lo fiable (para no volver a preguntar por esos comercios).
      // Se agrupa por patrón: una inferencia fiable sobre un comercio vale para todos sus cargos.
      setRules((rs) => {
        const have = new Set(rs.map((r) => r.k));
        const extra = [];
        const addRule = (k, cat, asset) => {
          if (k && !have.has(k) && !extra.some((e) => e.k === k)) {
            extra.push({ k, cat, asset: asset || undefined, prio: PRIO.personal, scope: "personal" });
          }
        };
        const seen = new Set();
        for (const m of fresh) {
          const d = decByMov.get(m.id);
          if (!d || !d.confirmed || d.source === "regla" || seen.has(m.pattern)) continue;
          if (d.source !== "comercio" && d.source !== "importe") continue;
          if (needsAmount(m)) { if (!extra.some((e) => ruleId(e) === ruleId(learnedRule(m, d.cat, d.asset)))) extra.push(learnedRule(m, d.cat, d.asset)); continue; }
          seen.add(m.pattern);
          const ent = merchantEntity(m.pattern);
          if (ent && ent.length >= 5 && !ENTITY_STOP.has(ent)) addRule(ent, d.cat, d.asset);
          else addRule(m.pattern, d.cat, d.asset);
        }
        return extra.length ? [...extra, ...rs] : rs;
      });
      setMovs((ms) => [...ms, ...applied]);
      if (sampleRef.current) { setGroups((gs) => (gs.length ? gs : SAMPLE_GROUPS.map((g) => ({ ...g })))); sampleRef.current = false; }
      const pend = applied.filter((m) => m.confirmed === false).length;
      setImp(null);
      setTab("resumen");
      // Un CSV nuevo trae comercios nuevos: merece una ronda de sugerencias.
      if (pend > 0) aiAutoRanRef.current = false;
      if (pend > 0) setPendingNotice(pend); // aviso suave, no bloqueante
    } catch (e) {
      setImp(null);
      setError("No se ha podido importar: " + e.message + ". Vuelve a intentarlo.");
    }
  };

  /* ---------- Correcciones por contexto ---------- */
  // Aplicar clasificaciones desde el panel de pendientes: marca confirmados y destila reglas.
  const applyPending = useCallback((changes) => {
    if (!changes?.length) return;
    // Las filas de transferencias van por importe, así que se aplica por ids cuando llegan.
    const byId = new Map();
    for (const c of changes) for (const id of c.ids || []) byId.set(id, c);
    const byPattern = new Map(changes.filter((c) => !c.ids).map((c) => [c.pattern, c]));
    const assetNames = new Set();
    for (const c of changes) if (c.asset) assetNames.add(c.asset);
    for (const n of assetNames) ensureAsset(n);
    setMovs((ms) => ms.map((m) => {
      const c = byId.get(m.id) || byPattern.get(m.pattern);
      if (!c || m.confirmed) return m;
      return { ...m, category: c.cat, assetName: c.asset !== undefined ? (c.asset || null) : m.assetName, confirmed: true };
    }));
    setRules((rs) => {
      const have = new Set(rs.map((r) => r.k));
      const extra = [];
      const addRule = (k, cat, asset) => {
        if (k && !have.has(k) && !extra.some((e) => e.k === k)) {
          extra.push({ k, cat, asset: asset || undefined, prio: PRIO.personal, scope: "personal" });
        }
      };
      for (const c of changes) {
        if (c.mov) {
          const nr = learnedRule(c.mov, c.cat, c.asset, movs);
          if (!rs.some((r) => ruleId(r) === ruleId(nr)) && !extra.some((e) => ruleId(e) === ruleId(nr))) extra.push(nr);
          continue;
        }
        // Clasificación manual → patrón exacto. Sugerencia de IA aceptada → entidad (generaliza).
        if (c.fromAI) {
          const ent = merchantEntity(c.pattern);
          if (ent && ent.length >= 5 && !ENTITY_STOP.has(ent)) addRule(ent, c.cat, c.asset);
          else addRule(c.pattern, c.cat, c.asset);
        } else {
          addRule(c.pattern, c.cat, c.asset);
        }
      }
      return extra.length ? [...extra, ...rs] : rs;
    });
    setPendingNotice(0);
  }, [ensureAsset, movs]);

  // Corregir a mano es la señal de confirmación más fuerte que existe: si no marcamos
  // `confirmed`, el movimiento seguía apareciendo en «por clasificar» para siempre.
  const recat = (mov, cat, applySimilar) => {
    if (!cat) return;
    // Pasarela pura (PayPal, Stripe…): el patrón agrupa comercios reales distintos.
    // Ni cambiamos en bloque ni destilamos regla por patrón — clasificaría mal todos
    // los cargos futuros de la pasarela. Solo tocamos este movimiento.
    const proc = isProcessorPattern(mov.pattern);
    // Los Bizum son por persona/motivo: destilar una regla del patrón concreto solo genera
    // reglas de un solo uso que ensucian. Los Bizum recurrentes (alquileres) se gobiernan
    // con reglas condicionales por importe/día, no por patrón. Así que corregir un Bizum
    // cambia el movimiento (o los del mismo patrón, si lo pides) pero NO crea regla.
    const isBizum = /^BIZUM\b/.test(String(mov.pattern || ""));
    // En una transferencia, «los similares» y la regla son los de importe parecido.
    const nr = learnedRule(mov, cat, undefined, movs);
    const parecido = (m) => isBizum || !isConditional(nr) || ruleConditionsHold(nr, m.amount, m.date);
    setMovs((ms) => ms.map((m) => {
      if (m.id === mov.id) return { ...m, category: cat, splits: null, confirmed: true };
      if (applySimilar && !proc && m.pattern === mov.pattern && parecido(m)) return { ...m, category: cat, splits: m.splits, confirmed: true };
      return m;
    }));
    // Sustituye a las reglas del mismo patrón que clasificaban ESTE movimiento (no a las de
    // otros importes: la del parking sobrevive a corregir la de la inversión).
    // Una regla de gasto no se aplica a un positivo (salvo las «+»): corregir una devolución no
    // debe borrar la regla de los cargos del mismo comercio.
    const aplica = (r) => ruleConditionsHold(r, mov.amount, mov.date) && (mov.amount < 0 || INGRESO_SET.has(r.cat) || TRANSFER_SET.has(r.cat) || r.sign === "+");
    const sobra = (r) => r.k === mov.pattern && (ruleId(r) === ruleId(nr) || (aplica(r) && (r.cat !== cat || !isConditional(nr))));
    // La regla sin importe que se retira (p. ej. «concepto = Parking» al corregir los 500 €) no se
    // pierde: vuelve atada a los importes de los movimientos que sí son de esa categoría.
    const reatar = (r) => {
      if (isConditional(r) || !isConditional(nr) || r.cat === cat) return null;
      const amts = movs.filter((m) => m.id !== mov.id && ambKey(m) === ambKey(mov) && m.category === r.cat && !ruleConditionsHold(nr, m.amount, m.date)).map((m) => Math.abs(m.amount));
      if (!amts.length) return null;
      return { ...r, sign: mov.amount < 0 ? "-" : "+", min: Math.floor(Math.min(...amts) * 85) / 100, max: Math.ceil(Math.max(...amts) * 115) / 100 };
    };
    if (!proc && !isBizum) setRules((rs) => [nr, ...rs.filter(sobra).map(reatar).filter((x) => x && !ruleConditionsHold(x, mov.amount, mov.date)), ...rs.filter((r) => !sobra(r))]);
  };
  // Aplicar una propuesta de reclasificación del asistente: reclasifica los ids a la categoría.
  // Reversible (puedes volver a corregir a mano); no crea reglas para no ensuciar con lotes.
  const applyReclassify = (p) => {
    const ids = new Set((p?.ids || []).map(Number));
    const cat = p?.categoria;
    if (!ids.size || !cat) return;
    setMovs((ms) => ms.map((m) => (ids.has(m.id) ? { ...m, category: cat, splits: null, confirmed: true } : m)));
    // Una correccion sin regla se repite cada mes. Se crea una regla personal por cada patron
    // afectado, saltando los que ya tienen una: asi la proxima importacion ya llega clasificada.
    const porRegla = new Map();
    for (const m of movs) if (ids.has(m.id) && m.pattern) { const nr = learnedRule(m, cat, undefined, movs.filter((o) => !ids.has(o.id))); porRegla.set(ruleId(nr), nr); }
    if (porRegla.size) {
      setRules((rs) => {
        const nuevas = [...porRegla.values()]
          .filter((nr) => !rs.some((r) => r.scope === "personal" && (isConditional(nr) ? ruleId(r) === ruleId(nr) : r.k === nr.k && r.cat === cat)));
        return nuevas.length ? [...nuevas, ...rs] : rs;
      });
    }
  };
  // Todo se agrupa por NOMBRE de activo: renombrar sin propagar dejaba el activo a cero y sus
  // movimientos huérfanos. Se cambia en movimientos, memoria comercio→activo, reglas y filtros.
  const renameAsset = (viejo, nuevo) => {
    if (!viejo || !nuevo || viejo === nuevo) return;
    setMovs((ms) => ms.map((m) => (m.assetName === viejo ? { ...m, assetName: nuevo } : m)));
    setAssetMem((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === viejo ? nuevo : v])));
    setRules((rs) => rs.map((r) => (r.asset === viejo ? { ...r, asset: nuevo } : r)));
    setFilters((f) => (f.assetsSel?.has(viejo) ? { ...f, assetsSel: new Set([...f.assetsSel].map((x) => (x === viejo ? nuevo : x))) } : f));
  };
  // Borrar pide confirmación y limpia las referencias: antes la siguiente importación lo volvía
  // a crear desde la memoria comercio→activo. Los movimientos vuelven a asignarse por categoría.
  const deleteAsset = (a) => {
    const n = movs.filter((m) => m.assetName === a.name).length;
    if (!window.confirm(`¿Eliminar «${a.name}»?${n ? `\n\n${nfNum.format(n)} movimientos asignados a mano dejarán de estarlo (no se borran).` : ""}`)) return false;
    setAssets((as) => as.filter((x) => x.id !== a.id));
    setMovs((ms) => ms.map((m) => (m.assetName === a.name ? { ...m, assetName: undefined } : m)));
    setAssetMem((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== a.name)));
    setRules((rs) => rs.map((r) => (r.asset === a.name ? { ...r, asset: undefined } : r)));
    setFilters((f) => (f.assetsSel?.has(a.name) ? { ...f, assetsSel: new Set([...f.assetsSel].filter((x) => x !== a.name)) } : f));
    return true;
  };
  const reasset = (mov, assetName) => {
    if (assetName) ensureAsset(assetName);
    // Por movimiento individual: un mismo comercio puede repartirse entre activos
    // (p. ej. el taller que unas veces es del coche y otras de la moto).
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, assetName: assetName || null } : m)));
  };
  // Reasignar activo a TODOS los movimientos de un comercio (acción explícita "aplicar a todos")
  const reassetAll = (mov, assetName) => {
    if (assetName) ensureAsset(assetName);
    setMovs((ms) => ms.map((m) => (m.pattern === mov.pattern ? { ...m, assetName: assetName || null } : m)));
    // "Aplicar a todos" es intencion inequivoca: se recuerda para las proximas importaciones.
    // Quitar el activo tambien se respeta, borrando la entrada en vez de dejarla desactualizada.
    setAssetMem((p) => { const n = { ...p }; if (assetName) n[mov.pattern] = assetName; else delete n[mov.pattern]; return n; });
  };
  // Marcar un movimiento como extraordinario (herencia, venta puntual): fuera del análisis
  const toggleExtra = (mov) => {
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, extra: !m.extra } : m)));
  };
  const splitMov = (mov, splits) => {
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, splits, category: splits ? splits[0].cat : m.category, confirmed: true } : m)));
  };
  // Apodo/nota por movimiento: un nombre humano para conceptos crípticos ("Impuestos"
  // en vez de "TRANSFER 4471…"). Repetido en varios movimientos, agrupa para gráficos.
  const setNote = (mov, note) => {
    const n = (note || "").trim().slice(0, 40);
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, note: n || undefined } : m)));
  };
  // Apodo a TODOS los movimientos del mismo comercio de una vez (nivel agrupado).
  const setNoteAll = (mov, note) => {
    const n = (note || "").trim().slice(0, 40);
    setMovs((ms) => ms.map((m) => (m.pattern === mov.pattern ? { ...m, note: n || undefined } : m)));
  };
  // Borrar movimientos = enviarlos a la PAPELERA (borrado suave): salen del análisis y de
  // las listas, pero se pueden rescatar desde Ajustes → Papelera. Se guarda cuándo.
  // Duplicados bancarios sospechosos: misma cuenta, fecha, importe y concepto normalizado, pero
  // distinta referencia. Ocurren cuando el banco cambia la referencia al liquidar (tarjetas) o
  // por sincronizaciones solapadas (ya corregido). Se devuelven en grupos, el más antiguo primero,
  // para que la persona decida: dos cafés iguales el mismo día también caen aquí.
  const findBankDupes = () => {
    const groups = new Map();
    for (const m of movs) {
      if (!m.bankId || m.omit) continue;
      const d = m.date instanceof Date ? m.date : new Date(m.date);
      // Sin accountUid a proposito: los uid cambian en cada sesion, asi que incluirlos dejaba
      // fuera del grupo el mismo movimiento reimportado tras reconectar — el duplicado que mas
      // importa detectar. Si tienes dos cuentas con un cargo identico el mismo dia tambien
      // agrupara: por eso esto es una lista para REVISAR, no un borrado automatico.
      const key = [isNaN(d.getTime()) ? "?" : d.toISOString().slice(0, 10), Math.round((Number(m.amount) || 0) * 100), m.pattern || normalizePattern(m.concept || "")].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    return [...groups.values()].filter((g) => g.length > 1).map((g) => [...g].sort((a, b) => a.id - b.id));
  };
  // Conserva el más antiguo de cada grupo y manda el resto a la papelera (reversible).
  const trashBankDupes = (groups) => deleteMovs(groups.flatMap((g) => g.slice(1).map((m) => m.id)));

  // Movimientos que PROVABLEMENTE son de otra cuenta del mismo banco.
  //
  // La versión anterior comparaba `m.accountUid !== keepUid` y era peligrosa: los uid de
  // Enable Banking son POR SESIÓN, así que los movimientos importados en sesiones anteriores
  // llevan uid antiguos de la MISMA cuenta y quedaban marcados como ajenos. Señalaba para
  // borrar justo los datos buenos.
  //
  // Ahora hace falta `knownUids`: los uid de las cuentas de la sesión ACTUAL (los que devuelve
  // «Ver cuentas»). Solo se señala lo que está en esa lista y no es la cuenta elegida. Lo que
  // viene de sesiones viejas no se puede clasificar, así que no se toca: ante la duda, nada.
  const otherAccountMovIds = (label, keepUid, knownUids) => {
    if (!keepUid || !Array.isArray(knownUids) || knownUids.length < 2) return [];
    const foreign = new Set(knownUids.filter((u) => u && u !== keepUid));
    if (!foreign.size) return [];
    return movs.filter((m) => m.bankId && !m.omit && (m.file || "") === label && m.accountUid && foreign.has(m.accountUid)).map((m) => m.id);
  };
  const trashOtherAccountMovs = (label, keepUid, knownUids) => {
    const ids = otherAccountMovIds(label, keepUid, knownUids);
    if (ids.length) deleteMovs(ids);
    return ids.length;
  };

  const deleteMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.map((m) => (set.has(m.id) ? { ...m, omit: Date.now() } : m)));
  };
  const restoreMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.map((m) => { if (!set.has(m.id)) return m; const { omit: _omit, ...rest } = m; return rest; }));
  };
  const purgeMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.filter((m) => !set.has(m.id)));
  };
  const trashed = useMemo(() => movs.filter((m) => m.omit).sort((a, b) => b.omit - a.omit), [movs]);
  const deleteImport = (file) => setMovs((ms) => ms.filter((m) => (m.file || "(sin origen)") !== file));
  // Corregir el importe (en €) de UN movimiento: p. ej. un cargo en otra divisa dentro
  // de un CSV en euros. Se guarda el importe original y la divisa para transparencia.
  const setAmount = (mov, amount, meta) => {
    const a = Math.round(Number(amount) * 100) / 100;
    if (!isFinite(a) || a === 0) return;
    setMovs((ms) => ms.map((m) => (m.id === mov.id
      ? { ...m, amount: a, ...(meta && meta.currency ? { currency: meta.currency, origAmount: meta.origAmount } : {}) }
      : m)));
  };
  // Alta manual: mismo formato que un movimiento importado, marcado como confirmado y
  // con file "Manual" para poder distinguirlo (y borrar la tanda entera si hiciera falta).
  const addMov = (data) => {
    if (data.assetName) ensureAsset(data.assetName);
    const mov = {
      id: MOV_ID++, date: data.date, concept: data.concept, amount: data.amount, saldo: null,
      pattern: normalizePattern(data.concept), file: "Manual", category: data.category || null,
      assetName: data.assetName, splits: null, groupIds: [], confirmed: true, manual: true,
    };
    setMovs((ms) => [...ms, mov]);
    // Lleva la vista al mes del alta para que el usuario la vea de inmediato (si no, un
    // movimiento con fecha de hoy podría caer fuera del periodo filtrado y "no aparecer").
    setFilters((f) => ({ ...f, periodType: "month", month: monthKey(data.date), from: "", to: "" }));
  };
  // Edición manual de un movimiento existente. Si cambia la categoría o el signo, una
  // división previa deja de ser válida y se descarta (coherente con recategorizar a mano).
  const editMov = (mov, data) => {
    if (data.assetName) ensureAsset(data.assetName);
    setMovs((ms) => ms.map((m) => {
      if (m.id !== mov.id) return m;
      const catChanged = data.category != null && data.category !== m.category;
      const signFlipped = Math.sign(data.amount) !== Math.sign(m.amount);
      const keepSplits = m.splits && !catChanged && !signFlipped;
      return {
        ...m, date: data.date, amount: data.amount, concept: data.concept,
        pattern: normalizePattern(data.concept), category: data.category ?? m.category,
        assetName: data.assetName, splits: keepSplits ? m.splits : null, confirmed: true,
      };
    }));
  };
  // Cargas de datos: una por archivo importado, para poder borrar una entera.
  const imports = useMemo(() => {
    const map = new Map();
    for (const m of movs) {
      const f = m.file || "(sin origen)";
      let e = map.get(f);
      if (!e) { e = { file: f, count: 0, min: m.date, max: m.date }; map.set(f, e); }
      e.count++;
      if (m.date < e.min) e.min = m.date;
      if (m.date > e.max) e.max = m.date;
    }
    return [...map.values()].sort((a, b) => b.max - a.max);
  }, [movs]);

  /* ---------- Etiquetado de grupos de gasto ---------- */
  // Etiquetar identifica el comercio, no un cargo suelto: se aplica a TODOS los
  // movimientos del mismo patrón (los de nombre idéntico), no solo al que pulsas.
  // Excepciones: pasarelas (PayPal, Stripe…), donde cada cargo es un comercio distinto, y
  // operaciones genéricas del banco ("TRANSFER INMEDIATA", "BIZUM"), donde el patrón es el
  // tipo de operación y no el destinatario: ahí etiquetar uno arrastraba a todos los demás.
  const samePatternIds = (mov) => (identifiesMerchant(mov.pattern)
    ? movs.filter((m) => m.pattern === mov.pattern).map((m) => m.id)
    : [mov.id]);
  const toggleGroup = (mov, g) => {
    const ids = samePatternIds(mov);
    const idset = new Set(ids);
    setGroups((gs) => gs.map((x) => {
      if (x.id !== g.id) return x;
      const inNow = movInGroup(mov, x);
      let movementIds = x.movementIds || [];
      let excludedIds = x.excludedIds || [];
      if (inNow) {
        movementIds = movementIds.filter((id) => !idset.has(id));
        const byKw = (x.keywords || []).some((k) => k && stripAccents(mov.pattern.toUpperCase()).includes(stripAccents(k.toUpperCase())));
        if (byKw) excludedIds = [...new Set([...excludedIds, ...ids])];
      } else {
        excludedIds = excludedIds.filter((id) => !idset.has(id));
        movementIds = [...new Set([...movementIds, ...ids])];
      }
      return { ...x, movementIds, excludedIds };
    }));
  };
  const createGroupFromMov = (mov) => {
    const raw = (mov.pattern || mov.concept || "Grupo").trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Nueva etiqueta";
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const g = { id: "g" + Date.now(), name, emoji: "🏷️", color, keywords: [], movementIds: samePatternIds(mov), excludedIds: [] };
    setGroups((gs) => [...gs, g]);
    setDrill(null);
    // "Etiquetas" vive dentro del combo "Activos": hay que abrir esa pestaña y su sub-vista,
    // no una pestaña "grupos" que ya no existe (dejaba la pantalla en blanco).
    setTab("activos");
    setSubAct("etiquetas");
  };

  /* ---------- Rangos y agregados ---------- */
  const dataRange = useMemo(() => {
    if (!hasData) return null;
    let min = movs[0].date, max = movs[0].date;
    for (const m of movs) { if (m.date < min) min = m.date; if (m.date > max) max = m.date; }
    return [min, max];
  }, [movs, hasData]);

  const monthsAvail = useMemo(() => [...new Set(movs.map((m) => monthKey(m.date)))].sort(), [movs]);
  const yearsAvail = useMemo(() => [...new Set(movs.map((m) => m.date.getFullYear()))].sort(), [movs]);

  useEffect(() => {
    if (filters.periodType === "month" && !filters.month && monthsAvail.length) {
      setFilters((f) => ({ ...f, month: monthsAvail[monthsAvail.length - 1] }));
    }
    if (filters.periodType === "year" && yearsAvail.length && !yearsAvail.includes(filters.year)) {
      setFilters((f) => ({ ...f, year: yearsAvail[yearsAvail.length - 1] }));
    }
    if (filters.periodType === "custom" && dataRange && (!filters.from || !filters.to)) {
      setFilters((f) => ({ ...f, from: f.from || dataRange[0].toISOString().slice(0, 10), to: f.to || dataRange[1].toISOString().slice(0, 10) }));
    }
  }, [filters.periodType, filters.month, filters.year, filters.from, filters.to, monthsAvail, yearsAvail, dataRange]);

  const periodRange = useMemo(() => {
    if (!dataRange) return null;
    const f = filters;
    if (f.periodType === "year") return [new Date(f.year, 0, 1), new Date(f.year, 11, 31, 23, 59)];
    if (f.periodType === "month" && f.month) {
      const [y, m] = f.month.split("-").map(Number);
      return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59)];
    }
    if (f.periodType === "custom" && f.from && f.to) {
      const a = new Date(f.from), b = new Date(f.to); b.setHours(23, 59);
      return a <= b ? [a, b] : [b, a];
    }
    return dataRange;
  }, [filters, dataRange]);

  // Los movimientos en papelera (omit) no deben alimentar recurrentes, atípicos ni recibos.
  const liveMovs = useMemo(() => movs.filter((m) => !m.omit), [movs]);
  // Movimientos del panel de detalle: los del periodo elegido, o todos si lo abre un aviso.
  // Memorizado: antes se creaba un array nuevo en cada render y la lista se recalculaba siempre.
  const drillMovs = useMemo(() => (drill?.todo ? liveMovs : liveMovs.filter((m) => periodRange && m.date >= periodRange[0] && m.date <= periodRange[1])), [drill, liveMovs, periodRange]);
  const recurring = useMemo(() => detectRecurring(liveMovs), [liveMovs]);
  const outliers = useMemo(() => computeOutliers(liveMovs), [liveMovs]);
  const receiptTrends = useMemo(() => analyzeReceiptTrends(liveMovs), [liveMovs]);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => { try { return new Set(JSON.parse(window.localStorage?.getItem("finz:dismissed:v1") || "[]")); } catch { return new Set(); } });
  const dismissAlert = useCallback((a) => setDismissedAlerts((s) => { const n = new Set(s); n.add(a.id); try { window.localStorage?.setItem("finz:dismissed:v1", JSON.stringify([...n])); } catch { /* cuota */ } return n; }), []);
  const alerts = useMemo(() => buildAlerts({ movs: liveMovs, budgets, receiptTrends, outliers }).filter((a) => !dismissedAlerts.has(a.id)), [liveMovs, budgets, receiptTrends, outliers, dismissedAlerts]);
  const upcoming = useMemo(() => upcomingCharges(movs, recurring, receiptTrends, dataRange ? dataRange[1] : null), [movs, recurring, receiptTrends, dataRange]);
  const momDelta = useMemo(() => {
    if (filters.periodType !== "month" || !filters.month) return null;
    const [y, mo] = filters.month.split("-").map(Number);
    const prevKey = monthKey(new Date(y, mo - 2, 1));
    let cur = 0, prev = 0;
    for (const m of movs) {
      if (m.amount >= 0 || m.extra || INTERNAL_SET.has(m.category || "Otros")) continue;
      const k = monthKey(m.date);
      if (k === filters.month) cur -= m.amount; else if (k === prevKey) prev -= m.amount;
    }
    if (prev <= 0) return null;
    return { delta: (cur - prev) / prev, prevKey };
  }, [filters.periodType, filters.month, movs]);
  const saldoSerie = useMemo(() => {
    const withSaldo = movs.filter((m) => m.saldo !== null && m.saldo !== undefined && isFinite(m.saldo));
    if (withSaldo.length < 5 || withSaldo.length < movs.length * 0.5) return null;
    const sorted = [...withSaldo].sort((a, b) => a.date - b.date);
    // Clave por día LOCAL: toISOString() pasa a UTC y en España desplazaría al día
    // anterior los movimientos de madrugada. new Date("AAAA-MM-DD") tiene el mismo
    // problema al reconstruirla, así que guardamos también el instante local.
    const byDay = new Map();
    for (const m of sorted) {
      const d = m.date;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byDay.set(key, { t: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), saldo: m.saldo });
    }
    return [...byDay.values()].map(({ t, saldo }) => ({ d: t, saldo }));
  }, [movs]);

  // Saldo REAL: suma de los saldos de las cuentas bancarias conectadas (si los hay).
  /* Saldo del banco AL DÍA. El saldo solo se lee cuando la app consulta el banco; las revisiones
     automáticas del servidor traen movimientos pero no saldo (pedirlo gastaría consultas del
     límite diario). Así que, si después han llegado movimientos de esa conexión, se parte del
     saldo contable y su fecha y se suman los contabilizados después; si el banco da el saldo
     tras cada movimiento, se usa ese directamente. Sin movimientos nuevos, el saldo leído. */
  const bankSaldo = useMemo(() => computeBankSaldo(bankCfg.connections, movs), [bankCfg, movs]);
  // Solo se calcula con Ajustes abierto: recorre todos los movimientos del banco.
  const conciliaciones = useMemo(() => (settingsOpen ? Object.fromEntries((bankCfg.connections || []).map((c) => [c.id, conciliar(movs, c)])) : {}), [settingsOpen, bankCfg, movs]);
  const cierre = useMemo(() => buildMonthClose({ movs, receiptTrends, upcoming, saldoSerie, dataRange, realSaldo: bankSaldo ? bankSaldo.amount : null, saldoEstimado: !!bankSaldo?.estimado }), [movs, receiptTrends, upcoming, saldoSerie, dataRange, bankSaldo]);

  const createGroupFromProposal = useCallback((p) => {
    setGroups((gs) => {
      // Si la etiqueta ya existe, se le añaden los movimientos y palabras propuestos (antes no
      // se hacía nada, pero la tarjeta decía «Creada»).
      const ya = gs.find((g) => g.name.toLowerCase() === p.nombre.toLowerCase());
      if (ya) return gs.map((g) => (g === ya ? { ...g, keywords: [...new Set([...(g.keywords || []), ...(p.keywords || [])])], movementIds: [...new Set([...(g.movementIds || []), ...(p.ids || [])])] } : g));
      return [...gs, { id: "g" + Date.now(), name: p.nombre, emoji: p.emoji || "🏷️", color: GROUP_COLORS[gs.length % GROUP_COLORS.length], keywords: p.keywords || [], movementIds: p.ids || [], excludedIds: [] }];
    });
  }, []);

  const makeAgg = useCallback((range, useFilters, { conExtra = false } = {}) => {
    const [a, b] = range;
    const byCat = new Map(), byAsset = new Map(), byAssetCat = new Map(), byAssetIncome = new Map();
    const byAssetRange = new Map(); // activo -> [primer, último] movimiento: su anualización es la suya
    const bucketCat = new Map(), bucketTot = new Map();
    const byInternoCat = new Map();
    let gasto = 0, ingresos = 0, interno = 0;
    const parts = [];
    const catF = useFilters ? filters.cats : new Set();
    const assF = useFilters ? filters.assetsSel : new Set();
    const grpF = useFilters ? filters.groupsSel : new Set();
    let extraGasto = 0, extraIngreso = 0;
    // Un conjunto por signo. Con uno solo, el subtítulo de ingresos abría también los gastos
    // extraordinarios y al revés: cada anillo debe mostrar SOLO lo suyo. Un movimiento con
    // partes de los dos signos entra legítimamente en ambos.
    const extraGastoIds = new Set(), extraIngresoIds = new Set();
    const rangeDays = daysBetween(a, b);
    const isDay = rangeDays <= 32;
    const isYear = !isDay && granularity === "year";
    let dMin = null, dMax = null;
    for (const m of movs) {
      if (m.omit) continue; // en la papelera: fuera del análisis
      if (m.date < a || m.date > b) continue;
      // Los extraordinarios (herencia, ventas puntuales, una derrama) quedan fuera del análisis
      // para no distorsionar medias y proyecciones, pero se contabilizan aparte: excluirlos sin
      // decirlo hacía que el total del gráfico no cuadrase con el dinero que salió de verdad.
      if (m.extra && !conExtra) {
        if (grpF.size) {
          const inSelX = groups.some((g) => grpF.has(g.name) && movInGroup(m, g));
          if (!inSelX) continue;
        }
        for (const p of expandParts(m, assets)) {
          if (catF.size && !catF.has(p.cat)) continue;
          if (assF.size && (!p.asset || !assF.has(p.asset))) continue;
          if (p.amount < 0) { extraGasto -= p.amount; extraGastoIds.add(m.id); }
          else if (p.amount > 0) { extraIngreso += p.amount; extraIngresoIds.add(m.id); }
        }
        continue;
      }
      if (grpF.size) {
        const inSel = groups.some((g) => grpF.has(g.name) && movInGroup(m, g));
        if (!inSel) continue;
      }
      for (const p of expandParts(m, assets)) {
        if (catF.size && !catF.has(p.cat)) continue;
        if (assF.size && (!p.asset || !assF.has(p.asset))) continue;
        parts.push(p);
        if (!dMin || m.date < dMin) dMin = m.date;
        if (!dMax || m.date > dMax) dMax = m.date;
        if (p.asset) { const rg = byAssetRange.get(p.asset); if (!rg) byAssetRange.set(p.asset, [m.date, m.date]); else { if (m.date < rg[0]) rg[0] = m.date; if (m.date > rg[1]) rg[1] = m.date; } }
        const bk = isDay ? m.date.toISOString().slice(0, 10) : isYear ? String(m.date.getFullYear()) : monthKey(m.date);
        if (!bucketTot.has(bk)) bucketTot.set(bk, { gasto: 0, ingreso: 0 });
        if (INTERNAL_SET.has(p.cat)) {
          // Traspaso entre cuentas propias / ahorro-inversión: ni gasto ni ingreso. La
          // SALIDA (negativa) suma a "interno"; el RETORNO (positivo) no cuenta como ingreso
          // (es tu propio dinero volviendo), para no inflar ingresos ni el ahorro.
          if (p.amount < 0) {
            const v = -p.amount;
            interno += v;
            byInternoCat.set(p.cat, (byInternoCat.get(p.cat) || 0) + v);
          }
        } else if (p.amount < 0 || isRefundPart(p)) {
          // Gasto: negativo = gasto normal; positivo con categoría de gasto explícita =
          // DEVOLUCIÓN, que resta del gasto de esa categoría en vez de contar como ingreso.
          const v = -p.amount; // negativo cuando es una devolución
          gasto += v;
          byCat.set(p.cat, (byCat.get(p.cat) || 0) + v);
          bucketTot.get(bk).gasto += v;
          if (!bucketCat.has(bk)) bucketCat.set(bk, new Map());
          const bc = bucketCat.get(bk);
          bc.set(p.cat, (bc.get(p.cat) || 0) + v);
          if (p.asset) {
            byAsset.set(p.asset, (byAsset.get(p.asset) || 0) + v);
            if (!byAssetCat.has(p.asset)) byAssetCat.set(p.asset, new Map());
            const mm = byAssetCat.get(p.asset);
            mm.set(p.cat, (mm.get(p.cat) || 0) + v);
          }
        } else {
          ingresos += p.amount;
          bucketTot.get(bk).ingreso += p.amount;
          if (p.asset) byAssetIncome.set(p.asset, (byAssetIncome.get(p.asset) || 0) + p.amount);
        }
      }
    }
    const mesesData = dMin ? monthsCoveredOf(dMin, dMax) : 1;
    const annualFactor = 12 / mesesData;
    const topCats = [...byCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([c]) => c);
    const topSet = new Set(topCats);
    const buckets = [...bucketTot.keys()].sort((x, y) => x.localeCompare(y)).map((k) => {
      const obj = { label: isDay ? fmtDateShort(new Date(k)) : isYear ? k : monthLabel(k), _key: k, gasto: Math.round(bucketTot.get(k).gasto * 100) / 100, ingreso: Math.round(bucketTot.get(k).ingreso * 100) / 100 };
      const bc = bucketCat.get(k) || new Map();
      let resto = 0;
      for (const [c, v] of bc) { if (topSet.has(c)) obj[c] = Math.round(v * 100) / 100; else resto += v; }
      for (const c of topCats) if (!(c in obj)) obj[c] = 0;
      obj.Resto = Math.round(resto * 100) / 100;
      return obj;
    });
    const assetsArr = assets.map((x) => ({ ...x, total: byAsset.get(x.name) || 0 }));
    return {
      parts, gasto, ingresos, interno, byCat, byInternoCat, byAsset, byAssetCat, byAssetIncome, byAssetRange, buckets, topCats, assets: assetsArr,
      extraGasto, extraIngreso, extraGastoIds: [...extraGastoIds], extraIngresoIds: [...extraIngresoIds],
      rangeDays, mesesData, annualFactor, mediaMensual: gasto / mesesData, gastoProj: gasto * annualFactor,
    };
  }, [movs, assets, groups, filters.cats, filters.assetsSel, filters.groupsSel, granularity]);

  const agg = useMemo(() => (periodRange ? makeAgg(periodRange, true) : null), [makeAgg, periodRange]);
  // Para el informe de la renta: el periodo elegido, SIN los filtros de pantalla (un filtro de
  // categoría o etiqueta dejaba el informe fiscal incompleto sin avisar) y CON los
  // extraordinarios (una derrama o una reparación grande sí es gasto del inmueble).
  const rentaAgg = useMemo(() => (periodRange ? makeAgg(periodRange, false, { conExtra: true }) : null), [makeAgg, periodRange]);
  // Movimientos que respetan TODOS los filtros de arriba (fecha, categorías, activos,
  // grupos) y sin los de la papelera. Para la pestaña Clasificación.
  const filteredMovs = useMemo(() => {
    const catF = filters.cats, assF = filters.assetsSel, grpF = filters.groupsSel;
    return movs.filter((m) => {
      if (m.omit) return false;
      if (periodRange && (m.date < periodRange[0] || m.date > periodRange[1])) return false;
      if (grpF.size && !groups.some((g) => grpF.has(g.name) && movInGroup(m, g))) return false;
      if (catF.size || assF.size) {
        const parts = expandParts(m, assets);
        if (catF.size && !parts.some((p) => catF.has(p.cat))) return false;
        if (assF.size && !parts.some((p) => p.asset && assF.has(p.asset))) return false;
      }
      return true;
    });
  }, [movs, periodRange, filters.cats, filters.assetsSel, filters.groupsSel, groups, assets]);
  const allAgg = useMemo(() => (dataRange ? makeAgg(dataRange, false) : null), [makeAgg, dataRange]);

  const agentCtx = useMemo(() => ({
    // Sin la papelera: el asistente contaba movimientos que tú ya habías borrado.
    movs: liveMovs, assets, groups, budgets, receiptTrends, recurring, dataRange,
    mesesData: allAgg?.mesesData || 0,
  }), [liveMovs, assets, groups, budgets, receiptTrends, recurring, dataRange, allAgg]);

  const monthlySpark = useMemo(() => {
    const m = new Map();
    for (const mv of movs) { if (mv.amount >= 0 || INTERNAL_SET.has(mv.category || "Otros")) continue; const k = monthKey(mv.date); m.set(k, (m.get(k) || 0) + (-mv.amount)); }
    return [...m.keys()].sort().slice(-12).map((k) => Math.round(m.get(k)));
  }, [movs]);

  const makeGroupStats = useCallback((range) => {
    const map = new Map();
    // total = gasto (se mantiene para orden y desglose por categoría). Añadimos ingreso
    // y gasto por separado para poder mostrar ingresos, gastos y neto en la etiqueta.
    for (const g of groups) map.set(g.id, { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map(), byYear: new Map() });
    const a = range ? range[0] : null, b = range ? range[1] : null;
    for (const m of movs) {
      if (m.omit) continue;
      if (range && (m.date < a || m.date > b)) continue;
      for (const g of groups) {
        if (!movInGroup(m, g)) continue;
        const s = map.get(g.id);
        s.count++;
        for (const p of expandParts(m, assets)) {
          if (p.amount < 0) {
            const v = -p.amount;
            s.total += v; s.gasto += v;
            s.byCat.set(p.cat, (s.byCat.get(p.cat) || 0) + v);
            const y = m.date.getFullYear();
            s.byYear.set(y, (s.byYear.get(y) || 0) + v);
          } else {
            s.ingreso += p.amount;
          }
        }
      }
    }
    return map;
  }, [movs, groups, assets]);

  const groupStats = useMemo(() => makeGroupStats(periodRange), [makeGroupStats, periodRange]);
  const allGroupStats = useMemo(() => makeGroupStats(dataRange), [makeGroupStats, dataRange]);

  /* Atípicos reactivos al rango: la referencia de "lo normal" se calcula DENTRO del
     periodo elegido, no sobre todo el histórico. Así, al mirar 2025, lo atípico es lo
     atípico de 2025. (Los avisos del resumen siguen usando la base global, que es lo
     correcto para "gasto atípico reciente".) */
  const outlierMovs = useMemo(() => {
    if (!periodRange) return [];
    const [a, b] = periodRange;
    const inRange = liveMovs.filter((m) => m.date >= a && m.date <= b);
    const info = computeOutliers(inRange);
    return inRange.filter((m) => info.has(m.id)).map((m) => ({ ...m, _out: info.get(m.id) })).sort((x, y) => x.amount - y.amount);
  }, [liveMovs, periodRange]);

  const onPickMonth = useCallback((label) => {
    const bk = agg?.buckets.find((x) => x.label === label);
    if (!bk) return;
    const key = bk._key;
    if (/^\d{4}-\d{2}$/.test(key)) setFilters((f) => ({ ...f, periodType: "month", month: key }));
    else if (/^\d{4}$/.test(key)) setFilters((f) => ({ ...f, periodType: "year", year: +key }));
  }, [agg]);

  /* ---------- Render ---------- */
  const TABS = ALL_TABS.filter((t) => !tabsOcultas.includes(t.id));

  return (
    <div className="min-h-screen overflow-x-clip" style={{ background: C.bg, color: C.ink }}>
      {!booted && (
        <div className="flex min-h-screen items-center justify-center"><Spinner label="Abriendo tus finanzas…" /></div>
      )}
      {booted && (<>
      <style>{`
        /* --- Tipografía. Inter si el shell de la PWA la sirve; si no, la del sistema. --- */
        :root {
          --font-sans: "Inter var", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          --scrollbar: #D9D9DE; --scrollbar-hover: #BFBFC6;
        }
        html, body { font-family: var(--font-sans); }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        h1, h2, h3 { letter-spacing: -0.012em; }
        .text-2xl, .text-xl { letter-spacing: -0.018em; }

        /* --- Modo oscuro. El tema se fija en <html data-theme>. Las reglas de abajo
               reasignan las utilidades de Tailwind que la app usa de verdad: como llevan
               un atributo delante, ganan en especificidad sin necesidad de !important. --- */
        :root[data-theme="dark"] { color-scheme: dark; --scrollbar: #3A3F4A; --scrollbar-hover: #4C525F; }
        :root[data-theme="dark"] .bg-white { background-color: ${TOKENS.dark.surface} }
        :root[data-theme="dark"] .bg-slate-50 { background-color: ${TOKENS.dark.surfaceAlt} }
        :root[data-theme="dark"] .bg-slate-100 { background-color: #232730 }
        :root[data-theme="dark"] .bg-slate-200, :root[data-theme="dark"] .bg-slate-200\\/70 { background-color: #2C313B }
        :root[data-theme="dark"] .text-slate-300 { color: ${TOKENS.dark.faint} }
        :root[data-theme="dark"] .text-slate-400 { color: ${TOKENS.dark.faint} }
        /* Gris de textos secundarios: el slate-400 de Tailwind da 2,6:1 sobre blanco. */
        :root:not([data-theme="dark"]) .text-slate-400 { color: ${TOKENS.light.faint} }
        :root[data-theme="dark"] .text-slate-500 { color: ${TOKENS.dark.muted} }
        :root[data-theme="dark"] .text-slate-600 { color: ${TOKENS.dark.muted} }
        :root[data-theme="dark"] .text-slate-700 { color: ${TOKENS.dark.ink2} }
        :root[data-theme="dark"] .text-slate-800, :root[data-theme="dark"] .text-slate-900 { color: ${TOKENS.dark.ink} }
        :root[data-theme="dark"] .hover\\:bg-slate-50:hover, :root[data-theme="dark"] .hover\\:bg-white:hover { background-color: ${TOKENS.dark.surfaceAlt} }
        :root[data-theme="dark"] .hover\\:bg-slate-100:hover { background-color: #232730 }
        :root[data-theme="dark"] .hover\\:text-slate-800:hover { color: ${TOKENS.dark.ink} }
        :root[data-theme="dark"] .bg-blue-50, :root[data-theme="dark"] .hover\\:bg-blue-50:hover { background-color: ${TOKENS.dark.accentSoft} }
        :root[data-theme="dark"] .text-blue-600, :root[data-theme="dark"] .text-blue-700 { color: ${TOKENS.dark.accent} }
        :root[data-theme="dark"] .bg-rose-50, :root[data-theme="dark"] .bg-rose-50\\/50,
        :root[data-theme="dark"] .bg-rose-100, :root[data-theme="dark"] .hover\\:bg-rose-50:hover { background-color: ${TOKENS.dark.expenseSoft} }
        :root[data-theme="dark"] .border-rose-200 { border-color: #5A2A31 }
        :root[data-theme="dark"] .text-rose-600, :root[data-theme="dark"] .text-rose-700,
        :root[data-theme="dark"] .text-rose-800, :root[data-theme="dark"] .hover\\:text-rose-600:hover { color: ${TOKENS.dark.expense} }
        :root[data-theme="dark"] .text-emerald-700 { color: ${TOKENS.dark.income} }
        :root[data-theme="dark"] .text-amber-700 { color: ${TOKENS.dark.warn} }
        :root[data-theme="dark"] .shadow-sm, :root[data-theme="dark"] .shadow-md,
        :root[data-theme="dark"] .shadow-xl, :root[data-theme="dark"] .shadow-2xl { box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35) }

        @keyframes animFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes animRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes animSlide { from { transform: translateX(24px); opacity: .6 } to { transform: none; opacity: 1 } }
        @keyframes animSheet { from { transform: translateY(16px); opacity: .4 } to { transform: none; opacity: 1 } }
        @keyframes animDrawer { from { transform: translateX(-100%) } to { transform: none } }
        .anim-fade { animation: animFade .18s ease-out }
        .anim-rise { animation: animRise .28s cubic-bezier(.22,1,.36,1) }
        .anim-slide { animation: animSlide .26s cubic-bezier(.22,1,.36,1) }
        .anim-sheet { animation: animSheet .24s cubic-bezier(.22,1,.36,1) }
        .anim-drawer { animation: animDrawer .24s cubic-bezier(.22,1,.36,1) }
        @media (prefers-reduced-motion: reduce) { .anim-fade,.anim-rise,.anim-slide,.anim-sheet,.anim-drawer { animation: none } }
        /* Botones y tarjetas: transición corta y con curva de salida, nunca en color de texto */
        button, a, .card-hover { transition: background-color .15s ease-out, border-color .15s ease-out, transform .15s cubic-bezier(.22,1,.36,1) }
        button:active { transform: scale(.97) }
        input[type=range]::-webkit-slider-thumb { cursor: pointer }
        ::-webkit-scrollbar { width: 10px; height: 10px }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 8px; border: 2px solid transparent; background-clip: content-box }
        ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); background-clip: content-box }
        .chat-bar { position: sticky; top: var(--app-header-h, 0px); z-index: 10; }
        .chat-dock { position: sticky; bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 640px) { .chat-dock { bottom: .5rem } }
        /* iOS hace zoom al enfocar un input con fuente <16px y descuadra la pantalla.
           Forzamos 16px en los campos de texto en móvil (mantiene el pinch-zoom). */
        @media (max-width: 640px) { input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select { font-size: 16px !important } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important } }
      `}</style>

      {!hasData ? (
        <EmptyState onFiles={handleFiles} onSample={loadSample} error={error} parsing={imp?.phase === "parsing"}
          onSettings={() => setSettingsOpen(true)} onAsistente={() => setAsistenteOpen(true)}
          onEntrar={() => setEntrarOpen({})} />
      ) : (
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:pb-12">
          <header ref={headerRef} className="sticky top-0 z-20 -mx-4 mb-3 px-4 py-3 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,.14)" }}><Wallet size={18} /></span>
                <div className="flex min-w-0 flex-col leading-tight">
                  <h1 className="truncate text-base font-semibold tracking-tight">Mis finanzas</h1>
                  {dataRange && <span className="truncate text-[11px] text-white/55" style={tnum}>{nfNum.format(movs.length)} movimientos · {fmtDate(dataRange[0])} – {fmtDate(dataRange[1])}</span>}
                  {/* Estado del banco a la vista. Rojo = permiso caducado o error; ámbar = lleva más
                      de día y medio sin sincronizar; verde = al día. Pulsar abre Ajustes. */}
                  {bankStatus && (
                    <button type="button" onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 truncate text-left text-[11px] text-white/55 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" style={tnum}
                      title={bankStatus.expired ? "El permiso del banco ha caducado: reconecta en Ajustes" : bankStatus.failed ? "La última sincronización falló: mira Ajustes" : bankStatus.last ? new Date(bankStatus.last).toLocaleString("es-ES") : "Aún no se ha sincronizado"}>
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: bankStatus.expired || bankStatus.failed ? "#f87171" : bankStatus.stale || !bankStatus.last ? "#fbbf24" : "#4ade80" }} />
                      <span className="truncate">
                        {bankStatus.expired ? "Permiso del banco caducado · reconectar" : bankStatus.failed ? "Error al sincronizar con el banco" : bankStatus.last ? `Banco sincronizado ${fmtAgo(bankStatus.last)}` : "Banco sin sincronizar"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDrill({ type: "search", key: "buscador", label: "Buscar movimientos" })} aria-label="Buscar movimientos"
                  className="rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  <Search size={17} />
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-within:ring-2 focus-within:ring-white/60" style={{ background: "rgba(255,255,255,.14)" }}>
                  <Plus size={15} /> <span className="hidden sm:inline">Añadir CSV</span><span className="sm:hidden">CSV</span>
                  <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods,.json,text/csv,text/plain,text/tab-separated-values,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/comma-separated-values,application/octet-stream" className="sr-only" onChange={(e) => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ""; }} />
                </label>
                {movsPend.length > 0 && (
                  <button type="button" onClick={() => setPendingOpen(true)} aria-label="Movimientos por clasificar"
                    className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style={{ background: "rgba(244,192,99,.25)" }}>
                    <ClipboardList size={15} />
                    <span className="tabular-nums">{movsPend.length}</span>
                    <span className="hidden sm:inline">por revisar</span>
                  </button>
                )}
                <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                  title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
                  className="rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Ajustes y datos" title={saveState === "saved" ? "Todo guardado" : saveState === "saving" ? "Guardando…" : "No se pudo guardar"}
                  className="relative rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  <Settings size={17} />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: saveState === "error" ? "#FF8A94" : saveState === "saving" ? "#F4C063" : "#5FD4B0", transition: "background .3s" }} />
                </button>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-4 flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>
              <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="rounded p-0.5 hover:bg-rose-100"><X size={14} /></button>
            </div>
          )}
          {imp?.phase === "parsing" && <Card className="mb-4 p-4"><Spinner label={`Leyendo ${imp.fileName}…`} /></Card>}

          <nav className="mb-4 hidden gap-1 border-b sm:flex" style={{ borderColor: C.line }} aria-label="Secciones">
            {TABS.map((t) => {
              const I = t.icon;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tab === t.id ? "" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  style={tab === t.id ? { borderColor: C.accent, color: C.accent } : {}}>
                  <I size={15} /> {t.label}
                </button>
              );
            })}
          </nav>

          {/* Ideas (recap, plan, presupuesto) usa todo el histórico: los filtros no le afectan y
              enseñarlos ahí confundía. */}
          {tab !== "asistente" && tab !== "ideas" && agg && (
            <div className="mb-4">
              <FiltersBar filters={filters} setFilters={setFilters} monthsAvail={monthsAvail} yearsAvail={yearsAvail} assets={assets} groups={groups} />
            </div>
          )}

          {tab === "resumen" && agg && (
            <ResumenTab agg={agg} allAgg={allAgg} granularity={granularity} setGranularity={setGranularity} onDrill={setDrill} onPickMonth={onPickMonth}
              outlierMovs={outlierMovs} recurring={recurring} monthlySpark={monthlySpark} saldoSerie={saldoSerie} momDelta={momDelta} alerts={alerts} cierre={cierre} onOpenPending={() => setPendingOpen(true)} onDismissAlert={dismissAlert} />
          )}
          {tab === "analisis" && agg && (
            <div className="space-y-4 anim-rise">
              <GastoCalendar movs={filteredMovs} meses={monthsAvail} onDrill={setDrill}
                mesFiltro={filters.periodType === "month" ? filters.month : null}
                onPickMes={(k) => setFilters((f) => ({ ...f, periodType: "month", month: k }))} />
              <ExtraordinariosCard movs={filteredMovs} onDrill={setDrill} />
              <Card className="p-4">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">Desglose jerárquico</h2>
                  <span className="text-xs text-slate-400">Pulsa una fila para expandir o ver el detalle</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Gastos por supra categoría → categoría → comercio (o por activo), e ingresos por origen. Respeta los filtros de arriba.</p>
                <HierarchyExplorer parts={agg.parts} assets={assets} onDrill={setDrill} />
              </Card>
            </div>
          )}
          {tab === "clasificar" && agg && <ClasificacionTab movs={filteredMovs} assets={assets} groups={groups}
            onRecat={recat} onReasset={reasset} onReassetAll={reassetAll} onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov} onCreateAsset={createAsset}
            onNote={setNote} onNoteAll={setNoteAll} onToggleExtra={toggleExtra} onDelete={deleteMovs} onSetAmount={setAmount} outliers={outliers} onOpenPending={() => setPendingOpen(true)}
            onNewMov={() => setMovEdit({ mode: "new" })} onEditMov={(m) => setMovEdit({ mode: "edit", mov: m })} />}
          {tab === "activos" && agg && (
            <div className="space-y-4">
              <div className="flex"><Seg ariaLabel="Activos o etiquetas" value={subAct} onChange={setSubAct}
                options={[{ v: "activos", l: "🏠 Activos" }, { v: "etiquetas", l: "🏷️ Etiquetas" }]} /></div>
              {subAct === "activos"
                ? <ActivosTab assets={assets} setAssets={setAssets} agg={agg} rentaAgg={rentaAgg} allAgg={allAgg} onDrill={setDrill} periodLabel={describePeriod(filters)} onRenameAsset={renameAsset} onDeleteAsset={deleteAsset} />
                : <GruposTab groups={groups} setGroups={setGroups} groupStats={groupStats} allGroupStats={allGroupStats}
                    movsAll={movs} annualFactor={allAgg.annualFactor} mesesData={allAgg.mesesData} onDrill={setDrill} />}
            </div>
          )}
          {tab === "ideas" && agg && (
            <div className="space-y-4">
              <div className="flex"><Seg ariaLabel="Recap, ideas o plan" value={subIdea} onChange={setSubIdea}
                options={[{ v: "recap", l: "📅 Recap" }, { v: "ideas", l: "✨ Ideas" }, { v: "plan", l: "🎯 Plan" }]} /></div>
              {subIdea === "recap"
                ? <MonthRecap movs={movs} onDrill={setDrill} />
                : subIdea === "ideas"
                ? <InteligenciaTab movs={movs} agg={agg} allAgg={allAgg}
                    recurring={recurring} receiptTrends={receiptTrends} outlierMovs={outlierMovs} reducible={reducible} onDrill={setDrill} />
                : <PlanTab budgets={budgets} setBudgets={setBudgets} movs={movs} monthsAvail={monthsAvail} allAgg={allAgg}
                    agg={agg} reducible={reducible} setReducible={setReducible} recurring={recurring}
                    receiptTrends={receiptTrends} upcoming={upcoming} onDrill={setDrill} />}
            </div>
          )}
          {tab === "asistente" && <AsistenteTab aiOn={aiOn} setAiOn={setAiOn} hasData={hasData} ctx={agentCtx} ai={ai} aiDetail={aiDetail} onCreateProposal={createGroupFromProposal} onApplyReclassify={applyReclassify} onOpenSettings={() => setSettingsOpen(true)} msgs={chatMsgs} setMsgs={setChatMsgs}
            conversations={chatStore.convs} activeId={chatStore.activeId} onNewChat={newChat} onSelectChat={selectChat} onDeleteChat={deleteChat} />}

          <footer className="mt-10 text-center text-xs text-slate-400">
            Tus datos se guardan solo en {STORE.kind} y puedes exportarlos o borrarlos desde Ajustes.{" "}
            {aiDetail
              ? "Has permitido que el asistente consulte movimientos individuales."
              : "El asistente recibe totales y nombres de comercios, nunca movimientos uno a uno ni nombres de personas."}
            <span className="mt-1 block text-[10px] text-slate-400">versión {BUILD_STAMP} · <a href="/privacidad.html" className="underline hover:text-slate-600">Privacidad</a> · <a href="https://github.com/lsantos44/finanzas-app" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Código fuente (AGPL-3.0)</a></span>
          </footer>
        </div>
      )}

      {hasData && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t sm:hidden" style={{ borderColor: C.line, background: C.surface, paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Secciones">
          {TABS.map((t) => {
            const I = t.icon;
            const on = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); setDrill(null); }}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                style={{ color: on ? C.accent : C.muted }}>
                <I size={20} strokeWidth={on ? 2.4 : 1.9} /> {t.short || t.label}
              </button>
            );
          })}
        </nav>
      )}

      {imp?.phase === "mapping" && (
        <MappingModal imp={imp}
          onCancel={() => { setImp(null); sampleRef.current = false; }}
          onConfirm={({ dataStart, cols }) => {
            try { finishParse(imp.rows, dataStart, cols, imp.fileName, { cols, headerIdx: dataStart - 1 }); }
            catch (e) { setImp(null); setError("Error al procesar las columnas: " + e.message); }
          }} />
      )}
      {imp?.phase === "validate" && (
        <ValidationModal val={imp.val}
          onCancel={() => { setImp(null); sampleRef.current = false; }}
          onRemap={() => setImp({ phase: "mapping", fileName: imp.fileName, rows: imp.rows, analysis: { cols: imp.cols, headerIdx: imp.dataStart - 1 } })}
          onConfirm={applyImport} />
      )}
      {drill && agg && (
        <DrillPanel
          drill={drill} assets={assets} groups={groups} outliers={outliers}
          movs={drillMovs}
          onClose={() => setDrill(null)} onRecat={recat} onReasset={reasset} onReassetAll={reassetAll} onCreateAsset={createAsset} onToggleExtra={toggleExtra}
          onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov} onNote={setNote} onDelete={deleteMovs} onSetAmount={setAmount}
          onEditMov={(m) => setMovEdit({ mode: "edit", mov: m })} onSplit={splitMov}
        />
      )}
      {vueltaAjena && <VueltaOtroNavegador url={vueltaAjena} onClose={() => {
        setVueltaAjena(null);
        try { window.history.replaceState({}, "", window.location.pathname); } catch { /* noop */ }
      }} />}
      {entrarOpen && <EntrarModal inicial={entrarOpen.inicial} auto={entrarOpen.auto} onEntrar={entrar} onClose={() => setEntrarOpen(null)} />}
      {asistenteOpen && (
        <AsistenteConexion
          workerUrl={bankCfg.workerUrl || ""} token={bankCfg.token || ""}
          // A disco al momento (no vía persistBank): activarSync lee la URL y el token de ahí.
          onGuardar={(u, t) => { saveBank({ ...loadBank(), workerUrl: u, token: t }); setBankCfg(loadBank()); }}
          onActivarSync={activarSync}
          onConectarBanco={(aspsp, pais, psu) => { setAsistenteOpen(false); bankStartAuth(aspsp, pais, null, psu); }}
          onClose={() => setAsistenteOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} storeKind={STORE.kind} saveState={saveState}
          theme={theme} setTheme={setTheme} upcoming={upcoming}
          movsCount={movs.length} aiOn={aiOn} setAiOn={setAiOn} ai={ai} setAi={setAi} aiDetail={aiDetail} setAiDetail={setAiDetail}
          aiProfiles={aiProfiles} onSaveAiProfile={saveAiProfile} onActivateAiProfile={activateAiProfile} onDeleteAiProfile={deleteAiProfile}
          onExport={exportJSON} onImportFile={importJSON} onWipe={wipeAll}
          snapCount={snapCount} snapTooBig={snapTooBig} onListSnaps={listSnaps} onRestoreSnap={restoreSnapshot}
          materialidad={materialidad} setMaterialidad={setMaterialidad}
          imports={imports} onDeleteImport={deleteImport}
          onFindDupes={findBankDupes} onTrashDupes={trashBankDupes}
          onAsistente={() => setAsistenteOpen(true)}
          tabsOcultas={tabsOcultas} onToggleTab={toggleTab}
          assetMem={assetMem} onForgetAssetMem={forgetAssetMem} onForgetAllAssetMem={forgetAllAssetMem}
          onDrillIds={(ids, label) => { setSettingsOpen(false); setDrill({ type: "ids", ids, label }); }}
          trashed={trashed} onRestoreTrash={restoreMovs} onPurgeTrash={purgeMovs}
          onRulesAudit={rulesAudit} onToggleRule={toggleRule} onRemoveRule={removeCustomRule} onUpdateRuleCat={updateRuleCat}
          sync={{ busy: syncBusy, msg: syncMsg, conflict: syncConflict, auto: !!syncCfg.auto, version: syncCfg.version || 0, lastPush: syncCfg.lastPush || 0, lastPull: syncCfg.lastPull || 0,
            onPush: (o) => syncPush(o), onPull: (o) => syncPull({ confirmReplace: true, ...o }), onHistory: syncHistory, onRestore: syncRestore,
            backendInfo, onDiagnostico: diagnostico,
            onToggleAuto: (v) => { persistSync({ auto: v }); setSyncMsg({ kind: "info", text: v ? "Sincronización automática activada." : "Sincronización automática desactivada." }); } }}
          bank={{ workerUrl: bankCfg.workerUrl || "", token: bankCfg.token || "", connections: bankCfg.connections || [],
            aspsps: bankAspsps, accountsByConn: bankAccountsByConn, addCountry: bankAddCountry, addSel: bankAddSel, busy: bankBusy, msg: bankMsg,
            auto: !!bankCfg.auto, cron: cronInfo, concil: conciliaciones,
            onChange: persistBank, onSetAddCountry: setBankAddCountry, onSetAddSel: setBankAddSel, onLoadAspsps: bankLoadAspsps, onAddConnect: bankAddConnect,
            onToggleAuto: (v) => persistBank((b) => ({ ...b, auto: v })),
            diag: bankDiag, onDiagnose: bankDiagnose, onReconnect: bankReconnect,
            addPsu: bankAddPsu, onSetAddPsu: setBankAddPsu, onSetPsu: bankSetPsu,
            otherAccountIds: otherAccountMovIds, onTrashOtherAccounts: trashOtherAccountMovs,
            onLoadAccounts: bankLoadAccounts, onPickAccount: bankPickAccount, onSyncOne: bankSyncOne, onSyncAll: bankSyncAll, onRemove: bankRemoveConnection }} />
      )}
      {pendingOpen && (
        <PendientesPanel movsPend={movsPend} amb={ambPend} assets={assets} setAssets={setAssets} applyPending={applyPending}
          aiOn={aiOn} ai={ai} autoRanRef={aiAutoRanRef} onClose={() => setPendingOpen(false)}
          tagGroups={groups} onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov}
          onRecat={recat} onReasset={reasset} onNote={setNote} onNoteAll={setNoteAll} onSetAmount={setAmount} onDelete={deleteMovs} />
      )}
      {movEdit && (
        <MovEditModal
          initial={movEdit.mode === "edit" ? movEdit.mov : null}
          assets={assets} onCreateAsset={createAsset}
          onSave={(data) => (movEdit.mode === "edit" ? editMov(movEdit.mov, data) : addMov(data))}
          onClose={() => setMovEdit(null)} />
      )}
      </>)}
    </div>
  );
}
