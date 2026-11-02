import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LogScreen from "./components/LogScreen.jsx";
import PhotoDay from "./components/PhotoDay.jsx";
import { Sheet } from "./components/Sheet.jsx";
import { IconList, IconMore, IconPhotos } from "./components/Icons.jsx";
import { createBackupZip, mergeState, readBackupFile, summarizeBackup } from "./lib/backup.js";
import { downloadBlob } from "./lib/download.js";
import { exerciseOptions } from "./data/exercises.js";
import { getTodayKey, isValidDateKey, parseDateKey, shiftMonth } from "./lib/dates.js";
import { makeId } from "./lib/id.js";
import { KEYS, emptyAppState, loadAppState, saveJson } from "./lib/storage.js";
import { deletePhotoRecord, getAllPhotoRecords, listPhotoMeta, savePhotoRecord } from "./lib/photos.js";
import "./App.css";

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
  const [screen, setScreen] = useState("photo");
  const [photoMeta, setPhotoMeta] = useState([]);
  const [toast, setToast] = useState("");
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [busy, setBusy] = useState(false);
  const importRef = useRef(null);
  const toastTimer = useRef(0);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

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
    if (persist.records) saveJson(localStorage, KEYS.records, records);
  }, [records, persist.records]);

  useEffect(() => {
    if (persist.dayParts) saveJson(localStorage, KEYS.dayParts, dayParts);
  }, [dayParts, persist.dayParts]);

  useEffect(() => {
    if (persist.customExercises) saveJson(localStorage, KEYS.customExercises, customExercises);
  }, [customExercises, persist.customExercises]);

  useEffect(() => {
    if (persist.lastExercises) saveJson(localStorage, KEYS.lastExercises, lastExercises);
  }, [lastExercises, persist.lastExercises]);

  useEffect(() => {
    if (persist.bodyWeight) saveJson(localStorage, KEYS.bodyWeight, bodyWeight);
  }, [bodyWeight, persist.bodyWeight]);

  const exercises = useMemo(() => [...exerciseOptions, ...customExercises], [customExercises]);

  async function refreshPhotos() {
    try {
      setPhotoMeta(await listPhotoMeta());
    } catch {
      showToast("写真の一覧を読めなかったよ");
    }
  }

  function selectDate(dateKey) {
    if (!isValidDateKey(dateKey)) return;
    const date = parseDateKey(dateKey);
    setSelectedDateKey(dateKey);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  }

  function changeMonth(diff) {
    const next = shiftMonth(viewYear, viewMonth, diff);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function addTraining(draft) {
    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: [
        ...(Array.isArray(prev[selectedDateKey]) ? prev[selectedDateKey] : []),
        { id: makeId(), ...draft, createdAt: new Date().toISOString() },
      ],
    }));
    if (!exerciseOptions.some((item) => item.part === draft.part && item.name === draft.exercise)) {
      setCustomExercises((prev) => {
        if (prev.some((item) => item.part === draft.part && item.name === draft.exercise)) return prev;
        return [...prev, { id: makeId(), name: draft.exercise, part: draft.part }];
      });
    }
    showToast("記録を追加したよ");
  }

  function updateTraining(id, updates) {
    setRecords((prev) => ({
      ...prev,
      [selectedDateKey]: (prev[selectedDateKey] || []).map((record) => {
        if (!record || record.id !== id) return record;
        const next = { ...record, ...updates };
        for (const [key, value] of Object.entries(updates)) {
          if (value == null || value === "") delete next[key];
        }
        return next;
      }),
    }));
    showToast("記録を保存したよ");
  }

  function moveTraining(id, direction) {
    setRecords((prev) => {
      const list = [...(prev[selectedDateKey] || [])];
      const index = list.findIndex((record) => record && record.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return prev;
      const [item] = list.splice(index, 1);
      list.splice(nextIndex, 0, item);
      return { ...prev, [selectedDateKey]: list };
    });
  }

  function deleteTraining(id) {
    setRecords((prev) => {
      const list = (prev[selectedDateKey] || []).filter((record) => !(record && record.id === id));
      const next = { ...prev, [selectedDateKey]: list };
      if (list.length === 0) delete next[selectedDateKey];
      return next;
    });
  }

  function saveWeight(dateKey, kg) {
    setBodyWeight((prev) => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), kg, updatedAt: new Date().toISOString() },
    }));
    showToast("体重を保存したよ");
  }

  function deleteWeight(dateKey) {
    setBodyWeight((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
    showToast("体重を削除したよ");
  }

  async function exportBackup() {
    setMenuOpen(false);
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
      showToast(error?.message || "書き出せませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function chooseImport(file) {
    setMenuOpen(false);
    setBusy(true);
    try {
      setPendingImport(await readBackupFile(file));
    } catch (error) {
      showToast(error?.message || "読み込めませんでした");
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
      for (const photo of imported.photos) {
        await savePhotoRecord({
          dateKey: photo.dateKey,
          blob: photo.blob,
          byteSize: photo.blob.size,
          createdAt: new Date().toISOString(),
        });
      }
      await refreshPhotos();
      setPendingImport(null);
      showToast("バックアップを合流したよ");
    } catch (error) {
      showToast(error?.message || "合流できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function savePhoto(record) {
    try {
      await savePhotoRecord(record);
      await refreshPhotos();
      showToast("写真を保存したよ");
    } catch {
      showToast("写真を保存できなかったよ");
      throw new Error("写真を保存できなかったよ");
    }
  }

  async function deletePhoto(dateKey) {
    try {
      await deletePhotoRecord(dateKey);
      await refreshPhotos();
      showToast("写真を削除したよ");
    } catch {
      showToast("写真を削除できなかったよ");
    }
  }

  const title = screen === "photo" ? "写真" : "記録";

  return (
    <div className="app">
      <header className="navBar">
        <div className="navBarInner">
          <button type="button" className="navMore" aria-label="メニュー" onClick={() => setMenuOpen(true)}>
            <IconMore />
          </button>
          <h1 className={compact ? "navTitle" : "navTitle hidden"}>{title}</h1>
          <span className="navSide" />
        </div>
      </header>

      <main
        id="main"
        className={screen === "photo" ? "scroller photoScroller" : "scroller"}
        onScroll={(event) => setCompact(event.currentTarget.scrollTop > 36)}
      >
        <h1 className="largeTitle">{title}</h1>
        {loaded.warnings.length > 0 ? (
          <p className="warningNote">{loaded.warnings.join("、")}は読めなかったので上書きしていません。</p>
        ) : null}
        {screen === "log" ? (
          <LogScreen
            dateKey={selectedDateKey}
            todayKey={todayKey}
            viewYear={viewYear}
            viewMonth={viewMonth}
            records={records}
            exercises={exercises}
            lastByPart={lastExercises}
            onSelectDate={selectDate}
            onChangeMonth={changeMonth}
            onAdd={addTraining}
            onUpdate={updateTraining}
            onDelete={deleteTraining}
            onMove={moveTraining}
            onRemember={(part, name) => setLastExercises((prev) => ({ ...prev, [part]: name }))}
          />
        ) : (
          <PhotoDay
            photoMeta={photoMeta}
            weights={bodyWeight}
            todayKey={todayKey}
            onSaveWeight={saveWeight}
            onDeleteWeight={deleteWeight}
            onSavePhoto={savePhoto}
            onDeletePhoto={deletePhoto}
            notify={showToast}
          />
        )}
      </main>

      <nav className="tabBar" aria-label="メイン">
        <button
          type="button"
          className={screen === "log" ? "active" : ""}
          aria-current={screen === "log" ? "page" : undefined}
          onClick={() => {
            setScreen("log");
            setCompact(false);
          }}
        >
          <IconList />
          記録
        </button>
        <button
          type="button"
          className={screen === "photo" ? "active" : ""}
          aria-current={screen === "photo" ? "page" : undefined}
          onClick={() => {
            setScreen("photo");
            setCompact(false);
          }}
        >
          <IconPhotos />
          写真
        </button>
      </nav>

      <input
        ref={importRef}
        className="fileInput"
        type="file"
        accept=".zip,.json,application/zip,application/json"
        aria-label="バックアップを選ぶ"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) chooseImport(file);
        }}
      />

      {menuOpen ? (
        <div className="sheetBackdrop" onClick={() => setMenuOpen(false)} role="presentation">
          <div className="actionWrap" onClick={(event) => event.stopPropagation()}>
            <div className="actionGroup">
              <p>記録、体重、写真をこの端末に保存します。</p>
              <button type="button" className="actionRow" onClick={exportBackup} disabled={busy}>
                バックアップを書き出す
              </button>
              <button type="button" className="actionRow" onClick={() => importRef.current?.click()} disabled={busy}>
                バックアップを読み込む
              </button>
            </div>
            <button type="button" className="actionCancel" onClick={() => setMenuOpen(false)}>
              キャンセル
            </button>
          </div>
        </div>
      ) : null}

      {pendingImport ? (
        <Sheet title="バックアップ" onClose={() => setPendingImport(null)} trailing={<button type="button" className="navTextButton strong" onClick={confirmImport} disabled={busy}>合流</button>}>
          <p className="sheetLead">同じ日付はバックアップを優先します。この端末にしかない日は残ります。</p>
          <div className="group">
            <div className="cell"><div className="cellBody"><strong>トレーニング</strong><span>{summarizeBackup(pendingImport.data, pendingImport.photos.length).days}日</span></div></div>
            <div className="cell"><div className="cellBody"><strong>体重</strong><span>{summarizeBackup(pendingImport.data, pendingImport.photos.length).weights}日</span></div></div>
            <div className="cell"><div className="cellBody"><strong>写真</strong><span>{pendingImport.photos.length}枚</span></div></div>
          </div>
        </Sheet>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
