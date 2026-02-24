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
   const date = new Date(year, month - 1, 1);
   const end = new Date(year, month, 1);

   while (date < end) {
      const localDate = new Date(date);
      const iso = localDate.toLocaleDateString('sv-SE');
      dates.push({
         id: iso,
         content: new Date(iso).toLocaleDateString('ja-JP', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
         }),
      });
      date.setDate(date.getDate() + 1);
   }
   return dates;
}

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
   }, 300);
}

let timeline = null;

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
               group: item.date,
               start: startTime,
               end: endTime,
               content: `車種： ${item.car}<br>\u{1F464} ${item.user} <button class="cancelBtn" onclick="cancelItem(${item.id})">\u{274C}</button>`,
               style: 'background-color: #60a5fa; color: white; padding: 5px; border-radius: 6px;',
            };
         })
   );

   const options = {
      groupOrder: 'id',
      orientation: 'top',
      verticalScroll: true,
      horizontalScroll: true,
      zoomable: false,
      moveable: false,
      stack: false,
      autoResize: false,
      showCurrentTime: false,
      timeAxis: { scale: 'minute', step: 30 },
      start: new Date('1970-01-01T06:00:00'),
      end: new Date('1970-01-01T22:30:00'),
      min: new Date('1970-01-01T06:00:00'),
      max: new Date('1970-01-01T22:30:00'),
      width: '1700px', // 固定横幅
      height: '600px',
   };

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
