const form = document.getElementById('reservationForm');
const submitBtn = form.querySelector('button[type="submit"]');
let isSubmitting = false;

// 時間のバリデーション
function isValidTime(time) {
	const [hour, minute] = time.split(':').map(Number);
	if (hour < 8 || hour > 22) return false;
	if (minute % 15 !== 0) return false;
	return true;
}

form.addEventListener('submit', async (e) => {
	e.preventDefault();
	// 二重送信防止
	if (isSubmitting) return;
	isSubmitting = true;
	submitBtn.disabled = true;
	submitBtn.textContent = '送信中...';

	// バリュー取得
	const car = document.getElementById('car').value;
	const date = document.getElementById('date').value;
	const starttime = document.getElementById('start').value;
	const endtime = document.getElementById('end').value;
	// データがnullならアラート
	if (!car || !date || !starttime || !endtime) {
		alert('車両、日付、開始時間、終了時間を選択してください。');
		isSubmitting = false;
		submitBtn.disabled = false;
		submitBtn.textContent = '🚀 予約する';
		return;
	}
	// 時間のフォーマットチェック
    if (!isValidTime(starttime) || !isValidTime(endtime)) {
        alert('時間は8:00～22:00の15分単位で選択してください。');
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 予約する';
        return;
    }
// ...existing code...
	// nullなら待つ
	let user = auth.currentUser;
	if (!user) {
		user = await new Promise((resolve) => {
			auth.onAuthStateChanged(resolve);
		});
	}
	const uid = user.uid;
	const userDoc = await db.collection('users').doc(uid).get();
	const username = userDoc.exists ? userDoc.data().username : '未登録';
	if (!username) return alert('ログイン情報が見つかりません');

	// 重複確認
	// 同じ車かつ同じ日付
	const snapshot = await db.collection('cars_reservations').where('car', '==', car).where('date', '==', date).get();
	let isOverlap = false;
	snapshot.forEach((doc) => {
		const data = doc.data();
		// 予約時間の重複チェック
		if (starttime < data.endtime && endtime > data.starttime) {
			isOverlap = true;
		}
	});

	if (isOverlap) {
		alert('この時間は既に予約があります！');
		isSubmitting = false;
		submitBtn.disabled = false;
		submitBtn.textContent = '🚀 予約する';
		return;
	}

	const data = new URLSearchParams();
	data.append('user', username);
	data.append('car', document.getElementById('car').value);
	data.append('memo', document.getElementById('memo').value);
	data.append('date', document.getElementById('date').value);
	data.append('starttime', document.getElementById('start').value);
	data.append('endtime', document.getElementById('end').value);
	data.append('colorId', '6');

	try {
		const res = await fetch(
			'https://script.google.com/macros/s/AKfycbzdsWjVm75VoFfdNd5m4ir3bs-S5BJVe2MyWmrkJsuPUTmoGmQ7dRPxFoCBQ2U905VJ/exec',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: data,
			}
		);
		const json = await res.json();
		if (json.status === 'success') {
			const eventId = json.eventId;
			// Firestoreに保存
			await db.collection('cars_reservations').add({
				createdAt: new Date(),
				eventId,
				car: document.getElementById('car').value,
				user: username,
				date: document.getElementById('date').value,
				starttime: document.getElementById('start').value,
				endtime: document.getElementById('end').value,
				memo: document.getElementById('memo').value,
			});
			alert('GoogleカレンダーとFirestoreに予約を保存しました！');
			form.reset();
		} else {
			alert('登録失敗: ' + JSON.stringify(json));
		}
	} catch (err) {
		console.error(err);
		alert('通信エラー');
	} finally {
		// 絶対にボタンを復活させる
		isSubmitting = false;
		submitBtn.disabled = false;
		submitBtn.textContent = '🚀 予約する';
	}
});
