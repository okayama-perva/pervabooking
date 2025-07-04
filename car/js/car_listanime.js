// 🔥 15分単位の固定タイムライン
const timeline = document.getElementById('timeline');

function buildTimeline() {
	timeline.innerHTML = '';
	for (let i = 0; i < 56; i++) {
		const hour = 8 + Math.floor(i / 4);
		const minute = (i % 4) * 15;
		const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

		const slot = document.createElement('div');
		slot.className = 'slot h-2 bg-gray-200';
		slot.style.width = '50px';
		slot.dataset.time = timeStr;

		const label = document.createElement('div');
		label.className = 'text-xs mt-1';
		if (minute === 0) {
			label.textContent = `${hour}:00`;
			label.classList.add('font-bold', 'text-gray-700');
		} else {
			label.textContent = `${minute}`;
			label.classList.add('text-gray-500');
		}

		const container = document.createElement('div');
		container.className = 'flex flex-col items-center';
		container.appendChild(slot);
		container.appendChild(label);

		timeline.appendChild(container);
	}
}

function timeToIndex(timeStr) {
	const [hour, minute] = timeStr.split(':').map(Number);
	return (hour - 8) * 4 + minute / 15;
}

async function renderReservations(car, date) {
	document.querySelectorAll('.slot').forEach((slot) => {
		slot.classList.replace('bg-gray-800', 'bg-gray-200');
	});

	const snapshot = await db
		.collection('cars_reservations')
		.where('car', '==', car)
		.where('date', '==', date)
		.orderBy('starttime')
		.get();

	snapshot.forEach((doc) => {
		const data = doc.data();
		const startIdx = timeToIndex(data.starttime);
		const endIdx = timeToIndex(data.endtime);
		for (let i = startIdx; i < endIdx; i++) {
			const slot = timeline.children[i]?.querySelector('.slot');
			if (slot) slot.classList.replace('bg-gray-200', 'bg-gray-800');
		}
	});

	return snapshot.size;
}

// 🚗 requestAnimationFrame で scrollを最適化
const timelineContainer = timeline.parentElement;
const car = document.getElementById('cars');
let lastScrollX = 0;
let ticking = false;

function updateCar(scrollX) {
	const OFFSET = 25;
	const direction = scrollX > lastScrollX ? -1 : 1;
	const index = Math.floor((scrollX + OFFSET) / 50);
	const slotContainer = timeline.children[index];
	const slot = slotContainer ? slotContainer.querySelector('.slot') : null;

	let translateY = 0;
	let opacity = 1;

	if (!(slot && slot.classList.contains('bg-gray-800'))) {
		translateY = 10;
		opacity = 0.3;
	}

	car.style.left = '10px';
	car.style.transform = `translateX(${scrollX}px) translateY(${translateY}px) scaleX(${direction})`;
	car.style.opacity = opacity;

	lastScrollX = scrollX;
	ticking = false;
}

timelineContainer.addEventListener('scroll', () => {
	const scrollX = timelineContainer.scrollLeft;

	if (!ticking) {
		requestAnimationFrame(() => updateCar(scrollX));
		ticking = true;
	}
});

// 🔥 検索ボタン
document.getElementById('searchBtn').addEventListener('click', async () => {
	const date = document.getElementById('selectedDate').value;
	const carType = document.getElementById('selectedCar').value;

	const count = await renderReservations(carType, date);
	if (count === 0) {
		car.style.display = 'none';
	} else {
		car.style.display = 'block';
	}
});

buildTimeline();
