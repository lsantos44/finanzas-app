import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  Upload, Plus, X, ChevronDown, ChevronRight, ChevronLeft, Sparkles, Send, Pencil,
  AlertTriangle, Check, Scissors, Info, Trash2, Loader2, FileText, RefreshCw,
  LayoutGrid, Car, Tag, PiggyBank, Bot, Search, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Minus, Filter, Wallet, Calendar, Target, Settings, Download, CalendarDays, History, GitBranch, ClipboardList, Star,
  Sun, Moon, Menu, Landmark
} from "lucide-react";

/* ============================================================
   TOKENS DE DISEÑO
   Dos temas con las mismas claves. `C` es un proxy que lee el tema activo y
   devuelve SIEMPRE un hex real: recharts pinta los colores como atributos SVG
   (stroke, fill), donde un var(--x) de CSS no se resolvería.
   ============================================================ */
const THEME_KEY = "finz:theme:v1";
// Sello de versión visible (en Ajustes y en el pie): sirve para confirmar de un vistazo
// qué build está desplegado. Se sube a mano en cada despliegue.
const APP_BUILD = "2026-09-08";
const TOKENS = {
  light: {
    bg: "#F3F6FA", surface: "#FFFFFF", surfaceAlt: "#F8FAFC",
    ink: "#0F1B2D", ink2: "#33415C", muted: "#5E6E85", faint: "#93A1B5",
    line: "#E4EAF2", lineStrong: "#C9D5E3",
    navy: "#0B2545", navy2: "#15406F",
    accent: "#1266C0", accentHover: "#0E54A0", accentSoft: "#E7F0FB",
    teal: "#0FA3A3", tealSoft: "#E2F5F5",
    income: "#0B8457", incomeSoft: "#E4F5EE",
    expense: "#D24955", expenseSoft: "#FBEBEC",
    warn: "#B26A05", warnSoft: "#FDF3E3",
    extra: "#C08A00", extraSoft: "#FCF4DC",
  },
  dark: {
    bg: "#0D0F13", surface: "#16181D", surfaceAlt: "#1C1F26",
    ink: "#ECEEF2", ink2: "#C3C7D0", muted: "#98A0AE", faint: "#6B7280",
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
  "Vivienda", "Suministros", "Telecomunicaciones", "Hogar", "Compras",
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
const ASSET_EMOJI = { Coche: "🚗", Casa: "🏠", Mascota: "🐾", "Segunda residencia": "🏖️" };
const EMOJI_CHOICES = ["🚗", "🏠", "🏖️", "🐾", "💻", "🛵", "🚲", "⛵", "📦", "🎸", "🏍️", "🚐"];
const GROUP_EMOJI = ["🏃", "✈️", "🎉", "🎄", "💍", "🍼", "🏖️", "🎓", "🏡", "🎮", "📸", "🎁", "⚽", "🚴", "🏔️", "🛠️"];

/* ============================================================
   MACRO-CATEGORÍAS (nivel superior del desglose jerárquico)
   ============================================================ */
const MACROS = [
  { name: "Hogar", emoji: "🏠", kind: "gasto", cats: ["Vivienda", "Suministros", "Hogar", "Telecomunicaciones"] },
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
  R("HIPOTECA", "Vivienda", "Algodonales 10"), R("PRESTAMO HIPOTECARIO", "Vivienda", "Algodonales 10"),
  R("CUOTA HIPOTECA", "Vivienda", "Algodonales 10"), R("ALQUILER", "Vivienda", "Algodonales 10"),
  R("COMUNIDAD PROPIETARIOS", "Vivienda", "Algodonales 10"), R("COMUNIDAD DE PROP", "Vivienda", "Algodonales 10"),
  R("ADMINISTRADOR FINCAS", "Vivienda", "Algodonales 10"), R("COMUNIDAD", "Vivienda", "Algodonales 10"),
  R("IBI", "Impuestos", "Algodonales 10"), R("SEGURO HOGAR", "Seguros", "Algodonales 10"), R("OCASO", "Seguros", "Algodonales 10"),
  // — Suministros
  R("IBERDROLA", "Suministros", "Algodonales 10"), R("ENDESA", "Suministros", "Algodonales 10"),
  R("NATURGY", "Suministros", "Algodonales 10"), R("HOLALUZ", "Suministros", "Algodonales 10"),
  R("TOTALENERGIES", "Suministros", "Algodonales 10"), R("TOTAL ENERGIES", "Suministros", "Algodonales 10"),
  R("OCTOPUS ENERGY", "Suministros", "Algodonales 10"), R("PLENITUDE", "Suministros", "Algodonales 10"),
  R("PEPEENERGY", "Suministros", "Algodonales 10"), R("REPSOL LUZ", "Suministros", "Algodonales 10"),
  R("CANAL DE ISABEL", "Suministros", "Algodonales 10"), R("CANAL ISABEL", "Suministros", "Algodonales 10"),
  R("AGUAS DE", "Suministros", "Algodonales 10"), R("EMASESA", "Suministros", "Algodonales 10"),
  R("AQUALIA", "Suministros", "Algodonales 10"), R("HIDRALIA", "Suministros", "Algodonales 10"),
  R("EMIVASA", "Suministros", "Algodonales 10"), R("AQUASERVICE", "Suministros", "Algodonales 10"),
  R("GAS NATURAL", "Suministros", "Algodonales 10"),
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
  R("ELECTRICIDAD", "Suministros", "Algodonales 10"), R("ENERGIA", "Suministros", "Algodonales 10"),
  R("LUZ", "Suministros", "Algodonales 10"), R("AGUA", "Suministros", "Algodonales 10"), R("GAS", "Suministros", "Algodonales 10"),
  R("BASURA", "Suministros", "Algodonales 10"), R("ALCANTARILLADO", "Suministros", "Algodonales 10"),
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
    // El activo "Casa" se fusionó con "Algodonales 10" (era un duplicado de la vivienda).
    assetName: m.assetName === "Casa" ? "Algodonales 10" : m.assetName,
    splits: m.splits?.length ? m.splits.map((s) => ({ ...s, cat: migrateCat(s.cat) })) : m.splits,
  })).filter((m) => m.date instanceof Date && !isNaN(m.date));
  return list;
}
/* Solo se guardan tus reglas (scope "personal") y qué reglas de fábrica has apagado.
   Así las de fábrica pueden mejorar en futuras versiones sin quedar congeladas, y una
   regla base desactivada NO reaparece al recargar (antes sí: `deleteRule` la borraba
   del array en memoria, pero al arrancar se volvía a construir desde DEFAULT_RULES). */
const customRulesOf = (rules) => rules.filter((r) => r.scope === "personal");
const disabledBaseIdsOf = (rules) => rules.filter((r) => r.scope !== "personal" && r.active === false).map(ruleId);

const rebuildRules = (customRules, disabledIds) => {
  const off = new Set(disabledIds || []);
  return [
    ...(customRules || []).map((r) => ({ ...r, cat: migrateCat(r.cat), scope: "personal", prio: r.prio ?? PRIO.personal })),
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
      id: ruleId(r), k: r.k, cat: r.cat, asset: r.asset || null,
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
    v: 3, customRules: customRulesOf(rules), disabledRules: disabledBaseIdsOf(rules),
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
  if (Array.isArray(c.customRules)) setters.setRules(rebuildRules(c.customRules, c.disabledRules));
  if (typeof c.aiOn === "boolean") setters.setAiOn(c.aiOn);
  if (c.ai && typeof c.ai === "object" && typeof c.ai.provider === "string") setters.setAi?.({ ...DEFAULT_AI_CFG, ...c.ai });
  if (Array.isArray(c.aiProfiles)) setters.setAiProfiles?.(c.aiProfiles);
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
const saveSync = (v) => { try { window.localStorage?.setItem(SYNC_KEY, JSON.stringify(v)); } catch { /* cuota */ } };

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
    workerUrl: local.workerUrl || incoming.workerUrl || "",
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
    window.localStorage?.setItem(BANK_KEY, JSON.stringify({ ...v, updatedAt: Date.now() }));
  } catch { /* cuota */ }
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
  s = s.replace(/[0-9]/g, " ").replace(/[/\\:;,._'"()\-]+/g, " ").replace(/\s+/g, " ").trim();
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
const GENERIC_OP_RE = /^(TRANSFER|TRANSFERENCIA|BIZUM|TRASPASO|INGRESO|REINTEGRO|CAJERO|NOMINA|DEVOLUCION|ADEUDO|RECIBO|DOMICILIACION|EFECTIVO|ABONO|CARGO|LIQUIDACION|COMISION|VARIOS)\b/;

/* ¿El patron identifica a un comercio concreto? Solo entonces tiene sentido que una accion
   sobre un movimiento se aplique a todos los que comparten patron. */
function identifiesMerchant(pattern) {
  const p = stripAccents(String(pattern || "").toUpperCase()).trim();
  return !!p && !isProcessorPattern(p) && !GENERIC_OP_RE.test(p);
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

function matchRule(pattern, amount, rules, date = null) {
  const p = stripAccents(String(pattern).toUpperCase());
  const isIncome = amount > 0;
  for (const r of sortedRules(rules)) {
    if (r.active === false) continue; // baja lógica: la regla existe pero está apagada
    const k = stripAccents(String(r.k).toUpperCase()).trim();
    if (!k) continue;
    // Una regla de categoría de GASTO no debe capturar un ingreso (mismo texto, signo opuesto):
    // p. ej. "ALQUILER" que pagas (Vivienda) vs. el que cobras (Alquileres cobrados).
    if (isIncome && !INGRESO_SET.has(r.cat) && !TRANSFER_SET.has(r.cat)) continue;
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
  const cols = { date: -1, date2: -1, concept: -1, amount: -1, cargo: -1, abono: -1, saldo: -1 };
  if (headers) {
    headers.forEach((h, i) => {
      if (/fecha/.test(h)) { if (/valor/.test(h)) cols.date2 = i; else if (cols.date < 0) cols.date = i; }
      else if (/concepto|descripcion|movimiento|detalle|observ/.test(h)) { if (cols.concept < 0) cols.concept = i; }
      else if (/saldo/.test(h)) cols.saldo = i;
      else if (/cargo|debe|debito|pagos/.test(h)) cols.cargo = i;
      else if (/abono|haber|credito|ingreso/.test(h)) cols.abono = i;
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
  if (cols.concept < 0) {
    let best = -1, bestLen = -1;
    stats.forEach((s, i) => {
      if (i === cols.date || i === cols.date2 || i === cols.amount || i === cols.cargo || i === cols.abono || i === cols.saldo) return;
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

  movs.sort((a, b) => a.d - b.d);
  let saldo = 6200;
  for (const mv of movs) { saldo = Math.round((saldo + mv.a) * 100) / 100; mv.s = saldo; }
  movs.reverse();
  const lines = [
    "BANCO EJEMPLO DE ESPAÑA;;;;",
    "Titular: LAURA GARCÍA PÉREZ;;;;",
    "IBAN: ES21 0049 0001 5021 3456 7890;;;;",
    `Saldo a fecha 31/05/2026: ${toEsNum(saldo)} EUR;;;;`,
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

  alerts.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === "alta" ? -1 : 1));
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
    const toks = merchantTokens(m.pattern);
    for (const t of new Set(toks)) addFeat("tok", t, cat);

    const ent = merchantEntity(m.pattern);
    bumpMap(entityCat, ent, cat);
    if (!entityTokenSets.has(ent)) entityTokenSets.set(ent, new Set(toks));
    else for (const t of toks) entityTokenSets.get(ent).add(t);

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
  const toks = [...new Set(merchantTokens(m.pattern))];
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

  // 1) Entidad conocida (match exacto o fuzzy por tokens)
  const ent = merchantEntity(m.pattern);
  let entHit = model.entityCat.get(ent);
  if (!entHit) {
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

function buildMonthClose({ movs, receiptTrends, upcoming, saldoSerie, dataRange, realSaldo = null }) {
  if (!movs || !movs.length || !dataRange) return null;
  const lastDate = dataRange[1];
  const mesKey = monthKey(lastDate);
  const [ly, lm] = mesKey.split("-").map(Number);
  const prevKey = monthKey(new Date(ly, lm - 2, 1));

  let gastoMes = 0, ingresoMes = 0, gastoPrev = 0, ingresoPrev = 0;
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
      if (asGasto) gastoPrev -= m.amount; else ingresoPrev += m.amount;
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
    saldoNow: saldoNow != null ? r2c(saldoNow) : null, saldoReal: realSaldo != null,
    saldoProj, pendientes: r2c(pendientes), ingresosPrev: r2c(ingresosPrev),
    discrecional: r2c(discrecional), diasRestantes,
  };
}

const RECEIPT_CATS = new Set(["Suministros", "Telecomunicaciones", "Vivienda", "Seguros", "Impuestos", "Comisiones", "Suscripciones", "Educación"]);

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
function classifyForImport(freshMovs, existingMovs, rules, { materialidad = DEFAULT_MATERIALIDAD, assetMem = {} } = {}) {
  const behavior = buildBehaviorModel(existingMovs || []);
  const repByPattern = new Map();
  for (const m of freshMovs) {
    const prev = repByPattern.get(m.pattern);
    if (!prev || m.date > prev.date) repByPattern.set(m.pattern, m);
  }
  const dec = new Map();
  for (const m of freshMovs) {
    const r = matchRule(m.pattern, m.amount, rules, m.date);
    if (r) {
      // Una regla defensiva clasifica, pero pide que lo mires: crea el pendiente a propósito.
      dec.set(m.id, {
        // La memoria de activos manda sobre la regla solo si la regla no trae activo propio.
        cat: r.cat, asset: r.asset || assetMem[m.pattern] || null,
        confirmed: !r.confirm, source: "regla", rule: r.k ? r : null,
      });
      continue;
    }
    const rep = repByPattern.get(m.pattern);
    const guess = rep ? inferByBehavior(behavior, rep) : null;
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
  let out = ctx.movs;
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

const totalsOf = (list) => ({
  movimientos: list.length,
  gasto: r2(list.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0)),
  ingreso: r2(list.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0)),
  get neto() { return r2(this.ingreso - this.gasto); },
});

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
  const t = totalsOf(list);
  const total = { movimientos: t.movimientos, gasto: t.gasto, ingreso: t.ingreso, neto: t.neto };
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
          sin_confirmar: enPeriodo.filter((m) => !m.confirmed).length,
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
    const push = (key, amount, sample) => {
      if (!acc.has(key)) acc.set(key, { gasto: 0, ingreso: 0, n: 0, sample });
      const x = acc.get(key);
      if (amount < 0) x.gasto += -amount; else x.ingreso += amount;
      x.n++;
    };
    if (dim === "etiqueta") {
      for (const g of ctx.groups) for (const m of list) if (movInGroup(m, g)) push(g.name, m.amount, m.concept);
    } else {
      for (const m of list) {
        const parts = m.splits?.length ? m.splits.map((s) => ({ cat: s.cat, amount: (m.amount * s.pct) / 100 })) : [{ cat: m.category || "Otros", amount: m.amount }];
        for (const p of parts) {
          const key = dim === "categoria" ? p.cat
            : dim === "macro" ? macroOf(p.cat)
            : dim === "comercio" ? m.pattern
            : dim === "activo" ? (assetOfMovCtx(ctx, m) || "Sin activo")
            : dim === "mes" ? monthKey(m.date)
            : dim === "año" ? String(m.date.getFullYear())
            : null;
          if (key === null) { out.nota = "agrupar_por no reconocido: " + dimRaw; return out; }
          push(key, p.amount, m.concept);
        }
      }
    }
    let filas = [...acc.entries()].map(([clave, x]) => ({
      clave, ...(dim === "comercio" ? { ejemplo: x.sample.slice(0, 46) } : {}),
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
  const t = totalsOf(list);
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
      ejemplos: matches.slice(0, 5).map((m) => m.concept.slice(0, 46)),
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
  const acts = ctx.assets.length ? ctx.assets.map((a) => `- ${a.name} (${a.categories.join(", ") || "sin categorías fijas"})`).join("\n") : "- (ninguno definido)";
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
    "Reglas: 1) Cualquier cifra sale de las herramientas; nunca la estimes de memoria. 2) Las consultas se ejecutan en su propio dispositivo: tú solo ves los resultados que devuelven. 3) Si una consulta vuelve vacía, revisa nombres exactos o pregunta. 4) 'Rentabilidad' de un activo aquí significa neto ingresos−gastos de sus movimientos (un extracto no contiene valor de mercado); dilo si procede. 5) Para agrupar gastos transversales usa proponer_etiqueta y deja que el usuario confirme; para corregir categorías (mal clasificados o sin clasificar) usa proponer_reclasificacion con la categoría destino EXACTA, y deja que el usuario aplique. Nunca afirmes que has cambiado nada: solo propones. 6) Para pagos futuros usa proximos_cargos y di que son estimaciones. 7) Un resultado vacío puede significar que NO hay datos de ese periodo, no que no haya habido gasto: contrasta el periodo pedido con el rango de datos y, si cae fuera aunque sea en parte, dilo explícitamente («tus datos llegan hasta el X») en vez de afirmar que no ha gastado nada." + (detail ? "" : " 8) El usuario ha limitado tu acceso: solo agregados, sin movimientos individuales."),
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

/* ============================================================
   ÁTOMOS DE INTERFAZ
   ============================================================ */
function Btn({ children, onClick, kind = "ghost", size = "md", disabled, className = "", title, active }) {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const base = `inline-flex items-center gap-1.5 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${sz}`;
  const kinds = {
    primary: "text-white shadow-sm hover:shadow",
    ghost: "border hover:bg-slate-50 active:bg-slate-100",
    subtle: "hover:bg-slate-100 text-slate-600",
    danger: "border border-rose-200 text-rose-700 hover:bg-rose-50",
  };
  const style = kind === "primary" ? { background: C.accent } : kind === "ghost" ? { borderColor: active ? C.accent : C.line, color: active ? C.accent : C.ink2, background: active ? C.accentSoft : undefined } : {};
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={style} className={`${base} ${kinds[kind]} ${className}`}>
      {children}
    </button>
  );
}
function Card({ children, className = "", style, pad = true }) {
  return <div className={`rounded-2xl border bg-white ${pad ? "" : ""} ${className}`} style={{ borderColor: C.line, boxShadow: "0 1px 2px rgba(16,16,20,.04)", ...style }}>{children}</div>;
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

function Modal({ title, subtitle, onClose, children, wide, footer }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", h);
    lockBodyScroll();
    return () => { window.removeEventListener("keydown", h); unlockBodyScroll(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div className={`relative flex w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl anim-sheet`}>
        <div className="flex shrink-0 items-center gap-2 border-b bg-white px-3 py-2.5 sm:px-5 sm:py-3" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="shrink-0 border-t bg-white px-5 py-3" style={{ borderColor: C.line, paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
          {footer || <Btn onClick={onClose} className="w-full justify-center sm:w-auto">Cerrar</Btn>}
        </div>
      </div>
    </div>
  );
}
function Seg({ options, value, onChange, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex shrink-0 rounded-lg border p-0.5" style={{ borderColor: C.line, background: C.bg }}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value === o.v ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
function MultiSelect({ label, options, groups, selected, onChange, icon }) {
  const [open, setOpen] = useState(false);
  const n = selected.size;
  const toggle = (o, checked) => { const s = new Set(selected); checked ? s.add(o) : s.delete(o); onChange(s); };
  const Item = (o) => (
    <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
      <input type="checkbox" className="accent-blue-600" checked={selected.has(o)} onChange={(e) => toggle(o, e.target.checked)} />
      <span className="truncate">{o}</span>
    </label>
  );
  // `groups` = [{label, items}] pinta cabeceras (gasto/ingreso/transferencia); si no, lista plana.
  const empty = groups ? !groups.some((g) => g.items.length) : options.length === 0;
  return (
    <div className="relative">
      <Btn onClick={() => setOpen(!open)} active={n > 0}>{icon}{label}{n > 0 ? ` · ${n}` : ""} <ChevronDown size={13} /></Btn>
      {open && (
        <>
          {/* En móvil, hoja inferior fija: la barra de filtros tiene overflow-x-auto y
              recortaba el desplegable absoluto. En escritorio, popover normal. */}
          <div className="fixed inset-0 z-50 bg-slate-900/25 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:max-h-72 sm:w-60 sm:rounded-xl sm:shadow-xl" style={{ borderColor: C.line, paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-1 flex items-center justify-between px-2 sm:hidden">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {n > 0 && <button type="button" className="mb-1 w-full rounded-md px-2 py-1 text-left text-xs text-blue-700 hover:bg-slate-50" onClick={() => onChange(new Set())}>Quitar filtro</button>}
            {groups
              ? groups.filter((g) => g.items.length).map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</div>
                    {g.items.map(Item)}
                  </div>
                ))
              : options.map(Item)}
            {empty && <div className="px-2 py-1 text-sm text-slate-500">Sin opciones</div>}
          </div>
        </>
      )}
    </div>
  );
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
function CatSelect({ value, onChange, className = "", allowEmpty }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`} style={{ borderColor: C.line }}>
      {allowEmpty && <option value="">— Elegir —</option>}
      <optgroup label="Ingresos">
        {INGRESO_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Gastos">
        {GASTO_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
      <optgroup label="Transferencias">
        {TRANSFER_SORTED.map((c) => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </select>
  );
}
function AssetSelect({ value, onChange, assets, onCreateAsset, className = "" }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const create = () => {
    const nm = name.trim();
    if (!nm) return;
    const exists = assets.find((a) => a.name.toLowerCase() === nm.toLowerCase());
    if (exists) { onChange(exists.name); setCreating(false); setName(""); return; }
    onCreateAsset?.({ name: nm, emoji });
    onChange(nm);
    setCreating(false); setName(""); setEmoji("📦");
  };
  if (creating) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Icono del activo"
          className="rounded-lg border bg-white px-1.5 py-1.5 text-sm" style={{ borderColor: C.line }}>
          {EMOJI_CHOICES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nombre del activo"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } if (e.key === "Escape") setCreating(false); }}
          className="w-32 rounded-lg border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
        <button type="button" onClick={create} aria-label="Guardar activo" className="rounded-lg px-2 py-1.5 text-sm text-white" style={{ background: C.accent }}><Check size={14} /></button>
        <button type="button" onClick={() => { setCreating(false); setName(""); }} aria-label="Cancelar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
      </div>
    );
  }
  return (
    <select value={value ?? ""} onChange={(e) => { if (e.target.value === "__new__") { setCreating(true); } else { onChange(e.target.value || null); } }}
      className={`rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`} style={{ borderColor: C.line }}>
      <option value="">Sin activo</option>
      {assets.map((a) => <option key={a.id} value={a.name}>{a.emoji} {a.name}</option>)}
      {onCreateAsset && <option value="__new__">➕ Crear activo…</option>}
    </select>
  );
}
/* Alta y edición manual de un movimiento (efectivo, un apunte que falta, o corregir uno
   mal parseado). Un mismo modal para «nuevo» y «editar»: mismos campos, misma validación.
   La fecha se construye a mediodía local para que no baile de día por zona horaria. */
const toDateInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function MovEditModal({ initial, assets, onCreateAsset, onSave, onClose }) {
  const isNew = !initial;
  const [tipo, setTipo] = useState(initial ? (initial.amount >= 0 ? "ingreso" : "gasto") : "gasto");
  const [amountTxt, setAmountTxt] = useState(initial ? String(Math.abs(initial.amount)).replace(".", ",") : "");
  const [dateTxt, setDateTxt] = useState(toDateInput(initial?.date instanceof Date && !isNaN(initial.date) ? initial.date : new Date()));
  const [concept, setConcept] = useState(initial?.concept || "");
  const [category, setCategory] = useState(initial?.splits ? initial.splits[0].cat : (initial?.category || null));
  const [assetName, setAssetName] = useState(initial?.assetName ? initial.assetName : "");
  const [err, setErr] = useState(null);

  const save = () => {
    const mag = Math.abs(parseFloat((amountTxt || "").replace(/\s|\./g, "").replace(",", ".")));
    if (!isFinite(mag) || mag === 0) { setErr("Pon un importe mayor que cero."); return; }
    const [y, m, d] = dateTxt.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    if (isNaN(date)) { setErr("La fecha no es válida."); return; }
    const amount = Math.round((tipo === "gasto" ? -mag : mag) * 100) / 100;
    onSave({ date, amount, concept: concept.trim() || "Sin concepto", category, assetName: assetName || undefined });
    onClose();
  };

  const Label = ({ children }) => <label className="mb-1 block text-xs font-semibold text-slate-500">{children}</label>;
  return (
    <Modal title={isNew ? "Nuevo movimiento" : "Editar movimiento"} subtitle={isNew ? "Añade un gasto o ingreso a mano" : "Corrige los datos de este movimiento"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <Label>Tipo</Label>
          <Seg ariaLabel="Tipo de movimiento" value={tipo} onChange={setTipo}
            options={[{ v: "gasto", l: "Gasto" }, { v: "ingreso", l: "Ingreso" }]} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[8rem] flex-1">
            <Label>Importe (€)</Label>
            <input value={amountTxt} onChange={(e) => setAmountTxt(e.target.value)} autoFocus={isNew} inputMode="decimal" placeholder="0,00"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
          </div>
          <div className="min-w-[8rem] flex-1">
            <Label>Fecha</Label>
            <input type="date" value={dateTxt} onChange={(e) => setDateTxt(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
          </div>
        </div>
        <div>
          <Label>Concepto</Label>
          <input value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={120} placeholder="p. ej. Compra en efectivo, Alquiler cobrado en mano…"
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[8rem] flex-1">
            <Label>Categoría</Label>
            <CatSelect value={category} allowEmpty onChange={setCategory} className="w-full" />
          </div>
          <div className="min-w-[8rem] flex-1">
            <Label>Activo (opcional)</Label>
            <AssetSelect value={assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => setAssetName(v || "")} className="w-full" />
          </div>
        </div>
        {initial?.splits && <p className="text-[11px] text-amber-600">Este movimiento estaba dividido en varias categorías; al guardar aquí se aplicará una sola categoría.</p>}
        {err && <p className="text-xs font-medium" style={{ color: C.expense }}>{err}</p>}
        <Btn kind="primary" onClick={save} className="w-full justify-center">{isNew ? "Añadir movimiento" : "Guardar cambios"}</Btn>
      </div>
    </Modal>
  );
}
function Money({ v, bold, size = "text-sm", positive }) {
  const color = positive ? C.income : v >= 0 ? C.income : C.ink;
  return <span className={`${size} ${bold ? "font-semibold" : ""}`} style={{ ...tnum, color }}>{v >= 0 ? "+" : ""}{fmtE(v)}</span>;
}
function Spinner({ label }) {
  return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {label}</div>;
}
function Pill({ children, color, soft }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: soft, color }}>{children}</span>;
}

/* ============================================================
   GRÁFICOS
   ============================================================ */
/* Donut con drill-down JERÁRQUICO: categorías → comercios → lista de movimientos.
   Antes, clicar una categoría saltaba directo a la lista (confundía). Ahora al pulsar
   una categoría se abre el MISMO gráfico con el desglose por comercio; solo el último
   paso (un comercio concreto) va a la lista. `parts` trae los movimientos ya expandidos
   ({cat, amount, mov}); si no se pasa, se mantiene el comportamiento antiguo. */
function DonutCategories({ byCat, total, onDrill, parts, selectedCat, onHover, income, extraTotal = 0, extraIds = [] }) {
  const [focus, setFocus] = useState(null); // categoría en la que hemos entrado, o null

  // Vista actual: categorías (nivel 0) o comercios de `focus` (nivel 1).
  const view = useMemo(() => {
    if (!focus) {
      // Una categoría puede quedar en negativo en un periodo si las devoluciones superan a
      // las compras: no se pinta como porción (un arco negativo no tiene sentido), pero el
      // total del centro sí la descuenta.
      const entries = [...byCat.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ key: name, name, value }));
      return { entries, viewTotal: total, level: "cat" };
    }
    const map = new Map();
    for (const p of parts || []) {
      // Ingresos = importes positivos; gastos = negativos.
      if (p.cat !== focus || (income ? p.amount <= 0 : p.amount >= 0)) continue;
      const k = p.mov.pattern;
      if (!map.has(k)) map.set(k, { key: k, name: p.mov.concept.slice(0, 30), value: 0, ids: [] });
      const e = map.get(k);
      e.value += income ? p.amount : -p.amount;
      e.ids.push(p.mov.id); // qué movimientos componen exactamente esta porción
    }
    const entries = [...map.values()].sort((a, b) => b.value - a.value);
    return { entries, viewTotal: entries.reduce((s, e) => s + e.value, 0), level: "merchant" };
  }, [focus, byCat, total, parts, income]);

  const { entries, viewTotal, level } = view;
  const canDrillIn = !!parts; // hay datos para bajar un nivel

  if (entries.length === 0) return <div className="flex h-[220px] items-center justify-center text-sm text-slate-500">{income ? "Sin ingresos en este periodo." : "Sin gastos en este periodo."}</div>;

  // Antes se agrupaba todo lo que pasara de 9 en una porción gris "Otras" que, además, ignoraba
  // el clic. En una vista anual ese trozo era enorme y parecía la app rota. Se pintan TODAS las
  // categorías: cada porción es suya y se puede pulsar. La lista de la derecha sigue llevando el
  // detalle para las porciones finas.
  const chartData = entries;

  // En nivel 1, degradado del tono de la categoría (más intenso = más importante).
  const ramp = level === "merchant" ? shadeRamp(catColor(focus), entries.length) : null;
  const sliceColor = (d, i) => (level === "cat" ? catColor(d.name) : (ramp[i] || catColor(focus)));
  const sliceOpacity = (d) => (level === "cat" && selectedCat && selectedCat !== d.name ? 0.35 : 1);

  const activate = (d) => {
    if (!d || !d.key) return;
    if (level === "cat") {
      if (canDrillIn) setFocus(d.key);            // entra al desglose por comercio
      else onDrill({ type: "cat", key: d.key, label: d.key });
    } else {
      // El detalle es EXACTAMENTE lo que suma esta porción, no toda la subcategoría:
      // si la porción son 2 movimientos, se ven esos 2; si es uno, ese uno.
      onDrill({ type: "ids", ids: d.ids, label: d.name });
    }
  };

  return (
    <div>
      {focus && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setFocus(null)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <ChevronLeft size={14} /> Todas las categorías
          </button>
          <button type="button" onClick={() => onDrill({ type: "cat", key: focus, label: focus })} className="text-xs font-medium hover:underline" style={{ color: C.accent }}>
            Ver movimientos de {focus}
          </button>
        </div>
      )}
      <div className="grid items-center gap-2 sm:grid-cols-[200px_1fr]">
        <div className="relative" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={88} paddingAngle={1.5}
                stroke={C.surface} strokeWidth={2} onClick={activate}>
                {chartData.map((d, i) => (
                  <Cell key={d.key} fill={sliceColor(d, i)} cursor="pointer" opacity={sliceOpacity(d, i)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Esta capa cubre TODO el gráfico (inset-0), anillo incluido. Sin pointer-events-none
              se traga los clics de las porciones y el anillo entero deja de responder: solo el
              subtítulo vuelve a capturarlos, con pointer-events-auto. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="max-w-[110px] truncate text-[11px] text-slate-400">{focus || (income ? "Ingresos" : "Gasto")}</span>
            <span className="text-lg font-semibold" style={tnum}>{fmtE0(viewTotal)}</span>
            {/* Los extraordinarios no entran en el anillo (distorsionarían medias y proyecciones),
                pero salieron de la cuenta igual. Sin esta línea el total del centro no cuadra con
                el dinero real del periodo y no hay forma de saber que faltan. */}
            {!focus && extraTotal > 0 && (
              <button type="button" onClick={() => extraIds.length && onDrill({ type: "ids", ids: extraIds, label: income ? "Ingresos extraordinarios" : "Gastos extraordinarios" })}
                className="pointer-events-auto mt-0.5 flex max-w-[118px] items-center gap-1 rounded px-1 text-[10px] font-medium leading-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ color: C.extra }} title={`Con extraordinarios: ${fmtE0(viewTotal + extraTotal)}. Pulsa para verlos.`}>
                <Star size={9} className="shrink-0" fill="currentColor" />
                <span className="truncate">+{fmtE0(extraTotal)} extra</span>
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[220px] space-y-0.5 overflow-y-auto pr-1">
          {entries.map((e, i) => (
            <button key={e.key} type="button" onClick={() => activate(e)}
              onMouseEnter={() => level === "cat" && onHover?.(e.name)} onMouseLeave={() => level === "cat" && onHover?.(null)}
              className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: sliceColor(e, i), opacity: sliceOpacity(e, i) }} />
              <span className="flex-1 truncate text-sm">{e.name}</span>
              <span className="text-sm font-medium" style={tnum}>{fmtE0(e.value)}</span>
              <span className="w-11 text-right text-xs text-slate-400" style={tnum}>{viewTotal > 0 ? fmtPct(e.value / viewTotal) : "–"}</span>
              <ChevronRight size={13} className="text-slate-300 transition-colors group-hover:text-slate-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedTime({ buckets, topCats, isDay, onPick }) {
  if (!buckets.length) return <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">Sin datos en el rango.</div>;
  const keys = [...topCats, "Resto"];
  const TT = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const tot = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.line, minWidth: 160 }}>
        <div className="mb-1 font-semibold">{label}</div>
        {payload.filter((p) => p.value > 0).reverse().map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3" style={tnum}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: p.fill }} />{p.dataKey}</span>
            <span>{fmtE0(p.value)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t pt-1 font-medium" style={{ ...tnum, borderColor: C.line }}><span>Total</span><span>{fmtE0(tot)}</span></div>
        {!isDay && <div className="mt-1 text-[10px] text-slate-400">Pulsa para filtrar este periodo</div>}
      </div>
    );
  };
  return (
    <div style={{ height: 248 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 6, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%"
          onClick={(e) => { if (!isDay && e?.activeLabel && onPick) onPick(e.activeLabel); }}>
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => nfNum.format(v) + "€"} />
          <Tooltip content={<TT />} cursor={{ fill: "rgba(67,56,202,.06)" }} />
          {/* Trazo de 2 px del color de la superficie entre segmentos apilados: es lo que
              hace legible la pila cuando dos categorías comparten supra-categoría. */}
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={k === "Resto" ? C.lineStrong : catColor(k)}
              stroke={C.surface} strokeWidth={2}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} cursor={!isDay ? "pointer" : "default"} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniSpark({ data, color }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ height: 32, width: 88 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================
   IMPORTACIÓN
   ============================================================ */
function DropZone({ onFiles, compact }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-all ${compact ? "p-5" : "p-10"}`}
      style={{ borderColor: over ? C.accent : C.lineStrong, background: over ? C.accentSoft : C.surfaceAlt }}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.accentSoft }}><Upload size={20} style={{ color: C.accent }} /></div>
      <p className="text-sm font-medium">Arrastra aquí el CSV de tu banco</p>
      <p className="text-[11px] text-slate-400">o púlsalo para buscarlo en tu dispositivo</p>
      <Btn onClick={() => inputRef.current?.click()} kind="primary">Seleccionar archivo</Btn>
      {/* El `accept` estricto escondía el archivo en el móvil: los selectores de Android e iOS
          reportan el CSV con tipos dispares (vnd.ms-excel, comma-separated-values, y
          octet-stream cuando viene de Drive). Se amplía para que no quede nunca en gris. */}
      <input ref={inputRef} type="file" multiple className="hidden"
        accept=".csv,.txt,.tsv,.json,text/csv,text/plain,text/tab-separated-values,application/json,application/vnd.ms-excel,text/comma-separated-values,application/octet-stream"
        onChange={(e) => { if (e.target.files.length) onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// Guía de instalación del backend. Vive en el repositorio porque es donde está el botón de
// despliegue; desde la app solo se enlaza.
const GUIA_URL = "https://github.com/lsantos44/MisFinanzas";

// Primeros pasos. Enseña la progresión real de la app: lo que funciona sin montar nada y lo
// que exige backend, con su coste declarado. Un usuario nuevo tiene que poder ver de un
// vistazo dónde está y qué gana con el siguiente paso — y, sobre todo, que puede quedarse
// donde está. Antes la portada ofrecía «conectar el banco» como primera opción recomendada:
// cuarenta minutos de instalación antes de ver un solo gráfico.
function PrimerosPasos({ tieneDatos, tieneSync, tieneBanco, tieneIA, onIr }) {
  const pasos = [
    { id: "datos", hecho: tieneDatos, titulo: "Trae tus movimientos", gana: "Verlo todo clasificado por categorías y por activos.",
      coste: "Sin instalar nada", accion: tieneDatos ? null : { texto: "Importar un archivo", ir: "cerrar" } },
    { id: "sync", hecho: tieneSync, titulo: "Sincroniza entre dispositivos", gana: "Los mismos datos en el móvil y en el ordenador, siempre al día.",
      coste: "Requiere tu propio backend · ~20 min", accion: { texto: tieneSync ? "Ver ajustes" : "Cómo se monta", ir: tieneSync ? "sync" : "guia" } },
    { id: "banco", hecho: tieneBanco, titulo: "Conecta tu banco", gana: "Los movimientos entran solos cada pocas horas, sin descargar extractos.",
      coste: "Requiere backend y cuenta en Enable Banking · ~20 min más", accion: { texto: tieneBanco ? "Ver ajustes" : "Cómo se monta", ir: tieneBanco ? "banco" : "guia" } },
    { id: "ia", hecho: tieneIA, titulo: "Deja que la IA te ayude a clasificar", gana: "Reconoce comercios que no sabes de qué son.",
      coste: "Solo pegar tu clave de un proveedor", accion: { texto: tieneIA ? "Ver ajustes" : "Configurar", ir: "ia" } },
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-slate-500">
        La app funciona entera sin instalar nada: importas el extracto de tu banco y ya está. Lo demás es opcional y puedes hacerlo cuando quieras — o nunca.
      </p>
      {pasos.map((x) => (
        <div key={x.id} className="flex items-start gap-2.5 rounded-xl border p-2.5" style={{ borderColor: C.line, background: x.hecho ? C.surfaceAlt : C.surface }}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={x.hecho ? { background: "#dcfce7", color: "#15803d" } : { background: C.surfaceAlt, color: C.faint, border: `1px solid ${C.lineStrong}` }}>
            {x.hecho ? "✓" : ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">{x.titulo}</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{x.gana}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">{x.coste}</span>
            {x.accion && (
              <button type="button" onClick={() => onIr(x.accion.ir)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline focus-visible:outline-none" style={{ color: C.accent }}>
                {x.accion.texto} <ChevronRight size={11} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// Asistente de conexión. La guía del repositorio explica los pasos, pero no puede decirte si
// TE han salido bien: lees, haces, y descubres al final que algo falló. Aquí cada paso se
// verifica contra tu propio backend en el momento, que es la diferencia entre diez minutos y
// dos tardes. Lo que no puede hacer: crear tus cuentas. Eso es tuyo por definición.
function AsistenteConexion({ onClose, workerUrl, token, onGuardar, onIrBanco }) {
  const [paso, setPaso] = useState(0);
  const [url, setUrl] = useState(workerUrl || "");
  const [tok, setTok] = useState(token || "");
  const [probando, setProbando] = useState(false);
  const [res, setRes] = useState(null); // { ok, texto, detalle }

  const limpia = (u) => u.trim().replace(/\/+$/, "");

  // Comprueba contra /store/status, que dice qué ve el Worker sin exponer ningún secreto.
  const probar = async (conToken) => {
    const base = limpia(url);
    if (!/^https?:\/\//.test(base)) { setRes({ ok: false, texto: "La dirección debe empezar por https://" }); return false; }
    setProbando(true); setRes(null);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(base + "/store/status", {
        headers: conToken && tok.trim() ? { Authorization: "Bearer " + tok.trim() } : {},
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.status === 401) {
        setRes({ ok: false, texto: conToken ? "La contraseña no coincide con la del Worker." : "Tu backend responde, pero pide contraseña.", detalle: conToken ? "Revisa que la hayas pegado igual en Cloudflare, sin espacios ni saltos de línea." : null });
        return false;
      }
      if (!r.ok) { setRes({ ok: false, texto: `Tu backend respondió ${r.status}.`, detalle: "Comprueba que la dirección es la correcta y que lo has desplegado." }); return false; }
      const d = await r.json();
      if (!d.bindingDB) {
        setRes({ ok: false, texto: "Responde, pero le falta la base de datos.", detalle: "En Cloudflare: tu Worker → Settings → Bindings → añadir D1 con el nombre DB. Ojo: el botón de guardar queda fuera de la vista, baja dentro de la ventanita." });
        return false;
      }
      setRes({ ok: true, texto: conToken ? "Todo correcto: responde, tiene contraseña y la base de datos funciona." : "Tu backend responde y la base de datos funciona.", detalle: !conToken && !d.tieneToken ? "Aún no tiene contraseña: la pondremos en el paso siguiente." : null });
      return true;
    } catch (e) {
      setRes({ ok: false, texto: e.name === "AbortError" ? "No respondió en 20 segundos." : "No se pudo contactar con esa dirección.", detalle: "Comprueba que la has copiado entera, incluido el https://" });
      return false;
    } finally { setProbando(false); }
  };

  const generar = () => setTok(crypto.randomUUID() + "-" + crypto.randomUUID().slice(0, 8));

  const Paso = ({ n, titulo, children }) => (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.accent }}>Paso {n} de 4</div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  );

  const Resultado = () => !res ? null : (
    <div className="rounded-xl p-2.5 text-[12px] leading-relaxed" style={res.ok ? { background: "#dcfce7", color: "#15803d" } : { background: C.warnSoft, color: C.warn }}>
      <strong>{res.ok ? "✓ " : "⚠ "}{res.texto}</strong>
      {res.detalle && <span className="mt-0.5 block font-normal">{res.detalle}</span>}
    </div>
  );

  return (
    <Modal title="Conectar tu backend" subtitle="Unos 20 minutos, gratis" onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-2">
          <Btn onClick={() => (paso === 0 ? onClose() : (setRes(null), setPaso(paso - 1)))}>{paso === 0 ? "Ahora no" : "Atrás"}</Btn>
          {paso < 3 ? (
            <Btn kind="primary" disabled={(paso === 1 || paso === 2) && !(res && res.ok)}
              onClick={() => { if (paso === 2) onGuardar(limpia(url), tok.trim()); setRes(null); setPaso(paso + 1); }}>
              Siguiente <ChevronRight size={14} />
            </Btn>
          ) : (
            <Btn kind="primary" onClick={onClose}>Terminar</Btn>
          )}
        </div>
      )}>
      <div className="space-y-5">
        {paso === 0 && (
          <Paso n={1} titulo="Lo que vas a conseguir">
            <p>Tus datos sincronizados entre el móvil y el ordenador, y —si quieres— los movimientos del banco entrando solos cada pocas horas.</p>
            <p>Todo vive en <strong>tu</strong> cuenta de Cloudflare. Ni yo ni nadie más tiene acceso.</p>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">Necesitas una cuenta de Cloudflare</p>
              <p className="mt-0.5 text-[12px]">Es gratis y no piden tarjeta. Si ya la tienes, pasa al siguiente paso.</p>
              <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: C.accent }}>
                Crear cuenta <ChevronRight size={12} />
              </a>
            </div>
          </Paso>
        )}

        {paso === 1 && (
          <Paso n={2} titulo="Instala tu backend">
            <p>Pulsa el botón de abajo: se abre Cloudflare, te pide permiso y lo instala solo, con su base de datos incluida.</p>
            <a href={GUIA_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: C.accent }}>
              Abrir la guía con el botón <ChevronRight size={14} />
            </a>
            <p className="text-[12px] text-slate-500">Cuando termine, Cloudflare te dará una dirección parecida a <code className="rounded bg-slate-100 px-1">https://finanzas.algo.workers.dev</code>. Cópiala y pégala aquí:</p>
            <input value={url} onChange={(e) => { setUrl(e.target.value); setRes(null); }} placeholder="https://…workers.dev"
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              className="w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
            <Btn onClick={() => probar(false)} disabled={probando || !url.trim()}>{probando ? "Comprobando…" : "Comprobar"}</Btn>
            <Resultado />
          </Paso>
        )}

        {paso === 2 && (
          <Paso n={3} titulo="Ponle una contraseña">
            <p>Para que solo tú puedas usar tu backend. Te la genero yo, que es más segura que una inventada:</p>
            <div className="flex flex-wrap items-center gap-2">
              <input value={tok} onChange={(e) => { setTok(e.target.value); setRes(null); }} placeholder="pulsa Generar"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
              <Btn size="sm" onClick={generar}>Generar</Btn>
              <Btn size="sm" onClick={() => { try { navigator.clipboard.writeText(tok); } catch { /* sin permiso */ } }} disabled={!tok}>Copiar</Btn>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">Pégala en Cloudflare</p>
              <p className="mt-0.5 text-[12px]">Tu Worker → <strong>Settings</strong> → <strong>Variables and Secrets</strong> → <strong>Add</strong>. Tipo <strong>Secret</strong>, nombre exacto <code className="rounded bg-slate-100 px-1">PROXY_TOKEN</code>, y de valor esta contraseña. Luego pulsa <strong>Deploy</strong>.</p>
              <p className="mt-1 text-[12px] font-medium" style={{ color: C.warn }}>El botón de guardar suele quedar fuera de la vista: baja dentro de la ventanita, no en la página.</p>
            </div>
            <Btn onClick={() => probar(true)} disabled={probando || !tok.trim()}>{probando ? "Comprobando…" : "Comprobar que coincide"}</Btn>
            <Resultado />
          </Paso>
        )}

        {paso === 3 && (
          <Paso n={4} titulo="Listo">
            <p>Tu backend está conectado. A partir de ahora tus datos se sincronizan entre dispositivos: en el otro, pega esta misma dirección y contraseña.</p>
            <div className="rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <p className="text-[12px] font-medium text-slate-700">¿Quieres que el banco entre solo?</p>
              <p className="mt-0.5 text-[12px]">Hace falta además una cuenta en Enable Banking, gratuita para tus propias cuentas. Son otros 15 minutos y están explicados en la guía.</p>
              <button type="button" onClick={() => { onClose(); onIrBanco?.(); }}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline" style={{ color: C.accent }}>
                Ir a la conexión bancaria <ChevronRight size={12} />
              </button>
            </div>
          </Paso>
        )}
      </div>
    </Modal>
  );
}

function EmptyState({ onFiles, onSample, error, parsing, onSettings, onAsistente }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14 anim-rise">
      {/* Portada. Antes esta pantalla solo ofrecia CSV, que dejo de ser la via principal en
          cuanto la app aprendio a conectarse al banco: quien llegaba nuevo no se enteraba. */}
      <div className="overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
        <div className="px-6 py-8 sm:px-9 sm:py-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,.14)" }}>
            <Wallet size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Tus finanzas, claras</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/70">
            Descubre en qué se va tu dinero: por categoría, por activo y por etiquetas transversales.
            Todo se procesa y se guarda <strong className="font-semibold text-white/90">solo en tu dispositivo</strong>.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{error}</div>
        </div>
      )}

      {parsing ? (
        <Card className="mt-5 flex items-center justify-center p-10"><Spinner label="Leyendo el archivo…" /></Card>
      ) : (
        <>
          {/* El orden importa más de lo que parece. Antes el banco iba primero y marcado como
              recomendado, pero exige montar un backend y una cuenta en Enable Banking: cuarenta
              minutos antes de ver un gráfico. Quien llega tiene que poder probar la app en un
              minuto y decidir después si le compensa instalar algo. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col rounded-2xl border-2 bg-white p-5" style={{ borderColor: C.accent }}>
              <span className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: C.accentSoft, color: C.accent }}>
                  <FileText size={20} />
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: C.accentSoft, color: C.accent }}>Empieza aquí</span>
              </span>
              <span className="mt-3 block text-base font-semibold">Trae tu extracto</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Descárgalo en <strong>formato CSV</strong> desde la web de tu banco y tráelo aquí. Un minuto, sin registrarte en nada. Si solo te lo da en Excel, ábrelo y guárdalo como CSV.
              </span>
              <div className="mt-3"><DropZone onFiles={onFiles} compact /></div>
            </div>

            <button type="button" onClick={onAsistente || onSettings}
              className="group flex flex-col rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ borderColor: C.line }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Landmark size={20} />
              </span>
              <span className="mt-3 block text-base font-semibold">Conectar tu banco</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Los movimientos entran solos cada pocas horas, sin descargar nada. Más cómodo, pero hay que montar un backend propio: unos 20 minutos.
              </span>
              <span className="mt-auto pt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
                Ver cómo <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
            <button type="button" onClick={onSample} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Sparkles size={14} /> Probar con datos de ejemplo
            </button>
            {onSettings && (
              <button type="button" onClick={onSettings} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <History size={14} /> Restaurar una copia
              </button>
            )}
          </div>
          <p className="mt-1 text-center text-xs text-slate-400">Los datos de ejemplo son 14 meses ficticios de un banco español, con dos maratones para ver las etiquetas.</p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
            {["Conecta o importa", "Explora panel, activos y etiquetas", "Pregunta al asistente"].map((t, i) => (
              <div key={i} className="rounded-xl border bg-white p-3" style={{ borderColor: C.line }}>
                <div className="mb-1 font-semibold text-slate-700">{i + 1}</div>{t}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MappingModal({ imp, onConfirm, onCancel }) {
  const { rows } = imp;
  const init = imp.analysis.cols || {};
  const [headerRow, setHeaderRow] = useState(imp.analysis.headerIdx ?? 0);
  const [date, setDate] = useState(init.date ?? -1);
  const [concept, setConcept] = useState(init.concept ?? -1);
  const [mode, setMode] = useState(init.cargo >= 0 || init.abono >= 0 ? "dual" : "single");
  const [amount, setAmount] = useState(init.amount ?? -1);
  const [cargo, setCargo] = useState(init.cargo ?? -1);
  const [abono, setAbono] = useState(init.abono ?? -1);
  const [saldo, setSaldo] = useState(init.saldo ?? -1);
  const [skipEmptyCol, setSkipEmptyCol] = useState(init.skipEmptyCol ?? -1);
  const [keepCol, setKeepCol] = useState(init.keepCol ?? -1);
  const [keepVal, setKeepVal] = useState(init.keepVal ?? "");
  const nCols = Math.max(...rows.slice(0, 30).map((r) => r.length));
  // ¿Esta fila entra, según los filtros? (mismos criterios que la importación).
  const rowKept = (r) => {
    if (!r) return false;
    if (skipEmptyCol >= 0 && !String(r[skipEmptyCol] ?? "").trim()) return false;
    if (keepCol >= 0 && String(keepVal).trim() && String(r[keepCol] ?? "").trim().toLowerCase() !== String(keepVal).trim().toLowerCase()) return false;
    return true;
  };
  const colName = (i) => { const h = rows[headerRow]?.[i]?.trim(); return h ? `${i + 1} · ${h.slice(0, 18)}` : `Columna ${i + 1}`; };
  const ColPick = ({ value, onChange, optional }) => (
    <select value={value} onChange={(e) => onChange(+e.target.value)} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
      <option value={-1}>{optional ? "(ninguna)" : "— Elegir —"}</option>
      {Array.from({ length: nCols }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
    </select>
  );
  const ok = date >= 0 && concept >= 0 && (mode === "single" ? amount >= 0 : cargo >= 0 || abono >= 0);
  const preview = rows.slice(headerRow + 1, headerRow + 10);
  const dataRows = rows.slice(headerRow + 1);
  const keptCount = dataRows.reduce((n, r) => n + (rowKept(r) ? 1 : 0), 0);
  return (
    <Modal title="Asignar columnas" subtitle={imp.fileName} onClose={onCancel} wide>
      {imp.mapError && <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{imp.mapError}</div></div>}
      <p className="mb-3 text-sm text-slate-500">Indica qué contiene cada columna. Abajo tienes una vista previa de los datos.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">Fila de cabecera<input type="number" min={0} max={rows.length - 2} value={headerRow} onChange={(e) => setHeaderRow(Math.max(0, +e.target.value))} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} /></label>
        <label className="text-xs font-medium text-slate-600">Fecha<div className="mt-1"><ColPick value={date} onChange={setDate} /></div></label>
        <label className="text-xs font-medium text-slate-600">Concepto<div className="mt-1"><ColPick value={concept} onChange={setConcept} /></div></label>
        <label className="text-xs font-medium text-slate-600">Tipo de importe<div className="mt-1"><select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}><option value="single">Importe único con signo</option><option value="dual">Cargo y abono separados</option></select></div></label>
        {mode === "single"
          ? <label className="text-xs font-medium text-slate-600">Importe<div className="mt-1"><ColPick value={amount} onChange={setAmount} /></div></label>
          : <><label className="text-xs font-medium text-slate-600">Cargo (gastos)<div className="mt-1"><ColPick value={cargo} onChange={setCargo} optional /></div></label><label className="text-xs font-medium text-slate-600">Abono (ingresos)<div className="mt-1"><ColPick value={abono} onChange={setAbono} optional /></div></label></>}
        <label className="text-xs font-medium text-slate-600">Saldo (opcional)<div className="mt-1"><ColPick value={saldo} onChange={setSaldo} optional /></div></label>
      </div>
      <div className="mt-3 grid gap-3 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: C.line, background: C.surfaceAlt }}>
        <label className="text-xs font-medium text-slate-600">Omitir filas donde esta columna esté vacía <span className="font-normal text-slate-400">(opcional)</span>
          <div className="mt-1"><ColPick value={skipEmptyCol} onChange={setSkipEmptyCol} optional /></div>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">PayPal: elige <strong>«Nombre»</strong> — las filas internas (depósitos, conversiones) van sin nombre y duplican.</span>
        </label>
        <label className="text-xs font-medium text-slate-600">Solo importar filas donde esta columna sea… <span className="font-normal text-slate-400">(opcional)</span>
          <div className="mt-1 flex items-center gap-2">
            <ColPick value={keepCol} onChange={setKeepCol} optional />
            <input value={keepVal} onChange={(e) => setKeepVal(e.target.value)} placeholder="EUR" className="w-24 shrink-0 rounded-lg border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
          </div>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">Divisa: elige la columna <strong>«Divisa»</strong> y escribe <strong>EUR</strong> — así no cuela coronas/dólares como si fueran euros.</span>
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Se importarán <span style={{ color: C.accent }}>{nfNum.format(keptCount)}</span> de {nfNum.format(dataRows.length)} filas <span className="font-normal text-slate-400">(según tus filtros)</span>.</p>
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border" style={{ borderColor: C.line }}>
        <table className="w-full text-xs" style={tnum}><tbody>
          {preview.map((r, i) => {
            const kept = rowKept(r);
            return (
              <tr key={i} className="border-b last:border-0" style={{ borderColor: C.line, opacity: kept ? 1 : 0.4 }}>
                <td className="px-2 py-1.5 text-center" title={kept ? "Se importa" : "Se omite"}>{kept ? <Check size={13} className="inline text-emerald-600" /> : <X size={13} className="inline text-slate-400" />}</td>
                {Array.from({ length: nCols }, (_, c) => <td key={c} className={`max-w-[160px] truncate px-2 py-1.5 ${kept ? "text-slate-600" : "text-slate-400 line-through"}`}>{r[c]}</td>)}
              </tr>
            );
          })}
        </tbody></table>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onCancel}>Cancelar</Btn>
        <Btn kind="primary" disabled={!ok} onClick={() => onConfirm({ dataStart: headerRow + 1, cols: { date, date2: -1, concept, amount: mode === "single" ? amount : -1, cargo: mode === "dual" ? cargo : -1, abono: mode === "dual" ? abono : -1, saldo, skipEmptyCol, keepCol, keepVal } })}>Continuar</Btn>
      </div>
    </Modal>
  );
}

const IMPORT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "NOK", "SEK", "DKK", "PLN", "CZK", "JPY", "CAD", "AUD"];
function ValidationModal({ val, onConfirm, onCancel, onRemap }) {
  const { movs, skipped, mismatches, fileName, dupes } = val;
  const [cur, setCur] = useState("EUR");
  const [rateStr, setRateStr] = useState("");
  const isEur = cur === "EUR";
  const rate = isEur ? 1 : parseFloat((rateStr || "").replace(",", "."));
  const rateOk = isEur || (isFinite(rate) && rate > 0);
  if (movs.length === 0) {
    return (
      <Modal title="Comprobación de la importación" subtitle={fileName} onClose={onCancel}>
        <p className="text-sm text-slate-600">No hay movimientos nuevos: {dupes > 0 ? `los ${dupes} movimientos ya estaban importados.` : "no se ha podido leer ninguna fila válida."} {dupes === 0 && "Prueba a ajustar las columnas."}</p>
        <div className="mt-4 flex justify-end gap-2">{dupes === 0 && <Btn onClick={onRemap}>Ajustar columnas</Btn>}<Btn kind="primary" onClick={onCancel}>Entendido</Btn></div>
      </Modal>
    );
  }
  const dates = movs.map((m) => m.date);
  const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
  const inSum = movs.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
  const outSum = movs.filter((m) => m.amount < 0).reduce((s, m) => s - m.amount, 0);
  return (
    <Modal title="Comprobación de la importación" subtitle={fileName} onClose={onCancel}>
      <p className="mb-3 text-sm text-slate-500">Revisa que los datos cuadran. Al importar se clasifican solos; lo que quede dudoso lo verás como "por revisar" en el panel, sin bloquearte.</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Card className="p-3"><div className="text-xs text-slate-500">Movimientos leídos</div><div className="text-lg font-semibold" style={tnum}>{nfNum.format(movs.length)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Rango de fechas</div><div className="text-sm font-medium" style={tnum}>{fmtDate(min)} – {fmtDate(max)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Ingresos</div><div className="font-semibold" style={{ ...tnum, color: C.income }}>{fmtE(inSum)}</div></Card>
        <Card className="p-3"><div className="text-xs text-slate-500">Gastos</div><div className="font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE(outSum)}</div></Card>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {skipped > 0 && <li className="flex items-center gap-2 text-slate-600"><Info size={14} /> {skipped} filas omitidas (cabeceras, totales o sin datos válidos).</li>}
        {dupes > 0 && <li className="flex items-center gap-2 text-slate-600"><Info size={14} /> {dupes} duplicados ya importados se han ignorado.</li>}
        {mismatches !== null && (mismatches === 0
          ? <li className="flex items-center gap-2" style={{ color: C.income }}><Check size={14} /> El saldo cuadra con los importes en todas las filas.</li>
          : <li className="flex items-center gap-2" style={{ color: C.warn }}><AlertTriangle size={14} /> {mismatches} descuadres entre saldo e importes. Revisa el mapeo si no lo esperas.</li>)}
      </ul>

      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Divisa del archivo</span>
          <select value={cur} onChange={(e) => setCur(e.target.value)} className="rounded-lg border bg-white px-2 py-1 text-sm" style={{ borderColor: C.line }}>
            {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {!isEur && (
            <span className="flex items-center gap-1.5">
              <span className="text-slate-500" style={tnum}>1 {cur} =</span>
              <input value={rateStr} onChange={(e) => setRateStr(e.target.value)} inputMode="decimal" placeholder="0,086"
                className="w-20 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: rateOk ? C.line : C.expense }} />
              <span className="text-slate-500">€</span>
            </span>
          )}
        </div>
        {isEur
          ? <p className="mt-1.5 text-[11px] text-slate-400">Si el archivo está en euros, no toques nada. Si viene en otra moneda (p. ej. un PayPal en coronas), elígela y pon la tasa: convertiré los importes a € al importar.</p>
          : rateOk
            ? <p className="mt-1.5 text-[11px] text-slate-500">Convertido a €: <span className="font-medium" style={{ color: C.income }}>{fmtE(inSum * rate)}</span> ingresos · <span className="font-medium" style={{ color: C.expense }}>{fmtE(outSum * rate)}</span> gastos. Se guarda el importe original en {cur}.</p>
            : <p className="mt-1.5 text-[11px]" style={{ color: C.expense }}>Escribe cuántos euros vale 1 {cur} para poder convertir.</p>}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2"><Btn onClick={onCancel}>Descartar</Btn><Btn onClick={onRemap}>Ajustar columnas</Btn><Btn kind="primary" disabled={!rateOk} onClick={() => onConfirm({ currency: cur, rate })}>Importar</Btn></div>
    </Modal>
  );
}

/* Panel de pendientes: clasificas con calma los movimientos que quedaron sin
   confirmar. A diferencia del viejo muro, no bloquea, y un movimiento NO se
   marca como resuelto al vuelo: eliges categoría y activo, y al pulsar
   "Guardar cambios" se aplican juntos (así no desaparece antes de asignarle
   también el activo). */
function PendientesPanel({ movsPend, assets, setAssets, applyPending, aiOn, ai, autoRanRef, onClose, tagGroups, onToggleGroup, onCreateGroup, onRecat, onReasset, onNote, onNoteAll, onSetAmount, onDelete }) {
  const [edits, setEdits] = useState({}); // pattern -> { cat, asset }
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiNote, setAiNote] = useState(null);
  const [unresolved, setUnresolved] = useState([]); // comercios que la IA no supo resolver sin web
  const [webDone, setWebDone] = useState(false);
  const [open, setOpen] = useState(null);       // patrón desplegado a segundo nivel
  const [noting, setNoting] = useState(null);   // id de movimiento cuyo apodo editas
  const [noteText, setNoteText] = useState("");
  const [gNoting, setGNoting] = useState(null); // patrón cuyo apodo (a todos) editas
  const [gNoteText, setGNoteText] = useState("");
  const [amtEdit, setAmtEdit] = useState(null);
  const [amtText, setAmtText] = useState("");
  const [amtCur, setAmtCur] = useState("EUR");
  const [amtRate, setAmtRate] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const createAssetLocal2 = ({ name, emoji }) => setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || "📦", categories: [] }]));
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => { const sign = m.amount < 0 ? -1 : 1; const v = parseFloat((amtText || "").replace(",", ".")) * sign; if (!isFinite(v) || v === 0) return; onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null); setAmtEdit(null); };

  // Agrupar pendientes por patrón (mismo comercio → una fila)
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of movsPend) {
      if (!map.has(m.pattern)) map.set(m.pattern, { pattern: m.pattern, sample: m.concept, count: 0, total: 0, cat: m.category, ids: [] });
      const g = map.get(m.pattern);
      g.count++; g.total += m.amount; g.ids.push(m.id);
    }
    return orderByInfoGain([...map.values()]);
  }, [movsPend]);

  const createAssetLocal = ({ name, emoji }) => {
    setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || "📦", categories: [] }]));
  };
  const setEdit = (pattern, patch) => setEdits((e) => ({ ...e, [pattern]: { ...e[pattern], ...patch } }));
  const touched = Object.keys(edits).filter((p) => edits[p] && (edits[p].cat || edits[p].asset !== undefined));

  const applySuggestions = (map) => setEdits((e) => {
    const next = { ...e };
    for (const g of groups) if (map[g.pattern] && !(next[g.pattern]?.cat)) next[g.pattern] = { ...next[g.pattern], cat: map[g.pattern], _ai: true };
    return next;
  });

  const describeError = (err) => {
    const custom = ai && ai.provider !== "claude";
    const net = /failed to fetch|networkerror|load failed/i.test(err.message);
    if (/\b401\b/.test(err.message) && !custom) {
      return "«Claude (integrado)» solo funciona dentro de claude.ai. En esta app necesitas configurar un proveedor propio en Ajustes → Inteligencia artificial.";
    }
    return net && custom
      ? "No he podido conectar con tu proveedor de IA. Revisa la URL y la clave en Ajustes."
      : "La sugerencia con IA no ha funcionado: " + err.message + ".";
  };

  /* Pasada 1: barata y sin internet. Un modelo pequeño mira el nombre del comercio y
     lo etiqueta. Resuelve la gran mayoría; lo que no sepa vuelve en `unresolved`.
     silent: en el disparo automático no gritamos un error rojo si la IA no responde. */
  const runAI = async (silent = false) => {
    setAiBusy(true); setAiError(null); setAiNote(null);
    try {
      const payload = groups.slice(0, 200).map((g) => ({ pattern: g.pattern, sign: g.total > 0 ? 1 : -1 }));
      const { map, unresolved: left } = await aiCategorizePatterns(payload, false, ai);
      if (Object.keys(map).length === 0) { if (!silent) setAiError("La IA no reconoció ninguno de estos comercios. Clasifícalos a mano."); return; }
      applySuggestions(map);
      setUnresolved(left);
      setWebDone(false);
      const n = Object.keys(map).length - left.length;
      setAiNote(`${n} de ${payload.length} comercios reconocidos sin salir a internet.`);
    } catch (err) {
      // En el disparo automático no gritamos en rojo, pero callarse del todo deja al
      // usuario sin saber por qué no hay sugerencias. Un aviso discreto y accionable.
      if (silent) {
        setAiNote("Sin sugerencias automáticas: no hay ningún proveedor de IA disponible. Configúralo en Ajustes → Inteligencia artificial.");
        return;
      }
      setAiError(describeError(err));
    } finally { setAiBusy(false); }
  };

  /* Pasada 2: solo sobre el residuo, y con la web. Aquí sí hay tasa por búsqueda,
     así que es una decisión explícita del usuario y con el coste estimado delante. */
  const runWebAI = async () => {
    if (!unresolved.length) return;
    setAiBusy(true); setAiError(null); setAiNote(null);
    try {
      const byPattern = new Map(groups.map((g) => [g.pattern, g]));
      const payload = unresolved.map((p) => ({ pattern: p, sign: (byPattern.get(p)?.total ?? -1) > 0 ? 1 : -1 }));
      const { map, unresolved: left, searches } = await aiCategorizePatterns(payload, true, ai);
      applySuggestions(map);
      setUnresolved(left);
      setWebDone(true);
      const found = payload.length - left.length;
      setAiNote(`${found} de ${payload.length} identificados con ${searches || "algunas"} búsquedas web. El resto, a mano.`);
    } catch (err) {
      setAiError(describeError(err));
    } finally { setAiBusy(false); }
  };

  /* Una sola vez por SESIÓN, no por apertura del panel: `autoRanRef` vive en App.
     Con un ref local, cerrar y reabrir "por clasificar" repetía la ronda entera
     (y con búsqueda web eso eran euros, no céntimos). */
  useEffect(() => {
    if (!aiOn || autoRanRef.current || groups.length === 0) return;
    autoRanRef.current = true;
    runAI(true);
  }, [aiOn, groups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { lockBodyScroll(); return unlockBodyScroll; }, []);

  const save = () => {
    const changes = [];
    for (const g of groups) {
      const e = edits[g.pattern];
      if (!e || (!e.cat && e.asset === undefined)) continue;
      changes.push({ pattern: g.pattern, cat: e.cat || g.cat, asset: e.asset, fromAI: !!e._ai });
    }
    applyPending(changes);
    onClose();
  };

  if (!movsPend.length) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <Card className="w-full max-w-md p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <Check size={28} className="mx-auto" style={{ color: C.income }} />
          <h2 className="mt-2 text-lg font-semibold">Todo clasificado</h2>
          <p className="mt-1 text-sm text-slate-500">No tienes movimientos pendientes de revisar.</p>
          <Btn kind="primary" className="mt-4" onClick={onClose}>Cerrar</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Movimientos por clasificar</h2>
            <p className="text-xs text-slate-500">{nfNum.format(movsPend.length)} movimientos en {groups.length} comercios. Lo que clasifiques se guarda como regla: no te lo volveré a preguntar en las próximas cargas.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>

        {aiOn && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2" style={{ borderColor: C.line }}>
            <Btn onClick={() => runAI()} disabled={aiBusy}>
              {aiBusy ? <><Loader2 size={14} className="animate-spin" /> Clasificando…</> : <><Sparkles size={14} /> Volver a sugerir</>}
            </Btn>

            {/* Segunda pasada, solo sobre lo que la primera no supo. La tasa por búsqueda
                es real ($10/1.000), así que la enseñamos antes de que el usuario decida. */}
            {!aiBusy && unresolved.length > 0 && !webDone && aiSupportsWeb(ai) && (() => {
              const { searches, usd } = estimateWebCostUSD(unresolved.length);
              return (
                <Btn onClick={runWebAI} title={`Hasta ${searches} búsquedas a $${WEB_SEARCH_USD} cada una, más los tokens de los resultados`}>
                  <Search size={14} /> Buscar en la web los {unresolved.length} desconocidos
                  <span className="ml-1 text-slate-400">≈ ${usd.toFixed(2)}</span>
                </Btn>
              );
            })()}

            {aiNote && !aiError && <span className="text-xs text-slate-500">{aiNote}</span>}
            {aiError && <span className="w-full text-xs text-rose-600">{aiError}</span>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {groups.map((g) => {
            const e = edits[g.pattern] || {};
            const cat = e.cat ?? "";
            const asset = e.asset;
            const isOpen = open === g.pattern;
            const mine = isOpen ? movsPend.filter((m) => m.pattern === g.pattern).sort((a, b) => b.date - a.date) : null;
            const noteVals = new Set();
            for (const m of movsPend) if (m.pattern === g.pattern && m.note) noteVals.add(m.note);
            const gNote = noteVals.size === 1 ? [...noteVals][0] : null;
            const gMixed = noteVals.size > 1;
            return (
              <div key={g.pattern} className="border-b px-4 py-3" style={{ borderColor: C.line }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.pattern)} className="flex w-full items-start gap-1.5 text-left focus-visible:outline-none">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium" title={g.sample}>{g.sample}</div>
                    <div className="mt-0.5 text-xs text-slate-500" style={tnum}>
                      {g.count} {g.count === 1 ? "movimiento" : "movimientos"} · {fmtE(g.total)}
                      {e._ai && <span className="ml-2 inline-flex items-center gap-0.5 text-blue-700"><Sparkles size={11} /> IA</span>}
                      {noteVals.size > 0 && <span className="ml-2">🏷️ {noteVals.size === 1 ? gNote : "varios"}</span>}
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CatSelect value={cat} allowEmpty onChange={(v) => setEdit(g.pattern, { cat: v, _ai: false })} className="min-w-0 flex-1 basis-[45%] sm:basis-auto" />
                  <AssetSelect value={asset ?? ""} assets={assets} onCreateAsset={createAssetLocal} onChange={(v) => setEdit(g.pattern, { asset: v })} className="min-w-0 flex-1 basis-[45%] sm:basis-auto" />
                  {onToggleGroup && <GroupTags mov={{ id: g.ids[0], pattern: g.pattern }} groups={tagGroups || []} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />}
                  {onNoteAll && <button type="button" onClick={() => { setGNoting(gNoting === g.pattern ? null : g.pattern); setGNoteText(gNote || ""); }} className="rounded-lg border px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }}>{gNote || gMixed ? `🏷️ ${gNote || "varios"}` : "+ apodo a todos"}</button>}
                </div>
                {onNoteAll && gNoting === g.pattern && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={gNoteText} onChange={(ev) => setGNoteText(ev.target.value)} autoFocus maxLength={40}
                      placeholder={`Apodo para los ${g.count} movimientos`}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { onNoteAll({ pattern: g.pattern }, gNoteText); setGNoting(null); } if (ev.key === "Escape") setGNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNoteAll({ pattern: g.pattern }, gNoteText); setGNoting(null); }}>Aplicar a todos</Btn>
                    {(gNote || gMixed) && <button type="button" onClick={() => { onNoteAll({ pattern: g.pattern }, ""); setGNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
                {isOpen && (
                  <div className="mt-2 space-y-1 rounded-lg border p-2" style={{ borderColor: C.line, background: C.surface }}>
                    <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{mine.length} movimientos · corrige o apoda uno a uno</div>
                    {mine.map((m) => (
                      <div key={m.id} className="rounded-md px-1.5 py-1.5 hover:bg-slate-50">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-500" style={tnum}>{fmtDate(m.date)}
                              {m.currency && <span className="ml-1.5 text-slate-400">· orig {Math.abs(m.origAmount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency}</span>}
                            </div>
                            {m.note && noting !== m.id && <button type="button" onClick={() => { setNoting(m.id); setNoteText(m.note); }} className="mt-0.5 inline-flex max-w-full items-center rounded px-1 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }}><span className="truncate">🏷️ {m.note}</span></button>}
                          </div>
                          {onSetAmount
                            ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500"><Money v={m.amount} bold /></button>
                            : <Money v={m.amount} bold />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {onRecat && <CatSelect value={m.category} allowEmpty onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-40" />}
                          {onReasset && <AssetSelect value={m.assetName === undefined ? "" : m.assetName} assets={assets} onCreateAsset={createAssetLocal2} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-32" />}
                          <GroupTags mov={m} groups={tagGroups || []} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                          {onNote && noting !== m.id && !m.note && <button type="button" onClick={() => { setNoting(m.id); setNoteText(""); }} className="text-[11px] text-slate-400 hover:text-blue-600">+ apodo</button>}
                          {onDelete && (confirmDel === m.id
                            ? <span className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                                <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                              </span>
                            : <button type="button" onClick={() => setConfirmDel(m.id)} title="Enviar a la papelera" aria-label="Enviar a la papelera" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>)}
                        </div>
                        {onSetAmount && amtEdit === m.id && (
                          <div className="mt-1.5 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.bg }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500">Importe</span>
                              <input value={amtText} onChange={(ev) => setAmtText(ev.target.value)} autoFocus inputMode="decimal"
                                onKeyDown={(ev) => { if (ev.key === "Enter") saveAmt(m); if (ev.key === "Escape") setAmtEdit(null); }}
                                className="w-24 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: C.line }} />
                              <span className="text-xs text-slate-500">€ {m.amount < 0 ? "(gasto)" : "(ingreso)"}</span>
                              <Btn size="sm" kind="primary" onClick={() => saveAmt(m)}>Guardar</Btn>
                              <button type="button" onClick={() => setAmtEdit(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>Cancelar</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span>o convierte desde</span>
                              <select value={amtCur} onChange={(ev) => { setAmtCur(ev.target.value); if (ev.target.value === "EUR") setAmtText(Math.abs(m.amount).toFixed(2)); }} className="rounded-lg border bg-white px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }}>
                                {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {amtCur !== "EUR" && <>
                                <span style={tnum}>1 {amtCur} =</span>
                                <input value={amtRate} onChange={(ev) => { setAmtRate(ev.target.value); const r = parseFloat((ev.target.value || "").replace(",", ".")); if (isFinite(r) && r > 0) setAmtText((Math.abs(m.amount) * r).toFixed(2)); }} inputMode="decimal" placeholder="0,086" className="w-16 rounded-lg border px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }} />
                                <span>€</span>
                              </>}
                            </div>
                          </div>
                        )}
                        {onNote && noting === m.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input value={noteText} onChange={(ev) => setNoteText(ev.target.value)} autoFocus maxLength={40}
                              placeholder="Apodo o nota"
                              onKeyDown={(ev) => { if (ev.key === "Enter") { onNote(m, noteText); setNoting(null); } if (ev.key === "Escape") setNoting(null); }}
                              className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                            <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                            {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Trash2 size={13} /></button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3" style={{ borderColor: C.line }}>
          <span className="text-xs text-slate-500">{touched.length > 0 ? `${touched.length} ${touched.length === 1 ? "comercio listo" : "comercios listos"}` : "Sin cambios todavía"}</span>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Cerrar</Btn>
            <Btn kind="primary" onClick={save} disabled={touched.length === 0}><Check size={14} /> Guardar cambios</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color, icon, spark, sparkColor }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        {icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>{icon}</div>}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="text-xl font-semibold sm:text-2xl" style={{ ...tnum, color: color || C.ink }}>{value}</div>
        {spark && <MiniSpark data={spark} color={sparkColor || C.accent} />}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

function FiltersBar({ filters, setFilters, monthsAvail, yearsAvail, assets, groups }) {
  const f = filters;
  const set = (patch) => setFilters({ ...f, ...patch });
  const lastMonth = monthsAvail[monthsAvail.length - 1];
  const prevMonth = monthsAvail[monthsAvail.length - 2];
  return (
    // En móvil una sola fila que se desplaza en horizontal: envolviendo, los filtros
    // ocupaban tres líneas y empujaban el contenido fuera de la primera pantalla.
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      <Seg ariaLabel="Periodo" value={f.periodType} onChange={(v) => set({ periodType: v, ...(v === "month" && !f.month ? { month: lastMonth } : {}) })}
        options={[{ v: "all", l: "Todo" }, { v: "year", l: "Año" }, { v: "month", l: "Mes" }, { v: "custom", l: "Rango" }]} />
      {f.periodType === "year" && (
        <select value={f.year} onChange={(e) => set({ year: +e.target.value })} className="shrink-0 rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line, ...tnum }}>
          {yearsAvail.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
      {f.periodType === "month" && (
        <>
          <select value={f.month} onChange={(e) => set({ month: e.target.value })} className="shrink-0 rounded-lg border bg-white px-2 py-1.5 text-sm" style={{ borderColor: C.line }}>
            {monthsAvail.map((m) => <option key={m} value={m}>{monthLabelLong(m)}</option>)}
          </select>
          <Btn size="sm" kind="subtle" className="shrink-0" onClick={() => set({ month: lastMonth })} disabled={!lastMonth}>Último mes</Btn>
          <Btn size="sm" kind="subtle" className="shrink-0" onClick={() => set({ month: prevMonth })} disabled={!prevMonth}>Mes anterior</Btn>
        </>
      )}
      {f.periodType === "custom" && (
        <div className="flex shrink-0 items-center gap-1.5 text-sm">
          <input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="Desde" className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
          <span className="text-slate-400">–</span>
          <input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="Hasta" className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: C.line }} />
        </div>
      )}
      <div className="flex shrink-0 gap-2 sm:ml-auto">
        <MultiSelect label="Categorías" icon={<Filter size={13} />} groups={CAT_FILTER_GROUPS} selected={f.cats} onChange={(s) => set({ cats: s })} />
        {assets.length > 0 && <MultiSelect label="Activos" options={assets.map((a) => a.name)} selected={f.assetsSel} onChange={(s) => set({ assetsSel: s })} />}
        {groups.length > 0 && <MultiSelect label="Grupos" icon={<Tag size={13} />} options={groups.map((g) => g.name)} selected={f.groupsSel} onChange={(s) => set({ groupsSel: s })} />}
      </div>
    </div>
  );
}

/* ============================================================
   DRILL-DOWN (corrección por contexto + etiquetado de grupos)
   ============================================================ */
function SplitEditor({ mov, onSave, onCancel }) {
  const [pct, setPct] = useState(mov.splits?.[0]?.pct ?? 50);
  const [catA, setCatA] = useState(mov.splits?.[0]?.cat ?? mov.category ?? "Otros");
  const [catB, setCatB] = useState(mov.splits?.[1]?.cat ?? "Otros");
  return (
    <div className="mt-2 rounded-xl border bg-slate-50 p-3" style={{ borderColor: C.line }}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <CatSelect value={catA} onChange={setCatA} className="w-40" />
        <input type="number" min={1} max={99} value={pct} aria-label="Porcentaje" onChange={(e) => setPct(Math.min(99, Math.max(1, +e.target.value || 1)))} className="w-16 rounded-lg border px-2 py-1 text-sm" style={{ ...tnum, borderColor: C.line }} />
        <span className="text-xs text-slate-500">%</span><span className="text-slate-400">+</span>
        <CatSelect value={catB} onChange={setCatB} className="w-40" /><span className="text-xs text-slate-500" style={tnum}>{100 - pct} %</span>
      </div>
      <div className="mt-2 text-xs text-slate-500" style={tnum}>{fmtE((mov.amount * pct) / 100)} · {fmtE((mov.amount * (100 - pct)) / 100)}</div>
      <div className="mt-2 flex gap-2">
        <Btn size="sm" kind="primary" onClick={() => onSave([{ pct, cat: catA }, { pct: 100 - pct, cat: catB }])}>Guardar división</Btn>
        {mov.splits && <Btn size="sm" onClick={() => onSave(null)}>Quitar</Btn>}
        <Btn size="sm" onClick={onCancel}>Cancelar</Btn>
      </div>
    </div>
  );
}

function GroupTags({ mov, groups, onToggle, onCreateGroup }) {
  const [open, setOpen] = useState(false);
  const inGroups = groups.filter((g) => movInGroup(mov, g));
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
        <Tag size={12} /> {inGroups.length ? `${inGroups.length} etiqueta${inGroups.length > 1 ? "s" : ""}` : "Etiquetar"} <ChevronDown size={11} />
      </button>
      {open && (
        <>
          {/* En móvil, hoja inferior fija (no se recorta dentro de listas con scroll);
              en escritorio, popover normal a la derecha del botón. */}
          <div className="fixed inset-0 z-50 bg-slate-900/25 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 bottom-3 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:w-56 sm:max-h-none sm:rounded-xl sm:shadow-xl" style={{ borderColor: C.line, paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="mb-1 flex items-center justify-between px-2 sm:hidden">
              <span className="text-xs font-semibold text-slate-500">Etiquetas de «{(mov.concept || mov.pattern || "").slice(0, 22)}»</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            {groups.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-500">No hay etiquetas todavía.</div>}
            {groups.map((g) => {
              const inIt = movInGroup(mov, g);
              const byKw = g.keywords?.some((k) => k && stripAccents(mov.pattern.toUpperCase()).includes(stripAccents(k.toUpperCase())));
              return (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={inIt} onChange={() => onToggle(mov, g)} />
                  <span>{g.emoji}</span><span className="flex-1 truncate">{g.name}</span>
                  {byKw && inIt && <span className="text-[10px] text-slate-400" title="Coincide por palabra clave">auto</span>}
                </label>
              );
            })}
            <button type="button" onClick={() => { setOpen(false); onCreateGroup(mov); }} className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
              <Plus size={13} /> Nueva etiqueta con este gasto
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DrillPanel({ drill, movs, assets, groups, outliers, onClose, onRecat, onReasset, onReassetAll, onToggleGroup, onCreateGroup, onCreateAsset, onToggleExtra, onNote, onDelete, onSetAmount, onEditMov }) {
  const [shown, setShown] = useState(60);
  const [noting, setNoting] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [amtEdit, setAmtEdit] = useState(null);   // id del movimiento cuyo importe editas
  const [amtText, setAmtText] = useState("");      // importe en € (valor absoluto)
  const [amtCur, setAmtCur] = useState("EUR");     // divisa desde la que convertir
  const [amtRate, setAmtRate] = useState("");      // tasa de conversión
  const [q, setQ] = useState("");
  const [signSel, setSignSel] = useState("todos"); // todos | in (ingresos) | out (gastos)
  const [amtMin, setAmtMin] = useState("");        // importe (valor absoluto) desde
  const [amtMax, setAmtMax] = useState("");        // importe (valor absoluto) hasta
  const isSearch = drill.type === "search";
  useEffect(() => { setShown(60); setNoting(null); setConfirmDel(null); setAmtEdit(null); setQ(""); setSignSel("todos"); setAmtMin(""); setAmtMax(""); }, [drill?.key, drill?.type, drill?.label]);
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => {
    const sign = m.amount < 0 ? -1 : 1;
    const v = parseFloat((amtText || "").replace(",", ".")) * sign;
    if (!isFinite(v) || v === 0) return;
    onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null);
    setAmtEdit(null);
  };
  const list = useMemo(() => {
    const idset = drill.ids ? new Set(drill.ids) : null;
    const match = (m) => {
      if (idset) return idset.has(m.id);
      // Un drill puede acotarse a un mes: "Dónde más fue" del cierre quiere ESOS cargos
      // del mes, no toda la categoría en el histórico (que confunde más que aclara).
      if (drill.month && monthKey(m.date) !== drill.month) return false;
      // …y por signo: en Activos quieres ver los ingresos y los gastos por separado.
      if (drill.sign === "in" && !(m.amount > 0)) return false;
      if (drill.sign === "out" && !(m.amount < 0)) return false;
      if (drill.type === "cat") return expandParts(m, assets).some((p) => p.cat === drill.key);
      if (drill.type === "asset") return expandParts(m, assets).some((p) => p.asset === drill.key);
      if (drill.type === "group") { const g = groups.find((x) => x.id === drill.key); return g ? movInGroup(m, g) : false; }
      if (drill.type === "pattern") return m.pattern === drill.key;
      if (drill.type === "atipicos") return outliers.has(m.id);
      if (drill.type === "search") {
        const t = stripAccents(q.trim().toUpperCase());
        const min = parseFloat((amtMin || "").replace(",", "."));
        const max = parseFloat((amtMax || "").replace(",", "."));
        const hasMin = isFinite(min), hasMax = isFinite(max);
        // Sin ningún filtro no mostramos nada (evita volcar todo el histórico sin querer).
        if (!t && signSel === "todos" && !hasMin && !hasMax) return false;
        if (t && !stripAccents((m.concept + " " + m.pattern).toUpperCase()).includes(t)) return false;
        if (signSel === "in" && !(m.amount > 0)) return false;
        if (signSel === "out" && !(m.amount < 0)) return false;
        const abs = Math.abs(m.amount);
        if (hasMin && abs < min) return false;
        if (hasMax && abs > max) return false;
        return true;
      }
      return false;
    };
    const out = movs.filter(match);
    return isSearch ? out.sort((a, b) => b.date - a.date) : out.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [drill, movs, assets, groups, outliers, q, signSel, amtMin, amtMax, isSearch]);
  const total = list.reduce((s, m) => s + m.amount, 0);
  // La categoría se puede corregir desde cualquier drill: en Análisis ves los cargos
  // de un comercio (p. ej. PayPal) y a veces uno no es lo que el resto — hay que poder
  // recolocarlo ahí mismo, no solo ponerle activo o etiqueta.
  const showCat = true;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 anim-fade" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl anim-slide" role="dialog" aria-label={`Movimientos de ${drill.label}`}>
        <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4" style={{ borderColor: C.line }}>
          <button type="button" onClick={onClose} aria-label="Volver" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronLeft size={20} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{drill.label}</h2>
            <p className="text-xs text-slate-500" style={tnum}>{list.length} movimientos · <span style={{ color: total < 0 ? C.expense : C.income }}>{fmtE(total)}</span></p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
        </div>
        {isSearch ? (
          <div className="border-b px-4 py-2.5" style={{ borderColor: C.line }}>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.lineStrong }}>
              <Search size={15} className="shrink-0 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Buscar movimientos"
                placeholder="Comercio o concepto (p. ej. taller, netflix, bizum…)"
                className="w-full bg-transparent text-sm focus:outline-none" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Seg ariaLabel="Ingresos o gastos" value={signSel} onChange={setSignSel}
                options={[{ v: "todos", l: "Todos" }, { v: "in", l: "Ingresos" }, { v: "out", l: "Gastos" }]} />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400">Importe €</span>
                <input value={amtMin} onChange={(e) => setAmtMin(e.target.value)} inputMode="decimal" aria-label="Importe desde" placeholder="desde"
                  className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
                <span className="text-slate-300">–</span>
                <input value={amtMax} onChange={(e) => setAmtMax(e.target.value)} inputMode="decimal" aria-label="Importe hasta" placeholder="hasta"
                  className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
                {(amtMin || amtMax) && <button type="button" onClick={() => { setAmtMin(""); setAmtMax(""); }} aria-label="Limpiar importe" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Busca por texto, por importe (valor absoluto) y por ingresos/gastos, dentro del periodo de arriba. Corrige o etiqueta desde los resultados.</p>
          </div>
        ) : (
          <p className="border-b px-4 py-2 text-xs text-slate-500" style={{ borderColor: C.line }}>Corrige aquí lo que esté mal: la categoría se aplica a movimientos similares. Usa <span className="font-medium">Etiquetar</span> para tus clusters (pádel, maratones, vacaciones…).</p>
        )}
        <div className="flex-1 overflow-y-auto">
          {list.slice(0, shown).map((m) => {
            // "Otros" = movimientos del mismo comercio distintos de este (los que una
            // acción "aplicar a todos" tocaría de verdad). No contamos el actual: así el
            // aviso dice lo que ves ("y otro más"), no un total que incluye este.
            const proc = isProcessorPattern(m.pattern);
            // En pasarelas cada cargo es un comercio distinto: sin cambios en bloque.
            const others = proc ? [] : movs.filter((x) => x.pattern === m.pattern && x.id !== m.id);
            const myAsset = m.assetName === undefined ? null : m.assetName;
            const othersToAsset = myAsset ? others.filter((x) => (x.assetName === undefined ? null : x.assetName) !== myAsset) : [];
            return (
              <div key={m.id} className="border-b px-4 py-2.5 last:border-0" style={{ borderColor: C.line }}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm" title={m.concept}>{m.concept}</div>
                    <div className="text-xs text-slate-500" style={tnum}>{fmtDate(m.date)}
                      {m.currency && <span className="ml-2 text-slate-400">· orig {Math.abs(m.origAmount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency}</span>}
                      {outliers.has(m.id) && <span className="ml-2"><Pill color={C.warn} soft={C.warnSoft}>atípico</Pill></span>}
                      {m.splits && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">dividido</span>}
                      {isRefund(m) && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700" title="Devolución: resta del gasto de su categoría, no cuenta como ingreso">devolución</span>}
                      {m.extra && <span className="ml-2"><Pill color={C.accent} soft="rgba(99,102,241,.12)">extraordinario</Pill></span>}
                    </div>
                    {onNote && (m.note
                      ? <button type="button" onClick={() => { setNoting(noting === m.id ? null : m.id); setNoteText(m.note); }} className="mt-1 inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }} title="Editar apodo o nota"><span className="truncate">🏷️ {m.note}</span></button>
                      : <button type="button" onClick={() => { setNoting(noting === m.id ? null : m.id); setNoteText(""); }} className="mt-1 block text-[11px] text-slate-400 hover:text-blue-600">+ apodo / nota</button>)}
                  </div>
                  {onSetAmount
                    ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Money v={m.amount} bold /></button>
                    : <Money v={m.amount} bold />}
                </div>
                {/* En 360 px los anchos fijos (w-40 + w-32) se salían del panel: en móvil
                    cada selector ocupa media fila, y los iconos suben a 40 px de zona táctil. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {showCat && <CatSelect value={m.splits ? m.splits[0].cat : m.category} onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:w-40 sm:flex-none sm:basis-auto" />}
                  <AssetSelect value={m.assetName === undefined ? (expandParts(m, assets)[0].asset ?? "") : m.assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:w-32 sm:flex-none sm:basis-auto" />
                  <GroupTags mov={m} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                  {onToggleExtra && <button type="button" onClick={() => onToggleExtra(m)} aria-label={m.extra ? "Quitar de extraordinarios" : "Marcar como extraordinario"} title={m.extra ? "Quitar de extraordinarios (vuelve al análisis)" : "Marcar como extraordinario (fuera de medias, proyecciones y comparativas)"} className={`shrink-0 rounded-lg p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${m.extra ? "text-white" : "text-slate-500 hover:bg-slate-100"}`} style={m.extra ? { background: C.accent } : undefined}><Star size={15} /></button>}
                  {onEditMov && <button type="button" onClick={() => onEditMov(m)} title="Editar fecha, importe o concepto" aria-label="Editar movimiento" className="shrink-0 rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>}
                  {onDelete && (confirmDel === m.id
                    ? <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                        <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1.5 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                      </span>
                    : <button type="button" onClick={() => setConfirmDel(m.id)} title="Borrar movimiento (no lo quiero analizar)" aria-label="Borrar movimiento" className="shrink-0 rounded-lg p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={15} /></button>)}
                </div>
                {othersToAsset.length > 0 && onReassetAll && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    Este activo está solo en este movimiento.{" "}
                    <button type="button" onClick={() => onReassetAll(m, m.assetName)} className="font-medium text-blue-600 hover:underline">Aplicar {othersToAsset.length === 1 ? "también al otro" : `también a los otros ${othersToAsset.length}`} de «{m.pattern}»</button>
                  </div>
                )}
                {showCat && others.length > 0 && !proc && (
                  <div className="mt-1 text-[11px] text-slate-400">
                    El cambio de categoría afecta solo a este movimiento.{" "}
                    <button type="button" onClick={() => onRecat(m, m.splits ? m.splits[0].cat : (m.category || "Otros"), true)} className="font-medium text-blue-600 hover:underline">Aplicar «{m.splits ? m.splits[0].cat : (m.category || "Otros")}» {others.length === 1 ? "también al otro" : `también a los otros ${others.length}`} de «{m.pattern}»</button>
                  </div>
                )}
                {showCat && proc && <div className="mt-1 text-[11px] text-slate-400">«{m.pattern}» agrupa comercios distintos: el cambio afecta solo a este cargo.</div>}
                {onNote && noting === m.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus maxLength={40}
                      placeholder="Apodo o nota (p. ej. «Impuestos», «reforma baño»)"
                      onKeyDown={(e) => { if (e.key === "Enter") { onNote(m, noteText); setNoting(null); } if (e.key === "Escape") setNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                    {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" title="Quitar apodo" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
                {onSetAmount && amtEdit === m.id && (
                  <div className="mt-2 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.surfaceAlt }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">Importe</span>
                      <input value={amtText} onChange={(e) => setAmtText(e.target.value)} autoFocus inputMode="decimal"
                        onKeyDown={(e) => { if (e.key === "Enter") saveAmt(m); if (e.key === "Escape") setAmtEdit(null); }}
                        className="w-24 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: C.line }} />
                      <span className="text-xs text-slate-500">€ {m.amount < 0 ? "(gasto)" : "(ingreso)"}</span>
                      <Btn size="sm" kind="primary" onClick={() => saveAmt(m)}>Guardar</Btn>
                      <button type="button" onClick={() => setAmtEdit(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>Cancelar</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>o convierte desde</span>
                      <select value={amtCur} onChange={(e) => { setAmtCur(e.target.value); if (e.target.value === "EUR") setAmtText(Math.abs(m.amount).toFixed(2)); }} className="rounded-lg border bg-white px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }}>
                        {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {amtCur !== "EUR" && <>
                        <span style={tnum}>1 {amtCur} =</span>
                        <input value={amtRate} onChange={(e) => { setAmtRate(e.target.value); const r = parseFloat((e.target.value || "").replace(",", ".")); if (isFinite(r) && r > 0) setAmtText((Math.abs(m.amount) * r).toFixed(2)); }} inputMode="decimal" placeholder="0,086" className="w-16 rounded-lg border px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }} />
                        <span>€ · sobre el original {Math.abs(m.amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {amtCur}</span>
                      </>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {list.length > shown && <div className="p-3 text-center"><Btn onClick={() => setShown(shown + 100)}>Mostrar más ({nfNum.format(list.length - shown)})</Btn></div>}
          {list.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {isSearch ? (q.trim() ? "Nada coincide en el periodo seleccionado. Prueba con menos letras o cambia el periodo." : "Escribe arriba para buscar en tus movimientos.") : "No hay movimientos aquí con los filtros actuales."}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   PESTAÑA RESUMEN
   ============================================================ */
function AlertsCard({ alerts, onDrill, onOpenPending, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.line }}>
        <AlertTriangle size={15} style={{ color: C.warn }} />
        <h2 className="text-sm font-semibold">Avisos</h2>
        <span className="text-xs text-slate-400">{alerts.length === 1 ? "1 cosa que mirar" : `${alerts.length} cosas que mirar`}</span>
      </div>
      {alerts.map((a, i) => (
        <div key={a.id || i} className="flex items-start gap-1 border-b px-4 py-2.5 last:border-0" style={{ borderColor: C.line }}>
          <button type="button" onClick={() => (a.openPending ? onOpenPending?.() : a.drill && onDrill(a.drill))}
            className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg py-0.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.sev === "alta" ? C.expense : a.sev === "baja" ? C.accent : C.warn }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{a.titulo}</span>
              <span className="block text-xs text-slate-500">{a.detalle}</span>
            </span>
            <ChevronRight size={14} className="mt-1 shrink-0 text-slate-300" />
          </button>
          {onDismiss && <button type="button" onClick={() => onDismiss(a)} aria-label="Marcar como visto" title="Marcar como visto (lo oculta)" className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={14} /></button>}
        </div>
      ))}
    </Card>
  );
}

function CierreMesCard({ cierre, onDrill }) {
  if (!cierre) return null;
  const mesTxt = monthLabelLong(cierre.mesKey);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: C.line }}>
        <CalendarDays size={15} style={{ color: C.accent }} />
        <h2 className="text-sm font-semibold">Resumen de {mesTxt}</h2>
      </div>
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4" style={{ background: C.line }}>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(cierre.ingreso)}</div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(cierre.gasto)}</div>
          {cierre.deltaGasto !== null && (
            <div className="mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ ...tnum, background: cierre.deltaGasto > 0 ? C.expenseSoft : C.incomeSoft, color: cierre.deltaGasto > 0 ? C.expense : C.income }}>
              {cierre.deltaGasto > 0 ? "▲ +" : "▼ "}{fmtPct(Math.abs(cierre.deltaGasto))} vs {monthLabelLong(cierre.prevKey).split(" de ")[0]}
            </div>
          )}
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ahorrado</div>
          <div className="text-lg font-semibold" style={{ ...tnum, color: cierre.neto >= 0 ? C.income : C.expense }}>{cierre.neto >= 0 ? "+" : ""}{fmtE0(cierre.neto)}</div>
          {cierre.ingreso > 0 && <div className="text-xs text-slate-400">{fmtPct(cierre.neto / cierre.ingreso)} de lo ingresado</div>}
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Saldo actual{cierre.saldoReal ? <span className="ml-1 rounded-full px-1.5 py-px text-[9px] font-semibold" style={{ background: C.accentSoft, color: C.accent }}>banco</span> : ""}</div>
          {cierre.saldoNow != null
            ? <div className="text-2xl font-bold tracking-tight" style={{ ...tnum, color: cierre.saldoNow >= 0 ? C.ink : C.expense }}>{fmtE0(cierre.saldoNow)}</div>
            : <div className="text-sm text-slate-400">Sin datos de saldo</div>}
        </div>
      </div>
      {(cierre.topCats.length > 0 || cierre.subidas.length > 0) && (
        <div className="border-t px-4 py-3" style={{ borderColor: C.line }}>
          {cierre.topCats.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-slate-400">Donde más fue:</span>
              {cierre.topCats.map((c) => (
                <button key={c.cat} type="button" onClick={() => onDrill({ type: "cat", key: c.cat, label: `${c.cat} · ${monthLabelLong(cierre.mesKey)}`, month: cierre.mesKey })} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ background: C.expenseSoft, color: C.expense }}>
                  {c.cat} {fmtE0(c.v)}
                </button>
              ))}
            </div>
          )}
          {cierre.subidas.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="text-slate-400">Se encareció:</span>
              {cierre.subidas.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium" style={{ background: C.warnSoft, color: C.warn }}>
                  <TrendingUp size={10} /> {s.label.slice(0, 22)} ({s.annualImpact > 0 ? "+" : ""}{fmtE0(s.annualImpact)}/año)
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

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

/* Recap mensual conversacional (tono neutro). Mes en curso por defecto; flechas para cambiar. */
function MonthRecap({ movs, onDrill }) {
  const months = useMemo(() => {
    const s = new Set();
    for (const m of movs) if (!m.omit) s.add(monthKey(m.date));
    return [...s].sort();
  }, [movs]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(Math.max(0, months.length - 1)); }, [months.length]);
  if (!months.length) return <Card className="p-8 text-center text-sm text-slate-500">Aún no hay datos para el recap.</Card>;
  const pos = Math.min(idx, months.length - 1);
  const mKey = months[pos];
  const r = buildRecap(movs, mKey);
  const mesTxt = monthLabelLong(mKey);
  const mesPrevTxt = monthLabelLong(r.prevKey).split(" de ")[0];
  const maxBar = Math.max(1, ...r.topCats.flatMap((c) => [c.v, c.prev]));
  const frase1 = r.neto >= 0
    ? `En ${mesTxt} ingresaste ${fmtE0(r.ingreso)} y gastaste ${fmtE0(r.gasto)}: te quedaron ${fmtE0(r.neto)}.`
    : `En ${mesTxt} gastaste ${fmtE0(r.gasto)} e ingresaste ${fmtE0(r.ingreso)}: gastaste ${fmtE0(-r.neto)} más de lo que entró.`;
  const frase2 = r.deltaGasto != null
    ? `Gastaste un ${fmtPct(Math.abs(r.deltaGasto))} ${r.deltaGasto >= 0 ? "más" : "menos"} que en ${mesPrevTxt}${r.topRise && r.topRise.rise > 0 ? `, sobre todo en ${r.topRise.cat}` : ""}.`
    : null;
  const arrow = "flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
  return (
    <div className="space-y-4 anim-rise">
      <div className="flex items-center justify-center gap-4">
        <button type="button" aria-label="Mes anterior" disabled={pos <= 0} onClick={() => setIdx(pos - 1)} className={arrow} style={{ borderColor: C.lineStrong, color: C.ink2 }}>‹</button>
        <span className="min-w-[9rem] text-center text-sm font-semibold">{mesTxt}</span>
        <button type="button" aria-label="Mes siguiente" disabled={pos >= months.length - 1} onClick={() => setIdx(pos + 1)} className={arrow} style={{ borderColor: C.lineStrong, color: C.ink2 }}>›</button>
      </div>
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: C.accent }}>✦</div>
          <h2 className="text-sm font-semibold">Tu resumen de {mesTxt.split(" de ")[0]}</h2>
        </div>
        <p className="text-sm">{frase1}</p>
        {frase2 && <p className="mt-1.5 text-sm">{frase2}</p>}
        <p className="mt-1.5 text-xs text-slate-400">Los traspasos entre cuentas y el ahorro no cuentan aquí.</p>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos</div><div className="text-lg font-bold" style={{ ...tnum, color: C.income }}>{fmtE0(r.ingreso)}</div></Card>
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div><div className="text-lg font-bold" style={{ ...tnum, color: C.expense }}>{fmtE0(r.gasto)}</div></Card>
        <Card className="p-3"><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div><div className="text-lg font-bold" style={{ ...tnum, color: r.neto >= 0 ? C.income : C.expense }}>{r.neto >= 0 ? "+" : ""}{fmtE0(r.neto)}</div></Card>
      </div>
      {r.topCats.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Dónde más se fue <span className="font-normal text-slate-400">· vs {mesPrevTxt}</span></h2>
          <div className="space-y-3">
            {r.topCats.map((c) => {
              const d = c.prev > 0 ? (c.v - c.prev) / c.prev : null;
              return (
                <button key={c.cat} type="button" onClick={() => onDrill({ type: "cat", key: c.cat, label: `${c.cat} · ${mesTxt}`, month: mKey })} className="block w-full text-left focus-visible:outline-none">
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{c.cat}</span>
                    <span style={tnum}><b>{fmtE0(c.v)}</b>{d != null && <span className="ml-1.5 text-xs font-semibold" style={{ color: d >= 0 ? C.expense : C.income }}>{d >= 0 ? "▲" : "▼"}{fmtPct(Math.abs(d))}</span>}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${Math.max(3, (c.v / maxBar) * 100)}%`, background: C.expense }} /></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, (c.prev / maxBar) * 100)}%`, background: C.lineStrong }} /></div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400"><span className="inline-block h-2 w-4 rounded-full" style={{ background: C.expense }} /> {mesTxt.split(" de ")[0]} · <span className="inline-block h-2 w-4 rounded-full" style={{ background: C.lineStrong }} /> {mesPrevTxt}</div>
        </Card>
      )}
    </div>
  );
}

/* Calendario de gasto del mes: una fila por semana (lunes→domingo), intensidad = gasto del día.
   Revela hábitos (findes, día de cobro) que un donut no ve. Excluye internos (traspasos/ahorro). */
function GastoCalendar({ movs, meses, mesFiltro, onPickMes, onDrill }) {
  // El mes que se pinta sale del FILTRO, y las flechas mueven el filtro, para que calendario y
  // resto de la pestaña no puedan contradecirse.
  const [modo, setModo] = useState("neto"); // neto | gasto | ingreso
  const mesesConDatos = useMemo(() => {
    const s = new Set();
    for (const mv of movs) if (mv.date instanceof Date && !isNaN(mv.date)) s.add(monthKey(mv.date));
    return [...s].sort();
  }, [movs]);
  const mk = mesFiltro || mesesConDatos[mesesConDatos.length - 1];

  const { byDay, maxG, maxI, maxPos, maxNeg } = useMemo(() => {
    const map = new Map();
    if (!mk) return { byDay: map, maxG: 1, maxI: 1, maxPos: 1, maxNeg: 1 };
    const [yy, mm] = mk.split("-").map(Number);
    for (const mv of movs) {
      const d = mv.date;
      if (!(d instanceof Date) || d.getFullYear() !== yy || d.getMonth() !== mm - 1) continue;
      if (INTERNAL_SET.has(mv.category || "Otros")) continue;
      // Extraordinarios y papelera fuera, igual que en el resto de agregados: un cargo puntual
      // grande saturaba la escala de color y dejaba los demás días en blanco.
      if (mv.extra || mv.omit) continue;
      const day = d.getDate();
      const e = map.get(day) || { g: 0, i: 0, ids: [] };
      if (mv.amount < 0) e.g += -mv.amount; else e.i += mv.amount;
      e.ids.push(mv.id);
      map.set(day, e);
    }
    const vals = [...map.values()];
    const mx = (arr) => (arr.length ? Math.max(...arr) : 1);
    return {
      byDay: map,
      maxG: mx(vals.map((v) => v.g).filter((x) => x > 0)),
      maxI: mx(vals.map((v) => v.i).filter((x) => x > 0)),
      // Escalas independientes para positivo y negativo: con una sola, un día de nómina fija el
      // máximo y todos los días de gasto normal quedan prácticamente incoloros.
      maxPos: mx(vals.map((v) => v.i - v.g).filter((x) => x > 0)),
      maxNeg: mx(vals.map((v) => v.g - v.i).filter((x) => x > 0)),
    };
  }, [movs, mk]);

  if (!mk) return null;
  const [y, m] = mk.split("-").map(Number);
  const lista = meses && meses.length ? meses : mesesConDatos;
  const idx = lista.indexOf(mk);
  const anterior = idx > 0 ? lista[idx - 1] : null;
  const siguiente = idx >= 0 && idx < lista.length - 1 ? lista[idx + 1] : null;
  const dim = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes = 0
  const cells = [];
  for (let k = 0; k < firstDow; k++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const escala = (v, max) => (v <= 0 ? 0 : v < max * 0.25 ? 25 : v < max * 0.5 ? 48 : v < max * 0.75 ? 72 : 100);
  const tint = (base, p) => (p === 0 ? C.line : `color-mix(in srgb, ${base} ${p}%, ${C.line})`);
  // Color de la celda según el modo. En "neto" manda el signo del día: uno con 2.700 € de
  // ingreso y 650 € de gasto cierra en verde, no en rojo intenso por el gasto.
  const pinta = (e) => {
    if (!e) return { p: 0, base: C.expense };
    if (modo === "gasto") return { p: escala(e.g, maxG), base: C.expense };
    if (modo === "ingreso") return { p: escala(e.i, maxI), base: C.income };
    const neto = e.i - e.g;
    if (neto > 0) return { p: escala(neto, maxPos), base: C.income };
    if (neto < 0) return { p: escala(-neto, maxNeg), base: C.expense };
    return { p: 0, base: C.expense };
  };

  const totalG = [...byDay.values()].reduce((s, e) => s + e.g, 0);
  const totalI = [...byDay.values()].reduce((s, e) => s + e.i, 0);
  const Flecha = ({ destino, atras }) => (
    <button type="button" onClick={() => destino && onPickMes && onPickMes(destino)} disabled={!destino || !onPickMes}
      aria-label={atras ? "Mes anterior" : "Mes siguiente"}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {atras ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
  const rampa = (base) => [25, 48, 72, 100].map((p) => <span key={p} className="inline-block h-3 w-3 rounded-sm" style={{ background: tint(base, p) }} />);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">Calendario · {monthLabelLong(mk)}</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Flecha destino={anterior} atras />
          <Flecha destino={siguiente} />
        </div>
      </div>
      <div className="mb-3 mt-1.5 flex flex-wrap items-center gap-2">
        <Seg ariaLabel="Qué colorea el calendario" value={modo} onChange={setModo}
          options={[{ v: "neto", l: "Neto" }, { v: "gasto", l: "Gasto" }, { v: "ingreso", l: "Ingreso" }]} />
        <span className="text-xs text-slate-500" style={tnum}>
          {fmtE0(totalG)} gasto · {fmtE0(totalI)} ingreso · neto {fmtE0(totalI - totalG)}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, k) => <div key={k} className="text-[10px] font-semibold text-slate-400">{d}</div>)}
        {cells.map((d, k) => {
          if (d == null) return <div key={"e" + k} />;
          const e = byDay.get(d);
          const { p, base } = pinta(e);
          const partes = [];
          if (e && e.g > 0) partes.push("gasto " + fmtE0(e.g));
          if (e && e.i > 0) partes.push("ingreso " + fmtE0(e.i));
          if (e && e.g > 0 && e.i > 0) partes.push("neto " + fmtE0(e.i - e.g));
          const title = `${d} de ${monthLabelLong(mk)}` + (partes.length ? " · " + partes.join(" · ") : " · sin movimientos");
          const estilo = { ...tnum, background: tint(base, p), color: p >= 72 ? "#fff" : C.ink2 };
          // El punto solo cuando el color de la celda NO cuenta ya que hubo ingreso: así un día
          // que cierra en negativo pero tuvo ingresos no esconde ese dato.
          const marca = e && e.i > 0 && base !== C.income
            ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: C.income }} />
            : null;
          if (!e) return <div key={d} title={title} className="relative flex aspect-square items-center justify-center rounded-md text-[10px] font-medium" style={estilo}>{d}</div>;
          return (
            <button key={d} type="button" title={title} aria-label={title}
              onClick={() => onDrill({ type: "ids", ids: e.ids, label: `${d} de ${monthLabelLong(mk)}` })}
              className="relative flex aspect-square items-center justify-center rounded-md text-[10px] font-medium transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={estilo}>{d}{marca}</button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {modo !== "ingreso" && <span className="inline-flex items-center gap-1.5">{modo === "neto" ? "Cierra en rojo" : "Menos gasto"} {rampa(C.expense)} más</span>}
        {modo !== "gasto" && <span className="inline-flex items-center gap-1.5">{modo === "neto" ? "Cierra en verde" : "Menos ingreso"} {rampa(C.income)} más</span>}
        {modo !== "ingreso" && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.income }} /> hubo ingreso</span>}
        <span>Pulsa un día para ver sus movimientos.</span>
      </div>
    </Card>
  );
}

/* Los extraordinarios se excluyen de TODOS los agregados (medias, proyecciones, cierre,
   calendario…), que es justo para lo que sirve la marca. Pero al no aparecer en ninguna parte
   se volvian invisibles: el dinero desaparecia del analisis sin dejar rastro. Esta tarjeta los
   contabiliza aparte, sin contaminar las medias, y deja abrirlos. */
function ExtraordinariosCard({ movs, onDrill }) {
  const extras = useMemo(() => movs.filter((m) => m.extra), [movs]);
  if (!extras.length) return null;
  const gasto = extras.reduce((sx, m) => (m.amount < 0 ? sx - m.amount : sx), 0);
  const ingreso = extras.reduce((sx, m) => (m.amount > 0 ? sx + m.amount : sx), 0);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Star size={14} style={{ color: C.accent }} /> Extraordinarios del periodo
          </h2>
          <p className="mt-0.5 text-xs text-slate-500" style={tnum}>
            {extras.length} {extras.length === 1 ? "movimiento" : "movimientos"}
            {gasto > 0 ? ` · ${fmtE0(gasto)} de gasto` : ""}
            {ingreso > 0 ? ` · ${fmtE0(ingreso)} de ingreso` : ""}
          </p>
        </div>
        <Btn size="sm" onClick={() => onDrill({ type: "ids", ids: extras.map((m) => m.id), label: "Movimientos extraordinarios" })}>Ver y editar</Btn>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Quedan fuera de medias, proyecciones, comparativas y del calendario, para que un cargo puntual
        no distorsione tu gasto habitual. Aquí los tienes contabilizados aparte: pulsa la estrella de
        un movimiento para devolverlo al análisis.
      </p>
    </Card>
  );
}

function ResumenTab({ agg, allAgg, granularity, setGranularity, onDrill, onPickMonth, outlierMovs, recurring, monthlySpark, saldoSerie, momDelta, alerts, cierre, onOpenPending, onDismissAlert }) {
  const { gasto, ingresos, interno = 0, byInternoCat, byCat, byAsset, buckets, topCats, rangeDays, mediaMensual, gastoProj, mesesData } = agg;
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  // Ingresos por categoría, para su propio donut (mismo componente, modo income).
  const byCatIncome = useMemo(() => {
    const m = new Map();
    for (const p of agg.parts || []) if (p.amount > 0 && !INTERNAL_SET.has(p.cat) && !isRefundPart(p)) m.set(p.cat, (m.get(p.cat) || 0) + p.amount);
    return m;
  }, [agg.parts]);
  const activeRec = recurring.filter((r) => ["mensual", "anual", "bimestral", "trimestral", "semestral"].includes(r.cadence));
  const recAnnual = activeRec.reduce((s, r) => s + r.annual, 0);
  const isDay = rangeDays <= 32;
  // Ahorro = lo que ingresas menos lo que consumes. El dinero movido a ahorro/inversión
  // NO es gasto: es parte de cómo colocas ese ahorro, así que no resta aquí.
  const ahorro = ingresos - gasto;
  return (
    <div className="space-y-4 anim-rise">
      <CierreMesCard cierre={cierre} onDrill={onDrill} />
      <AlertsCard alerts={alerts || []} onDrill={onDrill} onOpenPending={onOpenPending} onDismiss={onDismissAlert} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Gasto del periodo" value={fmtE0(gasto)} color={C.expense} icon={<ArrowDownRight size={15} />}
          spark={monthlySpark} sparkColor={C.expense}
          sub={momDelta ? `${momDelta.delta >= 0 ? "▲ +" : "▼ "}${fmtPct(Math.abs(momDelta.delta))} vs ${monthLabelLong(momDelta.prevKey)}` : `Proyección 12 m: ${fmtE0(gastoProj)} · ${fmtMonths(mesesData)} m de datos`} />
        <KPI label="Ingresos" value={fmtE0(ingresos)} color={C.income} icon={<ArrowUpRight size={15} />} sub={`Media de gasto: ${fmtE0(mediaMensual)}/mes`} />
        <KPI label="Ahorro del periodo" value={fmtE0(ahorro)} color={ahorro >= 0 ? C.income : C.expense} icon={<PiggyBank size={15} />}
          sub={`${ingresos > 0 ? `Tasa: ${fmtPct(ahorro / ingresos)}` : "Sin ingresos"}${interno > 0 ? ` · ${fmtE0(interno)} a ahorro/inversión` : ""}`} />
        <KPI label="Mayor categoría" value={topCat ? topCat[0] : "–"} icon={<TrendingUp size={15} />} sub={topCat ? `${fmtE0(topCat[1])} en el periodo` : "Sin gastos"} />
      </div>

      {/* 1) Ingresos por categoría (mismo donut, modo ingresos) */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ingresos por categoría</h2>
          <span className="text-xs text-slate-400">Pulsa para ver el detalle</span>
        </div>
        <DonutCategories byCat={byCatIncome} total={ingresos} onDrill={onDrill} parts={agg.parts} income
          extraTotal={agg.extraIngreso || 0} extraIds={agg.extraIngresoIds || []} />
      </Card>

      {/* 1b) A ahorro e inversión (traspasos internos: no son gasto) */}
      {interno > 0 && byInternoCat && (
        <Card className="p-4">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> A ahorro e inversión</h2>
            <span className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(interno)}</span>
          </div>
          <p className="mb-2 text-xs text-slate-400">Dinero que has movido a ahorro/inversión u otras cuentas en el periodo. No es gasto: es cómo colocas lo que ahorras.</p>
          <div className="space-y-1">
            {[...byInternoCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
              <button key={cat} type="button" onClick={() => onDrill({ type: "cat", key: cat, label: cat })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catColor(cat) }} /> {cat}</span>
                <span className="font-medium" style={tnum}>{fmtE0(v)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 2) Gasto por categoría */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Gasto por categoría</h2>
          <span className="text-xs text-slate-400">Pulsa para ver y corregir</span>
        </div>
        <DonutCategories byCat={byCat} total={gasto} onDrill={onDrill} parts={agg.parts}
          extraTotal={agg.extraGasto || 0} extraIds={agg.extraGastoIds || []} />
      </Card>

      {/* 3) Evolución del gasto */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-semibold">Evolución del gasto</h2><p className="text-xs text-slate-400">{isDay ? "Por día" : "Apilado por categoría · pulsa un periodo para filtrarlo"}</p></div>
          {!isDay && <Seg ariaLabel="Granularidad" value={granularity} onChange={setGranularity} options={[{ v: "month", l: "Mensual" }, { v: "year", l: "Anual" }]} />}
        </div>
        <StackedTime buckets={buckets} topCats={topCats} isDay={isDay} onPick={onPickMonth} />
      </Card>

      {/* 4) Gasto por activo */}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Gasto por activo</h2>
        {byAsset.size === 0 ? <p className="py-6 text-center text-sm text-slate-500">Sin gastos asignados a activos. Créalos en la pestaña Activos.</p> : (
          <div className="space-y-1">
            {[...byAsset.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => {
              const a = allAgg.assets.find((x) => x.name === name);
              return (
                <button key={name} type="button" onClick={() => onDrill({ type: "asset", key: name, label: `${a?.emoji || ""} ${name}` })}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className="flex items-center gap-2">{a?.emoji} {name}</span>
                  <span className="font-medium" style={tnum}>{fmtE0(v)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 5) Evolución del saldo */}
      {saldoSerie && (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Evolución del saldo</h2>
            <span className="text-xs text-slate-400" style={tnum}>Ahora: {fmtE(saldoSerie[saldoSerie.length - 1].saldo)}</span>
          </div>
          <SaldoChart serie={saldoSerie} />
        </Card>
      )}

      {/* 6) Gastos atípicos */}
      <Card className="p-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle size={14} style={{ color: C.warn }} /> Gastos atípicos</h2>
        <p className="mb-2 text-xs text-slate-400">Cargos muy por encima de tu media en su categoría, dentro del periodo elegido.</p>
        {outlierMovs.length === 0 ? <p className="py-2 text-sm text-slate-500">Nada fuera de lo habitual. 👌</p> : (
          <div className="space-y-1">
            {outlierMovs.slice(0, 6).map((m) => (
              <button key={m.id} type="button" onClick={() => onDrill({ type: "pattern", key: m.pattern, label: m.concept.slice(0, 42) })}
                className="flex w-full items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{m.concept}</span>
                  <span className="block truncate text-xs text-slate-400" style={tnum}>{fmtDateShort(m.date)}{m._out?.ratio >= 1.5 && <span style={{ color: C.warn }}> · ≈{nfNum.format(Math.round(m._out.ratio * 10) / 10)}× tu media en {m._out.cat}</span>}</span>
                </span>
                <span className="shrink-0 font-medium" style={{ ...tnum, color: C.expense }}>{fmtE0(m.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   PESTAÑA ACTIVOS
   ============================================================ */
function AssetModal({ asset, onSave, onDelete, onClose }) {
  const [name, setName] = useState(asset?.name || "");
  const [emoji, setEmoji] = useState(asset?.emoji || "📦");
  const [cats, setCats] = useState(new Set(asset?.categories || []));
  const [value, setValue] = useState(asset?.value != null ? String(asset.value) : "");
  const [uso, setUso] = useState(asset?.uso || "otro"); // alquiler | vivienda | otro
  return (
    <Modal title={asset ? "Editar activo" : "Nuevo activo"} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div><label className="text-xs font-medium text-slate-600">Icono</label>
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 block rounded-lg border bg-white px-2 py-1.5 text-lg" style={{ borderColor: C.line }}>{EMOJI_CHOICES.map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="flex-1"><label className="text-xs font-medium text-slate-600">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coche, Casa, Segunda residencia…" className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} /></div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Uso</label>
          <p className="mb-1.5 mt-0.5 text-xs text-slate-400">Para el informe por inmueble: distingue lo que alquilas de tu vivienda.</p>
          <Seg ariaLabel="Uso del activo" value={uso} onChange={setUso}
            options={[{ v: "alquiler", l: "🔑 En alquiler" }, { v: "vivienda", l: "🏠 Vivienda habitual" }, { v: "otro", l: "Otro" }]} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Valoración actual <span className="font-normal text-slate-400">(opcional)</span></label>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ej. 180000" className="w-40 rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-sm text-slate-400">€</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">El valor de mercado del piso, el coche o tu posición. Un CSV no lo trae; con él la app calcula tu patrimonio y la rentabilidad real (rendimiento anual sobre el valor).</p>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Categorías que agrupa</div>
          <p className="mb-2 mt-0.5 text-xs text-slate-400">Todo gasto de estas categorías cuenta para el activo, salvo que un movimiento tenga otro activo asignado a mano.</p>
          <div className="grid max-h-56 grid-cols-2 gap-x-3 overflow-y-auto rounded-xl border p-2" style={{ borderColor: C.line }}>
            {CATEGORIES_GASTO.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" className="accent-blue-600" checked={cats.has(c)} onChange={(e) => { const s = new Set(cats); e.target.checked ? s.add(c) : s.delete(c); setCats(s); }} />{c}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-2">
          {asset ? <Btn kind="danger" onClick={onDelete}><Trash2 size={14} /> Eliminar</Btn> : <span />}
          <div className="flex gap-2"><Btn onClick={onClose}>Cancelar</Btn><Btn kind="primary" disabled={!name.trim()} onClick={() => { const v = parseFloat(String(value).replace(",", ".")); onSave({ name: name.trim(), emoji, categories: [...cats], value: isFinite(v) && v > 0 ? v : undefined, uso }); }}>Guardar</Btn></div>
        </div>
      </div>
    </Modal>
  );
}

/* Informe por inmueble para el periodo seleccionado (un año natural = informe anual, útil
   para la renta). Por cada activo «en alquiler»: alquiler cobrado, gastos desglosados por
   categoría y rendimiento neto. La vivienda habitual se muestra aparte (no es rendimiento
   de alquiler). Es orientativo: no sustituye al asesoramiento fiscal. */
function RentaReport({ assets, agg, periodLabel, onClose }) {
  const rows = assets.map((a) => {
    const ingreso = agg.byAssetIncome.get(a.name) || 0;
    const gasto = agg.byAsset.get(a.name) || 0;
    const cats = [...(agg.byAssetCat.get(a.name) || new Map()).entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    return { a, ingreso, gasto, neto: ingreso - gasto, cats };
  });
  const alquiler = rows.filter((r) => r.a.uso === "alquiler");
  const vivienda = rows.filter((r) => r.a.uso === "vivienda");
  const totIng = alquiler.reduce((s, r) => s + r.ingreso, 0);
  const totGas = alquiler.reduce((s, r) => s + r.gasto, 0);

  const exportar = () => {
    const data = {
      informe: "Rendimiento por inmueble", periodo: periodLabel, generado: new Date().toISOString(),
      aviso: "Cifras orientativas basadas en tus movimientos. No es asesoramiento fiscal.",
      alquiler: alquiler.map((r) => ({ inmueble: r.a.name, ingresos: r2(r.ingreso), gastos: r2(r.gasto), neto: r2(r.neto), gastosPorCategoria: Object.fromEntries(r.cats.map(([c, v]) => [c, r2(v)])) })),
      viviendaHabitual: vivienda.map((r) => ({ inmueble: r.a.name, gastos: r2(r.gasto), nota: "Vivienda habitual: no genera rendimiento de alquiler. La deducción por hipoteca solo aplica en régimen transitorio (compra anterior a 2013)." })),
      totalAlquiler: { ingresos: r2(totIng), gastos: r2(totGas), neto: r2(totIng - totGas) },
    };
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `informe-inmuebles-${(periodLabel || "").replace(/[^\w-]+/g, "_")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* noop */ }
  };

  return (
    <Modal title="Informe por inmueble" subtitle={periodLabel} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-md text-xs text-slate-500">Rendimiento de cada inmueble <span className="font-medium">en el periodo seleccionado</span>. Elige un año arriba para el informe anual de la renta.</p>
          <Btn kind="primary" onClick={exportar}><Download size={14} /> Exportar informe</Btn>
        </div>

        {alquiler.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">
            Ningún activo marcado como <span className="font-medium">«En alquiler»</span>. Edita tus inmuebles (icono ✏️) y pon su uso para que aparezcan aquí.
          </Card>
        ) : alquiler.map(({ a, ingreso, gasto, neto, cats }) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold"><span className="mr-1.5">{a.emoji}</span>{a.name}</h3>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.accentSoft, color: C.accent }}>🔑 En alquiler</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Alquiler cobrado</div><div className="text-lg font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(ingreso)}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div><div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(gasto)}</div></div>
              <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div><div className="text-lg font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</div></div>
            </div>
            {cats.length > 0 && (
              <div className="mt-3 border-t pt-2" style={{ borderColor: C.line }}>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Gastos por categoría</div>
                <div className="space-y-1">
                  {cats.map(([c, v]) => (
                    <div key={c} className="flex items-center gap-2 text-xs">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(c) }} />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{c}</span>
                      <span className="shrink-0 font-medium text-slate-500" style={tnum}>{fmtE0(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}

        {alquiler.length > 1 && (
          <Card className="p-4">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total alquileres</span>
              <span style={{ ...tnum, color: totIng - totGas >= 0 ? C.income : C.expense }}>{totIng - totGas >= 0 ? "+" : ""}{fmtE0(totIng - totGas)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500" style={tnum}>Ingresos {fmtE0(totIng)} · Gastos {fmtE0(totGas)}</div>
          </Card>
        )}

        {vivienda.map(({ a, gasto }) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold"><span className="mr-1.5">{a.emoji}</span>{a.name}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">🏠 Vivienda habitual</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Gastos del periodo: <span className="font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(gasto)}</span>. No genera rendimiento de alquiler.</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">La hipoteca de la vivienda habitual solo desgrava por el <span className="font-medium">régimen transitorio</span> (compra anterior a 2013 y deducción ya aplicada). Compruébalo con tu gestor.</p>
          </Card>
        ))}

        <p className="text-[11px] leading-relaxed text-slate-400">Cifras orientativas a partir de tus movimientos del periodo. No incluye amortizaciones ni la reducción del 60 % por alquiler de vivienda, ni sustituye al asesoramiento fiscal.</p>
      </div>
    </Modal>
  );
}

function ActivosTab({ assets, setAssets, agg, allAgg, onDrill, periodLabel }) {
  const [report, setReport] = useState(false);
  useBackClose(report, () => setReport(false));
  const [editing, setEditing] = useState(null);
  useBackClose(!!editing, () => setEditing(null));
  const save = (data) => {
    if (editing === "new") setAssets((as) => [...as, { id: "a" + Date.now(), ...data }]);
    else setAssets((as) => as.map((a) => (a.id === editing.id ? { ...a, ...data } : a)));
    setEditing(null);
  };
  // Resumen por activo en el PERIODO (real, no proyectado), para el vistazo rápido.
  const resumen = assets.map((a) => {
    const gasto = agg.byAsset.get(a.name) || 0;
    const ingreso = agg.byAssetIncome.get(a.name) || 0;
    return { a, gasto, ingreso, neto: ingreso - gasto };
  }).sort((x, y) => y.neto - x.neto);
  const totIng = resumen.reduce((s, r) => s + r.ingreso, 0);
  const totGas = resumen.reduce((s, r) => s + r.gasto, 0);

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Un activo agrupa lo que ingresa y cuesta algo tuyo (un piso en alquiler, el coche, la mascota…). Abajo, el detalle y la proyección anual de cada uno.</p>
        <div className="flex flex-wrap items-center gap-2">
          {assets.some((a) => a.uso === "alquiler") && <Btn onClick={() => setReport(true)}><FileText size={15} /> Informe por inmueble</Btn>}
          <Btn kind="primary" onClick={() => setEditing("new")}><Plus size={15} /> Nuevo activo</Btn>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card className="p-10 text-center"><Car size={28} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Aún no tienes activos. Crea uno (por ejemplo «Coche») y elige qué categorías agrupa.</p></Card>
      ) : (<>
        {/* Tabla resumen: todos los activos de un vistazo, ingresos y gastos por separado.
            Cada celda de importe lleva a sus movimientos (por signo). */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-slate-400" style={{ borderColor: C.line }}>
                  <th className="px-3 py-2 text-left font-medium">Activo</th>
                  <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                  <th className="px-3 py-2 text-right font-medium">Gastos</th>
                  <th className="px-3 py-2 text-right font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map(({ a, gasto, ingreso, neto }) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: C.line }}>
                    <td className="px-3 py-2"><button type="button" onClick={() => setEditing(a)} className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" title="Ver / editar este activo"><span className="mr-1.5">{a.emoji}</span>{a.name}</button></td>
                    <td className="px-3 py-2 text-right" style={tnum}>
                      {ingreso > 0
                        ? <button type="button" onClick={() => onDrill({ type: "asset", key: a.name, sign: "in", label: `${a.emoji} ${a.name} · ingresos` })} className="font-medium hover:underline" style={{ color: C.income }}>{fmtE0(ingreso)}</button>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-3 py-2 text-right" style={tnum}>
                      {gasto > 0
                        ? <button type="button" onClick={() => onDrill({ type: "asset", key: a.name, sign: "out", label: `${a.emoji} ${a.name} · gastos` })} className="font-medium hover:underline" style={{ color: C.expense }}>{fmtE0(gasto)}</button>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold" style={{ borderColor: C.lineStrong }}>
                  <td className="px-3 py-2 text-left text-slate-500">Total</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.income }}>{fmtE0(totIng)}</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: C.expense }}>{fmtE0(totGas)}</td>
                  <td className="px-3 py-2 text-right" style={{ ...tnum, color: totIng - totGas >= 0 ? C.income : C.expense }}>{totIng - totGas >= 0 ? "+" : ""}{fmtE0(totIng - totGas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="border-t px-3 py-1.5 text-[11px] text-slate-400" style={{ borderColor: C.line }}>Cifras del periodo seleccionado. Toca un importe para ver sus movimientos.</div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {assets.map((a) => {
            const real = agg.byAsset.get(a.name) || 0;
            const full = allAgg.byAsset.get(a.name) || 0;
            const proj = full * allAgg.annualFactor;
            const incomeFull = allAgg.byAssetIncome.get(a.name) || 0;
            const incomeProj = incomeFull * allAgg.annualFactor;
            const ingresoReal = agg.byAssetIncome.get(a.name) || 0;
            const netoReal = ingresoReal - real;
            const netProj = incomeProj - proj;
            // Composición del gasto del PERIODO (coherente con las cifras de arriba),
            // no el histórico anualizado: cada categoría como parte del 100% del gasto.
            const desglose = [...(agg.byAssetCat.get(a.name) || new Map()).entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
            const maxIG = Math.max(ingresoReal, real, 1);
            const grossYield = a.value ? incomeProj / a.value : null;
            const netYield = a.value ? netProj / a.value : null;
            const costPct = a.value ? proj / a.value : null;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5"><span className="text-2xl">{a.emoji}</span><div><h3 className="font-semibold">{a.name}</h3><p className="text-xs text-slate-400">{a.categories.length ? a.categories.join(" · ") : "Solo movimientos asignados a mano"}</p></div></div>
                  <button type="button" onClick={() => setEditing(a)} aria-label={`Editar ${a.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>
                </div>

                {/* Lo primero y en grande: lo que entra y lo que sale en el periodo. */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos actuales</div>
                    <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: ingresoReal > 0 ? C.income : C.faint }}>{fmtE0(ingresoReal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos actuales</div>
                    <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: real > 0 ? C.expense : C.faint }}>{fmtE0(real)}</div>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">Neto del periodo: <span className="font-semibold" style={{ ...tnum, color: netoReal >= 0 ? C.income : C.expense }}>{netoReal >= 0 ? "+" : ""}{fmtE0(netoReal)}</span></div>

                {a.value != null && (
                  <div className="mt-4 rounded-xl p-3" style={{ background: C.accentSoft }}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor actual</span>
                      <span className="text-lg font-semibold" style={{ ...tnum, color: C.accent }}>{fmtE0(a.value)}</span>
                    </div>
                    {incomeProj > 0 ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg p-2" style={{ background: C.surface }}>
                          <div className="text-[10px] font-medium uppercase text-slate-400">Rent. bruta</div>
                          <div className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtPct(grossYield)}</div>
                          <div className="text-[10px] text-slate-400" style={tnum}>{fmtE0(incomeProj)}/año</div>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: C.surface }}>
                          <div className="text-[10px] font-medium uppercase text-slate-400">Rent. neta</div>
                          <div className="text-sm font-semibold" style={{ ...tnum, color: netYield >= 0 ? C.income : C.expense }}>{fmtPct(netYield)}</div>
                          <div className="text-[10px] text-slate-400" style={tnum}>{fmtE0(netProj)}/año</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-slate-500" style={tnum}>Cuesta mantenerlo <span className="font-semibold" style={{ color: C.expense }}>{fmtPct(costPct)}</span> de su valor al año ({fmtE0(proj)}/año)</div>
                    )}
                  </div>
                )}
                {/* Ingresos vs gastos del periodo, en barra, para compararlos de un vistazo. */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-slate-500">Ingresos</span>
                    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(ingresoReal / maxIG) * 100}%`, background: C.income }} /></span>
                    <span className="w-16 shrink-0 text-right font-medium" style={{ ...tnum, color: ingresoReal > 0 ? C.income : C.faint }}>{fmtE0(ingresoReal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-slate-500">Gastos</span>
                    <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(real / maxIG) * 100}%`, background: C.expense }} /></span>
                    <span className="w-16 shrink-0 text-right font-medium" style={{ ...tnum, color: real > 0 ? C.expense : C.faint }}>{fmtE0(real)}</span>
                  </div>
                </div>

                {/* Composición del 100 % del gasto: una barra apilada por categoría + leyenda
                    con importe y % (comunidad, impuestos…). Sustituye a la barra incremental. */}
                {desglose.length > 0 && real > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Cómo se compone el gasto</div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label="Composición del gasto por categoría">
                      {desglose.map(([cat, v]) => <div key={cat} style={{ width: `${(v / real) * 100}%`, background: catColor(cat) }} title={`${cat}: ${fmtE0(v)} (${Math.round((v / real) * 100)} %)`} />)}
                    </div>
                    <div className="mt-2 space-y-1">
                      {desglose.slice(0, 6).map(([cat, v]) => (
                        <div key={cat} className="flex items-center gap-2 text-xs">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: catColor(cat) }} />
                          <span className="min-w-0 flex-1 truncate text-slate-600">{cat}</span>
                          <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / real) * 100)} %</span>
                          <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                        </div>
                      ))}
                      {desglose.length > 6 && <div className="pl-4 text-[11px] text-slate-400">y {desglose.length - 6} categorías más</div>}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {incomeProj > 0 && <Btn size="sm" onClick={() => onDrill({ type: "asset", key: a.name, sign: "in", label: `${a.emoji} ${a.name} · ingresos` })}><ArrowUpRight size={13} /> Ingresos</Btn>}
                  {real > 0 && <Btn size="sm" onClick={() => onDrill({ type: "asset", key: a.name, sign: "out", label: `${a.emoji} ${a.name} · gastos` })}><ArrowDownRight size={13} /> Gastos</Btn>}
                  <Btn size="sm" kind="subtle" onClick={() => onDrill({ type: "asset", key: a.name, label: `${a.emoji} ${a.name}` })}>Todo <ChevronRight size={13} /></Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </>)}
      {editing && <AssetModal asset={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} onDelete={() => { setAssets((as) => as.filter((a) => a.id !== editing.id)); setEditing(null); }} />}
      {report && <RentaReport assets={assets} agg={agg} periodLabel={periodLabel} onClose={() => setReport(false)} />}
    </div>
  );
}

/* ============================================================
   PESTAÑA GRUPOS DE GASTO
   ============================================================ */
function GroupModal({ group, movsAll, onSave, onDelete, onClose }) {
  const [name, setName] = useState(group?.name || "");
  const [emoji, setEmoji] = useState(group?.emoji || "🏷️");
  const [color, setColor] = useState(group?.color || GROUP_COLORS[0]);
  const [keywords, setKeywords] = useState(group?.keywords || []);
  const [kwInput, setKwInput] = useState("");
  const draft = { ...group, name, emoji, color, keywords, movementIds: group?.movementIds || [], excludedIds: group?.excludedIds || [] };
  const matched = useMemo(() => movsAll.filter((m) => m.amount < 0 && movInGroup(m, draft)), [movsAll, name, keywords, color]);
  const matchedTotal = matched.reduce((s, m) => s - m.amount, 0);
  const addKw = () => { const v = kwInput.trim().toUpperCase(); if (v && !keywords.includes(v)) setKeywords([...keywords, v]); setKwInput(""); };
  return (
    <Modal title={group ? "Editar etiqueta" : "Nueva etiqueta"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium text-slate-600">Icono</label>
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 block rounded-lg border bg-white px-2 py-1.5 text-lg" style={{ borderColor: C.line }}>{[emoji, ...GROUP_EMOJI.filter((x) => x !== emoji)].map((e) => <option key={e} value={e}>{e}</option>)}</select></div>
          <div className="min-w-[160px] flex-1"><label className="text-xs font-medium text-slate-600">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maratones, Vacaciones verano, Boda…" className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} /></div>
          <div><label className="text-xs font-medium text-slate-600">Color</label>
            <div className="mt-1.5 flex gap-1.5">{GROUP_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-1 scale-110" : ""}`} style={{ background: c }} aria-label="color" />)}</div></div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600">Palabras clave (asignación automática)</div>
          <p className="mb-2 mt-0.5 text-xs text-slate-400">Cualquier movimiento cuyo concepto contenga una de estas palabras lleva la etiqueta. Útil para «pádel», «maratón»… Y además puedes añadir movimientos sueltos a mano desde cualquier gráfico.</p>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border p-2" style={{ borderColor: C.line }}>
            {keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{k}<button type="button" onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="text-slate-400 hover:text-slate-700"><X size={11} /></button></span>
            ))}
            <input value={kwInput} onChange={(e) => setKwInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }} placeholder="Escribe y pulsa Enter" className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none" />
          </div>
        </div>
        <Card className="bg-slate-50 p-3" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Coinciden ahora</span><span className="font-semibold" style={tnum}>{matched.length} movimientos · {fmtE0(matchedTotal)}</span></div>
          {matched.length > 0 && <div className="mt-2 max-h-28 space-y-0.5 overflow-y-auto">{matched.slice(0, 8).map((m) => <div key={m.id} className="flex justify-between text-xs text-slate-500" style={tnum}><span className="truncate pr-2">{m.concept}</span><span>{fmtE0(-m.amount)}</span></div>)}{matched.length > 8 && <div className="text-xs text-slate-400">y {matched.length - 8} más…</div>}</div>}
        </Card>
        <div className="flex justify-between gap-2">
          {group ? <Btn kind="danger" onClick={onDelete}><Trash2 size={14} /> Eliminar</Btn> : <span />}
          <div className="flex gap-2"><Btn onClick={onClose}>Cancelar</Btn><Btn kind="primary" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), emoji, color, keywords })}>Guardar</Btn></div>
        </div>
      </div>
    </Modal>
  );
}

function GruposTab({ groups, setGroups, groupStats, allGroupStats, movsAll, annualFactor, mesesData, onDrill }) {
  const [editing, setEditing] = useState(null);
  useBackClose(!!editing, () => setEditing(null));
  const save = (data) => {
    if (editing === "new") setGroups((gs) => [...gs, { id: "g" + Date.now(), movementIds: [], excludedIds: [], ...data }]);
    else setGroups((gs) => gs.map((g) => (g.id === editing.id ? { ...g, ...data } : g)));
    setEditing(null);
  };
  const ordered = [...groups].sort((a, b) => (allGroupStats.get(b.id)?.total || 0) - (allGroupStats.get(a.id)?.total || 0));
  // Desglose por apodo dentro de cada etiqueta: el apodo agrupa (varios "Impuestos"
  // suman) y así vemos qué % de una etiqueta como «Herencia» es realmente impuestos.
  const notesByGroup = useMemo(() => {
    const res = new Map();
    for (const g of groups) {
      const agg = new Map(); let total = 0;
      for (const m of movsAll) {
        if (m.amount >= 0 || !movInGroup(m, g)) continue;
        const v = -m.amount; total += v;
        const key = m.note || null;
        agg.set(key, (agg.get(key) || 0) + v);
      }
      const entries = [...agg.entries()].sort((a, b) => b[1] - a[1]);
      res.set(g.id, { total, entries, hasNotes: entries.some(([k]) => k) });
    }
    return res;
  }, [groups, movsAll]);
  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Una etiqueta reúne gastos sueltos de <strong>varias categorías</strong> bajo un tema: tu pádel (pistas + ropa + hoteles), un maratón, unas vacaciones… Se asigna por palabra clave, a mano desde cualquier gráfico, o pidiéndoselo al asistente.</p>
        <Btn kind="primary" onClick={() => setEditing("new")}><Plus size={15} /> Nueva etiqueta</Btn>
      </div>
      {groups.length === 0 ? (
        <Card className="p-10 text-center"><Tag size={28} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Crea tu primera etiqueta. Por ejemplo «Pádel» con las palabras clave <span className="font-medium">pádel</span> y <span className="font-medium">pista</span>, o pídesela al asistente.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {ordered.map((g) => {
            const sp = groupStats.get(g.id) || { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map() };
            const all = allGroupStats.get(g.id) || { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map(), byYear: new Map() };
            const neto = sp.ingreso - sp.gasto;
            const desglose = [...all.byCat.entries()].sort((a, b) => b[1] - a[1]);
            const maxD = desglose[0]?.[1] || 1;
            const years = [...all.byYear.entries()].sort();
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="h-1.5" style={{ background: g.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5"><span className="text-2xl">{g.emoji}</span><div><h3 className="font-semibold">{g.name}</h3><p className="text-xs text-slate-400">{all.count} movimientos en total{g.keywords?.length ? ` · ${g.keywords.length} palabra${g.keywords.length > 1 ? "s" : ""} clave` : ""}</p></div></div>
                    <button type="button" onClick={() => setEditing(g)} aria-label={`Editar ${g.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil size={15} /></button>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="flex gap-5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ingresos</div>
                        <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: sp.ingreso > 0 ? C.income : C.faint }}>{fmtE0(sp.ingreso)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Gastos</div>
                        <div className="text-2xl font-semibold tracking-tight" style={{ ...tnum, color: sp.gasto > 0 ? C.expense : C.faint }}>{fmtE0(sp.gasto)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Neto</div>
                      <div className="text-base font-semibold" style={{ ...tnum, color: neto >= 0 ? C.income : C.expense }}>{neto >= 0 ? "+" : ""}{fmtE0(neto)}</div>
                    </div>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{sp.count} mov. en el periodo</div>
                  {desglose.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Desglose por categoría (histórico)</div>
                      {desglose.slice(0, 5).map(([cat, v]) => (
                        <div key={cat} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0 truncate text-slate-600">{cat}</span>
                          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(v / maxD) * 100}%`, background: catColor(cat) }} /></span>
                          <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const nb = notesByGroup.get(g.id);
                    if (!nb || !nb.hasNotes || nb.total <= 0) return null;
                    return (
                      <div className="mt-4 space-y-1.5">
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Desglose por apodo</div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Composición por apodo">
                          {nb.entries.map(([k, v], i) => <div key={k ?? "_"} style={{ width: `${(v / nb.total) * 100}%`, background: k ? GROUP_COLORS[i % GROUP_COLORS.length] : C.faint }} title={`${k || "sin apodo"}: ${fmtE0(v)} (${Math.round((v / nb.total) * 100)} %)`} />)}
                        </div>
                        {nb.entries.slice(0, 6).map(([k, v], i) => (
                          <div key={k ?? "_"} className="flex items-center gap-2 text-xs">
                            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: k ? GROUP_COLORS[i % GROUP_COLORS.length] : C.faint }} />
                            <span className="min-w-0 flex-1 truncate text-slate-600">{k || <span className="text-slate-400">sin apodo</span>}</span>
                            <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / nb.total) * 100)} %</span>
                            <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {years.length > 1 && <div className="mt-3 flex flex-wrap gap-2 text-xs">{years.map(([y, v]) => <span key={y} className="rounded-md bg-slate-100 px-2 py-1" style={tnum}>{y}: <span className="font-medium">{fmtE0(v)}</span></span>)}</div>}
                  <div className="mt-4"><Btn onClick={() => onDrill({ type: "group", key: g.id, label: `${g.emoji} ${g.name}` })}>Ver y editar movimientos <ChevronRight size={14} /></Btn></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <GroupModal group={editing === "new" ? null : editing} movsAll={movsAll} onClose={() => setEditing(null)} onSave={save} onDelete={() => { setGroups((gs) => gs.filter((g) => g.id !== editing.id)); setEditing(null); }} />}
    </div>
  );
}

/* ============================================================
   PESTAÑA CLASIFICACIÓN — ver y completar cómo quedó todo
   ============================================================ */
function ClasificacionTab({ movs, assets, groups, onRecat, onReasset, onReassetAll, onToggleGroup, onCreateGroup, onCreateAsset, onNote, onNoteAll, onToggleExtra, onDelete, onSetAmount, outliers, onOpenPending, onNewMov, onEditMov }) {
  const [filter, setFilter] = useState("todos"); // todos | pend | ok
  const [q, setQ] = useState("");
  const [signSel, setSignSel] = useState("todos"); // todos | in | out
  const [extraSel, setExtraSel] = useState("todos"); // todos | si | no
  const [amtMin, setAmtMin] = useState("");
  const [amtMax, setAmtMax] = useState("");
  const [shown, setShown] = useState(80);
  const [open, setOpen] = useState(null);      // patrón expandido
  const [noting, setNoting] = useState(null);  // id de movimiento cuyo apodo editas
  const [noteText, setNoteText] = useState("");
  const [gNoting, setGNoting] = useState(null); // patrón cuyo apodo (a todos) editas
  const [gNoteText, setGNoteText] = useState("");
  const [amtEdit, setAmtEdit] = useState(null); // id del movimiento cuyo importe editas
  const [amtText, setAmtText] = useState("");
  const [amtCur, setAmtCur] = useState("EUR");
  const [amtRate, setAmtRate] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const openAmt = (m) => { setAmtEdit(m.id); setAmtText(Math.abs(m.amount).toFixed(2)); setAmtCur("EUR"); setAmtRate(""); };
  const saveAmt = (m) => { const sign = m.amount < 0 ? -1 : 1; const v = parseFloat((amtText || "").replace(",", ".")) * sign; if (!isFinite(v) || v === 0) return; onSetAmount(m, v, amtCur !== "EUR" ? { currency: amtCur, origAmount: m.amount } : null); setAmtEdit(null); };

  // Un comercio (patrón) por fila: es la unidad en la que de verdad se clasifica.
  const rows = useMemo(() => {
    const map = new Map();
    for (const m of movs) {
      let g = map.get(m.pattern);
      if (!g) { g = { pattern: m.pattern, sample: m.concept, count: 0, total: 0, cats: new Set(), assets: new Set(), pend: 0, notes: 0, noteVals: new Set(), rep: m, hasIn: false, hasOut: false, hasExtra: false, absList: [] }; map.set(m.pattern, g); }
      g.count++; g.total += m.amount;
      if (m.amount > 0) g.hasIn = true; else if (m.amount < 0) g.hasOut = true;
      if (m.extra) g.hasExtra = true;
      g.absList.push(Math.abs(m.amount));
      g.cats.add(m.splits ? "· dividido" : (m.category || "Otros"));
      g.assets.add(m.assetName === undefined ? "·auto" : (m.assetName || ""));
      if (!m.confirmed) g.pend++;
      if (m.note) { g.notes++; g.noteVals.add(m.note); }
    }
    const arr = [...map.values()];
    for (const g of arr) { g.tags = groups.filter((gr) => movInGroup(g.rep, gr)).length; g.proc = isProcessorPattern(g.pattern); }
    return arr.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [movs, groups]);

  const totalPend = rows.reduce((s, g) => s + g.pend, 0);
  const filtered = useMemo(() => {
    const t = stripAccents(q.trim().toUpperCase());
    const min = parseFloat((amtMin || "").replace(",", ".")); const hasMin = isFinite(min);
    const max = parseFloat((amtMax || "").replace(",", ".")); const hasMax = isFinite(max);
    return rows.filter((g) => {
      if (filter === "pend" && g.pend === 0) return false;
      if (filter === "ok" && g.pend > 0) return false;
      if (t && !stripAccents((g.sample + " " + g.pattern).toUpperCase()).includes(t)) return false;
      if (signSel === "in" && !g.hasIn) return false;
      if (signSel === "out" && !g.hasOut) return false;
      // Los extraordinarios quedan fuera de todos los agregados, asi que sin un filtro
      // propio no habia forma de reencontrarlos para revisarlos o desmarcarlos.
      if (extraSel === "si" && !g.hasExtra) return false;
      if (extraSel === "no" && g.hasExtra) return false;
      // Importe: se queda el comercio que tenga ALGÚN movimiento en el rango (valor absoluto).
      if ((hasMin || hasMax) && !g.absList.some((a) => (!hasMin || a >= min) && (!hasMax || a <= max))) return false;
      return true;
    });
  }, [rows, filter, q, signSel, extraSel, amtMin, amtMax]);

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Cómo ha quedado clasificado cada comercio. Corrige la <strong>categoría</strong>, el <strong>activo</strong> o la <strong>etiqueta</strong> y se aplica a todos sus movimientos. <strong>Despliega un comercio</strong> para editarlos uno a uno: ahí puedes pulsar el importe para corregirlo o convertirlo desde otra divisa. Lo <span className="font-medium" style={{ color: C.warn }}>por revisar</span> es lo que aún no has confirmado.</p>
        <div className="flex flex-wrap items-center gap-2">
          {onNewMov && <Btn onClick={onNewMov}><Plus size={15} /> Nuevo movimiento</Btn>}
          {totalPend > 0 && <Btn kind="primary" onClick={onOpenPending}><ClipboardList size={15} /> Revisar {nfNum.format(totalPend)} pendientes</Btn>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: C.line }}>
          <Seg ariaLabel="Filtro de estado" value={filter} onChange={setFilter}
            options={[{ v: "todos", l: "Todos" }, { v: "pend", l: "Por revisar" }, { v: "ok", l: "Confirmados" }]} />
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border px-3 py-1.5" style={{ borderColor: C.lineStrong }}>
            <Search size={14} className="shrink-0 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio o concepto…" className="w-full bg-transparent text-sm focus:outline-none" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
          </div>
          <Seg ariaLabel="Ingresos o gastos" value={signSel} onChange={setSignSel}
            options={[{ v: "todos", l: "Todos" }, { v: "in", l: "Ingresos" }, { v: "out", l: "Gastos" }]} />
          <Seg ariaLabel="Extraordinarios" value={extraSel} onChange={setExtraSel}
            options={[{ v: "todos", l: "Todos" }, { v: "si", l: "⭐ Solo extra." }, { v: "no", l: "Sin extra." }]} />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Importe €</span>
            <input value={amtMin} onChange={(e) => setAmtMin(e.target.value)} inputMode="decimal" aria-label="Importe desde" placeholder="desde"
              className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-slate-300">–</span>
            <input value={amtMax} onChange={(e) => setAmtMax(e.target.value)} inputMode="decimal" aria-label="Importe hasta" placeholder="hasta"
              className="w-16 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ ...tnum, borderColor: C.line }} />
            {(amtMin || amtMax) && <button type="button" onClick={() => { setAmtMin(""); setAmtMax(""); }} aria-label="Limpiar importe" className="rounded p-0.5 text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: C.line }}>
          {filtered.slice(0, shown).map((g) => {
            const cat = g.cats.size === 1 ? [...g.cats][0] : "";
            const asset = g.assets.size === 1 ? [...g.assets][0] : "";
            const assetVal = asset === "·auto" ? "" : asset;
            const gNote = g.noteVals.size === 1 ? [...g.noteVals][0] : null; // apodo común
            const gMixed = g.noteVals.size > 1;                              // apodos distintos
            const isOpen = open === g.pattern;
            const mine = isOpen ? movs.filter((m) => m.pattern === g.pattern).sort((a, b) => b.date - a.date) : null;
            return (
              <div key={g.pattern} className="px-3 py-2.5" style={{ borderColor: C.line }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : g.pattern)} className="flex w-full items-baseline justify-between gap-3 text-left focus-visible:outline-none">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                      <span className="min-w-0 break-words text-sm font-medium" title={g.sample}>{g.sample}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[22px] text-xs text-slate-500" style={tnum}>
                      <span>{g.count} {g.count === 1 ? "mov." : "movs."} · {fmtE(g.total)}</span>
                      {g.pend > 0
                        ? <Pill color={C.warn} soft={C.warnSoft}>{g.pend === g.count ? "por revisar" : `${g.pend} por revisar`}</Pill>
                        : <span className="inline-flex items-center gap-0.5" style={{ color: C.income }}><Check size={11} /> confirmado</span>}
                      {g.tags > 0 && <span className="inline-flex items-center gap-0.5 text-slate-400"><Tag size={10} /> {g.tags}</span>}
                      {g.notes > 0 && <span className="inline-flex items-center gap-0.5 text-slate-400">🏷️ {g.notes}</span>}
                      {g.proc && <span className="text-slate-400">· pasarela (cargo a cargo)</span>}
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CatSelect value={cat === "· dividido" ? "" : cat} allowEmpty onChange={(v) => onRecat(g.rep, v, !g.proc)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-44" />
                  <AssetSelect value={assetVal} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReassetAll(g.rep, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-36" />
                  <GroupTags mov={g.rep} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                  {onNoteAll && (gNote
                    ? <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(gNote); }} className="inline-flex max-w-[140px] items-center rounded-lg px-2 py-1 text-xs font-medium" style={{ background: C.accentSoft, color: C.accent }} title="Editar apodo de todos"><span className="truncate">🏷️ {gNote}</span></button>
                    : gMixed
                      ? <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(""); }} className="rounded-lg border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }} title="Hay varios apodos; unifícalos">🏷️ varios</button>
                      : <button type="button" onClick={() => { setGNoting(g.pattern); setGNoteText(""); }} className="rounded-lg border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50" style={{ borderColor: C.line }}>+ apodo a todos</button>)}
                </div>
                {onNoteAll && gNoting === g.pattern && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={gNoteText} onChange={(e) => setGNoteText(e.target.value)} autoFocus maxLength={40}
                      placeholder={`Apodo para los ${g.count} movimientos de este comercio`}
                      onKeyDown={(e) => { if (e.key === "Enter") { onNoteAll(g.rep, gNoteText); setGNoting(null); } if (e.key === "Escape") setGNoting(null); }}
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                    <Btn size="sm" kind="primary" onClick={() => { onNoteAll(g.rep, gNoteText); setGNoting(null); }}>Aplicar a todos</Btn>
                    {(gNote || gMixed) && <button type="button" onClick={() => { onNoteAll(g.rep, ""); setGNoting(null); }} aria-label="Quitar apodo de todos" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>}
                  </div>
                )}
                {!isOpen && g.cats.size > 1 && <div className="mt-1 text-[11px] text-slate-400">Varias categorías en este comercio ({[...g.cats].filter((c) => c !== "· dividido").slice(0, 3).join(", ")}…). Ábrelo para revisarlas una a una; elegir arriba una las unifica.</div>}
                {isOpen && (
                  <div className="mt-2 space-y-1 rounded-lg border p-2" style={{ borderColor: C.line, background: C.surface }}>
                    <div className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{mine.length} movimientos · corrige o apoda uno a uno</div>
                    {mine.map((m) => (
                      <div key={m.id} className="rounded-md px-1.5 py-1.5 hover:bg-slate-50">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-500" style={tnum}>{fmtDate(m.date)}
                              {m.currency && <span className="ml-1.5 text-slate-400">· orig {Math.abs(m.origAmount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency}</span>}
                              {!m.confirmed && <span className="ml-1.5"><Pill color={C.warn} soft={C.warnSoft}>por revisar</Pill></span>}
                              {isRefund(m) && <span className="ml-1.5 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700" title="Devolución: resta del gasto de su categoría, no cuenta como ingreso">devolución</span>}
                              {m.extra && <span className="ml-1.5 rounded px-1 py-0.5 text-[10px]" style={{ background: C.accentSoft, color: C.accent }}>extraordinario</span>}
                              {outliers?.has?.(m.id) && <span className="ml-1.5"><Pill color={C.warn} soft={C.warnSoft}>atípico</Pill></span>}
                            </div>
                            {m.note && noting !== m.id && <button type="button" onClick={() => { setNoting(m.id); setNoteText(m.note); }} className="mt-0.5 inline-flex max-w-full items-center rounded px-1 py-0.5 text-[11px] font-medium" style={{ background: C.accentSoft, color: C.accent }}><span className="truncate">🏷️ {m.note}</span></button>}
                          </div>
                          {onSetAmount
                            ? <button type="button" onClick={() => (amtEdit === m.id ? setAmtEdit(null) : openAmt(m))} title="Pulsa para corregir el importe o convertir desde otra divisa" className="shrink-0 rounded px-1 underline decoration-dotted decoration-slate-300 underline-offset-4 hover:bg-slate-100 hover:decoration-slate-500"><Money v={m.amount} bold /></button>
                            : <Money v={m.amount} bold />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <CatSelect value={m.splits ? m.splits[0].cat : m.category} onChange={(v) => onRecat(m, v, false)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-40" />
                          {onReasset && <AssetSelect value={m.assetName === undefined ? (expandParts(m, assets)[0].asset ?? "") : m.assetName} assets={assets} onCreateAsset={onCreateAsset} onChange={(v) => onReasset(m, v)} className="min-w-0 flex-1 basis-[45%] sm:basis-auto sm:w-32" />}
                          <GroupTags mov={m} groups={groups} onToggle={onToggleGroup} onCreateGroup={onCreateGroup} />
                          {onNote && noting !== m.id && !m.note && <button type="button" onClick={() => { setNoting(m.id); setNoteText(""); }} className="text-[11px] text-slate-400 hover:text-blue-600">+ apodo</button>}
                          {onToggleExtra && <button type="button" onClick={() => onToggleExtra(m)} title={m.extra ? "Quitar de extraordinarios" : "Marcar como extraordinario"} className={`shrink-0 rounded-lg p-2 ${m.extra ? "text-white" : "text-slate-400 hover:bg-slate-100"}`} style={m.extra ? { background: C.accent } : undefined}><Star size={13} /></button>}
                          {onEditMov && <button type="button" onClick={() => onEditMov(m)} title="Editar fecha, importe o concepto" aria-label="Editar movimiento" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil size={13} /></button>}
                          {onDelete && (confirmDel === m.id
                            ? <span className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => { onDelete(m.id); setConfirmDel(null); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{ background: C.expense }}>Borrar</button>
                                <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>No</button>
                              </span>
                            : <button type="button" onClick={() => setConfirmDel(m.id)} title="Enviar a la papelera" aria-label="Enviar a la papelera" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>)}
                        </div>
                        {onNote && noting === m.id && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <input value={noteText} onChange={(e) => setNoteText(e.target.value)} autoFocus maxLength={40}
                              placeholder="Apodo o nota (p. ej. «Impuestos»)"
                              onKeyDown={(e) => { if (e.key === "Enter") { onNote(m, noteText); setNoting(null); } if (e.key === "Escape") setNoting(null); }}
                              className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                            <Btn size="sm" kind="primary" onClick={() => { onNote(m, noteText); setNoting(null); }}>Guardar</Btn>
                            {m.note && <button type="button" onClick={() => { onNote(m, ""); setNoting(null); }} aria-label="Quitar apodo" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><Trash2 size={13} /></button>}
                          </div>
                        )}
                        {onSetAmount && amtEdit === m.id && (
                          <div className="mt-1.5 space-y-1.5 rounded-lg border p-2" style={{ borderColor: C.line, background: C.bg }}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500">Importe</span>
                              <input value={amtText} onChange={(e) => setAmtText(e.target.value)} autoFocus inputMode="decimal"
                                onKeyDown={(e) => { if (e.key === "Enter") saveAmt(m); if (e.key === "Escape") setAmtEdit(null); }}
                                className="w-24 rounded-lg border px-2 py-1 text-sm" style={{ borderColor: C.line }} />
                              <span className="text-xs text-slate-500">€ {m.amount < 0 ? "(gasto)" : "(ingreso)"}</span>
                              <Btn size="sm" kind="primary" onClick={() => saveAmt(m)}>Guardar</Btn>
                              <button type="button" onClick={() => setAmtEdit(null)} className="rounded-lg border px-2 py-1 text-xs text-slate-500" style={{ borderColor: C.line }}>Cancelar</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                              <span>o convierte desde</span>
                              <select value={amtCur} onChange={(e) => { setAmtCur(e.target.value); if (e.target.value === "EUR") setAmtText(Math.abs(m.amount).toFixed(2)); }} className="rounded-lg border bg-white px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }}>
                                {IMPORT_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {amtCur !== "EUR" && <>
                                <span style={tnum}>1 {amtCur} =</span>
                                <input value={amtRate} onChange={(e) => { setAmtRate(e.target.value); const r = parseFloat((e.target.value || "").replace(",", ".")); if (isFinite(r) && r > 0) setAmtText((Math.abs(m.amount) * r).toFixed(2)); }} inputMode="decimal" placeholder="0,086" className="w-16 rounded-lg border px-1.5 py-0.5 text-xs" style={{ borderColor: C.line }} />
                                <span>€ · orig {Math.abs(m.amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </>}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nada coincide con este filtro.</p>}
        </div>
        {filtered.length > shown && <div className="border-t p-3 text-center" style={{ borderColor: C.line }}><Btn onClick={() => setShown(shown + 100)}>Mostrar más ({nfNum.format(filtered.length - shown)})</Btn></div>}
      </Card>
    </div>
  );
}

/* ============================================================
   PESTAÑA INTELIGENCIA — hallazgos locales, sin llamadas externas
   ============================================================ */
// Días sin cargo tras los que un recurrente se marca "posible baja". Para lo mensual, ~3
// meses (la regla del usuario: si llevas 3 meses sin cobro, quizá diste de baja el servicio).
const STALE_GAP = { semanal: 30, mensual: 92, bimestral: 140, trimestral: 200, semestral: 380, anual: 730 };

// Tesela de resumen (una cifra grande + contexto), para el vistazo de la pestaña Ideas.
function IdeaStat({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: C.line }}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ ...tnum, color: color || C.ink }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
// Fila compacta de una línea (nombre + meta a la izquierda, cifra a la derecha), clicable.
function IdeaRow({ onClick, title, meta, figure, figureColor, warn }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${onClick ? "hover:bg-slate-50" : "cursor-default"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}>
      {warn && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.warn }} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{title}</span>
        {meta && <span className="block truncate text-xs text-slate-400">{meta}</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold" style={{ ...tnum, color: figureColor || C.ink }}>{figure}</span>
      {onClick && <ChevronRight size={13} className="mt-0.5 shrink-0 text-slate-300" />}
    </button>
  );
}

function InteligenciaTab({ movs, agg, allAgg, recurring, receiptTrends, outlierMovs, reducible, onDrill }) {
  const lastData = useMemo(() => (movs.length ? movs.reduce((a, m) => (m.date > a ? m.date : a), movs[0].date) : new Date()), [movs]);
  const af = allAgg.annualFactor || 1;

  // 1) Recibos y suscripciones que suben (interanual o mes a mes) con impacto material
  const subiendo = receiptTrends.filter((t) => t.annualImpact > 15 && (t.deltaYoY ?? t.deltaMoM ?? 0) > 0.05).slice(0, 6);

  // 2) Recurrentes. Hipoteca, préstamos, alquiler y comunidad NO son suscripciones:
  // van a su propio bloque. El resto (streaming, cuotas, recibos) sí.
  const LOAN_RE = /HIPOTEC|PRESTAMO|^PREST|^PRES\b/;
  const isLoanHousing = (r) => r.category === "Vivienda" || LOAN_RE.test(r.pattern);
  const recAll = recurring.map((r) => ({ ...r, stale: (lastData - r.lastDate) / 86400000 > (STALE_GAP[r.cadence] || 400) }));
  const subs = recAll.filter((r) => !isLoanHousing(r));
  const prestamos = recAll.filter((r) => isLoanHousing(r)).sort((a, b) => b.annual - a.annual);
  const subsAnnual = subs.reduce((s, r) => s + r.annual, 0);
  const prestamosAnnual = prestamos.reduce((s, r) => s + r.annual, 0);
  const posiblesBajas = subs.filter((r) => r.stale).slice(0, 6);

  // 3) Gasto hormiga: cargos pequeños que, sumados, pesan
  const hormiga = movs.filter((m) => m.amount < 0 && !m.extra && -m.amount <= 12);
  const hormigaTot = hormiga.reduce((s, m) => s - m.amount, 0);

  // 4) Gasto atípico reciente (fuera de tu media en su categoría)
  const atipicos = [...outlierMovs].sort((a, b) => b.date - a.date).slice(0, 5);

  // 5) Idea de ahorro: recorte sobre lo que tú marcas como reducible
  let reducibleTot = 0;
  for (const [cat, v] of agg.byCat) if (reducible.has(cat)) reducibleTot += v;
  const ahorroIdea = reducibleTot * 0.2 * af;

  // 6) Ahorro e inversión: lo aportado en el periodo (traspasos entre cuentas, fondos…)
  const inversion = [...(agg.byInternoCat || new Map()).entries()].sort((a, b) => b[1] - a[1]);
  const inversionTot = agg.interno || 0;
  const subiendoImpact = subiendo.reduce((s, t) => s + t.annualImpact, 0);
  const subsSorted = [...subs].sort((a, b) => Number(b.stale) - Number(a.stale) || b.annual - a.annual);

  const nada = !subiendo.length && !subs.length && !prestamos.length && !atipicos.length && reducibleTot <= 0 && inversionTot <= 0;

  const Sec = ({ icon, title, total, totalColor, children, extra }) => (
    <Card className="p-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">{icon} {title}</h2>
        {total != null && <span className="text-sm font-semibold" style={{ ...tnum, color: totalColor || C.ink }}>{total}</span>}
      </div>
      <div className="-mx-2">{children}</div>
      {extra}
    </Card>
  );

  return (
    <div className="space-y-4 anim-rise">
      <p className="text-sm text-slate-500">Detección automática sobre tus datos, en tu navegador. Sin coste. Para preguntas en lenguaje natural, usa el <span className="font-medium">Asistente</span>.</p>

      {nada ? (
        <Card className="p-10 text-center"><Sparkles size={26} className="mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-500">Aún no hay suficientes datos para sacar conclusiones. Importa más meses y vuelve.</p></Card>
      ) : (
        <>
          {/* Vistazo: cuatro cifras que resumen la pestaña */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <IdeaStat label="Suscripciones" value={`${fmtE0(subsAnnual)}/año`} color={C.expense}
              sub={posiblesBajas.length ? `${posiblesBajas.length} posible${posiblesBajas.length > 1 ? "s" : ""} baja${posiblesBajas.length > 1 ? "s" : ""}` : `${subs.length} activas`} />
            <IdeaStat label="Recibos subiendo" value={subiendo.length ? `+${fmtE0(subiendoImpact)}/año` : "—"} color={subiendo.length ? C.warn : C.faint}
              sub={subiendo.length ? `${subiendo.length} recibo${subiendo.length > 1 ? "s" : ""}` : "ninguno"} />
            <IdeaStat label="Gasto hormiga" value={fmtE0(hormigaTot)} sub={`${nfNum.format(hormiga.length)} cargos ≤ 12 €`} />
            <IdeaStat label="Ahorro potencial" value={`${fmtE0(ahorroIdea)}/año`} color={C.income} sub="recortando 20 % reducible" />
          </div>

          {/* Detalle en dos columnas, filas de una línea */}
          <div className="grid gap-4 lg:grid-cols-2">
            {subiendo.length > 0 && (
              <Sec icon={<TrendingUp size={15} style={{ color: C.warn }} />} title="Recibos subiendo" total={`+${fmtE0(subiendoImpact)}/año`} totalColor={C.warn}>
                {subiendo.map((t) => (
                  <IdeaRow key={t.pattern} warn title={t.label.slice(0, 34)} meta={`${fmtPct(t.deltaYoY ?? t.deltaMoM ?? 0)} · ${fmtE0(t.last)}/mes`}
                    figure={`+${fmtE0(t.annualImpact)}`} figureColor={C.warn} onClick={() => onDrill({ type: "pattern", key: t.pattern, label: t.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {subs.length > 0 && (
              <Sec icon={<RefreshCw size={15} style={{ color: C.accent }} />} title="Suscripciones" total={`${fmtE0(subsAnnual)}/año`} totalColor={C.expense}
                extra={subsSorted.length > 5 && <div className="px-2 pt-1 text-[11px] text-slate-400">y {subsSorted.length - 5} más</div>}>
                {subsSorted.slice(0, 5).map((r) => (
                  <IdeaRow key={r.pattern} warn={r.stale} title={r.label.slice(0, 34)} meta={r.stale ? `posible baja · sin cargos desde ${fmtDate(r.lastDate)}` : `${r.cadence} · ${fmtE0(r.avgAmount)}`}
                    figure={`${fmtE0(r.annual)}/año`} figureColor={r.stale ? C.warn : C.ink} onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {prestamos.length > 0 && (
              <Sec icon={<Wallet size={15} style={{ color: C.expense }} />} title="Préstamos y vivienda" total={`${fmtE0(prestamosAnnual)}/año`} totalColor={C.expense}>
                {prestamos.slice(0, 5).map((r) => (
                  <IdeaRow key={r.pattern} title={r.label.slice(0, 34)} meta={`${r.cadence} · ${fmtE0(r.avgAmount)}`}
                    figure={`${fmtE0(r.annual)}/año`} onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label.slice(0, 42) })} />
                ))}
              </Sec>
            )}
            {atipicos.length > 0 && (
              <Sec icon={<AlertTriangle size={15} style={{ color: C.warn }} />} title="Gastos fuera de lo normal">
                {atipicos.map((m) => (
                  <IdeaRow key={m.id} warn title={m.concept.slice(0, 34)} meta={`${fmtDate(m.date)} · ${m.category || "Otros"}`}
                    figure={fmtE0(-m.amount)} figureColor={C.expense} onClick={() => onDrill({ type: "ids", ids: [m.id], label: m.concept.slice(0, 42) })} />
                ))}
              </Sec>
            )}
          </div>

          {(reducibleTot > 0 || inversionTot > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {reducibleTot > 0 && (
                <Card className="p-4">
                  <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> Idea de ahorro</h2>
                  <p className="text-xs text-slate-500">Has gastado <span className="font-semibold">{fmtE0(reducibleTot)}</span> en categorías reducibles. Recortando un 20 % ahorrarías <span className="font-semibold" style={{ color: C.income }}>{fmtE0(ahorroIdea)}/año</span>. Ajusta qué es reducible en <span className="font-medium">Plan</span>.</p>
                </Card>
              )}
              {inversionTot > 0 && (
                <Card className="p-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold"><PiggyBank size={15} style={{ color: C.income }} /> Ahorro e inversión</h2>
                    <span className="text-sm font-semibold" style={{ ...tnum, color: C.income }}>{fmtE0(inversionTot)}</span>
                  </div>
                  <div className="space-y-1">
                    {inversion.map(([cat, v]) => (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-slate-600">{cat}</span>
                        <span className="shrink-0 text-slate-400" style={tnum}>{Math.round((v / inversionTot) * 100)} %</span>
                        <span className="w-16 shrink-0 text-right text-slate-600" style={tnum}>{fmtE0(v)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   PESTAÑA AHORRO
   ============================================================ */
function AhorroTab({ agg, reducible, setReducible, recurring, onDrill }) {
  const [cut, setCut] = useState(20);
  const [showConfig, setShowConfig] = useState(false);
  const { ingresos, gasto, byCat } = agg;
  const ahorro = ingresos - gasto;
  const tasa = ingresos > 0 ? ahorro / ingresos : 0;
  let reducibleTotal = 0, esencialTotal = 0;
  for (const [cat, v] of byCat) (reducible.has(cat) ? (reducibleTotal += v) : (esencialTotal += v));
  const potencial = ahorro + (reducibleTotal * cut) / 100;
  const tasaPot = ingresos > 0 ? potencial / ingresos : 0;
  const pct = (v) => (ingresos > 0 ? Math.max(0, Math.min(100, (v / ingresos) * 100)) : 0);
  const recList = recurring.map((r) => ({ ...r, revisable: reducible.has(r.category) }));

  return (
    <div className="space-y-4 anim-rise">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Ingresos" value={fmtE0(ingresos)} color={C.income} icon={<ArrowUpRight size={15} />} />
        <KPI label="Gastos" value={fmtE0(gasto)} color={C.expense} icon={<ArrowDownRight size={15} />} />
        <KPI label="Ahorro real" value={fmtE0(ahorro)} color={ahorro >= 0 ? C.income : C.expense} icon={<PiggyBank size={15} />}
          sub={ingresos > 0 ? `Tasa de ahorro: ${fmtPct(tasa)}` : "Sin ingresos en el periodo"} />
        <KPI label="Gasto reducible" value={fmtE0(reducibleTotal)} icon={<Filter size={15} />} sub={`${[...reducible].length} categorías marcadas`} />
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">A dónde va cada euro</h2>
        <p className="mb-3 text-xs text-slate-400">Reparto de los ingresos del periodo.</p>
        {ingresos <= 0 ? (
          <p className="py-3 text-sm text-slate-500">No hay ingresos en el periodo seleccionado, así que no se puede repartir el euro. Amplía el periodo.</p>
        ) : (
          <>
            <div className="flex h-7 w-full overflow-hidden rounded-lg" role="img"
              aria-label={`Esencial ${Math.round(pct(esencialTotal))} %, reducible ${Math.round(pct(reducibleTotal))} %, ahorro ${Math.round(pct(Math.max(0, ahorro)))} %`}>
              <div style={{ width: `${pct(esencialTotal)}%`, background: C.ink2 }} title="Esencial" />
              <div style={{ width: `${pct(reducibleTotal)}%`, background: C.warn }} title="Reducible" />
              <div style={{ width: `${pct(Math.max(0, ahorro))}%`, background: C.income }} title="Ahorro" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={tnum}>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.ink2 }} />Esencial {fmtE0(esencialTotal)} ({fmtPct(esencialTotal / ingresos)})</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.warn }} />Reducible {fmtE0(reducibleTotal)} ({fmtPct(reducibleTotal / ingresos)})</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: C.income }} />Ahorro {fmtE0(Math.max(0, ahorro))} ({fmtPct(Math.max(0, tasa))})</span>
            </div>
            {ahorro < 0 && <p className="mt-2 text-xs" style={{ color: C.expense }}>En este periodo gastas más de lo que ingresas ({fmtE(ahorro)}).</p>}
          </>
        )}
        <div className="mt-3 border-t pt-3" style={{ borderColor: C.line }}>
          <button type="button" onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1 rounded text-xs font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {showConfig ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Elegir qué categorías son reducibles
          </button>
          {showConfig && (
            <div className="mt-2 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
              {CATEGORIES_GASTO.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="accent-blue-600" checked={reducible.has(c)}
                    onChange={(e) => { const s = new Set(reducible); e.target.checked ? s.add(c) : s.delete(c); setReducible(s); }} />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Ahorro potencial</h2>
        <p className="mb-3 text-xs text-slate-400">¿Y si recortas parte del gasto reducible de este periodo?</p>
        <div className="flex flex-wrap items-center gap-4">
          <input type="range" min={0} max={100} step={5} value={cut} onChange={(e) => setCut(+e.target.value)}
            aria-label="Porcentaje de recorte del gasto reducible" className="w-full max-w-xs accent-blue-600" />
          <span className="text-sm font-medium" style={tnum}>Recorte del {cut} %</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <div className="text-xs text-slate-500">Ahorrarías</div>
            <div className="text-xl font-semibold" style={{ ...tnum, color: C.income }}>{fmtE(potencial)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Nueva tasa de ahorro</div>
            <div className="text-xl font-semibold" style={tnum}>{ingresos > 0 ? fmtPct(tasaPot) : "–"}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400" style={tnum}>+{fmtE((reducibleTotal * cut) / 100)} respecto al ahorro actual.</p>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Partidas que comprometen el ahorro</h2>
        <p className="mb-2 text-xs text-slate-400">Gastos recurrentes detectados en todo tu histórico, anualizados y de mayor a menor. Los «revisables» pertenecen a categorías reducibles.</p>
        {recList.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No se han detectado cargos recurrentes todavía. Hacen falta al menos 2–3 repeticiones del mismo emisor.</p>
        ) : (
          <div>
            {recList.map((r) => (
              <button key={r.pattern} type="button" onClick={() => onDrill({ type: "pattern", key: r.pattern, label: r.label })}
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-1 py-2 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{ borderColor: C.line }}>
                <span className="min-w-0 flex-1 truncate text-sm">{r.label}</span>
                {r.revisable && <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: C.warnSoft, color: C.warn }}>revisable</span>}
                <span className="text-xs text-slate-400">{r.category} · {r.cadence} · {fmtE(r.avgAmount)}</span>
                <span className="w-24 text-right text-sm font-semibold" style={tnum}>{fmtE0(r.annual)}/año</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   PESTAÑA ASISTENTE
   ============================================================ */
/* Markdown ligero para respuestas del asistente (negrita, cursiva, código, listas, títulos) */
function mdInline(text, keyBase) {
  const out = [];
  let rest = String(text);
  let k = 0;
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={`${keyBase}-${k++}`} className="rounded bg-slate-100 px-1 text-[0.92em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}
function MDLite({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="space-y-1">
      {lines.map((ln, i) => {
        const t = ln.trim();
        if (!t) return <div key={i} className="h-1" />;
        const mList = t.match(/^([-•*]|\d+[.)])\s+(.*)$/);
        if (mList) return <div key={i} className="flex gap-1.5 pl-1"><span className="shrink-0 text-slate-400">•</span><span className="min-w-0 flex-1">{mdInline(mList[2], i)}</span></div>;
        const mHead = t.match(/^#{1,4}\s+(.*)$/);
        if (mHead) return <div key={i} className="font-semibold">{mdInline(mHead[1], i)}</div>;
        return <div key={i}>{mdInline(ln, i)}</div>;
      })}
    </div>
  );
}

function TraceSummary({ trace }) {
  const [open, setOpen] = useState(false);
  if (!trace?.length) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Search size={11} /> {trace.length} {trace.length === 1 ? "consulta en tu dispositivo" : "consultas en tu dispositivo"}
        <ChevronDown size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
          {trace.map((t, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-semibold text-slate-600">{t.name}</span>
              <span className="truncate font-mono text-[10px] text-slate-400" style={{ maxWidth: "16rem" }}>{t.argsTxt}</span>
              <span>→ {t.resumen}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProposalCard({ p, created, onCreate }) {
  const isReclass = p.kind === "reclass";
  return (
    <div className="mt-2 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {isReclass ? (
            <>
              <div className="text-sm font-semibold">Reclasificar {p.count} {p.count === 1 ? "movimiento" : "movimientos"} → <span style={{ color: C.accent }}>{p.categoria}</span></div>
              {p.fromCats?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.fromCats.map((f) => <span key={f.c} className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{f.c} ({f.n})</span>)}
                </div>
              )}
              {p.sample?.length > 0 && <div className="mt-1 truncate text-[11px] text-slate-400">p. ej. {p.sample.join(" · ")}</div>}
              {p.patrones?.length > 0 && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Se recordará como regla para {p.patrones.length === 1 ? <strong>{p.patrones[0]}</strong> : <>{p.patrones.length} comercios</>}, para que no vuelva a preguntártelo.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm font-semibold">{p.emoji} Etiqueta «{p.nombre}»</div>
              <div className="text-xs text-slate-500" style={tnum}>{p.count} movimientos · {fmtE0(p.gasto)} de gasto</div>
              {p.keywords.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.keywords.map((k) => <span key={k} className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{k}</span>)}
                </div>
              )}
            </>
          )}
        </div>
        {created
          ? <span className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium" style={{ color: C.income, background: C.incomeSoft }}><Check size={14} /> {isReclass ? "Aplicada" : "Creada"}</span>
          : <Btn kind="primary" onClick={onCreate}>{isReclass ? <><Check size={14} /> Aplicar</> : <><Plus size={14} /> Crear etiqueta</>}</Btn>}
      </div>
    </div>
  );
}

function AsistenteTab({ aiOn, setAiOn, hasData, ctx, ai, aiDetail, onCreateProposal, onApplyReclassify, onOpenSettings, msgs, setMsgs, conversations, activeId, onNewChat, onSelectChat, onDeleteChat }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdKeys, setCreatedKeys] = useState(() => new Set());
  const [convMenu, setConvMenu] = useState(false);
  const [convQuery, setConvQuery] = useState("");
  const endRef = useRef(null);
  const taRef = useRef(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";                                  // medir desde cero
    el.style.height = Math.min(el.scrollHeight, 220) + "px";   // y crecer hasta un tope
  }, [input]);
  const activeTitle = convTitle((conversations || []).find((c) => c.id === activeId) || { msgs });
  const sortedConvs = [...(conversations || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const cerca = d.scrollHeight - d.scrollTop - d.clientHeight < 140;
      atBottomRef.current = cerca;
      setShowJump(!cerca);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Scroll al final REAL de la pagina, no a un elemento: scrollIntoView aterrizaba a media
  // altura porque se ejecutaba antes de que el hilo terminara de maquetarse.
  const irAlFinal = useCallback((suave) => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave ? "smooth" : "auto" });
  }, []);
  useEffect(() => {
    // Abrir o cambiar de conversacion aterriza en el ultimo mensaje, y sin animacion: con el
    // hilo mas alto que la pantalla, arrancar arriba obliga a bajar a mano cada vez. Dos frames
    // de espera para medir la altura ya maquetada.
    atBottomRef.current = true;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => irAlFinal(false)));
    return () => cancelAnimationFrame(r);
  }, [activeId, irAlFinal]);
  useEffect(() => {
    if (!atBottomRef.current) return; // estas leyendo historial: no te muevo el suelo
    const r = requestAnimationFrame(() => irAlFinal(true));
    return () => cancelAnimationFrame(r);
  }, [msgs, busy, irAlFinal]);

  const suggestions = [
    "Revisa mis movimientos sin categorizar y propón cómo clasificarlos",
    "¿Qué recibos me han subido y cuánto suponen al año?",
    "Etiqueta como Pádel todo mi gasto en pádel",
    "¿En qué comercios gasté más el mes pasado?",
  ];

  const resumen = (name, out) => {
    if (out?.error) return "error: " + out.error;
    if (name === "consultar") return `${out.total?.movimientos ?? 0} movs${out.resultado ? ` · ${out.resultado.length} filas` : ""}`;
    if (name === "ver_movimientos") return `${out.mostrados}/${out.encontrados} movimientos`;
    if (name === "evolucion_recibo") return out.recibos ? `${out.recibos.length} recibos` : out.serie_mensual ? `${out.serie_mensual.length} meses` : "sin datos";
    if (name === "proponer_etiqueta") return out.coincidencias != null ? `${out.coincidencias} coincidencias` : "propuesta";
    if (name === "proponer_reclasificacion") return out.coincidencias != null ? `${out.coincidencias} a reclasificar` : "propuesta";
    return "ok";
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy || !aiOn) return;
    setInput("");
    const history = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs((ms) => [...ms, { role: "user", content: q }]);
    setBusy(true);
    const trace = [];
    const proposals = [];
    try {
      const system = buildAssistantSystem(ctx, aiDetail);
      const tools = buildAgentTools(aiDetail);
      const runTool = (n, a) => runAgentTool(ctx, n, a, { onProposal: (ui) => proposals.push(ui) });
      const onTrace = (n, a, out) => trace.push({ name: n, argsTxt: JSON.stringify(a), resumen: resumen(n, out) });
      const reply = await aiChatWithTools(ai, {
        system, tools, runTool, onTrace,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((ms) => [...ms, { role: "assistant", content: reply, trace, proposals }]);
    } catch (e) {
      const isNet = /failed to fetch|networkerror|load failed/i.test(e.message);
      const custom = ai && ai.provider !== "claude";
      const content = isNet && custom
        ? `No he podido conectar con ${aiProviderLabel(ai)}. Dentro de Claude.ai solo funciona el proveedor integrado; tu elección se aplicará en la versión instalada en tu iPhone. Si ya estás en tu web, revisa la URL del proveedor y tu conexión.`
        : "No he podido conectar con el asistente (" + e.message + "). Inténtalo de nuevo.";
      setMsgs((ms) => [...ms, { role: "assistant", content, error: true, trace, proposals: [] }]);
    } finally { setBusy(false); }
  };

  if (!hasData) return <Card className="p-10 text-center text-sm text-slate-500">Aún no hay movimientos. Conecta tu banco o importa un archivo para poder preguntar sobre tus datos.</Card>;

  const convsFiltradas = convQuery.trim()
    ? sortedConvs.filter((c) => stripAccents(convTitle(c).toLowerCase()).includes(stripAccents(convQuery.trim().toLowerCase())))
    : sortedConvs;

  return (
    <div className="mx-auto flex max-w-2xl flex-col anim-rise" style={{ minHeight: "60vh" }}>
      {/* Barra fija. Antes la cabecera scrolleaba con los mensajes y para cambiar de
          conversación había que subir hasta arriba del todo. */}
      <div className="chat-bar -mx-1 mb-3 flex items-center gap-1 border-b bg-white px-1 py-2" style={{ borderColor: C.line }}>
        <button type="button" onClick={() => setConvMenu(true)} aria-label="Conversaciones"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Menu size={17} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={activeTitle}>{activeTitle}</span>
        <button type="button" onClick={onNewChat} aria-label="Nueva conversación"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Plus size={17} />
        </button>
        <button type="button" onClick={onOpenSettings} aria-label="Ajustes del asistente"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Settings size={16} />
        </button>
      </div>

      {convMenu && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={() => setConvMenu(false)} />
          <div className="fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col border-r bg-white shadow-2xl anim-drawer" style={{ borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: C.line }}>
              <span className="text-sm font-semibold">Conversaciones</span>
              <button type="button" onClick={() => setConvMenu(false)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><X size={18} /></button>
            </div>
            <button type="button" onClick={() => { onNewChat(); setConvMenu(false); }}
              className="mx-2 mt-2 flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ background: C.accent }}>
              <Plus size={15} /> Nueva conversación
            </button>
            {/* Buscador: con muchas conversaciones, recorrer la lista a ojo no escala. */}
            {sortedConvs.length > 6 && (
              <div className="mx-2 mt-2 flex items-center gap-1.5 rounded-lg border px-2" style={{ borderColor: C.line }}>
                <Search size={13} className="shrink-0 text-slate-400" />
                <input value={convQuery} onChange={(e) => setConvQuery(e.target.value)} placeholder="Buscar conversación"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm focus:outline-none" />
                {convQuery && <button type="button" onClick={() => setConvQuery("")} aria-label="Limpiar" className="shrink-0 text-slate-400 hover:text-slate-600"><X size={13} /></button>}
              </div>
            )}
            <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
              {convsFiltradas.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Ninguna conversación coincide.</p>}
              {convsFiltradas.map((c) => (
                <div key={c.id} className={`mb-1 flex items-center gap-1 rounded-lg ${c.id === activeId ? "" : "hover:bg-slate-50"}`} style={c.id === activeId ? { background: C.accentSoft } : undefined}>
                  <button type="button" onClick={() => { onSelectChat(c.id); setConvMenu(false); }} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                    <span className="block truncate text-sm" style={c.id === activeId ? { color: C.accent, fontWeight: 600 } : { color: C.ink }}>{convTitle(c)}</span>
                    <span className="block text-[11px] text-slate-400">{c.msgs.length} mensajes{c.updatedAt ? " · " + new Date(c.updatedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : ""}</span>
                  </button>
                  <button type="button" onClick={() => onDeleteChat(c.id)} aria-label="Borrar conversación" className="mr-1 shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* El interruptor y la nota de privacidad ocupaban sitio fijo en cada scroll pese a ser
          cosa de una vez. El interruptor ya vive en Ajustes; aquí solo aparece si hace falta. */}
      {!aiOn && (
        <Card className="mb-3 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
            Activar el asistente
          </label>
          <p className="mt-1.5 text-xs text-slate-400">
            Tus datos se consultan <strong>en tu dispositivo</strong>: el proveedor solo ve tu pregunta y los resultados de cada consulta.
          </p>
        </Card>
      )}

      <div className="flex-1 space-y-4 pb-3">
        {msgs.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.accentSoft, color: C.accent }}><Bot size={26} /></div>
            <p className="mx-auto mt-3 max-w-sm text-sm text-slate-500">Pregunta con detalle: totales, evoluciones, recibos que suben, netos por activo… o pídeme etiquetar un tipo de gasto.</p>
            <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={!aiOn || busy}
                  className="rounded-xl border bg-white px-3.5 py-2.5 text-left text-[13px] leading-snug text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, mi) => {
          const user = m.role === "user";
          return (
            <div key={mi} className={`flex items-start gap-2 ${user ? "justify-end" : "justify-start"}`}>
              {!user && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: m.error ? "#FEE2E2" : C.accentSoft, color: m.error ? "#B91C1C" : C.accent }}>
                  <Bot size={15} />
                </div>
              )}
              <div className={`max-w-[84%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${user ? "rounded-2xl rounded-br-md text-white" : "rounded-2xl rounded-bl-md"}`}
                style={user ? { background: C.accent } : { background: C.surface, border: `1px solid ${m.error ? "#FECDD3" : C.line}` }}>
                {user ? <div className="whitespace-pre-wrap">{m.content}</div> : <MDLite text={m.content} />}
                {!user && <TraceSummary trace={m.trace} />}
                {!user && (m.proposals || []).map((p, pi) => {
                  const key = mi + "-" + pi;
                  return <ProposalCard key={key} p={p} created={createdKeys.has(key)}
                    onCreate={() => { (p.kind === "reclass" ? onApplyReclassify : onCreateProposal)(p); setCreatedKeys((s) => new Set(s).add(key)); }} />;
                })}
              </div>
            </div>
          );
        })}
        {busy && (
          <div className="flex items-end gap-2 justify-start">
            <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: C.accentSoft, color: C.accent }}><Bot size={15} /></div>
            <div className="rounded-2xl rounded-bl-md border px-3.5 py-3 shadow-sm" style={{ borderColor: C.line, background: C.surface }}>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
                </span>
                Consultando tus datos…
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-dock mt-3">
        {showJump && msgs.length > 0 && (
          <div className="pointer-events-none flex justify-center pb-2">
            <button type="button" onClick={() => irAlFinal(true)} aria-label="Ir al último mensaje"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border bg-white text-slate-500 shadow-md transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ borderColor: C.line }}>
              <ChevronDown size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm" style={{ borderColor: C.lineStrong }}>
          <textarea ref={taRef} value={input} rows={1} placeholder={aiOn ? "Pregunta a tus datos…" : "Activa el asistente para preguntar"} disabled={!aiOn || busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="min-h-[2.5rem] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm focus:outline-none disabled:opacity-50"
          />
          <button type="button" onClick={() => send()} disabled={!aiOn || busy || !input.trim()} aria-label="Enviar pregunta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ background: C.accent }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   APLICACIÓN PRINCIPAL
   ============================================================ */
/* ============================================================
   EVOLUCIÓN DEL SALDO
   ============================================================ */
function SaldoChart({ serie }) {
  const data = useMemo(() => {
    if (!serie || serie.length < 2) return null;
    const step = Math.max(1, Math.ceil(serie.length / 240));
    const ds = serie.filter((_, i) => i % step === 0 || i === serie.length - 1);
    return ds.map((p) => ({ ...p, label: fmtDateShort(new Date(p.d)) }));
  }, [serie]);
  if (!data) return null;
  const TT = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg" style={{ borderColor: C.line }}>
        <div className="font-medium">{fmtDate(new Date(p.d))}</div>
        <div className="mt-0.5 font-semibold" style={tnum}>{fmtE(p.saldo)}</div>
      </div>
    );
  };
  return (
    <div style={{ height: 190 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.navy2} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.navy2} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={C.line} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={{ stroke: C.line }} interval="preserveStartEnd" minTickGap={48} />
          <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => nfNum.format(v) + "€"} domain={["auto", "auto"]} />
          <Tooltip content={<TT />} cursor={{ stroke: C.lineStrong }} />
          <Area type="monotone" dataKey="saldo" stroke={C.navy2} strokeWidth={2} fill="url(#gradSaldo)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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

function HBar({ pct, color }) {
  return (
    <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </span>
  );
}

function HierarchyExplorer({ parts, assets, onDrill }) {
  const [kind, setKind] = useState("gastos");
  const [group, setGroup] = useState("tipo");
  const [open, setOpen] = useState(() => new Set());
  const { total, tree } = useMemo(() => buildHierarchy(parts, kind, group), [parts, kind, group]);
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const assetEmoji = (name) => assets.find((a) => a.name === name)?.emoji || "";
  const l1Sorted = [...tree.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxL1 = l1Sorted[0]?.[1].total || 1;
  // Nivel 1: el tono de la supra-categoría, para que la jerarquía se lea en el color
  // (macro arriba, su rampa de luminosidad debajo). Agrupando por activo no hay macro.
  const barColorOf = (l1) =>
    kind === "ingresos" ? C.income
    : group === "activo" ? C.navy2
    : macroColor(l1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Seg ariaLabel="Tipo de flujo" value={kind} onChange={(v) => { setKind(v); setOpen(new Set()); }}
          options={[{ v: "gastos", l: "Gastos" }, { v: "ingresos", l: "Ingresos" }]} />
        {kind === "gastos" && (
          <Seg ariaLabel="Agrupación" value={group} onChange={(v) => { setGroup(v); setOpen(new Set()); }}
            options={[{ v: "tipo", l: "Por categoría" }, { v: "activo", l: "Por activo" }]} />
        )}
      </div>
      {l1Sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Sin {kind} en este periodo.</p>
      ) : (
        <div className="space-y-0.5">
          {l1Sorted.map(([l1, n1]) => {
            const k1 = `1|${l1}`;
            const isOpen1 = open.has(k1);
            const l2Sorted = [...n1.children.entries()].sort((a, b) => b[1].total - a[1].total);
            return (
              <div key={l1}>
                <button type="button" onClick={() => toggle(k1)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <ChevronRight size={14} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen1 ? "rotate(90deg)" : "none" }} />
                  <span className="w-40 shrink-0 truncate text-sm font-medium sm:w-52">
                    {group === "activo" && kind === "gastos" ? `${assetEmoji(l1)} ${l1}`.trim() : kind === "gastos" ? `${MACRO_EMOJI[l1] || ""} ${l1}`.trim() : l1}
                  </span>
                  <span className="hidden flex-1 sm:block"><HBar pct={n1.total / maxL1} color={barColorOf(l1)} /></span>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold" style={tnum}>{fmtE0(n1.total)}</span>
                  <span className="w-11 shrink-0 text-right text-xs text-slate-400" style={tnum}>{total > 0 ? fmtPct(n1.total / total) : "–"}</span>
                </button>
                {isOpen1 && l2Sorted.map(([l2, n2]) => {
                  const k2 = `2|${l1}|${l2}`;
                  const isLeaf2 = kind === "ingresos";
                  const isOpen2 = open.has(k2);
                  const l3Sorted = [...n2.children.entries()].sort((a, b) => b[1].total - a[1].total);
                  return (
                    <div key={l2}>
                      <button type="button"
                        onClick={() => isLeaf2 ? onDrill({ type: "pattern", key: l2, label: n2.sample.slice(0, 42) }) : toggle(k2)}
                        className="flex w-full items-center gap-2 rounded-lg py-1.5 pl-8 pr-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {isLeaf2
                          ? <Search size={12} className="shrink-0 text-slate-300" />
                          : <ChevronRight size={13} className="shrink-0 text-slate-400 transition-transform" style={{ transform: isOpen2 ? "rotate(90deg)" : "none" }} />}
                        <span className="flex items-center gap-1.5 truncate text-sm text-slate-700" style={{ width: "11.5rem" }}>
                          {!isLeaf2 && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: catColor(l2) }} />}
                          <span className="truncate">{isLeaf2 ? n2.sample.slice(0, 40) : l2}</span>
                        </span>
                        <span className="hidden flex-1 sm:block"><HBar pct={n2.total / n1.total} color={isLeaf2 ? C.income : catColor(l2)} /></span>
                        <span className="w-20 shrink-0 text-right text-sm" style={tnum}>{fmtE0(n2.total)}</span>
                        <span className="w-11 shrink-0 text-right text-xs text-slate-400" style={tnum}>{fmtPct(n2.total / n1.total)}</span>
                      </button>
                      {isOpen2 && (
                        <>
                          {l3Sorted.slice(0, 12).map(([l3, n3]) => (
                            <button key={l3} type="button" onClick={() => onDrill({ type: "pattern", key: l3, label: n3.sample.slice(0, 42) })}
                              className="flex w-full items-center gap-2 rounded-lg py-1 pl-14 pr-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                              <Search size={11} className="shrink-0 text-slate-300" />
                              <span className="flex-1 truncate text-xs text-slate-600">{n3.sample.slice(0, 46)}</span>
                              <span className="shrink-0 text-xs text-slate-400" style={tnum}>×{n3.count}</span>
                              <span className="w-20 shrink-0 text-right text-xs font-medium" style={tnum}>{fmtE0(n3.total)}</span>
                            </button>
                          ))}
                          {l3Sorted.length > 12 && (
                            <button type="button" onClick={() => onDrill({ type: "cat", key: l2, label: l2 })}
                              className="w-full rounded-lg py-1 pl-14 pr-2 text-left text-xs text-blue-700 hover:bg-blue-50">
                              Ver los {l3Sorted.length - 12} comercios restantes en el detalle →
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PESTAÑA PRESUPUESTO
   ============================================================ */
function PresupuestoTab({ budgets, setBudgets, movs, monthsAvail, allAgg, onDrill }) {
  const lastMonth = monthsAvail[monthsAvail.length - 1] || null;
  const gastoMes = useMemo(() => {
    const map = new Map();
    if (!lastMonth) return map;
    for (const m of movs) {
      if (monthKey(m.date) !== lastMonth) continue;
      const parts = m.splits?.length
        ? m.splits.map((s) => ({ cat: s.cat, amount: (m.amount * s.pct) / 100 }))
        : [{ cat: m.category || "Otros", amount: m.amount }];
      for (const p of parts) { if (p.amount >= 0) continue; map.set(p.cat, (map.get(p.cat) || 0) - p.amount); }
    }
    return map;
  }, [movs, lastMonth]);
  const media = (cat) => (allAgg ? (allAgg.byCat.get(cat) || 0) / allAgg.mesesData : 0);
  const suggest = (cat) => Math.max(5, Math.ceil(media(cat) / 5) * 5);
  const entries = Object.entries(budgets).filter(([, v]) => v > 0);
  const budgetedCats = new Set(entries.map(([c]) => c));
  const totalBudget = entries.reduce((s, [, v]) => s + v, 0);
  const totalSpent = entries.reduce((s, [c]) => s + (gastoMes.get(c) || 0), 0);
  const overCount = entries.filter(([c, v]) => (gastoMes.get(c) || 0) > v).length;
  const globalPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const globalColor = globalPct > 1 ? C.expense : globalPct > 0.75 ? C.warn : C.teal;
  const candidates = CATEGORIES.filter((c) => !INGRESO_SET.has(c) && !budgetedCats.has(c))
    .sort((a, b) => media(b) - media(a));
  const suggestAll = () => {
    const b = { ...budgets };
    for (const c of CATEGORIES) {
      if (INGRESO_SET.has(c) || TRANSFER_SET.has(c) || c === "Otros") continue;
      const m = media(c);
      if (m >= 10) b[c] = suggest(c);
    }
    setBudgets(b);
  };
  const setB = (cat, v) => setBudgets((b) => { const n = { ...b }; if (v > 0) n[cat] = v; else delete n[cat]; return n; });

  return (
    <div className="space-y-4 anim-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-sm text-slate-500">Fija un límite mensual por categoría y controla cómo vas. El progreso se calcula sobre <strong>{lastMonth ? monthLabelLong(lastMonth) : "el último mes"}</strong> (tu último mes con datos).</p>
        <Btn kind="primary" onClick={suggestAll}><Sparkles size={14} /> Sugerir según mi histórico</Btn>
      </div>

      {entries.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 pb-4 pt-5" style={{ background: `linear-gradient(140deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
            <div className="flex flex-wrap items-end justify-between gap-3 text-white">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-white/60">Presupuesto de {lastMonth ? monthLabelLong(lastMonth) : "–"}</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight" style={tnum}>{fmtE0(totalSpent)}<span className="text-lg font-medium text-white/60"> / {fmtE0(totalBudget)}</span></div>
              </div>
              <div className="text-right text-sm" style={tnum}>
                {totalSpent <= totalBudget
                  ? <span className="font-medium" style={{ color: "#7BE0C8" }}>Te quedan {fmtE0(totalBudget - totalSpent)}</span>
                  : <span className="font-medium" style={{ color: "#FFB3B8" }}>Superado en {fmtE0(totalSpent - totalBudget)}</span>}
                <div className="mt-0.5 text-xs text-white/60">{overCount > 0 ? `${overCount} ${overCount === 1 ? "categoría superada" : "categorías superadas"}` : "Todo bajo control"}</div>
              </div>
            </div>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div style={{ width: `${Math.min(100, globalPct * 100)}%`, background: globalColor, transition: "width .4s" }} />
            </div>
          </div>
          <div>
            {entries.sort((a, b) => (gastoMes.get(b[0]) || 0) / b[1] - (gastoMes.get(a[0]) || 0) / a[1]).map(([cat, budget]) => {
              const spent = gastoMes.get(cat) || 0;
              const pct = spent / budget;
              const color = pct > 1 ? C.expense : pct > 0.75 ? C.warn : C.teal;
              return (
                <div key={cat} className="border-b px-4 py-3 last:border-0" style={{ borderColor: C.line }}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catColor(cat) }} />
                    <button type="button" onClick={() => onDrill({ type: "cat", key: cat, label: cat })} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{cat}</button>
                    <span className="text-sm" style={tnum}><span className="font-semibold" style={{ color }}>{fmtE0(spent)}</span><span className="text-slate-400"> / </span></span>
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <input type="number" min={0} step={5} value={budget} aria-label={`Presupuesto de ${cat}`}
                        onChange={(e) => setB(cat, Math.max(0, +e.target.value || 0))}
                        className="w-20 rounded-lg border px-2 py-1 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        style={{ ...tnum, borderColor: C.line }} /> €
                    </span>
                    <button type="button" onClick={() => setB(cat, 0)} aria-label={`Quitar presupuesto de ${cat}`} className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600"><X size={13} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div style={{ width: `${Math.min(100, pct * 100)}%`, background: color, transition: "width .4s" }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs" style={{ ...tnum, color: pct > 1 ? C.expense : C.muted }}>
                      {pct > 1 ? `+${fmtE0(spent - budget)} extra` : `${fmtPct(pct)} usado`}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400" style={tnum}>Tu media histórica: {fmtE0(media(cat))}/mes</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold">{entries.length ? "Añadir otra categoría" : "Empieza a presupuestar"}</h3>
        <p className="mt-0.5 text-xs text-slate-500">Elige una categoría: se propone tu media mensual redondeada, y luego la ajustas.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {candidates.slice(0, 12).map((c) => (
            <button key={c} type="button" onClick={() => setB(c, suggest(c))}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <span className="h-2 w-2 rounded-sm" style={{ background: catColor(c) }} />{c}
              {media(c) >= 1 && <span className="text-slate-400" style={tnum}>~{fmtE0(media(c))}</span>}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   EVOLUCIÓN DE RECIBOS (subidas y bajadas)
   ============================================================ */
function DeltaBadge({ d }) {
  if (d === null || d === undefined) return <span className="text-xs text-slate-300">–</span>;
  const up = d >= 0.03, down = d <= -0.03;
  const color = up ? C.expense : down ? C.income : C.muted;
  const soft = up ? C.expenseSoft : down ? C.incomeSoft : C.surfaceAlt;
  const I = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ ...tnum, color, background: soft }}>
      <I size={11} /> {d > 0 ? "+" : ""}{fmtPct(d)}
    </span>
  );
}

function UpcomingCard({ upcoming, onDrill }) {
  if (!upcoming || !upcoming.items.length) return null;
  const fmtDay = (d) => new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3" style={{ borderColor: C.line }}>
        <div>
          <h2 className="text-sm font-semibold">Próximos cargos estimados</h2>
          <p className="text-xs text-slate-400">En los {upcoming.horizonDays} días siguientes a tus últimos datos ({fmtDate(upcoming.base)})</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold" style={{ ...tnum, color: C.expense }}>{fmtE0(upcoming.total)}</div>
          <div className="text-[11px] text-slate-400">{upcoming.items.length} cargos previstos</div>
        </div>
      </div>
      {upcoming.items.map((it, i) => (
        <button key={it.pattern + i} type="button" onClick={() => onDrill({ type: "pattern", key: it.pattern, label: it.label.slice(0, 42) })}
          className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
          <span className="w-[74px] shrink-0 text-xs font-medium text-slate-500" style={tnum}>{fmtDay(it.date)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{it.label}</span>
            <span className="text-[11px] text-slate-400">{it.category} · {it.cadence}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold" style={tnum}>{it.variable ? "~" : ""}{fmtE0(it.amount)}</span>
        </button>
      ))}
      <p className="px-4 py-2 text-[11px] text-slate-400">Estimación según la fecha habitual y el último importe de cada recibo (media reciente en los variables, marcados con ~). No es información del banco.</p>
    </Card>
  );
}

function ReceiptTrendsCard({ trends, onDrill }) {
  const [shown, setShown] = useState(8);
  if (!trends.length) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Evolución de tus recibos</h2>
        <p className="mt-1 text-sm text-slate-500">Aún no hay recibos con historial suficiente (hacen falta al menos 3 meses del mismo recibo).</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-3" style={{ borderColor: C.line }}>
        <h2 className="text-sm font-semibold">Evolución de tus recibos</h2>
        <p className="text-xs text-slate-400">Último cargo comparado con el mes anterior (Δ mes) y con el mismo mes del año pasado (Δ año). El impacto anual estima cuánto suma o resta la variación en 12 meses.</p>
      </div>
      <div className="hidden gap-2 border-b px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:flex" style={{ borderColor: C.line }}>
        <span className="flex-1">Recibo</span><span className="w-[88px]">Tendencia</span><span className="w-16 text-right">Último</span><span className="w-16 text-center">Δ mes</span><span className="w-16 text-center">Δ año</span><span className="w-20 text-right">Impacto/año</span>
      </div>
      {trends.slice(0, shown).map((t) => (
        <button key={t.pattern} type="button" onClick={() => onDrill({ type: "pattern", key: t.pattern, label: t.label.slice(0, 42) })}
          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="block truncate text-sm">{t.label}</span>
              {t.kind === "variable" && <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">variable</span>}
            </span>
            <span className="text-[11px] text-slate-400">{t.category} · {t.months} meses</span>
          </span>
          <span className="w-[88px] shrink-0"><MiniSpark data={t.serie} color={t.annualImpact >= 0 ? C.expense : C.income} /></span>
          <span className="w-16 shrink-0 text-right text-sm font-semibold" style={tnum}>{fmtE0(t.last)}</span>
          <span className="w-16 shrink-0 text-center"><DeltaBadge d={t.deltaMoM} /></span>
          <span className="w-16 shrink-0 text-center"><DeltaBadge d={t.deltaYoY} /></span>
          <span className="w-20 shrink-0 text-right text-sm font-medium" style={{ ...tnum, color: t.annualImpact > 1 ? C.expense : t.annualImpact < -1 ? C.income : C.muted }}>
            {t.annualImpact > 0 ? "+" : ""}{fmtE0(t.annualImpact)}
          </span>
        </button>
      ))}
      {trends.length > shown && <div className="p-3 text-center"><Btn onClick={() => setShown(shown + 12)}>Mostrar más ({trends.length - shown})</Btn></div>}
    </Card>
  );
}

/* ============================================================
   AJUSTES (datos, copia de seguridad, borrado)
   ============================================================ */
// Grupo plegable de Ajustes. Enseña su estado en la cabecera (un punto de color y una frase)
// para que quien llega nuevo vea de un vistazo qué tiene configurado y qué le falta, sin
// abrirlos uno a uno. Solo el primero viene abierto.
function Grupo({ titulo, estado, ok, abierto = false, forzar = false, children }) {
  const [open, setOpen] = useState(abierto);
  // `forzar` permite abrirlo desde Primeros pasos: sin esto, pulsar «Configurar» no haría
  // nada visible porque el grupo guarda su propio estado.
  useEffect(() => { if (forzar) setOpen(true); }, [forzar]);
  return (
    <section className="rounded-xl border" style={{ borderColor: C.line, background: C.surface }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <ChevronRight size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
          {estado && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              {ok !== undefined && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ok ? "#4ade80" : C.lineStrong }} />}
              <span className="truncate">{estado}</span>
            </span>
          )}
        </span>
      </button>
      {open && <div className="space-y-5 border-t px-3 pb-4 pt-4" style={{ borderColor: C.line }}>{children}</div>}
    </section>
  );
}

function SettingsModal({ onClose, storeKind, saveState, theme, setTheme, upcoming, movsCount, aiOn, setAiOn, ai, setAi, aiDetail, setAiDetail, aiProfiles, onSaveAiProfile, onActivateAiProfile, onDeleteAiProfile, materialidad, setMaterialidad, onExport, onImportFile, onWipe, snapCount, snapTooBig, onListSnaps, onRestoreSnap, imports, onDeleteImport, trashed, onRestoreTrash, onPurgeTrash, onRulesAudit, onToggleRule, onRemoveRule, onUpdateRuleCat, onFindDupes, onTrashDupes, assetMem, onForgetAssetMem, onForgetAllAssetMem, onDrillIds, onAsistente, sync, bank }) {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // archivo pendiente de confirmar borrado
  const [trashOpen, setTrashOpen] = useState(false);
  const upcomingItems = upcoming?.items || [];
  const downloadICS = () => {
    const blob = new Blob([buildICS(upcomingItems)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cargos-previstos.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  const [importMsg, setImportMsg] = useState(null);
  const [snaps, setSnaps] = useState(null);
  const [snapsOpen, setSnapsOpen] = useState(false);
  const [dupes, setDupes] = useState(null); // null = sin buscar; [] = buscado y limpio
  const [abrir, setAbrir] = useState(null);  // grupo al que saltar desde Primeros pasos
  const fileRef = useRef(null);
  const custom = ai.provider !== "claude";
  const setAiField = (k, v) => setAi((c) => ({ ...c, [k]: v }));
  const applyPreset = (p) => setAi((c) => ({ ...c, provider: "openai_compat", baseUrl: p.baseUrl, model: p.model }));
  const openSnaps = async () => { setSnapsOpen(true); setSnaps(await onListSnaps()); };
  const [rulesOpen, setRulesOpen] = useState(false);
  const [audit, setAudit] = useState(null);
  const [profLabel, setProfLabel] = useState("");
  // Un perfil está "activo" si coincide con la config de IA actual (ignora la clave).
  const profileActive = (p) => p.provider === ai.provider && (p.baseUrl || "") === (ai.baseUrl || "") && (p.model || "") === (ai.model || "");
  const openRules = () => { setRulesOpen(true); setAudit(onRulesAudit()); };
  const toggle = (id, active) => { onToggleRule(id, active); setAudit((a) => a.map((x) => (x.id === id ? { ...x, active } : x))); };
  const remove = (id) => { onRemoveRule(id); setAudit((a) => a.filter((x) => x.id !== id)); };
  const changeCat = (id, cat) => { onUpdateRuleCat?.(id, cat); setAudit((a) => a.map((x) => (x.id === id ? { ...x, cat, conflict: false, conflictCat: null } : x))); };
  return (
    <Modal title="Ajustes y datos" onClose={onClose}>
      <div className="space-y-5">
        {/* Ajustes es también donde se orienta quien llega nuevo: cada grupo enseña su
            estado, de modo que de un vistazo se ve qué falta por configurar. Lo que se usa
            una vez al año deja de ocupar lo mismo que lo que se mira cada semana. */}
        {/* Lo primero que ve quien abre Ajustes por primera vez: dónde está y qué puede ganar.
            Se cierra solo cuando ya no queda nada por configurar, para no estorbar después. */}
        <Grupo titulo="Primeros pasos" abierto={!(movsCount && sync?.version && bank?.connections?.length)}
          estado={`${[movsCount > 0, !!sync?.version, !!(bank && bank.connections.length), aiOn].filter(Boolean).length} de 4 completados`}>
          <PrimerosPasos
            tieneDatos={movsCount > 0} tieneSync={!!sync?.version}
            tieneBanco={!!(bank && bank.connections.length)} tieneIA={!!aiOn}
            onIr={(destino) => {
              // El asistente verifica cada paso contra tu propio backend; la guía solo explica.
              if (destino === "guia") { onClose(); onAsistente(); return; }
              if (destino === "cerrar") { onClose(); return; }
              setAbrir(destino); // despliega el grupo correspondiente
            }} />
        </Grupo>

        <Grupo titulo="Tus datos y sincronización" abierto={abrir === "sync"} forzar={abrir === "sync"}
          estado={sync?.version ? `sincronizado · versión ${sync.version}` : "sin sincronizar"}
          ok={!!sync?.version}>
        <section>
          <h3 className="text-sm font-semibold">Tus datos</h3>
          {/* Saber qué build está sirviendo el navegador: sin esto, ante un fallo no se distingue
              "el arreglo no funciona" de "no se ha subido / está cacheado", y se gastan despliegues. */}
          <p className="mt-1 text-[11px] text-slate-400" style={tnum}>
            Versión {BUILD_STAMP}
            <span className="block">Origen: {typeof window !== "undefined" ? window.location.host : "?"}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {nfNum.format(movsCount)} movimientos guardados en <strong>{storeKind}</strong>, solo accesibles para ti.
            {" "}Estado: {saveState === "saving" ? "guardando…" : saveState === "error" ? "no se pudo guardar el último cambio" : "todo guardado"}.
          </p>
        </section>
        {sync && (
        <section>
          <h3 className="text-sm font-semibold">Sincronizar con tu backend</h3>
          <p className="mt-1 text-xs text-slate-500">
            Guarda tus datos en tu propio Worker, usando la URL y el token de arriba. No necesita Google ni volver a autorizar nada: una vez puesto, funciona siempre. Funciona en todos tus dispositivos.
          </p>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Btn kind="primary" onClick={() => sync.onPush()} disabled={sync.busy}><Upload size={14} /> Guardar</Btn>
              <Btn onClick={() => sync.onPull()} disabled={sync.busy}><Download size={14} /> Traer</Btn>
            </div>
            {sync.busy && <p className="text-xs text-slate-400">Hablando con tu Worker…</p>}
            {sync.msg && <p className={`text-xs ${sync.msg.kind === "ok" ? "text-emerald-700" : sync.msg.kind === "err" ? "text-rose-700" : "text-slate-500"}`}>{sync.msg.text}</p>}

            {/* El servidor rechaza una escritura basada en una versión vieja, así que aquí no se
                pierde nada: solo hay que decidir. Nada se sobrescribe sin tu permiso. */}
            {sync.conflict && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                <p className="text-[11px] font-medium leading-relaxed text-amber-800">
                  El servidor tiene la versión {sync.conflict.version}, más nueva que la de este dispositivo. No se ha sobrescrito nada. Elige:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn size="sm" onClick={() => sync.onPull({ confirmReplace: true })} disabled={sync.busy}><Download size={13} /> Traer la del servidor</Btn>
                  <Btn size="sm" kind="primary" onClick={() => sync.onPush({ force: true })} disabled={sync.busy}><Upload size={13} /> Subir la de aquí</Btn>
                </div>
                <p className="mt-1.5 text-[10px] text-amber-700">«Traer» descarta tus cambios locales; «Subir» pisa la del servidor. El historial del servidor guarda las 10 últimas versiones, así que ninguna de las dos es irreversible.</p>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
              <input type="checkbox" className="accent-blue-600" checked={!!sync.auto} onChange={(e) => sync.onToggleAuto(e.target.checked)} disabled={sync.busy} />
              Sincronizar automáticamente (trae al abrir, guarda al cambiar)
            </label>            <p className="text-[11px] leading-relaxed text-slate-400">
              El guardado automático espera 25 segundos tras el último cambio y también al cerrar la pestaña, para no generar escrituras de más. Lo local se guarda al instante, como siempre.
              {sync.version ? ` Versión en el servidor según este dispositivo: ${sync.version}.` : ""}
            </p>
          </div>
        </section>
        )}
        </Grupo>

        <Grupo titulo="Banco" abierto={abrir === "banco"} forzar={abrir === "banco"}
          estado={bank && bank.connections.length ? `${bank.connections.length} ${bank.connections.length === 1 ? "banco conectado" : "bancos conectados"}` : "sin conectar"}
          ok={!!(bank && bank.connections.length)}>
        {bank && (
        <section>
          <h3 className="text-sm font-semibold">Conexión bancaria (Enable Banking)</h3>
          <p className="mt-1 text-xs text-slate-500">Conecta tus bancos y baja los movimientos automáticamente, sin CSV. Puedes conectar varios.</p>
          <div className="mt-2 space-y-2">
            <label className="block text-xs text-slate-600">URL del backend (tu Worker)
              <input value={bank.workerUrl} onChange={(e) => bank.onChange({ workerUrl: e.target.value })} placeholder="https://…workers.dev" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }} />
            </label>
            <label className="block text-xs text-slate-600">Token del backend <span className="font-normal text-slate-400">(tu PROXY_TOKEN de Cloudflare)</span>
              <input type="password" value={bank.token} onChange={(e) => bank.onChange({ token: e.target.value })} placeholder="tu token" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
            </label>

            {/* Bancos conectados */}
            {bank.connections.length > 0 && (
              <div className="space-y-2">
                {bank.connections.map((c) => {
                  const accs = bank.accountsByConn[c.id] || [];
                  return (
                    <div key={c.id} className="rounded-xl border p-2.5" style={{ borderColor: C.line, background: C.surface }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">{c.aspsp}<span className="ml-1 text-[11px] font-normal text-slate-400">{c.country}</span></span>
                        <button type="button" onClick={() => bank.onRemove(c.id)} aria-label="Quitar banco" className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* La opción vacía significa «todas» y antes mostraba el nombre de la cuenta
                            guardada, así que elegirla parecía seleccionarla cuando hacía lo contrario.
                            Y la cuenta guardada no salía hasta pulsar «Ver cuentas»: se añade a mano. */}
                        <select value={c.accountUid || ""} onChange={(e) => { const a = accs.find((x) => x.uid === e.target.value); bank.onPickAccount(c.id, e.target.value, a ? (a.name || a.iban || "") : (e.target.value ? c.accountName : ""), a ? (a.iban || "") : (e.target.value ? c.accountIban : "")); }}
                          className="min-w-0 flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                          <option value="">Todas las cuentas</option>
                          {c.accountUid && !accs.some((a) => a.uid === c.accountUid) && (
                            <option value={c.accountUid}>{c.accountName || c.accountUid.slice(0, 8)} (guardada)</option>
                          )}
                          {accs.map((a) => (
                            <option key={a.uid} value={a.uid}>
                              {a.name || a.uid.slice(0, 8)}{a.iban ? ` · ${a.iban.slice(-6)}` : ""}{typeof a.balance === "number" ? ` · ${nfEUR.format(a.balance)}` : ""}{a.type ? ` (${a.type})` : ""}
                            </option>
                          ))}
                        </select>
                        <Btn size="sm" onClick={() => bank.onLoadAccounts(c.id)} disabled={bank.busy}>Ver cuentas</Btn>
                        <Btn size="sm" kind="primary" onClick={() => bank.onSyncOne(c.id)} disabled={bank.busy}><RefreshCw size={13} /> Sincronizar</Btn>
                        <Btn size="sm" onClick={() => bank.onReconnect(c.id)} disabled={bank.busy}>Reconectar</Btn>
                      </div>
                      {/* Titular por conexión: si no coincide con el del banco, el consentimiento
                          se firma pero luego toda petición de datos falla con ASPSP_ERROR. */}
                      <label className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        Titular:
                        <select value={c.psu || "personal"} onChange={(e) => bank.onSetPsu(c.id, e.target.value)}
                          className="rounded-md border bg-white px-1.5 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                          <option value="personal">Personal</option>
                          <option value="business">Empresa / autónomo</option>
                        </select>
                        <span className="text-slate-400">sesión activa: {c.sessionPsu ? (c.sessionPsu === "business" ? "empresa" : "personal") : "desconocida"}</span>
                      </label>
                      {/* Este desplegable NO reautoriza: solo decide qué se pedirá la próxima vez.
                          Sin este aviso parece que el cambio se aplica ya, y se prueba dos veces
                          la misma sesión creyendo estar probando dos configuraciones. */}
                      {(c.psu || "personal") !== (c.sessionPsu || "personal") && (
                        <p className="mt-1 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                          Cambiar el titular no reautoriza nada: la sesión de ahora se creó como <strong>{c.sessionPsu ? (c.sessionPsu === "business" ? "empresa" : "personal") : "desconocida"}</strong> y sigue igual. Pulsa <strong>Reconectar</strong> para que el cambio surta efecto.
                        </p>
                      )}
                      {/* El permiso caducado era invisible: el auto-sync se tragaba el error y solo
                          quedaba una fecha de «última» antigua que nadie mira. Ahora se canta. */}
                      {c.lastError && (
                        <p className="mt-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                          {c.expired ? "El permiso de este banco ha caducado: pulsa Reconectar para renovarlo." : "La última sincronización falló."}
                          <span className="block font-normal opacity-80">{c.lastError}{c.lastErrorAt ? ` · ${new Date(c.lastErrorAt).toLocaleString("es-ES")}` : ""}</span>
                        </p>
                      )}
                      {/* Solo se ofrece con las cuentas de la sesión actual cargadas («Ver cuentas»):
                          sin esa lista no hay forma de saber qué uid es de qué cuenta, y la versión
                          anterior daba por ajeno todo uid antiguo de la propia cuenta buena.
                          Y nunca se borra a ciegas: primero se ven los movimientos. */}
                      {(() => {
                        const otros = c.accountUid ? (bank.otherAccountIds?.(c.aspsp, c.accountUid, accs.map((a) => a.uid)) || []) : [];
                        if (!otros.length) return null;
                        return (
                          <div className="mt-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                            Hay {nfNum.format(otros.length)} movimientos que pertenecen a <strong>otra cuenta de la sesión actual</strong>, no a {c.accountName || "la que sigues"}.
                            <span className="mt-1 flex flex-wrap gap-2">
                              <button type="button" onClick={() => onDrillIds?.(otros, "Movimientos de otra cuenta")} className="font-semibold underline focus-visible:outline-none">Verlos primero</button>
                              <button type="button" onClick={() => bank.onTrashOtherAccounts(c.aspsp, c.accountUid, accs.map((a) => a.uid))} className="font-semibold underline focus-visible:outline-none">Enviarlos a la papelera</button>
                            </span>
                          </div>
                        );
                      })()}
                      {typeof c.balance === "number" && <p className="mt-1 text-[11px] font-medium text-slate-600" style={tnum}>Saldo real: {nfEUR.format(c.balance)}{c.balanceAt ? ` · ${new Date(c.balanceAt).toLocaleDateString("es-ES")}` : ""}</p>}
                      {/* «Última» era la hora de preguntar, no de recibir: con la conexión muerta parecía sana. */}
                      {c.lastNewest && <p className="mt-0.5 text-[11px] text-slate-500" style={tnum}>Último movimiento recibido: {c.lastNewest}</p>}
                      {c.lastSync && <p className="mt-0.5 text-[11px] text-slate-400" style={tnum}>Última consulta: {new Date(c.lastSync).toLocaleString("es-ES")}{typeof c.lastCount === "number" ? ` · ${nfNum.format(c.lastCount)} movimientos devueltos` : ""}</p>}
                    </div>
                  );
                })}
                <Btn onClick={bank.onSyncAll} disabled={bank.busy}><RefreshCw size={14} /> Sincronizar todos</Btn>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={!!bank.auto} onChange={(e) => bank.onToggleAuto(e.target.checked)} className="h-3.5 w-3.5" />
                  Sincronización automática al abrir <span className="text-slate-400">(una vez cada 12 h; baja lo reciente sin duplicar)</span>
                </label>
              </div>
            )}

            {/* Añadir banco */}
            <div className="rounded-xl border p-2.5" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="text-xs font-medium text-slate-600">Añadir banco</div>
              <div className="mt-1.5 flex items-center gap-2">
                <input value={bank.addCountry} onChange={(e) => bank.onSetAddCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="ES" className="w-14 rounded-lg border px-2 py-1.5 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                <Btn size="sm" onClick={() => bank.onLoadAspsps(bank.addCountry)} disabled={bank.busy}>Cargar bancos</Btn>
              </div>
              {bank.aspsps.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={bank.addSel} onChange={(e) => bank.onSetAddSel(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.lineStrong }}>
                    <option value="">— Elige tu banco —</option>
                    {bank.aspsps.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={bank.addPsu} onChange={(e) => bank.onSetAddPsu(e.target.value)}
                    className="rounded-lg border bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                    <option value="personal">Personal</option>
                    <option value="business">Empresa / autónomo</option>
                  </select>
                  <Btn size="sm" kind="primary" onClick={bank.onAddConnect} disabled={bank.busy || !bank.addSel}>Conectar</Btn>
                </div>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">Pon el país (CaixaBank: ES · Revolut: LT · PayPal: LU), pulsa <strong>Cargar bancos</strong>, elige el tuyo y <strong>Conectar</strong> (te lleva a su login). Al volver, elige la cuenta y sincroniza.</p>
            </div>

            {bank.busy && <p className="text-xs text-slate-400">Trabajando con el banco…</p>}
            {bank.msg && <p className={`text-xs ${bank.msg.kind === "ok" ? "text-emerald-700" : bank.msg.kind === "err" ? "text-rose-700" : "text-slate-500"}`}>{bank.msg.text}</p>}

            <div>
              <Btn size="sm" onClick={bank.onDiagnose} disabled={bank.busy}>Probar backend</Btn>
              <span className="ml-2 text-[11px] text-slate-400">Pregunta al Worker y enseña su respuesta literal.</span>
              {bank.diag && (
                <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-2 text-[10px] leading-relaxed text-slate-600" style={{ borderColor: C.line, background: C.surfaceAlt }}>{bank.diag.join("\n")}</pre>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">Cada movimiento se marca con su banco (origen) y se deduplica por el id del banco. El permiso caduca a ~90 días; entonces vuelve a <strong>Conectar</strong> ese banco. La configuración viaja con tus datos: conecta una vez y el resto de dispositivos la hereda.</p>
          </div>
        </section>
        )}
        </Grupo>

        <Grupo titulo="Inteligencia artificial" abierto={abrir === "ia"} forzar={abrir === "ia"}
          estado={aiOn ? "activada" : "desactivada"} ok={aiOn}>
        <section>
          <h3 className="text-sm font-semibold">Inteligencia artificial</h3>
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-blue-600" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
            Activar asistente y sugerencias con IA
          </label>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Proveedor</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setAiField("provider", "claude")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${!custom ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                style={!custom ? { background: C.accent, borderColor: C.accent } : { borderColor: C.line }}>
                Claude (integrado)
              </button>
              <button type="button" onClick={() => setAiField("provider", "openai_compat")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${custom ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                style={custom ? { background: C.accent, borderColor: C.accent } : { borderColor: C.line }}>
                El que yo elija
              </button>
            </div>
            {custom && (
              <div className="mt-2 space-y-2 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
                <div className="flex flex-wrap gap-1.5">
                  {AI_PRESETS.map((p) => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ai.baseUrl === p.baseUrl ? "border-blue-400 bg-blue-50 text-blue-700" : "text-slate-600"}`}
                      style={ai.baseUrl === p.baseUrl ? {} : { borderColor: C.line }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="block text-xs text-slate-600">URL base (compatible OpenAI)
                  <input type="url" value={ai.baseUrl} onChange={(e) => setAiField("baseUrl", e.target.value)} placeholder="https://api.openai.com/v1"
                    className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs text-slate-600">Modelo
                    <input type="text" value={ai.model} onChange={(e) => setAiField("model", e.target.value)} placeholder="gpt-4o-mini"
                      className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                  </label>
                  <label className="block text-xs text-slate-600">Clave API (si el proveedor la pide)
                    <input type="password" value={ai.apiKey} onChange={(e) => setAiField("apiKey", e.target.value)} placeholder="sk-…" autoComplete="off"
                      className="mt-0.5 w-full rounded-lg border px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  La clave se guarda solo en {storeKind} y viaja dentro de tus copias de seguridad. El modelo debe admitir <em>function calling</em> para consultar tus datos.
                  {" "}<strong>Dentro de Claude.ai</strong> el navegador bloquea otros orígenes: tu elección se aplica en la app instalada en tu iPhone (o en local con Ollama/LM Studio, donde nada sale de tu red).
                </p>
              </div>
            )}
            {!custom && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                «Claude (integrado)» <strong>solo funciona dentro de claude.ai</strong>, donde el entorno pone la clave y el gasto va contra tu plan de Claude.
                En esta app instalada devuelve un error de autenticación: usa «El que yo elija» con una clave de API (una suscripción a Claude no incluye crédito de API) o un modelo local.
              </p>
            )}
          </div>

          {/* Perfiles: guarda varias configuraciones (Claude, un modelo gratuito…) y cambia al vuelo. */}
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Perfiles guardados</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">Guarda varias configuraciones con su clave y cambia entre ellas con un toque. Útil para tener, por ejemplo, Claude y un modelo gratuito a mano.</p>
            {aiProfiles && aiProfiles.length > 0 ? (
              <div className="mt-2 space-y-1">
                {aiProfiles.map((p) => {
                  const on = profileActive(p);
                  return (
                    <div key={p.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${on ? "border-blue-400 bg-blue-50" : "bg-white"}`} style={on ? {} : { borderColor: C.line }}>
                      <button type="button" onClick={() => onActivateAiProfile(p)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-slate-700">{p.label}{on && <span className="ml-1.5 text-[10px] font-semibold text-blue-600">· activo</span>}</span>
                        <span className="block truncate text-[11px] text-slate-400">{p.provider === "claude" ? "Claude (integrado)" : `${p.model || "modelo"} · ${(p.baseUrl || "").replace(/^https?:\/\//, "").split("/")[0] || "endpoint"}`}{p.apiKey ? " · con clave" : " · sin clave"}</span>
                      </button>
                      {!on && <button type="button" onClick={() => onActivateAiProfile(p)} className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50" style={{ borderColor: C.line }}>Usar</button>}
                      <button type="button" onClick={() => onDeleteAiProfile(p.id)} aria-label={`Borrar perfil ${p.label}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400">Aún no has guardado ningún perfil.</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input value={profLabel} onChange={(e) => setProfLabel(e.target.value)} maxLength={30} placeholder="Nombre (p. ej. «Gemini gratis»)"
                onKeyDown={(e) => { if (e.key === "Enter" && profLabel.trim()) { onSaveAiProfile(profLabel); setProfLabel(""); } }}
                className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }} />
              <Btn size="sm" kind="primary" onClick={() => { onSaveAiProfile(profLabel); setProfLabel(""); }}>Guardar el actual</Btn>
            </div>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 accent-blue-600" checked={aiDetail} onChange={(e) => setAiDetail(e.target.checked)} />
            <span>Permitir que la IA consulte movimientos individuales<span className="block text-xs text-slate-400">Desactivado, el asistente solo puede pedir totales agregados (menos granularidad, más privacidad).</span></span>
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Con independencia de este ajuste, al clasificar movimientos pendientes se envían al proveedor de IA los
            <strong> nombres de comercio</strong> (no las fechas ni los importes individuales). Si no quieres que salga
            nada, desactiva el asistente arriba y clasifica a mano.
          </p>
        </section>
        </Grupo>

        <Grupo titulo="Avanzado" estado="copias, reglas, limpieza y apariencia">
        <section>
          <h3 className="text-sm font-semibold">Copia de seguridad</h3>
          <p className="mt-1 text-xs text-slate-500">Exporta un archivo JSON con todo (movimientos, reglas, activos, etiquetas y presupuestos) o restaura una copia anterior. Al importar se reemplaza lo actual.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={onExport}><Download size={14} /> Exportar copia</Btn>
            <Btn onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar copia</Btn>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f) return;
                const r = await onImportFile(f);
                setImportMsg(r);
              }} />
          </div>
          {importMsg && <p className={`mt-2 text-xs ${importMsg.ok ? "text-emerald-700" : "text-rose-700"}`}>{importMsg.text}</p>}

          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <History size={14} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-700">Copias automáticas</span>
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{snapCount}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              La app guarda una copia diaria dentro de {storeKind} (se conservan los últimos días, semanas y meses). Es una red de seguridad, pero {storeKind} puede borrarse: exporta de vez en cuando un archivo y guárdalo fuera.
            </p>
            {snapTooBig && (
              <p className="mt-2 rounded-lg px-2 py-1.5 text-[11px] font-medium leading-relaxed" style={{ background: C.warnSoft, color: C.warn }}>
                Tus datos ya no caben en las copias automáticas: cada una es una copia entera y se guardan varias.
                Las he desactivado para no agotar el espacio del navegador y tumbar el guardado normal.
                <strong> Exporta el archivo a mano de vez en cuando</strong>: ahora es tu única red de seguridad.
              </p>
            )}
            {!snapsOpen ? (
              <button type="button" onClick={openSnaps} disabled={!snapCount}
                className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                Ver copias automáticas
              </button>
            ) : (
              <div className="mt-2 space-y-1">
                {snaps == null && <p className="text-xs text-slate-400">Cargando…</p>}
                {snaps && snaps.length === 0 && <p className="text-xs text-slate-400">Aún no hay copias automáticas.</p>}
                {snaps && snaps.map((s) => (
                  <div key={s.ts} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 text-xs text-slate-600">
                      {new Date(s.ts).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {s.movs != null && <span className="text-slate-400"> · {nfNum.format(s.movs)} movs</span>}
                    </span>
                    <button type="button" onClick={async () => { const r = await onRestoreSnap(s.ts); setImportMsg(r); setSnapsOpen(false); }}
                      className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {bank && bank.connections.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Duplicados del banco</span>
                {dupes && <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{dupes.length}</span>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Movimientos del banco con la misma cuenta, fecha, importe y concepto pero distinta referencia. Pasa cuando el banco cambia la referencia al liquidar una operación de tarjeta, y pasaba con sincronizaciones solapadas (ya corregido). Revísalos antes de limpiar: dos compras iguales el mismo día también aparecen aquí. Lo que quites va a la papelera y se puede recuperar.
              </p>
              {dupes === null ? (
                <button type="button" onClick={() => setDupes(onFindDupes())}
                  className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
                  Buscar duplicados
                </button>
              ) : dupes.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-700">No hay duplicados del banco.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {dupes.slice(0, 60).map((g) => (
                    <div key={g[0].id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-700" title={g[0].concept}>{g[0].concept}</span>
                        <span className="text-[11px] text-slate-400" style={tnum}>{fmtDate(g[0].date instanceof Date ? g[0].date : new Date(g[0].date))} · {nfEUR.format(g[0].amount)} · {g.length} veces</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{g.length - 1} de más</span>
                    </div>
                  ))}
                  {dupes.length > 60 && <p className="text-[11px] text-slate-400">y {dupes.length - 60} grupos más.</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Btn size="sm" kind="primary" onClick={() => { onTrashDupes(dupes); setDupes(null); }}>
                      Enviar {nfNum.format(dupes.reduce((n, g) => n + g.length - 1, 0))} repetidos a la papelera
                    </Btn>
                    <Btn size="sm" onClick={() => setDupes(null)}>Cerrar</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {assetMem && Object.keys(assetMem).length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Comercios y sus activos</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{Object.keys(assetMem).length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Lo que la app ha aprendido de tus asignaciones: cada comercio y el activo al que lo mandas. Vive aquí y no en los movimientos, así que <strong className="text-slate-500">borrar una carga ya no se lleva este trabajo</strong>: al reimportar se aplica solo. Si un comercio se reparte entre varios activos no se memoriza, porque no hay una respuesta única.
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                {Object.entries(assetMem).sort((a, b) => a[0].localeCompare(b[0], "es")).map(([pat, asset]) => (
                  <div key={pat} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={pat}>{pat}</span>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500">{asset}</span>
                    <button type="button" onClick={() => onForgetAssetMem(pat)} aria-label={`Olvidar ${pat}`} className="shrink-0 rounded-md p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={onForgetAllAssetMem} className="mt-2 text-[11px] font-medium text-slate-400 underline hover:text-rose-600 focus-visible:outline-none">Olvidar todas</button>
            </div>
          )}

          {imports && imports.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Cargas de datos</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{imports.length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Cada archivo que has importado. Puedes borrar una carga entera (p. ej. un CSV con la divisa mal leída). Es destructivo, pero tienes las copias automáticas de arriba para deshacer.
                {" "}<strong className="text-slate-500">Lo que has enseñado se conserva</strong>: las categorías (como reglas) y la relación comercio–activo (más abajo) se vuelven a aplicar al reimportar. Se pierde lo que es de cada movimiento concreto: marcas de extraordinario, notas y repartos.
              </p>
              <div className="mt-2 space-y-1">
                {imports.map((im) => (
                  <div key={im.file} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700" title={im.file}>{im.file}</span>
                      <span className="text-[11px] text-slate-400" style={tnum}>{nfNum.format(im.count)} movs · {fmtDate(im.min)}–{fmtDate(im.max)}</span>
                    </span>
                    {confirmDel === im.file ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => { onDeleteImport(im.file); setConfirmDel(null); setImportMsg({ ok: true, text: `Carga «${im.file}» borrada (${nfNum.format(im.count)} movimientos).` }); }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ background: C.expense }}>Borrar {nfNum.format(im.count)}</button>
                        <button type="button" onClick={() => setConfirmDel(null)} className="rounded-md border px-2 py-1 text-[11px] text-slate-500" style={{ borderColor: C.line }}>No</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDel(im.file)} aria-label={`Borrar la carga ${im.file}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {trashed && trashed.length > 0 && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: C.line, background: C.surfaceAlt }}>
              <div className="flex items-center gap-2">
                <Trash2 size={14} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-700">Papelera</span>
                <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{trashed.length}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Movimientos que enviaste a la papelera: fuera del análisis, pero puedes <span className="font-medium">rescatarlos</span> aquí. Bórralos del todo cuando estés seguro.</p>
              {!trashOpen ? (
                <button type="button" onClick={() => setTrashOpen(true)} className="mt-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white" style={{ borderColor: C.line }}>Ver la papelera</button>
              ) : (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => { onPurgeTrash(trashed.map((m) => m.id)); }} className="text-[11px] font-medium text-rose-600 hover:underline">Vaciar papelera</button>
                  </div>
                  {trashed.slice(0, 60).map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-slate-700" title={m.concept}>{m.concept}</span>
                        <span className="text-[11px] text-slate-400" style={tnum}>{fmtDate(new Date(m.date))} · {fmtE(m.amount)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => onRestoreTrash(m.id)} className="rounded-md border px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50" style={{ borderColor: C.line }}>Rescatar</button>
                        <button type="button" onClick={() => onPurgeTrash(m.id)} aria-label="Borrar del todo" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={13} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold">Reglas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Cada vez que corriges una categoría, la app crea una regla para no volver a preguntar. Aquí ves las tuyas
            —cuántas veces han disparado y cuánto dinero han colocado— y puedes apagarlas sin perderlas.
          </p>
          {!rulesOpen ? (
            <button type="button" onClick={openRules}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ borderColor: C.line }}>
              <GitBranch size={13} /> Revisar reglas
            </button>
          ) : (
            <div className="mt-2 space-y-1.5">
              {audit && audit.length === 0 && <p className="text-xs text-slate-400">Todavía no has creado reglas propias. Se generan al corregir categorías.</p>}
              {audit && audit.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#FB7185" }} /> En conflicto: contradice tus correcciones → cámbiala o apágala.</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#FBBF24" }} /> Genérica: pesca muchos comercios → revísala.</span>
                </div>
              )}
              {audit && audit.map((r) => (
                <div key={r.id} className={`rounded-lg border p-2.5 ${r.active ? "" : "opacity-60"}`}
                  style={{ borderColor: r.conflict ? "#FECDD3" : r.broad ? "#FDE68A" : C.line, background: C.surface }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="font-mono text-xs font-semibold text-slate-700">{r.k}</span>
                        {/* Las condiciones son la razón de ser de la regla: enséñalas */}
                        {r.conditional && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                            {r.sign === "+" ? "ingreso" : r.sign === "-" ? "gasto" : ""}
                            {r.min != null || r.max != null ? ` ${fmtE0(r.min ?? 0)}–${r.max != null && r.max < 999999 ? fmtE0(r.max) : "∞"}` : ""}
                            {r.dayMin != null ? ` días ${r.dayMin}-${r.dayMax ?? 31}` : ""}
                          </span>
                        )}
                        <span className="text-slate-400">→</span>
                        <span className="font-medium">{r.cat}</span>
                        {r.asset && <span className="text-xs text-slate-400">· {r.asset}</span>}
                        {r.confirm && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">pide revisión</span>}
                        {!r.active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">apagada</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500" style={tnum}>
                        {r.usos > 0
                          ? `${nfNum.format(r.usos)} usos · ${fmtE0(r.dinero)} clasificados${r.ultimoUso ? ` · última vez ${fmtDate(new Date(r.ultimoUso))}` : ""}`
                          : r.hits === 0 ? "no coincide con ningún movimiento actual" : `coincide con ${nfNum.format(r.hits)} movimiento${r.hits !== 1 ? "s" : ""}, pero nunca ha clasificado ninguno`}
                      </div>
                      {r.conflict && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-rose-700">La mayoría ya están en «{r.conflictCat}»: esta regla podría estar obsoleta.</span>
                          {r.scope === "personal" && r.conflictCat && <button type="button" onClick={() => changeCat(r.id, r.conflictCat)} className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50" style={{ borderColor: "#FECDD3" }}>Cambiar a «{r.conflictCat}»</button>}
                        </div>
                      )}
                      {!r.conflict && r.broad && <div className="mt-1 text-[11px] font-medium text-amber-700">Genérica: afecta a varios comercios ({r.sampleEntities.join(", ")}…).</div>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => toggle(r.id, !r.active)}
                        aria-label={r.active ? `Apagar regla ${r.k}` : `Encender regla ${r.k}`}
                        title={r.active ? "Apagar (no se pierde)" : "Volver a encender"}
                        className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {r.active ? <Check size={14} /> : <X size={14} />}
                      </button>
                      {r.scope === "personal" && (
                        <button type="button" onClick={() => remove(r.id)} aria-label={`Borrar regla ${r.k}`} title="Borrar del todo"
                          className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold">Cuándo preguntarte</h3>
          <p className="mt-1 text-xs text-slate-500">
            Los movimientos por debajo de este importe no se llevan a «por clasificar»: un café mal
            categorizado no cambia ninguna decisión, pero preguntarte por él te quema. Pon 0 para que
            se pregunte por todo.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600">Ignorar por debajo de</span>
            <input type="number" min={0} max={1000} step={1} value={materialidad}
              onChange={(e) => setMaterialidad(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              className="w-20 rounded-lg border px-2 py-1.5 text-sm" style={{ ...tnum, borderColor: C.line }} />
            <span className="text-slate-600">€</span>
          </label>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Recordatorios en el calendario</h3>
          <p className="mt-1 text-xs text-slate-500">
            La app no puede enviarte notificaciones estando cerrada: eso necesitaría un servidor. Lo que sí puede es
            darte tus cargos previstos como archivo de calendario. Lo abres, se añaden a tu calendario con un aviso
            la víspera, y es tu teléfono quien te lo recuerda.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Btn onClick={downloadICS} disabled={!upcomingItems.length}>
              <CalendarDays size={14} /> Descargar {upcomingItems.length || ""} cargos previstos
            </Btn>
            {!upcomingItems.length && <span className="text-xs text-slate-400">Aún no he detectado recibos periódicos.</span>}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Apariencia</h3>
          <div className="mt-2">
            <Seg ariaLabel="Tema" value={theme} onChange={setTheme}
              options={[{ v: "light", l: "Claro" }, { v: "dark", l: "Oscuro" }]} />
          </div>
        </section>
        <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <h3 className="text-sm font-semibold text-rose-800">Zona de borrado</h3>
          <p className="mt-1 text-xs text-rose-700">Elimina todos los movimientos, reglas aprendidas, activos, etiquetas y presupuestos de este espacio. No se puede deshacer.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!confirmWipe ? (
              <Btn kind="danger" onClick={() => setConfirmWipe(true)}><Trash2 size={14} /> Borrar todos mis datos</Btn>
            ) : (
              <>
                <span className="text-xs font-medium text-rose-800">¿Seguro? Esta acción es definitiva.</span>
                <Btn kind="danger" onClick={async () => { await onWipe(); onClose(); }}><Trash2 size={14} /> Sí, borrar todo</Btn>
                <Btn size="sm" onClick={() => setConfirmWipe(false)}>Cancelar</Btn>
              </>
            )}
          </div>
        </section>
        </Grupo>

      </div>
    </Modal>
  );
}

/* Exportaciones con nombre: no las usa la app, existen para que el banco de pruebas
   ejerza EL MOTOR REAL y no una copia suya que se desincronice con el tiempo. */
export {
  matchRule, ruleConditionsHold, sortedRules, ruleId, isConditional,
  DEFAULT_RULES, PRIO, DEFAULT_MATERIALIDAD,
  classifyForImport, dedupeAgainst, movKey, normalizePattern, auditRules,
  CATEGORIES, rebuildRules,
  buildMonthClose, missingIncome, upcomingIncome, upcomingCharges, detectRecurring, analyzeReceiptTrends,
};

let MOV_ID = 1;

/* ============================================================
   PESTAÑA PLAN (Presupuesto · Recibos · Ahorro)
   ============================================================ */
function PlanTab({ budgets, setBudgets, movs, monthsAvail, allAgg, agg, reducible, setReducible, recurring, receiptTrends, upcoming, onDrill }) {
  const [view, setView] = useState("presupuesto");
  const risingCount = receiptTrends.filter((t) => (t.deltaYoY ?? t.deltaMoM ?? 0) >= 0.03).length;
  return (
    <div className="anim-rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Seg ariaLabel="Sección del plan" value={view} onChange={setView}
          options={[{ v: "presupuesto", l: "Presupuesto" }, { v: "recibos", l: "Recibos" }, { v: "ahorro", l: "Ahorro" }]} />
        {view !== "recibos" && risingCount > 0 && (
          <button type="button" onClick={() => setView("recibos")} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ color: C.expense, background: C.expenseSoft }}>
            <TrendingUp size={11} /> {risingCount} {risingCount === 1 ? "recibo ha subido" : "recibos han subido"}
          </button>
        )}
      </div>
      {view === "presupuesto" && <PresupuestoTab budgets={budgets} setBudgets={setBudgets} movs={movs} monthsAvail={monthsAvail} allAgg={allAgg} onDrill={onDrill} />}
      {view === "recibos" && (
        <div className="space-y-4">
          <UpcomingCard upcoming={upcoming} onDrill={onDrill} />
          <ReceiptTrendsCard trends={receiptTrends} onDrill={onDrill} />
        </div>
      )}
      {view === "ahorro" && <AhorroTab agg={agg} reducible={reducible} setReducible={setReducible} recurring={recurring} onDrill={onDrill} />}
    </div>
  );
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
let overlaySeq = 0;
let selfPops = 0; // popstate provocados por nuestro propio history.back()
let popBound = false;

function tryHistory(fn) { try { fn(); return true; } catch { return false; } }

function bindPopstate() {
  if (popBound || typeof window === "undefined") return;
  popBound = true;
  window.addEventListener("popstate", () => {
    if (selfPops > 0) { selfPops--; return; }
    const top = overlayStack.pop();
    if (top) top.close();
  });
}

function useBackClose(isOpen, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    bindPopstate();
    const entry = { id: ++overlaySeq, close: () => closeRef.current?.() };
    overlayStack.push(entry);
    const pushed = tryHistory(() => window.history.pushState({ overlay: entry.id }, ""));
    return () => {
      const i = overlayStack.indexOf(entry);
      const wasTop = i === overlayStack.length - 1;
      if (i >= 0) overlayStack.splice(i, 1);
      // Cerrado por la X / Escape / clic fuera: consumimos nuestra propia entrada.
      // Si lo cerró el "atrás", popstate ya lo sacó de la pila y no hay nada que consumir.
      if (pushed && i >= 0 && wasTop && window.history.state?.overlay === entry.id) {
        selfPops++;
        if (!tryHistory(() => window.history.back())) selfPops--;
      }
    };
  }, [isOpen]);
}

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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error("Fallo de render capturado:", error, info); } catch { /* noop */ } }
  downloadBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(recoverBackupFromStore(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finanzas-copia-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* si ni esto funciona, quedan los snapshots */ }
  };
  render() {
    if (!this.state.error) return this.props.children;
    const wrap = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" };
    const card = { maxWidth: "440px", width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "24px" };
    const btn = { display: "block", width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "10px" };
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Algo ha fallado al mostrar la app</h1>
          <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#94a3b8", margin: "0 0 4px" }}>
            Tranquilo: <strong style={{ color: "#e2e8f0" }}>tus datos siguen guardados</strong>, solo ha fallado la pantalla.
            Descarga una copia por seguridad y recarga.
          </p>
          <button style={{ ...btn, background: "#22c55e", color: "#052e16" }} onClick={this.downloadBackup}>Descargar copia de seguridad</button>
          <button style={{ ...btn, background: "#334155", color: "#e2e8f0" }} onClick={() => window.location.reload()}>Recargar la app</button>
          <p style={{ fontSize: "11px", color: "#64748b", margin: "14px 0 0", wordBreak: "break-word" }}>{String(this.state.error?.message || this.state.error)}</p>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppMain />
    </ErrorBoundary>
  );
}

// Conversaciones del asistente (varias, con menú). El título se deriva del primer mensaje.
const CHATS_KEY = "finz:chats:v1";
const newConv = () => ({ id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), title: "", msgs: [], updatedAt: Date.now() });
const convTitle = (c) => (c.title || (c.msgs.find((m) => m.role === "user")?.content || "")).trim().slice(0, 40) || "Nueva conversación";

function AppMain() {
  // El tema vive en un módulo (C y catColor lo leen durante el render). Lo escribimos
  // ANTES de setThemeState para que el re-render que provoca ya use los colores nuevos.
  const [theme, setThemeState] = useState(THEME);
  const setTheme = useCallback((t) => {
    THEME = t;
    try {
      document.documentElement.dataset.theme = t;
      window.localStorage?.setItem(THEME_KEY, t);
    } catch { /* almacenamiento bloqueado: el tema dura la sesión */ }
    setThemeState(t);
  }, []);

  const [movs, setMovs] = useState([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [assets, setAssets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reducible, setReducible] = useState(new Set(DEFAULT_REDUCIBLE));
  const [aiOn, setAiOn] = useState(true);
  const [ai, setAi] = useState(DEFAULT_AI_CFG);
  const [aiProfiles, setAiProfiles] = useState([]); // perfiles de IA guardados: {id,label,provider,baseUrl,model,apiKey}
  // Apagado por defecto: dar acceso al detalle línea a línea debe ser una decisión
  // consciente, no el arranque. El pie de la app afirma que solo ve agregados.
  const [aiDetail, setAiDetail] = useState(false);
  const [tab, setTab] = useState("resumen");
  // Dos pestañas combinan dos vistas con un conmutador interno, para aligerar el nav
  // (sobre todo en móvil): "Activos" ↔ "Etiquetas" e "Ideas" ↔ "Plan".
  const [subAct, setSubAct] = useState("activos");
  const [subIdea, setSubIdea] = useState("recap");
  // El chat vive en App (persiste al navegar y al recargar). Ahora son VARIAS conversaciones
  // con menú para navegar. Se migra el chat único anterior (finz:chat:v1) a la primera.
  const [chatStore, setChatStore] = useState(() => {
    try { const s = window.localStorage?.getItem(CHATS_KEY); if (s) { const p = JSON.parse(s); if (p && Array.isArray(p.convs) && p.convs.length) return p; } } catch { /* ignore */ }
    try { const old = JSON.parse(window.localStorage?.getItem("finz:chat:v1") || "[]"); if (Array.isArray(old) && old.length) { const c = { ...newConv(), msgs: old }; return { convs: [c], activeId: c.id }; } } catch { /* ignore */ }
    const c = newConv();
    return { convs: [c], activeId: c.id };
  });
  useEffect(() => {
    try { window.localStorage?.setItem(CHATS_KEY, JSON.stringify(chatStore)); } catch { /* cuota */ }
  }, [chatStore]);
  const activeConv = chatStore.convs.find((c) => c.id === chatStore.activeId) || chatStore.convs[0];
  const chatMsgs = activeConv ? activeConv.msgs : [];
  const setChatMsgs = useCallback((arg) => {
    setChatStore((store) => {
      const convs = store.convs.map((c) => (c.id === store.activeId ? { ...c, msgs: typeof arg === "function" ? arg(c.msgs) : arg, updatedAt: Date.now() } : c));
      return { ...store, convs };
    });
  }, []);
  const newChat = useCallback(() => setChatStore((store) => {
    const empty = store.convs.find((c) => c.msgs.length === 0);
    if (empty) return { ...store, activeId: empty.id };
    const c = newConv();
    return { convs: [c, ...store.convs], activeId: c.id };
  }), []);
  const selectChat = useCallback((id) => setChatStore((s) => ({ ...s, activeId: id })), []);
  const deleteChat = useCallback((id) => setChatStore((store) => {
    const convs = store.convs.filter((c) => c.id !== id);
    if (!convs.length) { const c = newConv(); return { convs: [c], activeId: c.id }; }
    return { convs, activeId: store.activeId === id ? convs[0].id : store.activeId };
  }), []);
  // Alto real de la cabecera, publicado como variable CSS: lo consume la barra fija del chat
  // para pegarse justo debajo en vez de solaparse. Ref de callback porque la cabecera no existe
  // en el primer render y un efecto con deps [] se quedaba con la referencia vacia.
  const headerRoRef = useRef(null);
  const headerRef = useCallback((el) => {
    headerRoRef.current?.disconnect();
    headerRoRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const publicar = () => document.documentElement.style.setProperty("--app-header-h", el.offsetHeight + "px");
    publicar();
    headerRoRef.current = new ResizeObserver(publicar);
    headerRoRef.current.observe(el);
  }, []);
  const [drill, setDrill] = useState(null);
  const [movEdit, setMovEdit] = useState(null); // null | { mode:"new" } | { mode:"edit", mov }
  const [granularity, setGranularity] = useState("month");
  const [imp, setImp] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(0);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ periodType: "month", year: new Date().getFullYear(), month: "", from: "", to: "", cats: new Set(), assetsSel: new Set(), groupsSel: new Set() });
  const sampleRef = useRef(false);
  // Vive en App, no en el panel: así cerrar y reabrir "por clasificar" no vuelve a
  // pagar la ronda de IA. Se rearma al importar un CSV nuevo (hay comercios nuevos).
  const aiAutoRanRef = useRef(false);
  const hasData = movs.length > 0;
  const movsPend = useMemo(() => movs.filter((m) => m.confirmed === false && !m.omit), [movs]);

  // Botón atrás cierra overlays en vez de salir de la app (crucial en la PWA de iPhone)
  useBackClose(settingsOpen, () => setSettingsOpen(false));
  useBackClose(pendingOpen, () => setPendingOpen(false));
  useBackClose(!!drill, () => setDrill(null));

  /* ---------- Persistencia ---------- */
  const [budgets, setBudgets] = useState({});
  const [booted, setBooted] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const saveTimer = useRef(null);
  const lastSnapRef = useRef(0);
  // Se activa si al arrancar había una copia de movimientos que NO se pudo leer. Mientras
  // esté activo y el estado siga vacío, bloqueamos el autoguardado para no pisar esa copia
  // (recuperable vía snapshots) con un estado vacío. Se libera al importar o al borrar todo.
  const bootProtectRef = useRef(false);
  const [snapCount, setSnapCount] = useState(0);
  const [snapTooBig, setSnapTooBig] = useState(false);
  // Telemetría por regla: id -> { n, abs, last }. Y el umbral por debajo del cual
  // un movimiento no merece que te preguntemos.
  const [ruleStats, setRuleStats] = useState({});
  const [materialidad, setMaterialidad] = useState(DEFAULT_MATERIALIDAD);
  // Memoria comercio -> activo. Se aprende sola de lo que ya has asignado a mano y NO se borra
  // al eliminar movimientos: es lo que evita rehacer el trabajo tras una carga equivocada.
  const [assetMem, setAssetMem] = useState({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [cRaw, mRaw] = await Promise.all([STORE.get(STORE_KEYS.cfg), STORE.get(STORE_KEYS.movs)]);
        if (cancel) return;
        if (cRaw) { try { applyCfg(cRaw, { setAssets, setGroups, setBudgets, setReducible, setRules, setAiOn, setAi, setAiProfiles, setAiDetail, setRuleStats, setMaterialidad, setAssetMem }); } catch { /* copia corrupta: se ignora */ } }
        if (mRaw) {
          try {
            const ms = deserializeMovs(mRaw);
            if (ms.length) {
              let mx = 0;
              for (const m of ms) if (typeof m.id === "number" && m.id > mx) mx = m.id;
              MOV_ID = mx + 1;
              setMovs(ms);
            } else {
              // Había copia pero no salió ningún movimiento útil: protege contra sobrescribir.
              bootProtectRef.current = true;
            }
          } catch { bootProtectRef.current = true; /* copia corrupta: no la pises */ }
        }
      } finally { if (!cancel) setBooted(true); }
    })();
    return () => { cancel = true; };
  }, []);

  // Inventario inicial de snapshots (para mostrar en Ajustes y no duplicar el diario)
  useEffect(() => {
    if (!booted) return;
    let cancel = false;
    (async () => {
      const snaps = await listSnapshots(STORE);
      if (cancel) return;
      setSnapCount(snaps.length);
      if (snaps.length) lastSnapRef.current = snaps[0];
    })();
    return () => { cancel = true; };
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    // No sobrescribas una copia que no se pudo leer con un estado vacío: espera a que el
    // usuario importe (movs > 0) o borre todo explícitamente. Los snapshots siguen intactos.
    if (bootProtectRef.current && movs.length === 0) { setSaveState("error"); return; }
    bootProtectRef.current = false;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const cfgStr = serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem });
        const movStr = serializeMovs(movs);
        const okC = await STORE.set(STORE_KEYS.cfg, cfgStr);
        const okM = await STORE.set(STORE_KEYS.movs, movStr);
        setSaveState(okC && okM ? "saved" : "error");
        // Snapshot diario de defensa (no bloquea el guardado principal)
        try {
          const now = Date.now();
          if (shouldSnapshot(lastSnapRef.current, now, movs.length)) {
            const snap = JSON.stringify({ app: "finanzas-personales", version: 3, exportado: new Date(now).toISOString(), cfg: JSON.parse(cfgStr), movs: JSON.parse(movStr) });
            const r = await writeSnapshot(STORE, snap, now);
            setSnapTooBig(!!r.skipped);
            if (!r.skipped) {
              lastSnapRef.current = now;
              setSnapCount((await listSnapshots(STORE)).length);
            }
          }
        } catch { /* el snapshot es best-effort */ }
      } catch { setSaveState("error"); }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [movs, rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, booted]);

  // Salvavidas: el guardado va con 900 ms de rebote y su cleanup cancela el timer.
  // Cerrar la app dentro de esa ventana perdía el último cambio. Al ocultarse la
  // página volcamos de inmediato lo que haya en curso.
  const stateRef = useRef(null);
  stateRef.current = { rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, movs, ruleStats, materialidad, assetMem };
  useEffect(() => {
    if (!booted) return;
    const flush = (force) => {
      if (!force && document.visibilityState !== "hidden") return;
      const s = stateRef.current;
      if (bootProtectRef.current && s.movs.length === 0) return; // no pises la copia protegida
      clearTimeout(saveTimer.current);
      try {
        STORE.set(STORE_KEYS.cfg, serializeCfg(s));
        STORE.set(STORE_KEYS.movs, serializeMovs(s.movs));
      } catch { /* al cerrar no hay a quién avisar */ }
    };
    const onVis = () => flush(false);
    const onHide = () => flush(true);
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onHide); };
  }, [booted]);

  // Aprende de lo que ya hay: por comercio, si todos los movimientos vivos con activo apuntan
  // al MISMO activo, se recuerda. Si discrepan (el taller que a veces es del coche y a veces de
  // la moto) no se toca, porque ahi no hay una respuesta unica. Las entradas no se borran cuando
  // desaparecen los movimientos: precisamente eso es lo que sobrevive a borrar una carga.
  useEffect(() => {
    if (!booted) return;
    const byPattern = new Map();
    for (const m of movs) {
      if (m.omit || !m.assetName || !m.pattern) continue;
      if (!byPattern.has(m.pattern)) byPattern.set(m.pattern, new Set());
      byPattern.get(m.pattern).add(m.assetName);
    }
    setAssetMem((prev) => {
      let changed = false; const next = { ...prev };
      for (const [pat, set] of byPattern) {
        if (set.size !== 1) continue;
        const only = [...set][0];
        if (next[pat] !== only) { next[pat] = only; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [movs, booted]);

  const forgetAssetMem = useCallback((pattern) => setAssetMem((p) => { const n = { ...p }; delete n[pattern]; return n; }), []);
  const forgetAllAssetMem = useCallback(() => setAssetMem({}), []);

  const wipeAll = useCallback(async () => {
    bootProtectRef.current = false; // borrado explícito: deja de proteger la copia previa
    await STORE.del(STORE_KEYS.movs);
    await STORE.del(STORE_KEYS.cfg);
    try { for (const t of await listSnapshots(STORE)) await STORE.del(SNAP_PREFIX + t); } catch { /* best-effort */ }
    lastSnapRef.current = 0; setSnapCount(0);
    MOV_ID = 1;
    setMovs([]); setAssets([]); setGroups([]); setBudgets({});
    setRules(DEFAULT_RULES); setReducible(new Set(DEFAULT_REDUCIBLE));
    setRuleStats({}); setMaterialidad(DEFAULT_MATERIALIDAD); setAssetMem({});
    setAi(DEFAULT_AI_CFG); setAiProfiles([]); setAiDetail(false);
    setDrill(null); setImp(null); setPendingNotice(0); setError(null); setTab("resumen");
    setFilters((f) => ({ ...f, periodType: "all", month: "", from: "", to: "", cats: new Set(), assetsSel: new Set(), groupsSel: new Set() }));
  }, []);

  const exportJSON = useCallback(() => {
    try {
      const cfg = JSON.parse(serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem }));
      // Privacidad: la clave de API NO viaja en la copia exportada (podrías compartir el
      // archivo). Se queda solo en este navegador; al reimportar la vuelves a poner.
      if (cfg.ai) cfg.ai = { ...cfg.ai, apiKey: "" };
      if (Array.isArray(cfg.aiProfiles)) cfg.aiProfiles = cfg.aiProfiles.map((p) => ({ ...p, apiKey: "" }));
      const payload = {
        app: "finanzas-personales", version: 3, exportado: new Date().toISOString(),
        cfg,
        movs: JSON.parse(serializeMovs(movs)),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `finanzas-copia-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) { setError("No se pudo exportar la copia: " + e.message); }
  }, [rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, movs, ruleStats, materialidad]);

  const applyBackupPayload = useCallback((p) => {
    const ms = deserializeMovs(JSON.stringify(p.movs));
    applyCfg(JSON.stringify(p.cfg), { setAssets, setGroups, setBudgets, setReducible, setRules, setAiOn, setAi, setAiProfiles, setAiDetail, setRuleStats, setMaterialidad, setAssetMem });
    // La config del banco viaja en las copias del servidor (no en las exportadas, que se comparten):
    // así conectas una vez y el resto de dispositivos hereda sesión, cuenta y token.
    // La copia del servidor puede ser ANTERIOR a la sesión bancaria que acabas de crear en este
    // dispositivo: al volver del banco se hace un arranque completo y el "traer" automático
    // llegaba después, borrando la sesión nueva (y a veces worker y token). Solo se aplica si
    // la copia es más reciente, y nunca si viene vacía habiendo config local.
    const merged = mergeBank(loadBank(), p.bank);
    if (merged) { saveBank(merged); try { window.dispatchEvent(new Event("finz-bank-updated")); } catch { /* noop */ } }    let mx = 0;
    for (const m of ms) if (typeof m.id === "number" && m.id > mx) mx = m.id;
    MOV_ID = mx + 1;
    setMovs(ms);
    return ms.length;
  }, []);

  const importJSON = useCallback(async (file) => {
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      if (!p || !p.movs || !p.cfg) return { ok: false, text: "El archivo no parece una copia de esta aplicación." };
      const n = applyBackupPayload(p);
      return { ok: true, text: `Copia restaurada: ${nfNum.format(n)} movimientos.` };
    } catch (e) { return { ok: false, text: "No se pudo importar: " + e.message }; }
  }, [applyBackupPayload]);

  /* ---------- Sincronización con tu Worker (D1) ---------- */
  const [syncCfg, setSyncCfg] = useState(loadSync);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [syncConflict, setSyncConflict] = useState(null); // { version, updatedAt }
  const persistSync = useCallback((patch) => setSyncCfg((c) => { const n = { ...c, ...patch }; saveSync(n); return n; }), []);

  // El cuerpo que se sube: mismo formato que la copia exportable, para poder restaurar entre ambas
  // y puedas volver atrás sin convertir nada.
  const syncPayload = useCallback(() => ({
    app: "finanzas-personales", version: 3, updatedAt: Date.now(),
    cfg: JSON.parse(serializeCfg({ rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem })),
    movs: JSON.parse(serializeMovs(movs)),
    bank: loadBank(),
  }), [rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, movs]);

  const syncPush = useCallback(async ({ silent, force } = {}) => {
    const url = bankBase();
    if (!url) { if (!silent) setSyncMsg({ kind: "err", text: "Pon la URL del backend (tu Worker) en la sección de arriba." }); return; }
    setSyncBusy(true); if (!silent) setSyncMsg(null);
    try {
      const base = force ? null : (Number(loadSync().version) || 0);
      // Con `force` hay que leer primero la versión real: subir a ciegas volvería a abrir la
      // puerta a pisar lo de otro dispositivo, que es justo lo que esto viene a cerrar.
      let baseVersion = base;
      if (force) {
        const cur = await bankFetch("/store", 25000);
        const curData = cur.ok ? await cur.json() : null;
        baseVersion = curData ? (Number(curData.version) || 0) : 0;
        // Red de seguridad contra el accidente más caro: subir a la fuerza desde un dispositivo
        // casi vacío (una ventana de incógnito, un móvil recién configurado) y arrasar la copia
        // buena. El rechazo por versión no cubre este caso, porque forzar lo salta a propósito.
        const aqui = stateRef.current?.movs?.length || 0;
        const alli = (curData?.payload?.movs?.movs || curData?.payload?.movs || []).length || 0;
        if (alli > 20 && aqui < alli / 2) {
          const seguir = window.confirm(
            [
              `Atención: en el servidor hay ${nfNum.format(alli)} movimientos y en este dispositivo solo ${nfNum.format(aqui)}.`,
              "Si subes, los del servidor se reemplazan por los de aquí. ¿Es lo que quieres?",
              "Si estás probando en una ventana nueva o en otro dispositivo, lo que buscas es «Traer», no «Subir».",
            ].join("\n\n")
          );
          if (!seguir) { setSyncMsg({ kind: "info", text: "Cancelado. No se ha subido nada." }); return; }
        }
      }
      const res = await fetch(url + "/store", {
        method: "PUT", headers: { ...bankHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion, payload: syncPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSyncConflict({ version: data.version, updatedAt: data.updatedAt });
        setSyncMsg({ kind: "err", text: `Otro dispositivo guardó después que tú${data.updatedAt ? ` (${new Date(data.updatedAt).toLocaleString("es-ES")})` : ""}. No he subido nada: elige abajo qué conservar.` });
        return;
      }
      if (!res.ok) throw new Error(data.error || "el backend devolvió " + res.status);
      persistSync({ version: data.version, lastPush: Date.now() });
      setSyncConflict(null);
      if (!silent) setSyncMsg({ kind: "ok", text: `Guardado en tu Worker (versión ${data.version}).` });
    } catch (e) { if (!silent) setSyncMsg({ kind: "err", text: "No se pudo guardar: " + e.message }); }
    finally { setSyncBusy(false); }
  }, [persistSync, syncPayload]);

  const syncPull = useCallback(async ({ silent, confirmReplace } = {}) => {
    const url = bankBase();
    if (!url) { if (!silent) setSyncMsg({ kind: "err", text: "Pon la URL del backend (tu Worker) en la sección de arriba." }); return; }
    setSyncBusy(true); if (!silent) setSyncMsg(null);
    try {
      const res = await bankFetch("/store", 30000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "el backend devolvió " + res.status);
      if (data.empty) { if (!silent) setSyncMsg({ kind: "info", text: "Tu Worker aún no tiene copia. Pulsa «Guardar» para crear la primera." }); return; }
      // Traer REEMPLAZA lo local: se confirma siempre que haya algo que perder.
      const locales = stateRef.current?.movs?.length || 0;
      if (confirmReplace && locales && !window.confirm(`Vas a reemplazar los ${nfNum.format(locales)} movimientos de este dispositivo por la copia del servidor (versión ${data.version}).\n\n¿Continuar?`)) {
        setSyncMsg({ kind: "info", text: "Cancelado. No se ha tocado nada." });
        return;
      }
      const n = applyBackupPayload(data.payload);
      persistSync({ version: data.version, lastPull: Date.now() });
      setSyncConflict(null);
      if (!silent) setSyncMsg({ kind: "ok", text: `Traídos ${nfNum.format(n)} movimientos (versión ${data.version}).` });
    } catch (e) { if (!silent) setSyncMsg({ kind: "err", text: "No se pudo traer: " + e.message }); }
    finally { setSyncBusy(false); }
  }, [applyBackupPayload, persistSync]);

  const syncBootRef = useRef(false);
  const syncTimer = useRef(null);
  const syncSuppressRef = useRef(0); // ventana tras un "traer" en la que NO se re-sube

  // Traer al abrir, una sola vez. Si hay conflicto no se aplica nada: decide la persona.
  useEffect(() => {
    if (!booted || syncBootRef.current) return;
    if (!syncCfg.auto || !bankBase()) return;
    // Al volver del banco manda el estado de ESTE dispositivo: traer aquí lo pisaría, que es
    // el fallo que ya nos costó una sesión bancaria.
    try { if (new URLSearchParams(window.location.search).has("bank_session")) return; } catch { /* noop */ }
    syncBootRef.current = true;
    syncSuppressRef.current = Date.now() + 6000;
    syncPull({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, syncCfg.auto]);

  // Guardar tras cambiar, con mucha espera. Si hay un conflicto sin resolver no se reintenta
  // en bucle: se espera a que la persona decida.
  useEffect(() => {
    if (!booted || !syncCfg.auto || !bankBase() || syncConflict) return;
    if (Date.now() < syncSuppressRef.current) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncPush({ silent: true }), 25000);
    return () => clearTimeout(syncTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs, rules, assets, groups, budgets, reducible, aiOn, ai, aiProfiles, aiDetail, ruleStats, materialidad, assetMem, syncCfg.auto, syncConflict, booted]);

  // Al cerrar o esconder la pestaña, volcar lo pendiente: el temporizador de 25 s se cancela
  // al desmontar y perderiamos el ultimo cambio.
  useEffect(() => {
    if (!booted || !syncCfg.auto) return;
    const flush = () => {
      if (document.visibilityState !== "hidden" || !bankBase() || syncConflict) return;
      clearTimeout(syncTimer.current);
      syncPush({ silent: true });
    };
    window.addEventListener("visibilitychange", flush);
    return () => window.removeEventListener("visibilitychange", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, syncCfg.auto, syncConflict]);

  /* ---------- Conexión bancaria (Enable Banking, vía el Worker) — MULTI-BANCO ---------- */
  const [bankCfg, setBankCfg] = useState(loadBank);
  // persistBank acepta un patch { ... } o una función (b) => nuevoEstado.
  const persistBank = useCallback((patchOrFn) => setBankCfg((b) => { const n = typeof patchOrFn === "function" ? patchOrFn(b) : { ...b, ...patchOrFn }; saveBank(n); return n; }), []);
  useEffect(() => { if (settingsOpen) setBankCfg(loadBank()); }, [settingsOpen]);
  useEffect(() => {
    const h = () => setBankCfg(loadBank());
    window.addEventListener("finz-bank-updated", h);
    return () => window.removeEventListener("finz-bank-updated", h);
  }, []);
  const [bankBusy, setBankBusy] = useState(false);
  const [bankMsg, setBankMsg] = useState(null);
  const [bankAspsps, setBankAspsps] = useState([]);          // lista de bancos del país cargado
  const [bankAccountsByConn, setBankAccountsByConn] = useState({}); // connId -> cuentas
  const [bankAddCountry, setBankAddCountry] = useState("ES");
  const [bankAddSel, setBankAddSel] = useState("");          // banco elegido para añadir
  const [bankDiag, setBankDiag] = useState(null);            // salida cruda del diagnóstico
  const [asistenteOpen, setAsistenteOpen] = useState(false); // asistente de conexión del backend
  const [bankAddPsu, setBankAddPsu] = useState("personal");  // titular: personal o empresa

  // Al volver del banco, ?bank_session=… : creamos una conexión con el banco que estaba pendiente.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const sid = p.get("bank_session");
      if (!sid) return;
      // Se decide aquí, con lo que hay en disco: el updater de persistBank corre más tarde y
      // leer su resultado desde este ámbito daría siempre el valor viejo.
      const disk = loadBank();
      // Un pending de hace horas es de un intento abandonado: usarlo hace que la sesión nueva
      // aterrice sobre la conexión que tocaba entonces y herede su cuenta caducada. La misma
      // regla tiene que valer aquí y dentro del updater, o el mensaje diría una cosa y el
      // estado haría otra.
      const isFresh = (pd) => !!pd && (!pd.at || Date.now() - pd.at < 30 * 60000);
      const renew = !!(isFresh(disk.pending) && disk.pending.reconnectId && (disk.connections || []).some((c) => c.id === disk.pending.reconnectId));
      persistBank((b) => {
        const pend = isFresh(b.pending) ? b.pending : {};
        // Reconectar un banco que ya estaba: se cambia la sesión de esa misma conexión. Antes se
        // añadía una conexión nueva y quedaba la vieja (muerta) al lado, sincronizando en balde.
        // La cuenta elegida NO se conserva: los uid de Enable Banking son por sesión y al renovar
        // cambian, así que el uid viejo filtraba a cero cuentas y la sincronización moría con
        // «la sesión no contiene esa cuenta». Se limpia y se vuelve a elegir.
        const target = pend.reconnectId && (b.connections || []).some((c) => c.id === pend.reconnectId) ? pend.reconnectId : null;
        if (target) return { ...b, pending: null, connections: (b.connections || []).map((c) => (c.id === target ? { ...c, sessionId: sid, accountUid: "", accountName: "", psu: pend.psu || c.psu || "", sessionPsu: pend.psu || "", lastError: null, lastErrorAt: null, expired: false } : c)) };
        const conn = { id: "bc" + Date.now() + Math.random().toString(36).slice(2, 5), aspsp: pend.aspsp || "Banco", country: pend.country || "ES", psu: pend.psu || "", sessionPsu: pend.psu || "", sessionId: sid, accountUid: "", accountName: "", lastSync: null };
        return { ...b, connections: [...(b.connections || []), conn], pending: null };
      });
      p.delete("bank_session");
      window.history.replaceState({}, "", window.location.pathname + (p.toString() ? "?" + p.toString() : ""));
      setBankMsg({ kind: "ok", text: renew ? "Permiso renovado. La cuenta hay que volver a elegirla (al renovar cambian los identificadores): pulsa «Ver cuentas» y luego Sincronizar." : "Banco conectado. Elige la cuenta y sincroniza." });
      setSettingsOpen(true);
    } catch { /* ignore */ }
  }, [persistBank]);

  const bankHeaders = () => { const b = loadBank(); return b.token ? { Authorization: "Bearer " + b.token } : {}; };
  // Sin límite de tiempo, una petición que no vuelve dejaba `bankBusy` en true y el candado de
  // sincronización atascado: los botones Sincronizar y Reconectar quedaban muertos y parecía
  // que la app ignoraba los clics. Todo lo bancario pasa por aquí.
  const bankFetch = async (path, ms = 45000) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      return await fetch(bankBase() + path, { headers: bankHeaders(), signal: ac.signal });
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`el backend no respondió en ${Math.round(ms / 1000)} s`);
      throw e;
    } finally { clearTimeout(t); }
  };
  const bankBase = () => (loadBank().workerUrl || "").replace(/\/+$/, "");

  const bankLoadAspsps = useCallback(async (country) => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    setBankBusy(true); setBankMsg(null);
    try {
      const res = await bankFetch(`/bank/aspsps?country=${encodeURIComponent(country || "ES")}`, 25000);
      if (!res.ok) throw new Error("el backend devolvió " + res.status);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.aspsps || []);
      const names = [...new Set(list.map((a) => a.name).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es"));
      setBankAspsps(names);
      setBankMsg({ kind: names.length ? "info" : "err", text: names.length ? `${names.length} bancos en ${country}. Elige el tuyo y pulsa Conectar.` : "No se han encontrado bancos para ese país." });
    } catch (e) { setBankMsg({ kind: "err", text: "No se pudieron cargar los bancos: " + e.message }); }
    finally { setBankBusy(false); }
  }, []);

  // Salida hacia el banco. `reconnectId` marca que volvemos a autorizar una conexión que ya
  // existe (renovar permiso) en vez de dar de alta otra.
  const bankStartAuth = useCallback((aspsp, country, reconnectId, psu) => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    if (!aspsp) { setBankMsg({ kind: "err", text: "Elige un banco de la lista." }); return; }
    const cty = (country || "ES").toUpperCase();
    // El pending tiene que estar EN DISCO antes de abandonar la página: persistBank solo
    // programa un cambio de estado y su updater (el que llama a saveBank) puede no llegar a
    // ejecutarse antes de la navegación. Por eso perdíamos el nombre del banco al volver.
    const next = { ...loadBank(), pending: { aspsp, country: cty, reconnectId: reconnectId || null, psu: psu || "", at: Date.now() } };
    saveBank(next);
    setBankCfg(next);
    // El tipo de titular viaja en la URL: pedir "personal" sobre cuentas de empresa deja firmar
    // el consentimiento y luego revienta cada petición de datos con ASPSP_ERROR.
    window.location.href = `${url}/bank/auth?aspsp=${encodeURIComponent(aspsp)}&country=${encodeURIComponent(cty)}${psu ? `&psu=${encodeURIComponent(psu)}` : ""}`;
  }, []);

  const bankAddConnect = useCallback(() => bankStartAuth(bankAddSel, bankAddCountry, null, bankAddPsu), [bankStartAuth, bankAddSel, bankAddCountry, bankAddPsu]);
  const bankReconnect = useCallback((connId) => {
    const c = (loadBank().connections || []).find((x) => x.id === connId);
    if (!c) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    bankStartAuth(c.aspsp, c.country, connId, c.psu || "");
  }, [bankStartAuth]);
  // Cambiar el tipo de titular de una conexión ya creada, para que Reconectar renueve bien.
  const bankSetPsu = useCallback((connId, psu) => persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, psu } : c)) })), [persistBank]);

  // Diagnóstico: pregunta al backend y enseña el estado y el cuerpo TAL CUAL. Es la única forma
  // de ver el error real de Enable Banking sin abrir la consola del navegador.
  const bankDiagnose = useCallback(async () => {
    const url = bankBase();
    if (!url) { setBankMsg({ kind: "err", text: "Pon la URL del backend (tu Worker)." }); return; }
    setBankBusy(true); setBankMsg(null);
    const probe = async (label, path) => {
      try {
        const r = await bankFetch(path, 30000);
        const body = (await r.text()).slice(0, 600).replace(/\s+/g, " ").trim();
        return `${label}: ${r.status} ${r.ok ? "OK" : "ERROR"} · ${body || "(sin cuerpo)"}`;
      } catch (e) { return `${label}: no se pudo conectar (${e.message})`; }
    };
    // El estado va primero: dice si el Worker ve el binding D1, el token y las credenciales.
    // Es lo que convierte "no me funciona" en un dato concreto.
    const lines = [await probe("configuración del Worker", "/store/status"), await probe("app Enable Banking", "/bank/ping"), await probe("bancos", "/bank/aspsps?country=ES")];
    for (const c of loadBank().connections || []) {
      // Lo PRIMERO, la configuración real de la conexión. Diagnosticar sin saber con qué se creó
      // la sesión viva lleva a probar dos veces lo mismo creyendo probar dos cosas distintas.
      lines.push(`config ${c.aspsp} · país=${c.country || "?"} · titular sesión=${c.sessionPsu || "desconocido"} · titular al reconectar=${c.psu || "personal"}`
        + ` · cuenta=${c.accountUid ? (c.accountName || c.accountUid.slice(0, 8)) : "todas"}${c.accountIban ? ` (IBAN ...${c.accountIban.slice(-6)})` : ""}`
        + ` · sesión=${c.sessionId ? c.sessionId.slice(0, 8) + "…" : "(ninguna)"}`);
      // La ficha del banco (validez máxima, psu_types, auth_methods) es lo que explica un
      // "invalid_request" al autorizar.
      lines.push(await probe(`ficha ${c.aspsp}`, `/bank/aspsp?name=${encodeURIComponent(c.aspsp || "")}&country=${encodeURIComponent(c.country || "ES")}`));
      lines.push(await probe(`cuentas ${c.aspsp}`, `/bank/accounts?session=${encodeURIComponent(c.sessionId)}`));
      // Se prueban varios valores del filtro de estado de una tacada: si el banco solo acepta
      // uno, una sola pulsación dice cuál, en vez de una ronda de despliegues por cada variante.
      const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      for (const st of ["BOOK", "ALL", "none"]) {
        lines.push(await probe(`movimientos ${c.aspsp} [estado=${st}]`, `/bank/transactions?session=${encodeURIComponent(c.sessionId)}&from=${desde}&tx_status=${st}`));
      }
    }
    setBankDiag(lines);
    setBankBusy(false);
  }, []);

  const bankLoadAccounts = useCallback(async (connId) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (!url || !conn || !conn.sessionId) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    setBankBusy(true); setBankMsg(null);
    try {
      const res = await bankFetch(`/bank/accounts?session=${encodeURIComponent(conn.sessionId)}`, 30000);
      if (!res.ok) throw new Error("el backend devolvió " + res.status);
      const data = await res.json();
      const list = Array.isArray(data.accounts) ? data.accounts : [];
      setBankAccountsByConn((m) => ({ ...m, [connId]: list }));
      // Al renovar el permiso los uid cambian y la cuenta elegida se queda huérfana. El IBAN sí
      // es estable: si lo tenemos guardado, se vuelve a enganchar sola en vez de obligarte a
      // reconocer tu cuenta entre identificadores opacos.
      let remap = null;
      if (!conn.accountUid && conn.accountIban) {
        const same = list.find((a) => a.iban && a.iban === conn.accountIban);
        if (same) { bankPickAccount(connId, same.uid, same.name || same.iban, same.iban); remap = same.name || same.iban; }
      }
      // Si el banco no da nombre ni IBAN, decirlo: si no, parece que la app no sabe leerlos.
      const opacas = list.filter((a) => !a.iban).length;
      setBankMsg({
        kind: "info",
        text: remap ? `Cuentas cargadas. He vuelto a seleccionar «${remap}» por su IBAN.`
          : `${list.length} cuentas de ${conn.aspsp}. Elige cuál seguir.` + (opacas ? ` El banco no da nombre ni IBAN para ${opacas === list.length ? "ellas" : `${opacas}`}: distínguelas por el saldo.` : ""),
      });
    } catch (e) { setBankMsg({ kind: "err", text: "No se pudieron cargar las cuentas: " + e.message }); }
    finally { setBankBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se guarda también el IBAN: los uid cambian en cada sesión, el IBAN no. Es lo que permite
  // reencontrar TU cuenta al renovar el permiso sin que tengas que adivinar entre hexadecimales.
  const bankPickAccount = useCallback((connId, uid, name, iban) => persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, accountUid: uid || "", accountName: name || "", accountIban: iban || (uid ? c.accountIban : "") || "" } : c)) })), [persistBank]);
  // Quitar un banco borraba solo la copia local y dejaba la sesión viva en Enable Banking y el
  // consentimiento colgado en el banco. Se revoca primero (sin bloquear: si falla, se quita igual).
  const bankRemoveConnection = useCallback(async (connId) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (url && conn?.sessionId) {
      try { await bankFetch(`/bank/revoke?session=${encodeURIComponent(conn.sessionId)}`, 15000); } catch { /* la limpieza remota es best-effort */ }
    }
    persistBank((b) => ({ ...b, connections: (b.connections || []).filter((c) => c.id !== connId) }));
  }, [persistBank]);

  // Ids de banco ya conocidos, en un ref. La deduplicación se hacía contra el `movs` capturado
  // al crear el callback: dos sincronizaciones solapadas (la automática al abrir no marca busy,
  // y tú pulsas Sincronizar) veían el mismo conjunto y metían lo mismo dos veces. El ref se
  // reconstruye con cada cambio de movs Y se amplía en el acto al aceptar movimientos, así la
  // segunda ingesta ve lo que acaba de entrar aunque React aún no haya vuelto a renderizar.
  const bankIdsRef = useRef(new Set());
  useEffect(() => { bankIdsRef.current = new Set(movs.filter((m) => m.bankId).map((m) => m.bankId)); }, [movs]);

  // Ingesta común: mapea, deduplica por id de banco, clasifica y añade. Devuelve nº nuevos.
  const ingestBankMovements = useCallback((list, sourceLabel) => {
    const existing = bankIdsRef.current;
    // Índice de movimientos NO bancarios (histórico manual / xlsx / CSV) por importe en céntimos,
    // para no duplicar contra ellos aunque el banco use otra fecha (±4 días) u otro concepto.
    // Así, si tu Excel llega hasta junio, el banco no vuelve a meter esos mismos movimientos.
    const nonBankByAmt = new Map();
    for (const m of movs) {
      if (m.bankId) continue;
      const cents = Math.round((Number(m.amount) || 0) * 100);
      const t = (m.date instanceof Date ? m.date : new Date(m.date)).getTime();
      if (!isNaN(t)) { if (!nonBankByAmt.has(cents)) nonBankByAmt.set(cents, []); nonBankByAmt.get(cents).push(t); }
    }
    const DAY = 86400000;
    const dupOfNonBank = (r) => {
      const arr = nonBankByAmt.get(Math.round((Number(r.amount) || 0) * 100));
      if (!arr) return false;
      const [y, mo, d] = String(r.date || "").split("-").map(Number);
      if (!(y && mo && d)) return false;
      const t = new Date(y, mo - 1, d, 12, 0, 0).getTime();
      return arr.some((t2) => Math.abs(t2 - t) <= 4 * DAY);
    };
    const fresh = list.filter((r) => {
      if (r.bankId && existing.has(r.bankId)) return false; // ya importado por el banco
      if (dupOfNonBank(r)) return false;                    // ya está en tu histórico (otra fuente)
      return true;
    }).map((r) => {
      const [y, mo, d] = String(r.date || "").split("-").map(Number);
      const date = (y && mo && d) ? new Date(y, mo - 1, d, 12, 0, 0) : new Date();
      return {
        id: MOV_ID++, date, concept: r.concept || "Sin concepto", amount: Math.round((Number(r.amount) || 0) * 100) / 100,
        saldo: null, pattern: normalizePattern(r.concept || ""), file: sourceLabel || "Banco", bankId: r.bankId || undefined,
        category: null, assetName: undefined, splits: null, groupIds: [], confirmed: false,
        ...(r.accountUid ? { accountUid: r.accountUid } : {}),
        ...(r.currency && r.currency !== "EUR" ? { currency: r.currency } : {}),
      };
    });
    if (!fresh.length) return 0;
    for (const m of fresh) if (m.bankId) existing.add(m.bankId); // visible ya para la siguiente ingesta
    const dec = classifyForImport(fresh, movs, rules, { materialidad, assetMem });
    const applied = fresh.map((m) => { const x = dec.get(m.id); return { ...m, category: x.cat, assetName: x.asset || undefined, confirmed: x.confirmed }; });
    for (const n of new Set(applied.map((a) => a.assetName).filter(Boolean))) ensureAsset(n);
    setMovs((ms) => [...ms, ...applied]);
    const pend = applied.filter((m) => !m.confirmed).length;
    if (pend > 0) { aiAutoRanRef.current = false; setPendingNotice(pend); }
    return fresh.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs, rules, materialidad]);

  // Candado: todas las sincronizaciones pasan por la misma cola. Es la segunda mitad de la
  // corrección de duplicados: aunque el ref de ids ya cierra la carrera, dos descargas
  // simultáneas del mismo banco siguen siendo trabajo tirado y peticiones de más al banco.
  // Resumen para la cabecera: cuándo fue la última sincronización y si algo está mal. Es lo que
  // evita tener que entrar en Ajustes para saber si el banco sigue vivo.
  const bankStatus = useMemo(() => {
    const conns = bankCfg.connections || [];
    if (!conns.length) return null;
    const last = Math.max(0, ...conns.map((c) => c.lastSync || 0));
    const expired = conns.some((c) => c.expired);
    const failed = conns.some((c) => c.lastError && (!c.lastSync || (c.lastErrorAt || 0) > c.lastSync));
    return { last, expired, failed, stale: last > 0 && Date.now() - last > 36 * 3600000 };
  }, [bankCfg]);

  const bankLockRef = useRef(Promise.resolve());
  const bankSyncOne = useCallback((connId, opts = {}) => {
    const run = () => bankSyncOneInner(connId, opts);
    const p = bankLockRef.current.then(run, run);
    bankLockRef.current = p.catch(() => {});
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingestBankMovements, persistBank]);
  const bankSyncOneInner = async (connId, opts = {}) => {
    const url = bankBase();
    const conn = (loadBank().connections || []).find((c) => c.id === connId);
    if (!url || !conn || !conn.sessionId) { setBankMsg({ kind: "err", text: "Conexión no válida." }); return; }
    if (!opts.silent) { setBankBusy(true); setBankMsg(null); }
    try {
      // Los uid de cuenta cambian al renovar el permiso, así que tras reconectar la cuenta
      // elegida se queda sin uid. Antes eso equivalía a "todas las cuentas" y mezclaba los
      // movimientos de las dos. El IBAN sí es estable: se reencuentra por él, y si no se
      // consigue se PARA. Ampliar el alcance sin avisar no es una opción aceptable.
      let accUid = conn.accountUid || "";
      if (!accUid && conn.accountIban) {
        const ra = await bankFetch(`/bank/accounts?session=${encodeURIComponent(conn.sessionId)}`, 25000);
        if (!ra.ok) throw new Error("no se pudo comprobar qué cuenta sincronizar: el backend devolvió " + ra.status);
        const la = (await ra.json()).accounts || [];
        const match = la.find((a) => a.iban && a.iban === conn.accountIban);
        if (!match) throw new Error(`la cuenta que sigues (IBAN ...${conn.accountIban.slice(-6)}) no aparece en la sesión nueva. Pulsa «Ver cuentas» y vuelve a elegirla; no sincronizo para no mezclar las dos cuentas.`);
        accUid = match.uid;
        bankPickAccount(connId, match.uid, match.name || match.iban, match.iban);
      }
      const acc = accUid ? `&account=${encodeURIComponent(accUid)}` : "";
      // Ventana reciente para el auto-sync (barato); en la sincronización manual, histórico completo.
      // Si la conexión lleva tiempo rota, 90 días fijos dejarían un agujero: ampliamos la ventana
      // hasta una semana antes del último movimiento que sí llegó.
      let days = opts.recentDays || 0;
      if (days && conn.lastNewest) {
        const gap = Math.ceil((Date.now() - new Date(conn.lastNewest + "T12:00:00").getTime()) / 86400000) + 7;
        if (gap > days) days = gap;
      }
      const since = days ? `&from=${new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)}` : "";
      const res = await bankFetch(`/bank/transactions?session=${encodeURIComponent(conn.sessionId)}${acc}${since}`, 60000);
      if (!res.ok) throw Object.assign(new Error("HTTP " + res.status + (await bankErrDetail(res))), { httpStatus: res.status });
      const data = await res.json();
      const rows = Array.isArray(data.movements) ? data.movements : [];
      // El Worker devuelve `errors:[{uid,error}]` por cuenta. Si una cuenta falla y otra no,
      // el 200 es legítimo (hay datos), pero el fallo hay que contarlo igual.
      const errs = Array.isArray(data.errors) ? data.errors.map((x) => (x && x.error) || String(x)) : [];
      // Y el backend puede devolver 200 con el error dentro (sesión muerta en Enable Banking).
      // Sin esto la app cantaba «sin novedades» durante meses con el permiso caducado.
      const inner = data.error || data.message || errs[0] || (data.ok === false ? "el backend devolvió ok:false" : null);
      if (!rows.length && inner) throw Object.assign(new Error(String(inner)), { httpStatus: 200 });
      const n = ingestBankMovements(rows, conn.aspsp || "Banco");
      const noId = Number(data.noId) || 0;
      // Fecha del movimiento más reciente que ha devuelto el banco: es lo único que de verdad
      // dice hasta dónde llega la conexión (lastSync solo dice cuándo preguntamos).
      const newest = rows.reduce((mx, r) => (r.date && r.date > mx ? r.date : mx), "");
      // Saldo real de la cuenta (no rompe la sincronización si falla).
      let bal = null;
      try {
        const rb = await bankFetch(`/bank/balance?session=${encodeURIComponent(conn.sessionId)}${acc}`, 25000);
        if (rb.ok) {
          const jb = await rb.json();
          const b0 = (jb.balances || []).find((x) => x.amount != null);
          if (b0) bal = { amount: b0.amount, currency: b0.currency || "EUR", at: b0.at || null };
        }
      } catch { /* saldo opcional */ }
      persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, lastSync: Date.now(), lastCount: rows.length, lastNewest: newest || c.lastNewest || null, lastError: errs.length ? errs.join(" · ") : null, lastErrorAt: errs.length ? Date.now() : null, expired: false, ...(bal ? { balance: bal.amount, balanceCur: bal.currency, balanceAt: bal.at } : {}) } : c)) }));
      // Distinguir «el banco no manda nada» de «llega pero ya lo tenías» es lo que permite
      // diagnosticar sin abrir la consola: por eso el mensaje dice ambas cifras.
      const detail = n ? `${nfNum.format(n)} movimientos nuevos de ${conn.aspsp}.`
        : rows.length ? `${conn.aspsp}: sin novedades (el banco devolvió ${nfNum.format(rows.length)} movimientos, todos repetidos${newest ? `; el más reciente es del ${newest}` : ""}).`
          : `${conn.aspsp}: el banco no ha devuelto ningún movimiento. Si esperabas movimientos nuevos, el permiso está caducado: pulsa Reconectar.`;
      // Sin referencia del banco la deduplicación es por contenido (cuenta+fecha+importe+concepto):
      // funciona, pero conviene saberlo si algún día aparece un repetido.
      const sinRef = noId ? ` ${nfNum.format(noId)} venían sin referencia del banco (deduplicados por contenido).` : "";
      if (!opts.silent || n || !rows.length) setBankMsg({ kind: rows.length || n ? "ok" : "err", text: detail + (bal ? ` Saldo: ${nfEUR.format(bal.amount)}.` : "") + sinRef });
    } catch (e) {
      // Antes el auto-sync silencioso se tragaba el error entero: la app parecía sana con la
      // conexión muerta. Ahora el fallo queda pegado a la conexión y se ve en Ajustes.
      const expired = e.httpStatus === 401 || e.httpStatus === 403 || e.httpStatus === 404 || /expired|caducad|invalid.*session|session.*(not found|invalid)|consent/i.test(e.message || "");
      persistBank((b) => ({ ...b, connections: (b.connections || []).map((c) => (c.id === connId ? { ...c, lastError: e.message, lastErrorAt: Date.now(), expired } : c)) }));
      if (!opts.silent) setBankMsg({ kind: "err", text: `${conn.aspsp}: ${e.message}${expired ? " — el permiso ha caducado, pulsa Reconectar." : ""}` });
    }
    finally { if (!opts.silent) setBankBusy(false); }
  };

  // Recoge lo que el Worker ha bajado del banco mientras la app estaba cerrada y lo ingiere
  // con la clasificación de siempre (reglas, memoria de activos, deduplicación). Solo después
  // se vacía la bandeja, y solo lo que se ha leído: si el cron metió algo entre medias, se
  // queda para la próxima en vez de perderse.
  const bankDrainInbox = useCallback(async (opts = {}) => {
    const url = bankBase();
    if (!url) return 0;
    try {
      const res = await bankFetch("/store/inbox", 30000);
      if (!res.ok) return 0;
      const data = await res.json();
      const rows = Array.isArray(data.movements) ? data.movements : [];
      if (!rows.length) return 0;
      const porOrigen = new Map();
      for (const r of rows) {
        const k = r._origen || "Banco";
        if (!porOrigen.has(k)) porOrigen.set(k, []);
        porOrigen.get(k).push(r);
      }
      let n = 0;
      for (const [origen, lista] of porOrigen) n += ingestBankMovements(lista, origen);
      await fetch(url + "/store/inbox", {
        method: "PUT", headers: { ...bankHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ bankIds: rows.map((r) => String(r.bankId)) }),
      });
      if (!opts.silent && n) setBankMsg({ kind: "ok", text: `${nfNum.format(n)} movimientos nuevos que el servidor había bajado por su cuenta.` });
      return n;
    } catch { return 0; }
  }, [ingestBankMovements]);

  const bankSyncAll = useCallback(async (opts = {}) => {
    const conns = loadBank().connections || [];
    if (!conns.length) { if (!opts.silent) setBankMsg({ kind: "err", text: "No hay bancos conectados." }); return; }
    for (const c of conns) await bankSyncOne(c.id, opts); // secuencial
  }, [bankSyncOne]);

  // Sincronización automática al abrir: si está activada y hace >12 h de la última, baja lo reciente
  // (ventana de 90 días, barata) de todos los bancos, en silencio. La dedup evita duplicados.
  const bankAutoRef = useRef(false);
  useEffect(() => {
    // Esperar a `booted` es obligatorio: antes esto arrancaba con el efecto de montaje y la
    // ingesta se hacía contra `movs` vacío, así que ni deduplicaba por bankId ni contra el
    // histórico, y encima el setMovs(ms) de la carga podía llegar después y borrar lo bajado.
    if (!booted || bankAutoRef.current) return; // solo un intento por carga
    const b = loadBank();
    if (!b.auto || !(b.connections || []).length) return;
    if (b.lastAuto && Date.now() - b.lastAuto < 12 * 3600000) return; // como mucho cada 12 h
    bankAutoRef.current = true;
    // El sello se pone al terminar, no antes: si el intento falla, no bloquea 12 h el siguiente.
    // La bandeja va primero: es lo que el servidor ya bajó por su cuenta, no cuesta ninguna
    // llamada al banco y suele traer todo lo pendiente.
    bankDrainInbox({ silent: true })
      .then(() => bankSyncAll({ silent: true, recentDays: 90 }))
      .finally(() => persistBank((prev) => ({ ...prev, lastAuto: Date.now() })));
    // También depende de la config del banco: en el móvil llega del servidor DESPUÉS de arrancar,
    // y con solo [booted] el efecto ya había pasado y no volvía a intentarlo en toda la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, bankCfg.auto, (bankCfg.connections || []).length]);

  // Copias de seguridad automáticas (snapshots): listar y restaurar
  const listSnaps = useCallback(async () => {
    const ts = await listSnapshots(STORE);
    const out = [];
    for (const t of ts) {
      const raw = await STORE.get(SNAP_PREFIX + t);
      let movsN = null;
      try { movsN = JSON.parse(raw)?.movs?.movs?.length ?? null; } catch { /* ignore */ }
      out.push({ ts, movs: movsN });
    }
    return out;
  }, []);
  const restoreSnapshot = useCallback(async (ts) => {
    try {
      const raw = await STORE.get(SNAP_PREFIX + ts);
      if (!raw) return { ok: false, text: "Esa copia ya no está disponible." };
      const p = JSON.parse(raw);
      const n = applyBackupPayload(p);
      return { ok: true, text: `Restaurada la copia del ${new Date(ts).toLocaleString("es-ES")}: ${nfNum.format(n)} movimientos.` };
    } catch (e) { return { ok: false, text: "No se pudo restaurar: " + e.message }; }
  }, [applyBackupPayload]);

  // Gobierno de reglas: auditoría en vivo y baja lógica.
  const rulesAudit = useCallback(() => auditRules(rules, movs, ruleStats), [rules, movs, ruleStats]);
  /* Apagar, no borrar. Borrar una regla de fábrica no servía de nada (al recargar se
     reconstruía desde DEFAULT_RULES) y borrar una tuya perdía su historial de uso.
     Una regla apagada se puede volver a encender. */
  const toggleRule = useCallback((id, active) => {
    setRules((rs) => rs.map((r) => (ruleId(r) === id ? { ...r, active } : r)));
  }, []);
  const removeCustomRule = useCallback((id) => {
    setRules((rs) => rs.filter((r) => !(ruleId(r) === id && r.scope === "personal")));
    setRuleStats((s) => { const n = { ...s }; delete n[id]; return n; });
  }, []);
  // Cambiar la categoría de una regla PERSONAL (para resolver una regla "en conflicto" con
  // un clic: dejarla apuntando a donde de verdad clasificas ahora).
  const updateRuleCat = useCallback((id, cat) => {
    if (!cat) return;
    setRules((rs) => rs.map((r) => (ruleId(r) === id && r.scope === "personal" ? { ...r, cat } : r)));
  }, []);

  /* ---------- Perfiles de IA (varias claves/modelos, cambio rápido) ---------- */
  const saveAiProfile = useCallback((label) => {
    const name = (label || "").trim() || aiProviderLabel(ai);
    const prof = { id: "aip" + Date.now(), label: name, provider: ai.provider, baseUrl: ai.baseUrl || "", model: ai.model || "", apiKey: ai.apiKey || "" };
    // Si ya hay un perfil con esa etiqueta, lo reemplaza (guardar de nuevo = actualizar).
    setAiProfiles((ps) => [...ps.filter((p) => p.label.toLowerCase() !== name.toLowerCase()), prof]);
  }, [ai]);
  const activateAiProfile = useCallback((prof) => {
    setAi({ provider: prof.provider || "claude", baseUrl: prof.baseUrl || "", model: prof.model || "", apiKey: prof.apiKey || "" });
    setAiOn(true);
  }, []);
  const deleteAiProfile = useCallback((id) => setAiProfiles((ps) => ps.filter((p) => p.id !== id)), []);


  /* ---------- Importación ---------- */
  const ensureAsset = useCallback((name) => {
    setAssets((as) => (as.some((a) => a.name === name) ? as : [...as, { id: "a" + Date.now() + name, name, emoji: ASSET_EMOJI[name] || "📦", categories: [] }]));
  }, []);
  const createAsset = useCallback(({ name, emoji }) => {
    setAssets((as) => (as.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? as : [...as, { id: "a" + Date.now(), name, emoji: emoji || ASSET_EMOJI[name] || "📦", categories: [] }]));
  }, []);

  const startImport = useCallback((text, fileName, isSample) => {
    setError(null);
    sampleRef.current = !!isSample;
    setImp({ phase: "parsing", fileName });
    setTimeout(() => {
      try {
        const delim = detectDelimiter(text);
        const rows = tokenizeCSV(text, delim);
        if (rows.length < 2) throw new Error("El archivo está vacío o no parece un CSV.");
        const analysis = analyzeRows(rows);
        if (analysis.error) throw new Error(analysis.error);
        if (!analysis.ok) { setImp({ phase: "mapping", fileName, rows, analysis }); return; }
        finishParse(rows, analysis.dataStart, analysis.cols, fileName, analysis);
      } catch (e) {
        setImp(null);
        setError(e.message + " Prueba a exportar de nuevo el extracto en formato CSV o usa el mapeo manual.");
      }
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movs]);

  const finishParse = (rows, dataStart, cols, fileName, analysis) => {
    const { movs: parsed, skipped, mismatches } = buildMovements(rows, dataStart, cols, fileName);
    if (parsed.length === 0) {
      const totalRows = Math.max(0, rows.length - dataStart);
      let sinFecha = 0, sinImporte = 0;
      for (let i = dataStart; i < rows.length; i++) {
        const r = rows[i];
        if (!parseDateAny(r[cols.date])) { sinFecha++; continue; }
        const amt = cols.amount >= 0 ? parseEsNumber(r[cols.amount])
          : (cols.cargo >= 0 ? parseEsNumber(r[cols.cargo]) : null) ?? (cols.abono >= 0 ? parseEsNumber(r[cols.abono]) : null);
        if (amt === null) sinImporte++;
      }
      const motivo = sinFecha >= sinImporte
        ? "la columna de Fecha no tiene un formato reconocible (usa DD/MM/AAAA o AAAA-MM-DD)"
        : "la columna de Importe no contiene números válidos";
      setImp({
        phase: "mapping", fileName, rows,
        analysis: analysis || { cols, headerIdx: dataStart - 1 },
        mapError: `Se han leído ${totalRows} filas con estas columnas, pero ninguna da un movimiento válido: ${motivo}. Revisa la asignación de columnas y la fila de cabecera.`,
      });
      return;
    }
    const { fresh, dupes } = dedupeAgainst(movs, parsed);
    setImp({ phase: "validate", fileName, rows, val: { movs: fresh, skipped, mismatches, fileName, dupes }, cols, dataStart });
  };

  const handleFiles = async (fileList) => {
    const file = fileList[0];
    if (!file) return;
    setError(null);
    // Una copia de seguridad (.json) no es un extracto: pasarla por el lector de CSV producía
    // un error sin sentido. Se detecta y se restaura por su camino.
    if (/\.json$/i.test(file.name) || file.type === "application/json") {
      const r = await importJSON(file);
      if (!r.ok) setError(r.text);
      return;
    }
    setImp({ phase: "parsing", fileName: file.name });
    try {
      const buf = await file.arrayBuffer();
      const text = decodeBuffer(buf);
      startImport(text, file.name, false);
    } catch (e) {
      setImp(null);
      setError("No se pudo leer el archivo: " + e.message);
    }
  };

  const loadSample = () => startImport(genSampleCSV(), "ejemplo-banco.csv", true);

  // Importar SIN muro: clasifica todo y lleva directo al dashboard.
  // Lo de alta confianza queda confirmado; lo dudoso entra como "por revisar"
  // (confirmed:false) y se resuelve con calma desde la vista de pendientes.
  const applyImport = (conv) => {
    try {
      // Conversión de divisa (tasa manual del paso de comprobación): pasamos los importes
      // a € ANTES de clasificar (las reglas por importe son en €), guardamos el original,
      // y quitamos el saldo extranjero para no mezclarlo con el balance del banco en €.
      const rate = conv && conv.rate && conv.rate !== 1 ? conv.rate : 1;
      const fresh = imp.val.movs.map((m) => {
        const base = { ...m, id: MOV_ID++ };
        if (rate !== 1) {
          base.origAmount = m.amount;
          base.currency = conv.currency;
          base.amount = Math.round(m.amount * rate * 100) / 100;
          base.saldo = null;
        }
        return base;
      });
      const decByMov = classifyForImport(fresh, movs, rules, { materialidad, assetMem });
      // Aplicar a los movimientos
      const assetNames = new Set();
      const applied = fresh.map((m) => {
        const d = decByMov.get(m.id);
        if (d.asset) assetNames.add(d.asset);
        return { ...m, category: d.cat, assetName: d.asset || undefined, confirmed: d.confirmed };
      });
      for (const n of assetNames) ensureAsset(n);

      // Telemetría por regla: cuántas veces disparó, cuánto dinero clasificó y cuándo.
      // Sin esto, auditar una regla solo dice "coincide con N movimientos"; con esto
      // dice "esta regla ha colocado 4.722 €", que es lo que de verdad importa.
      setRuleStats((prev) => {
        const next = { ...prev };
        for (const m of fresh) {
          const d = decByMov.get(m.id);
          if (!d?.rule) continue;
          const id = ruleId(d.rule);
          const s = next[id] || { n: 0, abs: 0, last: null };
          const t = m.date.getTime();
          next[id] = { n: s.n + 1, abs: r2c(s.abs + Math.abs(m.amount)), last: s.last && s.last > t ? s.last : t };
        }
        return next;
      });

      // Destilar reglas solo de lo fiable (para no volver a preguntar por esos comercios).
      // Se agrupa por patrón: una inferencia fiable sobre un comercio vale para todos sus cargos.
      setRules((rs) => {
        const have = new Set(rs.map((r) => r.k));
        const extra = [];
        const addRule = (k, cat, asset) => {
          if (k && !have.has(k) && !extra.some((e) => e.k === k)) {
            extra.push({ k, cat, asset: asset || undefined, prio: PRIO.personal, scope: "personal" });
          }
        };
        const seen = new Set();
        for (const m of fresh) {
          const d = decByMov.get(m.id);
          if (!d || !d.confirmed || d.source === "regla" || seen.has(m.pattern)) continue;
          if (d.source !== "comercio" && d.source !== "importe") continue;
          seen.add(m.pattern);
          const ent = merchantEntity(m.pattern);
          if (ent && ent.length >= 5 && !ENTITY_STOP.has(ent)) addRule(ent, d.cat, d.asset);
          else addRule(m.pattern, d.cat, d.asset);
        }
        return extra.length ? [...extra, ...rs] : rs;
      });
      setMovs((ms) => [...ms, ...applied]);
      if (sampleRef.current) { setGroups((gs) => (gs.length ? gs : SAMPLE_GROUPS.map((g) => ({ ...g })))); sampleRef.current = false; }
      const pend = applied.filter((m) => !m.confirmed).length;
      setImp(null);
      setTab("resumen");
      // Un CSV nuevo trae comercios nuevos: merece una ronda de sugerencias.
      if (pend > 0) aiAutoRanRef.current = false;
      if (pend > 0) setPendingNotice(pend); // aviso suave, no bloqueante
    } catch (e) {
      setImp(null);
      setError("No se ha podido importar: " + e.message + ". Vuelve a intentarlo.");
    }
  };

  /* ---------- Correcciones por contexto ---------- */
  // Aplicar clasificaciones desde el panel de pendientes: marca confirmados y destila reglas.
  const applyPending = useCallback((changes) => {
    if (!changes?.length) return;
    const byPattern = new Map(changes.map((c) => [c.pattern, c]));
    const assetNames = new Set();
    for (const c of changes) if (c.asset) assetNames.add(c.asset);
    for (const n of assetNames) ensureAsset(n);
    setMovs((ms) => ms.map((m) => {
      const c = byPattern.get(m.pattern);
      if (!c || m.confirmed) return m;
      return { ...m, category: c.cat, assetName: c.asset !== undefined ? (c.asset || null) : m.assetName, confirmed: true };
    }));
    setRules((rs) => {
      const have = new Set(rs.map((r) => r.k));
      const extra = [];
      const addRule = (k, cat, asset) => {
        if (k && !have.has(k) && !extra.some((e) => e.k === k)) {
          extra.push({ k, cat, asset: asset || undefined, prio: PRIO.personal, scope: "personal" });
        }
      };
      for (const c of changes) {
        // Clasificación manual → patrón exacto. Sugerencia de IA aceptada → entidad (generaliza).
        if (c.fromAI) {
          const ent = merchantEntity(c.pattern);
          if (ent && ent.length >= 5 && !ENTITY_STOP.has(ent)) addRule(ent, c.cat, c.asset);
          else addRule(c.pattern, c.cat, c.asset);
        } else {
          addRule(c.pattern, c.cat, c.asset);
        }
      }
      return extra.length ? [...extra, ...rs] : rs;
    });
    setPendingNotice(0);
  }, [ensureAsset]);

  // Corregir a mano es la señal de confirmación más fuerte que existe: si no marcamos
  // `confirmed`, el movimiento seguía apareciendo en «por clasificar» para siempre.
  const recat = (mov, cat, applySimilar) => {
    if (!cat) return;
    // Pasarela pura (PayPal, Stripe…): el patrón agrupa comercios reales distintos.
    // Ni cambiamos en bloque ni destilamos regla por patrón — clasificaría mal todos
    // los cargos futuros de la pasarela. Solo tocamos este movimiento.
    const proc = isProcessorPattern(mov.pattern);
    // Los Bizum son por persona/motivo: destilar una regla del patrón concreto solo genera
    // reglas de un solo uso que ensucian. Los Bizum recurrentes (alquileres) se gobiernan
    // con reglas condicionales por importe/día, no por patrón. Así que corregir un Bizum
    // cambia el movimiento (o los del mismo patrón, si lo pides) pero NO crea regla.
    const isBizum = /^BIZUM\b/.test(String(mov.pattern || ""));
    setMovs((ms) => ms.map((m) => {
      if (m.id === mov.id) return { ...m, category: cat, splits: null, confirmed: true };
      if (applySimilar && !proc && m.pattern === mov.pattern) return { ...m, category: cat, splits: m.splits, confirmed: true };
      return m;
    }));
    if (!proc && !isBizum) setRules((rs) => [{ k: mov.pattern, cat, prio: PRIO.personal, scope: "personal" }, ...rs.filter((r) => r.k !== mov.pattern)]);
  };
  // Aplicar una propuesta de reclasificación del asistente: reclasifica los ids a la categoría.
  // Reversible (puedes volver a corregir a mano); no crea reglas para no ensuciar con lotes.
  const applyReclassify = (p) => {
    const ids = new Set((p?.ids || []).map(Number));
    const cat = p?.categoria;
    if (!ids.size || !cat) return;
    setMovs((ms) => ms.map((m) => (ids.has(m.id) ? { ...m, category: cat, splits: null, confirmed: true } : m)));
    // Una correccion sin regla se repite cada mes. Se crea una regla personal por cada patron
    // afectado, saltando los que ya tienen una: asi la proxima importacion ya llega clasificada.
    const patrones = [...new Set(movs.filter((m) => ids.has(m.id)).map((m) => m.pattern).filter(Boolean))];
    if (patrones.length) {
      setRules((rs) => {
        const nuevas = patrones
          .filter((k) => !rs.some((r) => r.scope === "personal" && r.k === k && r.cat === cat))
          .map((k) => ({ k, cat, prio: PRIO.personal, scope: "personal" }));
        return nuevas.length ? [...nuevas, ...rs] : rs;
      });
    }
  };
  const reasset = (mov, assetName) => {
    if (assetName) ensureAsset(assetName);
    // Por movimiento individual: un mismo comercio puede repartirse entre activos
    // (p. ej. el taller que unas veces es del coche y otras de la moto).
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, assetName: assetName || null } : m)));
  };
  // Reasignar activo a TODOS los movimientos de un comercio (acción explícita "aplicar a todos")
  const reassetAll = (mov, assetName) => {
    if (assetName) ensureAsset(assetName);
    setMovs((ms) => ms.map((m) => (m.pattern === mov.pattern ? { ...m, assetName: assetName || null } : m)));
    // "Aplicar a todos" es intencion inequivoca: se recuerda para las proximas importaciones.
    // Quitar el activo tambien se respeta, borrando la entrada en vez de dejarla desactualizada.
    setAssetMem((p) => { const n = { ...p }; if (assetName) n[mov.pattern] = assetName; else delete n[mov.pattern]; return n; });
  };
  // Marcar un movimiento como extraordinario (herencia, venta puntual): fuera del análisis
  const toggleExtra = (mov) => {
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, extra: !m.extra } : m)));
  };
  const splitMov = (mov, splits) => {
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, splits, category: splits ? splits[0].cat : m.category } : m)));
  };
  // Apodo/nota por movimiento: un nombre humano para conceptos crípticos ("Impuestos"
  // en vez de "TRANSFER 4471…"). Repetido en varios movimientos, agrupa para gráficos.
  const setNote = (mov, note) => {
    const n = (note || "").trim().slice(0, 40);
    setMovs((ms) => ms.map((m) => (m.id === mov.id ? { ...m, note: n || undefined } : m)));
  };
  // Apodo a TODOS los movimientos del mismo comercio de una vez (nivel agrupado).
  const setNoteAll = (mov, note) => {
    const n = (note || "").trim().slice(0, 40);
    setMovs((ms) => ms.map((m) => (m.pattern === mov.pattern ? { ...m, note: n || undefined } : m)));
  };
  // Borrar movimientos = enviarlos a la PAPELERA (borrado suave): salen del análisis y de
  // las listas, pero se pueden rescatar desde Ajustes → Papelera. Se guarda cuándo.
  // Duplicados bancarios sospechosos: misma cuenta, fecha, importe y concepto normalizado, pero
  // distinta referencia. Ocurren cuando el banco cambia la referencia al liquidar (tarjetas) o
  // por sincronizaciones solapadas (ya corregido). Se devuelven en grupos, el más antiguo primero,
  // para que la persona decida: dos cafés iguales el mismo día también caen aquí.
  const findBankDupes = () => {
    const groups = new Map();
    for (const m of movs) {
      if (!m.bankId || m.omit) continue;
      const d = m.date instanceof Date ? m.date : new Date(m.date);
      // Sin accountUid a proposito: los uid cambian en cada sesion, asi que incluirlos dejaba
      // fuera del grupo el mismo movimiento reimportado tras reconectar — el duplicado que mas
      // importa detectar. Si tienes dos cuentas con un cargo identico el mismo dia tambien
      // agrupara: por eso esto es una lista para REVISAR, no un borrado automatico.
      const key = [isNaN(d.getTime()) ? "?" : d.toISOString().slice(0, 10), Math.round((Number(m.amount) || 0) * 100), m.pattern || normalizePattern(m.concept || "")].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    return [...groups.values()].filter((g) => g.length > 1).map((g) => [...g].sort((a, b) => a.id - b.id));
  };
  // Conserva el más antiguo de cada grupo y manda el resto a la papelera (reversible).
  const trashBankDupes = (groups) => deleteMovs(groups.flatMap((g) => g.slice(1).map((m) => m.id)));

  // Movimientos que PROVABLEMENTE son de otra cuenta del mismo banco.
  //
  // La versión anterior comparaba `m.accountUid !== keepUid` y era peligrosa: los uid de
  // Enable Banking son POR SESIÓN, así que los movimientos importados en sesiones anteriores
  // llevan uid antiguos de la MISMA cuenta y quedaban marcados como ajenos. Señalaba para
  // borrar justo los datos buenos.
  //
  // Ahora hace falta `knownUids`: los uid de las cuentas de la sesión ACTUAL (los que devuelve
  // «Ver cuentas»). Solo se señala lo que está en esa lista y no es la cuenta elegida. Lo que
  // viene de sesiones viejas no se puede clasificar, así que no se toca: ante la duda, nada.
  const otherAccountMovIds = (label, keepUid, knownUids) => {
    if (!keepUid || !Array.isArray(knownUids) || knownUids.length < 2) return [];
    const foreign = new Set(knownUids.filter((u) => u && u !== keepUid));
    if (!foreign.size) return [];
    return movs.filter((m) => m.bankId && !m.omit && (m.file || "") === label && m.accountUid && foreign.has(m.accountUid)).map((m) => m.id);
  };
  const trashOtherAccountMovs = (label, keepUid, knownUids) => {
    const ids = otherAccountMovIds(label, keepUid, knownUids);
    if (ids.length) deleteMovs(ids);
    return ids.length;
  };

  const deleteMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.map((m) => (set.has(m.id) ? { ...m, omit: Date.now() } : m)));
  };
  const restoreMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.map((m) => { if (!set.has(m.id)) return m; const { omit, ...rest } = m; return rest; }));
  };
  const purgeMovs = (ids) => {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    setMovs((ms) => ms.filter((m) => !set.has(m.id)));
  };
  const trashed = useMemo(() => movs.filter((m) => m.omit).sort((a, b) => b.omit - a.omit), [movs]);
  const deleteImport = (file) => setMovs((ms) => ms.filter((m) => (m.file || "(sin origen)") !== file));
  // Corregir el importe (en €) de UN movimiento: p. ej. un cargo en otra divisa dentro
  // de un CSV en euros. Se guarda el importe original y la divisa para transparencia.
  const setAmount = (mov, amount, meta) => {
    const a = Math.round(Number(amount) * 100) / 100;
    if (!isFinite(a) || a === 0) return;
    setMovs((ms) => ms.map((m) => (m.id === mov.id
      ? { ...m, amount: a, ...(meta && meta.currency ? { currency: meta.currency, origAmount: meta.origAmount } : {}) }
      : m)));
  };
  // Alta manual: mismo formato que un movimiento importado, marcado como confirmado y
  // con file "Manual" para poder distinguirlo (y borrar la tanda entera si hiciera falta).
  const addMov = (data) => {
    if (data.assetName) ensureAsset(data.assetName);
    const mov = {
      id: MOV_ID++, date: data.date, concept: data.concept, amount: data.amount, saldo: null,
      pattern: normalizePattern(data.concept), file: "Manual", category: data.category || null,
      assetName: data.assetName, splits: null, groupIds: [], confirmed: true, manual: true,
    };
    setMovs((ms) => [...ms, mov]);
    // Lleva la vista al mes del alta para que el usuario la vea de inmediato (si no, un
    // movimiento con fecha de hoy podría caer fuera del periodo filtrado y "no aparecer").
    setFilters((f) => ({ ...f, periodType: "month", month: monthKey(data.date), from: "", to: "" }));
  };
  // Edición manual de un movimiento existente. Si cambia la categoría o el signo, una
  // división previa deja de ser válida y se descarta (coherente con recategorizar a mano).
  const editMov = (mov, data) => {
    if (data.assetName) ensureAsset(data.assetName);
    setMovs((ms) => ms.map((m) => {
      if (m.id !== mov.id) return m;
      const catChanged = data.category != null && data.category !== m.category;
      const signFlipped = Math.sign(data.amount) !== Math.sign(m.amount);
      const keepSplits = m.splits && !catChanged && !signFlipped;
      return {
        ...m, date: data.date, amount: data.amount, concept: data.concept,
        pattern: normalizePattern(data.concept), category: data.category ?? m.category,
        assetName: data.assetName, splits: keepSplits ? m.splits : null, confirmed: true,
      };
    }));
  };
  // Cargas de datos: una por archivo importado, para poder borrar una entera.
  const imports = useMemo(() => {
    const map = new Map();
    for (const m of movs) {
      const f = m.file || "(sin origen)";
      let e = map.get(f);
      if (!e) { e = { file: f, count: 0, min: m.date, max: m.date }; map.set(f, e); }
      e.count++;
      if (m.date < e.min) e.min = m.date;
      if (m.date > e.max) e.max = m.date;
    }
    return [...map.values()].sort((a, b) => b.max - a.max);
  }, [movs]);

  /* ---------- Etiquetado de grupos de gasto ---------- */
  // Etiquetar identifica el comercio, no un cargo suelto: se aplica a TODOS los
  // movimientos del mismo patrón (los de nombre idéntico), no solo al que pulsas.
  // Excepciones: pasarelas (PayPal, Stripe…), donde cada cargo es un comercio distinto, y
  // operaciones genéricas del banco ("TRANSFER INMEDIATA", "BIZUM"), donde el patrón es el
  // tipo de operación y no el destinatario: ahí etiquetar uno arrastraba a todos los demás.
  const samePatternIds = (mov) => (identifiesMerchant(mov.pattern)
    ? movs.filter((m) => m.pattern === mov.pattern).map((m) => m.id)
    : [mov.id]);
  const toggleGroup = (mov, g) => {
    const ids = samePatternIds(mov);
    const idset = new Set(ids);
    setGroups((gs) => gs.map((x) => {
      if (x.id !== g.id) return x;
      const inNow = movInGroup(mov, x);
      let movementIds = x.movementIds || [];
      let excludedIds = x.excludedIds || [];
      if (inNow) {
        movementIds = movementIds.filter((id) => !idset.has(id));
        const byKw = (x.keywords || []).some((k) => k && stripAccents(mov.pattern.toUpperCase()).includes(stripAccents(k.toUpperCase())));
        if (byKw) excludedIds = [...new Set([...excludedIds, ...ids])];
      } else {
        excludedIds = excludedIds.filter((id) => !idset.has(id));
        movementIds = [...new Set([...movementIds, ...ids])];
      }
      return { ...x, movementIds, excludedIds };
    }));
  };
  const createGroupFromMov = (mov) => {
    const raw = (mov.pattern || mov.concept || "Grupo").trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Nueva etiqueta";
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const g = { id: "g" + Date.now(), name, emoji: "🏷️", color, keywords: [], movementIds: samePatternIds(mov), excludedIds: [] };
    setGroups((gs) => [...gs, g]);
    setDrill(null);
    // "Etiquetas" vive dentro del combo "Activos": hay que abrir esa pestaña y su sub-vista,
    // no una pestaña "grupos" que ya no existe (dejaba la pantalla en blanco).
    setTab("activos");
    setSubAct("etiquetas");
  };

  /* ---------- Rangos y agregados ---------- */
  const dataRange = useMemo(() => {
    if (!hasData) return null;
    let min = movs[0].date, max = movs[0].date;
    for (const m of movs) { if (m.date < min) min = m.date; if (m.date > max) max = m.date; }
    return [min, max];
  }, [movs, hasData]);

  const monthsAvail = useMemo(() => [...new Set(movs.map((m) => monthKey(m.date)))].sort(), [movs]);
  const yearsAvail = useMemo(() => [...new Set(movs.map((m) => m.date.getFullYear()))].sort(), [movs]);

  useEffect(() => {
    if (filters.periodType === "month" && !filters.month && monthsAvail.length) {
      setFilters((f) => ({ ...f, month: monthsAvail[monthsAvail.length - 1] }));
    }
    if (filters.periodType === "year" && yearsAvail.length && !yearsAvail.includes(filters.year)) {
      setFilters((f) => ({ ...f, year: yearsAvail[yearsAvail.length - 1] }));
    }
    if (filters.periodType === "custom" && dataRange && (!filters.from || !filters.to)) {
      setFilters((f) => ({ ...f, from: f.from || dataRange[0].toISOString().slice(0, 10), to: f.to || dataRange[1].toISOString().slice(0, 10) }));
    }
  }, [filters.periodType, filters.month, filters.year, filters.from, filters.to, monthsAvail, yearsAvail, dataRange]);

  const periodRange = useMemo(() => {
    if (!dataRange) return null;
    const f = filters;
    if (f.periodType === "year") return [new Date(f.year, 0, 1), new Date(f.year, 11, 31, 23, 59)];
    if (f.periodType === "month" && f.month) {
      const [y, m] = f.month.split("-").map(Number);
      return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59)];
    }
    if (f.periodType === "custom" && f.from && f.to) {
      const a = new Date(f.from), b = new Date(f.to); b.setHours(23, 59);
      return a <= b ? [a, b] : [b, a];
    }
    return dataRange;
  }, [filters, dataRange]);

  // Los movimientos en papelera (omit) no deben alimentar recurrentes, atípicos ni recibos.
  const liveMovs = useMemo(() => movs.filter((m) => !m.omit), [movs]);
  const recurring = useMemo(() => detectRecurring(liveMovs), [liveMovs]);
  const outliers = useMemo(() => computeOutliers(liveMovs), [liveMovs]);
  const receiptTrends = useMemo(() => analyzeReceiptTrends(liveMovs), [liveMovs]);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => { try { return new Set(JSON.parse(window.localStorage?.getItem("finz:dismissed:v1") || "[]")); } catch { return new Set(); } });
  const dismissAlert = useCallback((a) => setDismissedAlerts((s) => { const n = new Set(s); n.add(a.id); try { window.localStorage?.setItem("finz:dismissed:v1", JSON.stringify([...n])); } catch { /* cuota */ } return n; }), []);
  const alerts = useMemo(() => buildAlerts({ movs: liveMovs, budgets, receiptTrends, outliers }).filter((a) => !dismissedAlerts.has(a.id)), [liveMovs, budgets, receiptTrends, outliers, dismissedAlerts]);
  const upcoming = useMemo(() => upcomingCharges(movs, recurring, receiptTrends, dataRange ? dataRange[1] : null), [movs, recurring, receiptTrends, dataRange]);
  const momDelta = useMemo(() => {
    if (filters.periodType !== "month" || !filters.month) return null;
    const [y, mo] = filters.month.split("-").map(Number);
    const prevKey = monthKey(new Date(y, mo - 2, 1));
    let cur = 0, prev = 0;
    for (const m of movs) {
      if (m.amount >= 0 || m.extra || INTERNAL_SET.has(m.category || "Otros")) continue;
      const k = monthKey(m.date);
      if (k === filters.month) cur -= m.amount; else if (k === prevKey) prev -= m.amount;
    }
    if (prev <= 0) return null;
    return { delta: (cur - prev) / prev, prevKey };
  }, [filters.periodType, filters.month, movs]);
  const saldoSerie = useMemo(() => {
    const withSaldo = movs.filter((m) => m.saldo !== null && m.saldo !== undefined && isFinite(m.saldo));
    if (withSaldo.length < 5 || withSaldo.length < movs.length * 0.5) return null;
    const sorted = [...withSaldo].sort((a, b) => a.date - b.date);
    // Clave por día LOCAL: toISOString() pasa a UTC y en España desplazaría al día
    // anterior los movimientos de madrugada. new Date("AAAA-MM-DD") tiene el mismo
    // problema al reconstruirla, así que guardamos también el instante local.
    const byDay = new Map();
    for (const m of sorted) {
      const d = m.date;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byDay.set(key, { t: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), saldo: m.saldo });
    }
    return [...byDay.values()].map(({ t, saldo }) => ({ d: t, saldo }));
  }, [movs]);

  // Saldo REAL: suma de los saldos de las cuentas bancarias conectadas (si los hay).
  const bankSaldo = useMemo(() => {
    const conns = (bankCfg.connections || []).filter((c) => typeof c.balance === "number");
    return conns.length ? conns.reduce((s, c) => s + c.balance, 0) : null;
  }, [bankCfg]);
  const cierre = useMemo(() => buildMonthClose({ movs, receiptTrends, upcoming, saldoSerie, dataRange, realSaldo: bankSaldo }), [movs, receiptTrends, upcoming, saldoSerie, dataRange, bankSaldo]);

  const createGroupFromProposal = useCallback((p) => {
    setGroups((gs) => {
      if (gs.some((g) => g.name.toLowerCase() === p.nombre.toLowerCase())) return gs;
      return [...gs, { id: "g" + Date.now(), name: p.nombre, emoji: p.emoji || "🏷️", color: GROUP_COLORS[gs.length % GROUP_COLORS.length], keywords: p.keywords || [], movementIds: p.ids || [], excludedIds: [] }];
    });
  }, []);

  const makeAgg = useCallback((range, useFilters) => {
    const [a, b] = range;
    const byCat = new Map(), byAsset = new Map(), byAssetCat = new Map(), byAssetIncome = new Map();
    const bucketCat = new Map(), bucketTot = new Map();
    const byInternoCat = new Map();
    let gasto = 0, ingresos = 0, interno = 0;
    const parts = [];
    const catF = useFilters ? filters.cats : new Set();
    const assF = useFilters ? filters.assetsSel : new Set();
    const grpF = useFilters ? filters.groupsSel : new Set();
    let extraGasto = 0, extraIngreso = 0;
    // Un conjunto por signo. Con uno solo, el subtítulo de ingresos abría también los gastos
    // extraordinarios y al revés: cada anillo debe mostrar SOLO lo suyo. Un movimiento con
    // partes de los dos signos entra legítimamente en ambos.
    const extraGastoIds = new Set(), extraIngresoIds = new Set();
    const rangeDays = daysBetween(a, b);
    const isDay = rangeDays <= 32;
    const isYear = !isDay && granularity === "year";
    let dMin = null, dMax = null;
    for (const m of movs) {
      if (m.omit) continue; // en la papelera: fuera del análisis
      if (m.date < a || m.date > b) continue;
      // Los extraordinarios (herencia, ventas puntuales, una derrama) quedan fuera del análisis
      // para no distorsionar medias y proyecciones, pero se contabilizan aparte: excluirlos sin
      // decirlo hacía que el total del gráfico no cuadrase con el dinero que salió de verdad.
      if (m.extra) {
        if (grpF.size) {
          const inSelX = groups.some((g) => grpF.has(g.name) && movInGroup(m, g));
          if (!inSelX) continue;
        }
        for (const p of expandParts(m, assets)) {
          if (catF.size && !catF.has(p.cat)) continue;
          if (assF.size && (!p.asset || !assF.has(p.asset))) continue;
          if (p.amount < 0) { extraGasto -= p.amount; extraGastoIds.add(m.id); }
          else if (p.amount > 0) { extraIngreso += p.amount; extraIngresoIds.add(m.id); }
        }
        continue;
      }
      if (grpF.size) {
        const inSel = groups.some((g) => grpF.has(g.name) && movInGroup(m, g));
        if (!inSel) continue;
      }
      for (const p of expandParts(m, assets)) {
        if (catF.size && !catF.has(p.cat)) continue;
        if (assF.size && (!p.asset || !assF.has(p.asset))) continue;
        parts.push(p);
        if (!dMin || m.date < dMin) dMin = m.date;
        if (!dMax || m.date > dMax) dMax = m.date;
        const bk = isDay ? m.date.toISOString().slice(0, 10) : isYear ? String(m.date.getFullYear()) : monthKey(m.date);
        if (!bucketTot.has(bk)) bucketTot.set(bk, { gasto: 0, ingreso: 0 });
        if (INTERNAL_SET.has(p.cat)) {
          // Traspaso entre cuentas propias / ahorro-inversión: ni gasto ni ingreso. La
          // SALIDA (negativa) suma a "interno"; el RETORNO (positivo) no cuenta como ingreso
          // (es tu propio dinero volviendo), para no inflar ingresos ni el ahorro.
          if (p.amount < 0) {
            const v = -p.amount;
            interno += v;
            byInternoCat.set(p.cat, (byInternoCat.get(p.cat) || 0) + v);
          }
        } else if (p.amount < 0 || isRefundPart(p)) {
          // Gasto: negativo = gasto normal; positivo con categoría de gasto explícita =
          // DEVOLUCIÓN, que resta del gasto de esa categoría en vez de contar como ingreso.
          const v = -p.amount; // negativo cuando es una devolución
          gasto += v;
          byCat.set(p.cat, (byCat.get(p.cat) || 0) + v);
          bucketTot.get(bk).gasto += v;
          if (!bucketCat.has(bk)) bucketCat.set(bk, new Map());
          const bc = bucketCat.get(bk);
          bc.set(p.cat, (bc.get(p.cat) || 0) + v);
          if (p.asset) {
            byAsset.set(p.asset, (byAsset.get(p.asset) || 0) + v);
            if (!byAssetCat.has(p.asset)) byAssetCat.set(p.asset, new Map());
            const mm = byAssetCat.get(p.asset);
            mm.set(p.cat, (mm.get(p.cat) || 0) + v);
          }
        } else {
          ingresos += p.amount;
          bucketTot.get(bk).ingreso += p.amount;
          if (p.asset) byAssetIncome.set(p.asset, (byAssetIncome.get(p.asset) || 0) + p.amount);
        }
      }
    }
    const mesesData = dMin ? monthsCoveredOf(dMin, dMax) : 1;
    const annualFactor = 12 / mesesData;
    const topCats = [...byCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([c]) => c);
    const topSet = new Set(topCats);
    const buckets = [...bucketTot.keys()].sort((x, y) => x.localeCompare(y)).map((k) => {
      const obj = { label: isDay ? fmtDateShort(new Date(k)) : isYear ? k : monthLabel(k), _key: k, gasto: Math.round(bucketTot.get(k).gasto * 100) / 100, ingreso: Math.round(bucketTot.get(k).ingreso * 100) / 100 };
      const bc = bucketCat.get(k) || new Map();
      let resto = 0;
      for (const [c, v] of bc) { if (topSet.has(c)) obj[c] = Math.round(v * 100) / 100; else resto += v; }
      for (const c of topCats) if (!(c in obj)) obj[c] = 0;
      obj.Resto = Math.round(resto * 100) / 100;
      return obj;
    });
    const assetsArr = assets.map((x) => ({ ...x, total: byAsset.get(x.name) || 0 }));
    return {
      parts, gasto, ingresos, interno, byCat, byInternoCat, byAsset, byAssetCat, byAssetIncome, buckets, topCats, assets: assetsArr,
      extraGasto, extraIngreso, extraGastoIds: [...extraGastoIds], extraIngresoIds: [...extraIngresoIds],
      rangeDays, mesesData, annualFactor, mediaMensual: gasto / mesesData, gastoProj: gasto * annualFactor,
    };
  }, [movs, assets, groups, filters.cats, filters.assetsSel, filters.groupsSel, granularity]);

  const agg = useMemo(() => (periodRange ? makeAgg(periodRange, true) : null), [makeAgg, periodRange]);
  // Movimientos que respetan TODOS los filtros de arriba (fecha, categorías, activos,
  // grupos) y sin los de la papelera. Para la pestaña Clasificación.
  const filteredMovs = useMemo(() => {
    const catF = filters.cats, assF = filters.assetsSel, grpF = filters.groupsSel;
    return movs.filter((m) => {
      if (m.omit) return false;
      if (periodRange && (m.date < periodRange[0] || m.date > periodRange[1])) return false;
      if (grpF.size && !groups.some((g) => grpF.has(g.name) && movInGroup(m, g))) return false;
      if (catF.size || assF.size) {
        const parts = expandParts(m, assets);
        if (catF.size && !parts.some((p) => catF.has(p.cat))) return false;
        if (assF.size && !parts.some((p) => p.asset && assF.has(p.asset))) return false;
      }
      return true;
    });
  }, [movs, periodRange, filters.cats, filters.assetsSel, filters.groupsSel, groups, assets]);
  const allAgg = useMemo(() => (dataRange ? makeAgg(dataRange, false) : null), [makeAgg, dataRange]);

  const agentCtx = useMemo(() => ({
    movs, assets, groups, budgets, receiptTrends, recurring, dataRange,
    mesesData: allAgg?.mesesData || 0,
  }), [movs, assets, groups, budgets, receiptTrends, recurring, dataRange, allAgg]);

  const monthlySpark = useMemo(() => {
    const m = new Map();
    for (const mv of movs) { if (mv.amount >= 0 || INTERNAL_SET.has(mv.category || "Otros")) continue; const k = monthKey(mv.date); m.set(k, (m.get(k) || 0) + (-mv.amount)); }
    return [...m.keys()].sort().slice(-12).map((k) => Math.round(m.get(k)));
  }, [movs]);

  const makeGroupStats = useCallback((range) => {
    const map = new Map();
    // total = gasto (se mantiene para orden y desglose por categoría). Añadimos ingreso
    // y gasto por separado para poder mostrar ingresos, gastos y neto en la etiqueta.
    for (const g of groups) map.set(g.id, { total: 0, ingreso: 0, gasto: 0, count: 0, byCat: new Map(), byYear: new Map() });
    const a = range ? range[0] : null, b = range ? range[1] : null;
    for (const m of movs) {
      if (m.omit) continue;
      if (range && (m.date < a || m.date > b)) continue;
      for (const g of groups) {
        if (!movInGroup(m, g)) continue;
        const s = map.get(g.id);
        s.count++;
        for (const p of expandParts(m, assets)) {
          if (p.amount < 0) {
            const v = -p.amount;
            s.total += v; s.gasto += v;
            s.byCat.set(p.cat, (s.byCat.get(p.cat) || 0) + v);
            const y = m.date.getFullYear();
            s.byYear.set(y, (s.byYear.get(y) || 0) + v);
          } else {
            s.ingreso += p.amount;
          }
        }
      }
    }
    return map;
  }, [movs, groups, assets]);

  const groupStats = useMemo(() => makeGroupStats(periodRange), [makeGroupStats, periodRange]);
  const allGroupStats = useMemo(() => makeGroupStats(dataRange), [makeGroupStats, dataRange]);

  /* Atípicos reactivos al rango: la referencia de "lo normal" se calcula DENTRO del
     periodo elegido, no sobre todo el histórico. Así, al mirar 2025, lo atípico es lo
     atípico de 2025. (Los avisos del resumen siguen usando la base global, que es lo
     correcto para "gasto atípico reciente".) */
  const outlierMovs = useMemo(() => {
    if (!periodRange) return [];
    const [a, b] = periodRange;
    const inRange = liveMovs.filter((m) => m.date >= a && m.date <= b);
    const info = computeOutliers(inRange);
    return inRange.filter((m) => info.has(m.id)).map((m) => ({ ...m, _out: info.get(m.id) })).sort((x, y) => x.amount - y.amount);
  }, [liveMovs, periodRange]);

  const onPickMonth = useCallback((label) => {
    const bk = agg?.buckets.find((x) => x.label === label);
    if (!bk) return;
    const key = bk._key;
    if (/^\d{4}-\d{2}$/.test(key)) setFilters((f) => ({ ...f, periodType: "month", month: key }));
    else if (/^\d{4}$/.test(key)) setFilters((f) => ({ ...f, periodType: "year", year: +key }));
  }, [agg]);


  /* ---------- Render ---------- */
  const TABS = [
    { id: "resumen", label: "Resumen", icon: LayoutGrid },
    { id: "analisis", label: "Análisis", icon: TrendingUp },
    { id: "clasificar", label: "Clasificación", short: "Clasif.", icon: ClipboardList },
    { id: "activos", label: "Activos", icon: Car },
    { id: "ideas", label: "Ideas", icon: Sparkles },
    { id: "asistente", label: "Asistente", icon: Bot },
  ];

  return (
    <div className="min-h-screen overflow-x-clip" style={{ background: C.bg, color: C.ink }}>
      {!booted && (
        <div className="flex min-h-screen items-center justify-center"><Spinner label="Abriendo tus finanzas…" /></div>
      )}
      {booted && (<>
      <style>{`
        /* --- Tipografía. Inter si el shell de la PWA la sirve; si no, la del sistema. --- */
        :root {
          --font-sans: "Inter var", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          --scrollbar: #D9D9DE; --scrollbar-hover: #BFBFC6;
        }
        html, body { font-family: var(--font-sans); }
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        h1, h2, h3 { letter-spacing: -0.012em; }
        .text-2xl, .text-xl { letter-spacing: -0.018em; }

        /* --- Modo oscuro. El tema se fija en <html data-theme>. Las reglas de abajo
               reasignan las utilidades de Tailwind que la app usa de verdad: como llevan
               un atributo delante, ganan en especificidad sin necesidad de !important. --- */
        :root[data-theme="dark"] { color-scheme: dark; --scrollbar: #3A3F4A; --scrollbar-hover: #4C525F; }
        :root[data-theme="dark"] .bg-white { background-color: ${TOKENS.dark.surface} }
        :root[data-theme="dark"] .bg-slate-50 { background-color: ${TOKENS.dark.surfaceAlt} }
        :root[data-theme="dark"] .bg-slate-100 { background-color: #232730 }
        :root[data-theme="dark"] .bg-slate-200, :root[data-theme="dark"] .bg-slate-200\\/70 { background-color: #2C313B }
        :root[data-theme="dark"] .text-slate-300 { color: ${TOKENS.dark.faint} }
        :root[data-theme="dark"] .text-slate-400 { color: ${TOKENS.dark.faint} }
        :root[data-theme="dark"] .text-slate-500 { color: ${TOKENS.dark.muted} }
        :root[data-theme="dark"] .text-slate-600 { color: ${TOKENS.dark.muted} }
        :root[data-theme="dark"] .text-slate-700 { color: ${TOKENS.dark.ink2} }
        :root[data-theme="dark"] .text-slate-800, :root[data-theme="dark"] .text-slate-900 { color: ${TOKENS.dark.ink} }
        :root[data-theme="dark"] .hover\\:bg-slate-50:hover, :root[data-theme="dark"] .hover\\:bg-white:hover { background-color: ${TOKENS.dark.surfaceAlt} }
        :root[data-theme="dark"] .hover\\:bg-slate-100:hover { background-color: #232730 }
        :root[data-theme="dark"] .hover\\:text-slate-800:hover { color: ${TOKENS.dark.ink} }
        :root[data-theme="dark"] .bg-blue-50, :root[data-theme="dark"] .hover\\:bg-blue-50:hover { background-color: ${TOKENS.dark.accentSoft} }
        :root[data-theme="dark"] .text-blue-600, :root[data-theme="dark"] .text-blue-700 { color: ${TOKENS.dark.accent} }
        :root[data-theme="dark"] .bg-rose-50, :root[data-theme="dark"] .bg-rose-50\\/50,
        :root[data-theme="dark"] .bg-rose-100, :root[data-theme="dark"] .hover\\:bg-rose-50:hover { background-color: ${TOKENS.dark.expenseSoft} }
        :root[data-theme="dark"] .border-rose-200 { border-color: #5A2A31 }
        :root[data-theme="dark"] .text-rose-600, :root[data-theme="dark"] .text-rose-700,
        :root[data-theme="dark"] .text-rose-800, :root[data-theme="dark"] .hover\\:text-rose-600:hover { color: ${TOKENS.dark.expense} }
        :root[data-theme="dark"] .text-emerald-700 { color: ${TOKENS.dark.income} }
        :root[data-theme="dark"] .text-amber-700 { color: ${TOKENS.dark.warn} }
        :root[data-theme="dark"] .shadow-sm, :root[data-theme="dark"] .shadow-md,
        :root[data-theme="dark"] .shadow-xl, :root[data-theme="dark"] .shadow-2xl { box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35) }

        @keyframes animFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes animRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes animSlide { from { transform: translateX(24px); opacity: .6 } to { transform: none; opacity: 1 } }
        @keyframes animSheet { from { transform: translateY(16px); opacity: .4 } to { transform: none; opacity: 1 } }
        @keyframes animDrawer { from { transform: translateX(-100%) } to { transform: none } }
        .anim-fade { animation: animFade .18s ease-out }
        .anim-rise { animation: animRise .28s cubic-bezier(.22,1,.36,1) }
        .anim-slide { animation: animSlide .26s cubic-bezier(.22,1,.36,1) }
        .anim-sheet { animation: animSheet .24s cubic-bezier(.22,1,.36,1) }
        .anim-drawer { animation: animDrawer .24s cubic-bezier(.22,1,.36,1) }
        @media (prefers-reduced-motion: reduce) { .anim-fade,.anim-rise,.anim-slide,.anim-sheet,.anim-drawer { animation: none } }
        /* Botones y tarjetas: transición corta y con curva de salida, nunca en color de texto */
        button, a, .card-hover { transition: background-color .15s ease-out, border-color .15s ease-out, transform .15s cubic-bezier(.22,1,.36,1) }
        button:active { transform: scale(.97) }
        input[type=range]::-webkit-slider-thumb { cursor: pointer }
        ::-webkit-scrollbar { width: 10px; height: 10px }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 8px; border: 2px solid transparent; background-clip: content-box }
        ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); background-clip: content-box }
        .chat-bar { position: sticky; top: var(--app-header-h, 0px); z-index: 10; }
        .chat-dock { position: sticky; bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 640px) { .chat-dock { bottom: .5rem } }
        /* iOS hace zoom al enfocar un input con fuente <16px y descuadra la pantalla.
           Forzamos 16px en los campos de texto en móvil (mantiene el pinch-zoom). */
        @media (max-width: 640px) { input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select { font-size: 16px !important } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important } }
      `}</style>

      {!hasData ? (
        <EmptyState onFiles={handleFiles} onSample={loadSample} error={error} parsing={imp?.phase === "parsing"}
          onSettings={() => setSettingsOpen(true)} onAsistente={() => setAsistenteOpen(true)} />
      ) : (
        <div className="mx-auto max-w-5xl px-4 pb-24 sm:pb-12">
          <header ref={headerRef} className="sticky top-0 z-20 -mx-4 mb-3 px-4 py-3 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)` }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,.14)" }}><Wallet size={18} /></span>
                <div className="flex min-w-0 flex-col leading-tight">
                  <h1 className="truncate text-base font-semibold tracking-tight">Mis finanzas</h1>
                  {dataRange && <span className="truncate text-[11px] text-white/55" style={tnum}>{nfNum.format(movs.length)} movimientos · {fmtDate(dataRange[0])} – {fmtDate(dataRange[1])}</span>}
                  {/* Estado del banco a la vista. Rojo = permiso caducado o error; ámbar = lleva más
                      de día y medio sin sincronizar; verde = al día. Pulsar abre Ajustes. */}
                  {bankStatus && (
                    <button type="button" onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 truncate text-left text-[11px] text-white/55 hover:text-white/85 focus-visible:outline-none" style={tnum}
                      title={bankStatus.expired ? "El permiso del banco ha caducado: reconecta en Ajustes" : bankStatus.failed ? "La última sincronización falló: mira Ajustes" : bankStatus.last ? new Date(bankStatus.last).toLocaleString("es-ES") : "Aún no se ha sincronizado"}>
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: bankStatus.expired || bankStatus.failed ? "#f87171" : bankStatus.stale || !bankStatus.last ? "#fbbf24" : "#4ade80" }} />
                      <span className="truncate">
                        {bankStatus.expired ? "Permiso del banco caducado · reconectar" : bankStatus.failed ? "Error al sincronizar con el banco" : bankStatus.last ? `Banco sincronizado ${fmtAgo(bankStatus.last)}` : "Banco sin sincronizar"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDrill({ type: "search", key: "buscador", label: "Buscar movimientos" })} aria-label="Buscar movimientos"
                  className="rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  <Search size={17} />
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-within:ring-2 focus-within:ring-white/60" style={{ background: "rgba(255,255,255,.14)" }}>
                  <Plus size={15} /> <span className="hidden sm:inline">Añadir CSV</span><span className="sm:hidden">CSV</span>
                  <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ""; }} />
                </label>
                {movsPend.length > 0 && (
                  <button type="button" onClick={() => setPendingOpen(true)} aria-label="Movimientos por clasificar"
                    className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" style={{ background: "rgba(244,192,99,.25)" }}>
                    <ClipboardList size={15} />
                    <span className="tabular-nums">{movsPend.length}</span>
                    <span className="hidden sm:inline">por revisar</span>
                  </button>
                )}
                <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                  title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
                  className="rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Ajustes y datos" title={saveState === "saved" ? "Todo guardado" : saveState === "saving" ? "Guardando…" : "No se pudo guardar"}
                  className="relative rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  <Settings size={17} />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: saveState === "error" ? "#FF8A94" : saveState === "saving" ? "#F4C063" : "#5FD4B0", transition: "background .3s" }} />
                </button>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-4 flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>{error}</div></div>
              <button type="button" onClick={() => setError(null)} aria-label="Cerrar aviso" className="rounded p-0.5 hover:bg-rose-100"><X size={14} /></button>
            </div>
          )}
          {imp?.phase === "parsing" && <Card className="mb-4 p-4"><Spinner label={`Leyendo ${imp.fileName}…`} /></Card>}

          <nav className="mb-4 hidden gap-1 border-b sm:flex" style={{ borderColor: C.line }} aria-label="Secciones">
            {TABS.map((t) => {
              const I = t.icon;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tab === t.id ? "" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  style={tab === t.id ? { borderColor: C.accent, color: C.accent } : {}}>
                  <I size={15} /> {t.label}
                </button>
              );
            })}
          </nav>

          {tab !== "asistente" && agg && (
            <div className="mb-4">
              <FiltersBar filters={filters} setFilters={setFilters} monthsAvail={monthsAvail} yearsAvail={yearsAvail} assets={assets} groups={groups} />
            </div>
          )}

          {tab === "resumen" && agg && (
            <ResumenTab agg={agg} allAgg={allAgg} granularity={granularity} setGranularity={setGranularity} onDrill={setDrill} onPickMonth={onPickMonth}
              outlierMovs={outlierMovs} recurring={recurring} monthlySpark={monthlySpark} saldoSerie={saldoSerie} momDelta={momDelta} alerts={alerts} cierre={cierre} onOpenPending={() => setPendingOpen(true)} onDismissAlert={dismissAlert} />
          )}
          {tab === "analisis" && agg && (
            <div className="space-y-4 anim-rise">
              <GastoCalendar movs={filteredMovs} meses={monthsAvail} onDrill={setDrill}
                mesFiltro={filters.periodType === "month" ? filters.month : null}
                onPickMes={(k) => setFilters((f) => ({ ...f, periodType: "month", month: k }))} />
              <ExtraordinariosCard movs={filteredMovs} onDrill={setDrill} />
              <Card className="p-4">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">Desglose jerárquico</h2>
                  <span className="text-xs text-slate-400">Pulsa una fila para expandir o ver el detalle</span>
                </div>
                <p className="mb-3 text-xs text-slate-500">Gastos por supra categoría → categoría → comercio (o por activo), e ingresos por origen. Respeta los filtros de arriba.</p>
                <HierarchyExplorer parts={agg.parts} assets={assets} onDrill={setDrill} />
              </Card>
            </div>
          )}
          {tab === "clasificar" && agg && <ClasificacionTab movs={filteredMovs} assets={assets} groups={groups}
            onRecat={recat} onReasset={reasset} onReassetAll={reassetAll} onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov} onCreateAsset={createAsset}
            onNote={setNote} onNoteAll={setNoteAll} onToggleExtra={toggleExtra} onDelete={deleteMovs} onSetAmount={setAmount} outliers={outliers} onOpenPending={() => setPendingOpen(true)}
            onNewMov={() => setMovEdit({ mode: "new" })} onEditMov={(m) => setMovEdit({ mode: "edit", mov: m })} />}
          {tab === "activos" && agg && (
            <div className="space-y-4">
              <div className="flex"><Seg ariaLabel="Activos o etiquetas" value={subAct} onChange={setSubAct}
                options={[{ v: "activos", l: "🏠 Activos" }, { v: "etiquetas", l: "🏷️ Etiquetas" }]} /></div>
              {subAct === "activos"
                ? <ActivosTab assets={assets} setAssets={setAssets} agg={agg} allAgg={allAgg} onDrill={setDrill} periodLabel={describePeriod(filters)} />
                : <GruposTab groups={groups} setGroups={setGroups} groupStats={groupStats} allGroupStats={allGroupStats}
                    movsAll={movs} annualFactor={allAgg.annualFactor} mesesData={allAgg.mesesData} onDrill={setDrill} />}
            </div>
          )}
          {tab === "ideas" && agg && (
            <div className="space-y-4">
              <div className="flex"><Seg ariaLabel="Recap, ideas o plan" value={subIdea} onChange={setSubIdea}
                options={[{ v: "recap", l: "📅 Recap" }, { v: "ideas", l: "✨ Ideas" }, { v: "plan", l: "🎯 Plan" }]} /></div>
              {subIdea === "recap"
                ? <MonthRecap movs={movs} onDrill={setDrill} />
                : subIdea === "ideas"
                ? <InteligenciaTab movs={movs} agg={agg} allAgg={allAgg}
                    recurring={recurring} receiptTrends={receiptTrends} outlierMovs={outlierMovs} reducible={reducible} onDrill={setDrill} />
                : <PlanTab budgets={budgets} setBudgets={setBudgets} movs={movs} monthsAvail={monthsAvail} allAgg={allAgg}
                    agg={agg} reducible={reducible} setReducible={setReducible} recurring={recurring}
                    receiptTrends={receiptTrends} upcoming={upcoming} onDrill={setDrill} />}
            </div>
          )}
          {tab === "asistente" && <AsistenteTab aiOn={aiOn} setAiOn={setAiOn} hasData={hasData} ctx={agentCtx} ai={ai} aiDetail={aiDetail} onCreateProposal={createGroupFromProposal} onApplyReclassify={applyReclassify} onOpenSettings={() => setSettingsOpen(true)} msgs={chatMsgs} setMsgs={setChatMsgs}
            conversations={chatStore.convs} activeId={chatStore.activeId} onNewChat={newChat} onSelectChat={selectChat} onDeleteChat={deleteChat} />}

          <footer className="mt-10 text-center text-xs text-slate-400">
            Tus datos se guardan solo en {STORE.kind} y puedes exportarlos o borrarlos desde Ajustes.{" "}
            {aiDetail
              ? "Has permitido que el asistente consulte movimientos individuales."
              : "El asistente solo recibe totales agregados; al clasificar pendientes sí ve los nombres de comercio."}
            <span className="mt-1 block text-[10px] text-slate-300">versión {APP_BUILD}</span>
          </footer>
        </div>
      )}

      {hasData && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t sm:hidden" style={{ borderColor: C.line, background: C.surface, paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Secciones">
          {TABS.map((t) => {
            const I = t.icon;
            const on = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); setDrill(null); }}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium focus-visible:outline-none"
                style={{ color: on ? C.accent : C.muted }}>
                <I size={20} strokeWidth={on ? 2.4 : 1.9} /> {t.short || t.label}
              </button>
            );
          })}
        </nav>
      )}

      {imp?.phase === "mapping" && (
        <MappingModal imp={imp}
          onCancel={() => { setImp(null); sampleRef.current = false; }}
          onConfirm={({ dataStart, cols }) => {
            try { finishParse(imp.rows, dataStart, cols, imp.fileName, { cols, headerIdx: dataStart - 1 }); }
            catch (e) { setImp(null); setError("Error al procesar las columnas: " + e.message); }
          }} />
      )}
      {imp?.phase === "validate" && (
        <ValidationModal val={imp.val}
          onCancel={() => { setImp(null); sampleRef.current = false; }}
          onRemap={() => setImp({ phase: "mapping", fileName: imp.fileName, rows: imp.rows, analysis: { cols: imp.cols, headerIdx: imp.dataStart - 1 } })}
          onConfirm={applyImport} />
      )}
      {drill && agg && (
        <DrillPanel
          drill={drill} assets={assets} groups={groups} outliers={outliers}
          movs={liveMovs.filter((m) => periodRange && m.date >= periodRange[0] && m.date <= periodRange[1])}
          onClose={() => setDrill(null)} onRecat={recat} onReasset={reasset} onReassetAll={reassetAll} onCreateAsset={createAsset} onToggleExtra={toggleExtra}
          onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov} onNote={setNote} onDelete={deleteMovs} onSetAmount={setAmount}
          onEditMov={(m) => setMovEdit({ mode: "edit", mov: m })}
        />
      )}
      {asistenteOpen && (
        <AsistenteConexion
          workerUrl={bankCfg.workerUrl || ""} token={bankCfg.token || ""}
          onGuardar={(u, t) => persistBank({ workerUrl: u, token: t })}
          onIrBanco={() => setSettingsOpen(true)}
          onClose={() => setAsistenteOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} storeKind={STORE.kind} saveState={saveState}
          theme={theme} setTheme={setTheme} upcoming={upcoming}
          movsCount={movs.length} aiOn={aiOn} setAiOn={setAiOn} ai={ai} setAi={setAi} aiDetail={aiDetail} setAiDetail={setAiDetail}
          aiProfiles={aiProfiles} onSaveAiProfile={saveAiProfile} onActivateAiProfile={activateAiProfile} onDeleteAiProfile={deleteAiProfile}
          onExport={exportJSON} onImportFile={importJSON} onWipe={wipeAll}
          snapCount={snapCount} snapTooBig={snapTooBig} onListSnaps={listSnaps} onRestoreSnap={restoreSnapshot}
          materialidad={materialidad} setMaterialidad={setMaterialidad}
          imports={imports} onDeleteImport={deleteImport}
          onFindDupes={findBankDupes} onTrashDupes={trashBankDupes}
          onAsistente={() => setAsistenteOpen(true)}
          assetMem={assetMem} onForgetAssetMem={forgetAssetMem} onForgetAllAssetMem={forgetAllAssetMem}
          onDrillIds={(ids, label) => { setSettingsOpen(false); setDrill({ type: "ids", ids, label }); }}
          trashed={trashed} onRestoreTrash={restoreMovs} onPurgeTrash={purgeMovs}
          onRulesAudit={rulesAudit} onToggleRule={toggleRule} onRemoveRule={removeCustomRule} onUpdateRuleCat={updateRuleCat}
          sync={{ busy: syncBusy, msg: syncMsg, conflict: syncConflict, auto: !!syncCfg.auto, version: syncCfg.version || 0,
            onPush: (o) => syncPush(o), onPull: (o) => syncPull({ confirmReplace: true, ...o }),
            onToggleAuto: (v) => { persistSync({ auto: v }); setSyncMsg({ kind: "info", text: v ? "Sincronización automática activada." : "Sincronización automática desactivada." }); } }}
          bank={{ workerUrl: bankCfg.workerUrl || "", token: bankCfg.token || "", connections: bankCfg.connections || [],
            aspsps: bankAspsps, accountsByConn: bankAccountsByConn, addCountry: bankAddCountry, addSel: bankAddSel, busy: bankBusy, msg: bankMsg,
            auto: !!bankCfg.auto,
            onChange: persistBank, onSetAddCountry: setBankAddCountry, onSetAddSel: setBankAddSel, onLoadAspsps: bankLoadAspsps, onAddConnect: bankAddConnect,
            onToggleAuto: (v) => persistBank((b) => ({ ...b, auto: v })),
            diag: bankDiag, onDiagnose: bankDiagnose, onReconnect: bankReconnect,
            addPsu: bankAddPsu, onSetAddPsu: setBankAddPsu, onSetPsu: bankSetPsu,
            otherAccountIds: otherAccountMovIds, onTrashOtherAccounts: trashOtherAccountMovs,
            onLoadAccounts: bankLoadAccounts, onPickAccount: bankPickAccount, onSyncOne: bankSyncOne, onSyncAll: bankSyncAll, onRemove: bankRemoveConnection }} />
      )}
      {pendingOpen && (
        <PendientesPanel movsPend={movsPend} assets={assets} setAssets={setAssets} applyPending={applyPending}
          aiOn={aiOn} ai={ai} autoRanRef={aiAutoRanRef} onClose={() => setPendingOpen(false)}
          tagGroups={groups} onToggleGroup={toggleGroup} onCreateGroup={createGroupFromMov}
          onRecat={recat} onReasset={reasset} onNote={setNote} onNoteAll={setNoteAll} onSetAmount={setAmount} onDelete={deleteMovs} />
      )}
      {movEdit && (
        <MovEditModal
          initial={movEdit.mode === "edit" ? movEdit.mov : null}
          assets={assets} onCreateAsset={createAsset}
          onSave={(data) => (movEdit.mode === "edit" ? editMov(movEdit.mov, data) : addMov(data))}
          onClose={() => setMovEdit(null)} />
      )}
      </>)}
    </div>
  );
}
