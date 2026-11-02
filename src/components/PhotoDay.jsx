import { useEffect, useMemo, useRef, useState } from "react";
import CalendarMonth from "./CalendarMonth.jsx";
import CameraCapture from "./CameraCapture.jsx";
import { formatJapaneseDate, monthPrefix } from "../lib/dates.js";
import { formatKg, parseKgInput } from "../lib/weights.js";
import { compressImage } from "../lib/image.js";
import { getPhotosByDates } from "../lib/photos.js";

function WeightEditor({ dateKey, entry, error, onError, onSave }) {
  const [text, setText] = useState(entry ? formatKg(entry.kg) : "");

  function saveWeight(event) {
    event.preventDefault();
    const parsed = parseKgInput(text);
    if (parsed.empty) {
      onError("体重を入力してね");
      return;
    }
    if (!parsed.ok) {
      onError("15〜500の数字で入力してね");
      return;
    }
    onSave(dateKey, parsed.kg);
    setText(formatKg(parsed.kg));
    onError("");
  }

  return (
    <form className="weightRow" onSubmit={saveWeight}>
      <label>
        この日の体重（kg）
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onError("");
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="例：62.4"
          aria-invalid={error ? "true" : "false"}
        />
      </label>
      {error ? <p className="fieldError">{error}</p> : null}
      <button type="submit" className="mainButton">
        体重を保存
      </button>
    </form>
  );
}

function kgText(weights, dateKey) {
  const kg = weights[dateKey]?.kg;
  return Number.isFinite(kg) ? `この写真 = ${formatKg(kg)}kg` : "体重未記録";
}

export default function PhotoDay({
  photoMeta,
  weights,
  selectedDateKey,
  todayKey,
  viewYear,
  viewMonth,
  onChangeMonth,
  onSelectDate,
  onSaveWeight,
  onSavePhoto,
  onDeletePhoto,
  notify,
}) {
  const libraryRef = useRef(null);
  const urlCache = useRef(new Map());
  const [photos, setPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [pair, setPair] = useState([]);
  const [weightError, setWeightError] = useState("");

  const monthKey = monthPrefix(viewYear, viewMonth);
  const photoDates = useMemo(() => photoMeta.map((item) => item.dateKey), [photoMeta]);

  useEffect(() => {
    let cancelled = false;
    const monthDates = photoDates.filter((dateKey) => dateKey.startsWith(monthKey));
    const needed = [...new Set([...monthDates, selectedDateKey, ...pair])];

    async function load() {
      try {
        const records = await getPhotosByDates(needed);
        if (cancelled) return;
        const next = records.map((record) => {
          const cacheKey = `${record.dateKey}:${record.createdAt}:${record.byteSize}`;
          let url = urlCache.current.get(cacheKey);
          if (!url) {
            url = URL.createObjectURL(record.blob);
            urlCache.current.set(cacheKey, url);
          }
          return { ...record, url, cacheKey };
        });
        const live = new Set(next.map((photo) => photo.cacheKey));
        for (const [key, url] of urlCache.current) {
          if (!live.has(key)) {
            URL.revokeObjectURL(url);
            urlCache.current.delete(key);
          }
        }
        setPhotos(next);
      } catch {
        if (!cancelled) notify("写真を読み込めなかったよ");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [photoDates, monthKey, selectedDateKey, pair, notify]);

  useEffect(() => {
    const cache = urlCache.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (draft?.url) URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  const byDate = useMemo(() => new Map(photos.map((photo) => [photo.dateKey, photo])), [photos]);
  const selectedPhoto = byDate.get(selectedDateKey) || null;
  const monthPhotos = photos
    .filter((photo) => photo.dateKey.startsWith(monthKey))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  function rememberDraft(image) {
    setDraft({ ...image, url: URL.createObjectURL(image.blob) });
    setCameraOpen(false);
  }

  async function onLibrary(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      rememberDraft(await compressImage(file));
    } catch (error) {
      notify(error.message || "画像を読み込めなかったよ");
    } finally {
      setBusy(false);
    }
  }

  function toggleCompare(dateKey) {
    if (!photoDates.includes(dateKey)) {
      notify("この日の写真はまだないよ");
      return;
    }
    setPair((current) => {
      if (current.includes(dateKey)) return current.filter((item) => item !== dateKey);
      return [...current, dateKey].slice(-2).sort();
    });
  }

  const left = byDate.get(pair[0]);
  const right = byDate.get(pair[1]);

  return (
    <div className="panel">
      <p className="hint">選択中の日付</p>
      <h2>{formatJapaneseDate(selectedDateKey)}</h2>

      <figure className="photoStage">
        {selectedPhoto ? (
          <img src={selectedPhoto.url} alt={`${formatJapaneseDate(selectedDateKey)}の全身写真`} />
        ) : (
          <div className="photoEmpty">この日の写真はまだないよ</div>
        )}
        <figcaption>{kgText(weights, selectedDateKey)}</figcaption>
      </figure>

      <WeightEditor
        key={`${selectedDateKey}:${weights[selectedDateKey]?.kg ?? ""}`}
        dateKey={selectedDateKey}
        entry={weights[selectedDateKey]}
        error={weightError}
        onError={setWeightError}
        onSave={onSaveWeight}
      />
      <div className="photoActions">
        <button type="button" className="mainButton" onClick={() => setCameraOpen(true)} disabled={busy}>
          {selectedPhoto ? "撮り直す" : "カメラで撮る"}
        </button>
        <button type="button" className="secondaryButton" onClick={() => libraryRef.current?.click()} disabled={busy}>
          ライブラリから選ぶ
        </button>
        {selectedPhoto ? (
          <button type="button" className="textButton" onClick={() => onDeletePhoto(selectedDateKey)}>
            この日の写真を削除
          </button>
        ) : null}
      </div>
      <input
        ref={libraryRef}
        className="fileInput"
        type="file"
        accept="image/*"
        aria-label="写真をライブラリから選ぶ"
        onChange={onLibrary}
      />
      <p className="hint">写真はこの端末だけに保存するよ。1日1枚。</p>

      <CalendarMonth
        embedded
        viewYear={viewYear}
        viewMonth={viewMonth}
        onChangeMonth={onChangeMonth}
        selectedDateKey={selectedDateKey}
        todayKey={todayKey}
        onSelectDate={(dateKey) => {
          onSelectDate(dateKey);
          if (compareOn) toggleCompare(dateKey);
        }}
        getDayState={(dateKey) => ({
          marked: photoDates.includes(dateKey),
          dotted: pair.includes(dateKey),
          label: [formatJapaneseDate(dateKey), photoDates.includes(dateKey) ? "写真あり" : "写真なし", kgText(weights, dateKey)].join("、"),
        })}
      />

      <button
        type="button"
        className="secondaryButton wide"
        onClick={() => {
          setCompareOn((value) => !value);
          setPair([]);
        }}
      >
        {compareOn ? "比較をやめる" : "2枚を比べる"}
      </button>
      {compareOn ? <p className="hint">写真のある日を2つ選んでね。左が古い日付だよ。</p> : null}

      {left && right ? (
        <div className="compareSide">
          {[left, right].map((photo) => (
            <figure key={photo.dateKey}>
              <img src={photo.url} alt={`${formatJapaneseDate(photo.dateKey)}の全身写真`} />
              <figcaption>
                <strong>{formatJapaneseDate(photo.dateKey)}</strong>
                <span>{kgText(weights, photo.dateKey)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className="photoTimeline">
        <h3>この月の写真</h3>
        {monthPhotos.length === 0 ? (
          <p className="hint">この月の写真はまだないよ。</p>
        ) : (
          monthPhotos.map((photo) => (
            <button type="button" key={photo.dateKey} className="timelineItem" onClick={() => onSelectDate(photo.dateKey)}>
              <img src={photo.url} alt="" />
              <span>
                <strong>{formatJapaneseDate(photo.dateKey)}</strong>
                <em>{kgText(weights, photo.dateKey)}</em>
              </span>
            </button>
          ))
        )}
      </div>

      {cameraOpen ? (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onShot={rememberDraft}
          onPickLibrary={() => libraryRef.current?.click()}
        />
      ) : null}

      {draft ? (
        <div className="modalBackdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
            <h3 id="draft-title">{selectedPhoto ? "この日の写真を上書きする？" : "この写真を保存する？"}</h3>
            <img className="draftPreview" src={draft.url} alt="保存前の写真" />
            <p className="kgCaption">{kgText(weights, selectedDateKey)}</p>
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setDraft(null)} disabled={busy}>
                やめる
              </button>
              <button
                type="button"
                className="mainButton"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSavePhoto({
                      dateKey: selectedDateKey,
                      blob: draft.blob,
                      width: draft.width,
                      height: draft.height,
                      byteSize: draft.blob.size,
                      createdAt: new Date().toISOString(),
                    });
                    setDraft(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
