import { useMemo, useState } from "react";
import { CUSTOM_EXERCISE, addBodyParts, getPartLabel } from "../data/exercises.js";
import { formatJapaneseDate } from "../lib/dates.js";

function loadLine(record) {
  const weight =
    record.weight == null || record.weight === "" || record.weight === "自重"
      ? "自重"
      : `${record.weight}kg`;
  const parts = [weight];
  if (record.reps != null && record.reps !== "") parts.push(`${record.reps}回`);
  if (record.sets != null && record.sets !== "") parts.push(`${record.sets}セット`);
  return parts.join(" × ");
}

function usable(record) {
  return Boolean(record && typeof record === "object" && record.exercise);
}

export default function LogScreen({
  dateKey,
  records,
  exercises,
  lastByPart,
  onAdd,
  onDelete,
  onRemember,
}) {
  const [part, setPart] = useState("chest");
  const partExercises = useMemo(
    () => exercises.filter((item) => item.part === part && item.name !== "その他"),
    [exercises, part]
  );
  const [exercise, setExercise] = useState(() => {
    const first = exercises.filter((item) => item.part === "chest" && item.name !== "その他");
    const remembered = lastByPart?.chest;
    return first.some((item) => item.name === remembered) ? remembered : first[0]?.name || CUSTOM_EXERCISE;
  });
  const [customName, setCustomName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("10");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const dayRecords = (Array.isArray(records[dateKey]) ? records[dateKey] : []).filter(usable);

  function changePart(nextPart) {
    setPart(nextPart);
    const options = exercises.filter((item) => item.part === nextPart && item.name !== "その他");
    const remembered = lastByPart?.[nextPart];
    setExercise(options.some((item) => item.name === remembered) ? remembered : options[0]?.name || CUSTOM_EXERCISE);
    setCustomName("");
  }

  function chooseExercise(next) {
    setExercise(next);
    if (next !== CUSTOM_EXERCISE) onRemember(part, next);
  }

  function addRecord(event) {
    event.preventDefault();
    const name = exercise === CUSTOM_EXERCISE ? customName.trim() : exercise;
    if (!name) {
      setError("種目名を入力してね");
      return;
    }
    if (!/^\d+$/.test(reps) || Number(reps) <= 0 || Number(reps) > 999) {
      setError("回数は1〜999にしてね");
      return;
    }
    let weightValue = "自重";
    if (weight.trim()) {
      const normalized = weight.trim().replace(",", ".");
      if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) > 999) {
        setError("重量は数字か、空欄（自重）にしてね");
        return;
      }
      weightValue = String(Number(normalized));
    }

    onAdd({
      exercise: name,
      part,
      weight: weightValue,
      reps: String(Number(reps)),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setNote("");
    setError("");
    if (exercise === CUSTOM_EXERCISE) setCustomName("");
  }

  return (
    <div className="panel">
      <p className="hint">選択中の日付</p>
      <h2>{formatJapaneseDate(dateKey)}</h2>

      <form className="addBox" onSubmit={addRecord}>
        <label>
          部位
          <select value={part} onChange={(event) => changePart(event.target.value)}>
            {addBodyParts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          種目
          <select value={exercise} onChange={(event) => chooseExercise(event.target.value)}>
            {partExercises.map((item) => (
              <option key={`${item.part}-${item.name}`} value={item.name}>
                {item.name}
              </option>
            ))}
            <option value={CUSTOM_EXERCISE}>リストにない種目</option>
          </select>
        </label>
        {exercise === CUSTOM_EXERCISE ? (
          <label>
            種目名
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="例：ケーブルロウ"
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="inputGrid">
          <label>
            重量（kg）
            <input
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="空欄で自重"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <label>
            回数
            <input
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
        </div>
        <label>
          メモ
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="調子やフォームなど"
            autoComplete="off"
          />
        </label>
        {error ? <p className="fieldError">{error}</p> : null}
        <button type="submit" className="mainButton">
          追加する
        </button>
      </form>

      <div className="recordList">
        <h3>この日のトレーニング</h3>
        {dayRecords.length === 0 ? (
          <p className="hint">この日の記録はまだないよ。</p>
        ) : (
          dayRecords.map((record) => (
            <article className="recordItem" key={record.id}>
              <div>
                <h4>{record.exercise}</h4>
                <p>
                  {getPartLabel(record.part)} · {loadLine(record)}
                </p>
                {record.note ? <p className="noteText">{record.note}</p> : null}
              </div>
              <button type="button" className="textButton" onClick={() => onDelete(record.id)}>
                削除
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
