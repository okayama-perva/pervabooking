const container = document.getElementById('timeline');

// ✅ サンプルデータ
const sampleData = [
   {
      id: 1,
      date: '2025-09-04',
      start: '2025-09-04T06:30:00',
      end: '2025-09-04T09:15:00',
      car: 'シエンタ',
      user: '内山',
   },
   {
      id: 2,
      date: '2025-09-07',
      start: '2025-09-07T09:00:00',
      end: '2025-09-07T11:45:00',
      car: 'ヤリス',
      user: '岡山',
   },
   {
      id: 3,
      date: '2025-09-12',
      start: '2025-09-12T20:30:00',
      end: '2025-09-13T21:30:00',
      car: 'プリウス',
      user: '古舘',
   },
];

function getMonthDates(year, month) {
   const dates = [];

   const date = new Date(year, month - 1, 1);     // ← 月初（9/1）から
   const end = new Date(year, month, 1);          // ← 翌月の1日（10/1）

   while (date < end) {
      const localDate = new Date(date); // ← 毎回複製（ミューテート防止）
      const iso = localDate.toLocaleDateString('sv-SE'); // YYYY-MM-DD 形式（UTCずれしない）s
      dates.push({
         id: iso,
         content: new Date(iso).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
         }),
      });
      
      date.setDate(date.getDate() + 1); // ✅ 1日進める（date は let なのでOK）
   }

   return dates;
}

// ⬇ 追加：大きいラベルのテキストを修正する関数
function fixMajorLabelText(year, month) {
   const labelText = `${year}年${month}月`;
   let attempts = 0;

   const interval = setInterval(() => {
      const labels = document.querySelectorAll('.vis-text.vis-major div');

      if (labels.length > 0) {
         labels.forEach((el) => {
            if (!el.innerText.includes('年')) {
               el.innerText = labelText;
            }
         });
         attempts++;
      }

      if (attempts >= 5) {
         clearInterval(interval);
      }
   }, 300); // 300msごとにチェック（最大5回＝約1.5秒）
}

let timeline = null; // 🔄 タイムラインのインスタンスを使い回す

function getLastDayOfMonth(year, month) {
   return new Date(year, month, 0).getDate(); // ← monthは1-based（例: 9月 → 9）
}

function drawTimeline(year, month) {
   const groups = new vis.DataSet(getMonthDates(year, month));

   const items = new vis.DataSet(
      sampleData
         .filter((item) => {
            const d = new Date(item.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
         })
         .map((item) => {
   const startTime = new Date(`1970-01-01T${item.start.split('T')[1]}`);
   const endTime = new Date(`1970-01-01T${item.end.split('T')[1]}`);
   return {
      id: item.id,
      group: item.date, // '2025-09-12' など
      start: startTime,
      end: endTime,
      content: `車種： ${item.car}<br>👤 ${item.user} <button class="cancelBtn" onclick="cancelItem(${item.id})">❌</button>`,
      className: 'custom-item',
   };
})

   );

   const options = {
      groupOrder: 'id',
      orientation: 'top',
      verticalScroll: true,
      zoomable: false,
      moveable: false,
      stack: false,
      autoResize:false,
      showCurrentTime: false,
      timeAxis: { scale: 'minute', step: 30 },

       // ⬅ 横軸は「仮想1日」として固定する（時刻だけ見せる）
      start: new Date(`1970-01-01T06:00:00`),
      end:   new Date(`1970-01-01T22:30:00`),
      min:   new Date(`1970-01-01T06:00:00`),
      max:   new Date(`1970-01-01T22:30:00`),
   };

   // 💡 横幅を手動で設定（15分単位で24時間＝96コマ × 25px）
   const totalBlocks = 60;
   const pxPerBlock = 20; // 1ブロックあたりの幅（px）
   const scrollWidth = totalBlocks * pxPerBlock;

   document.getElementById('timeline').style.width = scrollWidth + 'px';

   if (!timeline) {
      timeline = new vis.Timeline(container, items, groups, options);
   } else {
      timeline.setItems(items);
      timeline.setGroups(groups);
      timeline.setOptions(options);
   }
   // 👇 追加
   fixMajorLabelText(year, month);
}

// ❌ キャンセル処理（仮）
window.cancelItem = function (id) {
   alert(`予約ID ${id} をキャンセル（実装予定）`);
};

// 🔁 月切り替え
document.querySelectorAll('#monthTabs button').forEach((btn) => {
   btn.addEventListener('click', () => {
      const year = parseInt(btn.dataset.year);
      const month = parseInt(btn.dataset.month);
      drawTimeline(year, month);
   });
});
