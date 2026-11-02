import { getMonthDays, toDateKey } from "../lib/dates.js";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function CalendarMonth({
  viewYear,
  viewMonth,
  onChangeMonth,
  selectedDateKey,
  todayKey,
  onSelectDate,
  getDayState,
  children,
  embedded = false,
}) {
  const days = getMonthDays(viewYear, viewMonth);

  return (
    <section
      className={embedded ? "calendarCard embedded" : "calendarCard"}
      aria-label={`${viewYear}年${viewMonth + 1}月のカレンダー`}
    >
      <div className="calendarHeader">
        <button type="button" onClick={() => onChangeMonth(-1)} aria-label="前の月">
          ‹
        </button>
        <h2>
          {viewYear}年 {viewMonth + 1}月
        </h2>
        <button type="button" onClick={() => onChangeMonth(1)} aria-label="次の月">
          ›
        </button>
      </div>

      {children}

      <div className="weekRow" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendarGrid" role="grid">
        {days.map((date, index) => {
          if (!date) return <div className="emptyDay" key={`empty-${viewYear}-${viewMonth}-${index}`} />;

          const dateKey = toDateKey(date);
          const state = getDayState(dateKey);
          const selected = dateKey === selectedDateKey;
          const today = dateKey === todayKey;

          return (
            <button
              type="button"
              key={dateKey}
              role="gridcell"
              className={[
                "dayButton",
                state.marked ? "hasRecordBg" : "",
                selected ? "selected" : "",
                today ? "today" : "",
              ].join(" ")}
              aria-pressed={selected}
              aria-label={state.label}
              onClick={() => onSelectDate(dateKey)}
            >
              <span>{date.getDate()}</span>
              {state.dotted ? <i className="dayMark" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
