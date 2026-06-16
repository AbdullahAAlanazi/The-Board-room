import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADVISORS } from "./data/boardData.js";
import { UI, EXAMPLES } from "./i18n.js";
import { AdvisorIcon } from "./components/Icons.jsx";
import {
  cannedSession,
  runIntake,
  streamRound,
  runVerdict,
  buildLiveSession,
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
  IconCheck,
  IconBulb,
  IconSend,
} from "@tabler/icons-react";

// Auto-advance dwell per contribution, scaled to reading time.
function readingDwell(beat, t) {
  const txt =
    (t(beat.data.perspective) || "") + " " +
    (beat.data.conditions || []).map(t).join(" ") + " " +
    (t(beat.data.reasoning) || "");
  return Math.min(11000, Math.max(4200, 1800 + txt.length * 42));
}

const TABS = [
  { id: "convene", label: UI.tabConvene, Icon: IconPencil },
  { id: "advisors", label: UI.tabAdvisors, Icon: IconUsers },
  { id: "debate", label: UI.tabDebate, Icon: IconMessages },
  { id: "verdict", label: UI.tabVerdict, Icon: IconCrown },
  { id: "tension", label: UI.tabTension, Icon: IconAffiliate },
];

// Seats evenly around an ellipse (shared 0..100 space with the SVG lines).
const ADV_LIST = Object.values(ADVISORS);
const SEATS = (() => {
  const cx = 50, cy = 47, rx = 37, ry = 32, n = ADV_LIST.length;
  const m = {};
  ADV_LIST.forEach((a, i) => {
    const ang = ((-90 + (i * 360) / n) * Math.PI) / 180;
    m[a.id] = { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) };
  });
  return m;
})();

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
  // live: { decision, context } while a live run is in progress; null for replay.
  const [live, setLive] = useState(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Replay an existing session (demo / saved / imported).
  const startReplay = (s) => {
    setLive(null);
    setSession(s);
    setTab("debate");
  };

  // Begin a live, round-by-round run.
  const startLive = (decision, context) => {
    setLive({ decision, context: context || "" });
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
            onReplay={startReplay}
            onLive={startLive}
          />
        )}
        {tab === "advisors" && <Advisors t={t} />}
        {tab === "debate" &&
          (live ? (
            <LiveDebate
              t={t}
              lang={lang}
              decision={live.decision}
              baseContext={live.context}
              onSessionReady={setSession}
              setSaved={setSaved}
              onVerdict={() => setTab("verdict")}
            />
          ) : (
            <ReplayDebate
              t={t}
              session={session}
              setSaved={setSaved}
              onVerdict={() => setTab("verdict")}
            />
          ))}
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

// ── Convene (with discovery chat) ─────────────────────────────────────────────
// phase: "input" → "discovering" → "chat" | "answered"
function Convene({ t, lang, saved, setSaved, onReplay, onLive }) {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState("input");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]); // {q, a}
  const [qIdx, setQIdx] = useState(0);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");          // chairman's direct answer
  const [suggested, setSuggested] = useState("");    // suggested decision
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qIdx, phase]);

  const buildContext = (pairs) =>
    pairs
      .filter((p) => p.a.trim())
      .map((p) => `Q: ${p.q}\nA: ${p.a.trim()}`)
      .join("\n\n");

  const askBoard = async () => {
    const q = draft.trim();
    if (!q || phase !== "input") return;
    setError("");
    setPhase("discovering");
    try {
      const r = await runIntake(q, lang);
      if (r.kind === "question") {
        // Chairman answers directly + proposes a decision.
        setAnswer(r.answer);
        setSuggested(r.suggestedDecision);
        setPhase("answered");
      } else if (r.questions.length) {
        // A vague decision → discovery chat.
        setQuestions(r.questions);
        setAnswers([]);
        setQIdx(0);
        setPhase("chat");
      } else {
        // A clear decision → straight to the board.
        onLive(q, "");
        setPhase("input");
      }
    } catch {
      // Intake unavailable — go straight to the live board.
      onLive(q, "");
      setPhase("input");
    }
  };

  const resetIntake = () => {
    setPhase("input");
    setAnswer("");
    setSuggested("");
    setQuestions([]);
    setAnswers([]);
  };

  const sendReply = () => {
    const a = reply.trim();
    const pairs = [...answers, { q: questions[qIdx], a }];
    setAnswers(pairs);
    setReply("");
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1);
    } else {
      onLive(draft.trim(), buildContext(pairs));
    }
  };

  const skipRest = () => onLive(draft.trim(), buildContext(answers));

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onReplay(await readSessionFile(file));
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
          {phase === "answered" ? (
            <AnswerView
              t={t}
              question={draft}
              answer={answer}
              suggested={suggested}
              onConvene={() => onLive(suggested || draft.trim(), "")}
              onReset={resetIntake}
            />
          ) : phase === "chat" ? (
            <DiscoveryChat
              t={t}
              decision={draft}
              questions={questions}
              answers={answers}
              qIdx={qIdx}
              reply={reply}
              setReply={setReply}
              onSend={sendReply}
              onSkip={skipRest}
              chatEndRef={chatEndRef}
            />
          ) : (
            <>
              <div className="qbox">
                <div className="qbox-label">{t(UI.decisionLabel)}</div>
                <textarea
                  className="qbox-input"
                  rows={2}
                  value={draft}
                  placeholder={t(UI.questionPlaceholder)}
                  disabled={phase === "discovering"}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askBoard();
                  }}
                />
              </div>

              {phase === "discovering" ? (
                <div className="discover-loading">
                  <IconLoader2 size={18} className="spin" />
                  <span>{t(UI.discoverLoading)}</span>
                </div>
              ) : (
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
                      onClick={askBoard}
                      disabled={!draft.trim()}
                    >
                      <IconBolt size={18} /> {t(UI.runLive)}
                    </button>
                    <button
                      className="ghost-btn lg"
                      onClick={() => onReplay(cannedSession())}
                    >
                      <IconPlayerPlayFilled size={15} /> {t(UI.runDemo)}
                    </button>
                  </div>
                  <p className="live-hint">{t(UI.liveHint)}</p>
                </>
              )}
            </>
          )}
          {error && <p className="error-msg">{error}</p>}
        </div>

        <div className="seats">
          {ADV_LIST.map((a) => (
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
                  <button className="mini-btn" onClick={() => onReplay(s)}>
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

function DiscoveryChat({ t, decision, questions, answers, qIdx, reply, setReply, onSend, onSkip, chatEndRef }) {
  return (
    <div className="chat">
      <div className="chat-thread">
        <div className="chat-row user">
          <div className="bubble user">{decision}</div>
        </div>
        <div className="chat-row chair">
          <div className="chair-av"><IconCrown size={15} /></div>
          <div className="bubble chair">{t(UI.discoverIntro)}</div>
        </div>
        {questions.slice(0, qIdx + 1).map((q, i) => (
          <div key={i}>
            <div className="chat-row chair">
              <div className="chair-av"><IconCrown size={15} /></div>
              <div className="bubble chair">{q}</div>
            </div>
            {answers[i] && answers[i].a.trim() && (
              <div className="chat-row user">
                <div className="bubble user">{answers[i].a}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          className="chat-textarea"
          rows={1}
          value={reply}
          placeholder={t(UI.answerPlaceholder)}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button className="send-btn" onClick={onSend}>
          {qIdx + 1 < questions.length ? (
            <><IconSend size={16} /> {t(UI.send)}</>
          ) : (
            <><IconBolt size={16} /> {t(UI.discoverStart)}</>
          )}
        </button>
      </div>
      <button className="chat-skip" onClick={onSkip}>
        {t(UI.discoverSkip)} →
      </button>
    </div>
  );
}

// The chairman's direct answer to a question + a suggested decision to convene on.
function AnswerView({ t, question, answer, suggested, onConvene, onReset }) {
  return (
    <div className="chat">
      <div className="chat-thread">
        <div className="chat-row user">
          <div className="bubble user">{question}</div>
        </div>
        <div className="chat-row chair">
          <div className="chair-av"><IconCrown size={15} /></div>
          <div className="bubble chair">{answer}</div>
        </div>
      </div>

      {suggested && (
        <div className="suggested-card">
          <div className="suggested-label">
            <IconBolt size={14} /> {t(UI.suggestedDecision)}
          </div>
          <div className="suggested-text">{suggested}</div>
          <div className="suggested-actions">
            <button className="convene-btn" onClick={onConvene}>
              <IconUsers size={17} /> {t(UI.convOnSuggested)}
            </button>
            <button className="ghost-btn" onClick={onReset}>
              {t(UI.askAnother)}
            </button>
          </div>
        </div>
      )}
      {!suggested && (
        <div className="convene-actions">
          <button className="ghost-btn" onClick={onReset}>{t(UI.askAnother)}</button>
        </div>
      )}
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
        {ADV_LIST.map((a) => (
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
                  <span key={i} className="trait">{tr}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Boardroom table (shared visual) ───────────────────────────────────────────
function BoardTable({ t, byId, activeId, targetId, activeNum }) {
  const ids = ADV_LIST.map((a) => a.id);
  const pairs = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);

  return (
    <div className="board-table">
      <svg className="bt-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {pairs.map(([a, b], i) => (
          <line
            key={i}
            x1={SEATS[a].x} y1={SEATS[a].y}
            x2={SEATS[b].x} y2={SEATS[b].y}
            className="bt-line"
          />
        ))}
        {activeId && targetId && SEATS[activeId] && SEATS[targetId] && (
          <line
            x1={SEATS[activeId].x} y1={SEATS[activeId].y}
            x2={SEATS[targetId].x} y2={SEATS[targetId].y}
            className="bt-line active"
            style={{ stroke: ADVISORS[activeId].accent }}
          />
        )}
      </svg>
      <div className="bt-surface">
        <IconGavel size={24} />
      </div>
      {ADV_LIST.map((a) => {
        const pos = SEATS[a.id];
        const resp = byId[a.id];
        const isActive = a.id === activeId;
        const isTarget = a.id === targetId;
        return (
          <div
            key={a.id}
            className={
              "bt-seat" +
              (resp ? " filled" : "") +
              (isActive ? " active" : "") +
              (isTarget ? " targeted" : "") +
              (resp && resp.relevant === false ? " muted" : "")
            }
            style={{ left: pos.x + "%", top: pos.y + "%", ...advVars(a) }}
          >
            <div className="bt-seat-av">
              <AdvisorIcon name={a.icon} color={a.accent} size={24} />
              {isActive && activeNum != null && (
                <span className="bt-seat-num">{activeNum}</span>
              )}
            </div>
            <span className="bt-seat-name">{t(a.name)}</span>
            {isActive && <span className="bt-seat-status">{t(UI.speakingNow)}</span>}
            {isTarget && <span className="bt-target-tag">⟵</span>}
          </div>
        );
      })}
    </div>
  );
}

// The enlarged, translucent active speaker card (numbered) under the table.
function ActiveCard({ t, beat, n, total, playing, dwell }) {
  if (!beat) {
    return (
      <div className="active-card waiting">
        <div className="typing-dots"><span /><span /><span /></div>
        <span className="ac-waiting-text">{t(UI.boardRunning)}</span>
      </div>
    );
  }
  const a = ADVISORS[beat.data.advisor];
  const resp = beat.data;
  const target = resp.respondsTo ? ADVISORS[resp.respondsTo] : null;
  const outOfScope = resp.relevant === false;
  return (
    <div className="active-card" style={advVars(a)} key={n}>
      {/* reading-time progress */}
      <div
        className={"ac-progress" + (playing ? " run" : "")}
        style={{ animationDuration: dwell + "ms" }}
      />
      <div className="ac-head">
        <span className="ac-number">{n}</span>
        <div className="ac-av">
          <AdvisorIcon name={a.icon} color={a.accent} size={24} />
        </div>
        <div className="ac-meta">
          <span className="ac-name">{t(a.name)}</span>
          <span className="ac-role">
            {beat.round === 2 ? t(UI.round2Short) : t(UI.round1Short)}
            {" · "}{t(a.role)}
          </span>
        </div>
        {target && (
          <span className="replying-chip">
            <IconCornerDownRight size={14} className="reply-arrow" />
            <span className="replying-label">{t(UI.respondingTo)}</span>
            <span
              className="target-pill"
              style={{ background: target.accentSoft, color: target.accentDeep }}
            >
              <AdvisorIcon name={target.icon} color={target.accent} size={14} />
              {t(target.name)}
            </span>
          </span>
        )}
      </div>

      {outOfScope ? (
        <p className="ac-perspective out">
          <span className="oos-tag">{t(UI.outOfScope)}</span> {t(resp.perspective)}
        </p>
      ) : (
        <>
          <p className="ac-perspective display">{t(resp.perspective)}</p>
          {resp.conditions?.length > 0 && (
            <div className="stage-tags">
              <span className="tags-label"><IconCheck size={13} /> {t(UI.conditionsLabel)}</span>
              {resp.conditions.map((c, i) => (
                <span key={i} className="tag cond">{t(c)}</span>
              ))}
            </div>
          )}
          {resp.recommendations?.length > 0 && (
            <div className="stage-tags">
              <span className="tags-label"><IconBulb size={13} /> {t(UI.recommendsLabel)}</span>
              {resp.recommendations.map((r, i) => (
                <span key={i} className="tag rec">{t(r)}</span>
              ))}
            </div>
          )}
          {resp.reasoning && <p className="ac-reasoning">{t(resp.reasoning)}</p>}
        </>
      )}
    </div>
  );
}

// Numbered timeline of every contribution — click any to review.
function Timeline({ t, beats, idx, onJump, expected }) {
  const slots = [];
  for (let i = 0; i < (expected || beats.length); i++) {
    const b = beats[i];
    slots.push(b ? { b, i } : { b: null, i });
  }
  return (
    <div className="timeline">
      {slots.map(({ b, i }) =>
        b ? (
          <button
            key={i}
            className={
              "tl-pill" + (i === idx ? " active" : "") + (i < idx ? " past" : "")
            }
            style={advVars(ADVISORS[b.data.advisor])}
            onClick={() => onJump(i)}
            title={`${i + 1}. ${t(ADVISORS[b.data.advisor].name)}`}
          >
            <span className="tl-num">{i + 1}</span>
            <AdvisorIcon name={ADVISORS[b.data.advisor].icon} color={ADVISORS[b.data.advisor].accent} size={14} />
            {b.round === 2 && <span className="tl-r2">R2</span>}
          </button>
        ) : (
          <span key={i} className="tl-pill pending">
            <span className="tl-num">{i + 1}</span>
            <span className="tl-dots">···</span>
          </span>
        )
      )}
    </div>
  );
}

// Minimal transport: pause/resume + replay. No "next" — it auto-advances.
function Transport({ t, playing, setPlaying, onReplay, ended, onVerdict }) {
  return (
    <div className="controls">
      {!ended && (
        <button className="ctrl primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPlayerPauseFilled size={16} /> : <IconPlayerPlayFilled size={16} />}
          {playing ? t(UI.pause) : t(UI.play)}
        </button>
      )}
      {onReplay && (
        <button className="ctrl" onClick={onReplay}>
          <IconRefresh size={15} /> {t(UI.restart)}
        </button>
      )}
      {ended && onVerdict && (
        <button className="ctrl accent" onClick={onVerdict}>
          {t(UI.toVerdict)} <IconArrowRight size={16} />
        </button>
      )}
      <span className="space-hint">{t(UI.spaceHint)}</span>
    </div>
  );
}

// ── Live debate (auto-flows through rounds; persistent interjection) ───────────
function LiveDebate({ t, lang, decision, baseContext, onSessionReady, setSaved, onVerdict }) {
  // phase: r1 | r2 | verdict | done | error
  const [phase, setPhase] = useState("r1");
  const [beats, setBeats] = useState([]);          // {round, data} in arrival order
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [verdict, setVerdict] = useState(null);
  const [interject, setInterject] = useState("");
  const [flash, setFlash] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  const contextRef = useRef(baseContext || "");
  const interjectRef = useRef("");
  const round1Ref = useRef([]);
  const round2Ref = useRef([]);
  const cancelRef = useRef(null);
  const finalSession = useRef(null);

  // ── orchestration: round1 → round2 → verdict, back-to-back ──────────────────
  useEffect(() => {
    cancelRef.current = streamRound(decision, lang, contextRef.current, 1, [], {
      onAdvisor: (a) => {
        round1Ref.current.push(a);
        setBeats((b) => [...b, { round: 1, data: a }]);
      },
      onDone: startRound2,
      onError: () => setPhase("error"),
    });
    return () => cancelRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyInterjection() {
    if (interjectRef.current.trim()) {
      contextRef.current += `\n\n[Board chair adds]: ${interjectRef.current.trim()}`;
      interjectRef.current = "";
      setInterject("");
    }
  }

  function startRound2() {
    applyInterjection();
    setPhase("r2");
    cancelRef.current = streamRound(decision, lang, contextRef.current, 2, round1Ref.current, {
      onAdvisor: (a) => {
        round2Ref.current.push(a);
        setBeats((b) => [...b, { round: 2, data: a }]);
      },
      onDone: goVerdict,
      onError: () => setPhase("error"),
    });
  }

  async function goVerdict() {
    applyInterjection();
    setPhase("verdict");
    try {
      const v = await runVerdict(
        decision, lang, contextRef.current, round1Ref.current, round2Ref.current
      );
      setVerdict(v);
      const sess = buildLiveSession(decision, round1Ref.current, round2Ref.current, v);
      finalSession.current = sess;
      onSessionReady(sess);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  const total = 2 * ADV_LIST.length; // expected contributions
  const beat = beats[idx];
  const dwell = beat ? readingDwell(beat, t) : 4200;
  const atLastAvailable = idx >= beats.length - 1;
  const ended = phase === "done" && atLastAvailable;

  // auto-advance through available beats
  useEffect(() => {
    if (!playing || !beat) return;
    if (idx < beats.length - 1) {
      const id = setTimeout(() => setIdx((s) => s + 1), dwell);
      return () => clearTimeout(id);
    }
    // caught up to the last available beat; if verdict is in, stop here
    // otherwise we simply wait — new beats will re-trigger this effect.
  }, [playing, idx, beats.length, dwell, beat]);

  const jump = (i) => { if (beats[i]) { setIdx(i); setPlaying(false); } };

  // keyboard: P pause/play, R replay, ←/→ review
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "p") setPlaying((p) => !p);
      else if (e.key === "ArrowRight") jump(Math.min(beats.length - 1, idx + 1));
      else if (e.key === "ArrowLeft") jump(Math.max(0, idx - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, beats.length]);

  const sendInterject = () => {
    if (!interject.trim()) return;
    interjectRef.current = interject;
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
    setInterject("");
  };

  const onSave = () => {
    if (finalSession.current) {
      setSaved(saveSession(finalSession.current));
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
    }
  };

  const byId = useMemo(() => {
    const m = {};
    beats.slice(0, idx + 1).forEach((b) => (m[b.data.advisor] = b.data));
    return m;
  }, [beats, idx]);

  const activeId = beat?.data.advisor || null;
  const targetId = beat?.round === 2 ? beat.data.respondsTo : null;
  const waiting = atLastAvailable && !ended; // deliberating / synthesizing

  const status = !beat
    ? t(UI.boardRunning)
    : waiting
    ? (phase === "verdict" ? t(UI.synthesizing) : t(UI.deliberating))
    : beat.round === 2
    ? t(UI.round2)
    : t(UI.round1);

  return (
    <div className="panel-pad">
      <div className="debate-top">
        <h2 className="display debate-h2">{t(UI.debateTitle)}</h2>
        {ended && (
          <div className="debate-tools">
            <button className="ghost-btn" onClick={onSave}>
              <IconDeviceFloppy size={15} /> {savedTick ? t(UI.saved) : t(UI.save)}
            </button>
            <button
              className="ghost-btn"
              onClick={() => downloadSession(finalSession.current, t(decision).slice(0, 24))}
            >
              <IconDownload size={15} /> {t(UI.download)}
            </button>
          </div>
        )}
      </div>

      <div className="decision-recap">
        <IconQuote size={17} className="recap-icon" />
        <span>{t(decision)}</span>
        <span className="src-badge live">{t(UI.liveBadge)}</span>
      </div>

      <div className="round-banner">
        <span className="round-label">{status}</span>
        {waiting && <IconLoader2 size={14} className="spin" />}
        <span className="round-count">{Math.min(idx + 1, beats.length)} / {total}</span>
      </div>

      <BoardTable t={t} byId={byId} activeId={activeId} targetId={targetId} activeNum={beat ? idx + 1 : null} />

      <ActiveCard t={t} beat={beat} n={idx + 1} total={total} playing={playing && !waiting} dwell={dwell} />

      <Timeline t={t} beats={beats} idx={idx} onJump={jump} expected={total} />

      {phase === "error" ? (
        <p className="error-msg">{t(UI.apiError)}</p>
      ) : (
        <>
          {!ended && (
            <div className={"live-interject" + (flash ? " flash" : "")}>
              <input
                className="interject-input"
                value={interject}
                placeholder={flash ? t(UI.interjected) + " ✓" : t(UI.interjectPlaceholder)}
                onChange={(e) => setInterject(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendInterject(); }}
              />
              <button className="ctrl" onClick={sendInterject} disabled={!interject.trim()}>
                <IconSend size={15} /> {t(UI.send)}
              </button>
            </div>
          )}
          <Transport
            t={t}
            playing={playing}
            setPlaying={setPlaying}
            ended={ended}
            onVerdict={onVerdict}
          />
        </>
      )}
    </div>
  );
}

// ── Replay debate (canned / saved sessions) — same auto-flow ──────────────────
function ReplayDebate({ t, session, setSaved, onVerdict }) {
  const beats = useMemo(() => {
    const b = [];
    session.round1.forEach((d) => b.push({ round: 1, data: d }));
    session.round2.forEach((d) => b.push({ round: 2, data: d }));
    return b;
  }, [session]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => { setIdx(0); setPlaying(true); setEnded(false); }, [session]);

  const beat = beats[idx] || beats[0];
  const dwell = readingDwell(beat, t);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setIdx((s) => {
        if (s >= beats.length - 1) { setPlaying(false); setEnded(true); return s; }
        return s + 1;
      });
    }, dwell);
    return () => clearTimeout(id);
  }, [playing, idx, dwell, beats.length]);

  const jump = (i) => { setIdx(i); setPlaying(false); };
  const replay = () => { setIdx(0); setEnded(false); setPlaying(true); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "p") setPlaying((p) => !p);
      else if (e.key.toLowerCase() === "r") replay();
      else if (e.key === "ArrowRight") { setPlaying(false); setIdx((s) => Math.min(beats.length - 1, s + 1)); }
      else if (e.key === "ArrowLeft") { setPlaying(false); setIdx((s) => Math.max(0, s - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beats.length]);

  const onSave = () => {
    setSaved(saveSession(session));
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  };

  const byId = useMemo(() => {
    const m = {};
    beats.slice(0, idx + 1).forEach((b) => (m[b.data.advisor] = b.data));
    return m;
  }, [beats, idx]);

  const activeId = beat.data.advisor;
  const targetId = beat.round === 2 ? beat.data.respondsTo : null;

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
        </div>
      </div>

      <div className="decision-recap">
        <IconQuote size={17} className="recap-icon" />
        <span>{t(session.decision)}</span>
        <span className={"src-badge " + session.source}>
          {t(session.source === "live" ? UI.liveBadge : UI.demoBadge)}
        </span>
      </div>

      <div className="round-banner">
        <span className="round-label">{t(beat.round === 2 ? UI.round2 : UI.round1)}</span>
        <span className="round-count">{idx + 1} / {beats.length}</span>
      </div>

      <BoardTable t={t} byId={byId} activeId={activeId} targetId={targetId} activeNum={idx + 1} />

      <ActiveCard t={t} beat={beat} n={idx + 1} total={beats.length} playing={playing} dwell={dwell} />

      <Timeline t={t} beats={beats} idx={idx} onJump={jump} expected={beats.length} />

      <Transport
        t={t}
        playing={playing}
        setPlaying={setPlaying}
        onReplay={replay}
        ended={ended}
        onVerdict={onVerdict}
      />
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

  // each advisor's final perspective + conditions (what each lens requires)
  const finals = useMemo(() => {
    const m = {};
    session.round1.forEach((r) => (m[r.advisor] = r));
    session.round2.forEach((r) => (m[r.advisor] = r));
    return ADV_LIST.map((a) => ({ a, r: m[a.id] })).filter((x) => x.r);
  }, [session]);

  return (
    <div className="panel-pad">
      <div className="section-intro">
        <div className="eyebrow accent-legal">{t(UI.verdictEyebrow)}</div>
        <h2 className="display">{t(UI.verdictTitle)}</h2>
      </div>

      <div className="requires-title">{t(UI.whatEachRequires)}</div>
      <div className="requires-grid">
        {finals.map(({ a, r }) => (
          <div key={a.id} className="requires-cell" style={advVars(a)}>
            <div className="rc-head">
              <div className="rc-av">
                <AdvisorIcon name={a.icon} color={a.accent} size={22} />
              </div>
              <span className="rc-name">{t(a.name)}</span>
            </div>
            <p className="rc-perspective">{t(r.perspective)}</p>
            {r.conditions?.length > 0 && (
              <ul className="rc-conditions">
                {r.conditions.map((c, i) => (
                  <li key={i}><IconCheck size={12} /> {t(c)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
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
  const edges = useMemo(() => deriveTensions(session), [session]);
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
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={TENSION_COLOR[e.kind]}
                  strokeWidth={e.kind === "clash" ? 1.1 : e.kind === "tension" ? 0.7 : 0.8}
                  strokeLinecap="round"
                  opacity="0.9"
                />
              );
            })}
          </svg>
          {ADV_LIST.map((a) => {
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

        {/* the tensions, labelled */}
        <div className="tlist">
          {edges.filter((e) => e.kind !== "align" && e.over).map((e, i) => (
            <div key={i} className="tlist-item">
              <span
                className="tlist-dot"
                style={{ background: TENSION_COLOR[e.kind] }}
              />
              <b>{t(ADVISORS[e.a].name)} ↔ {t(ADVISORS[e.b].name)}</b>
              <span className="tlist-over">{t(e.over)}</span>
            </div>
          ))}
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
