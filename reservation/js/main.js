// ✅ 初期化・エントリーポイント（main.js）

auth.onAuthStateChanged((user) => {
	const authSection = document.getElementById('authSection');
	const appSection = document.getElementById('appSection');

	const now = new Date();
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // タイムゾーン補正
	const today = now.toISOString().split('T')[0];

	if (user) {
		// 表示切り替え
		if (authSection) authSection.classList.add('hidden');
		if (appSection) appSection.classList.remove('hidden');

	

		// 初期化処理
		if (document.getElementById('list-date')) {
			document.getElementById('list-date').value = today;
		}
		if (typeof generateTimeOptions === 'function') {
			generateTimeOptions();
		}
		if (typeof renderRoomWiseList === 'function') {
			renderRoomWiseList(today);
		}
		if (typeof loadReservedRanges === 'function') {
			const room = document.getElementById('room')?.value || 'room1';
			loadReservedRanges(room, today);
		}
	} else {
		if (authSection) authSection.classList.remove('hidden');
		if (appSection) appSection.classList.add('hidden');
	}
});
