// ✅ 認証関連処理（auth.js）

function register() {
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;
	const username = document.getElementById('username').value;
	const registerBtn = document.getElementById('registerBtn');

	if (!username) {
		alert('表示名を入力してください。');
		return;
	}

	// 二重送信防止：ボタン無効化と文言変更
	registerBtn.disabled = true;
	const originalText = registerBtn.innerText;
	registerBtn.innerText = '登録中...';

	auth.createUserWithEmailAndPassword(email, password)
		.then((cred) => {
			// 🔸ユーザー登録後、表示名を保存
			return db.collection('users').doc(cred.user.uid).set({
				username: username,
				email: email,
			});
		})
		.then(() => {
			alert('登録完了！');
		})
		.catch((err) => {
			alert('登録失敗しました。登録済みでは？ログインとして再試行してください');
			// エラー時はボタンを戻す
			registerBtn.disabled = false;
			registerBtn.innerText = originalText;
		});
}

function login() {
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;
	const loginBtn = document.getElementById('loginBtn');

	// 二重送信防止：ボタン無効化＆表示変更
	loginBtn.disabled = true;
	const originalText = loginBtn.innerText;
	loginBtn.innerText = 'ログイン中...';
	auth.signInWithEmailAndPassword(email, password)
	.then(() => {
			// 🔐 成功時：1日セッション有効期限を保存
			const expireAt = Date.now() +3 * 24 * 60 * 60 * 1000;
			localStorage.setItem('authExpireAt', expireAt);
			console.log('✅ expireAt saved:', new Date(expireAt).toLocaleString());
		})
	.catch((err) => {
		alert('ログイン失敗：メールアドレス・パスワードを間違えていないか確認してください ');
		// エラー時はボタンを戻す
		loginBtn.disabled = false;
		loginBtn.innerText = originalText;
		console.log(err.message);
	});
}


function logout() {
	auth.signOut();
	localStorage.removeItem('authExpireAt');
}

auth.onAuthStateChanged((user) => {
	// 🔍 セッション期限を確認
	const expireAt = parseInt(localStorage.getItem('authExpireAt') || '0', 10);
	if (user && expireAt && Date.now() > expireAt) {
		auth.signOut().then(() => {
			localStorage.removeItem('authExpireAt'); // クリーンアップ
			alert('セッションの有効期限が切れました。再度ログインしてください。');
		});
		return; // 処理中断
	}
	if (user) {
		document.getElementById('authSection').classList.add('hidden');
		document.getElementById('appSection').classList.remove('hidden');
		const now = new Date();
		now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // タイムゾーン補正
		const today = now.toISOString().split('T')[0];
		document.getElementById('list-date').value = today;
		renderRoomWiseList(today);
		loadReservedRanges(document.getElementById('room').value, today);
		// updateAllViews();
	} else {
		document.getElementById('authSection').classList.remove('hidden');
		document.getElementById('appSection').classList.add('hidden');
	}
});
