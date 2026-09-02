import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { App } from "./App";
import {
  SECTION_DEFINITIONS,
  pathForSection,
  sectionFromPath,
  type Section,
} from "./domain/sections";
import { createReviewStore } from "./store/reviewStore";
import { Trajectory } from "./Trajectory";

export function RouteView() {
  const store = useMemo(() => createReviewStore(), []);
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const readPath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", readPath);
    return () => window.removeEventListener("popstate", readPath);
  }, []);

  useEffect(() => {
    if (pathname === "/trajectory") {
      document.title = "Cutoff · How this was built";
      return;
    }
    const section = sectionFromPath(pathname);
    const label = SECTION_DEFINITIONS.find((candidate) => candidate.id === section)?.label ?? "Order";
    document.title = `Cutoff · ${label}`;
  }, [pathname]);

  const navigate = useCallback((section: Section) => {
    const nextPath = pathForSection(section);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    flushSync(() => setPathname(nextPath));
  }, []);

  return pathname === "/trajectory" ? (
    <Trajectory />
  ) : (
    <App store={store} section={sectionFromPath(pathname)} navigate={navigate} />
  );
}
