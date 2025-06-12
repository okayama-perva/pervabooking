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

  if (!confirm('⚠️ 先月以前の予約を削除し、ログに保存しますか？')) return;

  const deleteBtn = document.getElementById('deleteOldBtn');
  deleteBtn.disabled = true;
  deleteBtn.innerText = '削除中...';

  try {
    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const targetTimestamp = firebase.firestore.Timestamp.fromDate(firstDayOfThisMonth);

    const snapshot = await db
      .collection('reservations')
      .where('date', '<', targetTimestamp)
      .get();

    if (snapshot.empty) {
      alert('削除対象の予約はありません。');
      return;
    }

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
    deleteBtn.innerText = '先月以前の予約削除';
  }
}
