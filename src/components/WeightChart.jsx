import { formatShortDate } from "../lib/dates.js";
import { formatKg } from "../lib/weights.js";

export default function WeightChart({ points, average }) {
  if (points.length === 0) {
    return <p className="hint">この期間の体重はまだないよ。</p>;
  }

  const width = 360;
  const height = 210;
  const pad = { left: 44, right: 14, top: 16, bottom: 32 };
  const seriesValues = points.map((point) => point.kg);
  const values = [...seriesValues, ...(average || [])];
  const labelMax = Math.max(...seriesValues);
  const labelMin = Math.min(...seriesValues);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padY = (max - min) * 0.12;
  min -= padY;
  max += padY;

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const start = Date.parse(points[0].dateKey);
  const end = Date.parse(points[points.length - 1].dateKey);

  function xAt(dateKey) {
    if (end === start) return pad.left + innerW / 2;
    const time = Date.parse(dateKey);
    return pad.left + ((time - start) / (end - start)) * innerW;
  }

  function yAt(kg) {
    return pad.top + ((max - kg) / (max - min)) * innerH;
  }

  function pathFor(series, read) {
    return series
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${xAt(point.dateKey).toFixed(1)} ${yAt(read(point, index)).toFixed(1)}`;
      })
      .join(" ");
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="chartWrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="体重の推移グラフ">
        <line
          x1={pad.left}
          y1={pad.top + innerH}
          x2={width - pad.right}
          y2={pad.top + innerH}
          className="chartAxis"
        />
        <text x={pad.left - 8} y={yAt(labelMax) + 4} className="chartLabel" textAnchor="end">
          {formatKg(labelMax)}
        </text>
        {labelMin !== labelMax ? (
          <text x={pad.left - 8} y={yAt(labelMin) + 4} className="chartLabel" textAnchor="end">
            {formatKg(labelMin)}
          </text>
        ) : null}
        <text x={xAt(first.dateKey)} y={height - 8} className="chartLabel" textAnchor="middle">
          {formatShortDate(first.dateKey)}
        </text>
        {points.length > 1 ? (
          <text x={xAt(last.dateKey)} y={height - 8} className="chartLabel" textAnchor="middle">
            {formatShortDate(last.dateKey)}
          </text>
        ) : null}
        <path d={pathFor(points, (point) => point.kg)} className="chartLine" />
        {average ? (
          <path d={pathFor(points, (_, index) => average[index])} className="chartAverage" />
        ) : null}
        {points.map((point) => (
          <circle
            key={point.dateKey}
            cx={xAt(point.dateKey)}
            cy={yAt(point.kg)}
            r={point === last ? 4.5 : 3.2}
            className="chartDot"
          >
            <title>
              {point.dateKey} {formatKg(point.kg)}kg
            </title>
          </circle>
        ))}
      </svg>
      <div className="chartLegend">
        <span>
          <i className="legendSwatch" /> 体重
        </span>
        {average ? (
          <span>
            <i className="legendSwatch average" /> 7回移動平均
          </span>
        ) : null}
        <span className="chartUnit">kg</span>
      </div>
      <table className="srOnly">
        <caption>体重の推移（kg）</caption>
        <thead>
          <tr>
            <th>日付</th>
            <th>体重</th>
            {average ? <th>7回移動平均</th> : null}
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.dateKey}>
              <td>{point.dateKey}</td>
              <td>{formatKg(point.kg)}</td>
              {average ? <td>{formatKg(average[index])}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
