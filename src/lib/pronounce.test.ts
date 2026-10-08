import { describe, expect, it } from "vitest";
import { scorePronunciation, similarity, tokenize } from "./pronounce";

const one = (transcript: string, confidence = 0) => [{ transcript, confidence }];
const statuses = (target: string, heard: string) =>
  scorePronunciation(target, one(heard)).words.map((w) => w.status);

describe("tokenize", () => {
  it("대소문자·구두점을 무시한다", () => {
    expect(tokenize("Hello, World!").tokens).toEqual(["hello", "world"]);
  });
  it("축약형을 풀어 인식기의 두 표기를 같게 본다", () => {
    expect(tokenize("I'm late").tokens).toEqual(["i", "am", "late"]);
    expect(tokenize("don't").tokens).toEqual(["do", "not"]);
    expect(tokenize("can't").tokens).toEqual(["can", "not"]);
  });
  it("숫자와 p.m. 을 단어로 맞춘다", () => {
    expect(tokenize("by 3 p.m.").tokens).toEqual(["by", "three", "pm"]);
    expect(tokenize("21").tokens).toEqual(["twenty", "one"]);
  });
  it("풀린 토큰은 원래 표시 단어를 가리킨다", () => {
    const t = tokenize("I'm here");
    expect(t.owner).toEqual([0, 0, 1]);
  });
});

describe("scorePronunciation", () => {
  it("완전히 같으면 100점", () => {
    const r = scorePronunciation("The red lorry is really long.", one("the red lorry is really long"));
    expect(r.score).toBe(100);
    expect(r.words.every((w) => w.status === "good")).toBe(true);
  });

  it("축약형·숫자 표기 차이는 감점하지 않는다", () => {
    expect(scorePronunciation("I'm running late.", one("I am running late")).score).toBe(100);
    expect(scorePronunciation("We need to check in by 3 p.m.", one("we need to check in by three PM")).score).toBe(100);
  });

  it("R/L 혼동은 '비슷함'으로 잡고 무엇으로 들렸는지 알려준다", () => {
    const r = scorePronunciation("I like rice.", one("I like lice"));
    const rice = r.words[2];
    expect(rice.status).toBe("close");
    expect(rice.heard).toBe("lice");
    expect(r.score).toBeGreaterThan(70);
    expect(r.score).toBeLessThan(100);
  });

  it("빠진 단어는 missing", () => {
    expect(statuses("Thank you very much", "thank you much")).toEqual(["good", "good", "missing", "good"]);
  });

  it("전혀 다른 단어는 wrong", () => {
    expect(statuses("I want coffee", "I want tea")[2]).toBe("wrong");
  });

  it("끼어든 단어는 extra 로 모으고 감점한다", () => {
    const r = scorePronunciation("I want coffee", one("I want some hot coffee"));
    expect(r.extra).toEqual(["some", "hot"]);
    expect(r.score).toBeLessThan(100);
    expect(r.words.every((w) => w.status === "good")).toBe(true);
  });

  it("인식 신뢰도가 낮으면 점수가 내려간다", () => {
    const sure = scorePronunciation("Good morning", one("good morning", 0.95)).score;
    const unsure = scorePronunciation("Good morning", one("good morning", 0.4)).score;
    expect(unsure).toBeLessThan(sure);
  });

  it("1순위가 아닌 후보가 맞으면 쓰되 깎는다", () => {
    const r = scorePronunciation("Fly right over the river", [
      { transcript: "fly light over the liver", confidence: 0 },
      { transcript: "fly right over the river", confidence: 0 },
    ]);
    expect(r.score).toBe(92);
    expect(r.heard).toBe("fly right over the river");
  });

  it("아무것도 못 알아들었으면 0점, 전부 missing", () => {
    const r = scorePronunciation("Hello there", one("  "));
    expect(r.score).toBe(0);
    expect(r.words.map((w) => w.status)).toEqual(["missing", "missing"]);
  });

  it("점수는 0~100 범위", () => {
    const r = scorePronunciation("Hi", one("completely different long sentence with many words"));
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("similarity", () => {
  it("한 글자 차이 짧은 단어", () => {
    expect(similarity("rice", "lice")).toBe(0.75);
    expect(similarity("same", "same")).toBe(1);
  });
});
