# Publicación remota con GitHub Pages

Esta es la configuración recomendada para que todo el cuerpo técnico acceda a la misma aplicación desde cualquier ubicación.

## Arquitectura de producción

```text
Móvil, tablet u ordenador
        ↓ HTTPS
GitHub Pages · interfaz React/PWA
        ↓ HTTPS + token temporal
Google Apps Script · validación y API
        ↓ acceso privado del propietario
Google Sheets · jugadores, sesiones y mediciones
```

GitHub no almacena las mediciones. Solo sirve los archivos públicos de la interfaz. La hoja sigue siendo privada y Apps Script actúa como puerta de entrada.

## 1. Preparar Google Sheets

Siga el apartado **Conectar Google Sheets** del `README.md`. Al terminar debe tener una URL de Apps Script parecida a:

```text
https://script.google.com/macros/s/IDENTIFICADOR/exec
```

Compruebe que el PIN definitivo está configurado y que la implementación se ejecuta con la cuenta propietaria de la hoja.

## 2. Crear el repositorio

1. Cree un repositorio en la cuenta u organización del club.
2. Suba este proyecto sin el archivo `.env`.
3. La rama principal debe llamarse `main`.

La web publicada será accesible públicamente, pero el contenido funcional permanece protegido por el PIN y los tokens temporales. No suba hojas, exportaciones, PIN, datos de jugadores reales ni credenciales al repositorio.

## 3. Configurar las variables de GitHub

Abra **Settings > Secrets and variables > Actions > Variables** y cree:

| Variable | Valor |
| --- | --- |
| `VITE_APPS_SCRIPT_URL` | URL `/exec` de Apps Script |
| `VITE_PUBLIC_URL` | `https://rendimiento.atleticozabal.com` |
| `VITE_BASE_PATH` | `/` para el dominio definitivo |

La URL de Apps Script no es una clave privada: la seguridad depende del PIN validado en el servidor y del token temporal. Aun así, mantenerla como variable permite cambiarla sin modificar el código.

Para probar primero con `https://USUARIO.github.io/NOMBRE-REPOSITORIO/`, use `/NOMBRE-REPOSITORIO/` en `VITE_BASE_PATH`. Antes de activar el subdominio, vuelva a establecerla en `/` y ejecute otra publicación.

## 4. Activar Pages

1. Abra **Settings > Pages**.
2. En **Source**, seleccione **GitHub Actions**.
3. Abra la pestaña **Actions** y ejecute `Publicar Zabal Performance`, o envíe un cambio a `main`.
4. El proceso ejecutará las pruebas, compilará la aplicación obligatoriamente con `google-sheets` y publicará `dist`.

El flujo se detiene si falta `VITE_APPS_SCRIPT_URL`; de esta forma, la versión pública no puede desplegarse accidentalmente en modo local.

## 5. Conectar el subdominio

En **Settings > Pages > Custom domain**, introduzca:

```text
rendimiento.atleticozabal.com
```

En el proveedor DNS de `atleticozabal.com`, cree:

| Tipo | Nombre | Destino |
| --- | --- | --- |
| `CNAME` | `rendimiento` | `USUARIO-O-ORGANIZACION.github.io` |

El destino no debe incluir el nombre del repositorio. Cuando GitHub valide el DNS, active **Enforce HTTPS**.

## 6. Acceso del cuerpo técnico

Cada técnico podrá abrir `https://rendimiento.atleticozabal.com` desde cualquier dispositivo e introducir el mismo PIN. Todos verán la misma plantilla y las mismas mediciones porque los datos se consultan en Google Sheets, no en el almacenamiento del dispositivo.

La sesión de cada dispositivo caduca a los 30 minutos. El PIN no se almacena en el navegador.

## Actualizaciones

Cada cambio enviado a `main` vuelve a ejecutar pruebas y publica una nueva versión. La PWA detecta la actualización y renueva la interfaz instalada.
