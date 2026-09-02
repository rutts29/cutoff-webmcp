export const SECTIONS = ["order", "stock", "labor", "log"] as const;

export type Section = (typeof SECTIONS)[number];

export type SectionDefinition = Readonly<{
  id: Section;
  label: string;
  path: "/" | "/stock" | "/labor" | "/log";
  description: string;
  steps: readonly [
    Readonly<{ title: string; detail: string }>,
    Readonly<{ title: string; detail: string }>,
    Readonly<{ title: string; detail: string }>,
  ];
}>;

export const SECTION_DEFINITIONS: readonly SectionDefinition[] = [
  {
    id: "order",
    label: "Order",
    path: "/",
    description: "Review the supplier order before cutoff.",
    steps: [
      { title: "Record what changed", detail: "Signals, pins, and stock math" },
      { title: "Preview the replan", detail: "Covers, labor, cases, and cost" },
      { title: "Adopt and hand off", detail: "Working order stays local" },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    path: "/stock",
    description: "Review stock position and waste risk.",
    steps: [
      { title: "Count the shelf", detail: "On hand, expiring, and last counted" },
      { title: "Log what was wasted", detail: "Item, quantity, reason, and cost" },
      { title: "Refresh the order", detail: "New counts feed the shared plan" },
    ],
  },
  {
    id: "labor",
    label: "Labor",
    path: "/labor",
    description: "Match the service-day roster to the covers you're actually expecting.",
    steps: [
      { title: "Check the roster against the forecast", detail: "Required, scheduled, and gap" },
      { title: "Preview shift changes", detail: "Releases and on-call cover" },
      { title: "Adopt the roster", detail: "Keep an undo point in this browser" },
    ],
  },
  {
    id: "log",
    label: "Shift log",
    path: "/log",
    description: "One record of the shift, for whoever opens tomorrow.",
    steps: [
      { title: "Read what happened", detail: "Every section, action, and time" },
      { title: "Add what the next shift needs", detail: "One note in the shared record" },
      { title: "Download", detail: "Filtered service-day JSON" },
    ],
  },
] as const;

export function sectionFromPath(pathname: string): Section {
  return (
    SECTION_DEFINITIONS.find((section) => section.path === pathname)?.id ??
    "order"
  );
}

export function pathForSection(section: Section): SectionDefinition["path"] {
  return SECTION_DEFINITIONS.find((candidate) => candidate.id === section)!
    .path;
}
