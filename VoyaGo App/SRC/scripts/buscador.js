
(function () {
  'use strict';

  const API = window.VoyaGoAPI;
  if (!API) return;

  const tagScript = document.querySelector('script[src$="buscador.js"]');
  const base = tagScript ? tagScript.src : location.href;
  const URL_DESTINO = new URL('../pages/destino.html', base).href;
  const URL_PLANIFICAR = new URL('../pages/planificar.html', base).href;

  function urlDestino(l) {
    const u = new URL(URL_DESTINO);
    if (l.lat != null) {
      u.searchParams.set('lugar', l.nombre);
      if (l.pais) u.searchParams.set('pais', l.pais);
      if (l.cc) u.searchParams.set('cc', l.cc);
      if (l.region) u.searchParams.set('region', l.region);
      u.searchParams.set('lat', Number(l.lat).toFixed(4));
      u.searchParams.set('lon', Number(l.lon).toFixed(4));
      if (l.zoom) u.searchParams.set('zoom', l.zoom);
    } else if (l.lugar) {
      u.searchParams.set('lugar', l.lugar);
      if (l.pais) u.searchParams.set('pais', l.pais);
    } else {
      u.searchParams.set('q', l.q);
    }
    return u.href;
  }

  const ir = (l) => { location.href = urlDestino(l); };

  /* ---------- Sugerencias ---------- */

  function adjuntar(input) {
    const caja = document.createElement('ul');
    caja.className = 'vg-sug';
    caja.setAttribute('role', 'listbox');
    caja.hidden = true;
    document.body.appendChild(caja);

    let items = [], activo = -1, timer = null, seq = 0;

    function posicionar() {
      const r = input.getBoundingClientRect();
      const ancho = Math.max(r.width, 300);
      const izq = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
      caja.style.width = ancho + 'px';
      caja.style.left = (izq + window.scrollX) + 'px';
      caja.style.top = (r.bottom + window.scrollY + 6) + 'px';
    }

    function cerrar() { caja.hidden = true; activo = -1; }

    function pintar(mensaje) {
      posicionar();
      if (mensaje) {
        caja.innerHTML = '<li class="vg-sug__vacio">' + API.esc(mensaje) + '</li>';
      } else {
        caja.innerHTML = items.map((l, i) => {
          const sub = [l.region, l.pais].filter(Boolean).join(', ');
          return '<li role="option" data-i="' + i + '" class="' + (i === activo ? 'vg-sug__activo' : '') + '">' +
            '<span class="vg-sug__pin">📍</span><span><strong>' + API.esc(l.nombre) + '</strong>' +
            (sub ? '<small>' + API.esc(sub) + '</small>' : '') + '</span></li>';
        }).join('');
      }
      caja.hidden = false;
    }

    async function buscar() {
      const q = input.value.trim();
      if (q.length < 2) { cerrar(); return; }
      const mio = ++seq;
      let r = [];
      try { r = await API.buscarLugares(q, 6); } catch (e) { /* sin red */ }
      if (mio !== seq) return; // llegó una respuesta vieja
      items = r; activo = -1;
      if (!document.activeElement || document.activeElement !== input) return;
      pintar(r.length ? '' : 'Sin sugerencias. Pulsa Enter para buscar «' + q + '».');
    }

    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(buscar, 280); });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) buscar(); });
    input.addEventListener('blur', () => setTimeout(cerrar, 150));
    window.addEventListener('resize', () => { if (!caja.hidden) posicionar(); });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length || caja.hidden) return;
        e.preventDefault();
        activo = (activo + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        pintar();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activo >= 0 && items[activo]) ir(items[activo]);
        else if (input.value.trim()) ir({ q: input.value.trim() });
      } else if (e.key === 'Escape') {
        cerrar();
      }
    });

    caja.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li[data-i]');
      if (!li) return;
      e.preventDefault();
      ir(items[Number(li.dataset.i)]);
    });
  }

  
  document.querySelectorAll('.header__buscador, .filtros__buscador input').forEach(adjuntar);

  const formPortada = document.querySelector('form.buscador');
  if (formPortada) {
    const campo = formPortada.querySelector('input[type="text"]');
    if (campo) adjuntar(campo);
    formPortada.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = campo ? campo.value.trim() : '';
      if (q) ir({ q }); else if (campo) campo.focus();
    });
  }

  

  function partir(texto) {
    const p = texto.split(',').map((s) => s.trim());
    return { lugar: p[0], pais: p.slice(1).join(', ') };
  }

  
  document.querySelectorAll('.tarjeta').forEach((t) => {
    const h3 = t.querySelector('h3');
    if (!h3) return;
    const pais = (t.querySelector('.tarjeta__pais') || {}).textContent || '';
    const href = urlDestino({ lugar: h3.textContent.trim(), pais: pais.trim() });
    let a = h3.querySelector('a');
    if (!a) {
      a = document.createElement('a');
      a.textContent = h3.textContent.trim();
      h3.textContent = '';
      h3.appendChild(a);
    }
    if (!a.getAttribute('href') || a.getAttribute('href') === '#') a.href = href;
    t.classList.add('vg-clic');
    t.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      location.href = a.href;
    });
  });

  
  document.querySelectorAll('.fv-card h3 a').forEach((a) => {
    if (a.getAttribute('href') && a.getAttribute('href') !== '#') return;
    a.href = urlDestino(partir(a.textContent));
  });

  
  document.querySelectorAll('a.ds-rel').forEach((a) => {
    if (a.getAttribute('href') && a.getAttribute('href') !== '#') return;
    const n = a.querySelector('h3'), p = a.querySelector('p');
    if (n) a.href = urlDestino({ lugar: n.textContent.trim(), pais: p ? p.textContent.trim() : '' });
  });

  

  const params = new URLSearchParams(location.search);
  const destinoPlan = document.querySelector('.detalles-viaje input[type="text"]');
  if (destinoPlan && params.get('lugar')) {
    destinoPlan.value = [params.get('lugar'), params.get('pais')].filter(Boolean).join(', ');
  }

  window.VoyaGoBuscador = { urlDestino, URL_PLANIFICAR };
})();
