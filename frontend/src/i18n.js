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

  // discovery phase
  discoverLoading: {
    en: "The chairman is preparing questions…",
    ar: "الرئيس يُعدّ الأسئلة…",
  },
  discoverTitle: {
    en: "Before we begin",
    ar: "قبل أن نبدأ",
  },
  discoverLede: {
    en: "The chairman wants a bit more context to sharpen the debate.",
    ar: "الرئيس يريد فهم السياق بشكل أعمق قبل انعقاد المجلس.",
  },
  discoverOptional: { en: "(optional)", ar: "(اختياري)" },
  discoverSkip: {
    en: "Skip — go straight to the debate",
    ar: "تخطَّ — انطلق للنقاش مباشرة",
  },
  discoverConvene: {
    en: "Convene with context",
    ar: "ابدأ الجلسة بالسياق",
  },
  boardRunning: {
    en: "The board is deliberating…",
    ar: "المجلس يتداول…",
  },
  fastMode: { en: "Fast mode (skip debate round)", ar: "وضع سريع (بدون جولة النقاش)" },
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
    en: "Each advisor reasons from a single perspective — and is built to push back on the others.",
    ar: "كل مستشار يحلّل من زاوية واحدة — ومصمّم ليعارض الآخرين.",
  },

  // debate
  debateTitle: { en: "The board debates", ar: "المجلس يتناقش" },
  round1: { en: "Round 1 · independent analysis", ar: "الجولة ١ · تحليل مستقل" },
  round2: { en: "Round 2 · the debate", ar: "الجولة ٢ · النقاش" },
  respondingTo: { en: "responding to", ar: "يرد على" },
  play: { en: "Play", ar: "تشغيل" },
  pause: { en: "Pause", ar: "إيقاف" },
  next: { en: "Next", ar: "التالي" },
  restart: { en: "Replay", ar: "إعادة" },
  toVerdict: { en: "See the verdict", ar: "اعرض القرار" },
  spaceHint: {
    en: "Space = next · P = play/pause · R = replay",
    ar: "مسافة = التالي · P = تشغيل/إيقاف · R = إعادة",
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
  boardSplit: { en: "Board vote", ar: "تصويت المجلس" },
  notVoteCount: {
    en: "The chairman weighs the arguments, not the vote count.",
    ar: "الرئيس يوازن الحجج، لا عدد الأصوات.",
  },
  voteCount: {
    for: { en: "for", ar: "مع" },
    against: { en: "against", ar: "ضد" },
    neutral: { en: "neutral", ar: "محايد" },
  },

  // tension
  tensionEyebrow: { en: "Where they clash", ar: "أين يختلفون" },
  tensionTitle: { en: "The tension map", ar: "خريطة الخلافات" },
  tensionLede: {
    en: "Good decisions come from disagreement. Here's who's pulling against whom.",
    ar: "القرارات الجيدة تأتي من الاختلاف. هذا من يشدّ ضد من.",
  },
  legClash: { en: "Strong disagreement", ar: "خلاف قوي" },
  legTension: { en: "Partial tension", ar: "توتر جزئي" },
  legAlign: { en: "Alignment", ar: "توافق" },

  votes: {
    for: { en: "FOR", ar: "مع" },
    against: { en: "AGAINST", ar: "ضد" },
    neutral: { en: "NEUTRAL", ar: "محايد" },
  },
  voteWord: {
    for: { en: "For", ar: "مع" },
    against: { en: "Against", ar: "ضد" },
    neutral: { en: "Neutral", ar: "محايد" },
  },

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
