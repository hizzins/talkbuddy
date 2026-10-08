import { LESSONS, type LessonDef } from "../../shared/catalog";
import type { Level } from "../../shared/types";
import { loadLessonResults } from "../lib/store";

const LEVEL_KO: Record<Level, string> = { beginner: "입문", intermediate: "중급", advanced: "고급" };
const ORDER: Level[] = ["beginner", "intermediate", "advanced"];

export default function Lessons({ level, onOpen }: { level: Level; onOpen: (id: string) => void }) {
  const results = loadLessonResults();
  // 내 레벨을 맨 위로
  const levels = [level, ...ORDER.filter((l) => l !== level)];
  const mine = LESSONS.filter((l) => l.level === level);
  const doneMine = mine.filter((l) => results[l.id]).length;

  return (
    <div className="screen with-tabs lessons">
      <header className="tab-head">
        <h1>문법 레슨</h1>
        <p className="muted small">짧게 배우고 퀴즈로 확인해요</p>
      </header>

      <section className="goal-card">
        <div className="goal-row">
          <span>{LEVEL_KO[level]} 과정</span>
          <strong>
            {doneMine} / {mine.length} 완료
          </strong>
        </div>
        <div className="progress light">
          <div style={{ width: `${(doneMine / mine.length) * 100}%` }} />
        </div>
      </section>

      {levels.map((lv) => (
        <section key={lv} className="lesson-group">
          <h3 className="section-title">
            {LEVEL_KO[lv]}
            {lv === level && <span className="tag">내 레벨</span>}
          </h3>
          <div className="lesson-list">
            {LESSONS.filter((l) => l.level === lv).map((l, i) => (
              <LessonRow key={l.id} def={l} n={i + 1} result={results[l.id]} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LessonRow({ def, n, result, onOpen }: { def: LessonDef; n: number; result?: { score: number; total: number }; onOpen: (id: string) => void }) {
  return (
    <button className={`lesson-row ${result ? "done" : ""}`} onClick={() => onOpen(def.id)}>
      <span className="lesson-n">{n}</span>
      <span className="lesson-txt">
        <strong>{def.titleKo}</strong>
        <span className="muted small">{def.title}</span>
      </span>
      {result ? (
        <span className="score-badge">
          {result.score}/{result.total}
        </span>
      ) : (
        <span className="muted small">시작</span>
      )}
    </button>
  );
}
