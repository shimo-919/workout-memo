import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import { addDays, formatJapaneseDate, isValidDateKey } from "../src/lib/dates.js";
import { KEYS, loadAppState, normalizeBodyWeight } from "../src/lib/storage.js";
import { bestRecord, currentStreak, monthStats, progressBadge } from "../src/lib/records.js";
import {
  crc32,
  createZip,
  isJpeg,
  mergeState,
  parseBackupData,
  readBackupFile,
  unzip,
} from "../src/lib/backup.js";
import { filterWeightRange, formatKg, movingAverage, parseKgInput, roundTenth } from "../src/lib/weights.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test("keeps existing training fields, including sets", () => {
  const storage = memoryStorage({
    [KEYS.records]: JSON.stringify({
      "2026-07-01": [
        {
          id: "a",
          exercise: "ベンチプレス",
          part: "chest",
          weight: "60",
          reps: "8",
          sets: "3",
          note: "残す",
        },
      ],
    }),
  });

  const state = loadAppState(storage);
  const record = state.records["2026-07-01"][0];
  assert.equal(record.sets, "3");
  assert.equal(record.note, "残す");
  assert.equal(record.weight, "60");
  assert.equal(state.persist.records, true);
});

test("does not allow a corrupt record file to be overwritten", () => {
  const storage = memoryStorage({
    [KEYS.records]: "{これは壊れている",
  });
  const state = loadAppState(storage);
  assert.deepEqual(state.records, {});
  assert.equal(state.persist.records, false);
  assert.ok(state.warnings.includes("トレーニング記録"));
});

test("assigns ids when older rows do not have one, and keeps duplicates unique", () => {
  const storage = memoryStorage({
    [KEYS.records]: JSON.stringify({
      "2026-07-02": [
        { exercise: "スクワット", weight: "自重", reps: "10" },
        { id: "same", exercise: "スクワット", weight: "40", reps: "8" },
        { id: "same", exercise: "スクワット", weight: "50", reps: "6" },
      ],
    }),
  });
  const rows = loadAppState(storage).records["2026-07-02"];
  assert.equal(rows[0].weight, "自重");
  assert.ok(rows[0].id);
  assert.notEqual(rows[1].id, rows[2].id);
});

test("reads numeric and object body-weight history", () => {
  const weights = normalizeBodyWeight({
    "2026-11-01": 62,
    "2026-11-02": { kg: 62.4, note: "朝" },
    "bad-date": 70,
    "2026-11-03": "62",
  });
  assert.equal(weights["2026-11-01"].kg, 62);
  assert.equal(weights["2026-11-02"].note, "朝");
  assert.equal(weights["bad-date"], undefined);
  assert.equal(weights["2026-11-03"], undefined);
});

test("streak counts back from today, or from yesterday if today is empty", () => {
  const today = "2026-11-02";
  const records = {
    [today]: [{ exercise: "スクワット", reps: "5" }],
    [addDays(today, -1)]: [{ exercise: "スクワット", reps: "5" }],
    [addDays(today, -2)]: [{ exercise: "スクワット", reps: "5" }],
    [addDays(today, -4)]: [{ exercise: "スクワット", reps: "5" }],
  };
  assert.equal(currentStreak(records, today), 3);

  delete records[today];
  assert.equal(currentStreak(records, today), 2);
  assert.equal(currentStreak({}, today), 0);
});

test("month volume keeps legacy set counts", () => {
  const stats = monthStats(
    {
      "2026-11-01": [{ exercise: "ベンチプレス", weight: "50", reps: "10", sets: "3" }],
      "2026-11-02": [{ exercise: "プランク", weight: "自重", reps: "60" }],
    },
    2026,
    10
  );
  assert.equal(stats.days, 2);
  assert.equal(stats.volume, 1500);
});

test("progress badge prefers weight, then reps", () => {
  assert.equal(progressBadge({ weight: "62.5", reps: "8" }, { weight: "60", reps: "10" }), "+2.5kg");
  assert.equal(progressBadge({ weight: "自重", reps: "12" }, { weight: "自重", reps: "10" }), "+2回");
  assert.equal(progressBadge({ weight: "60", reps: "10" }, { weight: "60", reps: "10" }), null);
  assert.equal(bestRecord([
    { weight: "40", reps: "12" },
    { weight: "50", reps: "5" },
  ]).weight, "50");
});

test("weight range, moving average, and input parsing", () => {
  const entries = [
    { dateKey: "2026-10-01", kg: 64 },
    { dateKey: "2026-11-01", kg: 63 },
    { dateKey: "2026-11-02", kg: 62 },
  ];
  assert.deepEqual(
    filterWeightRange(entries, "week", "2026-11-02").map((entry) => entry.dateKey),
    ["2026-11-01", "2026-11-02"]
  );
  assert.deepEqual(movingAverage([1, 2, 3, 4], 2), [1, 1.5, 2.5, 3.5]);
  assert.equal(formatKg(62), "62");
  assert.equal(formatKg(62.25), "62.3");
  assert.equal(roundTenth(-1.25), -1.3);
  assert.deepEqual(parseKgInput("62,5"), { ok: true, kg: 62.5 });
  assert.equal(parseKgInput("").empty, true);
  assert.equal(parseKgInput("2").ok, false);
  assert.equal(parseKgInput("700").ok, false);
});

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("zip roundtrip keeps unicode training data and jpeg photos", () => {
  const payload = {
    app: "workout-memo",
    version: 1,
    records: {
      "2026-11-02": [{ id: "1", exercise: "ベンチプレス", part: "chest", weight: "60", reps: "8", sets: "3" }],
    },
    dayParts: { "2026-11-02": "chest" },
    customExercises: [],
    lastExercises: {},
    bodyWeight: { "2026-11-02": { kg: 62.4 } },
  };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const zip = createZip([
    { name: "data.json", data: new TextEncoder().encode(JSON.stringify(payload)) },
    { name: "photos/2026-11-02.jpg", data: jpeg },
  ]);

  return unzip(zip).then(async (files) => {
    const data = parseBackupData(files.find((file) => file.name === "data.json").data);
    assert.equal(data.records["2026-11-02"][0].sets, "3");
    assert.equal(data.bodyWeight["2026-11-02"].kg, 62.4);
    assert.equal(isJpeg(files.find((file) => file.name.endsWith(".jpg")).data), true);

    const backup = await readBackupFile(new File([zip], "backup.zip"));
    assert.equal(backup.photos.length, 1);
    assert.equal(backup.photos[0].dateKey, "2026-11-02");
    assert.equal(backup.photos[0].blob.type, "image/jpeg");
  });
});

test("deflated zip entries can be read", async () => {
  const raw = new TextEncoder().encode("{\"records\":{}}");
  const deflated = deflateRawSync(raw);
  const name = new TextEncoder().encode("data.json");
  const crc = crc32(raw);
  const local = new Uint8Array(30);
  const view = new DataView(local.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 8, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, deflated.length, true);
  view.setUint32(22, raw.length, true);
  view.setUint16(26, name.length, true);
  const localBytes = concatBytes([local, name, deflated]);
  const central = new Uint8Array(46);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, 8, true);
  centralView.setUint32(16, crc, true);
  centralView.setUint32(20, deflated.length, true);
  centralView.setUint32(24, raw.length, true);
  centralView.setUint16(28, name.length, true);
  centralView.setUint32(42, 0, true);
  const centralBytes = concatBytes([central, name]);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, 1, true);
  eocdView.setUint16(10, 1, true);
  eocdView.setUint32(12, centralBytes.length, true);
  eocdView.setUint32(16, localBytes.length, true);
  const files = await unzip(concatBytes([localBytes, centralBytes, eocd]));
  assert.equal(new TextDecoder().decode(files[0].data), "{\"records\":{}}");
});

test("merge keeps days that exist only on this device", () => {
  const current = {
    records: {
      "2026-11-01": [{ id: "local", exercise: "スクワット", part: "leg", weight: "80", reps: "5", sets: "3" }],
      "2026-11-02": [{ id: "old", exercise: "ベンチプレス", weight: "40", reps: "10" }],
    },
    dayParts: { "2026-11-01": "leg" },
    customExercises: [{ id: "c1", name: "ヒップスラスト", part: "leg" }],
    lastExercises: { leg: "スクワット" },
    bodyWeight: { "2026-11-01": { kg: 63 } },
  };
  const incoming = parseBackupData(JSON.stringify({
    version: 1,
    records: {
      "2026-11-02": [{ exercise: "ベンチプレス", part: "chest", weight: "50", reps: "8", sets: "4" }],
    },
    dayParts: { "2026-11-02": "chest" },
    customExercises: [
      { name: "ヒップスラスト", part: "leg" },
      { name: "チンニング", part: "back" },
    ],
    lastExercises: { chest: "ベンチプレス" },
    bodyWeight: { "2026-11-02": 62.5 },
  }));
  const merged = mergeState(current, incoming);
  assert.equal(merged.records["2026-11-01"][0].sets, "3");
  assert.equal(merged.records["2026-11-02"][0].weight, "50");
  assert.equal(merged.records["2026-11-02"][0].sets, "4");
  assert.ok(merged.records["2026-11-02"][0].id);
  assert.equal(merged.bodyWeight["2026-11-01"].kg, 63);
  assert.equal(merged.bodyWeight["2026-11-02"].kg, 62.5);
  assert.equal(merged.customExercises.length, 2);
  assert.equal(merged.lastExercises.leg, "スクワット");
  assert.equal(merged.dayParts["2026-11-01"], "leg");
});

test("japanese date formatting and date keys stay local calendar days", () => {
  assert.equal(formatJapaneseDate("2026-11-02"), "2026年11月2日");
  assert.equal(isValidDateKey("2026-02-31"), false);
  assert.equal(addDays("2026-11-02", -1), "2026-11-01");
});

function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
