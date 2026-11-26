# Inversiones: qué datos poner y cómo se calcula

La pestaña **Inversiones** valora tus acciones y fondos con precios que tu servidor trae solo de
Yahoo Finance. Este documento fija el estándar: qué datos de tu entidad necesitas para que las
cifras **coincidan con las suyas**, y qué significa cada cifra.

## Cómo cargar tus inversiones

Cuatro formas, de más completa a más técnica:

1. **Importar el archivo de tu bróker** (Inversiones → *Importar*). El CSV o Excel de operaciones
   que descargas de DEGIRO («Transacciones»), Revolut, Interactive Brokers, MyInvestor, Trade
   Republic o tu banco. Se lee en tu dispositivo (no se envía a nadie): cada compra y venta con su
   fecha, cantidad, importe y comisiones. Las columnas se reconocen por su nombre, en español o
   inglés; lo que no es compraventa (dividendos, ingresos, comisiones de custodia) se salta y se
   cuenta. Antes de guardar ves lo que se ha entendido. Con esto:
   - participaciones y coste salen exactos aunque compraras en varias veces (el coste de lo que
     queda, gastando primero lo más antiguo: FIFO, como Hacienda);
   - la evolución empieza en tu primera compra, sin decir la fecha;
   - las ventas alimentan **Impuestos (Renta)**.
   Volver a importar el histórico completo actualiza sin duplicar.
2. **Desde capturas de tu banco o bróker** (Inversiones → *Capturas*). Haz capturas de la ficha
   de cada producto, o de la cartera, donde se vean el nº de participaciones y el coste (o la
   ganancia). La IA que tengas configurada las lee —nombre, ISIN o ticker y bolsa, participaciones,
   coste en euros— y tú revisas la lista antes de guardar. Si un producto ya estaba (mismo ISIN o
   nombre), se actualiza; si no, se añade. Sirve igual para recalibrar más adelante.
3. **Añadir un producto** (Inversiones → *Añadir*), en dos pasos: lo buscas por nombre, ISIN o
   ticker (se marca cuál tiene precios), y dices cuántas tienes, a qué precio medio (o cuánto
   invertiste en total) y en qué plataforma.
4. **Pegar una lista** en formato JSON, con los campos de abajo.

Tu servidor elige solo la cotización de cada producto: por ISIN; si no, por ticker y bolsa (como
los muestran los brókeres: «SOI · Euronext Paris»); si no, por nombre.

Para probar sin datos propios: **Ver una cartera de ejemplo** (productos y precios inventados,
que no se piden a ningún servidor; se quita con un toque).

## Impuestos (Renta)

Con las operaciones importadas, la sección *Impuestos (Renta)* estima lo que tus ventas suman a la
base del ahorro de cada año, con las reglas generales del IRPF:

| Regla | Cómo se aplica |
|---|---|
| Ganancia o pérdida | lo que recibiste (con comisiones) − lo que te costó (con comisiones), en euros al cambio de cada día |
| Orden de venta | lo más antiguo primero (FIFO), por ISIN y contando todas tus plataformas juntas (Hacienda lo aplica por contribuyente, no por bróker); clases distintas de un fondo son valores distintos |
| Retención | los reembolsos de fondos con ganancia llevan un 19 % de retención, ya pagado: se descuenta de lo que quedaría por pagar |
| Brókers extranjeros | sus ventas no salen en el borrador: se marcan para añadirlas a mano |
| Traspasos entre fondos | no tributan; el fondo nuevo hereda el coste y la fecha del anterior |
| Regla de los dos meses | una pérdida con recompra del mismo valor 2 meses antes o después (12 si es un fondo que no cotiza) se aplaza |
| Compensación | ganancias y pérdidas del año; si sale negativo, en los 4 años siguientes |
| Tipos del ahorro | 19 % hasta 6.000 €, 21 % hasta 50.000, 23 % hasta 200.000, 27 % hasta 300.000, 30 % a partir de ahí |

Arriba, **¿Tengo que declararlo?**: lo que tienes no se declara, lo que vendes sí (en la Renta del
año siguiente); cuándo no se está obligado a presentar la Renta (1.000 € de ingresos totales y
pérdidas de menos de 500 €; 1.600 € si son reembolsos de fondos con retención) y que los 50.000 €
son el **Modelo 720**, informativo, para lo que tienes en entidades extranjeras (con lo que tienes
hoy en ellas).

Además: *Si vendieras hoy* (lo que ganarías o perderías con cada producto y lo que añadiría a tu
impuesto) y *Puedes pagar menos este año* (pérdidas que compensarían lo que ya has ganado). Se
puede descargar el detalle de ventas en CSV para tu gestor. Es una estimación: no incluye
dividendos, intereses ni otras ganancias de la base del ahorro, ni normas forales.

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
| `compra` | Recomendado | Fecha de tu primera compra (`2026-03-09` o `09/03/2026`). Tu evolución empieza ese día | Movimientos u órdenes de tu entidad |
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
| **Última sesión** | participaciones × (último precio publicado − el anterior), con su fecha | Cuánto se movió el último precio (en fondos, el de hace 1–2 días) |
| **Resultado del periodo** (1S, 1M, 3M, Año, 1A, Todo) | valor al final − valor al principio − lo que pusiste entre medias; en % ÷ (valor al principio + lo que pusiste) | Cuánto has ganado o perdido en ese periodo. Si entraste después de que empiece, cuenta desde que entraste. Con «Todo» es la plusvalía |
| **Qué explica tu resultado** | el mismo cálculo para cada plataforma o producto | Qué ha sumado y qué ha restado; sumados dan el total |
| **Tú frente al mercado** | cada euro que pusiste, el mismo día, en un fondo indexado (MSCI World, S&P 500, Nasdaq 100 o STOXX Europe 600, cotizados en euros) | Si lo estás haciendo mejor o peor que el índice, con tus mismas aportaciones |
| **Tu posición / El producto** (ficha) | tu plusvalía desde que entraste / variación de su precio en ese mismo tiempo | Separar cómo te ha ido a ti de cómo ha ido el producto |
| **Variación 1 semana / 1 mes / este año / 1 año** de un producto | precio final ÷ precio inicial − 1 | Cómo ha ido el producto en sí |

Tu posición **nunca se calcula hacia atrás**: cuenta desde tu fecha de compra (`compra`) o, si no
la pones, desde la fecha de tus datos. En una cartera automatizada con aportaciones periódicas, lo
que tenías se reparte en tus transferencias de aportación anteriores (que la app ve en tus
movimientos), ajustado para que coincida con tus participaciones e invertido de hoy.

Los totales y los grupos (por plataforma, por tipo) suman valores e invertido, y el % se calcula
sobre esas sumas, como hacen las entidades en su cabecera. Los productos sin coste no entran en la
plusvalía total («Todo») y se indican aparte; en un periodo sí cuentan, desde lo que valían al
empezar.

Un producto **sin fecha de compra** solo cuenta en un periodo desde el día que lo diste de alta y con
lo que valía entonces: así no se apunta en el último mes lo que ganó antes.

**«¿Por qué se ha movido?»** (opcional, con tu IA): busca en la web las noticias del periodo que
explican lo que han hecho tus productos. A la IA solo se le envían nombres, identificadores y
porcentajes; nunca cuánto tienes ni cuánto ganas.

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
