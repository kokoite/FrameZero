import React from "react";
import { createRoot } from "react-dom/client";
import { compileStudioProject } from "@framezero/compiler";
import { parallelComponentsProject } from "@framezero/fixtures";
import "./styles.css";

const compileResult = compileStudioProject(parallelComponentsProject);
const nodes = compileResult.document.nodes;
const machine = compileResult.document.machines[0];
const activeState = machine?.states[1];

function App() {
  return (
    <main className="studio-shell">
      <aside className="panel left-panel">
        <div className="panel-header">
          <p className="eyebrow">FrameZero Studio</p>
          <h1>{parallelComponentsProject.name}</h1>
        </div>

        <section>
          <h2>Layers</h2>
          <div className="layer-list">
            {nodes.map((node) => (
              <div className="layer-row" key={node.id}>
                <span className={`kind-dot kind-${node.kind}`} />
                <div>
                  <strong>{node.id}</strong>
                  <small>{node.kind}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Roles</h2>
          <div className="role-list">
            {Object.values(parallelComponentsProject.roles).map((role) => (
              <span className="role-pill" key={role.id}>
                {role.name}
              </span>
            ))}
          </div>
        </section>
      </aside>

      <section className="canvas-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local Authoring</p>
            <h2>Parallel Component Gesture Cue</h2>
          </div>
          <div className="runtime-status">
            <span className="status-light" />
            Runtime JSON valid
          </div>
        </header>

        <div className="canvas-frame">
          <div className="phone-canvas">
            <div className="grid" />
            <div className="node-card">Card</div>
            <div className="node-icon" />
            <div className="node-title">Drag ready</div>
            <svg className="motion-path" viewBox="0 0 360 620" aria-hidden="true">
              <path d="M 145 310 C 170 280, 205 280, 230 310" />
              <circle cx="230" cy="310" r="5" />
            </svg>
          </div>
        </div>
      </section>

      <aside className="panel right-panel">
        <section>
          <h2>Phase</h2>
          {activeState ? (
            <div className="phase-card">
              <strong>{activeState.id}</strong>
              <span>{activeState.values.length} target changes</span>
            </div>
          ) : null}
        </section>

        <section>
          <h2>Parallel Targets</h2>
          <div className="target-list">
            {activeState?.values.map((value, index) => (
              <div className="target-row" key={`${JSON.stringify(value.select)}-${index}`}>
                <code>{selectorLabel(value.select)}</code>
                <span>{JSON.stringify(value.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="json-section">
          <h2>Generated .motion.json</h2>
          <pre>{compileResult.json}</pre>
        </section>
      </aside>
    </main>
  );
}

function selectorLabel(selector: { id?: string | undefined; role?: string | undefined; properties: readonly string[] }) {
  const target = selector.id ? `#${selector.id}` : `.${selector.role}`;
  return `${target} -> ${selector.properties.join(", ")}`;
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
