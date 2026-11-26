/* Web de S2 Solutions: ajustes, formularios (solicitud de plan o prueba y contacto), video y vista previa. */
(function () {
  'use strict';

  // ═══ AJUSTES (un solo cambio cada uno) ═══
  const S2 = {
    URL_FORMULARIOS: 'https://script.google.com/macros/s/AKfycbwByncXAGokYD7qF9MSEDvGFdKUpmHQJ6n5Hign4fZoP5wHrdAijHPOc0ncErXhlLxA/exec',            // dirección /exec del proyecto «SGB - Web» (Apps Script) que guarda las solicitudes y avisa por correo
    MOSTRAR_FACTURACION: true,      // false = la facturación electrónica se oculta en toda la web (portada, módulos, planes, preguntas)
    VIDEO_YOUTUBE: '',              // enlace o ID del video de YouTube; vacío = la sección no muestra video
    MOSTRAR_TESTIMONIOS: false,     // true cuando haya testimonios con permiso escrito del cliente
    REDES: [{ nombre: 'Instagram', url: 'https://www.instagram.com/s2solutions.co/' }],   // las del pie (Facebook, TikTok…: agregarlas aquí y en index.html)
    MOSTRAR_INGRESO: false,         // true cuando esté la parte 2 del ingreso (ingresar.s2solutions.app): vuelve «Iniciar sesión» arriba
    WHATSAPP: '573234924680'
  };
  window.S2_AJUSTES = S2;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const previa = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';

  // ── Facturación, testimonios, video y redes ──
  let repintar = () => {};   // los precios (el nombre «POS + Facturación» depende de la facturación)
  function aplicar(opc) {
    $$('[data-factura]').forEach(el => { el.hidden = !opc.factura; });
    $$('[data-sin-factura]').forEach(el => { el.hidden = opc.factura; });
    const ademas = $('#ademas'); if (ademas) ademas.classList.toggle('dos', !opc.factura);
    $$('[data-testimonios]').forEach(el => { el.hidden = !opc.testimonios; });
    $$('[data-abrir-sesion]').forEach(el => { el.hidden = !S2.MOSTRAR_INGRESO; });
    const v = $('#video'); if (v) v.hidden = !opc.video;
    const r = $('#redes'); if (r) r.hidden = !opc.redes;
    repintar();
  }
  const idVideo = (() => {
    const t = String(S2.VIDEO_YOUTUBE || '').trim();
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(t);
    return m ? m[1] : /^[\w-]{11}$/.test(t) ? t : '';
  })();
  const estado = { factura: S2.MOSTRAR_FACTURACION, testimonios: !!S2.MOSTRAR_TESTIMONIOS, video: !!idVideo, redes: S2.REDES.length > 0 };
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

  // ── Precios: salen de la pestaña «Ajustes» de la hoja «SGB - Web» (un solo lugar; se cambian ahí, sin tocar la página) ──
  // Mensual / Anual: el selector de arriba de los planes (por defecto Mensual). El formulario tiene su propia «Forma de pago»
  // (empieza con la que se estaba viendo al tocar «Elegir plan»).
  const pesos = n => '$' + Number(n).toLocaleString('es-CO');
  const miles = n => Number(n).toLocaleString('es-CO');
  // Con / Sin facturación electrónica: el otro selector de arriba de los planes (por defecto Con). Solo cambia la sección de planes:
  // sin facturación, POS y Completo usan sus precios «_sin_fe» de «Ajustes» y se ocultan el certificado, el cupo y los adicionales de facturación.
  let precios = {}, periodo = 'MENSUAL', conFE = true;
  const fe = () => estado.factura && conFE;
  const SIN_FE = { pos: 'pos_sin_fe', completo: 'completo_sin_fe' };
  const clave = k => (!fe() && SIN_FE[k]) || k;
  const NOMBRES = () => ({ MUSICA: 'Música', POS: estado.factura ? 'POS + Facturación' : 'POS', COMPLETO: 'Completo',
                           POS_SIN_FE: 'POS', COMPLETO_SIN_FE: 'Completo sin facturación' });
  const periodoForm = () => { const r = $('#ventana-plan input[name=periodo]:checked'); return r ? r.value : 'MENSUAL'; };
  /** «$15.000 COP / mes» o «$150.000 COP / año» según el periodo; null si ese precio no está en «Ajustes». */
  const precioDe = (clave, per) => { const v = precios[per === 'ANUAL' ? clave + '_anual' : clave]; return v ? pesos(v) + ' COP / ' + (per === 'ANUAL' ? 'año' : 'mes') : null; };
  function pintarPrecios() {
    const p = precios, anual = periodo === 'ANUAL';
    $$('[data-periodo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.periodo === periodo)));
    $$('[data-fe]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.fe === 'SI') === conFE)));
    $$('[data-con-fe]').forEach(el => { el.hidden = !fe(); });
    $$('[data-sin-fe]').forEach(el => { el.hidden = fe(); });
    $$('[data-solo-anual]').forEach(el => { el.hidden = !anual; });
    $$('[data-precio]').forEach(el => { const k = clave(el.dataset.precio), v = p[anual ? k + '_anual' : k]; el.textContent = v ? pesos(v) : 'Consúltanos'; });
    $$('[data-por]').forEach(el => { el.textContent = anual ? 'COP / año' : 'COP / mes'; });
    $$('[data-equivale]').forEach(el => {
      const v = p[clave(el.dataset.equivale) + '_anual'];
      el.hidden = !(anual && v); el.textContent = anual && v ? 'Equivale a ' + pesos(Math.round(v / 12)) + ' / mes' : '';
    });
    const cert = p.certificado ? pesos(p.certificado) + ' COP / año' : 'precio a consultar';
    $$('[data-certificado]').forEach(el => { el.innerHTML = '<b>Certificado digital y habilitación DIAN:</b> ' + (anual ? 'incluido' : '+ ' + cert); });
    $$('[data-precio-certificado]').forEach(el => { el.textContent = cert; });
    const sp = [precioDe('spotify', 'MENSUAL'), precioDe('spotify', 'ANUAL')].filter(Boolean);
    $$('[data-precio-spotify]').forEach(el => { el.innerHTML = sp.length ? sp[0] + (sp[1] ? ' <small>o ' + sp[1] + '</small>' : '') : 'Precio a consultar'; });
    $$('[data-precio-documento]').forEach(el => { el.textContent = p.documento_extra ? pesos(p.documento_extra) + ' COP c/u' : 'Precio a consultar'; });
    $$('[data-precio-documento-corto]').forEach(el => { el.textContent = p.documento_extra ? pesos(p.documento_extra) : 'un valor adicional (consúltanos)'; });
    if (p.documentos_mes) $$('[data-cupo-documentos]').forEach(el => { el.textContent = miles(p.documentos_mes); });
    // Formulario: en la lista solo el nombre corto (cabe en el celular sin cortarse); el precio del plan elegido va debajo,
    // en la forma de pago elegida ahí
    const pf = periodoForm(), n = NOMBRES();
    $$('option[data-precio-opcion]').forEach(o => { o.textContent = n[o.value]; });
    $$('[data-precio-plan-form]').forEach(el => {
      const o = el.parentElement.querySelector('select option:checked');
      const v = o && precios[pf === 'ANUAL' ? o.dataset.precioOpcion + '_anual' : o.dataset.precioOpcion];
      el.textContent = v ? pesos(v) + ' COP / ' + (pf === 'ANUAL' ? 'año (equivale a ' + pesos(Math.round(v / 12)) + ' / mes)' : 'mes') : 'Precio a consultar';
    });
    $$('[data-precio-spotify-form]').forEach(el => { const v = precioDe('spotify', pf); el.textContent = v ? '+ ' + v : 'precio a consultar'; });
    const planForm = $('#s-plan');   // «y el certificado digital va incluido» solo en los planes con facturación
    $$('[data-form-fe]').forEach(el => { el.hidden = !estado.factura || !!(planForm && /_SIN_FE$/.test(planForm.value)); });
  }
  repintar = pintarPrecios;
  pintarPrecios();
  $$('[data-periodo]').forEach(b => b.addEventListener('click', () => { periodo = b.dataset.periodo; pintarPrecios(); }));
  $$('[data-fe]').forEach(b => b.addEventListener('click', () => { conFE = b.dataset.fe === 'SI'; pintarPrecios(); }));
  if (S2.URL_FORMULARIOS)
    fetch(S2.URL_FORMULARIOS + '?ajustes=1').then(r => r.json()).then(r => { if (r && r.ok) { precios = r.precios || {}; pintarPrecios(); } }).catch(() => {});

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
      const inicio = b.dataset.inicio;
      let plan = b.dataset.abrirPlan;
      if (plan && !fe() && SIN_FE[plan.toLowerCase()]) plan += '_SIN_FE';   // viendo los planes sin facturación
      form.hidden = false; $('.listo', ventana).hidden = true; $('.estado', form).hidden = true;
      if (plan) form.elements.plan.value = plan;
      $$('input[name=periodo]', form).forEach(r => { r.checked = r.value === periodo; });
      if (inicio) $$('input[name=inicio]', form).forEach(r => { r.checked = r.value === inicio; });
      $('#plan-titulo').textContent = inicio === 'PRUEBA' ? 'Prueba gratis 8 días' : 'Elegir plan';
      verOpciones(); abiertos.set(form, Date.now());
      if (ventana.showModal) ventana.showModal(); else ventana.setAttribute('open', '');
      setTimeout(() => form.elements.negocio.focus(), 50);
    }));
    $$('[data-cerrar]', ventana).forEach(b => b.addEventListener('click', () => ventana.close()));
    ventana.addEventListener('click', e => { if (e.target === ventana) ventana.close(); });
    // Spotify (adicional) solo con «Pagar de una vez» y un plan con música (en la prueba gratis no hay Spotify)
    function verOpciones() {
      const conSpotify = $('[data-con-spotify]', form);
      if (conSpotify) {
        conSpotify.hidden = /^POS/.test(form.elements.plan.value) || !$('#s-pagar', form).checked;
        if (conSpotify.hidden) form.elements.spotify.checked = false;
      }
      pintarPrecios();
    }
    form.addEventListener('change', e => { if (/^(plan|periodo|inicio)$/.test(e.target.name)) verOpciones(); });
  }
  const sesion = $('#ventana-sesion');
  if (sesion) {
    $$('[data-abrir-sesion]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); sesion.showModal ? sesion.showModal() : sesion.setAttribute('open', ''); }));
    $$('[data-cerrar]', sesion).forEach(b => b.addEventListener('click', () => sesion.close()));
    sesion.addEventListener('click', e => { if (e.target === sesion) sesion.close(); });
  }
})();
