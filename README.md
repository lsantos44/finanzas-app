# Mis Finanzas — aplicación

Aplicación web para llevar las finanzas personales: importa el extracto del banco o se
conecta a él, clasifica los movimientos con reglas que aprende de ti, y los reparte por
categorías y por activos (cada piso, cada coche).

**En marcha:** https://misfinanzas.cc

Funciona sin instalar nada: arrastras el CSV o el Excel (.xlsx, .xls) de tu banco y listo. Los datos se
quedan en tu navegador.

## Si quieres sincronizar entre dispositivos o conectar el banco

Necesitas tu propio backend. La guía de instalación, pensada para quien no programa, está en
el repositorio del Worker: **https://github.com/lsantos44/MisFinanzas**

**En otro navegador o dispositivo** no hace falta memorizar nada. En el que ya usas, abre
Ajustes → Tus datos y sincronización → *Tu acceso en otros dispositivos* y mándate el enlace por
email (o guárdalo en tus notas). Abrirlo en cualquier móvil u ordenador es entrar: llegan tus
datos y tus bancos y la sincronización queda activada. También puedes pegarlo en *Entrar*, y si
el gestor de contraseñas guarda el acceso, en un navegador nuevo te ofrece entrar con un toque.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # genera dist/
```

Una sola aplicación React en `src/App.jsx`. Sin servidor: todo ocurre en el navegador, salvo
lo que se delega en el Worker (almacenamiento, banco y proxy de IA).

El despliegue lo hace Cloudflare al recibir un push: compila con `npm run build` y publica
`dist/` como Worker con archivos estáticos, según `wrangler.jsonc`. Por eso `dist/` no se
versiona: lo genera el servidor de compilación.

## Dónde se guardan los datos

1. **Siempre** en el almacenamiento del navegador (localStorage). Para abrir la app hace falta
   conexión; tus datos no salen del dispositivo salvo que configures lo siguiente.
2. **Opcionalmente** en tu Worker, que sincroniza entre dispositivos y guarda las 10 últimas
   versiones y una por día del último mes, recuperables desde Ajustes.

La app no envía tus movimientos a ningún servidor del autor. Eso sí: la web que abres
(misfinanzas.cc) la publica el autor, y quien controla una web controla el código que ejecuta
tu navegador. Si prefieres no depender de nadie, publica tu propia copia de la app. Detalle de
qué se envía a quién (banco, IA): [privacidad](public/privacidad.html).

---

## Licencia

Copyright (C) 2026 lsantos44.

Este programa es software libre: puedes redistribuirlo y modificarlo bajo los términos de la
**GNU Affero General Public License, versión 3** (AGPL-3.0), publicada por la Free Software
Foundation. Se distribuye **sin ninguna garantía**, ni siquiera la implícita de
comerciabilidad o idoneidad para un fin concreto. El texto completo está en [LICENSE](LICENSE).

En la práctica: puedes usarlo, instalar tu propia copia y modificarla. Si ofreces a otras
personas una versión modificada (también como servicio web), tienes que publicar su código
fuente con la misma licencia.
