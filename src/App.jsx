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
const DAY_PARTS_STORAGE_KEY = "training-memo-day-parts-v1";
const CUSTOM_EXERCISES_STORAGE_KEY = "training-memo-custom-exercises-v1";
const LAST_EXERCISES_STORAGE_KEY = "training-memo-last-exercises-v1";

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
  { name: "ダンベルプレス", part: "chest" },
  { name: "チェストプレス", part: "chest" },

  // 背中
  { name: "ラットプルダウン", part: "back" },
  { name: "シーテッドロー", part: "back" },
  { name: "デッドリフト", part: "back" },

  // 肩
  { name: "サイドレイズ", part: "shoulder" },
  { name: "ショルダープレス", part: "shoulder" },
  { name: "リアレイズ", part: "shoulder" },

  // 腕
  { name: "アームカール", part: "arm" },
  { name: "ハンマーカール", part: "arm" },
  { name: "トライセプスプレスダウン", part: "arm" },

  // 脚
  { name: "スクワット", part: "leg" },
  { name: "レッグプレス", part: "leg" },
  { name: "レッグカール", part: "leg" },

  // 腹
  { name: "腹筋", part: "core" },
  { name: "プランク", part: "core" },
  { name: "レッグレイズ", part: "core" },

  // 有酸素
  { name: "ランニング", part: "cardio" },
  { name: "バイク", part: "cardio" },
  { name: "ウォーキング", part: "cardio" },

  // その他
  { name: "その他", part: "other" },
];

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

function SortableTrainingItem({
  record,
  previousRecord,
  onDelete,
  onUpdate,
}) {
  const [editWeight, setEditWeight] = useState(
    record.weight === "自重" ? "" : record.weight
  );
  const [editReps, setEditReps] = useState(record.reps);
  const [savedFeedback, setSavedFeedback] = useState(false);

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
  const weightIncrease =
    previousRecord &&
    Number.isFinite(Number(record.weight)) &&
    Number.isFinite(Number(previousRecord.weight))
      ? Number(record.weight) - Number(previousRecord.weight)
      : 0;
  const repsIncrease = previousRecord
    ? Number(record.reps) - Number(previousRecord.reps)
    : 0;

  function saveNumbers() {
    if (!editReps) {
      setEditReps(record.reps);
      return;
    }

    onUpdate(record.id, {
      weight: editWeight.trim() || "自重",
      reps: editReps,
    });
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1200);
  }

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
          {weightIncrease > 0 && (
            <span className="progressBadge">
              +{Number(weightIncrease.toFixed(2))}kg
            </span>
          )}
          {repsIncrease > 0 && (
            <span className="progressBadge">+{repsIncrease}回</span>
          )}
          {savedFeedback && <span className="savedFeedback">保存しました</span>}
        </div>

        <div className="recordEditFields">
          <label>
            重量（kg）
            <input
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
              onBlur={saveNumbers}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="自重"
              inputMode="decimal"
            />
          </label>
          <label>
            回数
            <input
              value={editReps}
              onChange={(e) => setEditReps(e.target.value)}
              onBlur={saveNumbers}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              inputMode="numeric"
            />
          </label>
        </div>
      </div>

      <div className="recordActions">
        <button
          type="button"
          className="deleteButton"
          onClick={() => onDelete(record.id)}
        >
          ×
        </button>
      </div>
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

  const [dayParts, setDayParts] = useState(() => {
    const saved = localStorage.getItem(DAY_PARTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [customExercises, setCustomExercises] = useState(() => {
    const saved = localStorage.getItem(CUSTOM_EXERCISES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [lastExercises, setLastExercises] = useState(() => {
    const saved = localStorage.getItem(LAST_EXERCISES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const [exercisePart, setExercisePart] = useState("");
  const [exercise, setExercise] = useState("");
  const [customExercise, setCustomExercise] = useState("");
  const [settingsPart, setSettingsPart] = useState("chest");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [isChoosingDayPart, setIsChoosingDayPart] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("10");
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

  useEffect(() => {
    localStorage.setItem(DAY_PARTS_STORAGE_KEY, JSON.stringify(dayParts));
  }, [dayParts]);

  useEffect(() => {
    localStorage.setItem(
      CUSTOM_EXERCISES_STORAGE_KEY,
      JSON.stringify(customExercises)
    );
  }, [customExercises]);

  useEffect(() => {
    localStorage.setItem(
      LAST_EXERCISES_STORAGE_KEY,
      JSON.stringify(lastExercises)
    );
  }, [lastExercises]);

  const selectedRecords = records[selectedDateKey] || [];

  const hasSavedDayPart = Object.prototype.hasOwnProperty.call(
    dayParts,
    selectedDateKey
  );
  const selectedDayPart = hasSavedDayPart
    ? dayParts[selectedDateKey]
    : selectedRecords[0]
      ? selectedRecords[0].part || getExercisePart(selectedRecords[0].exercise)
      : "";

  const selectedRecordsByPart = selectedRecords.filter((record) => {
    if (activePart === "all") return true;
    const part = record.part || getExercisePart(record.exercise);
    return part === activePart;
  });

  const selectedRecordIds = selectedRecordsByPart.map((record) => record.id);

  const allExerciseOptions = useMemo(
    () => [...exerciseOptions, ...customExercises],
    [customExercises]
  );

  const filteredExerciseOptions = useMemo(() => {
    return allExerciseOptions.filter((item) => item.part === exercisePart);
  }, [allExerciseOptions, exercisePart]);

  const selectedExerciseName =
    exercise === "その他" ? customExercise.trim() : exercise;

  const selectedExercisePart =
    exercise === "その他" ? "other" : exercisePart;

  const previousSameExerciseRecord = (() => {
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
  })();

  const todayKey = getTodayKey();

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
    setIsChoosingDayPart(false);
    setActiveTab("list");
  }

  function changeExercisePart(nextPart) {
    setExercisePart(nextPart);

    const savedExercise = lastExercises[nextPart];
    const savedExerciseExists = allExerciseOptions.some(
      (item) => item.part === nextPart && item.name === savedExercise
    );
    const firstExercise =
      (savedExerciseExists && savedExercise) ||
      allExerciseOptions.find((item) => item.part === nextPart)?.name ||
      "その他";

    setExercise(firstExercise);
    setCustomExercise("");
  }

  function changeExercise(nextExercise) {
    setExercise(nextExercise);
    setLastExercises((prev) => ({
      ...prev,
      [exercisePart]: nextExercise,
    }));
  }

  function selectDayPart(nextPart) {
    if (isChoosingDayPart && selectedRecords.length > 0) {
      const ok = window.confirm(
        "今日の記録をリセットして部位を変更しますか？"
      );
      if (!ok) {
        setIsChoosingDayPart(false);
        return;
      }
    }

    setDayParts((prev) => ({
      ...prev,
      [selectedDateKey]: nextPart,
    }));

    let nextDayRecords = [];
    const previousDateKey = Object.keys(records)
      .filter((dateKey) => dateKey < selectedDateKey)
      .sort((a, b) => b.localeCompare(a))
      .find((dateKey) =>
        records[dateKey]?.some((record) => {
          const part = record.part || getExercisePart(record.exercise);
          return part === nextPart;
        })
      );

    if (previousDateKey) {
      nextDayRecords = records[previousDateKey]
        .filter((record) => {
          const part = record.part || getExercisePart(record.exercise);
          return part === nextPart;
        })
        .map((record) => ({
          id: makeId(),
          exercise: record.exercise,
          part: nextPart,
          weight: record.weight,
          reps: record.reps,
          createdAt: new Date().toISOString(),
        }));
    }

    setRecords((prev) => {
      const next = { ...prev };

      if (nextDayRecords.length > 0) {
        next[selectedDateKey] = nextDayRecords;
      } else {
        delete next[selectedDateKey];
      }

      return next;
    });

    changeExercisePart(nextPart);
    setIsChoosingDayPart(false);
  }

  function changeDayPart() {
    setIsChoosingDayPart(true);
  }

  function openAddForm() {
    setCustomExercise("");
    setWeight("");
    setReps("10");
    changeExercisePart(selectedDayPart);
    setActiveTab("add");
  }

  function addCustomExercise() {
    const name = newExerciseName.trim();

    if (!name) {
      alert("種目名を入力してね");
      return;
    }

    const alreadyExists = allExerciseOptions.some(
      (item) => item.part === settingsPart && item.name === name
    );

    if (alreadyExists) {
      alert("同じ種目がすでにあるよ");
      return;
    }

    setCustomExercises((prev) => [
      ...prev,
      { id: makeId(), name, part: settingsPart },
    ]);
    setNewExerciseName("");
  }

  function deleteCustomExercise(id) {
    setCustomExercises((prev) => prev.filter((item) => item.id !== id));
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

    if (!reps) {
      alert("回数を選んでね");
      return;
    }

    const newRecord = {
      id: makeId(),
      exercise: finalExercise,
      part: selectedExercisePart,
      weight: weight || "自重",
      reps,
      createdAt: new Date().toISOString(),
    };

    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: [...(prev[selectedDateKey] || []), newRecord],
    }));

    setWeight("");
    setReps("10");
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

  function updateRecord(id, updates) {
    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: (prev[selectedDateKey] || []).map((record) =>
        record.id === id ? { ...record, ...updates } : record
      ),
    }));
  }

  function usePreviousRecord() {
    if (!previousSameExerciseRecord) return;

    const previous = previousSameExerciseRecord.record;

    setWeight(previous.weight === "自重" ? "" : previous.weight);
    setReps(previous.reps);
  }

  function getPreviousRecord(record) {
    const previousDateKey = Object.keys(records)
      .filter((dateKey) => dateKey < selectedDateKey)
      .sort((a, b) => b.localeCompare(a))
      .find((dateKey) =>
        records[dateKey]?.some(
          (pastRecord) => pastRecord.exercise === record.exercise
        )
      );

    return previousDateKey
      ? records[previousDateKey].find(
          (pastRecord) => pastRecord.exercise === record.exercise
        )
      : null;
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

        <div className="headerActions">
          <button
            type="button"
            className="settingsButton"
            onClick={() => setActiveTab("settings")}
          >
            設定
          </button>
          <button type="button" className="todayButton" onClick={goToday}>
            今日
          </button>
        </div>
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
                    setIsChoosingDayPart(false);
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
            <div>
              <p>選択中の日付</p>
              <h2>{formatJapaneseDate(selectedDateKey)}</h2>
            </div>

            {selectedDayPart && !isChoosingDayPart ? (
              <div className="fixedDayPart">
                <span>今日の部位</span>
                <button
                  type="button"
                  onClick={changeDayPart}
                  aria-label={`${getPartLabel(selectedDayPart)}から部位を選び直す`}
                >
                  {getPartLabel(selectedDayPart)}
                </button>
              </div>
            ) : (
              <div className="dayPartPicker">
                <p>今日の部位</p>
                <div className="dayPartButtons">
                  {addBodyParts.map((part) => (
                    <button
                      type="button"
                      key={part.id}
                      onClick={() => selectDayPart(part.id)}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              onClick={openAddForm}
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

              {selectedRecordsByPart.length === 0 ? (
                <div className="emptyBox">
                  <p>この条件の記録はまだないよ。</p>
                  <button type="button" onClick={openAddForm}>
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
                          previousRecord={getPreviousRecord(record)}
                          onDelete={deleteRecord}
                          onUpdate={updateRecord}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {activeTab === "add" && (
            <div className={`addBox ${exercisePart ? "" : "awaitingPart"}`}>
              <div className="addTitleRow">
                <h3>トレーニングを追加</h3>

                {justAdded && <span className="addedBadge">追加しました</span>}
              </div>

              <div className="exercisePickGrid">
                <label>
                  種目
                    <select
                      value={exercise}
                      onChange={(e) => changeExercise(e.target.value)}
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
                      / {previousSameExerciseRecord.record.reps}回
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
                  <input
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    placeholder="例：10"
                    inputMode="numeric"
                  />
                </label>

              </div>

              <button type="button" className="mainButton" onClick={addRecord}>
                追加する
              </button>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="exerciseSettings">
              <div className="addTitleRow">
                <div>
                  <h3>種目設定</h3>
                  <p>よく使う種目を追加できます</p>
                </div>
              </div>

              <div className="settingsInputGrid">
                <label>
                  部位
                  <select
                    value={settingsPart}
                    onChange={(e) => setSettingsPart(e.target.value)}
                  >
                    {addBodyParts
                      .filter((part) => part.id !== "other")
                      .map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.label}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  種目名
                  <input
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCustomExercise();
                    }}
                    placeholder="例：インクラインプレス"
                  />
                </label>
              </div>

              <button
                type="button"
                className="mainButton"
                onClick={addCustomExercise}
              >
                種目を追加
              </button>

              <div className="customExerciseList">
                <h4>追加した種目</h4>
                {customExercises.length === 0 ? (
                  <p>追加した種目はまだありません</p>
                ) : (
                  customExercises.map((item) => (
                    <div key={item.id} className="customExerciseItem">
                      <div>
                        <span>{getPartLabel(item.part)}</span>
                        <strong>{item.name}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCustomExercise(item.id)}
                      >
                        削除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
