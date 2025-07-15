(async function () {
	const params = new URLSearchParams(location.search);
	const room = params.get('room') || 'room1';
	const username = 'NFCユーザー';
	const type = '即時';

	const message = document.getElementById('message');

	const roomNames = { room1: '会議室', room2: '個室', room3: '商談室' };
	const roomName = roomNames[room] || room;

	const roomColorMap = { room1: '9', room2: '10', room3: '3' };
	const colorId = roomColorMap[room] || '9';

	const pad = (n) => String(n).padStart(2, '0');
	const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	const formatISO = (d) => `${formatDate(d)}T${formatTime(d)}:00+09:00`;

	// ✅ Firestoreの日時文字列をDateに変換
	const parseDateTime = (str) => {
		const [datePart, timePart] = str.split(' ');
		return new Date(`${datePart}T${timePart}:00+09:00`);
	};

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
		// 🔍 今日の同じroom・usernameの予約を探す
		const snapshot = await db
			.collection('reservations')
			.where('room', '==', room)
			.where('date', '==', date)
			.where('username', '==', username)
			.get();

		let existing = null;
		snapshot.forEach((doc) => {
			const data = doc.data();
			if (!existing || parseDateTime(data.end) > parseDateTime(existing.end)) {
				existing = { id: doc.id, ...data };
			}
		});

		if (existing) {
			// 🔍 延長したい終了時間を計算
			const newEndTime = new Date(parseDateTime(existing.end).getTime() + 60 * 60 * 1000);
			const newEndStr = `${date} ${formatTime(newEndTime)}`;

			// 🔍 他の予約と衝突がないか確認
			const otherSnapshot = await db
				.collection('reservations')
				.where('room', '==', room)
				.where('date', '==', date)
				.get();

			const conflict = otherSnapshot.docs.some((doc) => {
				const d = doc.data();
				if (doc.id === existing.id) return false;
				return !(newEndStr <= d.start || existing.start >= d.end);
			});

			if (conflict) {
				message.textContent = '❌ これ以上延長できません。他の予約と重なります。';
				return;
			}

			// 📅 Googleカレンダー更新
			let updated = false;
			if (existing.eventId) {
				try {
					const formData = new URLSearchParams();
					formData.append('eventId', existing.eventId);
					formData.append('newEnd', formatISO(newEndTime));
					formData.append('action', 'extend');
					console.log('=== Googleカレンダー延長 payload ===');
					console.log('eventId:', existing.eventId);
					console.log('newEnd:', formatISO(newEndTime));
					console.log('action:', 'extend');

					const res = await fetch(
						'https://script.google.com/macros/s/AKfycbwEl2qhnBPavks2-5W_jfKnQPcHWH9jZEsS7KnFt54XC6b_2W6KUkZuW7odpUo-Mu9A7w/exec',
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
							body: formData,
						}
					);

					const data = await res.json();
					console.log("GASからの返答:", data);
					if (data.status === 'success') {
						updated = true;
					}
				} catch (err) {
					console.warn('⚠️ Googleカレンダー延長失敗:', err);
				}
			}

			// Firestoreを更新
			await db
				.collection('reservations')
				.doc(existing.id)
				.update({
					end: newEndStr,
					accessLog: {
						userAgent: navigator.userAgent,
						extendedAt: new Date(),
						calendarExtended: updated,
					},
				});

			message.textContent = `✅ 延長しました。新しい終了時刻: ${newEndStr}`;
		} else {
			// 🔍 重複チェック
			const conflictSnapshot = await db
				.collection('reservations')
				.where('room', '==', room)
				.where('date', '==', date)
				.get();

			const hasConflict = conflictSnapshot.docs.some((doc) => {
				const d = doc.data();
				return !(endTime <= d.start.slice(11, 16) || startTime >= d.end.slice(11, 16));
			});

			if (hasConflict) {
				message.textContent = '❌ その時間はすでに予約があります。';
				return;
			}

			// 📅 Googleカレンダー新規登録
			let eventId = null;
			try {
				const formData = new URLSearchParams();
				formData.append('summary', `${roomName}｜${type}｜${username}`);
				formData.append('description', 'NFC即時予約');
				formData.append('start', formatISO(startDate));
				formData.append('end', formatISO(endDate));
				formData.append('location', roomName);
				formData.append('colorId', colorId);

				const res = await fetch(
					'https://script.google.com/macros/s/AKfycbwEl2qhnBPavks2-5W_jfKnQPcHWH9jZEsS7KnFt54XC6b_2W6KUkZuW7odpUo-Mu9A7w/exec',
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: formData,
					}
				);

				const data = await res.json();
				if (data.status === 'success') {
					eventId = data.eventId;
				}
			} catch (err) {
				console.warn('⚠️ Googleカレンダー登録失敗:', err);
			}

			// Firestoreに新規登録
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
				eventId: eventId || '',
				colorId: colorId,
				source: 'nfc',
				accessLog: {
					userAgent: navigator.userAgent,
					createdAt: new Date(),
					calendarCreated: !!eventId,
				},
			});

			message.textContent = `✅ ${startTime}〜${endTime} を予約しました`;
		}
	} catch (err) {
		console.error(err);
		message.textContent = '⚠️ 予約処理でエラーが発生しました。再試行してください。';
	}
})();
