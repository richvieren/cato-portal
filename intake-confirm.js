/* intake-confirm.js — shared confirmation step + TOB formatting for all reading intake forms.
   Used by blueprint.html, transit-reading.html, and future reading types. */

/**
 * Format ISO date (YYYY-MM-DD) to human-readable: "31 December 1963"
 */
function formatDobHuman(isoDate) {
  var d = new Date(isoDate + 'T00:00:00');
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

/**
 * Format 24h time to "14:30 (= 2:30 PM)" or "Not provided"
 */
function formatTobHuman(time24) {
  if (!time24) return 'Not provided';
  var parts = time24.split(':');
  var h = parseInt(parts[0], 10);
  var m = parts[1];
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12 || 12;
  return time24 + ' (= ' + h12 + ':' + m + ' ' + ampm + ')';
}

/**
 * Render the TOB field with 24-hour label and hint.
 * Call from HTML: renderTobField('tob')
 * Returns the field-group HTML string for insertion, or use the static HTML pattern.
 */

/**
 * Build and inject confirmation view HTML into a container element.
 * @param {string} containerId - ID of an empty div to receive the confirm markup
 * @param {Array} fields - Array of {label, id} objects for the business-context fields
 */
function buildConfirmView(containerId, fields) {
  var container = document.getElementById(containerId);
  if (!container) return;

  // Birth detail rows (always present)
  var rows = [
    {label: 'Name', id: 'confirm-name'},
    {label: 'Date of birth', id: 'confirm-dob'},
    {label: 'Time of birth', id: 'confirm-tob'},
    {label: 'Birthplace', id: 'confirm-city'},
  ];

  // Add business-context fields
  for (var i = 0; i < fields.length; i++) {
    rows.push(fields[i]);
  }

  var html = '<h1 style="margin-top:2rem">Please confirm your details</h1>';
  html += '<p class="subtitle">Birth details cannot be changed after submission.</p>';
  html += '<div style="background:rgba(186,145,107,0.06);border:1px solid rgba(186,145,107,0.15);border-radius:10px;padding:1.5rem 1.8rem;margin-bottom:2rem;text-align:left">';

  for (var j = 0; j < rows.length; j++) {
    var isLast = j === rows.length - 1;
    html += '<div id="' + rows[j].id + '-row" style="margin-bottom:' + (isLast ? '0' : '1rem') + '">';
    html += '<span class="field-label" style="margin-bottom:0.2rem;font-family:Jost,sans-serif;font-size:0.62rem;letter-spacing:0.22em;text-transform:uppercase">' + rows[j].label + '</span>';
    html += '<p id="' + rows[j].id + '" style="color:var(--mist);font-size:1rem;line-height:1.5"></p>';
    html += '</div>';
  }

  html += '</div>';
  html += '<div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">';
  html += '<button class="btn" onclick="backToForm()" style="background:transparent;border:1px solid rgba(186,145,107,0.3);color:var(--stone);padding:0.8rem 1.6rem;border-radius:6px;cursor:pointer;font-family:Jost,sans-serif;font-weight:400;font-size:0.85rem">Edit details</button>';
  html += '<button class="btn btn-primary" id="confirm-submit-btn" onclick="confirmAndSubmit()">Confirm &amp; submit</button>';
  html += '</div>';
  html += '<div class="error-msg" id="confirm-error"></div>';

  container.innerHTML = html;
}

/**
 * Populate the confirmation screen with collected intake data.
 * @param {Object} data - The pending intake data object
 * @param {Object} loc - The validated location object from autocomplete
 * @param {Array} businessFields - Array of {id, value, optional} for business fields
 */
function populateConfirmView(data, loc, businessFields) {
  document.getElementById('confirm-name').textContent = data.full_name;
  document.getElementById('confirm-dob').textContent = formatDobHuman(data.dob);
  document.getElementById('confirm-tob').textContent = formatTobHuman(data.tob);
  document.getElementById('confirm-city').textContent = loc.display || (loc.city + ', ' + loc.country);

  for (var i = 0; i < businessFields.length; i++) {
    var f = businessFields[i];
    var el = document.getElementById(f.id);
    var rowEl = document.getElementById(f.id + '-row');
    if (el) el.textContent = f.value;
    if (rowEl && f.optional) {
      rowEl.style.display = f.value ? 'block' : 'none';
    }
  }
}

/**
 * Show confirmation view, hide intake view.
 */
function showConfirmView() {
  document.getElementById('intake-view').style.display = 'none';
  document.getElementById('confirm-view').style.display = 'block';
}

/**
 * Back to form — hide confirm, show intake. Values are preserved in the DOM.
 */
function backToForm() {
  document.getElementById('confirm-view').style.display = 'none';
  document.getElementById('intake-view').style.display = 'block';
}
