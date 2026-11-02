import { useMemo, useState } from "react";
import { CUSTOM_EXERCISE } from "../data/exercises.js";
import { findPreviousSession, formatRecordLoad, parseTrainingNumber } from "../lib/records.js";
import { formatJapaneseDate } from "../lib/dates.js";

function selectInput(event) {
  const field = event.currentTarget;
  requestAnimationFrame(() => field.select());
}

export default function AddForm({
  part,
  partLabel,
  options,
  records,
  dateKey,
  lastExercise,
  onRememberExercise,
  onAdd,
  onCreateCustom,
}) {
  const partOptions = useMemo(
    () => options.filter((item) => item.part === part && item.name !== "その他"),
    [options, part]
  );
  const initialExercise = partOptions.some((item) => item.name === lastExercise)
    ? lastExercise
    : partOptions[0]?.name || CUSTOM_EXERCISE;

  const [exercise, setExercise] = useState(initialExercise);
  const [customName, setCustomName] = useState("");
  const [saveCustom, setSaveCustom] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("10");
  const [sets, setSets] = useState("");
  const [error, setError] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  const exerciseName = exercise === CUSTOM_EXERCISE ? customName.trim() : exercise;
  const previous = useMemo(
    () => (exerciseName ? findPreviousSession(records, dateKey, exerciseName) : null),
    [records, dateKey, exerciseName]
  );

  function chooseExercise(next) {
    setExercise(next);
    setError("");
    if (next !== CUSTOM_EXERCISE) onRememberExercise(part, next);
  }

  function addRecord() {
    if (!exerciseName) {
      setError("種目名を入力してね");
      return;
    }

    const repsParsed = parseTrainingNumber(reps, { max: 999 });
    if (!repsParsed.ok) {
      setError("回数は1〜999で入力してね");
      return;
    }

    const setsParsed = parseTrainingNumber(sets, { max: 99 });
    if (!setsParsed.empty && !setsParsed.ok) {
      setError("セット数は1〜99で入力してね");
      return;
    }

    let weightValue = "自重";
    if (weight.trim()) {
      const weightParsed = parseTrainingNumber(weight, { max: 999, decimal: true });
      if (!weightParsed.ok) {
        setError("重量は数字か、空欄（自重）にしてね");
        return;
      }
      weightValue = weightParsed.value;
    }

    onAdd({
      exercise: exerciseName,
      part,
      weight: weightValue,
      reps: repsParsed.value,
      ...(setsParsed.ok ? { sets: setsParsed.value } : {}),
    });

    if (saveCustom && exercise === CUSTOM_EXERCISE) {
      onCreateCustom(exerciseName, part);
      setSaveCustom(false);
    }

    setCustomName("");
    setError("");
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  }

  if (!part) {
    return (
      <div className="addBox">
        <h3>トレーニングを追加</h3>
        <p className="hint">先に、この日の部位を選んでね。</p>
      </div>
    );
  }

  return (
    <form
      className="addBox"
      onSubmit={(event) => {
        event.preventDefault();
        addRecord();
      }}
    >
      <div className="addTitleRow">
        <h3>{partLabel}を追加</h3>
        {justAdded ? <span className="addedBadge">追加しました</span> : null}
      </div>

      <label>
        種目
        <select value={exercise} onChange={(event) => chooseExercise(event.target.value)}>
          {partOptions.map((item) => (
            <option key={`${item.part}-${item.name}`} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value={CUSTOM_EXERCISE}>リストにない種目</option>
        </select>
      </label>

      {exercise === CUSTOM_EXERCISE ? (
        <>
          <label>
            種目名
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="例：ケーブルサイドレイズ"
              autoComplete="off"
              autoCapitalize="off"
            />
          </label>
          <label className="checkRow">
            <input
              type="checkbox"
              checked={saveCustom}
              onChange={(event) => setSaveCustom(event.target.checked)}
            />
            よく使う種目に追加
          </label>
        </>
      ) : null}

      {previous ? (
        <div className="previousBox">
          <div>
            <p>前回の{exerciseName}</p>
            <h4>{formatRecordLoad(previous.best)}</h4>
            <span>
              {formatJapaneseDate(previous.dateKey)}
              {previous.records.length > 1 ? ` ・ 同じ日に${previous.records.length}件` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const best = previous.best;
              setWeight(best.weight === "自重" ? "" : String(best.weight ?? ""));
              setReps(String(best.reps ?? ""));
              setSets(best.sets == null ? "" : String(best.sets));
            }}
          >
            使う
          </button>
        </div>
      ) : null}

      <div className="inputGrid">
        <label>
          重量（kg）
          <input
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            placeholder="空欄で自重"
            inputMode="decimal"
            autoComplete="off"
            onFocus={selectInput}
          />
        </label>
        <label>
          回数
          <input
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            onFocus={selectInput}
          />
        </label>
        <label>
          セット
          <input
            value={sets}
            onChange={(event) => setSets(event.target.value)}
            placeholder="1"
            inputMode="numeric"
            autoComplete="off"
            onFocus={selectInput}
          />
        </label>
      </div>

      {error ? <p className="fieldError">{error}</p> : null}
      <button type="submit" className="mainButton">
        追加する
      </button>
    </form>
  );
}
