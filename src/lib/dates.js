export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayKey(now = new Date()) {
  return toDateKey(now);
}

export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return toDateKey(date) === value;
}

export function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateKey, amount) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay.getDay();
  const days = [];

  for (let i = 0; i < startDay; i += 1) days.push(null);
  for (let d = 1; d <= lastDate; d += 1) days.push(new Date(year, month, d));

  return days;
}

export function shiftMonth(year, month, diff) {
  const next = new Date(year, month + diff, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export function formatJapaneseDate(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

export function formatLibraryDate(dateKey, todayKey) {
  if (dateKey === todayKey) return "今日";
  if (dateKey === addDays(todayKey, -1)) return "昨日";
  const date = parseDateKey(dateKey);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (date.getFullYear() === parseDateKey(todayKey).getFullYear()) return `${month}月${day}日`;
  return `${date.getFullYear()}年${month}月${day}日`;
}

export function weekdayLabel(dateKey) {
  return ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"][parseDateKey(dateKey).getDay()];
}

export function formatShortDate(dateKey) {
  const [, m, d] = dateKey.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function monthPrefix(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
