function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDailyTimeRange(startDate, startTime, endTime) {
  return [{ date: startDate, startTime, endTime }];
}

function buildMultiDayTimeRanges(startDateText, endDateText, startTime, endTime) {
  const ranges = [];
  const [sy, sm, sd] = startDateText.split('-').map(Number);
  const [ey, em, ed] = endDateText.split('-').map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  while (current <= end) {
    const dateText = formatLocalDate(current);
    const isFirst = dateText === startDateText;
    const isLast = dateText === endDateText;

    const dayStart = isFirst ? startTime : '00:00';
    const dayEnd = isLast ? endTime : '24:00';
    ranges.push({ date: dateText, startTime: dayStart, endTime: dayEnd });

    current.setDate(current.getDate() + 1);
  }

  return ranges;
}

function toMinutes(timeText) {
  const [h, m] = timeText.split(':').map(Number);
  return h * 60 + m;
}

async function hasConflict(car, ranges) {
  for (const range of ranges) {
    const snapshot = await db
      .collection('car_reservations')
      .where('car', '==', car)
      .where('date', '==', range.date)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (range.startTime < data.endTime && range.endTime > data.startTime) {
        return `${range.date} ${range.startTime}-${range.endTime}`;
      }
    }
  }

  return null;
}

document.getElementById('reservationForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const car = document.getElementById('selectedCar').value;
  const memo = document.getElementById('memo').value;
  const multiDay = document.getElementById('multiDayToggle').checked;
  const submitBtn = document.getElementById('submitBtn');

  if (!car || !startDate || !endDate || !startTime || !endTime) {
    alert('必須項目を入力してください。');
    return;
  }

  if (!validateTimeRange()) {
    return;
  }

  if (multiDay && startDate === endDate && toMinutes(endTime) <= toMinutes(startTime)) {
    alert('同日予約の場合、終了時間は開始時間より後にしてください。');
    return;
  }

  if (submitBtn.disabled) {
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerText;
  submitBtn.innerText = '登録中...';

  try {
    const ranges = multiDay
      ? buildMultiDayTimeRanges(startDate, endDate, startTime, endTime)
      : buildDailyTimeRange(startDate, startTime, endTime);

    const conflict = await hasConflict(car, ranges);
    if (conflict) {
      alert(`既に予約されています: ${conflict}`);
      return;
    }

    const uid = auth.currentUser.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const username = userDoc.exists ? userDoc.data().username : '未登録';

    const calendarApiUrl =
      'https://script.google.com/macros/s/AKfycbzdsWjVm75VoFfdNd5m4ir3bs-S5BJVe2MyWmrkJsuPUTmoGmQ7dRPxFoCBQ2U905VJ/exec';

    const reservations = [];

    for (const range of ranges) {
      const params = new URLSearchParams({
        action: 'add',
        user: username,
        car,
        memo,
        date: range.date,
        starttime: range.startTime,
        endtime: range.endTime,
        colorId: '6',
      });

      const res = await fetch(calendarApiUrl, { method: 'POST', body: params });
      const result = await res.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'Google Calendar登録失敗');
      }

      reservations.push({
        car,
        date: range.date,
        startTime: range.startTime,
        endTime: range.endTime,
        memo,
        uid,
        username,
        createdAt: new Date(),
        eventId: result.eventId,
      });
    }

    const batch = db.batch();
    reservations.forEach((data) => {
      batch.set(db.collection('car_reservations').doc(), data);
    });
    await batch.commit();

    alert('予約を登録しました。');
    if (typeof window.refreshCarTimeline === 'function') {
      await window.refreshCarTimeline();
    }
    document.getElementById('reservationForm').reset();
  } catch (err) {
    console.error('予約登録エラー:', err);
    alert(`予約登録に失敗しました。\n${err.message || ''}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = originalText;
  }
});
