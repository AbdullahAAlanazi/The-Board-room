// UI chrome strings (separate from board content, which lives in boardData.js).
export const UI = {
  brand: { en: "Boardroom", ar: "مجلس المستشارين" },
  // tabs
  tabConvene: { en: "Convene", ar: "ابدأ" },
  tabAdvisors: { en: "Advisors", ar: "المستشارون" },
  tabDebate: { en: "Debate", ar: "النقاش" },
  tabVerdict: { en: "Verdict", ar: "القرار" },
  tabTension: { en: "Tensions", ar: "الخلافات" },

  // convene / hero
  heroEyebrow: { en: "A decision worth debating", ar: "قرار يستحق النقاش" },
  heroTitle1: { en: "Every leader deserves", ar: "كل قائد يستحق" },
  heroTitleEm: { en: "a board.", ar: "مجلساً." },
  heroLede: {
    en: "Describe a business decision. Three AI advisors analyze it, argue it out, and hand you a clear recommendation.",
    ar: "صف قراراً تجارياً. ثلاثة مستشارين بالذكاء الاصطناعي يحلّلونه ويتناقشون فيه ويسلّمونك توصية واضحة.",
  },
  decisionLabel: { en: "The decision on the table", ar: "القرار المطروح" },
  examples: { en: "Try an example", ar: "جرّب مثالاً" },
  convene: { en: "Convene the board", ar: "ابدأ الجلسة" },
  questionPlaceholder: {
    en: "Type your own business decision…",
    ar: "اكتب قرارك التجاري الخاص…",
  },
  runDemo: { en: "Play the demo", ar: "شغّل العرض الجاهز" },
  runLive: { en: "Ask the board (live)", ar: "اسأل المجلس (حي)" },
  generating: { en: "The board is deliberating…", ar: "المجلس يتداول…" },
  liveHint: {
    en: "Live answers take ~30s and need the API server running.",
    ar: "الرد الحي يأخذ ~٣٠ ثانية ويحتاج تشغيل سيرفر الـAPI.",
  },

  // discovery chat
  discoverLoading: {
    en: "The chairman is preparing questions…",
    ar: "الرئيس يُعدّ الأسئلة…",
  },
  discoverIntro: {
    en: "Before I convene the board, let me understand the situation a little better.",
    ar: "قبل أن أعقد الجلسة، دعني أفهم الموقف بشكل أوضح.",
  },
  chairman: { en: "Chairman", ar: "رئيس المجلس" },
  answerPlaceholder: { en: "Type your answer…", ar: "اكتب إجابتك…" },
  send: { en: "Send", ar: "إرسال" },
  discoverSkip: { en: "Skip the rest", ar: "تخطَّ الباقي" },
  discoverStart: { en: "Convene the board", ar: "اعقد الجلسة" },
  // intake — direct answer to a question
  suggestedDecision: { en: "A decision worth bringing to the board", ar: "قرار يستحق عرضه على المجلس" },
  convOnSuggested: { en: "Convene the board on this", ar: "اعقد الجلسة على هذا" },
  askAnother: { en: "Ask something else", ar: "اسأل شيئاً آخر" },
  boardRunning: {
    en: "The board is deliberating…",
    ar: "المجلس يتداول…",
  },
  apiError: {
    en: "Couldn't reach the live board API. Is the server running on :8000?",
    ar: "تعذّر الوصول لسيرفر الـAPI. هل السيرفر شغّال على :8000؟",
  },
  liveBadge: { en: "live", ar: "حي" },
  demoBadge: { en: "demo", ar: "عرض" },

  // saved sessions
  savedTitle: { en: "Saved conversations", ar: "المحادثات المحفوظة" },
  noSaved: { en: "No saved conversations yet.", ar: "لا توجد محادثات محفوظة بعد." },
  load: { en: "Load", ar: "تشغيل" },
  importFile: { en: "Import file", ar: "استيراد ملف" },
  save: { en: "Save", ar: "حفظ" },
  saved: { en: "Saved ✓", ar: "تم الحفظ ✓" },
  download: { en: "Download", ar: "تنزيل" },
  deleteWord: { en: "Delete", ar: "حذف" },
  rebutted: { en: "rebutted", ar: "مُعترَض عليه" },

  // advisors intro
  advEyebrow: { en: "Three lenses, three agendas", ar: "ثلاث زوايا، ثلاث أولويات" },
  advTitle: { en: "Meet your board", ar: "تعرّف على مجلسك" },
  advLede: {
    en: "Each advisor reasons from a single lens — and contributes where it genuinely applies.",
    ar: "كل مستشار يحلّل من زاوية واحدة — ويساهم حيث ينطبق اختصاصه فعلاً.",
  },

  // debate
  debateTitle: { en: "The board convenes", ar: "المجلس ينعقد" },
  round1: { en: "Round 1 · independent perspectives", ar: "الجولة ١ · منظورات مستقلة" },
  round2: { en: "Round 2 · the debate", ar: "الجولة ٢ · النقاش" },
  respondingTo: { en: "responding to", ar: "يرد على" },
  conditionsLabel: { en: "Conditions", ar: "الشروط" },
  recommendsLabel: { en: "Recommends", ar: "التوصيات" },
  outOfScope: { en: "outside this lens", ar: "خارج هذه الزاوية" },
  speakingNow: { en: "speaking", ar: "يتحدّث" },
  round1Short: { en: "Round 1", ar: "الجولة ١" },
  round2Short: { en: "Round 2", ar: "الجولة ٢" },
  deliberating: { en: "The board is deliberating…", ar: "المجلس يتداول…" },
  synthesizing: { en: "The chairman is synthesizing…", ar: "الرئيس يصوغ القرار…" },
  play: { en: "Play", ar: "تشغيل" },
  pause: { en: "Pause", ar: "إيقاف" },
  next: { en: "Next", ar: "التالي" },
  restart: { en: "Replay", ar: "إعادة" },
  toVerdict: { en: "See the verdict", ar: "اعرض القرار" },
  continueWord: { en: "Continue", ar: "متابعة" },
  thinking: { en: "deliberating…", ar: "يتداول…" },
  // interjection
  interjectLabel: { en: "Add context to the board", ar: "أضف سياقاً للمجلس" },
  interjectPlaceholder: {
    en: "Interject — add a constraint, a fact, a question…",
    ar: "قاطِع — أضف قيداً أو معلومة أو سؤالاً…",
  },
  interjected: { en: "you added context", ar: "أضفت سياقاً" },
  spaceHint: {
    en: "Auto-playing · P = pause/play · ←/→ review · R = replay",
    ar: "تشغيل تلقائي · P = إيقاف/تشغيل · ←/→ مراجعة · R = إعادة",
  },

  // verdict
  verdictEyebrow: { en: "The chairman rules", ar: "الرئيس يحكم" },
  verdictTitle: { en: "The final call", ar: "القرار النهائي" },
  chairmanRec: { en: "Chairman's recommendation", ar: "توصية الرئيس" },
  confidence: { en: "Confidence", ar: "نسبة الثقة" },
  nextSteps: { en: "Recommended next steps", ar: "الخطوات الموصى بها" },
  finalCall: { en: "Final call", ar: "القرار" },
  stance: {
    proceed: { en: "Proceed", ar: "نفّذ" },
    against: { en: "Do not proceed", ar: "لا تنفّذ" },
    conditional: { en: "Proceed — conditional", ar: "نفّذ — بشروط" },
  },
  whatEachRequires: {
    en: "What each lens requires",
    ar: "ما يتطلّبه كل منظور",
  },

  // tension
  tensionEyebrow: { en: "Where they clash", ar: "أين يختلفون" },
  tensionTitle: { en: "The tension map", ar: "خريطة الخلافات" },
  tensionLede: {
    en: "Good decisions come from productive tension. Here's where the lenses pull against each other.",
    ar: "القرارات الجيدة تأتي من التوتر البنّاء. هنا حيث تتجاذب الزوايا.",
  },
  legClash: { en: "Strong tension", ar: "توتر قوي" },
  legTension: { en: "Mild tension", ar: "توتر خفيف" },
  legAlign: { en: "Alignment", ar: "توافق" },

  langToggle: { en: "العربية", ar: "English" },
  footer: { en: "AI BOARD ROOM · Hackathon 2026", ar: "AI BOARD ROOM · هاكاثون ٢٠٢٦" },
};

export const EXAMPLES = [
  {
    chip: { en: "Open a Jeddah branch?", ar: "نفتح فرعاً في جدة؟" },
    full: {
      en: "Should we open a new branch in Jeddah to capture the Western Region market?",
      ar: "هل نفتح فرعاً جديداً في جدة لاقتناص سوق المنطقة الغربية؟",
    },
  },
  {
    chip: { en: "Launch a subscription?", ar: "نطلق اشتراكاً؟" },
    full: {
      en: "Should we launch a monthly subscription tier?",
      ar: "هل نطلق باقة اشتراك شهري؟",
    },
  },
  {
    chip: { en: "Cut prices 20%?", ar: "نخفّض الأسعار ٢٠٪؟" },
    full: {
      en: "Should we cut prices 20% to fight a new competitor?",
      ar: "هل نخفّض الأسعار ٢٠٪ لمواجهة منافس جديد؟",
    },
  },
];
