/* autocomplete.js — Google Places Autocomplete for birth city selection.
   Uses Places API (New) with (cities) type restriction and session tokens.
   Stores place_id for server-side verification. */

var _validatedLocation = null;

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
}

function initBirthCityAutocomplete(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('input', function () {
    clearValidatedLocation();
  });

  var autocomplete = new google.maps.places.Autocomplete(input, {
    types: ['(cities)'],
    fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
  });

  autocomplete.addListener('place_changed', function () {
    var place = autocomplete.getPlace();

    if (!place || !place.place_id) {
      clearValidatedLocation();
      return;
    }

    var city = '';
    var country = '';
    var components = place.address_components || [];
    for (var i = 0; i < components.length; i++) {
      var types = components[i].types;
      if (types.indexOf('locality') !== -1) {
        city = components[i].long_name;
      } else if (types.indexOf('administrative_area_level_1') !== -1 && !city) {
        city = components[i].long_name;
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
