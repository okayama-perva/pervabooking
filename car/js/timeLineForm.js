const yearSelect = document.getElementById('yearSelect');
const monthSelect = document.getElementById('monthSelect');
const thisYear = new Date().getFullYear();
const thisMonth = new Date().getMonth() + 1;

// 📆 年セレクト生成（2023〜2026）
for (let y = thisYear ; y <= thisYear + 2; y++) {
  const opt = document.createElement('option');
  opt.value = y;
  opt.textContent = `${y}年`;
  if (y === thisYear) opt.selected = true;
  yearSelect.appendChild(opt);
}

// 📆 月初期値を今月に
monthSelect.value = thisMonth;

// ✅ セレクト変更時に即反映
yearSelect.addEventListener('change', () => {
  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  drawTimeline(year, month);
});

monthSelect.addEventListener('change', () => {
  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  drawTimeline(year, month);
});

// ✅ 初期表示
drawTimeline(thisYear, thisMonth);
