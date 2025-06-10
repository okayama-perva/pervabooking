async function testDeleteOldReservations() {
	// ログインしているユーザー取得
    const user = firebase.auth().currentUser;
	if (!user) {
		alert('ログインしていません。処理を中止します。');
		return;
	}

	if (user.email !== 'y-okayama@perva.co.jp') {
		alert('この操作は許可されていません。');
		return;
	}

	const now = new Date();
	const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const targetTimestamp = firebase.firestore.Timestamp.fromDate(firstDayOfThisMonth);

	console.log('📅 今月初日:', firstDayOfThisMonth.toISOString());
	console.log('🔎 クエリ条件: date < ', targetTimestamp.toDate().toISOString());

	try {
		const snapshot = await db.collection('reservations').where('date', '<', targetTimestamp).get();

		console.log(`📄 ヒット件数: ${snapshot.size} 件`);

		if (snapshot.empty) {
			console.log('✅ 削除対象の予約はありません。');
			return;
		}

		const user = firebase.auth().currentUser;
		console.log('👤 実行ユーザー:', user ? user.uid : '未ログイン');

		snapshot.forEach((doc, index) => {
			const data = doc.data();
			console.log(`--- 🔽 ${index + 1} 件目 ---`);
			console.log('🆔 document ID:', doc.id);
			console.log('📝 title:', data.title);
			console.log('📅 date:', data.date.toDate().toISOString());
			console.log('📌 userId:', data.userId);
			console.log('🗒️ memo:', data.memo || '(なし)');

			// ここで実際にログを保存する場合は下記を使う（今はコメントアウト）
			/*
      const logRef = db.collection('deleted_reservations').doc();
      await logRef.set({
        ...data,
        originalId: doc.id,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedBy: user ? user.uid : 'unknown',
      });
      */
		});

		console.log('✅ ログ表示完了。削除処理は行っていません。');
	} catch (err) {
		console.error('❌ エラー発生:', err);
	}
}
