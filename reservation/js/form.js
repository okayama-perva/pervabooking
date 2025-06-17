// ✅ 予約フォーム関連処理（form.js）
// 会議室（room1〜3）を選択
function selectRoom(room) {
	document.getElementById('room').value = room;

	const roomColorMap = {
		room1: ['bg-blue-100', 'text-blue-800'],
		room2: ['bg-green-100', 'text-green-800'],
		room3: ['bg-purple-100', 'text-purple-800'],
	};
	// 🔁 ボタンのスタイルをリセット
	['room1', 'room2', 'room3'].forEach((r) => {
		const btn = document.getElementById(`room-${r}`);
		btn.classList.remove(
			'bg-blue-100',
			'text-blue-800',
			'bg-green-100',
			'text-green-800',
			'bg-purple-100',
			'text-purple-800',
			'font-bold'
		);
	});

	const selectedBtn = document.getElementById(`room-${room}`);
	selectedBtn.classList.add(...roomColorMap[room], 'font-bold');

	// 🔁 特定の会議室ではZOOMのみ表示
	if (room === 'room2' || room === 'room3') {
		// 🔽 ボタン表示切り替え
		document.getElementById('tab-社内').style.display = 'none';
		document.getElementById('tab-来客').style.display = 'none';
		document.getElementById('tab-ZOOM').style.display = 'inline-block';
		// 🔽 少し遅らせてクラス付与
		setTimeout(() => selectType('ZOOM'), 0);
	} else {
		document.getElementById('tab-社内').style.display = 'inline-block';
		document.getElementById('tab-来客').style.display = 'inline-block';
		document.getElementById('tab-ZOOM').style.display = 'inline-block';

		selectType('社内');
	}

	// 🔄 選択された会議室・日付に応じて予約済み時間を更新
	const date = document.getElementById('list-date').value;
	loadReservedRanges(room, date);
}

// タイプの初期値
let selectedType = '社内';
// タイプのスタイルをリセット
function selectType(type) {
	selectedType = type;
	['社内', '来客', 'ZOOM'].forEach((t) => {
		const btn = document.getElementById(`tab-${t}`);
		btn.classList.remove(
			'bg-blue-100',
			'bg-green-100',
			'bg-purple-100',
			'text-blue-800',
			'text-green-800',
			'text-purple-800',
			'font-bold'
		);
	});
	// 選択されたタイプのボタンにスタイルを適用
	const selectedBtn = document.getElementById(`tab-${type}`);
	selectedBtn.classList.add('bg-blue-100', 'font-bold');
}


// 下記削除予定
// function generateTimeOptions() {削除予定
// 	const startSelect = document.getElementById('start_time');
// 	const endSelect = document.getElementById('end_time');

// 	// 7:00〜22:00までの範囲（30分刻み）
// 	for (let h = 7; h <= 22; h++) {
// 		for (let m of [0, 30]) {
// 			const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// 			const option1 = document.createElement('option');
// 			const option2 = document.createElement('option');
// 			option1.value = option1.textContent = time;
// 			option2.value = option2.textContent = time;
// 			startSelect.appendChild(option1);
// 			endSelect.appendChild(option2);
// 		}
// 	}
// }

// document.getElementById('start_time').addEventListener('change', function () {
// 	const selectedStart = this.value;
// 	const endSelect = document.getElementById('end_time');
// 	const currentEnd = endSelect.value;

// 	endSelect.innerHTML = '';

// 	// 先頭に空の選択肢（比較対象にならない）
// 	const emptyOption = document.createElement('option');
// 	emptyOption.value = '';
// 	emptyOption.textContent = '';
// 	endSelect.appendChild(emptyOption);

// 	for (let h = 7; h <= 22; h++) {
// 		for (let m of [0, 30]) {
// 			const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// 			if (time > selectedStart) {
// 				const option = document.createElement('option');
// 				option.value = option.textContent = time;
// 				endSelect.appendChild(option);
// 			}
// 		}
// 	}

// 	if (currentEnd > selectedStart) {
// 		endSelect.value = currentEnd;
// 	}
// });

// document.getElementById('end_time').addEventListener('change', function () {
// 	const selectedEnd = this.value;
// 	const startSelect = document.getElementById('start_time');
// 	const currentStart = startSelect.value;

// 	startSelect.innerHTML = '';

// 	const emptyOption = document.createElement('option');
// 	emptyOption.value = '';
// 	emptyOption.textContent = '';
// 	startSelect.appendChild(emptyOption);

// 	for (let h = 7; h <= 22; h++) {
// 		for (let m of [0, 30]) {
// 			const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// 			if (time < selectedEnd) {
// 				const option = document.createElement('option');
// 				option.value = option.textContent = time;
// 				startSelect.appendChild(option);
// 			}
// 		}
// 	}

// 	if (currentStart < selectedEnd) {
// 		startSelect.value = currentStart;
// 	}
// });
// 



async function reserve() {
	const reserveBtn = document.getElementById('reserveBtn');
	if (reserveBtn.disabled) return; // 二重送信防止
	// ボタンの表示切替＆無効化
	reserveBtn.disabled = true;
	const originalText = reserveBtn.innerText;
	reserveBtn.innerText = '予約中...';

	const room = document.getElementById('room')?.value;
	const date = document.getElementById('list-date')?.value;
	const startTime = document.getElementById('start_time')?.value;
	const endTime = document.getElementById('end_time')?.value;
	const memo = document.getElementById('memo')?.value || '';

	if (!room || !date || !startTime || !endTime) {
		alert('すべての項目を入力してください。');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}

	if (startTime >= endTime) {
		alert('終了時間は開始時間より後にしてください。');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}

	const start = `${date} ${startTime}`;
	const end = `${date} ${endTime}`;

	const snapshot = await db.collection('reservations').where('room', '==', room).where('date', '==', date).get();

	const overlap = snapshot.docs.some((doc) => {
		const data = doc.data();
		return !(end <= data.start || start >= data.end);
	});

	if (overlap) {
		alert('この時間帯はすでに予約があります！');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}
	const roomNames = {
		room1: '会議室',
		room2: '個室',
		room3: '商談室',
	};

	const roomName = roomNames[room] || room; // カレンダー送信用に変換

	const uid = auth.currentUser.uid;
	const userDoc = await db.collection('users').doc(uid).get();
	const username = userDoc.exists ? userDoc.data().username : '未登録';

	// Googleカレンダーに登録
	const formData = new URLSearchParams();
	formData.append('summary', `${roomName}｜${selectedType}｜${username}`);
	formData.append('description', memo || '（メモなし）');
	formData.append('start', `${date}T${startTime}:00+09:00`);
	formData.append('end', `${date}T${endTime}:00+09:00`);
	formData.append('location', roomName);

	let eventId = null;

	try {
		const res = await fetch(
			'https://script.google.com/macros/s/AKfycbwmG-VtaC9ZThK-RIr0U8y35_CQyNKAP8RHkY5tKACo3xZjuRb0hPvx43Hg0WpABY-n8g/exec',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: formData,
			}
		);

		const data = await res.json();
		// console.log('✅ 登録結果:', data);

		if (data.status === 'success') {
			eventId = data.eventId;
		} else {
			throw new Error('Googleカレンダー登録失敗');
		}
	} catch (err) {
		// console.error('❌ Googleカレンダー登録エラー:', err);
		alert('Googleカレンダーへの登録に失敗しました');
		// エラー発生時はボタン復元
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		// 失敗ログを保存
		await db.collection('error_logs').add({
			timestamp: new Date().toISOString().replace('Z', '+09:00'),
			uid,
			username,
			room,
			date,
			start,
			end,
			memo,
			errorMessage: err.message,
			stage: 'Googleカレンダー登録',
			formData: Object.fromEntries(formData.entries()), // 送信内容を確認用に保存
		});

		console.error(err.message); // optional
		return;
	}
	// 登録時間をFirestoreに保存
	const createdAt = new Date();

	// 日本時間 (UTC+9) に変換
	const jstDate = new Date(createdAt.getTime() + 9 * 60 * 60 * 1000);

	// ISO形式にして "Z"（UTC）を削除し、代わりに "+09:00" を付ける
	const jstISOString = jstDate.toISOString().replace('Z', '+09:00');

	await db.collection('reservations').add({
		uid,
		username,
		type: selectedType,
		room,
		date,
		start,
		end,
		memo,
		eventId, // カレンダー登録成功時に取得したIDを保存
		jstISOString,
	});

	alert('予約が完了しました！');
	reserveBtn.disabled = false;
	reserveBtn.innerText = originalText;
	renderRoomWiseList(date);
	loadReservedRanges(room, date); // 予約済み時間帯を更新
}
