/* Web de S2 Solutions: ajustes, formularios (solicitud de plan o prueba y contacto), video y vista previa. */
(function () {
  'use strict';

  // ═══ AJUSTES (un solo cambio cada uno) ═══
  const S2 = {
    URL_FORMULARIOS: 'https://script.google.com/macros/s/AKfycbwByncXAGokYD7qF9MSEDvGFdKUpmHQJ6n5Hign4fZoP5wHrdAijHPOc0ncErXhlLxA/exec',            // dirección /exec del proyecto «SGB - Web» (Apps Script) que guarda las solicitudes y avisa por correo
    MOSTRAR_FACTURACION: true,      // false = la facturación electrónica se oculta en toda la web (portada, módulos, planes, preguntas)
    VIDEO_YOUTUBE: '',              // enlace o ID del video de YouTube; vacío = la sección no muestra video
    MOSTRAR_TESTIMONIOS: false,     // true cuando haya testimonios con permiso escrito del cliente
    REDES: [],                      // ej. [{ nombre: 'Instagram', url: 'https://instagram.com/…' }]
    WHATSAPP: '573234924680'
  };
  window.S2_AJUSTES = S2;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const previa = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';

  // ── Facturación, testimonios, video y redes ──
  function aplicar(opc) {
    $$('[data-factura]').forEach(el => { el.hidden = !opc.factura; });
    $$('[data-sin-factura]').forEach(el => { el.hidden = opc.factura; });
    const ademas = $('#ademas'); if (ademas) ademas.classList.toggle('dos', !opc.factura);
    $$('[data-testimonios]').forEach(el => { el.hidden = !opc.testimonios; });
    const v = $('#video'); if (v) v.hidden = !opc.video;
    const r = $('#redes'); if (r) r.hidden = !opc.redes;
  }
  const idVideo = (() => {
    const t = String(S2.VIDEO_YOUTUBE || '').trim();
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(t);
    return m ? m[1] : /^[\w-]{11}$/.test(t) ? t : '';
  })();
  const estado = { factura: S2.MOSTRAR_FACTURACION, testimonios: S2.MOSTRAR_TESTIMONIOS || previa, video: !!idVideo || previa, redes: S2.REDES.length > 0 || previa };
  aplicar(estado);

  if (previa) {   // franja solo en el computador de S2 (no aparece en github.io, pages.dev ni el dominio)
    const f = document.createElement('div');
    f.className = 'previa'; f.setAttribute('role', 'note');
    f.innerHTML = '<div class="envoltura"><span>Vista previa en este computador (la franja no sale en la web).</span>' +
      '<label for="pv-factura"><input type="checkbox" id="pv-factura"> Facturación electrónica</label>' +
      '<label for="pv-testimonios"><input type="checkbox" id="pv-testimonios"> Espacios de testimonios</label>' +
      (S2.URL_FORMULARIOS ? '' : '<span>Formularios sin conectar: se simula el envío.</span>') + '</div>';
    document.body.prepend(f);
    const cf = $('#pv-factura'), ct = $('#pv-testimonios');
    cf.checked = estado.factura; ct.checked = estado.testimonios;
    cf.addEventListener('change', () => { estado.factura = cf.checked; aplicar(estado); });
    ct.addEventListener('change', () => { estado.testimonios = ct.checked; aplicar(estado); });
  }

  // Redes sociales del pie
  const redes = $('#redes-lista');
  if (redes && S2.REDES.length) redes.innerHTML = S2.REDES.map(r => '<li><a href="' + encodeURI(r.url) + '" target="_blank" rel="noopener">' +
    String(r.nombre).replace(/[<>&"]/g, '') + '</a></li>').join('');

  // Video (se carga solo al tocarlo: la página sigue liviana)
  const video = $('#video');
  if (video && idVideo) {
    const b = $('button', video);
    b.style.backgroundImage = 'linear-gradient(rgba(17,19,24,.35), rgba(17,19,24,.35)), url(https://i.ytimg.com/vi/' + idVideo + '/hqdefault.jpg)';
    $('small', b).textContent = 'Toca para ver el video';
    b.addEventListener('click', () => {
      video.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + idVideo + '?autoplay=1&rel=0" title="Video de S2 Solutions" ' +
        'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    });
  } else if (video) {
    const b = $('button', video); b.disabled = true; b.style.cursor = 'default';
  }

  // QR de muestra de la portada (dibujo, no se escanea)
  const qr = $('#qr');
  if (qr) {
    const n = 29; let s = 7; const p = ['<rect width="29" height="29" fill="#fff"/>'];
    const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const esquina = (x, y) => x < 8 && y < 8 || x > n - 9 && y < 8 || x < 8 && y > n - 9;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!esquina(x, y) && azar() > .52) p.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#111318"/>');
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => p.push('<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="#111318"/><rect x="' + (x + 1) + '" y="' + (y + 1) +
      '" width="5" height="5" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#1769FF"/>'));
    qr.innerHTML = p.join('');
  }

  // ── Formularios ──
  const PAISES = [
    ['Colombia', '57'], ['México', '52'], ['Perú', '51'], ['Ecuador', '593'], ['Chile', '56'], ['Argentina', '54'], ['Venezuela', '58'],
    ['Panamá', '507'], ['Costa Rica', '506'], ['Guatemala', '502'], ['El Salvador', '503'], ['Honduras', '504'], ['Nicaragua', '505'],
    ['República Dominicana', '1'], ['Puerto Rico', '1'], ['Bolivia', '591'], ['Paraguay', '595'], ['Uruguay', '598'], ['Estados Unidos', '1'],
    ['España', '34'], ['Otro país', '']
  ];
  $$('select[data-paises]').forEach(sel => {
    sel.innerHTML = PAISES.map(([p]) => '<option>' + p + '</option>').join('');
    const form = sel.form, ind = form.elements.indicativo;
    ind.innerHTML = PAISES.filter(x => x[1]).map(x => x[1]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      .map(v => '<option value="' + v + '"' + (v === '57' ? ' selected' : '') + '>+' + v + '</option>').join('') + '<option value="otro">Otro</option>';
    sel.addEventListener('change', () => {
      const i = PAISES.find(x => x[0] === sel.value);
      if (i && i[1]) ind.value = i[1];
      const otro = form.querySelector('[data-otro-pais]'); if (otro) { otro.hidden = sel.value !== 'Otro país'; otro.querySelector('input').required = sel.value === 'Otro país'; }
    });
  });

  const abiertos = new WeakMap();   // cuándo se abrió cada formulario (los robots lo llenan en menos de 3 s)
  $$('form[data-formulario]').forEach(f => abiertos.set(f, Date.now()));

  function marcar(campo, mensaje) {
    const c = campo.closest('.campo, .autoriza');
    if (!c) return;
    c.classList.toggle('mal', !!mensaje);
    let m = c.querySelector('.falta');
    if (mensaje && !m && c.classList.contains('campo')) { m = document.createElement('span'); m.className = 'falta'; c.appendChild(m); }
    if (m) { m.textContent = mensaje || ''; m.hidden = !mensaje; }
  }
  function validar(form) {
    let primero = null;
    $$('input, select, textarea', form).forEach(el => {
      if (el.closest('.trampa') || el.type === 'hidden' || el.closest('[hidden]')) return;
      let msj = '';
      const v = (el.value || '').trim();
      if (el.type === 'checkbox') msj = el.required && !el.checked ? 'Debes aceptar para continuar.' : '';
      else if (el.required && !v) msj = 'Este dato es obligatorio.';
      else if (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msj = 'Revisa el correo: debe ser como nombre@correo.com.';
      else if (el.name === 'telefono' && v && !/^[\d\s-]{6,16}$/.test(v)) msj = 'Escribe solo números (entre 6 y 15).';
      marcar(el, msj);
      if (msj && !primero) primero = el;
    });
    if (primero) primero.focus();
    return !primero;
  }
  $$('form[data-formulario]').forEach(form => {
    form.addEventListener('input', e => { if (e.target.closest('.mal')) marcar(e.target, ''); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const aviso = $('.estado', form); aviso.hidden = true;
      if (!validar(form)) return;
      const datos = {};
      $$('input, select, textarea', form).forEach(el => {
        if (!el.name) return;
        if (el.type === 'radio') { if (el.checked) datos[el.name] = el.value; }
        else if (el.type === 'checkbox') datos[el.name] = el.checked;
        else datos[el.name] = el.value.trim();
      });
      if (datos.pais === 'Otro país' && datos.pais_otro) datos.pais = datos.pais_otro;
      delete datos.pais_otro;
      const envio = { tipo: form.dataset.formulario, datos, ms: Date.now() - (abiertos.get(form) || Date.now()), pagina: location.hostname };
      const boton = $('button[type=submit]', form);
      boton.disabled = true; const texto = boton.textContent; boton.textContent = 'Enviando…';
      try {
        let r;
        if (!S2.URL_FORMULARIOS) {
          if (!previa) throw new Error('sin dirección');
          await new Promise(res => setTimeout(res, 700));
          console.log('Vista previa: esto se enviaría a «SGB - Web»', envio);
          r = { ok: true };
        } else {
          const resp = await fetch(S2.URL_FORMULARIOS, { method: 'POST', body: JSON.stringify(envio) });   // text/plain: sin pre-verificación
          r = await resp.json();
        }
        if (!r || !r.ok) throw new Error((r && r.mensaje) || 'No se pudo enviar.');
        form.hidden = true;
        const listo = form.parentElement.querySelector('.listo'); if (listo) { listo.hidden = false; listo.focus(); }
      } catch (err) {
        aviso.className = 'estado error'; aviso.hidden = false;
        aviso.innerHTML = 'No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo otra vez, o escríbenos por <a href="https://wa.me/' + S2.WHATSAPP +
          '" target="_blank" rel="noopener">WhatsApp</a>.';
      } finally { boton.disabled = false; boton.textContent = texto; }
    });
  });

  // ── Ventana de solicitud (Elegir plan / Prueba gratis) ──
  const ventana = $('#ventana-plan');
  if (ventana) {
    const form = $('form', ventana);
    $$('[data-abrir-plan]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const plan = b.dataset.abrirPlan, inicio = b.dataset.inicio;
      form.hidden = false; $('.listo', ventana).hidden = true; $('.estado', form).hidden = true;
      if (plan) form.elements.plan.value = plan;
      if (inicio) $$('input[name=inicio]', form).forEach(r => { r.checked = r.value === inicio; });
      $('#plan-titulo').textContent = inicio === 'PRUEBA' ? 'Prueba gratis 8 días' : 'Elegir plan';
      abiertos.set(form, Date.now());
      if (ventana.showModal) ventana.showModal(); else ventana.setAttribute('open', '');
      setTimeout(() => form.elements.negocio.focus(), 50);
    }));
    $$('[data-cerrar]', ventana).forEach(b => b.addEventListener('click', () => ventana.close()));
    ventana.addEventListener('click', e => { if (e.target === ventana) ventana.close(); });
    const plan = form.elements.plan, adicional = $('[data-adicional]', form);
    const verAdicional = () => { if (adicional) adicional.hidden = plan.value !== 'POS' || !estado.factura; };
    plan.addEventListener('change', verAdicional); ventana.addEventListener('focusin', verAdicional, { once: false });
  }
  const sesion = $('#ventana-sesion');
  if (sesion) {
    $$('[data-abrir-sesion]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); sesion.showModal ? sesion.showModal() : sesion.setAttribute('open', ''); }));
    $$('[data-cerrar]', sesion).forEach(b => b.addEventListener('click', () => sesion.close()));
    sesion.addEventListener('click', e => { if (e.target === sesion) sesion.close(); });
  }
})();
