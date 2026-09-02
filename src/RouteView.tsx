import { App } from "./App";
import { Trajectory } from "./Trajectory";

export function RouteView() {
  return window.location.pathname === "/trajectory" ? <Trajectory /> : <App />;
}
