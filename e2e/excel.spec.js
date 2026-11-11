import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";

// Un extracto en Excel como los de los bancos: fechas, conceptos, importes con signo y una
// columna D/H. Se genera con la misma librería que usa la app para leerlo.
function excelDePrueba(tipo) {
  const filas = [
    ["Fecha", "Concepto", "Importe", "D/H"],
    ["03/11/2026", "COMPRA TARJ. MERCADONA", "40,10", "D"],
    ["04/11/2026", "NOMINA ACME SL", "2.100,00", "H"],
    ["05/11/2026", "RECIBO IBERDROLA", "55,20", "D"],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Movimientos");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: tipo }));
}

for (const tipo of ["xlsx", "xls"]) {
  test(`importa un extracto .${tipo} con sus signos`, async ({ page }) => {
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles({ name: `extracto.${tipo}`, mimeType: "application/octet-stream", buffer: excelDePrueba(tipo) });
    // La vista previa enseña los importes ya con su signo.
    await expect(page.getByText(/2\.100,00/).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.getByText(/3 movimientos/).first()).toBeVisible();
    expect(errores).toEqual([]);
  });
}

test("importa un «.xls» que en realidad es una tabla HTML (lo que exportan varios bancos)", async ({ page }) => {
  const html = `<html><body><table>
    <tr><td>Fecha</td><td>Concepto</td><td>Importe</td></tr>
    <tr><td>03/11/2026</td><td>COMPRA TARJ. MERCADONA</td><td>-40,10</td></tr>
    <tr><td>04/11/2026</td><td>NOMINA ACME SL</td><td>2.100,00</td></tr>
  </table></body></html>`;
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "extracto.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from(html) });
  await expect(page.getByText(/2\.100,00/).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByText(/2 movimientos/).first()).toBeVisible();
});
