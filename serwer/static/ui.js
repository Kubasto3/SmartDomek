function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

async function loadHighcharts() {
  if (window.Highcharts) return;

  await loadScript('https://code.highcharts.com/stock/highstock.js');
  await loadScript('https://code.highcharts.com/highcharts-more.js');
  await loadScript('https://code.highcharts.com/stock/modules/exporting.js');
  await loadScript('https://code.highcharts.com/stock/modules/accessibility.js');
}


document.addEventListener('DOMContentLoaded', () => {
  /* Flash messages */
  setTimeout(() => {
    document.querySelectorAll('.flash').forEach(flash => {
      flash.style.opacity = '0';
      flash.style.transform = 'translateY(-10px)';
      setTimeout(() => flash.remove(), 400);
    });
  }, 5000);

  /* Theme handling */
  function applyThemeFromStorage() {
    if (localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light');
    }
  }

  function initThemeToggle(id) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const updateIcon = () => {
      btn.textContent = document.body.classList.contains('light') ? '🌙' : '🌞';
    };

    updateIcon();

    btn.addEventListener('click', () => {
      document.body.classList.toggle('light');
      localStorage.setItem(
        'theme',
        document.body.classList.contains('light') ? 'light' : 'dark'
      );
      updateIcon();
    });
  }

  applyThemeFromStorage();
  initThemeToggle('theme-toggle-auth');
  initThemeToggle('theme-toggle-dashboard');

  /* Password visibility toggle */
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;

      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      btn.textContent = isVisible ? '👁' : '🙈';
    });
  });
});

function reflowAllCharts() {
  if (!window.Highcharts) return;

  Highcharts.charts.forEach(chart => {
    if (chart && typeof chart.reflow === 'function') {
      chart.reflow();
    }
  });
}

window.addEventListener('resize', () => {
  clearTimeout(window.__hcResizeTimer);
  window.__hcResizeTimer = setTimeout(reflowAllCharts, 150);
});

document.addEventListener('DOMContentLoaded', () => {
  const FLASH_DURATION = 5000;

  document.querySelectorAll('.flash').forEach(flash => {
    flash.style.setProperty('--flash-duration', `${FLASH_DURATION}ms`);

    setTimeout(() => {
      flash.style.opacity = '0';
      flash.style.transform = 'translateY(-8px)';

      setTimeout(() => {
        flash.remove();
      }, 300);
    }, FLASH_DURATION);
  });
});
