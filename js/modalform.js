// 定例予約のモーダルフォームを開くためのイベントリスナー
document.getElementById('openRepeatModal').addEventListener('click', () => {
	document.getElementById('repeatModal').classList.remove('hidden');
});
// 定例予約のモーダルフォームを閉じるためのイベントリスナー
document.getElementById('closeRepeatModal').addEventListener('click', () => {
	document.getElementById('repeatModal').classList.add('hidden');
});
// 曜日チェックボックスの整理
function getSelectedWeekdays() {
	const checkboxes = document.querySelectorAll('input[name="repeat-weekday"]:checked');
	return Array.from(checkboxes).map((cb) => parseInt(cb.value));
}
// 日付選択
document.addEventListener('DOMContentLoaded', () => {
	const startSelect = document.getElementById('repeat-start');
	const endSelect = document.getElementById('repeat-end');

	for (let h = 7; h <= 20; h++) {
		for (let m of [0, 30]) {
			const hh = String(h).padStart(2, '0');
			const mm = m === 0 ? '00' : '30';
			const timeStr = `${hh}:${mm}`;
			const option1 = new Option(timeStr, timeStr);
			const option2 = new Option(timeStr, timeStr);
			startSelect.appendChild(option1);
			endSelect.appendChild(option2);
		}
	}

	// 初期値
	startSelect.value = '10:00';
	endSelect.value = '11:00';
});

// 定例予約の登録ボタンにイベントリスナーを追加
async function registerRepeatReservation() {
	const title = document.getElementById('repeat-title')?.value.trim();
	const room = document.getElementById('repeat-room')?.value;
	const weekdays = getSelectedWeekdays();
	const timeFrom = document.getElementById('repeat-start')?.value;
	const timeTo = document.getElementById('repeat-end')?.value;
	const months = parseInt(document.getElementById('repeat-months')?.value);
	const memo = document.getElementById('repeat-memo')?.value.trim();
	// const excludeHoliday = document.getElementById('repeat-exclude-holiday')?.checked;
	// 入力チェック
	if (!title || !room || weekdays.length === 0 || !timeFrom || !timeTo || !months) {
		alert('すべての項目を入力してください');
		return;
	}
	// 時間のバリデーション
	if (timeFrom >= timeTo) {
		alert('開始時間は終了時間より前にしてください');
		return;
	}

	// 予約ユーザー情報
	const uid = auth.currentUser.uid;
	const userDoc = await db.collection('users').doc(uid).get();
	const username = userDoc.exists ? userDoc.data().username : '未登録';

	// excludeHoliday = excludeHoliday || false; // チェックボックスの値を取得

	// グループIDの生成（タイムスタンプ＋ランダム）
	const repeatGroupId = `grp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

	//以降の処理へ進む
	await saveRepeatGroupAndReservations({
		title,
		room,
		weekdays,
		timeFrom,
		timeTo,
		months,
		memo,
		// excludeHoliday,
		uid,
		username,
		repeatGroupId,
	});
}

// 定例予約の保存と予約登録処理
async function saveRepeatGroupAndReservations({
	title,
	room,
	weekdays,
	timeFrom,
	timeTo,
	months,
	memo,
	uid,
	username,
	repeatGroupId,
}) {
	const now = new Date();
	const createdAt = now.toISOString().replace('Z', '+09:00');
	const reservations = [];

	for (let i = 0; i < months; i++) {
		const targetDate = new Date(now);
		targetDate.setMonth(now.getMonth() + i);

		const year = targetDate.getFullYear();
		const month = targetDate.getMonth();
		const lastDay = new Date(year, month + 1, 0).getDate();

		for (let d = 1; d <= lastDay; d++) {
			const date = new Date(year, month, d);
			if (date < now) continue;
			if (!weekdays.includes(date.getDay())) continue;

			const ymd = date.toISOString().split('T')[0];
			const start = `${ymd} ${timeFrom}`;
			const end = `${ymd} ${timeTo}`;

			// ▼ 重複チェック
			const snapshot = await db
				.collection('reservations')
				.where('room', '==', room)
				.where('date', '==', ymd)
				.get();

			const overlap = snapshot.docs.some((doc) => {
				const data = doc.data();
				return !(end <= data.start || start >= data.end);
			});
			if (overlap) continue;

			reservations.push({ ymd, start, end });
		}
	}

	// 🔍 ログで確認
	console.log('📝 作成予定の定例予約:', {
		title,
		room,
		weekdays,
		timeFrom,
		timeTo,
		months,
		memo,
		createdAt,
		uid,
		username,
		repeatGroupId,
		count: reservations.length,
	});
	console.log('📅 作成予定の予約一覧:', reservations);

	// 🔕 以下は本番時のみ有効に
	// await db.collection('repeatGroups').doc(repeatGroupId).set({...});
	// for (const r of reservations) {
	//     const eventId = await registerGoogleCalendarEvent({...});
	//     await db.collection('reservations').add({...});
	// }

	alert('※ 登録は行われていません（テストモード）');
}

// Googleカレンダーに登録する関数
async function registerGoogleCalendarEvent({ room, username, type, start, end, date, memo }) {
	const roomNames = {
		room1: '会議室',
		room2: '個室',
		room3: '商談室',
	};
	const roomName = roomNames[room] || room;

	const formData = new URLSearchParams();
	formData.append('summary', `${roomName}｜${type}｜${username}`);
	formData.append('description', memo || '（メモなし）');
	formData.append('start', `${date}T${start.split(' ')[1]}:00+09:00`);
	formData.append('end', `${date}T${end.split(' ')[1]}:00+09:00`);
	formData.append('location', roomName);

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
		if (data.status === 'success') {
			return data.eventId;
		} else {
			console.error('Googleカレンダー登録失敗:', data);
			return null;
		}
	} catch (err) {
		console.error('❌ Googleカレンダー登録エラー:', err);
		return null;
	}
}

// リストの表示
async function renderRepeatGroups() {
	const list = document.getElementById('repeat-list');
	list.innerHTML = ''; // 初期化

	const snapshot = await db.collection('repeatGroups').orderBy('createdAt', 'desc').get();
	if (snapshot.empty) {
		list.innerHTML = '<p class="text-gray-500">登録された定例予約はありません。</p>';
		return;
	}

	snapshot.forEach((doc) => {
		const data = doc.data();
		const div = document.createElement('div');
		div.className = 'border p-3 rounded shadow-sm flex justify-between items-center';
		div.innerHTML = `
      <div>
        <div class="font-bold">${data.title}</div>
        <div class="text-sm text-gray-600">${data.weekday}曜日 ${data.startTime}〜${data.endTime}</div>
        <div class="text-xs text-gray-400">期間: ${data.startDate} 〜 ${data.endDate}</div>
      </div>
      <button onclick="deleteRepeatGroup('${doc.id}')" class="text-red-600 hover:underline text-sm">🗑️ 削除</button>
    `;
		list.appendChild(div);
	});
}

// 一括削除の関数
async function deleteRepeatGroup(groupId) {
	if (!confirm('この定例予約と関連するすべての予約を削除しますか？')) return;

	// repeatGroupIdを持つ予約を取得
	const snapshot = await db.collection('reservations').where('repeatGroupId', '==', groupId).get();

	// Googleカレンダー削除処理
	for (const doc of snapshot.docs) {
		const data = doc.data();
		if (data.eventId) {
			const form = new URLSearchParams();
			form.append('eventId', data.eventId);
			form.append('action', 'delete');
			await fetch(
				'https://script.google.com/macros/s/AKfycbwEn021D7zcfUqcYA5HREjqYZiRLQ-uEx8yxHgBGwdZCBhsRP748DK3qZFCtz6sAf3g3Q/exec',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: form,
				}
			);
		}
		// Firestoreから予約削除
		await doc.ref.delete();
	}

	// グループ自体を削除
	await db.collection('repeatGroups').doc(groupId).delete();

	alert('定例予約を削除しました。');
	renderRepeatGroups(); // リスト更新
	renderRoomWiseList(document.getElementById('list-date').value); // 予約リスト再描画
}
