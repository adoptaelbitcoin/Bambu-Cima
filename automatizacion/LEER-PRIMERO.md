# Bambu · Actualización diaria automática de datos

Este paquete convierte la actualización de datos de Bambu (hoy manual) en un
proceso que corre **solo, todos los días**, sin que tengas que tocar nada.

> **Importante — para quién es esto.** Los pasos 3 a 6 los hace una persona con
> perfil técnico (un dev) **una sola vez**. Después de eso, funciona solo y tú
> no vuelves a intervenir. Si tú no eres técnico: lee las secciones "Qué hace"
> y "Qué necesitas conseguir", consigue esas 2 cosas, y pásale esta carpeta
> completa al dev. Con esto le sobra.

---

## 1. Qué hace (en simple)

Cada día, a una hora fija:

1. **Pide** a la API de ChartInspect las métricas on-chain de BTC y ETH del día.
2. **Traduce** esos números al formato interno de Bambu.
3. **Reescribe** los dos archivos de datos (`btc_real.js` y `eth_real.js`).
4. **Reconstruye** los HTML (Bambu Cima, Bambu +, Bambu Go).
5. **Publica** la versión nueva en Netlify.

Resultado: al día siguiente el dashboard ya muestra los datos frescos, con la
fecha actualizada arriba. Nadie tuvo que abrir nada.

---

## 2. Qué necesitas conseguir (las 2 llaves)

Antes de montar nada, junta esto:

1. **Una API key de ChartInspect** (o de la fuente que uses: Glassnode,
   CryptoQuant…). Es un texto largo tipo `ci_live_xxxxxxxx`. Se saca en la
   cuenta de esa plataforma, sección *API / Developers*.
2. **Acceso al repositorio de código** donde vive Bambu (GitHub) y al sitio de
   Netlify donde está publicado. Si aún no están en GitHub, el paso 3 lo
   resuelve.

Sin la #1 no hay datos que traer. Es el único costo/gestión externo real.

---

## 3. Dónde vive esto: ¿"cowork" o no?

No necesitas un espacio de coworking físico ni una herramienta de pago aparte.
Lo más simple y **gratis** es **GitHub Actions**: GitHub ejecuta el script por ti
en la nube, a la hora que le digas. No necesitas dejar tu PC encendido.

Alternativas (si el dev prefiere): un cron en un servidor propio, o funciones
programadas de Netlify/Vercel. Pero para 8 usuarios y un update diario,
**GitHub Actions es la respuesta correcta**. El resto de esta guía asume eso.

---

## 4. Archivos de este paquete

| Archivo | Para qué sirve |
|---|---|
| `LEER-PRIMERO.md` | Esta guía. |
| `formato-datos.md` | El formato exacto que Bambu espera (referencia del dev). |
| `fetch-chartinspect.mjs` | Trae los datos del día desde la API. **Aquí se pega la API key y se revisan los nombres de métrica.** |
| `build-datos.mjs` | Toma los datos traídos y reescribe `btc_real.js` / `eth_real.js`. |
| `bambu-diario.yml` | La "alarma" de GitHub: corre todo cada día. Se copia a `.github/workflows/`. |

---

## 5. Paso a paso para montarlo (lo hace el dev, una vez)

### Paso 5.1 — Subir Bambu a GitHub (si no está ya)
1. Crear un repositorio nuevo en GitHub (privado).
2. Subir toda la carpeta del proyecto Bambu (incluida la carpeta `app/`, `pro/`,
   `sbambu/`, los `.html`, y esta carpeta `automatizacion/`).

### Paso 5.2 — Conectar el repo con Netlify
1. En Netlify: *Add new site → Import from Git → elegir el repo*.
2. Build command: *(dejar vacío, no hay build)*. Publish directory: la raíz (`.`).
3. Guardar. A partir de ahora, cada vez que cambie el repo, Netlify republica solo.

### Paso 5.3 — Guardar la API key como secreto
1. En GitHub: repo → *Settings → Secrets and variables → Actions → New secret*.
2. Nombre: `CHARTINSPECT_API_KEY`. Valor: la key. Guardar.
   (Nunca se escribe la key dentro del código; se lee de aquí.)

### Paso 5.4 — Revisar el mapeo de métricas
1. Abrir `fetch-chartinspect.mjs`.
2. En la tabla `METRIC_MAP`, confirmar que el nombre de cada métrica de
   ChartInspect corresponde al campo de Bambu (columna izquierda = Bambu,
   derecha = id de ChartInspect). Ajustar los ids según la doc de la API.
3. Ver `formato-datos.md` para la lista completa de campos que Bambu espera.

### Paso 5.5 — Probar en local (recomendado)
```bash
cd automatizacion
export CHARTINSPECT_API_KEY="tu-key"     # en Windows: set CHARTINSPECT_API_KEY=...
node fetch-chartinspect.mjs              # crea datos-hoy.json
node build-datos.mjs                     # reescribe ../app/btc_real.js y ../app/eth_real.js
```
Abrir un `.html` y comprobar que la fecha de arriba es la de hoy y los números cuadran.

### Paso 5.6 — Activar la ejecución diaria
1. Copiar `bambu-diario.yml` a la carpeta `.github/workflows/` del repo.
2. Hacer commit y push.
3. En GitHub → pestaña *Actions*: aparecerá el flujo "Bambu · datos diarios".
   Se puede lanzar a mano con *Run workflow* para probar.
4. Listo. Corre solo cada día a la hora fijada (por defecto 12:00 UTC).

---

## 6. Cómo saber que está funcionando
- GitHub → *Actions*: cada día debe aparecer una ejecución en verde.
- El dashboard publicado muestra la fecha de hoy arriba ("Datos al …").
- Si un día falla (API caída, key vencida), la ejecución sale en rojo y GitHub
  te manda un correo. Los datos del día anterior siguen visibles; no se rompe nada.

---

## 7. Recompilar los HTML offline
Los archivos `*(offline).html` son copias autónomas que NO se actualizan solas
(llevan los datos incrustados). El flujo diario actualiza los `.html` normales.
Si repartes los offline, hay que regenerarlos tras cada cambio grande — dímelo
y te los recompilo, o el dev añade ese paso al final del script.
