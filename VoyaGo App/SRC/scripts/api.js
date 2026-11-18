
(function (global) {
  'use strict';

  

  const norm = (s) =>
    (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  const MIN = 60 * 1000;
  const HORA = 60 * MIN;
  const DIA = 24 * HORA;

  
  const cache = {
    get(clave, ttl) {
      try {
        const r = JSON.parse(localStorage.getItem('vg:' + clave));
        if (r && Date.now() - r.t < ttl) return r.v;
      } catch (e) { /* sin caché */ }
      return null;
    },
    set(clave, valor) {
      try { localStorage.setItem('vg:' + clave, JSON.stringify({ t: Date.now(), v: valor })); }
      catch (e) { /* almacenamiento lleno o bloqueado */ }
    }
  };

  async function getJSON(url, timeout) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout || 10000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(id);
    }
  }

  function distanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  

  const CATALOGO = [
    {
      id: 'bali', nombre: 'Bali', pais: 'Indonesia', cc: 'ID', lat: -8.4095, lon: 115.1889, zoom: 9,
      rating: '4.8', resenas: '12.3k reseñas',
      lema: 'Playas, templos y una cultura que te conecta.',
      descripcion: 'Bali es un destino que combina naturaleza, espiritualidad y aventura. Sus playas de aguas cristalinas, templos milenarios y paisajes volcánicos lo convierten en un lugar único para todo tipo de viajeros.',
      etiquetas: ['naturaleza', 'cultura', 'gastronomia', 'playas', 'aventura'],
      imagenes: ['bali.png', 'bali2.jpg', 'Perfil fondo.jpg', 'explorar.png.jpg']
    },
    {
      id: 'tokio', nombre: 'Tokio', pais: 'Japón', cc: 'JP', lat: 35.6762, lon: 139.6503, zoom: 11,
      alias: ['tokyo'],
      rating: '4.7', resenas: '9.1k reseñas',
      lema: 'Tradición y tecnología en un solo lugar.',
      descripcion: 'Tokio mezcla rascacielos futuristas con templos tranquilos y barrios llenos de vida. Es un destino perfecto para quienes aman la gastronomía, las compras, la cultura pop y una ciudad que nunca se detiene.',
      etiquetas: ['cultura', 'gastronomia', 'ciudad', 'compras', 'historia'],
      imagenes: ['Tokio.png', 'tokio2.jpg', 'kioto.jpg']
    },
    {
      id: 'kioto', nombre: 'Kioto', pais: 'Japón', cc: 'JP', lat: 35.0116, lon: 135.7681, zoom: 11,
      alias: ['kyoto'],
      lema: 'Templos, jardines y tradición viva.',
      descripcion: 'Kioto fue la capital imperial de Japón durante más de mil años y conserva miles de templos, santuarios y casas de té. Sus jardines, sus geishas y sus calles de madera la convierten en el corazón cultural del país.',
      etiquetas: ['cultura', 'historia', 'gastronomia', 'naturaleza'],
      imagenes: ['kioto.jpg', 'Tokio.png', 'tokio2.jpg']
    },
    {
      id: 'roma', nombre: 'Roma', pais: 'Italia', cc: 'IT', lat: 41.9028, lon: 12.4964, zoom: 12,
      rating: '4.7', resenas: '8.4k reseñas',
      lema: 'Historia, arte y gastronomía en cada rincón.',
      descripcion: 'Roma es un museo al aire libre: el Coliseo, el Foro Romano, el Vaticano y la Fontana di Trevi conviven con plazas animadas y una cocina que enamora. Cada esquina cuenta casi tres mil años de historia.',
      etiquetas: ['cultura', 'historia', 'gastronomia', 'ciudad'],
      imagenes: ['Roma.png', 'roma2.jpg']
    },
    {
      id: 'santorini', nombre: 'Santorini', pais: 'Grecia', cc: 'GR', lat: 36.3932, lon: 25.4615, zoom: 12,
      rating: '4.6', resenas: '6.8k reseñas',
      lema: 'Atardeceres inolvidables y paisajes de ensueño.',
      descripcion: 'Santorini es una isla volcánica del mar Egeo famosa por sus casas blancas con cúpulas azules sobre acantilados, sus playas de arena negra y unos atardeceres que figuran entre los más bellos del mundo.',
      etiquetas: ['playas', 'relax', 'gastronomia', 'cultura'],
      imagenes: ['Santorini.png', 'santorini2.jpg']
    },
    {
      id: 'nueva-york', nombre: 'Nueva York', pais: 'Estados Unidos', cc: 'US', lat: 40.7128, lon: -74.006, zoom: 11,
      alias: ['new york', 'nyc', 'new york city'],
      rating: '4.5', resenas: '10.2k reseñas',
      lema: 'Una ciudad que nunca deja de sorprender.',
      descripcion: 'Nueva York es energía pura: Times Square, Central Park, Broadway y el Empire State en una ciudad multicultural donde siempre hay algo que ver, probar o comprar, a cualquier hora del día.',
      etiquetas: ['ciudad', 'compras', 'cultura', 'gastronomia'],
      imagenes: ['nueva york.png', 'nueva york2.jpg']
    },
    {
      id: 'cancun', nombre: 'Cancún', pais: 'México', cc: 'MX', lat: 21.1619, lon: -86.8515, zoom: 11,
      alias: ['cancun'],
      rating: '4.6', resenas: '9.3k reseñas',
      lema: 'Playas de arena blanca y mar turquesa.',
      descripcion: 'Cancún combina playas caribeñas de arena blanca con vida nocturna, snorkel en arrecifes y excursiones a zonas arqueológicas mayas como Chichén Itzá y Tulum, todo a pocos kilómetros.',
      etiquetas: ['playas', 'vida-nocturna', 'aventura', 'cultura'],
      imagenes: ['cancun.jpg']
    },
    {
      id: 'patagonia', nombre: 'Patagonia', pais: 'Argentina', cc: 'AR', lat: -41.1335, lon: -71.3103, zoom: 7,
      lema: 'Naturaleza en su estado más puro.',
      descripcion: 'La Patagonia argentina ofrece glaciares, lagos de color turquesa, bosques andinos y montañas legendarias como el Fitz Roy. Es el lugar ideal para el trekking, la fotografía y la desconexión total.',
      etiquetas: ['naturaleza', 'aventura', 'relax'],
      imagenes: ['patagonia.jpg']
    }
  ];

  function buscarEnCatalogo(nombre, cc) {
    const n = norm(nombre);
    if (!n) return null;
    return CATALOGO.find((c) =>
      (norm(c.nombre) === n || (c.alias || []).some((a) => norm(a) === n)) &&
      (!cc || !c.cc || c.cc === String(cc).toUpperCase())
    ) || null;
  }

  

  function zoomPorTipo(t) {
    t = String(t || '').toUpperCase();
    if (/^PCL/.test(t) || t === 'COUNTRY') return 5;
    if (/^ADM1|STATE|REGION/.test(t)) return 7;
    if (/^ISL|ISLAND/.test(t)) return 9;
    if (/^ADM2|COUNTY/.test(t)) return 9;
    if (/^PPL|CITY|TOWN|VILLAGE|MUNICIPALITY/.test(t)) return 11;
    return 12;
  }

  function deCatalogo(c) {
    return {
      nombre: c.nombre, region: '', pais: c.pais, cc: c.cc, lat: c.lat, lon: c.lon,
      zoom: c.zoom, catalogo: c
    };
  }

  async function buscarOpenMeteo(nombre, n) {
    const d = await getJSON(
      'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(nombre) +
      '&count=' + (n || 10) + '&language=es&format=json'
    );
    return (d.results || []).map((r) => ({
      nombre: r.name,
      region: r.admin1 || '',
      pais: r.country || '',
      cc: (r.country_code || '').toUpperCase(),
      lat: r.latitude,
      lon: r.longitude,
      tz: r.timezone,
      poblacion: r.population,
      zoom: zoomPorTipo(r.feature_code)
    }));
  }

  async function buscarNominatim(texto, n) {
    const d = await getJSON(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=' + (n || 5) +
      '&accept-language=es&q=' + encodeURIComponent(texto)
    );
    return d.map((r) => {
      const a = r.address || {};
      return {
        nombre: r.name || (r.display_name || '').split(',')[0],
        region: a.state || a.region || a.county || '',
        pais: a.country || '',
        cc: (a.country_code || '').toUpperCase(),
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        zoom: zoomPorTipo(r.addresstype || r.type)
      };
    });
  }

  
  async function buscarLugares(texto, max) {
    const q = (texto || '').trim();
    if (q.length < 2) return [];
    const partes = q.split(',').map((s) => s.trim()).filter(Boolean);
    const nombre = partes[0];
    const pista = norm(partes.slice(1).join(' '));
    const limite = max || 6;

    const locales = CATALOGO
      .filter((c) => norm(c.nombre).startsWith(norm(nombre)) ||
        (c.alias || []).some((a) => norm(a).startsWith(norm(nombre))))
      .map(deCatalogo);

    let remotos = [];
    try {
      remotos = await buscarOpenMeteo(nombre, 10);
    } catch (e) { /* sin internet o API caída: seguimos con lo que haya */ }

    if (pista) {
      const coincide = (r) => norm(r.pais + ' ' + r.region).includes(pista);
      remotos = remotos.filter(coincide).concat(remotos.filter((r) => !coincide(r)));
    }

    const salida = [];
    const vistos = new Set();
    locales.concat(remotos).forEach((r) => {
      const clave = norm(r.nombre) + '|' + r.cc + '|' + Math.round(r.lat) + '|' + Math.round(r.lon);
      const claveCorta = norm(r.nombre) + '|' + r.cc;
      if (vistos.has(clave) || vistos.has(claveCorta)) return;
      vistos.add(clave); vistos.add(claveCorta);
      salida.push(r);
    });
    return salida.slice(0, limite);
  }

  
  async function resolverLugar(p) {
    p = p || {};
    const texto = (p.lugar || p.q || '').trim();
    const nombre = texto.split(',')[0].trim();

    const delCat = buscarEnCatalogo(nombre, p.cc);
    if (delCat) return deCatalogo(delCat);

    const lat = parseFloat(p.lat), lon = parseFloat(p.lon);
    if (isFinite(lat) && isFinite(lon)) {
      return {
        nombre: nombre || 'Destino', region: p.region || '', pais: p.pais || '',
        cc: (p.cc || '').toUpperCase(), lat, lon, zoom: parseInt(p.zoom, 10) || 10
      };
    }
    if (!nombre) return null;

    const clave = 'geo:' + norm(texto);
    const guardado = cache.get(clave, 7 * DIA);
    if (guardado) return guardado;

    let r = [];
    try { r = await buscarLugares(texto, 1); } catch (e) { /* ver abajo */ }
    if (!r.length) {
      try { r = await buscarNominatim(texto, 1); } catch (e) { /* nada */ }
    }
    if (r.length) {
      cache.set(clave, r[0]);
      return r[0];
    }
    return null;
  }

  

  async function clima(lat, lon) {
    const clave = 'clima:' + lat.toFixed(2) + ',' + lon.toFixed(2);
    const guardado = cache.get(clave, 15 * MIN);
    if (guardado) return guardado;
    const d = await getJSON(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
      '&timezone=auto&forecast_days=7'
    );
    cache.set(clave, d);
    return d;
  }

  
  function descripcionClima(codigo, esDia) {
    const dia = esDia !== 0 && esDia !== false;
    const t = (texto, iconoDia, iconoNoche) => ({ texto, icono: dia ? iconoDia : (iconoNoche || iconoDia) });
    const c = Number(codigo);
    if (c === 0) return t('Despejado', 'fa-sun', 'fa-moon');
    if (c === 1) return t('Mayormente despejado', 'fa-cloud-sun', 'fa-cloud-moon');
    if (c === 2) return t('Parcialmente nublado', 'fa-cloud-sun', 'fa-cloud-moon');
    if (c === 3) return t('Nublado', 'fa-cloud');
    if (c === 45 || c === 48) return t('Niebla', 'fa-smog');
    if (c >= 51 && c <= 55) return t('Llovizna', 'fa-cloud-rain');
    if (c === 56 || c === 57) return t('Llovizna helada', 'fa-cloud-rain');
    if (c === 61) return t('Lluvia ligera', 'fa-cloud-rain');
    if (c === 63) return t('Lluvia moderada', 'fa-cloud-showers-heavy');
    if (c === 65) return t('Lluvia fuerte', 'fa-cloud-showers-heavy');
    if (c === 66 || c === 67) return t('Lluvia helada', 'fa-cloud-rain');
    if (c === 71 || c === 73 || c === 75) return t('Nieve', 'fa-snowflake');
    if (c === 77) return t('Granizo fino', 'fa-snowflake');
    if (c >= 80 && c <= 82) return t('Chubascos', 'fa-cloud-showers-heavy');
    if (c === 85 || c === 86) return t('Chubascos de nieve', 'fa-snowflake');
    if (c === 95) return t('Tormenta eléctrica', 'fa-cloud-bolt');
    if (c === 96 || c === 99) return t('Tormenta con granizo', 'fa-cloud-bolt');
    return t('Sin datos', 'fa-cloud');
  }

  function rumboViento(grados) {
    const p = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return p[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
  }

  

  
  const MONEDA_POR_PAIS = {
    CO: 'COP', US: 'USD', MX: 'MXN', AR: 'ARS', BR: 'BRL', CL: 'CLP', PE: 'PEN', UY: 'UYU', PY: 'PYG',
    BO: 'BOB', EC: 'USD', VE: 'VES', PA: 'PAB', CR: 'CRC', GT: 'GTQ', HN: 'HNL', NI: 'NIO', SV: 'USD',
    DO: 'DOP', CU: 'CUP', PR: 'USD', CA: 'CAD', GB: 'GBP', IE: 'EUR', FR: 'EUR', ES: 'EUR', PT: 'EUR',
    IT: 'EUR', DE: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', GR: 'EUR', FI: 'EUR', CH: 'CHF', SE: 'SEK',
    NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', TR: 'TRY', RU: 'RUB', UA: 'UAH', EG: 'EGP',
    MA: 'MAD', ZA: 'ZAR', KE: 'KES', AE: 'AED', SA: 'SAR', IL: 'ILS', IN: 'INR', CN: 'CNY', JP: 'JPY',
    KR: 'KRW', TH: 'THB', VN: 'VND', ID: 'IDR', MY: 'MYR', SG: 'SGD', PH: 'PHP', AU: 'AUD', NZ: 'NZD'
  };

  async function pais(cc) {
    cc = (cc || '').toUpperCase();
    if (!cc) return null;
    const clave = 'pais:' + cc;
    const guardado = cache.get(clave, 7 * DIA);
    if (guardado) return guardado;
    try {
      const d = await getJSON('https://restcountries.com/v3.1/alpha/' + encodeURIComponent(cc));
      const p = Array.isArray(d) ? d[0] : d;
      const idd = p.idd || {};
      const sufijos = idd.suffixes || [];
      const r = {
        cc: p.cca2 || cc,
        nombre: (p.translations && p.translations.spa && p.translations.spa.common) || (p.name && p.name.common) || '',
        capital: (p.capital || [])[0] || '',
        region: p.region || '',
        subregion: p.subregion || '',
        continentes: p.continents || [],
        poblacion: p.population || 0,
        area: p.area || 0,
        idiomas: p.languages || {},
        monedas: p.currencies || {},
        zonas: p.timezones || [],
        bandera: (p.flags && (p.flags.svg || p.flags.png)) || '',
        prefijo: (idd.root || '') + (sufijos.length === 1 ? sufijos[0] : ''),
        conduccion: (p.car && p.car.side) || ''
      };
      cache.set(clave, r);
      return r;
    } catch (e) {
      const cod = MONEDA_POR_PAIS[cc];
      return {
        cc, nombre: '', capital: '', region: '', subregion: '', continentes: [], poblacion: 0, area: 0,
        idiomas: {}, monedas: cod ? { [cod]: { name: cod, symbol: '' } } : {}, zonas: [],
        bandera: '', prefijo: '', conduccion: '', parcial: true
      };
    }
  }

  

  async function tasas() {
    const guardado = cache.get('tasas', 60 * MIN);
    if (guardado) return guardado;

    const fuentes = [
      async () => {
        const d = await getJSON('https://open.er-api.com/v6/latest/USD');
        if (d.result !== 'success') throw new Error('er-api');
        return { rates: d.rates, fecha: d.time_last_update_utc, fuente: 'ExchangeRate-API' };
      },
      async () => {
        const d = await getJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const rates = {};
        Object.keys(d.usd).forEach((k) => { rates[k.toUpperCase()] = d.usd[k]; });
        return { rates, fecha: d.date, fuente: 'currency-api' };
      },
      async () => {
        const d = await getJSON('https://api.frankfurter.app/latest?from=USD');
        return { rates: Object.assign({ USD: 1 }, d.rates), fecha: d.date, fuente: 'Frankfurter (BCE)' };
      }
    ];

    let ultimoError;
    for (const f of fuentes) {
      try {
        const r = await f();
        r.base = 'USD';
        cache.set('tasas', r);
        return r;
      } catch (e) { ultimoError = e; }
    }
    throw ultimoError || new Error('Sin tasas de cambio');
  }

  function convertir(monto, de, a, t) {
    const rDe = t.rates[de], rA = t.rates[a];
    if (!rDe || !rA) return null;
    return (monto / rDe) * rA;
  }

  

  async function wikiResumenPorTitulo(titulo) {
    return getJSON('https://es.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(titulo.replace(/ /g, '_')));
  }

  async function wikiTituloBusqueda(texto) {
    const d = await getJSON(
      'https://es.wikipedia.org/w/api.php?action=opensearch&limit=3&namespace=0&format=json&origin=*&search=' +
      encodeURIComponent(texto)
    );
    return (d && d[1]) || [];
  }

  
  async function wikiResumen(lugar) {
    const clave = 'wiki:' + norm(lugar.nombre) + '|' + lugar.cc + '|' + Math.round(lugar.lat) + '|' + Math.round(lugar.lon);
    const guardado = cache.get(clave, DIA);
    if (guardado) return guardado.nada ? null : guardado;

    const valido = (r) => {
      if (!r || !r.extract || r.type === 'disambiguation') return false;
      if (r.coordinates && isFinite(lugar.lat)) {
        return distanciaKm(lugar.lat, lugar.lon, r.coordinates.lat, r.coordinates.lon) < 250;
      }
      return true;
    };

    const intentos = [lugar.nombre];
    if (lugar.pais) intentos.push(lugar.nombre + ' ' + lugar.pais);
    if (lugar.region) intentos.push(lugar.nombre + ' ' + lugar.region);

    for (const texto of intentos) {
      try {
        let r = await wikiResumenPorTitulo(texto);
        if (valido(r)) { cache.set(clave, r); return r; }
      } catch (e) { /* probamos con la búsqueda */ }
      try {
        const titulos = await wikiTituloBusqueda(texto);
        for (const t of titulos.slice(0, 2)) {
          const r = await wikiResumenPorTitulo(t);
          if (valido(r)) { cache.set(clave, r); return r; }
        }
      } catch (e) { /* siguiente intento */ }
    }
    cache.set(clave, { nada: true });
    return null;
  }

  const IMG_NO = /(flag|bandera|escudo|coat_of|map|mapa|locator|logo|icon|symbol|blank|commons-logo|wikimedia|stub|diagram|seal_of|signature|firma)/i;

  function agrandar(url, ancho) {
    if (!url) return url;
    if (url.indexOf('//') === 0) url = 'https:' + url;
    return url.replace(/\/(\d+)px-/, '/' + (ancho || 1280) + 'px-');
  }

  async function wikiImagenes(titulo, max) {
    try {
      const d = await getJSON('https://es.wikipedia.org/api/rest_v1/page/media-list/' +
        encodeURIComponent(titulo.replace(/ /g, '_')));
      return (d.items || [])
        .filter((i) => i.type === 'image' && i.showInGallery !== false && /\.jpe?g$/i.test(i.title || '') &&
          !IMG_NO.test(i.title || '') && i.srcset && i.srcset.length)
        .map((i) => agrandar(i.srcset[i.srcset.length - 1].src, 1280))
        .slice(0, max || 8);
    } catch (e) {
      return [];
    }
  }

  
  async function fotosCerca(lat, lon, max) {
    try {
      const d = await getJSON(
        'https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6' +
        '&ggscoord=' + lat + '%7C' + lon + '&ggsradius=8000&ggslimit=30&prop=imageinfo&iiprop=url%7Csize' +
        '&iiurlwidth=1280&format=json&origin=*'
      );
      const paginas = d.query ? Object.values(d.query.pages) : [];
      return paginas
        .map((p) => (p.imageinfo || [])[0])
        .filter((i) => i && i.thumburl && /\.jpe?g$/i.test(i.url || '') && i.width >= i.height &&
          i.width >= 1200 && !IMG_NO.test(i.url))
        .map((i) => i.thumburl)
        .slice(0, max || 6);
    } catch (e) {
      return [];
    }
  }

  async function cercanos(lat, lon, limite) {
    const clave = 'cerca:' + lat.toFixed(2) + ',' + lon.toFixed(2);
    const guardado = cache.get(clave, 3 * DIA);
    if (guardado) return guardado;
    try {
      const d = await getJSON(
        'https://es.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=10000&gslimit=' + (limite || 12) +
        '&gscoord=' + lat + '%7C' + lon + '&format=json&origin=*'
      );
      const r = ((d.query && d.query.geosearch) || []).map((x) => ({
        id: x.pageid, titulo: x.title, lat: x.lat, lon: x.lon, dist: x.dist
      }));
      cache.set(clave, r);
      return r;
    } catch (e) {
      return [];
    }
  }

  

  global.VoyaGoAPI = {
    CATALOGO, norm, esc, cache, distanciaKm,
    buscarEnCatalogo, buscarLugares, buscarNominatim, resolverLugar,
    clima, descripcionClima, rumboViento,
    pais, tasas, convertir,
    wikiResumen, wikiImagenes, fotosCerca, cercanos
  };
})(window);
