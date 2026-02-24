const timelineContainer = document.getElementById('timeline');
let timeline = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;

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

async function drawTimeline(year, month) {
  currentYear = year;
  currentMonth = month;

  const groups = new vis.DataSet(getMonthDates(year, month));
  const reservations = await fetchReservations(year, month);

  const items = new vis.DataSet(
    reservations.flatMap((reservation) =>
      splitReservationByDay(reservation).map((segment, idx) => ({
        id: `${reservation.id}-${idx}`,
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
    horizontalScroll: true,
    zoomable: false,
    moveable: false,
    stack: false,
    showCurrentTime: false,
    timeAxis: { scale: 'minute', step: 30 },
    start: new Date('1970-01-01T06:00:00'),
    end: new Date('1970-01-01T22:30:00'),
    min: new Date('1970-01-01T00:00:00'),
    max: new Date('1970-01-01T23:59:59'),
    width: isMobile ? '1800px' : '2400px',
    height: isMobile ? '560px' : '680px',
    margin: {
      item: 12,
      axis: 10,
    },
  };

  if (!timeline) {
    timeline = new vis.Timeline(timelineContainer, items, groups, options);
  } else {
    timeline.setItems(items);
    timeline.setGroups(groups);
    timeline.setOptions(options);
  }
}

window.drawTimeline = drawTimeline;
window.refreshCarTimeline = () => drawTimeline(currentYear, currentMonth);
