import { useEffect, useRef, useState } from "react";
import { findScenario, findTutor } from "../../shared/catalog";
import type { Summary } from "../../shared/types";
import type { FinishedSession } from "../App";
import { Avatar } from "../components";
import { getSummary } from "../lib/api";
import { addWords, recordSession, type Profile, type Stats } from "../lib/store";

interface Props {
  profile: Profile;
  session: FinishedSession;
  onRecorded: (s: Stats) => void;
  onDeckChange: () => void;
  onDone: () => void;
}

export default function SummaryScreen({ profile, session, onRecorded, onDeckChange, onDone }: Props) {
  const tutor = findTutor(session.tutorId);
  const scenario = findScenario(session.scenarioId);
  const [summary, setSummary] = useState<Summary | "loading" | "error">("loading");
  const [saved, setSaved] = useState<number | null>(null);
  const recorded = useRef(false);

  const turns = session.history.filter((t) => t.role === "user").length;
  const scores = session.feedback.map((f) => f.feedback.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const minutes = (Date.now() - session.startedAt) / 60000;
  const fixes = session.feedback.filter((f) => f.feedback.verdict !== "perfect");

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    onRecorded(
      recordSession({ at: new Date().toISOString(), scenarioId: scenario.id, tutorId: tutor.id, minutes, turns, avgScore: avg }),
    );
    getSummary({
      learner: { name: profile.name, level: profile.level, goal: profile.goal },
      scenarioId: scenario.id,
      history: session.history,
      feedback: session.feedback,
    })
      .then((s) => {
        setSummary(s);
        // 오늘의 표현은 단어장으로 — 다음 복습에 바로 나온다.
        setSaved(addWords(s.vocabulary, scenario.titleKo).added);
        onDeckChange();
      })
      .catch(() => setSummary("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen summary">
      <div className="sum-hero" style={{ background: `linear-gradient(135deg, ${tutor.colors[0]}, ${tutor.colors[1]})` }}>
        <span className="ring">
          <Avatar tutor={tutor} size={72} />
        </span>
        <h1>수고했어요, {profile.name}님!</h1>
        <p>{scenario.titleKo} 대화를 마쳤어요</p>
        <div className="stat-row">
          <div>
            <b>{turns}</b>
            <span>말한 문장</span>
          </div>
          <div>
            <b>{avg ?? "-"}</b>
            <span>평균 점수</span>
          </div>
          <div>
            <b>{Math.max(1, Math.round(minutes))}분</b>
            <span>학습 시간</span>
          </div>
        </div>
      </div>

      <section className="card">
        <h3>{tutor.name}의 코멘트</h3>
        {summary === "loading" && <p className="muted">대화를 돌아보는 중…</p>}
        {summary === "error" && <p className="muted">요약을 만들지 못했어요. 아래 교정 내역을 확인해 주세요.</p>}
        {typeof summary === "object" && (
          <>
            <p>{summary.overall_ko}</p>
            {summary.strengths_ko.length > 0 && (
              <>
                <h4>잘한 점</h4>
                <ul>{summary.strengths_ko.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
            {summary.focus_ko.length > 0 && (
              <>
                <h4>다음에 신경 쓸 점</h4>
                <ul>{summary.focus_ko.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </>
            )}
          </>
        )}
      </section>

      {fixes.length > 0 && (
        <section className="card">
          <h3>교정 노트 {fixes.length}개</h3>
          {fixes.map((f, i) => (
            <div key={i} className="fix">
              <p className="before">{f.userLine}</p>
              <p className="after">{f.feedback.corrected}</p>
              <p className="muted small">{f.feedback.explanation_ko}</p>
            </div>
          ))}
        </section>
      )}

      {typeof summary === "object" && summary.vocabulary.length > 0 && (
        <section className="card">
          <h3>오늘의 표현</h3>
          {saved !== null && <p className="saved-note">{saved ? `단어장에 ${saved}개를 담았어요. 단어 탭에서 복습해요.` : "모두 이미 단어장에 있는 표현이에요."}</p>}
          {summary.vocabulary.map((v, i) => (
            <div key={i} className="vocab">
              <strong>{v.word}</strong> <span className="muted">{v.meaning_ko}</span>
              <p className="small">{v.example}</p>
            </div>
          ))}
        </section>
      )}

      <div className="sum-actions">
        <button className="btn primary big" onClick={onDone}>
          홈으로
        </button>
      </div>
    </div>
  );
}
