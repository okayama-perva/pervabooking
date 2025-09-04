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
	// ✅ 確認ダイアログ
	if (
		!confirm(
			'この内容で定例予約を登録しますか？登録には時間がかかります。モーダルで予約完了が出るまで操作しないでください。'
		)
	)
		return;
	// 🔒 他の操作を防ぐためにボタンを無効化
	const saveButton = document.querySelector('#repeatModal button.bg-blue-500');
	saveButton.disabled = true;
	saveButton.textContent = '登録中...';

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
	// console.log('📝 作成予定の定例予約:', {
	// 	title,
	// 	room,
	// 	weekdays,
	// 	timeFrom,
	// 	timeTo,
	// 	months,
	// 	memo,
	// 	createdAt,
	// 	uid,
	// 	username,
	// 	repeatGroupId,
	// 	count: reservations.length,
	// });
	// console.log('📅 作成予定の予約一覧:', reservations);

	// 🔕 以下は本番時のみ有効に
	await db.collection('repeatGroups').doc(repeatGroupId).set({
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
		createdAt,
		count: reservations.length,
	});
	for (const r of reservations) {
		const eventId = await registerGoogleCalendarEvent({
			room,
			username,
			type: '定例',
			start: r.start,
			end: r.end,
			date: r.ymd,
			memo,
		});
		await db.collection('reservations').add({
			title,
			room,
			type: '定例',
			start: r.start,
			end: r.end,
			date: r.ymd,
			memo,
			uid,
			username,
			repeatGroupId,
			eventId: eventId || null,
			createdAt,
		});
	}
	document.getElementById('repeatModal').classList.add('hidden');
	const saveButton = document.querySelector('#repeatModal button.bg-blue-500');
	// ✅ ボタン状態を元に戻す（必要なら）
	saveButton.disabled = false;
	saveButton.textContent = '登録';
	renderRepeatGroups();

	alert(`定例予約「${title}」を登録しました。${reservations.length}件の予約が作成されました。`);
}

// Googleカレンダーに登録する関数
async function registerGoogleCalendarEvent({ room, username, type, start, end, date, memo }) {
	const roomNames = {
		room1: '会議室',
		room2: '個室',
		room3: '商談室',
	};
	const roomName = roomNames[room] || room;
	const roomColorMap = {
		room1: '9', // 青
		room2: '10', // 緑
		room3: '3', // 紫
	};
	const colorId = roomColorMap[room] || '9';
	const formData = new URLSearchParams();
	formData.append('summary', `${roomName}｜${type}｜${username}`);
	formData.append('description', memo || '（メモなし）');
	formData.append('start', `${date}T${start.split(' ')[1]}:00+09:00`);
	formData.append('end', `${date}T${end.split(' ')[1]}:00+09:00`);
	formData.append('location', roomName);
	formData.append('colorId', colorId);

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

	let hasValidGroup = false;

	snapshot.forEach((doc) => {
		const data = doc.data();

		// 値が正しく存在するかチェック（防御的）
		if (!data.title || !data.timeFrom || !data.timeTo || !data.weekdays || !Array.isArray(data.weekdays)) {
			return; // スキップ
		}

		// 表示用の曜日
		const weekdaysStr = data.weekdays.map((n) => ['土','日', '月', '火', '水', '木', '金',][n]).join('・');

		const div = document.createElement('div');
		div.className = 'border p-3 rounded shadow-sm flex justify-between items-center';
		div.innerHTML = `
      <div>
        <div class="font-bold">${data.title}</div>
        <div class="text-sm text-gray-600">毎週 ${weekdaysStr}曜日 ${data.timeFrom}〜${data.timeTo}</div>
        <div class="text-xs text-gray-400">月数: ${data.months || '?'}ヶ月 / 登録数: ${data.count || 0}件</div>
		<div class="text-xs text-gray-500">登録者: ${data.username || '不明'} </div>
      </div>
      <button onclick="deleteRepeatGroup('${doc.id}', this)" class="text-red-600 hover:underline text-sm">🗑️ 削除</button>
    `;
		list.appendChild(div);
		hasValidGroup = true;
	});

	// データがなかった場合に表示
	if (!hasValidGroup) {
		list.innerHTML = '<p class="text-gray-500">登録された定例予約はありません。</p>';
	}
}

// ページ読み込み時に定例予約リストを表示
document.addEventListener('DOMContentLoaded', () => {
	renderRepeatGroups();
});

// 一括削除の関数
async function deleteRepeatGroup(groupId, btnElement) {
  if (!confirm("この定例予約と関連するすべての予約を削除しますか？")) return;

  // 🔒 ボタン無効化＋文言変更
  btnElement.disabled = true;
  const originalText = btnElement.innerText;
  btnElement.innerText = "削除中...";

  try {
    const snapshot = await db
      .collection("reservations")
      .where("repeatGroupId", "==", groupId)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.eventId) {
        const form = new URLSearchParams();
        form.append("eventId", data.eventId);
        form.append("action", "delete");
        await fetch(
          "https://script.google.com/macros/s/AKfycbxBkBNGAtYkXxjcQftVzzo9HjoEWPnXoGFCbSMypi7cLKGbCZk6BnNiU8XVVl0ADviPKw/exec",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form,
          }
        );
      }
      await doc.ref.delete();
    }

    await db.collection("repeatGroups").doc(groupId).delete();

    alert("定例予約を削除しました。");
  } catch (err) {
    console.error("削除エラー:", err);
    alert("削除に失敗しました");
  } finally {
    renderRepeatGroups();
    renderRoomWiseList(document.getElementById("list-date")?.value);
  }
}