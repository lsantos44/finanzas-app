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
    if (url.pathname === "/version") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ version: "2026-11-26", rasgos: ["inversiones", "inversiones-intradia"] }) });
    if (url.pathname === "/inversiones/resolver") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(url.searchParams.get("nombre") === "Fondo de bolsa" ? { simbolo: "0PBUENO.F", puntos: 21 } : { simbolo: "0PFONDO.F", puntos: 21 }) });
    if (url.pathname === "/inversiones/buscar") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ resultados: [{ simbolo: "0PFONDO.F", nombre: "Fondo de prueba", tipo: "MUTUALFUND" }] }) });
    if (url.pathname === "/inversiones/seguir") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true }) });
    if (url.pathname === "/inversiones/precios") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({
      series: { "TEF.MC": serie(400, 3.0, 3.404), COHR: serie(400, 150, 196.24), "EURUSD=X": serie(400, 1.08, 1.0964), "0PFONDO.F": serie(400, 90, 100), "0PBUENO.F": serie(400, 40, 50), "LISTADO.MU": [["2026-11-24", 7]] },
      meta: { "TEF.MC": { divisa: "EUR" }, COHR: { divisa: "USD" }, "0PFONDO.F": { divisa: "EUR" }, "0PBUENO.F": { divisa: "EUR" }, "LISTADO.MU": { divisa: "EUR" } } }) });
    return route.fulfill({ status: 200, headers: cors, body: "{}" });
  });
  await page.addInitScript((w) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [
      { id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true },
      { id: 2, date: "2026-09-02T12:00:00.000Z", concept: "TRANSF A ROBO", pattern: "TRANSF A ROBO", amount: -300, category: "Ahorro e inversión", confirmed: true },
      { id: 3, date: "2026-10-02T12:00:00.000Z", concept: "TRANSF A ROBO", pattern: "TRANSF A ROBO", amount: -300, category: "Ahorro e inversión", confirmed: true },
    ] }));
    localStorage.setItem("finz:cfg:v1", JSON.stringify({ v: 5, customRules: [], disabledRules: [], assets: [], groups: [], budgets: {}, reducible: [], aiOn: false, ai: {}, aiProfiles: [], aiDetail: false, ruleStats: {}, materialidad: 10, assetMem: {},
      inversiones: { posiciones: [
        { id: "tef", nombre: "Telefónica", entidad: "Plan de empleados", tipo: "accion", simbolo: "TEF.MC", participaciones: 1000, coste: null, alta: "2026-11-24" },
        { id: "cohr", nombre: "Coherent", entidad: "Bróker", tipo: "accion", simbolo: "COHR", participaciones: 5, coste: 1000, alta: "2026-11-24" },
        { id: "fondo", nombre: "Fondo con ISIN", entidad: "Banco privado", tipo: "fondo", isin: "DE0008474024", valorAlta: 10000, coste: 9000, alta: "2026-11-24" },
        { id: "robo", nombre: "Fondo de bolsa", entidad: "Roboadvisor", tipo: "fondo", simbolo: "LISTADO.MU", valorAlta: 2000, coste: 1800, alta: "2026-11-24", robo: true, pesoObjetivo: 100 },
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
  await expect.poll(() => peticiones.includes("GET /inversiones/resolver")).toBe(true);
  await expect.poll(() => peticiones.includes("POST /inversiones/seguir")).toBe(true);
  await expect(page.getByText("Plan de empleados", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Bróker", { exact: true }).first()).toBeVisible();
  // 3.404 + 894,93 + 10.000 + 2.000 ≈ 16.299 €
  await expect(page.getByText(/16\.29[89]\s?€/).first()).toBeVisible();
  // El listado de bolsa con un solo dato se cambia por la cotización con historial.
  await expect.poll(() => peticiones.filter((x) => x === "GET /inversiones/resolver").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("El gráfico aparecerá cuando lleguen los precios.")).toHaveCount(0);
  await page.getByRole("button", { name: "Por plataforma" }).first().click();
  await page.getByRole("button", { name: "Comparar" }).click();
  await expect(page.getByText(/Rentabilidad en el periodo/)).toBeVisible();
  await page.getByRole("button", { name: "Total", exact: true }).click();
  // Aportación periódica detectada y aplicada con un toque.
  await expect(page.getByText(/Tu aportación mensual a esta cartera/)).toBeVisible();
  await page.getByRole("button", { name: "Sí, usarla" }).click();
  await expect(page.getByText(/Aportación automática de/)).toBeVisible();
  await page.getByRole("button", { name: /Coherent/ }).first().click();
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
  const evo = page.getByText("Evolución", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await page.getByRole("button", { name: "Por plataforma" }).first().click();
  await page.waitForTimeout(300);
  await evo.screenshot({ path: `${dir}/plataforma-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Comparar" }).click();
  await page.waitForTimeout(300);
  await evo.screenshot({ path: `${dir}/comparar-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Total", exact: true }).click();
  await page.getByRole("button", { name: /Coherent/ }).first().click();
  await page.getByText("Precio medio de compra").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/detalle-${test.info().project.name}.png` });
});
