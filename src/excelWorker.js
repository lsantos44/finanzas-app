// Lectura de Excel fuera de la página. La librería xlsx 0.18.5 (la última publicada en npm)
// tiene fallos conocidos con archivos manipulados (contaminación de prototipos, expresiones
// regulares lentas). Aquí, en un Web Worker, un archivo malicioso solo puede estropear este
// hilo: no tiene acceso al DOM, ni a localStorage (donde están el token y tus datos), ni a la
// app. La página le pasa los bytes y recibe filas de texto; si tarda demasiado, lo mata.
import * as XLSX from "xlsx";

function spreadsheetToRows(buf) {
  // `raw`: en los «.xls» que son HTML, el texto se deja tal cual. Si no, la librería lee
  // «3/1/2026» como 1 de marzo y «1234,5» como 12345; el lector de CSV ya sabe hacerlo bien.
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false, cellNF: true, raw: true });
  // La hoja con más filas: algunos bancos ponen una portada o un resumen delante.
  let best = null, bestN = -1;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws && ws["!ref"];
    if (!ref) continue;
    const r = XLSX.utils.decode_range(ref);
    const n = r.e.r - r.s.r + 1;
    if (n > bestN) { bestN = n; best = ws; }
  }
  if (!best) return [];
  const range = XLSX.utils.decode_range(best["!ref"]);
  const pad = (n) => String(n).padStart(2, "0");
  const rows = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row = [];
    for (let Cc = range.s.c; Cc <= range.e.c; Cc++) {
      const cell = best[XLSX.utils.encode_cell({ r: R, c: Cc })];
      if (!cell || cell.v == null) { row.push(""); continue; }
      if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)) {
        // Las fechas de Excel son un número de días. Se pasan a dd/mm/aaaa: el texto formateado
        // depende del formato del archivo y el 14 por defecto sale como m/d/aa, al revés.
        const d = XLSX.SSF.parse_date_code(cell.v);
        row.push(d ? `${pad(d.d)}/${pad(d.m)}/${d.y}` : String(cell.w || cell.v));
      } else if (cell.t === "d" && cell.v instanceof Date) {
        row.push(`${pad(cell.v.getDate())}/${pad(cell.v.getMonth() + 1)}/${cell.v.getFullYear()}`);
      } else if (cell.t === "n") {
        // Coma decimal: con punto, «1.234» se leería como mil doscientos treinta y cuatro.
        row.push(String(cell.v).replace(".", ","));
      } else {
        row.push(String(cell.v).trim());
      }
    }
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

self.onmessage = (e) => {
  try { self.postMessage({ ok: true, rows: spreadsheetToRows(e.data) }); }
  catch (err) { self.postMessage({ ok: false, error: String((err && err.message) || err) }); }
};
