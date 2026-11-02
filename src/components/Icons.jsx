function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" className="symbol" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconPhotos() {
  return (
    <Icon>
      <rect x="3.5" y="5" width="17" height="14" rx="2" {...stroke} />
      <circle cx="8.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M4 16.5 8.2 12.4l2.4 2.3 2.2-2 4.7 4.3" {...stroke} />
    </Icon>
  );
}

export function IconList() {
  return (
    <Icon>
      <path d="M8 7h11M8 12h11M8 17h11" {...stroke} />
      <path d="M4.5 7h.5M4.5 12h.5M4.5 17h.5" {...stroke} />
    </Icon>
  );
}

export function IconChevron() {
  return (
    <Icon>
      <path d="M14.5 5.5 8 12l6.5 6.5" {...stroke} />
    </Icon>
  );
}

export function IconPlus() {
  return (
    <Icon>
      <path d="M12 5.5v13M5.5 12h13" {...stroke} />
    </Icon>
  );
}

export function IconCamera() {
  return (
    <Icon>
      <path d="M8 7.5 9.2 5.8h5.6L16 7.5h2.2A1.8 1.8 0 0 1 20 9.3v8.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.5V9.3a1.8 1.8 0 0 1 1.8-1.8H8Z" {...stroke} />
      <circle cx="12" cy="13" r="3.1" {...stroke} />
    </Icon>
  );
}

export function IconTrash() {
  return (
    <Icon>
      <path d="M5 8h14" {...stroke} />
      <path d="M9.5 8V5.8h5V8" {...stroke} />
      <path d="M7.2 8l.7 10.2h8.2L16.8 8" {...stroke} />
    </Icon>
  );
}

export function IconCompare() {
  return (
    <Icon>
      <rect x="3.2" y="4.5" width="7.4" height="15" rx="1.6" {...stroke} />
      <rect x="13.4" y="4.5" width="7.4" height="15" rx="1.6" {...stroke} />
    </Icon>
  );
}

export function IconScale() {
  return (
    <Icon>
      <path d="M12 4v3" {...stroke} />
      <path d="M4.5 10h15" {...stroke} />
      <path d="M12 7 4.5 10" {...stroke} />
      <path d="M12 7 19.5 10" {...stroke} />
      <path d="M4.5 10 3 16h5L6.5 10" {...stroke} />
      <path d="M19.5 10 21 16h-5L17.5 10" {...stroke} />
      <path d="M8 20h8" {...stroke} />
      <path d="M12 13v7" {...stroke} />
    </Icon>
  );
}

export function IconMore() {
  return (
    <Icon>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconClose() {
  return (
    <Icon>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />
    </Icon>
  );
}
