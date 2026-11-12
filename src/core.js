/* Núcleo de Mis finanzas: toda la lógica que no es interfaz (categorías, reglas, importación,
   cálculos, IA, almacenamiento…). Salió de App.jsx tal cual, en el mismo orden; App.jsx
   importa de aquí. Sin React: se puede probar y reutilizar por separado. */
import { Bot, Car, ClipboardList, LayoutGrid, Sparkles, TrendingUp } from "lucide-react";

/* ============================================================
   TOKENS DE DISEÑO
   Dos temas con las mismas claves. `C` es un proxy que lee el tema activo y
   devuelve SIEMPRE un hex real: recharts pinta los colores como atributos SVG
   (stroke, fill), donde un var(--x) de CSS no se resolvería.
   ============================================================ */
const THEME_KEY = "finz:theme:v1";
// Sello de versión visible (en Ajustes y en el pie): sirve para confirmar de un vistazo
// qué build está desplegado. Se sube a mano en cada despliegue.
const TOKENS = {
  light: {
    bg: "#F3F6FA", surface: "#FFFFFF", surfaceAlt: "#F8FAFC",
    // faint a 4,8:1 sobre blanco (antes 2,6:1, ilegible en los textos pequeños).
    ink: "#0F1B2D", ink2: "#33415C", muted: "#5E6E85", faint: "#64748B",
    line: "#E4EAF2", lineStrong: "#C9D5E3",
    navy: "#0B2545", navy2: "#15406F",
    accent: "#1266C0", accentHover: "#0E54A0", accentSoft: "#E7F0FB",
    teal: "#0FA3A3", tealSoft: "#E2F5F5",
    income: "#0B8457", incomeSoft: "#E4F5EE",
    expense: "#C23E4A", expenseSoft: "#FBEBEC", // 5,1:1 sobre blanco (antes 4,35:1)
    warn: "#9A5B03", warnSoft: "#FDF3E3", // 4,9:1 sobre su fondo (antes 3,85:1)
    extra: "#C08A00", extraSoft: "#FCF4DC",
  },
  dark: {
    bg: "#0D0F13", surface: "#16181D", surfaceAlt: "#1C1F26",
    ink: "#ECEEF2", ink2: "#C3C7D0", muted: "#98A0AE", faint: "#8A93A3",
    line: "#262A33", lineStrong: "#363B46",
    navy: "#0B1524", navy2: "#14263F",
    accent: "#5197EE", accentHover: "#6EA9F2", accentSoft: "#16294A",
    teal: "#2BC0BF", tealSoft: "#10312F",
    income: "#35C08A", incomeSoft: "#102B22",
    expense: "#F0707A", expenseSoft: "#331519",
    warn: "#E0A63C", warnSoft: "#332616",
    extra: "#E8BE4A", extraSoft: "#2E2712",
  },
};
function initialTheme() {
  try {
    const saved = window.localStorage?.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch { return "light"; }
}
let THEME = typeof window !== "undefined" ? initialTheme() : "light";
// Antes del primer pintado: si esperásemos a un efecto, la app parpadearía en claro.
if (typeof document !== "undefined") document.documentElement.dataset.theme = THEME;
const C = new Proxy({}, { get: (_t, k) => TOKENS[THEME][k] });

const GROUP_COLORS = [
  "#4F46E5", "#0891B2", "#D97706", "#DB2777", "#059669", "#7C3AED",
  "#DC2626", "#0D9488", "#CA8A04", "#E11D48",
];

/* ============================================================
   CATEGORÍAS
   ============================================================ */
const CATEGORIES_INGRESO = ["Nómina y pensión", "Alquileres cobrados", "Inversiones", "Devoluciones y ayudas", "Otros ingresos"];
// "Ahorro e inversión": mover dinero a un bróker o a un fondo no es un gasto ni un
// ingreso, es un traspaso. Sin esta categoría acababa contaminando "Traspasos".
const CATEGORIES_TRANSFER = ["Bizum", "Traspasos entre cuentas", "Ahorro e inversión", "Efectivo"];
const CATEGORIES_GASTO = [
  "Supermercado", "Restauración", "Ocio", "Suscripciones", "Combustible",
  "Transporte", "Parking", "Taller y mantenimiento", "Seguros", "Impuestos",
  "Vivienda", "Hipoteca y préstamos", "Suministros", "Telecomunicaciones", "Hogar", "Compras",
  "Salud", "Ropa", "Deporte", "Mascota", "Educación", "Viajes", "Regalos",
  "Donaciones", "Comisiones", "Otros",
];
const CATEGORIES = [...CATEGORIES_GASTO, ...CATEGORIES_INGRESO, ...CATEGORIES_TRANSFER];
const INGRESO_SET = new Set(CATEGORIES_INGRESO);
const TRANSFER_SET = new Set(CATEGORIES_TRANSFER);
// Movimiento interno: dinero que se MUEVE (a tu bróker, a otra cuenta tuya), no que se
// gasta. No es consumo, así que no cuenta como "gasto" ni resta a tu tasa de ahorro.
// (Bizum y Efectivo sí son salidas reales de consumo: se quedan como gasto.)
const INTERNAL_SET = new Set(["Traspasos entre cuentas", "Ahorro e inversión"]);
// Migración desde la taxonomía anterior (v≤4.1): la categoría única "Ingresos" se reparte
const migrateCat = (c) => (c === "Ingresos" ? "Otros ingresos" : c === "Gastos financieros" ? "Comisiones" : c);
const DEFAULT_REDUCIBLE = ["Ocio", "Restauración", "Suscripciones", "Compras", "Ropa"];
const ALL_TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutGrid },
  { id: "analisis", label: "Análisis", icon: TrendingUp },
  { id: "clasificar", label: "Clasificación", short: "Clasif.", icon: ClipboardList },
  { id: "activos", label: "Activos", icon: Car },
  { id: "ideas", label: "Ideas", icon: Sparkles },
  { id: "asistente", label: "Asistente", icon: Bot },
];
const ASSET_EMOJI = { Coche: "🚗", Casa: "🏠", Mascota: "🐾", "Segunda residencia": "🏖️" };
const EMOJI_CHOICES = ["🚗", "🏠", "🏖️", "🐾", "💻", "🛵", "🚲", "⛵", "📦", "🎸", "🏍️", "🚐", "📈", "🏢"];
/* Tipo de activo, para seleccionar de golpe «todos los vehículos» o «todos los inmuebles» y
   ver su subtotal. Se puede fijar al editar el activo; si no, se deduce del uso, el icono y el
   nombre. */
const TIPOS_ACTIVO = [
  { v: "inmueble", l: "🏠 Inmuebles" }, { v: "vehiculo", l: "🚗 Vehículos" },
  { v: "inversion", l: "📈 Inversiones" }, { v: "mascota", l: "🐾 Mascotas" }, { v: "otro", l: "📦 Otros" },
];
function tipoActivo(a) {
  if (a?.tipo) return a.tipo;
  const n = stripAccents(String(a?.name || "").toLowerCase());
  if (["alquiler", "vivienda", "segunda"].includes(a?.uso) || ["🏠", "🏖️", "🏢"].includes(a?.emoji) || /\b(casa|piso|apartamento|local|garaje|plaza|chalet|vivienda|finca|calle|avda)\b/.test(n)) return "inmueble";
  if (["🚗", "🛵", "🚲", "⛵", "🏍️", "🚐"].includes(a?.emoji) || /\b(coche|moto|furgo\w*|bici\w*|barco|vehiculo|auto)\b/.test(n)) return "vehiculo";
  if (a?.emoji === "📈" || /\b(fondo|fondos|acciones|cartera|broker|myinvestor|indexa|inversion\w*|etf|plan de pensiones)\b/.test(n)) return "inversion";
  if (a?.emoji === "🐾" || /\b(perro|gato|mascota)\b/.test(n)) return "mascota";
  return "otro";
}
const GROUP_EMOJI = ["🏃", "✈️", "🎉", "🎄", "💍", "🍼", "🏖️", "🎓", "🏡", "🎮", "📸", "🎁", "⚽", "🚴", "🏔️", "🛠️"];

/* ============================================================
   MACRO-CATEGORÍAS (nivel superior del desglose jerárquico)
   ============================================================ */
const MACROS = [
  { name: "Hogar", emoji: "🏠", kind: "gasto", cats: ["Vivienda", "Hipoteca y préstamos", "Suministros", "Hogar", "Telecomunicaciones"] },
  { name: "Alimentación", emoji: "🛒", kind: "gasto", cats: ["Supermercado", "Restauración"] },
  { name: "Movilidad", emoji: "🚗", kind: "gasto", cats: ["Combustible", "Transporte", "Parking", "Taller y mantenimiento"] },
  { name: "Compras y ocio", emoji: "🛍️", kind: "gasto", cats: ["Ocio", "Suscripciones", "Compras", "Ropa", "Regalos", "Viajes"] },
  { name: "Personal y familia", emoji: "❤️", kind: "gasto", cats: ["Salud", "Deporte", "Mascota", "Educación", "Donaciones"] },
  { name: "Finanzas e impuestos", emoji: "🏦", kind: "gasto", cats: ["Seguros", "Impuestos", "Comisiones"] },
  { name: "Otros", emoji: "📦", kind: "gasto", cats: ["Otros"] },
  { name: "Ingresos", emoji: "💰", kind: "ingreso", cats: CATEGORIES_INGRESO },
  { name: "Transferencias", emoji: "🔁", kind: "transfer", cats: CATEGORIES_TRANSFER },
];
const MACRO_OF = Object.fromEntries(MACROS.flatMap((m) => m.cats.map((c) => [c, m.name])));
const MACRO_EMOJI = Object.fromEntries(MACROS.map((m) => [m.name, m.emoji]));
const macroOf = (cat) => MACRO_OF[cat] || "Otros";

/* ============================================================
   COLOR DE CATEGORÍAS (jerárquico)
   El TONO identifica la supra-categoría; la LUMINOSIDAD solo separa vecinas
   dentro de ella (no codifica orden: las categorías son nominales). La identidad
   nunca depende del color solo: leyenda, etiquetas del donut y desglose
   jerárquico son el canal de relieve que exige el contraste sub-3:1.

   Los siete tonos, en orden fijo, están validados para daltonismo: peor par
   adyacente ΔE 13.3 en claro y 23.6 en oscuro, ambos sobre el objetivo de 12.
   ============================================================ */
const MACRO_SLOTS = ["Hogar", "Alimentación", "Movilidad", "Compras y ocio", "Personal y familia", "Finanzas e impuestos", "Ingresos"];
const MACRO_HUES = {
  light: ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e87ba4", "#e34948", "#008300"],
  dark: ["#3987e5", "#199e70", "#c98500", "#9085e9", "#d55181", "#e66767", "#008300"],
};
const NEUTRAL_CAT = { light: "#A1A1AA", dark: "#7A8090" };     // "Otros"
const NEUTRAL_TRANSFER = { light: "#94A3B8", dark: "#64748B" }; // por defecto para transferencias
// Cada transferencia con su color, para que no se confundan entre sí (Bizum gris, pero
// Traspasos entre cuentas y Ahorro e inversión con color propio, distintos del gris).
const TRANSFER_COLORS = {
  light: { "Traspasos entre cuentas": "#06b6d4", "Ahorro e inversión": "#8b5cf6", "Bizum": "#94A3B8", "Efectivo": "#a8a29e" },
  dark: { "Traspasos entre cuentas": "#22d3ee", "Ahorro e inversión": "#a78bfa", "Bizum": "#64748B", "Efectivo": "#8b8681" },
};
const L_BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };

/* --- Conversión sRGB ↔ OKLCH (para escalonar la luminosidad sin torcer el tono) --- */
const _srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const _linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const _clamp01 = (v) => Math.min(1, Math.max(0, v));
function hexToOklch(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => _srgbToLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function oklchToHex(L, Ch, H) {
  const A = Ch * Math.cos(H), B = Ch * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => Math.round(_clamp01(_linToSrgb(v)) * 255));
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// Rampa de n pasos alrededor de la L del tono base, siempre dentro de la banda del modo.
// Además de la luminosidad, escalona ligeramente el TONO (±~10°) y el croma: dos
// categorías de la misma familia (varios "azules" de Hogar) se distinguían solo por
// brillo y en la tarta parecían el mismo color. Con la dispersión de tono/croma se leen
// como la familia pero ya no se confunden. No toca los 7 tonos macro (macroColor).
function rampFor(baseHex, n, band) {
  const [L0, Ch, H] = hexToOklch(baseHex);
  if (n <= 1) return [baseHex];
  const [lo, hi] = band;
  const step = Math.min(0.06, (hi - lo) / (n - 1));
  const span = (n - 1) * step;
  const start = Math.min(Math.max(L0 - span / 2, lo), hi - span);
  const hueSpan = 0.36; // rad totales (~21°) repartidos entre las hermanas, sin invadir la familia vecina
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);          // 0..1
    const H2 = H + (t - 0.5) * hueSpan;
    const Ch2 = Ch * (1 + 0.14 * t); // sin desaturar; algo más de croma al aclarar
    return oklchToHex(start + i * step, Ch2, H2);
  });
}
function buildCatColors(mode) {
  const map = {};
  MACRO_SLOTS.forEach((macroName, slot) => {
    const cats = MACROS.find((m) => m.name === macroName).cats;
    rampFor(MACRO_HUES[mode][slot], cats.length, L_BAND[mode]).forEach((hex, i) => { map[cats[i]] = hex; });
  });
  map["Otros"] = NEUTRAL_CAT[mode];
  for (const c of CATEGORIES_TRANSFER) map[c] = TRANSFER_COLORS[mode][c] || NEUTRAL_TRANSFER[mode];
  return map;
}
const CAT_COLORS = { light: buildCatColors("light"), dark: buildCatColors("dark") };
const catColor = (cat) => CAT_COLORS[THEME][cat] || NEUTRAL_CAT[THEME];
const macroColor = (macro) => {
  const slot = MACRO_SLOTS.indexOf(macro);
  return slot >= 0 ? MACRO_HUES[THEME][slot] : NEUTRAL_CAT[THEME];
};

/* Rampa de intensidad de UN tono, para el drill del donut: el más importante (índice 0)
   sale con el color pleno y los siguientes se van aclarando y desaturando. Así las
   porciones de una misma categoría se distinguen entre sí en vez de verse todas iguales. */
function shadeRamp(baseHex, n) {
  if (n <= 1) return [baseHex];
  const [L, Ch, H] = hexToOklch(baseHex);
  const topL = Math.min(0.88, L);
  const botL = Math.min(0.93, L + 0.34);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return oklchToHex(topL + (botL - topL) * t, Ch * (1 - 0.45 * t), H);
  });
}

/* ============================================================
   MOTOR DE REGLAS
   Una regla es un texto que debe aparecer en el concepto, más condiciones
   opcionales sobre el movimiento concreto:

     k        texto que debe contener el patrón
     cat      categoría resultante          asset   activo sugerido
     prio     0-100, explícita              sign    "+" | "-" (signo del importe)
     min/max  rango del importe ABSOLUTO    dayMin/dayMax  rango de día del mes
     confirm  clasifica pero exige revisión (crea un pendiente a propósito)
     active   baja lógica (no se borra, se apaga)
     scope    "base" (de fábrica) | "personal" (aprendida)

   Por qué las condiciones importan: el mismo texto puede significar cosas
   distintas según el importe y el día. Un "BIZUM RECIBIDO" de 300 € los días
   1–4 puede ser el reparto de gastos de casa, y el mismo importe a partir del
   día 5 el alquiler de un piso. Sin importe y día, ninguna regla puede
   distinguirlos y ambos acaban en un cajón de sastre.

   La PRIORIDAD sustituye al orden del array (frágil y no auditable). A igualdad
   de prioridad gana la que aparece antes, así que el orden dentro de cada tramo
   se sigue respetando y las reglas aprendidas —que se anteponen— siguen ganando.
   ============================================================ */
const PRIO = {
  personal: 95,   // lo que tú corriges a mano manda sobre todo
  conditional: 80, // reglas con importe/día: más informadas que un simple texto
  defensive: 85,  // "no lo sé: pregúntame" — por encima de cualquier adivinanza
  bizum: 65,      // el cajón Bizum gana a los comercios, pero no a las condicionales
  merchant: 60,   // nombre de comercio concreto
  safety: 40,     // tokens cortos y comercios modernos
  generic: 30,    // palabras del propio concepto (LUZ, ALIMENTACION…)
};

/* Activo «tu vivienda»: un papel, no un nombre. Las reglas de fábrica de luz, agua, comunidad,
   IBI o hipoteca lo usan y, al clasificar, se convierte en el activo de vivienda de cada
   persona (ver viviendaPorDefecto). Antes llevaban el nombre de un piso concreto. */
const VIVIENDA = "@vivienda";
/* Regla simple de texto. `prio` por defecto: comercio concreto. */
const R = (k, cat, asset, prio = PRIO.merchant) => ({ k, cat, asset, prio, scope: "base" });
/* Regla condicional: además del texto, exige signo / importe / día del mes. */
const RC = (k, cat, opts = {}) => ({ k, cat, prio: PRIO.conditional, scope: "base", ...opts });

/* Identidad estable de una regla, para apagarla o llevarle la cuenta sin depender
   de su posición en el array (que cambia cada vez que añadimos reglas de fábrica). */
const ruleId = (r) =>
  r.id || `${r.k}|${r.cat}|${r.sign ?? ""}|${r.min ?? ""}|${r.max ?? ""}|${r.dayMin ?? ""}|${r.dayMax ?? ""}`;
const isConditional = (r) => r.sign != null || r.min != null || r.max != null || r.dayMin != null || r.dayMax != null;

const MERCHANT_RULES = [
  // — Combustible (antes que "transporte" genérico)
  R("REPSOL", "Combustible", "Coche"), R("CEPSA", "Combustible", "Coche"),
  R("GALP", "Combustible", "Coche"), R("BALLENOIL", "Combustible", "Coche"),
  R("PETROPRIX", "Combustible", "Coche"), R("PLENOIL", "Combustible", "Coche"),
  R("PETRONOR", "Combustible", "Coche"), R("SHELL", "Combustible", "Coche"),
  R("AVIA ", "Combustible", "Coche"), R("DISA", "Combustible", "Coche"),
  R("GASOLINERA", "Combustible", "Coche"), R("ESTACION DE SERVICIO", "Combustible", "Coche"),
  R("ESTACION SERVICIO", "Combustible", "Coche"), R("CARBURANTE", "Combustible", "Coche"),
  R("E S ", "Combustible", "Coche"),
  // — Coche: parking, taller, seguro, impuesto
  R("EMPARK", "Parking", "Coche"), R("INTERPARKING", "Parking", "Coche"),
  R("PARKIA", "Parking", "Coche"), R("APARCAMIENTO", "Parking", "Coche"),
  R("PARKING", "Parking", "Coche"), R("ZONA AZUL", "Parking", "Coche"),
  R("ZONA SER", "Parking", "Coche"), R("ESTACIONAMIENTO", "Parking", "Coche"),
  R("NORAUTO", "Taller y mantenimiento", "Coche"), R("MIDAS", "Taller y mantenimiento", "Coche"),
  R("FEU VERT", "Taller y mantenimiento", "Coche"), R("EUROMASTER", "Taller y mantenimiento", "Coche"),
  R("CONFORTAUTO", "Taller y mantenimiento", "Coche"), R("AURGI", "Taller y mantenimiento", "Coche"),
  R("NEUMATIC", "Taller y mantenimiento", "Coche"), R("TALLER", "Taller y mantenimiento", "Coche"),
  R("RECAMBIOS", "Taller y mantenimiento", "Coche"), R("ITV", "Taller y mantenimiento", "Coche"),
  R("SEGURO AUTO", "Seguros", "Coche"), R("SEGURO COCHE", "Seguros", "Coche"),
  R("SEGURO AUTOMOVIL", "Seguros", "Coche"), R("LINEA DIRECTA", "Seguros", "Coche"),
  R("VERTI", "Seguros", "Coche"), R("DIRECT SEGUROS", "Seguros", "Coche"),
  R("IVTM", "Impuestos", "Coche"), R("IMPUESTO VEHICULOS", "Impuestos", "Coche"),
  R("IMPUESTO CIRCULACION", "Impuestos", "Coche"), R("DGT", "Impuestos", "Coche"),
  R("PEAJE", "Transporte"), R("AUTOPISTA", "Transporte"), R("AUSOL", "Transporte"),
  // — Vivienda / casa
  // La cuota de la hipoteca, aparte: lleva capital, que no es gasto deducible en la renta.
  R("HIPOTECA", "Hipoteca y préstamos", VIVIENDA), R("PRESTAMO HIPOTECARIO", "Hipoteca y préstamos", VIVIENDA),
  R("CUOTA HIPOTECA", "Hipoteca y préstamos", VIVIENDA), R("ALQUILER", "Vivienda", VIVIENDA),
  R("COMUNIDAD PROPIETARIOS", "Vivienda", VIVIENDA), R("COMUNIDAD DE PROP", "Vivienda", VIVIENDA),
  R("ADMINISTRADOR FINCAS", "Vivienda", VIVIENDA), R("COMUNIDAD", "Vivienda", VIVIENDA),
  R("IBI", "Impuestos", VIVIENDA), R("SEGURO HOGAR", "Seguros", VIVIENDA), R("OCASO", "Seguros", VIVIENDA),
  // — Suministros
  R("IBERDROLA", "Suministros", VIVIENDA), R("ENDESA", "Suministros", VIVIENDA),
  R("NATURGY", "Suministros", VIVIENDA), R("HOLALUZ", "Suministros", VIVIENDA),
  R("TOTALENERGIES", "Suministros", VIVIENDA), R("TOTAL ENERGIES", "Suministros", VIVIENDA),
  R("OCTOPUS ENERGY", "Suministros", VIVIENDA), R("PLENITUDE", "Suministros", VIVIENDA),
  R("PEPEENERGY", "Suministros", VIVIENDA), R("REPSOL LUZ", "Suministros", VIVIENDA),
  R("CANAL DE ISABEL", "Suministros", VIVIENDA), R("CANAL ISABEL", "Suministros", VIVIENDA),
  R("AGUAS DE", "Suministros", VIVIENDA), R("EMASESA", "Suministros", VIVIENDA),
  R("AQUALIA", "Suministros", VIVIENDA), R("HIDRALIA", "Suministros", VIVIENDA),
  R("EMIVASA", "Suministros", VIVIENDA), R("AQUASERVICE", "Suministros", VIVIENDA),
  R("GAS NATURAL", "Suministros", VIVIENDA),
  // — Telecomunicaciones
  R("MOVISTAR", "Telecomunicaciones"), R("VODAFONE", "Telecomunicaciones"),
  R("ORANGE", "Telecomunicaciones"), R("YOIGO", "Telecomunicaciones"),
  R("DIGI ", "Telecomunicaciones"), R("MASMOVIL", "Telecomunicaciones"),
  R("PEPEPHONE", "Telecomunicaciones"), R("LOWI", "Telecomunicaciones"),
  R("JAZZTEL", "Telecomunicaciones"), R("FINETWORK", "Telecomunicaciones"),
  R("SIMYO", "Telecomunicaciones"), R("O2 FIBRA", "Telecomunicaciones"),
  R("ADAMO", "Telecomunicaciones"), R("AVATEL", "Telecomunicaciones"),
  // — Suscripciones / streaming / software
  R("NETFLIX", "Suscripciones"), R("SPOTIFY", "Suscripciones"), R("HBO", "Suscripciones"),
  R("DISNEY", "Suscripciones"), R("DISNEY PLUS", "Suscripciones"), R("PRIME VIDEO", "Suscripciones"),
  R("AMAZON PRIME", "Suscripciones"), R("YOUTUBE PREMIUM", "Suscripciones"),
  R("ICLOUD", "Suscripciones"), R("APPLE.COM/BILL", "Suscripciones"), R("APPLE COM BILL", "Suscripciones"),
  R("GOOGLE STORAGE", "Suscripciones"), R("GOOGLE ONE", "Suscripciones"),
  R("DROPBOX", "Suscripciones"), R("MICROSOFT 365", "Suscripciones"), R("MICROSOFT", "Suscripciones"),
  R("DAZN", "Suscripciones"), R("FILMIN", "Suscripciones"), R("CRUNCHYROLL", "Suscripciones"),
  R("AUDIBLE", "Suscripciones"), R("TWITCH", "Suscripciones"), R("PATREON", "Suscripciones"),
  R("CANVA", "Suscripciones"), R("CHATGPT", "Suscripciones"), R("OPENAI", "Suscripciones"),
  R("ADOBE", "Suscripciones"), R("DUOLINGO", "Suscripciones"), R("MOVISTAR PLUS", "Suscripciones"),
  // — Supermercado
  R("MERCADONA", "Supermercado"), R("CARREFOUR", "Supermercado"), R("LIDL", "Supermercado"),
  R("ALCAMPO", "Supermercado"), R("EROSKI", "Supermercado"), R("ALDI", "Supermercado"),
  R("CONSUM", "Supermercado"), R("DIA ", "Supermercado"), R("SUPERCOR", "Supermercado"),
  R("HIPERCOR", "Supermercado"), R("AHORRAMAS", "Supermercado"), R("MASYMAS", "Supermercado"),
  R("BONAREA", "Supermercado"), R("BONPREU", "Supermercado"), R("CAPRABO", "Supermercado"),
  R("CONDIS", "Supermercado"), R("GADIS", "Supermercado"), R("FROIZ", "Supermercado"),
  R("COVIRAN", "Supermercado"), R("SUPERSOL", "Supermercado"), R("VERITAS", "Supermercado"),
  R("SIMPLY", "Supermercado"), R("SPAR ", "Supermercado"), R("SUPERMERCADO", "Supermercado"),
  R("PANADERIA", "Supermercado"), R("FRUTERIA", "Supermercado"), R("CARNICERIA", "Supermercado"),
  R("PESCADERIA", "Supermercado"), R("CHARCUTERIA", "Supermercado"),
  // — Restauración
  R("MCDONALD", "Restauración"), R("BURGER KING", "Restauración"), R("KFC", "Restauración"),
  R("TELEPIZZA", "Restauración"), R("DOMINO", "Restauración"), R("GOIKO", "Restauración"),
  R("TAGLIATELLA", "Restauración"), R("GINOS", "Restauración"), R("FOSTER", "Restauración"),
  R("VIPS", "Restauración"), R("RODILLA", "Restauración"), R("PANS", "Restauración"),
  R("LIZARRAN", "Restauración"), R("SUREÑA", "Restauración"), R("100 MONTADITOS", "Restauración"),
  R("CIEN MONTADITOS", "Restauración"), R("STARBUCKS", "Restauración"), R("DUNKIN", "Restauración"),
  R("COSTA COFFEE", "Restauración"), R("GLOVO", "Restauración"), R("JUST EAT", "Restauración"),
  R("UBER EATS", "Restauración"), R("DELIVEROO", "Restauración"), R("RESTAURANTE", "Restauración"),
  R("CAFETERIA", "Restauración"), R("CERVECERIA", "Restauración"), R("TABERNA", "Restauración"),
  R("ASADOR", "Restauración"), R("PIZZERIA", "Restauración"), R("HAMBURGUES", "Restauración"),
  R("KEBAB", "Restauración"), R("BAR ", "Restauración"), R("MESON", "Restauración"),
  // — Ocio
  R("CINESA", "Ocio"), R("YELMO", "Ocio"), R("KINEPOLIS", "Ocio"), R("OCINE", "Ocio"),
  R("CINE ", "Ocio"), R("TEATRO", "Ocio"), R("TICKETMASTER", "Ocio"), R("ENTRADAS", "Ocio"),
  R("STEAM", "Ocio"), R("STEAMGAMES", "Ocio"), R("PLAYSTATION", "Ocio"), R("NINTENDO", "Ocio"),
  R("XBOX", "Ocio"), R("EPIC GAMES", "Ocio"), R("PORTAVENTURA", "Ocio"), R("MUSEO", "Ocio"),
  R("CONCIERTO", "Ocio"), R("DISCOTECA", "Ocio"), R("BOLERA", "Ocio"),
  // — Transporte
  R("RENFE", "Transporte"), R("OUIGO", "Transporte"), R("IRYO", "Transporte"), R("AVLO", "Transporte"),
  R("METRO DE", "Transporte"), R("EMT ", "Transporte"), R("TMB ", "Transporte"),
  R("CERCANIAS", "Transporte"), R("ALSA", "Transporte"), R("AVANZA", "Transporte"),
  R("CABIFY", "Transporte"), R("UBER", "Transporte"), R("BOLT", "Transporte"),
  R("FREE NOW", "Transporte"), R("FREENOW", "Transporte"), R("BLABLACAR", "Transporte"),
  R("BICIMAD", "Transporte"), R("TAXI", "Transporte"),
  // — Seguros (genéricos, tras los de coche/hogar)
  R("MAPFRE", "Seguros"), R("MUTUA MADRILE", "Seguros"), R("AXA", "Seguros"),
  R("ALLIANZ", "Seguros"), R("ZURICH", "Seguros"), R("GENERALI", "Seguros"),
  R("REALE", "Seguros"), R("PELAYO", "Seguros"), R("CATALANA OCC", "Seguros"),
  R("CASER", "Seguros"), R("ADESLAS", "Seguros"), R("SANITAS", "Seguros"),
  R("DKV", "Seguros"), R("ASISA", "Seguros"), R("SANTALUCIA", "Seguros"),
  R("SEGURO", "Seguros"), R("POLIZA", "Seguros"),
  // — Impuestos / administración
  R("AEAT", "Impuestos"), R("AGENCIA TRIBUTARIA", "Impuestos"), R("HACIENDA", "Impuestos"),
  R("AYUNTAMIENTO", "Impuestos"), R("DIPUTACION", "Impuestos"), R("TRIBUTOS", "Impuestos"),
  R("RECAUDACION", "Impuestos"), R("TASA", "Impuestos"), R("IMPUESTO", "Impuestos"),
  R("MULTA", "Impuestos"), R("SANCION", "Impuestos"), R("SUMA GESTION", "Impuestos"),
  R("SEGURIDAD SOCIAL", "Impuestos"), R("TGSS", "Impuestos"),
  // — Hogar / bricolaje / electrónica
  R("LEROY MERLIN", "Hogar"), R("LEROY", "Hogar"), R("IKEA", "Hogar"), R("BRICOMART", "Hogar"),
  R("BRICODEPOT", "Hogar"), R("BRICO DEPOT", "Hogar"), R("CONFORAMA", "Hogar"),
  R("MAISONS DU MONDE", "Hogar"), R("BAUHAUS", "Hogar"), R("FERRETERIA", "Hogar"),
  R("MEDIA MARKT", "Hogar"), R("MEDIAMARKT", "Hogar"), R("WORTEN", "Hogar"), R("MENAJE", "Hogar"),
  // — Compras / marketplaces
  R("AMAZON", "Compras"), R("ALIEXPRESS", "Compras"), R("EL CORTE INGLES", "Compras"),
  R("CORTE INGLES", "Compras"), R("PCCOMPONENTES", "Compras"), R("FNAC", "Compras"),
  R("EBAY", "Compras"), R("SHEIN", "Compras"), R("TEMU", "Compras"), R("WALLAPOP", "Compras"),
  R("ZALANDO", "Compras"), R("PRIVALIA", "Compras"), R("VEEPEE", "Compras"), R("ETSY", "Compras"),
  // — Salud
  R("FARMACIA", "Salud"), R("PARAFARMACIA", "Salud"), R("CLINICA", "Salud"), R("DENTISTA", "Salud"),
  R("DENTAL", "Salud"), R("OPTICA", "Salud"), R("HOSPITAL", "Salud"), R("FISIOTERAPIA", "Salud"),
  R("QUIRONSALUD", "Salud"), R("QUIRON", "Salud"), R("VITHAS", "Salud"), R("PODOLOG", "Salud"),
  R("PSICOLOG", "Salud"), R("LABORATORIO", "Salud"), R("MEDICO", "Salud"),
  // — Ropa
  R("ZARA", "Ropa"), R("PULL&BEAR", "Ropa"), R("PULL AND BEAR", "Ropa"), R("BERSHKA", "Ropa"),
  R("STRADIVARIUS", "Ropa"), R("MASSIMO DUTTI", "Ropa"), R("LEFTIES", "Ropa"), R("OYSHO", "Ropa"),
  R("PRIMARK", "Ropa"), R("MANGO", "Ropa"), R("SPRINGFIELD", "Ropa"), R("CORTEFIEL", "Ropa"),
  R("WOMEN SECRET", "Ropa"), R("CALZEDONIA", "Ropa"), R("INTIMISSIMI", "Ropa"), R("TEZENIS", "Ropa"),
  R("KIABI", "Ropa"), R("UNIQLO", "Ropa"), R("PEPE JEANS", "Ropa"), R("DESIGUAL", "Ropa"),
  R("LEVIS", "Ropa"), R("H&M", "Ropa"), R("H M ", "Ropa"),
  // — Deporte
  R("DECATHLON", "Deporte"), R("BASIC-FIT", "Deporte"), R("BASIC FIT", "Deporte"), R("MCFIT", "Deporte"),
  R("ALTAFIT", "Deporte"), R("VIVAGYM", "Deporte"), R("SYNERGYM", "Deporte"), R("FITNESS PARK", "Deporte"),
  R("FORUS", "Deporte"), R("SPRINTER", "Deporte"), R("JD SPORTS", "Deporte"), R("FOOT LOCKER", "Deporte"),
  R("INTERSPORT", "Deporte"), R("FORUM SPORT", "Deporte"), R("GIMNASIO", "Deporte"),
  R("CROSSFIT", "Deporte"), R("PADEL", "Deporte"), R("RUNNING", "Deporte"), R("STRAVA", "Deporte"),
  // — Donaciones (ONGs, fundaciones, causas)
  R("CRUZ ROJA", "Donaciones"), R("UNICEF", "Donaciones"), R("MEDICOS SIN FRONTERAS", "Donaciones"),
  R("MSF", "Donaciones"), R("ACNUR", "Donaciones"), R("CARITAS", "Donaciones"), R("MANOS UNIDAS", "Donaciones"),
  R("OXFAM", "Donaciones"), R("INTERMON", "Donaciones"), R("GREENPEACE", "Donaciones"), R("WWF", "Donaciones"),
  R("AMNISTIA", "Donaciones"), R("SAVE THE CHILDREN", "Donaciones"), R("AYUDA EN ACCION", "Donaciones"),
  R("FUNDACION", "Donaciones"), R("DONACION", "Donaciones"), R("DONATIVO", "Donaciones"), R("ONG", "Donaciones"),
  // — Mascota
  R("VETERINAR", "Mascota", "Mascota"), R("KIWOKO", "Mascota", "Mascota"),
  R("TIENDANIMAL", "Mascota", "Mascota"), R("KIVET", "Mascota", "Mascota"),
  R("ZOOPLUS", "Mascota", "Mascota"), R("PIENSO", "Mascota", "Mascota"),
  // — Educación
  R("UNIVERSIDAD", "Educación"), R("COLEGIO", "Educación"), R("ACADEMIA", "Educación"),
  R("UDEMY", "Educación"), R("COURSERA", "Educación"), R("DOMESTIKA", "Educación"),
  R("MATRICULA", "Educación"), R("LIBRERIA", "Educación"), R("AUTOESCUELA", "Educación"),
  R("GUARDERIA", "Educación"), R("INSTITUTO", "Educación"),
  // — Viajes
  R("VUELING", "Viajes"), R("RYANAIR", "Viajes"), R("IBERIA", "Viajes"), R("AIR EUROPA", "Viajes"),
  R("AIREUROPA", "Viajes"), R("EASYJET", "Viajes"), R("LUFTHANSA", "Viajes"), R("BOOKING", "Viajes"),
  R("AIRBNB", "Viajes"), R("HOTEL", "Viajes"), R("HOSTAL", "Viajes"), R("EXPEDIA", "Viajes"),
  R("EDREAMS", "Viajes"), R("LOGITRAVEL", "Viajes"), R("CIVITATIS", "Viajes"),
  R("GETYOURGUIDE", "Viajes"), R("PARADOR", "Viajes"), R("CAMPING", "Viajes"), R("RESORT", "Viajes"),
  // — Regalos
  R("JUGUETTOS", "Regalos"), R("TOYS R US", "Regalos"), R("FLORISTERIA", "Regalos"),
  R("JOYERIA", "Regalos"), R("TOUS", "Regalos"), R("PANDORA", "Regalos"),
  // — Comisiones
  R("COMISION", "Comisiones"), R("MANTENIMIENTO CUENTA", "Comisiones"), R("CUOTA TARJETA", "Comisiones"),
  R("INTERESES", "Comisiones"), R("DESCUBIERTO", "Comisiones"),
  // — Efectivo
  R("CAJERO", "Efectivo"), R("REINTEGRO", "Efectivo"), R("RETIRADA EFECTIVO", "Efectivo"),
  R("DISPOSICION EFECTIVO", "Efectivo"),
  // — Ingresos
  R("NOMINA", "Nómina y pensión"), R("NÓMINA", "Nómina y pensión"), R("PENSION", "Nómina y pensión"),
  R("PRESTACION", "Nómina y pensión"), R("FINIQUITO", "Nómina y pensión"), R("DIVIDENDO", "Inversiones"),
  R("INTERESES", "Inversiones"), R("CUPON", "Inversiones"), R("VENTA VALORES", "Inversiones"),
  R("DEVOLUCION", "Devoluciones y ayudas"), R("REEMBOLSO", "Devoluciones y ayudas"),
  R("SUBVENCION", "Devoluciones y ayudas"), R("AYUDA", "Devoluciones y ayudas"),
  R("TRASPASO A", "Traspasos entre cuentas"), R("TRASPASO DE", "Traspasos entre cuentas"),
  R("TRASPASO ENTRE", "Traspasos entre cuentas"), R("CUENTA PROPIA", "Traspasos entre cuentas"),
  R("AHORRO PROGRAMADO", "Traspasos entre cuentas"),
  // — Ahorro e inversión: mover dinero al bróker no es gasto ni ingreso
  R("FONDOS", "Ahorro e inversión"),
  R("MYINVESTOR", "Ahorro e inversión"), R("INDEXA CAPITAL", "Ahorro e inversión"),
  R("TRADE REPUBLIC", "Ahorro e inversión"), R("TRADEREPUBLIC", "Ahorro e inversión"),
  R("DEGIRO", "Ahorro e inversión"), R("INTERACTIVE BROKERS", "Ahorro e inversión"),
  R("RENTA 4", "Ahorro e inversión"), R("SCALABLE", "Ahorro e inversión"),
  R("FINIZENS", "Ahorro e inversión"), R("APORTACION FONDO", "Ahorro e inversión"),
  R("PLAN DE PENSIONES", "Ahorro e inversión"),
  // — Telecomunicaciones que faltaban
  R("O2 ", "Telecomunicaciones"),
];

/* Red de seguridad: tokens cortos y comercios modernos. Solo capturan lo que ninguna
   regla específica ha resuelto, de ahí su prioridad baja. */
const SAFETY_RULES = [
  R("BP", "Combustible"), R("Q8", "Combustible"), R("PETRONOR", "Combustible"),
  R("DIGI", "Telecomunicaciones"), R("FINETWORK", "Telecomunicaciones"), R("PEPEPHONE", "Telecomunicaciones"),
  R("METRO", "Transporte"), R("FGC", "Transporte"), R("EUSKOTREN", "Transporte"), R("CERCANIAS", "Transporte"),
  R("MUTUA", "Seguros"), R("CASER", "Seguros"), R("REALE", "Seguros"), R("PELAYO", "Seguros"),
  R("MARATON", "Deporte"), R("MARATHON", "Deporte"), R("SPORTMANIACS", "Deporte"), R("ROCKTHESPORT", "Deporte"),
  R("RUNNING", "Deporte"), R("TRIATLON", "Deporte"), R("DORSAL", "Deporte"), R("CARRERA POPULAR", "Deporte"),
  R("WALLAPOP", "Compras"), R("VINTED", "Ropa"), R("MILANUNCIOS", "Compras"),
  R("OPENAI", "Suscripciones"), R("CHATGPT", "Suscripciones"), R("ANTHROPIC", "Suscripciones"), R("CLAUDE AI", "Suscripciones"),
];

/* Palabras genéricas del propio concepto (última prioridad: solo si ningún comercio
   concreto ha coincidido). Cubren extractos que describen el gasto en vez de nombrar
   al comercio: "RECIBO ALIMENTACION", "FACTURA LUZ", "PAGO COMBUSTIBLE"… */
const GENERIC_WORD_RULES = [
  R("ALIMENTACION", "Supermercado"), R("COMESTIBLES", "Supermercado"),
  R("ELECTRICIDAD", "Suministros", VIVIENDA), R("ENERGIA", "Suministros", VIVIENDA),
  R("LUZ", "Suministros", VIVIENDA), R("AGUA", "Suministros", VIVIENDA), R("GAS", "Suministros", VIVIENDA),
  R("BASURA", "Suministros", VIVIENDA), R("ALCANTARILLADO", "Suministros", VIVIENDA),
  R("TELEFONIA", "Telecomunicaciones"), R("TELEFONO", "Telecomunicaciones"),
  R("INTERNET", "Telecomunicaciones"), R("FIBRA", "Telecomunicaciones"),
  R("COMBUSTIBLE", "Combustible", "Coche"), R("GASOLINA", "Combustible", "Coche"), R("GASOLEO", "Combustible", "Coche"),
  R("SUSCRIPCION", "Suscripciones"), R("CUOTA MENSUAL", "Suscripciones"),
  R("RESTAURACION", "Restauración"), R("COMIDA", "Restauración"), R("CENA", "Restauración"),
  R("TRANSPORTE", "Transporte"), R("BILLETE", "Transporte"),
  R("EDUCACION", "Educación"), R("FORMACION", "Educación"),
  R("SANIDAD", "Salud"), R("SALUD", "Salud"),
  R("MASCOTA", "Mascota", "Mascota"), R("VIAJE", "Viajes"), R("REGALO", "Regalos"),
  R("ROPA", "Ropa"), R("CALZADO", "Ropa"), R("OCIO", "Ocio"), R("DEPORTE", "Deporte"),
].map((r) => ({ ...r, prio: PRIO.generic }));

/* ------------------------------------------------------------
   REGLAS CONDICIONALES DE FÁBRICA
   El tope de importe es el que hace la regla fiable: un cargo de "ASADOR" de
   3.000 € no es una comida, y clasificarlo como Restauración estropea la media
   del mes entero. Fuera del rango la regla simplemente no se aplica y el
   movimiento sigue su camino hacia otras reglas o hacia pendientes.
   ------------------------------------------------------------ */
const EAT_CAPS = [
  ["RESTAURANTE", 300], ["RESTAURANT", 300], ["RESTAURACION", 300], ["MARISQUERIA", 180],
  ["ASADOR", 250], ["MESON", 180], ["TABERNA", 220], ["CHIRINGUITO", 220], ["RISTORANTE", 180],
  ["BISTRO", 150], ["SUSHI", 150], ["CERVECERIA", 150], ["PIZZERIA", 120], ["PIZZA", 120],
  ["FREIDURIA", 120], ["CAFETERIA", 80], ["BURGER", 80], ["HAMBURGUES", 80], ["KEBAB", 80],
  ["HELADERIA", 60], ["CAFE", 50], ["COFFEE", 50],
];
const CONDITIONAL_RULES = [
  ...EAT_CAPS.map(([k, max]) => RC(k, "Restauración", { sign: "-", min: 1, max })),
  // ITV: por encima de ~55 € ya no es la inspección, es la reparación que sale de ella.
  RC("ITV", "Taller y mantenimiento", { sign: "-", min: 20, max: 55, asset: "Coche" }),
  // Un bizum recibido pequeño casi siempre es alguien devolviéndote su parte.
  RC("BIZUM", "Bizum", { sign: "+", min: 0.01, max: 299, prio: PRIO.safety }),
];

/* ------------------------------------------------------------
   REGLAS DEFENSIVAS
   No adivinan: clasifican de forma conservadora y marcan el movimiento para que
   lo revises. Un bizum grande puede ser un alquiler, una deuda o un regalo, y
   equivocarse ahí distorsiona meses enteros. Mejor preguntarte una vez.
   ------------------------------------------------------------ */
const DEFENSIVE_RULES = [
  RC("BIZUM", "Bizum", { sign: "+", min: 300, max: 999999, prio: PRIO.defensive, confirm: true }),
  RC("BIZUM", "Bizum", { sign: "-", min: 100, max: 999999, prio: PRIO.defensive, confirm: true }),
];

/* Cajón Bizum: gana a cualquier nombre de comercio que aparezca en el concepto
   ("BIZUM A JUAN CENA" no es Restauración), pero pierde contra las condicionales
   y contra tus reglas personales, que son las que sí saben de qué va el bizum. */
const BIZUM_FALLBACK = [R("BIZUM", "Bizum", undefined, PRIO.bizum)];

/* Una regla simple con la misma clave que una condicional la deja inútil: la
   condicional no aplica fuera de su rango, pero entonces gana la simple y el tope
   no sirve de nada (un "ASADOR" de 3.000 € volvía a ser Restauración). Se quitan
   automáticamente, para que añadir un tope nuevo no exija recordar borrar la vieja. */
const CAPPED_KEYS = new Set(CONDITIONAL_RULES.filter((r) => r.max != null).map((r) => r.k));
const dropCapped = (list) => list.filter((r) => !CAPPED_KEYS.has(r.k));

const DEFAULT_RULES = [
  ...DEFENSIVE_RULES,
  ...CONDITIONAL_RULES,
  ...BIZUM_FALLBACK,
  ...dropCapped(MERCHANT_RULES),
  ...dropCapped(SAFETY_RULES).map((r) => ({ ...r, prio: PRIO.safety })),
  ...dropCapped(GENERIC_WORD_RULES),
];

/* ============================================================
   FORMATO es-ES
   ============================================================ */
// useGrouping "always": es-ES por defecto NO separa miles en cifras de 4 dígitos (2480 → «2480»)
const nfEUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
const nfEUR0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const nfNum = new Intl.NumberFormat("es-ES", { useGrouping: "always" });
const fmtE = (v) => nfEUR.format(v ?? 0);
const fmtE0 = (v) => nfEUR0.format(v ?? 0);
const fmtPct = (v) => new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(v || 0);
const fmtDate = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDateShort = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
// "hace 5 min" / "hace 3 h" / "ayer" / "hace 4 días": para la cabecera, donde una fecha completa no cabe.
const fmtAgo = (ts) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
};
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// Fecha y hora de compilación, inyectada por Vite. Permite comprobar de un vistazo si el
// navegador está sirviendo el build que acabas de subir o uno cacheado.
const BUILD_STAMP = typeof __BUILD__ === "string" ? __BUILD__ : "dev";
const MES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Etiqueta legible del periodo filtrado (para títulos de informe).
function describePeriod(f) {
  if (!f) return "Todo el histórico";
  if (f.periodType === "year") return `Año ${f.year}`;
  if (f.periodType === "month" && f.month) { const [y, m] = f.month.split("-").map(Number); return `${MES_ES[(m || 1) - 1]} de ${y}`; }
  if (f.periodType === "custom" && f.from && f.to) return `${f.from} a ${f.to}`;
  return "Todo el histórico";
}
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
};
const monthLabelLong = (key) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fmtMonths = (m) => nfNum.format(Math.round(m * 10) / 10);
const tnum = { fontVariantNumeric: "tabular-nums" };

/* ============================================================
   PERSISTENCIA
   window.storage (artefacto) → localStorage (despliegue propio) → memoria.
   Los datos nunca salen del espacio personal del usuario.
   ============================================================ */
const STORE_KEYS = { movs: "finz:movs:v1", cfg: "finz:cfg:v1" };
function makeStore() {
  try {
    if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
      return {
        kind: "espacio personal",
        async get(k) { try { const r = await window.storage.get(k); return r ? r.value : null; } catch { return null; } },
        async set(k, v) { try { const r = await window.storage.set(k, v); return !!r; } catch { return false; } },
        async del(k) { try { await window.storage.delete(k); return true; } catch { return false; } },
      };
    }
  } catch { /* sigue */ }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.getItem("__finz_probe__");
      return {
        kind: "este navegador",
        async get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
        async set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
        async del(k) { try { window.localStorage.removeItem(k); return true; } catch { return false; } },
      };
    }
  } catch { /* sigue */ }
  const mem = new Map();
  return {
    kind: "solo esta sesión",
    async get(k) { return mem.has(k) ? mem.get(k) : null; },
    async set(k, v) { mem.set(k, v); return true; },
    async del(k) { mem.delete(k); return true; },
  };
}
const STORE = makeStore();

/* ============================================================
   SNAPSHOTS AUTOMÁTICOS (defensa ante pérdida de datos)
   Safari/iOS puede purgar el almacenamiento local tras días de
   inactividad. Guardamos copias versionadas con retención
   "abuelo-padre-hijo" y ofrecemos restaurarlas o descargarlas.
   ============================================================ */
const SNAP_PREFIX = "finz:snap:";
const DAY_MS = 86400000;
// Política de retención: conserva los últimos 3 días, 1 por semana (4) y 1 por mes (6).
function planSnapshotRetention(timestamps, now) {
  const keep = new Set();
  const sorted = [...timestamps].sort((a, b) => b - a); // recientes primero
  for (const t of sorted.slice(0, 3)) keep.add(t); // últimos 3 siempre
  const weekBucket = (t) => Math.floor((now - t) / (7 * DAY_MS));
  const monthBucket = (t) => { const d = new Date(t), n = new Date(now); return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth()); };
  const seenWeek = new Set(), seenMonth = new Set();
  for (const t of sorted) {
    const w = weekBucket(t);
    if (w >= 0 && w < 4 && !seenWeek.has(w)) { seenWeek.add(w); keep.add(t); }
    const mo = monthBucket(t);
    if (mo >= 0 && mo < 6 && !seenMonth.has(mo)) { seenMonth.add(mo); keep.add(t); }
  }
  const remove = sorted.filter((t) => !keep.has(t));
  return { keep: [...keep], remove };
}
// ¿Debe crearse un snapshot ahora? Como mucho uno al día, y solo si hay datos.
function shouldSnapshot(lastSnapTs, now, movsCount) {
  if (!movsCount) return false;
  if (!lastSnapTs) return true;
  return now - lastSnapTs >= DAY_MS;
}
async function listSnapshots(store) {
  try {
    if (typeof window !== "undefined" && window.storage?.list) {
      const r = await window.storage.list(SNAP_PREFIX);
      const keys = (r?.keys || r || []).filter((k) => typeof k === "string" && k.startsWith(SNAP_PREFIX));
      return keys.map((k) => +k.slice(SNAP_PREFIX.length)).filter((n) => Number.isFinite(n)).sort((a, b) => b - a);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      const out = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(SNAP_PREFIX)) { const t = +k.slice(SNAP_PREFIX.length); if (Number.isFinite(t)) out.push(t); }
      }
      return out.sort((a, b) => b - a);
    }
  } catch { /* sin listado disponible */ }
  return [];
}
/* Cada snapshot es una COPIA COMPLETA y la retención guarda hasta 13. localStorage da
   unos 5 MB, así que a partir de cierto tamaño las copias automáticas dejarían de
   caber y, peor, podrían tumbar el guardado principal. Por encima del umbral dejamos
   de crearlas y avisamos: la red de seguridad pasa a ser exportar el JSON a mano. */
const SNAP_MAX_CHARS = 300000; // ~13 copias ≈ 3,9 MB, con margen bajo la cuota
async function writeSnapshot(store, payloadStr, now) {
  if (payloadStr.length > SNAP_MAX_CHARS) return { created: null, pruned: 0, skipped: true };
  await store.set(SNAP_PREFIX + now, payloadStr);
  const all = await listSnapshots(store);
  const { remove } = planSnapshotRetention(all, now);
  for (const t of remove) await store.del(SNAP_PREFIX + t);
  return { created: now, pruned: remove.length, skipped: false };
}

// Blindaje: un movimiento con fecha inválida haría fallar `toISOString()` y con él TODO
// el guardado (no se salvaría nada). Filtramos esos registros ya inservibles para que un
// dato corrupto aislado nunca tumbe la persistencia del resto.
const serializeMovs = (movs) => JSON.stringify({
  v: 1,
  movs: movs
    .filter((m) => m.date instanceof Date && !isNaN(m.date))
    .map((m) => ({ ...m, date: m.date.toISOString() })),
});
function deserializeMovs(raw) {
  const p = JSON.parse(raw);
  const list = (p.movs || []).map((m) => ({
    ...m,
    date: new Date(m.date),
    category: m.category ? migrateCat(m.category) : m.category,
    splits: m.splits?.length ? m.splits.map((s) => ({ ...s, cat: migrateCat(s.cat) })) : m.splits,
  })).filter((m) => m.date instanceof Date && !isNaN(m.date));
  // Las devoluciones de un comercio conocido guardadas como ingreso pasan a la categoría de
  // gasto del comercio, donde restan (Amazon → Compras). Una sola vez por movimiento (`dv`):
  // si luego lo devuelves a ingreso a mano, se respeta.
  // Cuotas de hipoteca guardadas como «Vivienda» pasan a su categoría (una vez por movimiento):
  // mezcladas, el informe de la renta deducía el capital como si fuera gasto de la finca.
  for (const m of list) {
    if (m.hp || m.category !== "Vivienda" || !(m.amount < 0)) continue;
    m.hp = 1;
    if (ES_HIPOTECA.test(m.pattern || m.concept || "")) m.category = "Hipoteca y préstamos";
  }
  const refunds = refundIndex(list);
  for (const m of list) {
    if ((m.dv || 0) >= 2 || !(m.amount > 0) || m.splits?.length || (m.category !== "Devoluciones y ayudas" && m.category !== "Otros ingresos")) continue;
    m.dv = 2;
    const r = matchRule(m.pattern || normalizePattern(m.concept), m.amount, DEFAULT_RULES, m.date, m.concept);
    const cat = r && !INGRESO_SET.has(r.cat) && !TRANSFER_SET.has(r.cat) ? r.cat : refundFromHistory(m, refunds);
    if (cat) m.category = cat;
  }
  return list;
}
/* Solo se guardan tus reglas (scope "personal") y qué reglas de fábrica has apagado.
   Así las de fábrica pueden mejorar en futuras versiones sin quedar congeladas, y una
   regla base desactivada NO reaparece al recargar (antes sí: `deleteRule` la borraba
   del array en memoria, pero al arrancar se volvía a construir desde DEFAULT_RULES). */
const customRulesOf = (rules) => rules.filter((r) => r.scope === "personal");
const disabledBaseIdsOf = (rules) => rules.filter((r) => r.scope !== "personal" && r.active === false).map(ruleId);

const ES_HIPOTECA = /HIPOTEC|PRESTAMO HIPOT/i;
const rebuildRules = (customRules, disabledIds, version = 4) => {
  const off = new Set(disabledIds || []);
  // Tus reglas de hipoteca a «Vivienda» pasan a la categoría propia de la cuota del préstamo.
  // Solo al venir de una configuración anterior (v<4): luego puedes volver a cambiarla.
  const cat = (r) => (version < 4 && r.cat === "Vivienda" && ES_HIPOTECA.test(r.k || "") ? "Hipoteca y préstamos" : migrateCat(r.cat));
  return [
    ...(customRules || []).map((r) => ({ ...r, cat: cat(r), scope: "personal", prio: r.prio ?? PRIO.personal })),
    ...DEFAULT_RULES.map((r) => (off.has(ruleId(r)) ? { ...r, active: false } : r)),
  ];
};

/* ============================================================
   GOBIERNO DE REGLAS
   Cada corrección crea una regla; con el tiempo se solapan o se
   vuelven demasiado amplias. Esto las audita: cuánto disparan, sobre
   cuántos comercios distintos, cuánto DINERO han clasificado, y si
   alguna es sospechosamente genérica o ya no cuadra con la realidad.
   El dinero clasificado es la métrica que importa: una regla que ha
   colocado 4.700 € pesa más que una que acierta tres cafés.
   ============================================================ */
function auditRules(rules, movs, stats = {}) {
  const out = [];
  // Se auditan las tuyas y las de fábrica que estén apagadas (para poder reactivarlas).
  const audited = rules.filter((r) => r.scope === "personal" || r.active === false);
  for (const r of audited) {
    const k = stripAccents(String(r.k).toUpperCase()).trim();
    if (!k) continue;
    const short = k.length <= 4;
    let hits = 0;
    const entities = new Set();
    const cats = new Map(); // categoría real actual de los movimientos que captura
    for (const m of movs) {
      const p = stripAccents(String(m.pattern).toUpperCase());
      const match = short ? ruleRegex(k).test(p) : p.includes(k);
      if (!match) continue;
      if (!ruleConditionsHold(r, m.amount, m.date)) continue;
      hits++;
      entities.add(merchantEntity(m.pattern));
      const c = m.category || "Otros";
      cats.set(c, (cats.get(c) || 0) + 1);
    }
    // "Amplia": una clave que abarca muchas entidades distintas suele ser demasiado genérica
    const distinct = entities.size;
    const broad = distinct >= 4 || (short && distinct >= 2);
    // "En conflicto": la mayoría de lo que captura ya no está en la categoría de la regla
    let conflict = false, domCat = r.cat, domN = 0, tot = 0;
    for (const [c, n] of cats) { tot += n; if (n > domN) { domN = n; domCat = c; } }
    if (tot >= 3 && domCat !== r.cat && domN / tot > 0.6) conflict = true;
    const st = stats[ruleId(r)] || { n: 0, abs: 0, last: null };
    out.push({
      id: ruleId(r), k: r.k, cat: r.cat, asset: r.asset === VIVIENDA ? "tu vivienda" : (r.asset || null),
      active: r.active !== false, scope: r.scope || "base", conditional: isConditional(r),
      sign: r.sign ?? null, min: r.min ?? null, max: r.max ?? null,
      dayMin: r.dayMin ?? null, dayMax: r.dayMax ?? null, confirm: !!r.confirm,
      hits, entities: distinct, broad, conflict,
      conflictCat: conflict ? domCat : null,
      sampleEntities: [...entities].slice(0, 4),
      usos: st.n, dinero: st.abs, ultimoUso: st.last,
    });
  }
  // Orden: primero lo que pide atención (conflicto, luego amplitud), después por dinero.
  return out.sort((a, b) => (b.conflict - a.conflict) || (b.broad - a.broad) || (b.dinero - a.dinero) || (b.hits - a.hits));
}

const serializeCfg = ({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem }) =>
  JSON.stringify({
    v: 4, customRules: customRulesOf(rules), disabledRules: disabledBaseIdsOf(rules),
    assets, groups, budgets, reducible: [...reducible], aiOn, ai, aiProfiles: aiProfiles || [], aiDetail,
    ruleStats: ruleStats || {}, materialidad,
    // Comercio -> activo. Vive en la CONFIG, no en los movimientos: así borrar una carga
    // equivocada no se lleva por delante el trabajo de asignar gastos a cada activo.
    assetMem: assetMem || {},
  });
function applyCfg(raw, setters) {
  const c = JSON.parse(raw);
  if (Array.isArray(c.assets)) setters.setAssets(c.assets);
  if (Array.isArray(c.groups)) setters.setGroups(c.groups);
  if (c.budgets && typeof c.budgets === "object") setters.setBudgets(c.budgets);
  if (Array.isArray(c.reducible)) setters.setReducible(new Set(c.reducible));
  if (Array.isArray(c.customRules)) setters.setRules(rebuildRules(c.customRules, c.disabledRules, Number(c.v) || 0));
  if (typeof c.aiOn === "boolean") setters.setAiOn(c.aiOn);
  // Las claves de IA no viajan en las copias (ni exportadas ni del servidor). Al aplicar una, se
  // conserva la clave que ya hubiera aquí, pero solo para el MISMO servicio: mandarla a otra
  // dirección sería entregársela a un tercero.
  const keepKey = (inc, prev) => inc.apiKey || (prev && prev.baseUrl === inc.baseUrl && prev.provider === inc.provider ? prev.apiKey : "") || "";
  if (c.ai && typeof c.ai === "object" && typeof c.ai.provider === "string") setters.setAi?.((prev) => ({ ...DEFAULT_AI_CFG, ...c.ai, apiKey: keepKey(c.ai, prev) }));
  if (Array.isArray(c.aiProfiles)) setters.setAiProfiles?.((prev) => c.aiProfiles.map((p) => ({ ...p, apiKey: keepKey(p, (prev || []).find((q) => q.id === p.id)) })));
  if (typeof c.aiDetail === "boolean") setters.setAiDetail?.(c.aiDetail);
  if (c.ruleStats && typeof c.ruleStats === "object") setters.setRuleStats?.(c.ruleStats);
  if (typeof c.materialidad === "number") setters.setMaterialidad?.(c.materialidad);
  if (c.assetMem && typeof c.assetMem === "object") setters.setAssetMem?.(c.assetMem);
}

// Config de la conexión bancaria (URL del Worker, banco, país, cuenta, sesión, token). Se
// guarda aparte y viaja con tus datos, para que conectando una vez en un dispositivo el resto
// pueda refrescar directamente. Helpers a nivel de módulo para leerla/escribirla sin líos de orden.
// Sincronizacion con el propio Worker (sustituye a Google Drive). Guarda la version que este
// dispositivo cree que hay en el servidor: es lo que permite detectar que otro ha escrito
// despues y NO pisarlo.
const SYNC_KEY = "finz:sync:v1";
const loadSync = () => { try { return JSON.parse(window.localStorage?.getItem(SYNC_KEY) || "{}") || {}; } catch { return {}; } };
// Guardar en localStorage sin perder en silencio la conexión bancaria o el estado de la sync.
// Si no cabe, se sacrifican las copias automáticas más antiguas (son de respaldo) y se
// reintenta; si ni así, se avisa a la app (evento «finz-cuota»).
function setItemSeguro(key, value) {
  for (let intento = 0; intento < 20; intento++) {
    try { window.localStorage?.setItem(key, value); return true; } catch {
      const snaps = [];
      try { for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k && k.startsWith(SNAP_PREFIX)) snaps.push(k); } } catch { /* sin acceso */ }
      if (!snaps.length) break;
      snaps.sort((a, b) => +a.slice(SNAP_PREFIX.length) - +b.slice(SNAP_PREFIX.length));
      try { window.localStorage.removeItem(snaps[0]); } catch { break; }
    }
  }
  try { window.dispatchEvent(new Event("finz-cuota")); } catch { /* noop */ }
  return false;
}
const saveSync = (v) => setItemSeguro(SYNC_KEY, JSON.stringify(v));

const BANK_KEY = "finz:bank:v1";
// Formato: { workerUrl, token, connections:[{id,aspsp,country,sessionId,accountUid,accountName,lastSync}], pending }.
// Migra el formato antiguo de una sola conexión.
const loadBank = () => {
  try {
    const raw = window.localStorage?.getItem(BANK_KEY);
    const b = JSON.parse(raw || "{}") || {};
    if (!Array.isArray(b.connections)) {
      const conns = (b.sessionId || b.aspsp) ? [{ id: "bc0", aspsp: b.aspsp || "", country: b.country || "ES", sessionId: b.sessionId || "", accountUid: b.accountUid || "", accountName: b.accountName || "", lastSync: b.lastSync || null }] : [];
      return { ...b, workerUrl: b.workerUrl || "", token: b.token || "", connections: conns, pending: b.pending || null, auto: !!b.auto, lastAuto: b.lastAuto || null };
    }
    // El spread va delante para NO perder los campos que esta función no enumera (psu,
    // sessionPsu, accountIban, lastNewest...). Sin él, cualquier guardado posterior los borraba.
    return { ...b, workerUrl: b.workerUrl || "", token: b.token || "", connections: b.connections, pending: b.pending || null, auto: !!b.auto, lastAuto: b.lastAuto || null };
  } catch {
    // Antes esto devolvía una config EN BLANCO, y quien la guardara acto seguido destruía la
    // real (URL del worker, token, sesión). `broken` avisa de que no hay nada que preservar.
    return { workerUrl: "", token: "", connections: [], pending: null, auto: false, lastAuto: null, broken: true };
  }
};
const bankIsEmpty = (b) => !b || (!b.workerUrl && !b.token && !(b.connections || []).length);

// La URL del Worker y el token son, a efectos prácticos, el usuario y la contraseña de tu
// cuenta. Se guardan en el gestor de contraseñas del navegador para que en otro navegador u
// otro dispositivo baste con «Entrar»: Google y iCloud los sincronizan, y en Android el
// autorrelleno de Google sirve también en Firefox, Samsung Internet o Edge. Sin servidor nuestro.
async function recordarAcceso(workerUrl, token) {
  try {
    if (!workerUrl || !token || !window.PasswordCredential || !navigator.credentials?.store) return false;
    await navigator.credentials.store(new window.PasswordCredential({ id: workerUrl, password: token, name: "Mis Finanzas" }));
    return true;
  } catch { return false; }
}
// Enlace personal de acceso: la dirección y el token metidos en un enlace que te mandas a ti
// mismo (email, WhatsApp, notas). Abrirlo en cualquier dispositivo = entrar. Es la versión sin
// servidor del «enlace mágico» por email: tu bandeja de entrada ya está en todos tus aparatos.
// Va en el fragmento (#), que el navegador no envía nunca a ningún servidor.
const ACCESS_KEY = "acceso";
//
// Desde la v2 el token va CIFRADO con una clave que eliges tú y que no viaja en el enlace: quien
// consiga tu correo (o el enlace) sin la clave no tiene nada. PBKDF2 con 600.000 iteraciones hace
// que probar claves a ciegas sea lentísimo; aun así, cuanto más larga, mejor.
const ACCESS_ITER = 600000;
const ACCESS_MIN = 8;
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
async function claveEnlace(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ACCESS_ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function makeAccessLink(workerUrl, token, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await claveEnlace(pass, salt), new TextEncoder().encode(token));
  const data = JSON.stringify({ v: 2, u: workerUrl, s: b64u(salt), i: b64u(iv), c: b64u(c) });
  return `${window.location.origin}/#${ACCESS_KEY}=${b64u(new TextEncoder().encode(data))}`;
}
// Devuelve el token, o lanza si la clave no es la buena (AES-GCM no descifra con otra clave).
async function abrirAcceso(cif, pass) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(cif.i) }, await claveEnlace(pass, unb64u(cif.s)), unb64u(cif.c));
  return new TextDecoder().decode(plain);
}
// Acepta el enlace entero o solo su fragmento. Devuelve { u, t } (enlace antiguo, sin cifrar),
// { u, cif } (cifrado: falta la clave) o null.
const parseAccessLink = (text) => {
  try {
    const m = String(text || "").match(new RegExp(ACCESS_KEY + "=([A-Za-z0-9_-]+)"));
    if (!m) return null;
    const j = JSON.parse(new TextDecoder().decode(unb64u(m[1])));
    const u = String(j.u || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(u)) return null;
    if (j.v === 2 && j.s && j.i && j.c) return { u, cif: { s: j.s, i: j.i, c: j.c } };
    const t = String(j.t || "").trim();
    return t ? { u, t } : null;
  } catch { return null; }
};
// Se mira al cargar el módulo, antes de que nadie limpie la barra de direcciones.
const LLEGA_CON_ENLACE = typeof window !== "undefined" && new RegExp(ACCESS_KEY + "=").test(window.location.hash);
async function leerAccesoGuardado() {
  try {
    if (!window.PasswordCredential || !navigator.credentials?.get) return null;
    const c = await navigator.credentials.get({ password: true, mediation: "optional" });
    return c && c.id && c.password ? { u: c.id, t: c.password } : null;
  } catch { return null; }
}

// Fusiona la config bancaria de una copia con la local. NO vale quedarse con "la más reciente":
// en un dispositivo nuevo acabas de teclear la URL y el token, así que el sello local es
// posterior aunque no tenga ninguna conexión dentro. Con ese criterio se rechazaba la copia
// buena y el banco no aparecía nunca en el dispositivo nuevo.
//
// Lo que de verdad hay que proteger son las CONEXIONES, que son lo caro de recrear: exigen
// pasar otra vez por el banco con su SCA. Devuelve null si no hay nada que aportar.
function mergeBank(local, incoming) {
  if (!incoming || typeof incoming !== "object" || bankIsEmpty(incoming)) return null;
  const lConns = local.connections || [], iConns = incoming.connections || [];
  const incomingNewer = (Number(incoming.updatedAt) || 0) > (Number(local.updatedAt) || 0);
  // Se adoptan las conexiones si aquí no hay ninguna (dispositivo nuevo) o si la copia es
  // posterior. Nunca se sustituyen conexiones vivas por una copia anterior.
  const takeConns = iConns.length > 0 && (lConns.length === 0 || incomingNewer);
  if (!takeConns && !incomingNewer) return null;
  return {
    ...incoming,
    ...local,
    // La URL y el token que acabas de escribir mandan sobre los de la copia; si están vacíos,
    // se heredan, que es lo que permite configurar un dispositivo nuevo de una sola vez.
    workerUrl: local.workerUrl || (/^https:\/\//.test(incoming.workerUrl || "") ? incoming.workerUrl : ""),
    token: local.token || incoming.token || "",
    connections: takeConns ? iConns : lConns,
    auto: local.auto || incoming.auto || false,
    pending: local.pending || null, // lo pendiente es de ESTE dispositivo
  };
}
// Guardar sella la hora: es lo que permite decidir, al restaurar una copia, cuál es la
// más nueva en vez de pisar a ciegas la que tiene la sesión buena.
const saveBank = (v) => {
  try {
    const prev = loadBank();
    // Red de seguridad: nunca sustituir una config con datos por una vacía. Esto es lo que
    // dejaba la app "como nueva" (sin worker, sin token) tras una reconexión.
    if (bankIsEmpty(v) && !bankIsEmpty(prev) && !prev.broken) return;
    setItemSeguro(BANK_KEY, JSON.stringify({ ...v, updatedAt: Date.now() }));
  } catch { /* lectura previa ilegible */ }
};
// El motivo real de un fallo bancario viene en el cuerpo de la respuesta del Worker (que a su
// vez reenvía el de Enable Banking). Un «HTTP 400» pelado no permite arreglar nada, así que
// lo abrimos aquí. Best-effort: si el cuerpo no se puede leer, devolvemos cadena vacía.
async function bankErrDetail(res) {
  try {
    const txt = (await res.text()).slice(0, 400);
    if (!txt) return "";
    let msg = txt;
    try { const j = JSON.parse(txt); msg = j.error || j.message || j.detail || j.error_description || txt; } catch { /* no era JSON */ }
    return " — " + String(msg).replace(/\s+/g, " ").trim();
  } catch { return ""; }
}

/* ============================================================
   PARSER DE NÚMEROS Y FECHAS (es)
   ============================================================ */
function parseEsNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim()
    .replace(/\u00A0/g, " ")
    // El signo menos tipográfico (−) y los guiones largos que meten Excel y algunos bancos
    // no son el «-» del teclado: sin esto, el gasto no se leía y la fila desaparecía.
    .replace(/[\u2212\u2012\u2013\u2014\uFE63\uFF0D]/g, "-")
    .replace(/[€$£]/g, "")
    .replace(/[A-Za-z]/g, "")
    .replace(/\s/g, "");
  if (!s || s === "-") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = true; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1); }
  if (!/^[\d.,]+$/.test(s)) return null;
  const hasC = s.includes(","), hasP = s.includes(".");
  if (hasC && hasP) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasC) {
    s = s.replace(/,/g, ".");
    if ((s.match(/\./g) || []).length > 1) return null;
  } else if (hasP) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else if ((s.match(/\./g) || []).length > 1) return null;
  }
  const v = parseFloat(s);
  if (!isFinite(v)) return null;
  return neg ? -v : v;
}

function parseDateAny(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? d : null; }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const day = +m[1], mon = +m[2];
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    const d = new Date(y, mon - 1, day);
    return d.getMonth() === mon - 1 ? d : null;
  }
  return null;
}

const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const BANK_PREFIXES = [
  "COMPRA TARJ.", "COMPRA TARJETA", "COMPRA EN", "PAGO MOVIL EN", "PAGO MOVIL",
  "PAGO CON TARJETA EN", "PAGO CON TARJETA", "PAGO TARJETA", "PAGO EN", "TARJ.",
  "ADEUDO RECIBO", "ADEUDO POR DOMICILIACION", "ADEUDO SEPA", "ADEUDO", "RECIBO DE",
  "RECIBO", "DOMICILIACION", "TRANSFERENCIA A FAVOR DE", "TRANSFERENCIA A",
  "TRANSFERENCIA DE", "TRANSFERENCIA", "TRANSF.",
  "CARGO", "ABONO", "LIQUIDACION", "COMPRA",
];
const PROCESSOR_RE = /^(PAYPAL|SUMUP|ZETTLE|IZIPAY|VERSE|STRIPE|VIVA|SQ|PP)\b[\s*]*/;
// Cola que delata que tras la pasarela NO hay comercio, solo su propia razón social:
// "PAYPAL EUROPE S.A.R.L.", "STRIPE PAYMENTS EUROPE"… Colapsan a la pasarela a secas.
const PROCESSOR_TAIL_RE = /^(EUROPE|IBERIA|ESPANA|SPAIN|PAYMENTS?|EU|SARL|S\s?A\s?R\s?L|S\s?L\s?U?|S\s?A|BV|INC|LTD|GMBH|LLC)\b/;

// Cadenas con muchas tiendas: el banco añade el barrio/local ("MERCADONA LA REMO",
// "MERCADONA MARMOLE") y fragmentan el mismo comercio en decenas de patrones. Se
// colapsan a la marca para que agrupen en clasificación, gráficos y reglas. Multi-
// palabra y marcas largas primero para que la alternancia las prefiera.
const CHAIN_RE = /^(EL CORTE INGLES|CASH FRESH|BM SUPERMERCADO|AHORRA MAS|MAS Y MAS|MERCADONA|CARREFOUR|ALCAMPO|HIPERCOR|SUPERCOR|AHORRAMAS|SUPERSOL|COVIRAN|CAPRABO|BONPREU|MASYMAS|CONSUM|EROSKI|GADIS|CONDIS|SIMPLY|FROIZ|SUPECO|SPAR|LIDL|ALDI|DIA)\b/;

function normalizePattern(concept) {
  let s = stripAccents(String(concept || "").toUpperCase());
  for (const p of BANK_PREFIXES) {
    const pn = stripAccents(p);
    // El prefijo debe terminar en frontera de palabra. Sin esto, "TRANSFERENCIA A"
    // mordía la A de "TRANSFERENCIA ALQUILER" y dejaba "LQUILER"; igual "COMPRA EN"
    // con "COMPRA ENERGIA". El movimiento se volvía irreconocible para toda regla.
    if (s.startsWith(pn) && !/[A-Z0-9]/.test(s.charAt(pn.length))) { s = s.slice(pn.length); break; }
  }
  s = s.replace(/[*#]/g, " ").trim();
  // Pasarela de pago (PayPal, Stripe…): si revela el comercio ("PAYPAL *NETFLIX"),
  // nos quedamos con el comercio; si no ("PAYPAL EUROPE S.A."), el patrón es la
  // pasarela a secas, para que agrupe y NO se confunda con un comercio inventado.
  const pm = PROCESSOR_RE.exec(s);
  if (pm) {
    const rest = s.slice(pm[0].length).trim();
    s = (!rest || PROCESSOR_TAIL_RE.test(rest)) ? pm[1] : rest;
  }
  s = s.replace(/[0-9]/g, " ").replace(/[/\\:;,._'"()-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "SIN CONCEPTO";
  // Cadena conocida con sufijo de local: nos quedamos con la marca (un único comercio).
  const chm = CHAIN_RE.exec(s);
  if (chm) return chm[1];
  return s.slice(0, 46).trim();
}

// Patrón "pasarela pura" (PAYPAL, STRIPE, SUMUP…) cuando el banco NO reveló el comercio.
// Agrupa cargos de comercios reales distintos, así que su patrón no vale como clave de
// regla ni para cambios en bloque: cada cargo se clasifica por separado.
function isProcessorPattern(pattern) {
  const s = String(pattern || "").trim();
  const pm = PROCESSOR_RE.exec(s);
  return !!pm && s === pm[1];
}

/* Operaciones bancarias genericas: el patron describe el TIPO de movimiento, no a quien se
   paga. "TRANSFER INMEDIATA" agrupa el alquiler de todos los inquilinos y "BIZUM RECIBIDO"
   a media agenda, asi que tratarlos como si fueran un comercio hace que etiquetar UNO
   arrastre a todos los demas. El \b evita falsos positivos: "INGRESOS SL" no casa con INGRESO. */
// La segunda línea es lo que queda de una transferencia tras quitarle el prefijo
// ("TRANSF. PERIODICA" → "PERIODICA"): tampoco dice a quién se paga.
const GENERIC_OP_RE = /^(TRANSFER|TRANSFERENCIA|BIZUM|TRASPASO|INGRESO|REINTEGRO|CAJERO|NOMINA|DEVOLUCION|ADEUDO|RECIBO|DOMICILIACION|EFECTIVO|ABONO|CARGO|LIQUIDACION|COMISION|VARIOS|PERIODICA|INMEDIATA|EMITIDA|RECIBIDA|ORDINARIA|SEPA|NACIONAL|SIN CONCEPTO|MOVIMIENTO)\b/;

/* ¿El patron identifica a un comercio concreto? Solo entonces tiene sentido que una accion
   sobre un movimiento se aplique a todos los que comparten patron. */
function identifiesMerchant(pattern) {
  const p = stripAccents(String(pattern || "").toUpperCase()).trim();
  return !!p && !isProcessorPattern(p) && !GENERIC_OP_RE.test(p);
}

/* Transferencias y operaciones genéricas: el texto no dice para qué es el dinero, el importe
   sí. Lo que se aprende de ellas va atado al importe (±15 %): corregir la transferencia de
   85 € del parking no debe arrastrar la de 500 € que va a los fondos. */
const TRANSF_CONCEPT_RE = /^(TRANSF|TRASPASO|ORDEN DE TRANSF)/;
// Por la conexión con el banco el concepto es el destinatario («ANA PÉREZ…»), sin rastro de
// que sea una transferencia. Por eso también cuenta el historial: un mismo concepto con
// movimientos del mismo signo en categorías distintas se decide por importe (`amb`).
const ambKey = (m) => `${m.pattern}|${m.amount < 0 ? "-" : "+"}`;
function ambiguousPatterns(movs) {
  const cats = new Map();
  for (const m of movs || []) {
    if (!m.category || m.category === "Otros" || m.splits?.length) continue;
    const k = ambKey(m);
    if (!cats.has(k)) cats.set(k, new Set());
    cats.get(k).add(m.category);
  }
  return new Set([...cats].filter(([, c]) => c.size > 1).map(([k]) => k));
}
function needsAmount(m, amb) {
  return !identifiesMerchant(m.pattern) || TRANSF_CONCEPT_RE.test(stripAccents(String(m.concept || "").toUpperCase()).trim())
    || !!(amb && amb.has(ambKey(m)));
}
// Regla personal que se aprende al corregir (o confirmar) un movimiento. `others`: el resto
// de movimientos; si el mismo concepto tiene otros de distinta categoría, la regla va por importe.
function learnedRule(m, cat, asset, others) {
  const r = { k: m.pattern, cat, asset: asset || undefined, prio: PRIO.personal, scope: "personal" };
  const amb = others && others.some((o) => o.id !== m.id && ambKey(o) === ambKey(m) && o.category && o.category !== "Otros" && o.category !== cat) ? new Set([ambKey(m)]) : null;
  // Un positivo puesto en una categoría de gasto es una devolución: la regla lleva signo «+»
  // para aplicarse a las próximas devoluciones (sin signo, una regla de gasto nunca casa con
  // un ingreso y la corrección no enseñaba nada).
  const refund = m.amount > 0 && !INGRESO_SET.has(cat) && !TRANSFER_SET.has(cat);
  if (!needsAmount(m, amb)) return refund ? { ...r, sign: "+" } : r;
  const a = Math.abs(m.amount);
  return { ...r, sign: m.amount < 0 ? "-" : "+", min: Math.floor(a * 85) / 100, max: Math.ceil(a * 115) / 100 };
}

const _ruleRe = new Map();
function ruleRegex(k) {
  let re = _ruleRe.get(k);
  if (!re) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^A-Z0-9])${esc}([^A-Z0-9]|$)`);
    _ruleRe.set(k, re);
  }
  return re;
}
/* Ordena una vez por prioridad (desc) y, a igualdad, por posición en el array (asc):
   así el orden dentro de cada tramo se respeta y las reglas aprendidas, que se
   anteponen al array, siguen ganando a sus iguales. Cacheado por identidad del array
   porque matchRule se llama una vez por movimiento. */
const _sortedCache = new WeakMap();
function sortedRules(rules) {
  let s = _sortedCache.get(rules);
  if (!s) {
    s = rules.map((r, i) => [r, i])
      .sort((a, b) => ((b[0].prio ?? PRIO.merchant) - (a[0].prio ?? PRIO.merchant)) || (a[1] - b[1]))
      .map(([r]) => r);
    _sortedCache.set(rules, s);
  }
  return s;
}

/* ¿Se cumplen las condiciones de la regla sobre ESTE movimiento?
   Una condición ausente no restringe. `date` puede faltar (clasificación por patrón):
   en ese caso una regla que exija día del mes no puede afirmarse, y no aplica. */
function ruleConditionsHold(r, amount, date) {
  if (r.sign === "+" && !(amount > 0)) return false;
  if (r.sign === "-" && !(amount < 0)) return false;
  const abs = Math.abs(amount);
  if (r.min != null && abs < r.min) return false;
  if (r.max != null && abs > r.max) return false;
  if (r.dayMin != null || r.dayMax != null) {
    if (!date) return false;
    const d = date.getDate();
    if (r.dayMin != null && d < r.dayMin) return false;
    if (r.dayMax != null && d > r.dayMax) return false;
  }
  return true;
}

/* Devolución: un positivo que el banco marca como tal, o un positivo de tarjeta (una
   compra con tarjeta no te paga; si entra dinero, es que te la han devuelto). */
const REFUND_RE = /DEVOLUC|DEVOL\b|REEMBOLSO|REFUND|RETROCESION|ANULACION|ANUL\b|ABONO COMPRA/;
const CARD_OP_RE = /^(COMPRA|PAGO (CON )?TARJ|PAGO MOVIL|TARJ)/;
const REFUND_NEEDS_MARK = new Set(["Vivienda", "Hipoteca y préstamos", "Comisiones", "Otros"]);

function matchRule(pattern, amount, rules, date = null, concept = "") {
  const p = stripAccents(String(pattern).toUpperCase());
  const isIncome = amount > 0;
  // Una devolución va a la categoría de gasto del comercio (Amazon → Compras, Iberdrola →
  // Suministros) y así resta de ese gasto en vez de contar como ingreso. Las condiciones de
  // la regla se miran sobre el cargo que se devuelve (mismo importe, en negativo).
  // Sin marca de devolución también vale un positivo de un comercio concreto (muchos bancos
  // ponen solo «AMAZON EU SARL»), pero no de categorías donde un
  // positivo sí suele ser ingreso (alquiler, intereses) o una regla genérica de palabra.
  const c = stripAccents(String(concept || "").toUpperCase()).trim();
  const marked = REFUND_RE.test(p) || REFUND_RE.test(c) || CARD_OP_RE.test(c);
  const transf = TRANSF_CONCEPT_RE.test(c);
  if (isIncome && (marked || identifiesMerchant(p))) {
    for (const r of sortedRules(rules)) {
      if (r.active === false || INGRESO_SET.has(r.cat) || TRANSFER_SET.has(r.cat) || r.cat === "Impuestos") continue;
      if (r.scope === "personal" && !isConditional(r) && !identifiesMerchant(r.k)) continue;
      if (!marked && (REFUND_NEEDS_MARK.has(r.cat) || (r.prio ?? PRIO.merchant) < PRIO.safety)) continue;
      // Por transferencia solo un comercio de la lista de fábrica (IBERDROLA): un nombre de
      // persona con regla tuya de gasto no convierte en devolución lo que te paga.
      if (!marked && transf && r.scope === "personal") continue;
      // Una regla aprendida de una devolución («+») se mira tal cual; una de gasto, contra el cargo.
      if (!ruleConditionsHold(r, r.sign === "+" ? amount : -amount, date)) continue;
      const k = stripAccents(String(r.k).toUpperCase()).trim();
      if (k && (k.length <= 4 ? ruleRegex(k).test(p) : p.includes(k))) return r;
    }
  }
  for (const r of sortedRules(rules)) {
    if (r.active === false) continue; // baja lógica: la regla existe pero está apagada
    // Reglas personales antiguas sobre un patrón genérico sin importe: casaban con TODAS las
    // transferencias de ese tipo, fuera cual fuera su importe. Ya no se crean; se ignoran.
    if (r.scope === "personal" && !isConditional(r) && !identifiesMerchant(r.k)) continue;
    const k = stripAccents(String(r.k).toUpperCase()).trim();
    if (!k) continue;
    // Una regla de categoría de GASTO no debe capturar un ingreso (mismo texto, signo opuesto):
    // p. ej. "ALQUILER" que pagas (Vivienda) vs. el que cobras (Alquileres cobrados).
    if (isIncome && !INGRESO_SET.has(r.cat) && !TRANSFER_SET.has(r.cat) && r.sign !== "+") continue;
    // Simétrico: una categoría de ingreso no debe capturar un gasto.
    if (!isIncome && INGRESO_SET.has(r.cat)) continue;
    if (!ruleConditionsHold(r, amount, date)) continue;
    // Claves cortas (≤4) exigen límite de palabra para evitar falsos positivos
    // (p.ej. "DIA" dentro de "GUARDIA"/"MEDIA"); el resto por subcadena para tolerar plurales.
    const hit = k.length <= 4 ? ruleRegex(k).test(p) : p.includes(k);
    if (hit) return r;
  }
  if (amount > 0) {
    if (/ALQUILER|ARRENDAMIENTO|INQUILIN/.test(p)) return { k: "", cat: "Alquileres cobrados" };
    if (/DEVOLUC|REEMBOLSO|ABONO COMPRA|RETROCESION/.test(p)) return { k: "", cat: "Devoluciones y ayudas" };
    if (/DIVIDENDO|INTERES|CUPON|AMORTIZACION/.test(p)) return { k: "", cat: "Inversiones" };
    if (/NOMINA|PENSION|SALARIO|PAGA/.test(p)) return { k: "", cat: "Nómina y pensión" };
    return { k: "", cat: "Otros ingresos" };
  }
  return null;
}

/* ============================================================
   LECTURA / TOKENIZACIÓN CSV
   ============================================================ */
function decodeBuffer(buf) {
  const u8 = new Uint8Array(buf);
  let off = 0;
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) off = 3;
  const slice = u8.subarray(off);
  const utf = new TextDecoder("utf-8").decode(slice);
  if (!utf.includes("\uFFFD")) return utf;
  try { return new TextDecoder("windows-1252").decode(slice); } catch { return utf; }
}
// Excel (.xlsx, .xls, .ods; también los «.xls» que en realidad son una tabla HTML, que es
// lo que exportan varios bancos). Devuelve las filas como las daría el lector de CSV, para que
// todo lo demás (detección de cabecera, columnas, importes) sea idéntico. La librería pesa,
// así que solo se descarga cuando alguien trae un Excel.
const isSpreadsheetFile = (file) => /\.(xlsx|xlsm|xls|ods)$/i.test(file.name)
  || /spreadsheetml|opendocument\.spreadsheet/.test(file.type || "");
function spreadsheetToRows(buf) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./excelWorker.js", import.meta.url), { type: "module" });
    const t = setTimeout(() => { w.terminate(); reject(new Error("el Excel tarda demasiado en leerse")); }, 30000);
    w.onmessage = (e) => {
      clearTimeout(t); w.terminate();
      // Solo se aceptan filas de texto: nada que venga del hilo se usa como objeto o código.
      const rows = e.data && e.data.ok && Array.isArray(e.data.rows) ? e.data.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : [])) : null;
      rows ? resolve(rows) : reject(new Error((e.data && e.data.error) || "no se pudo leer el Excel"));
    };
    w.onerror = (e) => { clearTimeout(t); w.terminate(); reject(new Error(e.message || "no se pudo leer el Excel")); };
    w.postMessage(buf, [buf]);
  });
}
function detectDelimiter(text) {
  const sample = text.slice(0, 6000);
  const counts = { ";": 0, "\t": 0, ",": 0 };
  let inQ = false;
  for (const ch of sample) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && counts[ch] !== undefined) counts[ch]++;
  }
  if (counts[";"] > 0 && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}
function tokenizeCSV(text, delim) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_WORDS = ["fecha", "concepto", "descripcion", "importe", "cargo", "abono", "debe", "haber", "saldo", "movimiento", "cantidad", "detalle", "valor"];

const SIGNO_RE = /^(d|h|debe|haber|cargo|abono|\+|-)$/i;
const SIGNO_NEG = /^(d|debe|cargo|-)$/i;
function analyzeRows(rows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = rows[i].map((c) => stripAccents(c.toLowerCase().trim()));
    let score = 0, hasFecha = false;
    for (const c of cells) {
      for (const w of HEADER_WORDS) if (c.includes(w)) { score++; if (w === "fecha") hasFecha = true; break; }
    }
    if (score >= 2 && hasFecha) { headerIdx = i; break; }
  }
  let dataStart;
  if (headerIdx >= 0) dataStart = headerIdx + 1;
  else {
    dataStart = -1;
    for (let i = 0; i < Math.min(rows.length, 60); i++) {
      const hasDate = rows[i].some((c) => parseDateAny(c));
      const hasNum = rows[i].some((c) => !parseDateAny(c) && parseEsNumber(c) !== null);
      if (hasDate && hasNum) { dataStart = i; break; }
    }
    if (dataStart < 0) return { error: "No se encontró ninguna fila con fecha e importe. Comprueba que el archivo es un extracto en CSV." };
  }
  const headers = headerIdx >= 0 ? rows[headerIdx].map((h) => stripAccents(h.toLowerCase())) : null;
  const sample = rows.slice(dataStart, dataStart + 60);
  const nCols = Math.max(...sample.map((r) => r.length));
  const stats = [];
  for (let c = 0; c < nCols; c++) {
    let dates = 0, nums = 0, filled = 0, textLen = 0, signChanges = 0, lastSign = 0, sumAbs = 0;
    for (const r of sample) {
      const v = (r[c] || "").trim();
      if (!v) continue;
      filled++;
      if (parseDateAny(v)) dates++;
      else {
        const n = parseEsNumber(v);
        if (n !== null) {
          nums++; sumAbs += Math.abs(n);
          const sg = Math.sign(n);
          if (sg !== 0 && lastSign !== 0 && sg !== lastSign) signChanges++;
          if (sg !== 0) lastSign = sg;
        } else textLen += v.length;
      }
    }
    stats.push({ dates, nums, filled, textLen, signChanges, avgAbs: nums ? sumAbs / nums : 0 });
  }
  const n = sample.length || 1;
  const cols = { date: -1, date2: -1, concept: -1, amount: -1, cargo: -1, abono: -1, saldo: -1, signo: -1 };
  if (headers) {
    headers.forEach((h, i) => {
      if (/fecha/.test(h)) { if (/valor/.test(h)) cols.date2 = i; else if (cols.date < 0) cols.date = i; }
      else if (/concepto|descripcion|movimiento|detalle|observ/.test(h)) { if (cols.concept < 0) cols.concept = i; }
      else if (/saldo/.test(h)) cols.saldo = i;
      else if (/^(d\/h|debe\/haber|cargo\/abono|signo|\+\/-)$/.test(h.trim())) cols.signo = i;
      // «Gasto (-)» / «Ingreso (+)» (así exportan algunos bancos): sin «gasto» aquí, la
      // columna de gastos no se reconocía y solo entraban los ingresos.
      else if (/cargo|debe|debito|pagos|gasto|retirad|reintegro|salida/.test(h)) cols.cargo = i;
      else if (/abono|haber|credito|ingreso|deposito|entrada/.test(h)) cols.abono = i;
      else if (/importe|cantidad|monto/.test(h)) cols.amount = i;
    });
    if (cols.date < 0 && cols.date2 >= 0) { cols.date = cols.date2; cols.date2 = -1; }
  }
  if (cols.date < 0) {
    let best = -1, bestV = 0;
    stats.forEach((s, i) => { if (s.dates / n > 0.6 && s.dates > bestV) { best = i; bestV = s.dates; } });
    cols.date = best;
  }
  const numericCols = stats.map((s, i) => ({ i, s }))
    .filter(({ i, s }) => i !== cols.date && i !== cols.date2 && s.nums / Math.max(1, s.filled) > 0.6 && s.nums > 0);
  if (cols.amount < 0 && cols.cargo < 0 && cols.abono < 0) {
    const free = numericCols.filter(({ i }) => i !== cols.saldo);
    if (free.length === 1) cols.amount = free[0].i;
    else if (free.length >= 2) {
      if (cols.saldo < 0) {
        const saldoCand = [...free].sort((a, b) => b.s.avgAbs - a.s.avgAbs)[0];
        if (saldoCand.s.filled >= n * 0.95 && saldoCand.s.signChanges <= 2) cols.saldo = saldoCand.i;
      }
      const rest = free.filter(({ i }) => i !== cols.saldo);
      if (rest.length === 1) cols.amount = rest[0].i;
      else if (rest.length >= 2) {
        const partial = rest.filter(({ s }) => s.filled < n * 0.85);
        if (partial.length >= 2) { cols.cargo = partial[0].i; cols.abono = partial[1].i; }
        else cols.amount = rest.sort((a, b) => b.s.nums - a.s.nums)[0].i;
      }
    }
  }
  // Importe siempre en positivo y el signo en otra columna (D/H, Debe/Haber, +/-): sin
  // detectarla, todos los movimientos entraban como ingresos.
  if (cols.signo < 0) {
    for (let c = 0; c < nCols; c++) {
      if ([cols.date, cols.date2, cols.amount, cols.cargo, cols.abono, cols.saldo].includes(c)) continue;
      const vals = sample.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
      // Con los dos signos presentes: una columna de «-» de relleno no es una columna de signo.
      if (vals.length >= n * 0.8 && vals.every((v) => SIGNO_RE.test(v)) && new Set(vals.map((v) => SIGNO_NEG.test(v))).size === 2) { cols.signo = c; break; }
    }
  }
  if (cols.concept < 0) {
    let best = -1, bestLen = -1;
    stats.forEach((s, i) => {
      if (i === cols.date || i === cols.date2 || i === cols.amount || i === cols.cargo || i === cols.abono || i === cols.saldo || i === cols.signo) return;
      if (s.textLen > bestLen) { best = i; bestLen = s.textLen; }
    });
    cols.concept = best;
  }
  const ok = cols.date >= 0 && cols.concept >= 0 && (cols.amount >= 0 || cols.cargo >= 0 || cols.abono >= 0);
  return { headerIdx, dataStart, cols, nCols, ok, headers: headerIdx >= 0 ? rows[headerIdx] : null };
}

function buildMovements(rows, dataStart, cols, fileName) {
  const movs = [];
  let skipped = 0;
  const saldoSeq = [];
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    // Filtro opcional: omitir filas donde una columna elegida esté vacía. Útil, p. ej., en
    // PayPal, donde las filas de "Depósito bancario"/"Conversión" (fontanería que duplica)
    // llevan el Nombre vacío, mientras que los pagos reales sí lo tienen.
    if (cols.skipEmptyCol >= 0 && !String(r[cols.skipEmptyCol] ?? "").trim()) { skipped++; continue; }
    // Filtro opcional: importar SOLO filas donde una columna coincide con un valor (p. ej.
    // Divisa = EUR, para no mezclar importes en otras monedas sin convertir).
    if (cols.keepCol >= 0 && String(cols.keepVal ?? "").trim() && String(r[cols.keepCol] ?? "").trim().toLowerCase() !== String(cols.keepVal).trim().toLowerCase()) { skipped++; continue; }
    const date = parseDateAny(r[cols.date]);
    if (!date) { skipped++; continue; }
    let amount = null;
    if (cols.amount >= 0) amount = parseEsNumber(r[cols.amount]);
    if (amount === null && (cols.cargo >= 0 || cols.abono >= 0)) {
      const cg = cols.cargo >= 0 ? parseEsNumber(r[cols.cargo]) : null;
      const ab = cols.abono >= 0 ? parseEsNumber(r[cols.abono]) : null;
      if (cg !== null || ab !== null) {
        const exp = cg !== null ? (cg < 0 ? cg : -cg) : 0;
        amount = (ab !== null ? Math.abs(ab) : 0) + exp;
      }
    }
    if (amount === null) { skipped++; continue; }
    if (cols.signo >= 0) {
      const sg = String(r[cols.signo] ?? "").trim();
      if (SIGNO_RE.test(sg)) amount = SIGNO_NEG.test(sg) ? -Math.abs(amount) : Math.abs(amount);
    }
    const concept = String(r[cols.concept] || "").replace(/\s+/g, " ").trim() || "Sin concepto";
    const saldo = cols.saldo >= 0 ? parseEsNumber(r[cols.saldo]) : null;
    saldoSeq.push({ saldo, amount });
    movs.push({
      date, concept, amount, saldo, pattern: normalizePattern(concept), file: fileName,
      category: null, assetName: undefined, splits: null, groupIds: [], confirmed: false,
    });
  }
  let mismatches = null;
  if (cols.saldo >= 0 && saldoSeq.length > 2) {
    let fwd = 0, bwd = 0, checked = 0;
    for (let i = 0; i + 1 < saldoSeq.length; i++) {
      const a = saldoSeq[i], b = saldoSeq[i + 1];
      if (a.saldo === null || b.saldo === null) continue;
      checked++;
      if (Math.abs(a.saldo - b.saldo - a.amount) > 0.02) fwd++;
      if (Math.abs(b.saldo - a.saldo - b.amount) > 0.02) bwd++;
    }
    if (checked > 0) mismatches = Math.min(fwd, bwd);
  }
  return { movs, skipped, mismatches };
}

/* ============================================================
   IDENTIDAD Y DEDUPLICACIÓN DE MOVIMIENTOS
   ============================================================ */
/* Clave de identidad. Dos decisiones deliberadas:
   · Día LOCAL. toISOString() pasa a UTC y en España mandaría los cargos de madrugada
     al día anterior.
   · Patrón normalizado, no el concepto crudo. Los bancos cambian el texto entre
     exportaciones (añaden un número de referencia, mueven un espacio) y el mismo
     cargo se colaba dos veces. normalizePattern ya limpia dígitos y ruido. */
const movKey = (m) =>
  `${m.date.getFullYear()}-${m.date.getMonth()}-${m.date.getDate()}|${m.amount.toFixed(2)}|${m.pattern}`;

/* Deduplicación como MULTICONJUNTO, no como conjunto. Dos cargos realmente idénticos
   —dos cafés de 1,60 € el mismo día en el mismo bar— son dos gastos, no un duplicado:
   contamos cuántas veces existe ya cada clave y solo descartamos esas primeras
   repeticiones. Con un Set, el segundo café desaparecía sin avisar.
   Pura y testeable: no toca estado ni React. */
function dedupeAgainst(existingMovs, parsed) {
  const have = new Map();
  for (const m of existingMovs) { const k = movKey(m); have.set(k, (have.get(k) || 0) + 1); }

  // Segunda red, para cargar historico que solapa con lo que ya bajo la conexion bancaria.
  // El banco escribe OTRO texto para el mismo cargo (el nombre de la contraparte, no la frase
  // del extracto) y a veces otra fecha (contable vs valor), asi que `movKey` no casa nunca y
  // el CSV duplicaria todo el solape. Se empareja por importe y +-4 dias, que es el mismo
  // criterio que ya usa la ingesta bancaria contra el historico manual, pero al reves.
  const DAY = 86400000;
  const delBanco = new Map(); // centimos -> [{ t, usado }]
  for (const m of existingMovs) {
    if (!m.bankId) continue;
    const cents = Math.round((Number(m.amount) || 0) * 100);
    const t = (m.date instanceof Date ? m.date : new Date(m.date)).getTime();
    if (isNaN(t)) continue;
    if (!delBanco.has(cents)) delBanco.set(cents, []);
    delBanco.get(cents).push({ t, usado: false });
  }
  // Multiconjunto tambien aqui: cada cargo bancario solo puede tapar UN movimiento del CSV,
  // para que dos retiradas reales de 50 EUR en la misma semana no se coman la una a la otra.
  const yaLoTraeElBanco = (m) => {
    const arr = delBanco.get(Math.round((Number(m.amount) || 0) * 100));
    if (!arr) return false;
    const t = m.date.getTime();
    const hit = arr.find((x) => !x.usado && Math.abs(x.t - t) <= 4 * DAY);
    if (!hit) return false;
    hit.usado = true;
    return true;
  };

  const seen = new Map();
  const fresh = [];
  let dupes = 0;
  for (const m of parsed) {
    const k = movKey(m);
    const used = seen.get(k) || 0;
    seen.set(k, used + 1);
    if (used < (have.get(k) || 0)) { dupes++; continue; } // ya estaba: reimportación
    if (yaLoTraeElBanco(m)) { dupes++; continue; }        // ya lo bajo el banco, con otro texto
    fresh.push(m);
  }
  return { fresh, dupes };
}

/* ============================================================
   DATOS DE EJEMPLO (incluye un grupo "maratones" reconocible)
   ============================================================ */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function toEsNum(n) {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return (neg ? "-" : "") + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}
function genSampleCSV() {
  const rnd = mulberry32(20260612);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const movs = [];
  const add = (y, m, d, c, a) => movs.push({ d: new Date(y, m, d), c, a: Math.round(a * 100) / 100 });
  const months = [];
  for (let i = 0; i < 14; i++) months.push([2025 + Math.floor((3 + i) / 12), (3 + i) % 12]);
  for (const [y, m] of months) {
    add(y, m, 1, "TRANSFERENCIA NOMINA INGENIERIA CASTELLANA SL", 2480);
    add(y, m, 4, "TRANSFERENCIA RECIBIDA PEREZ LOPEZ M ALQUILER PLAZA GARAJE", 95);
    add(y, m, 9, "PADEL INDOOR CENTER RESERVA PISTA", -14.5);
    if (y === 2026 && m === 4) { // posible doble cobro (demo de avisos): mismo importe con 2 días de diferencia
      add(y, m, 20, "PAGO MOVIL EN FNAC CALLAO MADRID", -49.9);
      add(y, m, 22, "PAGO MOVIL EN FNAC CALLAO MADRID", -49.9);
    }
    add(y, m, 1, "RECIBO PRESTAMO HIPOTECARIO CUOTA 0182-3341", -642.5);
    add(y, m, 2, "RECIBO COMUNIDAD PROPIETARIOS EDIF. GARDENIA", -(y >= 2026 ? 92 : 88));
    add(y, m, 3, "RECIBO MOVISTAR FIBRA Y MOVIL", -(y > 2026 || (y === 2026 && m >= 1) ? 56.9 : 52.9));
    add(y, m, 5, "NETFLIX.COM 866-579-7172", -(y >= 2026 ? 15.49 : 13.99));
    add(y, m, 6, "SPOTIFY P2B4F91C33", -10.99);
    add(y, m, 6, "PAYPAL *OPENAI CHATGPT", -22);
    add(y, m, 7, "RECIBO IBERDROLA CLIENTES SAU LUZ", -(46 + rnd() * 38 + ([11, 0, 1].includes(m) ? 22 : 0)));
    if (m % 2 === 0) add(y, m, 15, "CANAL DE ISABEL II AGUA BIMESTRAL", -(27 + rnd() * 12));
    add(y, m, 8, "RECIBO NATURGY IBERIA GAS", -([10, 11, 0, 1, 2].includes(m) ? 55 + rnd() * 30 : 14 + rnd() * 8));
    add(y, m, 10, "BASIC-FIT ESPANA CUOTA MENSUAL", -(y > 2026 || (y === 2026 && m >= 2) ? 27.99 : 29.99));
    const nSuper = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < nSuper; i++)
      add(y, m, 2 + Math.floor(rnd() * 26), `COMPRA TARJETA ${pick(["MERCADONA MADRID", "MERCADONA MADRID", "LIDL VALLECAS", "CARREFOUR EXPRESS", "ALDI RETIRO"])} ${Math.floor(rnd() * 9000)}`, -(16 + rnd() * 72));
    for (let i = 0; i < 2 + (rnd() > 0.6 ? 1 : 0); i++)
      add(y, m, 3 + Math.floor(rnd() * 24), `PAGO MOVIL EN ${pick(["REPSOL ESTACION 4421", "CEPSA E.S. ARGANDA", "BALLENOIL GETAFE"])}`, -(44 + rnd() * 26));
    for (let i = 0; i < 3 + Math.floor(rnd() * 4); i++)
      add(y, m, 1 + Math.floor(rnd() * 27), pick(["BAR CASA PACO", "RESTAURANTE LA TAGLIATELLA", "GLOVO MADRID", "MCDONALDS GRAN VIA", "STARBUCKS SOL", "TABERNA EL ANZUELO", "GOIKO GRILL"]), -(8 + rnd() * 42));
    for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++)
      add(y, m, 4 + Math.floor(rnd() * 22), "EMPARK APARCAMIENTO CENTRO", -(2.2 + rnd() * 6));
    if (rnd() > 0.4) add(y, m, 12, "FARMACIA LDA. LOPEZ HERRANZ", -(5 + rnd() * 22));
    for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++)
      add(y, m, 6 + Math.floor(rnd() * 20), `AMAZON.ES*${Math.floor(rnd() * 90000)}`, -(11 + rnd() * 55));
    if (rnd() > 0.5) add(y, m, 14, "ZARA ESPANA MADRID", -(22 + rnd() * 58));
    if (rnd() > 0.45) add(y, m, 17, pick(["CINESA PROYECCIONES", "STEAMGAMES.COM 4259", "YELMO CINES IDEAL"]), -(9 + rnd() * 28));
    add(y, m, 19, "KIWOKO TIENDA ANIMALES", -(14 + rnd() * 22));
    if (rnd() > 0.55) add(y, m, 21, "REINTEGRO CAJERO PLAZA MAYOR", -50);
    if (rnd() > 0.6) add(y, m, 23, "BIZUM A JUAN P. CENA", -(15 + rnd() * 30));
    if (rnd() > 0.75) add(y, m, 24, "BIZUM DE MARIA G. REGALO", 20 + rnd() * 25);
    if (rnd() > 0.6) add(y, m, 25, "PANADERIA LA ESPIGA DE ORO", -(3 + rnd() * 6));
    if (rnd() > 0.7) add(y, m, 9, "DECATHLON ALCORCON", -(18 + rnd() * 60));
  }
  // Recibos anuales / puntuales
  add(2025, 8, 14, "ADEUDO MAPFRE SEGURO AUTOMOVIL POLIZA 99821", -487.6);
  add(2025, 5, 9, "ADEUDO OCASO SEGURO HOGAR POLIZA 1182", -214.35);
  add(2025, 9, 5, "AYUNTAMIENTO DE MADRID IBI URBANA", -342.18);
  add(2026, 3, 12, "AYUNTAMIENTO DE MADRID IVTM IMPUESTO VEHICULOS", -98.4);
  add(2025, 10, 20, "ITV ESTACION VILLAVERDE", -45.8);
  add(2026, 1, 8, "TALLER HERMANOS RUIZ NEUMATICOS Y REVISION", -312.4);
  add(2025, 10, 2, "CLINICA VETERINARIA SUR VACUNAS", -86.5);
  add(2026, 2, 28, "CLINICA VETERINARIA SUR REVISION", -64);
  add(2025, 11, 18, "EL CORTE INGLES REGALOS NAVIDAD", -156.3);
  add(2026, 0, 7, "COMISION MANTENIMIENTO CUENTA", -12);
  // — Maratón de Valencia (nov 2025): inscripción, zapatillas, hotel, tren, cena
  add(2025, 9, 28, "DECATHLON ALCORCON ZAPATILLAS RUNNING", -129.99);
  add(2025, 10, 1, "SPORTMANIACS INSCRIPCION MARATON VALENCIA", -89);
  add(2025, 10, 14, "RENFE AVE MADRID VALENCIA", -78.4);
  add(2025, 10, 15, "BOOKING.COM HOTEL VALENCIA CENTRO", -184.5);
  add(2025, 10, 16, "RESTAURANTE LA PEPICA VALENCIA", -64.2);
  // — Maratón de Sevilla (feb 2026)
  add(2026, 1, 10, "SPORTMANIACS INSCRIPCION MARATON SEVILLA", -82);
  add(2026, 1, 20, "RENFE AVE MADRID SEVILLA", -95.6);
  add(2026, 1, 21, "AIRBNB SEVILLA TRIANA", -142);
  add(2026, 1, 1, "DECATHLON ALCORCON CAMISETA TECNICA", -34.99);

  // La demo se escribió de abril de 2025 a mayo de 2026. Se desplaza entera para que termine el
  // mes pasado: con fechas fijas, con el tiempo parecía antigua y «el mes actual» salía vacío.
  const hoy = new Date();
  const desplazar = (hoy.getFullYear() * 12 + hoy.getMonth() - 1) - (2026 * 12 + 4);
  for (const mv of movs) {
    const y = mv.d.getFullYear(), m = mv.d.getMonth() + desplazar, dia = mv.d.getDate();
    const ultimo = new Date(y, m + 1, 0).getDate();
    mv.d = new Date(y, m, Math.min(dia, ultimo));
  }
  movs.sort((a, b) => a.d - b.d);
  let saldo = 6200;
  for (const mv of movs) { saldo = Math.round((saldo + mv.a) * 100) / 100; mv.s = saldo; }
  movs.reverse();
  const lines = [
    "BANCO EJEMPLO DE ESPAÑA;;;;",
    "Titular: LAURA GARCÍA PÉREZ;;;;",
    "IBAN: ES21 0049 0001 5021 3456 7890;;;;",
    `Saldo a fecha ${fmtDate(movs[0].d)}: ${toEsNum(saldo)} EUR;;;;`,
    ";;;;",
    "Fecha operación;Fecha valor;Concepto;Importe;Saldo",
  ];
  for (const mv of movs) {
    const f = fmtDate(mv.d);
    const concept = mv.c.includes(";") ? `"${mv.c}"` : mv.c;
    lines.push(`${f};${f};${concept};${toEsNum(mv.a)};${toEsNum(mv.s)}`);
  }
  lines.push(`;;Total movimientos: ${movs.length};;`);
  return lines.join("\n");
}

// Grupos de ejemplo que se crean al cargar la muestra
const SAMPLE_GROUPS = [
  { id: "g_maraton", name: "Maratones", emoji: "🏃", color: GROUP_COLORS[0], keywords: ["MARATON", "INSCRIPCION MARATON", "ZAPATILLAS RUNNING"], movementIds: [] },
];

/* ============================================================
   RECURRENTES
   ============================================================ */
function detectRecurring(movs) {
  const groups = new Map();
  for (const m of movs) {
    if (m.amount >= 0 || m.extra) continue;
    if (!groups.has(m.pattern)) groups.set(m.pattern, []);
    groups.get(m.pattern).push(m);
  }
  const out = [];
  for (const [pattern, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);
    const amounts = list.map((m) => -m.amount);
    const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const max = Math.max(...amounts), min = Math.min(...amounts);
    const stable = min > 0 && max / min <= 1.7;
    const intervals = [];
    for (let i = 1; i < list.length; i++) intervals.push((list[i].date - list[i - 1].date) / 86400000);
    intervals.sort((a, b) => a - b);
    const med = intervals[Math.floor(intervals.length / 2)];
    let cadence = null, perYear = 0;
    if (med >= 5 && med <= 9 && list.length >= 5) { cadence = "semanal"; perYear = 52; }
    else if (med >= 24 && med <= 38 && list.length >= 3) { cadence = "mensual"; perYear = 12; }
    else if (med >= 50 && med <= 75 && list.length >= 3) { cadence = "bimestral"; perYear = 6; }
    else if (med >= 80 && med <= 100 && list.length >= 2) { cadence = "trimestral"; perYear = 4; }
    else if (med >= 165 && med <= 200 && list.length >= 2) { cadence = "semestral"; perYear = 2; }
    else if (med >= 320 && med <= 410 && list.length >= 2) { cadence = "anual"; perYear = 1; }
    if (!cadence || !stable) continue;
    out.push({
      pattern, label: list[list.length - 1].concept,
      category: list[list.length - 1].category || "Otros",
      cadence, count: list.length, avgAmount: mean, annual: mean * perYear,
      lastDate: list[list.length - 1].date,
    });
  }
  return out.sort((a, b) => b.annual - a.annual);
}

/* ============================================================
   PRÓXIMOS CARGOS (estimación tipo «agenda de recibos»)
   Proyecta cada recurrente a su siguiente fecha típica desde el
   último día con datos. Importe: último cargo (recoge subidas);
   para recibos variables (luz, gas…), media de los 3 últimos.
   ============================================================ */
const CADENCE_MONTHS = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
const PERYEAR_MONTHS = { 12: 1, 6: 2, 4: 3, 2: 6, 1: 12 };

function nextByMonths(lastDate, stepM, typicalDay, base) {
  let y = lastDate.getFullYear(), mo = lastDate.getMonth();
  for (let i = 0; i < 40; i++) {
    mo += stepM; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    const dim = new Date(y, mo + 1, 0).getDate();
    const d = new Date(y, mo, Math.min(typicalDay, dim));
    if (d > base) return d;
  }
  return null;
}

function upcomingCharges(movs, recurring, receiptTrends, baseDate, horizonDays = 31) {
  if (!baseDate) return { items: [], total: 0, horizonDays, base: null };
  const end = new Date(baseDate.getTime() + horizonDays * 86400000);
  const byPattern = new Map();
  for (const m of movs) {
    if (m.amount >= 0 || m.extra) continue;
    if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, []);
    byPattern.get(m.pattern).push(m);
  }
  for (const list of byPattern.values()) list.sort((a, b) => a.date - b.date);
  const typicalDayOf = (list) => {
    const days = list.map((m) => m.date.getDate()).sort((a, b) => a - b);
    return days[Math.floor(days.length / 2)];
  };
  const items = [];
  const seen = new Set();
  const push = (date, r, amount, variable) => {
    items.push({ date, label: r.label, pattern: r.pattern, category: r.category, amount: Math.round(amount * 100) / 100, cadence: r.cadence || "mensual", variable: !!variable });
    seen.add(r.pattern);
  };
  // 1) Recurrentes de importe estable: siguiente fecha + último importe.
  //    Solo categorías de cargo domiciliado/cuota: repostar cada mes no es un recibo.
  const UPCOMING_CATS = new Set([...RECEIPT_CATS, "Deporte", "Salud", "Transporte", "Mascota"]);
  for (const r of recurring) {
    if (!UPCOMING_CATS.has(r.category)) continue;
    const list = byPattern.get(r.pattern);
    if (!list || !list.length) continue;
    const last = list[list.length - 1];
    const lastAmount = -last.amount;
    if (r.cadence === "semanal") {
      let d = new Date(last.date.getTime());
      let guard = 0;
      while (d <= baseDate && guard++ < 120) d = new Date(d.getTime() + 7 * 86400000);
      while (d && d <= end) { push(new Date(d), r, lastAmount, false); d = new Date(d.getTime() + 7 * 86400000); }
      continue;
    }
    const stepM = CADENCE_MONTHS[r.cadence];
    if (!stepM) continue;
    const d = nextByMonths(last.date, stepM, typicalDayOf(list), baseDate);
    if (d && d <= end) push(d, r, lastAmount, false);
  }
  // 2) Recibos variables (luz, gas…) que la detección de estables descarta
  for (const t of receiptTrends) {
    if (t.kind !== "variable" || seen.has(t.pattern)) continue;
    const stepM = PERYEAR_MONTHS[t.perYear];
    if (!stepM) continue;
    const list = byPattern.get(t.pattern);
    if (!list || !list.length) continue;
    const last = list[list.length - 1];
    const serie = t.serie || [];
    const lastN = serie.slice(-3);
    const est = lastN.length ? lastN.reduce((s, v) => s + v, 0) / lastN.length : -last.amount;
    const d = nextByMonths(last.date, stepM, typicalDayOf(list), baseDate);
    if (d && d <= end) push(d, { label: t.label, pattern: t.pattern, category: t.category, cadence: stepM === 1 ? "mensual" : "periódico" }, est, true);
  }
  items.sort((a, b) => a.date - b.date);
  return { items, total: Math.round(items.reduce((s, x) => s + x.amount, 0) * 100) / 100, horizonDays, base: baseDate };
}

/* ============================================================
   EXPORTACIÓN A CALENDARIO (.ics)
   Un iPhone no puede recibir notificaciones push sin un servidor detrás. Pero sí
   sabe avisarte de un evento de calendario. Volcamos los cargos previstos como
   eventos de día completo con una alarma la víspera y que el calendario haga
   de recordatorio: cero infraestructura y funciona sin conexión.
   ============================================================ */
const icsDay = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
// RFC 5545: escapar \ ; , y saltos de línea; y plegar las líneas a 75 octetos.
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
// El límite del RFC son 75 OCTETOS, no caracteres: con "€" o "ó" (multibyte en UTF-8)
// contar caracteres se pasa de largo. Iteramos por puntos de código para no partir
// ninguno por la mitad. Partir un escape "\," entre líneas es inocuo: al desplegar,
// el lector quita el CRLF y el espacio, y el par se recompone.
const icsFold = (line) => {
  const enc = new TextEncoder();
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = " "; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
};
function buildICS(items, { alarmDaysBefore = 1 } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mis finanzas//Cargos previstos//ES",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Cargos previstos",
  ];
  items.forEach((it, i) => {
    const end = new Date(it.date.getTime() + 86400000); // DTEND es exclusivo en eventos de día completo
    lines.push(
      "BEGIN:VEVENT",
      `UID:finz-${icsDay(it.date)}-${i}@mis-finanzas`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(it.date)}`,
      `DTEND;VALUE=DATE:${icsDay(end)}`,
      icsFold(`SUMMARY:${icsText(`${fmtE0(it.amount)} · ${it.label.slice(0, 40)}`)}`),
      icsFold(`DESCRIPTION:${icsText(`Cargo ${it.variable ? "estimado" : "previsto"} de ${fmtE(it.amount)} (${it.cadence}). Estimación a partir de tu histórico.`)}`),
      "BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-P${alarmDaysBefore}D`,
      icsFold(`DESCRIPTION:${icsText(`Mañana: ${it.label.slice(0, 40)}`)}`),
      "END:VALARM", "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/* Avisos inteligentes: dobles cobros, presupuestos al límite, subidas recientes y atípicos.
   Función pura y testeable; la UI solo pinta lo que salga de aquí. */
function buildAlerts({ movs, budgets, receiptTrends, outliers }) {
  const alerts = [];
  if (!movs || !movs.length) return alerts;
  let lastDate = movs[0].date;
  for (const m of movs) if (m.date > lastDate) lastDate = m.date;
  const since = (days) => new Date(lastDate.getTime() - days * 86400000);

  // 0) Muchos movimientos sin clasificar: afecta a la fiabilidad de todo lo demás
  // 0) Movimientos por revisar (no confirmados): afectan a la fiabilidad de todo lo demás
  const sinClasif = movs.filter((m) => m.confirmed === false);
  if (sinClasif.length >= 1) {
    const gasto = sinClasif.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0);
    alerts.push({
      sev: sinClasif.length >= 8 ? "media" : "baja", kind: "sin_clasificar",
      titulo: `${nfNum.format(sinClasif.length)} ${sinClasif.length === 1 ? "movimiento por revisar" : "movimientos por revisar"}`,
      detalle: `${fmtE0(gasto)} sin confirmar. Revísalos para afinar categorías, presupuestos y avisos.`,
      openPending: true,
    });
  }

  // 1) Posibles cobros duplicados: mismo comercio e importe con ≤2 días de diferencia (60 días, ≥15 €)
  const cut60 = since(60);
  const byPat = new Map();
  for (const m of movs) {
    if (m.amount >= 0 || Math.abs(m.amount) < 15 || m.date < cut60) continue;
    const k = m.pattern + "|" + Math.abs(m.amount).toFixed(2);
    if (!byPat.has(k)) byPat.set(k, []);
    byPat.get(k).push(m);
  }
  const dups = [];
  for (const list of byPat.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);
    for (let i = 1; i < list.length; i++) {
      const dd = (list[i].date - list[i - 1].date) / 86400000;
      if (dd > 0 && dd <= 2) { dups.push([list[i - 1], list[i]]); break; }
    }
  }
  for (const [a, b] of dups.slice(0, 2)) {
    alerts.push({
      sev: "alta", kind: "duplicado",
      titulo: "Posible cargo duplicado",
      detalle: `${a.concept.slice(0, 38)}: ${fmtE0(Math.abs(a.amount))} el ${fmtDate(a.date)} y el ${fmtDate(b.date)}. Comprueba si te han cobrado dos veces.`,
      drill: { type: "pattern", key: a.pattern, label: a.concept.slice(0, 42) },
    });
  }

  // 1.5) Ingresos recurrentes que no han llegado (alquiler que no entra, nómina que se retrasa)
  for (const mi of missingIncome(movs, lastDate).slice(0, 3)) {
    alerts.push({
      sev: "alta", kind: "ingreso_falta",
      titulo: `No ha llegado un ingreso previsto`,
      detalle: `${mi.label.slice(0, 34)}: esperabas ~${fmtE0(mi.amount)} hacia el ${fmtDate(mi.esperado)} y aún no consta (${mi.diasRetraso} días de retraso).`,
      drill: { type: "pattern", key: mi.pattern, label: mi.label.slice(0, 42) },
    });
  }

  // 2) Presupuestos del último mes con datos: superados (alta) o al 90 % (media)
  const mesKey = monthKey(lastDate);
  const entries = Object.entries(budgets || {}).filter(([, v]) => v > 0);
  if (entries.length) {
    const gastoMes = new Map();
    for (const m of movs) {
      if (m.extra || monthKey(m.date) !== mesKey) continue;
      const parts = m.splits?.length ? m.splits.map((s) => ({ cat: s.cat, amount: (m.amount * s.pct) / 100 })) : [{ cat: m.category || "Otros", amount: m.amount }];
      for (const p of parts) { if (p.amount >= 0) continue; gastoMes.set(p.cat, (gastoMes.get(p.cat) || 0) - p.amount); }
    }
    const scored = entries
      .map(([cat, b]) => ({ cat, b, g: gastoMes.get(cat) || 0, pct: (gastoMes.get(cat) || 0) / b }))
      .filter((x) => x.pct >= 0.9)
      .sort((a, b) => b.pct - a.pct);
    for (const x of scored.slice(0, 3)) {
      alerts.push({
        sev: x.pct >= 1 ? "alta" : "media", kind: "presupuesto",
        titulo: x.pct >= 1 ? `Presupuesto de ${x.cat} superado` : `Presupuesto de ${x.cat} al ${Math.round(x.pct * 100)} %`,
        detalle: `${fmtE0(x.g)} de ${fmtE0(x.b)} este mes${x.pct >= 1 ? ` (+${fmtE0(x.g - x.b)} de más)` : ""}.`,
        drill: { type: "cat", key: x.cat, label: x.cat },
      });
    }
  }

  // 3) Subida reciente de un recibo fijo (Δ mes ≥3 % en el último mes, o Δ año ≥5 %)
  const subidas = (receiptTrends || [])
    .filter((t) => t.kind === "fijo" && ((t.lastMonth === mesKey && t.deltaMoM !== null && t.deltaMoM >= 0.03) || (t.deltaYoY !== null && t.deltaYoY >= 0.05)))
    .sort((a, b) => Math.abs(b.annualImpact) - Math.abs(a.annualImpact));
  for (const t of subidas.slice(0, 2)) {
    const d = t.lastMonth === mesKey && t.deltaMoM !== null && t.deltaMoM >= 0.03 ? t.deltaMoM : t.deltaYoY;
    alerts.push({
      sev: "media", kind: "subida",
      titulo: `${t.label.slice(0, 34)} ha subido`,
      detalle: `+${fmtPct(d)} · ahora ${fmtE0(t.last)} (~${t.annualImpact > 0 ? "+" : ""}${fmtE0(t.annualImpact)}/año).`,
      drill: { type: "pattern", key: t.pattern, label: t.label.slice(0, 42) },
    });
  }

  // 4) Gastos atípicos en los últimos 31 días
  const cut31 = since(31);
  const atip = movs.filter((m) => outliers?.has?.(m.id) && m.date >= cut31).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  for (const m of atip.slice(0, 2)) {
    alerts.push({
      sev: "media", kind: "atipico",
      titulo: "Gasto atípico reciente",
      detalle: `${m.concept.slice(0, 38)}: ${fmtE0(Math.abs(m.amount))}, muy por encima de lo habitual en ${m.category || "su categoría"}.`,
      drill: { type: "pattern", key: m.pattern, label: m.concept.slice(0, 42) },
    });
  }

  const SEV = { alta: 0, media: 1, baja: 2 }; // antes: (media, baja) y (baja, media) daban ambos 1 y el orden salía al azar
  alerts.sort((a, b) => (SEV[a.sev] ?? 3) - (SEV[b.sev] ?? 3));
  // Id estable por aviso, para poder marcarlo como visto y que no reaparezca.
  for (const a of alerts) a.id = `${a.kind}|${a.drill?.key ?? a.titulo}`;
  return alerts.slice(0, 5);
}

/* ============================================================
   MEMORIA Y PREDICCIÓN DE CLASIFICACIÓN
   Motor local (sin servidor) que aprende de los movimientos ya
   clasificados y predice la categoría de los nuevos combinando:
     · Entidad de comercio (normaliza "MERCADONA 4021 MADRID" y
       "MERCADONA VALENCIA" a la misma entidad) con match por tokens.
     · Importe recurrente (un cargo que coincide con el importe de un
       recibo/entidad conocido es ese, aunque el texto venga corrupto).
     · Un clasificador Naive Bayes sobre señales (tokens del comercio,
       tramo de importe, día de la semana, fase del mes, signo).
     · Priors de población (heurísticas) mezclados bayesianamente con
       la evidencia personal, desplazándose hacia lo del usuario según
       acumula datos.
     · Abstención: si la confianza no llega al umbral, deja "Otros"
       en vez de adivinar.
   Todo se recalcula a partir de los movimientos; no se persiste aparte.
   ============================================================ */
const AMOUNT_BUCKET = (abs) =>
  abs < 5 ? "0-5" : abs < 15 ? "5-15" : abs < 30 ? "15-30" : abs < 60 ? "30-60" :
  abs < 120 ? "60-120" : abs < 300 ? "120-300" : abs < 700 ? "300-700" : "700+";
const isWeekend = (d) => { const w = d.getDay(); return w === 0 || w === 6; };
const monthPhase = (d) => { const day = d.getDate(); return day <= 5 ? "inicio" : day >= 25 ? "fin" : "medio"; };

// Categorías que NO conviene inferir sin señal explícita del nombre.
const NO_INFER = new Set(["Otros", "Bizum", "Traspasos entre cuentas", "Efectivo", "Impuestos", "Seguros"]);

// --- Entidad de comercio: la parte estable del nombre, para agrupar variantes ---
const ENTITY_STOP = new Set(["DE", "LA", "EL", "LOS", "LAS", "SL", "SA", "SLU", "SAU", "COM", "ES", "MADRID", "BARCELONA", "ESPANA", "SPAIN", "CALLE", "AV", "AVDA", "TIENDA", "COMPRA", "PAGO", "MOVIL", "TARJETA", "RECIBO", "ADEUDO", "EN"]);
function merchantTokens(pattern) {
  // normalizePattern quita prefijos de pasarela/pago (PAYPAL *, COMPRA TARJ., BIZUM…) y ruido;
  // es idempotente, así que da igual recibir el concepto crudo o el patrón ya normalizado.
  return stripAccents(normalizePattern(String(pattern || "")).toUpperCase())
    .split(/[^A-Z0-9]+/).filter((t) => t.length >= 3 && !ENTITY_STOP.has(t) && !/^\d+$/.test(t));
}
// Entidad = marca principal. Si el primer token significativo es distintivo (≥5 letras),
// basta con él ("MERCADONA"); si es corto/genérico se añade el segundo ("CORTE INGLES").
function merchantEntity(pattern) {
  const toks = merchantTokens(pattern);
  if (!toks.length) return stripAccents(normalizePattern(String(pattern || "")).toUpperCase()).slice(0, 16).trim() || "DESCONOCIDO";
  if (toks[0].length >= 5) return toks[0];
  return toks.slice(0, 2).join(" ");
}
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
};

// --- Modelo Naive Bayes + índice de entidades e importes recurrentes ---
function buildBehaviorModel(movs) {
  const confirmed = movs.filter((m) => m.category && m.category !== "Otros" && !m.splits);
  const catCount = new Map();           // categoría -> nº de movimientos (prior personal)
  const featCount = new Map();          // "feat=valor|cat" -> conteo
  const featTotalsByCat = new Map();    // "feat|cat" -> total (para suavizado)
  const featVocab = new Map();          // "feat" -> set de valores distintos (para Laplace)
  const entityCat = new Map();          // entidad -> Map(cat -> conteo)  (memoria por comercio)
  const entityTokenSets = new Map();    // entidad -> set de tokens representativo (fuzzy)
  const amountCat = new Map();          // importe redondeado|signo -> Map(cat -> conteo) (importe recurrente)

  const bumpMap = (map, key, cat) => {
    if (!map.has(key)) map.set(key, new Map());
    const inner = map.get(key);
    inner.set(cat, (inner.get(cat) || 0) + 1);
  };
  const addFeat = (feat, value, cat) => {
    const k = `${feat}=${value}|${cat}`;
    featCount.set(k, (featCount.get(k) || 0) + 1);
    const tk = `${feat}|${cat}`;
    featTotalsByCat.set(tk, (featTotalsByCat.get(tk) || 0) + 1);
    if (!featVocab.has(feat)) featVocab.set(feat, new Set());
    featVocab.get(feat).add(value);
  };

  for (const m of confirmed) {
    const cat = m.category;
    catCount.set(cat, (catCount.get(cat) || 0) + 1);
    const sign = m.amount >= 0 ? "in" : "out";
    const bucket = AMOUNT_BUCKET(Math.abs(m.amount));
    const wknd = isWeekend(m.date) ? "we" : "wd";
    const phase = monthPhase(m.date);
    addFeat("sign", sign, cat);
    addFeat("bucket", bucket, cat);
    addFeat("wknd", wknd, cat);
    addFeat("phase", phase, cat);
    // En una transferencia el texto no identifica el motivo: solo cuentan importe y fechas.
    if (!needsAmount(m)) {
      const toks = merchantTokens(m.pattern);
      for (const t of new Set(toks)) addFeat("tok", t, cat);
      const ent = merchantEntity(m.pattern);
      bumpMap(entityCat, ent, cat);
      if (!entityTokenSets.has(ent)) entityTokenSets.set(ent, new Set(toks));
      else for (const t of toks) entityTokenSets.get(ent).add(t);
    }

    // Importe recurrente solo tiene sentido para cargos de cierta magnitud
    if (Math.abs(m.amount) >= 8) bumpMap(amountCat, `${Math.round(Math.abs(m.amount))}|${sign}`, cat);
  }

  const N = confirmed.length;
  return { N, catCount, featCount, featTotalsByCat, featVocab, entityCat, entityTokenSets, amountCat };
}

// Priors de población (día 1, sin historial). Devuelven {cat, conf} o null.
function defaultHeuristic(m) {
  const abs = Math.abs(m.amount);
  const phase = monthPhase(m.date);
  const p = stripAccents((m.pattern + " " + m.concept).toUpperCase());
  const isBizum = /(^|[^A-Z])BIZUM([^A-Z]|$)/.test(p);
  if (m.amount > 0) {
    if (abs >= 250 && abs <= 2000 && (phase === "inicio" || phase === "fin") && !isBizum) return { cat: "Alquileres cobrados", conf: 0.45 };
    return null;
  }
  if (isBizum && abs >= 250 && phase === "inicio") return { cat: "Vivienda", conf: 0.4 };
  if (isWeekend(m.date) && abs >= 10 && abs <= 80) return { cat: "Restauración", conf: 0.35 };
  return null;
}

// Núcleo Naive Bayes: devuelve ranking [{cat, p}] ya normalizado.
function naiveBayesScores(model, m) {
  const { N, catCount, featCount, featTotalsByCat, featVocab } = model;
  if (!N) return [];
  const sign = m.amount >= 0 ? "in" : "out";
  const bucket = AMOUNT_BUCKET(Math.abs(m.amount));
  const wknd = isWeekend(m.date) ? "we" : "wd";
  const phase = monthPhase(m.date);
  const toks = needsAmount(m) ? [] : [...new Set(merchantTokens(m.pattern))];
  const feats = [["sign", sign], ["bucket", bucket], ["wknd", wknd], ["phase", phase], ...toks.map((t) => ["tok", t])];

  const logs = [];
  for (const [cat, cN] of catCount) {
    if (NO_INFER.has(cat)) continue;
    // log-prior
    let lp = Math.log(cN / N);
    for (const [feat, value] of feats) {
      const c = featCount.get(`${feat}=${value}|${cat}`) || 0;
      const total = featTotalsByCat.get(`${feat}|${cat}`) || 0;
      const V = (featVocab.get(feat)?.size || 1);
      // Laplace: los tokens pesan la mitad (más ruidosos que las señales estructurales)
      const w = feat === "tok" ? 0.5 : 1;
      lp += w * Math.log((c + 1) / (totalV(total, V)));
    }
    logs.push([cat, lp]);
  }
  if (!logs.length) return [];
  const maxL = Math.max(...logs.map((x) => x[1]));
  const exps = logs.map(([cat, l]) => [cat, Math.exp(l - maxL)]);
  const sum = exps.reduce((s, x) => s + x[1], 0) || 1;
  return exps.map(([cat, e]) => ({ cat, p: e / sum })).sort((a, b) => b.p - a.p);
}
const totalV = (total, V) => total + V; // denominador Laplace, factorizado para legibilidad

/*
  Predicción combinada con abstención. Estrategia, de más fiable a menos:
   1) Entidad conocida con categoría dominante (memoria de comercio, tolera variantes por tokens).
   2) Importe recurrente idéntico de una categoría dominante.
   3) Naive Bayes sobre todas las señales.
   4) Prior de población (heurística) si aún hay poca evidencia.
  Devuelve {cat, conf, source, support?, alternatives?} o null (abstención).
*/
function inferByBehavior(model, m, { minConf = 0.5, minSupport = 3 } = {}) {
  const sign = m.amount >= 0 ? "in" : "out";

  // 1) Entidad conocida (match exacto o fuzzy por tokens). No en transferencias: ahí el
  // «comercio» es el tipo de operación y mezclaría el parking con la inversión.
  const generic = needsAmount(m);
  const ent = merchantEntity(m.pattern);
  let entHit = generic ? null : model.entityCat.get(ent);
  if (!entHit && !generic) {
    // Fuzzy: busca la entidad más parecida por Jaccard de tokens
    const toks = new Set(merchantTokens(m.pattern));
    let best = null, bestSim = 0;
    for (const [e, set] of model.entityTokenSets) {
      const sim = jaccard(toks, set);
      if (sim > bestSim) { bestSim = sim; best = e; }
    }
    if (best && bestSim >= 0.6) entHit = model.entityCat.get(best);
  }
  if (entHit) {
    let total = 0, top = null, topN = 0;
    for (const [cat, n] of entHit) { total += n; if (n > topN && !NO_INFER.has(cat)) { top = cat; topN = n; } }
    const conf = total ? topN / total : 0;
    if (top && total >= 2 && conf >= 0.7) return { cat: top, conf: r2c(conf), source: "comercio", support: topN };
  }

  // 2) Importe recurrente idéntico
  if (Math.abs(m.amount) >= 8) {
    const amHit = model.amountCat.get(`${Math.round(Math.abs(m.amount))}|${sign}`);
    if (amHit) {
      let total = 0, top = null, topN = 0;
      for (const [cat, n] of amHit) { total += n; if (n > topN && !NO_INFER.has(cat)) { top = cat; topN = n; } }
      const conf = total ? topN / total : 0;
      if (top && total >= 3 && conf >= 0.85) return { cat: top, conf: r2c(conf), source: "importe", support: topN };
    }
  }

  // 3) Naive Bayes sobre todas las señales
  const scores = naiveBayesScores(model, m);
  if (scores.length) {
    const best = scores[0];
    // Soporte mínimo: la categoría ganadora debe tener suficiente evidencia
    const support = model.catCount.get(best.cat) || 0;
    const alts = scores.slice(1, 3).filter((s) => s.p >= 0.12).map((s) => ({ cat: s.cat, p: r2c(s.p) }));
    if (support >= minSupport && best.p >= minConf) {
      return { cat: best.cat, conf: r2c(best.p), source: "modelo", support, alternatives: alts.length ? alts : undefined };
    }
  }

  // 4) Prior de población si aún hay poca evidencia
  if (model.N < 60) {
    const h = defaultHeuristic(m);
    if (h && h.conf >= Math.min(minConf, 0.35)) return { cat: h.cat, conf: h.conf, source: "heuristica" };
  }
  return null; // abstención
}
const r2c = (v) => Math.round(v * 100) / 100;

/* Prioriza la cola de pendientes por GANANCIA DE INFORMACIÓN (active learning):
   clasificar una entidad que se repite mucho enseña más que muchos cargos únicos.
   Recibe grupos {pattern, count, total} y devuelve el mismo array ordenado. */
function orderByInfoGain(groups) {
  return [...groups].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return Math.abs(b.total) - Math.abs(a.total);
  });
}

/* ============================================================
   CIERRE DE MES + PROYECCIÓN DE SALDO (RUNWAY)
   Combina el gasto/ingreso del último mes con datos frente al mes
   anterior, los recibos que se han encarecido y una estimación del
   saldo a fin de mes uniendo el saldo actual con los cargos e
   ingresos aún previstos. Función pura, sin efectos.
   ============================================================ */
/* Ingresos recurrentes previstos (nómina, alquileres) entre dos fechas.
   detectRecurring solo mira cargos, así que la proyección de saldo restaba los
   recibos pendientes sin sumar la nómina y salía sistemáticamente pesimista. */
function upcomingIncome(movs, baseDate, endDate) {
  if (!baseDate || !endDate || endDate <= baseDate) return { items: [], total: 0 };
  const byPattern = new Map();
  for (const m of movs) {
    if (m.amount <= 0 || m.extra) continue;
    if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, []);
    byPattern.get(m.pattern).push(m);
  }
  const items = [];
  for (const [pattern, list] of byPattern) {
    if (list.length < 3) continue;
    list.sort((a, b) => a.date - b.date);
    const gaps = [];
    for (let i = 1; i < list.length; i++) gaps.push((list[i].date - list[i - 1].date) / 86400000);
    gaps.sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    if (!(med >= 24 && med <= 38)) continue; // solo cadencia mensual: nómina, alquiler
    const days = list.map((m) => m.date.getDate()).sort((a, b) => a - b);
    const last = list[list.length - 1];
    const d = nextByMonths(last.date, 1, days[Math.floor(days.length / 2)], baseDate);
    if (!d || d > endDate) continue;
    items.push({ date: d, label: last.concept, pattern, amount: r2c(last.amount) });
  }
  items.sort((a, b) => a.date - b.date);
  return { items, total: r2c(items.reduce((s, x) => s + x.amount, 0)) };
}

/* Ingresos mensuales recurrentes que deberían haber llegado y NO están. Para cada
   patrón de ingreso con cadencia mensual, calcula cuándo tocaba el siguiente desde
   su última aparición; si esa fecha ya pasó (con margen para retrasos) y no hay un
   ingreso nuevo, es que falta. Un alquiler que no entra es justo lo que quieres saber. */
function missingIncome(movs, baseDate, { graceDays = 5, maxRetraso = 45 } = {}) {
  if (!baseDate) return [];
  const byPattern = new Map();
  for (const m of movs) {
    if (m.amount <= 0 || m.extra) continue;
    if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, []);
    byPattern.get(m.pattern).push(m);
  }
  const out = [];
  for (const [pattern, list] of byPattern) {
    if (list.length < 3) continue;
    list.sort((a, b) => a.date - b.date);
    const gaps = [];
    for (let i = 1; i < list.length; i++) gaps.push((list[i].date - list[i - 1].date) / 86400000);
    gaps.sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    if (!(med >= 24 && med <= 38)) continue; // solo mensuales
    const days = list.map((m) => m.date.getDate()).sort((a, b) => a - b);
    const last = list[list.length - 1];
    const esperado = nextByMonths(last.date, 1, days[Math.floor(days.length / 2)], last.date);
    if (!esperado) continue;
    // Ya debería haber llegado (fecha esperada + margen anterior a hoy) y no está,
    // porque si estuviera, `last` sería esa nueva aparición.
    const limite = new Date(esperado.getTime() + graceDays * 86400000);
    const diasRetraso = Math.round((baseDate - esperado) / 86400000);
    // Impago RECIENTE, no una fuente abandonada hace medio año (eso no es "se retrasa",
    // es "ya no cobras"; alertarlo cada mes sería ruido).
    if (limite < baseDate && diasRetraso <= maxRetraso) {
      out.push({
        pattern, label: last.concept, esperado, diasRetraso,
        amount: r2c(list.slice(-3).reduce((s, m) => s + m.amount, 0) / Math.min(3, list.length)),
      });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

function buildMonthClose({ movs, receiptTrends, upcoming, saldoSerie, dataRange, realSaldo = null, saldoEstimado = false }) {
  if (!movs || !movs.length || !dataRange) return null;
  const lastDate = dataRange[1];
  const mesKey = monthKey(lastDate);
  const [ly, lm] = mesKey.split("-").map(Number);
  const prevKey = monthKey(new Date(ly, lm - 2, 1));

  let gastoMes = 0, ingresoMes = 0, gastoPrev = 0;
  const catMes = new Map();
  for (const m of movs) {
    if (m.extra || m.omit) continue; // extraordinarios y papelera fuera del cierre
    // Los traspasos a ahorro/inversión no son ni gasto ni ingreso (igual que en el resto
    // del análisis): así "Gastado", "Ingresado" y "Ahorrado" cuadran con los donuts.
    if (INTERNAL_SET.has(m.category || "Otros")) continue;
    const k = monthKey(m.date);
    const c = m.category || "Otros";
    // Devolución (positivo con categoría de gasto explícita): resta del gasto de su categoría,
    // no suma a ingresos. Así "Gastado" e "Ingresado" del cierre netean igual que los donuts.
    const asGasto = m.amount < 0 || isRefund(m);
    if (k === mesKey) {
      if (asGasto) { gastoMes -= m.amount; catMes.set(c, (catMes.get(c) || 0) - m.amount); }
      else ingresoMes += m.amount;
    } else if (k === prevKey) {
      if (asGasto) gastoPrev -= m.amount;
    }
  }
  const topCats = [...catMes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, v]) => ({ cat, v: r2c(v) }));
  const subidas = (receiptTrends || [])
    .filter((t) => t.kind === "fijo" && ((t.lastMonth === mesKey && t.deltaMoM !== null && t.deltaMoM >= 0.03) || (t.deltaYoY !== null && t.deltaYoY >= 0.05)))
    .sort((a, b) => Math.abs(b.annualImpact) - Math.abs(a.annualImpact))
    .slice(0, 3)
    .map((t) => ({ label: t.label, last: r2c(t.last), annualImpact: r2c(t.annualImpact) }));

  // Proyección de saldo a fin del mes en curso (el del último dato)
  let saldoProj = null, saldoNow = null, pendientes = 0, ingresosPrev = 0, discrecional = 0, diasRestantes = 0;
  // Ancla del saldo: preferimos el saldo REAL del banco (si hay conexión); si no, el del CSV/Excel.
  const csvSaldo = (saldoSerie && saldoSerie.length) ? saldoSerie[saldoSerie.length - 1].saldo : null;
  saldoNow = realSaldo != null ? realSaldo : csvSaldo;
  if (saldoNow != null) {
    // Cargos e ingresos previstos que caen dentro del mes en curso y aún no han ocurrido
    const finMes = new Date(ly, lm, 0); // último día del mes
    const items = (upcoming?.items || []).filter((it) => it.date > lastDate && it.date <= finMes);
    pendientes = items.reduce((s, it) => s + it.amount, 0); // gastos (positivos en upcoming)
    ingresosPrev = upcomingIncome(movs, lastDate, finMes).total;

    /* Gasto discrecional esperado del resto del mes. Antes se ignoraba, así que el saldo
       salía siempre optimista: asumía que a partir del último dato solo pagarías recibos.
       Estimamos el ritmo diario de tu gasto de consumo (súper, restaurantes, compras…)
       de los últimos ~90 días y lo proyectamos a los días que quedan de mes.

       Qué se excluye, para que un pico no lo dispare: los recibos fijos (ya van en
       `pendientes`), los extraordinarios, los movimientos internos (traspasos, ahorro,
       bizum, efectivo — no son consumo del día a día) y el 5 % de cargos más grandes
       (una reforma o un mueble puntual no es tu ritmo habitual). */
    const fijos = new Set((receiptTrends || []).map((t) => t.pattern));
    for (const it of items) fijos.add(it.pattern);
    const winStart = Math.max(dataRange[0].getTime(), lastDate.getTime() - 90 * 86400000);
    const consumo = [];
    for (const m of movs) {
      if (m.amount >= 0 || m.extra) continue;
      const t = m.date.getTime();
      if (t < winStart || t > lastDate.getTime()) continue;
      if (fijos.has(m.pattern)) continue;
      if (TRANSFER_SET.has(m.category || "Otros")) continue; // dinero que se mueve, no que se gasta
      consumo.push(-m.amount);
    }
    consumo.sort((a, b) => a - b);
    const trim = consumo.slice(0, Math.max(0, Math.ceil(consumo.length * 0.95))); // recorta el 5 % superior
    const varSum = trim.reduce((s, v) => s + v, 0);
    const winDays = Math.max(1, (lastDate.getTime() - winStart) / 86400000);
    diasRestantes = Math.max(0, finMes.getDate() - lastDate.getDate());
    discrecional = r2c((varSum / winDays) * diasRestantes);
    saldoProj = r2c(saldoNow - pendientes + ingresosPrev - discrecional);
  }

  return {
    mesKey, prevKey,
    gasto: r2c(gastoMes), ingreso: r2c(ingresoMes), neto: r2c(ingresoMes - gastoMes),
    gastoPrev: r2c(gastoPrev), deltaGasto: gastoPrev > 0 ? r2c((gastoMes - gastoPrev) / gastoPrev) : null,
    topCats, subidas,
    saldoNow: saldoNow != null ? r2c(saldoNow) : null, saldoReal: realSaldo != null, saldoEstimado: realSaldo != null && saldoEstimado,
    saldoProj, pendientes: r2c(pendientes), ingresosPrev: r2c(ingresosPrev),
    discrecional: r2c(discrecional), diasRestantes,
  };
}

const RECEIPT_CATS = new Set(["Suministros", "Telecomunicaciones", "Vivienda", "Hipoteca y préstamos", "Seguros", "Impuestos", "Comisiones", "Suscripciones", "Educación"]);

/* Umbral de materialidad: por debajo de este importe no merece la pena molestarte.
   Un café de 1,60 € mal categorizado no mueve ninguna decisión; preguntarte por él
   sí te quema. Idea tomada del `umbral_materialidad_revision` de la hoja de cálculo.

   Medido sobre 1.212 movimientos reales: a 20 € el umbral se traga 2.099 € (1,6 % del
   gasto) sin que nadie los mire; a 10 € solo 844 € (0,6 %) y aún evita un tercio del
   trabajo manual. De ahí el 10. Es ajustable en Ajustes. */
const DEFAULT_MATERIALIDAD = 10;

/* Decide categoría/activo/confianza de cada movimiento nuevo al importar (sin muro).

   Antes se decidía UNA categoría por patrón, usando la SUMA de sus importes. Con
   reglas condicionales eso es imposible: cuatro "BIZUM RECIBIDO" del mismo patrón
   pueden ser cuatro cosas distintas según su importe y su día. Ahora se decide por
   movimiento, y solo se recurre al patrón para el modelo de comportamiento (que sí
   razona sobre el comercio, no sobre el cargo concreto).

   Devuelve Map(id -> { cat, asset, confirmed, source, conf, rule }). Pura y testeable. */
/* Devolución por historial: el banco devuelve con el MISMO concepto que el cargo, en positivo.
   Si ya hay cargos con ese patrón en una categoría de gasto, el positivo es su devolución y va
   a esa categoría (donde resta). No en transferencias ni operaciones genéricas, y nunca por
   más de lo que se llegó a cargar: eso ya no es una devolución. */
function refundIndex(movs) {
  const idx = new Map(); // patrón -> { cats: Map(cat -> n), max }
  for (const m of movs || []) {
    if (!(m.amount < 0) || m.splits?.length || !GASTO_SET.has(m.category) || m.category === "Otros" || m.category === "Impuestos" || needsAmount(m)) continue;
    const e = idx.get(m.pattern) || { cats: new Map(), max: 0 };
    e.cats.set(m.category, (e.cats.get(m.category) || 0) + 1);
    e.max = Math.max(e.max, -m.amount);
    idx.set(m.pattern, e);
  }
  return idx;
}
function refundFromHistory(m, idx) {
  if (!(m.amount > 0) || needsAmount(m)) return null;
  const e = idx.get(m.pattern);
  if (!e || m.amount > e.max * 1.05) return null;
  let top = null, n = 0, total = 0;
  for (const [cat, c] of e.cats) { total += c; if (c > n) { top = cat; n = c; } }
  return n / total >= 0.7 ? top : null;
}

/* A qué activo van los recibos de la vivienda (reglas con VIVIENDA):
   1) el activo marcado como «vivienda» en Activos;
   2) si no, el activo al que ya mandas más gastos de Suministros y Vivienda (tu historial);
   3) si no, «Casa», que se crea al primer recibo. */
function viviendaPorDefecto(assets, movs) {
  const marcado = (assets || []).find((a) => a.uso === "vivienda");
  if (marcado) return marcado.name;
  const n = new Map();
  for (const m of movs || []) if (m.assetName && (m.category === "Suministros" || m.category === "Vivienda" || m.category === "Hipoteca y préstamos")) n.set(m.assetName, (n.get(m.assetName) || 0) + 1);
  let mejor = null, max = 0;
  for (const [a, c] of n) if (c > max) { mejor = a; max = c; }
  return mejor || "Casa";
}

function classifyForImport(freshMovs, existingMovs, rules, { materialidad = DEFAULT_MATERIALIDAD, assetMem = {}, vivienda = "Casa" } = {}) {
  const behavior = buildBehaviorModel(existingMovs || []);
  const refunds = refundIndex(existingMovs);
  const amb = ambiguousPatterns(existingMovs);
  const repByPattern = new Map();
  for (const m of freshMovs) {
    const prev = repByPattern.get(m.pattern);
    if (!prev || m.date > prev.date) repByPattern.set(m.pattern, m);
  }
  const dec = new Map();
  for (const m of freshMovs) {
    const generic = needsAmount(m, amb);
    let r = matchRule(m.pattern, m.amount, rules, m.date, m.concept);
    // Una regla tuya sin importe sobre una transferencia (las de antes de atarlas al importe)
    // clasificaba igual el parking y la inversión: se ignora y decide el importe.
    if (r && generic && r.scope === "personal" && !isConditional(r)) r = null;
    // Positivo sin regla propia (solo el cajón de ingresos por defecto): ¿devolución de un cargo?
    if (m.amount > 0 && (!r || !r.k)) {
      const cat = refundFromHistory(m, refunds);
      if (cat) { dec.set(m.id, { cat, asset: assetMem[m.pattern] || null, confirmed: true, source: "devolución", rule: null }); continue; }
    }
    if (r) {
      // Una regla defensiva clasifica, pero pide que lo mires: crea el pendiente a propósito.
      dec.set(m.id, {
        // La memoria de activos manda sobre la regla solo si la regla no trae activo propio.
        cat: r.cat, asset: (r.asset === VIVIENDA ? vivienda : r.asset) || assetMem[m.pattern] || null,
        confirmed: !r.confirm, source: "regla", rule: r.k ? r : null,
      });
      continue;
    }
    const rep = generic ? m : repByPattern.get(m.pattern);
    let guess = rep ? inferByBehavior(behavior, rep) : null;
    // En una transferencia solo vale el mismo importe recurrente: lo demás (fase del mes,
    // tramo de importe) es adivinar, y así es como los fondos acababan en Parking.
    if (generic && guess && guess.source !== "importe") guess = null;
    let trustworthy = !!guess && (guess.source === "comercio" || guess.source === "importe" || guess.conf >= 0.9);
    // Calderilla: se acepta lo que haya y no se pregunta.
    if (!trustworthy && Math.abs(m.amount) <= materialidad) trustworthy = true;
    dec.set(m.id, {
      cat: guess?.cat || (m.amount > 0 ? "Otros ingresos" : "Otros"),
      asset: assetMem[m.pattern] || null, confirmed: trustworthy, source: guess ? guess.source : null, conf: guess?.conf, rule: null,
    });
  }
  return dec;
}

function analyzeReceiptTrends(movs) {
  const byPattern = new Map();
  for (const m of movs) {
    if (m.amount >= 0) continue;
    if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, []);
    byPattern.get(m.pattern).push(m);
  }
  const out = [];
  for (const [pattern, list] of byPattern) {
    if (list.length < 4) continue;
    list.sort((a, b) => a.date - b.date);
    const byM = new Map();
    for (const m of list) { const k = monthKey(m.date); byM.set(k, (byM.get(k) || 0) + (-m.amount)); }
    const keys = [...byM.keys()].sort();
    if (keys.length < 4) continue;
    // Un recibo se domicilia como mucho ~1 vez al mes; más cargos/mes es compra repetida, no recibo
    if (list.length / keys.length > 1.25) continue;
    // Recibo "vivo": sin desapariciones largas en medio (huecos ≤ 3 meses)
    let maxGap = 0;
    for (let i = 1; i < keys.length; i++) {
      const [a1, b1] = keys[i - 1].split("-").map(Number);
      const [a2, b2] = keys[i].split("-").map(Number);
      maxGap = Math.max(maxGap, (a2 - a1) * 12 + (b2 - b1));
    }
    if (maxGap > 3) continue;
    const serie = keys.map((k) => byM.get(k));
    const mean = serie.reduce((s, v) => s + v, 0) / serie.length;
    if (mean < 5) continue;
    // ¿Es un recibo? Importe en escalones (suscripción/cuota) o categoría de recibo (luz, gas…)
    const uniq = new Set(serie.map((v) => Math.round(v * 2) / 2)).size;
    const cv = Math.sqrt(serie.reduce((s, v) => s + (v - mean) ** 2, 0) / serie.length) / mean;
    const fixed = uniq / serie.length <= 0.4 || cv <= 0.1;
    const cat = list[list.length - 1].category || "Otros";
    if (!fixed && !RECEIPT_CATS.has(cat)) continue;
    const last = serie[serie.length - 1], prev = serie[serie.length - 2];
    const lastK = keys[keys.length - 1];
    const deltaMoM = prev > 0 ? (last - prev) / prev : null;
    // Interanual: mismo mes del año anterior (o ±1 mes si no existe), robusto a estacionalidad
    const [ly, lm] = lastK.split("-").map(Number);
    let yoyBase = null;
    for (const off of [12, 11, 13]) {
      const d = new Date(ly, lm - 1 - off, 1);
      const kk = monthKey(d);
      if (byM.has(kk)) { yoyBase = byM.get(kk); break; }
    }
    const deltaYoY = yoyBase ? (last - yoyBase) / yoyBase : null;
    // Cadencia aproximada por hueco mediano entre meses presentes
    const gaps = [];
    for (let i = 1; i < keys.length; i++) {
      const [a1, b1] = keys[i - 1].split("-").map(Number);
      const [a2, b2] = keys[i].split("-").map(Number);
      gaps.push((a2 - a1) * 12 + (b2 - b1));
    }
    gaps.sort((a, b) => a - b);
    const medGap = gaps[Math.floor(gaps.length / 2)] || 1;
    const perYear = Math.max(1, Math.round(12 / Math.max(1, medGap)));
    const baseRef = deltaYoY !== null ? yoyBase : prev;
    const annualImpact = (last - baseRef) * perYear;
    out.push({
      pattern, label: list[list.length - 1].concept, category: cat, kind: fixed ? "fijo" : "variable",
      last, prev, deltaMoM, deltaYoY, annualImpact, perYear, months: keys.length,
      serie: serie.slice(-13), lastMonth: lastK,
    });
  }
  return out.sort((a, b) => Math.abs(b.annualImpact) - Math.abs(a.annualImpact));
}

/* ============================================================
   EXPANSIÓN DE MOVIMIENTOS Y AGREGADOS
   ============================================================ */
function expandParts(m, assets) {
  const assetFor = (cat) => {
    if (m.assetName !== undefined) return m.assetName;
    const a = assets.find((x) => x.categories.includes(cat));
    return a ? a.name : null;
  };
  if (m.splits && m.splits.length) {
    return m.splits.map((s) => ({ mov: m, amount: (m.amount * s.pct) / 100, cat: s.cat, asset: assetFor(s.cat) }));
  }
  const cat = m.category || "Otros";
  return [{ mov: m, amount: m.amount, cat, asset: assetFor(cat) }];
}

// ¿Pertenece el movimiento al grupo? (manual O por palabra clave)
function movInGroup(m, g) {
  if (g.movementIds && g.movementIds.includes(m.id)) return true;
  if (g.excludedIds && g.excludedIds.includes(m.id)) return false;
  if (g.keywords && g.keywords.length) {
    const p = stripAccents(m.pattern.toUpperCase());
    return g.keywords.some((k) => k && p.includes(stripAccents(k.toUpperCase())));
  }
  return false;
}

/* Devuelve Map(id -> { cat, mean, ratio }). Como es un Map, `.has(id)` sigue valiendo
   donde antes había un Set; y ahora además sabemos CUÁNTO se sale de lo normal, para
   poder decir "≈2,4× tu media en Restauración" en vez de solo marcarlo. */
function computeOutliers(movs) {
  const byCat = new Map();
  for (const m of movs) {
    if (m.amount >= 0 || m.extra) continue;
    const c = m.category || "Otros";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(-m.amount);
  }
  const stat = new Map();
  for (const [c, arr] of byCat) {
    if (arr.length < 4) continue;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const std = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
    stat.set(c, { mean, threshold: mean + 2 * std });
  }
  const flagged = new Map();
  for (const m of movs) {
    // Los extraordinarios ya se excluyeron del umbral: marcarlos como atípicos
    // sería señalar como anomalía justo lo que el usuario declaró excepcional.
    if (m.amount >= 0 || m.extra) continue;
    const s = stat.get(m.category || "Otros");
    const abs = -m.amount;
    if (s && abs > s.threshold && abs > 60) {
      flagged.set(m.id, { cat: m.category || "Otros", mean: s.mean, ratio: s.mean > 0 ? abs / s.mean : null });
    }
  }
  return flagged;
}

const daysBetween = (a, b) => Math.max(0, (b - a) / 86400000) + 1;
const monthsCoveredOf = (a, b) => Math.max(0.25, daysBetween(a, b) / 30.4375);

/* ============================================================
   HERRAMIENTAS DE DATOS PARA LA IA
   La IA no recibe el dataset: pide consultas concretas y la app las
   ejecuta en local, devolviendo solo el resultado (compacto).
   ============================================================ */
const r2 = (v) => Math.round(v * 100) / 100;
const isoDay = (d) => d.toISOString().slice(0, 10);

/* Fecha laxa: "2025", "2026-02", "15/03/2025" o ISO. end=true → final del periodo. */
function parseLooseDate(s, end = false) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{4})$/);
  if (m) return end ? new Date(+m[1], 11, 31) : new Date(+m[1], 0, 1);
  m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) { const y = +m[1], mo = +m[2]; if (mo < 1 || mo > 12) return null; return end ? new Date(y, mo, 0) : new Date(y, mo - 1, 1); }
  const d = parseDateAny(t);
  return d && !isNaN(d) ? d : null;
}

/* ------------------------------------------------------------
   MOTOR DE CONSULTA LOCAL
   La IA pide; esto se ejecuta EN EL DISPOSITIVO y ella solo ve
   el resultado. ctx: { movs, assets, groups, budgets,
   receiptTrends, dataRange, mesesData }.
   ------------------------------------------------------------ */
const eqi = (a, b) => stripAccents(String(a).toLowerCase().trim()) === stripAccents(String(b).toLowerCase().trim());
const asArr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function assetOfMovCtx(ctx, m) {
  if (m.assetName !== undefined) return m.assetName;
  const a = ctx.assets.find((x) => x.categories.includes(m.category || "Otros"));
  return a ? a.name : null;
}
const catsOfMov = (m) => (m.splits?.length ? m.splits.map((s) => s.cat) : [m.category || "Otros"]);

/* Resuelve nombres de categoria admitiendo tambien supra categorias, y al reves. El modelo
   agrupa por macro ("Compras y ocio"), ve el total, y despues filtra por ESE nombre como si
   fuera una categoria hoja: antes eso devolvia cero en silencio y el asistente contestaba
   "no hay movimientos" sobre un gasto que el mismo acababa de reportar. Los nombres que no
   casan con nada se devuelven en `unknown` para poder decirlo en vez de callarlo. */
function resolveCatNames(names, unknown) {
  const out = new Set();
  for (const raw of names) {
    const leaf = CATEGORIES.find((c) => eqi(c, raw));
    if (leaf) { out.add(leaf); continue; }
    const macro = MACROS.find((m) => eqi(m.name, raw));
    if (macro) { for (const c of macro.cats) out.add(c); continue; }
    unknown.push(String(raw));
  }
  return out;
}
function resolveMacroNames(names, unknown) {
  const out = new Set();
  for (const raw of names) {
    const macro = MACROS.find((m) => eqi(m.name, raw));
    if (macro) { out.add(macro.name); continue; }
    const leaf = CATEGORIES.find((c) => eqi(c, raw)); // te han dado una hoja: sube a su macro
    if (leaf) { out.add(macroOf(leaf)); continue; }
    unknown.push(String(raw));
  }
  return out;
}

function filterMovs(ctx, a = {}, diag) {
  const unknown = [];
  // Como en el Resumen: los extraordinarios (una herencia, una venta) quedan fuera salvo que se pidan.
  let out = a.incluir_extraordinarios ? ctx.movs : ctx.movs.filter((m) => !m.extra);
  const d1 = parseLooseDate(a.desde);
  const d2 = parseLooseDate(a.hasta, true);
  if (d1) out = out.filter((m) => m.date >= d1);
  if (d2) { const e = new Date(d2); e.setHours(23, 59, 59, 999); out = out.filter((m) => m.date <= e); }
  if (a.tipo === "gasto") out = out.filter((m) => m.amount < 0);
  if (a.tipo === "ingreso") out = out.filter((m) => m.amount > 0);
  const catsRaw = asArr(a.categorias ?? a.categoria);
  if (catsRaw.length) {
    const set = resolveCatNames(catsRaw, unknown);
    out = set.size ? out.filter((m) => catsOfMov(m).some((c) => set.has(c))) : [];
  }
  const macrosRaw = asArr(a.macros ?? a.macro ?? a.supra_categorias);
  if (macrosRaw.length) {
    const set = resolveMacroNames(macrosRaw, unknown);
    out = set.size ? out.filter((m) => catsOfMov(m).some((c) => set.has(macroOf(c)))) : [];
  }
  const acts = asArr(a.activos ?? a.activo);
  if (acts.length) {
    for (const x of acts) if (!eqi(x, "Sin activo") && !ctx.assets.some((A) => eqi(A.name, x))) unknown.push(String(x));
    out = out.filter((m) => acts.some((x) => eqi(assetOfMovCtx(ctx, m) || "Sin activo", x)));
  }
  const tags = asArr(a.etiquetas ?? a.etiqueta ?? a.grupos ?? a.grupo);
  if (tags.length) {
    for (const t of tags) if (!ctx.groups.some((g) => eqi(g.name, t))) unknown.push(String(t));
    const gs = tags.map((t) => ctx.groups.find((g) => eqi(g.name, t))).filter(Boolean);
    out = gs.length ? out.filter((m) => gs.some((g) => movInGroup(m, g))) : [];
  }
  if (a.texto) { const t = stripAccents(String(a.texto).toUpperCase()); out = out.filter((m) => stripAccents((m.concept + " " + m.pattern).toUpperCase()).includes(t)); }
  if (a.importe_min != null) out = out.filter((m) => Math.abs(m.amount) >= a.importe_min);
  if (a.importe_max != null) out = out.filter((m) => Math.abs(m.amount) <= a.importe_max);
  if (diag && unknown.length) diag.push(...unknown);
  return out;
}

/* Totales con las MISMAS reglas que el Resumen (makeAgg): cada reparto cuenta en su categoría,
   los traspasos internos (a otra cuenta tuya, a tu bróker) no son gasto ni ingreso, y una
   devolución resta del gasto de su categoría en vez de sumar como ingreso. Antes el asistente
   daba cifras distintas de las de la app. `parteOk` limita a las categorías/activos pedidos. */
function totalsOf(list, assets = [], parteOk = null) {
  let gasto = 0, ingreso = 0, traspasos = 0;
  for (const m of list) for (const p of expandParts(m, assets)) {
    if (parteOk && !parteOk(p)) continue;
    if (INTERNAL_SET.has(p.cat)) { traspasos += Math.abs(p.amount); continue; }
    if (p.amount < 0) gasto += -p.amount;
    else if (GASTO_SET.has(p.cat) && hasExplicitCat(m)) gasto -= p.amount; // devolución
    else ingreso += p.amount;
  }
  return { movimientos: list.length, gasto: r2(gasto), ingreso: r2(ingreso), neto: r2(ingreso - gasto), ...(traspasos ? { traspasos_internos: r2(traspasos) } : {}) };
}
// Qué parte de un movimiento cuenta para el filtro de categoría/macro/activo de la consulta.
function parteFiltro(ctx, a = {}) {
  const ign = [];
  const cats = asArr(a.categorias ?? a.categoria), macros = asArr(a.macros ?? a.macro ?? a.supra_categorias), acts = asArr(a.activos ?? a.activo);
  if (!cats.length && !macros.length && !acts.length) return null;
  const cs = cats.length ? resolveCatNames(cats, ign) : null, ms = macros.length ? resolveMacroNames(macros, ign) : null;
  return (p) => (!cs || cs.has(p.cat)) && (!ms || ms.has(macroOf(p.cat))) && (!acts.length || acts.some((x) => eqi(p.asset || "Sin activo", x)));
}

/* Un nombre que no existe hay que DECIRLO, y ofrecer los validos en la misma respuesta para
   que el modelo se corrija en el mismo turno. Callarlo es lo que hacia que el asistente
   respondiera "no se han encontrado movimientos" sobre un gasto que el mismo habia reportado. */
function avisoNombres(ctx, nombres) {
  return {
    no_reconocidos: [...new Set(nombres)],
    categorias_validas: CATEGORIES,
    supra_categorias_validas: MACROS.map((m) => m.name),
    activos_validos: ctx.assets.map((a) => a.name),
    etiquetas_validas: ctx.groups.map((g) => g.name),
    nota: "Repite la consulta usando uno de los nombres validos de arriba.",
  };
}

function runQuery(ctx, args = {}) {
  const desconocidos = [];
  const list = filterMovs(ctx, args, desconocidos);
  const t = totalsOf(list, ctx.assets, parteFiltro(ctx, args));
  const total = t;
  const out = { total };
  if (desconocidos.length) out.aviso = avisoNombres(ctx, desconocidos);
  if (!list.length) {
    // Decir "no hay gastos en Compras" y callar que el periodo SI tiene movimientos, solo que
    // en otras categorias, es una respuesta tecnicamente cierta e inutil: suele significar que
    // los movimientos estan sin clasificar, no que no exista ese gasto. Se adjunta el desglose
    // real del mismo periodo para que el asistente pueda decir lo que de verdad pasa.
    const sinCat = { ...args };
    delete sinCat.categorias; delete sinCat.categoria;
    delete sinCat.macros; delete sinCat.macro; delete sinCat.supra_categorias;
    const filtroDeCategoria = args.categorias || args.categoria || args.macros || args.macro || args.supra_categorias;
    if (filtroDeCategoria && !desconocidos.length) {
      const enPeriodo = filterMovs(ctx, sinCat);
      if (enPeriodo.length) {
        const porCat = new Map();
        for (const m of enPeriodo) {
          for (const p of expandParts(m, ctx.assets)) {
            if (p.amount >= 0) continue;
            const c = p.cat || "Otros";
            porCat.set(c, (porCat.get(c) || 0) + -p.amount);
          }
        }
        out.en_el_periodo = {
          movimientos: enPeriodo.length,
          sin_confirmar: enPeriodo.filter((m) => m.confirmed === false).length,
          gasto_por_categoria: [...porCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([c, v]) => ({ categoria: c, gasto: r2(v) })),
        };
        out.nota = "En esa categoria no hay nada, pero el periodo SI tiene movimientos (ver en_el_periodo). "
          + "Dilo asi y enseña donde esta el gasto realmente. Si hay muchos 'sin_confirmar' o mucho en 'Otros', "
          + "es que estan sin clasificar: sugiere revisarlos, no afirmes que no hubo ese gasto.";
        return out;
      }
    }
    out.nota = desconocidos.length
      ? "El filtro no ha casado porque esos nombres no existen (ver aviso). NO concluyas que no hubo gasto."
      : "Sin movimientos con ese filtro en ese periodo. Contrasta el periodo con el rango de datos antes de afirmar que no hubo gasto.";
    return out;
  }
  const dimRaw = args.agrupar_por;
  if (dimRaw) {
    const dim = eqi(dimRaw, "anio") || eqi(dimRaw, "año") ? "año" : String(dimRaw).toLowerCase();
    const acc = new Map();
    const okParte = parteFiltro(ctx, args);
    const push = (key, amount, sample, cat, mov) => {
      if (cat && INTERNAL_SET.has(cat)) return; // traspasos: ni gasto ni ingreso
      if (!acc.has(key)) acc.set(key, { gasto: 0, ingreso: 0, n: 0, sample });
      const x = acc.get(key);
      if (amount < 0) x.gasto += -amount;
      else if (cat && GASTO_SET.has(cat) && mov && hasExplicitCat(mov)) x.gasto -= amount; // devolución
      else x.ingreso += amount;
      x.n++;
    };
    if (dim === "etiqueta") {
      for (const g of ctx.groups) for (const m of list) if (movInGroup(m, g)) for (const p of expandParts(m, ctx.assets)) if (!okParte || okParte(p)) push(g.name, p.amount, m.concept, p.cat, m);
    } else {
      for (const m of list) {
        for (const p of expandParts(m, ctx.assets)) {
          if (okParte && !okParte(p)) continue;
          const key = dim === "categoria" ? p.cat
            : dim === "macro" ? macroOf(p.cat)
            : dim === "comercio" ? (ctx.detail || (identifiesMerchant(m.pattern) && !needsAmount(m)) ? m.pattern : "Transferencias y Bizum (sin detalle)")
            : dim === "activo" ? (p.asset || "Sin activo")
            : dim === "mes" ? monthKey(m.date)
            : dim === "año" ? String(m.date.getFullYear())
            : null;
          if (key === null) { out.nota = "agrupar_por no reconocido: " + dimRaw; return out; }
          push(key, p.amount, m.concept, p.cat, m);
        }
      }
    }
    let filas = [...acc.entries()].map(([clave, x]) => ({
      clave, ...(dim === "comercio" && ctx.detail ? { ejemplo: x.sample.slice(0, 46) } : {}),
      gasto: r2(x.gasto), ingreso: r2(x.ingreso), neto: r2(x.ingreso - x.gasto), movimientos: x.n,
    }));
    const temporal = dim === "mes" || dim === "año";
    filas.sort((a, b) => (temporal ? a.clave.localeCompare(b.clave) : b.gasto - a.gasto || b.ingreso - a.ingreso));
    if (!temporal) {
      const top = Math.max(1, Math.min(60, args.top || 15));
      if (filas.length > top) {
        const rest = filas.slice(top);
        out.resto = {
          claves_agrupadas: rest.length,
          gasto: r2(rest.reduce((s, f) => s + f.gasto, 0)),
          ingreso: r2(rest.reduce((s, f) => s + f.ingreso, 0)),
        };
        filas = filas.slice(0, top);
      }
    }
    out.resultado = filas;
  }
  return out;
}

function runList(ctx, args = {}) {
  const desconocidos = [];
  const list = filterMovs(ctx, args, desconocidos);
  const orden = args.orden || "fecha";
  const sorted = [...list].sort((a, b) =>
    orden === "importe" ? Math.abs(b.amount) - Math.abs(a.amount)
    : orden === "fecha_asc" ? a.date - b.date
    : b.date - a.date);
  const limite = Math.max(1, Math.min(40, args.limite || 20));
  const t = totalsOf(list, ctx.assets, parteFiltro(ctx, args));
  const tagsOf = (m) => ctx.groups.filter((g) => movInGroup(m, g)).map((g) => g.name);
  return {
    ...(desconocidos.length ? { aviso: avisoNombres(ctx, desconocidos) } : {}),
    encontrados: list.length,
    suma_gasto: t.gasto,
    suma_ingreso: t.ingreso,
    mostrados: Math.min(limite, sorted.length),
    movimientos: sorted.slice(0, limite).map((m) => ({
      id: m.id, fecha: isoDay(m.date), concepto: m.concept.slice(0, 60), importe: r2(m.amount),
      categoria: m.splits?.length ? m.splits.map((s) => `${s.cat} ${s.pct}%`).join(" + ") : (m.category || "Otros"),
      ...(assetOfMovCtx(ctx, m) ? { activo: assetOfMovCtx(ctx, m) } : {}),
      ...(tagsOf(m).length ? { etiquetas: tagsOf(m).join(", ") } : {}),
    })),
  };
}

/* Propuesta de etiqueta que hace la IA y el usuario CONFIRMA en la interfaz. */
function buildGroupProposal(ctx, { nombre, emoji, keywords, ids } = {}) {
  const kws = asArr(keywords).map((k) => stripAccents(String(k).toUpperCase().trim())).filter(Boolean);
  const idSet = new Set(asArr(ids).map(Number).filter((n) => Number.isFinite(n)));
  const matches = ctx.movs.filter((m) => {
    if (idSet.has(m.id)) return true;
    if (!kws.length) return false;
    const hay = stripAccents((m.pattern + " " + m.concept).toUpperCase());
    return kws.some((k) => hay.includes(k));
  });
  if (!matches.length || !nombre) {
    return { forModel: { coincidencias: 0, aviso: !nombre ? "Falta el nombre de la etiqueta." : "Ninguna coincidencia con esas palabras clave o ids: prueba con ver_movimientos para localizar los movimientos primero." }, ui: null };
  }
  const gasto = r2(matches.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0));
  const byCat = new Map();
  for (const m of matches) { const c = m.category || "Otros"; byCat.set(c, (byCat.get(c) || 0) + 1); }
  return {
    forModel: {
      coincidencias: matches.length,
      gasto_total: gasto,
      por_categoria: [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c} (${n})`),
      // Sin acceso a detalle, solo nombres de comercio: un concepto de Bizum o transferencia
      // lleva nombres de personas.
      ejemplos: ctx.detail ? matches.slice(0, 5).map((m) => m.concept.slice(0, 46)) : [...new Set(matches.filter((m) => identifiesMerchant(m.pattern) && !needsAmount(m)).map((m) => m.pattern))].slice(0, 5),
      nota: "Propuesta mostrada al usuario con un botón para crearla. NO está creada todavía.",
    },
    ui: { nombre: String(nombre).slice(0, 30), emoji: emoji || "🏷️", keywords: kws, ids: [...idSet], count: matches.length, gasto },
  };
}

/* Propuesta de RECLASIFICACIÓN que hace la IA y el usuario APLICA en la interfaz. */
function buildReclassProposal(ctx, { keywords, ids, categoria } = {}) {
  const target = String(categoria || "").trim();
  const validCat = CATEGORIES.find((c) => stripAccents(c.toUpperCase()) === stripAccents(target.toUpperCase()));
  if (!validCat) return { forModel: { error: `Categoría no válida: "${categoria}". Usa una EXACTA de la taxonomía.` }, ui: null };
  const kws = asArr(keywords).map((k) => stripAccents(String(k).toUpperCase().trim())).filter(Boolean);
  const idSet = new Set(asArr(ids).map(Number).filter((n) => Number.isFinite(n)));
  const matches = ctx.movs.filter((m) => {
    if (idSet.has(m.id)) return true;
    if (!kws.length) return false;
    const hay = stripAccents((m.pattern + " " + m.concept).toUpperCase());
    return kws.some((k) => hay.includes(k));
  }).filter((m) => (m.category || "Otros") !== validCat && !m.splits); // ni los que ya están, ni divididos
  if (!matches.length) return { forModel: { coincidencias: 0, aviso: "Ninguna coincidencia nueva (o ya están en esa categoría). Usa ver_movimientos para localizarlos primero." }, ui: null };
  const byCat = new Map();
  for (const m of matches) { const c = m.category || "Sin categoría"; byCat.set(c, (byCat.get(c) || 0) + 1); }
  const fromCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => ({ c, n }));
  return {
    forModel: {
      coincidencias: matches.length, a_categoria: validCat,
      desde_categoria: fromCats.map((f) => `${f.c} (${f.n})`),
      ejemplos: matches.slice(0, 5).map((m) => m.concept.slice(0, 46)),
      nota: "Propuesta mostrada al usuario con un botón Aplicar. NO aplicada todavía.",
    },
    ui: { kind: "reclass", categoria: validCat, count: matches.length, ids: matches.map((m) => m.id), fromCats, sample: matches.slice(0, 3).map((m) => m.concept.slice(0, 40)), patrones: [...new Set(matches.map((m) => m.pattern).filter(Boolean))].slice(0, 6) },
  };
}

const compactTrends = (trends) => trends.map((t) => ({
  recibo: t.label.slice(0, 46), patron: t.pattern, categoria: t.category, tipo: t.kind,
  ultimo: r2(t.last), delta_mes_pct: t.deltaMoM === null ? null : r2(t.deltaMoM * 100),
  delta_anyo_pct: t.deltaYoY === null ? null : r2(t.deltaYoY * 100),
  impacto_anual: r2(t.annualImpact), meses_con_datos: t.months,
}));

function receiptSeries(ctx, patron) {
  const t = stripAccents(String(patron).toUpperCase());
  const list = ctx.movs.filter((m) => m.amount < 0 && stripAccents((m.pattern + " " + m.concept).toUpperCase()).includes(t));
  if (!list.length) return { error: "No hay cargos que encajen con ese patrón." };
  const byM = new Map();
  for (const m of list) { const k = monthKey(m.date); byM.set(k, (byM.get(k) || 0) + (-m.amount)); }
  const keys = [...byM.keys()].sort();
  const serie = keys.map((k) => ({ mes: k, importe: r2(byM.get(k)) }));
  const escalones = [];
  for (const p of serie) {
    const last = escalones[escalones.length - 1];
    if (last && Math.abs(p.importe - last.importe) / last.importe <= 0.02) { last.hasta = p.mes; last.meses++; }
    else escalones.push({ desde: p.mes, hasta: p.mes, importe: p.importe, meses: 1 });
  }
  const cambios = escalones.slice(1).map((e, i) => ({ mes: e.desde, de: escalones[i].importe, a: e.importe, pct: r2(((e.importe - escalones[i].importe) / escalones[i].importe) * 100) }));
  return { concepto: list[list.length - 1].concept.slice(0, 60), serie_mensual: serie, escalones, cambios_de_precio: cambios };
}

/* Catálogo de herramientas del agente. detail=false oculta el nivel movimiento. */
const FILTER_SCHEMA = {
  desde: { type: "string", description: "Inicio del periodo: AAAA, AAAA-MM o AAAA-MM-DD" },
  hasta: { type: "string", description: "Fin del periodo (mismos formatos)" },
  tipo: { type: "string", enum: ["gasto", "ingreso", "todos"] },
  categorias: { type: "array", items: { type: "string" }, description: "Nombres exactos de categorías" },
  macros: { type: "array", items: { type: "string" }, description: "Nombres exactos de supra categorías" },
  activos: { type: "array", items: { type: "string" }, description: "Nombres exactos de activos" },
  etiquetas: { type: "array", items: { type: "string" }, description: "Nombres exactos de etiquetas" },
  texto: { type: "string", description: "Busca este texto en concepto/comercio" },
  importe_min: { type: "number" }, importe_max: { type: "number" },
  incluir_extraordinarios: { type: "boolean", description: "Incluir los movimientos marcados como extraordinarios (por defecto no cuentan, como en la app)" },
};
function buildAgentTools(detail) {
  const tools = [
    {
      name: "consultar",
      description: "Totales y agrupaciones de gastos/ingresos con filtros combinables. Sirve para cifras, rankings, evolución por mes/año y neto (ingresos−gastos) de un activo o etiqueta. Sin 'agrupar_por' devuelve solo los totales del filtro.",
      parameters: { type: "object", properties: { agrupar_por: { type: "string", enum: ["categoria", "macro", "comercio", "activo", "etiqueta", "mes", "año"] }, top: { type: "integer", description: "Máx. filas no temporales (def. 15)" }, ...FILTER_SCHEMA } },
    },
    {
      name: "evolucion_recibo",
      description: "Recibos periódicos y sus subidas. Sin 'patron': todos los recibos con Δ mensual, Δ interanual e impacto anual. Con 'patron': serie mensual completa, escalones de precio y cambios (cuándo y cuánto subió).",
      parameters: { type: "object", properties: { patron: { type: "string", description: "Parte del nombre del emisor (p. ej. 'iberdrola')" } } },
    },
    {
      name: "proximos_cargos",
      description: "Cargos domiciliados previstos (recibos, cuotas, suscripciones) a partir del último día con datos: fecha estimada, importe estimado (media reciente si es variable) y total del horizonte. Úsala para '¿qué me queda por pagar este mes?' o para planificar el saldo.",
      parameters: { type: "object", properties: { horizonte_dias: { type: "integer", description: "7–62 días (def. 31)" } } },
    },
    {
      name: "proponer_etiqueta",
      description: "Propone crear una etiqueta (cluster de gasto transversal, p. ej. 'Pádel') por palabras clave y/o ids de movimientos. NO la crea: el usuario verá una tarjeta con un botón para confirmarla. Úsala cuando el usuario quiera agrupar o etiquetar un tipo de gasto.",
      parameters: { type: "object", properties: { nombre: { type: "string" }, emoji: { type: "string", description: "Un solo emoji" }, keywords: { type: "array", items: { type: "string" } }, ids: { type: "array", items: { type: "integer" }, description: "Ids de movimientos concretos (de ver_movimientos)" } }, required: ["nombre"] },
    },
  ];
  if (detail) tools.splice(1, 0, {
    name: "ver_movimientos",
    description: "Lista movimientos concretos (fecha, concepto, importe, id) que cumplen los filtros. Úsala para detalle fino o para obtener ids antes de proponer una etiqueta.",
    parameters: { type: "object", properties: { orden: { type: "string", enum: ["fecha", "fecha_asc", "importe"] }, limite: { type: "integer", description: "1–40 (def. 20)" }, ...FILTER_SCHEMA } },
  });
  if (detail) tools.push({
    name: "proponer_reclasificacion",
    description: "Propone RECLASIFICAR movimientos (cambiar su categoría) por palabras clave y/o ids. NO los cambia: el usuario verá una tarjeta con un botón Aplicar. Úsala cuando detectes movimientos mal clasificados o sin clasificar que deberían ir a una categoría concreta.",
    parameters: { type: "object", properties: { categoria: { type: "string", description: "Categoría destino EXACTA de la taxonomía" }, keywords: { type: "array", items: { type: "string" }, description: "Palabras del concepto/comercio a reclasificar" }, ids: { type: "array", items: { type: "integer" }, description: "Ids concretos (de ver_movimientos)" }, motivo: { type: "string", description: "Breve motivo (opcional)" } }, required: ["categoria"] },
  });
  return tools;
}

function buildAssistantSystem(ctx, detail) {
  const taxo = MACROS.map((m) => `- ${m.name}: ${m.cats.join(", ")}`).join("\n");
  const USO = { alquiler: "en alquiler", vivienda: "vivienda habitual", segunda: "inmueble sin alquilar", otro: "otro" };
  const acts = ctx.assets.length ? ctx.assets.map((a) => `- ${a.name} (${a.categories.join(", ") || "sin categorías fijas"}; uso: ${USO[a.uso] || "otro"}${a.value ? `; valor estimado ${Math.round(a.value)} €` : ""})`).join("\n") : "- (ninguno definido)";
  const tags = ctx.groups.length ? ctx.groups.map((g) => `- ${g.name}${g.keywords?.length ? ` [claves: ${g.keywords.join(", ")}]` : ""}`).join("\n") : "- (ninguna definida)";
  const buds = Object.entries(ctx.budgets || {}).filter(([, v]) => v > 0);
  const budTxt = buds.length ? buds.map(([c, v]) => `${c} ${v} €/mes`).join(" · ") : "sin presupuestos definidos";
  return [
    "Eres el analista de finanzas personales del usuario, dentro de su propia aplicación. Respondes SIEMPRE en español, con cifras en euros (formato español) y de forma breve y directa; usa pequeñas listas o tablas solo si aclaran.",
    `Hoy es ${isoDay(new Date())}. Cualquier periodo relativo («este mes», «las últimas 5 semanas», «el año pasado») se calcula SIEMPRE a partir de esta fecha; nunca lo deduzcas de memoria.`,
    `Datos disponibles: ${ctx.movs.length} movimientos de su cuenta bancaria${ctx.dataRange ? `, del ${isoDay(ctx.dataRange[0])} al ${isoDay(ctx.dataRange[1])}` : ""} (~${Math.round(ctx.mesesData || 0)} meses).`,
    "Supra categorías y sus categorías (usa los nombres EXACTOS):\n" + taxo,
    "Activos del usuario:\n" + acts,
    "Etiquetas del usuario (clusters transversales):\n" + tags,
    "Presupuestos: " + budTxt + ".",
    "Reglas: 1) Cualquier cifra sale de las herramientas; nunca la estimes de memoria. 2) Las consultas se ejecutan en su propio dispositivo: tú solo ves los resultados que devuelven. 3) Si una consulta vuelve vacía, revisa nombres exactos o pregunta. 4) La rentabilidad de un activo es su neto (ingresos−gastos de sus movimientos), anualizado con su propio periodo, dividido entre el valor estimado que el usuario le ha puesto (si lo tiene); sin valor, da solo el neto y dilo. Para la renta de un inmueble remite al «Informe por inmueble» de la pestaña Activos. 5) Para agrupar gastos transversales usa proponer_etiqueta y deja que el usuario confirme; para corregir categorías (mal clasificados o sin clasificar) usa proponer_reclasificacion con la categoría destino EXACTA, y deja que el usuario aplique. Nunca afirmes que has cambiado nada: solo propones. 6) Para pagos futuros usa proximos_cargos y di que son estimaciones. 7) Un resultado vacío puede significar que NO hay datos de ese periodo, no que no haya habido gasto: contrasta el periodo pedido con el rango de datos y, si cae fuera aunque sea en parte, dilo explícitamente («tus datos llegan hasta el X») en vez de afirmar que no ha gastado nada." + (detail ? "" : " 8) El usuario ha limitado tu acceso: solo agregados, sin movimientos individuales."),
  ].join("\n\n");
}

/* Despacho de herramientas del agente (onProposal recibe la tarjeta de etiqueta). */
function runAgentTool(ctx, name, args = {}, { onProposal } = {}) {
  if (name === "consultar") return runQuery(ctx, args);
  if (name === "ver_movimientos") return runList(ctx, args);
  if (name === "evolucion_recibo") {
    if (args.patron) return receiptSeries(ctx, args.patron);
    return { recibos: compactTrends(ctx.receiptTrends), nota: "delta en %, impacto_anual en €/año." };
  }
  if (name === "proximos_cargos") {
    const h = Math.max(7, Math.min(62, args.horizonte_dias || 31));
    const base = ctx.dataRange ? ctx.dataRange[1] : null;
    const up = upcomingCharges(ctx.movs, ctx.recurring || [], ctx.receiptTrends, base, h);
    return {
      desde: base ? isoDay(base) : null, horizonte_dias: h, total_estimado: up.total,
      cargos: up.items.map((x) => ({ fecha_estimada: isoDay(x.date), concepto: x.label.slice(0, 46), importe_estimado: x.amount, cadencia: x.cadence, ...(x.variable ? { variable: true } : {}) })),
      nota: "Estimaciones sobre recibos detectados en el histórico; los importes variables usan la media de los últimos meses.",
    };
  }
  if (name === "proponer_etiqueta") {
    const p = buildGroupProposal(ctx, args);
    if (p.ui && onProposal) onProposal(p.ui);
    return p.forModel;
  }
  if (name === "proponer_reclasificacion") {
    const p = buildReclassProposal(ctx, args);
    if (p.ui && onProposal) onProposal(p.ui);
    return p.forModel;
  }
  return { error: "Herramienta desconocida: " + name };
}

/* ============================================================
   IA — MULTIPROVEEDOR
   "Claude (integrado)" funciona aquí sin configurar nada. En la versión
   desplegada puedes elegir cualquier endpoint compatible OpenAI (OpenAI,
   OpenRouter, Mistral, tu Ollama/LM Studio local…): así la IA es de tu
   elección y, con un servidor local, tus datos no salen de tu red.
   ============================================================ */
const DEFAULT_AI_CFG = { provider: "claude", baseUrl: "", model: "", apiKey: "" };
const AI_PRESETS = [
  { id: "anthropic", label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-5", needsKey: true },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", needsKey: true },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", needsKey: true },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", needsKey: true },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5", needsKey: true },
  { id: "openrouter-free", label: "OpenRouter (gratis)", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-oss-20b:free", needsKey: true },
  { id: "nvidia", label: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", model: "mistralai/mistral-nemotron", needsKey: true },
  { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", model: "llama3.1", needsKey: false },
  { id: "lmstudio", label: "LM Studio (local)", baseUrl: "http://localhost:1234/v1", model: "mi-modelo-local", needsKey: false },
];
const aiProviderLabel = (cfg) =>
  !cfg || cfg.provider === "claude"
    ? "Claude (integrado)"
    : `${cfg.model || "modelo"} · ${(cfg.baseUrl || "").replace(/^https?:\/\//, "").split("/")[0] || "endpoint propio"}`;
const aiSupportsWeb = (cfg) => !cfg || cfg.provider === "claude";

/* Un modelo por tarea, porque no cuestan lo mismo ni hacen lo mismo:
   - CLASSIFY: etiquetar "MERCADONA MADRID" → "Supermercado". Es reconocimiento de
     patrones, no razonamiento. Haiku 4.5 ($1/$5 por millón) lo hace igual de bien
     que Sonnet ($3/$15) por un tercio del precio, y son cientos de comercios.
   - CHAT: el asistente sí razona sobre tus datos, y son pocas preguntas. Sonnet 4.6.
     Si alguna vez quieres lo mejor a costa de precio, "claude-opus-4-8" es la opción. */
const AI_MODEL = { classify: "claude-haiku-4-5", chat: "claude-sonnet-4-6" };

// Petición cruda a Anthropic. Dentro del artefacto de Claude la clave la inyecta el
// entorno; en un despliegue propio esta ruta devuelve 401 (hace falta proveedor propio).
async function anthropicRequest(body, model = AI_MODEL.chat) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...body }),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al contactar con Claude`);
  return res.json();
}

// Petición cruda a un endpoint compatible OpenAI (elección del usuario).
async function openaiRequest(cfg, body) {
  const base = (cfg.baseUrl || "").replace(/\/+$/, "");
  if (!base) throw new Error("Falta la URL del proveedor: configúrala en Ajustes → Inteligencia artificial");
  const headers = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  // Anthropic bloquea las llamadas directas desde el navegador salvo con esta cabecera
  // explícita (endpoint compatible OpenAI). Así se puede usar una clave sk-ant- propia.
  if (/api\.anthropic\.com/i.test(base)) headers["anthropic-dangerous-direct-browser-access"] = "true";
  const res = await fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify({ model: cfg.model || "", ...body }) });
  if (!res.ok) {
    let extra = ""; try { extra = (await res.json())?.error?.message || ""; } catch { /* sin detalle */ }
    throw new Error(`Error ${res.status} del proveedor de IA${extra ? ": " + extra.slice(0, 160) : ""}`);
  }
  return res.json();
}

// Texto simple (categorización, sugerencias). webTools solo con Claude.
async function aiText(aiCfg, { system, user, maxTokens = 1500, webTools = null, model = AI_MODEL.classify }) {
  if (!aiCfg || aiCfg.provider === "claude") {
    const body = { max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] };
    if (webTools) body.tools = webTools;
    const data = await anthropicRequest(body, model);
    const blocks = data.content || [];
    // Con búsqueda web hay texto de razonamiento intercalado entre las llamadas; el JSON
    // útil es lo que el modelo escribe DESPUÉS de su última herramienta. Enumerar los
    // tipos de bloque era frágil (se añaden nuevos): cualquier bloque que no sea texto
    // cuenta como herramienta.
    let lastToolIdx = -1;
    blocks.forEach((b, i) => { if (b.type !== "text") lastToolIdx = i; });
    const textBlocks = blocks.filter((b, i) => b.type === "text" && i > lastToolIdx);
    const chosen = textBlocks.length ? textBlocks : blocks.filter((b) => b.type === "text");
    return { text: chosen.map((b) => b.text).join("\n").trim(), stop: data.stop_reason, usage: data.usage };
  }
  const data = await openaiRequest(aiCfg, { max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  return { text: (data.choices?.[0]?.message?.content || "").trim(), stop: data.choices?.[0]?.finish_reason, usage: null };
}

// Chat con herramientas de datos: la IA decide qué consultar y la app lo ejecuta EN LOCAL.
async function aiChatWithTools(aiCfg, { system, history, tools, runTool, onTrace, maxIter = 6, maxTokens = 3000 }) {
  const LIMIT_MSG = "He hecho demasiadas consultas seguidas sin llegar a una conclusión. Prueba a acotar la pregunta (periodo, categoría…).";
  if (!aiCfg || aiCfg.provider === "claude") {
    const aTools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const messages = history.map((m) => ({ role: m.role, content: m.content }));
    for (let i = 0; i < maxIter; i++) {
      const data = await anthropicRequest({ max_tokens: maxTokens, system, messages, tools: aTools });
      const blocks = data.content || [];
      const uses = blocks.filter((b) => b.type === "tool_use");
      if (!uses.length) {
        const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
        return text || "No he recibido respuesta. Inténtalo de nuevo.";
      }
      messages.push({ role: "assistant", content: blocks });
      const results = uses.map((u) => {
        const out = runTool(u.name, u.input || {});
        onTrace?.(u.name, u.input || {}, out);
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) };
      });
      messages.push({ role: "user", content: results });
    }
    return LIMIT_MSG;
  }
  const oTools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages = [{ role: "system", content: system }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  for (let i = 0; i < maxIter; i++) {
    const data = await openaiRequest(aiCfg, { max_tokens: maxTokens, messages, tools: oTools });
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("El proveedor devolvió una respuesta vacía");
    const calls = msg.tool_calls || [];
    // Algunos modelos de razonamiento dejan el texto en `reasoning` y `content` vacío; lo recogemos.
    if (!calls.length) return (msg.content || msg.reasoning || "").trim() || "No he recibido respuesta. Inténtalo de nuevo (prueba a subir el límite o usar un modelo sin «reasoning», como Llama 3.3 70B).";
    messages.push(msg);
    for (const tc of calls) {
      let args = {}; try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* argumentos ilegibles */ }
      const out = runTool(tc.function?.name, args);
      onTrace?.(tc.function?.name, args, out);
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
    }
  }
  return LIMIT_MSG;
}

function extractJSONObject(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch { /* seguimos */ }
  const a = clean.indexOf("{");
  if (a < 0) throw new Error("respuesta no interpretable");
  const b = clean.lastIndexOf("}");
  if (b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch { /* puede venir truncado */ } }
  // Rescate ante JSON truncado (max_tokens): recompone los pares "clave": "valor" completos.
  const obj = {};
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m, n = 0;
  while ((m = re.exec(clean))) { obj[m[1]] = m[2]; n++; }
  if (n === 0) throw new Error("respuesta no interpretable");
  return obj;
}
const CHUNK_SIZE = 22;      // lotes pequeños: evita respuestas largas que se truncan
const WEB_MAX_USES = 3;     // la doc recomienda 3 para acotar coste sin truncar apenas
const WEB_SEARCH_USD = 0.01; // $10 por cada 1.000 búsquedas

/* Estimación honesta del coste de una pasada CON búsqueda web, para enseñarla antes
   de gastar. La tasa por búsqueda es exacta; los tokens de los resultados son una
   media observada (~25k de entrada por lote que busca), así que es orientativa. */
function estimateWebCostUSD(nPatterns) {
  const chunks = Math.ceil(nPatterns / CHUNK_SIZE);
  const searches = chunks * WEB_MAX_USES;
  const tokensUSD = chunks * 25000 * (3 / 1e6); // resultados como tokens de entrada, Sonnet
  return { searches, usd: searches * WEB_SEARCH_USD + tokensUSD };
}

/* Clasifica patrones de comercio. Devuelve también los que NO ha sabido resolver,
   para poder mandar SOLO esos a una segunda pasada con búsqueda web: buscar en la
   web los cien comercios cuando solo diez son desconocidos multiplica el coste por
   diez sin ganar nada. */
async function aiCategorizePatterns(patterns, useWeb = false, aiCfg = null) {
  const web = useWeb && aiSupportsWeb(aiCfg);
  const base = `Clasificas conceptos de movimientos bancarios españoles. Devuelve un objeto JSON donde cada clave es EXACTAMENTE uno de los patrones recibidos y su valor es una categoría EXACTA de esta lista: ${CATEGORIES.join(", ")}. Incluye TODOS los patrones. Si dudas, usa "Otros".`;
  const system = web
    ? `${base} Puedes usar la búsqueda web para identificar comercios o emisores que no reconozcas. Tras buscar, tu ÚLTIMO mensaje debe ser SOLO el objeto JSON, sin texto ni marcas de código.`
    : `${base} Responde SOLO con el objeto JSON, sin texto ni marcas de código.`;
  const webTools = web ? [{ type: "web_search_20250305", name: "web_search", max_uses: WEB_MAX_USES }] : null;
  // Sin web, Haiku basta y cuesta un tercio. Con web el gasto lo dominan los tokens de
  // los resultados, y ahí prefiero el modelo cuyo soporte de la herramienta conozco.
  const model = web ? AI_MODEL.chat : AI_MODEL.classify;

  // Trocea en lotes pequeños para que la respuesta nunca se trunque, y tolera el fallo de un lote.
  const out = {};
  let anyOk = false, searches = 0, lastErr = null;
  for (let i = 0; i < patterns.length; i += CHUNK_SIZE) {
    const chunk = patterns.slice(i, i + CHUNK_SIZE);
    const user = `Patrones (cada línea: PATRON | tipo):\n${chunk.map((p) => `${p.pattern} | ${p.sign > 0 ? "ingreso" : "gasto"}`).join("\n")}`;
    // Presupuesto de tokens generoso y proporcional al lote (evita truncar).
    const maxTokens = Math.min(4000, 400 + chunk.length * 60);
    try {
      const { text, usage } = await aiText(aiCfg, { system, user, maxTokens, webTools, model });
      searches += usage?.server_tool_use?.web_search_requests || 0;
      const obj = extractJSONObject(text);
      for (const [k, v] of Object.entries(obj)) if (CATEGORIES.includes(v)) { out[k] = v; anyOk = true; }
    } catch (e) { lastErr = e; /* un lote falla pero seguimos con los demás */ }
  }
  if (!anyOk) throw lastErr || new Error("La IA no devolvió ninguna categoría utilizable");
  // "Otros" no es una respuesta: es la abstención del modelo. Va al residuo.
  const unresolved = patterns.map((p) => p.pattern).filter((p) => !out[p] || out[p] === "Otros");
  return { map: out, unresolved, searches };
}

/* Bloqueo de scroll del fondo con contador: dos overlays superpuestos ya no se
   pisan al desmontarse (el primero en cerrarse restauraba el scroll del otro). */
let scrollLocks = 0;
function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (scrollLocks++ === 0) document.body.style.overflow = "hidden";
}
function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (--scrollLocks <= 0) { scrollLocks = 0; document.body.style.overflow = ""; }
}

// Orden alfabético es-ES, pero "Otros"/"Otros ingresos" siempre al final de su grupo
const catSorter = (a, b) => {
  const oa = /^Otros/.test(a), ob = /^Otros/.test(b);
  if (oa !== ob) return oa ? 1 : -1;
  return a.localeCompare(b, "es");
};
const GASTO_SORTED = [...CATEGORIES_GASTO].sort(catSorter);
const INGRESO_SORTED = [...CATEGORIES_INGRESO].sort(catSorter);
const TRANSFER_SORTED = [...CATEGORIES_TRANSFER].sort(catSorter);
// Categorías inequívocas de gasto: un importe POSITIVO en una de ellas es una devolución
// (contra-gasto), no un ingreso. Las bidireccionales (Bizum, Efectivo, traspasos) siguen
// decidiéndose por el signo, porque un positivo ahí sí puede ser dinero que entra.
const GASTO_SET = new Set(CATEGORIES_GASTO);
// Una devolución es un POSITIVO con una categoría de gasto asignada EXPLÍCITAMENTE. El
// matiz "explícita" es clave: un positivo sin clasificar cae por defecto en "Otros" (que es
// de gasto), pero ese sigue siendo un ingreso por revisar, no una devolución.
const hasExplicitCat = (m) => !!(m.splits ? m.splits.length : m.category);
const isRefund = (m) => m.amount > 0 && hasExplicitCat(m) && GASTO_SET.has(m.splits ? m.splits[0].cat : m.category);
const isRefundPart = (p) => p.amount > 0 && hasExplicitCat(p.mov) && GASTO_SET.has(p.cat);
// Grupos de categorías para el filtro (mismo orden y agrupación que el selector).
const CAT_FILTER_GROUPS = [
  { label: "Gastos", items: GASTO_SORTED },
  { label: "Ingresos", items: INGRESO_SORTED },
  { label: "Transferencias", items: TRANSFER_SORTED },
];

/* Alta y edición manual de un movimiento (efectivo, un apunte que falta, o corregir uno
   mal parseado). Un mismo modal para «nuevo» y «editar»: mismos campos, misma validación.
   La fecha se construye a mediodía local para que no baile de día por zona horaria. */
const toDateInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Guía de instalación del backend. Vive en el repositorio porque es donde está el botón de
// despliegue; desde la app solo se enlaza.
const GUIA_URL = "https://github.com/lsantos44/MisFinanzas";
const DEPLOY_URL = "https://deploy.workers.cloudflare.com/?url=https://github.com/lsantos44/MisFinanzas";

// Botones para guardarte el acceso donde ya lo tienes todo: tu email, tus chats contigo mismo,
// tu gestor de contraseñas. Es lo que evita tener que memorizar la dirección y el token.
const ACCESO_GUARDADO_KEY = "finz:acceso-guardado";
const marcarAccesoGuardado = () => {
  try { localStorage.setItem(ACCESO_GUARDADO_KEY, String(Date.now())); } catch { /* noop */ }
  try { window.dispatchEvent(new Event("finz-acceso-guardado")); } catch { /* noop */ }
};
// Devuelve el momento (ms) en que se copió o envió el enlace por última vez, o 0.
const accesoGuardado = () => { try { return Number(localStorage.getItem(ACCESO_GUARDADO_KEY)) || 0; } catch { return 0; } };
const fmtCuando = (ms) => new Date(ms).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const IMPORT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "NOK", "SEK", "DKK", "PLN", "CZK", "JPY", "CAD", "AUD"];

/* Recap de un mes concreto: gasto/ingreso/neto, top categorías y comparación con el mes anterior.
   Pura y testeable; reutiliza la misma lógica de gasto/ingreso que el cierre (excluye internos). */
function buildRecap(movs, mKey) {
  const [y, mm] = mKey.split("-").map(Number);
  const prevKey = monthKey(new Date(y, mm - 2, 1));
  let gasto = 0, ingreso = 0, gastoPrev = 0;
  const catMes = new Map(), catPrev = new Map();
  for (const m of movs) {
    if (m.extra || m.omit) continue;
    if (INTERNAL_SET.has(m.category || "Otros")) continue;
    const k = monthKey(m.date);
    const asGasto = m.amount < 0 || isRefund(m);
    const cat = m.category || "Otros";
    if (k === mKey) {
      if (asGasto) { gasto -= m.amount; catMes.set(cat, (catMes.get(cat) || 0) - m.amount); }
      else ingreso += m.amount;
    } else if (k === prevKey) {
      if (asGasto) { gastoPrev -= m.amount; catPrev.set(cat, (catPrev.get(cat) || 0) - m.amount); }
    }
  }
  const neto = r2c(ingreso - gasto);
  const deltaGasto = gastoPrev > 0 ? (gasto - gastoPrev) / gastoPrev : null;
  const topCats = [...catMes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, v]) => ({ cat, v: r2c(v), prev: r2c(catPrev.get(cat) || 0) }));
  let topRise = null;
  for (const [cat, v] of catMes) { const rise = v - (catPrev.get(cat) || 0); if (!topRise || rise > topRise.rise) topRise = { cat, rise }; }
  return { mKey, prevKey, gasto: r2c(gasto), ingreso: r2c(ingreso), neto, gastoPrev: r2c(gastoPrev), deltaGasto, topCats, topRise };
}

// De categoría de la app a apartado de «inmuebles arrendados» en Renta Web. Es una propuesta:
// la app no sabe si una comisión es de la hipoteca o si «Vivienda» es la comunidad, así que lo
// dudoso lleva su aviso. Lo no listado cae en «Otros», a revisar uno a uno.
// La cuota del préstamo NO se deduce entera: solo sus intereses, que el extracto no separa del
// capital. Se enseña como referencia y no entra en el rendimiento neto.
const RENTA_CUOTA = "Cuota del préstamo (solo los intereses son deducibles)";
const RENTA_CONCEPTO = {
  Impuestos: "Tributos y tasas (IBI, basuras)",
  Seguros: "Primas de seguros",
  "Taller y mantenimiento": "Reparación y conservación",
  Hogar: "Reparación y conservación",
  Suministros: "Suministros y servicios",
  Telecomunicaciones: "Suministros y servicios",
  Vivienda: "Comunidad y servicios de la finca",
  Comisiones: "Intereses y gastos de financiación",
  "Hipoteca y préstamos": RENTA_CUOTA,
};
const RENTA_REVISAR = {
  [RENTA_CUOTA]: "No se deduce entera: incluye capital. Pon en «Intereses y gastos de financiación» solo los intereses del año (certificado del banco o cuadro de amortización).",
  "Comunidad y servicios de la finca": "Si aquí hay cuotas de hipoteca, solo los intereses son deducibles y van en financiación.",
  "Intereses y gastos de financiación": "Solo cuenta lo del préstamo de este inmueble. Junto con reparación y conservación, no puede superar los ingresos.",
  "Reparación y conservación": "Las mejoras (ampliar, reformar a fondo) no van aquí: se amortizan.",
  "Otros gastos": "Revisa uno a uno: solo es deducible lo necesario para alquilar, con factura.",
};
const rentaConceptos = (cats) => {
  const m = new Map();
  for (const [c, v] of cats) {
    const k = RENTA_CONCEPTO[c] || "Otros gastos";
    const e = m.get(k) || { total: 0, cats: [] };
    e.total += v; e.cats.push(c); m.set(k, e);
  }
  return [...m.entries()].sort((x, y) => y[1].total - x[1].total);
};

/* Cálculo de la renta de un inmueble alquilado para un año (rendimiento del capital
   inmobiliario, IRPF). Pura y probada. Usa la ficha fiscal del activo (`fiscal`):
     titularidad %, diasArrendado, valorCatastral, pctConstruccion %, coste (precio de compra
     más gastos), reduccion % (50/60/70/90 según contrato), intereses {año: €}, catastralRevisado.
   Reglas: los gastos de los días sin alquilar no se deducen (prorrateo por días); intereses +
   reparación no pueden superar los ingresos (el exceso se arrastra 4 años); amortización del 3 %
   sobre el mayor entre coste y valor catastral, solo la construcción; la reducción solo se
   aplica a un rendimiento positivo; los días sin alquilar imputan renta (1,1 % o 2 % del valor
   catastral). `faltan` dice qué dato falta para que el cálculo sea completo. Orientativo. */
function calcRentaInmueble({ ingreso, gastoDeducible, reparacion = 0, fiscal = {}, anio }) {
  const diasAnio = anio && ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0) ? 366 : 365;
  const faltan = [];
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  let dias = num(fiscal.diasArrendado);
  if (dias === null) { faltan.push("días alquilado"); dias = diasAnio; }
  dias = Math.max(0, Math.min(diasAnio, dias));
  const prorr = dias / diasAnio;
  const interesesAnio = num(fiscal.intereses?.[anio]);
  if (interesesAnio === null) faltan.push("intereses del préstamo de ese año (0 si no hay)");
  const intereses = (interesesAnio || 0) * prorr;
  const rep = reparacion * prorr;
  const otros = Math.max(0, gastoDeducible - reparacion) * prorr;
  const limite = Math.min(intereses + rep, ingreso);
  const exceso = Math.max(0, intereses + rep - ingreso);
  const vc = num(fiscal.valorCatastral), pc = num(fiscal.pctConstruccion), coste = num(fiscal.coste);
  let amortizacion = null;
  if (pc === null || (vc === null && coste === null)) faltan.push("valor catastral o coste de compra y % de construcción");
  else amortizacion = 0.03 * Math.max(vc || 0, coste || 0) * (pc / 100) * prorr;
  const neto = ingreso - otros - limite - (amortizacion || 0);
  const pctRed = num(fiscal.reduccion);
  if (pctRed === null) faltan.push("reducción por alquiler de vivienda (0 si no aplica)");
  const reduccion = neto > 0 ? neto * (pctRed || 0) / 100 : 0;
  const netoReducido = neto - reduccion;
  const tit = (num(fiscal.titularidad) ?? 100) / 100;
  // Días sin alquilar (y no vivienda habitual): imputación de rentas.
  const imputacion = vc !== null && dias < diasAnio ? vc * (fiscal.catastralRevisado ? 0.011 : 0.02) * (diasAnio - dias) / diasAnio : 0;
  const red = (v) => Math.round(v * 100) / 100;
  return {
    diasAnio, dias, ingreso: red(ingreso), gastos: red(otros), interesesYReparacion: red(limite), exceso: red(exceso),
    amortizacion: amortizacion === null ? null : red(amortizacion), neto: red(neto), pctReduccion: pctRed || 0,
    reduccion: red(reduccion), netoReducido: red(netoReducido), titularidad: tit * 100, tuParte: red(netoReducido * tit),
    imputacion: red(imputacion * tit), faltan,
  };
}
// Inmueble a disposición (segunda vivienda, vacío): no alquila, imputa renta por los días del año.
function calcImputacion({ fiscal = {}, anio }) {
  const r = calcRentaInmueble({ ingreso: 0, gastoDeducible: 0, fiscal: { ...fiscal, diasArrendado: 0, intereses: { [anio]: 0 }, reduccion: 0, pctConstruccion: fiscal.pctConstruccion ?? 0 }, anio });
  return { imputacion: r.imputacion, falta: typeof fiscal.valorCatastral === "number" ? null : "valor catastral" };
}

/* ============================================================
   PESTAÑA INTELIGENCIA — hallazgos locales, sin llamadas externas
   ============================================================ */
// Días sin cargo tras los que un recurrente se marca "posible baja". Para lo mensual, ~3
// meses (la regla del usuario: si llevas 3 meses sin cobro, quizá diste de baja el servicio).
const STALE_GAP = { semanal: 30, mensual: 92, bimestral: 140, trimestral: 200, semestral: 380, anual: 730 };

/* ============================================================
   EXPLORADOR JERÁRQUICO (gasto/ingreso · macro→categoría→comercio
   o activo→categoría→comercio)
   ============================================================ */
function buildHierarchy(parts, kind, group) {
  const tree = new Map();
  let total = 0;
  for (const p of parts) {
    // Devolución (positivo en categoría de gasto) va al lado de GASTOS y resta, no a ingresos.
    const isGasto = p.amount < 0 || isRefundPart(p);
    if (kind === "gastos" ? !isGasto : isGasto) continue;
    const v = isGasto ? -p.amount : p.amount; // gasto: compra suma, devolución resta
    total += v;
    let l1, l2, l3;
    if (kind === "ingresos") { l1 = p.cat; l2 = p.mov.pattern; l3 = null; }
    else if (group === "activo") { l1 = p.asset || "Sin activo"; l2 = p.cat; l3 = p.mov.pattern; }
    else { l1 = macroOf(p.cat); l2 = p.cat; l3 = p.mov.pattern; }
    if (!tree.has(l1)) tree.set(l1, { total: 0, children: new Map() });
    const n1 = tree.get(l1); n1.total += v;
    if (!n1.children.has(l2)) n1.children.set(l2, { total: 0, children: new Map(), sample: p.mov.concept, count: 0 });
    const n2 = n1.children.get(l2); n2.total += v; n2.count++;
    if (l3) {
      if (!n2.children.has(l3)) n2.children.set(l3, { total: 0, sample: p.mov.concept, count: 0 });
      const n3 = n2.children.get(l3); n3.total += v; n3.count++;
    }
  }
  return { total, tree };
}

/* Tu servidor no se actualiza solo: si le faltan capacidades que esta app usa, se dice cuáles
   y qué ganas al actualizarlo. */
const RASGOS_BACKEND = {
  "nonce-banco": "volver del banco de forma segura",
  "borrar-servidor": "borrar tus datos también del servidor",
  "historial-30-dias": "guardar una versión por día del último mes",
  "saldo-por-movimiento": "saldo al día con las revisiones automáticas",
  "permiso-180-dias": "permiso del banco de hasta 180 días (la mitad de reconexiones)",
};

/* Conciliación: ¿cuadran los movimientos con el saldo que da el banco tras cada uno? Día a día,
   el saldo al cerrar debe ser el del día anterior más los movimientos del día, y tiene que ser
   uno de los saldos que el banco puso a esos movimientos (dentro del día el orden no se sabe).
   Si no, falta o sobra algún movimiento (un duplicado, un hueco). Devuelve null si el banco
   no da saldos, o { dias, desde, hasta, descuadres: [{ dia, diferencia }] }. */
function conciliar(movs, conn) {
  const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const porDia = new Map();
  for (const m of movs) {
    if (!m.bankId || m.file !== (conn.aspsp || "Banco") || typeof m.bs !== "number") continue;
    if (conn.accountUid && m.accountUid && m.accountUid !== conn.accountUid) continue;
    const k = dia(m.date);
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(m);
  }
  if (!porDia.size) return null;
  const dias = [...porDia.keys()].sort();
  const cerca = (a, b) => Math.abs(a - b) < 0.015;
  const descuadres = [];
  let cierre = null;
  for (const k of dias) {
    const ms = porDia.get(k);
    const suma = ms.reduce((t, m) => t + m.amount, 0);
    const saldos = ms.map((m) => m.bs);
    if (cierre === null) {
      // Primer día: la apertura es el saldo de antes de alguno de sus movimientos.
      const ap = ms.map((m) => m.bs - m.amount).find((o) => saldos.some((x) => cerca(x, o + suma)));
      cierre = ap !== undefined ? ap + suma : saldos[saldos.length - 1];
      continue;
    }
    const esperado = cierre + suma;
    const ok = saldos.find((x) => cerca(x, esperado));
    if (ok !== undefined) { cierre = ok; continue; }
    const real = saldos.reduce((b, x) => (Math.abs(x - esperado) < Math.abs(b - esperado) ? x : b), saldos[0]);
    descuadres.push({ dia: k, diferencia: Math.round((real - esperado) * 100) / 100 });
    cierre = real; // se sigue desde lo que dice el banco, para no arrastrar el mismo error
  }
  return { dias: dias.length, desde: dias[0], hasta: dias[dias.length - 1], descuadres };
}

// Saldo del banco al día (ver el comentario en App, junto a su uso).
function computeBankSaldo(connections, movs) {
  const conns = (connections || []).filter((c) => typeof c.balance === "number");
  if (!conns.length) return null;
  const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let total = 0, estimado = false, hasta = null;
  for (const c of conns) {
    const base = typeof c.balanceBooked === "number" ? c.balanceBooked : c.balance;
    const baseDia = String((typeof c.balanceBooked === "number" ? c.balanceBookedAt : c.balanceAt) || (c.balanceRead || c.lastSync ? dia(new Date(c.balanceRead || c.lastSync)) : "")).slice(0, 10);
    const deLaConexion = (m) => m.bankId && m.file === (c.aspsp || "Banco") && !m.omit;
    const despues = baseDia ? movs.filter((m) => deLaConexion(m) && dia(m.date) > baseDia) : [];
    // Llegados DESPUÉS de leer el saldo aunque sean del mismo día (sincronizas a mano por la
    // mañana y la revisión de la tarde trae otro de hoy): su saldo es más nuevo que el leído.
    // Lo que llegó ANTES de leer el saldo ya está dentro de él (la sincronización manual trae
    // los movimientos y luego lee el saldo), así que no cuenta como nuevo.
    const nuevos = movs.filter((m) => deLaConexion(m) && (m.at && c.balanceRead ? m.at > c.balanceRead : dia(m.date) > baseDia));
    if (!nuevos.length) { total += c.balance; continue; }
    nuevos.sort((a, b) => (a.date - b.date) || ((a.at || 0) - (b.at || 0)));
    const ult = nuevos[nuevos.length - 1];
    if (typeof ult.bs === "number") total += ult.bs;
    else if (despues.length) { total += base + despues.reduce((s, m) => s + m.amount, 0); estimado = true; }
    else { total += c.balance; continue; }
    if (!hasta || ult.date > hasta) hasta = ult.date;
  }
  return { amount: Math.round(total * 100) / 100, estimado, hasta };
}

/* Integra un overlay (modal, panel, drill) con el botón "atrás" del navegador /
   teléfono: al abrirse mete una entrada en el historial; el gesto/boton atrás
   dispara popstate y lo cierra en vez de salir de la app. Imprescindible en la
   PWA de iPhone, donde no hay barra de navegador.

   Cada overlay lleva un id propio: con un marcador común, cerrar uno con la X
   consumía la entrada de otro y dejaba entradas huérfanas en el historial, de
   modo que el siguiente "atrás" salía de la app. Dentro de un iframe aislado
   (artefacto) history puede lanzar SecurityError, así que todo va protegido:
   si falla, el overlay se sigue cerrando con la X. */
const overlayStack = [];

function tryHistory(fn) { try { fn(); return true; } catch { return false; } }

/* ============================================================
   RED DE SEGURIDAD ANTE FALLOS DE RENDER
   Sin esto, una excepción al pintar cualquier componente deja la app en blanco y da la
   falsa sensación de "he perdido todo". Aquí capturamos el fallo, mantenemos los datos
   intactos en su sitio y ofrecemos descargar una copia de seguridad y recargar.
   ============================================================ */
function recoverBackupFromStore() {
  // Lee directamente el almacenamiento (no depende del estado de React, que puede estar roto)
  // y arma un JSON importable; si algo no se puede parsear, va en crudo para no perder nada.
  const out = { app: "finanzas-personales", version: 3, exportado: new Date().toISOString(), recuperacion: true };
  try {
    const rawM = window.localStorage?.getItem(STORE_KEYS.movs);
    const rawC = window.localStorage?.getItem(STORE_KEYS.cfg);
    try { out.movs = rawM ? JSON.parse(rawM) : null; } catch { out.movsRaw = rawM; }
    try { out.cfg = rawC ? JSON.parse(rawC) : null; } catch { out.cfgRaw = rawC; }
  } catch { /* almacenamiento no accesible */ }
  return out;
}

// Conversaciones del asistente (varias, con menú). El título se deriva del primer mensaje.
const CHATS_KEY = "finz:chats:v1";
const newConv = () => ({ id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), title: "", msgs: [], updatedAt: Date.now() });
const convTitle = (c) => (c.title || (c.msgs.find((m) => m.role === "user")?.content || "")).trim().slice(0, 40) || "Nueva conversación";

// El tema se cambia desde la app; las exportaciones de ES son de solo lectura.
function setTema(t) { THEME = t; }

export {
  ACCESO_GUARDADO_KEY,
  ACCESS_ITER,
  ACCESS_KEY,
  ACCESS_MIN,
  AI_MODEL,
  AI_PRESETS,
  ALL_TABS,
  AMOUNT_BUCKET,
  ASSET_EMOJI,
  BANK_KEY,
  BANK_PREFIXES,
  BIZUM_FALLBACK,
  BUILD_STAMP,
  C,
  CADENCE_MONTHS,
  CAPPED_KEYS,
  CARD_OP_RE,
  CATEGORIES,
  CATEGORIES_GASTO,
  CATEGORIES_INGRESO,
  CATEGORIES_TRANSFER,
  CAT_COLORS,
  CAT_FILTER_GROUPS,
  CHAIN_RE,
  CHATS_KEY,
  CHUNK_SIZE,
  CONDITIONAL_RULES,
  DAY_MS,
  DEFAULT_AI_CFG,
  DEFAULT_MATERIALIDAD,
  DEFAULT_REDUCIBLE,
  DEFAULT_RULES,
  DEFENSIVE_RULES,
  DEPLOY_URL,
  EAT_CAPS,
  EMOJI_CHOICES,
  ENTITY_STOP,
  ES_HIPOTECA,
  FILTER_SCHEMA,
  GASTO_SET,
  GASTO_SORTED,
  GENERIC_OP_RE,
  GENERIC_WORD_RULES,
  GROUP_COLORS,
  GROUP_EMOJI,
  GUIA_URL,
  HEADER_WORDS,
  IMPORT_CURRENCIES,
  INGRESO_SET,
  INGRESO_SORTED,
  INTERNAL_SET,
  LLEGA_CON_ENLACE,
  L_BAND,
  MACROS,
  MACRO_EMOJI,
  MACRO_HUES,
  MACRO_OF,
  MACRO_SLOTS,
  MERCHANT_RULES,
  MES_ES,
  NEUTRAL_CAT,
  NEUTRAL_TRANSFER,
  NO_INFER,
  PERYEAR_MONTHS,
  PRIO,
  PROCESSOR_RE,
  PROCESSOR_TAIL_RE,
  R,
  RASGOS_BACKEND,
  RC,
  RECEIPT_CATS,
  REFUND_NEEDS_MARK,
  REFUND_RE,
  RENTA_CONCEPTO,
  RENTA_CUOTA,
  RENTA_REVISAR,
  SAFETY_RULES,
  SAMPLE_GROUPS,
  SIGNO_NEG,
  SIGNO_RE,
  SNAP_MAX_CHARS,
  SNAP_PREFIX,
  STALE_GAP,
  STORE,
  STORE_KEYS,
  SYNC_KEY,
  THEME,
  THEME_KEY,
  TIPOS_ACTIVO,
  TOKENS,
  TRANSFER_COLORS,
  TRANSFER_SET,
  TRANSFER_SORTED,
  TRANSF_CONCEPT_RE,
  VIVIENDA,
  WEB_MAX_USES,
  WEB_SEARCH_USD,
  _clamp01,
  _linToSrgb,
  _ruleRe,
  _sortedCache,
  _srgbToLin,
  abrirAcceso,
  accesoGuardado,
  aiCategorizePatterns,
  aiChatWithTools,
  aiProviderLabel,
  aiSupportsWeb,
  aiText,
  ambKey,
  ambiguousPatterns,
  analyzeReceiptTrends,
  analyzeRows,
  anthropicRequest,
  applyCfg,
  asArr,
  assetOfMovCtx,
  auditRules,
  avisoNombres,
  b64u,
  bankErrDetail,
  bankIsEmpty,
  buildAgentTools,
  buildAlerts,
  buildAssistantSystem,
  buildBehaviorModel,
  buildCatColors,
  buildGroupProposal,
  buildHierarchy,
  buildICS,
  buildMonthClose,
  buildMovements,
  buildRecap,
  buildReclassProposal,
  calcImputacion,
  calcRentaInmueble,
  catColor,
  catSorter,
  catsOfMov,
  classifyForImport,
  claveEnlace,
  compactTrends,
  computeBankSaldo,
  computeOutliers,
  conciliar,
  convTitle,
  customRulesOf,
  daysBetween,
  decodeBuffer,
  dedupeAgainst,
  defaultHeuristic,
  describePeriod,
  deserializeMovs,
  detectDelimiter,
  detectRecurring,
  disabledBaseIdsOf,
  dropCapped,
  eqi,
  estimateWebCostUSD,
  expandParts,
  extractJSONObject,
  filterMovs,
  fmtAgo,
  fmtCuando,
  fmtDate,
  fmtDateShort,
  fmtE,
  fmtE0,
  fmtMonths,
  fmtPct,
  genSampleCSV,
  hasExplicitCat,
  hexToOklch,
  icsDay,
  icsFold,
  icsText,
  identifiesMerchant,
  inferByBehavior,
  initialTheme,
  isConditional,
  isProcessorPattern,
  isRefund,
  isRefundPart,
  isSpreadsheetFile,
  isWeekend,
  isoDay,
  jaccard,
  learnedRule,
  leerAccesoGuardado,
  listSnapshots,
  loadBank,
  loadSync,
  lockBodyScroll,
  macroColor,
  macroOf,
  makeAccessLink,
  makeStore,
  marcarAccesoGuardado,
  matchRule,
  merchantEntity,
  merchantTokens,
  mergeBank,
  migrateCat,
  missingIncome,
  monthKey,
  monthLabel,
  monthLabelLong,
  monthPhase,
  monthsCoveredOf,
  movInGroup,
  movKey,
  mulberry32,
  naiveBayesScores,
  needsAmount,
  newConv,
  nextByMonths,
  nfEUR,
  nfEUR0,
  nfNum,
  normalizePattern,
  oklchToHex,
  openaiRequest,
  orderByInfoGain,
  overlayStack,
  parseAccessLink,
  parseDateAny,
  parseEsNumber,
  parseLooseDate,
  parteFiltro,
  planSnapshotRetention,
  r2,
  r2c,
  rampFor,
  rebuildRules,
  receiptSeries,
  recordarAcceso,
  recoverBackupFromStore,
  refundFromHistory,
  refundIndex,
  rentaConceptos,
  resolveCatNames,
  resolveMacroNames,
  ruleConditionsHold,
  ruleId,
  ruleRegex,
  runAgentTool,
  runList,
  runQuery,
  saveBank,
  saveSync,
  scrollLocks,
  serializeCfg,
  serializeMovs,
  setItemSeguro,
  setTema,
  shadeRamp,
  shouldSnapshot,
  sortedRules,
  spreadsheetToRows,
  stripAccents,
  tipoActivo,
  tnum,
  toDateInput,
  toEsNum,
  tokenizeCSV,
  totalV,
  totalsOf,
  tryHistory,
  unb64u,
  unlockBodyScroll,
  upcomingCharges,
  upcomingIncome,
  viviendaPorDefecto,
  writeSnapshot,
};
