export const bodyParts = [
  { id: "all", label: "全部" },
  { id: "chest", label: "胸" },
  { id: "back", label: "背中" },
  { id: "shoulder", label: "肩" },
  { id: "arm", label: "腕" },
  { id: "leg", label: "脚" },
  { id: "core", label: "腹" },
  { id: "cardio", label: "有酸素" },
];

export const addBodyParts = [
  { id: "chest", label: "胸" },
  { id: "back", label: "背中" },
  { id: "shoulder", label: "肩" },
  { id: "arm", label: "腕" },
  { id: "leg", label: "脚" },
  { id: "core", label: "腹" },
  { id: "cardio", label: "有酸素" },
  { id: "other", label: "その他" },
];

export const filterParts = [...bodyParts, { id: "other", label: "その他" }];

export const exerciseOptions = [
  { name: "ベンチプレス", part: "chest" },
  { name: "ダンベルプレス", part: "chest" },
  { name: "チェストプレス", part: "chest" },
  { name: "ラットプルダウン", part: "back" },
  { name: "チンニング", part: "back" },
  { name: "シーテッドロー", part: "back" },
  { name: "デッドリフト", part: "back" },
  { name: "サイドレイズ", part: "shoulder" },
  { name: "ショルダープレス", part: "shoulder" },
  { name: "リアレイズ", part: "shoulder" },
  { name: "アームカール", part: "arm" },
  { name: "ハンマーカール", part: "arm" },
  { name: "トライセプスプレスダウン", part: "arm" },
  { name: "スクワット", part: "leg" },
  { name: "レッグプレス", part: "leg" },
  { name: "レッグカール", part: "leg" },
  { name: "腹筋", part: "core" },
  { name: "プランク", part: "core" },
  { name: "レッグレイズ", part: "core" },
  { name: "ランニング", part: "cardio" },
  { name: "バイク", part: "cardio" },
  { name: "ウォーキング", part: "cardio" },
  { name: "その他", part: "other" },
];

const LABELS = Object.fromEntries(
  [...bodyParts, ...addBodyParts].map((part) => [part.id, part.label])
);

export function getPartLabel(partId) {
  return LABELS[partId] || "その他";
}

export function getExercisePart(exerciseName, customExercises = []) {
  return (
    exerciseOptions.find((exercise) => exercise.name === exerciseName)?.part ||
    customExercises.find((exercise) => exercise.name === exerciseName)?.part ||
    "other"
  );
}

export const CUSTOM_EXERCISE = "__custom__";
