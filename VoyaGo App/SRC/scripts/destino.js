/* ==========================================================================
   VoyaGo · Página de destino
   Lee ?lugar=... (o ?q=...) y muestra: mapa, clima, moneda, datos del país,
   lugares cercanos y fotos. Si no hay parámetros, se ve Bali como siempre.
   ========================================================================== */
(function () {
  'use strict';

  const API = window.VoyaGoAPI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = API.esc;
  const params = new URLSearchParams(location.search);

  const MI_MONEDA_DEF = 'COP';
  const MONEDAS_COMUNES = ['COP', 'USD', 'EUR', 'MXN', 'GBP', 'ARS', 'BRL', 'CLP', 'PEN', 'CAD', 'JPY'];
  const CONTINENTES = {
    Asia: 'Asia', Europe: 'Europa', Africa: 'África', Americas: 'América', Oceania: 'Oceanía',
    Antarctic: 'Antártida', 'North America': 'América del Norte', 'South America': 'América del Sur'
  };
  const ETIQUETAS = {
    naturaleza: ['fa-solid fa-leaf', 'Naturaleza'], cultura: ['fa-solid fa-landmark', 'Cultura'],
    gastronomia: ['fa-solid fa-utensils', 'Gastronomía'], playas: ['fa-regular fa-sun', 'Playas'],
    aventura: ['fa-solid fa-mountain', 'Aventura'], ciudad: ['fa-solid fa-city', 'Ciudad'],
    compras: ['fa-solid fa-bag-shopping', 'Compras'], historia: ['fa-solid fa-monument', 'Historia'],
    relax: ['fa-solid fa-spa', 'Relax'], 'vida-nocturna': ['fa-solid fa-martini-glass-citrus', 'Vida nocturna']
  };

  const SUBREGIONES = {
    'Western Europe': 'Europa occidental', 'Southern Europe': 'Europa meridional', 'Northern Europe': 'Europa septentrional',
    'Eastern Europe': 'Europa oriental', 'Central Europe': 'Europa central', 'South America': 'Sudamérica',
    'Central America': 'Centroamérica', 'North America': 'Norteamérica', 'Northern America': 'Norteamérica', 'Caribbean': 'Caribe',
    'South-Eastern Asia': 'Sudeste asiático', 'Eastern Asia': 'Asia oriental', 'Southern Asia': 'Sur de Asia',
    'Western Asia': 'Asia occidental', 'Central Asia': 'Asia central', 'Northern Africa': 'África del Norte',
    'Western Africa': 'África occidental', 'Eastern Africa': 'África oriental', 'Southern Africa': 'África austral',
    'Middle Africa': 'África central', 'Australia and New Zealand': 'Australia y Nueva Zelanda', 'Melanesia': 'Melanesia',
    'Micronesia': 'Micronesia', 'Polynesia': 'Polinesia'
  };

  let lugar = null;       // lugar resuelto
  let datosClima = null;  // respuesta Open-Meteo
  let datosPais = null;   // respuesta REST Countries
  let unidad = 'C';

  /* ---------- Helpers ---------- */

  const fmt = (n, dec) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: dec == null ? 0 : dec });
  const fmtTasa = (n) => fmt(n, n >= 1000 ? 0 : n >= 1 ? 2 : 4);
  const grados = (c) => Math.round(unidad === 'F' ? c * 9 / 5 + 32 : c) + '°';
  const mayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  function errorHtml(msg, accion) {
    return '<div class="vg-error"><i class="fa-solid fa-triangle-exclamation"></i><p>' + esc(msg) + '</p>' +
      '<button type="button" class="vg-error__btn" data-reintentar="' + accion + '">Reintentar</button></div>';
  }

  function nombreIdioma(codigo, ingles) {
    try {
      const n = new Intl.DisplayNames(['es'], { type: 'language' }).of(codigo);
      if (n && n.toLowerCase() !== codigo.toLowerCase()) return mayus(n);
    } catch (e) { /* usamos el nombre en inglés */ }
    return ingles;
  }

  function nombreMoneda(codigo, ingles) {
    try {
      const n = new Intl.DisplayNames(['es'], { type: 'currency' }).of(codigo);
      if (n && n.toUpperCase() !== codigo) return mayus(n);
    } catch (e) { /* idem */ }
    return ingles || codigo;
  }

  function horaLocal(tz) {
    try {
      return new Date().toLocaleTimeString('es-CO', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return '--:--'; }
  }

  function utc(seg) {
    const h = seg / 3600;
    const s = (h >= 0 ? '+' : '-') + Math.floor(Math.abs(h));
    const m = Math.round((Math.abs(h) % 1) * 60);
    return 'UTC' + s + (m ? ':' + String(m).padStart(2, '0') : '');
  }

  const cssUrl = (u) => "url('" + encodeURI(u).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29') + "')";

  /* ---------- Encabezado / hero ---------- */

  function aplicarHero(l, esBali) {
    document.title = l.nombre + ' | VoyaGO';
    document.documentElement.classList.remove('vg-carga');
    if (esBali) return;

    $('.ds-hero__texto h1').textContent = l.nombre;
    $('.ds-hero__pais').textContent = l.pais || '';
    const cat = l.catalogo;
    const rating = $('.ds-hero__rating');
    if (cat && cat.rating) {
      rating.innerHTML = '<i class="fa-solid fa-star"></i> ' + esc(cat.rating) + ' <span>(' + esc(cat.resenas) + ')</span>';
    } else {
      rating.style.display = 'none';
    }
    $('.ds-hero__lema').textContent = cat ? cat.lema : 'Descubre ' + l.nombre;

    pintarMigas(l, '');
    if (cat) {
      $('.ds-desc p').textContent = cat.descripcion;
      pintarEtiquetas(cat.etiquetas);
    }

    // Quita de "relacionados" el destino que estamos viendo
    $$('a.ds-rel').forEach((a) => {
      const h3 = $('h3', a);
      if (h3 && API.norm(h3.textContent) === API.norm(l.nombre)) a.style.display = 'none';
    });

    // Mientras llegan las fotos, un fondo neutro (nunca fotos de Bali)
    const locales = cat ? cat.imagenes.map((f) => '../images/' + f) : [];
    ponerFotosHero(locales);
  }

  function pintarMigas(l, continente) {
    const chev = '<i class="fa-solid fa-chevron-right"></i>';
    $('.ds-migas').innerHTML =
      '<a href="explorar.html">Explorar</a>' + chev +
      (continente ? '<a href="explorar.html">' + esc(continente) + '</a>' + chev : '') +
      (l.pais ? '<a href="explorar.html">' + esc(l.pais) + '</a>' + chev : '') +
      '<span>' + esc(l.nombre) + '</span>';
  }

  function pintarEtiquetas(tags) {
    const ul = $('.ds-iconos');
    ul.innerHTML = tags.map((t) => ETIQUETAS[t]
      ? '<li><i class="' + ETIQUETAS[t][0] + '"></i><span>' + ETIQUETAS[t][1] + '</span></li>' : '').join('');
  }

  function ponerFotosHero(urls) {
    let st = $('#vg-hero-img');
    if (!st) { st = document.createElement('style'); st.id = 'vg-hero-img'; document.head.appendChild(st); }
    const neutro = 'linear-gradient(135deg,#0EBBB7,#0F172A)';
    const fondo = (i) => urls.length ? cssUrl(urls[i % urls.length]) : neutro;
    st.textContent = [1, 2, 3, 4].map((n) =>
      '.ds-hero:has(#ds-s' + n + ':checked){background-image:var(--ds-sombra),' + fondo(n - 1) + ';}'
    ).join('') + (urls.length ? '' : '.ds-hero{background-image:var(--ds-sombra),' + neutro + ';}');
  }

  function ponerGaleria(urls, nombre) {
    const imgs = $$('.ds-galeria__grid img');
    imgs.forEach((img, i) => {
      if (urls[i]) { img.src = urls[i]; img.alt = nombre + ' · foto ' + (i + 1); img.style.display = ''; }
      else img.style.display = 'none';
    });
    const mas = $('.ds-galeria__mas');
    if (mas) {
      if (urls[4]) {
        mas.style.backgroundImage = 'linear-gradient(rgba(43,43,43,0.72), rgba(43,43,43,0.72)), ' + cssUrl(urls[4]);
        const extra = Math.max(urls.length - 5, 0);
        $('span', mas).textContent = extra ? '+' + extra + ' fotos' : 'Más fotos';
      } else mas.style.display = 'none';
    }
    const ver = $('.ds-galeria .in-titulo a');
    if (ver) {
      ver.href = 'https://commons.wikimedia.org/w/index.php?search=' + encodeURIComponent(nombre);
      ver.target = '_blank'; ver.rel = 'noopener';
    }
  }

  /* ---------- Mapa (Leaflet) ---------- */

  let mapa = null, capaCercanos = [];

  function iniciarMapa(l) {
    const cont = $('#ds-mapa');
    const gm = $('#ds-gmaps'), ruta = $('#ds-ruta');
    if (gm) gm.href = 'https://www.google.com/maps/search/?api=1&query=' + l.lat + ',' + l.lon;
    if (ruta) ruta.href = 'https://www.google.com/maps/dir/?api=1&destination=' + l.lat + ',' + l.lon;

    if (!window.L) { // Leaflet no cargó (sin internet al CDN): mapa embebido de OSM
      const d = 0.08;
      cont.innerHTML = '<iframe title="Mapa de ' + esc(l.nombre) + '" loading="lazy" ' +
        'src="https://www.openstreetmap.org/export/embed.html?bbox=' +
        [l.lon - d, l.lat - d, l.lon + d, l.lat + d].join('%2C') + '&layer=mapnik&marker=' + l.lat + '%2C' + l.lon + '"></iframe>';
      return;
    }

    const atrib = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
    const calles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: atrib, subdomains: 'abcd', maxZoom: 19 });
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics', maxZoom: 18 });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap', maxZoom: 19 });

    mapa = L.map(cont, { scrollWheelZoom: false, layers: [calles] }).setView([l.lat, l.lon], l.zoom || 10);
    L.control.layers({ Mapa: calles, Satélite: satelite, OpenStreetMap: osm }, null, { collapsed: true }).addTo(mapa);
    mapa.on('click', () => mapa.scrollWheelZoom.enable());
    mapa.on('mouseout', () => mapa.scrollWheelZoom.disable());

    const icono = L.divIcon({
      className: 'vg-pin', html: '<i class="fa-solid fa-location-dot"></i>',
      iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30]
    });
    L.marker([l.lat, l.lon], { icon: icono, title: l.nombre }).addTo(mapa)
      .bindPopup('<strong>' + esc(l.nombre) + '</strong><br>' + esc([l.region, l.pais].filter(Boolean).join(', ')))
      .openPopup();

    setTimeout(() => mapa.invalidateSize(), 300);
    window.addEventListener('load', () => mapa.invalidateSize());
  }

  function pintarCercanos(lista) {
    const ul = $('#ds-cercanos-lista');
    if (!lista.length) {
      ul.innerHTML = '<li class="ds-cercanos__vacio">No encontramos lugares de interés registrados cerca de este punto.</li>';
      return;
    }
    ul.innerHTML = lista.map((c, i) =>
      '<li><button type="button" data-i="' + i + '"><i class="fa-solid fa-location-pin"></i>' +
      '<span>' + esc(c.titulo) + '</span><small>' + (c.dist < 1000 ? c.dist + ' m' : fmt(c.dist / 1000, 1) + ' km') + '</small></button></li>'
    ).join('');

    if (mapa && window.L) {
      capaCercanos = lista.map((c) =>
        L.circleMarker([c.lat, c.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#0EBBB7', fillOpacity: 1 })
          .addTo(mapa)
          .bindPopup('<strong>' + esc(c.titulo) + '</strong><br><a href="https://es.wikipedia.org/?curid=' + c.id +
            '" target="_blank" rel="noopener">Ver en Wikipedia</a>')
      );
    }
    ul.onclick = (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b || !mapa) return;
      const m = capaCercanos[Number(b.dataset.i)];
      if (!m) return;
      $('#ds-mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
      mapa.flyTo(m.getLatLng(), Math.max(mapa.getZoom(), 14));
      m.openPopup();
    };
  }

  /* ---------- Clima ---------- */

  function pintarClima() {
    const d = datosClima, c = d.current, dia = d.daily;
    const w = API.descripcionClima(c.weather_code, c.is_day);
    const prob = dia.precipitation_probability_max ? dia.precipitation_probability_max[0] : null;

    const dias = dia.time.map((t, i) => {
      const f = new Date(t + 'T12:00:00');
      const nombre = i === 0 ? 'Hoy' : mayus(f.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''));
      const wd = API.descripcionClima(dia.weather_code[i], 1);
      return '<li title="' + esc(wd.texto) + '"><span>' + nombre + '</span><i class="fa-solid ' + wd.icono + '"></i>' +
        '<strong>' + grados(dia.temperature_2m_max[i]) + '</strong><small>' + grados(dia.temperature_2m_min[i]) + '</small></li>';
    }).join('');

    $('#ds-clima-cuerpo').innerHTML =
      '<div class="ds-clima__actual">' +
        '<i class="fa-solid ' + w.icono + ' ds-clima__icono"></i>' +
        '<div><strong class="ds-clima__temp">' + grados(c.temperature_2m) + '</strong>' +
        '<span>' + esc(w.texto) + '</span>' +
        '<small>Sensación ' + grados(c.apparent_temperature) + ' · Máx ' + grados(dia.temperature_2m_max[0]) +
        ' · Mín ' + grados(dia.temperature_2m_min[0]) + '</small></div>' +
      '</div>' +
      '<ul class="ds-clima__stats">' +
        '<li><i class="fa-solid fa-droplet"></i><span>Humedad</span><strong>' + fmt(c.relative_humidity_2m) + '%</strong></li>' +
        '<li><i class="fa-solid fa-wind"></i><span>Viento</span><strong>' + fmt(c.wind_speed_10m) + ' km/h ' + API.rumboViento(c.wind_direction_10m) + '</strong></li>' +
        '<li><i class="fa-solid fa-umbrella"></i><span>Lluvia</span><strong>' + (prob == null ? '—' : fmt(prob) + '%') + '</strong></li>' +
        '<li><i class="fa-solid fa-sun"></i><span>Índice UV</span><strong>' + (dia.uv_index_max ? fmt(dia.uv_index_max[0], 1) : '—') + '</strong></li>' +
      '</ul>' +
      '<p class="ds-clima__hora"><i class="fa-regular fa-clock"></i> Hora local <b data-hora-local>' + horaLocal(d.timezone) + '</b>' +
        ' · <i class="fa-regular fa-sun"></i> ' + dia.sunrise[0].slice(11, 16) +
        ' · <i class="fa-regular fa-moon"></i> ' + dia.sunset[0].slice(11, 16) + '</p>' +
      '<ol class="ds-clima__dias" aria-label="Pronóstico de 7 días">' + dias + '</ol>';
  }

  async function cargarClima() {
    const cuerpo = $('#ds-clima-cuerpo');
    cuerpo.innerHTML = '<div class="vg-cargando">Consultando el clima…</div>';
    try {
      datosClima = await API.clima(lugar.lat, lugar.lon);
      pintarClima();
      pintarDatos();
      pintarResumenIconos();
    } catch (e) {
      cuerpo.innerHTML = errorHtml('No pudimos obtener el clima en este momento.', 'clima');
    }
  }

  /* ---------- Moneda ---------- */

  let tasasData = null;
  let monedaDestino = null;
  let miMoneda = (function () { try { return localStorage.getItem('vg:mi-moneda'); } catch (e) { return null; } })() || MI_MONEDA_DEF;

  function monedaPrincipal() {
    if (!datosPais) return null;
    const codigos = Object.keys(datosPais.monedas || {});
    if (!codigos.length) return null;
    if (tasasData) {
      const c = codigos.find((x) => tasasData.rates[x]);
      if (c) return c;
    }
    return codigos[0];
  }

  function pintarMoneda() {
    const cuerpo = $('#ds-moneda-cuerpo');
    monedaDestino = monedaPrincipal();
    if (!monedaDestino) {
      cuerpo.innerHTML = '<div class="vg-cargando">No pudimos identificar la moneda de este lugar.</div>';
      return;
    }
    if (!tasasData || !tasasData.rates[monedaDestino]) {
      cuerpo.innerHTML = errorHtml('No hay tasa de cambio disponible para ' + monedaDestino + '.', 'moneda');
      return;
    }
    const info = datosPais.monedas[monedaDestino] || {};
    const opciones = MONEDAS_COMUNES.slice();
    if (opciones.indexOf(miMoneda) < 0) opciones.unshift(miMoneda);
    const otras = Object.keys(datosPais.monedas).filter((c) => c !== monedaDestino);

    const montoIni = miMoneda === 'COP' ? 100000 : 100;
    const tasa = API.convertir(1, miMoneda, monedaDestino, tasasData);
    let mult = 1; while (tasa * mult < 1 && mult < 1e7) mult *= 10;

    cuerpo.innerHTML =
      '<div class="ds-moneda__info"><span class="ds-moneda__codigo">' + esc(monedaDestino) + '</span>' +
        '<div><strong>' + esc(nombreMoneda(monedaDestino, info.name)) + '</strong>' +
        '<small>' + (info.symbol ? 'Símbolo: ' + esc(info.symbol) : 'Moneda oficial') +
        (otras.length ? ' · También: ' + esc(otras.join(', ')) : '') + '</small></div></div>' +
      '<p class="ds-moneda__tasa" id="ds-tasa">' + fmt(mult) + ' ' + esc(miMoneda) + ' = <strong>' +
        fmtTasa(tasa * mult) + ' ' + esc(monedaDestino) + '</strong></p>' +
      '<div class="ds-conv">' +
        '<label class="ds-conv__lado"><span>Tengo</span><div>' +
          '<input type="number" id="conv-a" min="0" step="any" value="' + montoIni + '" inputmode="decimal" />' +
          '<select id="conv-de" aria-label="Mi moneda">' +
            opciones.map((c) => '<option' + (c === miMoneda ? ' selected' : '') + '>' + c + '</option>').join('') +
          '</select></div></label>' +
        '<span class="ds-conv__igual">=</span>' +
        '<label class="ds-conv__lado"><span>Recibo en destino</span><div>' +
          '<input type="number" id="conv-b" min="0" step="any" inputmode="decimal" />' +
          '<em>' + esc(monedaDestino) + '</em></div></label>' +
      '</div>' +
      '<p class="ds-moneda__fuente"><i class="fa-regular fa-clock"></i> Actualizado: ' +
        esc(String(tasasData.fecha || '').replace(/ \+0000$/, '')) + ' · Fuente: ' + esc(tasasData.fuente) + '. Tasa referencial.</p>';

    const a = $('#conv-a'), b = $('#conv-b'), de = $('#conv-de');
    const aB = () => {
      const r = API.convertir(parseFloat(a.value) || 0, de.value, monedaDestino, tasasData);
      b.value = r == null ? '' : String(Number(r.toFixed(r >= 1 ? 2 : 4)));
    };
    const bA = () => {
      const r = API.convertir(parseFloat(b.value) || 0, monedaDestino, de.value, tasasData);
      a.value = r == null ? '' : String(Number(r.toFixed(r >= 1 ? 2 : 4)));
    };
    a.addEventListener('input', aB);
    b.addEventListener('input', bA);
    de.addEventListener('change', () => {
      miMoneda = de.value;
      try { localStorage.setItem('vg:mi-moneda', miMoneda); } catch (e) { /* ok */ }
      const t = API.convertir(1, miMoneda, monedaDestino, tasasData);
      let m = 1; while (t * m < 1 && m < 1e7) m *= 10;
      $('#ds-tasa').innerHTML = fmt(m) + ' ' + esc(miMoneda) + ' = <strong>' + fmtTasa(t * m) + ' ' + esc(monedaDestino) + '</strong>';
      aB();
    });
    aB();
    pintarDatos();
    pintarResumenIconos();
  }

  async function cargarMoneda() {
    const cuerpo = $('#ds-moneda-cuerpo');
    cuerpo.innerHTML = '<div class="vg-cargando">Consultando la moneda…</div>';
    try {
      if (!datosPais && lugar.cc) datosPais = await API.pais(lugar.cc);
      tasasData = await API.tasas();
      pintarMoneda();
    } catch (e) {
      cuerpo.innerHTML = errorHtml('No pudimos obtener el tipo de cambio en este momento.', 'moneda');
    }
  }

  /* ---------- Datos prácticos ---------- */

  function pintarDatos() {
    const grid = $('#ds-datos-grid');
    const p = datosPais || {};
    const filas = [];
    const add = (icono, titulo, valor) => { if (valor) filas.push([icono, titulo, valor]); };

    if (p.bandera) add('fa-solid fa-flag', 'País', '<img class="ds-dato__bandera" src="' + esc(p.bandera) + '" alt="" /> ' + esc(p.nombre || lugar.pais));
    else add('fa-solid fa-flag', 'País', esc(lugar.pais));
    add('fa-solid fa-landmark-dome', 'Capital', esc(p.capital));
    const cont = (p.continentes || []).map((c) => CONTINENTES[c] || c)[0] || CONTINENTES[p.region] || p.region;
    add('fa-solid fa-earth-americas', 'Región', esc([cont, SUBREGIONES[p.subregion] || p.subregion].filter(Boolean).join(' · ')));
    if (lugar.poblacion) add('fa-solid fa-city', 'Población (ciudad)', fmt(lugar.poblacion));
    if (p.poblacion) add('fa-solid fa-people-group', 'Población (país)', fmt(p.poblacion));
    if (p.area) add('fa-solid fa-ruler-combined', 'Superficie del país', fmt(p.area) + ' km²');
    const idiomas = Object.keys(p.idiomas || {}).map((k) => nombreIdioma(k, p.idiomas[k]));
    add('fa-solid fa-language', 'Idiomas', esc(idiomas.join(', ')));
    if (monedaDestino) {
      const inf = (p.monedas || {})[monedaDestino] || {};
      add('fa-solid fa-coins', 'Moneda', esc(nombreMoneda(monedaDestino, inf.name) + ' (' + monedaDestino + ')'));
    }
    if (datosClima) {
      add('fa-regular fa-clock', 'Hora local',
        '<b data-hora-local>' + horaLocal(datosClima.timezone) + '</b> · ' + esc(utc(datosClima.utc_offset_seconds)));
      add('fa-solid fa-globe', 'Zona horaria', esc(datosClima.timezone));
      if (datosClima.elevation != null) add('fa-solid fa-mountain', 'Altitud', fmt(datosClima.elevation) + ' m s. n. m.');
    }
    add('fa-solid fa-phone', 'Prefijo telefónico', esc(p.prefijo));
    if (p.conduccion) add('fa-solid fa-car-side', 'Se conduce por la', p.conduccion === 'left' ? 'izquierda' : 'derecha');
    add('fa-solid fa-location-crosshairs', 'Coordenadas', fmt(lugar.lat, 4) + '°, ' + fmt(lugar.lon, 4) + '°');

    grid.innerHTML = filas.map((f) =>
      '<div class="ds-dato"><i class="' + f[0] + '"></i><div><dt>' + f[1] + '</dt><dd>' + f[2] + '</dd></div></div>').join('');
  }

  // En lugares que no están en el catálogo, la fila de iconos muestra datos reales
  function pintarResumenIconos() {
    if (lugar.catalogo) return;
    const items = [];
    if (datosClima) items.push(['fa-solid fa-temperature-half', grados(datosClima.current.temperature_2m)]);
    if (monedaDestino) items.push(['fa-solid fa-coins', monedaDestino]);
    const idiomas = Object.keys((datosPais || {}).idiomas || {});
    if (idiomas.length) items.push(['fa-solid fa-language', nombreIdioma(idiomas[0], datosPais.idiomas[idiomas[0]])]);
    if (datosClima) items.push(['fa-regular fa-clock', horaLocal(datosClima.timezone)]);
    $('.ds-iconos').innerHTML = items.map((i) => '<li><i class="' + i[0] + '"></i><span>' + esc(i[1]) + '</span></li>').join('');
  }

  /* ---------- Wikipedia (descripción + fotos) ---------- */

  async function cargarWiki() {
    const cat = lugar.catalogo;
    if (cat && cat.id === 'bali') return; // Bali conserva su contenido original
    let resumen = null;
    try { resumen = await API.wikiResumen(lugar); } catch (e) { /* sin wiki */ }

    if (!cat) {
      const p = $('.ds-desc p');
      if (resumen && resumen.extract) {
        let texto = resumen.extract;
        if (texto.length > 520) texto = texto.slice(0, 520).replace(/\s+\S*$/, '') + '…';
        p.textContent = texto;
        const fuente = document.createElement('a');
        fuente.className = 'ds-desc__fuente';
        fuente.href = (resumen.content_urls && resumen.content_urls.desktop.page) || '#';
        fuente.target = '_blank'; fuente.rel = 'noopener';
        fuente.textContent = 'Fuente: Wikipedia';
        p.after(fuente);
        if (resumen.description) $('.ds-hero__lema').textContent = mayus(resumen.description);
      } else {
        $('.ds-hero__lema').textContent = 'Descubre ' + lugar.nombre;
        p.textContent = lugar.nombre + (lugar.pais ? ' es un destino en ' + lugar.pais + '.' : ' es un destino por descubrir.') +
          ' Mira el mapa, el clima y la moneda para planificar tu viaje.';
      }
    }

    // Fotos: propias (catálogo) + Wikipedia + Commons
    const fotos = cat ? cat.imagenes.map((f) => '../images/' + f) : [];
    if (fotos.length < 5) {
      let remotas = [];
      if (resumen) {
        remotas = await API.wikiImagenes(resumen.title, 8);
        const principal = resumen.thumbnail ? resumen.thumbnail.source.replace(/\/(\d+)px-/, '/1280px-')
          : (resumen.originalimage && resumen.originalimage.source);
        if (principal) remotas.unshift(principal);
      }
      if (remotas.length < 5) remotas = remotas.concat(await API.fotosCerca(lugar.lat, lugar.lon, 6));
      remotas.forEach((u) => { if (fotos.indexOf(u) < 0) fotos.push(u); });
    }
    if (!fotos.length) return;
    fotoFav = fotos[0];
    if (window.__vgFavActualizar) window.__vgFavActualizar();
    ponerFotosHero(fotos.slice(0, 4));
    ponerGaleria(fotos.slice(0, 12), lugar.nombre);
  }

  /* ---------- Pestañas, enlaces, reloj ---------- */

  function conectarPestanas() {
    const mapaTabs = { 'qué hacer': '#ds-cercanos', 'cómo llegar': '#ds-mapa-sec', consejos: '#ds-practico' };
    const tabs = $$('.ds-tabs a');
    tabs.forEach((a) => {
      const destino = mapaTabs[a.textContent.trim().toLowerCase()];
      if (destino) a.setAttribute('href', destino);
      a.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('ds-tabs__tab--activa'));
        a.classList.add('ds-tabs__tab--activa');
      });
    });
  }

  function conectarPlan() {
    const btn = $('.ds-plan__btn');
    if (btn) {
      const u = new URL(btn.getAttribute('href'), location.href);
      u.searchParams.set('lugar', lugar.nombre);
      if (lugar.pais) u.searchParams.set('pais', lugar.pais);
      btn.href = u.href;
    }
  }

  function relojes() {
    setInterval(() => {
      if (!datosClima) return;
      $$('[data-hora-local]').forEach((el) => { el.textContent = horaLocal(datosClima.timezone); });
    }, 30000);
  }

  function conectarEventos() {
    document.addEventListener('click', (e) => {
      const re = e.target.closest('[data-reintentar]');
      if (re) { re.dataset.reintentar === 'clima' ? cargarClima() : cargarMoneda(); return; }
      const u = e.target.closest('.ds-unidad button');
      if (u && datosClima) {
        unidad = u.dataset.u;
        $$('.ds-unidad button').forEach((b) => b.classList.toggle('activa', b === u));
        pintarClima();
        pintarResumenIconos();
      }
    });
  }

  /* ---------- Favoritos ---------- */

  let fotoFav = '';

  function conectarFavorito() {
    const F = window.VoyaGoFav;
    const cb = $('#ds-fav-cb'), btn = $('.ds-plan__guardar');
    if (!F || !cb || !btn) return;
    const id = F.idDe(lugar.nombre, lugar.pais);
    const item = () => ({
      id, nombre: lugar.nombre, pais: lugar.pais, cc: lugar.cc, lat: lugar.lat, lon: lugar.lon,
      img: lugar.catalogo ? lugar.catalogo.imagenes[0] : fotoFav,
      lema: ($('.ds-hero__lema') || {}).textContent || ''
    });
    const pintar = () => {
      const on = F.tiene(id);
      cb.checked = on;
      btn.classList.toggle('activo', on);
      btn.innerHTML = on ? '<i class="fa-solid fa-bookmark"></i> Guardado en favoritos'
        : '<i class="fa-regular fa-bookmark"></i> Guardar en favoritos';
    };
    cb.addEventListener('change', () => { if (cb.checked !== F.tiene(id)) F.alternar(item()); pintar(); });
    btn.addEventListener('click', () => { F.alternar(item()); pintar(); });
    pintar();
    window.__vgFavActualizar = () => { if (F.tiene(id)) F.actualizar(id, item()); };
  }

  /* ---------- Inicio ---------- */

  async function iniciar() {
    const pedido = {
      lugar: params.get('lugar'), q: params.get('q'), pais: params.get('pais'), cc: params.get('cc'),
      lat: params.get('lat'), lon: params.get('lon'), region: params.get('region'), zoom: params.get('zoom')
    };
    const hayPedido = pedido.lugar || pedido.q;

    try {
      lugar = hayPedido
        ? await API.resolverLugar(pedido)
        : await API.resolverLugar({ lugar: 'Bali' });
    } catch (e) { lugar = null; }

    if (!lugar) { // lugar no encontrado
      document.documentElement.classList.remove('vg-carga');
      $$('.ds-top, .ds-tabs, .ds-info, .ds-api, .ds-migas').forEach((el) => { el.style.display = 'none'; });
      const aviso = document.createElement('section');
      aviso.className = 'vg-noencontrado';
      aviso.innerHTML = '<i class="fa-solid fa-map-location-dot"></i><h1>No encontramos ese lugar</h1>' +
        '<p>Revisamos «' + esc(pedido.lugar || pedido.q) + '» y no hubo resultados. Prueba con otro nombre o escribe también el país ' +
        '(por ejemplo «Lisboa, Portugal» o «Machu Picchu»).</p><a href="explorar.html" class="ds-plan__btn">Explorar destinos</a>';
      $('main.ds').prepend(aviso);
      return;
    }

    const esBali = lugar.catalogo && lugar.catalogo.id === 'bali';
    aplicarHero(lugar, esBali);
    conectarPestanas();
    conectarPlan();
    conectarFavorito();
    conectarEventos();
    relojes();

    $('#ds-clima-titulo').textContent = 'Clima en ' + lugar.nombre;
    iniciarMapa(lugar);

    // Todo en paralelo: si una API falla, las demás siguen funcionando
    if (lugar.cc) API.pais(lugar.cc).then((p) => {
      datosPais = p;
      if (p && !esBali) {
        const cont = (p.continentes || []).map((c) => CONTINENTES[c] || c)[0] || CONTINENTES[p.region] || '';
        pintarMigas(lugar, cont);
      }
      pintarDatos();
    }).catch(() => {});

    cargarClima();
    cargarMoneda();
    cargarWiki();
    API.cercanos(lugar.lat, lugar.lon, 12).then(pintarCercanos).catch(() => pintarCercanos([]));
  }

  setTimeout(() => document.documentElement.classList.remove('vg-carga'), 6000); // seguro anti-pantalla oculta
  iniciar();
})();
