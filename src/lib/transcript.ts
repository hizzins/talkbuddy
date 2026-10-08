// 연속 음성 인식(continuous=true) 결과 조각을 하나의 발화로 합친다.
// 브라우저마다 조각을 주는 방식이 다르다:
//  - 데스크톱 크롬·사파리: 조각이 이어진다       ["I want", "a large coffee"]
//  - 안드로이드 크롬: 조각이 앞 내용을 누적해 반복  ["I want", "I want a large coffee"]
// 그래서 새 조각이 지금까지 합친 문장으로 시작하면 이어 붙이지 않고 교체한다.

export interface Alt {
  transcript: string;
  confidence: number;
}

export interface Segment {
  isFinal: boolean;
  alts: Alt[]; // 0번이 인식기 1순위
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const top = (s: Segment) => s.alts[0]?.transcript.trim() ?? "";

// 확정 조각 목록에서 누적 반복을 걷어낸 조각 목록
export function mergeFinals(segments: Segment[]): Segment[] {
  const kept: Segment[] = [];
  for (const s of segments) {
    if (!s.isFinal || !top(s)) continue;
    const sofar = norm(kept.map(top).join(" "));
    if (sofar && norm(top(s)).startsWith(sofar)) kept.splice(0, kept.length, s);
    else kept.push(s);
  }
  return kept;
}

// 화면에 보여줄 현재 문장(확정 + 아직 확정 안 된 중간 결과)
export function liveText(segments: Segment[]): string {
  const finals = mergeFinals(segments).map(top).join(" ");
  const interim = segments
    .filter((s) => !s.isFinal)
    .map(top)
    .join(" ")
    .trim();
  if (!interim) return finals;
  if (finals && norm(interim).startsWith(norm(finals))) return interim; // 누적형 중간 결과
  return `${finals} ${interim}`.trim();
}

// 채점용 문장 후보: 조각마다 k번째 후보끼리 이어 붙여 k번째 문장 후보를 만든다(신뢰도는 가장 낮은 조각 기준).
export function sentenceAlternatives(segments: Segment[]): Alt[] {
  const finals = mergeFinals(segments);
  if (finals.length === 0) return [];
  const k = Math.max(...finals.map((s) => s.alts.length));
  const out: Alt[] = [];
  for (let a = 0; a < k; a++) {
    const parts = finals.map((s) => s.alts[Math.min(a, s.alts.length - 1)]);
    out.push({
      transcript: parts.map((p) => p.transcript.trim()).join(" "),
      confidence: Math.min(...parts.map((p) => p.confidence || 0)),
    });
  }
  return out;
}
