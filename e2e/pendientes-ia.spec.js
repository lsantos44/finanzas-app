import { test, expect } from "@playwright/test";

test("si los pendientes son transferencias, se explica por qué la IA no los sugiere (sin error)", async ({ page }) => {
  let llamadasIA = 0;
  await page.route("https://ia.example/**", (r) => { llamadasIA++; return r.abort("failed"); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem("finz:movs:v1", JSON.stringify({ v: 1, movs: [
      { id: 1, date: "2026-11-03T12:00:00.000Z", concept: "MERCADONA", pattern: "MERCADONA", amount: -40, category: "Supermercado", confirmed: true },
      { id: 2, date: "2026-11-04T12:00:00.000Z", concept: "TRANSFERENCIA A ANA PEREZ", pattern: "TRANSFERENCIA A ANA PEREZ", amount: -50, category: "Otros", confirmed: false },
    ] }));
    localStorage.setItem("finz:cfg:v1", JSON.stringify({ v: 5, customRules: [], disabledRules: [], assets: [], groups: [], budgets: {}, reducible: [], aiOn: true,
      ai: { provider: "openai_compat", baseUrl: "https://ia.example/v1", model: "m", apiKey: "k" }, aiProfiles: [], aiDetail: false, ruleStats: {}, materialidad: 10, assetMem: {} }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Movimientos por clasificar" }).click();
  await expect(page.getByText(/Queda 1 transferencia u operación sin comercio/)).toBeVisible();
  await expect(page.getByText(/no ha funcionado/)).toHaveCount(0);
  expect(llamadasIA).toBe(0);
});
