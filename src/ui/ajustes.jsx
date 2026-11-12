import { AI_PRESETS, ALL_TABS, BUILD_STAMP, C, RASGOS_BACKEND, buildICS, fmtCuando, fmtDate, fmtE, fmtE0, nfEUR, nfNum, tnum } from "../core.js";
import { Btn, Grupo, Modal, Seg } from "./comunes.jsx";
import { AccesoOtroNavegador, PrimerosPasos } from "./portada.jsx";
import { AlertTriangle, CalendarDays, Check, Download, FileText, GitBranch, History, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

function AvisoBackend({ info }) {
  if (!info) return null;
  const faltan = info.viejo ? Object.values(RASGOS_BACKEND) : Object.entries(RASGOS_BACKEND).filter(([k]) => !info.rasgos.includes(k)).map(([, v]) => v);
  if (!faltan.length) return null;
  return (
    <div className="mt-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
      <strong>Tu servidor está desactualizado.</strong> Al actualizarlo tendrás: {faltan.join("; ")}.
      <span className="block">Para actualizarlo, pega el archivo <code>src/worker.js</code> nuevo del repositorio MisFinanzas en tu copia de GitHub (se publica solo) o, si lo instalaste a mano, en el editor de tu Worker en Cloudflare. Tus datos no se tocan. La guía lo explica en «Actualizar tu servidor».</span>
    </div>
  );
}
/* Diagnóstico para pedir ayuda: se copia y se pega en un mensaje. No lleva datos personales. */
function CopiarDiagnostico({ generar }) {
  const [hecho, setHecho] = useState(null);
  if (!generar) return null;
  const copiar = async () => {
    const t = generar();
    try { await navigator.clipboard.writeText(t); setHecho("copiado"); } catch { setHecho(t); }
  };
  return (
    <div>
      <button type="button" onClick={copiar} className="text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ color: C.accent }}>Copiar diagnóstico</button>
      <span className="ml-1.5 text-[11px] text-slate-500">{hecho === "copiado" ? "Copiado: pégalo en tu mensaje de ayuda. No incluye importes, conceptos ni contraseñas." : "Estado de la app para pedir ayuda, sin datos personales."}</span>
      {hecho && hecho !== "copiado" && <textarea readOnly value={hecho} aria-label="Diagnóstico" className="mt-1 h-32 w-full rounded-lg border p-2 font-mono text-[10px]" style={{ borderColor: C.line }} />}
    </div>
  );
}

/* Versiones guardadas en tu backend, para recuperar cualquiera (un borrado sin querer, una
   importación equivocada, un «Subir» de más). Antes el servidor las guardaba pero la app no
   ofrecía forma de volver a ellas. */
function VersionesServidor({ sync }) {
  const [lista, setLista] = useState(null); // null | { versions } | { error }
  const [abierto, setAbierto] = useState(false);
  const abrir = async () => { setAbierto(!abierto); if (!abierto) { setLista(null); setLista(await sync.onHistory()); } };
  return (
    <div>
      <button type="button" onClick={abrir} className="text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ color: C.accent }} aria-expanded={abierto}>
        {abierto ? "Ocultar versiones anteriores" : "Versiones anteriores…"}
      </button>
      {abierto && (
        <div className="mt-1.5 rounded-lg border p-2" style={{ borderColor: C.line }}>
          {!lista && <p className="text-xs text-slate-500">Cargando…</p>}
          {lista?.error && <p className="text-xs text-rose-700">No se pudo leer el historial: {lista.error}</p>}
          {lista?.versions && !lista.versions.length && <p className="text-xs text-slate-500">Aún no hay versiones anteriores.</p>}
          {lista?.versions?.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {lista.versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-2 text-xs" style={tnum}>
                  <span className="text-slate-600">v{v.version} · {new Date(v.updatedAt).toLocaleString("es-ES")}{v.version === sync.version ? " (actual)" : ""}</span>
                  {v.version !== sync.version && <Btn size="sm" onClick={() => sync.onRestore(v)} disabled={sync.busy}>Recuperar</Btn>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-slate-500">Se guardan las 10 últimas y una por día del último mes.</p>
        </div>
      )}
    </div>
  );
}

function SettingsModal({ onClose, storeKind, saveState, theme, setTheme, upcoming, movsCount, aiOn, setAiOn, ai, setAi, aiDetail, setAiDetail, aiProfiles, onSaveAiProfile, onActivateAiProfile, onDeleteAiProfile, materialidad, setMaterialidad, onExport, onImportFile, onWipe, snapCount, snapTooBig, onListSnaps, onRestoreSnap, imports, onDeleteImport, trashed, onRestoreTrash, onPurgeTrash, onRulesAudit, onToggleRule, onRemoveRule, onUpdateRuleCat, onFindDupes, onTrashDupes, assetMem, onForgetAssetMem, onForgetAllAssetMem, onDrillIds, onAsistente, sync, bank, tabsOcultas, onToggleTab }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeServidor, setWipeServidor] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // archivo pendiente de confirmar borrado
  const [trashOpen, setTrashOpen] = useState(false);
  const upcomingItems = upcoming?.items || [];
  const downloadICS = () => {
    const blob = new Blob([buildICS(upcomingItems)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cargos-previstos.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  const [importMsg, setImportMsg] = useState(null);
  const [snaps, setSnaps] = useState(null);
  const [snapsOpen, setSnapsOpen] = useState(false);
  const [dupes, setDupes] = useState(null); // null = sin buscar; [] = buscado y limpio
  const [abrir, setAbrir] = useState(null);  // grupo al que saltar desde Primeros pasos
  const [primerosOcultos, setPrimerosOcultos] = useState(() => { try { return !!localStorage.getItem("finz:primeros-ocultos"); } catch { return false; } });
  const fileRef = useRef(null);
  const custom = ai.provider !== "claude";
  // La clave de un proveedor no debe viajar a otro: al cambiar de servidor se vacía.
  const hostDe = (u) => { try { return new URL(u).host; } catch { return String(u || ""); } };
  const setAiField = (k, v) => setAi((c) => ({ ...c, [k]: v, ...(k === "baseUrl" && hostDe(v) !== hostDe(c.baseUrl) ? { apiKey: "" } : {}) }));
  const applyPreset = (p) => setAi((c) => ({ ...c, provider: "openai_compat", baseUrl: p.baseUrl, model: p.model, ...(hostDe(p.baseUrl) !== hostDe(c.baseUrl) ? { apiKey: "" } : {}) }));
  const openSnaps = async () => { setSnapsOpen(true); setSnaps(await onListSnaps()); };
  const [rulesOpen, setRulesOpen] = useState(false);
  const [audit, setAudit] = useState(null);
  const [profLabel, setProfLabel] = useState("");
  // Un perfil está "activo" si coincide con la config de IA actual (ignora la clave).
  const profileActive = (p) => p.provider === ai.provider && (p.baseUrl || "") === (ai.baseUrl || "") && (p.model || "") === (ai.model || "");
  const openRules = () => { setRulesOpen(true); setAudit(onRulesAudit()); };
  const toggle = (id, active) => { onToggleRule(id, active); setAudit((a) => a.map((x) => (x.id === id ? { ...x, active } : x))); };
  const remove = (id) => { onRemoveRule(id); setAudit((a) => a.filter((x) => x.id !== id)); };
  const changeCat = (id, cat) => { onUpdateRuleCat?.(id, cat); setAudit((a) => a.map((x) => (x.id === id ? { ...x, cat, conflict: false, conflictCat: null } : x))); };
  return (
    <Modal title="Ajustes y datos" onClose={onClose}>
      <div className="space-y-5">
        {/* Ajustes es también donde se orienta quien llega nuevo: cada grupo enseña su
            estado, de modo que de un vistazo se ve qué falta por configurar. Lo que se usa
            una vez al año deja de ocupar lo mismo que lo que se mira cada semana. */}
        {/* Lo primero que ve quien abre Ajustes por primera vez: dónde está y qué puede ganar.
            Se cierra solo cuando ya no queda nada por configurar, para no estorbar después. */}
        {/* Cuando ya está todo hecho, o la persona lo descarta, deja de existir: si no, estorbaría
            en Ajustes toda la vida de la app. */}
        {!primerosOcultos && [movsCount > 0, !!sync?.version, !!(bank && bank.connections.length), aiOn].some((x) => !x) && (
        <Grupo titulo="Primeros pasos" abierto={!(movsCount && sync?.version && bank?.connections?.length)}
          estado={`${[movsCount > 0, !!sync?.version, !!(bank && bank.connections.length), aiOn].filter(Boolean).length} de 4 completados`}>
          <PrimerosPasos
            tieneDatos={movsCount > 0} tieneSync={!!sync?.version}
            tieneBanco={!!(bank && bank.connections.length)} tieneIA={!!aiOn}
            onIr={(destino) => {
              // El asistente verifica cada paso contra tu propio backend; la guía solo explica.
              if (destino === "guia") { onClose(); onAsistente(); return; }
              if (destino === "cerrar") { onClose(); return; }
              setAbrir(destino); // despliega el grupo correspondiente
            }} />
          <button type="button" onClick={() => { try { localStorage.setItem("finz:primeros-ocultos", "1"); } catch { /* noop */ } setPrimerosOcultos(true); }}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
            No volver a mostrar
          </button>
        </Grupo>
        )}

        <Grupo titulo="Tus datos y sincronización" abierto={abrir === "sync"} forzar={abrir === "sync"}
          estado={sync?.version ? `sincronizado · versión ${sync.version}` : "sin sincronizar"}
          ok={!!sync?.version}>
        <section>
          <h3 className="text-sm font-semibold">Tus datos</h3>
          {/* Saber qué build está sirviendo el navegador: sin esto, ante un fallo no se distingue
              "el arreglo no funciona" de "no se ha subido / está cacheado", y se gastan despliegues. */}
          <p className="mt-1 text-[11px] text-slate-400" style={tnum}>
            Versión de la app: {BUILD_STAMP} <span className="text-slate-300">(la fecha en que se publicó; sirve para saber si tienes la última)</span>
            <span className="block">Origen: {typeof window !== "undefined" ? window.location.host : "?"}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {nfNum.format(movsCount)} movimientos guardados en <strong>{storeKind}</strong>, solo accesibles para ti.
            {" "}Estado: {saveState === "saving" ? "guardando…" : saveState === "error" ? "no se pudo guardar el último cambio" : "todo guardado"}.
          </p>
          {/* Lo local se guarda al instante; lo que interesa saber es cuándo llegó a tu backend,
              que es lo que verá otro dispositivo. */}
          {sync && (sync.lastPush || sync.lastPull) && (
            <p className="mt-1 text-xs text-slate-500" style={tnum}>
              {sync.lastPush ? <>Último guardado en tu backend: <strong>{fmtCuando(sync.lastPush)}</strong>.</> : null}
              {sync.lastPull ? <> Última descarga: {fmtCuando(sync.lastPull)}.</> : null}
            </p>
          )}
        </section>
        {sync && (
        <section>
          <h3 className="text-sm font-semibold">Sincronizar con tu backend</h3>
          <AvisoBackend info={sync.backendInfo} />
          <p className="mt-1 text-xs text-slate-500">
            Guarda tus datos en tu propio Worker, usando la URL y el token de arriba. No necesita Google ni volver a autorizar nada: una vez puesto, funciona siempre. Funciona en todos tus dispositivos.
          </p>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Btn kind="primary" onClick={() => sync.onPush()} disabled={sync.busy}><Upload size={14} /> Guardar</Btn>
              <Btn onClick={() => sync.onPull()} disabled={sync.busy}><Download size={14} /> Traer</Btn>
            </div>
            {sync.busy && <p className="text-xs text-slate-400">Hablando con tu Worker…</p>}
            {sync.msg && <p className={`text-xs ${sync.msg.kind === "ok" ? "text-emerald-700" : sync.msg.kind === "err" ? "text-rose-700" : "text-slate-500"}`}>{sync.msg.text}</p>}

            {/* El servidor rechaza una escritura basada en una versión vieja, así que aquí no se
                pierde nada: solo hay que decidir. Nada se sobrescribe sin tu permiso. */}
            {sync.conflict && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                <p className="text-[11px] font-medium leading-relaxed text-amber-800">
                  El servidor tiene la versión {sync.conflict.version}, más nueva que la de este dispositivo. No se ha sobrescrito nada. Elige:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn size="sm" onClick={() => sync.onPull({ confirmReplace: true })} disabled={sync.busy}><Download size={13} /> Traer la del servidor</Btn>
                  <Btn size="sm" kind="primary" onClick={() => sync.onPush({ force: true })} disabled={sync.busy}><Upload size={13} /> Subir la de aquí</Btn>
                </div>
                <p className="mt-1.5 text-[10px] text-amber-700">«Traer» descarta tus cambios locales; «Subir» pisa la del servidor. Las dos se pueden deshacer desde «Versiones anteriores».</p>
              </div>
            )}
            <VersionesServidor sync={sync} />
            <CopiarDiagnostico generar={sync.onDiagnostico} />

            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
              <input type="checkbox" className="accent-blue-600" checked={!!sync.auto} onChange={(e) => sync.onToggleAuto(e.target.checked)} disabled={sync.busy} />
              Sincronizar automáticamente (trae al abrir, guarda al cambiar)
            </label>            <p className="text-[11px] leading-relaxed text-slate-400">
              El guardado automático espera 25 segundos tras el último cambio y también al cerrar la pestaña, para no generar escrituras de más. Lo local se guarda al instante, como siempre.
              {sync.version ? ` Versión en el servidor según este dispositivo: ${sync.version}.` : ""}
            </p>
          </div>
        </section>
        )}
        {bank && <AccesoOtroNavegador workerUrl={bank.workerUrl} token={bank.token} />}
        </Grupo>

        <Grupo titulo="Banco" abierto={abrir === "banco"} forzar={abrir === "banco"}
          estado={bank && bank.connections.length ? `${bank.connections.length} ${bank.connections.length === 1 ? "banco conectado" : "bancos conectados"}` : "sin conectar"}
          ok={!!(bank && bank.connections.length)}>
        {bank && (
        <section>
          <h3 className="text-sm font-semibold">Conexión bancaria (Enable Banking)</h3>
          <p className="mt-1 text-xs text-slate-500">Conecta tus bancos y baja los movimientos automáticamente, sin CSV. Puedes conectar varios.</p>
          {onAsistente && <button type="button" onClick={() => { onClose(); onAsistente(); }} className="mt-1 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" style={{ color: C.accent }}>Abrir el asistente de conexión paso a paso</button>}
          <div className="mt-2 space-y-2">
            <label className="block text-xs text-slate-600">URL del backend (tu Worker)
              <input value={bank.workerUrl} onChange={(e) => bank.onChange({ workerUrl: e.target.value })} placeholder="https://…workers.dev" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
            </label>
            <label className="block text-xs text-slate-600">Token del backend <span className="font-normal text-slate-400">(tu PROXY_TOKEN de Cloudflare)</span>
              <input type="password" value={bank.token} onChange={(e) => bank.onChange({ token: e.target.value })} placeholder="tu token" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
            </label>

            {/* Bancos conectados */}
            {bank.connections.length > 0 && (
              <div className="space-y-2">
                {bank.connections.map((c) => {
                  const accs = bank.accountsByConn[c.id] || [];
                  return (
                    <div key={c.id} className="rounded-xl border p-2.5" style={{ borderColor: C.line, background: C.surface }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">{c.aspsp && c.aspsp !== "Banco" ? c.aspsp : <span style={{ color: C.warn }}>Banco sin identificar</span>}<span className="ml-1 text-[11px] font-normal text-slate-400">{c.country}</span></span>
                        <button type="button" onClick={() => bank.onRemove(c.id)} aria-label="Quitar banco" className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* La opción vacía significa «todas» y antes mostraba el nombre de la cuenta
                            guardada, así que elegirla parecía seleccionarla cuando hacía lo contrario.
                            Y la cuenta guardada no salía hasta pulsar «Ver cuentas»: se añade a mano. */}
                        <select value={c.accountUid || ""} onChange={(e) => { const a = accs.find((x) => x.uid === e.target.value); bank.onPickAccount(c.id, e.target.value, a ? (a.name || a.iban || "") : (e.target.value ? c.accountName : ""), a ? (a.iban || "") : (e.target.value ? c.accountIban : "")); }}
                          className="min-w-0 flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                          <option value="">Todas las cuentas</option>
                          {c.accountUid && !accs.some((a) => a.uid === c.accountUid) && (
                            <option value={c.accountUid}>{c.accountName || c.accountUid.slice(0, 8)} (guardada)</option>
                          )}
                          {accs.map((a) => (
                            <option key={a.uid} value={a.uid}>
                              {a.name || a.uid.slice(0, 8)}{a.iban ? ` · ${a.iban.slice(-6)}` : ""}{typeof a.balance === "number" ? ` · ${nfEUR.format(a.balance)}` : ""}{a.type ? ` (${a.type})` : ""}
                            </option>
                          ))}
                        </select>
                        <Btn size="sm" onClick={() => bank.onLoadAccounts(c.id)} disabled={bank.busy}>Ver cuentas</Btn>
                        <Btn size="sm" kind="primary" onClick={() => bank.onSyncOne(c.id)} disabled={bank.busy}><RefreshCw size={13} /> Sincronizar</Btn>
                        <Btn size="sm" onClick={() => bank.onReconnect(c.id)} disabled={bank.busy}>Reconectar</Btn>
                      </div>
                      {/* Titular por conexión: si no coincide con el del banco, el consentimiento
                          se firma pero luego toda petición de datos falla con ASPSP_ERROR. */}
                      <label className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        Titular:
                        <select value={c.psu || "personal"} onChange={(e) => bank.onSetPsu(c.id, e.target.value)}
                          className="rounded-md border bg-white px-1.5 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                          <option value="personal">Personal</option>
                          <option value="business">Empresa / autónomo</option>
                        </select>
                        <span className="text-slate-400">sesión activa: {c.sessionPsu ? (c.sessionPsu === "business" ? "empresa" : "personal") : "desconocida"}</span>
                      </label>
                      {/* Este desplegable NO reautoriza: solo decide qué se pedirá la próxima vez.
                          Sin este aviso parece que el cambio se aplica ya, y se prueba dos veces
                          la misma sesión creyendo estar probando dos configuraciones. */}
                      {(c.psu || "personal") !== (c.sessionPsu || "personal") && (
                        <p className="mt-1 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                          Cambiar el titular no reautoriza nada: la sesión de ahora se creó como <strong>{c.sessionPsu ? (c.sessionPsu === "business" ? "empresa" : "personal") : "desconocida"}</strong> y sigue igual. Pulsa <strong>Reconectar</strong> para que el cambio surta efecto.
                        </p>
                      )}
                      {/* El permiso caducado era invisible: el auto-sync se tragaba el error y solo
                          quedaba una fecha de «última» antigua que nadie mira. Ahora se canta. */}
                      {c.lastError && (
                        <p className="mt-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                          {c.expired ? "El permiso de este banco ha caducado: pulsa Reconectar para renovarlo." : "La última sincronización falló."}
                          <span className="block font-normal opacity-80">{c.lastError}{c.lastErrorAt ? ` · ${new Date(c.lastErrorAt).toLocaleString("es-ES")}` : ""}</span>
                        </p>
                      )}
                      {/* Solo se ofrece con las cuentas de la sesión actual cargadas («Ver cuentas»):
                          sin esa lista no hay forma de saber qué uid es de qué cuenta, y la versión
                          anterior daba por ajeno todo uid antiguo de la propia cuenta buena.
                          Y nunca se borra a ciegas: primero se ven los movimientos. */}
                      {(() => {
                        const otros = c.accountUid ? (bank.otherAccountIds?.(c.aspsp, c.accountUid, accs.map((a) => a.uid)) || []) : [];
                        if (!otros.length) return null;
                        return (
                          <div className="mt-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                            Hay {nfNum.format(otros.length)} movimientos que pertenecen a <strong>otra cuenta de la sesión actual</strong>, no a {c.accountName || "la que sigues"}.
                            <span className="mt-1 flex flex-wrap gap-2">
                              <button type="button" onClick={() => onDrillIds?.(otros, "Movimientos de otra cuenta")} className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">Verlos primero</button>
                              <button type="button" onClick={() => bank.onTrashOtherAccounts(c.aspsp, c.accountUid, accs.map((a) => a.uid))} className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">Enviarlos a la papelera</button>
                            </span>
                          </div>
                        );
                      })()}
                      {typeof c.balance === "number" && <p className="mt-1 text-[11px] font-medium text-slate-600" style={tnum}>Saldo real: {nfEUR.format(c.balance)}{c.balanceAt ? ` · ${new Date(c.balanceAt).toLocaleDateString("es-ES")}` : ""}</p>}
                      {/* Conciliación: si los movimientos no explican los saldos del banco, falta o sobra alguno. */}
                      {(() => {
                        const q = bank.concil?.[c.id];
                        if (!q || q.dias < 2) return null;
                        const fd = (k) => new Date(k + "T12:00:00").toLocaleDateString("es-ES");
                        if (!q.descuadres.length) return <p className="mt-0.5 text-[11px]" style={{ ...tnum, color: C.income }}>✓ Los movimientos cuadran con el saldo del banco del {fd(q.desde)} al {fd(q.hasta)}.</p>;
                        const d0 = q.descuadres[0];
                        return (
                          <p className="mt-0.5 rounded px-1.5 py-1 text-[11px] leading-relaxed" style={{ ...tnum, background: C.warnSoft, color: C.warn }}>
                            Descuadre de {nfEUR.format(Math.abs(d0.diferencia))} el {fd(d0.dia)}: {d0.diferencia < 0 ? "falta algún movimiento" : "sobra algún movimiento (¿un duplicado?)"}.
                            {q.descuadres.length > 1 ? ` Y ${q.descuadres.length - 1} día${q.descuadres.length > 2 ? "s" : ""} más.` : ""} Revisa ese día en la búsqueda.
                          </p>
                        );
                      })()}
                      {/* «Última» era la hora de preguntar, no de recibir: con la conexión muerta parecía sana. */}
                      {c.lastNewest && <p className="mt-0.5 text-[11px] text-slate-500" style={tnum}>Último movimiento recibido: {c.lastNewest}</p>}
                      {c.lastSync && <p className="mt-0.5 text-[11px] text-slate-400" style={tnum}>Última consulta: {new Date(c.lastSync).toLocaleString("es-ES")}{typeof c.lastCount === "number" ? ` · ${nfNum.format(c.lastCount)} movimientos devueltos` : ""}</p>}
                    </div>
                  );
                })}
                <Btn onClick={bank.onSyncAll} disabled={bank.busy}><RefreshCw size={14} /> Sincronizar todos</Btn>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={!!bank.auto} onChange={(e) => bank.onToggleAuto(e.target.checked)} className="h-3.5 w-3.5" />
                  Sincronización automática al abrir <span className="text-slate-400">(una vez cada 12 h; baja lo reciente sin duplicar)</span>
                </label>
                {/* Lo que hace el servidor por su cuenta, con la app cerrada. */}
                {bank.cron && (() => {
                  const c = bank.cron;
                  const viejo = c.at && Date.now() - c.at > 9 * 3600000;
                  const mal = c.viejo || viejo || (c.errores || []).length;
                  return (
                    <p className="mt-1 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed" style={mal ? { background: C.warnSoft, color: C.warn } : { background: C.surfaceAlt, color: C.muted }}>
                      {c.viejo ? "Tu backend no informa de sus revisiones automáticas. Redespliégalo en Cloudflare para verlas aquí."
                        : !c.at ? "El servidor aún no ha hecho ninguna revisión automática. La primera llegará en menos de 8 horas."
                        : <>Servidor: última revisión el {fmtCuando(c.at)}{c.origen === "manual" ? " (forzada)" : ""} · {nfNum.format(c.nuevos || 0)} {c.nuevos === 1 ? "movimiento nuevo" : "movimientos nuevos"}.
                          {viejo && " Lleva más de 9 horas sin revisar: comprueba en Cloudflare que el disparador programado sigue activo."}
                          {(c.omitidas || []).length > 0 && <span className="block">No consultó: {c.omitidas.join(" · ")}.</span>}
                          {(c.errores || []).length > 0 && <span className="block">Errores: {c.errores.map((x) => (/HTTP 429|HUB046/.test(x) ? x.split(":")[0] + ": límite diario de consultas del banco agotado (se reanuda mañana)" : x)).join(" · ")}</span>}</>}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Añadir banco */}
            <div className="rounded-xl border p-2.5" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="text-xs font-medium text-slate-600">Añadir banco</div>
              <div className="mt-1.5 flex items-center gap-2">
                <input value={bank.addCountry} onChange={(e) => bank.onSetAddCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="ES" className="w-14 rounded-lg border px-2 py-1.5 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                <Btn size="sm" onClick={() => bank.onLoadAspsps(bank.addCountry)} disabled={bank.busy}>Cargar bancos</Btn>
              </div>
              {bank.aspsps.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={bank.addSel} onChange={(e) => bank.onSetAddSel(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }}>
                    <option value="">— Elige tu banco —</option>
                    {bank.aspsps.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={bank.addPsu} onChange={(e) => bank.onSetAddPsu(e.target.value)}
                    className="rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                    <option value="personal">Personal</option>
                    <option value="business">Empresa / autónomo</option>
                  </select>
                  <Btn size="sm" kind="primary" onClick={bank.onAddConnect} disabled={bank.busy || !bank.addSel}>Conectar</Btn>
                </div>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">Pon el país (CaixaBank: ES · Revolut: LT · PayPal: LU), pulsa <strong>Cargar bancos</strong>, elige el tuyo y <strong>Conectar</strong> (te lleva a su login). Al volver, elige la cuenta y sincroniza.</p>
            </div>

            {bank.busy && <p className="text-xs text-slate-400">Trabajando con el banco…</p>}
            {bank.msg && <p className={`text-xs ${bank.msg.kind === "ok" ? "text-emerald-700" : bank.msg.kind === "err" ? "text-rose-700" : "text-slate-500"}`}>{bank.msg.text}</p>}

            <div>
              <Btn size="sm" onClick={bank.onDiagnose} disabled={bank.busy}>Probar backend</Btn>
              <span className="ml-2 text-[11px] text-slate-400">Pregunta al Worker y enseña su respuesta literal.</span>
              {bank.diag && (
                <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-2 text-[10px] leading-relaxed text-slate-600" style={{ borderColor: C.line, background: C.surfaceAlt }}>{bank.diag.join("\n")}</pre>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">Cada movimiento se marca con su banco (origen) y se deduplica por el id del banco. El permiso caduca a ~90 días; entonces vuelve a <strong>Conectar</strong> ese banco. La configuración viaja con tus datos: conecta una vez y el resto de dispositivos la hereda.</p>
          </div>
        </section>
        )}
        </Grupo>

        <Grupo titulo="Inteligencia artificial" abierto={abrir === "ia"} forzar={abrir === "ia"}
          estado={aiOn ? "activada" : "desactivada"} ok={aiOn}>
        <section>
          <h3 className="text-sm font-semibold">Inteligencia artificial</h3>
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-blue-600" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
            Activar asistente y sugerencias con IA
          </label>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Proveedor</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setAiField("provider", "claude")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${!custom ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                style={!custom ? { background: C.accent, borderColor: C.accent } : { borderColor: C.line }}>
                Claude (integrado)
              </button>
              <button type="button" onClick={() => setAiField("provider", "openai_compat")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${custom ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                style={custom ? { background: C.accent, borderColor: C.accent } : { borderColor: C.line }}>
                El que yo elija
              </button>
            </div>
            {custom && (
              <div className="mt-2 space-y-2 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
                <div className="flex flex-wrap gap-1.5">
                  {AI_PRESETS.map((p) => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ai.baseUrl === p.baseUrl ? "border-blue-400 bg-blue-50 text-blue-700" : "text-slate-600"}`}
                      style={ai.baseUrl === p.baseUrl ? {} : { borderColor: C.line }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="block text-xs text-slate-600">URL base (compatible OpenAI)
                  <input type="url" value={ai.baseUrl} onChange={(e) => setAiField("baseUrl", e.target.value)} placeholder="https://api.openai.com/v1"
                    className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs text-slate-600">Modelo
                    <input type="text" value={ai.model} onChange={(e) => setAiField("model", e.target.value)} placeholder="gpt-4o-mini"
                      className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                  </label>
                  <label className="block text-xs text-slate-600">Clave API (si el proveedor la pide)
                    <input type="password" value={ai.apiKey} onChange={(e) => setAiField("apiKey", e.target.value)} placeholder="sk-…" autoComplete="off"
                      className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  La clave se guarda solo en {storeKind} y viaja dentro de tus copias de seguridad. El modelo debe admitir <em>function calling</em> para consultar tus datos.
                  {" "}<strong>Dentro de Claude.ai</strong> el navegador bloquea otros orígenes: tu elección se aplica en la app instalada en tu iPhone (o en local con Ollama/LM Studio, donde nada sale de tu red).
                </p>
              </div>
            )}
            {!custom && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                «Claude (integrado)» <strong>solo funciona dentro de claude.ai</strong>, donde el entorno pone la clave y el gasto va contra tu plan de Claude.
                En esta app instalada devuelve un error de autenticación: usa «El que yo elija» con una clave de API (una suscripción a Claude no incluye crédito de API) o un modelo local.
              </p>
            )}
          </div>

          {/* Perfiles: guarda varias configuraciones (Claude, un modelo gratuito…) y cambia al vuelo. */}
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Perfiles guardados</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">Guarda varias configuraciones con su clave y cambia entre ellas con un toque. Útil para tener, por ejemplo, Claude y un modelo gratuito a mano.</p>
            {aiProfiles && aiProfiles.length > 0 ? (
              <div className="mt-2 space-y-1">
                {aiProfiles.map((p) => {
                  const on = profileActive(p);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${on ? "border-blue-400 bg-blue-50" : "bg-white"}`} style={on ? {} : { borderColor: C.line }}>
                      <button type="button" onClick={() => onActivateAiProfile(p)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-slate-700">{p.label}{on && <span className="ml-1.5 text-[10px] font-semibold text-blue-600">· activo</span>}</span>
                        <span className="block truncate text-[11px] text-slate-400">{p.provider === "claude" ? "Claude (integrado)" : `${p.model || "modelo"} · ${(p.baseUrl || "").replace(/^https?:\/\//, "").split("/")[0] || "endpoint"}`}{p.apiKey ? " · con clave" : " · sin clave"}</span>
                      </button>
                      {!on && <button type="button" onClick={() => onActivateAiProfile(p)} className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50" style={{ borderColor: C.line }}>Usar</button>}
                      <button type="button" onClick={() => onDeleteAiProfile(p.id)} aria-label={`Borrar perfil ${p.label}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">Aún no has guardado ningún perfil.</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input value={profLabel} onChange={(e) => setProfLabel(e.target.value)} maxLength={30} placeholder="Nombre (p. ej. «Gemini gratis»)"
                onKeyDown={(e) => { if (e.key === "Enter" && profLabel.trim()) { onSaveAiProfile(profLabel); setProfLabel(""); } }}
                className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
              <Btn size="sm" kind="primary" onClick={() => { onSaveAiProfile(profLabel); setProfLabel(""); }}>Guardar el actual</Btn>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 accent-blue-600" checked={aiDetail} onChange={(e) => setAiDetail(e.target.checked)} />
            <span>Permitir que la IA consulte movimientos individuales<span className="block text-xs text-slate-400">Desactivado, el asistente solo puede pedir totales y nombres de comercios, sin movimientos uno a uno ni nombres de personas.</span></span>
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Con independencia de este ajuste, al clasificar movimientos pendientes se envían al proveedor de IA los
            <strong> nombres de comercio</strong> (no las fechas ni los importes individuales). Si no quieres que salga
            nada, desactiva el asistente arriba y clasifica a mano.
          </p>
        </section>
        </Grupo>

        <Grupo titulo="Avanzado" estado="copias, reglas, limpieza y apariencia">
        {onToggleTab && (
          <section>
            <h3 className="text-sm font-semibold">Pestañas</h3>
            <p className="mt-1 text-xs text-slate-500">Oculta las que no uses. No se borra nada: vuelven a aparecer al marcarlas.</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {ALL_TABS.filter((t) => t.id !== "resumen").map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="accent-blue-600" checked={!tabsOcultas.includes(t.id)} onChange={() => onToggleTab(t.id)} />{t.label}
                </label>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="text-sm font-semibold">Copia de seguridad</h3>
          <p className="mt-1 text-xs text-slate-500">Exporta un archivo JSON con todo (movimientos, reglas, activos, etiquetas y presupuestos) o restaura una copia anterior. Al importar se reemplaza lo actual.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={onExport}><Download size={14} /> Exportar copia</Btn>
            <Btn onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar copia</Btn>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const r = await onImportFile(f);
                setImportMsg(r);
              }} />
          </div>
          {importMsg && <p className={`mt-2 text-xs ${importMsg.ok ? "text-emerald-700" : "text-rose-700"}`}>{importMsg.text}</p>}

          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <History size={14} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-700">Copias automáticas</span>
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{snapCount}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              La app guarda una copia diaria dentro de {storeKind} (se conservan los últimos días, semanas y meses). Es una red de seguridad, pero {storeKind} puede borrarse: exporta de vez en cuando un archivo y guárdalo fuera.
            </p>
            {snapTooBig && (
              <p className="mt-2 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                Tus datos ya no caben en las copias automáticas: cada una es una copia entera y se guardan varias.
                Las he desactivado para no agotar el espacio del navegador y tumbar el guardado normal.
                <strong> Exporta el archivo a mano de vez en cuando</strong>: ahora es tu única red de seguridad.
              </p>
            )}
            {!snapsOpen ? (
              <button type="button" onClick={openSnaps} disabled={!snapCount}
                className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                Ver copias automáticas
              </button>
            ) : (
              <div className="mt-2 space-y-1">
                {snaps == null && <p className="text-xs text-slate-400">Cargando…</p>}
                {snaps && snaps.length === 0 && <p className="text-xs text-slate-400">Aún no hay copias automáticas.</p>}
                {snaps && snaps.map((s) => (
                  <div key={s.ts} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 text-xs text-slate-600">
                      {new Date(s.ts).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {s.movs != null && <span className="text-slate-400"> · {nfNum.format(s.movs)} movs</span>}
                    </span>
                    <button type="button" onClick={async () => { const r = await onRestoreSnap(s.ts); setImportMsg(r); setSnapsOpen(false); }}
                      className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {bank && bank.connections.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Duplicados del banco</span>
                {dupes && <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{dupes.length}</span>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Movimientos del banco con la misma cuenta, fecha, importe y concepto pero distinta referencia. Pasa cuando el banco cambia la referencia al liquidar una operación de tarjeta, y pasaba con sincronizaciones solapadas (ya corregido). Revísalos antes de limpiar: dos compras iguales el mismo día también aparecen aquí. Lo que quites va a la papelera y se puede recuperar.
              </p>
              {dupes === null ? (
                <button type="button" onClick={() => setDupes(onFindDupes())}
                  className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                  Buscar duplicados
                </button>
              ) : dupes.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-700">No hay duplicados del banco.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {dupes.slice(0, 60).map((g) => (
                    <div key={g[0].id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-700" title={g[0].concept}>{g[0].concept}</span>
                        <span className="text-[11px] text-slate-400" style={tnum}>{fmtDate(g[0].date instanceof Date ? g[0].date : new Date(g[0].date))} · {nfEUR.format(g[0].amount)} · {g.length} veces</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{g.length - 1} de más</span>
                    </div>
                  ))}
                  {dupes.length > 60 && <p className="text-[11px] text-slate-400">y {dupes.length - 60} grupos más.</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Btn size="sm" kind="primary" onClick={() => { onTrashDupes(dupes); setDupes(null); }}>
                      Enviar {nfNum.format(dupes.reduce((n, g) => n + g.length - 1, 0))} repetidos a la papelera
                    </Btn>
                    <Btn size="sm" onClick={() => setDupes(null)}>Cerrar</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {assetMem && Object.keys(assetMem).length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Comercios y sus activos</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{Object.keys(assetMem).length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Lo que la app ha aprendido de tus asignaciones: cada comercio y el activo al que lo mandas. Vive aquí y no en los movimientos, así que <strong className="text-slate-500">borrar una carga ya no se lleva este trabajo</strong>: al reimportar se aplica solo. Si un comercio se reparte entre varios activos no se memoriza, porque no hay una respuesta única.
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                {Object.entries(assetMem).sort((a, b) => a[0].localeCompare(b[0], "es")).map(([pat, asset]) => (
                  <div key={pat} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={pat}>{pat}</span>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500">{asset}</span>
                    <button type="button" onClick={() => onForgetAssetMem(pat)} aria-label={`Olvidar ${pat}`} className="shrink-0 rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={onForgetAllAssetMem} className="mt-2 text-[11px] font-medium text-slate-400 underline hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">Olvidar todas</button>
            </div>
          )}

          {imports && imports.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Cargas de datos</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{imports.length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Cada archivo que has importado. Puedes borrar una carga entera (p. ej. un CSV con la divisa mal leída). Es destructivo, pero tienes las copias automáticas de arriba para deshacer.
                {" "}<strong className="text-slate-500">Lo que has enseñado se conserva</strong>: las categorías (como reglas) y la relación comercio–activo (más abajo) se vuelven a aplicar al reimportar. Se pierde lo que es de cada movimiento concreto: marcas de extraordinario, notas y repartos.
              </p>
              <div className="mt-2 space-y-1">
                {imports.map((im) => (
                  <div key={im.file} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700" title={im.file}>{im.file}</span>
                      <span className="text-[11px] text-slate-400" style={tnum}>{nfNum.format(im.count)} movs · {fmtDate(im.min)}–{fmtDate(im.max)}</span>
                    </span>
                    {confirmDel === im.file ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => { onDeleteImport(im.file); setConfirmDel(null); setImportMsg({ ok: true, text: `Carga «${im.file}» borrada (${nfNum.format(im.count)} movimientos).` }); }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ background: C.expense }}>Borrar {nfNum.format(im.count)}</button>
                        <button type="button" onClick={() => setConfirmDel(null)} className="rounded-md border px-2 py-1 text-[11px] text-slate-500" style={{ borderColor: C.line }}>No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDel(im.file)} aria-label={`Borrar la carga ${im.file}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashed && trashed.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <Trash2 size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Papelera</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{trashed.length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Movimientos que enviaste a la papelera: fuera del análisis, pero puedes <span className="font-medium">rescatarlos</span> aquí. Bórralos del todo cuando estés seguro.</p>
              {!trashOpen ? (
                <button type="button" onClick={() => setTrashOpen(true)} className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white" style={{ borderColor: C.line }}>Ver la papelera</button>
              ) : (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { onPurgeTrash(trashed.map((m) => m.id)); }} className="text-[11px] font-medium text-rose-600 hover:underline">Vaciar papelera</button>
                  </div>
                  {trashed.slice(0, 60).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-slate-700" title={m.concept}>{m.concept}</span>
                        <span className="text-[11px] text-slate-400" style={tnum}>{fmtDate(new Date(m.date))} · {fmtE(m.amount)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => onRestoreTrash(m.id)} className="rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50" style={{ borderColor: C.line }}>Rescatar</button>
                        <button type="button" onClick={() => onPurgeTrash(m.id)} aria-label="Borrar del todo" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold">Reglas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Cada vez que corriges una categoría, la app crea una regla para no volver a preguntar. Aquí ves las tuyas
            —cuántas veces han disparado y cuánto dinero han colocado— y puedes apagarlas sin perderlas.
          </p>
          {!rulesOpen ? (
            <button type="button" onClick={openRules}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <GitBranch size={13} /> Revisar reglas
            </button>
          ) : (
            <div className="mt-2 space-y-1.5">
              {audit && audit.length === 0 && <p className="text-xs text-slate-400">Todavía no has creado reglas propias. Se generan al corregir categorías.</p>}
              {audit && audit.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#FB7185" }} /> En conflicto: contradice tus correcciones → cámbiala o apágala.</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#FBBF24" }} /> Genérica: pesca muchos comercios → revísala.</span>
                </div>
              )}
              {audit && audit.map((r) => (
                <div key={r.id} className={`rounded-lg border p-2.5 ${r.active ? "" : "opacity-60"}`}
                  style={{ borderColor: r.conflict ? "#FECDD3" : r.broad ? "#FDE68A" : C.line, background: C.surface }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="font-mono text-xs font-semibold text-slate-700">{r.k}</span>
                        {/* Las condiciones son la razón de ser de la regla: enséñalas */}
                        {r.conditional && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                            {r.sign === "+" ? "ingreso" : r.sign === "-" ? "gasto" : ""}
                            {r.min != null || r.max != null ? ` ${fmtE0(r.min ?? 0)}–${r.max != null && r.max < 999999 ? fmtE0(r.max) : "∞"}` : ""}
                            {r.dayMin != null ? ` días ${r.dayMin}-${r.dayMax ?? 31}` : ""}
                          </span>
                        )}
                        <span className="text-slate-400">→</span>
                        <span className="font-medium">{r.cat}</span>
                        {r.asset && <span className="text-xs text-slate-400">· {r.asset}</span>}
                        {r.confirm && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">pide revisión</span>}
                        {!r.active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">apagada</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500" style={tnum}>
                        {r.usos > 0
                          ? `${nfNum.format(r.usos)} usos · ${fmtE0(r.dinero)} clasificados${r.ultimoUso ? ` · última vez ${fmtDate(new Date(r.ultimoUso))}` : ""}`
                          : r.hits === 0 ? "no coincide con ningún movimiento actual" : `coincide con ${nfNum.format(r.hits)} movimiento${r.hits !== 1 ? "s" : ""}, pero nunca ha clasificado ninguno`}
                      </div>
                      {r.conflict && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-rose-700">La mayoría ya están en «{r.conflictCat}»: esta regla podría estar obsoleta.</span>
                          {r.scope === "personal" && r.conflictCat && <button type="button" onClick={() => changeCat(r.id, r.conflictCat)} className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50" style={{ borderColor: "#FECDD3" }}>Cambiar a «{r.conflictCat}»</button>}
                        </div>
                      )}
                      {!r.conflict && r.broad && <div className="mt-1 text-[11px] font-medium text-amber-700">Genérica: afecta a varios comercios ({r.sampleEntities.join(", ")}…).</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => toggle(r.id, !r.active)}
                        aria-label={r.active ? `Apagar regla ${r.k}` : `Encender regla ${r.k}`}
                        title={r.active ? "Apagar (no se pierde)" : "Volver a encender"}
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {r.active ? <Check size={14} /> : <X size={14} />}
                      </button>
                      {r.scope === "personal" && (
                        <button type="button" onClick={() => remove(r.id)} aria-label={`Borrar regla ${r.k}`} title="Borrar del todo"
                          className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold">Cuándo preguntarte</h3>
          <p className="mt-1 text-xs text-slate-500">
            Los movimientos por debajo de este importe no se llevan a «por clasificar»: un café mal
            categorizado no cambia ninguna decisión, pero preguntarte por él te quema. Pon 0 para que
            se pregunte por todo.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600">Ignorar por debajo de</span>
            <input type="number" min={0} max={1000} step={1} value={materialidad}
              onChange={(e) => setMaterialidad(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              className="w-20 rounded-lg border px-2 py-1.5 text-sm" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-slate-600">€</span>
          </label>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Recordatorios en el calendario</h3>
          <p className="mt-1 text-xs text-slate-500">
            La app no puede enviarte notificaciones estando cerrada: eso necesitaría un servidor. Lo que sí puede es
            darte tus cargos previstos como archivo de calendario. Lo abres, se añaden a tu calendario con un aviso
            la víspera, y es tu teléfono quien te lo recuerda.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Btn onClick={downloadICS} disabled={!upcomingItems.length}>
              <CalendarDays size={14} /> Descargar {upcomingItems.length || ""} cargos previstos
            </Btn>
            {!upcomingItems.length && <span className="text-xs text-slate-400">Aún no he detectado recibos periódicos.</span>}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Apariencia</h3>
          <div className="mt-2">
            <Seg ariaLabel="Tema" value={theme} onChange={setTheme}
              options={[{ v: "light", l: "Claro" }, { v: "dark", l: "Oscuro" }]} />
          </div>
        </section>
        <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <h3 className="text-sm font-semibold text-rose-800">Zona de borrado</h3>
          <p className="mt-1 text-xs text-rose-700">Elimina de este dispositivo todos los movimientos, reglas aprendidas, activos, etiquetas, presupuestos y conversaciones del asistente. No se puede deshacer.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!confirmWipe ? (
              <Btn kind="danger" onClick={() => setConfirmWipe(true)}><Trash2 size={14} /> Borrar todos mis datos</Btn>
            ) : (
              <>
                <span className="text-xs font-medium text-rose-800">¿Seguro? Esta acción es definitiva.</span>
                {sync && bank?.workerUrl && (
                  <label className="flex w-full items-start gap-2 text-xs text-rose-800">
                    <input type="checkbox" className="mt-0.5 accent-rose-600" checked={wipeServidor} onChange={(e) => setWipeServidor(e.target.checked)} />
                    <span>Borrar también en mi servidor (copia, versiones anteriores y bandeja), quitar los permisos del banco y olvidar la conexión en este dispositivo.</span>
                  </label>
                )}
                <Btn kind="danger" onClick={async () => { await onWipe({ servidor: wipeServidor }); onClose(); }}><Trash2 size={14} /> Sí, borrar todo</Btn>
                <Btn size="sm" onClick={() => setConfirmWipe(false)}>Cancelar</Btn>
              </>
            )}
          </div>
        </section>
        </Grupo>

      </div>
    </Modal>
  );
}

export {
  AvisoBackend,
  CopiarDiagnostico,
  VersionesServidor,
  SettingsModal,
};
