import { useStore, type ScreenId } from "./store";
import { Home } from "./screens/Home";
import { Setup } from "./screens/Setup";
import { Products } from "./screens/Products";
import { Dashboard } from "./screens/Dashboard";
import { ScenarioScreen } from "./screens/ScenarioScreen";
import { Budget } from "./screens/Budget";
import { Sensitivity } from "./screens/Sensitivity";
import { Guide } from "./screens/Guide";
import { Sources, SOURCE_PAGES } from "./sources/Sources";

/** Rail: three sections separated by rules — inputs · results · reference (Excel tab order within each). */
const INPUTS: [ScreenId, string][] = [["home", "⌂ Home"], ["setup", "Setup"], ["products", "Products"]];
const RESULTS: [ScreenId, string][] = [["dash", "CE Dashboard"], ["bia", "Budget Impact"], ["scen", "Scenario"], ["sens", "Sensitivity"]];
const REFERENCE: [ScreenId, string][] = [["guide", "Guide"], ["sources", "Sources"]];

export function App() {
  const { screen, go, srcPage, goSrc } = useStore();
  const btn = ([id, label]: [ScreenId, string]) => <button key={id} className={screen === id ? "here" : ""} onClick={() => go(id)} aria-current={screen === id ? "page" : undefined}>{label}</button>;
  return (
    <div className="app">
      <nav className="rail" aria-label="Navigate">
        {INPUTS.map(btn)}
        <div className="divider" />
        {RESULTS.map(btn)}
        <div className="divider" />
        {REFERENCE.map(btn)}
        {screen === "sources" && (
          <>
            <div className="divider" />
            <div className="rl">Source pages</div>
            {SOURCE_PAGES.map((p) => <button key={p.id} className={`sub${srcPage === p.id ? " here" : ""}`} onClick={() => goSrc(p.id)}>{p.label}</button>)}
          </>
        )}
      </nav>
      <main>
        {screen === "home" && <Home />}
        {screen === "setup" && <Setup />}
        {screen === "products" && <Products />}
        {screen === "dash" && <Dashboard />}
        {screen === "scen" && <ScenarioScreen />}
        {screen === "bia" && <Budget />}
        {screen === "sens" && <Sensitivity />}
        {screen === "guide" && <Guide />}
        {screen === "sources" && <Sources />}
      </main>
    </div>
  );
}
