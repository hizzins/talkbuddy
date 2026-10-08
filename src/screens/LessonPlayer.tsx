import { useEffect, useState } from "react";
import { findLesson, findTutor } from "../../shared/catalog";
import type { Lesson } from "../../shared/types";
import { Icon } from "../components";
import { PronounceSheet } from "../PronounceCard";
import { getLesson } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speech";
import { cacheLesson, cachedLesson, saveLessonResult, type Profile } from "../lib/store";

type Phase = "learn" | "quiz" | "result";

export default function LessonPlayer({ profile, lessonId, onExit }: { profile: Profile; lessonId: string; onExit: () => void }) {
  const def = findLesson(lessonId)!;
  const tutor = findTutor(profile.tutorId);
  const learner = { name: profile.name, level: profile.level, goal: profile.goal };

  const [lesson, setLesson] = useState<Lesson | "loading" | { error: string }>(() => cachedLesson(lessonId, profile.level) ?? "loading");
  const [phase, setPhase] = useState<Phase>("learn");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [attempt, setAttempt] = useState(0); // 새로 생성할 때마다 증가
  const [pron, setPron] = useState<{ text: string; ko: string } | null>(null);

  useEffect(() => {
    if (lesson !== "loading") return;
    let alive = true;
    getLesson({ learner, lessonId })
      .then((l) => {
        if (!alive) return;
        if (l.quiz.length === 0) throw new Error("퀴즈를 만들지 못했어요");
        cacheLesson(lessonId, profile.level, l);
        setLesson(l);
      })
      .catch((e) => alive && setLesson({ error: e instanceof Error ? e.message : "레슨을 불러오지 못했어요" }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => stopSpeaking, []);

  const say = (t: string) => speak(t, tutor, profile.level);

  function regenerate() {
    cacheLesson(lessonId, profile.level, null);
    setPhase("learn");
    setLesson("loading");
    setAttempt((a) => a + 1);
  }

  function restartQuiz() {
    setIdx(0);
    setPicked(null);
    setCorrect(0);
    setPhase("quiz");
  }

  const header = (
    <header className="sub-head">
      <button className="icon-btn" onClick={onExit} aria-label="닫기">
        <Icon name="close" />
      </button>
      {typeof lesson === "object" && "quiz" in lesson && phase === "quiz" ? (
        <div className="progress">
          <div style={{ width: `${((idx + (picked !== null ? 1 : 0)) / lesson.quiz.length) * 100}%` }} />
        </div>
      ) : (
        <strong className="sub-title">{def.titleKo}</strong>
      )}
    </header>
  );

  if (lesson === "loading")
    return (
      <div className="screen lesson">
        {header}
        <div className="loading-block">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <p className="muted">{def.titleKo} 레슨을 준비하는 중…</p>
          <p className="muted small">처음 한 번만 만들고, 다음부터는 바로 열려요.</p>
        </div>
      </div>
    );

  if ("error" in lesson)
    return (
      <div className="screen lesson">
        {header}
        <div className="loading-block">
          <p>{lesson.error}</p>
          <button className="btn primary" onClick={regenerate}>
            다시 시도
          </button>
        </div>
      </div>
    );

  if (phase === "learn")
    return (
      <div className="screen lesson">
        {header}
        <div className="lesson-body">
          <p className="eyebrow">{def.title}</p>
          <h1>{def.titleKo}</h1>
          <p className="lead">{lesson.intro_ko}</p>
          {lesson.points.map((pt, i) => (
            <section key={i} className="card point">
              <span className="lesson-n">{i + 1}</span>
              <p>{pt.rule_ko}</p>
              <div className="example">
                <span>
                  <strong>{pt.example_en}</strong>
                  <span className="muted small">{pt.example_ko}</span>
                </span>
                <span className="example-btns">
                  <button onClick={() => say(pt.example_en)} aria-label="예문 듣기">
                    <Icon name="speaker" size={18} />
                  </button>
                  <button onClick={() => (stopSpeaking(), setPron({ text: pt.example_en, ko: pt.example_ko }))} aria-label="예문 따라 말하기">
                    <Icon name="mic" size={18} />
                  </button>
                </span>
              </div>
            </section>
          ))}
          <section className="card tip">
            <h4>이런 실수 조심</h4>
            <p>{lesson.tip_ko}</p>
          </section>
        </div>
        <div className="bottom-cta">
          <button className="btn primary big" onClick={restartQuiz}>
            퀴즈 {lesson.quiz.length}문제 풀기
          </button>
        </div>
        <PronounceSheet text={pron?.text ?? null} ko={pron?.ko} tutor={tutor} level={profile.level} onClose={() => setPron(null)} />
      </div>
    );

  if (phase === "quiz") {
    const q = lesson.quiz[idx];
    const answered = picked !== null;
    const last = idx === lesson.quiz.length - 1;
    return (
      <div className="screen lesson">
        {header}
        <div className="lesson-body">
          <p className="eyebrow">
            {idx + 1} / {lesson.quiz.length}
          </p>
          <h2 className="question">
            {q.question.split("___").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="blank">{answered ? q.options[q.answer_index] : " "}</span>}
              </span>
            ))}
          </h2>
          <div className="options">
            {q.options.map((o, i) => {
              const state = !answered ? "" : i === q.answer_index ? "right" : i === picked ? "wrong" : "dim";
              return (
                <button
                  key={i}
                  className={`option quiz-opt ${state}`}
                  disabled={answered}
                  onClick={() => {
                    setPicked(i);
                    if (i === q.answer_index) setCorrect((c) => c + 1);
                  }}
                >
                  <strong>{o}</strong>
                </button>
              );
            })}
          </div>
        </div>
        {answered && (
          <div className={`answer-panel ${picked === q.answer_index ? "right" : "wrong"}`}>
            <strong>{picked === q.answer_index ? "정답이에요!" : `정답: ${q.options[q.answer_index]}`}</strong>
            <p>{q.explanation_ko}</p>
            <button
              className="btn primary big"
              onClick={() => {
                if (last) {
                  saveLessonResult(lessonId, { score: correct, total: lesson.quiz.length, at: new Date().toISOString() });
                  setPhase("result");
                } else {
                  setIdx(idx + 1);
                  setPicked(null);
                }
              }}
            >
              {last ? "결과 보기" : "다음"}
            </button>
          </div>
        )}
      </div>
    );
  }

  const total = lesson.quiz.length;
  const great = correct / total >= 0.8;
  return (
    <div className="screen lesson">
      {header}
      <div className="result-block">
        <div className={`result-ring ${great ? "great" : ""}`}>
          <b>{correct}</b>
          <span>/ {total}</span>
        </div>
        <h2>{great ? "훌륭해요!" : correct / total >= 0.5 ? "좋아요, 조금만 더!" : "한 번 더 복습해 봐요"}</h2>
        <p className="muted">{def.titleKo} 레슨을 마쳤어요</p>
        <div className="result-actions">
          <button className="btn primary big" onClick={onExit}>
            레슨 목록으로
          </button>
          <button className="btn big" onClick={() => setPhase("learn")}>
            설명 다시 보기
          </button>
          <button className="btn outline big" onClick={restartQuiz}>
            같은 퀴즈 다시 풀기
          </button>
          <button className="link center" onClick={regenerate}>
            <Icon name="refresh" size={14} /> 새 문제로 다시 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
