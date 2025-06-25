
// 🔒 管理者のみが先週以前の予約を削除できるようにする
window.addEventListener('load', () => {
	firebase.auth().onAuthStateChanged((user) => {
		if (!user || user.email !== 'y-okayama@perva.co.jp') {
			// 🔒 表示を消す
			document.getElementById('deleteOldBtn').style.display = 'none';
		}
	});
});
async function deleteOldReservationsWithLog() {
	const user = firebase.auth().currentUser;
	

	// ✅ ログイン＆本人確認
	if (!user) {
		alert('ログインしていません。処理を中止します。');
		return;
	}
	if (user.email !== 'y-okayama@perva.co.jp') {
		
		alert('この操作は許可されていません。');
		return;
	}

	if (!confirm('⚠️ 先週以前の予約を削除し、ログに保存しますか？')) return;

	const deleteBtn = document.getElementById('deleteOldBtn');
	deleteBtn.disabled = true;
	deleteBtn.innerText = '削除中...';

	try {
		const now = new Date();
		const dayOfWeek = now.getDay();
		const daysSinceMonday = (dayOfWeek + 6) % 7;
		const monday = new Date(now);
		monday.setDate(now.getDate() - daysSinceMonday);
		monday.setHours(0, 0, 0, 0);

		// 🔧 YYYY-MM-DD 形式に整形
		const yyyy = monday.getFullYear();
		const mm = String(monday.getMonth() + 1).padStart(2, '0');
		const dd = String(monday.getDate()).padStart(2, '0');
		const targetDateStr = `${yyyy}-${mm}-${dd}`;

		// 🔍 文字列ベースで比較
		const snapshot = await db.collection('reservations').where('date', '<', targetDateStr).get();

		// ✅ 削除前に対象データをログ出力
		console.log(`🔍 削除対象：${snapshot.size} 件`);
		snapshot.forEach((doc) => {
			console.log(`🗂️ ID: ${doc.id}`, doc.data());
		});

		const batch = db.batch();

		snapshot.forEach((doc) => {
			const data = doc.data();

			// 🔄 ログ保存用ドキュメント
			const logRef = db.collection('deleted_reservations').doc();

			batch.set(logRef, {
				...data,
				originalId: doc.id,
				deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
				deletedBy: user.uid,
			});

			// ❌ 予約を削除
			batch.delete(doc.ref);
		});

		await batch.commit();

		alert(`${snapshot.size} 件の予約を削除し、ログに保存しました。`);
	} catch (err) {
		console.error('❌ エラー:', err);
		alert('削除中にエラーが発生しました。');
	} finally {
		deleteBtn.disabled = false;
		deleteBtn.innerText = '先週以前の予約削除';
	}
}
