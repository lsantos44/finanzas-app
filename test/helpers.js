import { normalizePattern } from "../src/App.jsx";

let id = 1;
// Movimiento de prueba. `category` lo marca como ya clasificado (historial).
export const mk = (concept, amount, date, category) => ({
  id: id++, concept, amount, date: date instanceof Date ? date : new Date(date + "T12:00:00"),
  pattern: normalizePattern(concept), category, confirmed: !!category,
});
