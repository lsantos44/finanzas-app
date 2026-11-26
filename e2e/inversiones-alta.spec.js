import { test, expect } from "@playwright/test";

const WORKER = "https://backend-de-prueba.example";
const IA = "https://ia.example/v1";
// PNG de 1×1 píxel: basta para probar el envío de capturas.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function preparar(page) {
  const pedidas = { ia: [] };
  await page.route(WORKER + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "content-type": "application/json" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === "/version") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ rasgos: ["inversiones", "inversiones-intradia"] }) });
    if (url.pathname === "/inversiones/buscar") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ resultados: [
      { simbolo: "AAPL", nombre: "Apple Inc.", tipo: "EQUITY", bolsa: "NasdaqGS", puntos: 21 },
      { simbolo: "APC.F", nombre: "Apple Inc.", tipo: "EQUITY", bolsa: "Frankfurt", puntos: 1 } ] }) });
    if (url.pathname === "/inversiones/resolver") return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ simbolo: null }) });
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, series: {}, meta: {} }) });
  });
  await page.route(IA + "/**", async (route) => {
    pedidas.ia.push(JSON.parse(route.request().postData() || "{}"));
    const contenido = JSON.stringify({ entidad: "Bróker de prueba", posiciones: [
      { nombre: "Empresa Uno", ticker: "UNO", bolsa: "Nasdaq", tipo: "accion", participaciones: "5", coste: "1.000,00", valor: "900,00" },
      { nombre: "Fondo Dos", isin: "IE00TEST0002", tipo: "fondo", participaciones: "12,5", costeMedio: "10.5" },
    ] });
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ choices: [{ message: { content: contenido }, finish_reason: "stop" }] }) });
  });
  await page.addInitScript(([w, ia]) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [{ id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true }] }));
    localStorage.setItem("finz:cfg:v1", JSON.stringify({ v: 5, customRules: [], disabledRules: [], assets: [], groups: [], budgets: {}, reducible: [], aiOn: true,
      ai: { provider: "openai_compat", baseUrl: ia, model: "modelo-vision", apiKey: "k" }, aiProfiles: [], aiDetail: false, ruleStats: {}, materialidad: 10, assetMem: {} }));
  }, [WORKER, IA]);
  return pedidas;
}

test("añadir un producto en dos pasos: buscarlo y decir cuántas tienes y a qué precio", async ({ page }) => {
  await preparar(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByRole("button", { name: /Añadir a mano/ }).click();
  await page.getByLabel("Buscar producto").fill("apple");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("sin precios")).toBeVisible();
  await page.getByRole("button", { name: /AAPL/ }).click();
  await expect(page.getByText(/Precio automático · AAPL/)).toBeVisible();
  await page.getByPlaceholder("Nº de acciones o participaciones").fill("10");
  await page.getByLabel("Precio medio de compra en euros").fill("150,5");
  await page.getByLabel("Otra plataforma").fill("Mi bróker");
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/alta-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: /^Apple Inc\./ }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1")).inversiones?.posiciones?.length || 0)).toBe(1);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1")).inversiones);
  expect(inv.posiciones[0]).toMatchObject({ simbolo: "AAPL", participaciones: 10, coste: 1505, entidad: "Mi bróker", tipo: "accion" });
});

test("cargar posiciones desde capturas: la IA las lee y tú confirmas", async ({ page }) => {
  const pedidas = await preparar(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByRole("button", { name: /Desde capturas/ }).click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "cartera.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("1 captura · añadir más")).toBeVisible();
  await page.getByRole("button", { name: "Leer con IA" }).click();
  await expect(page.getByText("Empresa Uno")).toBeVisible();
  await expect(page.getByText(/12,5 part\. · invertido 131,25/)).toBeVisible();
  // La imagen se manda como contenido de visión, en JPEG.
  expect(pedidas.ia[0].messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/capturas-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Guardar 2 productos" }).click();
  await expect(page.getByText(/0 productos actualizados y 2 añadidos/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1")).inversiones?.posiciones?.length || 0)).toBe(2);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1")).inversiones);
  expect(inv.posiciones[0]).toMatchObject({ nombre: "Empresa Uno", entidad: "Bróker de prueba", ticker: "UNO", bolsa: "Nasdaq", participaciones: 5, coste: 1000 });
});
