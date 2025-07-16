// common/authGuard.js

auth.onAuthStateChanged((user) => {
	const expireAt = parseInt(localStorage.getItem('authExpireAt') || '0', 10);

	if (user && (!expireAt || Date.now() > expireAt)) {
		// セッション切れ or 未設定 → ログアウト
		(async () => {
			await auth.signOut();
			localStorage.removeItem('authExpireAt');
			alert('セッションが切れました。再度ログインしてください。');
			window.location.href = 'https://okayu.icurus.jp/perva_booking/auth/login.html';
		})();
	}

	if (!user) {
		// 本番では修正が必要
		window.location.href = 'https://okayu.icurus.jp/perva_booking/auth/login.html';
	}
});
