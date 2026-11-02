import { useMemo, useState } from "react";
import { formatJapaneseDate } from "../lib/dates.js";
import { formatKg, filterWeightRange, movingAverage, sortedWeights, WEIGHT_RANGES, weightDelta } from "../lib/weights.js";
import WeightChart from "./WeightChart.jsx";
import WeightField from "./WeightField.jsx";

export default function WeightPanel({
  weights,
  selectedDateKey,
  todayKey,
  onSelectDate,
  onSave,
  onDelete,
}) {
  const [range, setRange] = useState("month");
  const [showAverage, setShowAverage] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const all = useMemo(() => sortedWeights(weights), [weights]);
  const points = useMemo(
    () => filterWeightRange(all, range, todayKey),
    [all, range, todayKey]
  );
  const average =
    showAverage && points.length >= 2 ? movingAverage(points.map((point) => point.kg), 7) : null;
  const delta =
    points.length >= 2 ? weightDelta(points[0].kg, points[points.length - 1].kg) : null;
  const history = [...all].reverse();
  const visibleHistory = showAllHistory ? history : history.slice(0, 30);
  const latest = all[all.length - 1];

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <h2>体重</h2>
          <p className="hint">1日1件。あとから修正できるよ。</p>
        </div>
        {latest ? (
          <p className="statPill">
            最新 {formatKg(latest.kg)}kg
            <span>{formatJapaneseDate(latest.dateKey)}</span>
          </p>
        ) : null}
      </div>

      <div className="dateJump">
        <label>
          記録する日
          <input
            type="date"
            value={selectedDateKey}
            onChange={(event) => {
              if (event.target.value) onSelectDate(event.target.value);
            }}
          />
        </label>
      </div>

      <WeightField
        key={`weight-${selectedDateKey}:${weights[selectedDateKey]?.kg ?? ""}`}
        dateKey={selectedDateKey}
        entry={weights[selectedDateKey]}
        onSave={onSave}
        onDelete={onDelete}
      />

      <div className="rangeRow" role="radiogroup" aria-label="グラフの期間">
        {WEIGHT_RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={range === item.id}
            className={range === item.id ? "active" : ""}
            onClick={() => setRange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="checkRow">
        <input
          type="checkbox"
          checked={showAverage}
          onChange={(event) => setShowAverage(event.target.checked)}
        />
        7回の移動平均を表示
      </label>

      {delta != null ? (
        <p className="deltaText">
          期間の変化 {delta > 0 ? "+" : ""}
          {formatKg(delta)}kg（{formatKg(points[0].kg)} → {formatKg(points[points.length - 1].kg)}）
        </p>
      ) : null}

      <WeightChart points={points} average={average} />

      <div className="historyList">
        <h3>履歴</h3>
        {history.length === 0 ? (
          <p className="hint">まだ体重の記録はないよ。</p>
        ) : (
          visibleHistory.map((entry, index) => {
            const older = history[index + 1];
            const diff = older ? weightDelta(older.kg, entry.kg) : null;
            return (
              <div className="historyRow" key={entry.dateKey}>
                <button type="button" onClick={() => onSelectDate(entry.dateKey)}>
                  <strong>{formatJapaneseDate(entry.dateKey)}</strong>
                  <span>{formatKg(entry.kg)}kg</span>
                </button>
                {diff != null && diff !== 0 ? (
                  <em>
                    {diff > 0 ? "+" : ""}
                    {formatKg(diff)}
                  </em>
                ) : (
                  <em className="flat">—</em>
                )}
              </div>
            );
          })
        )}
        {history.length > 30 && !showAllHistory ? (
          <button type="button" className="secondaryButton wide" onClick={() => setShowAllHistory(true)}>
            すべて表示（{history.length}件）
          </button>
        ) : null}
      </div>
    </div>
  );
}
