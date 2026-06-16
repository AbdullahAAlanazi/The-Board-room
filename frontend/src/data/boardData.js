// Bundled bilingual demo for offline "Play the demo". Shape matches the live
// API: each advisor contributes a perspective + conditions + recommendations
// (no votes), round-2 entries name who they respond to, and the verdict carries
// the chairman's pairwise tensions (which power the tension map).

// Colors adopted from the warm "editorial" mockup.
export const ADVISORS = {
  CFO: {
    id: "CFO",
    accent: "#1f5fa8", // blue
    accentSoft: "#e7f0fa",
    accentDeep: "#0c4178",
    name: { en: "CFO", ar: "المدير المالي" },
    role: { en: "chief financial officer", ar: "المدير المالي · الأرقام أولاً" },
    tag: { en: "the numbers", ar: "زاوية الأرقام" },
    icon: "chart",
    quote: {
      en: "Show me the 12-month return and the runway it needs.",
      ar: "أرني العائد خلال ١٢ شهراً والسيولة التي يتطلبها.",
    },
    traits: {
      en: ["Rigorous", "Clear-eyed", "Disciplined"],
      ar: ["دقيق", "واضح الرؤية", "منضبط"],
    },
  },
  Legal: {
    id: "Legal",
    accent: "#0f7a5e", // green
    accentSoft: "#e4f2ec",
    accentDeep: "#0a4f3d",
    name: { en: "Legal", ar: "المستشار القانوني" },
    role: { en: "chief legal officer · ksa", ar: "المستشار القانوني · السعودية" },
    tag: { en: "the guardrails", ar: "زاوية الضوابط" },
    icon: "scale",
    quote: {
      en: "Here's what we put in place first — then we're clear to move.",
      ar: "هذا ما نجهّزه أولاً — بعدها الطريق سالك.",
    },
    traits: {
      en: ["Precise", "Thorough", "Practical"],
      ar: ["دقيق", "شامل", "عملي"],
    },
  },
  Market: {
    id: "Market",
    accent: "#6f4bce", // purple
    accentSoft: "#eee9fa",
    accentDeep: "#3f3597",
    name: { en: "Market", ar: "مستشار السوق" },
    role: { en: "saudi market strategist", ar: "استراتيجي السوق السعودي" },
    tag: { en: "the timing", ar: "زاوية التوقيت" },
    icon: "trending",
    quote: {
      en: "What are competitors doing, and does the timing fit the Saudi customer?",
      ar: "ماذا يفعل المنافسون، وهل التوقيت يناسب العميل السعودي؟",
    },
    traits: {
      en: ["Informed", "Forward-looking", "Customer-first"],
      ar: ["مطّلع", "استشرافي", "العميل أولاً"],
    },
  },
};

export const BOARD = {
  decision: {
    en: "Should we open a new branch in Jeddah to capture the Western Region market?",
    ar: "هل نفتح فرعاً جديداً في جدة لاقتناص سوق المنطقة الغربية؟",
  },

  round1: [
    {
      advisor: "CFO",
      perspective: {
        en: "A Jeddah branch can pay off — but only if the unit economics clear a 12-month payback before we commit capital.",
        ar: "فرع جدة قد يكون مربحاً — لكن فقط إذا حقّقت الأرقام استرداداً خلال ١٢ شهراً قبل أن نلتزم برأس المال.",
      },
      conditions: [
        { en: "A 12-month payback is modeled and met before fit-out", ar: "نمذجة استرداد خلال ١٢ شهراً واستيفاؤه قبل التجهيز" },
        { en: "We keep at least 6 months of cash runway intact", ar: "الإبقاء على سيولة تكفي ٦ أشهر على الأقل" },
      ],
      recommendations: [
        { en: "Build a bottom-up revenue model for the Western Region", ar: "بناء نموذج إيرادات تصاعدي للمنطقة الغربية" },
        { en: "Phase the capex — pilot before a full fit-out", ar: "تقسيم الإنفاق الرأسمالي — تجربة قبل التجهيز الكامل" },
      ],
      reasoning: {
        en: "The opportunity is real, but so are the upfront costs — real estate, staffing, marketing. I want a bottom-up revenue model, not a top-down hope. If the numbers show a payback inside 12 months while keeping our runway safe, I'm comfortable. The smart path is to phase the spend so a slow start doesn't threaten the wider business.",
        ar: "الفرصة حقيقية، لكن التكاليف المبدئية حقيقية أيضاً — عقارات وتوظيف وتسويق. أريد نموذج إيرادات تصاعدياً لا تمنّياً من الأعلى. إذا أظهرت الأرقام استرداداً خلال ١٢ شهراً مع الحفاظ على سيولتنا، فأنا مرتاح. المسار الذكي هو تقسيم الإنفاق حتى لا تهدّد بداية بطيئة بقية الأعمال.",
      },
    },
    {
      advisor: "Legal",
      perspective: {
        en: "Legally this is straightforward — it just needs the right registrations in place before we open the doors.",
        ar: "قانونياً الأمر مباشر — يحتاج فقط إلى التسجيلات الصحيحة قبل أن نفتح الأبواب.",
      },
      conditions: [
        { en: "A separate Commercial Registration (CR) for the Jeddah branch", ar: "سجل تجاري منفصل لفرع جدة" },
        { en: "A new municipal license (رخصة بلدية) — 2–4 weeks", ar: "رخصة بلدية جديدة — ٢–٤ أسابيع" },
        { en: "The lease registered on the Ejar platform", ar: "تسجيل عقد الإيجار على منصة إيجار" },
        { en: "Written, notarized contracts — no verbal agreements", ar: "عقود مكتوبة وموثّقة — لا اتفاقات شفهية" },
      ],
      recommendations: [
        { en: "Start the CR and municipal license process now, in parallel", ar: "بدء إجراءات السجل التجاري والرخصة البلدية الآن بالتوازي" },
        { en: "Add an SCCA arbitration clause to the lease", ar: "إضافة بند تحكيم (SCCA) إلى عقد الإيجار" },
      ],
      reasoning: {
        en: "None of this is a blocker — it's a checklist. A branch in a new city needs its own CR and municipal license, and the lease must be on Ejar to be enforceable. The only real risk is doing it informally under time pressure, so let's start the paperwork now in parallel with planning. Done in the right order, compliance never becomes the bottleneck.",
        ar: "لا شيء من هذا مانع — إنه قائمة تحقّق. الفرع في مدينة جديدة يحتاج سجله التجاري ورخصته البلدية، وعقد الإيجار يجب أن يكون على إيجار ليكون نافذاً. الخطر الوحيد هو القيام بذلك بشكل غير رسمي تحت ضغط الوقت، فلنبدأ الأوراق الآن بالتوازي مع التخطيط. بالترتيب الصحيح، لا يصبح الامتثال عنق الزجاجة أبداً.",
      },
    },
    {
      advisor: "Market",
      perspective: {
        en: "Jeddah is a strong growth market, and the timing window favors moving before competitors lock it in.",
        ar: "جدة سوق نمو قوي، ونافذة التوقيت تميل لصالح التحرّك قبل أن يثبّت المنافسون حضورهم.",
      },
      conditions: [
        { en: "The launch is positioned around the Ramadan/Eid spending peak", ar: "توجيه الإطلاق نحو ذروة الإنفاق في رمضان والعيد" },
        { en: "A mobile-first storefront is ready at open", ar: "جاهزية واجهة بيع تعتمد الجوّال عند الافتتاح" },
      ],
      recommendations: [
        { en: "Scout competitor locations across the Western Region first", ar: "استطلاع مواقع المنافسين في المنطقة الغربية أولاً" },
        { en: "Anchor the launch campaign to the seasonal peak", ar: "ربط حملة الإطلاق بالذروة الموسمية" },
      ],
      reasoning: {
        en: "Jeddah is the gateway to the Western Region — diverse, commercial, and mobile-first. Competitors are already moving, so timing matters: an opening aligned with the Ramadan and Eid peaks captures the spending surge instead of chasing it. This isn't about rushing; it's about sequencing the launch to when the Saudi customer is actually buying.",
        ar: "جدة بوابة المنطقة الغربية — متنوّعة وتجارية وتعتمد الجوّال. المنافسون يتحركون فعلاً، لذا التوقيت مهم: افتتاح يتزامن مع ذروة رمضان والعيد يقتنص موجة الإنفاق بدل مطاردتها. الأمر ليس تسرّعاً؛ بل ترتيب الإطلاق ليوافق اللحظة التي يشتري فيها العميل السعودي فعلاً.",
      },
    },
  ],

  round2: [
    {
      advisor: "Market",
      respondsTo: "CFO",
      perspective: {
        en: "Building on the CFO's payback point — the seasonal peak is exactly what makes the 12-month math work.",
        ar: "بناءً على نقطة الاسترداد لدى المدير المالي — الذروة الموسمية هي بالضبط ما يجعل حساب الـ١٢ شهراً ينجح.",
      },
      conditions: [
        { en: "The branch opens before the first Ramadan peak after launch", ar: "افتتاح الفرع قبل أول ذروة رمضان بعد الإطلاق" },
      ],
      recommendations: [
        { en: "Feed the seasonal uplift directly into the CFO's revenue model", ar: "إدخال الارتفاع الموسمي مباشرة في نموذج الإيرادات لدى المدير المالي" },
      ],
      reasoning: {
        en: "The CFO wants a payback inside 12 months — I'd argue the seasonal peak is how we get there, not a reason to wait. If we open ahead of Ramadan, the first spending surge front-loads revenue into that window. So let's not treat timing and finance as opposed; the timing is the financial case.",
        ar: "المدير المالي يريد استرداداً خلال ١٢ شهراً — وأرى أن الذروة الموسمية هي طريقنا لذلك، لا سبباً للانتظار. إذا افتتحنا قبل رمضان، فإن أول موجة إنفاق تقدّم الإيرادات إلى داخل تلك النافذة. فلا نتعامل مع التوقيت والمال كأنهما متضادان؛ التوقيت هو الدراسة المالية نفسها.",
      },
    },
    {
      advisor: "CFO",
      respondsTo: "Market",
      perspective: {
        en: "I can get behind Market's timing — provided the seasonal uplift is modeled with real data, not assumed.",
        ar: "أستطيع دعم توقيت مستشار السوق — بشرط أن يُنمذَج الارتفاع الموسمي ببيانات حقيقية لا بالافتراض.",
      },
      conditions: [
        { en: "Seasonal uplift validated against comparable-store data before capital is released", ar: "التحقق من الارتفاع الموسمي مقابل بيانات متاجر مماثلة قبل صرف رأس المال" },
      ],
      recommendations: [
        { en: "Tie capital release to a validated model — then move fast", ar: "ربط صرف رأس المال بنموذج مُتحقَّق — ثم التحرّك بسرعة" },
      ],
      reasoning: {
        en: "Fair point — if the Ramadan uplift is genuine, it does strengthen the payback. But 'seasonal surge' has to be a number from comparable stores, not optimism. Validate it, and I'll release capital quickly so we hit the window. The discipline isn't a brake; it's what lets us move at speed with confidence.",
        ar: "نقطة وجيهة — إذا كان ارتفاع رمضان حقيقياً فهو فعلاً يقوّي الاسترداد. لكن 'الموجة الموسمية' يجب أن تكون رقماً من متاجر مماثلة لا تفاؤلاً. تحقّقوا منه وسأصرف رأس المال بسرعة لندرك النافذة. الانضباط ليس مكابح؛ بل ما يتيح لنا التحرّك بسرعة وثقة.",
      },
    },
    {
      advisor: "Legal",
      respondsTo: "Market",
      perspective: {
        en: "Market's 'open before Ramadan' works — we just start the licensing clock now so the timeline actually holds.",
        ar: "خطة مستشار السوق 'الافتتاح قبل رمضان' قابلة للتنفيذ — فقط نبدأ ساعة التراخيص الآن ليصمد الجدول الزمني.",
      },
      conditions: [
        { en: "CR and municipal license started 6–8 weeks before the target opening", ar: "بدء السجل التجاري والرخصة البلدية قبل ٦–٨ أسابيع من الافتتاح المستهدف" },
      ],
      recommendations: [
        { en: "Lock the licensing timeline into the launch plan as a gating milestone", ar: "تثبيت الجدول الزمني للتراخيص ضمن خطة الإطلاق كمعلم حاكم" },
      ],
      reasoning: {
        en: "I'm with Market on the seasonal timing — it just makes the licensing lead time non-negotiable. The CR and municipal license take 2–4 weeks each, so if we want doors open before Ramadan, the paperwork has to start 6–8 weeks ahead. Put that milestone in the plan and the legal side never threatens the launch date.",
        ar: "أتفق مع مستشار السوق في التوقيت الموسمي — وهذا فقط يجعل مهلة التراخيص غير قابلة للتفاوض. السجل التجاري والرخصة البلدية يستغرق كلٌّ منهما ٢–٤ أسابيع، فإن أردنا فتح الأبواب قبل رمضان وجب بدء الأوراق قبلها بـ٦–٨ أسابيع. ضعوا هذا المعلم في الخطة ولن يهدّد الجانب القانوني موعد الإطلاق أبداً.",
      },
    },
  ],

  verdict: {
    confidence: 0.85,
    stance: "conditional",
    boardNote: {
      en: "All three see the opportunity — the real question is sequencing, not whether: start the licenses now, validate the seasonal model, and time the opening to the Ramadan peak.",
      ar: "الثلاثة يرون الفرصة — والسؤال الحقيقي هو الترتيب لا المبدأ: ابدأ التراخيص الآن، وتحقّق من النموذج الموسمي، ووقّت الافتتاح مع ذروة رمضان.",
    },
    recommendation: {
      en: "Proceed with the Jeddah branch on a phased plan: start licensing now, validate the seasonal revenue model, and time the opening to the Ramadan peak.",
      ar: "المضي في فرع جدة بخطة تدريجية: ابدأ التراخيص الآن، وتحقّق من نموذج الإيرادات الموسمي، ووقّت الافتتاح مع ذروة رمضان.",
    },
    conflicts: [
      {
        en: "Pace vs. cash discipline: Market wants to move on the window; the CFO wants the model validated first.",
        ar: "الوتيرة مقابل الانضباط المالي: مستشار السوق يريد اقتناص النافذة، والمدير المالي يريد التحقق من النموذج أولاً.",
      },
      {
        en: "Speed vs. licensing lead time: the opening date depends on starting the registrations early enough.",
        ar: "السرعة مقابل مهلة التراخيص: موعد الافتتاح يعتمد على بدء التسجيلات مبكراً بما يكفي.",
      },
    ],
    tensions: [
      { between: ["CFO", "Market"], over: { en: "pace vs. cash discipline", ar: "الوتيرة مقابل الانضباط المالي" }, severity: "high" },
      { between: ["Legal", "Market"], over: { en: "speed vs. licensing lead time", ar: "السرعة مقابل مهلة التراخيص" }, severity: "low" },
    ],
    nextSteps: [
      {
        en: "Build a bottom-up revenue model with the seasonal uplift validated against comparable stores.",
        ar: "بناء نموذج إيرادات تصاعدي مع التحقق من الارتفاع الموسمي مقابل متاجر مماثلة.",
      },
      {
        en: "Start the Commercial Registration (CR) and municipal license now — 6–8 weeks before target open.",
        ar: "بدء السجل التجاري والرخصة البلدية الآن — قبل ٦–٨ أسابيع من الافتتاح المستهدف.",
      },
      {
        en: "Register the lease on Ejar and put all agreements in written, notarized contracts.",
        ar: "تسجيل عقد الإيجار على إيجار ووضع كل الاتفاقات في عقود مكتوبة وموثّقة.",
      },
      {
        en: "Build a launch campaign anchored to the Ramadan and Eid seasons.",
        ar: "بناء حملة إطلاق مرتبطة بموسمي رمضان والعيد.",
      },
    ],
  },
};
