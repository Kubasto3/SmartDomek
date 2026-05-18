let lastTs = null;

function updateClock() {
  const clock = document.getElementById('rtc-clock');
  if (!clock) return;

  clock.innerText = new Date().toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

setInterval(updateClock, 1000);
updateClock();

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('history-toggle');
  const panel = document.getElementById('history-panel');

  if (toggle && panel) {
    toggle.onclick = () => {
      panel.classList.toggle('open');
      toggle.classList.toggle('open');
    };
  }

  pollState();
  setInterval(pollState, 10000);
});

async function pollState() {
  try {
    const url = lastTs
      ? `/dashboard/state?since=${lastTs}`
      : `/dashboard/state`;

    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return;

    const data = await res.json();

    if (data.last) {
      updateStatusCards(data.last);
    }

    if (data.new && data.new.length) {
      data.new.forEach(addMeasurementToCharts);
      lastTs = data.new[data.new.length - 1].ts;
    }
  } catch (e) {
    console.warn('Polling error:', e);
  }
}

function updateStatusCards(m) {
  const map = {
    'Temp. wewnętrzna': m.temp_inside?.toFixed(1) + ' °C',
    'Temp. zewnętrzna': m.temp_outside?.toFixed(1) + ' °C',
    'Wilgotność': Math.round(m.humidity) + ' %',
    'Ciśnienie': Math.round(m.pressure) + ' hPa',
    'Stan ogrzewania': m.heater_state ? 'ON' : 'OFF',
    ' Temperatura zadana ': m.set_temperature + ' °C'
  };

  document.querySelectorAll('.status-card').forEach(card => {
    const label = card.querySelector('.label')?.textContent;
    const val = card.querySelector('.value');
    if (!(label in map) || !val) return;

    if (val.textContent !== map[label]) {
      val.textContent = map[label];
      card.classList.add('updated');

      setTimeout(() => card.classList.remove('updated'), 800);
    }

    if (label === 'Stan ogrzewania') {
      val.classList.toggle('on', m.heater_state);
      val.classList.toggle('off', !m.heater_state);
    }
  });
}

function addMeasurementToCharts(m) {
  if (!window.Highcharts) return;

  Highcharts.charts.forEach(chart => {
    if (!chart) return;

    chart.series.forEach(s => {
      switch (s.name) {
        case 'Temperatura wewnętrzna': s.addPoint([m.ts, m.temp_inside], false); break;
        case 'Temperatura zewnętrzna': s.addPoint([m.ts, m.temp_outside], false); break;
        case 'Wilgotność': s.addPoint([m.ts, m.humidity], false); break;
        case 'Ciśnienie': s.addPoint([m.ts, m.pressure], false); break;
        case 'Natężenie światła':
          if (m.light_intensity != null) s.addPoint([m.ts, m.light_intensity], false);
          break;
        case 'Temperatura zadana': s.addPoint([m.ts, m.set_temperature], false); break;
        default:
          break;
      }
    });

    chart.redraw();
  });
}
