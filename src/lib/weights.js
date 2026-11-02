import { addDays, isValidDateKey } from "./dates.js";

export const WEIGHT_RANGES = [
  { id: "week", label: "1週間", days: 7 },
  { id: "month", label: "1ヶ月", days: 30 },
  { id: "quarter", label: "3ヶ月", days: 90 },
  { id: "all", label: "すべて", days: null },
];

export function sortedWeights(weightMap) {
  return Object.entries(weightMap || {})
    .filter(([dateKey, entry]) => isValidDateKey(dateKey) && Number.isFinite(entry?.kg))
    .map(([dateKey, entry]) => ({ dateKey, kg: entry.kg }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function filterWeightRange(entries, rangeId, todayKey) {
  const range = WEIGHT_RANGES.find((item) => item.id === rangeId) || WEIGHT_RANGES[1];
  if (!range.days) return entries;
  const start = addDays(todayKey, -(range.days - 1));
  return entries.filter((entry) => entry.dateKey >= start && entry.dateKey <= todayKey);
}

export function movingAverage(values, windowSize) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    let sum = 0;
    for (let cursor = start; cursor <= index; cursor += 1) sum += values[cursor];
    return sum / (index - start + 1);
  });
}

export function roundTenth(kg) {
  const sign = kg < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(kg) * 10)) / 10;
}

export function formatKg(kg) {
  if (!Number.isFinite(kg)) return "";
  const rounded = roundTenth(kg);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function parseKgInput(text) {
  const normalized = String(text ?? "")
    .trim()
    .replace(/,/g, ".")
    .replace(/kg$/i, "")
    .trim();

  if (!normalized) return { ok: false, empty: true };
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, empty: false };

  const kg = roundTenth(Number(normalized));
  if (kg < 15 || kg > 500) return { ok: false, empty: false, kg };
  return { ok: true, kg };
}

export function weightDelta(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return roundTenth(to - from);
}
