/**
 * Dragon Rush 2026 · Backend de inscripciones (Google Apps Script)
 *
 * Recibe el formulario de /inscripcion, guarda una fila por pareja en la hoja "Inscripciones",
 * sube comprobantes y autorizaciones a una carpeta privada de Drive, manda los correos
 * y lleva el cupo (solo cuentan las parejas con pago "Validado").
 * Si CONFIG.ADMIN tiene un correo, a ese correo le llega un aviso por cada inscripción con botones
 * para Validar o Rechazar el pago; al confirmar se actualiza la hoja y se avisa a la pareja.
 *
 * Instalación: ver LEEME.md en esta misma carpeta.
 */

const CONFIG = {
  CUPO: 40,
  EVENTO: 'Dragon Rush 2026',
  CARPETA: 'Dragon Rush 2026 · Comprobantes y autorizaciones',
  REMITENTE: 'Dragon Rush 2026',
  INSTAGRAM: '@dragonrush26',
  // Correo(s) que revisan los pagos, separados por coma. Vacío = no se envía el aviso de revisión.
  ADMIN: 'sebas.espinoza3110@gmail.com',
  // URL /exec para los botones del correo de revisión. Vacío = se usa automáticamente la del script.
  URL_WEBAPP: '',
};

const HOJA = 'Inscripciones';
const HOJA_ESPERA = 'Lista de espera';
const HOJA_REGISTRO = 'Mesa de registro';
const ESTADOS = ['Pendiente', 'Validado', 'Rechazado'];

// columnas de la hoja de inscripciones (una fila por pareja)
const PERSONA = ['Nombre', 'Documento', 'Nacimiento', 'Menor de edad', 'Correo', 'Celular', 'Género', 'Dragón/Externo',
  'Banner', 'Emergencia: nombre', 'Emergencia: teléfono', 'Emergencia: parentesco', 'Condición médica', 'Autorización representante'];
const COLS = [
  'Fecha de envío', 'Estado del pago', 'N.º pareja', 'Equipo',
  ...PERSONA.map(c => 'I1 · ' + c),
  ...PERSONA.map(c => 'I2 · ' + c),
  'N.º transacción', 'Comprobante', '¿Cómo se enteró?', 'Aceptaciones', 'Categoría', 'Correo de validación enviado',
  'Token revisión', 'Motivo de rechazo',
];
const col = name => COLS.indexOf(name) + 1;

// ---------------------------------------------------------------------------
// Hoja de cálculo: la que se guardó al correr setup(), o la que contiene el script
// ---------------------------------------------------------------------------
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* se borró: usar la activa */ } }
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('El script no está dentro de una hoja de cálculo: créalo desde Extensiones → Apps Script de la hoja.');
  return ss;
}

function hoja_(nombre) {
  const ss = ss_();
  let sh = ss.getSheetByName(nombre);
  if (!sh) { prepararHojas_(ss); sh = ss.getSheetByName(nombre); }
  return sh;
}

// ---------------------------------------------------------------------------
// Ejecutar UNA VEZ desde el editor (botón ▶ con la función "setup")
// ---------------------------------------------------------------------------
function setup() {
  const ss = SpreadsheetApp.getActive();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  prepararHojas_(ss);

  // carpeta privada de Drive
  getFolder_();

  // disparador para el correo de validación (al cambiar "Estado del pago" a "Validado")
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'alEditar').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('alEditar').forSpreadsheet(ss).onEdit().create();

  const first = ss.getSheets()[0];
  if (first.getName() !== HOJA && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

function prepararHojas_(ss) {

  const sh = ss.getSheetByName(HOJA) || ss.insertSheet(HOJA);
  sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#101010').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(4);
  const estadoRule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build();
  sh.getRange(2, col('Estado del pago'), 999, 1).setDataValidation(estadoRule);

  const esp = ss.getSheetByName(HOJA_ESPERA) || ss.insertSheet(HOJA_ESPERA);
  esp.getRange(1, 1, 1, 3).setValues([['Fecha', 'Nombre', 'Correo']]).setFontWeight('bold');
  esp.setFrozenRows(1);

  // Mesa de registro: solo validados, ordenados por equipo, con columnas para imprimir
  const reg = ss.getSheetByName(HOJA_REGISTRO) || ss.insertSheet(HOJA_REGISTRO);
  reg.clear();
  const L = c => columnLetter(col(c));
  const rango = c => `${HOJA}!${L(c)}2:${L(c)}`;
  reg.getRange('A1:G1').setValues([['Equipo', 'Integrante 1', 'Integrante 2', 'Categoría', 'Condición médica I1', 'Condición médica I2', 'Llegada']])
    .setFontWeight('bold').setBackground('#ED1C24').setFontColor('#ffffff');
  reg.getRange('A2').setFormula(
    `=IFERROR(SORT(FILTER({${rango('Equipo')}, ${rango('I1 · Nombre')}, ${rango('I2 · Nombre')}, ${rango('Categoría')}, ` +
    `${rango('I1 · Condición médica')}, ${rango('I2 · Condición médica')}}, ${rango('Estado del pago')}="Validado"), 1, TRUE), "")`);
  reg.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// GET  ?action=cupo  →  { validadas, cupo, quedan }
// ---------------------------------------------------------------------------
function doGet(e) {
  try { return doGet_(e); } catch (err) { console.error(err); return json_({ ok: false, error: String(err) }); }
}

function doGet_(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'cupo') {
    const v = validadas_();
    return json_({ ok: true, validadas: v, cupo: CONFIG.CUPO, quedan: Math.max(0, CONFIG.CUPO - v) });
  }
  if (action === 'revisar') return revisar_(e.parameter);
  if (action === 'info') {
    const ss = ss_();
    return json_({ ok: true, hoja: ss.getName(), pestañas: ss.getSheets().map(s => s.getName()) });
  }
  return json_({ ok: true, evento: CONFIG.EVENTO, version: 3 });
}

// ---------------------------------------------------------------------------
// POST  { action: 'inscripcion' | 'espera', ... }
// ---------------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'espera') return json_(guardarEspera_(d));
    if (d.action === 'inscripcion') return json_(guardarInscripcion_(d));
    return json_({ ok: false, error: 'acción desconocida' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function guardarInscripcion_(d) {
  if (validadas_() >= CONFIG.CUPO) return { ok: false, lleno: true };
  const faltan = validarInscripcion_(d);
  if (faltan.length) return { ok: false, error: 'Faltan datos: ' + faltan.join(', ') };

  const sh = hoja_(HOJA);
  const numero = Math.max(0, sh.getLastRow() - 1) + 1;
  const etiqueta = `${String(numero).padStart(2, '0')} ${d.equipo}`;

  const persona = (m, i) => {
    const aut = m.menor && m.autorizacion ? guardarArchivo_(m.autorizacion, `${etiqueta} · autorización I${i}`) : '';
    return [m.nombre, "'" + m.documento, m.nacimiento, m.menor ? 'Sí' : 'No', m.correo, "'" + m.celular, m.genero, m.tipo,
      m.banner ? "'" + m.banner : '', m.emergencia.nombre, "'" + m.emergencia.telefono, m.emergencia.parentesco, m.medico || '', aut];
  };
  const comprobante = guardarArchivo_(d.pago.comprobante, `${etiqueta} · comprobante`);
  const fila = [
    new Date(), 'Pendiente', numero, d.equipo,
    ...persona(d.integrantes[0], 1), ...persona(d.integrantes[1], 2),
    "'" + d.pago.transaccion, comprobante, d.enteraste || '', 'Aptitud, reglamento, imagen, datos', '', 'No',
    Utilities.getUuid(), '',
  ];
  sh.appendRow(fila);

  try { correoRecibido_(d, numero); } catch (err) { console.error('correo recibido', err); }
  try { correoAdmin_(d, numero, comprobante, fila[col('Token revisión') - 1]); } catch (err) { console.error('correo admin', err); }
  return { ok: true, numero };
}

function validarInscripcion_(d) {
  const f = [];
  if (!d.equipo) f.push('equipo');
  (d.integrantes || []).forEach((m, i) => {
    ['nombre', 'documento', 'nacimiento', 'correo', 'celular', 'genero', 'tipo'].forEach(k => { if (!m[k]) f.push(`I${i + 1} ${k}`); });
    if (m.tipo === 'Dragón' && !m.banner) f.push(`I${i + 1} banner`);
    if (m.menor && !m.autorizacion) f.push(`I${i + 1} autorización`);
    if (!m.emergencia || !m.emergencia.nombre || !m.emergencia.telefono || !m.emergencia.parentesco) f.push(`I${i + 1} emergencia`);
  });
  if (!d.integrantes || d.integrantes.length !== 2) f.push('integrantes');
  if (!d.pago || !d.pago.transaccion) f.push('transacción');
  if (!d.pago || !d.pago.comprobante) f.push('comprobante');
  return f;
}

function guardarEspera_(d) {
  if (!d.nombre || !d.correo) return { ok: false, error: 'faltan datos' };
  hoja_(HOJA_ESPERA).appendRow([new Date(), d.nombre, d.correo]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Correo de validación: al cambiar "Estado del pago" a "Validado"
// ---------------------------------------------------------------------------
function alEditar(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== HOJA || e.range.getColumn() !== col('Estado del pago') || e.range.getRow() < 2) return;
  const estado = String(e.value);
  if (estado !== 'Validado' && estado !== 'Rechazado') return;
  avisarResultado_(sh, e.range.getRow(), estado);
}

// Manda a la pareja el correo del resultado (una sola vez por estado)
function avisarResultado_(sh, row, estado) {
  const enviado = sh.getRange(row, col('Correo de validación enviado'));
  if (enviado.getValue() === estado) return;
  const get = name => sh.getRange(row, col(name)).getValue();
  const r = { numero: get('N.º pareja'), equipo: get('Equipo'), i1: get('I1 · Nombre'), i2: get('I2 · Nombre'), correo: get('I1 · Correo') };
  if (estado === 'Validado') correoValidado_(r);
  else correoRechazado_(r, get('Motivo de rechazo'));
  enviado.setValue(estado);
}

// ---------------------------------------------------------------------------
// Revisión desde el correo de administración: ?action=revisar&t=TOKEN&d=validar|rechazar[&ok=1&motivo=…]
// Dos pasos (abrir → confirmar) para que un antivirus que "abre" enlaces no valide nada solo.
// ---------------------------------------------------------------------------
function revisar_(p) {
  const token = p.t || '', decision = p.d === 'rechazar' ? 'rechazar' : 'validar';
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = hoja_(HOJA);
    const n = sh.getLastRow() - 1;
    const tokens = n > 0 ? sh.getRange(2, col('Token revisión'), n, 1).getValues().map(r => r[0]) : [];
    const idx = token ? tokens.indexOf(token) : -1;
    if (idx < 0) return pagina_('Enlace no válido', '<p>No encontramos esta inscripción. Puede que la fila se haya borrado.</p>');
    const row = idx + 2;
    const get = name => sh.getRange(row, col(name)).getValue();
    const estado = get('Estado del pago');
    const resumen = `<p><b>Pareja n.º ${esc_(get('N.º pareja'))} · ${esc_(get('Equipo'))}</b><br>${esc_(get('I1 · Nombre'))} y ${esc_(get('I2 · Nombre'))}<br>
      Transacción: ${esc_(get('N.º transacción'))}<br><a href="${esc_(get('Comprobante'))}" target="_blank">Ver comprobante</a></p>`;
    if (estado === 'Validado' || estado === 'Rechazado') {
      return pagina_(`Ya estaba ${estado.toLowerCase()}`, `${resumen}<p>Esta inscripción ya figura como <b>${estado}</b>. No se hizo ningún cambio.</p>`);
    }
    const url = urlApp_();
    if (!p.ok) {
      if (decision === 'validar') {
        return pagina_('¿Validar el pago?', `${resumen}<p>Al confirmar, la pareja queda <b>Validada</b>, baja el cupo y le llega el correo de confirmación.</p>
          <a class="b ok" target="_top" href="${url}?action=revisar&t=${encodeURIComponent(token)}&d=validar&ok=1">✅ Sí, validar pago</a>`);
      }
      return pagina_('¿Rechazar el pago?', `${resumen}
        <form method="get" action="${url}" target="_top">
          <input type="hidden" name="action" value="revisar"><input type="hidden" name="t" value="${esc_(token)}">
          <input type="hidden" name="d" value="rechazar"><input type="hidden" name="ok" value="1">
          <label>Motivo (opcional, se incluye en el correo a la pareja)<br>
          <textarea name="motivo" rows="3" placeholder="Ej.: el monto no coincide, no encontramos la transferencia…"></textarea></label>
          <button class="b no" type="submit">❌ Sí, rechazar pago</button>
        </form>`);
    }
    if (decision === 'rechazar' && p.motivo) sh.getRange(row, col('Motivo de rechazo')).setValue(String(p.motivo).slice(0, 500));
    const nuevo = decision === 'validar' ? 'Validado' : 'Rechazado';
    sh.getRange(row, col('Estado del pago')).setValue(nuevo);
    avisarResultado_(sh, row, nuevo);
    return pagina_(nuevo === 'Validado' ? 'Pago validado ✅' : 'Pago rechazado', `${resumen}<p>Listo: la hoja quedó en <b>${nuevo}</b> y se envió el correo a ${esc_(get('I1 · Correo'))}.</p>`);
  } finally { lock.releaseLock(); }
}

function urlApp_() {
  return CONFIG.URL_WEBAPP || ScriptApp.getService().getUrl();
}

function pagina_(titulo, cuerpo) {
  const html = `<!doctype html>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#eeeeed;margin:0;padding:24px;color:#101010}
    .c{max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px -24px rgba(0,0,0,.3)}
    .h{background:#ED1C24;color:#fff;padding:18px 22px}.h small{letter-spacing:2px;text-transform:uppercase;opacity:.9}
    .h h1{margin:6px 0 0;font-size:24px}.x{padding:18px 22px;font-size:15px;line-height:1.5}
    .b{display:inline-block;margin-top:8px;padding:14px 22px;border-radius:999px;border:0;font-weight:bold;font-size:15px;text-decoration:none;cursor:pointer;color:#fff}
    .ok{background:#1f8a4c}.no{background:#101010}
    textarea{width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border-radius:10px;border:2px solid #d6d6d4;font:inherit}
    a{color:#ED1C24}
  </style>
  <div class="c"><div class="h"><small>${CONFIG.EVENTO} · Revisión de pagos</small><h1>${titulo}</h1></div><div class="x">${cuerpo}</div></div>`;
  return HtmlService.createHtmlOutput(html).setTitle(`${CONFIG.EVENTO} · ${titulo}`).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Correos
// ---------------------------------------------------------------------------
function correoRecibido_(d, numero) {
  const [a, b] = d.integrantes;
  const html = plantilla_(`¡Recibimos tu inscripción, ${esc_(d.equipo)}!`, `
    <p>Tu inscripción está <b>en revisión</b> hasta que validemos la transferencia. Te escribiremos de nuevo cuando quede confirmada.</p>
    <table style="border-collapse:collapse;font-size:15px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Pareja n.º</td><td><b>${numero}</b></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Equipo</td><td><b>${esc_(d.equipo)}</b></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Integrante 1</td><td>${esc_(a.nombre)} · ${esc_(a.tipo)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Integrante 2</td><td>${esc_(b.nombre)} · ${esc_(b.tipo)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Transacción</td><td>${esc_(d.pago.transaccion)}</td></tr>
    </table>
    ${datosEvento_()}`);
  MailApp.sendEmail({ to: a.correo, subject: `${CONFIG.EVENTO} · Inscripción recibida (en revisión)`, htmlBody: html, name: CONFIG.REMITENTE });
}

function correoValidado_(r) {
  const html = plantilla_(`¡Están dentro, ${esc_(r.equipo)}!`, `
    <p>Validamos su pago. La pareja <b>n.º ${esc_(r.numero)}</b> (${esc_(r.i1)} y ${esc_(r.i2)}) quedó <b>confirmada</b> en ${CONFIG.EVENTO}.</p>
    ${datosEvento_()}`);
  MailApp.sendEmail({ to: r.correo, subject: `${CONFIG.EVENTO} · Inscripción confirmada`, htmlBody: html, name: CONFIG.REMITENTE });
}

function correoRechazado_(r, motivo) {
  const html = plantilla_(`No pudimos validar tu pago, ${esc_(r.equipo)}`, `
    <p>Revisamos la transferencia de la pareja <b>n.º ${esc_(r.numero)}</b> (${esc_(r.i1)} y ${esc_(r.i2)}) y <b>no pudimos validarla</b>.</p>
    ${motivo ? `<p><b>Motivo:</b> ${esc_(motivo)}</p>` : ''}
    <p>Si crees que es un error o quieres corregir el comprobante, escríbenos por Instagram ${CONFIG.INSTAGRAM} indicando tu número de pareja.</p>`);
  MailApp.sendEmail({ to: r.correo, subject: `${CONFIG.EVENTO} · No pudimos validar tu pago`, htmlBody: html, name: CONFIG.REMITENTE });
}

function correoAdmin_(d, numero, comprobante, token) {
  if (!CONFIG.ADMIN) return;
  const [a, b] = d.integrantes;
  const url = urlApp_();
  const link = dec => `${url}?action=revisar&t=${encodeURIComponent(token)}&d=${dec}`;
  const boton = (href, txt, bg) => `<a href="${href}" style="display:inline-block;margin:6px 8px 0 0;padding:12px 20px;border-radius:999px;background:${bg};color:#fff;font-weight:bold;text-decoration:none">${txt}</a>`;
  const html = plantilla_(`Nueva inscripción: pareja n.º ${numero}`, `
    <table style="border-collapse:collapse;font-size:15px">
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Equipo</td><td><b>${esc_(d.equipo)}</b></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Integrante 1</td><td>${esc_(a.nombre)} · ${esc_(a.correo)} · ${esc_(a.celular)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Integrante 2</td><td>${esc_(b.nombre)} · ${esc_(b.correo)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Transacción</td><td><b>${esc_(d.pago.transaccion)}</b></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">Comprobante</td><td><a href="${comprobante}">Abrir en Drive</a></td></tr>
    </table>
    <p style="margin-top:16px">Revisa que la transferencia de <b>USD 25,00</b> haya llegado y elige:</p>
    ${boton(link('validar'), '✅ Validar pago', '#1f8a4c')}${boton(link('rechazar'), '❌ Rechazar pago', '#101010')}
    <p style="font-size:13px;color:#6b6b6b;margin-top:14px">Cada botón abre una página para confirmar. También puedes cambiar el "Estado del pago" directamente en la hoja.</p>`);
  MailApp.sendEmail({ to: CONFIG.ADMIN, subject: `${CONFIG.EVENTO} · Revisar pago · Pareja ${numero} · ${d.equipo}`, htmlBody: html, name: CONFIG.REMITENTE });
}

function datosEvento_() {
  return `
    <div style="margin-top:18px;padding:14px 16px;background:#f2f2f1;border-radius:10px;font-size:15px">
      <b>Sábado 28 de noviembre de 2026</b><br>
      Registro de 07:30 a 08:00 · primera salida 08:30<br>
      Campus USFQ, Cumbayá<br><br>
      Lleven su <b>cédula o pasaporte</b>, ropa deportiva y zapatos para correr.
    </div>
    <p style="font-size:13px;color:#6b6b6b">¿Dudas? Escríbenos por Instagram ${CONFIG.INSTAGRAM}.</p>`;
}

function plantilla_(titulo, cuerpo) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#101010">
    <div style="background:#ED1C24;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.9">${CONFIG.EVENTO}</div>
      <div style="font-size:24px;font-weight:bold;margin-top:6px">${titulo}</div>
    </div>
    <div style="border:1px solid #e3e3e1;border-top:0;padding:20px 24px;border-radius:0 0 14px 14px;font-size:15px;line-height:1.5">${cuerpo}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function validadas_() {
  const sh = hoja_(HOJA);
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  return sh.getRange(2, col('Estado del pago'), n, 1).getValues().filter(r => r[0] === 'Validado').length;
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* se volvió a crear */ } }
  const f = DriveApp.createFolder(CONFIG.CARPETA); // privada: solo la cuenta dueña del script
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function guardarArchivo_(file, nombre) {
  if (!file || !file.data) return '';
  const tipo = file.tipo || 'application/octet-stream';
  const ext = (file.nombre && file.nombre.includes('.')) ? file.nombre.split('.').pop() : (tipo === 'application/pdf' ? 'pdf' : 'jpg');
  const blob = Utilities.newBlob(Utilities.base64Decode(file.data), tipo, `${nombre}.${ext}`);
  return getFolder_().createFile(blob).getUrl();
}

function columnLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
