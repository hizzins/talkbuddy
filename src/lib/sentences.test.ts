import { describe, expect, it } from "vitest";
import { SentenceSplitter } from "./sentences";

// 응답을 글자 조각으로 흘려 넣었을 때 나오는 문장들(스트림 종료 시 flush 포함)
function feed(chunks: string[]) {
  const sp = new SentenceSplitter();
  const steps = chunks.map((c) => sp.push(c));
  return { steps, all: [...steps.flat(), ...sp.flush()] };
}

describe("SentenceSplitter", () => {
  it("문장이 끝나는 즉시(다음 공백이 오면) 내보낸다", () => {
    const { steps, all } = feed(["Great choice, one iced americano!", " What size", " would you like?"]);
    expect(steps[0]).toEqual([]); // 뒤에 공백이 오기 전엔 끝인지 모른다
    expect(steps[1]).toEqual(["Great choice, one iced americano!"]);
    expect(all).toEqual(["Great choice, one iced americano!", "What size would you like?"]);
  });

  it("약어와 소수점에서는 끊지 않는다", () => {
    const { all } = feed(["Dr. Kim opens at 9 a.m. every day. ", "A latte is 4.50 dollars. Want one?"]);
    expect(all).toEqual(["Dr. Kim opens at 9 a.m. every day.", "A latte is 4.50 dollars.", "Want one?"]);
  });

  it("너무 짧은 감탄은 다음 문장과 합친다", () => {
    const { all } = feed(["Oh! ", "That sounds really fun. ", "Why?"]);
    expect(all).toEqual(["Oh! That sounds really fun.", "Why?"]);
  });

  it("닫는 따옴표·연속 부호도 문장 끝으로 본다", () => {
    const { all } = feed(['I said "thank you so much." Then I left. ', "Really?! Yes."]);
    expect(all).toEqual(['I said "thank you so much."', "Then I left.", "Really?! Yes."]);
  });

  it("글자 단위로 잘게 들어와도 같은 결과", () => {
    const text = "Hi there, nice to meet you! How is your day going so far?";
    expect(feed(text.split("")).all).toEqual(["Hi there, nice to meet you!", "How is your day going so far?"]);
  });

  it("문장 부호 없이 끝나도 flush 로 나온다", () => {
    expect(feed(["sure thing my friend"]).all).toEqual(["sure thing my friend"]);
  });
});
