import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatJapaneseDate } from "../lib/dates.js";
import {
  bestRecord,
  exerciseTrends,
  findPreviousSession,
  formatRecordLoad,
  isUsableRecord,
  parseTrainingNumber,
  progressBadge,
  recordPart,
} from "../lib/records.js";

function SortableTrainingItem({ record, badge, onDelete, onUpdate }) {
  const [editWeight, setEditWeight] = useState(record.weight === "自重" ? "" : String(record.weight ?? ""));
  const [editReps, setEditReps] = useState(String(record.reps ?? ""));
  const [editSets, setEditSets] = useState(record.sets == null ? "" : String(record.sets));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: record.id,
  });

  function commit() {
    const repsParsed = parseTrainingNumber(editReps, { max: 999 });
    if (!repsParsed.ok) {
      setError("回数は1〜999にしてね");
      setEditReps(String(record.reps ?? ""));
      return;
    }

    const setsParsed = parseTrainingNumber(editSets, { max: 99 });
    if (!setsParsed.empty && !setsParsed.ok) {
      setError("セット数は1〜99にしてね");
      return;
    }

    let weightValue = "自重";
    if (editWeight.trim()) {
      const weightParsed = parseTrainingNumber(editWeight, { max: 999, decimal: true });
      if (!weightParsed.ok) {
        setError("重量は数字か空欄にしてね");
        return;
      }
      weightValue = weightParsed.value;
    }

    onUpdate(record.id, {
      weight: weightValue,
      reps: repsParsed.value,
      sets: setsParsed.ok ? setsParsed.value : null,
    });
    setError("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "recordItem dragging" : "recordItem"}
    >
      <button type="button" className="dragHandle" aria-label={`${record.exercise}を並び替え`} {...attributes} {...listeners}>
        <span />
        <span />
        <span />
      </button>
      <div className="recordMain">
        <div className="recordTitleRow">
          <h4>{record.exercise}</h4>
          {badge ? <span className="progressBadge">{badge}</span> : null}
          {saved ? <span className="savedFeedback">保存しました</span> : null}
        </div>
        <p className="srOnly">{formatRecordLoad(record)}</p>
        <div className="recordEditFields">
          <label>
            重量（kg）
            <input
              value={editWeight}
              onChange={(event) => setEditWeight(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="自重"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <label>
            回数
            <input
              value={editReps}
              onChange={(event) => setEditReps(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label>
            セット
            <input
              value={editSets}
              onChange={(event) => setEditSets(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="1"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
        </div>
        {error ? <p className="fieldError">{error}</p> : null}
      </div>
      <div className="recordActions">
        <button
          type="button"
          className="deleteButton"
          aria-label={`${record.exercise}を削除`}
          onClick={() => onDelete(record.id)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}

function TrendList({ records, partFilter, customExercises }) {
  const trends = useMemo(
    () => exerciseTrends(records, partFilter, customExercises),
    [records, partFilter, customExercises]
  );

  if (trends.length === 0) return null;

  return (
    <section className="trendSection" aria-label="種目の推移">
      <h3>種目の推移</h3>
      <div className="trendList">
        {trends.map((row) => {
          const shown = row.points.slice(-8);
          const useWeight = shown.some((point) => point.weight != null);
          const nums = shown.map((point) => (useWeight ? point.weight || 0 : point.reps));
          const max = Math.max(...nums, 1);
          const delta = describeDelta(row, useWeight);
          return (
            <article key={row.name} className="trendItem">
              <div className="trendHead">
                <strong>{row.name}</strong>
                <span>{row.latest.label}</span>
              </div>
              <p className="hint">
                {formatJapaneseDate(row.latest.dateKey)}
                {delta ? ` ・ 前回比 ${delta}` : ""}
              </p>
              <div className="spark" aria-hidden="true">
                {shown.map((point) => (
                  <i
                    key={point.dateKey}
                    style={{
                      height: `${Math.max(12, Math.round((((useWeight ? point.weight || 0 : point.reps) / max) * 100)))}%`,
                    }}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function describeDelta(row, useWeight) {
  if (!row.previous) return "";
  if (useWeight && row.latest.weight != null && row.previous.weight != null) {
    const diff = Math.round((row.latest.weight - row.previous.weight) * 100) / 100;
    if (diff === 0) return "同じ";
    return `${diff > 0 ? "+" : ""}${diff}kg`;
  }
  const diff = row.latest.reps - row.previous.reps;
  if (diff === 0) return "同じ";
  return `${diff > 0 ? "+" : ""}${diff}回`;
}

export default function RecordList({
  records,
  dateKey,
  activePart,
  partLabel,
  customExercises,
  onDelete,
  onUpdate,
  onReorder,
  onAddClick,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dayRecords = Array.isArray(records[dateKey]) ? records[dateKey] : [];
  const visible = dayRecords.filter((record) => {
    if (!isUsableRecord(record)) return false;
    if (activePart === "all") return true;
    return recordPart(record, customExercises) === activePart;
  });

  const previousByExercise = useMemo(() => {
    const map = new Map();
    for (const record of visible) {
      if (!map.has(record.exercise)) {
        map.set(record.exercise, findPreviousSession(records, dateKey, record.exercise));
      }
    }
    return map;
  }, [visible, records, dateKey]);

  const bestIds = useMemo(() => {
    const grouped = new Map();
    for (const record of visible) {
      const rows = grouped.get(record.exercise) || [];
      rows.push(record);
      grouped.set(record.exercise, rows);
    }
    const ids = new Set();
    for (const rows of grouped.values()) {
      const best = bestRecord(rows);
      if (best?.id) ids.add(best.id);
    }
    return ids;
  }, [visible]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visible.findIndex((record) => record.id === active.id);
    const newIndex = visible.findIndex((record) => record.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(visible, oldIndex, newIndex);
    let cursor = 0;
    const next = dayRecords.map((record) => {
      if (!isUsableRecord(record)) return record;
      if (activePart !== "all" && recordPart(record, customExercises) !== activePart) return record;
      const replacement = moved[cursor];
      cursor += 1;
      return replacement;
    });
    onReorder(next);
  }

  return (
    <div className="recordList">
      <div className="recordListHeader">
        <div>
          <h3>この日のトレーニング</h3>
          <p className="filterText">表示中：{partLabel}</p>
        </div>
        {visible.length > 1 ? <p>左のつまみで並び替え</p> : null}
      </div>

      {visible.length === 0 ? (
        <div className="emptyBox">
          <p>この条件の記録はまだないよ。</p>
          <button type="button" onClick={onAddClick}>
            トレーニングを追加する
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((record) => record.id)} strategy={verticalListSortingStrategy}>
            <div className="sortableList">
                {visible.map((record) => (
                  <SortableTrainingItem
                    key={`${record.id}:${record.weight}:${record.reps}:${record.sets ?? ""}`}
                  record={record}
                  badge={
                    bestIds.has(record.id)
                      ? progressBadge(record, previousByExercise.get(record.exercise)?.best)
                      : null
                  }
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <TrendList records={records} partFilter={activePart} customExercises={customExercises} />
    </div>
  );
}
