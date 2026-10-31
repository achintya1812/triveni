import type { Concept, Keyword } from "./content";
import { type ClassData, type Content, childRecord, results } from "./running";
import { needsRecheck } from "./rules";

export type BriefLanguage = "en" | "hi";

type GroupPlacement = "language_gap" | "word_problem_gap" | "symbol_gap" | "language_symbol_gap" | "clip_failed";

// The daily brief's wording. Hindi is reviewed by a Hindi speaker (TODO.md, open items).
const say = {
  en: {
    title: (date: string) => `Morning brief, ${date}`,
    list: (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`),
    back: (names: string, many: boolean) => `${names} ${many ? "are" : "is"} back.`,
    missed: (name: string, concepts: string) => `${name} missed ${concepts}.`,
    missedConcept: (n: number, total: number, concept: string, names: string) =>
      `${n} of ${total} missed ${concept} (${names}), and later lessons build on it. Recap it with them in group time, and send catch-up voice notes to their parents.`,
    groups: {
      language_gap: (n: number, names: string, words: string) =>
        `Language group (${n}): ${names}. ${words ? `Teach the Hindi words ${words} first` : "Teach the question's key Hindi words first"}, with the Bhili audio.`,
      word_problem_gap: (n: number, names: string) => `Word-problem group (${n}): ${names}. Practise turning a story into a sum.`,
      symbol_gap: (n: number, names: string) => `Symbol group (${n}): ${names}. Solve a story, then write the sum that matches it.`,
      language_symbol_gap: (n: number, names: string) =>
        `Language and symbol group (${n}): ${names}. Teach the key Hindi words first, then practise turning stories into sums.`,
      clip_failed: (n: number, names: string) =>
        `Bhili clip not followed (${n}): ${names}. They followed the Hindi, so their language profile has been updated.`,
    } satisfies Record<GroupPlacement, unknown>,
    probe: (n: number, list: string) => `Probe group (${n}): ${list}. Run the step-down probe in group time.`,
    startAt: (concept: string) => `start at ${concept}`,
    reteach: (n: number, list: string) => `Reteaching group (${n}): ${list}. Use the reteaching kit.`,
    from: (concept: string) => `from ${concept}`,
    recheck: (n: number, names: string) => `Quick re-check (${n}): ${names}. Seen once; re-check in group time.`,
    nothing: "Nothing needs attention today.",
    word: (k: Keyword) => `${k.roman} (${k.hindi}, "${k.meaning}")`,
    concept: (c: Concept) => c.name,
  },
  hi: {
    title: (date: string) => `सुबह की जानकारी, ${date}`,
    list: (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} और ${items.at(-1)}`),
    // No gender is stored, so the template avoids gendered verbs; Claude's rewording presumes them from names.
    back: (names: string) => `फिर से कक्षा में: ${names}।`,
    missed: (name: string, concepts: string) => `${name} की अनुपस्थिति में पढ़ाया गया: ${concepts}।`,
    missedConcept: (n: number, total: number, concept: string, names: string) =>
      `${total} में से ${n} बच्चे ${concept} के पाठ में अनुपस्थित थे (${names}), और आगे के पाठ इसी पर टिके हैं। समूह-समय में इनके साथ पाठ दोहराएँ, और इनके माता-पिता को कैच-अप वॉइस नोट भेजें।`,
    groups: {
      language_gap: (n: number, names: string, words: string) =>
        `भाषा समूह (${n}): ${names}। ${words ? `पहले ये हिंदी शब्द सिखाएँ: ${words}` : "पहले प्रश्न के मुख्य हिंदी शब्द सिखाएँ"}, भीली ऑडियो के साथ।`,
      word_problem_gap: (n: number, names: string) => `शब्द-प्रश्न समूह (${n}): ${names}। कहानी से सवाल बनाने का अभ्यास कराएँ।`,
      symbol_gap: (n: number, names: string) => `चिह्न समूह (${n}): ${names}। पहले कहानी हल करें, फिर उससे मेल खाता सवाल लिखें।`,
      language_symbol_gap: (n: number, names: string) =>
        `भाषा और चिह्न समूह (${n}): ${names}। पहले मुख्य हिंदी शब्द सिखाएँ, फिर कहानी से सवाल बनाने का अभ्यास कराएँ।`,
      clip_failed: (n: number, names: string) =>
        `भीली क्लिप समझ नहीं आई (${n}): ${names}। हिंदी प्रश्न समझ आया, इसलिए इनकी भाषा-प्रोफ़ाइल बदल दी गई है।`,
    } satisfies Record<GroupPlacement, unknown>,
    probe: (n: number, list: string) => `जाँच समूह (${n}): ${list}। समूह-समय में क्रमवार जाँच (प्रोब) करें।`,
    startAt: (concept: string) => `${concept} से शुरू करें`,
    reteach: (n: number, list: string) => `दोबारा पढ़ाने वाला समूह (${n}): ${list}। पढ़ाने की किट का उपयोग करें।`,
    from: (concept: string) => `${concept} से`,
    recheck: (n: number, names: string) => `त्वरित दोबारा जाँच (${n}): ${names}। यह पैटर्न एक बार दिखा है; समूह-समय में फिर से जाँचें।`,
    nothing: "आज के लिए कोई ख़ास काम नहीं है।",
    word: (k: Keyword) => `${k.hindi} (${k.roman})`,
    concept: (c: Concept) => c.nameHi ?? c.name,
  },
};

const groupOrder: GroupPlacement[] = ["language_gap", "word_problem_gap", "symbol_gap", "language_symbol_gap", "clip_failed"];

// The morning brief for `today`, in the order of IDEA.md's example: who is back and what they missed,
// concepts that many missed, the confirmed groups, the probe group, and the re-check list.
// Claude may reword it later; without a signal this is shown as is.
export function buildDailyBrief(today: string, data: ClassData, content: Content, language: BriefLanguage = "en"): string {
  const t = say[language];
  const all = results(data, content);
  const records = data.children.map((child) => childRecord(child, data, content, all));
  const conceptName = (id: string) => t.concept(content.concepts.find((c) => c.id === id)!);
  const unique = (names: string[]) => [...new Set(names)];
  const lines: string[] = [];

  // 1. Who is back: absent on the day before the latest logged day, present on it.
  const days = [...new Set(data.attendance.map((r) => r.date))].filter((d) => d <= today).sort();
  const absentOn = (childId: string, date: string) =>
    data.attendance.some((r) => r.childId === childId && r.date === date && !r.present);
  const [before, latest] = days.slice(-2);
  if (before && latest) {
    const back = data.children.filter((c) => absentOn(c.id, before) && !absentOn(c.id, latest));
    if (back.length > 0) lines.push(t.back(t.list(back.map((c) => c.name)), back.length > 1));
    for (const child of back) {
      const missed: string[] = [];
      for (const day of days.slice(0, -1).reverse()) {
        if (!absentOn(child.id, day)) break;
        missed.unshift(...data.lessons.filter((l) => l.date === day).map((l) => l.conceptId));
      }
      if (missed.length > 0) lines.push(t.missed(child.name, t.list(unique(missed).map(conceptName))));
    }
  }

  // 2. Concepts that later lessons build on, which some children were never taught.
  for (const concept of content.concepts) {
    if (!content.concepts.some((c) => c.prerequisites.includes(concept.id))) continue;
    const missed = records.filter((r) => r.concepts[concept.id]?.status === "not_taught");
    if (missed.length === 0) continue;
    lines.push(t.missedConcept(missed.length, data.children.length, conceptName(concept.id), t.list(missed.map((r) => r.child.name))));
  }

  const labelled = records.flatMap((r) =>
    Object.entries(r.concepts).flatMap(([conceptId, c]) => (c.label ? [{ record: r, conceptId, label: c.label }] : [])),
  );

  // 3. The confirmed groups. The language group gets the class's most blocking key words.
  const blocking = content.keywords
    .map((k) => ({ k, stumbled: records.reduce((sum, r) => sum + (r.words[k.id]?.stumbled ?? 0), 0) }))
    .filter((w) => w.stumbled > 0)
    .sort((x, y) => y.stumbled - x.stumbled)
    .slice(0, 3)
    .map((w) => t.word(w.k));
  for (const placement of groupOrder) {
    const names = unique(
      labelled.filter((l) => l.label.confirmed && l.label.placement === placement).map((l) => l.record.child.name),
    );
    if (names.length > 0) lines.push(t.groups[placement](names.length, t.list(names), t.list(blocking)));
  }

  // 4. Concept gaps: the probe for those not yet probed, starting at the root; reteaching for the rest.
  // Each child is listed once, with every concept they start from.
  const byChild = (group: typeof labelled, start: (l: (typeof labelled)[number]) => string) =>
    unique(group.map((l) => l.record.child.name)).map((name) => {
      const starts = unique(group.filter((l) => l.record.child.name === name).map(start));
      return `${name} (${t.list(starts)})`;
    });
  const gaps = labelled.filter((l) => l.label.placement === "taught_not_learned");
  const probeGroup = byChild(
    gaps.filter((l) => !l.label.confirmed),
    (l) => t.startAt(conceptName(l.record.root(l.conceptId))),
  );
  if (probeGroup.length > 0) lines.push(t.probe(probeGroup.length, t.list(probeGroup)));
  const reteachGroup = byChild(
    gaps.filter((l) => l.label.confirmed),
    (l) => {
      const probe = data.probes.filter((p) => p.childId === l.record.child.id && p.conceptId === l.conceptId).at(-1);
      return t.from(conceptName(probe?.restartConceptId ?? l.record.root(l.conceptId)));
    },
  );
  if (reteachGroup.length > 0) lines.push(t.reteach(reteachGroup.length, t.list(reteachGroup)));

  // 5. Patterns seen once: a quick re-check in group time.
  const recheck = unique(labelled.filter((l) => needsRecheck(l.label)).map((l) => l.record.child.name));
  if (recheck.length > 0) lines.push(t.recheck(recheck.length, t.list(recheck)));

  return [t.title(today), ...(lines.length > 0 ? lines.map((l) => `- ${l}`) : [t.nothing])].join("\n");
}
