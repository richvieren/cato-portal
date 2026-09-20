// boot-demo.js — renders the demo chart wheel on the landing page.
// STUB: the render assets are not in this folder yet. See SOURCE.md.
//
// Contract when the assets land:
//   demo-chart.json  → the chart row (planets, houses, aspects, …)
//   chart-engine.js  → ChartData
//   chart-wheel.js   → renderChartWheel(containerId, chartData)
//
// No API call, no auth, no login. The landing page never talks to the portal backend.

(function () {
  var mount = document.getElementById('w-chart-wheel');
  if (!mount) return;

  if (typeof ChartData !== 'function' || typeof renderChartWheel !== 'function') {
    console.warn('[demo] render assets missing — static fallback stays visible. See shared/chart-demo/SOURCE.md');
    return;
  }

  fetch('../shared/chart-demo/demo-chart.json')
    .then(function (r) { if (!r.ok) throw new Error('demo-chart.json ' + r.status); return r.json(); })
    .then(function (chart) {
      renderChartWheel('w-chart-wheel', new ChartData(chart));
      var owner = mount.getAttribute('data-demo-owner');
      if (owner && mount._setCenterName) mount._setCenterName(owner);
    })
    .catch(function (err) { console.error('[demo] could not render:', err); });
})();
