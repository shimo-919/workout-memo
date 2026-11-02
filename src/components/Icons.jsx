function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" className="navIcon" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconRecord() {
  return (
    <Svg>
      <path
        d="M7 3.5h8.5A2.5 2.5 0 0 1 18 6v14.5l-4.2-2.2L9.5 20.5 5.5 18.3V6A2.5 2.5 0 0 1 8 3.5H7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.5 8.5h6M8.5 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconPhoto() {
  return (
    <Svg>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M7 16.5 10.2 13l2.2 2.2 1.7-1.6L17 16.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconWeight() {
  return (
    <Svg>
      <path d="M4 10v4M7 7v10M17 7v10M20 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}
