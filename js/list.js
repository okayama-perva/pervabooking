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

// window.addEventListener('load', syncListWithReservationDate);
function renderRoomWiseList(dateStr) {
	document.getElementById('list-date').value = dateStr;
	const uid = auth.currentUser?.uid;
	if (!uid) return;

	const roomMap = {
		room1: 'A',
		room2: 'B',
		room3: 'C',
	};

	// 3部屋分の表示エリアをリセット
	['A', 'B', 'C'].forEach((roomKey) => {
		const listEls = [
			document.getElementById(`list-room-${roomKey}`),
			document.getElementById(`list-room-${roomKey}-mobile`),
		];
		listEls.forEach((el) => {
			if (el) el.innerHTML = '';
		});
	});

	// データ取得
	db.collection('reservations')
		.where('date', '==', dateStr)
		.get()
		.then((snapshot) => {
			const reservations = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));

			// 各予約を部屋ごとに分ける
			const roomGrouped = { A: [], B: [], C: [] };
			reservations.forEach((res) => {
				const key = roomMap[res.room];
				if (key) roomGrouped[key].push(res);
			});

			['A', 'B', 'C'].forEach((roomKey) => {
				const listEls = [
					// document.getElementById(`list-room-${roomKey}`),
					document.getElementById(`list-room-${roomKey}-mobile`),
				];
				listEls.forEach((el) => {
					if (el) el.innerHTML = '';
				});
				const filtered = roomGrouped[roomKey].sort((a, b) => a.start.localeCompare(b.start));

				if (filtered.length === 0) {
					listEls.forEach((el) => {
						if (!el) return;
						const li = document.createElement('li');
						li.textContent = '（予約なし）';
						li.className = 'text-gray-400';
						el.appendChild(li);
					});
					return;
				}

				filtered.forEach((res) => {
					renderReservationItem(res, roomKey, uid);
					const li = document.createElement('li');
					li.className =
						'bg-gray-50 border border-gray-200 p-2 rounded text-sm flex justify-between items-start';

					const time = `${res.start.split(' ')[1]}〜${res.end.split(' ')[1]}`;
					const who = res.uid === uid ? '自分' : res.username;

					const contentDiv = document.createElement('div');
					contentDiv.className = 'flex-grow';
					contentDiv.innerHTML = `<div>${time}<br>${res.type}（${who}）</div>`;

					// メモの追加（任意）
					if (res.memo) {
						const maxLength = 100;
						const shortMemo = res.memo.length > maxLength ? res.memo.slice(0, maxLength) + '…' : res.memo;

						const memo = document.createElement('div');
						memo.className = 'text-xs text-gray-500 italic mt-1 break-all';
						memo.textContent = `メモ：${shortMemo}`;
						memo.title = res.memo; // ツールチップ表示用
						// ツールチップ表示のために title 属性を設定
						memo.style.cursor = 'pointer';
						memo.onmousemove = () => {
							// メモの全文を表示
							memo.textContent = `メモ：${res.memo}`;
						};
						// ショートメモに戻す
						memo.onmouseleave = () => {
							memo.textContent = `メモ：${shortMemo}`;
						};
						contentDiv.appendChild(memo);
					}

					// 🔥 削除ボタンの生成
					const delBtn = document.createElement('button');
					delBtn.textContent = '🗑️';
					delBtn.className =
						'text-xs p-1 ml-2 border rounded hover:text-red-600 hover:border-red-400 transition';
					delBtn.onclick = async () => {
						if (delBtn.disabled) return; // 二重削除防止

						if (confirm('この予約を削除しますか？')) {
							// 二重クリック防止＆表示変更
							delBtn.disabled = true;
							const originalText = delBtn.textContent;
							delBtn.textContent = '削除中...';

							try {
								// 🔥 Googleカレンダー削除APIを呼ぶ（eventId が存在すれば）
								if (res.eventId) {
									const deleteForm = new URLSearchParams();
									deleteForm.append('eventId', res.eventId);
									deleteForm.append('action', 'delete');

									await fetch(
										'https://script.google.com/macros/s/AKfycbwnkIPQyhamSHVxQFc1AlKtQ9Z-jnSArZoGmR52idARY1eOYPjPef3iBHMhxxzwEnt4rA/exec',
										{
											method: 'POST',
											headers: {
												'Content-Type': 'application/x-www-form-urlencoded',
											},
											body: deleteForm,
										}
									);
								}

								// Firestoreから削除
								await db.collection('reservations').doc(res.id).delete();
								renderRoomWiseList(dateStr);
							} catch (err) {
								console.error('❌ 削除中にエラーが発生:', err);
								alert('削除に失敗しました');

								// エラー時：ボタンを復元
								delBtn.disabled = false;
								delBtn.textContent = originalText;
							}
						}
					};

					// 自分の予約だけ強調表示
					if (res.uid === uid) {
						li.classList.add('bg-yellow-50', 'border-yellow-300', 'font-bold', 'text-yellow-800');
					}

					li.appendChild(contentDiv);
					li.appendChild(delBtn);
					listEls.forEach((el) => {
						if (el) el.appendChild(li.cloneNode(true));
					});
				});
			});
		});
}
// PC版のリスト表示のみ
function renderReservationItem(res, roomKey, uid) {
	const ul = document.getElementById(`list-room-${roomKey}`);
	if (!ul) return;

	// 🕒 時間から top / height を計算
	const startParts = res.start.split(' ')[1].split(':');
	const endParts = res.end.split(' ')[1].split(':');
	const startHour = parseInt(startParts[0]) + parseInt(startParts[1]) / 60;
	const endHour = parseInt(endParts[0]) + parseInt(endParts[1]) / 60;

	const top = (startHour - 7) * 84;
	const height = (endHour - startHour) * 84;

	// 📦 予約ブロック要素
	const li = document.createElement('li');
	li.className = 'absolute left-1 right-1 bg-gray-50 border border-gray-300 rounded p-2 text-xs shadow';
	li.style.top = `${top}px`;
	li.style.height = `${height}px`;
	li.style.overflow = 'hidden';

	// 👤 誰の予約？
	const who = res.uid === uid ? '自分' : res.username;
	const time = `${startParts[0]}:${startParts[1]}〜${endParts[0]}:${endParts[1]}`;

	// 💬 メモ（あれば）
	let memoHtml = '';
	if (res.memo) {
		const short = res.memo.length > 50 ? res.memo.slice(0, 50) + '…' : res.memo;
		memoHtml = `<div class="text-gray-500 italic mt-1 break-all" title="${res.memo}">メモ：${short}</div>`;
	}

	// 🔸 中身のHTML
	li.innerHTML = `
		<div class="text-[11px] font-bold">${time}</div>
		<div class="text-[13px] font-semibold">${res.type}（${who}）</div>
		${memoHtml}
	`;

	// ✨ 自分の予約は強調色に
	if (res.uid === uid) {
		li.classList.add('bg-yellow-50', 'border-yellow-300', 'text-yellow-800');
	}

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

			console.log(`クリック：部屋${roomKey}、時間${timeStr}`);

			// 🔻 ここはあなたのフォームIDに置き換えてください
			document.getElementById('room-select').value = roomKey;
			document.getElementById('start-time').value = timeStr;
		});
	});
}
