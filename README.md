# Mis Finanzas — aplicación

Aplicación web para llevar las finanzas personales: importa el extracto del banco o se
conecta a él, clasifica los movimientos con reglas que aprende de ti, y los reparte por
categorías y por activos (cada piso, cada coche).

**En marcha:** https://misfinanzas.cc

Funciona sin instalar nada: arrastras el Excel o el CSV de tu banco y listo. Los datos se
quedan en tu navegador.

## Si quieres sincronizar entre dispositivos o conectar el banco

Necesitas tu propio backend. La guía de instalación, pensada para quien no programa, está en
el repositorio del Worker: **https://github.com/lsantos44/MisFinanzas**

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

1. **Siempre** en el navegador (IndexedDB). La app funciona sin conexión.
2. **Opcionalmente** en tu Worker, que sincroniza entre dispositivos y guarda las 10 últimas
   versiones por si hay que volver atrás.

La app nunca envía tus datos a un servidor del autor: no existe tal servidor.
