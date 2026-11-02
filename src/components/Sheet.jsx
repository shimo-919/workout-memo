export function Sheet({ title, onClose, children, trailing }) {
  return (
    <div className="sheetBackdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grabber" aria-hidden="true" />
        <div className="sheetBar">
          <button type="button" className="navTextButton" onClick={onClose}>
            キャンセル
          </button>
          <h2 id="sheet-title">{title}</h2>
          <div className="sheetTrail">{trailing}</div>
        </div>
        <div className="sheetBody">{children}</div>
      </div>
    </div>
  );
}

export function ActionSheet({ message, confirmLabel, onConfirm, onClose }) {
  return (
    <div className="sheetBackdrop" onClick={onClose} role="presentation">
      <div className="actionWrap" onClick={(event) => event.stopPropagation()}>
        <div className="actionGroup">
          <p>{message}</p>
          <button type="button" className="actionDestructive" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
        <button type="button" className="actionCancel" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
