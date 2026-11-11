import { test, expect } from "@playwright/test";

// Backend simulado: así se prueba la sincronización sin tocar ningún servidor real.
const WORKER = "https://backend-de-prueba.example";

async function preparar(page, { pendiente }) {
  const peticiones = [];
  const subidas = []; // cuerpos de los PUT /store
  await page.route(WORKER + "/**", async (route) => {
    const req = route.request();
    const ruta = new URL(req.url()).pathname;
    peticiones.push(`${req.method()} ${ruta}`);
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (ruta === "/store/history" && new URL(req.url()).searchParams.get("version")) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ version: 5, updatedAt: Date.now() - 86400000, payload: { movs: { v: 1, movs: [
      { id: 1, date: "2026-11-01T12:00:00.000Z", concept: "RECUPERADO A", pattern: "RECUPERADO A", amount: -10, category: "Compras", confirmed: true },
      { id: 2, date: "2026-11-02T12:00:00.000Z", concept: "RECUPERADO B", pattern: "RECUPERADO B", amount: -20, category: "Compras", confirmed: true },
    ] }, cfg: {} } }) });
    if (ruta === "/store/history") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ versions: [{ version: 7, updatedAt: Date.now() }, { version: 5, updatedAt: Date.now() - 86400000 }] }) });
    if (ruta === "/store" && req.method() === "PUT") subidas.push(JSON.parse(req.postData() || "{}"));
    if (ruta === "/store" && req.method() === "PUT") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, version: 8, updatedAt: Date.now() }) });
    if (ruta === "/store") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ payload: { movs: { v: 1, movs: [{ id: 9, date: "2026-11-05T12:00:00.000Z", concept: "ACTUAL SERVIDOR", pattern: "ACTUAL SERVIDOR", amount: -5, category: "Compras", confirmed: true }, { id: 10, date: "2026-11-06T12:00:00.000Z", concept: "OTRO SERVIDOR", pattern: "OTRO SERVIDOR", amount: -6, category: "Compras", confirmed: true }] }, cfg: {} }, version: 7, updatedAt: Date.now() }) });
    return route.fulfill({ status: 200, headers: cors, body: "{}" });
  });
  await page.addInitScript(([w, pend]) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:sync:v1", JSON.stringify({ auto: true, version: 7, ...(pend ? { pendiente: Date.now() - 5000 } : {}) }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [{ id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true }] }));
  }, [WORKER, pendiente]);
  peticiones.subidas = subidas;
  return peticiones;
}

test("con cambios sin subir, al abrir se suben y NO se trae la copia del servidor", async ({ page }) => {
  const peticiones = await preparar(page, { pendiente: true });
  await page.goto("/");
  await expect.poll(() => peticiones.includes("PUT /store")).toBe(true);
  expect(peticiones).not.toContain("GET /store");
  // El movimiento local sigue ahí (no lo ha pisado la copia del servidor, que tiene otros dos).
  await expect(page.getByText(/1 movimiento/i).first()).toBeVisible();
});

test("sin cambios pendientes, al abrir se trae la copia del servidor", async ({ page }) => {
  const peticiones = await preparar(page, { pendiente: false });
  await page.goto("/");
  await expect.poll(() => peticiones.includes("GET /store")).toBe(true);
});

test("recuperar una versión sube la recuperada, no la de antes", async ({ page }) => {
  const peticiones = await preparar(page, { pendiente: false });
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await expect.poll(() => peticiones.includes("GET /store")).toBe(true);
  await page.getByRole("button", { name: "Ajustes y datos" }).click();
  await page.getByRole("button", { name: /Tus datos y sincronización/ }).click();
  await page.getByRole("button", { name: /Versiones anteriores/ }).click();
  await page.getByRole("button", { name: "Recuperar" }).click();
  await expect.poll(() => peticiones.subidas.length).toBeGreaterThan(0);
  const subida = peticiones.subidas.at(-1).payload;
  expect(subida.movs.movs.map((m) => m.concept)).toEqual(["RECUPERADO A", "RECUPERADO B"]);
});
