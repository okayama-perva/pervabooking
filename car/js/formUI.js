
// 🔧 初期状態：単一日
const dateSection = document.getElementById('dateSection');
const multiDayToggle = document.getElementById('multiDayToggle');
const singleDateInput = document.getElementById('singleDate');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');

const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');

// 初期状態：終了日は触れない
endDate.disabled = true;
endDate.value = startDate.value;

// 開始日変更時に、終了日へ同期（単一予約時）
startDate.addEventListener('change', () => {
   const nextDay = new Date(startDate.value);
   nextDay.setDate(nextDay.getDate() + 1);
   endDate.value = nextDay.toISOString().split('T')[0];
});

// チェック切り替えで有効/無効切り替え
multiDayToggle.addEventListener('change', () => {
   if (multiDayToggle.checked) {
      endDate.disabled = false;
   } else {
      endDate.disabled = true;
      endDate.value = startDate.value;
   }
});

const submitBtn = document.getElementById('submitBtn');

submitBtn.addEventListener('click', () => {
   // エラーリセット
   startDate.classList.remove('border-red-500');
   endDate.classList.remove('border-red-500');

   if (multiDayToggle.checked) {
      const start = new Date(startDate.value);
      const end = new Date(endDate.value);

      if (start > end) {
         alert('終了日は開始日と同じか後の日付を選んでください。');

         // 赤枠で強調
         startDate.classList.add('border-red-500');
         endDate.classList.add('border-red-500');
         return; // 保存処理などがある場合はここで中断
      }
   }
});

// 🔁 日付変更時にリアルタイムでバリデーション
[startDate, endDate].forEach((el) => {
   el.addEventListener('change', validateDates);
});

function validateDates() {
   // エラーリセット
   startDate.classList.remove('border-red-500');
   endDate.classList.remove('border-red-500');

   if (multiDayToggle.checked) {
      const start = new Date(startDate.value);
      const end = new Date(endDate.value);

      // 両方入力されているときだけ比較（空欄で比較するとエラーになるので）
      if (startDate.value && endDate.value && start > end) {
         alert('終了日は開始日と同じか後の日付を選んでください。');
         startDate.classList.add('border-red-500');
         endDate.classList.add('border-red-500');
      }
   }
}
function generateTimeOptions(selectElement, defaultTime) {
   const startHour = 6;
   const endHour = 22;

   for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
         if (hour === endHour && minute > 0) break;

         const h = String(hour).padStart(2, '0');
         const m = String(minute).padStart(2, '0');
         const timeStr = `${h}:${m}`;

         const option = document.createElement('option');
         option.value = timeStr;
         option.textContent = timeStr;
         if (timeStr === defaultTime) {
            option.selected = true;
         }

         selectElement.appendChild(option);
      }
   }
}

// 実行
generateTimeOptions(document.getElementById('startTime'), '09:00');
generateTimeOptions(document.getElementById('endTime'), '10:00');

function validateTimeRange() {
   const multiDay = document.getElementById('multiDayToggle').checked;
   const startTime = document.getElementById('startTime').value;
   const endTime = document.getElementById('endTime').value;

   if (!multiDay) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);

      const startTotal = sh * 60 + sm;
      const endTotal = eh * 60 + em;

      if (endTotal <= startTotal) {
         alert('終了時間は開始時間より後にしてください。');
         return false;
      }
   }

   return true;
}
