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
