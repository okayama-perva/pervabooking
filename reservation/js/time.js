let reservedRanges = [];

function parseTimeToFloat(timeStr) {
	// 例: "2025-06-03 17:00" → "17:00"
	const timePart = timeStr.split(' ')[1]; // 日付と時間を分割して時間だけ取る
	const [hour, min] = timePart.split(':').map(Number);
	return hour + (min >= 30 ? 0.5 : 0);
}

// 会議室 or 日付変更時に呼ぶ
async function loadReservedRanges(room, date) {
	if (!room || !date) return;

	// Firestore から予約取得
	const snapshot = await db.collection('reservations')
		.where('room', '==', room)
		.where('date', '==', date)
		.get();

	// 重なりチェック用に時刻を数値変換して格納
	reservedRanges = snapshot.docs.map(doc => {
		const data = doc.data();
		return {
			from: parseTimeToFloat(data.start),
			to: parseTimeToFloat(data.end),
		};
	});
	renderReservedBlocks();
}

// 視覚的に赤ブロック表示
function renderReservedBlocks() {
	const container = document.querySelector('.irs-grid');
	if (!container) return;

	// 既存ブロック削除
	document.querySelectorAll('.reserved-block').forEach(el => el.remove());

	reservedRanges.forEach(({ from, to }) => {
		const block = document.createElement('div');
		block.className = 'reserved-block absolute';
		const percentStart = ((from - 7) / 13) * 100;
		const percentEnd = ((to - 7) / 13) * 100;
		block.style.left = `${percentStart}%`;
		block.style.width = `${percentEnd - percentStart}%`;
		block.style.top = '0';
		block.style.bottom = '0';
		block.style.backgroundColor = '#fecaca';
		block.style.opacity = '0.5';
		block.style.pointerEvents = 'none';
		container.appendChild(block);
	});
}

$(document).ready(function () {
	$('#time-slider').ionRangeSlider({
		type: 'double',
		min: 7,
		max: 20,
		step: 0.5,
		from: 10,
		to: 11,
		grid: true,
        grid_num: 13,
        // grid_snap: true,
		prettify: function (num) {
			const hour = Math.floor(num);
			const minute = num % 1 === 0 ? '00' : '30';
			return `${String(hour).padStart(2, '0')}:${minute}`;
		},
		onStart: function (data) {
			updateTimeFields(data.from, data.to);
		},
		onChange: function (data) {
			updateTimeFields(data.from, data.to);
		},
	});

	function updateTimeFields(from, to) {
		const format = (num) => {
			const hour = Math.floor(num);
			const minute = num % 1 === 0 ? '00' : '30';
			return `${String(hour).padStart(2, '0')}:${minute}`;
		};
		document.getElementById('start_time').value = format(from);
		document.getElementById('end_time').value = format(to);
	}
});


flatpickr("#list-date", {
	dateFormat: "Y-m-d",
	defaultDate: "today",
	minDate: "today",
	onChange: function (selectedDates, dateStr) {
		const room = document.getElementById('room').value;
		loadReservedRanges(room, dateStr); // ← ここ追加
		renderRoomWiseList(dateStr);
		document.getElementById('list-date').value = dateStr;
	},
});
