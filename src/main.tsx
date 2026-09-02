import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { RouteView } from "./RouteView";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element is missing.");
}

createRoot(root).render(
  <StrictMode>
    <RouteView />
  </StrictMode>,
);
