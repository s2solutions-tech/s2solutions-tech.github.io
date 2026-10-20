/**
 * Muestra la app de Google Apps Script a pantalla completa dentro de esta página
 * y recorta la franja superior donde Google pone su aviso.
 *
 * Cada página define antes:  window.SGB = { app: 'https://script.google.com/macros/s/.../exec', pedir: true|false }
 *
 * Calibración del recorte (en píxeles), por si Google cambia el tamaño del aviso:
 *   - RECORTE        → pantallas anchas (computador, tablet)
 *   - RECORTE_MOVIL  → celulares (ahí el aviso puede ocupar dos líneas)
 *   - Para probar sin cambiar el archivo: agrega ?recorte=60 a la dirección.
 */
(function () {
  const RECORTE = 0;         // calibrado: dentro de la página propia, Google no muestra el aviso
  const RECORTE_MOVIL = 0;
  const ANCHO_MOVIL = 600;

  const cfg = window.SGB || {};
  const marco = document.getElementById('marco');
  if (!cfg.app || cfg.app.indexOf('PEGA_AQUI') !== -1) {
    marco.style.display = 'none';
    document.getElementById('sin-configurar').style.display = 'block';
    return;
  }
  const params = new URLSearchParams(location.search);
  const manual = params.has('recorte') ? Number(params.get('recorte')) : null;

  function ajustar() {
    const r = (manual !== null && isFinite(manual)) ? manual
      : (window.innerWidth <= ANCHO_MOVIL ? RECORTE_MOVIL : RECORTE);
    marco.style.top = (-r) + 'px';
    marco.style.height = 'calc(100% + ' + r + 'px)';
  }
  ajustar();
  window.addEventListener('resize', ajustar);
  // La página del QR pasa a la app el número de mesa (…/pedir/?mesa=5)
  const mesa = (params.get('mesa') || '').replace(/[^0-9]/g, '');
  marco.src = cfg.app + (cfg.pedir ? '?pedir=1' + (mesa ? '&mesa=' + mesa : '') : '');
})();
