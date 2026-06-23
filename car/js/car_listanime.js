const timelineContainer = document.getElementById('timeline');
const cancelModal = document.getElementById('cancelModal');
const cancelModalMessage = document.getElementById('cancelModalMessage');
const cancelModalUser = document.getElementById('cancelModalUser');
const cancelModalCar = document.getElementById('cancelModalCar');
const cancelModalDateTime = document.getElementById('cancelModalDateTime');
const cancelModalMemo = document.getElementById('cancelModalMemo');
const cancelModalConfirm = document.getElementById('cancelModalConfirm');
const cancelModalClose = document.getElementById('cancelModalClose');
const cancelModalDismiss = document.getElementById('cancelModalDismiss');

let timeline = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let selectedReservation = null;
const reservationIndex = new Map();

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthDates(year, month) {
  const dates = [];
  const date = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  while (date < end) {
    const localDate = new Date(date);
    const iso = formatLocalDate(localDate);
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

function splitReservationByDay(reservation) {
  const segments = [];
  const isSingleDay = reservation.startTime < reservation.endTime;

  if (isSingleDay) {
    segments.push({
      date: reservation.date,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    });
    return segments;
  }

  const [y, m, d] = reservation.date.split('-').map(Number);
  const nextDate = new Date(y, m - 1, d);
  nextDate.setDate(nextDate.getDate() + 1);

  segments.push({
    date: reservation.date,
    startTime: reservation.startTime,
    endTime: '24:00',
  });
  segments.push({
    date: formatLocalDate(nextDate),
    startTime: '00:00',
    endTime: reservation.endTime,
  });

  return segments;
}

function normalizeTimeForVis(timeText) {
  if (timeText === '24:00') {
    return '23:59:59';
  }
  return `${timeText}:00`;
}

function getReservationDateTimeText(reservation) {
  return `${reservation.date} ${reservation.startTime}-${reservation.endTime}`;
}

function getReservationSummaryText(reservation) {
  if (!reservation.groupId) {
    return getReservationDateTimeText(reservation);
  }

  const groupedReservations = Array.from(reservationIndex.values())
    .filter((item) => item.groupId === reservation.groupId)
    .sort((a, b) => {
      const aKey = `${a.date} ${a.startTime}`;
      const bKey = `${b.date} ${b.startTime}`;
      return aKey.localeCompare(bKey);
    });

  if (groupedReservations.length <= 1) {
    return getReservationDateTimeText(reservation);
  }

  const first = groupedReservations[0];
  const last = groupedReservations[groupedReservations.length - 1];
  return `${first.date} ${first.startTime} - ${last.date} ${last.endTime}`;
}

function canCancelReservation(reservation) {
  const user = auth.currentUser;
  return Boolean(user && (user.uid === reservation.uid || user.email === 'y-okayama@perva.co.jp'));
}

function setModalOpen(isOpen) {
  cancelModal.classList.toggle('hidden', !isOpen);
  cancelModal.setAttribute('aria-hidden', String(!isOpen));
}

function closeCancelModal() {
  selectedReservation = null;
  cancelModalConfirm.disabled = false;
  cancelModalConfirm.hidden = false;
  cancelModalConfirm.textContent = '予約を取り消す';
  setModalOpen(false);

  if (timeline) {
    timeline.setSelection([]);
  }
}

function openCancelModal(reservation) {
  selectedReservation = reservation;
  cancelModalUser.textContent = reservation.username || '不明';
  cancelModalCar.textContent = reservation.car || '不明';
  cancelModalDateTime.textContent = getReservationSummaryText(reservation);
  cancelModalMemo.textContent = reservation.memo || 'なし';

  if (canCancelReservation(reservation)) {
    cancelModalMessage.textContent = reservation.groupId
      ? 'この複数日予約をまとめて取り消しますか？'
      : 'この予約を取り消しますか？';
    cancelModalConfirm.hidden = false;
  } else {
    cancelModalMessage.textContent =
      'この予約は表示のみです。取り消しできるのは予約者本人または管理者です。';
    cancelModalConfirm.hidden = true;
  }

  setModalOpen(true);
}

async function fetchReservations(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const snapshot = await db
    .collection('car_reservations')
    .where('date', '>=', formatLocalDate(startDate))
    .where('date', '<', formatLocalDate(endDate))
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function buildItemContent(reservation, segment) {
  return `<strong>${segment.startTime}-${segment.endTime}</strong><br>${reservation.username || '不明'} / ${reservation.car}`;
}

function buildItemTitle(reservation, segment) {
  return [
    `利用者: ${reservation.username || '不明'}`,
    `車: ${reservation.car}`,
    `日時: ${segment.date} ${segment.startTime}-${segment.endTime}`,
    reservation.memo ? `メモ: ${reservation.memo}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function deleteReservation(reservation) {
  let reservationsToDelete = [reservation];

  if (reservation.groupId) {
    const snapshot = await db
      .collection('car_reservations')
      .where('groupId', '==', reservation.groupId)
      .get();

    reservationsToDelete = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  for (const item of reservationsToDelete) {
    if (item.eventId) {
      const params = new URLSearchParams({
        action: 'delete',
        eventId: item.eventId,
      });

      await fetch(window.carCalendarApiUrl, {
        method: 'POST',
        body: params,
      });
    }
  }

  const batch = db.batch();
  reservationsToDelete.forEach((item) => {
    batch.delete(db.collection('car_reservations').doc(item.id));
  });
  await batch.commit();
}

async function drawTimeline(year, month) {
  currentYear = year;
  currentMonth = month;

  const reservations = await fetchReservations(year, month);
  reservationIndex.clear();
  reservations.forEach((reservation) => {
    reservationIndex.set(reservation.id, reservation);
  });

  const groups = new vis.DataSet(getMonthDates(year, month));
  const items = new vis.DataSet(
    reservations.flatMap((reservation) =>
      splitReservationByDay(reservation).map((segment, idx) => ({
        id: `${reservation.id}-${idx}`,
        reservationId: reservation.id,
        group: segment.date,
        start: new Date(`1970-01-01T${normalizeTimeForVis(segment.startTime)}`),
        end: new Date(`1970-01-01T${normalizeTimeForVis(segment.endTime)}`),
        content: buildItemContent(reservation, segment),
        title: buildItemTitle(reservation, segment),
        className: 'reservation-item',
      }))
    )
  );

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const options = {
    groupOrder: 'id',
    orientation: 'top',
    verticalScroll: true,
    horizontalScroll: false,
    zoomable: false,
    moveable: false,
    stack: false,
    showCurrentTime: false,
    showMajorLabels: false,
    timeAxis: { scale: 'minute', step: 30 },
    start: new Date('1970-01-01T06:00:00'),
    end: new Date('1970-01-01T22:30:00'),
    min: new Date('1970-01-01T00:00:00'),
    max: new Date('1970-01-01T23:59:59'),
    width: '2400px',
    height: isMobile ? '560px' : '680px',
    margin: {
      item: 12,
      axis: 10,
    },
  };

  if (!timeline) {
    timeline = new vis.Timeline(timelineContainer, items, groups, options);
    timeline.on('select', ({ items: selectedItems }) => {
      const selectedItemId = selectedItems[0];
      if (!selectedItemId) {
        return;
      }

      const item = timeline.itemsData.get(selectedItemId);
      const reservation = reservationIndex.get(item?.reservationId);
      if (!reservation) {
        timeline.setSelection([]);
        return;
      }

      openCancelModal(reservation);
    });
  } else {
    timeline.setItems(items);
    timeline.setGroups(groups);
    timeline.setOptions(options);
  }
}

window.drawTimeline = drawTimeline;
window.refreshCarTimeline = () => drawTimeline(currentYear, currentMonth);

(function setupTransformPan() {
  const wrap = document.querySelector('.timeline-wrap');
  if (!wrap) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;

  const panShell = document.createElement('div');
  panShell.className = 'timeline-pan-shell';
  wrap.insertBefore(panShell, timelineContainer);
  panShell.appendChild(timelineContainer);

  const overlay = document.createElement('div');
  overlay.className = 'timeline-pan-overlay';
  wrap.appendChild(overlay);

  let translateX = 0;
  let startX = null;
  let startY = null;
  let startTranslate = 0;
  let mode = null;

  function clamp() {
    const minX = Math.min(0, wrap.clientWidth - panShell.scrollWidth);
    if (translateX > 0) translateX = 0;
    if (translateX < minX) translateX = minX;
  }

  function apply() {
    panShell.style.transform = `translate3d(${translateX}px, 0, 0)`;
  }

  overlay.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].pageX;
      startY = e.touches[0].pageY;
      startTranslate = translateX;
      mode = null;
    },
    { passive: true }
  );

  overlay.addEventListener(
    'touchmove',
    (e) => {
      if (startX === null) return;
      const dx = e.touches[0].pageX - startX;
      const dy = e.touches[0].pageY - startY;

      if (mode === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }

      if (mode === 'h') {
        translateX = startTranslate + dx;
        clamp();
        apply();
        if (e.cancelable) e.preventDefault();
      }
    },
    { passive: false }
  );

  overlay.addEventListener(
    'touchend',
    () => {
      startX = null;
      startY = null;
      mode = null;
    },
    { passive: true }
  );

  overlay.addEventListener('click', (e) => {
    overlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    overlay.style.pointerEvents = '';
    const itemEl = target && target.closest('.vis-item');
    if (!itemEl || !timeline) return;
    const segmentId = Array.from(timeline.itemsData.getIds()).find((id) => {
      const node = timeline.itemSet.items[id]?.dom?.box || timeline.itemSet.items[id]?.dom?.point;
      return node && (node === itemEl || node.contains(itemEl));
    });
    if (!segmentId) return;
    const item = timeline.itemsData.get(segmentId);
    const reservation = reservationIndex.get(item?.reservationId);
    if (reservation) openCancelModal(reservation);
  });
})();

cancelModalClose.addEventListener('click', closeCancelModal);
cancelModalDismiss.addEventListener('click', closeCancelModal);

cancelModal.addEventListener('click', (event) => {
  if (event.target === cancelModal) {
    closeCancelModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cancelModal.classList.contains('hidden')) {
    closeCancelModal();
  }
});

cancelModalConfirm.addEventListener('click', async () => {
  if (!selectedReservation || !canCancelReservation(selectedReservation)) {
    return;
  }

  cancelModalConfirm.disabled = true;
  cancelModalConfirm.textContent = '取り消し中...';

  try {
    await deleteReservation(selectedReservation);
    closeCancelModal();
    await window.refreshCarTimeline();
    alert('予約を取り消しました。');
  } catch (error) {
    console.error('予約取消エラー:', error);
    cancelModalConfirm.disabled = false;
    cancelModalConfirm.textContent = '予約を取り消す';
    alert(`予約取消に失敗しました。\n${error.message || ''}`);
  }
});
