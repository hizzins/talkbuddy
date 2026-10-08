// API 키 없이 화면 흐름을 확인하기 위한 가짜 응답. 실제 학습 품질과는 무관하다.
import { findScenario, findTutor } from "../shared/catalog.js";
import type { ChatRequest, Feedback, FeedbackRequest, Hint, Lesson, Summary, WordsResponse } from "../shared/types.js";

const LINES = [
  "That sounds great! Can you tell me a little more about it?",
  "Oh, interesting. How did that make you feel?",
  "Nice! What do you usually do on weekends?",
  "I see. Have you ever tried something like that before?",
  "Good point. What would you like to talk about next?",
];

export function mockChat(req: ChatRequest): string {
  const tutor = findTutor(req.tutorId);
  const scenario = findScenario(req.scenarioId);
  const userTurns = req.history.filter((t) => t.role === "user").length;
  if (userTurns === 0) {
    return scenario.id === "free"
      ? `Hi ${req.learner.name || "there"}, I'm ${tutor.name}! How has your day been so far?`
      : `Hi, I'm ${tutor.name}. Let's practice ${scenario.title.toLowerCase()}. Are you ready?`;
  }
  return LINES[(userTurns - 1) % LINES.length];
}

export function mockFeedback(req: FeedbackRequest): Feedback {
  const line = req.userLine.trim();
  if (/[가-힣]/.test(line)) {
    return {
      verdict: "error",
      corrected: "I'm not sure how to say it in English.",
      natural_alternative: "Hmm, how do I say this in English?",
      explanation_ko: "한국어로 말했어요. 짧은 영어 문장이라도 시도해 보세요!",
      score: 20,
    };
  }
  const fixed = line.replace(/\bi\b/g, "I").replace(/^./, (c) => c.toUpperCase()).replace(/[.?!]?$/, ".");
  if (/\bi\b/.test(line) || line.split(/\s+/).length < 3) {
    return {
      verdict: "minor",
      corrected: fixed,
      natural_alternative: `${fixed.replace(/\.$/, "")}, actually.`,
      explanation_ko: "(목업) 주어 I는 항상 대문자로 쓰고, 조금 더 길게 말해 보세요.",
      score: 72,
    };
  }
  return {
    verdict: "perfect",
    corrected: fixed,
    natural_alternative: fixed,
    explanation_ko: "(목업) 자연스러운 문장이에요. 잘했어요!",
    score: 95,
  };
}

export function mockHint(): Hint {
  return {
    suggestions: [
      { en: "It was pretty good, thanks!", ko: "꽤 좋았어요, 고마워요!" },
      { en: "I had a busy day at work, but I'm okay.", ko: "회사에서 바빴지만 괜찮아요." },
      { en: "Not bad. How about you?", ko: "나쁘지 않아요. 당신은요?" },
    ],
  };
}

export function mockTranslate(text: string): string {
  return `(목업 번역) ${text}`;
}

export function mockSummary(): Summary {
  return {
    overall_ko: "(목업) 끝까지 대화를 이어간 점이 좋았어요. 문장을 조금 더 길게 만들어 보면 좋겠어요.",
    strengths_ko: ["질문에 빠르게 대답했어요", "기본 문장 구조가 안정적이에요"],
    focus_ko: ["주어 I 대문자", "짧은 대답에 이유 덧붙이기"],
    vocabulary: [
      { word: "pretty good", meaning_ko: "꽤 좋은", example: "My day was pretty good." },
      { word: "How about you?", meaning_ko: "당신은요?", example: "I'm fine. How about you?" },
    ],
  };
}

export function mockLesson(lessonId: string): Lesson {
  return {
    intro_ko: `(목업 레슨 ${lessonId}) 실제 API 키를 넣으면 이 주제에 맞는 설명과 퀴즈가 만들어져요.`,
    points: [
      { rule_ko: "주어가 I면 am을 써요.", example_en: "I am a student.", example_ko: "나는 학생이에요." },
      { rule_ko: "주어가 he/she/it이면 is를 써요.", example_en: "She is my friend.", example_ko: "그녀는 내 친구예요." },
      { rule_ko: "주어가 you/we/they면 are를 써요.", example_en: "They are at home.", example_ko: "그들은 집에 있어요." },
    ],
    tip_ko: "한국어엔 be동사가 따로 없어서 'I happy'처럼 빠뜨리기 쉬워요. 형용사 앞에도 be동사가 필요해요.",
    quiz: [
      { question: "I ___ hungry.", options: ["am", "is", "are", "be"], answer_index: 0, explanation_ko: "주어 I에는 am을 써요." },
      { question: "My brother ___ a doctor.", options: ["am", "are", "is", "be"], answer_index: 2, explanation_ko: "3인칭 단수 주어에는 is." },
      { question: "We ___ late again.", options: ["is", "are", "am", "was be"], answer_index: 1, explanation_ko: "we에는 are." },
      { question: "___ you ready?", options: ["Is", "Am", "Be", "Are"], answer_index: 3, explanation_ko: "you로 묻는 의문문은 Are로 시작해요." },
      { question: "It ___ not cold today.", options: ["is", "are", "am", "do"], answer_index: 0, explanation_ko: "it에는 is, 부정은 is not." },
    ],
  };
}

export function mockWords(topic: string): WordsResponse {
  return {
    words: [
      { word: "check in", meaning_ko: "체크인하다", example: "We need to check in by 3 p.m." },
      { word: "I'm running late", meaning_ko: "좀 늦을 것 같아요", example: "Sorry, I'm running late. See you in ten." },
      { word: "grab a bite", meaning_ko: "간단히 먹다", example: "Do you want to grab a bite after work?" },
      { word: "recommend", meaning_ko: "추천하다", example: "Can you recommend a good place nearby?" },
      { word: `(mock) ${topic.split(/[ :,]/)[0]}`, meaning_ko: "(목업 단어)", example: "This is a mock word." },
    ],
  };
}
