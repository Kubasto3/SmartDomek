const RANGE_SELECTOR_CONFIG = {
  buttons: [
    { type: 'day', count: 1, text: '1d' },
    { type: 'day', count: 7, text: '7d' },
    { type: 'month', count: 1, text: '1m' },
    { type: 'year', count: 1, text: '1r' },
    { type: 'all', text: 'ALL' }
  ],
  selected: 0
};

async function initCharts() {
  if (!window.MEASUREMENTS || !window.MEASUREMENTS.length) return;
  await loadHighcharts();

  const m = window.MEASUREMENTS;

  createChart('chart-temp-inside', 'Temperatura wewnętrzna', '°C',
    m.map(r => [r.ts, r.temp_inside])
  );

  createChart('chart-temp-outside', 'Temperatura zewnętrzna', '°C',
    m.map(r => [r.ts, r.temp_outside])
  );

  createChart('chart-humidity', 'Wilgotność', '%',
    m.map(r => [r.ts, r.humidity])
  );

  createChart('chart-pressure', 'Ciśnienie', 'hPa',
    m.map(r => [r.ts, r.pressure])
  );

  createChart('chart-light', 'Natężenie światła', '',
    m.filter(r => r.light_intensity !== null)
     .map(r => [r.ts, r.light_intensity])
  );

  createChart(
    'chart-set-temp',
    'Temperatura zadana',
    '°C',
    m.map(r => [r.ts, r.set_temperature]),
    { dashStyle: 'ShortDash' }
  );

  createHeaterChart(
    'chart-heater',
    m.map(r => [r.ts, Number(r.heater_state)])
  );

  initMultiChart(m);
}

function baseStockConfig(title, unit) {
  return {
    chart: { zoomType: 'x' },
    title: { text: '' },
    time: { useUTC: false },
    rangeSelector: RANGE_SELECTOR_CONFIG,
    yAxis: { title: { text: unit } },
    navigator: { enabled: true },
    scrollbar: { enabled: true },
    legend: { enabled: true }
  };
}

function createChart(id, title, unit, data, extra = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const mainSeriesId = `${id}-main`;

  const chart = Highcharts.stockChart(el, {
    ...baseStockConfig(title, unit),

    xAxis: {
      events: {
        afterSetExtremes() {
          updateStats();
        }
      }
    },

    plotOptions: {
      series: {
        events: {
          legendItemClick() {
            setTimeout(updateStats, 0);
          }
        },
        dataLabels: {
          enabled: false
        }
      }
    },

    series: [
      {
        id: mainSeriesId,
        name: title,
        type: 'line',
        data,
        ...extra
      },
      {
        id: 'min',
        name: 'Mini',
        visible: false,
        type: 'line',
        dashStyle: 'Dash',
        dataLabels: statLabel(unit, false)
      },
      {
        id: 'max',
        name: 'Maks',
        visible: false,
        type: 'line',
        dashStyle: 'Dash',
        dataLabels: statLabel(unit, false)
      },
      {
        id: 'avg',
        name: 'Średnia',
        visible: false,
        type: 'line',
        dashStyle: 'ShortDash',
        dataLabels: statLabel(unit, true)
      },
      {
        id: 'median',
        name: 'Mediana',
        visible: false,
        type: 'line',
        dashStyle: 'Dot',
        dataLabels: statLabel(unit, true)
      }
    ]
  });

  function updateStats() {
    const main = chart.get(mainSeriesId);
    if (!main) return;

    const xMin = chart.xAxis[0].min;
    const xMax = chart.xAxis[0].max;
    if (xMin == null || xMax == null) return;

    const visibleData = main.options.data.filter(
      p => p[0] >= xMin && p[0] <= xMax
    );

    const stats = computeStats(visibleData);
    if (!stats) return;

    const from = xMin;
    const to = xMax;

    const mapping = {
      min: stats.min,
      max: stats.max,
      avg: stats.avg,
      median: stats.median
    };

    Object.entries(mapping).forEach(([id, value]) => {
      const s = chart.get(id);
      if (!s) return;

      if (s.visible) {
        s.setData(buildHorizontalLine(value, from, to), false);
      } else {
        s.setData([], false);
      }
    });

    chart.redraw();
  }
}

function statLabel(unit, round) {
  return {
    enabled: true,
    formatter() {
      return (round ? this.y.toFixed(2) : this.y) + (unit ? ' ' + unit : '');
    },
    align: 'left',
    verticalAlign: 'top',
    crop: false,
    overflow: 'allow',
    style: {
      fontWeight: 'bold'
    }
  };
}

function createHeaterChart(id, data) {
  const el = document.getElementById(id);
  if (!el) return;

  Highcharts.stockChart(el, {
    ...baseStockConfig('Stan ogrzewania', ''),
    yAxis: {
      min: 0,
      max: 1,
      tickInterval: 1,
      labels: {
        formatter() {
          return this.value ? 'ON' : 'OFF';
        }
      }
    },
    series: [{
      type: 'line',
      step: true,
      data
    }]
  });
}

function buildHeaterPlotBands(m) {
  const bands = [];
  let from = null;
  let id = 0;

  for (let i = 0; i < m.length; i++) {
    const curr = m[i];
    const next = m[i + 1];

    if (curr.heater_state === 1 && from === null) {
      from = curr.ts;
    }

    if (from !== null && (curr.heater_state === 0 || !next)) {
      bands.push({
        id: `heater-band-${id++}`,
        from,
        to: next ? curr.ts : curr.ts + 1,
        color: 'rgba(220, 38, 38, 0.25)'
      });
      from = null;
    }
  }

  return bands;
}

function initMultiChart(m) {
  const container = document.getElementById('chart-multi');
  if (!container) return;

  const heaterBands = buildHeaterPlotBands(m);

  Highcharts.stockChart(container, {
    chart: { zoomType: 'x' },
    title: { text: '' },
    time: { useUTC: false },
    rangeSelector: RANGE_SELECTOR_CONFIG,
    xAxis: { type: 'datetime', plotBands: heaterBands },
    yAxis: { title: { text: 'Wartości rzeczywiste' } },
    navigator: { enabled: true },
    scrollbar: { enabled: true },
    legend: { enabled: true },

    series: [
      { name: 'Temperatura wewnętrzna', data: m.map(r => [r.ts, r.temp_inside]), visible: true },
      { name: 'Temperatura zewnętrzna', data: m.map(r => [r.ts, r.temp_outside]), visible: false },
      { name: 'Wilgotność', data: m.map(r => [r.ts, r.humidity]), visible: false },
      { name: 'Ciśnienie', data: m.map(r => [r.ts, r.pressure]), visible: false },
      {
        name: 'Natężenie światła',
        data: m.filter(r => r.light_intensity !== null).map(r => [r.ts, r.light_intensity]),
        visible: false
      },
      {
        name: 'Temperatura zadana',
        dashStyle: 'ShortDash',
        data: m.map(r => [r.ts, r.set_temperature]),
        visible: false
      }
    ]
  });
}

function computeStats(data) {
  if (!data.length) return null;

  const values = data.map(p => p[1]).filter(v => v !== null && !isNaN(v));
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  const avg = sum / values.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(avg * 100) / 100,
    median: Math.round(median * 100) / 100
  };
}

function buildHorizontalLine(y, from, to) {
  return [
    [from, y],
    [to, y]
  ];
}

document.addEventListener('DOMContentLoaded', initCharts);
