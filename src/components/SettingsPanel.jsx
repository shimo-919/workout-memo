import { useRef, useState } from "react";
import { addBodyParts, getPartLabel } from "../data/exercises.js";
import { formatBytes } from "../lib/download.js";
import { summarizeBackup } from "../lib/backup.js";

export default function SettingsPanel({
  customExercises,
  onAddExercise,
  onDeleteExercise,
  onExport,
  onChooseImport,
  pendingImport,
  onConfirmImport,
  onCancelImport,
  busy,
  photoCount,
  photoBytes,
}) {
  const [part, setPart] = useState("chest");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const summary = pendingImport
    ? summarizeBackup(pendingImport.data, pendingImport.photos.length)
    : null;

  function addExercise() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("種目名を入力してね");
      return;
    }
    const exists = customExercises.some((item) => item.part === part && item.name === trimmed);
    if (exists) {
      setError("同じ種目がすでにあるよ");
      return;
    }
    onAddExercise(trimmed, part);
    setName("");
    setError("");
  }

  return (
    <div className="panel exerciseSettings">
      <div className="panelHeader">
        <div>
          <h2>設定</h2>
          <p className="hint">種目の追加と、この端末のバックアップ</p>
        </div>
      </div>

      <h3>種目</h3>
      <div className="settingsInputGrid">
        <label>
          部位
          <select value={part} onChange={(event) => setPart(event.target.value)}>
            {addBodyParts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          種目名
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addExercise();
            }}
            placeholder="例：インクラインプレス"
            autoComplete="off"
          />
        </label>
      </div>
      {error ? <p className="fieldError">{error}</p> : null}
      <button type="button" className="mainButton" onClick={addExercise}>
        種目を追加
      </button>

      <div className="customExerciseList">
        <h4>追加した種目</h4>
        {customExercises.length === 0 ? (
          <p>追加した種目はまだないよ</p>
        ) : (
          customExercises.map((item) => (
            <div key={item.id} className="customExerciseItem">
              <div>
                <span>{getPartLabel(item.part)}</span>
                <strong>{item.name}</strong>
              </div>
              <button type="button" onClick={() => onDeleteExercise(item.id)}>
                削除
              </button>
            </div>
          ))
        )}
      </div>

      <section className="backupSection" aria-label="バックアップ">
        <h3>バックアップ</h3>
        <p className="hint">
          トレーニング、体重、写真を1つのファイルにして、この端末に保存できるよ。写真はアップロードしない。
        </p>
        <p className="hint">
          いまの写真 {photoCount}枚 / {formatBytes(photoBytes)}
        </p>
        <button type="button" className="mainButton" onClick={onExport} disabled={busy}>
          {busy ? "作成中…" : "バックアップを書き出す"}
        </button>
        <button
          type="button"
          className="secondaryButton wide"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          バックアップを読み込む
        </button>
        <input
          ref={fileRef}
          className="fileInput"
          type="file"
          accept=".zip,.json,application/zip,application/json"
          aria-label="バックアップファイルを選ぶ"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onChooseImport(file);
          }}
        />
        {summary ? (
          <div className="importPreview">
            <p>同じ日付の記録・体重・写真は、バックアップの内容で上書きするよ。この端末にしかない日はそのまま残る。</p>
            <ul>
              <li>トレーニング {summary.days}日</li>
              <li>体重 {summary.weights}日</li>
              <li>追加種目 {summary.exercises}件</li>
              <li>写真 {summary.photos}枚</li>
            </ul>
            {pendingImport.data.newer ? <p>新しい形式だよ。読める部分だけ合流する。</p> : null}
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={onCancelImport} disabled={busy}>
                やめる
              </button>
              <button type="button" className="mainButton" onClick={onConfirmImport} disabled={busy}>
                この内容で合流
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
