import { seedVocabulary } from "./data";
import { VocabItem } from "./types";

const STORAGE_KEY = "english-path:vocabulary";

const mergeWithSeedVocabulary = (items: VocabItem[]) => {
  const savedEnglish = new Set(items.map((item) => item.english.trim().toLowerCase()));
  const missingSeedItems = seedVocabulary.filter((item) => !savedEnglish.has(item.english.trim().toLowerCase()));
  return [...items, ...missingSeedItems];
};

export const loadVocabulary = (): VocabItem[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedVocabulary;

  try {
    const parsed = JSON.parse(saved) as VocabItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? mergeWithSeedVocabulary(parsed) : seedVocabulary;
  } catch {
    return seedVocabulary;
  }
};

export const saveVocabulary = (items: VocabItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const resetVocabulary = () => {
  localStorage.removeItem(STORAGE_KEY);
  return seedVocabulary;
};
