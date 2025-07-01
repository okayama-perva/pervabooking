(async function () {
	const params = new URLSearchParams(location.search);
	const room = params.get('room') || 'room1';
	const username = 'NFC';
	const type = '即時';

	const message = document.getElementById('message');

	// 会議室名とカラーIDマップ
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

	// 日付フォーマット
	const pad = (n) => String(n).padStart(2, '0');
	const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

	const now = new Date();
	const rounded = new Date(now);
	const minutes = now.getMinutes();
	rounded.setMinutes(minutes % 30 === 0 ? minutes : minutes + (30 - (minutes % 30)));
	rounded.setSeconds(0, 0);

	const startDate = new Date(rounded);
	const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

	const date = formatDate(startDate);
	const startTime = formatTime(startDate);
	const endTime = formatTime(endDate);

	try {
		// 🔍 重複チェック
		const snapshot = await db.collection('reservations')
			.where('room', '==', room)
			.where('date', '==', date)
			.get();

		const hasConflict = snapshot.docs.some(doc => {
			const d = doc.data();
			return !(endTime <= d.start.slice(11, 16) || startTime >= d.end.slice(11, 16));
		});

		if (hasConflict) {
			message.textContent = '❌ その時間はすでに予約があります。他の時間帯をご利用ください。';
			return;
		}

		// 📅 Googleカレンダーに登録
		let eventId = null;
		const formData = new URLSearchParams();
		formData.append('summary', `${roomName}｜${type}｜${username}`);
		formData.append('description', 'NFC即時予約');
		formData.append('start', `${date}T${startTime}:00+09:00`);
		formData.append('end', `${date}T${endTime}:00+09:00`);
		formData.append('location', roomName);
		formData.append('colorId', colorId);

		try {
			const res = await fetch('https://script.google.com/macros/s/AKfycbztij-4sW0g3LiVS0q0A9z7DUFBp5iTF6bRJyYtzt-26DLnIkNJ7ySx0wBDu4nQZrh_Vg/exec', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: formData,
			});

			const data = await res.json();
			if (data.status === 'success') {
				eventId = data.eventId;
			} else {
				throw new Error('Googleカレンダー登録失敗');
			}
		} catch (err) {
			console.warn('⚠️ Googleカレンダー登録失敗:', err);
			message.textContent = '⚠️ Googleカレンダーへの登録に失敗しました。';
			return;
		}

		// 🔄 Firestoreに予約保存
		await db.collection('reservations').add({
			createdAt: new Date(),
			uid: '',
			username: username,
			type: type,
			room: room,
			date: date,
			start: `${date} ${startTime}`,
			end: `${date} ${endTime}`,
			memo: '',
			eventId: eventId,
			colorId: colorId,
			source: 'nfc'
		});

		message.textContent = `✅ ${startTime}〜${endTime} を予約しました`;
	} catch (error) {
		console.error(error);
		message.textContent = '⚠️ 予約処理でエラーが発生しました。再試行してください。';
	}
})();
