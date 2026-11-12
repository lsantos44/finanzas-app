import { ACCESS_MIN, C, DEPLOY_URL, GUIA_URL, IMPORT_CURRENCIES, abrirAcceso, accesoGuardado, fmtCuando, fmtDate, fmtE, leerAccesoGuardado, makeAccessLink, marcarAccesoGuardado, nfNum, parseAccessLink, recordarAcceso, tnum } from "../core.js";
import { Btn, Card, Modal, Spinner } from "./comunes.jsx";
import { AlertTriangle, Check, ChevronRight, FileText, Info, Landmark, RefreshCw, Sparkles, Upload, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ============================================================
   IMPORTACIÓN
   ============================================================ */
function DropZone({ onFiles, compact }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-all ${compact ? "p-5" : "p-10"}`}
      style={{ borderColor: over ? C.accent : C.lineStrong, background: over ? C.accentSoft : C.surfaceAlt }}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.accentSoft }}><Upload size={20} style={{ color: C.accent }} /></div>
      <p className="text-sm font-medium">Arrastra aquí el extracto de tu banco</p>
      <p className="text-[11px] text-slate-400">CSV o Excel (.xlsx, .xls)</p>
      <p className="text-[11px] text-slate-400">o búscalo en tu dispositivo</p>
      <Btn onClick={() => inputRef.current?.click()} kind="primary">Seleccionar archivo</Btn>
      {/* El `accept` estricto escondía el archivo en el móvil: los selectores de Android e iOS
          reportan el CSV con tipos dispares (vnd.ms-excel, comma-separated-values, y
          octet-stream cuando viene de Drive). Se amplía para que no quede nunca en gris. */}
      <input ref={inputRef} type="file" multiple className="hidden"
        accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods,.json,text/csv,text/plain,text/tab-separated-values,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/comma-separated-values,application/octet-stream"
        onChange={(e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// Primeros pasos. Enseña la progresión real de la app: lo que funciona sin montar nada y lo
// que exige backend, con su coste declarado. Un usuario nuevo tiene que poder ver de un
// vistazo dónde está y qué gana con el siguiente paso — y, sobre todo, que puede quedarse
// donde está. Antes la portada ofrecía «conectar el banco» como primera opción recomendada:
// cuarenta minutos de instalación antes de ver un solo gráfico.
function PrimerosPasos({ tieneDatos, tieneSync, tieneBanco, tieneIA, onIr }) {
  const pasos = [
    { id: "datos", hecho: tieneDatos, titulo: "Trae tus movimientos", gana: "Verlo todo clasificado por categorías y por activos.",
      coste: "Sin instalar nada", accion: tieneDatos ? null : { texto: "Importar un archivo", ir: "cerrar" } },
    { id: "sync", hecho: tieneSync, titulo: "Sincroniza entre dispositivos", gana: "Los mismos datos en el móvil y en el ordenador, siempre al día.",
      coste: "Requiere tu propio backend · ~20 min", accion: { texto: tieneSync ? "Ver ajustes" : "Cómo se monta", ir: tieneSync ? "sync" : "guia" } },
    { id: "banco", hecho: tieneBanco, titulo: "Conecta tu banco", gana: "Los movimientos entran solos cada pocas horas, sin descargar extractos.",
      coste: "Requiere backend y cuenta en Enable Banking · ~20 min más", accion: { texto: tieneBanco ? "Ver ajustes" : "Cómo se monta", ir: tieneBanco ? "banco" : "guia" } },
    { id: "ia", hecho: tieneIA, titulo: "Deja que la IA te ayude a clasificar", gana: "Reconoce comercios que no sabes de qué son.",
      coste: "Solo pegar tu clave de un proveedor", accion: { texto: tieneIA ? "Ver ajustes" : "Configurar", ir: "ia" } },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-slate-500">
        La app funciona entera sin instalar nada: importas el extracto de tu banco y ya está. Lo demás es opcional y puedes hacerlo cuando quieras — o nunca.
      </p>
      {pasos.map((x) => (
        <div key={x.id} className="flex items-start gap-2.5 rounded-xl border p-2.5" style={{ borderColor: C.line, background: x.hecho ? C.surfaceAlt : C.surface }}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={x.hecho ? { background: "#dcfce7", color: "#15803d" } : { background: C.surfaceAlt, color: C.faint, border: `1px solid ${C.lineStrong}` }}>
            {x.hecho ? "✓" : ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">{x.titulo}</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{x.gana}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">{x.coste}</span>
            {x.accion && (
              <button type="button" onClick={() => onIr(x.accion.ir)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" style={{ color: C.accent }}>
                {x.accion.texto} <ChevronRight size={11} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function CompartirAcceso({ workerUrl, token, compacto }) {
  const [msg, setMsg] = useState(null);
  const [pass, setPass] = useState("");
  const [link, setLink] = useState("");
  const [preparando, setPreparando] = useState(false);
  // El enlace se prepara al escribir la clave (cuesta medio segundo): así los botones funcionan
  // al momento y el móvil no bloquea copiar o compartir por haber esperado.
  useEffect(() => {
    setLink("");
    if (!workerUrl || !token || pass.length < ACCESS_MIN) return;
    let vivo = true;
    setPreparando(true);
    const t = setTimeout(() => makeAccessLink(workerUrl, token, pass).then((l) => { if (vivo) setLink(l); }).finally(() => { if (vivo) setPreparando(false); }), 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [workerUrl, token, pass]);
  if (!workerUrl || !token) return null;
  const asunto = "Mi acceso a Mis Finanzas";
  const cuerpo = `Abre este enlace en cualquier móvil u ordenador para entrar con tus datos. Te pedirá la clave que elegiste (no va en este correo):\n\n${link}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(link); marcarAccesoGuardado(); setMsg("Enlace copiado. Guárdalo en tus notas o mándatelo."); } catch { setMsg("No se pudo copiar."); } };
  const compartir = async () => { try { await navigator.share({ title: asunto, text: cuerpo }); marcarAccesoGuardado(); } catch { /* cancelado */ } };
  const gestor = async () => { const ok = await recordarAcceso(workerUrl, token); if (ok) marcarAccesoGuardado();
    setMsg(ok ? "Guardado en tu gestor de contraseñas (si te lo ha preguntado)." : "Este navegador no deja guardarlo desde aquí."); };
  const listo = !!link && !preparando;
  const off = "pointer-events-none opacity-40";
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">Clave del enlace <span className="font-normal text-slate-400">(mínimo {ACCESS_MIN} caracteres; te la pedirá al abrirlo)</span>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          placeholder="Una frase que recuerdes" className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
      </label>
      <p className="text-[11px] leading-relaxed text-slate-400">La clave no va en el enlace ni en el correo: así, aunque alguien entre en tu email, no puede usar el enlace. Una frase de varias palabras es más segura y más fácil de recordar.</p>
      <div className="flex flex-wrap gap-2">
        <a href={listo ? `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}` : undefined} onClick={listo ? marcarAccesoGuardado : undefined} aria-disabled={!listo}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${listo ? "" : off}`} style={{ background: C.accent }}>
          Enviármelo por email
        </a>
        {typeof navigator !== "undefined" && navigator.share && <Btn size="sm" onClick={compartir} disabled={!listo}>Compartir…</Btn>}
        <Btn size="sm" onClick={copiar} disabled={!listo}>Copiar enlace</Btn>
        {!compacto && typeof window !== "undefined" && window.PasswordCredential && <Btn size="sm" onClick={gestor}>Gestor de contraseñas</Btn>}
      </div>
      {preparando && <p className="text-xs text-slate-400">Cifrando el enlace…</p>}
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

// Entrar desde otro navegador o dispositivo. Tres formas, de más a menos cómoda: abrir el enlace
// personal (llega aquí ya relleno), dejar que el gestor de contraseñas rellene, o pegar el
// enlace / escribir los datos. Es un formulario de login de verdad para que el gestor lo vea.
function EntrarModal({ inicial, auto, onEntrar, onClose }) {
  const [url, setUrl] = useState(inicial?.u || "");
  const [tok, setTok] = useState(inicial?.t || "");
  const [cif, setCif] = useState(inicial?.cif || null); // enlace cifrado: falta la clave
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [hecho, setHecho] = useState(null); // { u, t } con el que se entró
  useEffect(() => {
    if (inicial) return;
    leerAccesoGuardado().then((c) => { if (c) { setUrl((v) => v || c.u); setTok((v) => v || c.t); } });
  }, [inicial]);
  const ir = async (u0, t0) => {
    if (cif) {
      if (!pass) { setRes({ ok: false, text: "Escribe la clave que elegiste al crear el enlace." }); return; }
      setBusy(true); setRes(null);
      try { t0 = await abrirAcceso(cif, pass); }
      catch { setBusy(false); setRes({ ok: false, text: "Esa no es la clave del enlace." }); return; }
      setBusy(false);
    }
    const u = u0.trim().replace(/\/+$/, ""), t = t0.trim();
    if (!/^https?:\/\//.test(u)) { setRes({ ok: false, text: "Pega tu enlace de acceso, o la dirección de tu backend (empieza por https://)." }); return; }
    if (!t) { setRes({ ok: false, text: "Falta el token." }); return; }
    setBusy(true); setRes(null);
    try { const r = await onEntrar(u, t); setRes(r); if (r?.ok) setHecho({ u, t }); } finally { setBusy(false); }
  };
  // Al llegar desde el gestor de contraseñas ya has elegido cuenta: no se pide otro toque.
  const autoRef = useRef(false);
  useEffect(() => { if (auto && inicial && !inicial.cif && !autoRef.current) { autoRef.current = true; ir(inicial.u, inicial.t); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Pegar el enlace en el primer campo vale igual que abrirlo.
  const onUrl = (v) => {
    const p = parseAccessLink(v);
    if (!p) { setUrl(v); setCif(null); return; }
    setUrl(p.u); setCif(p.cif || null); setTok(p.t || "");
  };
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  const campo = "mt-1 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return (
    <Modal title="Entrar con mi cuenta" onClose={onClose}
      footer={res?.ok
        ? <Btn kind="primary" onClick={onClose} className="w-full justify-center sm:w-auto">Ver mis datos</Btn>
        : <div className="flex gap-2"><Btn kind="primary" onClick={() => document.getElementById("finz-entrar")?.requestSubmit()} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Btn><Btn onClick={onClose}>Cancelar</Btn></div>}>
      {res?.ok ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-700">{res.text}</p>
          {/* El momento de cerrar el círculo: acabas de entrar, así que es cuando más fácil es
              dejarte el acceso guardado para la próxima vez. */}
          {!inicial && (
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-sm font-medium text-slate-700">Que la próxima vez sea un toque</p>
              <p className="mt-0.5 text-xs text-slate-500">Mándate tu enlace de acceso. En cualquier otro móvil u ordenador, ábrelo desde tu email y entrarás directamente.</p>
              <div className="mt-2"><CompartirAcceso workerUrl={hecho?.u} token={hecho?.t} compacto /></div>
            </div>
          )}
          <p className="text-xs text-slate-500">Los bancos conectados vienen con tus datos: no pulses «Reconectar» salvo que el permiso haya caducado.</p>
        </div>
      ) : (
        <form id="finz-entrar" onSubmit={(e) => { e.preventDefault(); ir(url, tok); }} className="space-y-3" autoComplete="on">
          {inicial ? (
            <p className="text-sm text-slate-600">Vas a entrar con tu backend en <strong className="break-all">{host}</strong>. Llegarán tus datos y tus bancos, y la sincronización quedará activada en este navegador.</p>
          ) : (
            <p className="text-sm text-slate-600">La forma más rápida: abre <strong>tu enlace de acceso</strong> (búscalo en tu email: «Mi acceso a Mis Finanzas») o pégalo aquí abajo.</p>
          )}
          {/* Con el enlace los campos sobran, salvo si falla (token cambiado, dirección vieja):
              entonces hay que poder corregirlos, o el modal se queda en un callejón sin salida. */}
          {cif && (
            <label className="block text-xs font-medium text-slate-600">Clave del enlace
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false}
                placeholder="La que elegiste al crearlo" className={campo} style={{ borderColor: C.line }} />
            </label>
          )}
          <div className={inicial && !res ? "hidden" : "space-y-3"}>
            <label className="block text-xs font-medium text-slate-600">Enlace de acceso o dirección de tu backend
              <input name="username" autoComplete="username" inputMode="url" value={url} onChange={(e) => onUrl(e.target.value)}
                placeholder="Pega aquí tu enlace" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={campo} style={{ borderColor: C.line }} />
            </label>
            <label className={`block text-xs font-medium text-slate-600 ${cif ? "hidden" : ""}`}>Token
              <input name="password" type="password" autoComplete="current-password" value={tok} onChange={(e) => setTok(e.target.value)}
                placeholder="Se rellena solo si pegas el enlace" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={campo} style={{ borderColor: C.line }} />
            </label>
            <details className="text-[11px] leading-relaxed text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-600">No tengo el enlace</summary>
              <div className="mt-1.5 space-y-1.5">
                <p><strong>Si tienes a mano el otro dispositivo:</strong> allí, Ajustes → Tus datos y sincronización → «Tu acceso en otros dispositivos» → «Enviármelo por email».</p>
                <p><strong>Si no:</strong> recupéralo en Cloudflare, que es donde vive tu backend. Entra en dash.cloudflare.com → Workers. La <strong>dirección</strong> es la que acaba en <code>.workers.dev</code>. El <strong>token</strong> no se puede leer (es un secreto). Puedes poner uno nuevo (tu Worker → Settings → Variables and Secrets → <code>PROXY_TOKEN</code> → Edit → Deploy), pero ojo: <strong>tu copia del servidor va ligada al token</strong>, así que con uno nuevo el servidor empieza vacío. Tus datos vuelven si te queda algún navegador con la app: entra en él con el token nuevo y se guardan solos. Si no te queda ninguno, la copia antigua solo se recupera con el token antiguo. Por eso conviene tener el enlace en el correo.</p>
              </div>
            </details>
          </div>
          {res && <p className="text-sm text-rose-700">{res.text}</p>}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}

// Has firmado en el banco pero has vuelto a un navegador sin tu backend. La firma no se ha
// perdido: basta con abrir esta misma dirección en el navegador donde usas la app.
function VueltaOtroNavegador({ url, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); } catch { /* sin permiso */ } };
  return (
    <Modal title="Has vuelto en otro navegador" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-600">
        <p>La firma en el banco ha ido bien, pero el banco te ha devuelto a <strong>este</strong> navegador, y tu app está configurada en otro (por ejemplo, Brave). Suele pasar en el iPhone cuando firmas con la app del banco: al terminar abre Safari.</p>
        <p className="font-medium text-slate-800">Para terminar la conexión:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Copia este enlace.</li>
          <li>Abre el navegador donde usas la app.</li>
          <li>Pégalo en la barra de direcciones y ábrelo. La conexión se completa sola.</li>
        </ol>
        <Btn kind="primary" onClick={copiar}>{copiado ? <><Check size={14} /> Copiado</> : "Copiar enlace"}</Btn>
        <p className="text-xs text-slate-400">No hace falta firmar otra vez. Después ya puedes cerrar este navegador.</p>
      </div>
    </Modal>
  );
}

// En Ajustes, para el navegador donde ya está todo configurado.
function AccesoOtroNavegador({ workerUrl, token }) {
  // En estado, no leído en cada render: si no, el aviso seguía en amarillo después de copiarlo.
  const [guardado, setGuardado] = useState(accesoGuardado);
  useEffect(() => {
    const h = () => setGuardado(accesoGuardado());
    window.addEventListener("finz-acceso-guardado", h);
    return () => window.removeEventListener("finz-acceso-guardado", h);
  }, []);
  if (!workerUrl || !token) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold">Tu acceso en otros dispositivos</h3>
      {guardado
        ? <p className="mt-1 rounded-lg px-2 py-1.5 text-[11px] font-medium" style={{ background: "#dcfce7", color: "#15803d" }}>✓ Copiado o enviado el {fmtCuando(guardado)}. Para usarlo en otro navegador, pégalo allí en «Entrar».</p>
        : <p className="mt-1 rounded-lg px-2 py-1.5 text-[11px] font-medium" style={{ background: C.warnSoft, color: C.warn }}>Aún no te lo has guardado. Hazlo ahora: si pierdes este dispositivo, es lo que te deja volver a entrar.</p>}
      <p className="mt-1 text-xs text-slate-500">Mándate tu enlace de acceso una vez. Desde cualquier móvil, ordenador o navegador, abrirlo y escribir tu clave es entrar: llegan tus datos y tus bancos.</p>
      <div className="mt-2"><CompartirAcceso workerUrl={workerUrl} token={token} /></div>
      <p className="mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
        El enlace va cifrado con tu clave: sin ella no sirve. Si te mandaste uno antes de este cambio, ese no lleva clave: cambia el token del Worker para invalidarlo y mándate uno nuevo.
      </p>
    </section>
  );
}

// Asistente de conexión. La guía del repositorio explica los pasos, pero no puede decirte si
// TE han salido bien: lees, haces, y descubres al final que algo falló. Aquí cada paso se
// verifica contra tu propio backend en el momento, que es la diferencia entre diez minutos y
// dos tardes. Lo que no puede hacer: crear tus cuentas. Eso es tuyo por definición.
//
// Cubre el proceso entero, backend y banco. El tramo bancario es el que más cuesta: el error
// típico (elegir mal el tipo de titular) no se manifiesta al configurar sino DESPUÉS de firmar
// en el banco, con un mensaje que no dice nada. Por eso aquí se valida antes de mandarte allí.
function AsistenteConexion({ onClose, workerUrl, token, onGuardar, onActivarSync, onConectarBanco }) {
  const [paso, setPaso] = useState(0);
  const [url, setUrl] = useState(workerUrl || "");
  const [tok, setTok] = useState(token || "");
  const [quiereBanco, setQuiereBanco] = useState(null);
  const [probando, setProbando] = useState(false);
  const [res, setRes] = useState(null);            // { ok, texto, detalle }
  const [bancos, setBancos] = useState([]);        // nombres del país
  const [pais, setPais] = useState("ES");
  const [banco, setBanco] = useState("");
  const [ficha, setFicha] = useState(null);        // ficha del banco elegido en Enable Banking
  const [psu, setPsu] = useState("personal");

  const limpia = (u) => u.trim().replace(/\/+$/, "");
  const callback = limpia(url) + "/bank/callback";
  const total = quiereBanco === false ? 4 : 6;

  // Petición al backend con el token y un límite de tiempo: sin él, un backend que no responde
  // deja el asistente colgado sin decir nada.
  const pedir = async (ruta, ms = 25000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(limpia(url) + ruta, {
        headers: tok.trim() ? { Authorization: "Bearer " + tok.trim() } : {},
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }
  };

  const probarBackend = async (conToken) => {
    const base = limpia(url);
    if (!/^https?:\/\//.test(base)) { setRes({ ok: false, texto: "La dirección debe empezar por https://" }); return false; }
    setProbando(true); setRes(null);
    try {
      const r = await fetch(base + "/store/status", { headers: conToken && tok.trim() ? { Authorization: "Bearer " + tok.trim() } : {} });
      if (r.status === 401) {
        setRes({ ok: false,
          texto: conToken ? "La contraseña no coincide con la del Worker." : "Tu backend responde, pero pide contraseña.",
          detalle: conToken ? "Revisa que la hayas pegado igual en Cloudflare, sin espacios ni saltos de línea al final." : null });
        return false;
      }
      if (!r.ok) { setRes({ ok: false, texto: `Tu backend respondió ${r.status}.`, detalle: "Comprueba que la dirección es correcta y que lo has desplegado." }); return false; }
      const d = await r.json();
      if (!d.bindingDB) {
        setRes({ ok: false, texto: "Responde, pero le falta la base de datos.",
          detalle: "En Cloudflare: tu Worker → Settings → Bindings → añadir D1 con el nombre DB. Ojo: el botón de guardar queda fuera de la vista, baja dentro de la ventanita." });
        return false;
      }
      // Sin ALLOW_ORIGIN la sincronización funciona, pero al volver del banco el Worker no sabe a
      // qué página devolverte y la conexión se queda a medias. Pasa con la instalación a mano.
      const origenes = String(d.allowOrigin || "").split(",").map((x) => x.trim().replace(/\/+$/, ""));
      if (!origenes.includes(window.location.origin)) {
        setRes({ ok: false, texto: "Responde, pero no sabe cuál es la dirección de la app.",
          detalle: `En Cloudflare: tu Worker → Settings → Variables and Secrets → Add. Tipo Text, nombre ALLOW_ORIGIN, valor ${window.location.origin}. Guarda y pulsa Deploy. Ahora tiene: ${d.allowOrigin || "nada"}.` });
        return false;
      }
      setRes({ ok: true,
        texto: conToken ? "Todo correcto: responde, la contraseña coincide y la base de datos funciona." : "Tu backend responde y la base de datos funciona.",
        detalle: !conToken && !d.tieneToken ? "Aún no tiene contraseña: la pondremos en el paso siguiente." : null });
      return true;
    } catch (e) {
      setRes({ ok: false, texto: e.name === "AbortError" ? "No respondió a tiempo." : "No se pudo contactar con esa dirección.",
        detalle: "Comprueba que la has copiado entera, incluido el https://" });
      return false;
    } finally { setProbando(false); }
  };

  // Valida las credenciales de Enable Banking ANTES de mandar a nadie al banco. /bank/ping
  // devuelve los datos de la aplicación si la firma JWT funciona.
  const probarBanco = async () => {
    setProbando(true); setRes(null);
    try {
      const r = await pedir("/bank/ping");
      const txt = await r.text();
      if (!r.ok) {
        setRes({ ok: false, texto: `Enable Banking respondió ${r.status}.`,
          detalle: /Falta EB_/.test(txt) ? "Faltan credenciales en el Worker: revisa EB_APP_ID y EB_PRIVATE_KEY." : txt.slice(0, 200) });
        return false;
      }
      const d = JSON.parse(txt);
      // Una aplicación de producción nace inactiva y no deja conectar ningún banco hasta que se
      // vinculan cuentas en el panel. Es el paso que nadie sabe que existe.
      if (d.active === false) {
        setRes({ ok: false, texto: "Tus credenciales funcionan, pero la aplicación está inactiva.",
          detalle: "En el panel de Enable Banking, entra en tu aplicación y pulsa «Activate by linking accounts». Elige tu banco, identifícate como en su app y autoriza todas las cuentas que quieras ver. Después vuelve a comprobar." });
        return false;
      }
      const registrada = (d.redirect_urls || []).some((x) => String(x).replace(/\/+$/, "") === callback);
      if (!registrada) {
        setRes({ ok: false, texto: "Tus credenciales funcionan, pero falta la dirección de retorno.",
          detalle: `En Enable Banking, tu aplicación debe tener registrada exactamente ${callback}. Ahora tiene: ${(d.redirect_urls || []).join(", ") || "ninguna"}.` });
        return false;
      }
      setRes({ ok: true, texto: `Credenciales correctas: «${d.name}», entorno ${d.environment}.`,
        detalle: "La dirección de retorno está bien registrada." });
      return true;
    } catch (e) {
      setRes({ ok: false, texto: "No se pudo comprobar.", detalle: String(e.message || e).slice(0, 160) });
      return false;
    } finally { setProbando(false); }
  };

  const cargarBancos = async () => {
    setProbando(true); setRes(null); setBancos([]); setBanco(""); setFicha(null);
    try {
      const r = await pedir(`/bank/aspsps?country=${encodeURIComponent(pais)}`);
      if (!r.ok) throw new Error("el backend devolvió " + r.status);
      const d = await r.json();
      const nombres = [...new Set(((Array.isArray(d) ? d : d.aspsps) || []).map((a) => a.name).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es"));
      setBancos(nombres);
      setRes(nombres.length ? { ok: true, texto: `${nombres.length} bancos disponibles en ${pais}.` } : { ok: false, texto: "No se han encontrado bancos para ese país." });
    } catch (e) { setRes({ ok: false, texto: "No se pudieron cargar los bancos.", detalle: String(e.message || e).slice(0, 160) }); }
    finally { setProbando(false); }
  };

  // La ficha dice qué tipos de titular admite el banco y cuánto puede durar el permiso. Es lo
  // que permite avisar ANTES de firmar, en vez de descubrirlo con un error opaco después.
  const cargarFicha = async (nombre) => {
    setBanco(nombre); setFicha(null); setRes(null);
    if (!nombre) return;
    try {
      const r = await pedir(`/bank/aspsp?name=${encodeURIComponent(nombre)}&country=${encodeURIComponent(pais)}`);
      if (!r.ok) return;
      const d = await r.json();
      setFicha(d);
      const tipos = Array.isArray(d.psu_types) ? d.psu_types : [];
      if (tipos.length === 1) setPsu(tipos[0]);
    } catch { /* la ficha es orientativa */ }
  };

  const generar = () => setTok(crypto.randomUUID() + "-" + crypto.randomUUID().slice(0, 8));
  const copiar = (t) => { try { navigator.clipboard.writeText(t); } catch { /* sin permiso */ } };

  const Paso = ({ n, titulo, children }) => (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.accent }}>Paso {n} de {total}</div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  );

  const Resultado = () => !res ? null : (
    <div className="rounded-xl p-2.5 text-[12px] leading-relaxed" style={res.ok ? { background: "#dcfce7", color: "#15803d" } : { background: C.warnSoft, color: C.warn }}>
      <strong>{res.ok ? "✓ " : "⚠ "}{res.texto}</strong>
      {res.detalle && <span className="mt-0.5 block font-normal break-words">{res.detalle}</span>}
    </div>
  );

  const Campo = ({ valor }) => (
    <span className="mt-1 flex items-center gap-1.5">
      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[11px]">{valor}</code>
      <Btn size="sm" onClick={() => copiar(valor)}>Copiar</Btn>
    </span>
  );

  // Siguiente solo se habilita cuando el paso está verificado: así nadie llega al final
  // creyendo que funciona.
  const puedeSeguir = () => {
    if (paso === 1 || paso === 2 || paso === 4) return !!(res && res.ok);
    if (paso === 3) return quiereBanco !== null;
    if (paso === 5) return !!banco;
    return true;
  };

  const avanzar = () => {
    if (paso === 2) { onGuardar(limpia(url), tok.trim()); onActivarSync?.(); }
    if (paso === 3 && quiereBanco === false) { setPaso(99); return; }
    if (paso === 5) { onConectarBanco?.(banco, pais, psu); return; } // navega al banco
    setRes(null); setPaso(paso + 1);
  };

  return (
    <Modal title="Conectar tu backend" subtitle={quiereBanco === false ? "Unos 20 minutos, gratis" : "Unos 35 minutos, gratis"} onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-2">
          <Btn onClick={() => (paso === 0 ? onClose() : (setRes(null), setPaso(paso === 99 ? 3 : paso - 1)))}>{paso === 0 ? "Ahora no" : "Atrás"}</Btn>
          {paso === 99 ? <Btn kind="primary" onClick={onClose}>Terminar</Btn> : (
            <Btn kind="primary" disabled={probando || !puedeSeguir()} onClick={avanzar}>
              {paso === 5 ? "Ir al banco" : "Siguiente"} <ChevronRight size={14} />
            </Btn>
          )}
        </div>
      )}>
      <div className="space-y-5">
        {paso === 0 && (
          <Paso n={1} titulo="Lo que vas a conseguir">
            <p>Tus datos sincronizados entre el móvil y el ordenador, y —si quieres— los movimientos del banco entrando solos cada pocas horas, aunque no abras la app.</p>
            <p>Todo vive en <strong>tu</strong> cuenta de Cloudflare: nadie más tiene acceso a ella.</p>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">Necesitas una cuenta de Cloudflare</p>
              <p className="mt-0.5 text-[12px]">Es gratis y no piden tarjeta. Si ya la tienes, pasa al siguiente paso.</p>
              <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: C.accent }}>
                Crear cuenta <ChevronRight size={12} />
              </a>
            </div>
          </Paso>
        )}

        {paso === 1 && (
          <Paso n={2} titulo="Instala tu backend">
            <p>Tu backend es un pequeño programa que vive gratis en tu cuenta de Cloudflare. Se instala con un botón:</p>
            <ol className="list-decimal space-y-1 pl-5 text-[13px]">
              <li>Si no tienes cuenta de <strong>GitHub</strong>, créala primero en <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: C.accent }}>github.com/signup</a> (gratis, 2 minutos). El botón la usa para guardar tu copia del programa.</li>
              <li>Pulsa el botón de abajo. Te pedirá entrar en Cloudflare y autorizar GitHub; si pregunta a qué repositorios dar acceso, basta con el nuevo.</li>
              <li>En la pantalla de confirmación pulsa <strong>Deploy</strong> y espera uno o dos minutos.</li>
            </ol>
            <a href={DEPLOY_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.accent }}>
              Instalar en Cloudflare <ChevronRight size={14} />
            </a>
            <p className="text-[12px] text-slate-500">¿Prefieres no crear cuenta de GitHub? Hay un camino copiando y pegando: <a href={GUIA_URL + "#camino-b--sin-cuenta-de-github"} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: C.accent }}>guía sin GitHub</a>.</p>
            <p className="text-[12px] text-slate-500">Cuando termine, Cloudflare te dará una dirección parecida a <code className="rounded bg-slate-100 px-1">https://finanzas.algo.workers.dev</code>. Pégala aquí:</p>
            <input value={url} onChange={(e) => { setUrl(e.target.value); setRes(null); }} placeholder="https://…workers.dev"
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
            <Btn onClick={() => probarBackend(false)} disabled={probando || !url.trim()}>{probando ? "Comprobando…" : "Comprobar"}</Btn>
            <Resultado />
          </Paso>
        )}

        {paso === 2 && (
          <Paso n={3} titulo="Ponle una contraseña">
            <p>Para que solo tú puedas usar tu backend. Te la genero yo, que es más segura que una inventada:</p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={tok} onChange={(e) => { setTok(e.target.value); setRes(null); }} placeholder="pulsa Generar"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
              <Btn size="sm" onClick={generar}>Generar</Btn>
              <Btn size="sm" onClick={() => copiar(tok)} disabled={!tok}>Copiar</Btn>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">Pégala en Cloudflare</p>
              <p className="mt-0.5 text-[12px]">Tu Worker → <strong>Settings</strong> → <strong>Variables and Secrets</strong> → <strong>Add</strong>. Tipo <strong>Secret</strong>, nombre exacto <code className="rounded bg-slate-100 px-1">PROXY_TOKEN</code>, y de valor esta contraseña. Luego <strong>Deploy</strong>.</p>
              <p className="mt-1 text-[12px] font-medium" style={{ color: C.warn }}>El botón de guardar suele quedar fuera de la vista: baja dentro de la ventanita, no en la página.</p>
            </div>
            <Btn onClick={() => probarBackend(true)} disabled={probando || !tok.trim()}>{probando ? "Comprobando…" : "Comprobar que coincide"}</Btn>
            <Resultado />
            {/* La contraseña es aleatoria a propósito (segura), así que nadie la recuerda. Este es
                el único momento en que la tienes delante: o te la guardas ahora, o el día que
                cambies de móvil tendrás que generar otra en Cloudflare. */}
            {res?.ok && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.accent, background: C.accentSoft }}>
                <p className="text-[12px] font-semibold text-slate-800">Guárdate el acceso antes de seguir</p>
                <p className="mt-0.5 text-[12px] text-slate-600">No tienes que recordar ni la dirección ni la contraseña: mándate este enlace. En cualquier otro móvil u ordenador, abrirlo es entrar con tus datos.</p>
                <div className="mt-2"><CompartirAcceso workerUrl={limpia(url)} token={tok.trim()} /></div>
              </div>
            )}
          </Paso>
        )}

        {paso === 3 && (
          <Paso n={4} titulo="¿Quieres conectar tu banco?">
            <p>Con el backend ya tienes sincronización entre dispositivos. Conectar el banco añade que los movimientos entren solos, sin descargar extractos.</p>
            <p className="text-[12px]">Hace falta además una cuenta en <strong>Enable Banking</strong>, el proveedor autorizado que habla con los bancos. Es gratuita para tus propias cuentas y lleva unos 15 minutos más.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setQuiereBanco(true)}
                className="rounded-xl border-2 p-3 text-left text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                style={{ borderColor: quiereBanco === true ? C.accent : C.line, background: quiereBanco === true ? C.accentSoft : C.surface }}>
                Sí, seguir con el banco
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">15 minutos más</span>
              </button>
              <button type="button" onClick={() => setQuiereBanco(false)}
                className="rounded-xl border-2 p-3 text-left text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                style={{ borderColor: quiereBanco === false ? C.accent : C.line, background: quiereBanco === false ? C.accentSoft : C.surface }}>
                Ahora no
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">Puedes hacerlo cuando quieras</span>
              </button>
            </div>
          </Paso>
        )}

        {paso === 4 && (
          <Paso n={5} titulo="Tu aplicación de Enable Banking">
            <p>Enable Banking es la empresa autorizada en Europa que lee tus cuentas (solo lectura: nunca puede mover dinero). Necesitas crear allí tu propia «aplicación». Está en inglés; estos son los pasos:</p>
            <ol className="list-decimal space-y-2 pl-5 text-[13px]">
              <li>Entra en <a href="https://enablebanking.com/cp/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: C.accent }}>el panel de Enable Banking</a> y regístrate con tu correo. Te llegará un enlace para entrar.</li>
              <li>Ve a <strong>Applications</strong> y registra una nueva. Rellena:
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px]">
                  <li><strong>Environment</strong>: <strong>Production</strong> (no Sandbox, que es de pruebas con bancos falsos).</li>
                  <li><strong>Name</strong>: lo que quieras, por ejemplo «Mis Finanzas».</li>
                  <li><strong>Redirect URL</strong>: exactamente esta, sin cambiar nada:
                    <Campo valor={callback} /></li>
                  <li>Si pide web de privacidad o de condiciones, pon <code className="rounded bg-slate-100 px-1">{window.location.origin}/privacidad.html</code>; y tu correo donde lo pida.</li>
                  <li>Para la clave, elige generarla en el navegador. Se descarga un archivo <code className="rounded bg-slate-100 px-1">.pem</code>: <strong>guárdalo</strong>, solo se descarga una vez. Su nombre es el <strong>Application ID</strong>.</li>
                </ul>
              </li>
              <li><strong>Actívala</strong>, que es el paso que todo el mundo se salta: la aplicación nace <em>inactiva</em>. Pulsa <strong>Activate by linking accounts</strong>, elige tu banco, identifícate como en su app y autoriza <strong>todas</strong> las cuentas que quieras ver luego aquí. Solo esas podrá leer.</li>
              <li>En Cloudflare, en el mismo sitio que la contraseña, añade dos <strong>Secret</strong> y pulsa <strong>Deploy</strong>:
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px]">
                  <li><code className="rounded bg-slate-100 px-1">EB_APP_ID</code>: el Application ID (el nombre del archivo, sin <code className="rounded bg-slate-100 px-1">.pem</code>).</li>
                  <li><code className="rounded bg-slate-100 px-1">EB_PRIVATE_KEY</code>: el contenido entero del archivo, incluidas las líneas BEGIN y END. Ábrelo en el ordenador con el Bloc de notas (Windows) o TextEdit (Mac), selecciona todo y cópialo.</li>
                </ul>
              </li>
            </ol>
            <Btn onClick={probarBanco} disabled={probando}>{probando ? "Comprobando…" : "Comprobar mis credenciales"}</Btn>
            <Resultado />
          </Paso>
        )}

        {paso === 5 && (
          <Paso n={6} titulo="Elige tu banco">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-slate-600">País
                <input value={pais} onChange={(e) => setPais(e.target.value.toUpperCase().slice(0, 2))} maxLength={2}
                  className="mt-0.5 block w-16 rounded-lg border px-2 py-1.5 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
              </label>
              <Btn onClick={cargarBancos} disabled={probando}>{probando ? "Cargando…" : "Cargar bancos"}</Btn>
            </div>
            {bancos.length > 0 && (
              <select value={banco} onChange={(e) => cargarFicha(e.target.value)}
                className="w-full rounded-lg border bg-white px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }}>
                <option value="">— Elige tu banco —</option>
                {bancos.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {banco && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
                <p className="text-[12px] font-medium text-slate-700">¿A nombre de quién están las cuentas?</p>
                <p className="mt-0.5 text-[12px]">Equivocarse aquí es el error más caro de todo el proceso: el banco te deja entrar y firmar, y <strong>después</strong> rechaza todas las peticiones de datos con un mensaje que no explica nada.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {["personal", "business"].map((t) => {
                    const admitido = !ficha || !Array.isArray(ficha.psu_types) || ficha.psu_types.includes(t);
                    return (
                      <button key={t} type="button" onClick={() => admitido && setPsu(t)} disabled={!admitido}
                        className="rounded-lg border-2 p-2 text-left text-[12px] font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        style={{ borderColor: psu === t ? C.accent : C.line, background: psu === t ? C.accentSoft : C.surface }}>
                        {t === "personal" ? "Personal" : "Empresa / autónomo"}
                        {!admitido && <span className="mt-0.5 block text-[10px] font-normal">este banco no lo admite</span>}
                      </button>
                    );
                  })}
                </div>
                {ficha && typeof ficha.maximum_consent_validity === "number" && (
                  <p className="mt-1.5 text-[11px] text-slate-400">El permiso durará como mucho {Math.round(ficha.maximum_consent_validity / 86400)} días; después habrá que renovarlo con un clic.</p>
                )}
              </div>
            )}
            <Resultado />
            <p className="text-[11px] text-slate-400">Al pulsar «Ir al banco» saldrás de la app para identificarte. Al volver, elige la cuenta que quieres seguir y sincroniza.</p>
          </Paso>
        )}

        {paso === 99 && (
          <Paso n={4} titulo="Listo">
            <p>Tu backend está conectado. Para usar tus datos en otro móvil u ordenador, abre allí tu enlace de acceso. Si aún no te lo has mandado:</p>
            <CompartirAcceso workerUrl={limpia(url)} token={tok.trim()} />
            <p className="text-[12px] text-slate-500">Por si lo prefieres a mano:</p>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">Dirección</p>
              <Campo valor={limpia(url)} />
              <p className="mt-2 text-[12px] font-medium text-slate-700">Contraseña</p>
              <Campo valor={tok.trim()} />
            </div>
            <p className="text-[12px] text-slate-500">¿Cambias de idea con el banco? Vuelve a abrir este asistente desde Ajustes → Banco.</p>
          </Paso>
        )}
      </div>
    </Modal>
  );
}

function EmptyState({ onFiles, onSample, error, parsing, onSettings, onAsistente, onEntrar }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14 anim-rise">
      {/* Portada. Antes esta pantalla solo ofrecia CSV, que dejo de ser la via principal en
          cuanto la app aprendio a conectarse al banco: quien llegaba nuevo no se enteraba. */}
      <div className="overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
        <div className="px-6 py-8 sm:px-9 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,.14)" }}>
              <Wallet size={24} />
            </span>
            {/* Quien vuelve no tiene que leerse la portada: el acceso está donde se busca. */}
            {onEntrar && (
              <button type="button" onClick={onEntrar}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ background: "rgba(255,255,255,.16)" }}>
                Entrar
              </button>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Tus finanzas, claras</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">
            Descubre en qué se va tu dinero: por categoría, por activo y por etiquetas transversales.
            Tus datos se guardan en tu dispositivo y, si quieres, en tu propio servidor. <strong className="font-semibold text-white/90">Nunca en el nuestro</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{error}</div>
        </div>
      )}

      {parsing ? (
        <Card className="mt-5 flex items-center justify-center p-10"><Spinner label="Leyendo el archivo…" /></Card>
      ) : (
        <>
          {/* El orden importa más de lo que parece. Antes el banco iba primero y marcado como
              recomendado, pero exige montar un backend y una cuenta en Enable Banking: cuarenta
              minutos antes de ver un gráfico. Quien llega tiene que poder probar la app en un
              minuto y decidir después si le compensa instalar algo. */}
          {/* Tres puntos de partida: dos para quien empieza (extracto o banco) y uno para quien
              ya tiene cuenta y abre la app en otro navegador o dispositivo. */}
          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Es mi primera vez</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col rounded-2xl border-2 bg-white p-5" style={{ borderColor: C.accent }}>
              <span className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.accentSoft, color: C.accent }}>
                  <FileText size={20} />
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: C.accentSoft, color: C.accent }}>Empieza aquí</span>
              </span>
              <span className="mt-3 block text-base font-semibold">Trae tu extracto</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Descárgalo desde la web de tu banco, en <strong>CSV o Excel</strong>, y tráelo aquí. Un minuto, sin registrarte en nada.
              </span>
              <div className="mt-3"><DropZone onFiles={onFiles} compact /></div>
            </div>

            <button type="button" onClick={onAsistente || onSettings}
              className="group flex flex-col rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ borderColor: C.line }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Landmark size={20} />
              </span>
              <span className="mt-3 block text-base font-semibold">Conectar tu banco</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Los movimientos entran solos cada pocas horas, sin descargar nada. Más cómodo, pero hay que montar un backend propio: unos 20 minutos.
              </span>
              <span className="mt-auto pt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
                Ver cómo <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>

          <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Ya uso la app</h2>
          <div className="mt-2 rounded-2xl border bg-white p-4" style={{ borderColor: C.line }}>
            {onEntrar && (
              <button type="button" onClick={onEntrar}
                className="group flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: C.accentSoft, color: C.accent }}><RefreshCw size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">Entrar con mi cuenta</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Abre tu enlace de acceso (está en tu email) o pégalo aquí. Llegan tus datos y tus bancos.</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {/* Sin backend, la copia .json es la única forma de llevarse los datos: es el mismo
                caso (ya uso la app), solo que por otro camino. */}
            {onSettings && (
              <p className="mt-3 border-t pt-2.5 text-xs text-slate-500" style={{ borderColor: C.line }}>
                ¿Sin backend? <button type="button" onClick={onSettings} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" style={{ color: C.accent }}>Restaura una copia (.json)</button>
              </p>
            )}
          </div>

          <div className="mt-6 text-center">
            <button type="button" onClick={onSample} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Sparkles size={14} /> Ver una demo con datos de ejemplo
            </button>
            <p className="mt-1 text-xs text-slate-400">14 meses ficticios de un banco español, para ver cómo funciona antes de traer los tuyos.</p>
            <p className="mt-3 text-xs"><a href="/privacidad.html" className="text-slate-500 underline hover:text-slate-700">Privacidad: qué datos usa la app y dónde se guardan</a></p>
          </div>
        </>
      )}
    </div>
  );
}

function MappingModal({ imp, onConfirm, onCancel }) {
  const { rows } = imp;
  const init = imp.analysis.cols || {};
  const [headerRow, setHeaderRow] = useState(imp.analysis.headerIdx ?? 0);
  const [date, setDate] = useState(init.date ?? -1);
  const [concept, setConcept] = useState(init.concept ?? -1);
  const [mode, setMode] = useState(init.cargo >= 0 || init.abono >= 0 ? "dual" : "single");
  const [amount, setAmount] = useState(init.amount ?? -1);
  const [cargo, setCargo] = useState(init.cargo ?? -1);
  const [abono, setAbono] = useState(init.abono ?? -1);
  const [saldo, setSaldo] = useState(init.saldo ?? -1);
  const [skipEmptyCol, setSkipEmptyCol] = useState(init.skipEmptyCol ?? -1);
  const [keepCol, setKeepCol] = useState(init.keepCol ?? -1);
  const [keepVal, setKeepVal] = useState(init.keepVal ?? "");
  const nCols = Math.max(...rows.slice(0, 30).map((r) => r.length));
  // ¿Esta fila entra, según los filtros? (mismos criterios que la importación).
  const rowKept = (r) => {
    if (!r) return false;
    if (skipEmptyCol >= 0 && !String(r[skipEmptyCol] ?? "").trim()) return false;
    if (keepCol >= 0 && String(keepVal).trim() && String(r[keepCol] ?? "").trim().toLowerCase() !== String(keepVal).trim().toLowerCase()) return false;
    return true;
  };
  const colName = (i) => { const h = rows[headerRow]?.[i]?.trim(); return h ? `${i + 1} · ${h.slice(0, 18)}` : `Columna ${i + 1}`; };
  const ColPick = ({ value, onChange, optional }) => (
    <select value={value} onChange={(e) => onChange(+e.target.value)} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
      <option value={-1}>{optional ? "(ninguna)" : "— Elegir —"}</option>
      {Array.from({ length: nCols }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
    </select>
  );
  const ok = date >= 0 && concept >= 0 && (mode === "single" ? amount >= 0 : cargo >= 0 || abono >= 0);
  const preview = rows.slice(headerRow + 1, headerRow + 10);
  const dataRows = rows.slice(headerRow + 1);
  const keptCount = dataRows.reduce((n, r) => n + (rowKept(r) ? 1 : 0), 0);
  return (
    <Modal title="Asignar columnas" subtitle={imp.fileName} onClose={onCancel} wide>
      {imp.mapError && <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{imp.mapError}</div></div>}
      <p className="mb-3 text-sm text-slate-500">Indica qué contiene cada columna. Abajo tienes una vista previa de los datos.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">Fila de cabecera<input type="number" min={0} max={rows.length - 2} value={headerRow} onChange={(e) => setHeaderRow(Math.max(0, +e.target.value))} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} /></label>
        <label className="text-xs font-medium text-slate-600">Fecha<div className="mt-1"><ColPick value={date} onChange={setDate} /></div></label>
        <label className="text-xs font-medium text-slate-600">Concepto<div className="mt-1"><ColPick value={concept} onChange={setConcept} /></div></label>
        <label className="text-xs font-medium text-slate-600">Tipo de importe<div className="mt-1"><select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}><option value="single">Importe único con signo</option><option value="dual">Cargo y abono separados</option></select></div></label>
        {mode === "single"
          ? <label className="text-xs font-medium text-slate-600">Importe<div className="mt-1"><ColPick value={amount} onChange={setAmount} /></div></label>
          : <><label className="text-xs font-medium text-slate-600">Cargo (gastos)<div className="mt-1"><ColPick value={cargo} onChange={setCargo} optional /></div></label><label className="text-xs font-medium text-slate-600">Abono (ingresos)<div className="mt-1"><ColPick value={abono} onChange={setAbono} optional /></div></label></>}
        <label className="text-xs font-medium text-slate-600">Saldo (opcional)<div className="mt-1"><ColPick value={saldo} onChange={setSaldo} optional /></div></label>
      </div>
      <div className="mt-3 grid gap-3 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: C.line, background: C.surfaceAlt }}>
        <label className="text-xs font-medium text-slate-600">Omitir filas donde esta columna esté vacía <span className="font-normal text-slate-400">(opcional)</span>
          <div className="mt-1"><ColPick value={skipEmptyCol} onChange={setSkipEmptyCol} optional /></div>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">PayPal: elige <strong>«Nombre»</strong> — las filas internas (depósitos, conversiones) van sin nombre y duplican.</span>
        </label>
        <label className="text-xs font-medium text-slate-600">Solo importar filas donde esta columna sea… <span className="font-normal text-slate-400">(opcional)</span>
          <div className="mt-1 flex items-center gap-2">
            <ColPick value={keepCol} onChange={setKeepCol} optional />
            <input value={keepVal} onChange={(e) => setKeepVal(e.target.value)} placeholder="EUR" className="w-24 shrink-0 rounded-lg border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
          </div>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">Divisa: elige la columna <strong>«Divisa»</strong> y escribe <strong>EUR</strong> — así no cuela coronas/dólares como si fueran euros.</span>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Se importarán <span style={{ color: C.accent }}>{nfNum.format(keptCount)}</span> de {nfNum.format(dataRows.length)} filas <span className="font-normal text-slate-400">(según tus filtros)</span>.</p>
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <table className="w-full text-xs" style={tnum}><tbody>
          {preview.map((r, i) => {
            const kept = rowKept(r);
            return (
              <tr key={i} className="border-b last:border-0" style={{ borderColor: C.line, opacity: kept ? 1 : 0.4 }}>
                <td className="px-2 py-1.5 text-center" title={kept ? "Se importa" : "Se omite"}>{kept ? <Check size={13} className="inline text-emerald-600" /> : <X size={13} className="inline text-slate-400" />}</td>
                {Array.from({ length: nCols }, (_, c) => <td key={c} className={`max-w-[160px] truncate px-2 py-1.5 ${kept ? "text-slate-600" : "text-slate-400 line-through"}`}>{r[c]}</td>)}
              </tr>
            );
          })}
        </tbody></table>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onCancel}>Cancelar</Btn>
        <Btn kind="primary" disabled={!ok} onClick={() => onConfirm({ dataStart: headerRow + 1, cols: { date, date2: -1, concept, amount: mode === "single" ? amount : -1, cargo: mode === "dual" ? cargo : -1, abono: mode === "dual" ? abono : -1, saldo, skipEmptyCol, keepCol, keepVal, signo: init.signo ?? -1 } })}>Continuar</Btn>
      </div>
    </Modal>
  );
}

function ValidationModal({ val, onConfirm, onCancel, onRemap }) {
  const { movs, skipped, mismatches, fileName, dupes } = val;
  const [cur, setCur] = useState("EUR");
  const [rateStr, setRateStr] = useState("");
  const isEur = cur === "EUR";
  const rate = isEur ? 1 : parseFloat((rateStr || "").replace(",", "."));
  const rateOk = isEur || (isFinite(rate) && rate > 0);
  if (movs.length === 0) {
    return (
      <Modal title="Comprobación de la importación" subtitle={fileName} onClose={onCancel}>
        <p className="text-sm text-slate-600">No hay movimientos nuevos: {dupes > 0 ? `los ${dupes} movimientos ya estaban importados.` : "no se ha podido leer ninguna fila válida."} {dupes === 0 && "Prueba a ajustar las columnas."}</p>
        <div className="mt-4 flex justify-end gap-2">{dupes === 0 && <Btn onClick={onRemap}>Ajustar columnas</Btn>}<Btn kind="primary" onClick={onCancel}>Entendido</Btn></div>
      </Modal>
    );
  }
  const dates = movs.map((m) => m.date);
  const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
  const inSum = movs.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const outSum = movs.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0);
  return (
    <Modal title="Comprobación de la importación" subtitle={fileName} onClose={onCancel}>
      <p className="mb-3 text-sm text-slate-500">Revisa que los datos cuadran. Al importar se clasifican solos; lo que quede dudoso lo verás como "por revisar" en el panel, sin bloquearte.</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Card className="p-3"><div className="text-xs text-slate-500">Movimientos leídos</div><div className="text-lg font-semibold" style={tnum}>{nfNum.format(movs.length)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Rango de fechas</div><div className="text-sm font-medium" style={tnum}>{fmtDate(min)} – {fmtDate(max)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Ingresos</div><div className="font-semibold" style={{ ...tnum, color: C.income }}>{fmtE(inSum)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Gastos</div><div className="font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE(outSum)}</div></Card>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {skipped > 0 && <li className="flex items-center gap-2 text-slate-600"><Info size={14} /> {skipped} {skipped === 1 ? "fila omitida" : "filas omitidas"} (cabeceras, totales o sin datos válidos).</li>}
        {dupes > 0 && <li className="flex items-center gap-2 text-slate-600"><Info size={14} /> {dupes} duplicados ya importados se han ignorado.</li>}
        {mismatches !== null && (mismatches === 0
          ? <li className="flex items-center gap-2" style={{ color: C.income }}><Check size={14} /> El saldo cuadra con los importes en todas las filas.</li>
          : <li className="flex items-center gap-2" style={{ color: C.warn }}><AlertTriangle size={14} /> {mismatches} descuadres entre saldo e importes. Revisa el mapeo si no lo esperas.</li>)}
      </ul>

      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Divisa del archivo</span>
          <select value={cur} onChange={(e) => setCur(e.target.value)} className="rounded-lg border bg-white px-2 py-1 text-sm" style={{ borderColor: C.line }}>
            {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {!isEur && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500" style={tnum}>1 {cur} =</span>
              <input value={rateStr} onChange={(e) => setRateStr(e.target.value)} inputMode="decimal" placeholder="0,086"
                className="w-20 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: rateOk ? C.line : C.expense }} />
              <span className="text-slate-500">€</span>
            </span>
          )}
        </div>
        {isEur
          ? <p className="mt-1.5 text-[11px] text-slate-400">Si el archivo está en euros, no toques nada. Si viene en otra moneda (p. ej. un PayPal en coronas), elígela y pon la tasa: convertiré los importes a € al importar.</p>
          : rateOk
            ? <p className="mt-1.5 text-[11px] text-slate-500">Convertido a €: <span className="font-medium" style={{ color: C.income }}>{fmtE(inSum * rate)}</span> ingresos · <span className="font-medium" style={{ color: C.expense }}>{fmtE(outSum * rate)}</span> gastos. Se guarda el importe original en {cur}.</p>
            : <p className="mt-1.5 text-[11px]" style={{ color: C.expense }}>Escribe cuántos euros vale 1 {cur} para poder convertir.</p>}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2"><Btn onClick={onCancel}>Descartar</Btn><Btn onClick={onRemap}>Ajustar columnas</Btn><Btn kind="primary" disabled={!rateOk} onClick={() => onConfirm({ currency: cur, rate })}>Importar</Btn></div>
    </Modal>
  );
}

export {
  DropZone,
  PrimerosPasos,
  CompartirAcceso,
  EntrarModal,
  VueltaOtroNavegador,
  AccesoOtroNavegador,
  AsistenteConexion,
  EmptyState,
  MappingModal,
  ValidationModal,
};
