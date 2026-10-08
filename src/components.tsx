import type { ReactNode } from "react";
import type { Tutor } from "../shared/catalog";

// 튜터 얼굴: 그라디언트 원 + 단순한 표정. talking 이면 입이 움직인다.
export function Avatar({ tutor, size = 48, talking = false }: { tutor: Tutor; size?: number; talking?: boolean }) {
  const id = `g-${tutor.id}`;
  return (
    <svg className={talking ? "avatar talking" : "avatar"} width={size} height={size} viewBox="0 0 100 100" aria-label={tutor.name} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tutor.colors[0]} />
          <stop offset="1" stopColor={tutor.colors[1]} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      <circle cx="36" cy="44" r="6" fill="#2b2250" />
      <circle cx="64" cy="44" r="6" fill="#2b2250" />
      <circle cx="38" cy="42" r="2" fill="#fff" />
      <circle cx="66" cy="42" r="2" fill="#fff" />
      <circle cx="28" cy="58" r="6" fill="#fff" opacity="0.35" />
      <circle cx="72" cy="58" r="6" fill="#fff" opacity="0.35" />
      <path className="mouth" d="M38 62 Q50 74 62 62" stroke="#2b2250" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-grip" />
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Icon({ name, size = 22 }: { name: "mic" | "send" | "speaker" | "bulb" | "keyboard" | "back" | "close" | "translate" | "gear" | "stop" | "chat" | "book" | "cards" | "trash" | "refresh"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "mic":
      return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
    case "stop":
      return <svg {...p}><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>;
    case "send":
      return <svg {...p}><path d="M4 12l16-8-6 16-2-6-8-2z" /></svg>;
    case "speaker":
      return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>;
    case "bulb":
      return <svg {...p}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>;
    case "keyboard":
      return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></svg>;
    case "back":
      return <svg {...p}><path d="M15 18l-6-6 6-6" /></svg>;
    case "close":
      return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "translate":
      return <svg {...p}><path d="M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 3-3 7-6 8M13 21l4-9 4 9M14.5 18h5" /></svg>;
    case "chat":
      return <svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>;
    case "book":
      return <svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" /><path d="M4 19a2 2 0 0 1 2-2h13M9 7h6" /></svg>;
    case "cards":
      return <svg {...p}><rect x="3" y="7" width="13" height="14" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v12" /></svg>;
    case "trash":
      return <svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
    case "refresh":
      return <svg {...p}><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></svg>;
    case "gear":
      return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
  }
}

export type Tab = "talk" | "grammar" | "words" | "speak";

export function TabBar({ tab, onTab, wordsDue }: { tab: Tab; onTab: (t: Tab) => void; wordsDue: number }) {
  const items: { id: Tab; label: string; icon: "chat" | "book" | "cards" | "mic" }[] = [
    { id: "talk", label: "대화", icon: "chat" },
    { id: "grammar", label: "문법", icon: "book" },
    { id: "words", label: "단어", icon: "cards" },
    { id: "speak", label: "발음", icon: "mic" },
  ];
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button key={it.id} className={tab === it.id ? "on" : ""} onClick={() => onTab(it.id)} aria-current={tab === it.id ? "page" : undefined}>
          <span className="tab-icon">
            <Icon name={it.icon} />
            {it.id === "words" && wordsDue > 0 && <i className="badge">{wordsDue > 99 ? "99+" : wordsDue}</i>}
          </span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
