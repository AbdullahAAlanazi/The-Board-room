// Session = one complete board meeting the UI plays through.
// Two sources share one normalized shape:
//   - "canned"  : the bundled bilingual demo (values are {en, ar} objects)
//   - "live"    : freshly generated via the API (values are plain strings)
// The t() helper in App handles both (string vs {en,ar}).
//
// Live runs are driven ROUND BY ROUND so the user can inject context between
// rounds:  streamRound(1) → [interject] → streamRound(2) → [interject] → runVerdict.

import { BOARD } from "../data/boardData.js";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const STORE_KEY = "boardroom.sessions";

// ── normalizers (snake_case API → camelCase session shape) ───────────────────
function normAdvisor(r) {
  return {
    advisor: r.advisor,
    relevant: r.relevant !== false,
    perspective: r.perspective ?? "",
    conditions: r.conditions || [],
    recommendations: r.recommendations || [],
    reasoning: r.reasoning ?? "",
    respondsTo: r.responds_to ?? r.respondsTo ?? null,
  };
}

function normVerdict(v) {
  return {
    stance: v.stance || null,
    boardNote: v.board_note ?? v.boardNote ?? "",
    recommendation: v.recommendation ?? "",
    confidence: v.confidence ?? 0,
    conflicts: v.conflicts || [],
    tensions: v.tensions || [],
    nextSteps: v.next_steps ?? v.nextSteps ?? [],
  };
}

// Tension-map edges: every advisor pair, marked from the chairman's tensions.
// Pairs the chairman didn't flag are treated as alignment.
export function deriveTensions(session) {
  const ids = (session.round2?.length ? session.round2 : session.round1).map(
    (r) => r.advisor
  );
  const flagged = {};
  (session.verdict?.tensions || []).forEach((tn) => {
    const [a, b] = tn.between || [];
    if (!a || !b) return;
    flagged[[a, b].sort().join("|")] = {
      kind: tn.severity === "high" ? "clash" : "tension",
      over: tn.over,
    };
  });
  const edges = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = [ids[i], ids[j]].sort().join("|");
      const hit = flagged[key];
      edges.push({ a: ids[i], b: ids[j], kind: hit?.kind || "align", over: hit?.over });
    }
  }
  return edges;
}

// The bundled demo as a session (authored respondsTo / tensions already present).
export function cannedSession() {
  return {
    id: "canned",
    source: "canned",
    decision: BOARD.decision,
    round1: BOARD.round1.map(normAdvisor),
    round2: BOARD.round2.map(normAdvisor),
    verdict: normVerdict({
      stance: BOARD.verdict.stance,
      board_note: BOARD.verdict.boardNote,
      recommendation: BOARD.verdict.recommendation,
      confidence: BOARD.verdict.confidence,
      conflicts: BOARD.verdict.conflicts,
      tensions: BOARD.verdict.tensions,
      next_steps: BOARD.verdict.nextSteps,
    }),
    createdAt: 0,
  };
}

// Assemble a finished live session from its parts (for replay / save).
export function buildLiveSession(decision, round1, round2, verdict) {
  return {
    id: "s_" + Date.now(),
    source: "live",
    decision,
    round1: round1.map(normAdvisor),
    round2: round2.map(normAdvisor),
    verdict: normVerdict(verdict),
    createdAt: Date.now(),
  };
}

// ── live API ─────────────────────────────────────────────────────────────────
// First read of the user's input: a question to answer, or a decision to debate.
export async function runIntake(decision, lang = "en") {
  const res = await fetch(`${API_BASE}/api/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, lang }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const d = await res.json();
  return {
    kind: d.kind === "question" ? "question" : "decision",
    answer: d.answer || "",
    suggestedDecision: d.suggested_decision || "",
    questions: d.questions || [],
  };
}

// Run one round (plain JSON — robust behind managed-host proxies; no SSE).
// Keeps the streaming callback shape: onAdvisor(normalized) per advisor, then
// onDone(allAdvisors[]). Returns a cancel() function.
export function streamRound(decision, lang, context, round, prior, callbacks = {}) {
  const ctrl = new AbortController();
  let aborted = false;

  (async () => {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          context,
          lang,
          round,
          prior: (prior || []).map((r) => ({
            advisor: r.advisor,
            relevant: r.relevant,
            perspective: r.perspective,
            conditions: r.conditions,
            recommendations: r.recommendations,
            reasoning: r.reasoning,
            responds_to: r.respondsTo ?? null,
          })),
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e.name !== "AbortError") callbacks.onError?.();
      return;
    }
    if (!res.ok) { callbacks.onError?.(); return; }

    let data;
    try {
      data = await res.json();
    } catch {
      callbacks.onError?.();
      return;
    }
    const list = (Array.isArray(data) ? data : data.advisors || []).map(normAdvisor);
    for (const a of list) {
      if (aborted) return;
      callbacks.onAdvisor?.(a);
    }
    callbacks.onDone?.(list);
  })();

  return () => { aborted = true; ctrl.abort(); };
}

export async function runVerdict(decision, lang, context, round1, round2) {
  const pack = (r) => ({
    advisor: r.advisor,
    relevant: r.relevant,
    perspective: r.perspective,
    conditions: r.conditions,
    recommendations: r.recommendations,
    reasoning: r.reasoning,
    responds_to: r.respondsTo ?? null,
  });
  const res = await fetch(`${API_BASE}/api/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision,
      context,
      lang,
      round1: round1.map(pack),
      round2: round2.map(pack),
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return normVerdict(await res.json());
}

// ── persistence ────────────────────────────────────────────────────────────
export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveSession(session) {
  const all = loadSaved().filter((s) => s.id !== session.id);
  all.unshift(session);
  localStorage.setItem(STORE_KEY, JSON.stringify(all.slice(0, 20)));
  return all;
}

export function deleteSaved(id) {
  const all = loadSaved().filter((s) => s.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(all));
  return all;
}

export function downloadSession(session, label) {
  const blob = new Blob([JSON.stringify(session, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `boardroom-${label || session.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readSessionFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s.round1 || !s.round2 || !s.verdict)
          throw new Error("not a board session");
        resolve(s);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
