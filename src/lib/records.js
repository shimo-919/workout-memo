import { addDays, monthPrefix } from "./dates.js";
import { getExercisePart } from "../data/exercises.js";

export function recordPart(record, customExercises = []) {
  return record?.part || getExercisePart(record?.exercise, customExercises);
}

export function isUsableRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      typeof record.exercise === "string" &&
      record.exercise
  );
}

export function formatWeightValue(weight) {
  if (weight == null || weight === "" || weight === "自重") return "自重";
  return `${weight}kg`;
}

export function formatRecordLoad(record) {
  const parts = [formatWeightValue(record?.weight)];
  if (record?.reps != null && record.reps !== "") parts.push(`${record.reps}回`);
  if (record?.sets != null && record.sets !== "") parts.push(`${record.sets}セット`);
  return parts.join(" × ");
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function bestRecord(records) {
  return records.reduce((best, record) => {
    if (!best) return record;
    const weight = numeric(record.weight);
    const bestWeight = numeric(best.weight);
    const left = weight == null ? -1 : weight;
    const right = bestWeight == null ? -1 : bestWeight;
    if (left !== right) return left > right ? record : best;
    return (numeric(record.reps) || -1) > (numeric(best.reps) || -1) ? record : best;
  }, null);
}

export function findPreviousSession(records, dateKey, exercise) {
  const dates = Object.keys(records)
    .filter((key) => key < dateKey)
    .sort((a, b) => b.localeCompare(a));

  for (const key of dates) {
    const matches = (Array.isArray(records[key]) ? records[key] : []).filter(
      (record) => isUsableRecord(record) && record.exercise === exercise
    );
    if (matches.length > 0) {
      return { dateKey: key, records: matches, best: bestRecord(matches) };
    }
  }

  return null;
}

export function progressBadge(current, previous) {
  if (!previous) return null;
  const currentWeight = numeric(current.weight);
  const previousWeight = numeric(previous.weight);

  if (currentWeight != null && previousWeight != null && currentWeight > previousWeight) {
    const diff = Math.round((currentWeight - previousWeight) * 100) / 100;
    return `+${diff}kg`;
  }

  const currentReps = numeric(current.reps);
  const previousReps = numeric(previous.reps);
  const sameWeight =
    (currentWeight == null && previousWeight == null) || currentWeight === previousWeight;

  if (sameWeight && currentReps != null && previousReps != null && currentReps > previousReps) {
    return `+${currentReps - previousReps}回`;
  }

  return null;
}

export function currentStreak(records, todayKey) {
  const dates = new Set(
    Object.entries(records)
      .filter(([, list]) => Array.isArray(list) && list.some(isUsableRecord))
      .map(([date]) => date)
  );

  let cursor = dates.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;

  while (dates.has(cursor) && streak < 5000) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function monthStats(records, year, month) {
  const prefix = `${monthPrefix(year, month)}-`;
  const days = new Set();
  let volume = 0;
  let entries = 0;

  for (const [dateKey, list] of Object.entries(records)) {
    if (!dateKey.startsWith(prefix) || !Array.isArray(list)) continue;

    for (const record of list) {
      if (!isUsableRecord(record)) continue;
      days.add(dateKey);
      entries += 1;
      const weight = numeric(record.weight);
      const reps = numeric(record.reps);
      const sets = numeric(record.sets);
      const setCount = sets != null && sets > 0 ? sets : 1;
      if (weight != null && weight > 0 && reps != null && reps > 0) {
        volume += weight * reps * setCount;
      }
    }
  }

  return { days: days.size, volume: Math.round(volume), entries };
}

export function exerciseTrends(records, partFilter = "all", customExercises = []) {
  const byName = new Map();
  const dates = Object.keys(records).sort((a, b) => a.localeCompare(b));

  for (const dateKey of dates) {
    const list = Array.isArray(records[dateKey]) ? records[dateKey] : [];
    const grouped = new Map();

    for (const record of list) {
      if (!isUsableRecord(record)) continue;
      if (partFilter !== "all" && recordPart(record, customExercises) !== partFilter) continue;
      const rows = grouped.get(record.exercise) || [];
      rows.push(record);
      grouped.set(record.exercise, rows);
    }

    for (const [name, rows] of grouped) {
      const best = bestRecord(rows);
      const series = byName.get(name) || [];
      series.push({
        dateKey,
        weight: numeric(best.weight),
        reps: numeric(best.reps) || 0,
        label: formatRecordLoad(best),
      });
      byName.set(name, series);
    }
  }

  return [...byName.entries()]
    .map(([name, points]) => ({
      name,
      points,
      latest: points[points.length - 1],
      previous: points.length > 1 ? points[points.length - 2] : null,
    }))
    .filter((row) => row.points.length >= 2)
    .sort(
      (a, b) =>
        b.latest.dateKey.localeCompare(a.latest.dateKey) || a.name.localeCompare(b.name, "ja")
    )
    .slice(0, 8);
}

export function parseTrainingNumber(value, { max, decimal = false } = {}) {
  const text = String(value ?? "").trim().replace(/,/g, ".");
  if (!text) return { empty: true, ok: false };
  const pattern = decimal ? /^\d+(\.\d+)?$/ : /^\d+$/;
  if (!pattern.test(text)) return { empty: false, ok: false };
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0 || number > max) return { empty: false, ok: false };
  return { empty: false, ok: true, value: String(number) };
}
