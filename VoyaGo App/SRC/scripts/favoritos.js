/* ==========================================================================
   VoyaGo · Favoritos (funcional)
   Se guardan en el navegador (localStorage). Conecta:
   - Los corazones ♡ de las tarjetas (portada y Explorar)
   - El corazón y "Guardar en favoritos" de la página de destino
   - La página Favoritos (se dibuja con lo guardado, mismo diseño de siempre)
   La primera vez, se cargan los 6 favoritos que ya mostraba la página.
   ========================================================================== */
(function () {
  'use strict';

  const API = window.VoyaGoAPI;
  if (!API) return;

  const CLAVE = 'vg:favs';
  const tagScript = document.querySelector('script[src$="favoritos.js"]');
  const base = tagScript ? tagScript.src : location.href;

  const idDe = (nombre, pais) => API.norm(nombre) + '|' + API.norm(pais);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- Almacenamiento ---------- */

  function leer() {
    try {
      const v = JSON.parse(localStorage.getItem(CLAVE));
      if (Array.isArray(v)) return v;
    } catch (e) { /* vacío */ }
    return null;
  }
  function guardar(lista) {
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* sin espacio */ }
  }

  // Primera visita: los favoritos que ya traía la página
  (function sembrar() {
    if (leer()) return;
    const base0 = [
      ['Bali', 'bali.png', 'Playas, templos y una cultura que te conecta.'],
      ['Santorini', 'santorini2.jpg', 'Atardeceres inolvidables y paisajes de ensueño.'],
      ['Tokio', 'kioto.jpg', 'Tradición y tecnología en un solo lugar.'],
      ['Roma', 'Roma.png', 'Historia, arte y gastronomía en cada rincón.'],
      ['Nueva York', 'nueva york.png', 'Una ciudad que nunca deja de sorprender.'],
      ['Patagonia', 'patagonia.jpg', 'Naturaleza en su estado más puro.']
    ];
    const ahora = Date.now();
    guardar(base0.map((d, i) => {
      const c = API.buscarEnCatalogo(d[0]) || {};
      return {
        id: idDe(d[0], c.pais), nombre: d[0], pais: c.pais || '', cc: c.cc || '',
        lat: c.lat, lon: c.lon, img: d[1], lema: d[2], t: ahora - i * 1000
      };
    }));
  })();

  function lista() { return leer() || []; }
  function tiene(id) { return lista().some((f) => f.id === id); }

  function alternar(item) {
    const l = lista();
    const i = l.findIndex((f) => f.id === item.id);
    if (i >= 0) { l.splice(i, 1); guardar(l); return false; }
    l.push(Object.assign({}, item, { t: Date.now() }));
    guardar(l);
    return true;
  }

  function actualizar(id, parche) {
    const l = lista();
    const f = l.find((x) => x.id === id);
    if (!f) return;
    Object.assign(f, parche);
    guardar(l);
  }

  function imgUrl(img) {
    if (!img) return '';
    if (/^(https?:)?\/\//.test(img)) return img;
    return new URL('../images/' + encodeURI(img), base).href;
  }

  // "…/images/Tokio.png" → "Tokio.png"
  function archivoDe(src) {
    if (!src) return '';
    if (/^https?:\/\//.test(src) && src.indexOf('/images/') < 0) return src;
    const i = src.lastIndexOf('/images/');
    return i >= 0 ? decodeURIComponent(src.slice(i + 8)) : src;
  }

  const urlDestino = (f) => window.VoyaGoBuscador
    ? window.VoyaGoBuscador.urlDestino(f.lat != null
      ? { nombre: f.nombre, pais: f.pais, cc: f.cc, lat: f.lat, lon: f.lon }
      : { lugar: f.nombre, pais: f.pais })
    : '#';

  /* ---------- Corazones de las tarjetas (portada / explorar) ---------- */

  $$('.tarjeta').forEach((t) => {
    const btn = $('.tarjeta__favorito', t);
    const h3 = $('h3', t);
    if (!btn || !h3) return;
    const nombre = h3.textContent.trim();
    const pais = ($('.tarjeta__pais', t) || {}).textContent || '';
    const id = idDe(nombre, pais.trim());
    const c = API.buscarEnCatalogo(nombre) || {};
    const imgTarjeta = $('img', t);

    const pintar = () => {
      const on = tiene(id);
      btn.textContent = on ? '♥' : '♡';
      btn.classList.toggle('activo', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', (on ? 'Quitar ' : 'Agregar ') + nombre + (on ? ' de favoritos' : ' a favoritos'));
    };
    pintar();
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      alternar({
        id, nombre, pais: pais.trim(), cc: c.cc || '', lat: c.lat, lon: c.lon,
        img: archivoDe(imgTarjeta ? imgTarjeta.getAttribute('src') : ''),
        lema: c.lema || ''
      });
      pintar();
    });
  });

  /* ---------- Página Favoritos ---------- */

  const grid = $('.fv-grid');
  if (grid) {
    const select = $('.fv-orden select');
    const etiquetaTodos = $$('.fv-tab')[0];
    const etiquetaDestinos = $$('.fv-tab')[1];
    const vacio = document.createElement('div');
    vacio.className = 'fv-vacio';
    vacio.hidden = true;
    vacio.innerHTML = '<p>Aún no tienes favoritos guardados.</p>' +
      '<a href="explorar.html" class="ds-plan__btn">Explorar destinos</a>';
    grid.after(vacio);

    const memoria = {}; // para poder volver a marcar un corazón sin recargar

    const cuenta = (el, n) => {
      if (!el) return;
      const txt = Array.from(el.childNodes).reverse().find((x) => x.nodeType === 3 && /\(\d+\)/.test(x.nodeValue));
      if (txt) txt.nodeValue = txt.nodeValue.replace(/\(\d+\)/, '(' + n + ')');
    };

    function refrescarContadores() {
      const n = lista().length;
      cuenta(etiquetaTodos, n);
      cuenta(etiquetaDestinos, n);
      vacio.hidden = n > 0;
    }

    function pintar() {
      let l = lista().slice();
      const orden = select ? select.selectedIndex : 0;
      if (orden === 1) l.sort((a, b) => a.t - b.t);
      else if (orden === 2) l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      else l.sort((a, b) => b.t - a.t);

      grid.innerHTML = l.map((f, i) => {
        memoria[f.id] = f;
        const titulo = API.esc(f.nombre + (f.pais ? ', ' + f.pais : ''));
        const src = imgUrl(f.img);
        return '<article class="fv-card" data-id="' + API.esc(f.id) + '">' +
          '<div class="fv-card__img">' +
            (src ? '<img src="' + API.esc(src) + '" alt="' + titulo + '" />'
              : '<img src="' + API.esc(imgUrl('portada.png')) + '" alt="' + titulo + '" />') +
            '<input type="checkbox" id="fv-c' + (i + 1) + '" class="oculto" checked />' +
            '<label for="fv-c' + (i + 1) + '" class="fv-card__corazon" aria-label="Quitar ' + titulo + ' de favoritos">' +
              '<i class="fa-regular fa-heart ico-off"></i><i class="fa-solid fa-heart ico-on"></i></label>' +
            '<span class="fv-card__badge">Destino</span>' +
          '</div>' +
          '<div class="fv-card__info">' +
            '<div class="fv-card__fila"><h3><a href="' + API.esc(urlDestino(f)) + '">' + titulo + '</a></h3>' +
              '<button type="button" class="fv-card__mas" aria-label="Más opciones"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>' +
            '<p class="fv-card__lugar"><i class="fa-solid fa-location-dot"></i> ' + titulo + '</p>' +
            '<p class="fv-card__desc">' + API.esc(f.lema || 'Un destino que quieres conocer.') + '</p>' +
          '</div></article>';
      }).join('');
      refrescarContadores();
    }

    grid.addEventListener('change', (e) => {
      const cb = e.target;
      const card = cb.closest('.fv-card');
      if (!card || cb.type !== 'checkbox') return;
      const f = memoria[card.dataset.id];
      if (!f) return;
      if (cb.checked !== tiene(f.id)) alternar(f);
      refrescarContadores();
    });

    if (select) select.addEventListener('change', pintar);
    pintar();
  }

  window.VoyaGoFav = { lista, tiene, alternar, actualizar, idDe, imgUrl };
})();
