// Formulario de inscripción Dragon Rush 2026.
// Envía los datos a un Web App de Google Apps Script (ver apps-script/Code.gs y apps-script/LEEME.md).
(function () {
  'use strict';

  // ================== CONFIGURACIÓN (completar antes de publicar) ==================
  const CONFIG = {
    // URL del Web App de Apps Script ("Implementar > Nueva implementación > Aplicación web").
    // Vacío = modo prueba: el formulario funciona pero no guarda nada.
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbzDysyJtPm8Eq5ceKDzKGWwkpnwVljiyUdQ7LNx0LFL--KDYE9KU3ifJc7Ww5lswwtG/exec',
    CUPO: 40,
    EVENTO: '2026-11-28',
    MAX_MB: 5,
    // Datos de la cuenta para la transferencia
    BANCO: {
      'Banco': 'Banco Pichincha',
      'Tipo de cuenta': 'Cuenta de ahorro transaccional',
      'Número de cuenta': '2213369561',
      'Titular': 'Luis Sebastián Espinoza Bermeo',
      'Cédula': '0107395055',
      'Correo': 'sebas.espinoza3110@gmail.com',
    },
  };
  // ===================================================================================

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const form = $('#form');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ---------- integrantes 1 y 2 desde la plantilla ----------
  const tpl = $('#member-tpl');
  const membersEl = $('#members');
  [1, 2].forEach(i => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.step = String(i + 1);
    node.dataset.title = `Integrante ${i}`;
    node.dataset.member = String(i);
    $('[data-intro]', node).innerHTML = i === 1
      ? 'El <b>integrante 1</b> es quien paga y recibe los correos de la inscripción.'
      : 'Los mismos datos para tu compañero o compañera de equipo.';
    $$('[data-k]', node).forEach(inp => {
      const k = inp.dataset.k, id = `m${i}-${k}`;
      inp.id = id; inp.name = id;
      const err = $(`[data-err="${k}"]`, node); if (err) { err.id = `${id}-err`; err.setAttribute('aria-live', 'polite'); }
      const lab = $(`[data-for="${k}"]`, node); if (lab) lab.htmlFor = id;
      const hint = inp.closest('.field') && $('.hint', inp.closest('.field'));
      if (hint) { hint.id = hint.id || `${id}-hint`; }
      inp.setAttribute('aria-describedby', [hint && hint.id, err && err.id].filter(Boolean).join(' '));
      const name = $(`[data-name="${k}"]`, node); if (name) name.id = `${id}-name`;
    });
    $$('[data-group]', node).forEach(g => {
      const k = g.dataset.group, id = `m${i}-${k}`;
      g.id = id;
      const lab = $(`[data-label="${k}"]`, node); lab.id = `${id}-label`; g.setAttribute('aria-labelledby', lab.id);
      const err = $(`[data-err="${k}"]`, node); err.id = `${id}-err`; err.setAttribute('aria-live', 'polite');
      g.setAttribute('aria-describedby', err.id);
      $$('input', g).forEach(r => { r.name = id; });
    });
    membersEl.appendChild(node);
  });

  const steps = $$('fieldset.step', form).sort((a, b) => a.dataset.step - b.dataset.step);
  let current = 0;

  // ---------- utilidades de error ----------
  function setErr(id, msg) {
    const err = document.getElementById(`${id}-err`);
    const el = document.getElementById(id);
    if (err) err.textContent = msg || '';
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  const val = id => (document.getElementById(id)?.value || '').trim();
  const radio = id => (document.querySelector(`input[name="${id}"]:checked`) || {}).value || '';
  const digits = s => s.replace(/\D/g, '');

  function ageOn(dateStr, refStr) {
    const d = new Date(dateStr + 'T00:00:00'), r = new Date(refStr + 'T00:00:00');
    let a = r.getFullYear() - d.getFullYear();
    const m = r.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < d.getDate())) a--;
    return a;
  }
  function fileErr(input, required) {
    const f = input.files && input.files[0];
    if (!f) return required ? 'Sube el archivo (foto o PDF).' : '';
    if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) return 'El archivo debe ser una imagen o un PDF.';
    if (f.size > CONFIG.MAX_MB * 1024 * 1024) return `El archivo pesa más de ${CONFIG.MAX_MB} MB.`;
    return '';
  }

  // ---------- validación por paso ----------
  function validateStep(n) {
    const step = steps[n];
    let ok = true;
    const check = (id, msg) => { ok = setErr(id, msg) && ok; };

    if (step.dataset.step === '1') {
      const v = val('equipo');
      check('equipo', !v ? 'Escribe el nombre del equipo.' : v.length > 30 ? 'Máximo 30 caracteres.' : '');
    }

    if (step.dataset.member) {
      const i = step.dataset.member, p = `m${i}-`;
      const nombre = val(p + 'nombre');
      check(p + 'nombre', !nombre ? 'Escribe nombres y apellidos.' : nombre.split(/\s+/).length < 2 ? 'Escribe al menos un nombre y un apellido.' : '');
      const doc = val(p + 'documento');
      let docMsg = !doc ? 'Escribe la cédula o el pasaporte.' : !/^[A-Za-z0-9-]{5,20}$/.test(doc) ? 'Revisa el número: solo letras y números.' : '';
      if (!docMsg && i === '2' && doc.toUpperCase() === val('m1-documento').toUpperCase()) docMsg = 'Es el mismo documento del integrante 1.';
      check(p + 'documento', docMsg);
      const nac = val(p + 'nacimiento');
      let nacMsg = '';
      if (!nac) nacMsg = 'Indica la fecha de nacimiento.';
      else { const a = ageOn(nac, CONFIG.EVENTO); if (isNaN(a) || a < 6 || a > 100) nacMsg = 'Revisa la fecha de nacimiento.'; }
      check(p + 'nacimiento', nacMsg);
      const minor = !nacMsg && ageOn(nac, CONFIG.EVENTO) < 18;
      if (minor) check(p + 'autorizacion', fileErr(document.getElementById(p + 'autorizacion'), true));
      const correo = val(p + 'correo');
      check(p + 'correo', !correo ? 'Escribe el correo.' : !EMAIL.test(correo) ? 'Revisa el formato del correo (ej. nombre@correo.com).' : '');
      const cel = digits(val(p + 'celular'));
      check(p + 'celular', !cel ? 'Escribe el celular.' : (cel.length < 9 || cel.length > 13) ? 'Revisa el número: entre 9 y 13 dígitos.' : '');
      check(p + 'genero', radio(p + 'genero') ? '' : 'Selecciona una opción.');
      const tipo = radio(p + 'tipo');
      check(p + 'tipo', tipo ? '' : 'Selecciona Dragón o Externo.');
      if (tipo === 'Dragón') {
        const b = digits(val(p + 'banner'));
        check(p + 'banner', !b ? 'Escribe tu código Banner.' : (b.length < 5 || b.length > 12) ? 'Revisa el código Banner (solo números).' : '');
      }
      check(p + 'emer_nombre', val(p + 'emer_nombre') ? '' : 'Escribe el nombre del contacto.');
      const et = digits(val(p + 'emer_tel'));
      check(p + 'emer_tel', !et ? 'Escribe el teléfono del contacto.' : (et.length < 7 || et.length > 13) ? 'Revisa el teléfono.' : '');
      check(p + 'emer_parentesco', val(p + 'emer_parentesco') ? '' : 'Indica el parentesco.');
    }

    if (step.dataset.step === '4') {
      const boxes = ['aptitud', 'reglamento', 'imagen', 'datos'];
      const missing = boxes.filter(b => !$('#chk-' + b).checked);
      boxes.forEach(b => $('#chk-' + b + '-wrap').setAttribute('aria-invalid', missing.includes(b) ? 'true' : 'false'));
      $('#checks-err').textContent = missing.length ? 'Marca las cuatro casillas para continuar.' : '';
      ok = !missing.length;
    }

    if (step.dataset.step === '5') {
      check('comprobante', fileErr($('#comprobante'), true));
      check('transaccion', val('transaccion') ? '' : 'Escribe el número de transacción o documento.');
    }

    if (!ok) {
      const first = step.querySelector('[aria-invalid="true"]');
      if (first) {
        const target = first.matches('.choices, .check') ? first.querySelector('input') : first;
        target.focus({ preventScroll: true });
        first.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }
    }
    return ok;
  }

  // ---------- mostrar paso ----------
  function show(n, focus = true) {
    current = n;
    steps.forEach((s, i) => { s.hidden = i !== n; });
    $$('.steps li').forEach((li, i) => { li.className = i < n ? 'done' : i === n ? 'current' : ''; });
    $('#step-title').textContent = steps[n].dataset.title;
    $('#step-count').textContent = `Paso ${n + 1} de ${steps.length}`;
    $('#prev').hidden = n === 0;
    const last = n === steps.length - 1;
    $('#next').innerHTML = last ? 'Enviar inscripción <svg aria-hidden="true"><use href="#i-arrow"/></svg>' : 'Continuar <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    $('#form-err').textContent = '';
    if (focus) {
      $('#card').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      $('#step-title').focus({ preventScroll: true });
    }
  }

  // ---------- comportamiento de campos ----------
  const eqLen = () => { $('#equipo-len').textContent = $('#equipo').value.length; };
  $('#equipo').addEventListener('input', eqLen);
  form.addEventListener('input', e => {
    const t = e.target;
    if (t.type === 'tel' || (t.dataset && t.dataset.k === 'banner')) {
      const clean = t.value.replace(/\D/g, '');
      if (clean !== t.value) t.value = clean;               // solo números
    }
    if (t.getAttribute('aria-invalid') === 'true') setErr(t.id, '');
  });
  form.addEventListener('change', e => {
    const t = e.target;
    if (t.type === 'radio') {
      const g = t.closest('[data-group]');
      setErr(g.id, '');
      if (g.dataset.group === 'tipo') {
        const box = $('[data-banner]', g.closest('fieldset'));
        box.hidden = t.value !== 'Dragón';
      }
    }
    if (t.dataset && t.dataset.k === 'nacimiento') {
      const box = $('[data-minor]', t.closest('fieldset'));
      box.hidden = !(t.value && ageOn(t.value, CONFIG.EVENTO) < 18);
    }
    if (t.type === 'file') {
      const nameEl = document.getElementById(`${t.id}-name`);
      const f = t.files[0];
      const msg = fileErr(t, false);
      setErr(t.id, msg);
      if (nameEl) nameEl.textContent = f && !msg ? `✓ ${f.name}` : '';
    }
    if (t.type === 'checkbox') {
      t.closest('.check').setAttribute('aria-invalid', 'false');
      if ($$('#checks input').every(c => c.checked)) $('#checks-err').textContent = '';
    }
  });

  // datos bancarios
  const dl = $('#bank-data');
  Object.entries(CONFIG.BANCO).forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  });
  $('#copy-account').addEventListener('click', async e => {
    const btn = e.currentTarget, label = btn.querySelector('span');
    const num = CONFIG.BANCO['Número de cuenta'];
    try { await navigator.clipboard.writeText(num); label.textContent = '¡Copiado!'; }
    catch { label.textContent = num; }
    setTimeout(() => { label.textContent = 'Copiar número de cuenta'; }, 2200);
  });

  $('#prev').addEventListener('click', () => show(Math.max(0, current - 1)));

  // ---------- envío ----------
  const toB64 = file => new Promise((res, rej) => {
    if (!file) return res(null);
    const r = new FileReader();
    r.onload = () => res({ nombre: file.name, tipo: file.type, data: String(r.result).split(',')[1] });
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  async function payload() {
    const member = async i => {
      const p = `m${i}-`;
      const nac = val(p + 'nacimiento');
      const minor = ageOn(nac, CONFIG.EVENTO) < 18;
      const tipo = radio(p + 'tipo');
      return {
        nombre: val(p + 'nombre'), documento: val(p + 'documento').toUpperCase(), nacimiento: nac, menor: minor,
        correo: val(p + 'correo').toLowerCase(), celular: digits(val(p + 'celular')), genero: radio(p + 'genero'),
        tipo, banner: tipo === 'Dragón' ? digits(val(p + 'banner')) : '',
        emergencia: { nombre: val(p + 'emer_nombre'), telefono: digits(val(p + 'emer_tel')), parentesco: val(p + 'emer_parentesco') },
        medico: val(p + 'medico'),
        autorizacion: minor ? await toB64(document.getElementById(p + 'autorizacion').files[0]) : null,
      };
    };
    return {
      action: 'inscripcion',
      equipo: val('equipo'),
      integrantes: [await member(1), await member(2)],
      aceptaciones: { aptitud: true, reglamento: true, imagen: true, datos: true },
      pago: { monto: 25, transaccion: val('transaccion'), comprobante: await toB64($('#comprobante').files[0]) },
      enteraste: $('#enteraste').value,
      enviado: new Date().toISOString(),
    };
  }

  async function post(data) {
    if (!CONFIG.ENDPOINT) { await new Promise(r => setTimeout(r, 700)); return { ok: true, prueba: true }; }
    const res = await fetch(CONFIG.ENDPOINT, { method: 'POST', body: JSON.stringify(data) }); // text/plain: sin preflight
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateStep(current)) return;
    if (current < steps.length - 1) { show(current + 1); return; }
    const btn = $('#next');
    btn.disabled = true; btn.textContent = 'Enviando…';
    $('#form-err').textContent = '';
    try {
      const data = await payload();
      const r = await post(data);
      if (r.lleno) { showWaitlist(); return; }
      if (!r.ok) throw new Error(r.error || 'error');
      showDone(data, r);
    } catch (err) {
      $('#form-err').textContent = 'No pudimos enviar tu inscripción. Revisa tu conexión e inténtalo de nuevo. Si el problema sigue, escríbenos por Instagram.';
      btn.disabled = false;
      btn.innerHTML = 'Enviar inscripción <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    }
  });

  function showDone(data, r) {
    form.hidden = true; $('#cupo').hidden = true;
    const s = $('#done-summary');
    const rows = [
      ['Equipo', data.equipo + (r.numero ? ` · pareja n.º ${r.numero}` : '')],
      ['Integrantes', data.integrantes.map(m => m.nombre).join(' y ')],
      ['Confirmación a', data.integrantes[0].correo],
      ['Transacción', data.pago.transaccion],
    ];
    s.innerHTML = '';
    rows.forEach(([k, v]) => { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = k; d.append(b, document.createElement('br'), document.createTextNode(v)); s.append(d); });
    if (r.prueba) s.insertAdjacentHTML('beforeend', '<div><b>Modo prueba</b><br>No se guardó ningún dato.</div>');
    $('#done').hidden = false;
    $('#card').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    $('#done-title').focus({ preventScroll: true });
  }

  // ---------- cupo y lista de espera ----------
  function showWaitlist() {
    form.hidden = true; $('#done').hidden = true;
    $('#waitlist').hidden = false;
    $('#wait-title').focus({ preventScroll: true });
  }
  $('#wait-form').addEventListener('submit', async e => {
    e.preventDefault();
    const okN = setErr('w-nombre', val('w-nombre') ? '' : 'Escribe tu nombre.');
    const c = val('w-correo');
    const okC = setErr('w-correo', !c ? 'Escribe tu correo.' : !EMAIL.test(c) ? 'Revisa el formato del correo.' : '');
    if (!okN || !okC) return;
    const btn = $('#w-submit'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const r = await post({ action: 'espera', nombre: val('w-nombre'), correo: c.toLowerCase(), enviado: new Date().toISOString() });
      if (!r.ok) throw new Error();
      btn.hidden = true; $('#w-ok').hidden = false;
    } catch { btn.disabled = false; btn.textContent = 'Anotarme en la lista de espera'; setErr('w-correo', 'No pudimos guardar tus datos. Inténtalo de nuevo.'); }
  });

  async function loadCupo() {
    if (!CONFIG.ENDPOINT) { $('#test-banner').hidden = false; return; }
    try {
      const res = await fetch(`${CONFIG.ENDPOINT}?action=cupo`);
      const r = await res.json();
      const quedan = Math.max(0, r.quedan);
      $('#cupo-n').textContent = quedan;
      $('#cupo').hidden = false;
      if (quedan <= 0) showWaitlist();
    } catch { /* si falla, el formulario sigue disponible */ }
  }

  show(0, false);
  eqLen();
  loadCupo();
})();
