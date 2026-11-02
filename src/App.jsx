import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LogScreen from "./components/LogScreen.jsx";
import PhotoDay from "./components/PhotoDay.jsx";
import { IconList, IconPhotos } from "./components/Icons.jsx";
import { exerciseOptions } from "./data/exercises.js";
import { getTodayKey, isValidDateKey, parseDateKey, shiftMonth } from "./lib/dates.js";
import { makeId } from "./lib/id.js";
import { KEYS, emptyAppState, loadAppState, saveJson } from "./lib/storage.js";
import { deletePhotoRecord, listPhotoMeta, savePhotoRecord } from "./lib/photos.js";
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
  const [customExercises, setCustomExercises] = useState(loaded.customExercises);
  const [lastExercises, setLastExercises] = useState(loaded.lastExercises);
  const [bodyWeight, setBodyWeight] = useState(loaded.bodyWeight);
  const [persist] = useState(loaded.persist);
  const [todayKey, setTodayKey] = useState(() => getTodayKey());
  const [selectedDateKey, setSelectedDateKey] = useState(() => getTodayKey());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [screen, setScreen] = useState("photo");
  const [photoMeta, setPhotoMeta] = useState([]);
  const [toast, setToast] = useState("");
  const [compact, setCompact] = useState(false);
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
          <span className="navSide" />
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
            onDelete={deleteTraining}
            onRemember={(part, name) => setLastExercises((prev) => ({ ...prev, [part]: name }))}
          />
        ) : (
          <PhotoDay
            photoMeta={photoMeta}
            weights={bodyWeight}
            todayKey={todayKey}
            onSaveWeight={saveWeight}
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

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
