# Inversiones: qué datos poner y cómo se calcula

La pestaña **Inversiones** valora tus acciones y fondos con precios que tu servidor trae solo de
Yahoo Finance. Este documento fija el estándar: qué datos de tu entidad necesitas para que las
cifras **coincidan con las suyas**, y qué significa cada cifra.

## Los datos de cada producto

Cada producto (posición) se describe con estos campos. Los dos que más importan son las
**participaciones** y el **coste medio**: con ellos, la plusvalía coincide con la de tu entidad.

| Campo | Obligatorio | Qué es | Dónde lo encuentras |
|---|---|---|---|
| `nombre` | Sí | Nombre del producto | En tu entidad |
| `entidad` | Recomendado | Banco, bróker o plataforma (agrupa la vista) | — |
| `tipo` | Recomendado | `accion` o `fondo` | — |
| `isin` | Recomendado | Código ISIN (12 caracteres) | Ficha del producto |
| `participaciones` | Sí* | Número de acciones o participaciones | Ficha del producto («Nº de participaciones», «Cantidad») |
| `costeMedio` | Recomendado | Coste medio por participación, en euros | Ficha («Coste medio», «Precio de compra medio», «BEP») |
| `coste` | — | Alternativa a `costeMedio`: total invertido en euros | Valor − plusvalía que muestra tu entidad |
| `valorAlta` | Sí* | Si no sabes las participaciones: valor actual en euros | Posición en tu entidad |
| `simbolo` | No | Cotización en Yahoo (si no, se busca sola por ISIN o nombre) | — |
| `robo` y `pesoObjetivo` | No | Fondo de una cartera automatizada y su peso objetivo (%) | Composición de la cartera |

\* Una de las dos: `participaciones` (exacto) o `valorAlta` (aproximado: se convierte en
participaciones con el precio de ese día).

Los números se aceptan como los muestran las entidades: `1.234,567`, `45,6789`, `12.3456`,
`1234.5600`. Un único punto seguido de exactamente tres cifras (`2.500`) se lee como millar.

Ejemplo para **Importar → Actualizar y añadir** (cambia lo que ya tienes con el mismo ISIN o
nombre y añade lo nuevo, sin duplicar):

```json
[
  { "nombre": "Mi fondo global", "entidad": "Mi banco", "tipo": "fondo", "isin": "IE00B4L5Y983",
    "participaciones": "1.250,5", "costeMedio": "12.3456" },
  { "nombre": "Apple", "entidad": "Mi bróker", "tipo": "accion", "isin": "US0378331005",
    "participaciones": 10, "costeMedio": 150 }
]
```

## Qué significa cada cifra

| Cifra | Fórmula | Para qué |
|---|---|---|
| **Valor** | participaciones × último precio (en euros, al cambio del día) | Cuánto vale hoy |
| **Invertido** | participaciones × coste medio, más las aportaciones de la cartera automatizada | Lo que has puesto |
| **Plusvalía** | valor − invertido; en % = valor ÷ invertido − 1 | Lo mismo que «Plusvalía/Minusvalía» o «G/P» de tu entidad |
| **Último cambio** | participaciones × (último precio − precio anterior) | Cuánto se ha movido desde el último precio |
| **Rentabilidad de un periodo** (gráfico, «en lo que va de año», «Comparar») | Ponderada por tiempo: Π (Vₜ − Fₜ) ÷ Vₜ₋₁ − 1, donde F son las aportaciones de ese día | Comparar periodos y productos sin que el dinero nuevo parezca ganancia |
| **Variación 1 semana / 1 mes / este año / 1 año** de un producto | precio final ÷ precio inicial − 1 | Cómo ha ido el producto en sí |

La **plusvalía** mide desde que compraste; la **rentabilidad de un periodo**, solo ese periodo y
sin contar las aportaciones (es el método estándar de gestoras y robo-advisors, *time-weighted
return*). Por eso pueden no coincidir entre sí, y es lo esperado.

Los totales y los grupos (por plataforma, por tipo) suman valores e invertido, y el % se calcula
sobre esas sumas, como hacen las entidades en su cabecera. Los productos sin coste no entran en la
plusvalía total y se indican aparte.

## Cuándo coincide con tu entidad y cuándo no

- **Coincide** cuando las participaciones y el coste medio son los de la ficha, y el precio es del
  mismo día. Es lo normal en fondos: hay un único valor liquidativo diario.
- **Diferencias de céntimos** en acciones extranjeras: tu bróker usa su propio cambio de divisa y a
  otra hora. En acciones durante la sesión: precios con unos 15 minutos de retraso.
- **Cartera automatizada** con `valorAlta`: las aportaciones se reparten según `pesoObjetivo` al
  precio de dos días después de la transferencia, y puede desviarse un poco de las compras reales.
  Para dejarla exacta, actualiza las participaciones de vez en cuando con «Actualizar y añadir».

## Actualización de precios

- **Acciones, ETF y divisas:** cada 30 minutos en horario de bolsa (disparador `*/30 7-21 * * 1-5`
  de tu servidor) y al cierre.
- **Fondos:** una vez al día. Publican su valor liquidativo con 1–2 días de retraso.
- **Con la pestaña abierta**, la app recoge los precios nuevos cada 10 minutos.

La lógica está en `src/inversiones.js` y sus pruebas en `test/inversiones.test.js`.
