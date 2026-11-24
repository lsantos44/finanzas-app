import { test, expect } from "@playwright/test";

const WORKER = "https://backend-de-prueba.example";
const dias = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 10, 24) - (n - 1 - i) * 86400000); return d.toISOString().slice(0, 10); });
const serie = (n, a, b) => dias(n).map((f, i) => [f, +(a + ((b - a) * i) / (n - 1)).toFixed(4)]);

async function preparar(page) {
  const peticiones = [];
  await page.route(WORKER + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    peticiones.push(`${req.method()} ${url.pathname}`);
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "content-type": "application/json" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/version") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ version: "2026-11-25", rasgos: ["inversiones"] }) });
    if (url.pathname === "/inversiones/buscar") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ resultados: [{ simbolo: "0PFONDO.F", nombre: "Fondo de prueba", tipo: "MUTUALFUND" }] }) });
    if (url.pathname === "/inversiones/seguir") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true }) });
    if (url.pathname === "/inversiones/precios") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({
      series: { "TEF.MC": serie(400, 3.0, 3.404), COHR: serie(400, 150, 196.24), "EURUSD=X": serie(400, 1.08, 1.0964), "0PFONDO.F": serie(400, 90, 100) },
      meta: { "TEF.MC": { divisa: "EUR" }, COHR: { divisa: "USD" }, "0PFONDO.F": { divisa: "EUR" } } }) });
    return route.fulfill({ status: 200, headers: cors, body: "{}" });
  });
  await page.addInitScript((w) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [{ id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true }] }));
    localStorage.setItem("finz:cfg:v1", JSON.stringify({ v: 5, customRules: [], disabledRules: [], assets: [], groups: [], budgets: {}, reducible: [], aiOn: false, ai: {}, aiProfiles: [], aiDetail: false, ruleStats: {}, materialidad: 10, assetMem: {},
      inversiones: { posiciones: [
        { id: "tef", nombre: "Telefónica", entidad: "Plan de empleados", tipo: "accion", simbolo: "TEF.MC", participaciones: 1000, coste: null, alta: "2026-11-24" },
        { id: "cohr", nombre: "Coherent", entidad: "Bróker", tipo: "accion", simbolo: "COHR", participaciones: 5, coste: 1000, alta: "2026-11-24" },
        { id: "fondo", nombre: "Fondo con ISIN", entidad: "Banco privado", tipo: "fondo", isin: "DE0008474024", valorAlta: 10000, coste: 9000, alta: "2026-11-24" },
      ], aportacion: null } }));
  }, WORKER);
  return peticiones;
}

test("la pestaña Inversiones valora, agrupa, resuelve ISIN y abre el detalle", async ({ page }) => {
  const peticiones = await preparar(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await expect(page.getByText("Valor de tus inversiones")).toBeVisible();
  // ISIN → cotización, y se le pide al servidor que la siga.
  await expect.poll(() => peticiones.includes("GET /inversiones/buscar")).toBe(true);
  await expect.poll(() => peticiones.includes("POST /inversiones/seguir")).toBe(true);
  await expect(page.getByText("Plan de empleados")).toBeVisible();
  await expect(page.getByText("Bróker", { exact: true })).toBeVisible();
  // 3.404 + 894,93 + 10.000 ≈ 14.299 €
  await expect(page.getByText(/14\.29[89]\s?€/).first()).toBeVisible();
  await page.getByRole("button", { name: /Coherent/ }).click();
  await expect(page.getByText("Precio medio de compra")).toBeVisible();
  await expect(page.getByText("Tu precio medio")).toBeVisible();
});

test("captura visual (solo con CAPTURAS)", async ({ page }) => {
  test.skip(!process.env.CAPTURAS, "solo para revisar a ojo");
  await preparar(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByText("Valor de tus inversiones").waitFor();
  await page.waitForTimeout(800);
  const dir = process.env.CAPTURAS;
  await page.screenshot({ path: `${dir}/tab-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: /Coherent/ }).click();
  await page.getByText("Precio medio de compra").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/detalle-${test.info().project.name}.png` });
});
