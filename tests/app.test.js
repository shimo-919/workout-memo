import assert from "node:assert/strict";
import test from "node:test";
import { exerciseOptions } from "../src/data/exercises.js";
import { KEYS, loadAppState } from "../src/lib/storage.js";
import { formatKg, parseKgInput } from "../src/lib/weights.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test("チンニングは背中の種目", () => {
  const item = exerciseOptions.find((exercise) => exercise.name === "チンニング");
  assert.equal(item?.part, "back");
});

test("既存の記録フィールドとメモを残す", () => {
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
    [KEYS.bodyWeight]: JSON.stringify({ "2026-07-01": { kg: 62.4 } }),
    [KEYS.dayParts]: JSON.stringify({ "2026-07-01": "chest" }),
  });
  const state = loadAppState(storage);
  const record = state.records["2026-07-01"][0];
  assert.equal(record.sets, "3");
  assert.equal(record.note, "残す");
  assert.equal(state.bodyWeight["2026-07-01"].kg, 62.4);
  assert.equal(state.dayParts["2026-07-01"], "chest");
  assert.equal(state.persist.records, true);
});

test("壊れた記録は上書きしない", () => {
  const state = loadAppState(memoryStorage({ [KEYS.records]: "{壊れている" }));
  assert.equal(state.persist.records, false);
  assert.deepEqual(state.records, {});
});

test("体重の入力", () => {
  assert.equal(formatKg(62.4), "62.4");
  assert.deepEqual(parseKgInput("62,5"), { ok: true, kg: 62.5 });
  assert.equal(parseKgInput("2").ok, false);
});
