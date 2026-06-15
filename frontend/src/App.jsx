import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADVISORS } from "./data/boardData.js";
import { UI, EXAMPLES } from "./i18n.js";
import { AdvisorIcon } from "./components/Icons.jsx";
import {
  cannedSession,
  runDiscover,
  runLiveBoard,
  streamBoard,
  deriveTensions,
  loadSaved,
  saveSession,
  deleteSaved,
  downloadSession,
  readSessionFile,
} from "./lib/session.js";
import {
  IconGavel,
  IconPencil,
  IconUsers,
  IconMessages,
  IconCrown,
  IconAffiliate,
  IconRefresh,
  IconArrowRight,
  IconQuote,
  IconCornerDownRight,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerTrackNextFilled,
  IconDeviceFloppy,
  IconDownload,
  IconUpload,
  IconTrash,
  IconBolt,
  IconLoader2,
  IconScale,
} from "@tabler/icons-react";

// ── PACING CONSTANTS (tune live during rehearsal) ───────────────────────────
const TYPING_MS = 2000;
const REVEAL_SPEED = 40;
const HOLD_MS = 4500;

const TABS = [
  { id: "convene", label: UI.tabConvene, Icon: IconPencil },
  { id: "advisors", label: UI.tabAdvisors, Icon: IconUsers },
  { id: "debate", label: UI.tabDebate, Icon: IconMessages },
  { id: "verdict", label: UI.tabVerdict, Icon: IconCrown },
  { id: "tension", label: UI.tabTension, Icon: IconAffiliate },
];

export default function App() {
  const [lang, setLang] = useState("en");
  const t = useCallback(
    (v) => {
      if (v == null) return "";
      if (typeof v === "string") return v;
      return v[lang] ?? v.en ?? "";
    },
    [lang]
  );

  const [tab, setTab] = useState("convene");
  const [session, setSession] = useState(cannedSession);
  const [saved, setSaved] = useState(loadSaved);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const startSession = (s) => {
    setSession(s);
    setTab("debate");
  };

  return (
    <div className="app">
      <Topbar t={t} tab={tab} setTab={setTab} lang={lang} setLang={setLang} />

      <main className="panel">
        {tab === "convene" && (
          <Convene
            t={t}
            lang={lang}
            saved={saved}
            setSaved={setSaved}
            onStart={startSession}
          />
        )}
        {tab === "advisors" && <Advisors t={t} />}
        {tab === "debate" && (
          <Debate
            t={t}
            session={session}
            setSaved={setSaved}
            onVerdict={() => setTab("verdict")}
          />
        )}
        {tab === "verdict" && <Verdict t={t} session={session} />}
        {tab === "tension" && <Tension t={t} session={session} />}
      </main>

      <footer className="foot">
        <span className="foot-mono">{t(UI.footer)}</span>
      </footer>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────
function Topbar({ t, tab, setTab, lang, setLang }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <IconGavel size={20} />
        </div>
        <div className="brand-name">{t(UI.brand)}</div>
      </div>
      <div className="tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={"tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
      <button
        className="lang-toggle"
        onClick={() => setLang((l) => (l === "en" ? "ar" : "en"))}
      >
        {UI.langToggle[lang]}
      </button>
    </div>
  );
}

// ── Convene ───────────────────────────────────────────────────────────────────
// phase: "input" → "discovering" → "questioning" → "running" → (onStart)
function Convene({ t, lang, saved, setSaved, onStart }) {
  const [draft, setDraft] = useState("");
  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState("input");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const busy = phase === "discovering" || phase === "running";

  // Build context string from answered discovery questions.
  const buildContext = (qs, ans) =>
    qs
      .map((q, i) => (ans[i]?.trim() ? `Q: ${q}\nA: ${ans[i].trim()}` : null))
      .filter(Boolean)
      .join("\n\n");

  // Step 1: user clicks "Ask the board" → load discovery questions.
  const handleLiveClick = async () => {
    const q = draft.trim();
    if (!q || busy) return;
    setError("");
    setPhase("discovering");
    try {
      const qs = await runDiscover(q, lang);
      setQuestions(qs);
      setAnswers({});
      setPhase("questioning");
    } catch {
      // Discovery endpoint unavailable — fall back to straight board run.
      await runBoard(q, "");
    }
  };

  // Step 2a: user submits answers → run board with enriched context.
  const handleConvene = async () => {
    const q = draft.trim();
    if (!q) return;
    setPhase("running");
    try {
      const s = await runLiveBoard(q, lang, buildContext(questions, answers), fast);
      onStart(s);
    } catch {
      setError(t(UI.apiError));
      setPhase("questioning");
    }
  };

  // Step 2b: skip discovery → run board without context.
  const handleSkip = async () => {
    const q = draft.trim();
    if (!q) return;
    setPhase("running");
    try {
      const s = await runLiveBoard(q, lang, "", fast);
      onStart(s);
    } catch {
      setError(t(UI.apiError));
      setPhase("questioning");
    }
  };

  // Internal helper shared by both fallback paths.
  const runBoard = async (q, ctx) => {
    setPhase("running");
    try {
      const s = await runLiveBoard(q, lang, ctx, fast);
      onStart(s);
    } catch {
      setError(t(UI.apiError));
      setPhase("input");
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await readSessionFile(file);
      onStart(s);
    } catch {
      setError("Invalid session file.");
    }
    e.target.value = "";
  };

  return (
    <div className="panel-pad">
      <div className="hero">
        <div className="eyebrow accent-market">{t(UI.heroEyebrow)}</div>
        <h1 className="display hero-h1">
          {t(UI.heroTitle1)}
          <br />
          <em>{t(UI.heroTitleEm)}</em>
        </h1>
        <p className="lede">{t(UI.heroLede)}</p>

        <div className="compose">
          <div className="qbox">
            <div className="qbox-label">{t(UI.decisionLabel)}</div>
            <textarea
              className="qbox-input"
              rows={2}
              value={draft}
              placeholder={t(UI.questionPlaceholder)}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleLiveClick();
              }}
            />
          </div>

          {/* ── Discovery phase ── */}
          {phase === "discovering" && (
            <div className="discover-loading">
              <IconLoader2 size={18} className="spin" />
              <span>{t(UI.discoverLoading)}</span>
            </div>
          )}

          {phase === "questioning" && questions.length > 0 && (
            <div className="discover-panel">
              <div className="discover-head">
                <IconCrown size={16} className="discover-crown" />
                <div>
                  <div className="discover-title">{t(UI.discoverTitle)}</div>
                  <div className="discover-lede">{t(UI.discoverLede)}</div>
                </div>
              </div>
              <div className="discover-questions">
                {questions.map((q, i) => (
                  <div key={i} className="discover-q">
                    <label className="dq-label">
                      {q}
                      <span className="dq-optional">{t(UI.discoverOptional)}</span>
                    </label>
                    <textarea
                      className="dq-input"
                      rows={2}
                      value={answers[i] || ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [i]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="discover-actions">
                <button className="convene-btn" onClick={handleConvene}>
                  <IconBolt size={17} /> {t(UI.discoverConvene)}
                </button>
                <button className="ghost-btn" onClick={handleSkip}>
                  {t(UI.discoverSkip)}
                </button>
              </div>
            </div>
          )}

          {phase === "running" && (
            <div className="discover-loading">
              <IconLoader2 size={18} className="spin" />
              <span>{t(UI.boardRunning)}</span>
            </div>
          )}

          {/* Only show action buttons in "input" phase */}
          {phase === "input" && (
            <>
              <div className="examples">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    className="ex-chip"
                    onClick={() => setDraft(t(ex.full))}
                  >
                    {t(ex.chip)}
                  </button>
                ))}
              </div>

              <div className="convene-actions">
                <button
                  className="convene-btn"
                  onClick={handleLiveClick}
                  disabled={!draft.trim()}
                >
                  <IconBolt size={18} /> {t(UI.runLive)}
                </button>
                <button className="ghost-btn lg" onClick={() => onStart(cannedSession())}>
                  <IconPlayerPlayFilled size={15} /> {t(UI.runDemo)}
                </button>
              </div>
              <label className="fast-toggle">
                <input
                  type="checkbox"
                  checked={fast}
                  onChange={(e) => setFast(e.target.checked)}
                />
                <span className="fast-label">⚡ {t(UI.fastMode)}</span>
              </label>
              <p className="live-hint">{t(UI.liveHint)}</p>
            </>
          )}

          {error && <p className="error-msg">{error}</p>}
        </div>

        <div className="seats">
          {Object.values(ADVISORS).map((a) => (
            <div key={a.id} className="seat">
              <div
                className="seat-av"
                style={{ background: a.accentSoft, borderColor: a.accent }}
              >
                <AdvisorIcon name={a.icon} color={a.accent} size={30} />
              </div>
              <span className="seat-name">{t(a.name)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* saved conversations */}
      <div className="saved-section">
        <div className="saved-head">
          <h3 className="saved-title">{t(UI.savedTitle)}</h3>
          <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
            <IconUpload size={15} /> {t(UI.importFile)}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={onImport}
          />
        </div>
        {saved.length === 0 ? (
          <p className="muted">{t(UI.noSaved)}</p>
        ) : (
          <div className="saved-list">
            {saved.map((s) => (
              <div key={s.id} className="saved-item">
                <span className={"src-badge " + s.source}>
                  {t(s.source === "live" ? UI.liveBadge : UI.demoBadge)}
                </span>
                <span className="saved-q">{t(s.decision)}</span>
                <div className="saved-acts">
                  <button className="mini-btn" onClick={() => onStart(s)}>
                    {t(UI.load)}
                  </button>
                  <button
                    className="mini-btn"
                    onClick={() => downloadSession(s, t(s.decision).slice(0, 24))}
                    title={t(UI.download)}
                  >
                    <IconDownload size={15} />
                  </button>
                  <button
                    className="mini-btn danger"
                    onClick={() => setSaved(deleteSaved(s.id))}
                    title={t(UI.deleteWord)}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Advisors intro ────────────────────────────────────────────────────────────
function Advisors({ t }) {
  return (
    <div className="panel-pad">
      <div className="section-intro">
        <div className="eyebrow accent-market">{t(UI.advEyebrow)}</div>
        <h2 className="display">{t(UI.advTitle)}</h2>
        <p className="lede">{t(UI.advLede)}</p>
      </div>
      <div className="advisor-grid">
        {Object.values(ADVISORS).map((a) => (
          <div key={a.id} className="advisor-card" style={advVars(a)}>
            <div className="ac-banner">
              <div className="ac-avatar">
                <AdvisorIcon name={a.icon} color={a.accent} size={34} />
              </div>
              <span className="ac-tag">{t(a.tag)}</span>
            </div>
            <div className="ac-body">
              <div className="ac-name">{t(a.name)}</div>
              <div className="ac-role">{t(a.role)}</div>
              <div className="ac-quote">“{t(a.quote)}”</div>
              <div className="ac-traits">
                {t(a.traits).map((tr, i) => (
                  <span key={i} className="trait">
                    {tr}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Debate (conversation theater) ─────────────────────────────────────────────
function Debate({ t, session, setSaved, onVerdict }) {
  const beats = useMemo(() => {
    const b = [];
    session.round1.forEach((d) => b.push({ kind: "r1", data: d }));
    session.round2.forEach((d) => b.push({ kind: "r2", data: d }));
    return b;
  }, [session]);

  const [step, setStep] = useState(0);
  const [stage, setStage] = useState("typing");
  const [reveal, setReveal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const activeRef = useRef(null);

  // reset everything when the session changes
  useEffect(() => {
    setStep(0);
    setStage("typing");
    setReveal(0);
    setPlaying(false);
  }, [session]);

  const beat = beats[step];
  const fullText = t(beat.data.rationale);
  const fullLen = fullText.length;
  const isLast = step === beats.length - 1;
  const finished = isLast && stage === "holding" && reveal >= fullLen;

  const goNext = useCallback(() => {
    setStep((s) => {
      if (s >= beats.length - 1) {
        setPlaying(false);
        return s;
      }
      return s + 1;
    });
  }, [beats.length]);

  useEffect(() => {
    setStage("typing");
    setReveal(0);
  }, [step]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step, stage]);

  useEffect(() => {
    if (!playing) return;
    if (stage === "typing") {
      const id = setTimeout(() => setStage("revealing"), TYPING_MS);
      return () => clearTimeout(id);
    }
    if (stage === "revealing") {
      if (reveal >= fullLen) {
        setStage("holding");
        return;
      }
      const id = setTimeout(() => setReveal((r) => r + 1), REVEAL_SPEED);
      return () => clearTimeout(id);
    }
    if (stage === "holding") {
      if (isLast) return;
      const id = setTimeout(goNext, HOLD_MS);
      return () => clearTimeout(id);
    }
  }, [playing, stage, reveal, fullLen, isLast, goNext]);

  const handleNext = useCallback(() => {
    if (stage === "typing" || reveal < fullLen) {
      setReveal(fullLen);
      setStage("holding");
    } else if (!isLast) {
      goNext();
    }
  }, [stage, reveal, fullLen, isLast, goNext]);

  const restart = useCallback(() => {
    setStep(0);
    setStage("typing");
    setReveal(0);
    setPlaying(false);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        handleNext();
      } else if (e.key.toLowerCase() === "p") setPlaying((p) => !p);
      else if (e.key.toLowerCase() === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNext, restart]);

  const onSave = () => {
    setSaved(saveSession(session));
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  };

  // who the active rebuttal targets, and the index of that target's last message
  const targetId = beat.kind === "r2" ? beat.data.respondsTo : null;
  let rebutTargetIdx = -1;
  if (targetId) {
    for (let i = step - 1; i >= 0; i--) {
      if (beats[i].data.advisor === targetId) {
        rebutTargetIdx = i;
        break;
      }
    }
  }

  return (
    <div className="panel-pad">
      <div className="debate-top">
        <h2 className="display debate-h2">{t(UI.debateTitle)}</h2>
        <div className="debate-tools">
          <button className="ghost-btn" onClick={onSave}>
            <IconDeviceFloppy size={15} /> {savedTick ? t(UI.saved) : t(UI.save)}
          </button>
          <button
            className="ghost-btn"
            onClick={() => downloadSession(session, t(session.decision).slice(0, 24))}
          >
            <IconDownload size={15} /> {t(UI.download)}
          </button>
          <button className="ghost-btn" onClick={restart}>
            <IconRefresh size={15} /> {t(UI.restart)}
          </button>
        </div>
      </div>

      <div className="decision-recap">
        <IconQuote size={17} className="recap-icon" />
        <span>{t(session.decision)}</span>
        <span className={"src-badge " + session.source}>
          {t(session.source === "live" ? UI.liveBadge : UI.demoBadge)}
        </span>
      </div>

      <AdvisorStrip t={t} speakerId={beat.data.advisor} targetId={targetId} />

      <div className="thread">
        {beats.slice(0, step + 1).map((b, i) => {
          const active = i === step;
          const showRoundLabel =
            i === 0 || beats[i - 1].kind !== b.kind;
          return (
            <div key={i}>
              {showRoundLabel && (
                <div className="round-divider">
                  <span className="round-label">
                    {t(b.kind === "r1" ? UI.round1 : UI.round2)}
                  </span>
                </div>
              )}
              {active ? (
                <div ref={activeRef}>
                  <FocusMessage
                    t={t}
                    beat={b}
                    stage={stage}
                    reveal={reveal}
                    fullText={fullText}
                  />
                </div>
              ) : (
                <PastMessage
                  t={t}
                  beat={b}
                  isRebutTarget={i === rebutTargetIdx}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="controls">
        <button className="ctrl primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPlayerPauseFilled size={17} /> : <IconPlayerPlayFilled size={17} />}
          {playing ? t(UI.pause) : t(UI.play)}
        </button>
        <button className="ctrl" onClick={handleNext}>
          {t(UI.next)} <IconPlayerTrackNextFilled size={15} />
        </button>
        {finished && (
          <button className="ctrl accent" onClick={onVerdict}>
            {t(UI.toVerdict)} <IconArrowRight size={16} />
          </button>
        )}
        <span className="space-hint">{t(UI.spaceHint)}</span>
      </div>
    </div>
  );
}

function AdvisorStrip({ t, speakerId, targetId }) {
  return (
    <div className="advisor-strip">
      {Object.values(ADVISORS).map((a) => {
        const isSpeaker = a.id === speakerId;
        const isTarget = a.id === targetId;
        return (
          <div
            key={a.id}
            className={
              "strip-card" +
              (isSpeaker ? " speaking" : "") +
              (isTarget ? " targeted" : "")
            }
            style={advVars(a)}
          >
            <div className="strip-av">
              <AdvisorIcon name={a.icon} color={a.accent} size={22} />
            </div>
            <span className="strip-name">{t(a.name)}</span>
            {isTarget && <span className="target-tag">⟵</span>}
          </div>
        );
      })}
    </div>
  );
}

function ReplyChip({ t, speaker, target }) {
  return (
    <div className="replying-chip">
      <span style={{ color: speaker.accent, fontWeight: 600 }}>{t(speaker.name)}</span>
      <IconCornerDownRight size={15} className="reply-arrow" />
      <span className="replying-label">{t(UI.respondingTo)}</span>
      <span
        className="target-pill"
        style={{ background: target.accentSoft, color: target.accentDeep }}
      >
        <AdvisorIcon name={target.icon} color={target.accent} size={15} />
        {t(target.name)}
      </span>
    </div>
  );
}

function FocusMessage({ t, beat, stage, reveal, fullText }) {
  const a = ADVISORS[beat.data.advisor];
  const target = beat.kind === "r2" ? ADVISORS[beat.data.respondsTo] : null;
  const vote = beat.data.vote;
  const typing = stage === "typing";
  const revealing = stage === "revealing";
  const shownText = fullText.slice(0, reveal);

  return (
    <div className="focus-card" style={advVars(a)}>
      <div className="focus-header">
        <div className="speaker">
          <div className="speaker-av">
            <AdvisorIcon name={a.icon} color={a.accent} size={24} />
          </div>
          <div className="speaker-meta">
            <span className="speaker-name">{t(a.name)}</span>
            <span className="speaker-role">{t(a.role)}</span>
          </div>
        </div>
        {target && <ReplyChip t={t} speaker={a} target={target} />}
        <span className={"vote vote-" + vote}>{t(UI.votes[vote])}</span>
      </div>

      {typing ? (
        <div className="typing-dots">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          <p className="rationale display">
            {shownText}
            {revealing && <span className="caret">|</span>}
          </p>
          <p className={"reasoning" + (revealing ? " dim" : "")}>
            {t(beat.data.reasoning)}
          </p>
        </>
      )}
    </div>
  );
}

function PastMessage({ t, beat, isRebutTarget }) {
  const a = ADVISORS[beat.data.advisor];
  const target = beat.kind === "r2" ? ADVISORS[beat.data.respondsTo] : null;
  const vote = beat.data.vote;
  return (
    <div
      className={"past-msg" + (isRebutTarget ? " rebut-target" : "")}
      style={advVars(a)}
    >
      {isRebutTarget && <span className="rebut-tag">⟵ {t(UI.rebutted)}</span>}
      <div className="past-head">
        <div className="past-av">
          <AdvisorIcon name={a.icon} color={a.accent} size={18} />
        </div>
        <span className="past-name">{t(a.name)}</span>
        {target && (
          <span className="past-reply">
            <IconCornerDownRight size={13} /> {t(target.name)}
          </span>
        )}
        <span className={"vote sm vote-" + vote}>{t(UI.votes[vote])}</span>
      </div>
      <p className="past-text">{t(beat.data.rationale)}</p>
    </div>
  );
}

// ── Verdict ───────────────────────────────────────────────────────────────────
function Verdict({ t, session }) {
  const v = session.verdict;
  const pct = Math.round((v.confidence || 0) * 100);
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setFill(pct), 200);
    return () => clearTimeout(id);
  }, [pct]);

  const finalVotes = useMemo(() => {
    const m = {};
    session.round2.forEach((r) => (m[r.advisor] = r.vote));
    return m;
  }, [session]);

  const voteCounts = useMemo(() => {
    return ["against", "for", "neutral"]
      .map((k) => ({
        k,
        n: Object.values(finalVotes).filter((vt) => vt === k).length,
      }))
      .filter((x) => x.n > 0);
  }, [finalVotes]);

  return (
    <div className="panel-pad">
      <div className="section-intro">
        <div className="eyebrow accent-legal">{t(UI.verdictEyebrow)}</div>
        <h2 className="display">{t(UI.verdictTitle)}</h2>
      </div>

      <div className="tally">
        {Object.values(ADVISORS).map((a) => {
          const vote = finalVotes[a.id] || "neutral";
          return (
            <div key={a.id} className="tally-cell" style={advVars(a)}>
              <div className="tally-av">
                <AdvisorIcon name={a.icon} color={a.accent} size={28} />
              </div>
              <div className="tally-name">{t(a.name)}</div>
              <div className="tally-vote">{t(UI.voteWord[vote])}</div>
            </div>
          );
        })}
      </div>

      <div className="vote-summary">
        <span className="vs-counts">
          {t(UI.boardSplit)}:{" "}
          {voteCounts.map((c, i) => (
            <span key={c.k}>
              {i > 0 && " · "}
              <b>{c.n}</b> {t(UI.voteCount[c.k])}
            </span>
          ))}
        </span>
        <span className="vs-note">{t(UI.notVoteCount)}</span>
      </div>

      <div className="gavel">
        <div className="gavel-top">
          <div className="gavel-label">
            <IconCrown size={14} /> {t(UI.chairmanRec)}
          </div>
          {v.stance && UI.stance[v.stance] && (
            <span className={"stance-badge " + v.stance}>
              {t(UI.stance[v.stance])}
            </span>
          )}
        </div>
        <div className="gavel-rec display">{t(v.recommendation)}</div>
        {v.boardNote && (
          <div className="board-note">
            <IconScale size={15} /> {t(v.boardNote)}
          </div>
        )}
        <div className="gavel-foot">
          <span className="conf-label">{t(UI.confidence)}</span>
          <div className="conf-track">
            <div className="conf-fill" style={{ width: fill + "%" }} />
          </div>
          <span className="conf-num">{pct}%</span>
        </div>
      </div>

      {v.nextSteps?.length > 0 && (
        <div className="steps-box">
          <div className="steps-title">{t(UI.nextSteps)}</div>
          {v.nextSteps.map((s, i) => (
            <div key={i} className="step-item">
              <span className="step-num">{i + 1}</span>
              <span className="step-text">{t(s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tension map ───────────────────────────────────────────────────────────────
const TENSION_POS = {
  CFO: { x: 26, y: 28 },
  Market: { x: 74, y: 28 },
  Legal: { x: 50, y: 80 },
};
const TENSION_COLOR = { clash: "#a82e2e", tension: "#c98a2a", align: "#3d7012" };

function Tension({ t, session }) {
  const edges = useMemo(() => deriveTensions(session.round2), [session]);
  return (
    <div className="panel-pad">
      <div className="section-intro">
        <div className="eyebrow accent-market">{t(UI.tensionEyebrow)}</div>
        <h2 className="display">{t(UI.tensionTitle)}</h2>
        <p className="lede">{t(UI.tensionLede)}</p>
      </div>

      <div className="tmap-wrap">
        <div className="tmap">
          <svg className="tlines" viewBox="0 0 100 100" preserveAspectRatio="none">
            {edges.map((e, i) => {
              const p1 = TENSION_POS[e.a];
              const p2 = TENSION_POS[e.b];
              if (!p1 || !p2) return null;
              return (
                <line
                  key={i}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={TENSION_COLOR[e.kind]}
                  strokeWidth={e.kind === "clash" ? 1.1 : e.kind === "tension" ? 0.7 : 0.8}
                  strokeLinecap="round"
                  opacity="0.9"
                />
              );
            })}
          </svg>
          {Object.values(ADVISORS).map((a) => {
            const pos = TENSION_POS[a.id];
            if (!pos) return null;
            return (
              <div
                key={a.id}
                className="tnode"
                style={{ left: pos.x + "%", top: pos.y + "%", ...advVars(a) }}
              >
                <div className="tnode-av">
                  <AdvisorIcon name={a.icon} color={a.accent} size={28} />
                </div>
                <span className="tnode-name">{t(a.name)}</span>
              </div>
            );
          })}
        </div>
        <div className="tlegend">
          <div className="tleg">
            <span className="tleg-line" style={{ background: TENSION_COLOR.clash }} />
            {t(UI.legClash)}
          </div>
          <div className="tleg">
            <span className="tleg-line" style={{ background: TENSION_COLOR.tension }} />
            {t(UI.legTension)}
          </div>
          <div className="tleg">
            <span className="tleg-line" style={{ background: TENSION_COLOR.align }} />
            {t(UI.legAlign)}
          </div>
        </div>
      </div>
    </div>
  );
}

function advVars(a) {
  return {
    "--accent": a.accent,
    "--accent-soft": a.accentSoft,
    "--accent-deep": a.accentDeep,
  };
}
