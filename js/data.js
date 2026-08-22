/*
 * Grounded knowledge base for IndiaToFinland.
 *
 * Every entry in SOURCES links to a real, verified official page (Migri, DVV,
 * Kela, InfoFinland, Vero, City of Espoo/Helsinki, Kielibuusti, TE-palvelut).
 * Where we could not verify a specific deep link (e.g. private housing
 * portals), we deliberately link to the verified homepage instead of
 * guessing a URL — see HOUSING steps below. Never add a link here that
 * hasn't been checked; the AI Buddy's whole value is that it doesn't
 * hallucinate rules.
 */

const SOURCES = {
  migriResearcher: { name: "Migri — moving to Finland as a researcher", url: "https://migri.fi/en/moving-to-finland-as-a-researcher" },
  migriStudent: { name: "Migri — residence permit for studies", url: "https://migri.fi/en/residence-permit-application-for-studies" },
  migriWork: { name: "Migri — residence permit applications", url: "https://migri.fi/en/residence-permit-applications" },
  migriPermanent: { name: "Migri — permanent residence permit", url: "https://migri.fi/en/permanent-residence-permit" },
  migriPersonalId: { name: "Migri — personal identity code with a residence permit", url: "https://migri.fi/en/personal-identity-code" },
  enterFinland: { name: "Enter Finland — apply for a residence permit online", url: "https://enterfinland.fi/eServices/info/residencepermit" },
  infoFinlandRegister: { name: "InfoFinland — registering as a resident", url: "https://infofinland.fi/en/moving-to-finland/registering-as-a-resident" },
  dvvIndividuals: { name: "DVV — Digital and Population Data Services Agency", url: "https://dvv.fi/en/individuals" },
  dvvInternationalMove: { name: "DVV — moving to, in, and out of Finland (foreigners)", url: "https://dvv.fi/en/international-moving" },
  dvvPersonalId: { name: "DVV — personal identity code", url: "https://dvv.fi/en/personal-identity-code" },
  ihHelsinki: { name: "International House Helsinki — registration & personal ID", url: "https://ihhelsinki.fi/services/registration-personal-identity-code-change-of-address/" },
  kelaWhenMoveIn: { name: "Kela — can you get benefits when you move to Finland?", url: "https://www.kela.fi/can-you-get-benefits-when-you-move-to-finland" },
  kelaGuide: { name: "Kela — Coming to Finland: benefits briefly and in plain language", url: "https://www.kela.fi/documents/d/guest/benefit-guide-coming-to-finland" },
  veroPersonalId: { name: "Vero (Tax Administration) — personal identity codes for workers", url: "https://www.vero.fi/en/individuals/tax-cards-and-tax-returns/arriving_in_finland/work_in_finland/finnish-personal-identity-codes-for-workers-arriving-in-finland/" },
  veroTaxCard: { name: "InfoFinland — the tax card", url: "https://infofinland.fi/en/work-and-enterprise/taxation/tax-card" },
  espooEce: { name: "City of Espoo — applying for early childhood education (eVaka)", url: "https://www.espoo.fi/en/childcare-and-education/early-childhood-education/applying-municipal-early-childhood-education" },
  espooPrePrimary: { name: "City of Espoo — pre-primary education enrolment", url: "https://www.espoo.fi/en/childcare-and-education/pre-primary-education/enrolment-pre-primary-education-2026-2027-school-year" },
  espooEceFree5: { name: "City of Espoo — free early childhood education for five-year-olds", url: "https://www.espoo.fi/en/childcare-and-education/early-childhood-education/free-early-childhood-education-five-year-olds" },
  helsinkiEce: { name: "City of Helsinki — applying for early childhood education (Edlevo)", url: "https://www.hel.fi/en/childhood-and-education/early-childhood-education/applying-for-early-childhood-education" },
  infoFinlandEce: { name: "InfoFinland — early childhood education", url: "https://infofinland.fi/en/education/early-childhood-education" },
  kielibuustiIntegration: { name: "Kielibuusti — integration training", url: "https://www.kielibuusti.fi/en/learn-finnish/language-tests-and-integration/information-about-integration" },
  infoFinlandIntegration: { name: "InfoFinland — integration into Finland", url: "https://infofinland.fi/en/settling-in-finland/integration-into-finland" },
  infoFinlandStudyingFinnish: { name: "InfoFinland — studying Finnish", url: "https://infofinland.fi/finnish-and-swedish/studying-finnish" },
  teWorkPermit: { name: "TE-palvelut — work permit services", url: "https://toimistot.te-palvelut.fi/en/work-permit-services" },
  ites: { name: "International Talent Employment Service (ITES), Helsinki region", url: "https://tyollisyys.palvelumanuaali.fi/en/service/international-talent-employment-service-ites" },
  workInFinlandJobs: { name: "Work in Finland — open jobs", url: "https://www.workinfinland.com/en/open-jobs/" },
  workInFinlandMarket: { name: "Work in Finland — the labour market", url: "https://www.workinfinland.com/en/why-finland/working-in-finland/labour-market/" },
  infoFinlandHome: { name: "InfoFinland — settling in Finland (start here for housing)", url: "https://infofinland.fi/en" },
  housingOikotie: { name: "Oikotie Homes — Finnish rental & property portal", url: "https://asunnot.oikotie.fi/" },
  housingVuokraovi: { name: "Vuokraovi — Finnish rental housing search", url: "https://www.vuokraovi.com/" },
  housingHoas: { name: "HOAS — student housing in the Helsinki region", url: "https://hoas.fi/en/" },
  espooHome: { name: "City of Espoo — official site", url: "https://www.espoo.fi/en" },
  helsinkiHome: { name: "City of Helsinki — official site", url: "https://www.hel.fi/en" },
  infoFinlandEverydayLife: { name: "InfoFinland — everyday life in Finland (incl. opening a bank account)", url: "https://infofinland.fi/en/settling-in-finland/everyday-life-in-finland" },
  infoFinlandCustoms: { name: "InfoFinland — Finnish culture and social norms", url: "https://infofinland.fi/en/information-about-finland/finnish-customs" },
  infoFinlandHolidays: { name: "InfoFinland — Finnish public holidays", url: "https://infofinland.fi/en/information-about-finland/finnish-holidays" },
  infoFinlandThingsToDo: { name: "InfoFinland — things to do in Finland", url: "https://infofinland.fi/en/leisure/things-to-do-in-finland" },
  infoFinlandOutdoor: { name: "InfoFinland — outdoor activities", url: "https://infofinland.fi/en/leisure/outdoor-activities" },
  infoFinlandAssociations: { name: "InfoFinland — associations (incl. immigrant associations & the Moniheli network)", url: "https://infofinland.fi/leisure/associations" },
  visitFinlandSauna: { name: "Visit Finland — your guide to Finnish sauna", url: "https://www.visitfinland.com/en/things-to-do/sauna/" },
  visitFinlandFood: { name: "Visit Finland — what to eat in Finland, iconic Finnish foods", url: "https://www.visitfinland.com/en/articles/finlands-traditional-and-iconic-foods/" },
  visitFinlandFoodCulture: { name: "Visit Finland — Finnish food culture and must-try local ingredients", url: "https://www.visitfinland.com/en/articles/finnish-food-culture/" },
  suomiFiFrontpage: { name: "Suomi.fi — official public e-services portal", url: "https://www.suomi.fi/frontpage" },
  suomiFiDigitalSupport: { name: "Suomi.fi — digital support for using web services and devices", url: "https://www.suomi.fi/citizen/rights-and-obligations/digital-support-and-administrative-services/guide/digital-support-in-using-web-services-and-devices1/digital-support/services" },
  infoFinlandMentalHealth: { name: "InfoFinland — mental health", url: "https://infofinland.fi/en/health/mental-health" },
  infoFinlandFinancialProblems: { name: "InfoFinland — financial problems", url: "https://infofinland.fi/settling-in-finland/cost-of-living-in-finland/financial-problems" },
  infoFinlandStartingBusiness: { name: "InfoFinland — starting a business in Finland", url: "https://infofinland.fi/en/work-and-enterprise/starting-a-business-in-finland" },
  infoFinlandEntrepreneurNonEU: { name: "InfoFinland — entrepreneur in Finland (non-EU citizens)", url: "https://infofinland.fi/en/moving-to-finland/non-eu-citizens/entrepreneur-in-finland" },
};

/*
 * Kaveri's four quest categories. Every roadmap step (whether generated from
 * the wizard or one of the fixed Cultural/Food quest lists below) belongs to
 * exactly one of these, which drives the points total, the level, and the
 * category badge shown on each quest card.
 */
const QUEST_CATEGORIES = {
  legal: { id: "legal", label: "Administrative Work", icon: "⚖️", color: "#003580", points: 20, blurb: "Permits, registration, bank accounts — the must-do admin." },
  social: { id: "social", label: "Social", icon: "👥", color: "#0072CE", points: 15, blurb: "Meetups, communities, making connections." },
  cultural: { id: "cultural", label: "Cultural", icon: "🎭", color: "#4DA8DA", points: 10, blurb: "Finnish traditions and everyday lifestyle." },
  food: { id: "food", label: "Food", icon: "🍴", color: "#8FCBEC", points: 5, blurb: "Finnish cuisine worth trying." },
};

// Points a completed quest in a given questCategory is worth.
function pointsFor(questCategoryId) {
  const qc = QUEST_CATEGORIES[questCategoryId];
  return qc ? qc.points : 10;
}

// Total points -> a friendly progression level. "Kaveri" (Finnish for
// "friend/buddy") is deliberately the top tier — the whole app is trying to
// get you there.
const LEVELS = [
  { min: 0, label: "Newcomer", icon: "🌱" },
  { min: 50, label: "Settler", icon: "🏠" },
  { min: 120, label: "Local", icon: "🧭" },
  { min: 220, label: "Kaveri", icon: "🤝" },
];

function levelFor(totalPoints) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalPoints >= l.min) current = l;
  }
  return current;
}

// Indian languages offered as options — deliberately not defaulting to Hindi.
const INDIAN_LANGUAGES = [
  "Hindi", "English", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati",
  "Punjabi", "Kannada", "Malayalam", "Odia", "Assamese", "Urdu", "Other",
];

const FINLAND_DESTINATIONS = [
  "Espoo", "Helsinki", "Vantaa", "Tampere", "Oulu", "Turku", "Jyväskylä", "Other city in Finland",
];

const BACKGROUNDS = [
  { id: "student", label: "Student (going to study in Finland)" },
  { id: "researcher", label: "Researcher / PhD / Postdoc" },
  { id: "employed", label: "Employed professional (have a Finnish job offer)" },
  { id: "jobseeker", label: "Job-seeker (no offer yet)" },
  { id: "entrepreneur", label: "Entrepreneur / self-employed" },
  { id: "accompanying", label: "Accompanying family member (spouse/parent/child)" },
];

const PHASES = [
  { id: "before", label: "Before you leave India", icon: "🧳" },
  { id: "week2", label: "First 2 weeks in Finland", icon: "🛫" },
  { id: "month1", label: "First month", icon: "📅" },
  { id: "month3", label: "First 3 months", icon: "🌱" },
  { id: "ongoing", label: "Ongoing", icon: "🔁" },
];

/*
 * Categories the user can pick as "of interest to them" — matches the seven
 * areas Kaveri is meant to help with (local culture & traditions; work,
 * entrepreneurship & studying; language; public services; digital skills;
 * family life & building social connections; self-help). Each still rolls
 * up into one of the four quest badges via questCategory (per the team's
 * own Miro plan: pick categories -> a short conditional questionnaire ->
 * answers feed the roadmap generator below).
 */
const CATEGORIES = [
  {
    id: "housing",
    label: "Housing",
    icon: "🏠",
    questCategory: "legal",
    blurb: "Temporary accommodation, long-term rentals, deposits, and getting a roof over your head sorted.",
    questions: [
      {
        id: "housingStatus",
        type: "select",
        label: "Where do things stand on housing?",
        options: ["Nothing arranged yet", "Temporary place booked, still need long-term", "Long-term place already arranged"],
      },
      {
        id: "housingType",
        type: "select",
        label: "What kind of housing are you looking for?",
        options: ["Private rental", "Student housing", "Employer-provided housing", "Not sure yet"],
        showIf: { field: "housingStatus", oneOf: ["Nothing arranged yet", "Temporary place booked, still need long-term"] },
      },
    ],
  },
  {
    id: "publicServices",
    label: "Public Services",
    icon: "🏛️",
    questCategory: "legal",
    blurb: "Residence permits, DVV registration, personal ID, tax card, and healthcare — the core admin unlock.",
    questions: [
      {
        id: "status",
        type: "select",
        label: "Where are you in the residence permit process?",
        options: ["Already granted", "Application submitted", "Not started yet"],
      },
      {
        id: "basis",
        type: "select",
        label: "What is your permit mainly based on?",
        options: ["Employment", "Studies", "Research", "Family member (spouse/parent)", "Not sure yet"],
      },
      {
        id: "timeframe",
        type: "select",
        label: "When are you hoping to move?",
        options: ["Within 1 month", "1–3 months", "3–6 months", "Still deciding"],
      },
      {
        id: "arrivedYet",
        type: "select",
        label: "Have you arrived in Finland yet?",
        options: ["Not yet", "Yes, within the last month", "Yes, more than a month ago"],
      },
      {
        id: "ongoingNeeds",
        type: "select",
        label: "Any ongoing medical needs, medication, or family members needing regular care?",
        options: ["No", "Yes"],
      },
    ],
  },
  {
    id: "digitalSkills",
    label: "Digital Skills",
    icon: "💻",
    questCategory: "legal",
    blurb: "Suomi.fi and the digital identity almost every Finnish public service assumes you already have.",
    questions: [
      {
        id: "comfort",
        type: "select",
        label: "How comfortable are you using government websites/apps in a new country?",
        options: ["Very comfortable", "Somewhat", "Not really — I'll need a guide"],
      },
    ],
  },
  {
    id: "workStudy",
    label: "Work, Entrepreneurship & Studying",
    icon: "💼",
    questCategory: "social",
    blurb: "Finding work, starting a business, or continuing your studies.",
    questions: [
      {
        id: "goal",
        type: "select",
        label: "What's your main goal here?",
        options: ["Find employment", "Start a business or freelance", "Further studies (Bachelor's/Master's/PhD)", "Not sure yet"],
      },
      {
        id: "field",
        type: "text",
        label: "What field do you work in / plan to study? (optional)",
        placeholder: "e.g. software engineering, nursing, academia",
      },
      {
        id: "jobStatus",
        type: "select",
        label: "Job search status?",
        options: ["Already have a Finnish job offer", "Actively searching", "Just researching options"],
        showIf: { field: "goal", oneOf: ["Find employment"] },
      },
      {
        id: "qualification",
        type: "select",
        label: "What are you aiming for?",
        options: ["Bachelor's degree", "Master's degree", "Doctoral studies"],
        showIf: { field: "goal", oneOf: ["Further studies (Bachelor's/Master's/PhD)"] },
      },
    ],
  },
  {
    id: "language",
    label: "Language",
    icon: "🗣️",
    questCategory: "cultural",
    blurb: "Learning Finnish or Swedish, and free integration training you may be entitled to.",
    questions: [
      {
        id: "level",
        type: "select",
        label: "Current Finnish or Swedish level?",
        options: ["None", "Basic", "Intermediate or higher"],
      },
      {
        id: "employmentStatus",
        type: "select",
        label: "Will you be registered as a jobseeker / unemployed at any point?",
        options: ["Yes", "No / not sure"],
      },
    ],
  },
  {
    id: "culture",
    label: "Local Culture & Traditions",
    icon: "🎭",
    questCategory: "cultural",
    blurb: "Finnish customs, traditions, and everyday lifestyle — on top of the quests everyone gets.",
    questions: [
      {
        id: "curiosity",
        type: "text",
        label: "What aspects of Finnish culture are you most curious about? (optional)",
        placeholder: "e.g. sauna etiquette, Midsummer, work-life balance",
      },
    ],
  },
  {
    id: "familyLife",
    label: "Family Life & Building Social Connections",
    icon: "👨‍👩‍👧",
    questCategory: "social",
    blurb: "Who's with you, what languages you speak, your children's schooling, and finding people with shared interests.",
    questions: [
      {
        id: "familyLanguages",
        type: "multiselect",
        label: "Which languages does your family speak at home?",
        options: INDIAN_LANGUAGES,
      },
      {
        id: "interests",
        type: "text",
        label: "What are you and your family interested in? (hobbies, sports, culture)",
        placeholder: "e.g. cricket, classical music, hiking, coding meetups",
      },
      {
        id: "instructionLanguage",
        type: "select",
        label: "If you have children — preferred language of instruction for daycare/school?",
        options: ["Finnish", "Swedish", "English / international / bilingual", "Not sure yet"],
      },
    ],
  },
  {
    id: "selfHelp",
    label: "Self-help",
    icon: "🧘",
    questCategory: "social",
    blurb: "Where to turn for mental health or financial support, if and when you need it — no shame in bookmarking this early.",
    questions: [
      {
        id: "wantsSupport",
        type: "select",
        label: "Would it help to know where to turn if things ever feel overwhelming (stress, loneliness, financial strain)?",
        options: ["Yes, show me", "Not needed right now"],
      },
    ],
  },
];

/*
 * Roadmap step generators — one per category. Each returns an array of
 * { phase, title, why, action, source } grounded in SOURCES above.
 * "why" is where personalization happens: it reads the profile + answers.
 */
const ROADMAP_GENERATORS = {
  housing(profile, a) {
    const steps = [];
    const alreadyArranged = a.housingStatus === "Long-term place already arranged";

    if (!alreadyArranged) {
      steps.push({
        phase: "before",
        title: "Book temporary accommodation for your first few weeks",
        why: "Long-term rentals in Finland often expect a Finnish personal identity code or local references you won't have yet — a short-term base gives you somewhere to land while you search properly.",
        action: "Book a hotel, serviced apartment, or short-term rental for your first 2–4 weeks. Specific listings and prices change too fast to cite one directly, so start from InfoFinland's housing overview.",
        source: SOURCES.infoFinlandHome,
      });

      if (a.housingType === "Student housing") {
        steps.push({
          phase: "week2",
          title: "Apply through your city's student housing organisation",
          why: "Student housing organisations run separate waiting lists from the private market and are usually cheaper — worth applying to as early as possible, ideally before you arrive.",
          action: "Check HOAS (Helsinki region) or your destination city's equivalent student housing organisation for availability and how to apply.",
          source: SOURCES.housingHoas,
        });
      } else if (a.housingType === "Employer-provided housing") {
        steps.push({
          phase: "week2",
          title: "Get your employer-provided housing terms in writing",
          why: "Employer-provided housing arrangements vary a lot in what's actually covered (utilities, deposit, duration) — worth confirming in writing rather than assuming.",
          action: "Ask HR for the exact terms in writing, and compare against InfoFinland's general housing overview.",
          source: SOURCES.infoFinlandHome,
        });
      } else {
        steps.push({
          phase: "week2",
          title: "Search Finland's main rental portals",
          why: "Oikotie and Vuokraovi together list most of the private rental market in Finland — nearly every independent landlord and rental company uses one or both.",
          action: `Set up saved searches for ${profile.destination || "your destination city"} on Oikotie Homes.`,
          source: SOURCES.housingOikotie,
        });
        steps.push({
          phase: "week2",
          title: "Check Vuokraovi as a second rental portal",
          why: "Listings differ between Finnish rental portals — checking a second one catches places the first doesn't list.",
          action: `Browse Vuokraovi for ${profile.destination || "your destination city"} alongside Oikotie.`,
          source: SOURCES.housingVuokraovi,
        });
      }
    }

    steps.push({
      phase: "month1",
      title: "Understand a Finnish rental contract before you sign",
      why: "Finnish rental agreements commonly require a deposit worth one to three months' rent and have specific notice-period rules that differ from what you're used to in India — worth knowing even if a lease is already arranged.",
      action: "Read InfoFinland's housing section for an overview of deposits and notice periods before you sign (or re-check a lease you've already signed).",
      source: SOURCES.infoFinlandHome,
    });

    return steps;
  },

  publicServices(profile, a) {
    const steps = [];
    if (a.status === "Not started yet") {
      steps.push({
        phase: "before",
        title: "Start your residence permit application",
        why: `Based on what you told us (${a.basis || "your situation"}), this is usually the first application to file — it typically needs to happen before you fly, not after.`,
        action: "Check which permit type applies to you and start the online application on Enter Finland.",
        source: SOURCES.enterFinland,
      });
    }
    if (a.basis === "Research") {
      steps.push({ phase: "before", title: "Confirm the researcher permit route", why: "You told us your move is research-based — Finland has a specific permit track for this with its own income requirements.", action: "Read Migri's researcher guidance before submitting anything.", source: SOURCES.migriResearcher });
    } else if (a.basis === "Studies") {
      steps.push({ phase: "before", title: "Confirm your student permit requirements", why: "Study-based permits require proof of acceptance and private health insurance before you apply.", action: "Review Migri's student residence permit page.", source: SOURCES.migriStudent });
    } else if (a.basis === "Employment") {
      steps.push({ phase: "before", title: "Confirm your employment-based permit requirements", why: "Employment permits are tied to your job offer and salary meeting Finnish thresholds.", action: "Review Migri's residence permit application guidance for workers.", source: SOURCES.migriWork });
    }
    if (a.timeframe === "Within 1 month") {
      steps.push({ phase: "before", title: "Double-check processing time won't slip your move date", why: "You're planning to move within a month — permit processing can take longer than that, so this is your most time-sensitive item.", action: "Check current processing times on Enter Finland and consider whether your timeline needs adjusting.", source: SOURCES.enterFinland });
    }
    steps.push({ phase: "month3", title: "Plan for permanent residence, eventually", why: "Most routes allow you to apply for permanent residence after a few continuous years — worth knowing early, not urgent now.", action: "Bookmark Migri's permanent residence permit page for later.", source: SOURCES.migriPermanent });

    steps.push({
      phase: "week2",
      title: "Register with DVV and get your personal identity code",
      why: "This one unlocks almost everything else — banking, healthcare, tax card, even a phone contract usually need it.",
      action: "Book an appointment with the Digital and Population Data Services Agency (DVV) to register and receive your henkilötunnus.",
      source: SOURCES.dvvIndividuals,
    });
    steps.push({
      phase: "week2",
      title: "Register your municipality of residence",
      why: `You told us you're heading to ${profile.destination || "your destination in Finland"} — your municipality of residence determines which local services (daycare, healthcare centre, schools) you're entitled to.`,
      action: "Register your address and municipality as part of the same DVV process.",
      source: SOURCES.infoFinlandRegister,
    });
    if (profile.background === "researcher" || profile.background === "employed" || profile.background === "jobseeker") {
      steps.push({ phase: "week2", title: "Get your tax card (verokortti)", why: "Without a Finnish tax card, employers withhold tax at a default high rate — this is one of the most commonly missed early steps.", action: "Apply for your personal identity code and tax card together where possible.", source: SOURCES.veroPersonalId });
    }
    steps.push({ phase: "week2", title: "If DVV's queue is long, try International House Helsinki", why: "In the Helsinki region, International House Helsinki runs a combined registration service that's often faster for newcomers.", action: "Check whether International House Helsinki can process your registration.", source: SOURCES.ihHelsinki });
    steps.push({ phase: "month1", title: "Open a Finnish bank account", why: "Once you have your personal identity code, a local bank account is what actually unlocks salary payments, Kela benefits, and paying rent — most Finnish landlords and employers won't work around it.", action: "Compare a couple of Finnish banks' requirements and fees, then open an account using your ID and personal identity code.", source: SOURCES.infoFinlandEverydayLife });

    steps.push({
      phase: "week2",
      title: "Understand your Kela / public healthcare eligibility",
      why: "Eligibility for Kela benefits and public healthcare depends on your permit type and length of stay — it is not automatic on arrival.",
      action: "Read Kela's guide on getting benefits when you move to Finland.",
      source: SOURCES.kelaWhenMoveIn,
    });
    if (a.ongoingNeeds === "Yes") {
      steps.push({ phase: "week2", title: "Plan continuity of care for ongoing medical needs", why: "You told us there are ongoing medical needs in your family — sort out prescriptions and medical records transfer before routine care access kicks in.", action: "Read Kela's plain-language guide on moving to Finland, and bring existing medical records/prescriptions translated if possible.", source: SOURCES.kelaGuide });
    }
    return steps;
  },

  digitalSkills(profile, a) {
    const steps = [
      {
        phase: "week2",
        title: "Get comfortable with Suomi.fi",
        why: "Almost every Finnish public service — Kela, Vero, DVV, even your future employer's HR system — assumes you can authenticate and act through Suomi.fi. It's worth understanding before you need it under pressure.",
        action: "Create your Suomi.fi identity once you have a personal identity code, and browse what it lets you do (messages, e-authorizations, viewing your own data).",
        source: SOURCES.suomiFiFrontpage,
      },
    ];
    if (a.comfort === "Not really — I'll need a guide") {
      steps.push({
        phase: "week2",
        title: "Use Suomi.fi's digital support guide",
        why: "You told us government sites/apps in a new country feel daunting — Suomi.fi has a dedicated guide for exactly this, not just a FAQ page.",
        action: "Work through Suomi.fi's digital support guide for using web services and devices.",
        source: SOURCES.suomiFiDigitalSupport,
      });
    }
    return steps;
  },

  workStudy(profile, a) {
    const steps = [];
    if (a.goal === "Find employment") {
      if (a.jobStatus === "Already have a Finnish job offer") {
        steps.push({ phase: "before", title: "Confirm your work-based permit route matches your offer", why: "Your permit basis needs to match the actual employment terms in your offer letter.", action: "Cross-check your offer against Migri's residence permit requirements before applying.", source: SOURCES.migriWork });
      } else {
        steps.push({
          phase: "week2",
          title: "Register with employment services",
          why: a.field ? `You work in ${a.field} — Finland actively recruits international talent in many technical and specialist fields, and TE-palvelut / ITES exist specifically to help match you.` : "Even while researching, registering early means you show up for relevant opportunities sooner.",
          action: "Register with TE-palvelut's work permit and employment services, and — if you're in the Helsinki region — the International Talent Employment Service (ITES).",
          source: SOURCES.teWorkPermit,
        });
        steps.push({ phase: "month1", title: "Explore the local job market directly", why: "Work in Finland's own job board and labour-market overview is a good gauge of realistic demand in your field before you commit to a city.", action: "Browse current openings and the labour market overview for your sector.", source: SOURCES.workInFinlandJobs });
      }
      steps.push({ phase: "week2", title: "Check the Helsinki region's international talent service", why: "The Espoo–Helsinki–Vantaa region runs a dedicated service to help international talent integrate into the local job market.", action: "See if ITES has relevant employer connections in your field.", source: SOURCES.ites });
    } else if (a.goal === "Start a business or freelance") {
      steps.push({
        phase: "month1",
        title: "Learn how to start a business in Finland",
        why: a.field ? `You told us you're in ${a.field} — the business form you pick (light entrepreneurship, proprietorship, limited company) changes your obligations, so it's worth understanding the options before registering anything.` : "The business form you pick changes your tax and reporting obligations, so it's worth understanding the options before registering anything.",
        action: "Read InfoFinland's overview of starting a business, including the Trade Register notification every form requires.",
        source: SOURCES.infoFinlandStartingBusiness,
      });
      if (profile.background !== "employed") {
        steps.push({
          phase: "before",
          title: "Check whether you need a start-up residence permit",
          why: "As a non-EU citizen, entrepreneurship usually needs its own permit route, applied for before you arrive — different from an employment-based permit.",
          action: "Confirm the entrepreneur/start-up permit requirements before you finalise your move date.",
          source: SOURCES.infoFinlandEntrepreneurNonEU,
        });
      }
    } else if (a.goal === "Further studies (Bachelor's/Master's/PhD)") {
      steps.push({
        phase: "month1",
        title: `Plan your ${a.qualification || "further studies"} pathway`,
        why: "Finnish universities have specific application windows and language requirements that differ from Indian ones — worth mapping before you commit time to one institution.",
        action: "Confirm your target programme's language of instruction, intake dates, and whether your existing qualification is recognised.",
        source: SOURCES.infoFinlandHome,
      });
    }
    return steps;
  },

  language(profile, a) {
    const steps = [];
    if (a.level === "None" || a.level === "Basic") {
      steps.push({ phase: "month1", title: "Start Finnish (or Swedish) as soon as you're settled — not before you have to", why: "Language is a marathon, not a sprint — most newcomers do better starting once housing and registration are behind them, rather than trying to learn everything in India first.", action: "Look at InfoFinland's overview of how and where to study Finnish.", source: SOURCES.infoFinlandStudyingFinnish });
    }
    if (a.employmentStatus === "Yes") {
      steps.push({ phase: "month3", title: "Ask about free integration training", why: "If you register as unemployed/jobseeking at any point, you may be entitled to a structured, often free integration plan including language study.", action: "Ask your municipality's employment services about an integration plan, and check Kielibuusti for available courses.", source: SOURCES.kielibuustiIntegration });
    }
    steps.push({ phase: "ongoing", title: "Understand what 'integration' officially covers", why: "Finland's integration system is a real, structured programme — not just language class — worth understanding what you're entitled to.", action: "Read InfoFinland's overview of integration into Finland.", source: SOURCES.infoFinlandIntegration });
    return steps;
  },

  culture(profile, a) {
    const steps = [];
    if (a.curiosity) {
      steps.push({
        phase: "ongoing",
        title: "Follow up on what you're curious about",
        why: `You told us you're curious about: ${a.curiosity}. Finnish culture and social norms are covered well in one place, worth reading before you guess at etiquette.`,
        action: "Read InfoFinland's overview of Finnish culture and social norms, then look up your specific interest by name once you're settled.",
        source: SOURCES.infoFinlandCustoms,
      });
    }
    return steps;
  },

  familyLife(profile, a) {
    const steps = [];
    const langs = (a.familyLanguages || []).filter((l) => l !== "Other");
    steps.push({
      phase: "ongoing",
      title: langs.length ? `Find ${langs.join(" / ")}-speaking community groups` : "Find community groups in your languages",
      why: "Community and language groups aren't centrally listed anywhere official — they mostly live on Facebook and Meetup, organised by the community itself.",
      action: "Search Facebook Groups and Meetup for your city name plus 'Indian community' or your specific language, once you've arrived and can verify a group is currently active.",
      source: SOURCES.infoFinlandHome,
    });
    steps.push({
      phase: "ongoing",
      title: "Look into immigrant associations",
      why: "Beyond informal Facebook groups, Finland has a formal network of registered immigrant associations that run activities and support — worth knowing this exists as an official option.",
      action: "Search the Finnish Patent and Registration Office's AssociationNet, and check the Moniheli network of immigrant organisations.",
      source: SOURCES.infoFinlandAssociations,
    });
    if (a.interests) {
      steps.push({
        phase: "ongoing",
        title: "Find clubs matching your interests",
        why: `You mentioned: ${a.interests}. We can't promise a specific named club exists without checking live — that's exactly the kind of question worth asking your city's leisure services directly.`,
        action: `Check your destination city's official site for hobby/leisure listings ("harrastukset"), and search Meetup for ${a.interests}.`,
        source: profile.destination === "Helsinki" ? SOURCES.helsinkiHome : SOURCES.espooHome,
      });
    }
    if (profile.childrenCount > 0) {
      const city = profile.destination === "Helsinki" ? "helsinki" : "espoo";
      steps.push({
        phase: "before",
        title: "Apply for early childhood education / daycare early",
        why: profile.childrenAges ? `You told us: ${profile.childrenAges}. Daycare and pre-primary places in the capital region fill up, and non-resident applications can usually start before you've even registered your address.` : "Daycare places in the capital region fill up — start the application before you arrive if you can.",
        action: city === "helsinki" ? "Apply through Helsinki's Edlevo e-service." : "Apply through Espoo's eVaka e-service.",
        source: city === "helsinki" ? SOURCES.helsinkiEce : SOURCES.espooEce,
      });
      if (a.instructionLanguage) {
        steps.push({ phase: "month1", title: `Confirm ${a.instructionLanguage} availability at nearby schools`, why: `You told us you're aiming for ${a.instructionLanguage} instruction — availability varies a lot by area, so confirming early avoids a surprise catchment assignment.`, action: "Cross-check InfoFinland's early childhood education overview against your city's own school/daycare finder.", source: SOURCES.infoFinlandEce });
      }
      steps.push({ phase: "month3", title: "Know about free pre-primary education for 5-year-olds", why: "If you have a child turning 5, Espoo (and most Finnish municipalities) offer free pre-primary education — easy to miss if you're not looking for it.", action: "Check eligibility and enrolment windows.", source: SOURCES.espooEceFree5 });
    }
    return steps;
  },

  selfHelp(profile, a) {
    const steps = [
      {
        phase: "ongoing",
        title: "Know where to get mental health support if you need it",
        why: "Relocation is genuinely stressful, and knowing this exists before you need it means one less thing to figure out in a crisis. MIELI's crisis helpline is anonymous — you don't have to give your name.",
        action: "Bookmark InfoFinland's mental health page, including how to contact your local health centre and the MIELI crisis helpline.",
        source: SOURCES.infoFinlandMentalHealth,
      },
    ];
    if (a.wantsSupport === "Yes, show me") {
      steps.push({
        phase: "ongoing",
        title: "Know what to do about financial difficulties",
        why: "You told us this would help — a new cost of living, delayed first paycheck, or unexpected expense is common early on, and there's a real, structured path for support if it happens.",
        action: "Read InfoFinland's overview of financial problems and who to contact.",
        source: SOURCES.infoFinlandFinancialProblems,
      });
    }
    return steps;
  },
};

/*
 * Fixed Cultural and Food quests — not personalized by the wizard, offered
 * to every user in "ongoing" once their roadmap is generated. Every quest
 * still cites a real, verified source (InfoFinland or Visit Finland); these
 * are the same grounding rules as the wizard-generated Administrative Work/Social quests.
 */
const CULTURAL_QUESTS = [
  {
    title: "Learn the everyday social norms",
    why: "A handful of small habits — handshakes, eye contact, personal space — cover most of what surprises newcomers in daily interactions.",
    action: "Read InfoFinland's overview of Finnish culture and social norms.",
    source: SOURCES.infoFinlandCustoms,
  },
  {
    title: "Try a Finnish sauna",
    why: "With roughly one sauna per two people nationwide, this isn't a spa treat here — it's the default way Finns unwind, and often where real conversations happen.",
    action: "Visit a public sauna or ask a Finnish colleague/neighbour about joining theirs.",
    source: SOURCES.visitFinlandSauna,
  },
  {
    title: "Mark a Finnish public holiday on your calendar",
    why: "Vappu (May Day), Juhannus (Midsummer) and the winter holidays all come with their own traditions — knowing the dates ahead of time means you don't miss them.",
    action: "Check InfoFinland's list of Finnish public holidays and pick the next one coming up.",
    source: SOURCES.infoFinlandHolidays,
  },
  {
    title: "Try an outdoor activity, whatever the season",
    why: "Nature is central to Finnish life in every season — this isn't just a summer thing.",
    action: "Pick one seasonal outdoor activity (hiking, ice-skating, berry picking, cross-country skiing) and try it.",
    source: SOURCES.infoFinlandOutdoor,
  },
  {
    title: "Explore what's on in your city",
    why: "Most local events (markets, festivals, exhibitions) aren't centrally advertised — city listing pages are the most reliable way to find what's actually happening near you.",
    action: "Browse InfoFinland's things-to-do guide, then check your destination city's own events listing.",
    source: SOURCES.infoFinlandThingsToDo,
  },
];

const FOOD_QUESTS = [
  {
    title: "Try karjalanpiirakka (Karelian pie)",
    why: "One of the most iconic everyday Finnish foods — a thin rye crust with rice porridge filling, usually topped with egg butter — and sold in nearly every grocery store.",
    action: "Pick one up from a supermarket or bakery and try it with egg butter.",
    source: SOURCES.visitFinlandFood,
  },
  {
    title: "Try a Finnish rye bread (ruisleipä)",
    why: "Rye bread is a genuine staple of the Finnish diet, not a novelty item — worth understanding early since it shows up everywhere.",
    action: "Buy a loaf of dark Finnish rye bread and compare it to what you're used to.",
    source: SOURCES.visitFinlandFoodCulture,
  },
  {
    title: "Visit a local market hall or outdoor market",
    why: "Market halls (kauppahalli) and seasonal outdoor markets are where a lot of Finnish food culture — smoked fish, berries, local produce — is easiest to encounter in one place.",
    action: "Find your city's market hall or weekly market and browse what's in season.",
    source: SOURCES.visitFinlandFoodCulture,
  },
  {
    title: "Try a Finnish sweet you haven't heard of",
    why: "Vappu brings tippaleipä and munkki, Shrove Tuesday brings laskiaispulla — the seasonal-treat calendar is a fun, low-stakes way into local culture.",
    action: "Pick one seasonal Finnish treat and try it when its season comes around.",
    source: SOURCES.visitFinlandFood,
  },
];

/*
 * Fun Finland trivia — shown in the "Fun Fact" popup. Sourced from TRIVIA.md
 * (already vetted); this is light-hearted flavor content, not a quest
 * citation, so no SOURCES link is attached.
 */
const FUN_FACTS = [
  "Across Finland as a whole, humans outnumber reindeer by a wide margin (~5.6 million people vs. ~200,000 reindeer) — but in Lapland, reindeer actually outnumber people.",
  "The sharp, salty kick in salmiakki (Finland's iconic salty liquorice) comes from ammonium chloride, not table salt — an ingredient that started life as a 19th-century cough medicine.",
  "Finns drink more coffee per capita than any other nation on earth — roughly 12 kilograms of light-roast coffee per person per year, about 4–8 cups a day.",
  "Finland has roughly 3 million saunas for a population of 5.6 million — enough total sauna space to fit the entire country inside at once.",
  "Finland hosts some wonderfully eccentric global competitions, including the Wife-Carrying World Championships, Swamp Soccer, and Heavy Metal Knitting.",
  "Finland has the highest concentration of heavy metal bands per capita in the world — over 53 bands per 100,000 residents.",
  "Finland's coastline is still rebounding from the weight of Ice Age glaciers (glacial rebound) and grows by roughly 7 square kilometers every year.",
  "Everyman's Right (Jokamiehenoikeus) gives anyone the legal right to roam freely, pitch a tent, and pick wild berries and mushrooms across almost all forests and wilderness, regardless of who owns the land.",
  "Traffic fines in Finland are calculated from the offender's income (day-fines) — high earners have occasionally received speeding tickets worth over €100,000.",
  "Every October 13th, Finland celebrates the National Day of Failure, encouraging risk-taking and destigmatizing setbacks in business and life.",
];

/*
 * Curated resource directory — shown in the "Resources" popup. Condensed
 * from RESOURCES.md (every URL there was used as-is, none invented). Kept
 * as a browsable reference, separate from the per-quest SOURCES citations
 * used in generated roadmap steps.
 */
const RESOURCES = [
  {
    section: "Official government & authority",
    links: [
      { name: "InfoFinland", url: "https://infofinland.fi/en", note: "Comprehensive info for people moving to and living in Finland." },
      { name: "Suomi.fi", url: "https://www.suomi.fi/frontpage", note: "Official Finnish public services portal." },
      { name: "Migri — Finnish Immigration Service", url: "https://migri.fi/en", note: "Residence permits, work, studies, family reunification." },
      { name: "DVV — Population Data Services Agency", url: "https://dvv.fi/en/", note: "Registration, personal identity codes, municipality of residence." },
      { name: "Kela", url: "https://www.kela.fi/moving-to-finland", note: "Social security, benefits, eligibility." },
      { name: "Vero (Tax Administration)", url: "https://www.vero.fi/en/", note: "Tax cards, income tax, taxation." },
      { name: "Job Market Finland", url: "https://tyomarkkinatori.fi/en", note: "National job market and employment service." },
      { name: "Work in Finland", url: "https://www.workinfinland.com/en/", note: "Opportunities for international professionals." },
      { name: "Finnish National Agency for Education (EDUFI)", url: "https://www.oph.fi/en", note: "The Finnish education system." },
      { name: "Traficom", url: "https://www.traficom.fi/en", note: "Vehicles, driving, and driving licence regulations." },
      { name: "112 Finland", url: "https://112.fi/en", note: "Emergency services." },
      { name: "City of Espoo", url: "https://www.espoo.fi/en", note: "Official information and services for Espoo." },
      { name: "City of Helsinki", url: "https://www.hel.fi/en", note: "Official information and services for Helsinki." },
      { name: "Embassy of India in Helsinki", url: "https://www.indembhelsinki.gov.in/", note: "Consular, passport, and other services for Indian citizens." },
    ],
  },
  {
    section: "Housing",
    links: [
      { name: "Oikotie Homes", url: "https://asunnot.oikotie.fi/", note: "Finnish property and housing portal." },
      { name: "Vuokraovi", url: "https://www.vuokraovi.com/", note: "Finnish rental housing search portal." },
      { name: "HOAS", url: "https://hoas.fi/en/", note: "Student housing in the Helsinki region." },
    ],
  },
  {
    section: "Jobs & language",
    links: [
      { name: "Duunitori", url: "https://duunitori.fi/", note: "Finnish job search and employment portal." },
      { name: "Yle Kielikoulu", url: "https://kielikoulu.yle.fi/", note: "Language learning from Finland's public broadcaster." },
      { name: "Duolingo", url: "https://www.duolingo.com/", note: "Language learning platform." },
    ],
  },
  {
    section: "Transport",
    links: [
      { name: "HSL", url: "https://www.hsl.fi/en", note: "Public transport in the Helsinki region." },
      { name: "VR", url: "https://www.vr.fi/en", note: "Finnish rail travel and train services." },
    ],
  },
  {
    section: "Indian community in Finland",
    links: [
      { name: "Indian Women in Finland", url: "https://www.iwf.fi/", note: "Networking, mentoring, and events." },
      { name: "Bharatvaasi in Finland", url: "https://www.bharatvaasi.fi/", note: "Community platform and network for Indians in Finland." },
      { name: "Finland-India Society", url: "https://suomiintiaseura.fi/", note: "Promotes connections between Finland and India." },
    ],
  },
];

function buildRoadmap(profile, categoryAnswers) {
  const stepsByPhase = {};
  PHASES.forEach((p) => (stepsByPhase[p.id] = []));

  Object.keys(categoryAnswers).forEach((catId) => {
    const gen = ROADMAP_GENERATORS[catId];
    if (!gen) return;
    const answers = categoryAnswers[catId] || {};
    const steps = gen(profile, answers) || [];
    const category = CATEGORIES.find((c) => c.id === catId);
    const questCategory = category ? category.questCategory : "legal";
    steps.forEach((s) => {
      stepsByPhase[s.phase].push({
        ...s,
        categoryId: catId,
        categoryLabel: category ? category.label : catId,
        categoryIcon: category ? category.icon : "•",
        questCategory,
        points: pointsFor(questCategory),
      });
    });
  });

  // Cultural and Food quests are universal — every user gets them, always in
  // "ongoing", regardless of what they picked in the wizard.
  CULTURAL_QUESTS.forEach((s) => {
    stepsByPhase.ongoing.push({
      ...s,
      phase: "ongoing",
      categoryId: "cultural",
      categoryLabel: QUEST_CATEGORIES.cultural.label,
      categoryIcon: QUEST_CATEGORIES.cultural.icon,
      questCategory: "cultural",
      points: pointsFor("cultural"),
    });
  });
  FOOD_QUESTS.forEach((s) => {
    stepsByPhase.ongoing.push({
      ...s,
      phase: "ongoing",
      categoryId: "food",
      categoryLabel: QUEST_CATEGORIES.food.label,
      categoryIcon: QUEST_CATEGORIES.food.icon,
      questCategory: "food",
      points: pointsFor("food"),
    });
  });

  return stepsByPhase;
}

// Stable per-step key used for Supabase quest_completions rows and for
// localStorage progress — must not change once a quest is shown to a user.
function questKeyFor(phaseId, step, idx) {
  return `${phaseId}|${step.categoryId}|${idx}`;
}
