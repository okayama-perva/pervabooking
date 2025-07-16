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
	const parseDateTime = (str) => {
		const [datePart, timePart] = str.split(' ');
		return new Date(`${datePart}T${timePart}:00+09:00`);
	};

	function debugLog(msg) {
		message.innerHTML += `<br>${msg}`;
	}

	debugLog(`🚀 デバッグ開始`);
	debugLog(`room=${room}, username=${username}`);

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

	debugLog(`🕒 start=${startTime}, end=${endTime}, date=${date}`);

	try {
		// 🔍 既存予約チェック
		debugLog("① Firestore existing確認前");
		const snapshot = await db.collection('reservations')
			.where('room', '==', room)
			.where('date', '==', date)
			.where('username', '==', username)
			.get();
		debugLog(`② snapshot数: ${snapshot.docs.length}`);

		let existing = null;
		snapshot.forEach((doc) => {
			const data = doc.data();
			debugLog(`③ snapshot data: ${JSON.stringify(data)}`);
			if (!existing || parseDateTime(data.end) > parseDateTime(existing.end)) {
				existing = { id: doc.id, ...data };
			}
		});
		debugLog(`④ existing: ${JSON.stringify(existing)}`);

		if (existing) {
			debugLog("⑤ 既存予約あり → 延長処理へ");

			const newEndTime = new Date(parseDateTime(existing.end).getTime() + 60 * 60 * 1000);
			const newEndStr = `${date} ${formatTime(newEndTime)}`;
			debugLog(`⑥ 延長後 newEndStr=${newEndStr}`);

			const otherSnapshot = await db.collection('reservations')
				.where('room', '==', room)
				.where('date', '==', date)
				.get();
			debugLog(`⑦ 他予約チェック数: ${otherSnapshot.docs.length}`);

			const conflict = otherSnapshot.docs.some((doc) => {
				const d = doc.data();
				if (doc.id === existing.id) return false;
				return !(newEndStr <= d.start || existing.start >= d.end);
			});
			debugLog(`⑧ conflict=${conflict}`);

			if (conflict) {
				message.textContent = '❌ これ以上延長できません。他の予約と重なります。';
				return;
			}

			let updated = false;
			if (existing.eventId) {
				debugLog("⑨ Googleカレンダー延長へ");
				try {
					const formData = new URLSearchParams();
					formData.append('eventId', existing.eventId);
					formData.append('newEnd', formatISO(newEndTime));
					formData.append('action', 'extend');
					debugLog(`⑩ payload: eventId=${existing.eventId}, newEnd=${formatISO(newEndTime)}`);

					const res = await fetch('https://script.google.com/macros/s/AKfycbwEl2qhnBPavks2-5W_jfKnQPcHWH9jZEsS7KnFt54XC6b_2W6KUkZuW7odpUo-Mu9A7w/exec', {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: formData,
					});
					const data = await res.json();
					debugLog(`⑪ GAS返答: ${JSON.stringify(data)}`);

					if (data.status === 'extended') {
						updated = true;
					}
				} catch (err) {
					debugLog(`⚠️ GASエラー: ${err.message}`);
				}
			}

			await db.collection('reservations').doc(existing.id).update({
				end: newEndStr,
				accessLog: {
					userAgent: navigator.userAgent,
					extendedAt: new Date(),
					calendarExtended: updated,
				},
			});
			debugLog("✅ Firestore更新完了（延長）");
			message.textContent = `✅ 延長しました。新しい終了時刻: ${newEndStr}`;
		} else {
			debugLog("⑤ 新規予約処理へ");

			const conflictSnapshot = await db.collection('reservations')
				.where('room', '==', room)
				.where('date', '==', date)
				.get();
			debugLog(`⑥ 重複snapshot数: ${conflictSnapshot.docs.length}`);

			const hasConflict = conflictSnapshot.docs.some((doc) => {
				const d = doc.data();
				return !(endTime <= d.start.slice(11, 16) || startTime >= d.end.slice(11, 16));
			});
			debugLog(`⑦ hasConflict=${hasConflict}`);

			if (hasConflict) {
				message.textContent = '❌ その時間はすでに予約があります。';
				return;
			}

			let eventId = null;
			try {
				debugLog("⑧ Googleカレンダー新規予約へ");
				const formData = new URLSearchParams();
				formData.append('summary', `${roomName}｜${type}｜${username}`);
				formData.append('description', 'NFC即時予約');
				formData.append('start', formatISO(startDate));
				formData.append('end', formatISO(endDate));
				formData.append('location', roomName);
				formData.append('colorId', colorId);

				debugLog(`⑨ payload: ${formatISO(startDate)} - ${formatISO(endDate)}`);
				const res = await fetch('https://script.google.com/macros/s/AKfycbwEl2qhnBPavks2-5W_jfKnQPcHWH9jZEsS7KnFt54XC6b_2W6KUkZuW7odpUo-Mu9A7w/exec', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: formData,
				});
				const data = await res.json();
				debugLog(`⑩ GAS返答: ${JSON.stringify(data)}`);

				if (data.status === 'success') {
					eventId = data.eventId;
				}
			} catch (err) {
				debugLog(`⚠️ Googleカレンダー新規エラー: ${err.message}`);
			}

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
			debugLog("✅ Firestore登録完了（新規）");
			message.textContent = `✅ ${startTime}〜${endTime} を予約しました`;
		}
	} catch (err) {
		debugLog(`❌ try-catch エラー: ${err.message}`);
	}
})();
