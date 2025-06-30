(async function () {
	const params = new URLSearchParams(location.search);
	const room = params.get('room') || 'room1';
	const username = 'NFC';
	const title = '今すぐ予約';
	const type = '即時';

	const message = document.getElementById('message');

	const now = new Date();
	const rounded = new Date(now);
	const minutes = now.getMinutes();
	rounded.setMinutes(minutes % 30 === 0 ? minutes : minutes + (30 - (minutes % 30)));
	rounded.setSeconds(0, 0);

	const start = new Date(rounded);
	const end = new Date(start.getTime() + 60 * 60 * 1000); // +1時間

	const pad = (n) => String(n).padStart(2, '0');
	const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const formatDateTime = (d) => `${formatDate(d)} ${formatTime(d)}`;
	const formatISO = (d) => `${formatDate(d)}T${formatTime(d)}:00+09:00`;

	const dateStr = formatDate(start);
	const startStr = formatDateTime(start);
	const endStr = formatDateTime(end);

	// ✅ GAS URL（カレンダー連携用）
	const GAS_URL = 'https://script.google.com/macros/s/AKfycbztij-4sW0g3LiVS0q0A9z7DUFBp5iTF6bRJyYtzt-26DLnIkNJ7ySx0wBDu4nQZrh_Vg/exec';

	try {
		// 🔍 重複チェック
		const snapshot = await db
			.collection('reservations')
			.where('room', '==', room)
			.where('date', '==', dateStr)
			.get();

		const hasConflict = snapshot.docs.some((doc) => {
			const d = doc.data();
			return !(endStr <= d.start || startStr >= d.end);
		});

		if (hasConflict) {
			message.textContent = '❌ その時間はすでに予約があります。他の時間帯をご利用ください。';
			return;
		}

		// 📅 Googleカレンダーに登録
		let eventId = '';
		try {
			const gasPayload = {
				title: title,
				start: formatISO(start), // ISO形式
				end: formatISO(end),
				room: room,
			};

			const response = await fetch(GAS_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(gasPayload),
			});

			const result = await response.json();
			eventId = result.eventId || '';
		} catch (e) {
			console.warn('⚠️ Googleカレンダー登録失敗:', e);
		}

		// 🔄 Firestoreへ予約保存
		await db.collection('reservations').add({
			createdAt: firebase.firestore.FieldValue.serverTimestamp(),
			date: dateStr,
			start: startStr,
			end: endStr,
			room: room,
			title: title,
			type: type,
			uid: '',
			username: username,
			memo: '',
			repeatGroupId: '',
			eventId: eventId,
			source: 'nfc',
		});

		message.textContent = `✅ ${startStr}〜${endStr} を予約しました`;
	} catch (error) {
		console.error(error);
		message.textContent = '⚠️ 予約処理でエラーが発生しました。再試行してください。';
	}
})();
