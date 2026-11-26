// Copia del programa en el dispositivo (service worker). La compilación rellena la versión y la
// lista real de archivos (ver vite.config.js).
// Para qué: si Cloudflare no responde (los bloqueos de LaLiga en jornada de fútbol, sin
// cobertura, en el avión), la app abre igualmente con los datos que ya hay en el dispositivo.
// Solo guarda el PROGRAMA. Tus datos siguen donde estaban; las peticiones a tu servidor, al banco
// o a la IA no pasan por aquí.
const VERSION = "__VERSION__";
const ARCHIVOS = __ARCHIVOS__;
const CACHE = "finz-app-" + VERSION;
const ESPERA_RED = 3500; // ms antes de abrir la copia guardada si la red no contesta

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("finz-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero, con plazo: online siempre se sirve lo último publicado; si la red no contesta a
// tiempo (o falla), la copia guardada. Si no hay copia, se espera a la red sin plazo.
async function redConPlazo(req, clave) {
  const cache = await caches.open(CACHE);
  const red = fetch(req).then((res) => {
    if (res.ok && !res.redirected) cache.put(clave, res.clone());
    return res;
  });
  const guardada = await cache.match(clave);
  if (!guardada) return red;
  return Promise.race([
    red.then((res) => (res.ok ? res : guardada), () => guardada),
    new Promise((ok) => setTimeout(() => ok(guardada), ESPERA_RED)),
  ]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Tu servidor, el banco, la IA: siempre directo a la red.
  if (url.origin !== self.location.origin) return;
  // ¿Hay una versión nueva publicada? Se pregunta siempre a la red, nunca a la copia.
  if (url.pathname === "/version.txt") return;

  if (req.mode === "navigate") {
    // La app es una sola página: cualquier dirección (con ?bank_session=…, ?v=…) es la misma.
    const clave = url.pathname === "/privacidad.html" ? "/privacidad.html" : "/";
    e.respondWith(redConPlazo(req, clave));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    // Llevan su huella en el nombre: si está guardado, es exactamente ese archivo.
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      // Un archivo que ya no existe llega como la página (text/html): eso no se guarda.
      if (res.ok && !(res.headers.get("content-type") || "").includes("text/html")) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(redConPlazo(req, url.pathname));
});
