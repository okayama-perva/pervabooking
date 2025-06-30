document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('snackForm');
	const listEl = document.getElementById('snackList');

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const name = document.getElementById('name').value;
		const file = document.getElementById('image').files[0];
		const link = document.getElementById('link').value || '';

		let imagePath = '';
		if (file) {
			const formData = new FormData();
			formData.append('file', file);

			const res = await fetch('upload.php', {
				method: 'POST',
				body: formData,
			});
			const result = await res.json();
			if (result.success) {
				imagePath = result.filePath; // ← img/xxxxx.png
			} else {
				alert('アップロード失敗: ' + result.message);
				return;
			}
		}

		// Firestoreに保存
		await db.collection('snacks').add({
			name: name,
			imageUrl: imagePath, // ← Firebaseじゃなくサーバーパス
			linkUrl: link,
			likes: 0,
			createdAt: firebase.firestore.FieldValue.serverTimestamp(),
		});

		alert('登録しました！');
		form.reset();
	});

	// 🔥 Firestoreのリアルタイム表示
	db.collection('snacks')
		.orderBy('createdAt', 'desc')
		.onSnapshot((snapshot) => {
			listEl.innerHTML = '';
			snapshot.forEach((doc) => {
				const data = doc.data();
				const item = document.createElement('div');
				item.className =
					'bg-white rounded-xl shadow hover:shadow-lg p-4 flex flex-col items-center transition-transform hover:scale-105';

				let imgHtml = data.imageUrl
					? `<img src="${data.imageUrl}" alt="${data.name}" class="w-32 h-32 object-cover rounded mb-3">`
					: '';
				let nameHtml = data.linkUrl
					? `<a href="${data.linkUrl}" target="_blank" class="text-lg font-semibold text-pink-700 hover:underline">${data.name}</a>`
					: `<div class="text-lg font-semibold text-pink-700">${data.name}</div>`;

				item.innerHTML = `
                ${imgHtml}
                ${nameHtml}
                <div class="flex space-x-2 mt-2">
                    <button onclick="like('${doc.id}', ${data.likes})"
                    class="bg-pink-300 text-white px-4 py-1 rounded-full hover:bg-pink-400 transition">
                    👍 ${data.likes}
                    </button>
                    <button onclick="deleteSnack('${doc.id}', '${data.imageUrl}')"
                    class="bg-red-400 text-white px-3 py-1 rounded-full hover:bg-red-500 transition">
                    🗑️
                    </button>
                </div>
                `;
				listEl.appendChild(item);
			});
		});

	// 👍 いいね
	window.like = (id, likes) => {
		db.collection('snacks')
			.doc(id)
			.update({
				likes: likes + 1,
			});
	};
});
window.deleteSnack = async (docId, filePath) => {
	if (!confirm('本当に削除しますか？')) return;

	// Firestoreから削除
	await db.collection('snacks').doc(docId).delete();

	// サーバー上の画像ファイル削除
	if (filePath) {
		await fetch('delete_image.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filePath }),
		});
	}

	alert('削除しました！');
};
