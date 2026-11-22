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
