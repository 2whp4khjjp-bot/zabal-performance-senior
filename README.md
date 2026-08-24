# Zabal Performance · Senior

Aplicación web para registrar desde cualquier tablet, móvil u ordenador el peso, la fatiga, las molestias y los comentarios de la plantilla antes de entrenar. Incluye panel técnico, tendencias, exportación CSV/Excel, informes PDF y una API de Google Apps Script para usar Google Sheets como base de datos centralizada.

El modo local es exclusivamente una demostración. La configuración de producción publica la interfaz en GitHub Pages y obliga a utilizar Google Apps Script/Sheets, permitiendo que todo el cuerpo técnico trabaje sobre los mismos datos desde cualquier lugar.

La identidad visual toma como referencia general la web del Atlético Zabal Linense (azul profundo, amarillo y blanco), pero todos los estilos y el isotipo provisional son originales.

## Qué incluye

- Acceso separado: PIN compartido del cuerpo técnico y PIN personal para cada jugador.
- Sesión firmada de 120 minutos, persistente tras recargar y con cierre manual/automático.
- Cuadrícula táctil de 25 jugadores del Senior, sin dorsales ni buscador, con filtros de estado.
- Estados pendiente, parcial, normal, moderado y alerta con color, texto e icono.
- Peso, fatiga y molestias obligatorios; comentario obligatorio cuando fatiga o molestias superan 1.
- Borrador local por jugador para no perder el formulario si se corta la conexión.
- Evolución individual con las últimas diez mediciones.
- Panel técnico con resumen, alertas, filtros, ordenación y comparativa semanal.
- Exportación a CSV y Excel.
- Informes PDF de sesión, semana, jugador y alertas, listos para A4.
- PWA instalable, caché de la interfaz y aviso sin conexión.
- Capa de datos intercambiable: demostración local o Google Sheets.
- Pruebas de sesión, validación, clasificación de alertas y duplicados.

## Arquitectura

```text
src/
  components/       Interfaz, formulario, cuadrícula y panel técnico
  data/             Plantilla y mediciones ficticias
  services/         Contrato de datos, almacenamiento local, Google Sheets,
                    exportaciones e informes
  utils/            Sesión, fechas y lógica de mediciones
apps-script/         API y creación de la plantilla de Google Sheets
public/assets/       Isotipo provisional y lugar para el escudo oficial
```

La interfaz solo depende del contrato `DataService`. Sustituir Google Sheets por Supabase requiere crear otra implementación de ese contrato; los componentes no cambian.

## Ejecutar en local

Requisitos: Node.js 20 o posterior y pnpm 9 o posterior.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Abra `http://localhost:4173`. En demostración, el PIN técnico es **2026** y el primer PIN de jugador es **1001**. Los datos quedan en el almacenamiento local del navegador y pueden reiniciarse borrando los datos del sitio.

Comprobaciones:

```bash
pnpm test
pnpm build
pnpm preview
```

## Configuración

Variables disponibles en `.env`:

| Variable | Uso |
| --- | --- |
| `VITE_DATA_PROVIDER` | `local` o `google-sheets` |
| `VITE_STAFF_PIN_SHA256` | Hash SHA-256 del PIN, solo para modo local |
| `VITE_APPS_SCRIPT_URL` | URL terminada en `/exec` de Apps Script |
| `VITE_PUBLIC_URL` | URL pública de producción |

No suba `.env` al repositorio. En producción con Google Sheets, el PIN se comprueba en Apps Script y no hay hash ni secreto de autenticación en el frontend.

Para calcular un hash local:

```bash
node -e "console.log(require('node:crypto').createHash('sha256').update('TU_PIN').digest('hex'))"
```

## Conectar Google Sheets

1. Cree una hoja de cálculo nueva en Google Sheets.
2. Abra **Extensiones > Apps Script**.
3. Copie `apps-script/Code.gs` y `apps-script/appsscript.json` en el proyecto.
4. Guarde y recargue la hoja.
5. En el nuevo menú **Zabal Performance**, ejecute **Preparar pestañas y datos demo**. Autorice el script con la cuenta propietaria.
6. En el mismo menú, pulse **Configurar PIN del cuerpo técnico**.
7. Pulse **Generar PINs de jugadores**. Puede editar cualquier código directamente en la columna `pin` de la pestaña privada `Códigos jugadores` y después pulsar **Aplicar PINs editados**. Reparta a cada jugador únicamente su código.
8. En Apps Script, elija **Implementar > Nueva implementación > Aplicación web**.
9. Configure **Ejecutar como: yo** y **Quién tiene acceso: cualquier usuario**. La API sigue protegida por una sesión firmada; los jugadores nunca reciben acceso a la hoja.
10. Copie la URL que termina en `/exec`.
11. Configure `.env`:

```env
VITE_DATA_PROVIDER=google-sheets
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/ID_DEL_DESPLIEGUE/exec
VITE_PUBLIC_URL=https://rendimiento.atleticozabal.com
```

12. Compile y despliegue de nuevo la web.

Las pestañas creadas son `Jugadores`, `Mediciones`, `Sesiones`, `Configuración` y `Códigos jugadores`.

### Añadir o desactivar jugadores

- Añadir: cree una fila en `Jugadores` con un `id` único, nombre, dorsal opcional, `activo=TRUE`, orden y fecha de alta.
- PIN editable: cambie el código en `Códigos jugadores`, manteniendo entre 4 y 12 dígitos, y pulse **Aplicar PINs editados**. El sistema impide códigos repetidos o jugadores sin PIN.
- Regenerar todos: **Generar PINs de jugadores** crea códigos nuevos para toda la plantilla e invalida los anteriores.
- Desactivar: cambie `activo` a `FALSE`. No borre al jugador; así se conserva su historial.
- Ordenar: cambie la columna `orden`.

## Informes y exportaciones

En **Panel técnico**:

- `CSV` y `Excel` exportan las filas que estén visibles según los filtros.
- `PDF del día` genera el informe de la sesión actual.
- `Informe semanal` usa las mediciones desde el lunes.
- `Informe de alertas` incluye los valores de nivel alto.
- En la vista individual, seleccione un jugador y pulse `PDF`.

Los PDF se generan en el navegador con tablas A4; no necesitan abrir Google Sheets.

## Despliegue y subdominio

La configuración recomendada para este proyecto es GitHub Pages mediante el flujo incluido en `.github/workflows/deploy-pages.yml`. Consulte la guía paso a paso en `docs/DESPLIEGUE_GITHUB.md`.

Como alternativas también puede utilizar Cloudflare Pages, Netlify o Vercel. En cualquiera de ellas:

1. Publique este repositorio.
2. Use `pnpm build` como comando de compilación y `dist` como carpeta de salida.
3. Añada las variables de `.env` en la configuración segura del proveedor.
4. Configure las rutas SPA para que cualquier ruta devuelva `index.html` (la PWA ya usa esa navegación).
5. Añada el dominio personalizado `rendimiento.atleticozabal.com`.

El proveedor mostrará el registro DNS exacto. Habitualmente será:

- `CNAME` con nombre `rendimiento` y destino asignado por el proveedor.
- Si el DNS lo gestiona Cloudflare, mantenga el proxy según indique Pages.

No cree un registro `A` salvo que el proveedor dé una IP concreta. El certificado HTTPS se emite automáticamente después de validar el DNS. Cambie `VITE_PUBLIC_URL`, vuelva a compilar y compruebe el candado HTTPS antes de instalar la PWA en la tablet.

Para actualizar la aplicación, publique los cambios en el mismo proyecto. El service worker está configurado para descargar la nueva versión automáticamente.

## Logotipo oficial

El isotipo actual es provisional y original. Para sustituirlo:

1. Guarde el escudo autorizado en `public/assets/`, idealmente como SVG o PNG transparente optimizado.
2. Cambie `logoSrc` en `src/config.ts`.
3. Sustituya también `favicon.svg`, `icon-192.svg` e `icon-512.svg` si desea que el icono instalado use el escudo.
4. Vuelva a ejecutar `pnpm build`.

## Seguridad y privacidad

- El PIN técnico y los PINs personales se validan mediante hash; la pestaña privada de códigos solo es visible para la cuenta propietaria de la hoja.
- El navegador recibe una sesión firmada que caduca a los 120 minutos y no depende de la caché temporal de Apps Script.
- Apps Script limita las lecturas del jugador a su propia ficha y valida también su identidad en cada escritura.
- `LockService` evita carreras y el par jugador-fecha se actualiza de forma controlada.
- Los comentarios se limpian y limitan a 500 caracteres.
- La hoja se ejecuta bajo la cuenta propietaria; no se comparte con jugadores.
- El identificador del jugador no se toma de una URL editable.

Limitaciones: Google Apps Script y Sheets son adecuados para un equipo y un volumen moderado, pero no ofrecen auditoría avanzada ni las garantías de una base de datos transaccional. Para varios equipos, más personal o datos médicos detallados, conviene migrar a Supabase/PostgreSQL con autenticación individual de técnicos, políticas de acceso y copias de seguridad.

Antes de usar datos reales, revise el tratamiento de datos personales, el acceso de entrenadores, la retención y las obligaciones aplicables en España/UE.

## Decisiones técnicas

- React + TypeScript + CSS propio: interfaz ligera y con identidad propia.
- SVG propio para minigráficos: menos peso y control visual completo.
- jsPDF/AutoTable: informes descargables sin servidor adicional.
- SheetJS: archivo Excel real además del CSV.
- Servicio local persistente: demostración completa sin preparar infraestructura.
- Apps Script como puerta de entrada: la hoja no se expone directamente.

## Mejoras futuras

- Autenticación individual para técnicos y registro de auditoría.
- Cola offline cifrada y sincronización en segundo plano para producción.
- Supabase/PostgreSQL, políticas por equipo y copias automáticas.
- Gestión de plantilla desde el panel técnico.
- Comparativas de microciclos, carga externa e integración con GPS.
- Notificaciones privadas de alertas y consentimiento/retención configurables.

## Qué debe proporcionar el club

- Una Google Sheet nueva y la cuenta propietaria que ejecutará Apps Script.
- El PIN definitivo del cuerpo técnico (se configura directamente en la hoja; no hace falta compartirlo con desarrollo).
- Acceso DNS al dominio `atleticozabal.com` o contacto de la persona que lo gestiona.
- El escudo oficial en SVG/PNG y confirmación de permiso de uso.
- La plantilla real: nombre, orden y estado activo; el Senior no utiliza dorsales en esta aplicación.
- Decisión sobre alojamiento (Cloudflare Pages, Netlify o Vercel) y política de privacidad/retención de datos.
