import React, { useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  compileStudioProject,
  type StudioComponent,
  type StudioNode,
  type StudioPhase,
  type StudioProject
} from "@framezero/compiler";
import { orbPlaygroundProject } from "@framezero/fixtures";
import type { MotionAction, MotionAssignment, MotionFill, MotionPropertySelector, MotionRule, MotionSpec, MotionValue } from "@framezero/schema";
import "./styles.css";

type TargetMode = "selected" | "role";
type NodeKindChoice = StudioNode["kind"];
type SendState = "idle" | "sending" | "sent" | "failed";
type WorkspaceMode = "design" | "animate";
type InspectorTab = "properties" | "effects" | "code";
type LeftPanelTab = "layers" | "assets";
type ResizeCorner = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";
type PreviewTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

type PreviewSegment = {
  phase: StudioPhase;
  start: number;
  duration: number;
  from: Record<string, PreviewTransform>;
  to: Record<string, PreviewTransform>;
};
type PreviewVisual = {
  id: string;
  kind: NodeKindChoice;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  opacity: number;
  color: string;
  text?: string;
  cornerRadius?: number;
};
type PreviewFrame = {
  transforms: Record<string, PreviewTransform>;
  visuals: PreviewVisual[];
  shake: { x: number; y: number };
};
type ParticleAction = MotionAction & {
  type: "emitParticles";
  id: string;
  selector?: { id?: string; role?: string };
  count: number;
  duration?: number;
  angle?: { min: number; max: number };
  distance?: { min: number; max: number };
  particle: {
    kind: NodeKindChoice;
    layout: Record<string, unknown>;
    style: Record<string, unknown>;
    fills?: MotionFill[];
    from: Record<string, unknown>;
    to: Record<string, unknown>;
    motion: MotionSpec;
    lifetime: number;
  };
};
type SpawnComponentsAction = MotionAction & {
  type: "spawnComponents";
  id: string;
  selector?: { id?: string; role?: string };
  components: Array<{
    id: string;
    kind: NodeKindChoice;
    layout: Record<string, unknown>;
    style: Record<string, unknown>;
    fills?: MotionFill[];
    from: Record<string, unknown>;
    to: Record<string, unknown>;
    motion: MotionSpec;
    lifetime: number;
  }>;
};
type ScreenShakeAction = MotionAction & {
  type: "screenShake";
  amplitude: number;
  duration: number;
  frequency?: number;
  decay?: number;
};
type HapticAction = MotionAction & {
  type: "haptic";
  style: "light" | "medium" | "heavy" | "rigid" | "soft" | "selection" | "success" | "warning" | "error";
  intensity?: number;
};

const storageKey = "framezero.studio.project.v4";
const leftPanelWidthStorageKey = "framezero.studio.leftPanelWidth";
const rightPanelWidthStorageKey = "framezero.studio.rightPanelWidth";
const canvasWidth = 600;
const canvasHeight = 400;
const canvasCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };
const transformProperties: MotionPropertySelector["properties"] = ["offset.x", "offset.y", "rotation", "scale", "opacity"];

function App() {
  const [project, setProject] = useState<StudioProject>(() => loadStoredProject());
  const [selectedNodeId, setSelectedNodeId] = useState(project.editor?.selection[0] ?? "");
  const [selectedPhaseId, setSelectedPhaseId] = useState(project.phaseOrder[0] ?? "");
  const [targetMode, setTargetMode] = useState<TargetMode>("selected");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [bridgeMessage, setBridgeMessage] = useState("Bridge idle");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("design");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [showDeveloperOutput, setShowDeveloperOutput] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("layers");
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => loadStoredPanelWidth(leftPanelWidthStorageKey, 180, 148, 320));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => loadStoredPanelWidth(rightPanelWidthStorageKey, 280, 248, 420));

  const compileResult = useMemo(() => {
    try {
      return { ok: true as const, value: compileStudioProject(project) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [project]);

  const selectedNode = project.nodes[selectedNodeId];
  const selectedComponent = project.components[selectedComponentId];
  const selectedPhase = project.phases[selectedPhaseId] ?? project.phases[project.phaseOrder[0] ?? ""];
  const phaseTargets = selectedPhase ? readPhaseTargets(selectedPhase, selectedNode, targetMode) : defaultPhaseTargets();
  const activeSelector = selectedNode ? selectorForTarget(project, selectedNode, targetMode) : undefined;
  const phaseRule = selectedPhase && activeSelector
    ? selectedPhase.rules.find((rule) => sameNodeSelector(rule.select, activeSelector))
    : undefined;
  const previewPlan = useMemo(() => buildPreviewPlan(project), [project]);
  const previewFrame = useMemo(
    () => (isPreviewing || previewTime > 0 ? samplePreview(project, previewPlan, previewTime) : emptyPreviewFrame()),
    [isPreviewing, previewPlan, previewTime, project]
  );

  useEffect(() => {
    if (!isPreviewing) return;

    let frame = 0;
    const startedAt = performance.now() - previewTime * 1000;

    function tick(now: number) {
      const nextTime = (now - startedAt) / 1000;
      setPreviewTime(Math.min(nextTime, previewPlan.totalDuration));

      if (nextTime >= previewPlan.totalDuration) {
        setIsPreviewing(false);
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPreviewing, previewPlan.totalDuration]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (isEditableKeyboardTarget(event.target)) return;

      if (workspaceMode === "design" && selectedComponent) {
        event.preventDefault();
        deleteSelectedComponent();
        return;
      }

      if (selectedNode && selectedNode.id !== project.rootNodeId) {
        event.preventDefault();
        deleteSelectedNode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspaceMode, selectedComponent, selectedNode, project.rootNodeId]);

  useEffect(() => {
    window.localStorage.setItem(leftPanelWidthStorageKey, String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(rightPanelWidthStorageKey, String(rightPanelWidth));
  }, [rightPanelWidth]);

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
        fills: defaultFills(kind),
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
      setSelectedComponentId("");
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
        ...(source.fills ? { fills: clone(source.fills) } : {}),
        presentation: {
          ...source.presentation,
          "offset.x": numberValue(source.presentation["offset.x"]) + 34,
          "offset.y": numberValue(source.presentation["offset.y"]) + 34
        }
      };
      draft.nodes[draft.rootNodeId]?.childIds.push(id);
      setSelectedNodeId(id);
      setSelectedComponentId("");
    });
  }

  function createComponent(kind: NodeKindChoice) {
    patchProject((draft) => {
      const id = uniqueId("component", draft.components);
      const name = `${titleCase(kind)} Component`;
      const component = defaultComponent(id, name, kind);
      draft.components[id] = component;
      setSelectedComponentId(id);
      setSelectedNodeId(draft.rootNodeId);
    });
  }

  function createComponentFromSelected() {
    if (!selectedNode || selectedNode.id === project.rootNodeId) return;
    patchProject((draft) => {
      const source = draft.nodes[selectedNode.id];
      if (!source) return;
      const id = uniqueId(slug(source.name || "component"), draft.components);
      draft.components[id] = componentFromNode(id, source);
      setSelectedComponentId(id);
      setSelectedNodeId(draft.rootNodeId);
    });
  }

  function duplicateSelectedComponent() {
    if (!selectedComponent) return;
    patchProject((draft) => {
      const source = draft.components[selectedComponent.id];
      if (!source) return;
      const id = uniqueId(slug(`${source.name}-copy`), draft.components);
      draft.components[id] = {
        ...clone(source),
        id,
        name: `${source.name} Copy`
      };
      setSelectedComponentId(id);
      setSelectedNodeId(draft.rootNodeId);
    });
  }

  function detachSelectedInstance() {
    if (!selectedNode?.componentId) return;
    patchProject((draft) => {
      const node = draft.nodes[selectedNode.id];
      if (!node) return;
      const componentRole = `component:${node.componentId}`;
      delete node.componentId;
      node.roles = node.roles.filter((role) => role !== componentRole);
      if (node.roles.length === 0) node.roles = ["actor"];
      setSelectedComponentId("");
    });
  }

  function instantiateComponent(componentId: string) {
    patchProject((draft) => {
      const component = draft.components[componentId];
      if (!component) return;
      const node = nodeFromComponent(component, draft.nodes, draft.rootNodeId);
      draft.nodes[node.id] = node;
      draft.nodes[draft.rootNodeId]?.childIds.push(node.id);
      for (const role of node.roles) {
        draft.roles[role] ??= { id: role, name: role };
      }
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
    });
  }

  function createSyncedComponentSet() {
    patchProject((draft) => {
      const orbComponentId = ensureComponent(
        draft,
        "syncOrb",
        "Sync Orb",
        "circle",
        { width: 84, height: 84 },
        {
          backgroundColor: "#5ED8FF",
          gradientEndColor: "#B58CFF",
          gradientAngle: 135,
          shadowBlur: 22,
          shadowColor: "#5ED8FF",
          shadowOpacity: 0.35
        },
        [radialFill("#E0F2FE", "#5ED8FF", 0.36, 0.28, 82, 0, 1, 1)]
      );
      const cardComponentId = ensureComponent(
        draft,
        "syncCard",
        "Sync Card",
        "roundedRectangle",
        { width: 158, height: 92 },
        {
          backgroundColor: "#1E2A44",
          gradientEndColor: "#0EA5E9",
          gradientAngle: 120,
          cornerRadius: 18,
          strokeWidth: 1,
          strokeColor: "#5ED8FF",
          shadowBlur: 18,
          shadowColor: "#0EA5E9",
          shadowOpacity: 0.22
        },
        [linearFill("#1E2A44", "#0EA5E9", 120, 0, 1, 0.94)]
      );
      const labelComponentId = ensureComponent(
        draft,
        "syncLabel",
        "Sync Label",
        "text",
        {},
        { text: "Synced motion", foregroundColor: "#E0F2FE" },
        []
      );

      const groupRole = "syncGroup";
      draft.roles[groupRole] = {
        id: groupRole,
        name: "syncGroup",
        description: "Components animated together from one phase"
      };

      const nodes = [
        createInstanceAt(draft, draft.components[cardComponentId] as StudioComponent, "Sync Card", -88, 34, groupRole),
        createInstanceAt(draft, draft.components[orbComponentId] as StudioComponent, "Sync Orb", 74, -28, groupRole),
        createInstanceAt(draft, draft.components[labelComponentId] as StudioComponent, "Sync Label", -24, -112, groupRole)
      ];
      const firstNode = nodes[0];

      const phaseId = uniqueId("syncedEnsemble", draft.phases);
      const selector: MotionPropertySelector = { role: groupRole, properties: transformProperties };
      draft.phases[phaseId] = {
        id: phaseId,
        name: "Synced Ensemble",
        mode: "absolute",
        startDelay: 0,
        nextMode: "afterPreviousSettles",
        nextAt: null,
        targets: [
          { select: { role: groupRole, properties: ["offset.x"] }, value: 118 },
          { select: { role: groupRole, properties: ["offset.y"] }, value: -42 },
          { select: { role: groupRole, properties: ["scale"] }, value: 1.16 },
          { select: { role: groupRole, properties: ["rotation"] }, value: 18 },
          { select: { role: groupRole, properties: ["opacity"] }, value: 1 }
        ],
        rules: [{ select: selector, motion: { type: "spring", response: 0.54, dampingFraction: 0.7 } }],
        arcs: [{
          select: { role: groupRole },
          x: "offset.x",
          y: "offset.y",
          direction: "clockwise",
          bend: 64,
          motion: { type: "spring", response: 0.54, dampingFraction: 0.7 }
        }],
        jiggles: [],
        actions: [
          { type: "screenShake", amplitude: 3, duration: 0.22, frequency: 24, decay: 1.8 },
          { type: "haptic", style: "selection", intensity: 0.55 }
        ]
      };
      draft.phaseOrder.push(phaseId);
      draft.editor = { viewportPreset: draft.editor?.viewportPreset ?? "iphone", ...draft.editor, selection: firstNode ? [firstNode.id] : [] };
      setSelectedNodeId(firstNode?.id ?? "");
      setSelectedComponentId("");
      setSelectedPhaseId(phaseId);
      setTargetMode("role");
      setWorkspaceMode("animate");
      stopWebPreview();
      setPreviewTime(0);
    });
  }

  function updateSelectedComponent(updater: (component: StudioComponent) => void) {
    if (!selectedComponent) return;
    patchProject((draft) => {
      const component = draft.components[selectedComponent.id];
      if (!component) return;
      updater(component);
      syncInstancesOfComponent(draft, component.id);
      for (const role of componentRoles(component)) {
        draft.roles[role] ??= { id: role, name: role };
      }
    });
  }

  function deleteSelectedComponent() {
    if (!selectedComponent) return;
    patchProject((draft) => {
      delete draft.components[selectedComponent.id];
      for (const node of Object.values(draft.nodes)) {
        if (node.componentId !== selectedComponent.id) continue;
        delete node.componentId;
        node.roles = node.roles.filter((role) => role !== `component:${selectedComponent.id}`);
        if (node.roles.length === 0) node.roles = ["actor"];
      }
      setSelectedComponentId("");
    });
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.id === project.rootNodeId) return;
    patchProject((draft) => {
      delete draft.nodes[selectedNode.id];
      for (const node of Object.values(draft.nodes)) {
        node.childIds = node.childIds.filter((childId) => childId !== selectedNode.id);
      }
      removeNodeMotionReferences(draft, selectedNode.id);
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
      node.roles = uniqueStrings([role, ...(node.componentId ? [`component:${node.componentId}`] : [])]);
      draft.roles[role] ??= { id: role, name: role };
      if (node.componentId) {
        const componentRole = `component:${node.componentId}`;
        draft.roles[componentRole] ??= { id: componentRole, name: componentRole };
      }
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
      setPhaseTargetValue(phase, selector, value);
      ensureRuleCovers(phase, selector, property);
    });
  }

  function updateMotionSpec(spec: MotionSpec) {
    updateSelectedPhase((phase) => {
      const node = selectedNode ?? project.nodes[project.rootNodeId];
      const selector = selectorForTarget(project, node, targetMode);
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

  function updateAction(type: MotionAction["type"], updater: (action: MotionAction) => MotionAction) {
    updateSelectedPhase((phase) => {
      phase.actions = phase.actions.map((action) => action.type === type ? updater(action) : action);
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
      const blocked = new Set([actionTypeForToggle(type)]);
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
    const fresh = cloneProject(orbPlaygroundProject);
    saveStoredProject(fresh);
    setProject(fresh);
    setSelectedNodeId(fresh.editor?.selection[0] ?? "");
    setSelectedPhaseId(fresh.phaseOrder[0] ?? "");
    setSelectedComponentId("");
    setBridgeMessage("Reset to fixture");
  }

  function clearCanvasSelection() {
    setSelectedNodeId("");
    setSelectedComponentId("");
    patchProject((draft) => {
      draft.editor = { viewportPreset: draft.editor?.viewportPreset ?? "iphone", ...draft.editor, selection: [] };
    });
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

  function playWebPreview() {
    setPreviewTime(0);
    setIsPreviewing(true);
  }

  function stopWebPreview() {
    setIsPreviewing(false);
    setPreviewTime(0);
  }

  function scrubPreview(value: number) {
    setIsPreviewing(false);
    setPreviewTime(clamp(value, 0, previewPlan.totalDuration));
  }

  function startCanvasDrag(nodeId: string, event: React.PointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.closest(".phone-canvas");
    if (!(canvas instanceof HTMLElement)) return;
    const canvasElement = canvas;

    const node = project.nodes[nodeId];
    if (!node || node.id === project.rootNodeId) return;
    const dragMode = workspaceMode;
    const phaseIdForDrag = selectedPhaseId;

    setSelectedNodeId(nodeId);
    setSelectedComponentId("");
    setIsPreviewing(false);
    setPreviewTime(0);
    event.preventDefault();
    event.stopPropagation();

    const canvasPoint = pointInCanvas(canvasElement, event.clientX, event.clientY);
    const initialTargets = dragMode === "animate" && selectedPhase
      ? readPhaseTargets(selectedPhase, node, "selected")
      : baseTargetsFromNode(node);
    const initialOrigin = { x: initialTargets.x, y: initialTargets.y };
    const grabOffset = {
      x: initialOrigin.x - canvasPoint.x,
      y: initialOrigin.y - canvasPoint.y
    };

    function move(moveEvent: PointerEvent) {
      const point = pointInCanvas(canvasElement, moveEvent.clientX, moveEvent.clientY);
      const nextX = round(point.x + grabOffset.x);
      const nextY = round(point.y + grabOffset.y);

      setProject((current) => {
        const draft = cloneProject(current);
        const movingNode = draft.nodes[nodeId];
        if (!movingNode) return current;

        if (dragMode === "animate" && phaseIdForDrag !== "") {
          const phase = draft.phases[phaseIdForDrag];
          if (phase) {
            setPhaseTargetValue(phase, { id: nodeId, properties: ["offset.x"] }, nextX);
            setPhaseTargetValue(phase, { id: nodeId, properties: ["offset.y"] }, nextY);
            ensureRuleCovers(phase, { id: nodeId, properties: ["offset.x", "offset.y"] }, "offset.x");
            ensureRuleCovers(phase, { id: nodeId, properties: ["offset.x", "offset.y"] }, "offset.y");
          }
        } else {
          movingNode.presentation["offset.x"] = nextX;
          movingNode.presentation["offset.y"] = nextY;
        }
        draft.editor = { viewportPreset: draft.editor?.viewportPreset ?? "iphone", ...draft.editor, selection: [nodeId] };
        saveStoredProject(draft);
        return draft;
      });
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  function startCanvasResize(nodeId: string, corner: ResizeCorner, event: React.PointerEvent<HTMLElement>) {
    const canvas = event.currentTarget.closest(".phone-canvas");
    if (!(canvas instanceof HTMLElement)) return;

    const node = project.nodes[nodeId];
    if (!node || node.id === project.rootNodeId) return;
    const canvasElement = canvas;
    const startPoint = pointInCanvas(canvasElement, event.clientX, event.clientY);
    const startWidth = nodeWidth(node);
    const startHeight = nodeHeight(node);
    const startOffset = {
      x: numberValue(node.presentation["offset.x"]),
      y: numberValue(node.presentation["offset.y"])
    };

    setSelectedNodeId(nodeId);
    setSelectedComponentId("");
    event.preventDefault();
    event.stopPropagation();

    function move(moveEvent: PointerEvent) {
      const point = pointInCanvas(canvasElement, moveEvent.clientX, moveEvent.clientY);
      const dx = point.x - startPoint.x;
      const dy = point.y - startPoint.y;
      const affectsLeft = corner.includes("w");
      const affectsRight = corner.includes("e");
      const affectsTop = corner.includes("n");
      const affectsBottom = corner.includes("s");
      const nextWidth = affectsLeft || affectsRight ? Math.max(12, round(startWidth + (affectsLeft ? -dx : dx))) : startWidth;
      const nextHeight = affectsTop || affectsBottom ? Math.max(12, round(startHeight + (affectsTop ? -dy : dy))) : startHeight;
      const centerShiftX = affectsLeft || affectsRight ? (affectsLeft ? -1 : 1) * (nextWidth - startWidth) / 2 : 0;
      const centerShiftY = affectsTop || affectsBottom ? (affectsTop ? -1 : 1) * (nextHeight - startHeight) / 2 : 0;

      setProject((current) => {
        const draft = cloneProject(current);
        const resizingNode = draft.nodes[nodeId];
        if (!resizingNode) return current;
        resizingNode.layout.width = nextWidth;
        resizingNode.layout.height = nextHeight;
        resizingNode.presentation["offset.x"] = round(startOffset.x + centerShiftX);
        resizingNode.presentation["offset.y"] = round(startOffset.y + centerShiftY);
        draft.editor = { viewportPreset: draft.editor?.viewportPreset ?? "iphone", ...draft.editor, selection: [nodeId] };
        saveStoredProject(draft);
        return draft;
      });
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  function startPanelResize(side: "left" | "right", event: React.PointerEvent<HTMLElement>) {
    const startX = event.clientX;
    const startLeft = leftPanelWidth;
    const startRight = rightPanelWidth;
    event.preventDefault();
    event.stopPropagation();

    function move(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      if (side === "left") {
        setLeftPanelWidth(clamp(round(startLeft + dx), 148, 320));
      } else {
        setRightPanelWidth(clamp(round(startRight - dx), 248, 420));
      }
    }

    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  return (
    <main
      className={`studio-shell ${workspaceMode === "design" ? "design-mode" : "animate-mode"}`}
      style={{
        "--left-panel-width": `${leftPanelWidth}px`,
        "--right-panel-width": `${rightPanelWidth}px`
      } as React.CSSProperties}
    >
      <header className="app-toolbar">
        <div className="brand-lockup">
          <strong>FrameZero</strong>
          <span>{project.name}</span>
        </div>

        <div className="tool-strip" aria-label="Editor tools">
          <div className="toolbar-group">
            <button type="button" className={workspaceMode === "design" ? "mode-tab active" : "mode-tab"} onClick={() => {
              stopWebPreview();
              setWorkspaceMode("design");
            }}>Design</button>
            <button type="button" className={workspaceMode === "animate" ? "mode-tab active" : "mode-tab"} onClick={() => setWorkspaceMode("animate")}>Animate</button>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={() => addNode("circle")}>Circle</button>
            <button type="button" onClick={() => addNode("roundedRectangle")}>Rectangle</button>
            <button type="button" onClick={() => addNode("text")}>Text</button>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={duplicateSelectedNode} disabled={!selectedNode || selectedNode.id === project.rootNodeId}>Duplicate</button>
          </div>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="preview-button" onClick={isPreviewing ? stopWebPreview : playWebPreview}>
            {isPreviewing ? "Stop Preview" : "Preview"}
          </button>
          <button type="button" onClick={downloadJson} disabled={!compileResult.ok}>Export JSON</button>
          <button type="button" className="primary" onClick={sendToSimulator} disabled={sendState === "sending"}>
            {sendState === "sending" ? "Sending" : "Send to Simulator"}
          </button>
        </div>
      </header>

      <aside className="panel left-panel">
        <div className="panel-header">
          <p className="eyebrow">Document</p>
          <h1>{leftPanelTab === "layers" ? "Layers" : "Assets"}</h1>
          <div className="left-tabs" role="tablist" aria-label="Document panel">
            <button type="button" className={leftPanelTab === "layers" ? "active" : ""} onClick={() => setLeftPanelTab("layers")}>Layers</button>
            <button type="button" className={leftPanelTab === "assets" ? "active" : ""} onClick={() => setLeftPanelTab("assets")}>Assets</button>
          </div>
        </div>

        {leftPanelTab === "layers" ? (
        <>
        <section className="left-section document-layers">
          <div className="section-heading">
            <h2>Layers</h2>
            <span>{Object.keys(project.nodes).length}</span>
          </div>
          <div className="layer-list">
            {orderedNodes(project).map((node) => (
              <button
                type="button"
                className={`layer-row ${selectedNodeId === node.id ? "selected" : ""}`}
                key={node.id}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setSelectedComponentId("");
                }}
              >
                <span className={`kind-dot kind-${node.kind}`} />
                  <div>
                    <strong>{node.name}</strong>
                    <small>{node.componentId ? <b>Instance</b> : null}<span>#{node.id} · {node.kind}</span></small>
                  </div>
                </button>
            ))}
          </div>
        </section>
        <section className="left-section role-groups">
          <div className="section-heading">
            <h2>Groups</h2>
            <span>roles</span>
          </div>
          <div className="role-list">
            {Object.values(project.roles).map((role) => (
              <span className="role-pill" key={role.id}>{role.name}</span>
            ))}
          </div>
        </section>
        </>
        ) : null}

        {leftPanelTab === "assets" ? (
        <section className="left-section component-library">
          <div className="section-heading">
            <h2>Components</h2>
            <span>{Object.keys(project.components).length}</span>
          </div>
          <p className="panel-hint">Reusable sources. Place instances onto the artboard.</p>
          <div className="button-grid">
            {selectedNode?.componentId ? (
              <button type="button" className="secondary-link field-wide" onClick={() => {
                setSelectedComponentId(selectedNode.componentId ?? "");
                setSelectedNodeId(project.rootNodeId);
              }}>Edit Main Component</button>
            ) : (
              <button type="button" className="primary field-wide" onClick={createComponentFromSelected} disabled={!selectedNode || selectedNode.id === project.rootNodeId}>Create Component from Selection</button>
            )}
            <button type="button" className="component-create field-wide" onClick={() => createComponent("circle")}>New Main Component</button>
            <button type="button" className="component-create field-wide synced-action" onClick={createSyncedComponentSet}>Create Synced Set</button>
            <button type="button" className="component-create" onClick={() => createComponent("circle")}><span className="kind-dot kind-circle" />Circle</button>
            <button type="button" className="component-create" onClick={() => createComponent("roundedRectangle")}><span className="kind-dot kind-roundedRectangle" />Card</button>
            <button type="button" className="component-create" onClick={() => createComponent("text")}><span className="kind-dot kind-text" />Text</button>
          </div>
          <div className="component-list">
            {Object.values(project.components).map((component) => {
              const isSelectedComponent = selectedComponentId === component.id;
              const isSourceForSelection = selectedNode?.componentId === component.id;
              return (
              <div
                role="group"
                className={`component-row ${isSelectedComponent ? "selected" : ""} ${isSourceForSelection ? "source-active" : ""}`}
                key={component.id}
              >
                <ComponentSwatch component={component} />
                <div>
                  <span className="asset-kicker">{isSourceForSelection ? "Source" : "Main"}</span>
                  <strong>{component.name}</strong>
                  <span className="asset-meta"><b>{component.kind === "roundedRectangle" ? "card" : component.kind ?? "component"}</b><b>{instanceCount(project, component.id)} inst</b></span>
                </div>
                <div className="asset-actions">
                  <button
                    type="button"
                    className="mini-action edit"
                    onClick={() => {
                      setSelectedComponentId(component.id);
                      setSelectedNodeId(project.rootNodeId);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="mini-action place"
                    onClick={() => {
                    instantiateComponent(component.id);
                    }}
                  >
                    Place
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        </section>
        ) : null}
        <div
          className="panel-resizer left-resizer"
          role="separator"
          aria-label="Resize left panel"
          aria-orientation="vertical"
          onPointerDown={(event) => startPanelResize("left", event)}
        />
      </aside>

      <section className="canvas-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">Canvas</p>
            <h2>{isPreviewing || previewTime > 0 ? `Preview ${previewTime.toFixed(2)}s` : `${workspaceMode === "design" ? "Design" : "Animate"} · ${selectedNode?.name ?? "No object selected"}`}</h2>
          </div>
          <div className="canvas-state">
            <span className={selectedNode?.componentId ? "status-badge" : "status-badge plain"}>{selectedNode?.componentId ? "Instance" : "Layer"}</span>
            <small>{selectedNode?.componentId ? project.components[selectedNode.componentId]?.name ?? selectedNode.componentId : selectedNode?.kind ?? "none"}</small>
          </div>
          <div className={`runtime-status ${compileResult.ok ? "ok" : "bad"}`}>
            <span className="status-light" />
            {compileResult.ok ? "Runtime JSON valid" : "Schema issue"}
          </div>
        </header>

        <div className="canvas-frame">
          <div
            className="phone-canvas"
            onPointerDown={(event) => {
              const target = event.target;
              if (target instanceof HTMLElement && target.closest(".canvas-node, .canvas-tool-hud, .canvas-side-tools")) return;
              clearCanvasSelection();
            }}
            style={{
              transform: `translate(${previewFrame.shake.x}px, ${previewFrame.shake.y}px)`
            }}
          >
            <div className="grid" />
            <div className="axis x-axis" />
            <div className="axis y-axis" />
            <span className="artboard-label">600 x 400</span>
            <span className="origin-label">origin</span>
            <div className="ruler ruler-top" aria-hidden="true">
              {rulerTicks(canvasWidth).map((tick) => <span key={tick} style={{ left: `${(tick / canvasWidth) * 100}%` }}>{tick}</span>)}
            </div>
            <div className="ruler ruler-left" aria-hidden="true">
              {rulerTicks(canvasHeight).map((tick) => <span key={tick} style={{ top: `${(tick / canvasHeight) * 100}%` }}>{tick}</span>)}
            </div>
            <div className="canvas-tool-hud" aria-label="Canvas manipulation tools">
              <button type="button" className="hud-tool active">Move</button>
              <button type="button" className="hud-tool live">Resize</button>
              <button type="button" className="hud-tool">Pivot</button>
              <button type="button" className="hud-tool">Snap 8</button>
            </div>
            <div className="canvas-side-tools" aria-label="Selection tools">
              <button type="button" className="active">V</button>
              <button type="button">R</button>
              <button type="button">P</button>
            </div>
            <div className="canvas-help">Drag selected layers. Pull corner handles to resize.</div>
            {orderedNodes(project)
              .filter((node) => node.id !== project.rootNodeId)
              .map((node) => (
                <CanvasNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedNodeId}
                  onPointerDown={(event) => startCanvasDrag(node.id, event)}
                  onResizeStart={(corner, event) => startCanvasResize(node.id, corner, event)}
                  {...(previewFrame.transforms[node.id] ? { previewTransform: previewFrame.transforms[node.id] } : {})}
                  {...(workspaceMode === "animate" && selectedPhase ? { phaseTargets: readPhaseTargets(selectedPhase, node, targetMode) } : {})}
                />
              ))}
            {previewFrame.visuals.map((visual) => (
              <PreviewVisualNode visual={visual} key={visual.id} />
            ))}
            {workspaceMode === "animate" && selectedPhase ? <MotionGuide phase={selectedPhase} node={selectedNode} targetMode={targetMode} /> : null}
          </div>
        </div>
      </section>

      <aside className="panel right-panel">
        <div
          className="panel-resizer right-resizer"
          role="separator"
          aria-label="Resize right panel"
          aria-orientation="vertical"
          onPointerDown={(event) => startPanelResize("right", event)}
        />
        {workspaceMode === "design" ? (
          <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
            {([
              ["properties", "Properties"],
              ["effects", "Effects"],
              ["code", "Code"]
            ] as const).map(([tab, label]) => (
              <button
                type="button"
                key={tab}
                className={inspectorTab === tab ? "active" : ""}
                onClick={() => setInspectorTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {workspaceMode === "animate" ? (
        <section className="action-strip">
          <strong>Preview</strong>
          <button type="button" onClick={isPreviewing ? stopWebPreview : playWebPreview}>
            {isPreviewing ? "Stop" : "Play"}
          </button>
          <button type="button" onClick={resetProject}>Reset</button>
          <div className="preview-meter" aria-label="Preview progress">
            <span style={{ width: `${Math.min((previewTime / Math.max(previewPlan.totalDuration, 0.01)) * 100, 100)}%` }} />
          </div>
          <p className={`bridge-message ${sendState}`}>{bridgeMessage}</p>
        </section>
        ) : null}

        {workspaceMode === "design" && selectedComponent && inspectorTab === "properties" ? (
        <section>
          <div className="section-heading">
            <h2>Main Component</h2>
            {selectedComponent ? <button type="button" className="danger" onClick={deleteSelectedComponent}>Delete Component</button> : null}
          </div>
          <>
              <ComponentPreview component={selectedComponent} />
              <p className="inline-note compact-note component-note"><span className="status-badge">Main</span> Editing the source component. Every placed instance updates from this definition.</p>
              <div className="component-actions">
                <button type="button" className="primary" onClick={() => instantiateComponent(selectedComponent.id)}>Place Instance</button>
                <button type="button" onClick={duplicateSelectedComponent}>Duplicate Main</button>
              </div>
              <div className="form-grid">
                <label>Name<input value={selectedComponent.name} onChange={(event) => updateSelectedComponent((component) => { component.name = event.target.value; })} /></label>
                <div className="field-block field-wide">
                  <span>Type</span>
                  <div className="segmented-row compact">
                    {(["circle", "roundedRectangle", "text"] as const).map((kind) => (
                      <button
                        type="button"
                        key={kind}
                        className={(selectedComponent.kind ?? "circle") === kind ? "segment active" : "segment"}
                        onClick={() => updateSelectedComponent((component) => {
                          component.kind = kind;
                          component.layout = kind === "text" ? {} : { width: kind === "circle" ? 72 : 150, height: kind === "circle" ? 72 : 86 };
                          component.style = defaultStyle(kind, component.name);
                          component.fills = defaultFills(kind);
                        })}
                      >
                        {kind === "roundedRectangle" ? "Card" : titleCase(kind)}
                      </button>
                    ))}
                  </div>
                </div>
                <NumberField label="Width" value={numberValue(selectedComponent.layout?.width, selectedComponent.kind === "circle" ? 72 : 150)} onChange={(value) => updateSelectedComponent((component) => {
                  component.layout = { ...(component.layout ?? {}), width: value };
                })} />
                <NumberField label="Height" value={numberValue(selectedComponent.layout?.height, selectedComponent.kind === "circle" ? 72 : 86)} onChange={(value) => updateSelectedComponent((component) => {
                  component.layout = { ...(component.layout ?? {}), height: value };
                })} />
                {selectedComponent.kind === "roundedRectangle" ? (
                  <NumberField label="Radius" value={numberValue(selectedComponent.style?.cornerRadius, 18)} onChange={(value) => updateSelectedComponent((component) => {
                    component.style = { ...(component.style ?? {}), cornerRadius: value };
                  })} />
                ) : null}
                {selectedComponent.kind === "text" ? (
                  <label className="field-wide">Text<input value={String(selectedComponent.style?.text ?? selectedComponent.name)} onChange={(event) => updateSelectedComponent((component) => {
                    component.style = { ...(component.style ?? {}), text: event.target.value };
                  })} /></label>
                ) : null}
              </div>
          </>
        </section>
        ) : null}

        {workspaceMode === "design" && selectedComponent && inspectorTab === "effects" ? (
          <section>
            <div className="section-heading">
              <h2>Component Effects</h2>
            </div>
            <ComponentPreview component={selectedComponent} />
            <StyleEditor
              kind={selectedComponent.kind ?? "circle"}
              style={selectedComponent.style ?? {}}
              fills={selectedComponent.fills ?? []}
              onChange={(style) => updateSelectedComponent((component) => { component.style = style; })}
              onFillsChange={(fills) => updateSelectedComponent((component) => { component.fills = fills; })}
            />
          </section>
        ) : null}

        {workspaceMode === "design" && !selectedComponent && inspectorTab === "properties" ? (
        <section>
          <div className="section-heading">
            <h2>Inspector</h2>
            {selectedNode?.id !== project.rootNodeId ? <button type="button" className="danger" onClick={deleteSelectedNode}>Delete</button> : null}
          </div>
          {selectedNode ? (
            <>
              {selectedNode.componentId ? null : selectedNode.id === project.rootNodeId ? (
                <p className="inline-note compact-note"><strong>Scene root</strong>. Add layers or place component instances to build the composition.</p>
              ) : (
                <p className="inline-note compact-note"><strong>Plain layer</strong>. Use Create from Selection to save it as a reusable component.</p>
              )}
              {selectedNode.componentId ? (
                <div className="instance-overview" aria-label="Instance override summary">
                  <span><b>Instance</b>{selectedNode.name}</span>
                  <span><b>Main</b>{project.components[selectedNode.componentId]?.name ?? selectedNode.componentId}</span>
                </div>
              ) : null}
              {selectedNode.componentId ? (
                <div className="component-actions">
                  <button type="button" className="secondary-link" onClick={() => {
                    setSelectedComponentId(selectedNode.componentId ?? "");
                    setSelectedNodeId(project.rootNodeId);
                  }}>Edit Main</button>
                  <button type="button" onClick={detachSelectedInstance}>Detach Instance</button>
                </div>
              ) : null}
              <div className="inspector-group">
                <h3><span>01</span> Identity</h3>
              <div className="form-grid">
                <label>Name<input value={selectedNode.name} onChange={(event) => updateSelectedNode((node) => { node.name = event.target.value; })} /></label>
                <label>Role<input value={selectedNode.roles[0] ?? ""} onChange={(event) => updateSelectedRole(event.target.value)} /></label>
              </div>
              </div>
              <div className="inspector-group">
                <h3><span>02</span> Transform</h3>
                <div className="form-grid">
                <NumberField label="Frame X" value={nodeFrameX(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameX(node, value); })} />
                <NumberField label="Frame Y" value={nodeFrameY(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameY(node, value); })} />
                <NumberField label="Width" value={numberValue(selectedNode.layout.width, 80)} onChange={(value) => updateSelectedNode((node) => { node.layout.width = value; })} />
                <NumberField label="Height" value={numberValue(selectedNode.layout.height, 80)} onChange={(value) => updateSelectedNode((node) => { node.layout.height = value; })} />
                {selectedNode.kind === "text" ? (
                  <label>Text<input value={String(selectedNode.style.text ?? selectedNode.name)} onChange={(event) => updateSelectedNode((node) => { node.style.text = event.target.value; })} /></label>
                ) : null}
                </div>
              </div>
              <div className="inspector-group inspector-summary">
                <h3><span>03</span> Runtime</h3>
                <div className="summary-grid">
                  <span><b>Selector</b>#{selectedNode.id}</span>
                  <span><b>Kind</b>{selectedNode.kind}</span>
                  <span><b>Effects</b>{hasVisualEffects(selectedNode) ? "custom" : "default"}</span>
                  <span><b>Motion</b>{nodeUsedInAnimation(project, selectedNode.id) ? "bound" : "ready"}</span>
                </div>
                <p className="panel-hint">Use Effects for visual styling and Animate for motion phases. This layer keeps the same runtime identity in exported JSON.</p>
              </div>
            </>
          ) : null}
        </section>
        ) : null}

        {workspaceMode === "design" && !selectedComponent && selectedNode && inspectorTab === "effects" ? (
          <section>
            <div className="section-heading">
              <h2>Layer Effects</h2>
              {selectedNode.id !== project.rootNodeId ? <button type="button" className="danger" onClick={deleteSelectedNode}>Delete</button> : null}
            </div>
            <StyleEditor
              kind={selectedNode.kind}
              style={selectedNode.style}
              fills={selectedNode.fills ?? []}
              onChange={(style) => updateSelectedNode((node) => { node.style = style; })}
              onFillsChange={(fills) => updateSelectedNode((node) => { node.fills = fills; })}
            />
          </section>
        ) : null}

        {workspaceMode === "animate" && selectedPhase ? (
          <section>
            <div className="section-heading">
              <h2>Animation</h2>
              <button type="button" className="danger" onClick={deletePhase}>Delete Phase</button>
            </div>
            <div className="form-grid">
              <label>Name<input value={selectedPhase.name} onChange={(event) => updateSelectedPhase((phase) => { phase.name = event.target.value; })} /></label>
              <div className="field-block field-wide">
                <span>Target</span>
                <div className="segmented-row compact">
                  <button type="button" className={targetMode === "selected" ? "segment active" : "segment"} onClick={() => setTargetMode("selected")}>Selected</button>
                  <button type="button" className={targetMode === "role" ? "segment active" : "segment"} onClick={() => setTargetMode("role")}>Role group</button>
                </div>
              </div>
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
                  <div className="field-block field-wide">
                    <span>Direction</span>
                    <div className="segmented-row compact">
                      {(["clockwise", "anticlockwise"] as const).map((direction) => (
                        <button
                          type="button"
                          key={direction}
                          className={selectedPhase.arcs[0]?.direction === direction ? "segment active" : "segment"}
                          onClick={() => updateSelectedPhase((phase) => {
                            phase.arcs = phase.arcs.map((arc) => ({ ...arc, direction }));
                          })}
                        >
                          {direction === "clockwise" ? "Clockwise" : "Anticlockwise"}
                        </button>
                      ))}
                    </div>
                  </div>
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
              <ActionEditors
                phase={selectedPhase}
                onChange={updateAction}
              />
            </div>
          </section>
        ) : null}

        {workspaceMode === "design" && inspectorTab === "code" ? (
          <section className="json-section">
            <div className="section-heading"><h2>Runtime JSON</h2></div>
            <pre>{compileResult.ok ? compileResult.value.json : compileResult.error}</pre>
          </section>
        ) : null}

        {workspaceMode === "animate" ? (
        <section className="json-section">
          <button type="button" className="dev-toggle" onClick={() => setShowDeveloperOutput((value) => !value)}>
            {showDeveloperOutput ? "Hide Runtime JSON" : "Show Runtime JSON"}
          </button>
          {showDeveloperOutput ? (
            <>
              <div className="section-heading"><h2>Generated .motion.json</h2></div>
              <pre>{compileResult.ok ? compileResult.value.json : compileResult.error}</pre>
            </>
          ) : null}
        </section>
        ) : null}
      </aside>

      <section className="timeline-panel">
        {workspaceMode === "design" ? (
          <div className="selection-status">
            <div>
              <p className="eyebrow">Selection</p>
              <h2>{selectedNode?.name ?? "Nothing selected"}</h2>
              <span>{selectionKind(project, selectedNode)} · {selectedNode?.kind ?? "none"}</span>
            </div>
            {selectedNode ? (
              <div className="quick-transform" aria-label="Quick transform controls">
                <NumberField label="X" value={nodeFrameX(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameX(node, value); })} />
                <NumberField label="Y" value={nodeFrameY(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameY(node, value); })} />
                <NumberField label="W" value={nodeWidth(selectedNode)} onChange={(value) => updateSelectedNode((node) => { node.layout.width = value; })} />
                <NumberField label="H" value={nodeHeight(selectedNode)} onChange={(value) => updateSelectedNode((node) => { node.layout.height = value; })} />
                <NumberField label="O" value={numberValue(selectedNode.presentation.opacity, 1)} step={0.05} onChange={(value) => updateSelectedNode((node) => { node.presentation.opacity = clamp(value, 0, 1); })} />
              </div>
            ) : (
              <div className="status-metrics">
                <span>No layer selected</span>
              </div>
            )}
          </div>
        ) : (
        <>
        <div className="timeline-header">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2>Composition Timeline</h2>
          </div>
          <div className="timeline-actions">
            <span>{formatTime(previewTime)} / {formatTime(previewPlan.totalDuration)}</span>
            <button type="button" onClick={addPhase}>Add Phase</button>
          </div>
        </div>
        <div className="timeline-composer">
          <div className="time-ruler" aria-hidden="true">
            {timelineTicks(previewPlan.totalDuration).map((tick) => (
              <span key={tick} style={{ left: `${(tick / previewPlan.totalDuration) * 100}%` }}>{formatTime(tick)}</span>
            ))}
          </div>
          <div className="timeline-scrub">
            <input
              aria-label="Timeline playhead"
              max={previewPlan.totalDuration}
              min={0}
              onChange={(event) => scrubPreview(Number(event.target.value))}
              step={0.01}
              type="range"
              value={Math.min(previewTime, previewPlan.totalDuration)}
            />
            <div className="playhead" style={{ left: `${Math.min((previewTime / Math.max(previewPlan.totalDuration, 0.01)) * 100, 100)}%` }} />
          </div>
          <div className="timeline-lanes">
            {previewPlan.segments.map((segment, index) => {
              const width = Math.max((segment.duration / previewPlan.totalDuration) * 100, 5);
              const left = (segment.start / previewPlan.totalDuration) * 100;
              const phase = segment.phase;
              return (
                <button
                  type="button"
                  className={`timeline-layer ${selectedPhaseId === phase.id ? "selected" : ""}`}
                  key={phase.id}
                  onClick={() => {
                    setSelectedPhaseId(phase.id);
                    scrubPreview(segment.start);
                  }}
                >
                  <span className="lane-name">{index + 1}. {phase.name}</span>
                  <span className="lane-track">
                    <span className="lane-bar" style={{ left: `${left}%`, width: `${width}%` }}>
                      <i className="keyframe start" />
                      <i className="keyframe end" />
                      {phase.arcs.length > 0 ? <b>arc</b> : null}
                      {phase.jiggles.length > 0 ? <b>jiggle</b> : null}
                      {phase.actions.length > 0 ? <b>fx</b> : null}
                    </span>
                  </span>
                  <span className="lane-time">{formatTime(segment.start)} to {formatTime(segment.start + segment.duration)}</span>
                </button>
              );
            })}
          </div>
        </div>
        </>
        )}
      </section>
    </main>
  );
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function removeNodeMotionReferences(project: StudioProject, nodeId: string) {
  for (const phase of Object.values(project.phases)) {
    phase.targets = phase.targets.filter((target) => target.select.id !== nodeId);
    phase.rules = phase.rules.filter((rule) => rule.select.id !== nodeId);
    phase.arcs = phase.arcs.filter((arc) => arc.select.id !== nodeId);
    phase.jiggles = phase.jiggles.filter((jiggle) => jiggle.select.id !== nodeId);
    phase.actions = phase.actions.filter((action) => !actionSelectorReferencesNode(action, nodeId));
  }
}

function actionSelectorReferencesNode(action: MotionAction, nodeId: string) {
  const selector = (action as { selector?: { id?: string } }).selector;
  return selector?.id === nodeId;
}

function instanceCount(project: StudioProject, componentId: string) {
  return Object.values(project.nodes).filter((node) => node.componentId === componentId).length;
}

function selectionKind(project: StudioProject, node: StudioNode | undefined) {
  if (!node) return "No selection";
  if (node.id === project.rootNodeId) return "Scene root";
  if (node.componentId) return `Instance of ${project.components[node.componentId]?.name ?? node.componentId}`;
  return "Plain layer";
}

function hasVisualEffects(node: StudioNode) {
  const style = node.style;
  return Boolean(
    Number(style.blur ?? 0) > 0 ||
    Number(style.strokeWidth ?? 0) > 0 ||
    Number(style.shadowBlur ?? 0) > 0 ||
    Number(style.shadowOpacity ?? 0) > 0
  );
}

function nodeUsedInAnimation(project: StudioProject, nodeId: string) {
  return Object.values(project.phases).some((phase) => (
    phase.targets.some((target) => target.select.id === nodeId) ||
    phase.rules.some((rule) => rule.select.id === nodeId) ||
    phase.arcs.some((arc) => arc.select.id === nodeId) ||
    phase.jiggles.some((jiggle) => jiggle.select.id === nodeId) ||
    phase.actions.some((action) => actionSelectorReferencesNode(action, nodeId))
  ));
}

function rulerTicks(size: number) {
  const ticks: number[] = [];
  for (let tick = 100; tick < size; tick += 100) {
    ticks.push(tick);
  }
  return ticks;
}

function nodeWidth(node: StudioNode | undefined) {
  if (!node) return 0;
  return numberValue(node.layout.width, node.kind === "circle" ? 62 : 128);
}

function nodeHeight(node: StudioNode | undefined) {
  if (!node) return 0;
  return numberValue(node.layout.height, node.kind === "circle" ? 62 : 74);
}

function nodeFrameX(node: StudioNode | undefined) {
  if (!node) return 0;
  return canvasCenter.x + numberValue(node.presentation["offset.x"]) - nodeWidth(node) / 2;
}

function nodeFrameY(node: StudioNode | undefined) {
  if (!node) return 0;
  return canvasCenter.y + numberValue(node.presentation["offset.y"]) - nodeHeight(node) / 2;
}

function setNodeFrameX(node: StudioNode, value: number) {
  node.presentation["offset.x"] = value - canvasCenter.x + nodeWidth(node) / 2;
}

function setNodeFrameY(node: StudioNode, value: number) {
  node.presentation["offset.y"] = value - canvasCenter.y + nodeHeight(node) / 2;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  const [draft, setDraft] = useState(() => String(round(value)));

  useEffect(() => {
    setDraft(String(round(value)));
  }, [value]);

  function commit(nextValue: string) {
    setDraft(nextValue);

    if (nextValue.trim() === "" || nextValue === "-" || nextValue === "." || nextValue === "-.") {
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  }

  function normalize() {
    const parsed = Number(draft);
    setDraft(Number.isFinite(parsed) ? String(round(parsed)) : String(round(value)));
  }

  return (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        data-step={step}
        value={draft}
        onBlur={normalize}
        onChange={(event) => commit(event.target.value)}
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeValue = isHexColor(value) ? normalizeHex(value) : "#5ED8FF";
  return (
    <label className="color-field">
      {label}
      <span>
        <input
          aria-label={`${label} picker`}
          type="color"
          value={safeValue}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <input
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </span>
    </label>
  );
}

function StyleEditor({
  kind,
  style,
  fills,
  onChange,
  onFillsChange
}: {
  kind: NodeKindChoice;
  style: StudioNode["style"];
  fills: MotionFill[];
  onChange: (style: StudioNode["style"]) => void;
  onFillsChange: (fills: MotionFill[]) => void;
}) {
  const isText = kind === "text";
  const foreground = String(style.foregroundColor ?? "#FFFFFF");
  const fill = fills[0] ?? fillsFromStyle(style, kind)[0] ?? defaultFills(kind)[0] ?? solidFill("#232327");
  const fillType = fill.type;
  const startStop = fill.type === "solid" ? undefined : fill.colors[0];
  const endStop = fill.type === "solid" ? undefined : fill.colors[1];
  const startColor = fill.type === "solid" ? fill.color : startStop?.color ?? "#5ED8FF";
  const endColor = fill.type === "solid" ? "#B58CFF" : endStop?.color ?? "#B58CFF";
  const startPosition = fill.type === "solid" ? 0 : startStop?.position ?? 0;
  const endPosition = fill.type === "solid" ? 1 : endStop?.position ?? 1;
  const fillOpacity = fill.opacity ?? 1;

  function applyStyle(nextStyle: StudioNode["style"], nextFills: MotionFill[]) {
    onChange(nextStyle);
    onFillsChange(nextFills);
  }

  function applyFill(nextFill: MotionFill) {
    applyStyle(styleFromFill(style, nextFill), [nextFill]);
  }

  function switchFill(type: MotionFill["type"]) {
    if (type === "solid") {
      applyFill(solidFill(startColor, fillOpacity));
      return;
    }

    if (type === "linearGradient") {
      applyFill(linearFill(startColor, endColor, numberFromFill(fill, "angle", 135), startPosition, endPosition, fillOpacity));
      return;
    }

    applyFill(radialFill(
      startColor,
      endColor,
      fill.type === "radialGradient" ? fill.centerX ?? 0.5 : 0.5,
      fill.type === "radialGradient" ? fill.centerY ?? 0.5 : 0.5,
      fill.type === "radialGradient" ? fill.radius ?? 90 : 90,
      startPosition,
      endPosition,
      fillOpacity
    ));
  }

  function updateFill(updater: (current: MotionFill) => MotionFill) {
    applyFill(updater(fill));
  }

  function patchTextColor(value: string) {
    applyStyle({ ...style, foregroundColor: value }, fills);
  }

  function patchStyleValue(key: string, value: MotionValue) {
    applyStyle({ ...style, [key]: value }, fills);
  }

  return (
    <div className="control-cluster inspector-group appearance-group">
      <h3><span>03</span> Appearance</h3>
      <div className="style-preview" style={{ background: visualBackground(style, kind, fills) }}>
        <span>{isText ? String(style.text ?? "Text") : "Fill"}</span>
      </div>
      <div className="form-grid">
        <ColorField
          label={fillType === "solid" ? (isText ? "Background" : "Fill") : "Start Color"}
          value={startColor}
          onChange={(value) => updateFill((current) => updateFillColor(current, "start", value))}
        />
        {isText ? (
          <ColorField label="Text Color" value={foreground} onChange={patchTextColor} />
        ) : null}
        <div className="field-block field-wide">
          <span>Fill Mode</span>
          <div className="segmented-row compact wrap">
            {(["solid", "linearGradient", "radialGradient"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={fillType === type ? "segment active" : "segment"}
                onClick={() => switchFill(type)}
              >
                {fillLabel(type)}
              </button>
            ))}
          </div>
        </div>
        {fillType !== "solid" ? (
          <ColorField label="End Color" value={endColor} onChange={(value) => updateFill((current) => updateFillColor(current, "end", value))} />
        ) : null}
        <NumberField
          label="Fill Opacity"
          value={fillOpacity}
          step={0.05}
          onChange={(value) => updateFill((current) => ({ ...current, opacity: clamp(value, 0, 1) }))}
        />
      </div>
      <details className="advanced-controls" open>
        <summary>Effects</summary>
        <div className="form-grid">
          <NumberField label="Blur" value={numberValue(style.blur, 0)} step={1} onChange={(value) => patchStyleValue("blur", Math.max(0, value))} />
          <NumberField label="Stroke Width" value={numberValue(style.strokeWidth, 0)} step={1} onChange={(value) => patchStyleValue("strokeWidth", Math.max(0, value))} />
          <ColorField label="Stroke Color" value={String(style.strokeColor ?? "#E0F2FE")} onChange={(value) => patchStyleValue("strokeColor", value)} />
          <ColorField label="Shadow Color" value={String(style.shadowColor ?? "#000000")} onChange={(value) => patchStyleValue("shadowColor", value)} />
          <NumberField label="Shadow X" value={numberValue(style.shadowX, 0)} step={1} onChange={(value) => patchStyleValue("shadowX", value)} />
          <NumberField label="Shadow Y" value={numberValue(style.shadowY, 0)} step={1} onChange={(value) => patchStyleValue("shadowY", value)} />
          <NumberField label="Shadow Blur" value={numberValue(style.shadowBlur, 0)} step={1} onChange={(value) => patchStyleValue("shadowBlur", Math.max(0, value))} />
          <NumberField label="Shadow Opacity" value={numberValue(style.shadowOpacity, 0)} step={0.05} onChange={(value) => patchStyleValue("shadowOpacity", clamp(value, 0, 1))} />
        </div>
      </details>
      {fillType !== "solid" ? (
        <details className="advanced-controls">
          <summary>Gradient controls</summary>
          <div className="form-grid">
            <NumberField
              label="Start Stop"
              value={startPosition}
              step={0.05}
              onChange={(value) => updateFill((current) => updateFillStop(current, "start", clamp(value, 0, 1)))}
            />
            <NumberField
              label="End Stop"
              value={endPosition}
              step={0.05}
              onChange={(value) => updateFill((current) => updateFillStop(current, "end", clamp(value, 0, 1)))}
            />
            {fillType === "linearGradient" ? (
              <NumberField label="Angle" value={fill.angle ?? 135} onChange={(value) => updateFill((current) => ({ ...asLinearFill(current, startColor, endColor), angle: value }))} />
            ) : null}
            {fillType === "radialGradient" ? (
              <>
                <NumberField label="Center X" value={fill.centerX ?? 0.5} step={0.05} onChange={(value) => updateFill((current) => ({ ...asRadialFill(current, startColor, endColor), centerX: clamp(value, 0, 1) }))} />
                <NumberField label="Center Y" value={fill.centerY ?? 0.5} step={0.05} onChange={(value) => updateFill((current) => ({ ...asRadialFill(current, startColor, endColor), centerY: clamp(value, 0, 1) }))} />
                <NumberField label="Radius" value={fill.radius ?? 90} step={5} onChange={(value) => updateFill((current) => ({ ...asRadialFill(current, startColor, endColor), radius: Math.max(1, value) }))} />
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ComponentSwatch({ component }: { component: StudioComponent }) {
  const kind = component.kind ?? "circle";
  return (
    <span
      className={`component-swatch component-${kind}`}
      style={{
        background: visualBackground(component.style ?? {}, kind, component.fills ?? []),
        borderRadius: kind === "circle" ? 999 : numberValue(component.style?.cornerRadius, 10),
        ...visualEffects(component.style ?? {}, 0.35)
      }}
    />
  );
}

function ComponentPreview({ component }: { component: StudioComponent }) {
  const kind = component.kind ?? "circle";
  const width = Math.min(numberValue(component.layout?.width, kind === "circle" ? 72 : 150), 170);
  const height = Math.min(numberValue(component.layout?.height, kind === "circle" ? 72 : 86), 110);
  return (
    <div className="component-preview">
      <div
        className={`component-preview-object component-${kind}`}
        style={{
          width,
          height,
          background: visualBackground(component.style ?? {}, kind, component.fills ?? []),
          borderRadius: kind === "circle" ? 999 : numberValue(component.style?.cornerRadius, 18),
          color: String(component.style?.foregroundColor ?? "#FFFFFF"),
          ...visualEffects(component.style ?? {})
        }}
      >
        {kind === "text" ? String(component.style?.text ?? component.name) : ""}
      </div>
    </div>
  );
}

function MotionSpecEditor({ motion, onChange }: { motion: MotionSpec | undefined; onChange: (motion: MotionSpec) => void }) {
  const current = motion ?? { type: "spring", response: 0.75, dampingFraction: 0.72 };
  return (
    <div className="control-cluster">
      <h3>Motion Behavior</h3>
      <div className="segmented-row" aria-label="Motion behavior">
        <button
          type="button"
          className={current.type === "spring" ? "segment active" : "segment"}
          onClick={() => onChange({ type: "spring", response: 0.75, dampingFraction: 0.72 })}
        >
          Spring
        </button>
        <button
          type="button"
          className={current.type === "timed" ? "segment active" : "segment"}
          onClick={() => onChange({ type: "timed", duration: 0.75, easing: "easeInOut" })}
        >
          Timed
        </button>
        <button
          type="button"
          className={current.type === "immediate" ? "segment active" : "segment"}
          onClick={() => onChange({ type: "immediate" })}
        >
          Immediate
        </button>
      </div>

      <div className="form-grid">
        {current.type === "spring" ? (
          <>
            <NumberField label="Response" value={current.response} step={0.05} onChange={(value) => onChange({ ...current, response: value })} />
            <NumberField label="Damping" value={current.dampingFraction} step={0.05} onChange={(value) => onChange({ ...current, dampingFraction: value })} />
          </>
        ) : null}
        {current.type === "timed" ? (
          <>
            <NumberField label="Duration" value={current.duration} step={0.05} onChange={(value) => onChange({ ...current, duration: value })} />
            <div className="field-block field-wide">
              <span>Easing</span>
              <div className="segmented-row compact">
                {(["linear", "easeIn", "easeOut", "easeInOut"] as const).map((easing) => (
                  <button
                    key={easing}
                    type="button"
                    className={(current.easing ?? "easeInOut") === easing ? "segment active" : "segment"}
                    onClick={() => onChange({ ...current, easing })}
                  >
                    {easingLabel(easing)}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}
        {current.type === "immediate" ? (
          <p className="inline-note">Applies the target on the next preview frame.</p>
        ) : null}
      </div>
    </div>
  );
}

function ToggleButton({ active, label, onToggle }: { active: boolean; label: string; onToggle: (enabled: boolean) => void }) {
  return <button type="button" className={active ? "toggle active" : "toggle"} onClick={() => onToggle(!active)}>{label}</button>;
}

function ActionEditors({
  phase,
  onChange
}: {
  phase: StudioPhase;
  onChange: (type: MotionAction["type"], updater: (action: MotionAction) => MotionAction) => void;
}) {
  const particleAction = phase.actions.find((action): action is ParticleAction => action.type === "emitParticles");
  const componentAction = phase.actions.find((action): action is SpawnComponentsAction => action.type === "spawnComponents");
  const shakeAction = phase.actions.find((action): action is ScreenShakeAction => action.type === "screenShake");
  const hapticAction = phase.actions.find((action): action is HapticAction => action.type === "haptic");

  return (
    <div className="action-editors">
      {particleAction ? (
        <div className="nested-editor">
          <h4>Particles</h4>
          <div className="form-grid">
            <NumberField label="Count" value={particleAction.count} onChange={(value) => onChange("emitParticles", (action) => ({ ...action as ParticleAction, count: Math.max(1, Math.round(value)) }))} />
            <NumberField label="Size" value={numberValue(particleAction.particle.layout.width, 7)} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, particle: { ...next.particle, layout: { ...next.particle.layout, width: value, height: value } } };
            })} />
            <NumberField label="Lifetime" value={particleAction.particle.lifetime} step={0.05} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              const lifetime = Math.max(0.05, value);
              return { ...next, duration: lifetime, particle: { ...next.particle, lifetime, motion: { type: "timed", duration: lifetime, easing: "easeOut" } } };
            })} />
            <NumberField label="Min distance" value={particleAction.distance?.min ?? 24} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, distance: { min: value, max: next.distance?.max ?? 150 } };
            })} />
            <NumberField label="Max distance" value={particleAction.distance?.max ?? 150} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, distance: { min: next.distance?.min ?? 24, max: value } };
            })} />
            <NumberField label="Start angle" value={particleAction.angle?.min ?? 0} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, angle: { min: value, max: next.angle?.max ?? 360 } };
            })} />
            <NumberField label="End angle" value={particleAction.angle?.max ?? 360} onChange={(value) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, angle: { min: next.angle?.min ?? 0, max: value } };
            })} />
            <label>Color<input value={String(particleAction.particle.style.backgroundColor ?? "#67E8F9")} onChange={(event) => onChange("emitParticles", (action) => {
              const next = action as ParticleAction;
              return { ...next, particle: { ...next.particle, style: { ...next.particle.style, backgroundColor: event.target.value } } };
            })} /></label>
          </div>
        </div>
      ) : null}

      {componentAction ? (
        <div className="nested-editor">
          <h4>Spawned components</h4>
          <div className="form-grid">
            <NumberField label="Count" value={componentAction.components.length} onChange={(value) => onChange("spawnComponents", (action) => {
              const next = action as SpawnComponentsAction;
              return { ...next, components: makeSpawnedComponents(next, Math.max(1, Math.min(8, Math.round(value)))) };
            })} />
            <NumberField label="Size" value={numberValue(componentAction.components[0]?.layout.width, 26)} onChange={(value) => onChange("spawnComponents", (action) => {
              const next = action as SpawnComponentsAction;
              return { ...next, components: next.components.map((component) => ({ ...component, layout: { ...component.layout, width: value, height: value } })) };
            })} />
            <NumberField label="Spread" value={componentSpread(componentAction)} onChange={(value) => onChange("spawnComponents", (action) => {
              const next = action as SpawnComponentsAction;
              return { ...next, components: makeSpawnedComponents(next, next.components.length, value) };
            })} />
            <NumberField label="Lifetime" value={componentAction.components[0]?.lifetime ?? 0.72} step={0.05} onChange={(value) => onChange("spawnComponents", (action) => {
              const lifetime = Math.max(0.05, value);
              const next = action as SpawnComponentsAction;
              return {
                ...next,
                components: next.components.map((component) => ({
                  ...component,
                  lifetime,
                  motion: { type: "timed", duration: lifetime, easing: "easeOut" }
                }))
              };
            })} />
            <label>Color<input value={String(componentAction.components[0]?.style.backgroundColor ?? "#60A5FA")} onChange={(event) => onChange("spawnComponents", (action) => {
              const next = action as SpawnComponentsAction;
              return { ...next, components: next.components.map((component) => ({ ...component, style: { ...component.style, backgroundColor: event.target.value } })) };
            })} /></label>
          </div>
        </div>
      ) : null}

      {shakeAction ? (
        <div className="nested-editor">
          <h4>Screen shake</h4>
          <div className="form-grid">
            <NumberField label="Amplitude" value={shakeAction.amplitude} step={0.5} onChange={(value) => onChange("screenShake", (action) => ({ ...action as ScreenShakeAction, amplitude: Math.max(0, value) }))} />
            <NumberField label="Duration" value={shakeAction.duration} step={0.05} onChange={(value) => onChange("screenShake", (action) => ({ ...action as ScreenShakeAction, duration: Math.max(0.05, value) }))} />
            <NumberField label="Frequency" value={shakeAction.frequency ?? 26} step={1} onChange={(value) => onChange("screenShake", (action) => ({ ...action as ScreenShakeAction, frequency: Math.max(0, value) }))} />
            <NumberField label="Decay" value={shakeAction.decay ?? 1.2} step={0.05} onChange={(value) => onChange("screenShake", (action) => ({ ...action as ScreenShakeAction, decay: Math.max(0, value) }))} />
          </div>
        </div>
      ) : null}

      {hapticAction ? (
        <div className="nested-editor">
          <h4>Haptic</h4>
          <div className="form-grid">
            <div className="field-block field-wide">
              <span>Style</span>
              <div className="segmented-row compact wrap">
                {(["light", "medium", "heavy", "soft", "rigid", "selection", "success", "warning", "error"] as const).map((style) => (
                  <button
                    type="button"
                    key={style}
                    className={hapticAction.style === style ? "segment active" : "segment"}
                    onClick={() => onChange("haptic", (action) => ({ ...action as HapticAction, style }))}
                  >
                    {titleCase(style)}
                  </button>
                ))}
              </div>
            </div>
            <NumberField label="Intensity" value={hapticAction.intensity ?? 0.82} step={0.05} onChange={(value) => onChange("haptic", (action) => ({ ...action as HapticAction, intensity: clamp(value, 0, 1) }))} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CanvasNode({
  node,
  selected,
  phaseTargets,
  previewTransform,
  onPointerDown,
  onResizeStart
}: {
  node: StudioNode;
  selected: boolean;
  phaseTargets?: ReturnType<typeof defaultPhaseTargets>;
  previewTransform?: PreviewTransform | undefined;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart?: (corner: ResizeCorner, event: React.PointerEvent<HTMLElement>) => void;
}) {
  const originX = numberValue(node.presentation["offset.x"]);
  const originY = numberValue(node.presentation["offset.y"]);
  const targetX = previewTransform?.x ?? phaseTargets?.x ?? originX;
  const targetY = previewTransform?.y ?? phaseTargets?.y ?? originY;
  const width = numberValue(node.layout.width, node.kind === "circle" ? 62 : 128);
  const height = numberValue(node.layout.height, node.kind === "circle" ? 62 : 74);
  const x = canvasCenter.x + targetX - width / 2;
  const y = canvasCenter.y + targetY - height / 2;
  const scale = previewTransform?.scale ?? phaseTargets?.scale ?? numberValue(node.presentation.scale, 1);
  const rotation = previewTransform?.rotation ?? phaseTargets?.rotation ?? numberValue(node.presentation.rotation);
  const opacity = previewTransform?.opacity ?? phaseTargets?.opacity ?? numberValue(node.presentation.opacity, 1);
  const style = {
    left: x,
    top: y,
    width,
    height,
    opacity,
    transform: `rotate(${rotation}deg) scale(${scale})`,
    background: node.kind === "text" && node.style.backgroundColor === undefined && (node.fills?.length ?? 0) === 0
      ? "transparent"
      : visualBackground(node.style, node.kind, node.fills ?? []),
    color: String(node.style.foregroundColor ?? "#FFFFFF"),
    borderRadius: node.kind === "circle" ? 999 : numberValue(node.style.cornerRadius, 12),
    ...visualEffects(node.style)
  } satisfies React.CSSProperties;

  return (
    <div
      className={`canvas-node canvas-${node.kind} ${selected ? "selected" : ""}`}
      data-node-id={node.id}
      data-roles={node.roles.join(" ")}
      style={style}
      onPointerDown={onPointerDown}
    >
      {selected ? (
        <>
          <span className="selection-guide guide-x" aria-hidden="true" />
          <span className="selection-guide guide-y" aria-hidden="true" />
          <span className="selection-frame" aria-hidden="true" />
          <span className="selection-rotate" aria-hidden="true" />
          <span className="selection-handle nw" aria-label="Resize from top left" role="button" onPointerDown={(event) => onResizeStart?.("nw", event)} />
          <span className="selection-handle n" aria-label="Resize from top" role="button" onPointerDown={(event) => onResizeStart?.("n", event)} />
          <span className="selection-handle ne" aria-label="Resize from top right" role="button" onPointerDown={(event) => onResizeStart?.("ne", event)} />
          <span className="selection-handle e" aria-label="Resize from right" role="button" onPointerDown={(event) => onResizeStart?.("e", event)} />
          <span className="selection-handle s" aria-label="Resize from bottom" role="button" onPointerDown={(event) => onResizeStart?.("s", event)} />
          <span className="selection-handle w" aria-label="Resize from left" role="button" onPointerDown={(event) => onResizeStart?.("w", event)} />
          <span className="selection-handle sw" aria-label="Resize from bottom left" role="button" onPointerDown={(event) => onResizeStart?.("sw", event)} />
          <span className="selection-handle se" aria-label="Resize from bottom right" role="button" onPointerDown={(event) => onResizeStart?.("se", event)} />
          <span className="selection-pivot" aria-hidden="true" />
          <span className="selection-size" aria-hidden="true">{round(width)} x {round(height)}</span>
        </>
      ) : null}
      {node.kind === "text" ? String(node.style.text ?? node.name) : null}
    </div>
  );
}

function PreviewVisualNode({ visual }: { visual: PreviewVisual }) {
  const style = {
    left: canvasCenter.x + visual.x - visual.width / 2,
    top: canvasCenter.y + visual.y - visual.height / 2,
    width: visual.width,
    height: visual.height,
    opacity: clamp(visual.opacity, 0, 1),
    transform: `rotate(${visual.rotation}deg) scale(${visual.scale})`,
    background: visual.kind === "text" ? "transparent" : visual.color,
    color: visual.color,
    borderRadius: visual.kind === "circle" ? 999 : visual.cornerRadius ?? 8
  } satisfies React.CSSProperties;

  return (
    <div className={`canvas-node preview-visual canvas-${visual.kind}`} style={style}>
      {visual.kind === "text" ? visual.text : ""}
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
      return normalizeLoadedProject(JSON.parse(raw) as StudioProject);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }
  return cloneProject(orbPlaygroundProject);
}

function loadStoredPanelWidth(key: string, fallback: number, min: number, max: number) {
  const raw = window.localStorage.getItem(key);
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function normalizeLoadedProject(project: StudioProject) {
  if (project.id !== orbPlaygroundProject.id) return project;
  const selection = project.editor?.selection ?? [];
  if (selection.length === 1 && selection[0] === "orb") {
    return {
      ...project,
      editor: { viewportPreset: project.editor?.viewportPreset ?? "iphone", ...project.editor, selection: [] }
    };
  }
  return project;
}

function saveStoredProject(project: StudioProject) {
  window.localStorage.setItem(storageKey, JSON.stringify(project));
}

function buildPreviewPlan(project: StudioProject) {
  const segments: PreviewSegment[] = [];
  let cursor = 0;
  let values = initialPreviewTransforms(project);

  for (const phaseId of project.phaseOrder) {
    const phase = project.phases[phaseId];
    if (!phase) continue;

    const start = cursor + phase.startDelay;
    const duration = previewPhaseDuration(phase);
    const nextValues = applyPreviewTargets(project, values, phase.targets);
    segments.push({
      phase,
      start,
      duration,
      from: clone(values),
      to: clone(nextValues)
    });
    values = nextValues;
    cursor = start + (phase.nextMode === "atTime" ? phase.nextAt ?? duration : duration);
  }

  const totalDuration = Math.max(
    0.01,
    ...segments.map((segment) => segment.start + segment.duration),
    cursor
  );
  return { segments, totalDuration };
}

function emptyPreviewFrame(): PreviewFrame {
  return { transforms: {}, visuals: [], shake: { x: 0, y: 0 } };
}

function samplePreview(
  project: StudioProject,
  plan: ReturnType<typeof buildPreviewPlan>,
  time: number
): PreviewFrame {
  let values = initialPreviewTransforms(project);
  const visuals: PreviewVisual[] = [];
  const shake = { x: 0, y: 0 };

  for (const segment of plan.segments) {
    collectPreviewActions(project, segment, time, visuals, shake);

    if (time < segment.start) {
      continue;
    }

    if (time >= segment.start + segment.duration) {
      values = clone(segment.to);
      continue;
    }

    const localTime = time - segment.start;
    const nextValues = clone(segment.from);
    for (const node of Object.values(project.nodes)) {
      const from = segment.from[node.id];
      const to = segment.to[node.id];
      if (!from || !to) continue;

      const motion = motionForNode(segment.phase, node);
      const progress = motionProgress(motion, localTime, segment.duration);
      const arc = segment.phase.arcs.find((candidate) => matchesNodeSelector(candidate.select, node));
      const point = arc
        ? arcPoint(from, to, progress, arc.bend ?? 0, arc.direction)
        : {
            x: interpolate(from.x, to.x, progress),
            y: interpolate(from.y, to.y, progress)
          };
      const jiggle = segment.phase.jiggles
        .filter((candidate) => matchesNodeSelector(candidate.select, node))
        .reduce((total, rule) => total + jiggleOffset(rule, localTime), 0);

      nextValues[node.id] = {
        x: point.x,
        y: point.y,
        scale: interpolate(from.scale, to.scale, progress),
        rotation: interpolate(from.rotation, to.rotation, progress) + jiggle,
        opacity: clamp(interpolate(from.opacity, to.opacity, progress), 0, 1)
      };
    }
    values = nextValues;
    break;
  }

  return { transforms: values, visuals, shake };
}

function initialPreviewTransforms(project: StudioProject): Record<string, PreviewTransform> {
  return Object.fromEntries(
    Object.values(project.nodes).map((node) => [
      node.id,
      {
        x: numberValue(node.presentation["offset.x"]),
        y: numberValue(node.presentation["offset.y"]),
        scale: numberValue(node.presentation.scale, 1),
        rotation: numberValue(node.presentation.rotation),
        opacity: numberValue(node.presentation.opacity, 1)
      }
    ])
  );
}

function applyPreviewTargets(
  project: StudioProject,
  current: Record<string, PreviewTransform>,
  targets: MotionAssignment[]
): Record<string, PreviewTransform> {
  const next = clone(current);
  for (const assignment of targets) {
    if (typeof assignment.value !== "number") continue;
    for (const nodeId of resolveNodeSelector(project, assignment.select)) {
      const transform = next[nodeId];
      if (!transform) continue;
      for (const property of assignment.select.properties) {
        if (property === "offset.x") transform.x = assignment.value;
        if (property === "offset.y") transform.y = assignment.value;
        if (property === "scale") transform.scale = assignment.value;
        if (property === "rotation") transform.rotation = assignment.value;
        if (property === "opacity") transform.opacity = assignment.value;
      }
    }
  }
  return next;
}

function collectPreviewActions(
  project: StudioProject,
  segment: PreviewSegment,
  time: number,
  visuals: PreviewVisual[],
  shake: { x: number; y: number }
) {
  const scheduled = schedulePreviewActions(segment.phase.actions, segment.start);
  for (const item of scheduled) {
    const localTime = time - item.start;
    if (localTime < 0 || localTime > item.duration) continue;

    if (item.action.type === "emitParticles") {
      visuals.push(...sampleParticles(project, segment, item.action as ParticleAction, localTime));
    } else if (item.action.type === "spawnComponents") {
      visuals.push(...sampleSpawnedComponents(project, segment, item.action as SpawnComponentsAction, localTime));
    } else if (item.action.type === "screenShake") {
      const action = item.action as ScreenShakeAction;
      const progress = clamp(localTime / Math.max(action.duration, 0.01), 0, 1);
      const decay = Math.max(0, 1 - (action.decay ?? 1) * progress);
      const frequency = action.frequency ?? 26;
      shake.x += Math.sin(localTime * frequency) * action.amplitude * decay;
      shake.y += Math.cos(localTime * frequency * 0.87) * action.amplitude * 0.45 * decay;
    }
  }
}

function schedulePreviewActions(actions: MotionAction[], baseStart: number): Array<{ action: MotionAction; start: number; duration: number }> {
  const scheduled: Array<{ action: MotionAction; start: number; duration: number }> = [];

  function visit(action: MotionAction, start: number) {
    const children = actionChildren(action);
    if (action.type === "sequence" && children.length > 0) {
      let cursor = start;
      for (const child of children) {
        visit(child, cursor);
        cursor += motionActionDuration(child);
      }
      return;
    }

    if (action.type === "parallel" && children.length > 0) {
      for (const child of children) {
        visit(child, start);
      }
      return;
    }

    if (action.type === "delay") {
      return;
    }

    scheduled.push({ action, start, duration: motionActionDuration(action) });
  }

  actions.forEach((action) => visit(action, baseStart));
  return scheduled;
}

function sampleParticles(
  project: StudioProject,
  segment: PreviewSegment,
  action: ParticleAction,
  localTime: number
): PreviewVisual[] {
  const lifetime = Math.max(action.particle.lifetime, 0.01);
  const progress = motionProgress(action.particle.motion, localTime, lifetime);
  const targets = action.selector ? resolveNodeSelector(project, action.selector) : [project.rootNodeId];
  const anchors = targets.length > 0 ? targets : [project.rootNodeId];
  const count = Math.max(1, Math.min(action.count, 128));
  const angleMin = action.angle?.min ?? 0;
  const angleMax = action.angle?.max ?? 360;
  const distanceMin = action.distance?.min ?? 24;
  const distanceMax = action.distance?.max ?? 150;
  const width = numberValue(action.particle.layout.width, 7);
  const height = numberValue(action.particle.layout.height, width);
  const fromScale = numberValue(action.particle.from.scale, 1);
  const toScale = numberValue(action.particle.to.scale, 0.08);
  const fromOpacity = numberValue(action.particle.from.opacity, 1);
  const toOpacity = numberValue(action.particle.to.opacity, 0);
  const color = visualBackground(action.particle.style, action.particle.kind, action.particle.fills ?? []);

  return anchors.flatMap((nodeId, anchorIndex) => {
    const anchor = segment.from[nodeId] ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
    return Array.from({ length: count }, (_, index) => {
      const spread = count === 1 ? 0.5 : index / (count - 1);
      const angle = degreesToRadians(interpolate(angleMin, angleMax, spread));
      const alternating = index % 2 === 0 ? 1 : -1;
      const distanceSpread = count === 1 ? 1 : ((index * 37) % count) / Math.max(count - 1, 1);
      const distance = interpolate(distanceMin, distanceMax, distanceSpread);
      return {
        id: `${action.id}-${anchorIndex}-${index}`,
        kind: action.particle.kind,
        x: anchor.x + Math.cos(angle) * distance * progress,
        y: anchor.y + Math.sin(angle) * distance * alternating * progress,
        width,
        height,
        scale: interpolate(fromScale, toScale, progress),
        rotation: interpolate(0, 180, progress) * alternating,
        opacity: interpolate(fromOpacity, toOpacity, progress),
        color,
        cornerRadius: numberValue(action.particle.style.cornerRadius, action.particle.kind === "roundedRectangle" ? 4 : 999)
      };
    });
  });
}

function sampleSpawnedComponents(
  project: StudioProject,
  segment: PreviewSegment,
  action: SpawnComponentsAction,
  localTime: number
): PreviewVisual[] {
  const targets = action.selector ? resolveNodeSelector(project, action.selector) : [project.rootNodeId];
  const anchors = targets.length > 0 ? targets : [project.rootNodeId];
  return anchors.flatMap((nodeId, anchorIndex) => {
    const anchor = segment.from[nodeId] ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
    return action.components.map((component, index) => {
      const lifetime = Math.max(component.lifetime, 0.01);
      const progress = motionProgress(component.motion, localTime, lifetime);
      const visual: PreviewVisual = {
        id: `${action.id}-${anchorIndex}-${component.id}`,
        kind: component.kind,
        x: anchor.x + interpolate(numberValue(component.from["offset.x"]), numberValue(component.to["offset.x"]), progress),
        y: anchor.y + interpolate(numberValue(component.from["offset.y"]), numberValue(component.to["offset.y"]), progress),
        width: numberValue(component.layout.width, 26),
        height: numberValue(component.layout.height, numberValue(component.layout.width, 26)),
        scale: interpolate(numberValue(component.from.scale, 1), numberValue(component.to.scale, 0.18), progress),
        rotation: interpolate(numberValue(component.from.rotation), numberValue(component.to.rotation, 0), progress),
        opacity: interpolate(numberValue(component.from.opacity, 0.85), numberValue(component.to.opacity, 0), progress),
        color: visualBackground(component.style, component.kind, component.fills ?? []),
        cornerRadius: numberValue(component.style.cornerRadius, component.kind === "roundedRectangle" ? 8 : 999)
      };
      if (component.kind === "text") {
        visual.text = String(component.style.text ?? "");
      }
      return visual;
    });
  });
}

function previewPhaseDuration(phase: StudioPhase) {
  const ruleDurations = phase.rules.map((rule) => motionDuration(rule.motion));
  const jiggleDurations = phase.jiggles.map((jiggle) => jiggle.duration);
  const actionDurations = phase.actions.map(motionActionDuration);
  return Math.max(0.01, ...ruleDurations, ...jiggleDurations, ...actionDurations);
}

function motionDuration(motion: MotionSpec) {
  if (motion.type === "spring") return motion.response;
  if (motion.type === "timed") return motion.duration;
  return 0.01;
}

function motionActionDuration(action: MotionAction): number {
  const children = actionChildren(action);
  if (action.type === "sequence" && children.length > 0) {
    return children.reduce((total, child) => total + motionActionDuration(child), 0);
  }

  if (action.type === "parallel" && children.length > 0) {
    return Math.max(0, ...children.map(motionActionDuration));
  }

  if (action.type === "delay") return numberValue((action as { duration?: unknown }).duration);
  if (action.type === "screenShake") return Math.max(0.01, numberValue((action as ScreenShakeAction).duration, 0.32));
  if (action.type === "emitParticles") {
    const particle = (action as ParticleAction).particle;
    const explicitDuration = numberValue((action as ParticleAction).duration, 0);
    return Math.max(0.01, explicitDuration > 0 ? explicitDuration : numberValue(particle.lifetime, 0.72));
  }
  if (action.type === "spawnComponents") {
    return Math.max(0.01, ...(action as SpawnComponentsAction).components.map((component) => numberValue(component.lifetime, 0.72)));
  }
  return 0.01;
}

function actionChildren(action: MotionAction): MotionAction[] {
  const maybeChildren = (action as unknown as { actions?: unknown }).actions;
  return Array.isArray(maybeChildren) ? maybeChildren as MotionAction[] : [];
}

function motionForNode(phase: StudioPhase, node: StudioNode): MotionSpec {
  return phase.rules.find((rule) => matchesNodeSelector(rule.select, node))?.motion
    ?? phase.rules[0]?.motion
    ?? { type: "immediate" };
}

function motionProgress(motion: MotionSpec, localTime: number, fallbackDuration: number) {
  if (motion.type === "immediate") return 1;

  const duration = motionDuration(motion) || fallbackDuration;
  const t = clamp(localTime / Math.max(duration, 0.01), 0, 1);
  if (motion.type === "spring") {
    const damping = clamp(motion.dampingFraction, 0.05, 3);
    const oscillation = Math.cos((1.2 + (1 - Math.min(damping, 1)) * 1.6) * Math.PI * t);
    return clamp(1 - Math.exp(-5.5 * damping * t) * oscillation, -0.12, 1.12);
  }

  if (motion.easing === "linear") return t;
  if (motion.easing === "easeIn") return t * t;
  if (motion.easing === "easeOut") return 1 - Math.pow(1 - t, 2);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function arcPoint(
  from: PreviewTransform,
  to: PreviewTransform,
  progress: number,
  bend: number,
  direction: "clockwise" | "anticlockwise"
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const multiplier = direction === "anticlockwise" ? -1 : 1;
  const control = {
    x: (from.x + to.x) / 2 + (-dy / length) * bend * multiplier,
    y: (from.y + to.y) / 2 + (dx / length) * bend * multiplier
  };
  const t = clamp(progress, 0, 1);
  const oneMinus = 1 - t;
  return {
    x: oneMinus * oneMinus * from.x + 2 * oneMinus * t * control.x + t * t * to.x,
    y: oneMinus * oneMinus * from.y + 2 * oneMinus * t * control.y + t * t * to.y
  };
}

function jiggleOffset(rule: StudioPhase["jiggles"][number], localTime: number) {
  const t = clamp(localTime / Math.max(rule.duration, 0.01), 0, 1);
  const direction = rule.startDirection === "negative" || rule.startDirection === "anticlockwise" ? -1 : 1;
  const decay = rule.decay ?? 0;
  const envelope = Math.max(0, 1 - decay * t);
  return direction * numberValue(rule.amplitude) * Math.sin(t * rule.cycles * Math.PI * 2) * envelope;
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

function defaultFills(kind: NodeKindChoice): MotionFill[] {
  if (kind === "text") return [];
  return [{
    type: "solid",
    color: kind === "circle" ? "#38BDF8" : "#0EA5E9",
    opacity: 1
  }];
}

function defaultLayout(kind: NodeKindChoice): StudioNode["layout"] {
  if (kind === "text") return {};
  return { width: kind === "circle" ? 72 : 150, height: kind === "circle" ? 72 : 86 };
}

function defaultComponent(id: string, name: string, kind: NodeKindChoice): StudioComponent {
  const layout = defaultLayout(kind);
  const style = kind === "text"
    ? { text: name, foregroundColor: "#FFFFFF", backgroundColor: "#232327" }
    : {
        ...defaultStyle(kind, name),
        gradientEndColor: kind === "circle" ? "#B58CFF" : "#5ED8FF",
        gradientAngle: 135
      };
  return {
    id,
    name,
    kind,
    roles: ["actor"],
    layout,
    style,
    fills: fillsFromStyle(style, kind),
    presentation: {
      "offset.x": 0,
      "offset.y": 0,
      rotation: 0,
      scale: 1,
      opacity: 1
    }
  };
}

function solidFill(color: string, opacity = 1): MotionFill {
  return {
    type: "solid",
    color: safeHex(color, "#38BDF8"),
    opacity: clamp(opacity, 0, 1)
  };
}

function linearFill(start: string, end: string, angle = 135, startPosition = 0, endPosition = 1, opacity = 1): MotionFill {
  return {
    type: "linearGradient",
    colors: [
      { color: safeHex(start, "#38BDF8"), position: clamp(startPosition, 0, 1) },
      { color: safeHex(end, "#B58CFF"), position: clamp(endPosition, 0, 1) }
    ],
    angle,
    opacity: clamp(opacity, 0, 1)
  };
}

function radialFill(start: string, end: string, centerX = 0.5, centerY = 0.5, radius = 90, startPosition = 0, endPosition = 1, opacity = 1): MotionFill {
  return {
    type: "radialGradient",
    colors: [
      { color: safeHex(start, "#38BDF8"), position: clamp(startPosition, 0, 1) },
      { color: safeHex(end, "#B58CFF"), position: clamp(endPosition, 0, 1) }
    ],
    centerX: clamp(centerX, 0, 1),
    centerY: clamp(centerY, 0, 1),
    radius: Math.max(1, radius),
    opacity: clamp(opacity, 0, 1)
  };
}

function asLinearFill(fill: MotionFill, start: string, end: string): Extract<MotionFill, { type: "linearGradient" }> {
  if (fill.type === "linearGradient") return fill;
  return linearFill(start, end, 135, 0, 1, fill.opacity ?? 1) as Extract<MotionFill, { type: "linearGradient" }>;
}

function asRadialFill(fill: MotionFill, start: string, end: string): Extract<MotionFill, { type: "radialGradient" }> {
  if (fill.type === "radialGradient") return fill;
  return radialFill(start, end, 0.5, 0.5, 90, 0, 1, fill.opacity ?? 1) as Extract<MotionFill, { type: "radialGradient" }>;
}

function updateFillColor(fill: MotionFill, edge: "start" | "end", color: string): MotionFill {
  const safeColor = safeHex(color, edge === "start" ? "#38BDF8" : "#B58CFF");
  if (fill.type === "solid") return { ...fill, color: safeColor };

  const colors = [...fill.colors];
  const index = edge === "start" ? 0 : 1;
  colors[index] = { ...(colors[index] ?? { position: index }), color: safeColor };
  return { ...fill, colors };
}

function updateFillStop(fill: MotionFill, edge: "start" | "end", position: number): MotionFill {
  if (fill.type === "solid") return fill;

  const colors = [...fill.colors];
  const index = edge === "start" ? 0 : 1;
  colors[index] = { ...(colors[index] ?? { color: index === 0 ? "#38BDF8" : "#B58CFF" }), position };
  return { ...fill, colors };
}

function styleFromFill(style: StudioNode["style"], fill: MotionFill): StudioNode["style"] {
  const next = { ...style };
  if (fill.type === "solid") {
    next.backgroundColor = fill.color;
    delete next.gradientEndColor;
    delete next.gradientAngle;
    return next;
  }

  next.backgroundColor = fill.colors[0]?.color ?? "#38BDF8";
  next.gradientEndColor = fill.colors[1]?.color ?? "#B58CFF";
  next.gradientAngle = fill.type === "linearGradient" ? fill.angle ?? 135 : 0;
  return next;
}

function componentFromNode(id: string, node: StudioNode): StudioComponent {
  return {
    id,
    name: node.name,
    kind: node.kind,
    roles: [...node.roles],
    layout: clone(node.layout),
    style: clone(node.style),
    fills: clone(node.fills ?? fillsFromStyle(node.style, node.kind)),
    presentation: clone(node.presentation)
  };
}

function componentRoles(component: StudioComponent) {
  return uniqueStrings([...(component.roles?.length ? component.roles : ["actor"]), `component:${component.id}`]);
}

function nodeFromComponent(component: StudioComponent, records: Record<string, StudioNode>, rootNodeId: string): StudioNode {
  const kind = component.kind ?? "circle";
  const id = uniqueId(slug(component.name || kind), records);
  const style = component.style ?? defaultStyle(kind, component.name);
  return {
    id,
    name: component.name,
    kind,
    parentId: rootNodeId,
    childIds: [],
    roles: componentRoles(component),
    layout: clone(component.layout ?? defaultLayout(kind)),
    style: clone(style),
    fills: clone(component.fills ?? fillsFromStyle(style, kind)),
    presentation: {
      "offset.x": 0,
      "offset.y": 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      ...(component.presentation ?? {})
    },
    componentId: component.id
  };
}

function ensureComponent(
  project: StudioProject,
  id: string,
  name: string,
  kind: NodeKindChoice,
  layout: StudioComponent["layout"],
  style: StudioComponent["style"],
  fills: MotionFill[]
) {
  if (project.components[id] !== undefined) return id;

  project.components[id] = {
    id,
    name,
    kind,
    roles: ["actor"],
    layout: clone(layout ?? defaultLayout(kind)),
    style: clone(style ?? defaultStyle(kind, name)),
    fills: clone(fills),
    presentation: {
      "offset.x": 0,
      "offset.y": 0,
      rotation: 0,
      scale: 1,
      opacity: 1
    }
  };

  return id;
}

function createInstanceAt(
  project: StudioProject,
  component: StudioComponent,
  name: string,
  x: number,
  y: number,
  groupRole: string
) {
  const node = nodeFromComponent(component, project.nodes, project.rootNodeId);
  node.name = name;
  node.roles = uniqueStrings([groupRole, ...node.roles]);
  node.presentation["offset.x"] = x;
  node.presentation["offset.y"] = y;
  project.nodes[node.id] = node;
  project.nodes[project.rootNodeId]?.childIds.push(node.id);

  for (const role of node.roles) {
    project.roles[role] ??= { id: role, name: role };
  }

  return node;
}

function syncInstancesOfComponent(project: StudioProject, componentId: string) {
  const component = project.components[componentId];
  if (!component) return;

  const kind = component.kind ?? "circle";
  const style = component.style ?? defaultStyle(kind, component.name);
  const layout = component.layout ?? defaultLayout(kind);
  const fills = component.fills ?? fillsFromStyle(style, kind);
  const roles = componentRoles(component);

  for (const node of Object.values(project.nodes)) {
    if (node.componentId !== componentId) continue;
    const preservedRoles = node.roles.filter((role) => !roles.includes(role) && !role.startsWith("component:"));
    node.kind = kind;
    node.layout = clone(layout);
    node.style = clone(style);
    node.fills = clone(fills);
    node.roles = uniqueStrings([...preservedRoles, ...roles]);
  }
}

function visualBackground(style: Record<string, unknown>, kind: NodeKindChoice, fills: MotionFill[] = []) {
  if (fills.length > 0) {
    return cssFill(fills[0]);
  }

  const start = String(style.backgroundColor ?? (kind === "text" ? "transparent" : "#5ED8FF"));
  const end = typeof style.gradientEndColor === "string" ? style.gradientEndColor : undefined;
  if (!end) return start;

  const angle = numberValue(style.gradientAngle, 135);
  return `linear-gradient(${angle}deg, ${start}, ${end})`;
}

function visualEffects(style: Record<string, unknown>, scale = 1) {
  const blur = Math.max(0, numberValue(style.blur, 0) * scale);
  const strokeWidth = Math.max(0, numberValue(style.strokeWidth, 0) * scale);
  const shadowBlur = Math.max(0, numberValue(style.shadowBlur, 0) * scale);
  const shadowX = numberValue(style.shadowX, 0) * scale;
  const shadowY = numberValue(style.shadowY, 0) * scale;
  const shadowOpacity = clamp(numberValue(style.shadowOpacity, 0), 0, 1);
  const shadowColor = String(style.shadowColor ?? "#000000");
  const effects: React.CSSProperties = {};

  if (blur > 0) {
    effects.filter = `blur(${round(blur)}px)`;
  }

  if (strokeWidth > 0) {
    effects.border = `${round(strokeWidth)}px solid ${String(style.strokeColor ?? "#E0F2FE")}`;
  }

  if (shadowBlur > 0 || shadowX !== 0 || shadowY !== 0) {
    effects.boxShadow = `${round(shadowX)}px ${round(shadowY)}px ${round(shadowBlur)}px ${colorWithOpacity(shadowColor, shadowOpacity)}`;
  }

  return effects;
}

function fillsFromStyle(style: Record<string, unknown>, kind: NodeKindChoice): MotionFill[] {
  if (kind === "text" && style.backgroundColor === undefined) return [];

  const start = safeHex(String(style.backgroundColor ?? (kind === "circle" ? "#38BDF8" : "#0EA5E9")), "#38BDF8");
  const end = typeof style.gradientEndColor === "string" ? style.gradientEndColor : undefined;
  if (end) {
    return [linearFill(start, end, numberValue(style.gradientAngle, 135))];
  }

  return [solidFill(start)];
}

function cssFill(fill: MotionFill | undefined) {
  if (!fill) return "transparent";
  if (fill.type === "solid") return colorWithOpacity(fill.color, fill.opacity ?? 1);
  const stops = fill.colors
    .map((stop) => `${colorWithOpacity(stop.color, (stop.opacity ?? 1) * (fill.opacity ?? 1))} ${Math.round(stop.position * 100)}%`)
    .join(", ");
  if (fill.type === "radialGradient") return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${fill.angle ?? 90}deg, ${stops})`;
}

function colorWithOpacity(hex: string, opacity: number) {
  const safe = safeHex(hex, "#38BDF8");
  const alpha = clamp(opacity, 0, 1);
  if (alpha >= 1) return safe;

  const red = parseInt(safe.slice(1, 3), 16);
  const green = parseInt(safe.slice(3, 5), 16);
  const blue = parseInt(safe.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function fillLabel(type: MotionFill["type"]) {
  if (type === "linearGradient") return "Linear";
  if (type === "radialGradient") return "Radial";
  return "Solid";
}

function numberFromFill(fill: MotionFill, key: "angle", fallback: number) {
  return fill.type === "linearGradient" && typeof fill[key] === "number" ? fill[key] : fallback;
}

function pointInCanvas(canvas: HTMLElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasWidth / Math.max(rect.width, 1);
  const scaleY = canvasHeight / Math.max(rect.height, 1);
  return {
    x: (clientX - rect.left) * scaleX - canvasWidth / 2,
    y: (clientY - rect.top) * scaleY - canvasHeight / 2
  };
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function normalizeHex(value: string) {
  return value.startsWith("#") ? value.toUpperCase() : `#${value.toUpperCase()}`;
}

function safeHex(value: string, fallback: string) {
  const normalized = normalizeHex(value);
  return isHexColor(normalized) ? normalized : fallback;
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

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function readPhaseTargets(phase: StudioPhase, node: StudioNode | undefined, targetMode: TargetMode) {
  const target = node ? baseTargetsFromNode(node) : defaultPhaseTargets();
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

function baseTargetsFromNode(node: StudioNode) {
  return {
    x: numberValue(node.presentation["offset.x"]),
    y: numberValue(node.presentation["offset.y"]),
    scale: numberValue(node.presentation.scale, 1),
    rotation: numberValue(node.presentation.rotation),
    opacity: numberValue(node.presentation.opacity, 1)
  };
}

function selectorForTarget(project: StudioProject, node: StudioNode | undefined, targetMode: TargetMode): MotionPropertySelector {
  if (targetMode === "role" && node?.roles[0]) {
    return { role: node.roles[0], properties: transformProperties };
  }

  return { id: node?.id ?? project.rootNodeId, properties: transformProperties };
}

function assignment(
  nodeId: string,
  property: MotionPropertySelector["properties"][number],
  value: number
): MotionAssignment {
  return { select: { id: nodeId, properties: [property] }, value };
}

function setPhaseTargetValue(phase: StudioPhase, selector: MotionPropertySelector, value: number) {
  const index = phase.targets.findIndex((target) => sameTarget(target, selector));
  const assignment = { select: selector, value } satisfies MotionAssignment;
  if (index >= 0) {
    phase.targets[index] = assignment;
  } else {
    phase.targets.push(assignment);
  }
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

function resolveNodeSelector(project: StudioProject, selector: { id?: string | undefined; role?: string | undefined }): string[] {
  if (selector.id !== undefined) {
    return project.nodes[selector.id] !== undefined ? [selector.id] : [];
  }

  if (selector.role !== undefined) {
    return Object.values(project.nodes)
      .filter((node) => node.roles.includes(selector.role as string))
      .map((node) => node.id);
  }

  return [];
}

function matchesNodeSelector(selector: { id?: string | undefined; role?: string | undefined }, node: StudioNode) {
  if (selector.id !== undefined) return selector.id === node.id;
  if (selector.role !== undefined) return node.roles.includes(selector.role);
  return false;
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

function makeSpawnedComponents(action: SpawnComponentsAction, count: number, spread = componentSpread(action)) {
  const safeCount = Math.max(1, Math.min(8, count));
  const size = numberValue(action.components[0]?.layout.width, 26);
  const lifetime = numberValue(action.components[0]?.lifetime, 0.72);
  const color = String(action.components[0]?.style.backgroundColor ?? "#60A5FA");
  const center = (safeCount - 1) / 2;

  return Array.from({ length: safeCount }, (_, index) => {
    const x = safeCount === 1 ? 0 : ((index - center) / Math.max(center, 1)) * spread;
    const y = -82 - Math.abs(index - center) * 10;
    return {
      id: `${action.id}-component-${index + 1}`,
      kind: "circle" as const,
      layout: { width: size, height: size },
      style: { backgroundColor: color },
      from: { "offset.x": 0, "offset.y": 0, scale: 1, opacity: 0.85 },
      to: { "offset.x": x, "offset.y": y, scale: 0.18, opacity: 0 },
      motion: { type: "timed" as const, duration: lifetime, easing: "easeOut" as const },
      lifetime
    };
  });
}

function componentSpread(action: SpawnComponentsAction) {
  const values = action.components
    .map((component) => numberValue(component.to["offset.x"]))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? Math.max(...values.map((value) => Math.abs(value))) : 74;
}

function actionTypeForToggle(type: "particles" | "components" | "shake" | "haptic") {
  if (type === "particles") return "emitParticles";
  if (type === "components") return "spawnComponents";
  if (type === "shake") return "screenShake";
  return "haptic";
}

function hasAction(phase: StudioPhase, type: string) {
  return phase.actions.some((action) => action.type === type);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
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

function easingLabel(value: "linear" | "easeIn" | "easeOut" | "easeInOut") {
  if (value === "easeIn") return "Ease In";
  if (value === "easeOut") return "Ease Out";
  if (value === "easeInOut") return "Ease In Out";
  return "Linear";
}

function formatTime(value: number) {
  return `${round(Math.max(0, value)).toFixed(2)}s`;
}

function timelineTicks(totalDuration: number) {
  const duration = Math.max(totalDuration, 0.01);
  const count = Math.min(Math.max(Math.ceil(duration / 0.5), 2), 8);
  return Array.from({ length: count + 1 }, (_, index) => Number(((duration / count) * index).toFixed(2)));
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
