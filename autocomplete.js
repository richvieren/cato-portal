/* autocomplete.js — Google Places Autocomplete for birth city selection.
   Uses Places API (New) with (cities) type restriction and session tokens.
   Stores place_id for server-side verification. */

var _validatedLocation = null;

/* Which address component names the birth city, most specific first. */
var CITY_COMPONENT_RANK = [
  'locality', 'postal_town', 'sublocality',
  'administrative_area_level_3', 'administrative_area_level_2',
  'administrative_area_level_1',
];

function getValidatedLocation() {
  return _validatedLocation;
}

function clearValidatedLocation() {
  _validatedLocation = null;
  var conf = document.getElementById('location-confirmation');
  if (conf) conf.style.display = 'none';
  var placeIdField = document.getElementById('birth-place-id');
  if (placeIdField) placeIdField.value = '';
}

/* Google Maps callback — called by &callback=initPlacesAutocomplete on the script tag.
   Inits autocomplete on whichever birth-city field exists on the current page. */
function initPlacesAutocomplete() {
  // Standard field ID used by blueprint, transit, astrocartography
  if (document.getElementById('birth-city')) {
    initBirthCityAutocomplete('birth-city');
  }
  // Profile intake uses a different field ID
  if (document.getElementById('f-city')) {
    initBirthCityAutocomplete('f-city');
  }
  // Astrocartography city fields (only exist on astrocartography.html)
  var cityIds = ['city-1','city-2','city-3','city-4','city-5'];
  for (var i = 0; i < cityIds.length; i++) {
    if (document.getElementById(cityIds[i])) {
      initCityAutocomplete(cityIds[i]);
    }
  }
}

/* ── Multi-city autocomplete (astrocartography) ─────────────────────────── */

var _validatedCities = {};

function getValidatedCities() {
  var result = [];
  var ids = ['city-1','city-2','city-3','city-4','city-5'];
  for (var i = 0; i < ids.length; i++) {
    if (_validatedCities[ids[i]]) {
      result.push(_validatedCities[ids[i]]);
    }
  }
  return result;
}

function clearValidatedCity(inputId) {
  delete _validatedCities[inputId];
  var conf = document.getElementById(inputId + '-confirmation');
  if (conf) conf.style.display = 'none';
}

function restoreValidatedCity(inputId, cityObj) {
  _validatedCities[inputId] = cityObj;
  var input = document.getElementById(inputId);
  if (input) input.value = cityObj.display || (cityObj.city + ', ' + cityObj.country);
  var conf = document.getElementById(inputId + '-confirmation');
  if (conf) {
    var span = document.getElementById(inputId + '-resolved-name');
    if (span) span.textContent = cityObj.display || (cityObj.city + ', ' + cityObj.country);
    conf.style.display = 'block';
  }
}

function initCityAutocomplete(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('input', function () {
    clearValidatedCity(inputId);
  });

  var autocomplete = new google.maps.places.Autocomplete(input, {
    // Was ['(cities)'], which returns only locality and
    // administrative_area_level_3. Measured against the Places API on
    // 2026-09-25, that filter returns ZERO suggestions for real birth places:
    //   Bjerkreim (Norwegian municipality, ~2,800 people)  0 -> 5
    //   Warszawa Ochota (a Warsaw district)                0 -> 5
    // A client whose birth place is one of those cannot submit the form at
    // all, ever, and until the beacon landed we could not see it happening.
    // NOT fixed by this: an institution name. "Rikshospitalet Oslo" still
    // returns zero, because a hospital is an establishment and no admin type
    // covers it. That case needs the manual fallback, which is not built.
    // The server still validates whatever she picks through
    // resolve_place(place_id), so forced selection is unchanged.
    types: ['locality', 'administrative_area_level_2',
            'administrative_area_level_3', 'sublocality', 'postal_town'],
    fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
  });

  autocomplete.addListener('place_changed', function () {
    var place = autocomplete.getPlace();

    if (!place || !place.place_id) {
      clearValidatedCity(inputId);
      return;
    }

    var city = '';
    var cityRank = -1;
    var country = '';
    var components = place.address_components || [];
    for (var i = 0; i < components.length; i++) {
      var types = components[i].types;
      // Most specific name first. Widening the type filter on 2026-09-25 let
      // through places with no `locality` at all: Bjerkreim Municipality is
      // administrative_area_level_2, and the old locality-or-level_1 rule
      // would have labelled it "Rogaland", its county. The city goes on the
      // cover of the reading, so a wrong one is worse than a missing one.
      for (var r = 0; r < CITY_COMPONENT_RANK.length; r++) {
        if (types.indexOf(CITY_COMPONENT_RANK[r]) !== -1) {
          if (cityRank === -1 || r < cityRank) { city = components[i].long_name; cityRank = r; }
          break;
        }
      }
      if (types.indexOf('country') !== -1) {
        country = components[i].long_name;
      }
    }

    if (!city) city = place.name || '';
    var display = place.formatted_address || (city + ', ' + country);
    var lat = place.geometry ? place.geometry.location.lat() : 0;
    var lon = place.geometry ? place.geometry.location.lng() : 0;

    _validatedCities[inputId] = {
      place_id: place.place_id,
      city: city,
      country: country,
      display: display,
      lat: lat,
      lon: lon,
    };

    var conf = document.getElementById(inputId + '-confirmation');
    if (conf) {
      var span = document.getElementById(inputId + '-resolved-name');
      if (span) span.textContent = display;
      conf.style.display = 'block';
    }
  });
}

/* ── Birth city autocomplete ────────────────────────────────────────────── */

function initBirthCityAutocomplete(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('input', function () {
    clearValidatedLocation();
  });

  var autocomplete = new google.maps.places.Autocomplete(input, {
    // Was ['(cities)'], which returns only locality and
    // administrative_area_level_3. Measured against the Places API on
    // 2026-09-25, that filter returns ZERO suggestions for real birth places:
    //   Bjerkreim (Norwegian municipality, ~2,800 people)  0 -> 5
    //   Warszawa Ochota (a Warsaw district)                0 -> 5
    // A client whose birth place is one of those cannot submit the form at
    // all, ever, and until the beacon landed we could not see it happening.
    // NOT fixed by this: an institution name. "Rikshospitalet Oslo" still
    // returns zero, because a hospital is an establishment and no admin type
    // covers it. That case needs the manual fallback, which is not built.
    // The server still validates whatever she picks through
    // resolve_place(place_id), so forced selection is unchanged.
    types: ['locality', 'administrative_area_level_2',
            'administrative_area_level_3', 'sublocality', 'postal_town'],
    fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
  });

  autocomplete.addListener('place_changed', function () {
    var place = autocomplete.getPlace();

    if (!place || !place.place_id) {
      clearValidatedLocation();
      return;
    }

    var city = '';
    var cityRank = -1;
    var country = '';
    var components = place.address_components || [];
    for (var i = 0; i < components.length; i++) {
      var types = components[i].types;
      // Most specific name first. Widening the type filter on 2026-09-25 let
      // through places with no `locality` at all: Bjerkreim Municipality is
      // administrative_area_level_2, and the old locality-or-level_1 rule
      // would have labelled it "Rogaland", its county. The city goes on the
      // cover of the reading, so a wrong one is worse than a missing one.
      for (var r = 0; r < CITY_COMPONENT_RANK.length; r++) {
        if (types.indexOf(CITY_COMPONENT_RANK[r]) !== -1) {
          if (cityRank === -1 || r < cityRank) { city = components[i].long_name; cityRank = r; }
          break;
        }
      }
      if (types.indexOf('country') !== -1) {
        country = components[i].long_name;
      }
    }

    if (!city) city = place.name || '';
    var display = place.formatted_address || (city + ', ' + country);
    var lat = place.geometry ? place.geometry.location.lat() : 0;
    var lon = place.geometry ? place.geometry.location.lng() : 0;

    _validatedLocation = {
      place_id: place.place_id,
      city: city,
      country: country,
      display: display,
      lat: lat,
      lon: lon,
    };

    // Set hidden fields
    var placeIdField = document.getElementById('birth-place-id');
    if (placeIdField) placeIdField.value = place.place_id;

    // Show confirmation
    var conf = document.getElementById('location-confirmation');
    if (conf) {
      var span = document.getElementById('location-resolved-name');
      if (span) span.textContent = display;
      conf.style.display = 'block';
    }
  });
}
