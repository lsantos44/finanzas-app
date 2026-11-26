import { test, expect } from "@playwright/test";

const WORKER = "https://backend-de-prueba.example";
const dias = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 10, 24) - (n - 1 - i) * 86400000); return d.toISOString().slice(0, 10); });
const serie = (n, a, b) => dias(n).map((f, i) => [f, +(a + ((b - a) * i) / (n - 1)).toFixed(4)]);

async function preparar(page, { ia = false } = {}) {
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
      series: { "TEF.MC": serie(400, 3.0, 3.404), COHR: serie(400, 150, 196.24), "EURUSD=X": serie(400, 1.08, 1.0964), "0PFONDO.F": serie(400, 90, 100), "0PBUENO.F": serie(400, 40, 50), "LISTADO.MU": [["2026-11-24", 7]], "IWDA.AS": serie(400, 80, 100) },
      meta: { "TEF.MC": { divisa: "EUR" }, COHR: { divisa: "USD" }, "0PFONDO.F": { divisa: "EUR" }, "0PBUENO.F": { divisa: "EUR" }, "LISTADO.MU": { divisa: "EUR" }, "IWDA.AS": { divisa: "EUR" } } }) });
    return route.fulfill({ status: 200, headers: cors, body: "{}" });
  });
  await page.addInitScript(({ w, ia }) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [
      { id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true },
      { id: 2, date: "2026-09-02T12:00:00.000Z", concept: "TRANSF A ROBO", pattern: "TRANSF A ROBO", amount: -300, category: "Ahorro e inversión", confirmed: true },
      { id: 3, date: "2026-10-02T12:00:00.000Z", concept: "TRANSF A ROBO", pattern: "TRANSF A ROBO", amount: -300, category: "Ahorro e inversión", confirmed: true },
    ] }));
    localStorage.setItem("finz:cfg:v1", JSON.stringify({ v: 5, customRules: [], disabledRules: [], assets: [], groups: [], budgets: {}, reducible: [], aiOn: ia, ai: ia ? { provider: "openai", baseUrl: "https://ia-de-prueba.example/v1", model: "modelo", apiKey: "k" } : {}, aiProfiles: [], aiDetail: false, ruleStats: {}, materialidad: 10, assetMem: {},
      inversiones: { posiciones: [
        { id: "tef", nombre: "Telefónica", entidad: "Plan de empleados", tipo: "accion", simbolo: "TEF.MC", participaciones: 1000, coste: null, alta: "2026-11-24", compra: "2026-01-15" },
        { id: "cohr", nombre: "Coherent", entidad: "Bróker", tipo: "accion", simbolo: "COHR", participaciones: 5, coste: 1000, alta: "2026-11-24", compra: "2026-02-10" },
        { id: "fondo", nombre: "Fondo con ISIN", entidad: "Banco privado", tipo: "fondo", isin: "XX0000000009", valorAlta: 10000, coste: 9000, alta: "2026-11-24", compra: "2026-06-03" },
        { id: "robo", nombre: "Fondo de bolsa", entidad: "Roboadvisor", tipo: "fondo", simbolo: "LISTADO.MU", valorAlta: 2000, coste: 1800, alta: "2026-11-24", robo: true, pesoObjetivo: 100 },
      ], aportacion: null } }));
  }, { w: WORKER, ia });
  return peticiones;
}

test("la pestaña Inversiones valora, agrupa, resuelve ISIN y abre el detalle", async ({ page }) => {
  const peticiones = await preparar(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await expect(page.getByRole("heading", { name: "Qué explica tu resultado" })).toBeVisible();
  // ISIN → cotización, y se le pide al servidor que la siga.
  await expect.poll(() => peticiones.includes("GET /inversiones/resolver")).toBe(true);
  await expect.poll(() => peticiones.includes("POST /inversiones/seguir")).toBe(true);
  await expect(page.getByRole("button", { name: /^Plan de empleados/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bróker/ }).first()).toBeVisible();
  // 3.404 + 894,93 + 10.000 + 2.000 ≈ 16.299 €
  await expect(page.getByText(/16\.29[89]\s?€/).first()).toBeVisible();
  // El listado de bolsa con un solo dato se cambia por la cotización con historial.
  await expect.poll(() => peticiones.filter((x) => x === "GET /inversiones/resolver").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("El gráfico aparecerá cuando lleguen los precios.")).toHaveCount(0);
  // La ganancia de una plataforma es desde que compraste (valor − invertido), no lo que han subido
  // sus acciones en el año: el bróker de prueba pierde aunque Coherent suba en el periodo.
  const plataforma = page.getByLabel("Plataforma");
  await plataforma.selectOption("Bróker");
  await expect(page.getByRole("heading", { name: "Tú frente al mercado" })).toBeVisible();
  await expect(page.getByText(/-105\s?€/).first()).toBeVisible();
  await expect(page.getByText(/-10,5\d\s?%/).first()).toBeVisible();
  // «Total» = la plusvalía (valor − invertido); un periodo cuenta desde que entraste si fue después.
  await page.getByRole("button", { name: "Total", exact: true }).click();
  await expect(page.getByText(/en total \(valor hoy − lo invertido\)/).first()).toBeVisible();
  await page.getByRole("button", { name: "1A", exact: true }).click();
  await expect(page.getByText(/desde que entraste \(10 feb\)/).first()).toBeVisible();
  await page.getByLabel("Producto").selectOption("cohr");
  // En %, con la línea del índice; y «Tú frente al mercado» con el mismo dinero en MSCI World.
  await page.getByRole("button", { name: "%", exact: true }).click();
  await expect(page.getByText(/– – MSCI World:/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tú frente al mercado" })).toBeVisible();
  await expect(page.getByText(/por (delante|detrás) de MSCI World/)).toBeVisible();
  await page.getByRole("button", { name: "€", exact: true }).click();
  await plataforma.selectOption("");
  await expect(page.getByText("Lo destacable")).toBeVisible();
  // Las plataformas salen plegadas; al abrir una se ven sus productos.
  await expect(page.getByText(/Tu aportación mensual a esta cartera/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Roboadvisor/ }).last().click();
  // Aportación periódica detectada y aplicada con un toque.
  await expect(page.getByText(/Tu aportación mensual a esta cartera/)).toBeVisible();
  await page.getByRole("button", { name: "Sí, usarla" }).click();
  await expect(page.getByText(/Aportación automática de/)).toBeVisible();
  await page.getByRole("button", { name: /^Bróker/ }).last().click();
  await page.getByRole("button", { name: /^Coherent/ }).last().click();
  await expect(page.getByText("Precio medio de compra")).toBeVisible();
  // Coherent cotiza en dólares: precio de hoy en euros y en dólares, y lo que va por acción.
  await expect(page.getByText(/196,24\s?US\$/).first()).toBeVisible();
  await expect(page.getByText("Diferencia por acción")).toBeVisible();
  await expect(page.getByText("Tu precio medio", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  // Resumen ya no repite las inversiones (tienen su pestaña).
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await expect(page.getByText("Ganas en total")).toHaveCount(0);
});

test("«¿Por qué se ha movido?»: la IA recibe nombres y %, nunca importes", async ({ page }) => {
  await preparar(page, { ia: true });
  let enviado = null;
  await page.route("https://ia-de-prueba.example/**", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    enviado = route.request().postData();
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ choices: [{ message: { content: "Mercado al alza.\n- **Coherent** (+3 %): contrato nuevo." } }] }) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByRole("button", { name: /Por qué se ha movido/ }).click();
  await expect(page.getByText("contrato nuevo.")).toBeVisible();
  expect(enviado).toContain("Coherent");
  expect(enviado).not.toMatch(/€|16\.29|3\.404|10\.000/);
});

test("captura visual (solo con CAPTURAS)", async ({ page }) => {
  test.skip(!process.env.CAPTURAS, "solo para revisar a ojo");
  await preparar(page);
  await page.goto("/");
  await page.screenshot({ path: `${process.env.CAPTURAS}/resumen-${test.info().project.name}.png` });
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByRole("heading", { name: "Qué explica tu resultado" }).waitFor();
  await page.waitForTimeout(800);
  const dir = process.env.CAPTURAS;
  await page.screenshot({ path: `${dir}/tab-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Total", exact: true }).click();
  await page.getByRole("button", { name: "%", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "%", exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").screenshot({ path: `${dir}/pct-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "€", exact: true }).click();
  await page.getByLabel("Plataforma").selectOption("Bróker");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/filtro-broker-${test.info().project.name}.png` });
  await page.getByLabel("Plataforma").selectOption("");
  await page.getByRole("button", { name: /^Bróker/ }).last().click();
  await page.getByRole("button", { name: /^Coherent/ }).last().click();
  await page.getByText("Precio medio de compra").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/detalle-${test.info().project.name}.png` });
});
