import { test, expect } from "@playwright/test";

test("Activos: seleccionar varios suma sus importes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /demo con datos de ejemplo/i }).click();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  const secciones = page.getByRole("navigation", { name: "Secciones" }).filter({ visible: true });
  await secciones.getByRole("button", { name: /Activos/ }).click();
  // Atajo «Vehículos»: selecciona el coche y enseña el subtotal.
  await page.getByRole("button", { name: /Vehículos/ }).click();
  await expect(page.getByText(/1 activo seleccionado/)).toBeVisible();
  // Añadir otro a mano: ahora son dos.
  await page.getByRole("checkbox", { name: "Seleccionar Casa" }).check();
  await expect(page.getByText(/2 activos seleccionados/)).toBeVisible();
  await expect(page.getByText(/Seleccionados \(2\)/)).toBeVisible();
  // Se recuerda al volver.
  await page.reload();
  await secciones.getByRole("button", { name: /Activos/ }).click();
  await expect(page.getByText(/2 activos seleccionados/)).toBeVisible();
});

test("Activos: el detalle de ingresos/gastos no desplaza la página de lado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /demo con datos de ejemplo/i }).click();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page.getByRole("navigation", { name: "Secciones" }).filter({ visible: true }).getByRole("button", { name: /Activos/ }).click();
  await page.locator("table tbody button", { hasText: "€" }).nth(0).click();
  const panel = page.getByRole("dialog", { name: /Movimientos de/ });
  await expect(panel).toBeVisible();
  // La página de detrás queda bloqueada y nada sobresale de lado, ni durante la animación.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  for (let i = 0; i < 3; i++) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
