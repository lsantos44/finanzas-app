import { test, expect } from "@playwright/test";

test("si el programa no carga, se explica y se ofrece recargar en vez de dejar la pantalla en blanco", async ({ page }) => {
  await page.route(/\/assets\/index-.*\.js$/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.getByText("La app no ha podido arrancar")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Recargar la app" })).toBeVisible();
  await expect(page.getByText(/No se pudo cargar/)).toBeVisible();
});

test("si la app arranca, el vigía no aparece", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(13000);
  await expect(page.getByText("La app no ha podido arrancar")).toHaveCount(0);
});

test("si se ha publicado una versión nueva, se ofrece actualizar (sin recargar sola)", async ({ page }) => {
  let sello = null;
  await page.route("**/version.txt", async (r) => {
    if (!sello) return r.continue();
    await r.fulfill({ status: 200, contentType: "text/plain", body: sello });
  });
  await page.goto("/");
  await expect(page.getByText("Tus finanzas, claras")).toBeVisible();
  await expect(page.getByText("Hay una versión nueva de la app.")).toHaveCount(0);
  // Se publica otra versión mientras la app sigue abierta en segundo plano; al volver a ella:
  sello = "01/01/2099, 10:00";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("Hay una versión nueva de la app.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar" })).toBeVisible();
});
