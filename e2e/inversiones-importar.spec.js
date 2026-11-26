import { test, expect } from "@playwright/test";

// Datos inventados de principio a fin.
const CSV = [
  "Fecha;Hora;Producto;ISIN;Bolsa de referencia;Centro de ejecución;Número;Precio;;Valor local;;Valor;;Tipo de cambio;Costes de transacción y/o externos;;Total;;ID Orden",
  "03-03-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;10;100,00;EUR;-1000,00;EUR;-1000,00;EUR;;-2,00;EUR;-1002,00;EUR;a1",
  "04-05-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;5;120,00;EUR;-600,00;EUR;-600,00;EUR;;-2,00;EUR;-602,00;EUR;a2",
  "10-09-2026;10:00;ACME CORP;US0000000001;NDQ;XNAS;-12;130,00;EUR;1560,00;EUR;1560,00;EUR;;-2,00;EUR;1558,00;EUR;a3",
  "11-09-2026;10:00;OTRA SA;ES0000000002;MAD;XMAD;20;10,00;EUR;-200,00;EUR;-200,00;EUR;;-1,00;EUR;-201,00;EUR;a4",
].join("\n");

// Una persona que ya usa la app (con algún movimiento) y aún no tiene inversiones.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [{ id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true }] }));
  });
});

test("importar el archivo del bróker: vista previa, cartera exacta y Renta", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await expect(page.getByText("Todas tus inversiones, en un solo sitio")).toBeVisible();
  await page.getByRole("button", { name: /Importar el archivo de tu bróker/ }).click();
  await expect(page.getByText("¿Dónde lo descargo?")).toBeVisible();
  await page.getByLabel("Archivo de operaciones").setInputFiles({ name: "Transactions.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
  await expect(page.getByText(/Archivo de DEGIRO/)).toBeVisible();
  await expect(page.getByText(/4 operaciones/)).toBeVisible();
  // ACME: quedan 3 de la 2ª compra (5 a 602 €) → 361 €
  await expect(page.getByText("te costaron 361 €")).toBeVisible();
  await page.getByLabel("¿En qué plataforma está?").fill("Mi bróker");
  await page.getByRole("button", { name: /Importar 2 productos/ }).click();
  await expect(page.getByRole("button", { name: /^Mi bróker/ }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1") || "{}").inversiones?.posiciones?.length || 0)).toBe(2);
  const inv = await page.evaluate(() => JSON.parse(localStorage.getItem("finz:cfg:v1")).inversiones);
  expect(inv.posiciones).toHaveLength(2);
  expect(inv.posiciones.find((p) => p.isin === "US0000000001")).toMatchObject({ participaciones: 3, coste: 361.2, compra: "2026-03-03" });
  // Renta: la venta de 12 a 1.558 € que costaron 1.002 + 2/5 × 602 = 1.242,80 → +315,20 €
  await page.getByRole("button", { name: "Impuestos (Renta)" }).click();
  await expect(page.getByText("¿Tengo que declararlo?")).toBeVisible();
  await expect(page.getByText("Tus ventas de 2026")).toBeVisible();
  await expect(page.getByText("+315 €").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Descargar para tu gestor/ })).toBeVisible();
  await expect(page.getByText("Si vendieras hoy")).toBeVisible();
});

test("la cartera de ejemplo funciona sin servidor y se puede quitar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Invers/ }).first().click();
  await page.getByRole("button", { name: /Ver una cartera de ejemplo/ }).click();
  await expect(page.getByText(/cartera de ejemplo/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué explica tu resultado" })).toBeVisible();
  await expect(page.getByText("Sin precio automático")).toHaveCount(0);
  await page.getByRole("button", { name: "Impuestos (Renta)" }).click();
  await expect(page.getByText(/Tus ventas de \d{4}/)).toBeVisible();
  await page.getByRole("button", { name: "Tu cartera" }).click();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect(page.getByText("Todas tus inversiones, en un solo sitio")).toBeVisible();
});
