// Session = one complete board meeting the UI plays through.
// Two sources share one normalized shape:
//   - "canned"  : the bundled bilingual demo (values are {en, ar} objects)
//   - "live"    : freshly generated via the API (values are plain strings)
// The t() helper in App handles both (string vs {en,ar}).

import { BOARD } from "../data/boardData.js";

export const API_BASE = "http://127.0.0.1:8000";
const STORE_KEY = "boardroom.sessions";

const VOTE_SIGN = { for: 1, against: -1, neutral: 0 };

// Pick who a round-2 rebuttal is aimed at: the round-1 advisor whose stance is
// most opposed to the speaker (backend round-2 has no explicit target).
function deriveTarget(speaker, round1) {
  const others = round1.filter((r) => r.advisor !== speaker.advisor);
  if (!others.length) return null;
  const mine = VOTE_SIGN[speaker.vote] ?? 0;
  // strongest opposite first; otherwise the first differing advisor
  const opposed = others
    .map((o) => ({ o, diff: Math.abs((VOTE_SIGN[o.vote] ?? 0) - mine) }))
    .sort((a, b) => b.diff - a.diff);
  return opposed[0].o.advisor;
}

// Tension edges between advisors, derived from their final (round-2) votes.
export function deriveTensions(round2) {
  const ids = round2.map((r) => r.advisor);
  const voteOf = Object.fromEntries(round2.map((r) => [r.advisor, r.vote]));
  const edges = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const sa = VOTE_SIGN[voteOf[a]] ?? 0;
      const sb = VOTE_SIGN[voteOf[b]] ?? 0;
      let kind = "tension";
      if (sa !== 0 && sb !== 0) kind = sa === sb ? "align" : "clash";
      edges.push({ a, b, kind });
    }
  }
  return edges;
}

// Normalize a raw API BoardResult into a session.
export function sessionFromApi(decision, result) {
  const round1 = result.round1_analyses.map((r) => ({
    advisor: r.advisor,
    vote: r.vote,
    rationale: r.rationale,
    reasoning: r.reasoning,
  }));
  const round2 = result.round2_rebuttals.map((r) => ({
    advisor: r.advisor,
    vote: r.vote,
    rationale: r.rationale,
    reasoning: r.reasoning,
    respondsTo: deriveTarget(r, round1),
  }));
  return {
    id: "s_" + Date.now(),
    source: "live",
    decision,
    round1,
    round2,
    verdict: {
      stance: result.verdict.stance || null,
      boardNote: result.verdict.board_note || "",
      recommendation: result.verdict.recommendation,
      confidence: result.verdict.confidence,
      conflicts: result.verdict.conflicts || [],
      nextSteps: result.verdict.next_steps || [],
    },
    createdAt: Date.now(),
  };
}

// The bundled demo as a session (authored respondsTo already present).
export function cannedSession() {
  return {
    id: "canned",
    source: "canned",
    decision: BOARD.decision,
    round1: BOARD.round1,
    round2: BOARD.round2,
    verdict: BOARD.verdict,
    createdAt: 0,
  };
}

// Ask the Chairman for discovery questions before the board convenes.
export async function runDiscover(decision, lang = "en") {
  const res = await fetch(`${API_BASE}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, lang }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.questions; // string[]
}

// Call the live API. `lang` ("en" | "ar") sets the language the board replies in.
// `context` is optional pre-session context built from discovery Q&A.
// `fast=true` skips Round 2 for ~2x speed.
export async function runLiveBoard(decision, lang = "en", context = "", fast = false) {
  const res = await fetch(`${API_BASE}/api/board`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, context, lang, fast }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return sessionFromApi(decision, data);
}

// Stream the board via SSE. Calls onR1/onR2/onVerdict as each arrives,
// then onDone(session) when complete. Returns a cancel() function.
export function streamBoard(decision, lang = "en", context = "", fast = false, callbacks = {}) {
  const ctrl = new AbortController();

  (async () => {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/board/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, context, lang, fast }),
        signal: ctrl.signal,
      });
    } catch {
      callbacks.onError?.();
      return;
    }
    if (!res.ok) { callbacks.onError?.(); return; }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const round1 = [], round2 = [];
    let verdict = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") {
            const session = sessionFromApi(decision, {
              round1_analyses: round1,
              round2_rebuttals: fast ? [] : round2,
              verdict,
            });
            callbacks.onDone?.(session);
            return;
          }
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "r1") { round1.push(ev.data); callbacks.onR1?.(ev.data); }
            else if (ev.type === "r2") { round2.push(ev.data); callbacks.onR2?.(ev.data); }
            else if (ev.type === "verdict") { verdict = ev.data; callbacks.onVerdict?.(); }
          } catch { /* malformed event, skip */ }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") callbacks.onError?.();
    }
  })();

  return () => ctrl.abort();
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
