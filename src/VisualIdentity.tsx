function stockGlyph(skuId: string) {
  switch (skuId) {
    case "chicken":
      return <><ellipse cx="14" cy="13" rx="7" ry="5" /><path d="m19 16 7 7m-1-3 3-1m-3 1-1 3" /></>;
    case "patties":
      return <><path d="M7 16c1-6 5-9 11-9s10 3 11 9H7Z" /><path d="M6 19h24M8 23h20M10 27h16" /></>;
    case "buns":
      return <><path d="M7 20c0-8 4-12 11-12s11 4 11 12H7Z" /><path d="M7 23h22M13 13l1-2m5 3 1-2m4 3 1-2" /></>;
    case "fries":
      return <><path d="m9 15 2 15h14l2-15H9Z" /><path d="M12 15 11 7m6 8V5m5 10 2-8" /></>;
    case "lettuce":
      return <><path d="M18 30c-7 0-12-5-12-12 0-3 2-5 5-5 0-4 3-7 7-7s7 3 7 7c3 0 5 2 5 5 0 7-5 12-12 12Z" /><path d="M18 10v16m0-8-6-3m6 7 7-4" /></>;
    case "tomatoes":
      return <><circle cx="18" cy="19" r="11" /><path d="m18 8 2-4m-2 4-5-2m5 2 5-2m-5 2-3 4m3-4 3 4" /></>;
    case "cheese":
      return <><path d="m7 27 4-16 18 16H7Z" /><circle cx="15" cy="21" r="1.5" /><circle cx="20" cy="24" r="1" /><circle cx="15" cy="15" r="1" /></>;
    case "cola":
      return <><path d="M12 7h12l-1 5 3 4-2 14H12l-2-14 3-4-1-5Z" /><path d="M13 12h10m-11 6h13" /></>;
    case "oil":
      return <path d="M18 5c0 0-9 11-9 17a9 9 0 0 0 18 0C27 16 18 5 18 5Zm-4 18c0 2 1 3 3 4" />;
    case "boxes":
      return <><path d="m7 12 11-5 11 5-11 5-11-5Z" /><path d="M7 12v13l11 5 11-5V12M18 17v13" /></>;
    default:
      return <><rect x="8" y="8" width="20" height="20" rx="3" /><path d="M12 14h12m-12 5h12m-12 5h7" /></>;
  }
}

export function StockItemThumbnail({ skuId }: Readonly<{ skuId: string }>) {
  return (
    <span className="item-thumbnail" aria-hidden="true">
      <svg viewBox="0 0 36 36" focusable="false">
        {stockGlyph(skuId)}
      </svg>
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const value = parts.slice(0, 2).map((part) => part.charAt(0)).join("");
  return value.toUpperCase() || "?";
}

export function StaffAvatar({ name }: Readonly<{ name: string }>) {
  return <span className="staff-avatar" aria-hidden="true">{initials(name)}</span>;
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">C</span>;
}

export function AgentGlyph() {
  return (
    <span className="agent-glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 3c.7 4.5 2.5 6.3 7 7-4.5.7-6.3 2.5-7 7-.7-4.5-2.5-6.3-7-7 4.5-.7 6.3-2.5 7-7Z" />
        <path d="M19 16.5c.25 1.7 1.05 2.5 2.75 2.75-1.7.25-2.5 1.05-2.75 2.75-.25-1.7-1.05-2.5-2.75-2.75 1.7-.25 2.5-1.05 2.75-2.75ZM4.5 3c.2 1.3.8 1.9 2.1 2.1-1.3.2-1.9.8-2.1 2.1-.2-1.3-.8-1.9-2.1-2.1 1.3-.2 1.9-.8 2.1-2.1Z" />
      </svg>
    </span>
  );
}
