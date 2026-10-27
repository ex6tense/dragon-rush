# Conectar el formulario de inscripción (Google Sheets + Drive)

El formulario de `inscripcion/` envía los datos a un **Google Apps Script** que:

- guarda **una fila por pareja** en la hoja **Inscripciones**;
- sube el **comprobante** y las **autorizaciones de menores** a una carpeta **privada** de Drive;
- manda el **correo de “inscripción recibida (en revisión)”** al integrante 1;
- manda el **correo de “inscripción confirmada”** cuando alguien cambia el estado del pago a **Validado**;
- lleva el **cupo de 40** (solo cuentan las parejas *Validadas*) y, al llenarse, el formulario muestra la **lista de espera**;
- arma la hoja **Mesa de registro**: solo validados, ordenados por equipo, con categoría, condición médica y columna de llegada (lista para imprimir).

Mientras no lo conectes, el formulario funciona en **modo prueba**: se puede recorrer completo, pero no guarda nada.

---

## 1. Crear la hoja y pegar el script (una sola vez)

1. Entra con la **cuenta de Google del evento** (los archivos y correos saldrán de esa cuenta).
2. Crea una hoja de cálculo nueva: <https://sheets.new> y ponle nombre, por ejemplo *Dragon Rush 2026 · Inscripciones*.
3. Menú **Extensiones → Apps Script**.
4. Borra lo que aparece en `Code.gs` y pega **todo** el contenido del archivo `apps-script/Code.gs` de este proyecto. Guarda (💾).
5. Arriba, en el selector de funciones, elige **`setup`** y pulsa **▶ Ejecutar**.
   - Google pedirá permisos (hoja, Drive y correo). Acepta con la cuenta del evento.
   - Si aparece “Google no verificó esta app”: **Configuración avanzada → Ir a … (no seguro)**. Es tu propio script.
6. Vuelve a la hoja: ya deben existir las pestañas **Inscripciones**, **Lista de espera** y **Mesa de registro**, y en tu Drive la carpeta *Dragon Rush 2026 · Comprobantes y autorizaciones*.

## 2. Publicarlo como aplicación web

1. En Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. *Ejecutar como*: **Yo** (la cuenta del evento).
4. *Quién tiene acceso*: **Cualquier usuario** (necesario para que el formulario público pueda enviar).
5. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

## 3. Conectar el formulario

Abre `js/inscripcion.js` y pega la URL en `ENDPOINT`:

```js
ENDPOINT: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

En ese mismo bloque `CONFIG`, completa los **datos de la cuenta bancaria** (banco, tipo, número, titular, cédula o RUC).
Después sube los cambios (commit + push) y GitHub Pages lo publica.

## 4. Correo de revisión de pagos (opcional, recomendado)

En `Code.gs`, al inicio, pon el correo de quien revisa los pagos en `ADMIN` (puedes poner varios separados por coma):

```js
ADMIN: 'pagos@ejemplo.com',
```

Con eso, por cada inscripción llega a ese correo un aviso con el resumen, el enlace al comprobante y dos botones:

- **✅ Validar pago** → abre una página para confirmar → la hoja pasa a **Validado**, baja el cupo y la pareja recibe el correo de **inscripción confirmada**.
- **❌ Rechazar pago** → abre una página donde puedes escribir un **motivo** (opcional) → la hoja pasa a **Rechazado** y la pareja recibe el correo de **pago no validado** con ese motivo.

Los botones piden confirmación en una segunda pantalla para que ningún filtro de correo valide un pago “abriendo” el enlace solo.

Después de cambiar `ADMIN` (o cualquier parte del código): **guarda**, ejecuta **`setup`** (agrega las columnas nuevas *Token revisión* y *Motivo de rechazo*) y publica **Implementar → Gestionar implementaciones → ✏️ → Nueva versión**.

## 5. Uso diario (Finanzas / Comercial)

- Revisa la pestaña **Inscripciones**: cada pareja entra como **Pendiente**, con el enlace al comprobante.
- Valida o rechaza desde los botones del correo de revisión, **o** cambia **Estado del pago** a mano en la hoja: con **Validado** se envía el correo de confirmación y baja el contador de cupos; con **Rechazado** se envía el correo de pago no validado (si escribes antes el motivo en la columna *Motivo de rechazo*, se incluye).
- **Exportar a CSV**: Archivo → Descargar → Valores separados por comas.
- **Lista para la mesa de registro**: pestaña *Mesa de registro* → Archivo → Imprimir.
- La columna **Categoría** se completa a mano cuando se definan las categorías (25 de noviembre).

## Notas

- **Datos sensibles**: cédulas, comprobantes y autorizaciones quedan solo en la hoja y en la carpeta de Drive de la cuenta del evento. No compartas la hoja ni la carpeta con más personas de las necesarias.
- Si cambias el código del script, vuelve a **Implementar → Gestionar implementaciones → Editar → Nueva versión**. La URL no cambia.
- Cuota de correos de Google: ~100 por día en cuentas gratuitas, suficiente para 40 parejas.
