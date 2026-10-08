import { useState } from "react";
import { PRON_SETS, findTutor, type PronSet } from "../../shared/catalog";
import { Icon } from "../components";
import PronounceCard from "../PronounceCard";
import { loadPronBest, savePronBest, type Profile } from "../lib/store";

export default function Pronounce({ profile }: { profile: Profile }) {
  const [active, setActive] = useState<PronSet | null>(null);
  const [best, setBest] = useState(loadPronBest);

  if (active)
    return (
      <PronSession
        profile={profile}
        set={active}
        onExit={(avg) => {
          if (avg !== null) savePronBest(active.id, avg);
          setBest(loadPronBest());
          setActive(null);
        }}
      />
    );

  return (
    <div className="screen with-tabs pron">
      <header className="tab-head">
        <h1>발음 클리닉</h1>
        <p className="muted small">한국어 화자가 자주 헷갈리는 소리를 골라 연습해요</p>
      </header>
      <p className="banner">
        문장을 소리 내어 읽으면 음성 인식기가 알아들은 단어를 비교해 점수를 매겨요. 다른 단어로 들린 곳(예: rice → lice)을 색으로 보여줘요.
      </p>
      <div className="pron-sets">
        {PRON_SETS.map((s) => (
          <button key={s.id} className="pron-set" onClick={() => setActive(s)}>
            <span className="mark">{s.pair}</span>
            <span className="lesson-txt">
              <strong>{s.titleKo}</strong>
              <span className="muted small">{s.sentences.length}문장</span>
            </span>
            {best[s.id] !== undefined ? <span className="score-badge">{best[s.id]}</span> : <span className="muted small">시작</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function PronSession({ profile, set, onExit }: { profile: Profile; set: PronSet; onExit: (avg: number | null) => void }) {
  const tutor = findTutor(profile.tutorId);
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState<(number | null)[]>(() => set.sentences.map(() => null));
  const done = idx >= set.sentences.length;
  const tried = scores.filter((s): s is number => s !== null);
  const avg = tried.length ? Math.round(tried.reduce((a, b) => a + b, 0) / tried.length) : null;

  return (
    <div className="screen study pron-session">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => onExit(done ? avg : null)} aria-label="닫기">
          <Icon name="close" />
        </button>
        <div className="progress">
          <div style={{ width: `${(Math.min(idx, set.sentences.length) / set.sentences.length) * 100}%` }} />
        </div>
        <span className="muted small">{set.titleKo}</span>
      </header>

      {done ? (
        <div className="result-block">
          <div className={`result-ring ${avg !== null && avg >= 80 ? "great" : ""}`}>
            <b>{avg ?? "-"}</b>
            <span>점</span>
          </div>
          <h2>{set.titleKo} 연습 완료!</h2>
          <p className="muted">{tried.length}문장 평균 점수예요. 낮은 문장은 다시 해 볼 수 있어요.</p>
          <ul className="pron-recap">
            {set.sentences.map((s, i) => (
              <li key={i}>
                <span>{s}</span>
                <b>{scores[i] ?? "-"}</b>
              </li>
            ))}
          </ul>
          <div className="result-actions">
            <button className="btn primary big" onClick={() => onExit(avg)}>
              목록으로
            </button>
            <button
              className="btn outline big"
              onClick={() => {
                setScores(set.sentences.map(() => null));
                setIdx(0);
              }}
            >
              처음부터 다시
            </button>
          </div>
        </div>
      ) : (
        <>
          {idx === 0 && (
            <section className="card tip">
              <h4>입 모양 팁</h4>
              <p>{set.tip_ko}</p>
            </section>
          )}
          <p className="eyebrow">
            {idx + 1} / {set.sentences.length}
          </p>
          <PronounceCard
            text={set.sentences[idx]}
            tutor={tutor}
            level={profile.level}
            // 같은 문장을 여러 번 시도하면 최고 점수를 남긴다
            onResult={(r) => setScores((sc) => sc.map((v, i) => (i === idx ? Math.max(v ?? 0, r.score) : v)))}
          />
          <div className="grade-row single">
            <button className="btn big" onClick={() => setIdx(idx + 1)}>
              {scores[idx] === null ? "건너뛰기" : idx === set.sentences.length - 1 ? "결과 보기" : "다음 문장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
