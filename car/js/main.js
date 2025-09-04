// ✅ 予約送信処理（例：Firestore保存など）
document.getElementById('reservationForm').addEventListener('submit', async (e) => {
   e.preventDefault();
   const startDate = document.getElementById('startDate').value;
   const endDate = document.getElementById('endDate').value;
   const startTime = document.getElementById('startTime').value;
   const endTime = document.getElementById('endTime').value;
   const car = document.getElementById('selectedCar').value;
   const memo = document.getElementById('memo').value;
   const multiDay = multiDayToggle.checked;

   // 🔒 バリデーション
   if (multiDay) {
      // 複数日予約
      if (!car || !startTime || !endTime || !startDate || !endDate) {
         alert('すべての項目を入力してください');
         return;
      }
   } else {
      // 単一日予約
      if (!car || !startTime || !startDate || !endDate) {
         alert('すべての項目を入力してください');
         return;
      }
   }

   const submitBtn = document.querySelector('#reservationForm button[type="submit"]');
   if (!submitBtn) return;
   // ⛔ 二重送信防止：すでに送信中なら無視
   if (submitBtn.disabled) return;

   // ⏳ ボタン無効化 & 表示変更
   submitBtn.disabled = true;
   const originalText = submitBtn.innerText;
   submitBtn.innerText = '送信中...';

   // 時間のバリデーション
   if (!validateTimeRange()) {
      return;
   }
   // 🔥 Firestoreへ登録する例（要firebase初期化）
   try {
      const start = new Date(startDate.value);
      const end = new Date(endDate.value);
      const dateList = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
         dateList.push(new Date(d));
      }

      // 🔍 各日付ごとに重複チェック
      for (let i = 0; i < dateList.length; i++) {
         const dateObj = dateList[i];
         const dateStr = dateObj.toISOString().slice(0, 10);

         const sTime = i === 0 ? startTime : '00:00';
         const eTime = i === dateList.length - 1 ? endTime : '24:00';

         const snapshot = await db
            .collection('car_reservations')
            .where('car', '==', car)
            .where('date', '==', dateStr)
            .get();

         for (const doc of snapshot.docs) {
            const data = doc.data();
            if (sTime < data.endTime && eTime > data.startTime) {
               alert(`🚫 ${dateStr} の ${sTime}〜${eTime} は既に予約されています`);
               submitBtn.disabled = false;
               submitBtn.innerText = originalText;
               return;
            }
         }
      }
      const uid = auth.currentUser.uid;
      const userDoc = await db.collection('users').doc(uid).get();
      const username = userDoc.exists ? userDoc.data().username : '未登録';
      const calendarApiUrl =
         'https://script.google.com/macros/s/AKfycbzdsWjVm75VoFfdNd5m4ir3bs-S5BJVe2MyWmrkJsuPUTmoGmQ7dRPxFoCBQ2U905VJ/exec'; // 🔁 あなたのGAS URLに差し替え

      let reservations = [];

      if (multiDay) {
         const start = new Date(startDate.value);
         const end = new Date(endDate.value);
         const dateList = [];

         for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateList.push(new Date(d));
         }

         for (let i = 0; i < dateList.length; i++) {
            const dateObj = dateList[i];
            const dateStr = dateObj.toISOString().slice(0, 10);

            const sTime = i === 0 ? startTime : '00:00';
            const eTime = i === dateList.length - 1 ? endTime : '24:00';

            // 🔄 Googleカレンダーに登録
            const params = new URLSearchParams({
               action: 'add',
               user: username,
               car,
               memo,
               date: dateStr,
               starttime: sTime,
               endtime: eTime,
               colorId: '6',
            });

            const res = await fetch(calendarApiUrl, {
               method: 'POST',
               body: params,
            });

            const result = await res.json();

            if (result.status === 'success') {
               reservations.push({
                  car,
                  date: dateStr,
                  startTime: sTime,
                  endTime: eTime,
                  memo,
                  uid,
                  username,
                  createdAt: new Date(),
                  eventId: result.eventId, // 🔑 ここ大事！
               });
            } else {
               throw new Error(`Googleカレンダー登録失敗: ${result.message}`);
            }
         }
      } else {
         const dateStr = startDate.value;

         const snapshot = await db
            .collection('car_reservations')
            .where('car', '==', car)
            .where('date', '==', dateStr)
            .get();

         for (const doc of snapshot.docs) {
            const data = doc.data();
            if (startTime < data.endTime && endTime > data.startTime) {
               alert(`🚫 ${dateStr} の ${startTime}〜${endTime} は既に予約されています`);
               submitBtn.disabled = false;
               submitBtn.innerText = originalText;
               return;
            }
         }

         const params = new URLSearchParams({
            action: 'add',
            user: username,
            car,
            memo,
            date: dateStr,
            starttime: startTime,
            endtime: endTime,
            colorId: '6',
         });

         const res = await fetch(calendarApiUrl, {
            method: 'POST',
            body: params,
         });

         const result = await res.json();

         if (result.status === 'success') {
            reservations.push({
               car,
               date: dateStr,
               startTime,
               endTime,
               memo,
               uid,
               username,
               createdAt: new Date(),
               eventId: result.eventId,
            });
         } else {
            throw new Error(`Googleカレンダー登録失敗: ${result.message}`);
         }
      }

      // 🔥 Firestore へ登録
      const batch = db.batch();
      reservations.forEach((data) => {
         const docRef = db.collection('car_reservations').doc(); // 任意のコレクション名
         batch.set(docRef, data);
      });
      await batch.commit();

      alert('予約を登録しました！');
      location.reload();
   } catch (err) {
      console.error('予約登録エラー:', err);
      alert('登録に失敗しました');
   } finally {
      // ✅ ボタン元に戻す
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
   }
});
