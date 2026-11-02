import { isValidDateKey } from "./dates.js";

export const KEYS = {
  records: "training-memo-app-v7",
  dayParts: "training-memo-day-parts-v1",
  customExercises: "training-memo-custom-exercises-v1",
  lastExercises: "training-memo-last-exercises-v1",
  bodyWeight: "training-memo-body-weight-v1",
};

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(storage, key) {
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return { present: false, ok: false, value: undefined };
  }

  if (raw == null) return { present: false, ok: true, value: undefined };

  try {
    return { present: true, ok: true, value: JSON.parse(raw) };
  } catch {
    return { present: true, ok: false, value: undefined };
  }
}

export function saveJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function normalizeRecords(raw) {
  const next = {};

  for (const [date, list] of Object.entries(raw || {})) {
    if (!Array.isArray(list)) {
      next[date] = list;
      continue;
    }

    const seen = new Set();
    next[date] = list.map((record, index) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return record;
      let id = record.id || `migrated-${date}-${index}`;
      if (seen.has(id)) id = `${id}-${index}`;
      seen.add(id);
      if (id === record.id) return record;
      return { ...record, id };
    });
  }

  return next;
}

function normalizeCustom(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object" && item.name)
    .map((item, index) => ({
      ...item,
      id: item.id || `custom-${index}-${item.name}`,
      name: String(item.name),
      part: typeof item.part === "string" ? item.part : "other",
    }));
}

export function normalizeBodyWeight(raw) {
  if (!isPlainObject(raw)) return {};
  const next = {};

  for (const [date, entry] of Object.entries(raw)) {
    if (!isValidDateKey(date)) continue;
    const kg = typeof entry === "number" ? entry : entry?.kg;
    if (typeof kg !== "number" || !Number.isFinite(kg)) continue;
    next[date] = {
      ...(isPlainObject(entry) ? entry : {}),
      kg,
    };
  }

  return next;
}

export function emptyAppState(warning) {
  return {
    records: {},
    dayParts: {},
    customExercises: [],
    lastExercises: {},
    bodyWeight: {},
    persist: {
      records: false,
      dayParts: false,
      customExercises: false,
      lastExercises: false,
      bodyWeight: false,
    },
    warnings: warning ? [warning] : [],
  };
}

export function loadAppState(storage) {
  const recordsRead = readJson(storage, KEYS.records);
  const dayPartsRead = readJson(storage, KEYS.dayParts);
  const customRead = readJson(storage, KEYS.customExercises);
  const lastRead = readJson(storage, KEYS.lastExercises);
  const weightRead = readJson(storage, KEYS.bodyWeight);

  const recordsOk =
    recordsRead.ok && (recordsRead.value == null || isPlainObject(recordsRead.value));
  const dayPartsOk =
    dayPartsRead.ok && (dayPartsRead.value == null || isPlainObject(dayPartsRead.value));
  const customOk = customRead.ok && (customRead.value == null || Array.isArray(customRead.value));
  const lastOk = lastRead.ok && (lastRead.value == null || isPlainObject(lastRead.value));
  const weightOk =
    weightRead.ok && (weightRead.value == null || isPlainObject(weightRead.value));

  const warnings = [];
  if (!recordsOk) warnings.push("トレーニング記録");
  if (!dayPartsOk) warnings.push("部位");
  if (!customOk) warnings.push("種目");
  if (!lastOk) warnings.push("前回の種目");
  if (!weightOk) warnings.push("体重");

  return {
    records: recordsOk ? normalizeRecords(recordsRead.value || {}) : {},
    dayParts: dayPartsOk && isPlainObject(dayPartsRead.value) ? { ...dayPartsRead.value } : {},
    customExercises: customOk ? normalizeCustom(customRead.value || []) : [],
    lastExercises: lastOk && isPlainObject(lastRead.value) ? { ...lastRead.value } : {},
    bodyWeight: weightOk ? normalizeBodyWeight(weightRead.value || {}) : {},
    persist: {
      records: recordsOk,
      dayParts: dayPartsOk,
      customExercises: customOk,
      lastExercises: lastOk,
      bodyWeight: weightOk,
    },
    warnings,
  };
}
