import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

const STORAGE_KEY = "training-memo-app-v7";

const bodyParts = [
  { id: "all", label: "全部" },
  { id: "chest", label: "胸" },
  { id: "back", label: "背中" },
  { id: "shoulder", label: "肩" },
  { id: "arm", label: "腕" },
  { id: "leg", label: "脚" },
  { id: "core", label: "腹" },
  { id: "cardio", label: "有酸素" },
];

const addBodyParts = [
  { id: "chest", label: "胸" },
  { id: "back", label: "背中" },
  { id: "shoulder", label: "肩" },
  { id: "arm", label: "腕" },
  { id: "leg", label: "脚" },
  { id: "core", label: "腹" },
  { id: "cardio", label: "有酸素" },
  { id: "other", label: "その他" },
];

const exerciseOptions = [
  // 胸
  { name: "ベンチプレス", part: "chest" },
  { name: "インクラインプレス", part: "chest" },
  { name: "ダンベルプレス", part: "chest" },
  { name: "インクラインダンベルプレス", part: "chest" },
  { name: "ペックフライ", part: "chest" },
  { name: "チェストプレス", part: "chest" },
  { name: "ディップス", part: "chest" },
  { name: "腕立て伏せ", part: "chest" },

  // 背中
  { name: "ラットプルダウン", part: "back" },
  { name: "ラテラルロー", part: "back" },
  { name: "シーテッドロー", part: "back" },
  { name: "懸垂", part: "back" },
  { name: "ワンハンドロー", part: "back" },
  { name: "デッドリフト", part: "back" },

  // 肩
  { name: "サイドレイズ", part: "shoulder" },
  { name: "ショルダープレス", part: "shoulder" },
  { name: "フロントレイズ", part: "shoulder" },
  { name: "リアレイズ", part: "shoulder" },

  // 腕
  { name: "アームカール", part: "arm" },
  { name: "バーベルカール", part: "arm" },
  { name: "インクラインアームカール", part: "arm" },
  { name: "ハンマーカール", part: "arm" },
  { name: "スカルクラッシャー", part: "arm" },
  { name: "フレンチプレス", part: "arm" },
  { name: "トライセプスプレスダウン", part: "arm" },

  // 脚
  { name: "スクワット", part: "leg" },
  { name: "ブルガリアンスクワット", part: "leg" },
  { name: "レッグプレス", part: "leg" },
  { name: "カーフプレス", part: "leg" },
  { name: "カーフレイズ", part: "leg" },
  { name: "レッグカール", part: "leg" },
  { name: "レッグエクステンション", part: "leg" },

  // 腹
  { name: "腹筋", part: "core" },
  { name: "プランク", part: "core" },
  { name: "レッグレイズ", part: "core" },
  { name: "ロータリートルソー", part: "core" },
  { name: "アブローラー", part: "core" },

  // 有酸素
  { name: "ランニング", part: "cardio" },
  { name: "バイク", part: "cardio" },
  { name: "ウォーキング", part: "cardio" },

  // その他
  { name: "その他", part: "other" },
];

const repOptions = Array.from({ length: 9 }, (_, i) => String(i + 5));
const setOptions = Array.from({ length: 5 }, (_, i) => String(i + 1));

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayKey() {
  return toDateKey(new Date());
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay.getDay();

  const days = [];

  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  for (let d = 1; d <= lastDate; d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

function formatJapaneseDate(dateKey) {
  const [y, m, d] = dateKey.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

function getPartLabel(partId) {
  const allParts = [...bodyParts, { id: "other", label: "その他" }];
  return allParts.find((part) => part.id === partId)?.label || "その他";
}

function getExercisePart(exerciseName) {
  return (
    exerciseOptions.find((exercise) => exercise.name === exerciseName)?.part ||
    "other"
  );
}

function SortableTrainingItem({ record, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: record.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const part = record.part || getExercisePart(record.exercise);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`recordItem ${isDragging ? "dragging" : ""}`}
    >
      <button
        type="button"
        className="dragHandle"
        {...attributes}
        {...listeners}
        aria-label="並び替え"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className="recordMain">
        <div className="recordTitleRow">
          <h4>{record.exercise}</h4>
          <em>{getPartLabel(part)}</em>
        </div>

        <p>
          {record.weight}
          {record.weight === "自重" ? "" : "kg"} / {record.reps}回 /{" "}
          {record.sets}セット
        </p>
      </div>

      <button
        type="button"
        className="deleteButton"
        onClick={() => onDelete(record.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function App() {
  const today = new Date();

  const [selectedDateKey, setSelectedDateKey] = useState(getTodayKey());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [activeTab, setActiveTab] = useState("list");
  const [activePart, setActivePart] = useState("all");

  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [exercisePart, setExercisePart] = useState("shoulder");
  const [exercise, setExercise] = useState("サイドレイズ");
  const [customExercise, setCustomExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("10");
  const [sets, setSets] = useState("3");
  const [justAdded, setJustAdded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 220,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const selectedRecords = records[selectedDateKey] || [];

  const selectedRecordsByPart = selectedRecords.filter((record) => {
    if (activePart === "all") return true;
    const part = record.part || getExercisePart(record.exercise);
    return part === activePart;
  });

  const selectedRecordIds = selectedRecordsByPart.map((record) => record.id);

  const filteredExerciseOptions = useMemo(() => {
    return exerciseOptions.filter((item) => item.part === exercisePart);
  }, [exercisePart]);

  const selectedExerciseName =
    exercise === "その他" ? customExercise.trim() : exercise;

  const selectedExercisePart =
    exercise === "その他" ? "other" : getExercisePart(exercise);

  const previousSameExerciseRecord = useMemo(() => {
    if (!selectedExerciseName) return null;

    const pastDateKeys = Object.keys(records)
      .filter((dateKey) => dateKey < selectedDateKey)
      .sort((a, b) => b.localeCompare(a));

    for (const dateKey of pastDateKeys) {
      const found = records[dateKey]?.find(
        (record) => record.exercise === selectedExerciseName
      );

      if (found) {
        return {
          dateKey,
          record: found,
        };
      }
    }

    return null;
  }, [records, selectedDateKey, selectedExerciseName]);

  const todayKey = getTodayKey();
  const isSelectedToday = selectedDateKey === todayKey;

  const monthDays = useMemo(() => {
    return getMonthDays(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  function changeMonth(diff) {
    const next = new Date(viewYear, viewMonth + diff, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function goToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDateKey(getTodayKey());
    setActiveTab("list");
  }

  function changeExercisePart(nextPart) {
    setExercisePart(nextPart);

    const firstExercise =
      exerciseOptions.find((item) => item.part === nextPart)?.name || "その他";

    setExercise(firstExercise);
    setCustomExercise("");
  }

  function recordMatchesPart(record) {
    if (activePart === "all") return true;
    const part = record.part || getExercisePart(record.exercise);
    return part === activePart;
  }

  function hasRecord(dateKey) {
    const dayRecords = records[dateKey] || [];
    return dayRecords.some(recordMatchesPart);
  }

  function addRecord() {
    const finalExercise =
      exercise === "その他" ? customExercise.trim() : exercise;

    if (!finalExercise) {
      alert("種目を入力してね");
      return;
    }

    if (!reps || !sets) {
      alert("回数とセット数を選んでね");
      return;
    }

    const newRecord = {
      id: makeId(),
      exercise: finalExercise,
      part: selectedExercisePart,
      weight: weight || "自重",
      reps,
      sets,
      createdAt: new Date().toISOString(),
    };

    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: [...(prev[selectedDateKey] || []), newRecord],
    }));

    setWeight("");
    setReps("10");
    setSets("3");
    setCustomExercise("");

    setJustAdded(true);

    window.setTimeout(() => {
      setJustAdded(false);
    }, 1400);
  }

  function deleteRecord(id) {
    const ok = window.confirm("このトレーニング記録を削除しますか？");
    if (!ok) return;

    setRecords((prev) => {
      const nextDayRecords = (prev[selectedDateKey] || []).filter(
        (record) => record.id !== id
      );

      const next = {
        ...prev,
        [selectedDateKey]: nextDayRecords,
      };

      if (nextDayRecords.length === 0) {
        delete next[selectedDateKey];
      }

      return next;
    });
  }

  function copySelectedDayToToday() {
    const sourceRecords = selectedRecordsByPart;

    if (sourceRecords.length === 0) {
      alert("この日にはコピーできる記録がないよ");
      return;
    }

    const copiedRecords = sourceRecords.map((record) => ({
      ...record,
      id: makeId(),
      createdAt: new Date().toISOString(),
    }));

    setRecords((prev) => ({
      ...prev,
      [todayKey]: [...(prev[todayKey] || []), ...copiedRecords],
    }));

    alert("今日のトレーニングにコピーしました");
  }

  function usePreviousRecord() {
    if (!previousSameExerciseRecord) return;

    const previous = previousSameExerciseRecord.record;

    setWeight(previous.weight === "自重" ? "" : previous.weight);
    setReps(previous.reps);
    setSets(previous.sets);
  }

  function handleDragEnd(event) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setRecords((prev) => {
      const currentRecords = prev[selectedDateKey] || [];

      const visibleRecords = currentRecords.filter((record) => {
        if (activePart === "all") return true;
        const part = record.part || getExercisePart(record.exercise);
        return part === activePart;
      });

      const oldIndex = visibleRecords.findIndex(
        (record) => record.id === active.id
      );
      const newIndex = visibleRecords.findIndex(
        (record) => record.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1) return prev;

      const movedVisibleRecords = arrayMove(visibleRecords, oldIndex, newIndex);
      let visibleIndex = 0;

      const nextRecords = currentRecords.map((record) => {
        if (activePart === "all") {
          return movedVisibleRecords[visibleIndex++];
        }

        const part = record.part || getExercisePart(record.exercise);

        if (part === activePart) {
          return movedVisibleRecords[visibleIndex++];
        }

        return record;
      });

      return {
        ...prev,
        [selectedDateKey]: nextRecords,
      };
    });
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="label">Training Memo</p>
          <h1>筋トレメモ</h1>
        </div>

        <button type="button" className="todayButton" onClick={goToday}>
          今日
        </button>
      </header>

      <main className="layout">
        <section className="calendarCard">
          <div className="calendarHeader">
            <button type="button" onClick={() => changeMonth(-1)}>
              ‹
            </button>
            <h2>
              {viewYear}年 {viewMonth + 1}月
            </h2>
            <button type="button" onClick={() => changeMonth(1)}>
              ›
            </button>
          </div>

          <div className="partFilter">
            {bodyParts.map((part) => (
              <button
                type="button"
                key={part.id}
                className={activePart === part.id ? "active" : ""}
                onClick={() => setActivePart(part.id)}
              >
                {part.label}
              </button>
            ))}
          </div>

          <div className="weekRow">
            <span>日</span>
            <span>月</span>
            <span>火</span>
            <span>水</span>
            <span>木</span>
            <span>金</span>
            <span>土</span>
          </div>

          <div className="calendarGrid">
            {monthDays.map((date, index) => {
              if (!date) {
                return <div className="emptyDay" key={`empty-${index}`} />;
              }

              const dateKey = toDateKey(date);
              const selected = dateKey === selectedDateKey;
              const todayDate = dateKey === todayKey;
              const hasTraining = hasRecord(dateKey);

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={[
                    "dayButton",
                    hasTraining ? "hasRecordBg" : "",
                    selected ? "selected" : "",
                    todayDate ? "today" : "",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedDateKey(dateKey);
                    setActiveTab("list");
                  }}
                >
                  <span>{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="contentCard">
          <div className="dateTitle">
            <p>選択中の日付</p>
            <h2>{formatJapaneseDate(selectedDateKey)}</h2>
          </div>

          <div className="tabBar">
            <button
              type="button"
              className={activeTab === "list" ? "active" : ""}
              onClick={() => setActiveTab("list")}
            >
              記録を見る
            </button>

            <button
              type="button"
              className={activeTab === "add" ? "active" : ""}
              onClick={() => setActiveTab("add")}
            >
              追加する
            </button>
          </div>

          {activeTab === "list" && (
            <div className="recordList">
              <div className="recordListHeader">
                <div>
                  <h3>この日のトレーニング</h3>
                  <p className="filterText">
                    表示中：{getPartLabel(activePart)}
                  </p>
                </div>

                {selectedRecordsByPart.length > 1 && (
                  <p>左のつまみで並び替え</p>
                )}
              </div>

              {!isSelectedToday && selectedRecordsByPart.length > 0 && (
                <div className="copyTodayBox">
                  <button type="button" onClick={copySelectedDayToToday}>
                    本日にコピー
                  </button>
                </div>
              )}

              {selectedRecordsByPart.length === 0 ? (
                <div className="emptyBox">
                  <p>この条件の記録はまだないよ。</p>
                  <button type="button" onClick={() => setActiveTab("add")}>
                    トレーニングを追加する
                  </button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedRecordIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="sortableList">
                      {selectedRecordsByPart.map((record) => (
                        <SortableTrainingItem
                          key={record.id}
                          record={record}
                          onDelete={deleteRecord}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {activeTab === "add" && (
            <div className="addBox">
              <div className="addTitleRow">
                <h3>トレーニングを追加</h3>

                {justAdded && <span className="addedBadge">追加しました</span>}
              </div>

              <div className="exercisePickGrid">
                <label>
                  部位
                  <select
                    value={exercisePart}
                    onChange={(e) => changeExercisePart(e.target.value)}
                  >
                    {addBodyParts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  種目
                  <select
                    value={exercise}
                    onChange={(e) => setExercise(e.target.value)}
                  >
                    {filteredExerciseOptions.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {exercise === "その他" && (
                <label>
                  種目名
                  <input
                    value={customExercise}
                    onChange={(e) => setCustomExercise(e.target.value)}
                    placeholder="例：ケーブルサイドレイズ"
                  />
                </label>
              )}

              {previousSameExerciseRecord && (
                <div className="previousBox">
                  <div>
                    <p>前回の{selectedExerciseName}</p>
                    <h4>
                      {previousSameExerciseRecord.record.weight}
                      {previousSameExerciseRecord.record.weight === "自重"
                        ? ""
                        : "kg"}{" "}
                      / {previousSameExerciseRecord.record.reps}回 /{" "}
                      {previousSameExerciseRecord.record.sets}セット
                    </h4>
                    <span>
                      {formatJapaneseDate(previousSameExerciseRecord.dateKey)}
                    </span>
                  </div>

                  <button type="button" onClick={usePreviousRecord}>
                    使う
                  </button>
                </div>
              )}

              <div className="inputGrid">
                <label>
                  重量
                  <input
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="例：10"
                    inputMode="decimal"
                  />
                </label>

                <label>
                  回数
                  <select value={reps} onChange={(e) => setReps(e.target.value)}>
                    {repOptions.map((num) => (
                      <option key={num} value={num}>
                        {num}回
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  セット
                  <select value={sets} onChange={(e) => setSets(e.target.value)}>
                    {setOptions.map((num) => (
                      <option key={num} value={num}>
                        {num}セット
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button type="button" className="mainButton" onClick={addRecord}>
                追加する
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}