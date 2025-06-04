// document.getElementById('list-date').addEventListener('change', (e) => {
// 	const dateStr = e.target.value;
// 	renderRoomWiseList(dateStr);
// });
window.addEventListener('load', () => {
	const today = new Date().toISOString().split('T')[0];
	document.getElementById('list-date').value = today;
	renderRoomWiseList(today);
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
		const listEl = document.getElementById(`list-room-${roomKey}`);
		listEl.innerHTML = '';
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
				const listEl = document.getElementById(`list-room-${roomKey}`);
				const filtered = roomGrouped[roomKey].sort((a, b) => a.start.localeCompare(b.start));

				if (filtered.length === 0) {
					const li = document.createElement('li');
					li.textContent = '（予約なし）';
					li.className = 'text-gray-400';
					listEl.appendChild(li);
					return;
				}

				filtered.forEach((res) => {
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
					listEl.appendChild(li);
				});
			});
		});
}
