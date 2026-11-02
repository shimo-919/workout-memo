import { useEffect, useMemo, useRef, useState } from "react";
import { formatJapaneseDate, formatLibraryDate, weekdayLabel } from "../lib/dates.js";
import { formatKg, parseKgInput } from "../lib/weights.js";
import { compressImage } from "../lib/image.js";
import { getPhotosByDates } from "../lib/photos.js";
import CameraCapture from "./CameraCapture.jsx";
import { Sheet, ActionSheet } from "./Sheet.jsx";
import { IconCamera, IconChevron, IconCompare, IconScale, IconTrash } from "./Icons.jsx";

function kgPhrase(weights, dateKey) {
  const kg = weights[dateKey]?.kg;
  return Number.isFinite(kg) ? `この写真 = ${formatKg(kg)}kg` : "体重未記録";
}

function WeightSheet({ dateKey, entry, onSave, onClose }) {
  const [text, setText] = useState(entry ? formatKg(entry.kg) : "");
  const [error, setError] = useState("");

  function save(event) {
    event.preventDefault();
    const parsed = parseKgInput(text);
    if (parsed.empty) {
      setError("体重を入力してください");
      return;
    }
    if (!parsed.ok) {
      setError("15〜500の数字で入力してください");
      return;
    }
    onSave(dateKey, parsed.kg);
    onClose();
  }

  return (
    <Sheet
      title="体重"
      onClose={onClose}
      trailing={
        <button type="submit" form="weight-form" className="navTextButton strong">
          保存
        </button>
      }
    >
      <form id="weight-form" onSubmit={save}>
        <p className="sheetLead">{formatJapaneseDate(dateKey)}</p>
        <div className="group">
          <label className="cell field">
            <span>kg</span>
            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
              }}
              inputMode="decimal"
              autoComplete="off"
              placeholder="62.4"
              autoFocus
            />
          </label>
        </div>
        {error ? <p className="formError">{error}</p> : null}
      </form>
    </Sheet>
  );
}

export default function PhotoDay({
  photoMeta,
  weights,
  todayKey,
  onSaveWeight,
  onSavePhoto,
  onDeletePhoto,
  notify,
}) {
  const libraryRef = useRef(null);
  const urlCache = useRef(new Map());
  const [photos, setPhotos] = useState([]);
  const [zoom, setZoom] = useState("all");
  const [viewerDate, setViewerDate] = useState(null);
  const [chrome, setChrome] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [weightFor, setWeightFor] = useState(null);
  const [compareWith, setCompareWith] = useState(null);
  const [pickingCompare, setPickingCompare] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const touch = useRef(null);

  const photoDates = useMemo(() => photoMeta.map((item) => item.dateKey), [photoMeta]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const records = await getPhotosByDates(photoDates);
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
        next.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
        setPhotos(next);
      } catch {
        if (!cancelled) notify("写真を読み込めませんでした");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [photoDates, notify]);

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
  const viewer = viewerDate ? byDate.get(viewerDate) : null;
  const viewerIndex = photos.findIndex((photo) => photo.dateKey === viewerDate);

  const months = useMemo(() => {
    const groups = new Map();
    for (const photo of photos) {
      const key = photo.dateKey.slice(0, 7);
      const list = groups.get(key) || [];
      list.push(photo);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [photos]);

  const years = useMemo(() => {
    const groups = new Map();
    for (const photo of photos) {
      const key = photo.dateKey.slice(0, 4);
      if (!groups.has(key)) groups.set(key, photo);
    }
    return [...groups.entries()];
  }, [photos]);

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
      notify(error.message || "この画像は読み込めませんでした");
    } finally {
      setBusy(false);
    }
  }

  function openViewer(dateKey) {
    setViewerDate(dateKey);
    setChrome(true);
  }

  return (
    <div className="library">
      {photos.length === 0 ? (
        <div className="emptyLibrary">
          <p>写真がありません</p>
          <button type="button" className="navTextButton" onClick={() => setCameraOpen(true)}>
            写真を撮る
          </button>
        </div>
      ) : null}

      {zoom === "all" ? (
        <div className="grid">
          {photos.map((photo) => (
            <button type="button" className="thumb" key={photo.dateKey} onClick={() => openViewer(photo.dateKey)}>
              <img src={photo.url} alt={`${formatLibraryDate(photo.dateKey, todayKey)} ${kgPhrase(weights, photo.dateKey)}`} />
              <span>{Number.isFinite(weights[photo.dateKey]?.kg) ? `${formatKg(weights[photo.dateKey].kg)}kg` : ""}</span>
            </button>
          ))}
        </div>
      ) : null}

      {zoom === "days"
        ? photos.map((photo) => (
            <section className="dayBlock" key={photo.dateKey}>
              <div className="dayHeader">
                <h2>
                  {formatLibraryDate(photo.dateKey, todayKey)}
                  <small>{weekdayLabel(photo.dateKey)}</small>
                </h2>
                <button type="button" className="kgLink" onClick={() => setWeightFor(photo.dateKey)}>
                  {kgPhrase(weights, photo.dateKey)}
                </button>
              </div>
              <div className="dayRow">
                <button type="button" className="thumb" onClick={() => openViewer(photo.dateKey)}>
                  <img src={photo.url} alt="" />
                  <span>{Number.isFinite(weights[photo.dateKey]?.kg) ? `${formatKg(weights[photo.dateKey].kg)}kg` : ""}</span>
                </button>
              </div>
            </section>
          ))
        : null}

      {zoom === "months"
        ? months.map(([month, list]) => (
            <section className="dayBlock" key={month}>
              <div className="dayHeader">
                <h2>
                  {Number(month.slice(0, 4))}年{Number(month.slice(5))}月
                </h2>
              </div>
              <div className="grid">
                {list.map((photo) => (
                  <button type="button" className="thumb" key={photo.dateKey} onClick={() => openViewer(photo.dateKey)}>
                    <img src={photo.url} alt="" />
                    <span>{Number(photo.dateKey.slice(8))}日</span>
                    <em>{Number.isFinite(weights[photo.dateKey]?.kg) ? `${formatKg(weights[photo.dateKey].kg)}kg` : ""}</em>
                  </button>
                ))}
              </div>
            </section>
          ))
        : null}

      {zoom === "years" ? (
        <div className="yearList">
          {years.map(([year, photo]) => (
            <button type="button" className="yearTile" key={year} onClick={() => setZoom("months")}>
              <img src={photo.url} alt="" />
              <span>{year}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="libraryEnd" />

      <div className="zoomControl" role="tablist" aria-label="表示">
        {[
          ["all", "すべて"],
          ["days", "日"],
          ["months", "月"],
          ["years", "年"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={zoom === id}
            className={zoom === id ? "active" : ""}
            onClick={() => setZoom(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" className="navPlus" aria-label="写真を撮る" onClick={() => setCameraOpen(true)}>
        <IconCamera />
      </button>
      <input ref={libraryRef} className="fileInput" type="file" accept="image/*" aria-label="写真をライブラリから選ぶ" onChange={onLibrary} />

      {viewer ? (
        <div
          className={chrome ? "viewer" : "viewer chromeOff"}
          onTouchStart={(event) => {
            touch.current = event.changedTouches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const start = touch.current;
            if (start == null) return;
            const delta = event.changedTouches[0].clientX - start;
            if (delta > 50 && viewerIndex > 0) openViewer(photos[viewerIndex - 1].dateKey);
            if (delta < -50 && viewerIndex < photos.length - 1) openViewer(photos[viewerIndex + 1].dateKey);
          }}
        >
          <button type="button" className="viewerStage" onClick={() => setChrome((value) => !value)} aria-label="操作を表示">
            <img src={viewer.url} alt={`${formatLibraryDate(viewer.dateKey, todayKey)}の全身写真`} />
          </button>
          <header className="viewerTop">
            <button type="button" className="viewerText" onClick={() => setViewerDate(null)}>
              <IconChevron />
              写真
            </button>
            <div className="viewerTitle">
              <strong>{formatLibraryDate(viewer.dateKey, todayKey)}</strong>
              <span>{kgPhrase(weights, viewer.dateKey)}</span>
            </div>
            <span className="viewerSpacer" />
          </header>
          <footer className="viewerBar">
            <button type="button" aria-label="体重" onClick={() => setWeightFor(viewer.dateKey)}>
              <IconScale />
            </button>
            <button type="button" aria-label="比べる" onClick={() => setPickingCompare(true)}>
              <IconCompare />
            </button>
            <button type="button" aria-label="削除" onClick={() => setPendingDelete(viewer.dateKey)}>
              <IconTrash />
            </button>
            <button type="button" aria-label="撮り直す" onClick={() => setCameraOpen(true)}>
              <IconCamera />
            </button>
          </footer>
        </div>
      ) : null}

      {compareWith && byDate.get(compareWith) && viewer ? (
        <div className="compareView">
          <header className="viewerTop">
            <button type="button" className="viewerText" onClick={() => setCompareWith(null)}>
              <IconChevron />
              戻る
            </button>
            <div className="viewerTitle">
              <strong>比較</strong>
            </div>
            <span className="viewerSpacer" />
          </header>
          <div className="comparePhotos">
            {[byDate.get(compareWith), viewer].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).map((photo) => (
              <figure key={photo.dateKey}>
                <img src={photo.url} alt={`${formatLibraryDate(photo.dateKey, todayKey)}の全身写真`} />
                <figcaption>
                  <strong>{formatLibraryDate(photo.dateKey, todayKey)}</strong>
                  <span>{kgPhrase(weights, photo.dateKey)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {pickingCompare ? (
        <Sheet title="比べる日" onClose={() => setPickingCompare(false)}>
          <div className="group">
            {photos
              .filter((photo) => photo.dateKey !== viewerDate)
              .map((photo) => (
                <button
                  type="button"
                  className="cell pickRow"
                  key={photo.dateKey}
                  onClick={() => {
                    setCompareWith(photo.dateKey);
                    setPickingCompare(false);
                  }}
                >
                  <img src={photo.url} alt="" />
                  <span>
                    <strong>{formatLibraryDate(photo.dateKey, todayKey)}</strong>
                    <em>{kgPhrase(weights, photo.dateKey)}</em>
                  </span>
                </button>
              ))}
          </div>
        </Sheet>
      ) : null}

      {weightFor ? (
        <WeightSheet
          dateKey={weightFor}
          entry={weights[weightFor]}
          onSave={onSaveWeight}
          onClose={() => setWeightFor(null)}
        />
      ) : null}

      {cameraOpen ? (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onShot={rememberDraft}
          onPickLibrary={() => libraryRef.current?.click()}
        />
      ) : null}

      {draft ? (
        <div className="viewer">
          <header className="viewerTop">
            <button type="button" className="viewerText" onClick={() => setDraft(null)}>
              キャンセル
            </button>
            <div className="viewerTitle">
              <strong>{viewerDate ? formatLibraryDate(viewerDate, todayKey) : "今日"}</strong>
              <span>{kgPhrase(weights, viewerDate || todayKey)}</span>
            </div>
            <button
              type="button"
              className="viewerText"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSavePhoto({
                    dateKey: viewerDate || todayKey,
                    blob: draft.blob,
                    width: draft.width,
                    height: draft.height,
                    byteSize: draft.blob.size,
                    createdAt: new Date().toISOString(),
                  });
                  const savedDate = viewerDate || todayKey;
                  setDraft(null);
                  setViewerDate(savedDate);
                } finally {
                  setBusy(false);
                }
              }}
            >
              保存
            </button>
          </header>
          <img className="draftFull" src={draft.url} alt="保存前の写真" />
        </div>
      ) : null}

      {pendingDelete ? (
        <ActionSheet
          message="この写真を削除しますか？"
          confirmLabel="写真を削除"
          onClose={() => setPendingDelete(null)}
          onConfirm={async () => {
            const dateKey = pendingDelete;
            setPendingDelete(null);
            setViewerDate(null);
            await onDeletePhoto(dateKey);
          }}
        />
      ) : null}
    </div>
  );
}
