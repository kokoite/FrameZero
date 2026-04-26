import React, { useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  compileStudioProject,
  type StudioNode,
  type StudioPhase,
  type StudioProject
} from "@framezero/compiler";
import { parallelComponentsProject } from "@framezero/fixtures";
import type { MotionAssignment, MotionPropertySelector, MotionRule, MotionSpec } from "@framezero/schema";
import "./styles.css";

type TargetMode = "selected" | "role";
type NodeKindChoice = StudioNode["kind"];
type SendState = "idle" | "sending" | "sent" | "failed";

const storageKey = "framezero.studio.project.v1";
const canvasWidth = 360;
const canvasHeight = 620;
const canvasCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };
const transformProperties: MotionPropertySelector["properties"] = ["offset.x", "offset.y", "rotation", "scale", "opacity"];

function App() {
  const [project, setProject] = useState<StudioProject>(() => loadStoredProject());
  const [selectedNodeId, setSelectedNodeId] = useState(project.editor?.selection[0] ?? project.rootNodeId);
  const [selectedPhaseId, setSelectedPhaseId] = useState(project.phaseOrder[0] ?? "");
  const [targetMode, setTargetMode] = useState<TargetMode>("selected");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [bridgeMessage, setBridgeMessage] = useState("Bridge idle");

  const compileResult = useMemo(() => {
    try {
      return { ok: true as const, value: compileStudioProject(project) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [project]);

  const selectedNode = project.nodes[selectedNodeId] ?? project.nodes[project.rootNodeId];
  const selectedPhase = project.phases[selectedPhaseId] ?? project.phases[project.phaseOrder[0] ?? ""];
  const phaseTargets = selectedPhase ? readPhaseTargets(selectedPhase, selectedNode, targetMode) : defaultPhaseTargets();
  const phaseRule = selectedPhase ? selectedPhase.rules[0] : undefined;

  function patchProject(updater: (draft: StudioProject) => void) {
    setProject((current) => {
      const draft = cloneProject(current);
      updater(draft);
      saveStoredProject(draft);
      return draft;
    });
  }

  function addNode(kind: NodeKindChoice) {
    patchProject((draft) => {
      const id = uniqueId(kind, draft.nodes);
      const name = titleCase(kind);
      const node: StudioNode = {
        id,
        name,
        kind,
        parentId: draft.rootNodeId,
        childIds: [],
        roles: ["actor"],
        layout: kind === "text" ? {} : { width: kind === "circle" ? 62 : 130, height: kind === "circle" ? 62 : 82 },
        style: defaultStyle(kind, name),
        presentation: {
          "offset.x": 0,
          "offset.y": 0,
          rotation: 0,
          scale: 1,
          opacity: 1
        }
      };

      draft.nodes[id] = node;
      draft.nodes[draft.rootNodeId]?.childIds.push(id);
      draft.roles.actor ??= { id: "actor", name: "actor", description: "Elements animated together" };
      draft.editor = { selection: [id], viewportPreset: "iphone" };
      setSelectedNodeId(id);
    });
  }

  function duplicateSelectedNode() {
    if (!selectedNode || selectedNode.id === project.rootNodeId) return;
    patchProject((draft) => {
      const source = draft.nodes[selectedNode.id];
      if (!source) return;
      const id = uniqueId(source.kind, draft.nodes);
      draft.nodes[id] = {
        ...clone(source),
        id,
        name: `${source.name} Copy`,
        parentId: draft.rootNodeId,
        childIds: [],
        presentation: {
          ...source.presentation,
          "offset.x": numberValue(source.presentation["offset.x"]) + 34,
          "offset.y": numberValue(source.presentation["offset.y"]) + 34
        }
      };
      draft.nodes[draft.rootNodeId]?.childIds.push(id);
      setSelectedNodeId(id);
    });
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.id === project.rootNodeId) return;
    patchProject((draft) => {
      delete draft.nodes[selectedNode.id];
      for (const node of Object.values(draft.nodes)) {
        node.childIds = node.childIds.filter((childId) => childId !== selectedNode.id);
      }
      setSelectedNodeId(draft.rootNodeId);
    });
  }

  function updateSelectedNode(updater: (node: StudioNode) => void) {
    if (!selectedNode) return;
    patchProject((draft) => {
      const node = draft.nodes[selectedNode.id];
      if (node) updater(node);
    });
  }

  function updateSelectedRole(value: string) {
    if (!selectedNode) return;
    patchProject((draft) => {
      const node = draft.nodes[selectedNode.id];
      if (!node) return;
      const role = slug(value || "actor");
      node.roles = [role];
      draft.roles[role] ??= { id: role, name: role };
    });
  }

  function updateSelectedPhase(updater: (phase: StudioPhase) => void) {
    if (!selectedPhase) return;
    patchProject((draft) => {
      const phase = draft.phases[selectedPhase.id];
      if (phase) updater(phase);
    });
  }

  function updatePhaseTarget(property: MotionAssignment["select"]["properties"][number], value: number) {
    updateSelectedPhase((phase) => {
      const selector: MotionPropertySelector = targetMode === "role" && selectedNode?.roles[0]
        ? { role: selectedNode.roles[0], properties: [property] }
        : { id: selectedNode?.id ?? project.rootNodeId, properties: [property] };
      const index = phase.targets.findIndex((target) => sameTarget(target, selector));
      const assignment = { select: selector, value } satisfies MotionAssignment;
      if (index >= 0) {
        phase.targets[index] = assignment;
      } else {
        phase.targets.push(assignment);
      }
      ensureRuleCovers(phase, selector, property);
    });
  }

  function updateMotionSpec(spec: MotionSpec) {
    updateSelectedPhase((phase) => {
      const selector = targetMode === "role" && selectedNode?.roles[0]
        ? { role: selectedNode.roles[0], properties: transformProperties }
        : { id: selectedNode?.id ?? project.rootNodeId, properties: transformProperties };
      const existing = phase.rules.find((rule) => sameNodeSelector(rule.select, selector));
      if (existing) {
        existing.select = selector;
        existing.motion = spec;
      } else {
        phase.rules.push({ select: selector, motion: spec });
      }
      if (phase.arcs.length > 0) {
        phase.arcs = phase.arcs.map((arc) => ({ ...arc, motion: spec }));
      }
    });
  }

  function addPhase() {
    patchProject((draft) => {
      const phaseId = uniqueId("phase", draft.phases);
      const node = draft.nodes[selectedNodeId] ?? draft.nodes[draft.rootNodeId];
      const selector: MotionPropertySelector = { id: node?.id ?? draft.rootNodeId, properties: transformProperties };
      const nodeId = node?.id ?? draft.rootNodeId;
      draft.phases[phaseId] = {
        id: phaseId,
        name: `Phase ${draft.phaseOrder.length + 1}`,
        mode: "absolute",
        startDelay: 0,
        nextMode: "atTime",
        nextAt: 1,
        targets: [
          assignment(nodeId, "offset.x", 80),
          assignment(nodeId, "offset.y", -80),
          assignment(nodeId, "scale", 1.1),
          assignment(nodeId, "opacity", 1)
        ],
        rules: [{ select: selector, motion: { type: "spring", response: 0.75, dampingFraction: 0.72 } }],
        arcs: [],
        jiggles: [],
        actions: []
      };
      draft.phaseOrder.push(phaseId);
      setSelectedPhaseId(phaseId);
    });
  }

  function deletePhase() {
    if (!selectedPhase) return;
    patchProject((draft) => {
      delete draft.phases[selectedPhase.id];
      draft.phaseOrder = draft.phaseOrder.filter((phaseId) => phaseId !== selectedPhase.id);
      setSelectedPhaseId(draft.phaseOrder[0] ?? "");
    });
  }

  function toggleArc(enabled: boolean) {
    updateSelectedPhase((phase) => {
      if (!enabled) {
        phase.arcs = [];
        return;
      }

      const spec = phase.rules[0]?.motion ?? { type: "spring", response: 0.75, dampingFraction: 0.72 };
      const selector = targetMode === "role" && selectedNode?.roles[0]
        ? { role: selectedNode.roles[0] }
        : { id: selectedNode?.id ?? project.rootNodeId };
      phase.arcs = [{
        select: selector,
        x: "offset.x",
        y: "offset.y",
        direction: "clockwise",
        bend: 110,
        motion: spec
      }];
    });
  }

  function toggleJiggle(enabled: boolean) {
    updateSelectedPhase((phase) => {
      if (!enabled) {
        phase.jiggles = [];
        return;
      }

      const selector: MotionPropertySelector = targetMode === "role" && selectedNode?.roles[0]
        ? { role: selectedNode.roles[0], properties: ["rotation"] }
        : { id: selectedNode?.id ?? project.rootNodeId, properties: ["rotation"] };
      phase.jiggles = [{
        select: selector,
        amplitude: 18,
        duration: phase.rules[0]?.motion.type === "timed" ? phase.rules[0].motion.duration : 0.75,
        cycles: 8,
        startDirection: "anticlockwise",
        decay: 0.18
      }];
    });
  }

  function toggleAction(type: "particles" | "components" | "shake" | "haptic", enabled: boolean) {
    updateSelectedPhase((phase) => {
      const blocked = new Set([
        type === "particles" ? "emitParticles" : "",
        type === "components" ? "spawnComponents" : "",
        type === "shake" ? "screenShake" : "",
        type === "haptic" ? "haptic" : ""
      ]);
      phase.actions = phase.actions.filter((action) => !blocked.has(String(action.type)));
      if (!enabled) return;

      if (type === "particles") {
        phase.actions.push({
          type: "emitParticles",
          id: `${phase.id}-particles`,
          selector: selectedNode?.id === project.rootNodeId ? undefined : { id: selectedNode?.id ?? project.rootNodeId },
          count: 34,
          duration: 0,
          angle: { min: 0, max: 360 },
          distance: { min: 24, max: 150 },
          particle: {
            kind: "circle",
            layout: { width: 7, height: 7 },
            style: { backgroundColor: "#67E8F9" },
            from: { scale: 1, opacity: 1 },
            to: { scale: 0.08, opacity: 0 },
            motion: { type: "timed", duration: 0.72, easing: "easeOut" },
            lifetime: 0.72
          }
        });
      } else if (type === "components") {
        phase.actions.push({
          type: "spawnComponents",
          id: `${phase.id}-components`,
          selector: selectedNode?.id === project.rootNodeId ? undefined : { id: selectedNode?.id ?? project.rootNodeId },
          components: [
            spawnedComponent(`${phase.id}-ghost-a`, -74),
            spawnedComponent(`${phase.id}-ghost-b`, 74)
          ]
        });
      } else if (type === "shake") {
        phase.actions.push({ type: "screenShake", amplitude: 8, duration: 0.32, frequency: 26, decay: 1.2 });
      } else {
        phase.actions.push({ type: "haptic", style: "medium", intensity: 0.82 });
      }
    });
  }

  async function sendToSimulator() {
    if (!compileResult.ok) {
      setSendState("failed");
      setBridgeMessage(compileResult.error);
      return;
    }

    setSendState("sending");
    setBridgeMessage("Sending to local bridge");
    try {
      const response = await fetch("http://127.0.0.1:8787/document", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId: project.id,
          reason: "studio-send",
          autoPlay: true,
          resetBeforePlay: true,
          json: compileResult.value.document
        })
      });
      const result = await response.json() as { ok?: boolean; revision?: number; previewClients?: number; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? `Bridge returned ${response.status}`);
      }
      setSendState("sent");
      setBridgeMessage(`Sent r${result.revision}; simulator clients ${result.previewClients}`);
    } catch (error) {
      setSendState("failed");
      setBridgeMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function resetProject() {
    const fresh = cloneProject(parallelComponentsProject);
    saveStoredProject(fresh);
    setProject(fresh);
    setSelectedNodeId(fresh.editor?.selection[0] ?? fresh.rootNodeId);
    setSelectedPhaseId(fresh.phaseOrder[0] ?? "");
    setBridgeMessage("Reset to fixture");
  }

  function downloadJson() {
    if (!compileResult.ok) return;
    const blob = new Blob([compileResult.value.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.motion.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="studio-shell">
      <aside className="panel left-panel">
        <div className="panel-header">
          <p className="eyebrow">FrameZero Studio</p>
          <h1>{project.name}</h1>
          <p className="muted">Create components, group them with roles, then animate those roles in parallel.</p>
        </div>

        <section>
          <div className="section-heading">
            <h2>Components</h2>
            <span>{Object.keys(project.nodes).length}</span>
          </div>
          <div className="button-grid">
            <button type="button" onClick={() => addNode("circle")}>Add Circle</button>
            <button type="button" onClick={() => addNode("roundedRectangle")}>Add Rect</button>
            <button type="button" onClick={() => addNode("text")}>Add Text</button>
            <button type="button" onClick={duplicateSelectedNode} disabled={!selectedNode || selectedNode.id === project.rootNodeId}>Duplicate</button>
          </div>
          <div className="layer-list">
            {orderedNodes(project).map((node) => (
              <button
                type="button"
                className={`layer-row ${selectedNodeId === node.id ? "selected" : ""}`}
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <span className={`kind-dot kind-${node.kind}`} />
                <div>
                  <strong>{node.name}</strong>
                  <small>#{node.id} · {node.kind}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="section-heading">
            <h2>Roles</h2>
            <span>parallel targets</span>
          </div>
          <div className="role-list">
            {Object.values(project.roles).map((role) => (
              <span className="role-pill" key={role.id}>{role.name}</span>
            ))}
          </div>
        </section>
      </aside>

      <section className="canvas-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local Preview</p>
            <h2>{selectedPhase?.name ?? "No phase selected"}</h2>
          </div>
          <div className={`runtime-status ${compileResult.ok ? "ok" : "bad"}`}>
            <span className="status-light" />
            {compileResult.ok ? "Runtime JSON valid" : "Schema issue"}
          </div>
        </header>

        <div className="canvas-frame">
          <div className="phone-canvas">
            <div className="grid" />
            <div className="axis x-axis" />
            <div className="axis y-axis" />
            <span className="origin-label">origin</span>
            {orderedNodes(project)
              .filter((node) => node.id !== project.rootNodeId)
              .map((node) => (
                <CanvasNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedNodeId}
                  {...(selectedPhase ? { phaseTargets: readPhaseTargets(selectedPhase, node, targetMode) } : {})}
                />
              ))}
            {selectedPhase ? <MotionGuide phase={selectedPhase} node={selectedNode} targetMode={targetMode} /> : null}
          </div>
        </div>
      </section>

      <aside className="panel right-panel">
        <section className="action-strip">
          <button type="button" className="primary" onClick={sendToSimulator} disabled={sendState === "sending"}>
            {sendState === "sending" ? "Sending" : "Send to Simulator"}
          </button>
          <button type="button" onClick={downloadJson} disabled={!compileResult.ok}>Export JSON</button>
          <button type="button" onClick={resetProject}>Reset</button>
          <p className={`bridge-message ${sendState}`}>{bridgeMessage}</p>
        </section>

        <section>
          <div className="section-heading">
            <h2>Selected Component</h2>
            {selectedNode?.id !== project.rootNodeId ? <button type="button" className="danger" onClick={deleteSelectedNode}>Delete</button> : null}
          </div>
          {selectedNode ? (
            <div className="form-grid">
              <label>Name<input value={selectedNode.name} onChange={(event) => updateSelectedNode((node) => { node.name = event.target.value; })} /></label>
              <label>Role<input value={selectedNode.roles[0] ?? ""} onChange={(event) => updateSelectedRole(event.target.value)} /></label>
              <NumberField label="Width" value={numberValue(selectedNode.layout.width, 80)} onChange={(value) => updateSelectedNode((node) => { node.layout.width = value; })} />
              <NumberField label="Height" value={numberValue(selectedNode.layout.height, 80)} onChange={(value) => updateSelectedNode((node) => { node.layout.height = value; })} />
              <NumberField label="Origin X" value={numberValue(selectedNode.presentation["offset.x"])} onChange={(value) => updateSelectedNode((node) => { node.presentation["offset.x"] = value; })} />
              <NumberField label="Origin Y" value={numberValue(selectedNode.presentation["offset.y"])} onChange={(value) => updateSelectedNode((node) => { node.presentation["offset.y"] = value; })} />
              <label>Color<input value={String(selectedNode.style.backgroundColor ?? selectedNode.style.foregroundColor ?? "#38BDF8")} onChange={(event) => updateSelectedNode((node) => {
                if (node.kind === "text") {
                  node.style.foregroundColor = event.target.value;
                } else {
                  node.style.backgroundColor = event.target.value;
                }
              })} /></label>
              {selectedNode.kind === "text" ? (
                <label>Text<input value={String(selectedNode.style.text ?? selectedNode.name)} onChange={(event) => updateSelectedNode((node) => { node.style.text = event.target.value; })} /></label>
              ) : null}
            </div>
          ) : null}
        </section>

        <section>
          <div className="section-heading">
            <h2>Phases</h2>
            <button type="button" onClick={addPhase}>Add Phase</button>
          </div>
          <div className="phase-list">
            {project.phaseOrder.map((phaseId, index) => {
              const phase = project.phases[phaseId];
              if (!phase) return null;
              return (
                <button type="button" className={`phase-row ${selectedPhaseId === phaseId ? "selected" : ""}`} key={phaseId} onClick={() => setSelectedPhaseId(phaseId)}>
                  <strong>{index + 1}. {phase.name}</strong>
                  <span>{phase.nextMode === "atTime" ? `next at ${phase.nextAt ?? 0}s` : "next after settle"}</span>
                </button>
              );
            })}
          </div>
        </section>

        {selectedPhase ? (
          <section>
            <div className="section-heading">
              <h2>Phase Controls</h2>
              <button type="button" className="danger" onClick={deletePhase}>Delete Phase</button>
            </div>
            <div className="form-grid">
              <label>Name<input value={selectedPhase.name} onChange={(event) => updateSelectedPhase((phase) => { phase.name = event.target.value; })} /></label>
              <label>Target
                <select value={targetMode} onChange={(event) => setTargetMode(event.target.value as TargetMode)}>
                  <option value="selected">Selected component</option>
                  <option value="role">Role group</option>
                </select>
              </label>
              <NumberField label="Start Delay" value={selectedPhase.startDelay} step={0.05} onChange={(value) => updateSelectedPhase((phase) => { phase.startDelay = value; })} />
              <NumberField label="Next At" value={selectedPhase.nextAt ?? 1} step={0.05} onChange={(value) => updateSelectedPhase((phase) => {
                phase.nextMode = "atTime";
                phase.nextAt = value;
              })} />
              <button type="button" onClick={() => updateSelectedPhase((phase) => { phase.nextMode = "afterPreviousSettles"; phase.nextAt = null; })}>Next after settle</button>
            </div>

            <div className="control-cluster">
              <h3>Targets</h3>
              <NumberField label="X" value={phaseTargets.x} onChange={(value) => updatePhaseTarget("offset.x", value)} />
              <NumberField label="Y" value={phaseTargets.y} onChange={(value) => updatePhaseTarget("offset.y", value)} />
              <NumberField label="Scale" value={phaseTargets.scale} step={0.05} onChange={(value) => updatePhaseTarget("scale", value)} />
              <NumberField label="Rotation" value={phaseTargets.rotation} onChange={(value) => updatePhaseTarget("rotation", value)} />
              <NumberField label="Opacity" value={phaseTargets.opacity} step={0.05} onChange={(value) => updatePhaseTarget("opacity", value)} />
            </div>

            <MotionSpecEditor motion={phaseRule?.motion} onChange={updateMotionSpec} />

            <div className="control-cluster">
              <h3>Special Motion</h3>
              <ToggleButton active={selectedPhase.arcs.length > 0} label="Arc" onToggle={toggleArc} />
              {selectedPhase.arcs[0] ? (
                <div className="form-grid">
                  <label>Direction
                    <select value={selectedPhase.arcs[0].direction} onChange={(event) => updateSelectedPhase((phase) => {
                      phase.arcs = phase.arcs.map((arc) => ({ ...arc, direction: event.target.value as "clockwise" | "anticlockwise" }));
                    })}>
                      <option value="clockwise">Clockwise</option>
                      <option value="anticlockwise">Anticlockwise</option>
                    </select>
                  </label>
                  <NumberField label="Bend" value={selectedPhase.arcs[0].bend ?? 110} onChange={(value) => updateSelectedPhase((phase) => {
                    phase.arcs = phase.arcs.map((arc) => ({ ...arc, bend: value }));
                  })} />
                </div>
              ) : null}
              <ToggleButton active={selectedPhase.jiggles.length > 0} label="Jiggle rotation" onToggle={toggleJiggle} />
            </div>

            <div className="control-cluster">
              <h3>Actions</h3>
              <div className="action-grid">
                <ToggleButton active={hasAction(selectedPhase, "emitParticles")} label="Particles" onToggle={(enabled) => toggleAction("particles", enabled)} />
                <ToggleButton active={hasAction(selectedPhase, "spawnComponents")} label="Spawn Components" onToggle={(enabled) => toggleAction("components", enabled)} />
                <ToggleButton active={hasAction(selectedPhase, "screenShake")} label="Screen Shake" onToggle={(enabled) => toggleAction("shake", enabled)} />
                <ToggleButton active={hasAction(selectedPhase, "haptic")} label="Haptic" onToggle={(enabled) => toggleAction("haptic", enabled)} />
              </div>
            </div>
          </section>
        ) : null}

        <section className="json-section">
          <div className="section-heading"><h2>Generated .motion.json</h2></div>
          <pre>{compileResult.ok ? compileResult.value.json : compileResult.error}</pre>
        </section>
      </aside>
    </main>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <label>
      {label}
      <input type="number" step={step} value={round(value)} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function MotionSpecEditor({ motion, onChange }: { motion: MotionSpec | undefined; onChange: (motion: MotionSpec) => void }) {
  const current = motion ?? { type: "spring", response: 0.75, dampingFraction: 0.72 };
  return (
    <div className="control-cluster">
      <h3>Motion Behavior</h3>
      <div className="form-grid">
        <label>Behavior
          <select value={current.type} onChange={(event) => {
            if (event.target.value === "spring") onChange({ type: "spring", response: 0.75, dampingFraction: 0.72 });
            else if (event.target.value === "immediate") onChange({ type: "immediate" });
            else onChange({ type: "timed", duration: 0.75, easing: "easeInOut" });
          }}>
            <option value="spring">Spring</option>
            <option value="timed">Timed</option>
            <option value="immediate">Immediate</option>
          </select>
        </label>
        {current.type === "spring" ? (
          <>
            <NumberField label="Response" value={current.response} step={0.05} onChange={(value) => onChange({ ...current, response: value })} />
            <NumberField label="Damping" value={current.dampingFraction} step={0.05} onChange={(value) => onChange({ ...current, dampingFraction: value })} />
          </>
        ) : null}
        {current.type === "timed" ? (
          <>
            <NumberField label="Duration" value={current.duration} step={0.05} onChange={(value) => onChange({ ...current, duration: value })} />
            <label>Easing
              <select value={current.easing ?? "easeInOut"} onChange={(event) => onChange({ ...current, easing: event.target.value as "linear" | "easeIn" | "easeOut" | "easeInOut" })}>
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In Out</option>
              </select>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ToggleButton({ active, label, onToggle }: { active: boolean; label: string; onToggle: (enabled: boolean) => void }) {
  return <button type="button" className={active ? "toggle active" : "toggle"} onClick={() => onToggle(!active)}>{label}</button>;
}

function CanvasNode({ node, selected, phaseTargets }: { node: StudioNode; selected: boolean; phaseTargets?: ReturnType<typeof defaultPhaseTargets> }) {
  const originX = numberValue(node.presentation["offset.x"]);
  const originY = numberValue(node.presentation["offset.y"]);
  const targetX = phaseTargets?.x ?? originX;
  const targetY = phaseTargets?.y ?? originY;
  const width = numberValue(node.layout.width, node.kind === "circle" ? 62 : 128);
  const height = numberValue(node.layout.height, node.kind === "circle" ? 62 : 74);
  const x = canvasCenter.x + targetX - width / 2;
  const y = canvasCenter.y + targetY - height / 2;
  const scale = phaseTargets?.scale ?? numberValue(node.presentation.scale, 1);
  const rotation = phaseTargets?.rotation ?? numberValue(node.presentation.rotation);
  const opacity = phaseTargets?.opacity ?? numberValue(node.presentation.opacity, 1);
  const style = {
    left: x,
    top: y,
    width,
    height,
    opacity,
    transform: `rotate(${rotation}deg) scale(${scale})`,
    background: node.kind === "text" ? "transparent" : String(node.style.backgroundColor ?? "#38BDF8"),
    color: String(node.style.foregroundColor ?? "#FFFFFF"),
    borderRadius: node.kind === "circle" ? 999 : numberValue(node.style.cornerRadius, 12)
  } satisfies React.CSSProperties;

  return (
    <div className={`canvas-node canvas-${node.kind} ${selected ? "selected" : ""}`} style={style}>
      {node.kind === "text" ? String(node.style.text ?? node.name) : node.name}
    </div>
  );
}

function MotionGuide({ phase, node, targetMode }: { phase: StudioPhase; node: StudioNode | undefined; targetMode: TargetMode }) {
  if (!node) return null;
  const target = readPhaseTargets(phase, node, targetMode);
  const startX = canvasCenter.x + numberValue(node.presentation["offset.x"]);
  const startY = canvasCenter.y + numberValue(node.presentation["offset.y"]);
  const endX = canvasCenter.x + target.x;
  const endY = canvasCenter.y + target.y;
  const arc = phase.arcs[0];
  const bend = arc?.bend ?? 0;
  const direction = arc?.direction === "anticlockwise" ? -1 : 1;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const controlX = midX + (-dy / length) * bend * direction;
  const controlY = midY + (dx / length) * bend * direction;
  const path = arc
    ? `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`
    : `M ${startX} ${startY} L ${endX} ${endY}`;

  return (
    <svg className="motion-path" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-hidden="true">
      <path d={path} />
      <circle cx={startX} cy={startY} r="4" className="start" />
      <circle cx={endX} cy={endY} r="5" />
    </svg>
  );
}

function loadStoredProject(): StudioProject {
  const raw = window.localStorage.getItem(storageKey);
  if (raw) {
    try {
      return JSON.parse(raw) as StudioProject;
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }
  return cloneProject(parallelComponentsProject);
}

function saveStoredProject(project: StudioProject) {
  window.localStorage.setItem(storageKey, JSON.stringify(project));
}

function cloneProject(project: StudioProject): StudioProject {
  return clone(project);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function orderedNodes(project: StudioProject): StudioNode[] {
  const result: StudioNode[] = [];
  function visit(nodeId: string) {
    const node = project.nodes[nodeId];
    if (!node) return;
    result.push(node);
    node.childIds.forEach(visit);
  }
  visit(project.rootNodeId);
  return result;
}

function defaultStyle(kind: NodeKindChoice, name: string): StudioNode["style"] {
  if (kind === "text") return { text: name, foregroundColor: "#E0F2FE" };
  if (kind === "circle") return { backgroundColor: "#38BDF8" };
  return { backgroundColor: "#0EA5E9", cornerRadius: 14 };
}

function uniqueId(base: string, records: Record<string, unknown>) {
  const clean = slug(base);
  let id = clean;
  let index = 2;
  while (records[id] !== undefined) {
    id = `${clean}${index}`;
    index += 1;
  }
  return id;
}

function readPhaseTargets(phase: StudioPhase, node: StudioNode | undefined, targetMode: TargetMode) {
  const target = defaultPhaseTargets();
  if (!node) return target;

  for (const assignment of phase.targets) {
    const selector = assignment.select;
    const matches = targetMode === "role"
      ? selector.role !== undefined && node.roles.includes(selector.role)
      : selector.id === node.id;
    if (!matches || typeof assignment.value !== "number") continue;
    for (const property of selector.properties) {
      if (property === "offset.x") target.x = assignment.value;
      if (property === "offset.y") target.y = assignment.value;
      if (property === "scale") target.scale = assignment.value;
      if (property === "rotation") target.rotation = assignment.value;
      if (property === "opacity") target.opacity = assignment.value;
    }
  }

  return target;
}

function defaultPhaseTargets() {
  return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
}

function assignment(
  nodeId: string,
  property: MotionPropertySelector["properties"][number],
  value: number
): MotionAssignment {
  return { select: { id: nodeId, properties: [property] }, value };
}

function ensureRuleCovers(
  phase: StudioPhase,
  selector: MotionPropertySelector,
  property: MotionPropertySelector["properties"][number]
) {
  const motion = phase.rules[0]?.motion ?? { type: "spring", response: 0.75, dampingFraction: 0.72 };
  const rule = phase.rules.find((candidate) => sameNodeSelector(candidate.select, selector));
  if (rule) {
    if (!rule.select.properties.includes(property)) {
      rule.select.properties.push(property);
    }
    return;
  }

  phase.rules.push({
    select: { id: selector.id, role: selector.role, properties: [property] },
    motion
  });
}

function sameTarget(left: MotionAssignment, right: MotionAssignment["select"]) {
  return left.select.id === right.id
    && left.select.role === right.role
    && left.select.properties.length === right.properties.length
    && left.select.properties.every((property, index) => property === right.properties[index]);
}

function sameNodeSelector(left: MotionPropertySelector, right: MotionPropertySelector) {
  return left.id === right.id && left.role === right.role;
}

function spawnedComponent(id: string, x: number) {
  return {
    id,
    kind: "circle" as const,
    layout: { width: 26, height: 26 },
    style: { backgroundColor: "#60A5FA" },
    from: { "offset.x": 0, "offset.y": 0, scale: 1, opacity: 0.85 },
    to: { "offset.x": x, "offset.y": -82, scale: 0.18, opacity: 0 },
    motion: { type: "timed" as const, duration: 0.72, easing: "easeOut" as const },
    lifetime: 0.72
  };
}

function hasAction(phase: StudioPhase, type: string) {
  return phase.actions.some((action) => action.type === type);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function titleCase(value: string) {
  return value.replace(/(^|[A-Z])[^A-Z]*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1));
}

function slug(value: string) {
  const clean = value.trim().replace(/[^a-zA-Z0-9]+/g, " ").trim().replace(/\s+(\w)/g, (_, letter: string) => letter.toUpperCase());
  return clean.length > 0 ? clean.charAt(0).toLowerCase() + clean.slice(1) : "item";
}

function round(value: number) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

const windowWithRoot = window as Window & { __framezeroRoot?: Root };
windowWithRoot.__framezeroRoot ??= createRoot(root);
windowWithRoot.__framezeroRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
