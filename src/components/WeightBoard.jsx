import { useMemo, useState } from "react";
import { formatJapaneseDate } from "../lib/dates.js";
import { filterWeightRange, formatKg, movingAverage, parseKgInput, sortedWeights, WEIGHT_RANGES, weightDelta } from "../lib/weights.js";
import { Sheet } from "./Sheet.jsx";

function TrendChart({ points, average }) {
  if (points.length === 0) return <p className="emptyCopy">この期間の体重はありません</p>;
  const width = 320;
  const height = 168;
  const pad = { left: 36, right: 8, top: 12, bottom: 24 };
  const values = points.map((point) => point.kg);
  const extras = average || [];
  let min = Math.min(...values, ...(extras.length ? extras : values));
  let max = Math.max(...values, ...(extras.length ? extras : values));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min || 1;
  min -= span * 0.12;
  max += span * 0.12;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const start = Date.parse(points[0].dateKey);
  const end = Date.parse(points[points.length - 1].dateKey);
  const xAt = (dateKey) => {
    if (end === start) return pad.left + innerW / 2;
    return pad.left + ((Date.parse(dateKey) - start) / (end - start)) * innerW;
  };
  const yAt = (kg) => pad.top + ((max - kg) / (max - min)) * innerH;
  const line = points.map((point, index) => `${index ? "L" : "M"}${xAt(point.dateKey).toFixed(1)} ${yAt(point.kg).toFixed(1)}`).join(" ");
  const avgLine = average
    ? points.map((point, index) => `${index ? "L" : "M"}${xAt(point.dateKey).toFixed(1)} ${yAt(average[index]).toFixed(1)}`).join(" ")
    : "";

  return (
    <svg className="trendChart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="体重の推移">
      <line className="chartAxis" x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} />
      <text className="chartLabel" x={4} y={yAt(max) + 4}>{formatKg(max)}</text>
      <text className="chartLabel" x={4} y={yAt(min) + 4}>{formatKg(min)}</text>
      {avgLine ? <path className="chartAverage" d={avgLine} /> : null}
      <path className="chartLine" d={line} />
      {points.map((point) => (
        <circle key={point.dateKey} className="chartDot" cx={xAt(point.dateKey)} cy={yAt(point.kg)} r="3" />
      ))}
    </svg>
  );
}

export default function WeightBoard({ dateKey, todayKey, weights, onSave, onDelete, onPickDate, onClose }) {
  const [text, setText] = useState(() => (weights[dateKey] ? formatKg(weights[dateKey].kg) : ""));
  const [error, setError] = useState("");
  const [range, setRange] = useState("month");
  const [showAverage, setShowAverage] = useState(true);
  const all = useMemo(() => sortedWeights(weights), [weights]);
  const points = useMemo(() => filterWeightRange(all, range, todayKey), [all, range, todayKey]);
  const average = showAverage && points.length >= 2 ? movingAverage(points.map((point) => point.kg), 7) : null;
  const history = [...all].reverse();

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
    setText(formatKg(parsed.kg));
    setError("");
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
            />
          </label>
        </div>
        {weights[dateKey] ? (
          <button type="button" className="navTextButton center destructive" onClick={() => onDelete(dateKey)}>
            この日の体重を削除
          </button>
        ) : null}
        {error ? <p className="formError">{error}</p> : null}
      </form>

      <div className="zoomControl inline" role="tablist" aria-label="期間">
        {WEIGHT_RANGES.map((item) => (
          <button key={item.id} type="button" className={range === item.id ? "active" : ""} onClick={() => setRange(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <label className="switchRow">
        <span>7回の移動平均</span>
        <input type="checkbox" checked={showAverage} onChange={(event) => setShowAverage(event.target.checked)} />
      </label>
      <TrendChart points={points} average={average} />

      <div className="sectionHead"><span>履歴</span></div>
      {history.length === 0 ? (
        <p className="emptyCopy">体重の記録はありません</p>
      ) : (
        <div className="group">
          {history.map((entry, index) => {
            const older = history[index + 1];
            const diff = older ? weightDelta(older.kg, entry.kg) : null;
            return (
              <button
                type="button"
                className="cell"
                key={entry.dateKey}
                onClick={() => onPickDate(entry.dateKey)}
              >
                <div className="cellBody">
                  <strong>{formatJapaneseDate(entry.dateKey)}</strong>
                </div>
                <span className="cellValue">
                  {formatKg(entry.kg)} kg
                  {diff != null && diff !== 0 ? <small>{diff > 0 ? "+" : ""}{formatKg(diff)}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
