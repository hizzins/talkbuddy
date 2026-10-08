// 튜터·시나리오 카탈로그. 서버(프롬프트)와 클라이언트(화면)가 같은 원본을 본다.

export interface Tutor {
  id: string;
  name: string;
  tagline: string;
  persona: string; // 시스템 프롬프트에 들어가는 성격 묘사
  accent: "en-US" | "en-GB" | "en-AU";
  voiceHint: "female" | "male";
  colors: [string, string];
}

export const TUTORS: Tutor[] = [
  {
    id: "mia",
    name: "Mia",
    tagline: "다정하고 차분한 대화 친구",
    persona:
      "warm, patient and encouraging; speaks slowly and clearly; loves cafés, books and travel stories",
    accent: "en-US",
    voiceHint: "female",
    colors: ["#ff9a9e", "#fad0c4"],
  },
  {
    id: "jay",
    name: "Jay",
    tagline: "에너지 넘치는 유머 담당",
    persona:
      "upbeat, playful and funny; uses casual everyday expressions; into sports, games and food",
    accent: "en-US",
    voiceHint: "male",
    colors: ["#43e97b", "#38f9d7"],
  },
  {
    id: "olivia",
    name: "Olivia",
    tagline: "비즈니스 영어 코치",
    persona:
      "professional, precise and supportive; models polite workplace English; interested in careers and tech",
    accent: "en-GB",
    voiceHint: "female",
    colors: ["#667eea", "#764ba2"],
  },
  {
    id: "liam",
    name: "Liam",
    tagline: "느긋한 호주 여행가",
    persona:
      "laid-back and curious; asks lots of follow-up questions; loves surfing, nature and road trips",
    accent: "en-AU",
    voiceHint: "male",
    colors: ["#f6d365", "#fda085"],
  },
];

export interface Scenario {
  id: string;
  title: string;
  titleKo: string;
  setup: string; // 프롬프트용 상황 설명(영어)
  mark: string; // 카드 배지 글자
}

export const SCENARIOS: Scenario[] = [
  {
    id: "free",
    title: "Free Talk",
    titleKo: "자유 대화",
    setup:
      "Free conversation. Chat about the learner's day, interests and opinions. Pick light topics and follow their lead.",
    mark: "FT",
  },
  {
    id: "cafe",
    title: "Ordering coffee",
    titleKo: "카페에서 주문하기",
    setup:
      "You are a barista at a busy café. The learner is a customer ordering. Ask about size, milk, for here or to go, and payment.",
    mark: "CF",
  },
  {
    id: "airport",
    title: "Airport check-in",
    titleKo: "공항 체크인",
    setup:
      "You are an airline check-in agent. The learner is a passenger. Ask for passport, destination, baggage, seat preference.",
    mark: "AP",
  },
  {
    id: "hotel",
    title: "Hotel check-in",
    titleKo: "호텔 체크인",
    setup:
      "You are a hotel front desk clerk. The learner is checking in. Confirm the booking, explain breakfast and Wi-Fi, handle a small request.",
    mark: "HT",
  },
  {
    id: "interview",
    title: "Job interview",
    titleKo: "영어 면접",
    setup:
      "You are an interviewer for a job the learner wants. Ask typical interview questions one at a time and react naturally.",
    mark: "JI",
  },
  {
    id: "doctor",
    title: "At the doctor",
    titleKo: "병원 진료",
    setup:
      "You are a friendly doctor. The learner is a patient describing symptoms. Ask about symptoms, duration and give simple advice.",
    mark: "DR",
  },
  {
    id: "friends",
    title: "Making friends",
    titleKo: "새 친구 사귀기",
    setup:
      "You just met the learner at a party of a mutual friend. Make small talk, find things in common and suggest meeting again.",
    mark: "MF",
  },
  {
    id: "shopping",
    title: "Returning an item",
    titleKo: "쇼핑 · 환불",
    setup:
      "You are a store clerk. The learner wants to return or exchange something. Ask for the receipt, reason and preferred option.",
    mark: "SH",
  },
];

export const findTutor = (id: string) => TUTORS.find((t) => t.id === id) ?? TUTORS[0];
export const findScenario = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

// ---------- 문법 커리큘럼 ----------
// focus 는 레슨 생성 프롬프트에 그대로 들어간다(영어).

export interface LessonDef {
  id: string;
  level: "beginner" | "intermediate" | "advanced";
  titleKo: string;
  title: string;
  focus: string;
}

export const LESSONS: LessonDef[] = [
  { id: "b-be", level: "beginner", titleKo: "be동사 (am / is / are)", title: "The verb to be", focus: "present tense of 'to be' with all subjects, contractions, negatives and yes/no questions" },
  { id: "b-simple-present", level: "beginner", titleKo: "현재시제와 3인칭 -s", title: "Simple present", focus: "simple present for habits and facts, third-person -s/-es, do/does in questions and negatives" },
  { id: "b-past", level: "beginner", titleKo: "과거시제", title: "Simple past", focus: "regular -ed and common irregular past forms, did in questions and negatives, time words like yesterday and last week" },
  { id: "b-articles", level: "beginner", titleKo: "a / an / the", title: "Articles", focus: "a vs an by sound, first mention vs known thing with the, no article for general plurals and uncountables" },
  { id: "b-progressive", level: "beginner", titleKo: "현재진행형", title: "Present continuous", focus: "be + -ing for actions now and near-future plans, spelling of -ing, contrast with simple present" },
  { id: "i-perfect", level: "intermediate", titleKo: "현재완료 vs 과거", title: "Present perfect vs past", focus: "have + past participle for experience, unfinished time and recent results vs simple past with finished time; ever, never, already, yet, since, for" },
  { id: "i-comparatives", level: "intermediate", titleKo: "비교급과 최상급", title: "Comparatives and superlatives", focus: "-er/-est vs more/most, irregular forms, as...as, than, and natural phrases like much better" },
  { id: "i-conditionals", level: "intermediate", titleKo: "조건문 (if)", title: "First and second conditionals", focus: "real future conditions (if + present, will) vs imaginary present conditions (if + past, would)" },
  { id: "i-relative", level: "intermediate", titleKo: "관계대명사", title: "Relative clauses", focus: "who, which, that, where; defining relative clauses and when the pronoun can be dropped" },
  { id: "i-gerund-inf", level: "intermediate", titleKo: "동명사 vs to부정사", title: "Gerunds and infinitives", focus: "verbs followed by -ing (enjoy, avoid, finish) vs to-infinitive (want, decide, hope) and verbs whose meaning changes (stop, remember, try)" },
  { id: "a-mixed-cond", level: "advanced", titleKo: "가정법 과거완료·혼합", title: "Third and mixed conditionals", focus: "if + past perfect, would have + past participle, and mixed conditionals linking past conditions to present results" },
  { id: "a-modal-perfect", level: "advanced", titleKo: "조동사 + have p.p.", title: "Modal perfects", focus: "should have, could have, must have, might have, can't have for regret, criticism and deduction about the past" },
  { id: "a-participle", level: "advanced", titleKo: "분사구문", title: "Participle clauses", focus: "-ing and past participle clauses for reason, time and result; dangling participles to avoid" },
  { id: "a-inversion", level: "advanced", titleKo: "도치 구문", title: "Inversion for emphasis", focus: "negative adverbials (never have I, not only, hardly...when, no sooner...than) and inversion in formal conditionals (had I known)" },
  { id: "a-reported", level: "advanced", titleKo: "간접화법·간접의문문", title: "Reported speech and indirect questions", focus: "backshifting tenses, reporting verbs (suggest, insist, admit), and indirect questions with statement word order (Could you tell me where it is?)" },
];

export const findLesson = (id: string) => LESSONS.find((l) => l.id === id);

// 추천 단어 주제(학습자 목적·롤플레이와 겹치게 고름)
export const WORD_TOPICS: { id: string; titleKo: string; topic: string }[] = [
  { id: "daily", titleKo: "일상 표현", topic: "everyday small talk and daily routines" },
  { id: "travel", titleKo: "여행", topic: "travel: airports, hotels, directions and sightseeing" },
  { id: "food", titleKo: "음식·카페", topic: "ordering food and drinks, tastes and restaurant phrases" },
  { id: "work", titleKo: "업무", topic: "office work, meetings, emails and schedules" },
  { id: "feelings", titleKo: "감정·의견", topic: "describing feelings and giving opinions" },
  { id: "idioms", titleKo: "자주 쓰는 숙어", topic: "common idioms and phrasal verbs native speakers use in conversation" },
];

// ---------- 발음 클리닉 (한국어 화자가 자주 틀리는 소리) ----------
// 정적 콘텐츠라 API 호출이 없다.

export interface PronSet {
  id: string;
  titleKo: string;
  pair: string; // 카드 배지
  tip_ko: string;
  sentences: string[];
}

export const PRON_SETS: PronSet[] = [
  {
    id: "rl", titleKo: "R과 L", pair: "R·L",
    tip_ko: "L은 혀끝을 윗니 뒤 잇몸에 붙였다 떼요. R은 혀끝이 어디에도 닿지 않게 살짝 말고 입술을 둥글게 해요.",
    sentences: ["I like rice and lemons.", "The red lorry is really long.", "Fly right over the river.", "Please correct the long list.", "Larry rarely reads library books."],
  },
  {
    id: "fp", titleKo: "F와 P", pair: "F·P",
    tip_ko: "F는 윗니를 아랫입술에 가볍게 대고 바람을 내보내요. P처럼 두 입술을 붙이면 'pan'이 'fan'이 되지 않아요.",
    sentences: ["My favorite food is pasta.", "Put the fresh fruit on the plate.", "Please fill out the form first.", "The coffee was perfect.", "Five people found a phone."],
  },
  {
    id: "vb", titleKo: "V와 B", pair: "V·B",
    tip_ko: "V는 F와 같은 입 모양에서 목을 울려요. B는 두 입술을 붙였다 터뜨려요. 'very'를 '베리'로 하면 'berry'가 돼요.",
    sentences: ["The van is very big.", "I believe the view is better above.", "Vote for the best video.", "Bring a vest and a bag.", "It was a very busy evening."],
  },
  {
    id: "th", titleKo: "TH 소리", pair: "TH",
    tip_ko: "혀끝을 윗니와 아랫니 사이로 살짝 내밀고 바람을 내보내요. 'think'를 '씽크'로 하면 'sink'가 돼요.",
    sentences: ["Thank you for thinking of me.", "This is the third Thursday.", "They think these things are worth it.", "I thought the theater was north.", "Breathe through your mouth."],
  },
  {
    id: "zj", titleKo: "Z와 J", pair: "Z·J",
    tip_ko: "Z는 S 입 모양에서 목을 울리는 '즈' 소리예요. 'zoo'를 '주'로 하면 J 소리가 나요.",
    sentences: ["The zoo is open in June.", "Zero is just a number.", "I enjoy jazz music.", "Please close the zipper.", "His jeans are easy to wash."],
  },
  {
    id: "vowel", titleKo: "긴 모음 · 짧은 모음", pair: "i·ee",
    tip_ko: "'ee'는 입꼬리를 옆으로 당기고 길게, 'i'는 힘을 빼고 짧게 말해요. 'ship'과 'sheep'이 달라져요.",
    sentences: ["Please sit in this seat.", "The ship carries sheep.", "I live where you leave.", "Did you eat it yet?", "Feel the heat and fill the cup."],
  },
];
