// ✅ 共通ユーティリティ関数群（utils.js）

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeToRow(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  return hh * 2 + (mm === 30 ? 1 : 0); // 30分単位 → 1時間=2行
}

function rowToTime(row) {
  const h = Math.floor(row / 2);
  const m = row % 2 === 1 ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${m}`;
}

function getRandomColor() {
	const colors = ['#1abc9c', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#f39c12', '#2ecc71'];
	return colors[Math.floor(Math.random() * colors.length)];
}
