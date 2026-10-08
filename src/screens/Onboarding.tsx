import { useState } from "react";
import { TUTORS } from "../../shared/catalog";
import type { Goal, Level } from "../../shared/types";
import { Avatar, Icon } from "../components";
import { defaultProfile, type Profile } from "../lib/store";

const GOALS: { id: Goal; label: string; sub: string }[] = [
  { id: "daily", label: "일상 대화", sub: "친구·동료와 자연스럽게" },
  { id: "travel", label: "여행 영어", sub: "공항·호텔·식당에서" },
  { id: "work", label: "업무 영어", sub: "회의·이메일·면접" },
  { id: "exam", label: "말하기 시험", sub: "OPIc · 토익 스피킹" },
  { id: "confidence", label: "자신감 키우기", sub: "틀려도 괜찮게 말하기" },
];

const LEVELS: { id: Level; label: string; sub: string }[] = [
  { id: "beginner", label: "입문", sub: "간단한 인사와 자기소개 정도" },
  { id: "intermediate", label: "중급", sub: "일상 대화는 되지만 막힐 때가 있어요" },
  { id: "advanced", label: "고급", sub: "대부분 말할 수 있고 더 자연스럽고 싶어요" },
];

const MINUTES = [5, 10, 15, 20];

export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(defaultProfile);
  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }));
  const next = () => setStep((s) => s + 1);
  const TOTAL = 5;

  return (
    <div className="screen onboarding">
      {step > 0 && (
        <div className="ob-top">
          <button className="icon-btn" onClick={() => setStep((s) => s - 1)} aria-label="뒤로">
            <Icon name="back" />
          </button>
          <div className="progress">
            <div style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="ob-welcome">
          <div className="avatar-row">
            {TUTORS.map((t, i) => (
              <div key={t.id} className="float" style={{ animationDelay: `${i * 0.3}s` }}>
                <Avatar tutor={t} size={64} />
              </div>
            ))}
          </div>
          <h1>
            AI 튜터와
            <br />
            영어로 말해 보세요
          </h1>
          <p className="muted">틀려도 괜찮아요. 말할 때마다 바로 교정해 드려요.</p>
          <button className="btn primary big" onClick={next}>
            시작하기
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <h2>뭐라고 불러 드릴까요?</h2>
          <p className="muted">튜터가 대화할 때 이 이름을 불러요.</p>
          <input
            className="text-input"
            autoFocus
            placeholder="이름 또는 영어 이름"
            value={p.name}
            maxLength={20}
            onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && p.name.trim() && next()}
          />
          <button className="btn primary big" disabled={!p.name.trim()} onClick={next}>
            다음
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <h2>영어를 배우는 목적은?</h2>
          <div className="options">
            {GOALS.map((g) => (
              <button key={g.id} className={`option ${p.goal === g.id ? "on" : ""}`} onClick={() => (set({ goal: g.id }), next())}>
                <strong>{g.label}</strong>
                <span>{g.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="ob-step">
          <h2>지금 영어 실력은?</h2>
          <div className="options">
            {LEVELS.map((l) => (
              <button key={l.id} className={`option ${p.level === l.id ? "on" : ""}`} onClick={() => (set({ level: l.id }), next())}>
                <strong>{l.label}</strong>
                <span>{l.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="ob-step">
          <h2>하루 목표 시간</h2>
          <p className="muted">매일 조금씩이 가장 효과적이에요.</p>
          <div className="chips">
            {MINUTES.map((m) => (
              <button key={m} className={`chip ${p.dailyMinutes === m ? "on" : ""}`} onClick={() => set({ dailyMinutes: m })}>
                {m}분
              </button>
            ))}
          </div>
          <button className="btn primary big" onClick={next}>
            다음
          </button>
        </div>
      )}

      {step === 5 && (
        <div className="ob-step">
          <h2>함께할 튜터를 골라 주세요</h2>
          <p className="muted">언제든 바꿀 수 있어요.</p>
          <TutorGrid value={p.tutorId} onChange={(tutorId) => set({ tutorId })} />
          <button className="btn primary big" onClick={() => onDone({ ...p, name: p.name.trim() })}>
            {p.name.trim()}님, 대화 시작!
          </button>
        </div>
      )}
    </div>
  );
}

export function TutorGrid({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="tutor-grid">
      {TUTORS.map((t) => (
        <button key={t.id} className={`tutor-card ${value === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
          <Avatar tutor={t} size={56} />
          <strong>{t.name}</strong>
          <span>{t.tagline}</span>
          <small>{t.accent === "en-GB" ? "영국 억양" : t.accent === "en-AU" ? "호주 억양" : "미국 억양"}</small>
        </button>
      ))}
    </div>
  );
}
