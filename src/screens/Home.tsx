import { useState } from "react";
import { SCENARIOS, findScenario, findTutor } from "../../shared/catalog";
import { Avatar, Icon, Sheet } from "../components";
import { DEFAULT_SILENCE_SEC, SILENCE_OPTIONS, resetAll, type Profile, type Stats } from "../lib/store";
import { TutorGrid } from "./Onboarding";

interface Props {
  profile: Profile;
  stats: Stats;
  mode: "mock" | "live" | "offline" | null;
  onProfile: (p: Profile) => void;
  onReset: () => void;
  onStart: (scenarioId: string) => void;
}

export default function Home({ profile, stats, mode, onProfile, onReset, onStart }: Props) {
  const tutor = findTutor(profile.tutorId);
  const [tutorSheet, setTutorSheet] = useState(false);
  const [settings, setSettings] = useState(false);
  const pct = Math.min(100, Math.round((stats.todayMinutes / profile.dailyMinutes) * 100));
  const roleplays = SCENARIOS.filter((s) => s.id !== "free");

  return (
    <div className="screen with-tabs home">
      <header className="home-head">
        <div>
          <p className="muted small">안녕하세요,</p>
          <h1>{profile.name}님</h1>
        </div>
        <div className="head-right">
          <div className="streak" title="연속 학습일">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z" fill="#ff7a45" />
            </svg>
            연속 {stats.streak}일
          </div>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="설정">
            <Icon name="gear" />
          </button>
        </div>
      </header>

      {mode === "mock" && <div className="banner">목업 모드: API 키가 없어 가짜 응답을 보여줘요. <code>.env</code>에 키를 넣으면 실제 AI가 대화해요.</div>}
      {mode === "offline" && <div className="banner warn">대화 서버에 연결할 수 없어요. <code>npm run dev</code>로 서버를 켜 주세요.</div>}

      <section className="goal-card">
        <div className="goal-row">
          <span>오늘의 목표</span>
          <strong>
            {Math.round(stats.todayMinutes)} / {profile.dailyMinutes}분
          </strong>
        </div>
        <div className="progress light">
          <div style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="hero" style={{ background: `linear-gradient(135deg, ${tutor.colors[0]}, ${tutor.colors[1]})` }}>
        <div className="hero-text">
          <span className="pill">Free Talk</span>
          <h2>{tutor.name}와 자유 대화</h2>
          <p>아무 주제나 영어로 이야기해 보세요</p>
          <div className="hero-actions">
            <button className="btn white" onClick={() => onStart("free")}>
              대화 시작
            </button>
            <button className="btn ghost-white" onClick={() => setTutorSheet(true)}>
              튜터 변경
            </button>
          </div>
        </div>
        <div className="hero-avatar float">
          <span className="ring">
            <Avatar tutor={tutor} size={96} />
          </span>
        </div>
      </section>

      <h3 className="section-title">상황별 롤플레이</h3>
      <div className="scenario-grid">
        {roleplays.map((s) => (
          <button key={s.id} className="scenario" onClick={() => onStart(s.id)}>
            <span className="mark">{s.mark}</span>
            <strong>{s.titleKo}</strong>
            <span className="muted small">{s.title}</span>
          </button>
        ))}
      </div>

      {stats.sessions.length > 0 && (
        <>
          <h3 className="section-title">최근 대화</h3>
          <ul className="history">
            {stats.sessions.slice(0, 5).map((r) => (
              <li key={r.at}>
                <Avatar tutor={findTutor(r.tutorId)} size={32} />
                <div>
                  <strong>{findScenario(r.scenarioId).titleKo}</strong>
                  <span className="muted small">
                    {new Date(r.at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} · {r.turns}번 말함 · {Math.max(1, Math.round(r.minutes))}분
                  </span>
                </div>
                {r.avgScore !== null && <span className="score-badge">{r.avgScore}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={tutorSheet} onClose={() => setTutorSheet(false)} title="튜터 선택">
        <TutorGrid
          value={profile.tutorId}
          onChange={(tutorId) => {
            onProfile({ ...profile, tutorId });
            setTutorSheet(false);
          }}
        />
      </Sheet>

      <Sheet open={settings} onClose={() => setSettings(false)} title="설정">
        <label className="setting">
          <span>튜터 음성 자동 재생</span>
          <input type="checkbox" checked={profile.autoplay} onChange={(e) => onProfile({ ...profile, autoplay: e.target.checked })} />
        </label>
        <label className="setting">
          <span>
            말 멈춤 후 자동 전송
            <small className="muted setting-sub">말하다 이만큼 조용하면 보내요</small>
          </span>
          <select value={profile.silenceSec ?? DEFAULT_SILENCE_SEC} onChange={(e) => onProfile({ ...profile, silenceSec: Number(e.target.value) })}>
            {SILENCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? "안 함 (버튼으로만)" : `${s}초`}
              </option>
            ))}
          </select>
        </label>
        <label className="setting">
          <span>실력</span>
          <select value={profile.level} onChange={(e) => onProfile({ ...profile, level: e.target.value as Profile["level"] })}>
            <option value="beginner">입문</option>
            <option value="intermediate">중급</option>
            <option value="advanced">고급</option>
          </select>
        </label>
        <label className="setting">
          <span>하루 목표</span>
          <select value={profile.dailyMinutes} onChange={(e) => onProfile({ ...profile, dailyMinutes: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("프로필과 학습 기록을 모두 지울까요?")) {
              resetAll();
              onReset();
            }
          }}
        >
          처음부터 다시 시작
        </button>
      </Sheet>
    </div>
  );
}
