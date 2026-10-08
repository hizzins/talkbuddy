import { describe, expect, it } from "vitest";
import { liveText, mergeFinals, sentenceAlternatives, type Segment } from "./transcript";

const seg = (isFinal: boolean, ...t: string[]): Segment => ({ isFinal, alts: t.map((x) => ({ transcript: x, confidence: 0.9 })) });

describe("mergeFinals", () => {
  it("데스크톱식 이어지는 조각은 이어 붙인다", () => {
    const m = mergeFinals([seg(true, "I want"), seg(true, " a large coffee")]);
    expect(m.map((s) => s.alts[0].transcript.trim())).toEqual(["I want", "a large coffee"]);
  });
  it("안드로이드식 누적 조각은 마지막 것으로 교체한다", () => {
    const m = mergeFinals([seg(true, "I want"), seg(true, "I want a large"), seg(true, "I want a large coffee")]);
    expect(m.map((s) => s.alts[0].transcript)).toEqual(["I want a large coffee"]);
  });
  it("대소문자·구두점이 달라도 누적으로 본다", () => {
    const m = mergeFinals([seg(true, "i want"), seg(true, "I want, a coffee.")]);
    expect(m).toHaveLength(1);
  });
  it("중간 결과와 빈 조각은 무시한다", () => {
    expect(mergeFinals([seg(false, "I"), seg(true, ""), seg(true, "hello")])).toHaveLength(1);
  });
  it("같은 단어로 시작하지만 누적이 아닌 새 문장은 이어 붙인다", () => {
    const m = mergeFinals([seg(true, "I want coffee"), seg(true, "and a muffin")]);
    expect(m).toHaveLength(2);
  });
});

describe("liveText", () => {
  it("확정 + 중간 결과를 이어 보여준다", () => {
    expect(liveText([seg(true, "I want"), seg(false, "a large")])).toBe("I want a large");
  });
  it("누적형 중간 결과는 중복 없이 보여준다", () => {
    expect(liveText([seg(true, "I want"), seg(false, "I want a large")])).toBe("I want a large");
  });
  it("아무것도 없으면 빈 문자열", () => {
    expect(liveText([])).toBe("");
  });
});

describe("sentenceAlternatives", () => {
  it("여러 조각의 k번째 후보끼리 잇는다", () => {
    const alts = sentenceAlternatives([seg(true, "I like", "I lake"), seg(true, "rice", "lice")]);
    expect(alts.map((a) => a.transcript)).toEqual(["I like rice", "I lake lice"]);
  });
  it("누적 조각이면 마지막 조각의 후보만 쓴다", () => {
    const alts = sentenceAlternatives([seg(true, "I like"), seg(true, "I like rice", "I like lice")]);
    expect(alts.map((a) => a.transcript)).toEqual(["I like rice", "I like lice"]);
  });
  it("후보 수가 다르면 짧은 쪽은 마지막 후보를 재사용한다", () => {
    const alts = sentenceAlternatives([seg(true, "fly"), seg(true, "right", "light")]);
    expect(alts.map((a) => a.transcript)).toEqual(["fly right", "fly light"]);
  });
});
