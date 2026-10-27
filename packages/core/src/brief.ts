import type { Keyword } from "./content";
import type { Placement } from "./rules";

export interface BriefInput {
  conceptName: string;
  keywords: Keyword[];
  children: { name: string; placement: Placement }[];
}

// The fixed template. Claude may reword it later; without a signal this is shown as is.
export function buildBrief({ conceptName, keywords, children }: BriefInput): string {
  const words = keywords.map((k) => `${k.roman} (${k.hindi}, "${k.meaning}")`).join(", ");
  const actions: [Placement, string, string][] = [
    ["language_gap", "Language gap", `teach the Hindi words ${words} first, with the Bhili audio`],
    ["word_problem_gap", "Word-problem gap", "practise the three stories: turn each story into a sum"],
    ["never_taught", "Never taught (absent)", `recap the lesson on ${conceptName}`],
    ["taught_not_learned", "Taught but not learned", "play the Bhili reteaching clip and use real objects"],
    ["unclear", "Unclear", "check again next time"],
    ["ready", "Ready", "move on"],
  ];

  const lines = [`Check on ${conceptName}: ${children.length} children.`];
  for (const [placement, label, action] of actions) {
    const names = children.filter((c) => c.placement === placement).map((c) => c.name);
    if (names.length === 0) continue;
    lines.push(`- ${label} (${names.length}): ${names.join(", ")}. ${capitalise(action)}.`);
  }
  return lines.join("\n");
}

function capitalise(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
