import { useEffect, useMemo, useRef, useState } from "react";
import { formatJapaneseDate, monthPrefix } from "../lib/dates.js";
import { formatKg } from "../lib/weights.js";
import { formatBytes } from "../lib/download.js";
import { compressImage } from "../lib/image.js";
import { getPhotosByDates } from "../lib/photos.js";
import CalendarMonth from "./CalendarMonth.jsx";
import CameraCapture from "./CameraCapture.jsx";
import WeightField from "./WeightField.jsx";

function weightText(weights, dateKey) {
  const entry = weights[dateKey];
  return entry ? `${formatKg(entry.kg)}kg` : "体重なし";
}

function PhotoCompare({ left, right, onSwap }) {
  const frameRef = useRef(null);
  const [mode, setMode] = useState("slider");
  const [pos, setPos] = useState(50);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || mode !== "slider") return undefined;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, left, right]);

  return (
    <section className="compareBox" aria-label="写真の比較">
      <div className="compareToolbar">
        <div className="rangeRow" role="radiogroup" aria-label="比較の見方">
          <button type="button" role="radio" aria-checked={mode === "slider"} className={mode === "slider" ? "active" : ""} onClick={() => setMode("slider")}>
            スライダー
          </button>
          <button type="button" role="radio" aria-checked={mode === "side"} className={mode === "side" ? "active" : ""} onClick={() => setMode("side")}>
            並べて
          </button>
        </div>
        <button type="button" className="secondaryButton" onClick={onSwap}>
          左右を入れ替え
        </button>
      </div>

      {mode === "slider" ? (
        <div className="compareFrame" ref={frameRef}>
          <img src={right.url} alt={`${formatJapaneseDate(right.dateKey)}の写真`} />
          <div className="compareClip" style={{ width: `${pos}%` }}>
            <img
              src={left.url}
              alt=""
              style={{ width: width ? `${width}px` : "100%" }}
            />
          </div>
          <input
            className="compareRange"
            type="range"
            min="0"
            max="100"
            value={pos}
            aria-label="比較の位置"
            aria-valuetext={`${formatJapaneseDate(left.dateKey)}と${formatJapaneseDate(right.dateKey)}`}
            onChange={(event) => setPos(Number(event.target.value))}
          />
        </div>
      ) : (
        <div className="compareSide">
          {[left, right].map((photo) => (
            <figure key={photo.dateKey}>
              <img src={photo.url} alt={`${formatJapaneseDate(photo.dateKey)}の写真`} />
            </figure>
          ))}
        </div>
      )}

      <div className="compareCaptions">
        {[left, right].map((photo) => (
          <p key={photo.dateKey}>
            <strong>{formatJapaneseDate(photo.dateKey)}</strong>
            <span>{photo.weightLabel}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

export default function PhotoPanel({
  photoMeta,
  weights,
  selectedDateKey,
  todayKey,
  viewYear,
  viewMonth,
  onChangeMonth,
  onSelectDate,
  onSaveWeight,
  onDeleteWeight,
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
  const [flipped, setFlipped] = useState(false);
  const [viewerDate, setViewerDate] = useState(null);

  const monthKey = monthPrefix(viewYear, viewMonth);
  const photoDates = useMemo(() => photoMeta.map((item) => item.dateKey), [photoMeta]);
  const totalBytes = photoMeta.reduce((sum, item) => sum + (item.byteSize || 0), 0);

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
    const url = URL.createObjectURL(image.blob);
    setDraft({ ...image, url });
    setCameraOpen(false);
  }

  async function onLibraryChange(event) {
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

  async function saveDraft() {
    if (!draft) return;
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
  }

  function toggleCompareDate(dateKey) {
    if (!photoDates.includes(dateKey)) {
      notify("この日の写真はまだないよ");
      return;
    }
    setFlipped(false);
    setPair((current) => {
      if (current.includes(dateKey)) return current.filter((item) => item !== dateKey);
      const next = [...current, dateKey].slice(-2);
      return [...next].sort();
    });
  }

  const left = byDate.get(flipped ? pair[1] : pair[0]);
  const right = byDate.get(flipped ? pair[0] : pair[1]);
  const viewer = viewerDate ? byDate.get(viewerDate) : null;

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <h2>体の写真</h2>
          <p className="hint">写真はこの端末の中だけに保存するよ。サーバーには送らない。</p>
        </div>
        <p className="statPill">
          {photoMeta.length}枚
          <span>{formatBytes(totalBytes)}</span>
        </p>
      </div>

      <article className="photoHero">
        {selectedPhoto ? (
          <button type="button" className="photoHeroButton" onClick={() => setViewerDate(selectedPhoto.dateKey)}>
            <img src={selectedPhoto.url} alt={`${formatJapaneseDate(selectedDateKey)}の全身写真`} />
          </button>
        ) : (
          <div className="photoEmpty">
            <p>この日の写真はまだないよ</p>
          </div>
        )}
        <div className="photoHeroMeta">
          <div>
            <p className="hint">選択中の日付</p>
            <h3>{formatJapaneseDate(selectedDateKey)}</h3>
            <p className="weightLine">{weightText(weights, selectedDateKey)}</p>
          </div>
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
        </div>
      </article>

      <input
        ref={libraryRef}
        className="fileInput"
        type="file"
        accept="image/*"
        onChange={onLibraryChange}
        aria-label="写真をライブラリから選ぶ"
      />

      <p className="hint">保存するときに位置情報は消えるよ。1日1枚で、同じ日は上書きできる。</p>

      <WeightField
        key={`photo-${selectedDateKey}:${weights[selectedDateKey]?.kg ?? ""}`}
        dateKey={selectedDateKey}
        entry={weights[selectedDateKey]}
        onSave={onSaveWeight}
        onDelete={onDeleteWeight}
        compact
      />

      <CalendarMonth
        embedded
        viewYear={viewYear}
        viewMonth={viewMonth}
        onChangeMonth={onChangeMonth}
        selectedDateKey={selectedDateKey}
        todayKey={todayKey}
        onSelectDate={(dateKey) => {
          if (compareOn) toggleCompareDate(dateKey);
          onSelectDate(dateKey);
        }}
        getDayState={(dateKey) => {
          const hasPhoto = photoDates.includes(dateKey);
          const comparing = pair.includes(dateKey);
          return {
            marked: hasPhoto,
            dotted: comparing,
            label: [
              formatJapaneseDate(dateKey),
              hasPhoto ? "写真あり" : "写真なし",
              weightText(weights, dateKey),
              comparing ? "比較に選択中" : "",
            ]
              .filter(Boolean)
              .join("、"),
          };
        }}
      />

      <div className="compareToolbar">
        <button
          type="button"
          className={compareOn ? "secondaryButton active" : "secondaryButton"}
          aria-pressed={compareOn}
          onClick={() => {
            setCompareOn((value) => !value);
            setPair([]);
            setFlipped(false);
          }}
        >
          {compareOn ? "比較をやめる" : "2枚を比べる"}
        </button>
        {compareOn ? <p className="hint">写真のある日を2つ選んでね。左が古い日付になるよ。</p> : null}
      </div>

      {left && right ? (
        <PhotoCompare
          left={{ ...left, weightLabel: weightText(weights, left.dateKey) }}
          right={{ ...right, weightLabel: weightText(weights, right.dateKey) }}
          onSwap={() => setFlipped((value) => !value)}
        />
      ) : null}

      <div className="photoTimeline">
        <h3>この月の写真</h3>
        {monthPhotos.length === 0 ? (
          <p className="hint">この月の写真はまだないよ。</p>
        ) : (
          monthPhotos.map((photo) => (
            <button
              type="button"
              key={photo.dateKey}
              className="timelineItem"
              onClick={() => {
                onSelectDate(photo.dateKey);
                setViewerDate(photo.dateKey);
              }}
            >
              <img src={photo.url} alt="" />
              <span>
                <strong>{formatJapaneseDate(photo.dateKey)}</strong>
                <em>{weightText(weights, photo.dateKey)}</em>
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
        <div className="modalBackdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="draft-title">
            <h3 id="draft-title">
              {selectedPhoto ? "この日の写真を上書きする？" : "この写真を保存する？"}
            </h3>
            <p className="hint">{formatJapaneseDate(selectedDateKey)}の1枚として、この端末だけに残るよ。</p>
            <img className="draftPreview" src={draft.url} alt="保存前の写真" />
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setDraft(null)} disabled={busy}>
                やめる
              </button>
              <button type="button" className="mainButton" onClick={saveDraft} disabled={busy}>
                {busy ? "保存中" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewer ? (
        <div className="modalBackdrop" role="presentation" onClick={() => setViewerDate(null)}>
          <div
            className="viewer"
            role="dialog"
            aria-modal="true"
            aria-label={`${formatJapaneseDate(viewer.dateKey)}の写真`}
            onClick={(event) => event.stopPropagation()}
          >
            <img src={viewer.url} alt={`${formatJapaneseDate(viewer.dateKey)}の全身写真`} />
            <div className="viewerMeta">
              <p>
                <strong>{formatJapaneseDate(viewer.dateKey)}</strong>
                <span>{weightText(weights, viewer.dateKey)}</span>
              </p>
              <button type="button" className="secondaryButton" onClick={() => setViewerDate(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
