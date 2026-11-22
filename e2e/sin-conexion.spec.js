import { test, expect } from "@playwright/test";

const WORKER = "https://backend-de-prueba.example";

test.describe("sin conexión", () => {
  test.use({ serviceWorkers: "allow" });

  test("con la copia guardada, la app abre aunque la web no responda", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // ya controlada por la copia
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("Tus finanzas, claras")).toBeVisible({ timeout: 15000 });
    await context.setOffline(false);
  });
});

test("si tu servidor no contesta, se avisa y se sigue con los datos del dispositivo", async ({ page }) => {
  await page.route(WORKER + "/**", (r) => r.abort("failed"));
  await page.addInitScript((w) => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:bank:v1", JSON.stringify({ workerUrl: w, token: "t", connections: [], pending: null, auto: false }));
    localStorage.setItem("finz:sync:v1", JSON.stringify({ auto: true, version: 3 }));
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [{ id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true }] }));
  }, WORKER);
  await page.goto("/");
  await expect(page.getByText("Sin conexión con tu servidor.")).toBeVisible();
  await expect(page.getByText(/1 movimiento/i).first()).toBeVisible();
});
