// document.getElementById('list-date').addEventListener('change', (e) => {
// 	const dateStr = e.target.value;
// 	renderRoomWiseList(dateStr);
// });
window.addEventListener('load', () => {
	const today = new Date().toISOString().split('T')[0];
	document.getElementById('list-date').value = today;
	renderRoomWiseList(today);
	setupClickListeners();
});
function renderRoomWiseList(dateStr) {
	document.getElementById('list-date').value = dateStr;
	const uid = auth.currentUser?.uid;
	if (!uid) return;

	const roomMap = { room1: 'A', room2: 'B', room3: 'C' };

	// リスト初期化（PC + モバイル）
	['A', 'B', 'C'].forEach((roomKey) => {
		const listEls = [
			document.getElementById(`list-room-${roomKey}`),
			document.getElementById(`list-room-${roomKey}-mobile`),
		];
		listEls.forEach((el) => {
			if (el) el.innerHTML = '';
		});
	});

	db.collection('reservations')
		.where('date', '==', dateStr)
		.get()
		.then((snapshot) => {
			const reservations = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			const roomGrouped = { A: [], B: [], C: [] };
			reservations.forEach((res) => {
				const key = roomMap[res.room];
				if (key) roomGrouped[key].push(res);
			});

			['A', 'B', 'C'].forEach((roomKey) => {
				const filtered = roomGrouped[roomKey].sort((a, b) => a.start.localeCompare(b.start));
				const pcList = document.getElementById(`list-room-${roomKey}`);
				const mobileList = document.getElementById(`list-room-${roomKey}-mobile`);
				const ul = document.getElementById(`list-room-${roomKey}`);
				if (ul) {
					ul.style.height = `${50 * 26}px`; // 7:00〜20:00 の30分刻み = 26コマ
				}

				// PC表示の空セル（時間帯）を生成クリックすると予約に反映
				if (pcList) {
					pcList.style.position = 'relative'; // 絶対配置に対応
					for (let time = 7; time <= 19.5; time += 0.5) {
						const hour = Math.floor(time);
						const minute = time % 1 === 0 ? '00' : '30';
						const timeStr = `${String(hour).padStart(2, '0')}:${minute}`;

						const emptyDiv = document.createElement('div');
						emptyDiv.className =
							'relative h-[50px] cursor-pointer hover:bg-blue-50 border-t border-gray-200'; // 1時間→84pxだったので半分に
						emptyDiv.dataset.room = roomKey;
						emptyDiv.dataset.time = timeStr;
						emptyDiv.title = `${timeStr} の予約する`;

						emptyDiv.onclick = () => {
							// 🔹部屋選択
							document.getElementById('room').value = `room${
								roomKey === 'A' ? 1 : roomKey === 'B' ? 2 : 3
							}`;
							selectRoom(`room${roomKey === 'A' ? 1 : roomKey === 'B' ? 2 : 3}`);

							// 🔹内容（type）自動選択 ←★ ここを追加
							const type = roomKey === 'A' ? '社内' : 'ZOOM';
							selectType(type); // ←既存の関数を使って選択状態を更新

							// 🔹日付反映
							document.getElementById('list-date').value = dateStr;

							// ✅ 時刻数値化
							const [h, m] = timeStr.split(':').map(Number);
							const from = h + (m === 30 ? 0.5 : 0);
							const to = from + 1.0;

							// ✅ スライダーに反映
							const sliderInstance = $('#time-slider').data('ionRangeSlider');
							sliderInstance.update({
								from,
								to,
							});

							// ✅ start_time, end_time にも反映（保険）
							// updateTimeFields(from, to);

							// 🔹メモ欄を初期化
							document.getElementById('memo').value = '';

							// 🔹予約タイプを初期化（必要に応じて）
							selectType('社内'); // デフォルト値があるなら明示的に

							alert(`部屋: ${roomKey}、開始時間: ${timeStr} に設定しました`);
						};

						pcList.appendChild(emptyDiv);
					}
				}

				if (filtered.length === 0) {
					[pcList, mobileList].forEach((el) => {
						if (!el) return;
						const li = document.createElement('li');
						// li.textContent = '（予約なし）';
						li.className = 'text-gray-400';
						el.appendChild(li);
					});
					return;
				}

				filtered.forEach((res) => {
					// PC表示（縦位置予約）
					if (pcList) renderReservationItem(res, roomKey, uid);

					// モバイル表示
					if (!mobileList) return;
					const li = document.createElement('li');
					li.className =
						'bg-gray-50 border border-gray-200 p-2 rounded text-sm flex justify-between items-start flex-col';
					if (res.uid === uid) {
						li.classList.add('bg-yellow-50', 'border-yellow-300', 'font-bold', 'text-yellow-800');
					}

					const time = `${res.start.split(' ')[1]}〜${res.end.split(' ')[1]}`;
					const who = res.uid === uid ? '自分' : res.username;

					const contentDiv = document.createElement('div');
					contentDiv.className = 'flex-grow';
					contentDiv.innerHTML = `<div>${time}<br>${res.type}（${who}）</div>`;

					if (res.memo) {
						const memo = document.createElement('div');
						memo.className = 'text-xs text-gray-500 italic mt-1 break-all';
						memo.textContent = `メモ：${res.memo}`;
						contentDiv.appendChild(memo);
					}

					li.appendChild(contentDiv);

					const delBtn = document.createElement('button');
					delBtn.textContent = '🗑️';
					delBtn.className =
						'text-xs mt-1 px-2 py-1 border rounded hover:text-red-600 hover:border-red-400 transition self-end';
					delBtn.onclick = async () => {
						if (delBtn.disabled) return;
						if (!confirm('この予約を削除しますか？')) return;

						delBtn.disabled = true;
						const original = delBtn.textContent;
						delBtn.textContent = '削除中...';

						try {
							if (res.eventId) {
								const deleteForm = new URLSearchParams();
								deleteForm.append('eventId', res.eventId);
								deleteForm.append('action', 'delete');
								await fetch(
									'https://script.google.com/macros/s/AKfycbwnkIPQyhamSHVxQFc1AlKtQ9Z-jnSArZoGmR52idARY1eOYPjPef3iBHMhxxzwEnt4rA/exec',
									{
										method: 'POST',
										headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
										body: deleteForm,
									}
								);
							}
							await db.collection('reservations').doc(res.id).delete();
							renderRoomWiseList(dateStr);
						} catch (err) {
							console.error('❌ モバイル削除失敗:', err);
							alert('削除に失敗しました');
							delBtn.disabled = false;
							delBtn.textContent = original;
						}
					};
					li.appendChild(delBtn);

					mobileList.appendChild(li);
				});
			});
		});
}

function renderReservationItem(res, roomKey, uid) {
	const ul = document.getElementById(`list-room-${roomKey}`);
	if (!ul) return;

	// 🕒 時間から top / height を計算
	const startParts = res.start.split(' ')[1].split(':');
	const endParts = res.end.split(' ')[1].split(':');
	const startHour = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
	const endHour = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;
	const marginY = 5; // 上下のマージン（px）

	const top = (startHour - 7) * 100 + marginY; // 7:00を基準に計算
	const height = (endHour - startHour) * 100 - marginY * 2;
	console.log(`予約時間: ${res.start} - ${res.end}, top: ${top}, height: ${height}`);

	// 📦 予約ブロック要素
	const li = document.createElement('li');
	li.className =
		'absolute left-1 right-1 bg-gray-50 border border-gray-300 rounded p-2 text-xs shadow overflow-y-auto overflow-x-hidden';
	li.style.top = `${top}px`;
	li.style.height = `${height}px`;

	// 👤 誰の予約？
	const who = res.uid === uid ? '自分' : res.username;
	const time = `${startParts[0]}:${startParts[1]}〜${endParts[0]}:${endParts[1]}`;

	// 💬 メモ（あれば）
	let memoHtml = '';
	if (res.memo) {
		memoHtml = `
			<div class="text-gray-500 italic mt-1 break-all max-h-[80px] overflow-y-auto text-[11px] leading-snug border-t pt-1">
				メモ：${res.memo}
			</div>
		`;
	}

	// 🧱 中身の div
	const contentDiv = document.createElement('div');
	contentDiv.innerHTML = `
		<div class="text-[11px] font-bold">${time}</div>
		<div class="text-[13px] font-semibold">${res.type}（${who}）</div>
		${memoHtml}
	`;

	// 🗑️ 削除ボタン（自分の予約のみ）

	const delBtn = document.createElement('button');
	delBtn.textContent = '🗑️';
	delBtn.className =
		'absolute top-1 right-1 text-xs bg-white border rounded px-1 hover:text-red-600 hover:border-red-400 transition';

	delBtn.onclick = async () => {
		if (delBtn.disabled) return;
		if (!confirm('この予約を削除しますか？')) return;

		delBtn.disabled = true;
		const original = delBtn.textContent;
		delBtn.textContent = '削除中...';

		try {
			// Googleカレンダー連携削除
			if (res.eventId) {
				const form = new URLSearchParams();
				form.append('eventId', res.eventId);
				form.append('action', 'delete');
				await fetch(
					'https://script.google.com/macros/s/AKfycbwnkIPQyhamSHVxQFc1AlKtQ9Z-jnSArZoGmR52idARY1eOYPjPef3iBHMhxxzwEnt4rA/exec',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: form,
					}
				);
			}

			// Firestoreから削除
			await db.collection('reservations').doc(res.id).delete();

			// 再描画
			renderRoomWiseList(document.getElementById('list-date').value);
		} catch (err) {
			console.error('❌ 削除エラー:', err);
			alert('削除に失敗しました');
			delBtn.disabled = false;
			delBtn.textContent = original;
		}
	};

	li.appendChild(delBtn);

	// 自分の予約は強調
	li.classList.add('bg-yellow-50', 'border-yellow-300', 'text-yellow-800', 'font-bold');

	li.appendChild(contentDiv);
	ul.appendChild(li);
}

function setupClickListeners() {
	['A', 'B', 'C'].forEach((roomKey) => {
		const ul = document.getElementById(`list-room-${roomKey}`);
		if (!ul) return;

		ul.addEventListener('click', (e) => {
			const rect = ul.getBoundingClientRect();
			const offsetY = e.clientY - rect.top;

			const hourFloat = 7 + offsetY / 84;
			const hour = Math.floor(hourFloat);
			const minute = hourFloat % 1 >= 0.5 ? 30 : 0;
			const timeStr = `${String(hour).padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;

			// 🔻 ここはあなたのフォームIDに置き換えてください
			document.getElementById('room').value = roomKey;
			document.getElementById('start_time').value = timeStr;
		});
	});
}
function onEmptyCellClick(roomKey, timeStr) {
	document.getElementById('room').value = roomKey;
	document.getElementById('start_time').value = timeStr;

	// 🔧 先に hour と minute を定義
	const [hour, minute] = timeStr.split(':').map(Number);
	const endHour = hour + 1;
	const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	document.getElementById('end_time').value = endTimeStr;

	// 🔁 スライダーにも反映
	const slider = document.getElementById('time-slider')?.noUiSlider;
	if (slider) {
		slider.set([hour, endHour]);
	}
}
