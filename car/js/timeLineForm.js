const yearSelect = document.getElementById('yearSelect');
const monthSelect = document.getElementById('monthSelect');
const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth() + 1;

for (let y = thisYear; y <= thisYear + 2; y++) {
  const opt = document.createElement('option');
  opt.value = String(y);
  opt.textContent = `${y}年`;
  if (y === thisYear) {
    opt.selected = true;
  }
  yearSelect.appendChild(opt);
}

monthSelect.value = String(thisMonth);

async function redraw() {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  if (typeof drawTimeline === 'function') {
    await drawTimeline(year, month);
  }
}

yearSelect.addEventListener('change', redraw);
monthSelect.addEventListener('change', redraw);

redraw();
