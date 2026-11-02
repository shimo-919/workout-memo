import { useMemo, useState } from "react";
import { CUSTOM_EXERCISE, addBodyParts, getPartLabel } from "../data/exercises.js";
import { addDays, formatJapaneseDate, formatLibraryDate, parseDateKey, weekdayLabel } from "../lib/dates.js";
import { bestRecord, currentStreak, findPreviousSession, formatRecordLoad, monthStats } from "../lib/records.js";
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

function parseFields(weight, reps, sets) {
  if (!/^\d+$/.test(String(reps)) || Number(reps) <= 0 || Number(reps) > 999) {
    return { error: "回数は1〜999にしてください" };
  }
  let weightValue = "自重";
  if (String(weight).trim()) {
    const normalized = String(weight).trim().replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(normalized) || Number(normalized) > 999) {
      return { error: "重量は数字か、空欄で自重にしてください" };
    }
    weightValue = String(Number(normalized));
  }
  let setsValue = null;
  if (String(sets).trim()) {
    if (!/^\d+$/.test(String(sets)) || Number(sets) <= 0 || Number(sets) > 99) {
      return { error: "セット数は1〜99にしてください" };
    }
    setsValue = String(Number(sets));
  }
  return { weightValue, repsValue: String(Number(reps)), setsValue };
}

function historyFor(records, name) {
  return Object.keys(records)
    .sort()
    .flatMap((dateKey) => {
      const list = (records[dateKey] || []).filter((record) => usable(record) && record.exercise === name);
      if (list.length === 0) return [];
      const best = bestRecord(list);
      const weight = Number(best.weight);
      return [{
        dateKey,
        weight: Number.isFinite(weight) ? weight : null,
        reps: Number(best.reps) || 0,
        label: formatRecordLoad(best),
      }];
    });
}

function MiniChart({ points }) {
  const numeric = points.filter((point) => point.weight != null);
  const series = numeric.length >= 1 ? numeric : points;
  const read = numeric.length >= 1 ? (point) => point.weight : (point) => point.reps;
  if (series.length === 0) return <p className="emptyCopy">まだ履歴がありません</p>;
  const width = 320;
  const height = 140;
  const pad = { left: 28, right: 8, top: 12, bottom: 22 };
  const values = series.map(read);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xAt = (index) => pad.left + (series.length === 1 ? innerW / 2 : (innerW * index) / (series.length - 1));
  const yAt = (value) => pad.top + ((max - value) / (max - min || 1)) * innerH;
  const line = series.map((point, index) => `${index ? "L" : "M"}${xAt(index).toFixed(1)} ${yAt(read(point)).toFixed(1)}`).join(" ");
  return (
    <svg className="trendChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="種目の推移">
      <path className="chartLine" d={line} />
      {series.map((point, index) => (
        <circle key={point.dateKey} className="chartDot" cx={xAt(index)} cy={yAt(read(point))} r="3" />
      ))}
    </svg>
  );
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
  onUpdate,
  onDelete,
  onMove,
  onRemember,
}) {
  const [part, setPart] = useState("chest");
  const [adding, setAdding] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [historyName, setHistoryName] = useState(null);
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
  const [sets, setSets] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const dayRecords = (Array.isArray(records[dateKey]) ? records[dateKey] : []).filter(usable);
  const exerciseName = exercise === CUSTOM_EXERCISE ? customName.trim() : exercise;
  const previous = exerciseName ? findPreviousSession(records, dateKey, exerciseName) : null;
  const viewed = parseDateKey(dateKey);
  const stats = monthStats(records, viewed.getFullYear(), viewed.getMonth());
  const streak = currentStreak(records, todayKey);
  const history = historyName ? historyFor(records, historyName) : [];

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
    const parsed = parseFields(weight, reps, sets);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    onAdd({
      exercise: name,
      part,
      weight: parsed.weightValue,
      reps: parsed.repsValue,
      ...(parsed.setsValue ? { sets: parsed.setsValue } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setNote("");
    setError("");
    if (exercise === CUSTOM_EXERCISE) setCustomName("");
    setAdding(false);
  }

  function saveEdit(event) {
    event.preventDefault();
    const parsed = parseFields(weight, reps, sets);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    onUpdate(editingRecord.id, {
      weight: parsed.weightValue,
      reps: parsed.repsValue,
      sets: parsed.setsValue,
      note: note.trim() || null,
    });
    setEditingRecord(null);
    setError("");
  }

  function openEdit(record) {
    setEditingRecord(record);
    setWeight(record.weight === "自重" ? "" : String(record.weight ?? ""));
    setReps(String(record.reps ?? ""));
    setSets(record.sets == null ? "" : String(record.sets));
    setNote(record.note || "");
    setError("");
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

      <div className="group stats">
        <div>
          <strong>{stats.days}</strong>
          <span>日数</span>
        </div>
        <div>
          <strong>{streak}</strong>
          <span>連続</span>
        </div>
        <div>
          <strong>{stats.volume ? stats.volume.toLocaleString("ja-JP") : "0"}</strong>
          <span>kg</span>
        </div>
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
          {dayRecords.map((record, index) => (
            <div className="cell" key={record.id}>
              {editing ? (
                <button type="button" className="minus" aria-label={`${record.exercise}を削除`} onClick={() => setPendingDelete(record)}>
                  <span />
                </button>
              ) : null}
              <button type="button" className="cellBody asButton" onClick={() => (editing ? openEdit(record) : setHistoryName(record.exercise))}>
                <strong>{record.exercise}</strong>
                <span>
                  {getPartLabel(record.part)} · {loadLine(record)}
                </span>
                {record.note ? <em>{record.note}</em> : null}
              </button>
              {editing ? (
                <span className="moveButtons">
                  <button type="button" aria-label="上へ" disabled={index === 0} onClick={() => onMove(record.id, -1)}>
                    <IconChevron />
                  </button>
                  <button type="button" className="flip" aria-label="下へ" disabled={index === dayRecords.length - 1} onClick={() => onMove(record.id, 1)}>
                    <IconChevron />
                  </button>
                </span>
              ) : (
                <button type="button" className="navIconButton pointRight" aria-label="詳細" onClick={() => setHistoryName(record.exercise)}>
                  <IconChevron />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <Sheet
          title="種目を追加"
          onClose={() => {
            setAdding(false);
            setError("");
          }}
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
                <span>セット</span>
                <input value={sets} onChange={(event) => setSets(event.target.value)} placeholder="1" inputMode="numeric" autoComplete="off" />
              </label>
              <label className="cell field">
                <span>メモ</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="任意" autoComplete="off" />
              </label>
            </div>
            {previous ? (
              <div className="group">
                <div className="cell">
                  <div className="cellBody">
                    <strong>前回</strong>
                    <span>
                      {formatJapaneseDate(previous.dateKey)} · {formatRecordLoad(previous.best)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="navTextButton"
                    onClick={() => {
                      const best = previous.best;
                      setWeight(best.weight === "自重" ? "" : String(best.weight ?? ""));
                      setReps(String(best.reps ?? ""));
                      setSets(best.sets == null ? "" : String(best.sets));
                    }}
                  >
                    使う
                  </button>
                </div>
              </div>
            ) : null}
            {error ? <p className="formError">{error}</p> : null}
          </form>
        </Sheet>
      ) : null}

      {editingRecord ? (
        <Sheet title="記録を編集" onClose={() => setEditingRecord(null)} trailing={<button type="submit" form="edit-form" className="navTextButton strong">保存</button>}>
          <form id="edit-form" onSubmit={saveEdit}>
            <p className="sheetLead">{editingRecord.exercise}</p>
            <div className="group">
              <label className="cell field">
                <span>重量</span>
                <input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="自重" inputMode="decimal" />
              </label>
              <label className="cell field">
                <span>回数</span>
                <input value={reps} onChange={(event) => setReps(event.target.value)} inputMode="numeric" />
              </label>
              <label className="cell field">
                <span>セット</span>
                <input value={sets} onChange={(event) => setSets(event.target.value)} placeholder="1" inputMode="numeric" />
              </label>
              <label className="cell field">
                <span>メモ</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="任意" />
              </label>
            </div>
            {error ? <p className="formError">{error}</p> : null}
          </form>
        </Sheet>
      ) : null}

      {historyName ? (
        <Sheet title={historyName} onClose={() => setHistoryName(null)}>
          <MiniChart points={history} />
          <div className="group">
            {[...history].reverse().map((point) => (
              <div className="cell" key={point.dateKey}>
                <div className="cellBody">
                  <strong>{formatJapaneseDate(point.dateKey)}</strong>
                  <span>{point.label}</span>
                </div>
              </div>
            ))}
          </div>
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
            <button type="button" className="navTextButton center" onClick={() => { onSelectDate(todayKey); setCalendarOpen(false); }}>
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

      <button type="button" className="navPlus" aria-label="種目を追加" onClick={() => { setError(""); setAdding(true); }}>
        <IconPlus />
      </button>
    </div>
  );
}
