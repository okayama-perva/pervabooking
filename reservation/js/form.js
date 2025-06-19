// ✅ 予約フォーム関連処理（form.js）
// 会議室（room1〜3）を選択
function selectRoom(room) {
	document.getElementById('room').value = room;

	// 🔁 会議室毎のボタンスタイルを定義
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

// 予約の処理
async function reserve() {
	const reserveBtn = document.getElementById('reserveBtn');
	if (reserveBtn.disabled) return; // 二重送信防止

	// 🔒 二重送信防止：ボタン無効化＋表示切り替え
	reserveBtn.disabled = true;
	const originalText = reserveBtn.innerText;
	reserveBtn.innerText = '予約中...';

	// 🔄 入力値の取得
	const room = document.getElementById('room')?.value;
	const date = document.getElementById('list-date')?.value;
	const startTime = document.getElementById('start_time')?.value;
	const endTime = document.getElementById('end_time')?.value;
	const memo = document.getElementById('memo')?.value || '';

	// 🔄 必須項目の確認
	if (!room || !date || !startTime || !endTime) {
		alert('すべての項目を入力してください。');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}
	// 時間のチェック
	if (startTime >= endTime) {
		alert('終了時間は開始時間より後にしてください。');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}

	// 🗓️ 時間をフォーマットを定義
	const start = `${date} ${startTime}`;
	const end = `${date} ${endTime}`;
	// Firestoreの予約済み時間帯をチェック
	const snapshot = await db.collection('reservations').where('room', '==', room).where('date', '==', date).get();
	const overlap = snapshot.docs.some((doc) => {
		const data = doc.data();
		return !(end <= data.start || start >= data.end);
	});
	// 重複していたら処理中断
	if (overlap) {
		alert('この時間帯はすでに予約があります！');
		reserveBtn.disabled = false;
		reserveBtn.innerText = originalText;
		return;
	}

	// 🧾 各種データ取得
	const uid = auth.currentUser.uid;
	const userDoc = await db.collection('users').doc(uid).get();
	const username = userDoc.exists ? userDoc.data().username : '未登録';
	const roomNames = {
		room1: '会議室',
		room2: '個室',
		room3: '商談室',
	};
	const roomName = roomNames[room] || room; // カレンダー送信用に変換
	const roomColorMap = {
		room1: '9', // 青
		room2: '10', // 緑
		room3: '3', // 紫
	};
	const colorId = roomColorMap[room] || '9';

	// Googleカレンダーに登録
	let eventId = null;
	const formData = new URLSearchParams();
	formData.append('summary', `${roomName}｜${selectedType}｜${username}`);
	formData.append('description', memo || '（メモなし）');
	formData.append('start', `${date}T${startTime}:00+09:00`);
	formData.append('end', `${date}T${endTime}:00+09:00`);
	formData.append('location', roomName);
	formData.append('colorId', colorId);

	// 例外処理：Googleカレンダー登録
	try {
		const res = await fetch(
			'https://script.google.com/macros/s/AKfycbxBkBNGAtYkXxjcQftVzzo9HjoEWPnXoGFCbSMypi7cLKGbCZk6BnNiU8XVVl0ADviPKw/exec',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: formData,
			}
		);

		const data = await res.json();
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
			createdAt: new Date(),
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
			colorId,
		});
		return;
	}
	// 登録時間をFirestoreに保存
	const createdAt = new Date();

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
		createdAt,
		colorId,
	});

	alert('予約が完了しました！');
	reserveBtn.disabled = false;
	reserveBtn.innerText = originalText;
	renderRoomWiseList(date);
	loadReservedRanges(room, date); // 予約済み時間帯を更新
}
