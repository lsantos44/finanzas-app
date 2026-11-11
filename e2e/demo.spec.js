import { test, expect } from "@playwright/test";

const TABS = ["Resumen", "Análisis", "Clasif", "Activos", "Ideas", "Asistente"];

test("la demo carga y todas las pestañas se abren sin errores", async ({ page }) => {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text() + " @ " + (m.location().url || "")); });
  page.on("response", (r) => { if (r.status() >= 400) errores.push(`${r.status()} ${new URL(r.url()).pathname}`); });

  await page.goto("/");
  await page.getByRole("button", { name: /demo con datos de ejemplo/i }).click();
  // La demo pasa por la misma vista previa que un extracto real.
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  // Las pestañas viven en la barra «Secciones» (arriba en escritorio, abajo en el móvil).
  const secciones = page.getByRole("navigation", { name: "Secciones" }).filter({ visible: true });
  await expect(secciones.getByRole("button", { name: /Activos/ })).toBeVisible();

  for (const t of TABS) {
    await secciones.getByRole("button", { name: new RegExp(t, "i") }).click();
    await page.waitForTimeout(300);
  }
  // Sin desbordamiento horizontal (la página no debe moverse de lado en el móvil).
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(1);
  expect(errores).toEqual([]);
});

test("la página de privacidad existe y enlaza de vuelta a la app", async ({ page }) => {
  const r = await page.goto("/privacidad.html");
  expect(r.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Privacidad" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Volver a la app/ })).toBeVisible();
});
