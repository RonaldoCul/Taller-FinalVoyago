
(function () {
  'use strict';

  const API = window.VoyaGoAPI;
  const lista = document.querySelector('.rv-precios');
  const total = document.querySelector('.rv-total strong');
  const titulo = document.querySelector('.rv-resumen__titulo');
  if (!API || !lista || !total || !titulo) return;

  const MONEDAS = ['COP', 'USD', 'EUR', 'MXN', 'GBP', 'ARS', 'BRL', 'CLP', 'PEN', 'CAD', 'JPY'];
  const SIN_DECIMALES = ['COP', 'JPY', 'CLP', 'ARS', 'PYG', 'KRW', 'VND', 'IDR'];

  // "$ 1.700" → 1700 (el punto es separador de miles)
  const leer = (txt) => parseFloat(txt.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

  const valores = Array.from(lista.querySelectorAll('strong')).map((el) => ({ el, usd: leer(el.textContent) }));
  const totalUSD = valores.reduce((a, v) => a + v.usd, 0) || leer(total.textContent);

  let guardada = null;
  try { guardada = localStorage.getItem('vg:mi-moneda'); } catch (e) { /* ok */ }
  let moneda = guardada || 'COP';
  if (MONEDAS.indexOf(moneda) < 0) MONEDAS.unshift(moneda);

  const caja = document.createElement('div');
  caja.className = 'rv-moneda';
  caja.innerHTML =
    '<label for="rv-moneda-sel">Ver precios en</label>' +
    '<select id="rv-moneda-sel">' + MONEDAS.map((c) => '<option' + (c === moneda ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>' +
    '<small id="rv-moneda-nota">Cargando tipo de cambio…</small>';
  titulo.after(caja);

  const sel = caja.querySelector('select');
  const nota = caja.querySelector('#rv-moneda-nota');
  let datos = null;

  function formato(usd, cod) {
    let v = usd;
    if (datos && cod !== 'USD') {
      const c = API.convertir(usd, 'USD', cod, datos);
      if (c == null) return null;
      v = c;
    }
    const dec = SIN_DECIMALES.indexOf(cod) >= 0 ? 0 : 2;
    return '$ ' + v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function pintar() {
    const cod = (!datos && moneda !== 'USD') ? 'USD' : moneda;
    valores.forEach((v) => { v.el.textContent = formato(v.usd, cod) || formato(v.usd, 'USD'); });
    total.textContent = (formato(totalUSD, cod) || formato(totalUSD, 'USD')) + ' ' + cod;
    if (datos && cod !== 'USD') {
      const t = API.convertir(1, 'USD', cod, datos);
      nota.textContent = '1 USD = ' + t.toLocaleString('es-CO', { maximumFractionDigits: t >= 100 ? 0 : 2 }) + ' ' + cod +
        ' · tasa referencial';
    } else if (datos) {
      nota.textContent = 'Precios base en dólares (USD)';
    }
  }

  sel.addEventListener('change', () => {
    moneda = sel.value;
    try { localStorage.setItem('vg:mi-moneda', moneda); } catch (e) { /* ok */ }
    pintar();
  });

  pintar();
  API.tasas().then((t) => { datos = t; pintar(); }).catch(() => {
    nota.textContent = 'No pudimos actualizar el tipo de cambio. Mostrando precios en USD.';
    sel.disabled = true; sel.value = 'USD';
    moneda = 'USD';
    pintar();
  });
})();
