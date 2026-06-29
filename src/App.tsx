import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  Check,
  Gamepad2,
  Keyboard,
  Layers3,
  ListOrdered,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { cefrRubric } from "./data";
import { loadVocabulary, resetVocabulary, saveVocabulary } from "./storage";
import { CefrLevel, Confidence, StudyMode, VocabItem } from "./types";

const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const confidenceOptions: Confidence[] = ["bad", "normal", "good"];

const confidenceScore: Record<Confidence, number> = {
  bad: 0.25,
  normal: 0.62,
  good: 1,
};

const levelWeight: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

const getRecommendedLevel = (items: VocabItem[]) => {
  if (items.length === 0) return { level: "A1" as CefrLevel, score: 0 };
  const total = items.reduce((sum, item) => sum + levelWeight[item.level] * confidenceScore[item.confidence], 0);
  const normalized = total / Math.max(items.length, 1);
  const index = Math.min(levels.length - 1, Math.max(0, Math.round(normalized) - 1));
  return { level: levels[index], score: normalized };
};

const getCefrPercentages = (items: VocabItem[]) => {
  const weightedTotal = items.reduce((sum, item) => sum + confidenceScore[item.confidence], 0) || 1;
  return levels.map((level) => {
    const value = items
      .filter((item) => item.level === level)
      .reduce((sum, item) => sum + confidenceScore[item.confidence], 0);
    return { level, percent: Math.round((value / weightedTotal) * 100) };
  });
};

const getQuizOptions = (items: VocabItem[], activeItem?: VocabItem) => {
  if (!activeItem) return [];

  const wrongOptions = items
    .filter((item) => item.id !== activeItem.id && item.spanish.trim())
    .slice(0, 3)
    .map((item) => item.spanish);

  return [activeItem.spanish, ...wrongOptions].sort((a, b) => a.localeCompare(b));
};

const normalizeAnswer = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.,!?'"`]/g, "")
    .replace(/\s+/g, " ");

const getWordTiles = (phrase: string) =>
  phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({ id: `${word}-${index}`, word }))
    .sort((a, b) => a.word.localeCompare(b.word));

const App = () => {
  const [items, setItems] = useState<VocabItem[]>(() => loadVocabulary());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<StudyMode>("flashcards");
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizChoice, setQuizChoice] = useState("");
  const [writeIndex, setWriteIndex] = useState(0);
  const [writeAnswer, setWriteAnswer] = useState("");
  const [writeResult, setWriteResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [writeScore, setWriteScore] = useState(0);
  const [orderIndex, setOrderIndex] = useState(0);
  const [orderAnswer, setOrderAnswer] = useState<Array<{ id: string; word: string }>>([]);
  const [orderResult, setOrderResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [orderScore, setOrderScore] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [form, setForm] = useState({
    english: "",
    spanish: "",
    level: "A1" as CefrLevel,
    confidence: "bad" as Confidence,
    group: "Vocabulary",
  });

  useEffect(() => {
    saveVocabulary(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.english.toLowerCase().includes(normalized) ||
        item.spanish.toLowerCase().includes(normalized) ||
        item.group.toLowerCase().includes(normalized);
      const matchesGroup = selectedGroup === "All" || item.group === selectedGroup;
      return matchesQuery && matchesGroup;
    });
  }, [items, query, selectedGroup]);

  const groups = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.group))).sort()], [items]);
  const recommended = useMemo(() => getRecommendedLevel(items), [items]);
  const cefrPercentages = useMemo(() => getCefrPercentages(items), [items]);
  const dueItems = useMemo(() => items.filter((item) => item.confidence !== "good"), [items]);
  const activeCards = dueItems.length ? dueItems : items;
  const activeCard = activeCards[cardIndex % Math.max(activeCards.length, 1)];
  const quizItems = useMemo(() => items.filter((item) => item.spanish.trim()).slice(0, 12), [items]);
  const quizItem = quizItems[quizIndex % Math.max(quizItems.length, 1)];
  const quizOptions = useMemo(() => getQuizOptions(items, quizItem), [items, quizItem]);
  const writeItems = useMemo(
    () => items.filter((item) => item.english.trim() && item.spanish.trim()).slice(0, 12),
    [items]
  );
  const writeItem = writeItems[writeIndex % Math.max(writeItems.length, 1)];
  const orderItems = useMemo(
    () => items.filter((item) => item.english.trim().split(/\s+/).length >= 2 && item.spanish.trim()).slice(0, 12),
    [items]
  );
  const orderItem = orderItems[orderIndex % Math.max(orderItems.length, 1)];
  const orderTiles = useMemo(() => getWordTiles(orderItem?.english ?? ""), [orderItem]);
  const availableOrderTiles = orderTiles.filter((tile) => !orderAnswer.some((answer) => answer.id === tile.id));

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    if (!form.english.trim() || !form.spanish.trim()) {
      toast.error("Add both the English phrase and the Spanish meaning.");
      return;
    }

    const newItem: VocabItem = {
      id: crypto.randomUUID(),
      english: form.english.trim(),
      spanish: form.spanish.trim(),
      level: form.level,
      confidence: form.confidence,
      group: form.group.trim() || "Vocabulary",
      createdAt: new Date().toISOString(),
    };

    setItems((current) => [newItem, ...current]);
    setForm({ english: "", spanish: "", level: "A1", confidence: "bad", group: "Vocabulary" });
    toast.success("Saved to your browser.");
  };

  const updateConfidence = (id: string, confidence: Confidence) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, confidence } : item)));
    toast.info(`Marked as ${confidence}.`);
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    toast.success("Entry removed.");
  };

  const resetData = () => {
    setItems(resetVocabulary());
    setCardIndex(0);
    toast.success("Starter vocabulary restored.");
  };

  const markCard = (confidence: Confidence) => {
    if (!activeCard) return;
    updateConfidence(activeCard.id, confidence);
    setShowAnswer(false);
    setCardIndex((current) => current + 1);
  };

  const answerQuiz = (answer: string) => {
    if (!quizItem || quizChoice) return;

    setQuizChoice(answer);
    if (answer === quizItem.spanish) {
      setQuizScore((current) => current + 1);
      toast.success("Correct!");
      return;
    }

    toast.error(`Correct answer: ${quizItem.spanish}`);
  };

  const nextQuiz = () => {
    setQuizChoice("");
    setQuizIndex((current) => current + 1);
  };

  const restartQuiz = () => {
    setQuizChoice("");
    setQuizIndex(0);
    setQuizScore(0);
    toast.info("Quiz restarted.");
  };

  const checkWrittenAnswer = (event: FormEvent) => {
    event.preventDefault();
    if (!writeItem || !writeAnswer.trim()) {
      toast.error("Write your answer first.");
      return;
    }

    const isCorrect = normalizeAnswer(writeAnswer) === normalizeAnswer(writeItem.english);
    setWriteResult(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setWriteScore((current) => current + 1);
      toast.success("Nice writing!");
      return;
    }

    toast.error("Almost. Check the correct phrase.");
  };

  const nextWrite = () => {
    setWriteAnswer("");
    setWriteResult("idle");
    setWriteIndex((current) => current + 1);
  };

  const restartWrite = () => {
    setWriteAnswer("");
    setWriteResult("idle");
    setWriteIndex(0);
    setWriteScore(0);
    toast.info("Writing game restarted.");
  };

  const addOrderWord = (tile: { id: string; word: string }) => {
    if (orderResult !== "idle") return;
    setOrderAnswer((current) => [...current, tile]);
  };

  const removeOrderWord = (id: string) => {
    if (orderResult !== "idle") return;
    setOrderAnswer((current) => current.filter((tile) => tile.id !== id));
  };

  const checkOrder = () => {
    if (!orderItem || orderAnswer.length === 0) {
      toast.error("Build the phrase first.");
      return;
    }

    const answer = orderAnswer.map((tile) => tile.word).join(" ");
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(orderItem.english);
    setOrderResult(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setOrderScore((current) => current + 1);
      toast.success("Phrase completed!");
      return;
    }

    toast.error("Not quite. Try the original order.");
  };

  const clearOrder = () => {
    setOrderAnswer([]);
    setOrderResult("idle");
  };

  const nextOrder = () => {
    setOrderAnswer([]);
    setOrderResult("idle");
    setOrderIndex((current) => current + 1);
  };

  const restartOrder = () => {
    setOrderAnswer([]);
    setOrderResult("idle");
    setOrderIndex(0);
    setOrderScore(0);
    toast.info("Order game restarted.");
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">English practice</p>
          <h1>Learn with your own words and phrases.</h1>
          <p className="hero-copy">Add what you learn, practice it, and track your level. Your progress stays in this browser.</p>
        </div>
        <div className="level-panel" aria-label="Estimated CEFR level">
          <div className="level-orbit">
            <span>{recommended.level}</span>
          </div>
          <p>Estimated CEFR focus</p>
          <strong>{Math.round(recommended.score * 10) / 10} / 6 readiness score</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel cefr-panel">
          <div className="panel-title">
            <Sparkles size={18} />
            <h2>CEFR Balance</h2>
          </div>
          <div className="bars">
            {cefrPercentages.map(({ level, percent }) => (
              <div className="bar-row" key={level}>
                <span>{level}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(percent, 3)}%` }} />
                </div>
                <strong>{percent}%</strong>
              </div>
            ))}
          </div>
          <p className="small-note">{cefrRubric[recommended.level]}</p>
        </article>

        <article className="panel stats-panel">
          <div className="stat">
            <BookOpen size={20} />
            <span>{items.length}</span>
            <p>saved entries</p>
          </div>
          <div className="stat">
            <Brain size={20} />
            <span>{dueItems.length}</span>
            <p>need practice</p>
          </div>
          <div className="stat">
            <Layers3 size={20} />
            <span>{groups.length - 1}</span>
            <p>groups</p>
          </div>
        </article>
      </section>

      <section className="workspace">
        <form className="panel entry-form" onSubmit={addItem}>
          <div className="panel-title">
            <Plus size={18} />
            <h2>Add a phrase</h2>
          </div>
          <label>
            English
            <input value={form.english} onChange={(event) => setForm({ ...form, english: event.target.value })} />
          </label>
          <label>
            Spanish meaning
            <input value={form.spanish} onChange={(event) => setForm({ ...form, spanish: event.target.value })} />
          </label>
          <div className="form-row">
            <label>
              Level
              <select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as CefrLevel })}>
                {levels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              Confidence
              <select
                value={form.confidence}
                onChange={(event) => setForm({ ...form, confidence: event.target.value as Confidence })}
              >
                {confidenceOptions.map((confidence) => (
                  <option key={confidence}>{confidence}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Group
            <input value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })} />
          </label>
          <button className="primary-button" type="submit">
            <Save size={18} />
            Save phrase
          </button>
        </form>

        <section className="panel study-panel">
          <div className="study-header">
            <div className="panel-title">
              <Brain size={18} />
              <h2>Practice</h2>
            </div>
            <div className="segmented">
              {(["flashcards", "match", "quiz", "write", "order", "groups"] as StudyMode[]).map((option) => (
                <button className={mode === option ? "active" : ""} key={option} onClick={() => setMode(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {mode === "flashcards" && activeCard && (
            <div className="flashcard">
              <p className="tag">{activeCard.group} - {activeCard.level}</p>
              <h3>{activeCard.english}</h3>
              {showAnswer ? <p className="answer">{activeCard.spanish}</p> : <p className="answer muted">Think of the meaning first.</p>}
              <div className="card-actions">
                <button onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? "Hide" : "Reveal"}</button>
                {confidenceOptions.map((confidence) => (
                  <button key={confidence} onClick={() => markCard(confidence)}>
                    {confidence}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "match" && (
            <div className="match-grid">
              {items.slice(0, 8).map((item) => (
                <button key={item.id} onClick={() => toast.info(item.spanish)}>
                  <span>{item.english}</span>
                  <small>tap to check</small>
                </button>
              ))}
            </div>
          )}

          {mode === "quiz" && quizItem && (
            <div className="quiz-game">
              <div className="quiz-topline">
                <span>
                  <Gamepad2 size={17} />
                  Question {(quizIndex % Math.max(quizItems.length, 1)) + 1} / {quizItems.length}
                </span>
                <strong>Score {quizScore}</strong>
              </div>
              <h3>{quizItem.english}</h3>
              <p className="muted">Choose the correct meaning.</p>
              <div className="quiz-options">
                {quizOptions.map((option) => {
                  const isSelected = quizChoice === option;
                  const isCorrect = quizChoice && option === quizItem.spanish;
                  const isWrong = isSelected && option !== quizItem.spanish;

                  return (
                    <button
                      className={`${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      key={option}
                      onClick={() => answerQuiz(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <div className="card-actions">
                <button onClick={nextQuiz} disabled={!quizChoice}>
                  Next
                </button>
                <button onClick={restartQuiz}>Restart</button>
              </div>
            </div>
          )}

          {mode === "write" && writeItem && (
            <form className="write-game" onSubmit={checkWrittenAnswer}>
              <div className="quiz-topline">
                <span>
                  <Keyboard size={17} />
                  Prompt {(writeIndex % Math.max(writeItems.length, 1)) + 1} / {writeItems.length}
                </span>
                <strong>Score {writeScore}</strong>
              </div>
              <div>
                <p className="tag">{writeItem.group} - {writeItem.level}</p>
                <h3>{writeItem.spanish}</h3>
                <p className="muted">Write this phrase in English.</p>
              </div>
              <label>
                Your answer
                <input
                  className={writeResult === "correct" ? "input-correct" : writeResult === "wrong" ? "input-wrong" : ""}
                  value={writeAnswer}
                  onChange={(event) => {
                    setWriteAnswer(event.target.value);
                    setWriteResult("idle");
                  }}
                  placeholder="Type the English phrase"
                />
              </label>
              {writeResult !== "idle" && (
                <p className={`write-feedback ${writeResult}`}>
                  {writeResult === "correct" ? "Correct." : `Correct phrase: ${writeItem.english}`}
                </p>
              )}
              <div className="card-actions">
                <button type="submit">Check</button>
                <button type="button" onClick={nextWrite}>
                  Next
                </button>
                <button type="button" onClick={restartWrite}>
                  Restart
                </button>
              </div>
            </form>
          )}

          {mode === "order" && orderItem && (
            <div className="order-game">
              <div className="quiz-topline">
                <span>
                  <ListOrdered size={17} />
                  Phrase {(orderIndex % Math.max(orderItems.length, 1)) + 1} / {orderItems.length}
                </span>
                <strong>Score {orderScore}</strong>
              </div>
              <div>
                <p className="tag">{orderItem.group} - {orderItem.level}</p>
                <h3>{orderItem.spanish}</h3>
                <p className="muted">Tap the words in the correct English order.</p>
              </div>
              <div className={`order-answer ${orderResult}`}>
                {orderAnswer.length ? (
                  orderAnswer.map((tile) => (
                    <button key={tile.id} onClick={() => removeOrderWord(tile.id)}>
                      {tile.word}
                    </button>
                  ))
                ) : (
                  <span>Your phrase will appear here.</span>
                )}
              </div>
              <div className="word-bank">
                {availableOrderTiles.map((tile) => (
                  <button key={tile.id} onClick={() => addOrderWord(tile)}>
                    {tile.word}
                  </button>
                ))}
              </div>
              {orderResult !== "idle" && (
                <p className={`write-feedback ${orderResult}`}>
                  {orderResult === "correct" ? "Correct." : `Correct phrase: ${orderItem.english}`}
                </p>
              )}
              <div className="card-actions">
                <button onClick={checkOrder}>Check</button>
                <button onClick={clearOrder}>Clear</button>
                <button onClick={nextOrder}>Next</button>
                <button onClick={restartOrder}>Restart</button>
              </div>
            </div>
          )}

          {mode === "groups" && (
            <div className="group-list">
              {groups.filter((group) => group !== "All").map((group) => {
                const count = items.filter((item) => item.group === group).length;
                return (
                  <button key={group} onClick={() => setSelectedGroup(group)}>
                    <span>{group}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <section className="panel library-panel">
        <div className="library-tools">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search words, meanings or groups" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
            {groups.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
          <button className="ghost-button" onClick={resetData}>
            <RotateCcw size={17} />
            Reset
          </button>
        </div>

        <div className="vocab-list">
          {filteredItems.map((item) => (
            <article className="vocab-card" key={item.id}>
              <div>
                <p className="tag">{item.group} - {item.level}</p>
                <h3>{item.english}</h3>
                <p>{item.spanish || "No translation yet"}</p>
              </div>
              <div className="confidence-row">
                {confidenceOptions.map((confidence) => (
                  <button
                    className={item.confidence === confidence ? "selected" : ""}
                    key={confidence}
                    onClick={() => updateConfidence(item.id, confidence)}
                    title={`Mark as ${confidence}`}
                  >
                    {item.confidence === confidence && <Check size={14} />}
                    {confidence}
                  </button>
                ))}
                <button className="icon-danger" onClick={() => removeItem(item.id)} title="Delete entry">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default App;
