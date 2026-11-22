// Vigía de arranque. Si la app no llega a pintarse (un archivo que no carga, un error antes de
// que React monte, una copia vieja de la página en el móvil), en vez de una pantalla en blanco
// se explica qué ha pasado y se ofrece recargar. Va aparte (no dentro de la app) para funcionar
// justo cuando la app no puede, y es un archivo propio porque la CSP no admite código en línea.
(function () {
  var errores = [];
  window.addEventListener("error", function (e) {
    var t = e && e.target;
    if (t && t !== window && (t.src || t.href)) errores.push("No se pudo cargar " + (t.src || t.href));
    else if (e && e.message) errores.push(e.message);
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    errores.push(String((r && r.message) || r || "error"));
  });
  function vacia() {
    var root = document.getElementById("root");
    return !root || !root.firstChild;
  }
  function mostrar() {
    if (!vacia()) return;
    var caja = document.createElement("div");
    caja.id = "finz-arranque";
    caja.style.cssText = "position:fixed;inset:0;z-index:99999;overflow:auto;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#e2e8f0;font:15px/1.5 system-ui,-apple-system,sans-serif";
    var tarjeta = document.createElement("div");
    tarjeta.style.cssText = "max-width:440px;width:100%;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px";
    var h = document.createElement("h1");
    h.style.cssText = "font-size:18px;margin:0 0 8px";
    h.textContent = "La app no ha podido arrancar";
    var p = document.createElement("p");
    p.style.cssText = "margin:0;color:#94a3b8";
    p.textContent = "Tus datos siguen guardados en este dispositivo. Suele arreglarse recargando: así se descarga la versión actual.";
    var b = document.createElement("button");
    b.style.cssText = "display:block;width:100%;margin-top:16px;padding:12px 16px;border:0;border-radius:10px;background:#22c55e;color:#052e16;font-weight:600;font-size:15px";
    b.textContent = "Recargar la app";
    b.onclick = function () {
      try { sessionStorage.removeItem("finz:recarga-trozos"); } catch (e) { /* nada */ }
      var u = location.pathname + "?v=" + Date.now() + location.hash;
      location.replace(u);
    };
    var d = document.createElement("p");
    d.style.cssText = "margin:14px 0 0;font-size:11px;color:#64748b;word-break:break-word";
    d.textContent = errores.length ? "Detalle: " + errores.slice(-3).join(" · ") : "Detalle: la app no respondió a tiempo.";
    tarjeta.appendChild(h); tarjeta.appendChild(p); tarjeta.appendChild(b); tarjeta.appendChild(d);
    caja.appendChild(tarjeta);
    document.body.appendChild(caja);
    // Si la app acaba arrancando (una conexión muy lenta), el aviso se retira solo.
    var vigia = setInterval(function () { if (!vacia()) { clearInterval(vigia); caja.remove(); } }, 1000);
  }
  setTimeout(mostrar, 12000);
})();
