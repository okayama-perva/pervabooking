  // 初期化
  window.addEventListener("load", () => {
    flatpickr("#list-date", {
      dateFormat: "Y-m-d",
      defaultDate: "today",
      minDate: "today", // 👈 過去日付は選択できない
	  locale: "ja", // ← 念のため指定
      onChange: function (selectedDates, dateStr) {
        renderRoomWiseList(dateStr);// 👈 日付変更時に予約リストを更新
        loadReservedRanges(document.getElementById('room').value, dateStr);
		document.getElementById('date').value = dateStr // 👈 日付入力欄も更新
      },
    });
  });

  // 初期化
  window.addEventListener("load", () => {
    flatpickr("#date", {
      dateFormat: "Y-m-d",
      defaultDate: "today",
      minDate: "today", // 👈 過去日付は選択できない
	  locale: "ja", // ← 念のため指定
      onChange: function (selectedDates, dateStr) {
        renderRoomWiseList(dateStr);// 👈 日付変更時に予約リストを更新
        loadReservedRanges(document.getElementById('room').value, dateStr); // ← ここ追加
		document.getElementById('list-date').value = dateStr // 👈 日付入力欄も更新
      },
    });
  });

