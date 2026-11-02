import { useState } from "react";
import { formatKg, parseKgInput } from "../lib/weights.js";

export default function WeightField({ dateKey, entry, onSave, onDelete, compact = false }) {
  const [text, setText] = useState(entry ? formatKg(entry.kg) : "");
  const [error, setError] = useState("");

  function commit() {
    const parsed = parseKgInput(text);

    if (parsed.empty) {
      setText(entry ? formatKg(entry.kg) : "");
      setError("");
      return;
    }

    if (!parsed.ok) {
      setError("15〜500の数字で入力してね");
      return;
    }

    if (entry && entry.kg === parsed.kg) {
      setText(formatKg(parsed.kg));
      setError("");
      return;
    }

    onSave(dateKey, parsed.kg);
    setText(formatKg(parsed.kg));
    setError("");
  }

  return (
    <form
      className={compact ? "weightField compact" : "weightField"}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <label>
        体重（kg）
        <input
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          onBlur={commit}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="例：62.4"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `weight-error-${dateKey}` : undefined}
        />
      </label>
      <button type="submit" className="secondaryButton">
        保存
      </button>
      {entry && onDelete ? (
        <button type="button" className="textButton" onClick={() => onDelete(dateKey)}>
          削除
        </button>
      ) : null}
      {error ? (
        <p id={`weight-error-${dateKey}`} className="fieldError">
          {error}
        </p>
      ) : null}
    </form>
  );
}
