import { useCallback, useEffect, useMemo, useState } from "react";
import { exerciseOptions, filterParts, getPartLabel, addBodyParts } from "./data/exercises.js";
import { formatJapaneseDate, getTodayKey, isValidDateKey, parseDateKey, shiftMonth } from "./lib/dates.js";
import { makeId } from "./lib/id.js";
import {
  KEYS,
  emptyAppState,
  loadAppState,
  saveJson,
} from "./lib/storage.js";
import {
  currentStreak,
  isUsableRecord,
  monthStats,
  recordPart,
} from "./lib/records.js";
import { deletePhotoRecord, getAllPhotoRecords, listPhotoMeta, savePhotoRecord } from "./lib/photos.js";
import { createBackupZip, mergeState, readBackupFile } from "./lib/backup.js";
import { downloadBlob } from "./lib/download.js";
import { formatKg } from "./lib/weights.js";
import CalendarMonth from "./components/CalendarMonth.jsx";
import RecordList from "./components/RecordList.jsx";
import AddForm from "./components/AddForm.jsx";
import PhotoPanel from "./components/PhotoPanel.jsx";
import WeightPanel from "./components/WeightPanel.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import WeightField from "./components/WeightField.jsx";
import { IconPhoto, IconRecord, IconSettings, IconWeight } from "./components/Icons.jsx";
import "./App.css";

const NAV = [
  { id: "record", label: "記録", Icon: IconRecord },
  { id: "photo", label: "写真", Icon: IconPhoto },
  { id: "weight", label: "体重", Icon: IconWeight },
  { id: "settings", label: "設定", Icon: IconSettings },
];

function loadInitialState() {
  try {
    return loadAppState(window.localStorage);
  } catch {
    return emptyAppState("このブラウザでは保存データを読めなかったよ");
  }
}

export default function App() {
  const [loaded] = useState(loadInitialState);
  const [records, setRecords] = useState(loaded.records);
  const [dayParts, setDayParts] = useState(loaded.dayParts);
  const [customExercises, setCustomExercises] = useState(loaded.customExercises);
  const [lastExercises, setLastExercises] = useState(loaded.lastExercises);
  const [bodyWeight, setBodyWeight] = useState(loaded.bodyWeight);
  const [persist, setPersist] = useState(loaded.persist);
  const [todayKey, setTodayKey] = useState(() => getTodayKey());
  const [selectedDateKey, setSelectedDateKey] = useState(() => getTodayKey());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [screen, setScreen] = useState("record");
  const [subtab, setSubtab] = useState("list");
  const [activePart, setActivePart] = useState("all");
  const [choosingPart, setChoosingPart] = useState(false);
  const [photoMeta, setPhotoMeta] = useState([]);
  const [toast, setToast] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2400);
  }, []);

  const refreshPhotos = useCallback(async () => {
    try {
      setPhotoMeta(await listPhotoMeta());
    } catch {
      showToast("写真の一覧を読めなかったよ");
    }
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    listPhotoMeta()
      .then((meta) => {
        if (!cancelled) setPhotoMeta(meta);
      })
      .catch(() => {
        if (!cancelled) showToast("写真の一覧を読めなかったよ");
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    function syncToday() {
      setTodayKey(getTodayKey());
    }
    window.addEventListener("focus", syncToday);
    document.addEventListener("visibilitychange", syncToday);
    return () => {
      window.removeEventListener("focus", syncToday);
      document.removeEventListener("visibilitychange", syncToday);
    };
  }, []);

  useEffect(() => {
    if (!persist.records) return;
    if (!saveJson(localStorage, KEYS.records, records)) {
      showToast("記録を保存できなかったよ。容量がいっぱいかもしれない。");
    }
  }, [records, persist.records, showToast]);

  useEffect(() => {
    if (!persist.dayParts) return;
    if (!saveJson(localStorage, KEYS.dayParts, dayParts)) {
      showToast("部位を保存できなかったよ");
    }
  }, [dayParts, persist.dayParts, showToast]);

  useEffect(() => {
    if (!persist.customExercises) return;
    if (!saveJson(localStorage, KEYS.customExercises, customExercises)) {
      showToast("種目を保存できなかったよ");
    }
  }, [customExercises, persist.customExercises, showToast]);

  useEffect(() => {
    if (!persist.lastExercises) return;
    saveJson(localStorage, KEYS.lastExercises, lastExercises);
  }, [lastExercises, persist.lastExercises]);

  useEffect(() => {
    if (!persist.bodyWeight) return;
    if (!saveJson(localStorage, KEYS.bodyWeight, bodyWeight)) {
      showToast("体重を保存できなかったよ");
    }
  }, [bodyWeight, persist.bodyWeight, showToast]);

  useEffect(() => {
    if (!confirmState) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") {
        confirmState.resolve(false);
        setConfirmState(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmState]);

  const allExercises = useMemo(
    () => [...exerciseOptions, ...customExercises],
    [customExercises]
  );
  const selectedRecords = Array.isArray(records[selectedDateKey]) ? records[selectedDateKey] : [];
  const savedPart = dayParts[selectedDateKey];
  const hasSavedPart = typeof savedPart === "string" && savedPart;
  const inferred = selectedRecords.find((record) => isUsableRecord(record));
  const selectedDayPart = hasSavedPart
    ? savedPart
    : inferred
      ? recordPart(inferred, customExercises)
      : "";
  const stats = useMemo(
    () => monthStats(records, viewYear, viewMonth),
    [records, viewYear, viewMonth]
  );
  const streak = useMemo(() => currentStreak(records, todayKey), [records, todayKey]);
  const photoDates = useMemo(() => new Set(photoMeta.map((item) => item.dateKey)), [photoMeta]);
  const photoBytes = photoMeta.reduce((sum, item) => sum + (item.byteSize || 0), 0);

  function askConfirm(options) {
    return new Promise((resolve) => {
      setConfirmState({
        message: options.message,
        confirmLabel: options.confirmLabel || "続ける",
        resolve,
      });
    });
  }

  function closeConfirm(answer) {
    confirmState?.resolve(answer);
    setConfirmState(null);
  }

  function selectDate(dateKey) {
    if (!isValidDateKey(dateKey)) return;
    const date = parseDateKey(dateKey);
    setSelectedDateKey(dateKey);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setChoosingPart(false);
  }

  function changeMonth(diff) {
    const next = shiftMonth(viewYear, viewMonth, diff);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function goToday() {
    selectDate(getTodayKey());
    setScreen("record");
    setSubtab("list");
  }

  function selectDayPart(nextPart) {
    const current = hasSavedPart ? savedPart : selectedDayPart;
    if (current && nextPart === current) {
      setChoosingPart(false);
      return;
    }

    setDayParts((prev) => ({ ...prev, [selectedDateKey]: nextPart }));
    setChoosingPart(false);

    const usable = selectedRecords.filter((record) => isUsableRecord(record));
    if (usable.length > 0) {
      showToast("部位を変えたよ。記録はそのまま残してある。");
      return;
    }

    const previousDateKey = Object.keys(records)
      .filter((dateKey) => dateKey < selectedDateKey && Array.isArray(records[dateKey]))
      .sort((a, b) => b.localeCompare(a))
      .find((dateKey) =>
        records[dateKey].some(
          (record) => isUsableRecord(record) && recordPart(record, customExercises) === nextPart
        )
      );

    if (!previousDateKey) return;

    const copied = records[previousDateKey]
      .filter((record) => isUsableRecord(record) && recordPart(record, customExercises) === nextPart)
      .map((record) => ({
        ...record,
        id: makeId(),
        part: nextPart,
        createdAt: new Date().toISOString(),
      }));

    if (copied.length === 0) return;
    setRecords((prev) => ({ ...prev, [selectedDateKey]: copied }));
    showToast(`前回の${getPartLabel(nextPart)}メニューを入れたよ`);
  }

  async function clearDay() {
    const ok = await askConfirm({
      message: "この日のトレーニング記録をすべて削除する？写真と体重は残るよ。",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    setRecords((prev) => {
      const next = { ...prev };
      delete next[selectedDateKey];
      return next;
    });
    showToast("この日の記録を削除したよ");
  }

  function createCustomExercise(name, part) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomExercises((prev) => {
      if (prev.some((item) => item.part === part && item.name === trimmed)) return prev;
      if (exerciseOptions.some((item) => item.part === part && item.name === trimmed)) return prev;
      return [...prev, { id: makeId(), name: trimmed, part }];
    });
  }

  async function deleteCustomExercise(id) {
    const ok = await askConfirm({
      message: "この種目をリストから削除する？過去の記録は残るよ。",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    setCustomExercises((prev) => prev.filter((item) => item.id !== id));
  }

  function addTraining(draft) {
    const record = {
      id: makeId(),
      ...draft,
      createdAt: new Date().toISOString(),
    };
    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: [
        ...(Array.isArray(prev[selectedDateKey]) ? prev[selectedDateKey] : []),
        record,
      ],
    }));
    if (typeof dayParts[selectedDateKey] !== "string") {
      setDayParts((prev) => ({ ...prev, [selectedDateKey]: draft.part }));
    }
  }

  async function deleteTraining(id) {
    const ok = await askConfirm({
      message: "このトレーニング記録を削除する？",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    setRecords((prev) => {
      const list = (prev[selectedDateKey] || []).filter((record) => !(record && record.id === id));
      const next = { ...prev, [selectedDateKey]: list };
      if (list.length === 0) delete next[selectedDateKey];
      return next;
    });
  }

  function updateTraining(id, updates) {
    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: (prev[selectedDateKey] || []).map((record) => {
        if (!record || record.id !== id) return record;
        const next = { ...record, ...updates };
        for (const [key, value] of Object.entries(updates)) {
          if (value == null) delete next[key];
        }
        return next;
      }),
    }));
  }

  function saveWeight(dateKey, kg) {
    setBodyWeight((prev) => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), kg, updatedAt: new Date().toISOString() },
    }));
    showToast("体重を保存したよ");
  }

  async function deleteWeight(dateKey) {
    const ok = await askConfirm({
      message: "この日の体重を削除する？",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    setBodyWeight((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
    showToast("体重を削除したよ");
  }

  async function savePhoto(record) {
    try {
      await savePhotoRecord(record);
      await refreshPhotos();
      showToast("写真を保存したよ");
    } catch {
      showToast("写真を保存できなかったよ。空き容量を確認してね。");
      throw new Error("写真を保存できなかったよ");
    }
  }

  async function deletePhoto(dateKey) {
    const ok = await askConfirm({
      message: "この日の写真を削除する？",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    try {
      await deletePhotoRecord(dateKey);
      await refreshPhotos();
      showToast("写真を削除したよ");
    } catch {
      showToast("写真を削除できなかったよ");
    }
  }

  async function exportBackup() {
    setBusy(true);
    try {
      const photos = await getAllPhotoRecords();
      const bytes = await createBackupZip(
        { records, dayParts, customExercises, lastExercises, bodyWeight },
        photos
      );
      downloadBlob(new Blob([bytes], { type: "application/zip" }), `筋トレメモ-backup-${todayKey}.zip`);
      showToast(`バックアップを書き出したよ（写真${photos.length}枚）`);
    } catch (error) {
      showToast(error?.message || "書き出せなかったよ");
    } finally {
      setBusy(false);
    }
  }

  async function chooseImport(file) {
    setBusy(true);
    try {
      setPendingImport(await readBackupFile(file));
    } catch (error) {
      showToast(error?.message || "読み込めなかったよ");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setBusy(true);
    const imported = pendingImport;
    try {
      const merged = mergeState(
        { records, dayParts, customExercises, lastExercises, bodyWeight },
        imported.data
      );
      setPersist({
        records: true,
        dayParts: true,
        customExercises: true,
        lastExercises: true,
        bodyWeight: true,
      });
      setRecords(merged.records);
      setDayParts(merged.dayParts);
      setCustomExercises(merged.customExercises);
      setLastExercises(merged.lastExercises);
      setBodyWeight(merged.bodyWeight);

      let photoErrors = 0;
      for (const photo of imported.photos) {
        try {
          await savePhotoRecord({
            dateKey: photo.dateKey,
            blob: photo.blob,
            byteSize: photo.blob.size,
            createdAt: new Date().toISOString(),
          });
        } catch {
          photoErrors += 1;
        }
      }
      await refreshPhotos();
      setPendingImport(null);
      const newer = imported.data.newer ? "新しい形式の一部は読み飛ばしたよ。" : "";
      showToast(
        photoErrors
          ? `合流したよ。写真${photoErrors}枚は保存できなかった。`
          : `バックアップを合流したよ。${newer}`
      );
    } catch (error) {
      showToast(error?.message || "合流できなかったよ");
    } finally {
      setBusy(false);
    }
  }

  function dayLabel(dateKey) {
    const bits = [formatJapaneseDate(dateKey)];
    if (dayHasWorkout(dateKey)) bits.push("トレーニングあり");
    if (photoDates.has(dateKey)) bits.push("写真あり");
    if (bodyWeight[dateKey]) bits.push(`体重${formatKg(bodyWeight[dateKey].kg)}kg`);
    if (dateKey === selectedDateKey) bits.push("選択中");
    return bits.join("、");
  }

  function dayHasWorkout(dateKey) {
    const list = records[dateKey];
    if (!Array.isArray(list)) return false;
    return list.some((record) => {
      if (!isUsableRecord(record)) return false;
      if (activePart === "all") return true;
      return recordPart(record, customExercises) === activePart;
    });
  }

  return (
    <div className="app">
      <a className="skipLink" href="#main">
        本文へ
      </a>
      <header className="header">
        <div>
          <p className="label">Training Memo</p>
          <h1>筋トレメモ</h1>
        </div>
        <button type="button" className="todayButton" onClick={goToday}>
          今日
        </button>
      </header>

      {loaded.warnings.length > 0 ? (
        <p className="warningBanner">
          {loaded.warnings.join("、")}
          を読めなかったので、その部分は上書きしていないよ。バックアップがあれば読み込める。
        </p>
      ) : null}

      <main id="main" className={screen === "record" ? "layout" : "layout layoutSingle"}>
        {screen === "record" ? (
          <CalendarMonth
            viewYear={viewYear}
            viewMonth={viewMonth}
            onChangeMonth={changeMonth}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            onSelectDate={(dateKey) => {
              selectDate(dateKey);
              setSubtab("list");
            }}
            getDayState={(dateKey) => ({
              marked: dayHasWorkout(dateKey),
              dotted: photoDates.has(dateKey),
              label: dayLabel(dateKey),
            })}
          >
            <div className="partFilter" role="toolbar" aria-label="部位で絞り込み">
              {filterParts.map((part) => (
                <button
                  type="button"
                  key={part.id}
                  className={activePart === part.id ? "active" : ""}
                  aria-pressed={activePart === part.id}
                  onClick={() => setActivePart(part.id)}
                >
                  {part.label}
                </button>
              ))}
            </div>
          </CalendarMonth>
        ) : null}

        <section className="contentCard">
          {screen === "record" ? (
            <>
              <div className="summaryStrip" aria-label="今月のまとめ">
                <p>
                  <strong>{stats.days}</strong>
                  <span>この月の日数</span>
                </p>
                <p>
                  <strong>{streak}</strong>
                  <span>連続日数</span>
                </p>
                {stats.volume > 0 ? (
                  <p>
                    <strong>{stats.volume.toLocaleString("ja-JP")}</strong>
                    <span>ボリュームkg</span>
                  </p>
                ) : null}
              </div>

              <div className="dateTitle">
                <div>
                  <p>選択中の日付</p>
                  <h2>{formatJapaneseDate(selectedDateKey)}</h2>
                </div>
                {selectedDayPart && !choosingPart ? (
                  <div className="fixedDayPart">
                    <span>この日の部位</span>
                    <button
                      type="button"
                      onClick={() => setChoosingPart(true)}
                      aria-label={`${getPartLabel(selectedDayPart)}から部位を選び直す`}
                    >
                      {getPartLabel(selectedDayPart)}
                    </button>
                  </div>
                ) : (
                  <div className="dayPartPicker">
                    <p>この日の部位</p>
                    <div className="dayPartButtons">
                      {addBodyParts.map((part) => (
                        <button type="button" key={part.id} onClick={() => selectDayPart(part.id)}>
                          {part.label}
                        </button>
                      ))}
                    </div>
                    <p className="hint">記録がない日は、前回の同じ部位を入れるよ。</p>
                  </div>
                )}
              </div>

              <WeightField
                key={`record-${selectedDateKey}:${bodyWeight[selectedDateKey]?.kg ?? ""}`}
                compact
                dateKey={selectedDateKey}
                entry={bodyWeight[selectedDateKey]}
                onSave={saveWeight}
                onDelete={deleteWeight}
              />

              <div className="tabBar" role="tablist" aria-label="記録の操作">
                <button
                  type="button"
                  role="tab"
                  aria-selected={subtab === "list"}
                  className={subtab === "list" ? "active" : ""}
                  onClick={() => setSubtab("list")}
                >
                  記録を見る
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={subtab === "add"}
                  className={subtab === "add" ? "active" : ""}
                  onClick={() => setSubtab("add")}
                >
                  追加する
                </button>
              </div>

              {subtab === "list" ? (
                <>
                  <RecordList
                    records={records}
                    dateKey={selectedDateKey}
                    activePart={activePart}
                    partLabel={getPartLabel(activePart)}
                    customExercises={customExercises}
                    onDelete={deleteTraining}
                    onUpdate={updateTraining}
                    onReorder={(nextList) =>
                      setRecords((prev) => ({ ...prev, [selectedDateKey]: nextList }))
                    }
                    onAddClick={() => setSubtab("add")}
                  />
                  {selectedRecords.some((record) => isUsableRecord(record)) ? (
                    <button type="button" className="textButton dangerText" onClick={clearDay}>
                      この日の記録をすべて削除
                    </button>
                  ) : null}
                </>
              ) : (
                <AddForm
                  key={`${selectedDateKey}:${selectedDayPart || "none"}`}
                  part={selectedDayPart}
                  partLabel={getPartLabel(selectedDayPart)}
                  options={allExercises}
                  records={records}
                  dateKey={selectedDateKey}
                  lastExercise={lastExercises[selectedDayPart]}
                  onRememberExercise={(part, name) =>
                    setLastExercises((prev) => ({ ...prev, [part]: name }))
                  }
                  onAdd={addTraining}
                  onCreateCustom={createCustomExercise}
                />
              )}
            </>
          ) : null}

          {screen === "photo" ? (
            <PhotoPanel
              photoMeta={photoMeta}
              weights={bodyWeight}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              viewYear={viewYear}
              viewMonth={viewMonth}
              onChangeMonth={changeMonth}
              onSelectDate={selectDate}
              onSaveWeight={saveWeight}
              onDeleteWeight={deleteWeight}
              onSavePhoto={savePhoto}
              onDeletePhoto={deletePhoto}
              notify={showToast}
            />
          ) : null}

          {screen === "weight" ? (
            <WeightPanel
              weights={bodyWeight}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              onSelectDate={selectDate}
              onSave={saveWeight}
              onDelete={deleteWeight}
            />
          ) : null}

          {screen === "settings" ? (
            <SettingsPanel
              customExercises={customExercises}
              onAddExercise={createCustomExercise}
              onDeleteExercise={deleteCustomExercise}
              onExport={exportBackup}
              onChooseImport={chooseImport}
              pendingImport={pendingImport}
              onConfirmImport={confirmImport}
              onCancelImport={() => setPendingImport(null)}
              busy={busy}
              photoCount={photoMeta.length}
              photoBytes={photoBytes}
            />
          ) : null}
        </section>
      </main>

      <nav className="bottomNav" aria-label="メインメニュー">
        {NAV.map((item) => (
          <button
            type="button"
            key={item.id}
            className={screen === item.id ? "active" : ""}
            aria-current={screen === item.id ? "page" : undefined}
            onClick={() => setScreen(item.id)}
          >
            <item.Icon />
            {item.label}
          </button>
        ))}
      </nav>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      {confirmState ? (
        <div className="modalBackdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h3 id="confirm-title">{confirmState.message}</h3>
            <div className="modalActions">
              <button type="button" className="secondaryButton" autoFocus onClick={() => closeConfirm(false)}>
                キャンセル
              </button>
              <button type="button" className="mainButton" onClick={() => closeConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
