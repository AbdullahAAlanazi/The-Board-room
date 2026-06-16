import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADVISORS } from "./data/boardData.js";
import { UI, EXAMPLES } from "./i18n.js";
import { AdvisorIcon } from "./components/Icons.jsx";
import {
  cannedSession,
  runDiscover,
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

const HOLD_MS = 5000; // replay auto-advance dwell per speaker

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
// phase: "input" → "discovering" → "chat"
function Convene({ t, lang, saved, setSaved, onReplay, onLive }) {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState("input");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]); // {q, a}
  const [qIdx, setQIdx] = useState(0);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
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
      const qs = await runDiscover(q, lang);
      setQuestions(qs.length ? qs : []);
      setAnswers([]);
      setQIdx(0);
      setPhase(qs.length ? "chat" : "input");
      if (!qs.length) onLive(q, "");
    } catch {
      // Discovery unavailable — go straight to the live board.
      onLive(q, "");
      setPhase("input");
    }
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
          {phase === "chat" ? (
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
function BoardTable({ t, byId, activeId, targetId }) {
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
        <IconGavel size={26} />
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
              <AdvisorIcon name={a.icon} color={a.accent} size={26} />
            </div>
            <span className="bt-seat-name">{t(a.name)}</span>
            {isTarget && <span className="bt-target-tag">⟵</span>}
          </div>
        );
      })}
    </div>
  );
}

// The enlarged active speaker, shown under the table.
function SpeakerStage({ t, advisorId, resp, thinking }) {
  const a = advisorId ? ADVISORS[advisorId] : null;
  if (!a) {
    return (
      <div className="stage empty">
        <div className="typing-dots"><span /><span /><span /></div>
        <span className="stage-thinking">{t(UI.boardRunning)}</span>
      </div>
    );
  }
  const target = resp?.respondsTo ? ADVISORS[resp.respondsTo] : null;
  const outOfScope = resp && resp.relevant === false;
  return (
    <div className="stage" style={advVars(a)} key={advisorId + (resp ? "1" : "0")}>
      <div className="stage-head">
        <div className="stage-av">
          <AdvisorIcon name={a.icon} color={a.accent} size={26} />
        </div>
        <div className="stage-meta">
          <span className="stage-name">{t(a.name)}</span>
          <span className="stage-role">{t(a.role)}</span>
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

      {thinking ? (
        <div className="typing-dots stage-dots"><span /><span /><span /></div>
      ) : outOfScope ? (
        <p className="stage-perspective out">
          <span className="oos-tag">{t(UI.outOfScope)}</span> {t(resp.perspective)}
        </p>
      ) : (
        <>
          <p className="stage-perspective display">{t(resp.perspective)}</p>
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
          {resp.reasoning && <p className="stage-reasoning">{t(resp.reasoning)}</p>}
        </>
      )}
    </div>
  );
}

function InterjectionBar({ t, value, setValue, onContinue, continueLabel }) {
  return (
    <div className="interject">
      <div className="interject-row">
        <input
          className="interject-input"
          value={value}
          placeholder={t(UI.interjectPlaceholder)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onContinue(); }}
        />
        <button className="ctrl primary" onClick={onContinue}>
          {continueLabel} <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Live debate (round by round, interruptible) ───────────────────────────────
function LiveDebate({ t, lang, decision, baseContext, onSessionReady, setSaved, onVerdict }) {
  // phase: r1 | r1pause | r2 | r2pause | verdict | done | error
  const [phase, setPhase] = useState("r1");
  const [round1, setRound1] = useState([]);
  const [round2, setRound2] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [interject, setInterject] = useState("");
  const [savedTick, setSavedTick] = useState(false);
  const contextRef = useRef(baseContext || "");
  const cancelRef = useRef(null);
  const finalSession = useRef(null);

  const round = phase === "r2" || phase === "r2pause" ? 2 : 1;
  const byId = useMemo(() => {
    const m = {};
    round1.forEach((r) => (m[r.advisor] = r));
    if (round >= 2) round2.forEach((r) => (m[r.advisor] = r));
    return m;
  }, [round1, round2, round]);

  const activeResp = activeId ? byId[activeId] : null;
  const targetId = round >= 2 && activeResp?.respondsTo ? activeResp.respondsTo : null;

  // kick off round 1 on mount
  useEffect(() => {
    cancelRef.current = streamRound(decision, lang, contextRef.current, 1, [], {
      onAdvisor: (a) => {
        setRound1((prev) => [...prev, a]);
        setActiveId(a.advisor);
      },
      onDone: () => setPhase("r1pause"),
      onError: () => setPhase("error"),
    });
    return () => cancelRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goRound2 = () => {
    if (interject.trim()) {
      contextRef.current += `\n\n[Board chair adds]: ${interject.trim()}`;
      setInterject("");
    }
    setPhase("r2");
    setActiveId(null);
    cancelRef.current = streamRound(decision, lang, contextRef.current, 2, round1, {
      onAdvisor: (a) => {
        setRound2((prev) => [...prev, a]);
        setActiveId(a.advisor);
      },
      onDone: () => setPhase("r2pause"),
      onError: () => setPhase("error"),
    });
  };

  const goVerdict = async () => {
    if (interject.trim()) {
      contextRef.current += `\n\n[Board chair adds]: ${interject.trim()}`;
      setInterject("");
    }
    setPhase("verdict");
    try {
      const v = await runVerdict(decision, lang, contextRef.current, round1, round2);
      setVerdict(v);
      const sess = buildLiveSession(decision, round1, round2, v);
      finalSession.current = sess;
      onSessionReady(sess);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  };

  const onSave = () => {
    if (finalSession.current) {
      setSaved(saveSession(finalSession.current));
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
    }
  };

  const roundLabel =
    round === 2 ? t(UI.round2) : t(UI.round1);
  const streaming = phase === "r1" || phase === "r2";

  return (
    <div className="panel-pad">
      <div className="debate-top">
        <h2 className="display debate-h2">{t(UI.debateTitle)}</h2>
        {phase === "done" && (
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
        <span className="round-label">{roundLabel}</span>
        {streaming && <IconLoader2 size={14} className="spin" />}
      </div>

      <BoardTable t={t} byId={byId} activeId={activeId} targetId={targetId} />

      <SpeakerStage
        t={t}
        advisorId={activeId}
        resp={activeResp}
        thinking={false}
      />

      {/* controls / interjection */}
      {phase === "r1pause" && (
        <InterjectionBar
          t={t}
          value={interject}
          setValue={setInterject}
          onContinue={goRound2}
          continueLabel={t(UI.round2)}
        />
      )}
      {phase === "r2pause" && (
        <InterjectionBar
          t={t}
          value={interject}
          setValue={setInterject}
          onContinue={goVerdict}
          continueLabel={t(UI.toVerdict)}
        />
      )}
      {phase === "verdict" && (
        <div className="discover-loading">
          <IconLoader2 size={18} className="spin" />
          <span>{t(UI.boardRunning)}</span>
        </div>
      )}
      {phase === "done" && (
        <div className="controls">
          <button className="ctrl accent" onClick={onVerdict}>
            {t(UI.toVerdict)} <IconArrowRight size={16} />
          </button>
        </div>
      )}
      {phase === "error" && <p className="error-msg">{t(UI.apiError)}</p>}

      {streaming && (
        <p className="interject-hint">{t(UI.interjectLabel)} ↓ {t(UI.thinking)}</p>
      )}
    </div>
  );
}

// ── Replay debate (canned / saved sessions) ───────────────────────────────────
function ReplayDebate({ t, session, setSaved, onVerdict }) {
  const beats = useMemo(() => {
    const b = [];
    session.round1.forEach((d) => b.push({ round: 1, data: d }));
    session.round2.forEach((d) => b.push({ round: 2, data: d }));
    return b;
  }, [session]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [session]);

  const beat = beats[step] || beats[0];
  const isLast = step >= beats.length - 1;

  const next = useCallback(() => {
    setStep((s) => {
      if (s >= beats.length - 1) { setPlaying(false); return s; }
      return s + 1;
    });
  }, [beats.length]);

  const restart = useCallback(() => { setStep(0); setPlaying(false); }, []);

  useEffect(() => {
    if (!playing) return;
    if (isLast) { setPlaying(false); return; }
    const id = setTimeout(next, HOLD_MS);
    return () => clearTimeout(id);
  }, [playing, step, isLast, next]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); next(); }
      else if (e.key.toLowerCase() === "p") setPlaying((p) => !p);
      else if (e.key.toLowerCase() === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, restart]);

  const onSave = () => {
    setSaved(saveSession(session));
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  };

  // advisors revealed up to current step (for the table)
  const byId = useMemo(() => {
    const m = {};
    beats.slice(0, step + 1).forEach((b) => (m[b.data.advisor] = b.data));
    return m;
  }, [beats, step]);

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

      <div className="round-banner">
        <span className="round-label">
          {t(beat.round === 2 ? UI.round2 : UI.round1)}
        </span>
        <span className="round-count">{step + 1} / {beats.length}</span>
      </div>

      <BoardTable t={t} byId={byId} activeId={activeId} targetId={targetId} />

      <SpeakerStage t={t} advisorId={activeId} resp={beat.data} thinking={false} />

      <div className="controls">
        <button className="ctrl primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <IconPlayerPauseFilled size={17} /> : <IconPlayerPlayFilled size={17} />}
          {playing ? t(UI.pause) : t(UI.play)}
        </button>
        <button className="ctrl" onClick={next} disabled={isLast}>
          {t(UI.next)} <IconPlayerTrackNextFilled size={15} />
        </button>
        {isLast && (
          <button className="ctrl accent" onClick={onVerdict}>
            {t(UI.toVerdict)} <IconArrowRight size={16} />
          </button>
        )}
        <span className="space-hint">{t(UI.spaceHint)}</span>
      </div>
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
