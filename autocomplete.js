/* autocomplete.js — Nominatim city autocomplete for Cato portal */

function initCityAutocomplete(cityInputId, countryInputId) {
  const cityInput = document.getElementById(cityInputId);
  const countryInput = document.getElementById(countryInputId);
  if (!cityInput || !countryInput) return;

  let debounceTimer = null;
  let activeIndex = -1;
  let results = [];

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'city-autocomplete-dropdown';
  dropdown.style.display = 'none';

  // Position relative to the input's parent
  const wrapper = cityInput.parentElement;
  wrapper.style.position = 'relative';
  wrapper.appendChild(dropdown);

  function hide() {
    dropdown.style.display = 'none';
    activeIndex = -1;
    results = [];
  }

  function render() {
    dropdown.innerHTML = '';
    if (!results.length) { hide(); return; }
    dropdown.style.display = 'block';
    results.forEach(function (r, i) {
      const item = document.createElement('div');
      item.className = 'city-autocomplete-item' + (i === activeIndex ? ' active' : '');
      item.textContent = r.display;
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        select(r);
      });
      dropdown.appendChild(item);
    });
  }

  function select(r) {
    cityInput.value = r.city;
    countryInput.value = r.country;
    hide();
  }

  function parseResult(item) {
    var city = '';
    var country = '';
    var addr = item.address || {};

    city = addr.city || addr.town || addr.village || addr.municipality || item.name || '';
    country = addr.country || '';

    var display = city;
    if (addr.state && addr.state !== city) display += ', ' + addr.state;
    if (country) display += ', ' + country;

    return { city: city, country: country, display: display };
  }

  async function fetchCities(query) {
    try {
      var url = 'https://nominatim.openstreetmap.org/search?q=' +
        encodeURIComponent(query) +
        '&format=json&addressdetails=1&limit=5&featuretype=city';
      var resp = await fetch(url, {
        headers: { 'User-Agent': 'CatoVermeulenPortal/1.0' }
      });
      var data = await resp.json();
      results = data.map(parseResult).filter(function (r) { return r.city; });
      activeIndex = -1;
      render();
    } catch (e) {
      hide();
    }
  }

  cityInput.addEventListener('input', function () {
    var val = cityInput.value.trim();
    clearTimeout(debounceTimer);
    if (val.length < 3) { hide(); return; }
    debounceTimer = setTimeout(function () { fetchCities(val); }, 300);
  });

  cityInput.addEventListener('keydown', function (e) {
    if (dropdown.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  cityInput.addEventListener('blur', function () {
    // Small delay so mousedown on item fires first
    setTimeout(hide, 150);
  });

  document.addEventListener('click', function (e) {
    if (!wrapper.contains(e.target)) hide();
  });
}
