import { useMemo, useState } from "react";
import { CUSTOM_EXERCISE, addBodyParts, getPartLabel } from "../data/exercises.js";
import { addDays, formatLibraryDate, weekdayLabel } from "../lib/dates.js";
import CalendarMonth from "./CalendarMonth.jsx";
import { Sheet, ActionSheet } from "./Sheet.jsx";
import { IconChevron, IconPlus } from "./Icons.jsx";

function loadLine(record) {
  const weight =
    record.weight == null || record.weight === "" || record.weight === "自重"
      ? "自重"
      : `${record.weight} kg`;
  const parts = [weight];
  if (record.reps != null && record.reps !== "") parts.push(`${record.reps}回`);
  if (record.sets != null && record.sets !== "") parts.push(`${record.sets}セット`);
  return parts.join(" · ");
}

function usable(record) {
  return Boolean(record && typeof record === "object" && record.exercise);
}

export default function LogScreen({
  dateKey,
  todayKey,
  viewYear,
  viewMonth,
  records,
  exercises,
  lastByPart,
  onSelectDate,
  onChangeMonth,
  onAdd,
  onDelete,
  onRemember,
}) {
  const [part, setPart] = useState("chest");
  const [adding, setAdding] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
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
      setError("種目名を入力してください");
      return;
    }
    if (!/^\d+$/.test(String(reps)) || Number(reps) <= 0 || Number(reps) > 999) {
      setError("回数は1〜999にしてください");
      return;
    }
    let weightValue = "自重";
    if (weight.trim()) {
      const normalized = weight.trim().replace(",", ".");
      if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) > 999) {
        setError("重量は数字か、空欄で自重にしてください");
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
    setAdding(false);
  }

  return (
    <div className="logScreen">
      <div className="dateBar">
        <button type="button" className="navIconButton" aria-label="前の日" onClick={() => onSelectDate(addDays(dateKey, -1))}>
          <IconChevron />
        </button>
        <button type="button" className="dateButton" onClick={() => setCalendarOpen(true)}>
          <strong>{formatLibraryDate(dateKey, todayKey)}</strong>
          <span>{weekdayLabel(dateKey)}</span>
        </button>
        <button type="button" className="navIconButton flip" aria-label="次の日" onClick={() => onSelectDate(addDays(dateKey, 1))}>
          <IconChevron />
        </button>
      </div>

      <div className="sectionHead">
        <span>トレーニング</span>
        {dayRecords.length > 0 ? (
          <button type="button" className="navTextButton" onClick={() => setEditing((value) => !value)}>
            {editing ? "完了" : "編集"}
          </button>
        ) : null}
      </div>

      {dayRecords.length === 0 ? (
        <p className="emptyCopy">この日の記録はありません</p>
      ) : (
        <div className="group">
          {dayRecords.map((record) => (
            <div className="cell" key={record.id}>
              {editing ? (
                <button type="button" className="minus" aria-label={`${record.exercise}を削除`} onClick={() => setPendingDelete(record)}>
                  <span />
                </button>
              ) : null}
              <div className="cellBody">
                <strong>{record.exercise}</strong>
                <span>
                  {getPartLabel(record.part)} · {loadLine(record)}
                </span>
                {record.note ? <em>{record.note}</em> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <Sheet
          title="種目を追加"
          onClose={() => setAdding(false)}
          trailing={
            <button type="submit" form="add-form" className="navTextButton strong">
              追加
            </button>
          }
        >
          <form id="add-form" onSubmit={addRecord}>
            <div className="group">
              <label className="cell field">
                <span>部位</span>
                <select value={part} onChange={(event) => changePart(event.target.value)}>
                  {addBodyParts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cell field">
                <span>種目</span>
                <select value={exercise} onChange={(event) => chooseExercise(event.target.value)}>
                  {partExercises.map((item) => (
                    <option key={`${item.part}-${item.name}`} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                  <option value={CUSTOM_EXERCISE}>その他</option>
                </select>
              </label>
              {exercise === CUSTOM_EXERCISE ? (
                <label className="cell field">
                  <span>名前</span>
                  <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="種目名" autoComplete="off" />
                </label>
              ) : null}
              <label className="cell field">
                <span>重量</span>
                <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="自重" inputMode="decimal" autoComplete="off" />
              </label>
              <label className="cell field">
                <span>回数</span>
                <input value={reps} onChange={(event) => setReps(event.target.value)} inputMode="numeric" autoComplete="off" />
              </label>
              <label className="cell field">
                <span>メモ</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="任意" autoComplete="off" />
              </label>
            </div>
            {error ? <p className="formError">{error}</p> : null}
          </form>
        </Sheet>
      ) : null}

      {calendarOpen ? (
        <Sheet title="日付" onClose={() => setCalendarOpen(false)}>
          <CalendarMonth
            viewYear={viewYear}
            viewMonth={viewMonth}
            onChangeMonth={onChangeMonth}
            selectedDateKey={dateKey}
            todayKey={todayKey}
            onSelectDate={(next) => {
              onSelectDate(next);
              setCalendarOpen(false);
            }}
            getDayState={(key) => ({
              marked: Array.isArray(records[key]) && records[key].some(usable),
              dotted: false,
              label: formatLibraryDate(key, todayKey),
            })}
          />
          {dateKey !== todayKey ? (
            <button
              type="button"
              className="navTextButton center"
              onClick={() => {
                onSelectDate(todayKey);
                setCalendarOpen(false);
              }}
            >
              今日に戻る
            </button>
          ) : null}
        </Sheet>
      ) : null}

      {pendingDelete ? (
        <ActionSheet
          message={`「${pendingDelete.exercise}」を削除しますか？`}
          confirmLabel="記録を削除"
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      ) : null}

      <button type="button" className="navPlus" aria-label="種目を追加" onClick={() => setAdding(true)}>
        <IconPlus />
      </button>
    </div>
  );
}
