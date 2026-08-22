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
  espooHome: { name: "City of Espoo — official site", url: "https://www.espoo.fi/en" },
  helsinkiHome: { name: "City of Helsinki — official site", url: "https://www.hel.fi/en" },
};

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
 * Categories the user can pick as "of interest to them" (per the team's own
 * Miro plan: pick categories -> AI asks a short conditional questionnaire ->
 * answers feed the roadmap generator below).
 */
const CATEGORIES = [
  {
    id: "immigration",
    label: "Visa & Residence Permit",
    icon: "🛂",
    blurb: "Migri applications, timelines, and what happens after you land.",
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
    ],
  },
  {
    id: "registration",
    label: "Registration & Personal ID",
    icon: "🪪",
    blurb: "DVV, the personal identity code (henkilötunnus), and your municipality of residence.",
    questions: [
      {
        id: "arrivedYet",
        type: "select",
        label: "Have you arrived in Finland yet?",
        options: ["Not yet", "Yes, within the last month", "Yes, more than a month ago"],
      },
    ],
  },
  {
    id: "housing",
    label: "Housing",
    icon: "🏠",
    blurb: "Where families and students typically look, and what to check before signing.",
    questions: [
      {
        id: "purpose",
        type: "select",
        label: "Are you renting for work, study, or family relocation?",
        options: ["Work", "Study", "Family relocation"],
      },
      {
        id: "areaPreference",
        type: "text",
        label: "Any preferred area or neighbourhood? (optional)",
        placeholder: "e.g. near Otaniemi / Leppävaara / Tapiola",
      },
    ],
  },
  {
    id: "education",
    label: "Education",
    icon: "🎓",
    blurb: "Daycare and school for your children, or further studies for yourself.",
    questions: [
      {
        id: "who",
        type: "select",
        label: "Is this mainly for yourself or for your children?",
        options: ["My children", "Myself", "Both"],
      },
      {
        id: "childAges",
        type: "text",
        label: "If for your children — how many, and what ages?",
        placeholder: "e.g. two kids, ages 4 and 9",
        showIf: { field: "who", oneOf: ["My children", "Both"] },
      },
      {
        id: "instructionLanguage",
        type: "select",
        label: "Preferred language of instruction for your children?",
        options: ["Finnish", "Swedish", "English / international / bilingual", "Not sure yet"],
        showIf: { field: "who", oneOf: ["My children", "Both"] },
      },
      {
        id: "ownQualification",
        type: "select",
        label: "If for yourself — what are you aiming for?",
        options: ["Bachelor's degree", "Master's degree", "Doctoral studies", "Not applicable"],
        showIf: { field: "who", oneOf: ["Myself", "Both"] },
      },
    ],
  },
  {
    id: "career",
    label: "Career & Job Market",
    icon: "💼",
    blurb: "Finding work, understanding the local market, and using employment services.",
    questions: [
      {
        id: "field",
        type: "text",
        label: "What field do you work in?",
        placeholder: "e.g. software engineering, nursing, academia",
      },
      {
        id: "jobStatus",
        type: "select",
        label: "Job search status?",
        options: ["Already have a Finnish job offer", "Actively searching", "Just researching options"],
      },
    ],
  },
  {
    id: "language",
    label: "Language & Integration",
    icon: "🗣️",
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
    id: "healthcare",
    label: "Healthcare & Social Security",
    icon: "🩺",
    blurb: "Kela, public healthcare access, and what changes once you're registered.",
    questions: [
      {
        id: "ongoingNeeds",
        type: "select",
        label: "Any ongoing medical needs, medication, or family members needing regular care?",
        options: ["No", "Yes"],
      },
    ],
  },
  {
    id: "community",
    label: "Language spoken at home & Community",
    icon: "🤝",
    blurb: "Who's with you, what languages you speak, and finding people with shared interests.",
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
    ],
  },
];

/*
 * Roadmap step generators — one per category. Each returns an array of
 * { phase, title, why, action, source } grounded in SOURCES above.
 * "why" is where personalization happens: it reads the profile + answers.
 */
const ROADMAP_GENERATORS = {
  immigration(profile, a) {
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
    return steps;
  },

  registration(profile, a) {
    const steps = [];
    steps.push({
      phase: a.arrivedYet === "Not yet" ? "week2" : "week2",
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
    return steps;
  },

  housing(profile, a) {
    return [
      {
        phase: "before",
        title: "Start housing research before you land",
        why: `${a.purpose ? `Renting for ${a.purpose.toLowerCase()} ` : "Housing "}in the Espoo/Helsinki region moves fast, especially near universities and tech employers — starting from India saves your first two weeks.`,
        action: "Start with InfoFinland's settling-in guidance, then use the destination city's own site to search for municipal and student housing options.",
        source: SOURCES.infoFinlandHome,
      },
      {
        phase: "before",
        title: `Check ${profile.destination || "your destination city"}'s own housing services`,
        why: a.areaPreference ? `You mentioned wanting to be near ${a.areaPreference} — city sites let you filter by area.` : "Municipal sites list both city-owned rentals and general housing guidance for newcomers.",
        action: "Search the official city site for 'housing' or 'asuminen' — city-run rentals are often more newcomer-friendly than the open market.",
        source: profile.destination === "Helsinki" ? SOURCES.helsinkiHome : SOURCES.espooHome,
      },
      {
        phase: "week2",
        title: "Register your new address once you sign a lease",
        why: "Your address on file with DVV needs to match where you actually live — this affects mail, healthcare centre assignment, and school catchment.",
        action: "Update your address with DVV as soon as your lease starts.",
        source: SOURCES.dvvInternationalMove,
      },
    ];
  },

  education(profile, a) {
    const steps = [];
    if (a.who === "My children" || a.who === "Both") {
      const city = profile.destination === "Helsinki" ? "helsinki" : "espoo";
      steps.push({
        phase: "before",
        title: "Apply for early childhood education / daycare early",
        why: a.childAges ? `You told us: ${a.childAges}. Daycare and pre-primary places in the capital region fill up, and non-resident applications can usually start before you've even registered your address.` : "Daycare places in the capital region fill up — start the application before you arrive if you can.",
        action: city === "helsinki" ? "Apply through Helsinki's Edlevo e-service." : "Apply through Espoo's eVaka e-service.",
        source: city === "helsinki" ? SOURCES.helsinkiEce : SOURCES.espooEce,
      });
      if (a.instructionLanguage) {
        steps.push({ phase: "month1", title: `Confirm ${a.instructionLanguage} availability at nearby schools`, why: `You told us you're aiming for ${a.instructionLanguage} instruction — availability varies a lot by area, so confirming early avoids a surprise catchment assignment.`, action: "Cross-check InfoFinland's early childhood education overview against your city's own school/daycare finder.", source: SOURCES.infoFinlandEce });
      }
      steps.push({ phase: "month3", title: "Know about free pre-primary education for 5-year-olds", why: "If you have a child turning 5, Espoo (and most Finnish municipalities) offer free pre-primary education — easy to miss if you're not looking for it.", action: "Check eligibility and enrolment windows.", source: SOURCES.espooEceFree5 });
    }
    if (a.who === "Myself" || a.who === "Both") {
      steps.push({
        phase: "month1",
        title: `Plan your ${a.ownQualification || "further studies"} pathway`,
        why: "Finnish universities have specific application windows and language requirements that differ from Indian ones — worth mapping before you commit time to one institution.",
        action: "Confirm your target programme's language of instruction, intake dates, and whether your existing qualification is recognised.",
        source: SOURCES.infoFinlandHome,
      });
    }
    return steps;
  },

  career(profile, a) {
    const steps = [];
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

  healthcare(profile, a) {
    const steps = [{
      phase: "week2",
      title: "Understand your Kela / public healthcare eligibility",
      why: "Eligibility for Kela benefits and public healthcare depends on your permit type and length of stay — it is not automatic on arrival.",
      action: "Read Kela's guide on getting benefits when you move to Finland.",
      source: SOURCES.kelaWhenMoveIn,
    }];
    if (a.ongoingNeeds === "Yes") {
      steps.push({ phase: "week2", title: "Plan continuity of care for ongoing medical needs", why: "You told us there are ongoing medical needs in your family — sort out prescriptions and medical records transfer before routine care access kicks in.", action: "Read Kela's plain-language guide on moving to Finland, and bring existing medical records/prescriptions translated if possible.", source: SOURCES.kelaGuide });
    }
    return steps;
  },

  community(profile, a) {
    const steps = [];
    const langs = (a.familyLanguages || []).filter((l) => l !== "Other");
    steps.push({
      phase: "ongoing",
      title: langs.length ? `Find ${langs.join(" / ")}-speaking community groups` : "Find community groups in your languages",
      why: "Community and language groups aren't centrally listed anywhere official — they mostly live on Facebook and Meetup, organised by the community itself.",
      action: "Search Facebook Groups and Meetup for your city name plus 'Indian community' or your specific language, once you've arrived and can verify a group is currently active.",
      source: SOURCES.infoFinlandHome,
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
    return steps;
  },
};

function buildRoadmap(profile, categoryAnswers) {
  const stepsByPhase = {};
  PHASES.forEach((p) => (stepsByPhase[p.id] = []));

  Object.keys(categoryAnswers).forEach((catId) => {
    const gen = ROADMAP_GENERATORS[catId];
    if (!gen) return;
    const answers = categoryAnswers[catId] || {};
    const steps = gen(profile, answers) || [];
    steps.forEach((s) => {
      const category = CATEGORIES.find((c) => c.id === catId);
      stepsByPhase[s.phase].push({ ...s, categoryId: catId, categoryLabel: category ? category.label : catId, categoryIcon: category ? category.icon : "•" });
    });
  });

  return stepsByPhase;
}
