import { useEffect, useState } from "react";
import type { Feedback, Turn } from "../shared/types";
import { TabBar, type Tab } from "./components";
import { getMode } from "./lib/api";
import { dueCards, loadDeck, loadProfile, loadStats, saveProfile, type Profile, type Stats } from "./lib/store";
import Chat from "./screens/Chat";
import Home from "./screens/Home";
import LessonPlayer from "./screens/LessonPlayer";
import Lessons from "./screens/Lessons";
import Onboarding from "./screens/Onboarding";
import Pronounce from "./screens/Pronounce";
import SummaryScreen from "./screens/Summary";
import Words from "./screens/Words";

export interface FinishedSession {
  scenarioId: string;
  tutorId: string;
  history: Turn[];
  feedback: { userLine: string; feedback: Feedback }[];
  startedAt: number;
}

type Screen =
  | { name: "home" }
  | { name: "chat"; scenarioId: string }
  | { name: "summary"; session: FinishedSession }
  | { name: "lesson"; lessonId: string };

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [mode, setMode] = useState<"mock" | "live" | "offline" | null>(null);
  const [tab, setTab] = useState<Tab>("talk");
  const [wordsDue, setWordsDue] = useState(() => dueCards(loadDeck()).length);
  const refreshDue = () => setWordsDue(dueCards(loadDeck()).length);

  useEffect(() => {
    getMode().then(setMode);
  }, []);

  const updateProfile = (p: Profile) => {
    saveProfile(p);
    setProfile(p);
  };

  if (!profile) return <Onboarding onDone={updateProfile} />;

  switch (screen.name) {
    case "chat":
      return (
        <Chat
          key={screen.scenarioId + profile.tutorId}
          profile={profile}
          scenarioId={screen.scenarioId}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(session) => setScreen({ name: "summary", session })}
        />
      );
    case "summary":
      return (
        <SummaryScreen
          profile={profile}
          session={screen.session}
          onRecorded={setStats}
          onDeckChange={refreshDue}
          onDone={() => setScreen({ name: "home" })}
        />
      );
    case "lesson":
      return <LessonPlayer profile={profile} lessonId={screen.lessonId} onExit={() => setScreen({ name: "home" })} />;
  }

  return (
    <>
      {tab === "talk" && (
        <Home
          profile={profile}
          stats={stats}
          mode={mode}
          onProfile={updateProfile}
          onReset={() => {
            setProfile(null);
            setStats(loadStats());
            setTab("talk");
            refreshDue();
          }}
          onStart={(scenarioId) => setScreen({ name: "chat", scenarioId })}
        />
      )}
      {tab === "grammar" && <Lessons level={profile.level} onOpen={(lessonId) => setScreen({ name: "lesson", lessonId })} />}
      {tab === "words" && <Words profile={profile} onDeckChange={refreshDue} />}
      {tab === "speak" && <Pronounce profile={profile} />}
      <TabBar tab={tab} onTab={setTab} wordsDue={wordsDue} />
    </>
  );
}
