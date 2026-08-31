// timefield.js — locale-independent birth time field.
//
// <input type="time"> renders according to the client's OS locale: a US device
// shows a 12-hour control with a separate AM/PM segment, a European one shows
// 24-hour. The stored value is always 24-hour "HH:MM", so a fixed label reading
// "(24-hour)" was wrong for every US client, and a half-filled native control
// blocked submission with the browser's own "Please enter a valid value" and no
// explanation of which part was missing (Sara Rios, 2026-08-31).
//
// Three explicit selects render identically everywhere, so the label always
// matches what the client is looking at. The canonical "HH:MM" is written into a
// hidden input, so every existing reader of #tob keeps working unchanged.

function _tobEls(id) {
  return [document.getElementById(id + '-h'),
          document.getElementById(id + '-m'),
          document.getElementById(id + '-ap')];
}

/** Write canonical 24-hour HH:MM into the hidden input, or '' if incomplete. */
function _tobSync(id) {
  var e = _tobEls(id), hidden = document.getElementById(id);
  if (!hidden || !e[0]) return;
  if (!e[0].value || !e[1].value || !e[2].value) { hidden.value = ''; return; }
  var h = parseInt(e[0].value, 10) % 12;
  if (e[2].value === 'PM') h += 12;
  hidden.value = (h < 10 ? '0' : '') + h + ':' + e[1].value;
}

/** Build the three selects into <div id="{id}-selects"> beside <input type="hidden" id="{id}">. */
function initTobField(id) {
  var hidden = document.getElementById(id);
  var mount = document.getElementById(id + '-selects');
  if (!hidden || !mount || mount.dataset.built) return;
  mount.dataset.built = '1';

  var css = 'background:transparent;border:none;border-bottom:1px solid var(--stone);' +
            'color:var(--mist);font-family:Jost,sans-serif;font-weight:300;font-size:1rem;' +
            'padding:0.6rem 0.2rem;outline:none';
  var h = '<option value="">Hour</option>';
  for (var i = 1; i <= 12; i++) h += '<option value="' + i + '">' + i + '</option>';
  var m = '<option value="">Min</option>';
  for (var j = 0; j < 60; j++) { var mm = (j < 10 ? '0' : '') + j; m += '<option value="' + mm + '">' + mm + '</option>'; }

  mount.innerHTML =
    '<div style="display:flex;gap:0.6rem;align-items:baseline">' +
      '<select id="' + id + '-h" style="' + css + '">' + h + '</select>' +
      '<span style="color:var(--stone)">:</span>' +
      '<select id="' + id + '-m" style="' + css + '">' + m + '</select>' +
      '<select id="' + id + '-ap" style="' + css + '">' +
        '<option value="">AM/PM</option><option value="AM">AM</option><option value="PM">PM</option>' +
      '</select>' +
    '</div>';

  var els = _tobEls(id);
  for (var k = 0; k < els.length; k++) {
    els[k].addEventListener('change', function () { _tobSync(id); });
  }
  _tobSync(id);
}

/** Populate the selects from a canonical "HH:MM". */
function setTobValue(id, hhmm) {
  var e = _tobEls(id);
  if (!e[0] || !hhmm) return;
  var p = String(hhmm).split(':');
  var h24 = parseInt(p[0], 10);
  if (isNaN(h24)) return;
  e[0].value = String(h24 % 12 || 12);
  e[1].value = p[1] ? p[1].slice(0, 2) : '00';
  e[2].value = h24 >= 12 ? 'PM' : 'AM';
  _tobSync(id);
}

/**
 * null when valid, otherwise a plain-English message naming what is missing.
 * All three empty is valid — birth time is optional and always has been.
 */
function tobError(id) {
  var e = _tobEls(id);
  if (!e[0]) return null;
  var filled = 0;
  for (var i = 0; i < 3; i++) if (e[i].value) filled++;
  if (filled === 0 || filled === 3) return null;
  var missing = [];
  if (!e[0].value) missing.push('hour');
  if (!e[1].value) missing.push('minutes');
  if (!e[2].value) missing.push('AM or PM');
  var last = missing.pop();
  var list = missing.length ? missing.join(', ') + ' and ' + last : last;
  return 'Your birth time is missing the ' + list + '. Please complete it, or clear all three boxes if you do not know your birth time.';
}

document.addEventListener('DOMContentLoaded', function () {
  initTobField('tob');
  initTobField('f-tob');
});
