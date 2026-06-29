export type Confidence = "bad" | "normal" | "good";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type VocabItem = {
  id: string;
  english: string;
  spanish: string;
  confidence: Confidence;
  level: CefrLevel;
  group: string;
  createdAt: string;
};

export type StudyMode = "flashcards" | "match" | "quiz" | "write" | "order" | "groups";
