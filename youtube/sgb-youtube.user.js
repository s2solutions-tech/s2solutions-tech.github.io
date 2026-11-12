// ==UserScript==
// @name         SGB - YouTube automático
// @namespace    https://s2solutions-tech.github.io/youtube
// @version      4.4
// @description  Conecta el YouTube del bar con su app (S2 Solutions): muestra lo que suena, busca las canciones pedidas y reproduce la cola en orden.
// @author       S2 Solutions
// @match        https://www.youtube.com/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-start
// @updateURL    https://s2solutions-tech.github.io/youtube/sgb-youtube.user.js
// @downloadURL  https://s2solutions-tech.github.io/youtube/sgb-youtube.user.js
// ==/UserScript==
//
// Script PÚBLICO, el mismo para todos los bares: no lleva la dirección ni la clave de ningún bar.
// Se guardan en este computador (almacenamiento de Tampermonkey) al tocar «🔌 Conectar YouTube» en la app del bar,
// que abre YouTube con un enlace …#sgb-conectar=… (lo que va después de # no se envía a YouTube).
(function () {
  'use strict';
  const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '';
  // Se lee apenas abre la página, antes de que YouTube cambie la dirección
  const conexionNueva = /[#&]sgb-conectar=([^&]+)/.exec(location.hash || '');
  if (conexionNueva) { try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {} }   // la clave no queda en la barra
  // Modo televisor a mano (por si YouTube cambia y no se detecta solo): …youtube.com/#sgb-tv=si | no | auto
  const tvHash = /[#&]sgb-tv=(si|no|auto)/.exec(location.hash || '');
  if (tvHash) {
    GM_setValue('sgb_tv', tvHash[1] === 'auto' ? '' : tvHash[1]);
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  function iniciar() {
  const DIRECCION = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
  if (conexionNueva) {
    let d = null;
    try { d = JSON.parse(decodeURIComponent(conexionNueva[1])); } catch (e) {}
    if (!d || !DIRECCION.test(String(d.u)) || !/^[A-Za-z0-9]{16,64}$/.test(String(d.k))) {
      alert('Ese enlace para conectar YouTube no es válido. Vuelve a tocar «🔌 Conectar YouTube» en la app del bar.');
    } else {
      const bar = String(d.n || 'el bar').slice(0, 60);
      if (confirm('¿Conectar la música de YouTube de este computador con la app de «' + bar + '»?\n\n' +
                  'Acepta solo si abriste este enlace desde la app de tu bar (🔌 Conectar YouTube).')) {
        GM_setValue('sgb_url', String(d.u)); GM_setValue('sgb_clave', String(d.k)); GM_setValue('sgb_bar', bar);
        GM_setValue('sgb_regreso', ''); GM_setValue('sgb_pedida', '');
      }
    }
  }
  const URL_APP = GM_getValue('sgb_url', ''), CLAVE = GM_getValue('sgb_clave', ''), BAR = GM_getValue('sgb_bar', '');

  let ultimoInfo = '', ultimoCmd = GM_getValue('nd_ult_cmd', ''), ultimoCtl = GM_getValue('nd_ult_ctl', ''), pidiendo = false, buscando = false;
  let proxima = null, saltando = false, videoVisto = null, auto = true, enCurso = false, principal = true;
  let posicionar = null;   // { videoId, segundo }: al volver a una canción de la lista cortada a la mitad
  let latencia = 0;        // cuánto tardó la última respuesta de la app (ms), para el diagnóstico del panel 🔌
  // Lo último que se vio de cada video (para saber si YouTube pasó solo a otro porque el anterior terminó)
  let visto = { id: null, restante: null }, anterior = { id: null, restante: null }, seAcaboSolo = false;
  // Identifica esta pestaña; se conserva aunque la página se recargue al cambiar de canción
  let INSTANCIA = '';
  try { INSTANCIA = sessionStorage.getItem('nd_instancia') || ''; } catch (e) {}
  if (!INSTANCIA) {
    INSTANCIA = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem('nd_instancia', INSTANCIA); } catch (e) {}
  }

  // ---------- Indicador de estado (esquina inferior izquierda; no se ve en pantalla completa) ----------
  let ultimoProblema = '', fallosSeguidos = 0, problemaGrave = false;
  function indicador(color, texto) {
    let el = document.getElementById('nd-indicador');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nd-indicador';
      el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;padding:6px 10px;border-radius:8px;' +
        'font:12px Arial,sans-serif;color:#fff;background:rgba(0,0,0,.75);max-width:340px;pointer-events:none;';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = color + ' ' + texto + (VERSION ? ' · v' + VERSION : '');
  }
  if (!URL_APP || !CLAVE) {
    indicador('🔴', 'Música automática sin conectar: en la app del bar, panel 🔌, toca «Conectar YouTube» desde este computador.');
    return;
  }
  function explicar(error) {
    if (error === 'token') return 'La clave no coincide: en la app del bar, panel 🔌, vuelve a tocar «Conectar YouTube».';
    if (/demasiadas veces|too many times/i.test(error)) return 'Google agotó un cupo diario de la app. Se restablece en unas horas.';
    return error;
  }
  function post(obj) {
    const t0 = Date.now();
    return new Promise(function (resolver0) {
      const resolver = function (j) { latencia = Date.now() - t0; resolver0(j); };
      try {
        GM_xmlhttpRequest({
          method: 'POST', url: URL_APP, timeout: 30000,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          data: JSON.stringify(Object.assign({ token: CLAVE, instancia: INSTANCIA, version: VERSION, lat: latencia }, obj)),
          onload: function (r) {
            let j = null;
            try { j = JSON.parse(r.responseText); } catch (e) {}
            if (!j) { ultimoProblema = 'La app respondió algo inesperado (código ' + r.status + '). ¿Cambió la dirección de la app?'; fallosSeguidos++; problemaGrave = false; }
            else if (!j.ok) { ultimoProblema = explicar(String(j.error || 'error')); problemaGrave = true; }
            else { ultimoProblema = ''; fallosSeguidos = 0; problemaGrave = false; }
            resolver(j);
          },
          onerror: function () { ultimoProblema = 'No se pudo conectar con la app. Revisa internet o el permiso de Tampermonkey para script.google.com.'; fallosSeguidos++; problemaGrave = false; resolver(null); },
          ontimeout: function () { ultimoProblema = 'La app tardó demasiado en responder.'; fallosSeguidos++; problemaGrave = false; resolver(null); },
        });
      } catch (e) {
        ultimoProblema = 'Tampermonkey bloqueó la conexión: ' + (e && e.message || e);
        resolver(null);
      }
    });
  }
  // Acceso al reproductor de la página de YouTube (para cambiar de video sin recargar)
  const pagina = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  function reproductor() {
    const p = pagina.document.getElementById('movie_player');
    return (p && typeof p.loadVideoById === 'function') ? p : null;
  }
  function datosReproductor() {
    try { const p = reproductor(); const d = p && p.getVideoData && p.getVideoData(); return (d && d.video_id) ? d : null; }
    catch (e) { return null; }
  }
  function enPantallaCompleta() { return !!(document.fullscreenElement || pagina.document.fullscreenElement); }
  function idActual() {
    if (location.pathname !== '/watch') return null;
    const d = datosReproductor();
    return (d && d.video_id) || new URLSearchParams(location.search).get('v');
  }
  function video() { return document.querySelector('video.html5-main-video, video'); }
  function leer() {
    const id = idActual();
    if (!id) return null;
    const d = datosReproductor();
    // Si el video se cambió sin recargar, el título de la página es viejo: se usa el del reproductor
    const h = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string');
    const titulo = ((d && d.video_id === id && d.title) || (h && h.textContent) || document.title.replace(/ - YouTube$/, '')).trim();
    const c = document.querySelector('ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a');
    const canal = ((d && d.video_id === id && d.author) || (c && c.textContent) || '').trim();
    const t = tiempos();
    const restante = (t && isFinite(t.duracion) && t.duracion > 0) ? Math.max(0, t.duracion - t.actual) : null;
    return { videoId: id, titulo: titulo, canal: canal, pausado: t ? t.pausado : false, restante: restante };
  }

  // ---------- Transmitiendo a un televisor (botón «Transmitir» de YouTube) ----------
  // Al transmitir, YouTube deja en pausa en el televisor la canción que empieza (de la cola o de su lista). Solo en ese modo:
  // si una canción nueva queda en pausa y nadie la pausó desde la app, se le da la misma orden que «Reanudar», se verifica y
  // se reintenta. Si el administrador pausó desde la app, se respeta. Fuera de la transmisión no se hace nada distinto.
  let pausaApp = GM_getValue('nd_pausa_app', '') === 'si';
  let tvSenal = '', tvVigilado = null, tvReanudadas = 0, tvUltima = '', tvSalto = '';
  /** Diagnóstico: cada vez que el script cambia la canción al transmitir, cómo lo hizo y si el televisor cambió. */
  function anotarSalto(id, via, ok) {
    tvSalto = id + ' por ' + via + ': ' + (ok === undefined ? 'enviado' : ok ? '✓ cambió' : '✗ no cambió') + ' (' + new Date().toLocaleTimeString() + ')';
    console.log('[Bar] Transmitiendo: ' + tvSalto);
  }
  /** Diagnóstico: lo que el reproductor dice del televisor (segundo / duración, estado). */
  function lecturaTv() {
    try {
      const p = reproductor();
      if (!p || typeof p.getCurrentTime !== 'function') return 'sin reproductor';
      return Math.round(Number(p.getCurrentTime()) || 0) + '/' + Math.round(Number(p.getDuration && p.getDuration()) || 0) + ' s, estado ' +
             (typeof p.getPlayerState === 'function' ? p.getPlayerState() : '?');
    } catch (e) { return 'error: ' + (e && e.message || e); }
  }
  function transmitiendo() {
    const forzado = GM_getValue('sgb_tv', '');
    if (forzado === 'si') { tvSenal = 'a mano (#sgb-tv=si)'; return true; }
    if (forzado === 'no') { tvSenal = ''; return false; }
    try {
      const p = pagina.document.getElementById('movie_player');
      if (p && p.classList && p.classList.contains('ytp-remote')) { tvSenal = 'reproductor en modo remoto'; return true; }
      const aviso = pagina.document.querySelector('.ytp-remote-display-status, .ytp-remote-display-status-text');
      if (aviso && aviso.offsetParent !== null && /\S/.test(aviso.textContent || '')) { tvSenal = 'aviso «Reproduciendo en…»'; return true; }
    } catch (e) {}
    tvSenal = '';
    return false;
  }
  /** ¿En pausa? Primero lo que dice el reproductor de YouTube (también al transmitir); si no, el video de la página. */
  function enPausa() {
    try {
      const p = reproductor();
      if (p && typeof p.getPlayerState === 'function') {
        const s = p.getPlayerState();
        if (s === 1 || s === 3) return false;              // reproduciendo / cargando
        if (s === 2 || s === 5 || s === -1) return true;   // en pausa / lista para empezar / sin empezar
      }
    } catch (e) {}
    const v = video();
    return !!(v && v.paused);
  }
  /**
   * Tiempo y estado de lo que suena. Al transmitir, el video de la página queda quieto (suena en el televisor): se lee del
   * reproductor de YouTube, que sí sigue al televisor. Sin transmitir, del video de la página, como siempre.
   */
  function tiempos() {
    if (transmitiendo()) {
      try {
        const p = reproductor();
        if (p && typeof p.getCurrentTime === 'function' && typeof p.getDuration === 'function') {
          const st = typeof p.getPlayerState === 'function' ? p.getPlayerState() : null;
          return { actual: Number(p.getCurrentTime()) || 0, duracion: Number(p.getDuration()) || NaN, pausado: enPausa(), termino: st === 0 };
        }
      } catch (e) {}
    }
    const v = video();
    return v ? { actual: v.currentTime, duracion: v.duration, pausado: v.paused, termino: !!v.ended } : null;
  }
  function pausarActual() {
    const v = video(); if (v) v.pause();
    if (transmitiendo()) { try { const p = reproductor(); if (p && p.pauseVideo) p.pauseVideo(); } catch (e) {} }
  }
  function darPlay(intento) {
    const v = video();
    if (v) { const p = v.play(); if (p && p.catch) p.catch(function () {}); }   // la misma orden que «Reanudar»
    if (intento >= 3) { try { const r = reproductor(); if (r && r.playVideo) r.playVideo(); } catch (e) {} }   // respaldo
  }
  function vigilarTv() {
    if (!auto || !principal || pausaApp || !transmitiendo()) { tvVigilado = null; return; }
    const id = idActual();
    if (!id) return;
    const ahora = Date.now();
    if (!tvVigilado || tvVigilado.id !== id) tvVigilado = { id: id, desde: ahora, intentos: 0, listo: false, proximo: ahora + 2500 };
    const t = tvVigilado;
    if (t.listo) return;
    if (!enPausa()) {   // ya suena: desde aquí una pausa es de alguien
      if (t.intentos && !t.contada) {
        t.contada = true; tvReanudadas++;
        tvUltima = 'arrancó sola en el intento ' + t.intentos + ' (' + new Date().toLocaleTimeString() + ')';
        console.log('[Bar] Transmitiendo: la canción quedó en pausa al empezar y se reanudó (intento ' + t.intentos + ').');
      }
      if (t.intentos || ahora - t.desde > 1500) t.listo = true;
      return;
    }
    if (t.intentos >= 5 || ahora - t.desde > 45000) {
      t.listo = true;
      if (t.intentos) tvUltima = 'no arrancó después de ' + t.intentos + ' intentos (' + new Date().toLocaleTimeString() + ')';
      return;
    }
    if (ahora < t.proximo) return;
    t.intentos++; t.proximo = ahora + 3000;
    darPlay(t.intentos);   // en la próxima revisión (1 s) se verifica si arrancó; si no, se reintenta a los 3 s
  }
  setInterval(vigilarTv, 1000);

  // ---------- Volver a la lista de reproducción de YouTube después de las canciones pedidas ----------
  // "pedida" = el último video que puso la app. "regreso" = dónde iba la lista cuando la app la interrumpió.
  let regreso = null;
  try { regreso = JSON.parse(GM_getValue('sgb_regreso', '') || 'null'); } catch (e) {}
  if (regreso && !(Date.now() - regreso.ts < 12 * 3600000)) regreso = null;   // de otra noche: se olvida
  function guardarRegreso(r) { regreso = r; GM_setValue('sgb_regreso', r ? JSON.stringify(r) : ''); }
  function esPedida(id) { return !!id && GM_getValue('sgb_pedida', '') === id; }
  /** La lista de YouTube en la que va la página (null si no suena una lista). */
  function listaDePagina() {
    const p = reproductor(), q = new URLSearchParams(location.search);
    let lista = '', indice = -1, ids = null;
    try { lista = (p && p.getPlaylistId && p.getPlaylistId()) || ''; } catch (e) {}
    if (!lista) lista = q.get('list') || '';
    if (!lista) return null;
    try { const l = p && p.getPlaylist && p.getPlaylist(); if (l && l.length) ids = Array.prototype.slice.call(l).map(String); } catch (e) {}
    try { const i = p && p.getPlaylistIndex && p.getPlaylistIndex(); if (typeof i === 'number' && i >= 0) indice = i; } catch (e) {}
    if (indice < 0 && q.get('index')) indice = Number(q.get('index')) - 1;
    const id = idActual();
    if (ids && ids[indice] !== id && ids.indexOf(id) !== -1) indice = ids.indexOf(id);
    return indice >= 0 ? { lista: lista, indice: indice, ids: ids } : null;
  }
  /** Antes de que la app ponga una canción pedida: se anota dónde iba la lista (video, posición y segundo). */
  function recordarLista() {
    const id = idActual();
    if (!id || esPedida(id)) return;   // de una pedida a otra: se conserva a dónde volver
    const l = listaDePagina(), t = tiempos();
    if (!l) { guardarRegreso(null); return; }   // no sonaba una lista: al final, como siempre
    const restante = (t && isFinite(t.duracion)) ? t.duracion - t.actual : 0;
    guardarRegreso({ lista: l.lista, indice: l.indice, videoId: id, segundo: Math.floor(t ? t.actual : 0),
                     completa: restante <= 3, siguiente: l.ids ? (l.ids[l.indice + 1] || '') : null, ts: Date.now() });
  }
  /** Se acabaron las pedidas: la lista sigue con la siguiente (si la anterior terminó) o donde iba (si se cortó). */
  function volverALista() {
    const r = regreso;
    guardarRegreso(null);
    GM_setValue('sgb_pedida', '');
    if (r && !r.completa) return irA({ videoId: r.videoId, lista: r.lista, indice: r.indice, segundo: r.segundo });
    if (r && r.siguiente) return irA({ videoId: r.siguiente, lista: r.lista, indice: r.indice + 1 });
    if (r && r.siguiente === null) {   // no se supo cuál sigue: se vuelve a esa canción y se pasa a la siguiente
      GM_setValue('sgb_avanzar', r.videoId);
      return irA({ videoId: r.videoId, lista: r.lista, indice: r.indice });
    }
    // No sonaba una lista, o la lista se acabó: como siempre, YouTube decide qué sigue
    autoplayYoutube(true);
    const t = tiempos();
    if (t && t.pausado && !t.termino) darPlay(1);
  }
  /** Al llegar a la canción de la lista: la lleva al segundo donde iba, o pasa a la siguiente si hacía falta. */
  function ajustarAlLlegar(t) {
    const id = idActual();
    if (posicionar && id === posicionar.videoId && isFinite(t.duracion)) {
      if (t.actual < posicionar.segundo - 5) {
        const p = reproductor(), v = video();
        if (transmitiendo() && p && p.seekTo) { try { p.seekTo(posicionar.segundo, true); } catch (e) {} }
        else if (v) v.currentTime = posicionar.segundo;
      }
      posicionar = null;
    }
    const avanzar = GM_getValue('sgb_avanzar', '');
    if (avanzar && id === avanzar) {
      GM_setValue('sgb_avanzar', '');
      const p = reproductor();
      try { if (p && p.nextVideo) p.nextVideo(); } catch (e) {}
    }
  }

  /** Navegación interna de YouTube (la misma que usa al pasar solo a la siguiente): actualiza la página y el título. */
  function navegarComoYoutube(d) {
    try {
      const app = pagina.document.querySelector('ytd-app');
      if (!app) return false;
      const we = { videoId: d.videoId };
      if (d.lista) { we.playlistId = d.lista; we.index = d.indice; }
      if (d.segundo) we.startTimeSeconds = d.segundo;
      const detalle = { endpoint: {
        commandMetadata: { webCommandMetadata: { url: urlDe(d), webPageType: 'WEB_PAGE_TYPE_WATCH', rootVe: 3832 } },
        watchEndpoint: we } };
      const det = (typeof cloneInto === 'function') ? cloneInto(detalle, pagina) : JSON.parse(JSON.stringify(detalle));
      const Ev = pagina.CustomEvent || CustomEvent;
      app.dispatchEvent(new Ev('yt-navigate', { bubbles: true, composed: true, detail: det }));
      return true;
    } catch (e) { return false; }
  }
  /** Respaldo: carga el video en el mismo reproductor y deja al menos la dirección y el título de la pestaña al día. */
  function cargarEnReproductor(videoId) {
    const p = reproductor();
    if (!p) return false;
    try {
      p.loadVideoById(videoId);
      try { history.replaceState(history.state, '', '/watch?v=' + videoId); } catch (e) {}
      setTimeout(function () { const d = datosReproductor(); if (d && d.title) document.title = d.title + ' - YouTube'; }, 2000);
      return true;
    } catch (e) { return false; }
  }
  function urlDe(d) {
    return '/watch?v=' + d.videoId + (d.lista ? '&list=' + encodeURIComponent(d.lista) + '&index=' + (d.indice + 1) : '') +
      (d.segundo ? '&t=' + d.segundo + 's' : '');
  }
  /** Pone una canción que pidió la app. */
  function ir(videoId) {
    if (!videoId) return;
    if (idActual() === videoId) { const t = tiempos(); if (t && t.pausado) darPlay(1); return; }
    recordarLista();
    GM_setValue('sgb_pedida', videoId);
    irA({ videoId: videoId });
  }
  /** d = { videoId, lista?, indice?, segundo? } */
  function irA(d) {
    saltando = true;
    posicionar = d.segundo ? { videoId: d.videoId, segundo: d.segundo } : null;
    const antes = idActual();
    // Al transmitir, recargar la página no cambia lo que suena en el televisor (la página vuelve a unirse a la transmisión, que
    // sigue con lo suyo): se le pide la canción al reproductor de YouTube, que se la pasa al televisor. Si a los 6 s no cambió,
    // se intenta como siempre (navegación interna y, si tampoco, recargando).
    if (transmitiendo() && reproductor()) {
      const p = reproductor();
      let enviado = false;
      try {
        if (d.lista && typeof p.loadPlaylist === 'function') p.loadPlaylist({ list: d.lista, listType: 'playlist', index: d.indice || 0, startSeconds: d.segundo || 0 });
        else p.loadVideoById(d.videoId, d.segundo || 0);
        enviado = true;
      } catch (e) {}
      if (enviado) {
        try { history.replaceState(history.state, '', urlDe(d)); } catch (e) {}
        anotarSalto(d.videoId, 'el reproductor');
        setTimeout(function () {
          if (idActual() === d.videoId) { anotarSalto(d.videoId, 'el reproductor', true); return; }
          anotarSalto(d.videoId, 'el reproductor', false);
          if (navegarComoYoutube(d)) {
            setTimeout(function () {
              if (idActual() === d.videoId) { anotarSalto(d.videoId, 'navegación interna', true); return; }
              anotarSalto(d.videoId, 'navegación interna', false);
              location.href = 'https://www.youtube.com' + urlDe(d);
            }, 6000);
            return;
          }
          location.href = 'https://www.youtube.com' + urlDe(d);
        }, 6000);
        return;
      }
    }
    // En pantalla completa: cambiar sin recargar la página, para no salir de pantalla completa
    if (reproductor() && enPantallaCompleta()) {
      pausarActual();
      if (navegarComoYoutube(d)) {
        setTimeout(function () {
          if (d.lista) { if (idActual() === antes) location.href = 'https://www.youtube.com' + urlDe(d); }   // no se movió: se recarga
          else if (idActual() !== d.videoId && !cargarEnReproductor(d.videoId)) location.href = 'https://www.youtube.com' + urlDe(d);
        }, 2500);
        return;
      }
      if (!d.lista && cargarEnReproductor(d.videoId)) return;
    }
    pausarActual();   // corta el video actual para que YouTube no ponga el suyo
    location.href = 'https://www.youtube.com' + urlDe(d);
  }
  /** Enciende o apaga la reproducción automática de YouTube (botón del reproductor). */
  function autoplayYoutube(encendido) {
    const b = document.querySelector('.ytp-autonav-toggle-button');
    if (!b) return;
    const actual = b.getAttribute('aria-checked') === 'true';
    if (actual !== encendido) b.click();
  }
  /** Saca los videos de una respuesta de YouTube (formato viejo "videoRenderer" y nuevo "lockupViewModel"). */
  function extraerVideos(datos) {
    const out = [], vistos = {};
    function texto(x) { return x ? (x.simpleText || x.content || (x.runs ? x.runs.map(function (r) { return r.text; }).join('') : '')) : ''; }
    (function recorrer(o) {
      if (!o || typeof o !== 'object' || out.length >= 5) return;
      if (o.videoRenderer && o.videoRenderer.videoId) {
        const v = o.videoRenderer;
        if (!vistos[v.videoId]) {
          vistos[v.videoId] = true;
          out.push({ videoId: v.videoId, titulo: texto(v.title),
                     canal: texto(v.ownerText) || texto(v.longBylineText), duracion: texto(v.lengthText) });
        }
        return;
      }
      const l = o.lockupViewModel;
      if (l && l.contentId && /VIDEO/.test(String(l.contentType || 'VIDEO'))) {
        if (!vistos[l.contentId] && /^[A-Za-z0-9_-]{11}$/.test(l.contentId)) {
          vistos[l.contentId] = true;
          const md = l.metadata && l.metadata.lockupMetadataViewModel;
          let canal = '';
          try { canal = md.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content; } catch (e) {}
          out.push({ videoId: l.contentId, titulo: md ? texto(md.title) : '', canal: canal || '', duracion: '' });
        }
        return;
      }
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) recorrer(o[i]); return; }
      for (const k in o) if (k !== 'adSlotRenderer' && k !== 'promotedSparklesWebRenderer') recorrer(o[k]);
    })(datos);
    return out;
  }
  /** 1) Buscador interno de YouTube (el mismo que usa su página): respuesta en JSON limpio. */
  async function buscarApi(consulta) {
    const cfg = pagina.ytcfg;
    const ctx = cfg && cfg.get ? cfg.get('INNERTUBE_CONTEXT') : null;
    if (!ctx) return null;
    const key = cfg.get('INNERTUBE_API_KEY');
    const r = await fetch('/youtubei/v1/search?prettyPrint=false' + (key ? '&key=' + encodeURIComponent(key) : ''), {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: JSON.parse(JSON.stringify(ctx)), query: consulta }),
    });
    if (!r.ok) throw new Error('api ' + r.status);
    return extraerVideos(await r.json());
  }
  /** 2) Respaldo: leer la página de resultados. */
  async function buscarHtml(consulta) {
    const r = await fetch('/results?search_query=' + encodeURIComponent(consulta), { credentials: 'include' });
    const html = await r.text();
    const patrones = [
      /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
      /window\["ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/,
      /ytInitialData\s*=\s*(\{[\s\S]*?\});\s*(?:var |window|<\/script>)/,
    ];
    for (let i = 0; i < patrones.length; i++) {
      const m = html.match(patrones[i]);
      if (!m) continue;
      try { const v = extraerVideos(JSON.parse(m[1])); if (v.length) return v; } catch (e) {}
    }
    // Variante en la que YouTube manda los datos como texto escapado
    const ms = html.match(/var ytInitialData\s*=\s*'((?:\\.|[^'\\])*)';/);
    if (ms) {
      try {
        const json = ms[1].replace(/\\x([0-9a-fA-F]{2})/g, function (a, h) { return String.fromCharCode(parseInt(h, 16)); })
                          .replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const v = extraerVideos(JSON.parse(json)); if (v.length) return v;
      } catch (e) {}
    }
    // Último recurso: tomar los videos directamente del texto
    const out = [], vistos = {}, re = /"videoId":"([A-Za-z0-9_-]{11})"[\s\S]{0,400}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g;
    let x;
    while ((x = re.exec(html)) && out.length < 5) {
      if (vistos[x[1]]) continue;
      vistos[x[1]] = true;
      let t = x[2]; try { t = JSON.parse('"' + t + '"'); } catch (e) {}
      out.push({ videoId: x[1], titulo: t, canal: '', duracion: '' });
    }
    return out;
  }
  async function buscar(consulta) {
    let errores = [];
    try { const v = await buscarApi(consulta); if (v && v.length) return { opciones: v, metodo: 'interno' }; }
    catch (e) { errores.push('interno: ' + (e && e.message || e)); }
    try { const v = await buscarHtml(consulta); if (v && v.length) return { opciones: v, metodo: 'página' }; }
    catch (e) { errores.push('página: ' + (e && e.message || e)); }
    return { opciones: [], metodo: '', error: errores.join(' | ') || 'YouTube no devolvió videos' };
  }
  async function atenderBusquedas(lista) {
    buscando = true;
    try {
      // Todas las búsquedas a la vez, y cada resultado se envía apenas está listo
      await Promise.all(lista.map(async function (b) {
        const r = await buscar(b.consulta);
        console.log('[Bar] Búsqueda "' + b.consulta + '":', r.opciones.length, 'videos', r.error || '');
        await post({ accion: 'resultados', id: b.id, consulta: b.consulta,
                     opciones: r.opciones, metodo: r.metodo, error: r.error || '' });
      }));
    } finally {
      buscando = false;
    }
    pulso();   // revisa de inmediato si quedó otra canción por buscar
  }
  /** Respaldo: si no se alcanzó a adelantar la siguiente, se le pregunta a la app al terminar. */
  async function terminado() {
    if (pidiendo || saltando) return;
    pidiendo = true;
    const id = idActual();
    const r = await post({ accion: 'terminado', videoId: id });
    pidiendo = false;
    if (r && r.reproducir) ir(r.reproducir);
    else if (regreso && esPedida(id) && idActual() === id) volverALista();   // se acabaron las pedidas
  }
  /** Cada avance de lo que suena (el video de la página, o el reproductor al transmitir). */
  function avance() {
    const t = tiempos();
    if (!t) return;
    const idv = idActual();
    if (idv !== visto.id) { anterior = visto; visto = { id: idv, restante: null }; }
    if (isFinite(t.duracion) && t.duracion > 0) visto.restante = t.duracion - t.actual;
    ajustarAlLlegar(t);
    if (saltando || !idActual() || !isFinite(t.duracion) || t.duracion < 5) return;
    // Medio segundo antes del final (2 s al transmitir: el televisor informa más despacio), salta a la siguiente de la cola
    if (t.duracion - t.actual > (transmitiendo() ? 2 : 0.6)) return;
    if (proxima) { if (proxima !== idActual()) ir(proxima); return; }
    // Última pedida y antes sonaba una lista: se detiene aquí (que YouTube no salte solo) y se pregunta a la app
    if (auto && principal && regreso && esPedida(idActual()) && !t.pausado) { pausarActual(); terminado(); }
  }
  function alTerminar() {
    if (!idActual() || saltando || !auto || !principal) return;
    if (proxima && proxima !== idActual()) ir(proxima); else terminado();
  }
  function engancharVideo() {
    const v = video();
    if (!v || v.__nd) return;
    v.__nd = true;
    v.addEventListener('timeupdate', avance);
    v.addEventListener('ended', alTerminar);
  }
  // Al transmitir, el video de la página no avanza (no hay "timeupdate" ni "ended"): se revisa el reproductor cada medio segundo
  let tvTermino = null;
  setInterval(function () {
    if (!transmitiendo()) { tvTermino = null; return; }
    avance();
    const t = tiempos(), id = idActual();
    if (t && t.termino && id && tvTermino !== id) { tvTermino = id; alTerminar(); }
  }, 500);
  async function pulso() {
    if (enCurso) return;   // no encimar consultas si la anterior todavía no responde
    enCurso = true;
    try { await pulsoInterno(); } catch (e) { ultimoProblema = 'Error del script: ' + (e && e.message || e); }
    finally {
      enCurso = false;
      if (ultimoProblema && (problemaGrave || fallosSeguidos >= 2)) indicador('🔴', 'Música automática sin conexión: ' + ultimoProblema);
      else if (ultimoProblema) indicador('🟡', 'La app respondió lento, reintentando…');
      else if (!idActual()) indicador('🟡', 'Conectado' + (BAR ? ' con «' + BAR + '»' : '') + '. Pon un video para que la app lo vea.');
      else if (!principal) indicador('🟡', 'Conectado, en espera: otra ventana controla la música.');
      else indicador('🟢', 'Música automática conectada' + (BAR ? ' con «' + BAR + '»' : '') + (auto ? '' : ' (control manual)') + (transmitiendo() ? ' · 📺 TV' : ''));
    }
  }
  async function pulsoInterno() {
    engancharVideo();
    const d = leer() || {};
    if (d.videoId !== videoVisto) {
      // ¿YouTube pasó solo a este video porque el anterior terminó (y no fue el script el que saltó)?
      seAcaboSolo = !!videoVisto && !saltando && anterior.id === videoVisto && anterior.restante !== null && anterior.restante < 5;
      videoVisto = d.videoId; proxima = null; saltando = false;
    }
    const clave = d.videoId ? d.videoId + '|' + d.titulo + '|' + d.pausado : '';
    const cambio = clave !== ultimoInfo;
    ultimoInfo = clave;
    const tv = transmitiendo();
    const r = await post(Object.assign({ accion: 'pulso', cambio: cambio && !!d.videoId, tv: tv, tvSenal: tvSenal, tvN: tvReanudadas, tvUltima: tvUltima, pausaApp: pausaApp,
                                         tvSalto: tvSalto, tvLectura: tv ? lecturaTv() : '' }, d));
    if (!r || !r.ok) return;
    if (r.principal === false) {
      // Hay otra ventana de YouTube reproduciendo: esta no toca nada (solo puede ayudar a buscar canciones)
      if (principal) console.log('[Bar] Otra ventana de YouTube es la principal; esta queda en espera.');
      principal = false; proxima = null;
      if (r.buscar && r.buscar.length && !buscando) atenderBusquedas(r.buscar);
      return;
    }
    principal = true;
    if (r.control && r.control.id !== ultimoCtl) {   // pausar / reanudar desde la app
      ultimoCtl = r.control.id; GM_setValue('nd_ult_ctl', ultimoCtl);
      pausaApp = r.control.accion === 'PAUSA'; GM_setValue('nd_pausa_app', pausaApp ? 'si' : '');   // el modo TV respeta la pausa de la app
      const v = video();
      if (v) {
        if (r.control.accion === 'PAUSA') pausarActual();   // al transmitir, también el reproductor del televisor
        else darPlay(1);
      }
    }
    if (r.auto === false) {
      // Control manual: el script no toca YouTube (solo informa lo que suena y busca canciones)
      if (auto) autoplayYoutube(true);   // al apagarlo, se devuelve la reproducción automática de YouTube
      auto = false; proxima = null;
    } else {
      auto = true;
    }
    if (auto && r.comando && r.comando.id !== ultimoCmd) {
      ultimoCmd = r.comando.id; GM_setValue('nd_ult_cmd', ultimoCmd);
      pausaApp = false; GM_setValue('nd_pausa_app', '');   // «Poner ya» desde la app: que suene
      ir(r.comando.videoId);
      return;
    }
    if (auto && 'proxima' in r) {
      proxima = r.proxima || null;
      // Se pasó el momento (la respuesta llegó tarde) y YouTube puso otra canción de la lista: se pone la de la cola ya
      if (seAcaboSolo && proxima && d.videoId && proxima !== d.videoId && !esPedida(d.videoId)) {
        const t = tiempos();
        seAcaboSolo = false;
        if (t && t.actual < 20) { console.log('[Bar] YouTube pasó solo a otra canción; se pone la de la cola.'); ir(proxima); return; }
      }
      // Si hay canción en la cola, YouTube no debe poner la suya; si no hay, que siga sola
      // (salvo que suene una pedida y haya una lista a la cual volver: la devuelve el script)
      autoplayYoutube(!proxima && !(regreso && esPedida(d.videoId)));
    }
    if (seAcaboSolo) { const t = tiempos(); if (!t || t.actual >= 20) seAcaboSolo = false; }
    if (r.buscar && r.buscar.length && !buscando) atenderBusquedas(r.buscar);
  }
  setInterval(pulso, 3000);
  pulso();
  }
})();
