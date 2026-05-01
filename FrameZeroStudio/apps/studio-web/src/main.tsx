import React, { useEffect, useMemo, useRef, useState } from "react";
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
type PresetAssetId = "hotelActiveGradient" | "hotelActiveGradientTall" | "hotelGradient" | "voiceGradient" | "hotelPlanetTwo" | "hotelPlanetOne";
type AssetSelection =
  | { type: "preset"; id: PresetAssetId }
  | { type: "component"; id: string }
  | { type: "layer"; componentId: string; nodeId: string };
type CanvasPreviewBackground = "device" | "checker" | "black" | "white";
type BridgeHealth = {
  ok: boolean;
  revision: number | null;
  previewClients: number;
  checkedAt: number;
};
type PresetAsset = {
  id: PresetAssetId;
  name: string;
  meta: string;
  swatchClass: string;
  ariaLabel: string;
  badges: string[];
  place: () => void;
};
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
const previewBackgroundOptions: ReadonlyArray<{ id: CanvasPreviewBackground; label: string }> = [
  { id: "device", label: "Device" },
  { id: "checker", label: "Checker" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" }
] as const;

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
  const [selectedAsset, setSelectedAsset] = useState<AssetSelection | undefined>();
  const [focusedLayerId, setFocusedLayerId] = useState("");
  const [showDeveloperOutput, setShowDeveloperOutput] = useState(false);
  const [copiedJsonLabel, setCopiedJsonLabel] = useState("");
  const [componentSearch, setComponentSearch] = useState("");
  const [canvasPreviewBackground, setCanvasPreviewBackground] = useState<CanvasPreviewBackground>("device");
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | undefined>();
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("layers");
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => loadStoredPanelWidth(leftPanelWidthStorageKey, 268, 220, 420));
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
  const selectedComponentIsLayered = selectedComponent?.nodes !== undefined;
  const selectedPhase = project.phases[selectedPhaseId] ?? project.phases[project.phaseOrder[0] ?? ""];
  const focusedLayer = focusedLayerId ? project.nodes[focusedLayerId] : undefined;
  const focusedPreviewRootId = focusedLayer ? topCanvasAncestorId(project, focusedLayer.id) : undefined;
  const runtimeBackgroundColor = rootBackgroundColor(project);
  const previewBackgroundStyle = canvasPreviewBackgroundStyle(canvasPreviewBackground, runtimeBackgroundColor);
  const bridgeStatus = bridgeStatusView(bridgeHealth);
  const simulatorStatusMessage = sendState === "idle" ? bridgeStatus.message : bridgeMessage;
  const simulatorStatusClass = sendState === "sent" && simulatorStatusMessage.includes("no simulator")
    ? "warning"
    : sendState !== "idle"
      ? sendState
      : bridgeStatus.kind === "connected"
        ? "sent"
        : bridgeStatus.kind === "offline"
          ? "failed"
          : bridgeStatus.kind === "no-client"
            ? "warning"
            : "";
  const componentSearchResults = componentLibraryItems(project, componentSearch);
  const designCodePanel = buildDesignCodePanel(
    project,
    selectedNode,
    selectedComponent,
    compileResult.ok ? compileResult.value.json : compileResult.error
  );
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

  useEffect(() => {
    if (leftPanelTab !== "layers") return;
    window.requestAnimationFrame(() => {
      document.querySelector(".layer-row.selected")?.scrollIntoView({ block: "nearest" });
    });
  }, [leftPanelTab, selectedNodeId]);

  useEffect(() => {
    if (inspectorTab === "code" && !showDeveloperOutput) {
      setInspectorTab("properties");
    }
  }, [inspectorTab, showDeveloperOutput]);

  useEffect(() => {
    let active = true;
    async function pollBridgeHealth() {
      try {
        const response = await fetch("http://127.0.0.1:8787/health");
        const result = await response.json() as { ok?: boolean; revision?: number; previewClients?: number };
        if (!active) return;
        setBridgeHealth({
          ok: response.ok && result.ok !== false,
          revision: typeof result.revision === "number" ? result.revision : null,
          previewClients: typeof result.previewClients === "number" ? result.previewClients : 0,
          checkedAt: Date.now()
        });
      } catch {
        if (!active) return;
        setBridgeHealth({ ok: false, revision: null, previewClients: 0, checkedAt: Date.now() });
      }
    }

    void pollBridgeHealth();
    const interval = window.setInterval(() => void pollBridgeHealth(), 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
        layout: defaultLayout(kind),
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
      setSelectedAsset(undefined);
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
      setSelectedAsset(undefined);
    });
  }

  function createComponent(kind: NodeKindChoice) {
    patchProject((draft) => {
      const id = uniqueId("component", draft.components);
      const name = `${titleCase(kind)} Component`;
      const component = defaultComponent(id, name, kind);
      draft.components[id] = component;
      setSelectedComponentId(id);
      setSelectedAsset({ type: "component", id });
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
      setSelectedAsset({ type: "component", id });
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
      retargetComponentTemplateRoles(draft.components[id] as StudioComponent, source.id, id);
      setSelectedComponentId(id);
      setSelectedAsset({ type: "component", id });
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
      const node = component.nodes !== undefined && component.rootNodeId !== undefined
        ? instantiateLayeredComponent(draft, component)
        : nodeFromComponent(component, draft.nodes, draft.rootNodeId);
      if (component.nodes === undefined || component.rootNodeId === undefined) {
        draft.nodes[node.id] = node;
        draft.nodes[draft.rootNodeId]?.childIds.push(node.id);
      }
      for (const role of node.roles) {
        draft.roles[role] ??= { id: role, name: role };
      }
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
    });
  }

  function instantiateComponentLayer(componentId: string, templateNodeId: string) {
    patchProject((draft) => {
      const component = draft.components[componentId];
      const template = component?.nodes?.[templateNodeId];
      if (!component || !template) return;

      const node = nodeFromTemplateLayer(component, template, draft.nodes, draft.rootNodeId);
      draft.nodes[node.id] = node;
      draft.nodes[draft.rootNodeId]?.childIds.push(node.id);
      for (const role of node.roles) {
        draft.roles[role] ??= { id: role, name: role };
      }
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId(node.id);
      setLeftPanelTab("layers");
    });
  }

  function createVoiceGradientComponent() {
    patchProject((draft) => {
      const componentId = "voiceGradient";
      const component = voiceGradientComponent(componentId);
      const node = replaceLayeredPresetInstance(draft, component);
      if (!draft.phaseOrder.some((phaseId) => draft.phases[phaseId]?.targets.some((target) => target.select.role === "voiceGradient"))) {
        const previewPhaseId = addVoiceGradientPreviewPhases(draft);
        setSelectedPhaseId(previewPhaseId);
      }
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setLeftPanelTab("layers");
      setInspectorTab("properties");
    });
  }

  function setPreviewBackground(mode: CanvasPreviewBackground) {
    setCanvasPreviewBackground(mode);
  }

  function createHotelPlanetOneComponent() {
    patchProject((draft) => {
      const componentId = "hotelPlanetOne";
      const component = hotelPlanetOneComponent(componentId);
      const node = replaceLayeredPresetInstance(draft, component);
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId(node.id);
      setLeftPanelTab("assets");
      setInspectorTab("properties");
    });
  }

  function createHotelPlanetTwoComponent() {
    patchProject((draft) => {
      const componentId = "hotelPlanetTwo";
      const component = hotelPlanetTwoComponent(componentId);
      const node = replaceLayeredPresetInstance(draft, component);
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId(node.id);
      setLeftPanelTab("assets");
      setInspectorTab("properties");
    });
  }

  function createHotelGradientComponent() {
    patchProject((draft) => {
      const componentId = "hotelGradient";
      const component = hotelGradientComponent(componentId);
      removeStarterOrbFromCanvas(draft);
      const node = replaceLayeredPresetInstance(draft, component);
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId("");
      setLeftPanelTab("layers");
      setInspectorTab("properties");
    });
  }

  function createHotelActiveGradientComponent() {
    patchProject((draft) => {
      const componentId = "hotelActiveGradient";
      const component = hotelActiveGradientComponent(componentId);
      removeStarterOrbFromCanvas(draft);
      const node = replaceLayeredPresetInstance(draft, component);
      const root = draft.nodes[draft.rootNodeId];
      if (root) root.style.backgroundColor = "#FFFFFF";
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId("");
      setLeftPanelTab("layers");
      setInspectorTab("properties");
    });
  }

  function createHotelActiveGradientTallComponent() {
    patchProject((draft) => {
      const componentId = "hotelActiveGradientTall";
      const component = hotelActiveGradientTallComponent(componentId);
      removeStarterOrbFromCanvas(draft);
      const node = replaceLayeredPresetInstance(draft, component);
      const root = draft.nodes[draft.rootNodeId];
      if (root) root.style.backgroundColor = "#FFFFFF";
      draft.editor = { selection: [node.id], viewportPreset: "iphone" };
      setSelectedNodeId(node.id);
      setSelectedComponentId("");
      setSelectedAsset(undefined);
      setFocusedLayerId("");
      setLeftPanelTab("layers");
      setInspectorTab("properties");
    });
  }

  function removeStarterOrbFromCanvas(draft: StudioProject) {
    const starterOrb = draft.nodes.orb;
    const root = draft.nodes[draft.rootNodeId];
    if (!starterOrb || !root || starterOrb.parentId !== draft.rootNodeId) return;
    root.childIds = root.childIds.filter((childId) => childId !== starterOrb.id);
    removeNodeMotionReferences(draft, starterOrb.id);
    delete draft.nodes[starterOrb.id];
  }

  function replaceLayeredPresetInstance(draft: StudioProject, component: StudioComponent) {
    removeComponentInstances(draft, component.id);
    draft.components[component.id] = component;
    return instantiateLayeredComponent(draft, component);
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
        description: "Components animated together from one clip"
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
      setSelectedAsset(undefined);
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
      setSelectedAsset((current) => {
        if (current?.type === "component" && current.id === selectedComponent.id) return undefined;
        if (current?.type === "layer" && current.componentId === selectedComponent.id) return undefined;
        return current;
      });
    });
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.id === project.rootNodeId) return;
    patchProject((draft) => {
      const deletedIds = collectNodeSubtreeIds(draft, selectedNode.id);
      for (const node of Object.values(draft.nodes)) {
        node.childIds = node.childIds.filter((childId) => !deletedIds.has(childId));
      }
      for (const nodeId of deletedIds) {
        removeNodeMotionReferences(draft, nodeId);
        delete draft.nodes[nodeId];
      }
      setSelectedNodeId(draft.rootNodeId);
      setSelectedAsset(undefined);
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
      const phaseId = uniqueId("clip", draft.phases);
      const node = draft.nodes[selectedNodeId] ?? draft.nodes[draft.rootNodeId];
      const selector: MotionPropertySelector = { id: node?.id ?? draft.rootNodeId, properties: transformProperties };
      const nodeId = node?.id ?? draft.rootNodeId;
      draft.phases[phaseId] = {
        id: phaseId,
        name: `Clip ${draft.phaseOrder.length + 1}`,
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
      const previewClients = typeof result.previewClients === "number" ? result.previewClients : 0;
      const revision = typeof result.revision === "number" ? result.revision : null;
      setBridgeHealth({ ok: true, revision, previewClients, checkedAt: Date.now() });
      setSendState("sent");
      setBridgeMessage(previewClients > 0 ? `Sent r${revision}; simulator connected` : `Sent r${revision}; no simulator client connected`);
    } catch (error) {
      setSendState("failed");
      setBridgeMessage(error instanceof Error ? error.message : String(error));
      setBridgeHealth({ ok: false, revision: null, previewClients: 0, checkedAt: Date.now() });
    }
  }

  function resetProject() {
    const fresh = cloneProject(orbPlaygroundProject);
    saveStoredProject(fresh);
    setProject(fresh);
    setSelectedNodeId(fresh.editor?.selection[0] ?? "");
    setSelectedPhaseId(fresh.phaseOrder[0] ?? "");
    setSelectedComponentId("");
    setSelectedAsset(undefined);
    setBridgeMessage("Reset to fixture");
  }

  function clearCanvasSelection() {
    setSelectedNodeId("");
    setSelectedComponentId("");
    setSelectedAsset(undefined);
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

  async function copyJson(label: string, json: string) {
    try {
      await navigator.clipboard.writeText(json);
      setCopiedJsonLabel(label);
      window.setTimeout(() => {
        setCopiedJsonLabel((current) => current === label ? "" : current);
      }, 1600);
    } catch (error) {
      setBridgeMessage(`Copy failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    setSelectedAsset(undefined);
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
    setSelectedAsset(undefined);
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
        setLeftPanelWidth(clamp(round(startLeft + dx), 220, 420));
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

  function selectAsset(asset: AssetSelection) {
    setSelectedAsset(asset);
    setSelectedComponentId("");
    setSelectedNodeId("");
    setFocusedLayerId("");
  }

  function handleAssetRowKeyDown(event: React.KeyboardEvent<HTMLElement>, asset: AssetSelection) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectAsset(asset);
  }

  function runAssetCommand(event: React.MouseEvent<HTMLElement>, action: () => void) {
    event.stopPropagation();
    action();
  }

  function stopAssetCommandKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
  }

  const presetAssets: PresetAsset[] = [
    {
      id: "hotelActiveGradient",
      name: "Hotel Active Gradient",
      meta: "Figma node 5013:45996 · dodge ignored",
      swatchClass: "hotel active",
      ariaLabel: "Preview Hotel Active Gradient asset preset",
      badges: ["Asset", "Native", "Figma"],
      place: createHotelActiveGradientComponent
    },
    {
      id: "hotelActiveGradientTall",
      name: "Hotel Active Gradient 500",
      meta: "375 x 500 · native bottom-anchored extension",
      swatchClass: "hotel active",
      ariaLabel: "Preview Hotel Active Gradient 500 asset preset",
      badges: ["Asset", "Native", "Layered"],
      place: createHotelActiveGradientTallComponent
    },
    {
      id: "hotelGradient",
      name: "Hotel Full Gradient",
      meta: "2 editable native layers",
      swatchClass: "hotel",
      ariaLabel: "Preview Hotel Full Gradient asset preset",
      badges: ["Asset", "Native", "Layered"],
      place: createHotelGradientComponent
    },
    {
      id: "voiceGradient",
      name: "Voice Gradient",
      meta: "Layered preset with fallback layers",
      swatchClass: "voice",
      ariaLabel: "Preview Voice Gradient asset preset",
      badges: ["Asset", "Partial", "Fallback"],
      place: createVoiceGradientComponent
    },
    {
      id: "hotelPlanetTwo",
      name: "Blue Planet",
      meta: "Single native layer",
      swatchClass: "blue",
      ariaLabel: "Preview Blue Planet asset preset",
      badges: ["Asset", "Native"],
      place: createHotelPlanetTwoComponent
    },
    {
      id: "hotelPlanetOne",
      name: "Hotel Planet 1",
      meta: "Single native layer",
      swatchClass: "pink",
      ariaLabel: "Preview Hotel Planet 1 asset preset",
      badges: ["Asset", "Native"],
      place: createHotelPlanetOneComponent
    }
  ];
  const selectedAssetDetails = selectedAsset ? assetSelectionDetails(project, selectedAsset, presetAssets) : undefined;

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
            <button type="button" onClick={() => addNode("path")}>Path</button>
            <button type="button" onClick={() => addNode("text")}>Text</button>
          </div>
          <div className="toolbar-group">
            <button type="button" onClick={duplicateSelectedNode} disabled={!selectedNode || selectedNode.id === project.rootNodeId}>Duplicate</button>
          </div>
        </div>

        <div className="toolbar-actions">
          <div className="preview-background-switch" aria-label="Editor preview background">
            {previewBackgroundOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={canvasPreviewBackground === option.id ? "active" : ""}
                onClick={() => setPreviewBackground(option.id)}
                aria-label={`Use ${option.label.toLowerCase()} editor preview background`}
                title={`${option.label} editor preview background`}
              >
                <span className="preview-background-swatch" style={previewBackgroundSwatchStyle(option.id, runtimeBackgroundColor)} />
              </button>
            ))}
          </div>
          <button type="button" className="preview-button" onClick={isPreviewing ? stopWebPreview : playWebPreview}>
            {isPreviewing ? "Stop Preview" : "Preview"}
          </button>
          <button type="button" onClick={downloadJson} disabled={!compileResult.ok}>Export JSON</button>
          <button type="button" className={showDeveloperOutput ? "dev-mode-toggle active" : "dev-mode-toggle"} onClick={() => setShowDeveloperOutput((value) => !value)}>
            Dev
          </button>
          <button type="button" className="primary" onClick={sendToSimulator} disabled={sendState === "sending"}>
            {sendState === "sending" ? "Sending" : "Send to Simulator"}
          </button>
          <span className={`bridge-message ${simulatorStatusClass}`}>
            {simulatorStatusMessage}
          </span>
        </div>
      </header>

      <aside className="panel left-panel">
        <div className="panel-header">
          <p className="eyebrow">Document</p>
          <h1>{leftPanelTab === "layers" ? "Layers" : "Assets"}</h1>
          <div className="left-tabs" role="tablist" aria-label="Left sidebar sections">
            <button
              type="button"
              id="left-tab-layers"
              role="tab"
              aria-selected={leftPanelTab === "layers"}
              aria-controls="left-panel-layers"
              className={leftPanelTab === "layers" ? "active" : ""}
              onClick={() => setLeftPanelTab("layers")}
            >
              Layers
            </button>
            <button
              type="button"
              id="left-tab-assets"
              role="tab"
              aria-selected={leftPanelTab === "assets"}
              aria-controls="left-panel-assets"
              className={leftPanelTab === "assets" ? "active" : ""}
              onClick={() => setLeftPanelTab("assets")}
            >
              Assets
            </button>
          </div>
        </div>

        {leftPanelTab === "layers" ? (
        <div role="tabpanel" id="left-panel-layers" aria-labelledby="left-tab-layers">
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
                style={{ paddingLeft: 10 + nodeDepth(project, node) * 14 }}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setSelectedComponentId("");
                  setSelectedAsset(undefined);
                }}
              >
                <span className={`kind-dot kind-${node.kind}`} />
                  <div>
                    <strong>{node.name}</strong>
                    <small>{node.componentId ? <b>{project.components[node.componentId]?.name ?? "Instance"}</b> : null}<span>#{node.id} · {node.kind}</span></small>
                  </div>
                </button>
            ))}
          </div>
        </section>
        {showDeveloperOutput ? <section className="left-section role-groups">
          <div className="section-heading">
            <h2>Groups</h2>
            <span>roles</span>
          </div>
          <div className="role-list">
            {Object.values(project.roles).map((role) => (
              <span className="role-pill" key={role.id}>{role.name}</span>
            ))}
          </div>
        </section> : null}
        </div>
        ) : null}

        {leftPanelTab === "assets" ? (
        <div role="tabpanel" id="left-panel-assets" aria-labelledby="left-tab-assets">
        <section className="left-section component-library">
          <div className="section-heading">
            <h2>Asset Browser</h2>
            <span>{presetAssets.length + componentSearchResults.length}</span>
          </div>
          <div className="asset-search">
            <input
              aria-label="Search assets and components"
              placeholder="Search assets or components"
              value={componentSearch}
              onChange={(event) => setComponentSearch(event.target.value)}
            />
          </div>
          {selectedAsset && selectedAssetDetails ? (
            <div className="component-create-panel" aria-live="polite">
              <div className="component-create-heading">
                <span>{selectedAssetDetails.label}</span>
                <b>{selectedAssetDetails.badges[0] ?? "Selected"}</b>
              </div>
              <div>
                <AssetSelectionPreview project={project} selection={selectedAsset} />
                <strong>{selectedAssetDetails.name}</strong>
                <p className="inline-note compact-note">{selectedAssetDetails.meta}</p>
                <FidelityBadges badges={selectedAssetDetails.badges} />
              </div>
            </div>
          ) : null}
          <div className="component-create-panel">
            <div className="component-create-heading">
              <span>Create component</span>
              {selectedNode?.componentId ? (
                <button type="button" onClick={(event) => runAssetCommand(event, () => {
                  setSelectedComponentId(selectedNode.componentId ?? "");
                  setSelectedNodeId(project.rootNodeId);
                })}>Edit main</button>
              ) : (
                <button type="button" onClick={createComponentFromSelected} disabled={!selectedNode || selectedNode.id === project.rootNodeId}>From selection</button>
              )}
            </div>
            <div className="component-create-strip" aria-label="Create component">
              <button type="button" onClick={() => createComponent("circle")} title="Create circle component"><span className="kind-dot kind-circle" />Circle</button>
              <button type="button" onClick={() => createComponent("roundedRectangle")} title="Create card component"><span className="kind-dot kind-roundedRectangle" />Card</button>
              <button type="button" onClick={() => createComponent("path")} title="Create path component"><span className="kind-dot kind-path" />Path</button>
              <button type="button" onClick={() => createComponent("text")} title="Create text component"><span className="kind-dot kind-text" />Text</button>
            </div>
          </div>
          <div className="asset-group">
            <div className="asset-group-heading">
              <span>Asset presets</span>
              <b>native</b>
            </div>
            <div className="preset-list">
              {presetAssets.map((asset) => {
                const assetSelection: AssetSelection = { type: "preset", id: asset.id };
                const isSelectedAsset = sameAssetSelection(selectedAsset, assetSelection);
                return (
                  <div
                    tabIndex={0}
                    key={asset.id}
                    className={`preset-row ${isSelectedAsset ? "selected" : ""}`}
                    onClick={() => selectAsset(assetSelection)}
                    onKeyDown={(event) => handleAssetRowKeyDown(event, assetSelection)}
                  >
                    <span className={`preset-swatch ${asset.swatchClass}`} />
                    <span>
                      <span className="asset-kicker">Asset preset</span>
                      <strong>{asset.name}</strong>
                      <small>{asset.meta}</small>
                      <FidelityBadges badges={asset.badges} />
                    </span>
                    <button
                      type="button"
                      className="mini-action place"
                      aria-label={`Place ${asset.name} Preset`}
                      onClick={(event) => runAssetCommand(event, asset.place)}
                      onKeyDown={stopAssetCommandKeyDown}
                    >
                      Place
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="asset-group-heading component-results-heading">
            <span>Component assets</span>
            <b>{componentSearchResults.length}</b>
          </div>
          <div className="component-list">
            {componentSearchResults.map((component) => {
              const componentAssetSelection: AssetSelection = { type: "component", id: component.id };
              const isSelectedAsset = sameAssetSelection(selectedAsset, componentAssetSelection);
              const isSourceForSelection = selectedNode?.componentId === component.id;
              const layerAssets = componentLayerAssets(component);
              const componentBadges = componentFidelityBadges(component);
              return (
              <React.Fragment key={component.id}>
              <div
                tabIndex={0}
                className={`component-row ${isSelectedAsset ? "selected" : ""} ${isSourceForSelection ? "source-active" : ""}`}
                onClick={() => selectAsset(componentAssetSelection)}
                onKeyDown={(event) => handleAssetRowKeyDown(event, componentAssetSelection)}
              >
                <ComponentSwatch component={component} />
                <div>
                  <span className="asset-kicker">{isSourceForSelection ? "Selected node source" : "Component asset"}</span>
                  <strong>{component.name}</strong>
                  <span className="asset-meta"><b>{component.kind === "roundedRectangle" ? "card" : component.kind ?? "component"}</b><b>{instanceCount(project, component.id)} inst</b></span>
                  <FidelityBadges badges={componentBadges} />
                </div>
                <div className="asset-actions">
                  <button
                    type="button"
                    className="mini-action edit"
                    aria-label={`Edit ${component.name} component`}
                    onClick={(event) => runAssetCommand(event, () => {
                      setSelectedComponentId(component.id);
                      setSelectedNodeId(project.rootNodeId);
                      setSelectedAsset({ type: "component", id: component.id });
                    })}
                    onKeyDown={stopAssetCommandKeyDown}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="mini-action place"
                    aria-label={`Place ${component.name} component`}
                    onClick={(event) => runAssetCommand(event, () => instantiateComponent(component.id))}
                    onKeyDown={stopAssetCommandKeyDown}
                  >
                    Place
                  </button>
                </div>
              </div>
              {layerAssets.length > 0 ? (
                <div className="component-layer-assets" aria-label={`${component.name} layer assets`}>
                  <div className="component-layer-assets-heading">
                    <span>Native layer assets</span>
                    <b>{layerAssets.length}</b>
                  </div>
                  {layerAssets.map((node) => {
                    const layerAssetSelection: AssetSelection = { type: "layer", componentId: component.id, nodeId: node.id };
                    const isSelectedLayerAsset = sameAssetSelection(selectedAsset, layerAssetSelection);
                    return (
                    <div
                      className={`component-layer-row ${isSelectedLayerAsset ? "selected" : ""}`}
                      key={`${component.id}-${node.id}`}
                      tabIndex={0}
                      onClick={() => selectAsset(layerAssetSelection)}
                      onKeyDown={(event) => handleAssetRowKeyDown(event, layerAssetSelection)}
                    >
                      <LayerAssetSwatch node={node} />
                      <div>
                        <strong>{node.name}</strong>
                        <small>{node.kind} · {Math.round(nodeWidth(node))} x {Math.round(nodeHeight(node))}</small>
                        <FidelityBadges badges={nodeFidelityBadges(node)} />
                      </div>
                      <button
                        type="button"
                        className="mini-action place"
                        aria-label={`Place detached layer ${node.name}`}
                        onClick={(event) => runAssetCommand(event, () => instantiateComponentLayer(component.id, node.id))}
                        onKeyDown={stopAssetCommandKeyDown}
                      >
                        Place
                      </button>
                    </div>
                  );
                  })}
                </div>
              ) : null}
              </React.Fragment>
            );
            })}
          </div>
        </section>
        </div>
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
          <div className="layer-focus-controls">
            <button
              type="button"
              className={focusedLayerId ? "" : "active"}
              onClick={() => setFocusedLayerId("")}
            >
              All layers
            </button>
            <button
              type="button"
              className={focusedLayerId ? "active" : ""}
              disabled={!selectedNode || selectedNode.id === project.rootNodeId}
              onClick={() => {
                if (selectedNode && selectedNode.id !== project.rootNodeId) {
                  setFocusedLayerId(selectedNode.id);
                }
              }}
            >
              Focus selected
            </button>
            {focusedLayerId ? <small>{project.nodes[focusedLayerId]?.name ?? focusedLayerId}</small> : null}
          </div>
          <div className={`runtime-status ${compileResult.ok ? "ok" : "bad"}`}>
            <span className="status-light" />
            <span title={compileResult.ok ? "Export document is valid" : compileResult.error}>
              {compileResult.ok ? "Export ready" : compileResult.error}
            </span>
          </div>
        </header>

        {focusedLayer && focusedPreviewRootId ? (
          <div className="layer-inspection-frame">
            <div className="layer-inspection-header">
              <div>
                <p className="eyebrow">Layer inspection</p>
                <h3>{focusedLayer.name}</h3>
                <span>{focusedLayer.kind} · {Math.round(nodeWidth(focusedLayer))} x {Math.round(nodeHeight(focusedLayer))}</span>
              </div>
              <button type="button" onClick={() => setFocusedLayerId("")}>Back to canvas</button>
            </div>
            <div className="layer-inspection-grid">
              <div className="layer-inspection-card">
                <div className="layer-inspection-title">
                  <strong>In component</strong>
                  <span>{project.nodes[focusedPreviewRootId]?.name ?? focusedPreviewRootId}</span>
                </div>
                <div
                  className="layer-inspection-stage component-space"
                  style={{
                    width: nodeWidth(project.nodes[focusedPreviewRootId]),
                    height: nodeHeight(project.nodes[focusedPreviewRootId])
                  }}
                >
                  <SemanticSvgPreview project={project} rootId={focusedPreviewRootId} focusNodeId={focusedLayer.id} display="inline" />
                </div>
              </div>
              <div className="layer-inspection-card">
                <div className="layer-inspection-title">
                  <strong>Layer only</strong>
                  <span>{focusedLayer.id}</span>
                </div>
                <div
                  className="layer-inspection-stage layer-space"
                  style={{
                    width: Math.min(Math.max(nodeWidth(focusedLayer), 160), 520),
                    height: Math.min(Math.max(nodeHeight(focusedLayer), 120), 360)
                  }}
                >
                  <SemanticSvgPreview project={singleNodePreviewProject(focusedLayer)} rootId={focusedLayer.id} display="inline" />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="canvas-frame">
          <div
            className="phone-canvas"
            onPointerDown={(event) => {
              const target = event.target;
              if (target instanceof HTMLElement && target.closest(".canvas-node")) return;
              clearCanvasSelection();
            }}
            style={{
              ...previewBackgroundStyle,
              transform: `translate(${previewFrame.shake.x}px, ${previewFrame.shake.y}px)`
            }}
          >
            <div className="grid" />
            <div className="axis x-axis" />
            <div className="axis y-axis" />
            <span className="artboard-label">{canvasWidth} × {canvasHeight}</span>
            <div className="ruler ruler-top" aria-hidden="true">
              {rulerTicks(canvasWidth).map((tick) => <span key={tick} style={{ left: `${(tick / canvasWidth) * 100}%` }}>{tick}</span>)}
            </div>
            <div className="ruler ruler-left" aria-hidden="true">
              {rulerTicks(canvasHeight).map((tick) => <span key={tick} style={{ top: `${(tick / canvasHeight) * 100}%` }}>{tick}</span>)}
            </div>
            <div className="canvas-help">Drag selected layers. Pull corner handles to resize.</div>
            {renderCanvasChildren(project.rootNodeId, canvasCenter)}
            {previewFrame.visuals.map((visual) => (
              <PreviewVisualNode visual={visual} key={visual.id} />
            ))}
            {workspaceMode === "animate" && selectedPhase ? <MotionGuide phase={selectedPhase} node={selectedNode} targetMode={targetMode} /> : null}
          </div>
        </div>
        )}
      </section>

      <aside className="panel right-panel">
        <div
          className="panel-resizer right-resizer"
          role="separator"
          aria-label="Resize right panel"
          aria-orientation="vertical"
          onPointerDown={(event) => startPanelResize("right", event)}
        />
        <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
          {[
            ["properties", "Properties"] as const,
            ["effects", "Effects"] as const,
            ...(showDeveloperOutput ? [["code", "Code"] as const] : [])
          ].map(([tab, label]) => (
            <button
              type="button"
              key={tab}
              id={`inspector-tab-${tab}`}
              role="tab"
              aria-selected={inspectorTab === tab}
              aria-controls={`inspector-panel-${tab}`}
              className={inspectorTab === tab ? "active" : ""}
              onClick={() => setInspectorTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

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
        <section role="tabpanel" id="inspector-panel-properties" aria-labelledby="inspector-tab-properties">
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
              {selectedComponentIsLayered ? (
                <div className="inspector-group inspector-summary">
                  <h3><span>01</span> Layered Component</h3>
                  <div className="summary-grid">
                    <span><b>Layers</b>{selectedComponent.nodeIds?.length ?? Object.keys(selectedComponent.nodes ?? {}).length}</span>
                    <span><b>Runtime</b>native nodes</span>
                    <span><b>Source</b>Figma-style preset</span>
                    <span><b>Use</b>place instance</span>
                  </div>
                  <p className="panel-hint">This component is a reusable multi-layer preset. Place it, select individual layers, then tune their fills/effects or animate the shared component role.</p>
                </div>
              ) : null}
              <div className="form-grid">
                <label>Name<input value={selectedComponent.name} onChange={(event) => updateSelectedComponent((component) => { component.name = event.target.value; })} /></label>
                {selectedComponentIsLayered ? null : <div className="field-block field-wide">
                  <span>Type</span>
                  <div className="segmented-row compact">
                    {(["circle", "roundedRectangle", "path", "text"] as const).map((kind) => (
                      <button
                        type="button"
                        key={kind}
                        className={(selectedComponent.kind ?? "circle") === kind ? "segment active" : "segment"}
                        onClick={() => updateSelectedComponent((component) => {
                          component.kind = kind;
                          component.layout = defaultLayout(kind);
                          component.style = defaultStyle(kind, component.name);
                          component.fills = defaultFills(kind);
                        })}
                      >
                        {kind === "roundedRectangle" ? "Card" : titleCase(kind)}
                      </button>
                    ))}
                  </div>
                </div>}
                {selectedComponentIsLayered ? null : <NumberField label="Width" value={numberValue(selectedComponent.layout?.width, selectedComponent.kind === "circle" ? 72 : 150)} onChange={(value) => updateSelectedComponent((component) => {
                  component.layout = { ...(component.layout ?? {}), width: value };
                })} />}
                {selectedComponentIsLayered ? null : <NumberField label="Height" value={numberValue(selectedComponent.layout?.height, selectedComponent.kind === "circle" ? 72 : 86)} onChange={(value) => updateSelectedComponent((component) => {
                  component.layout = { ...(component.layout ?? {}), height: value };
                })} />}
                {!selectedComponentIsLayered && selectedComponent.kind === "roundedRectangle" ? (
                  <NumberField label="Radius" value={numberValue(selectedComponent.style?.cornerRadius, 18)} onChange={(value) => updateSelectedComponent((component) => {
                    component.style = { ...(component.style ?? {}), cornerRadius: value };
                  })} />
                ) : null}
                {!selectedComponentIsLayered && selectedComponent.kind === "text" ? (
                  <label className="field-wide">Text<input value={String(selectedComponent.style?.text ?? selectedComponent.name)} onChange={(event) => updateSelectedComponent((component) => {
                    component.style = { ...(component.style ?? {}), text: event.target.value };
                  })} /></label>
                ) : null}
              </div>
          </>
        </section>
        ) : null}

        {workspaceMode === "design" && selectedComponent && inspectorTab === "effects" ? (
          <section role="tabpanel" id="inspector-panel-effects" aria-labelledby="inspector-tab-effects">
            <div className="section-heading">
              <h2>Component Effects</h2>
            </div>
            <ComponentPreview component={selectedComponent} />
            {selectedComponentIsLayered ? (
              <div className="inspector-group inspector-summary">
                <h3><span>03</span> Layer Effects</h3>
                <p className="panel-hint">Layered components keep each visual layer editable on the canvas. Place an instance, choose a layer in the Layers panel, then edit its fill, blur, shadow, and stroke.</p>
              </div>
            ) : <StyleEditor
              kind={selectedComponent.kind ?? "circle"}
              style={selectedComponent.style ?? {}}
              fills={selectedComponent.fills ?? []}
              onChange={(style) => updateSelectedComponent((component) => { component.style = style; })}
              onFillsChange={(fills) => updateSelectedComponent((component) => { component.fills = fills; })}
            />}
          </section>
        ) : null}

        {workspaceMode === "design" && !selectedComponent && inspectorTab === "properties" ? (
        <section role="tabpanel" id="inspector-panel-properties" aria-labelledby="inspector-tab-properties">
          <div className="section-heading">
            <h2>Inspector</h2>
            {selectedNode && selectedNode.id !== project.rootNodeId ? <button type="button" className="danger" onClick={deleteSelectedNode}>Delete</button> : null}
          </div>
          {selectedNode ? (
            <>
              {selectedNode.componentId ? null : selectedNode.id === project.rootNodeId ? (
                <p className="inline-note compact-note"><strong>Scene root</strong>. Add layers or place component instances to build the composition.</p>
              ) : selectedNode.roles.includes("detachedAssetLayer") || selectedNode.roles.includes("assetLayer") ? (
                <p className="inline-note compact-note"><strong>Detached asset layer</strong>{detachedAssetSourceName(project, selectedNode) ? ` from ${detachedAssetSourceName(project, selectedNode)}` : ""}. This is editable independently and will not update other instances.</p>
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
                    setSelectedAsset(undefined);
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
                <h3><span>02</span> Transform{nodeUsedInAnimation(project, selectedNode.id) ? <span className="rest-label"> · rest pose</span> : null}</h3>
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
                <h3><span>03</span> Layer status</h3>
                <div className="summary-grid">
                  {showDeveloperOutput ? <span><b>Selector</b>#{selectedNode.id}</span> : null}
                  <span><b>Kind</b>{selectedNode.kind}</span>
                  <span><b>Effects</b>{hasVisualEffects(selectedNode) ? "custom" : "default"}</span>
                  <span><b>Motion</b>{nodeUsedInAnimation(project, selectedNode.id) ? "bound" : "ready"}</span>
                </div>
                <p className="panel-hint">Use Effects for visual styling and Animate for motion. Developer mode shows runtime selectors.</p>
              </div>
            </>
          ) : null}
        </section>
        ) : null}

        {workspaceMode === "design" && !selectedComponent && selectedNode && inspectorTab === "effects" ? (
          <section role="tabpanel" id="inspector-panel-effects" aria-labelledby="inspector-tab-effects">
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
              <button type="button" className="danger" onClick={deletePhase}>Delete Clip</button>
            </div>
            <div className="form-grid">
              <label>Name<input value={selectedPhase.name} onChange={(event) => updateSelectedPhase((phase) => { phase.name = event.target.value; })} /></label>
              <div className="field-block field-wide">
                <span>Target</span>
                <div className="segmented-row compact">
                  <button type="button" className={targetMode === "selected" ? "segment active" : "segment"} onClick={() => setTargetMode("selected")}>Selected</button>
                  <button type="button" className={targetMode === "role" ? "segment active" : "segment"} onClick={() => setTargetMode("role")}>Group</button>
                </div>
              </div>
              <NumberField label="Start Delay" value={selectedPhase.startDelay} step={0.05} onChange={(value) => updateSelectedPhase((phase) => { phase.startDelay = value; })} />
              <div className="field-block field-wide">
                <span>Next Phase</span>
                <div className="segmented-row compact two-up">
                  <button type="button" className={selectedPhase.nextMode === "atTime" ? "segment active" : "segment"} aria-pressed={selectedPhase.nextMode === "atTime"} onClick={() => updateSelectedPhase((phase) => { phase.nextMode = "atTime"; if (phase.nextAt == null) phase.nextAt = 1; })}>At Time</button>
                  <button type="button" className={selectedPhase.nextMode === "afterPreviousSettles" ? "segment active" : "segment"} aria-pressed={selectedPhase.nextMode === "afterPreviousSettles"} onClick={() => updateSelectedPhase((phase) => { phase.nextMode = "afterPreviousSettles"; phase.nextAt = null; })}>After Settle</button>
                </div>
              </div>
              {selectedPhase.nextMode === "atTime" ? (
                <NumberField label="Next At" value={selectedPhase.nextAt ?? 1} step={0.05} onChange={(value) => updateSelectedPhase((phase) => { phase.nextAt = value; })} />
              ) : null}
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
          <section className="json-section" role="tabpanel" id="inspector-panel-code" aria-labelledby="inspector-tab-code">
            <JsonHeader
              copied={copiedJsonLabel === "design"}
              onCopy={() => void copyJson("design", designCodePanel.body)}
              title={designCodePanel.title}
            />
            <pre aria-label={designCodePanel.title} tabIndex={0}>{designCodePanel.body}</pre>
          </section>
        ) : null}

        {workspaceMode === "animate" && showDeveloperOutput ? (
        <section className="json-section">
          <JsonHeader
            copied={copiedJsonLabel === "runtime"}
            onCopy={() => void copyJson("runtime", compileResult.ok ? compileResult.value.json : compileResult.error)}
            title="Generated .motion.json"
          />
          <pre aria-label="Generated motion JSON" tabIndex={0}>{compileResult.ok ? compileResult.value.json : compileResult.error}</pre>
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
              <div className="quick-transform" aria-label={nodeUsedInAnimation(project, selectedNode.id) ? "Rest pose controls — sets position before animation plays" : "Quick transform controls"}>
                <NumberField label="X" value={nodeFrameX(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameX(node, value); })} />
                <NumberField label="Y" value={nodeFrameY(selectedNode)} onChange={(value) => updateSelectedNode((node) => { setNodeFrameY(node, value); })} />
                <NumberField label="W" value={nodeWidth(selectedNode)} onChange={(value) => updateSelectedNode((node) => { node.layout.width = value; })} />
                <NumberField label="H" value={nodeHeight(selectedNode)} onChange={(value) => updateSelectedNode((node) => { node.layout.height = value; })} />
                <NumberField label="Op" value={numberValue(selectedNode.presentation.opacity, 1)} step={0.05} onChange={(value) => updateSelectedNode((node) => { node.presentation.opacity = clamp(value, 0, 1); })} />
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
            <button type="button" onClick={addPhase}>Add Clip</button>
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

  function renderCanvasChildren(parentId: string, origin: { x: number; y: number }, ancestorHasSemanticPreview = false): React.ReactNode {
    const parent = project.nodes[parentId];
    if (!parent) return null;

    return parent.childIds.map((childId) => {
      const node = project.nodes[childId];
      if (!node) return null;
      const useSemanticPreview = workspaceMode === "design" && node.childIds.length > 0 && !ancestorHasSemanticPreview;
      return (
        <CanvasNode
          key={node.id}
          node={node}
          origin={origin}
          selected={node.id === selectedNodeId}
          suppressSurface={ancestorHasSemanticPreview}
          {...(useSemanticPreview ? { semanticPreview: <SemanticSvgPreview project={project} rootId={node.id} focusNodeId={focusedLayerId} /> } : {})}
          onPointerDown={(event) => startCanvasDrag(node.id, event)}
          onResizeStart={(corner, event) => startCanvasResize(node.id, corner, event)}
          {...(previewFrame.transforms[node.id] ? { previewTransform: previewFrame.transforms[node.id] } : {})}
          {...(workspaceMode === "animate" && selectedPhase ? { phaseTargets: readPhaseTargets(selectedPhase, node, targetMode) } : {})}
        >
          {renderCanvasChildren(node.id, { x: nodeWidth(node) / 2, y: nodeHeight(node) / 2 }, ancestorHasSemanticPreview || useSemanticPreview)}
        </CanvasNode>
      );
    });
  }
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function singleNodePreviewProject(node: StudioNode): StudioProject {
  const previewNode: StudioNode = {
    ...node,
    parentId: null,
    childIds: [],
    presentation: {
      ...node.presentation,
      "offset.x": 0,
      "offset.y": 0,
      rotation: 0,
      scale: 1,
      "scale.x": 1,
      "scale.y": 1,
      opacity: 1
    }
  };

  return {
    studioVersion: 1,
    id: "single-node-preview",
    name: "Single Node Preview",
    rootNodeId: node.id,
    nodes: { [node.id]: previewNode },
    roles: {},
    phases: {},
    phaseOrder: [],
    triggers: {},
    components: {}
  };
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

function collectNodeSubtreeIds(project: StudioProject, nodeId: string) {
  const ids = new Set<string>();
  const visit = (currentId: string) => {
    if (ids.has(currentId)) return;
    ids.add(currentId);
    for (const childId of project.nodes[currentId]?.childIds ?? []) {
      visit(childId);
    }
  };
  visit(nodeId);
  return ids;
}

function removeComponentInstances(project: StudioProject, componentId: string) {
  const ids = new Set<string>();
  for (const node of Object.values(project.nodes)) {
    if (node.componentId !== componentId) continue;
    for (const nodeId of collectNodeSubtreeIds(project, node.id)) {
      ids.add(nodeId);
    }
  }

  if (ids.size === 0) return;

  for (const node of Object.values(project.nodes)) {
    node.childIds = node.childIds.filter((childId) => !ids.has(childId));
  }

  for (const nodeId of ids) {
    removeNodeMotionReferences(project, nodeId);
    delete project.nodes[nodeId];
  }

  if (project.editor?.selection?.some((nodeId) => ids.has(nodeId))) {
    project.editor = {
      ...project.editor,
      viewportPreset: project.editor.viewportPreset ?? "iphone",
      selection: []
    };
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
  if (node.roles.includes("detachedAssetLayer") || node.roles.includes("assetLayer")) {
    const source = detachedAssetSourceName(project, node);
    return source ? `Detached asset layer from ${source}` : "Detached asset layer";
  }
  return "Plain layer";
}

function detachedAssetSourceName(project: StudioProject, node: StudioNode) {
  const sourceRole = node.roles.find((role) => role.startsWith("assetSource:"));
  if (!sourceRole) return "";
  const sourceId = sourceRole.slice("assetSource:".length);
  return project.components[sourceId]?.name ?? sourceId;
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

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    const stepValue = step ?? 1;
    const factor = event.shiftKey ? 10 : 1;
    const delta = (event.key === "ArrowUp" ? 1 : -1) * stepValue * factor;
    const current = typeof value === "number" ? value : parseFloat(String(value)) || 0;
    onChange(current + delta);
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
        onKeyDown={handleKeyDown}
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
  if (component.nodes !== undefined) {
    return (
      <span className="component-swatch layered">
        {componentPreviewNodes(component).slice(0, 4).map((node) => (
          <i
            key={node.id}
            style={{
              background: visualBackground(node.style ?? {}, node.kind, node.fills ?? []),
              borderRadius: node.kind === "circle" ? 999 : numberValue(node.style?.cornerRadius, 6),
              opacity: numberValue(node.presentation.opacity, 1)
            }}
          />
        ))}
      </span>
    );
  }

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

function LayerAssetSwatch({ node }: { node: StudioNode }) {
  return (
    <span className="layer-asset-swatch">
      <SemanticSvgPreview project={singleNodePreviewProject(node)} rootId={node.id} display="inline" />
    </span>
  );
}

function AssetSelectionPreview({ project, selection }: { project: StudioProject; selection: AssetSelection }) {
  if (selection.type === "preset") {
    return <ComponentPreview component={presetAssetPreviewComponent(selection.id)} />;
  }

  if (selection.type === "component") {
    const component = project.components[selection.id];
    return component ? <ComponentPreview component={component} /> : null;
  }

  const node = project.components[selection.componentId]?.nodes?.[selection.nodeId];
  return node ? (
    <div className="component-preview">
      <LayerAssetSwatch node={node} />
    </div>
  ) : null;
}

function presetAssetPreviewComponent(id: PresetAssetId) {
  if (id === "hotelActiveGradient") return hotelActiveGradientComponent("hotelActiveGradient");
  if (id === "hotelActiveGradientTall") return hotelActiveGradientTallComponent("hotelActiveGradientTall");
  if (id === "hotelGradient") return hotelGradientComponent("hotelGradient");
  if (id === "voiceGradient") return voiceGradientComponent("voiceGradient");
  if (id === "hotelPlanetTwo") return hotelPlanetTwoComponent("hotelPlanetTwo");
  if (id === "hotelPlanetOne") return hotelPlanetOneComponent("hotelPlanetOne");
  return hotelActiveGradientComponent("hotelActiveGradient");
}

function FidelityBadges({ badges }: { badges: string[] }) {
  const visibleBadges = uniqueStrings(badges).slice(0, 4);
  if (visibleBadges.length === 0) return null;
  return (
    <span className="asset-meta fidelity-badges">
      {visibleBadges.map((badge) => <b key={badge}>{badge}</b>)}
    </span>
  );
}

function sameAssetSelection(left: AssetSelection | undefined, right: AssetSelection | undefined) {
  if (!left || !right || left.type !== right.type) return false;
  if (left.type === "preset" && right.type === "preset") return left.id === right.id;
  if (left.type === "component" && right.type === "component") return left.id === right.id;
  return left.type === "layer" && right.type === "layer" && left.componentId === right.componentId && left.nodeId === right.nodeId;
}

function assetSelectionDetails(project: StudioProject, selection: AssetSelection, presets: PresetAsset[]) {
  if (selection.type === "preset") {
    const preset = presets.find((asset) => asset.id === selection.id);
    return {
      label: "Selected asset",
      name: preset?.name ?? selection.id,
      meta: preset?.meta ?? "Figma preset",
      badges: preset?.badges ?? ["Asset"]
    };
  }

  if (selection.type === "component") {
    const component = project.components[selection.id];
    return {
      label: "Selected component",
      name: component?.name ?? selection.id,
      meta: component
        ? `${component.nodes !== undefined ? "Layered component" : component.kind ?? "component"} · ${instanceCount(project, component.id)} placed`
        : "Component unavailable",
      badges: component ? componentFidelityBadges(component) : ["Component"]
    };
  }

  const component = project.components[selection.componentId];
  const node = component?.nodes?.[selection.nodeId];
  return {
    label: "Selected layer asset",
    name: node?.name ?? selection.nodeId,
    meta: node ? `${component?.name ?? selection.componentId} · ${node.kind} · ${Math.round(nodeWidth(node))} x ${Math.round(nodeHeight(node))}` : "Layer unavailable",
    badges: node ? nodeFidelityBadges(node) : ["Layer"]
  };
}

function componentFidelityBadges(component: StudioComponent) {
  const badges = [component.nodes !== undefined ? "Layered component" : "Component"];
  const roles = [
    ...(component.roles ?? []),
    ...componentPreviewNodes(component).flatMap((node) => node.roles)
  ];
  if (roles.some((role) => role.startsWith("native-layer:"))) badges.push("Native");
  if (roles.some((role) => role.startsWith("figma:"))) badges.push("Figma ref");
  if (roles.includes("fidelity:asset-required")) badges.push("Asset gap");
  return uniqueStrings(badges);
}

function nodeFidelityBadges(node: StudioNode) {
  const badges = ["Layer"];
  if (node.roles.some((role) => role.startsWith("native-layer:"))) badges.push("Native");
  if (node.roles.some((role) => role.startsWith("figma:"))) badges.push("Figma ref");
  if (node.roles.includes("fidelity:asset-required")) badges.push("Asset gap");
  if ((node.fills ?? []).length > 0) badges.push("Native fill");
  return uniqueStrings(badges);
}

function ComponentPreview({ component }: { component: StudioComponent }) {
  if (component.nodes !== undefined) {
    const nodes = componentPreviewNodes(component);
    return (
      <div className="component-preview layered-preview">
        <div className="layered-preview-stage">
          {nodes.map((node) => (
            <span
              key={node.id}
              className={`layered-preview-node component-${node.kind}`}
              style={{
                width: numberValue(node.layout.width, 80) * 0.38,
                height: numberValue(node.layout.height, 80) * 0.38,
                transform: `translate(-50%, -50%) translate(${numberValue(node.presentation["offset.x"]) * 0.38}px, ${numberValue(node.presentation["offset.y"]) * 0.38}px) rotate(${numberValue(node.presentation.rotation)}deg) scale(${numberValue(node.presentation.scale, 1)})`,
                opacity: numberValue(node.presentation.opacity, 1),
                background: visualBackground(node.style ?? {}, node.kind, node.fills ?? []),
                borderRadius: node.kind === "circle" ? 999 : numberValue(node.style?.cornerRadius, 12) * 0.38,
                ...visualEffects(node.style ?? {}, 0.16)
              }}
            />
          ))}
        </div>
      </div>
    );
  }

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

function componentPreviewNodes(component: StudioComponent) {
  const nodes = component.nodes ?? {};
  const ids = component.nodeIds?.length ? component.nodeIds : Object.keys(nodes);
  return ids.map((id) => nodes[id]).filter((node): node is StudioNode => node !== undefined);
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

function JsonHeader({ copied, onCopy, title }: { copied: boolean; onCopy: () => void; title: string }) {
  return (
    <div className="section-heading json-heading">
      <h2>{title}</h2>
      <button type="button" className={copied ? "copy-json copied" : "copy-json"} onClick={onCopy}>
        {copied ? "Copied" : "Copy JSON"}
      </button>
    </div>
  );
}

function CanvasNode({
  node,
  children,
  origin,
  selected,
  semanticPreview,
  suppressSurface = false,
  phaseTargets,
  previewTransform,
  onPointerDown,
  onResizeStart
}: {
  node: StudioNode;
  children?: React.ReactNode;
  origin: { x: number; y: number };
  selected: boolean;
  semanticPreview?: React.ReactNode;
  suppressSurface?: boolean;
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
  const x = origin.x + targetX - width / 2;
  const y = origin.y + targetY - height / 2;
  const scale = previewTransform?.scale ?? phaseTargets?.scale ?? numberValue(node.presentation.scale, 1);
  const scaleX = numberValue(node.presentation["scale.x"], 1);
  const scaleY = numberValue(node.presentation["scale.y"], 1);
  const rotation = previewTransform?.rotation ?? phaseTargets?.rotation ?? numberValue(node.presentation.rotation);
  const opacity = previewTransform?.opacity ?? phaseTargets?.opacity ?? numberValue(node.presentation.opacity, 1);
  const usesSemanticPreview = semanticPreview !== undefined;
  const usesProceduralGradient = isProceduralGradient(node.style);
  const usesPrimitiveCanvasPreview = (node.kind === "path" || usesProceduralGradient) && !usesSemanticPreview && !suppressSurface;
  const proceduralBackground = proceduralGradientCssBackground(node.style);
  const backgroundValue = proceduralBackground ?? (node.kind === "text" && node.style.backgroundColor === undefined && (node.fills?.length ?? 0) === 0
    ? "transparent"
    : visualBackground(node.style, node.kind, node.fills ?? []));
  const backgroundAsset = imageBackground(node.style);
  const backgroundIsGradient = backgroundValue.includes("gradient(");
  const shapeBounds = nodeShapeBounds(node.style);
  const hasInsetShapeBounds = shapeBounds.top > 0 || shapeBounds.right > 0 || shapeBounds.bottom > 0 || shapeBounds.left > 0;
  const style = {
    left: x,
    top: y,
    width,
    height,
    opacity,
    transform: `rotate(${rotation}deg) scale(${scale * scaleX}, ${scale * scaleY})`,
    mixBlendMode: cssBlendMode(node.style.blendMode)
  } satisfies React.CSSProperties;
  const surfaceStyle = {
    background: usesSemanticPreview || suppressSurface || usesPrimitiveCanvasPreview || backgroundAsset || backgroundIsGradient ? "transparent" : backgroundValue,
    backgroundImage: usesSemanticPreview || suppressSurface || usesPrimitiveCanvasPreview ? undefined : backgroundAsset ?? (backgroundIsGradient ? backgroundValue : undefined),
    backgroundSize: String(node.style.contentMode ?? "100% 100%"),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    color: String(node.style.foregroundColor ?? "#FFFFFF"),
    borderRadius: node.kind === "circle" ? "50%" : numberValue(node.style.cornerRadius, 12),
    ...visualEffects(node.style)
  } satisfies React.CSSProperties;

  return (
    <div
      className={`canvas-node canvas-${node.kind} ${selected ? "selected" : ""} ${suppressSurface ? "suppressed-node" : ""}`}
      data-node-id={node.id}
      data-roles={node.roles.join(" ")}
      style={style}
      onPointerDown={onPointerDown}
    >
      <span className="node-hit-target" aria-hidden="true" />
      <span className={node.style.clip === true ? "node-clip clipped" : "node-clip"}>
        <span className={suppressSurface ? "node-surface suppressed" : "node-surface"} style={surfaceStyle} aria-hidden={node.kind !== "text"}>
          {semanticPreview}
          {usesPrimitiveCanvasPreview ? <SemanticSvgPreview project={singleNodePreviewProject(node)} rootId={node.id} /> : null}
          {!suppressSurface && !usesSemanticPreview && node.kind === "text" ? String(node.style.text ?? node.name) : null}
        </span>
        {children}
      </span>
      {selected ? (
        <>
          <span className="selection-guide guide-x" aria-hidden="true" />
          <span className="selection-guide guide-y" aria-hidden="true" />
          <span className="selection-frame" aria-hidden="true" />
          {hasInsetShapeBounds ? (
            <span
              className={`selection-shape-frame ${node.kind === "circle" ? "circle" : ""}`}
              style={{
                left: shapeBounds.left,
                top: shapeBounds.top,
                right: shapeBounds.right,
                bottom: shapeBounds.bottom
              }}
              aria-hidden="true"
            />
          ) : null}
          <span className="selection-handle nw" aria-label="Resize from top left" role="button" onPointerDown={(event) => onResizeStart?.("nw", event)} />
          <span className="selection-handle n" aria-label="Resize from top" role="button" onPointerDown={(event) => onResizeStart?.("n", event)} />
          <span className="selection-handle ne" aria-label="Resize from top right" role="button" onPointerDown={(event) => onResizeStart?.("ne", event)} />
          <span className="selection-handle e" aria-label="Resize from right" role="button" onPointerDown={(event) => onResizeStart?.("e", event)} />
          <span className="selection-handle s" aria-label="Resize from bottom" role="button" onPointerDown={(event) => onResizeStart?.("s", event)} />
          <span className="selection-handle w" aria-label="Resize from left" role="button" onPointerDown={(event) => onResizeStart?.("w", event)} />
          <span className="selection-handle sw" aria-label="Resize from bottom left" role="button" onPointerDown={(event) => onResizeStart?.("sw", event)} />
          <span className="selection-handle se" aria-label="Resize from bottom right" role="button" onPointerDown={(event) => onResizeStart?.("se", event)} />
          <span className="selection-size" aria-hidden="true">{round(width)} x {round(height)}</span>
        </>
      ) : null}
    </div>
  );
}

function SemanticSvgPreview({
  project,
  rootId,
  focusNodeId,
  display = "absolute"
}: {
  project: StudioProject;
  rootId: string;
  focusNodeId?: string;
  display?: "absolute" | "inline";
}) {
  const root = project.nodes[rootId];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const width = root ? nodeWidth(root) : 1;
  const height = root ? nodeHeight(root) : 1;
  const layerPolicy = useMemo(() => semanticLayerPolicy(project, rootId, focusNodeId), [focusNodeId, project, rootId]);

  useEffect(() => {
    preloadSemanticImages(project, rootId, () => setImageVersion((version) => version + 1));
  }, [project, rootId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rootNode = project.nodes[rootId];
    if (!canvas || !rootNode) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.ceil(width * ratio));
    canvas.height = Math.max(1, Math.ceil(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    drawNodeLocal(context, project, rootNode, width, height, layerPolicy);
  }, [height, imageVersion, layerPolicy, project, rootId, width]);

  if (!root) return null;
  return (
    <canvas
      ref={canvasRef}
      className={`semantic-svg-preview ${display === "inline" ? "inline" : ""}`}
      data-root-id={rootId}
      data-focus-node-id={focusNodeId ?? ""}
      aria-hidden="true"
    />
  );
}

const semanticImageCache = new Map<string, { image: HTMLImageElement; loaded: boolean; failed: boolean }>();

function preloadSemanticImages(project: StudioProject, rootId: string, onChange: () => void) {
  for (const node of subtreeNodes(project, rootId)) {
    const url = nodeImageUrl(node);
    if (!url || semanticImageCache.has(url)) continue;
    const image = new Image();
    const record = { image, loaded: false, failed: false };
    semanticImageCache.set(url, record);
    image.onload = () => {
      record.loaded = true;
      onChange();
    };
    image.onerror = () => {
      record.failed = true;
      onChange();
    };
    image.src = url;
  }
}

function subtreeNodes(project: StudioProject, rootId: string) {
  const nodes: StudioNode[] = [];
  function visit(nodeId: string) {
    const node = project.nodes[nodeId];
    if (!node) return;
    nodes.push(node);
    node.childIds.forEach(visit);
  }
  visit(rootId);
  return nodes;
}

function nodeImageUrl(node: StudioNode) {
  return node.kind === "image" && typeof node.style.imageUrl === "string" ? node.style.imageUrl : undefined;
}

function topCanvasAncestorId(project: StudioProject, nodeId: string) {
  let current: StudioNode | undefined = project.nodes[nodeId];
  if (current === undefined) return project.rootNodeId;

  while (current !== undefined && current.parentId !== null && current.parentId !== project.rootNodeId) {
    const parent: StudioNode | undefined = project.nodes[current.parentId];
    if (parent === undefined) break;
    current = parent;
  }

  return current?.id ?? project.rootNodeId;
}

type SemanticLayerPolicy = {
  visible: Set<string>;
  drawable: Set<string>;
};

function semanticLayerPolicy(project: StudioProject, rootId: string, focusNodeId?: string): SemanticLayerPolicy | undefined {
  if (!focusNodeId || !project.nodes[focusNodeId]) return undefined;

  if (focusNodeId === rootId) {
    return { visible: new Set([rootId]), drawable: new Set([rootId]) };
  }

  const visible = new Set<string>([rootId]);
  const drawable = new Set<string>();
  let current: string | null | undefined = focusNodeId;
  while (current) {
    visible.add(current);
    if (current === rootId) break;
    current = project.nodes[current]?.parentId;
  }

  function addDescendants(nodeId: string) {
    drawable.add(nodeId);
    for (const childId of project.nodes[nodeId]?.childIds ?? []) {
      visible.add(childId);
      addDescendants(childId);
    }
  }
  addDescendants(focusNodeId);

  return { visible, drawable };
}

function drawNodeLocal(
  context: CanvasRenderingContext2D,
  project: StudioProject,
  node: StudioNode,
  width: number,
  height: number,
  layerPolicy?: SemanticLayerPolicy
) {
  if (node.style.clip === true) {
    context.save();
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();
  }

  if (!layerPolicy || layerPolicy.drawable.has(node.id)) {
    drawNodeShape(context, node, width, height);
  }

  for (const childId of node.childIds) {
    const child = project.nodes[childId];
    if (!child) continue;
    if (layerPolicy && !layerPolicy.visible.has(child.id)) continue;
    drawChildNode(context, project, child, width, height, layerPolicy);
  }

  if (node.style.clip === true) {
    context.restore();
  }
}

function drawChildNode(
  context: CanvasRenderingContext2D,
  project: StudioProject,
  node: StudioNode,
  parentWidth: number,
  parentHeight: number,
  layerPolicy?: SemanticLayerPolicy
) {
  const width = nodeWidth(node);
  const height = nodeHeight(node);
  const scale = numberValue(node.presentation.scale, 1);
  const scaleX = scale * numberValue(node.presentation["scale.x"], 1);
  const scaleY = scale * numberValue(node.presentation["scale.y"], 1);
  const centerX = parentWidth / 2 + numberValue(node.presentation["offset.x"]);
  const centerY = parentHeight / 2 + numberValue(node.presentation["offset.y"]);
  const opacity = clamp(numberValue(node.presentation.opacity, 1), 0, 1);
  const compositeOperation = canvasCompositeOperation(node.style.blendMode);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(numberValue(node.presentation.rotation) * Math.PI / 180);
  context.scale(scaleX, scaleY);
  context.translate(-width / 2, -height / 2);
  context.globalAlpha *= opacity;
  context.globalCompositeOperation = compositeOperation;

  if (shouldDrawIsolatedLayer(node, opacity, compositeOperation)) {
    const padding = Math.ceil(maxSubtreeEffectPadding(project, node) + 2);
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.max(1, Math.ceil(width + padding * 2));
    offscreen.height = Math.max(1, Math.ceil(height + padding * 2));
    const offscreenContext = offscreen.getContext("2d");
    if (offscreenContext) {
      offscreenContext.translate(padding, padding);
      drawNodeLocal(offscreenContext, project, node, width, height, layerPolicy);
      context.drawImage(offscreen, -padding, -padding, width + padding * 2, height + padding * 2);
    }
  } else {
    drawNodeLocal(context, project, node, width, height, layerPolicy);
  }
  context.restore();
}

function shouldDrawIsolatedLayer(node: StudioNode, opacity: number, compositeOperation: GlobalCompositeOperation) {
  return node.childIds.length > 0 && (opacity < 0.999 || compositeOperation !== "source-over");
}

function maxSubtreeEffectPadding(project: StudioProject, node: StudioNode): number {
  const bounds = nodeEffectBounds(node.style);
  let padding = Math.max(bounds.top, bounds.right, bounds.bottom, bounds.left, renderBlur(node.style) * 2);
  for (const childId of node.childIds) {
    const child = project.nodes[childId];
    if (!child) continue;
    padding = Math.max(padding, maxSubtreeEffectPadding(project, child));
  }
  return padding;
}

function drawNodeShape(context: CanvasRenderingContext2D, node: StudioNode, width: number, height: number) {
  if (node.kind === "image") {
    drawImageNode(context, node, width, height);
    return;
  }

  if (drawProceduralGradient(context, node.style, width, height)) {
    return;
  }

  const fills = canvasFills(context, node, width, height);
  const hasFill = fills.length > 0;
  const strokeWidth = Math.max(0, numberValue(node.style.strokeWidth, 0));
  const hasStroke = strokeWidth > 0;

  if (!hasFill && !hasStroke && node.kind !== "text") return;

  const blur = renderBlur(node.style);
  const filterBox = nodeFilterBox(node.style);
  if (filterBox && node.kind !== "text") {
    const boxFills = canvasFills(context, node, filterBox.width, filterBox.height);
    const source = document.createElement("canvas");
    source.width = Math.max(1, Math.ceil(filterBox.width));
    source.height = Math.max(1, Math.ceil(filterBox.height));
    const sourceContext = source.getContext("2d");
    if (sourceContext) {
      drawNodeShapeContent(sourceContext, node, filterBox.width, filterBox.height, boxFills, boxFills.length > 0, strokeWidth, hasStroke);
      const output = document.createElement("canvas");
      output.width = source.width;
      output.height = source.height;
      const outputContext = output.getContext("2d");
      context.save();
      if (outputContext) {
        if (blur > 0) outputContext.filter = `blur(${blur}px)`;
        outputContext.drawImage(source, 0, 0, filterBox.width, filterBox.height);
        context.drawImage(
          output,
          filterBox.cropX,
          filterBox.cropY,
          width,
          height,
          0,
          0,
          width,
          height
        );
      } else {
        if (blur > 0) context.filter = `blur(${blur}px)`;
        context.drawImage(source, -filterBox.cropX, -filterBox.cropY, filterBox.width, filterBox.height);
      }
      context.restore();
      return;
    }
  }

  if (blur > 0 && node.kind !== "text") {
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.max(1, Math.ceil(width));
    offscreen.height = Math.max(1, Math.ceil(height));
    const offscreenContext = offscreen.getContext("2d");
    if (offscreenContext) {
      drawNodeShapeContent(offscreenContext, node, width, height, fills, hasFill, strokeWidth, hasStroke);
      context.save();
      context.filter = `blur(${blur}px)`;
      context.drawImage(offscreen, 0, 0, width, height);
      context.restore();
      return;
    }
  }

  drawNodeShapeContent(context, node, width, height, fills, hasFill, strokeWidth, hasStroke);
}

function nodeFilterBox(style: Record<string, unknown>) {
  const width = numberValue(style["figmaFilterBox.width"], Number.NaN);
  const height = numberValue(style["figmaFilterBox.height"], Number.NaN);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;

  return {
    width,
    height,
    cropX: numberValue(style["figmaFilterBox.cropX"], 0),
    cropY: numberValue(style["figmaFilterBox.cropY"], 0)
  };
}

function drawImageNode(context: CanvasRenderingContext2D, node: StudioNode, width: number, height: number) {
  const url = nodeImageUrl(node);
  if (!url) return;
  const record = semanticImageCache.get(url);
  if (!record?.loaded || record.failed) return;

  const opacity = clamp(numberValue(node.style.imageOpacity, 1), 0, 1);
  context.save();
  context.globalAlpha *= opacity;
  context.drawImage(record.image, 0, 0, width, height);
  context.restore();
}

function drawNodeShapeContent(
  context: CanvasRenderingContext2D,
  node: StudioNode,
  width: number,
  height: number,
  fills: CanvasPaint[],
  hasFill: boolean,
  strokeWidth: number,
  hasStroke: boolean
) {
  context.save();

  if (node.kind === "path") {
    const viewBoxWidth = Math.max(numberValue(node.style.viewBoxWidth, width), 0.0001);
    const viewBoxHeight = Math.max(numberValue(node.style.viewBoxHeight, height), 0.0001);
    context.save();
    context.scale(width / viewBoxWidth, height / viewBoxHeight);
    const path = new Path2D(String(node.style.pathData ?? ""));
    if (hasFill) {
      for (const fill of fills) {
        fillCanvasPath(context, path, node, viewBoxWidth, viewBoxHeight, fill.paint, fill.fill);
      }
    }
    if (hasStroke) {
      context.strokeStyle = String(node.style.strokeColor ?? "#E0F2FE");
      context.lineWidth = strokeWidth;
      context.stroke(path);
    }
    context.restore();
    context.restore();
    return;
  } else if (node.kind === "text") {
    context.filter = "none";
    context.fillStyle = String(node.style.foregroundColor ?? "#FFFFFF");
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 16px Inter, system-ui, sans-serif";
    context.fillText(String(node.style.text ?? node.name), width / 2, height / 2);
    context.restore();
    return;
  }

  const path = canvasNodePath(node, width, height);
  if (hasFill) {
    for (const fill of fills) {
      fillCanvasPath(context, path, node, width, height, fill.paint, fill.fill);
    }
  }

  if (hasStroke) {
    context.strokeStyle = String(node.style.strokeColor ?? "#E0F2FE");
    context.lineWidth = strokeWidth;
    context.stroke(path);
  }

  context.restore();
}

function canvasNodePath(node: StudioNode, width: number, height: number) {
  const path = new Path2D();
  const shapeBounds = nodeShapeBounds(node.style);
  const shapeX = shapeBounds.left;
  const shapeY = shapeBounds.top;
  const shapeWidth = Math.max(0.0001, width - shapeBounds.left - shapeBounds.right);
  const shapeHeight = Math.max(0.0001, height - shapeBounds.top - shapeBounds.bottom);
  if (node.kind === "circle") {
    path.ellipse(shapeX + shapeWidth / 2, shapeY + shapeHeight / 2, shapeWidth / 2, shapeHeight / 2, 0, 0, Math.PI * 2);
  } else {
    const radius = node.kind === "roundedRectangle" || node.kind === "zstack" || node.kind === "vstack" || node.kind === "hstack"
      ? numberValue(node.style.cornerRadius, 0)
      : 0;
    roundedCanvasRect(path, shapeX, shapeY, shapeWidth, shapeHeight, radius);
  }
  return path;
}

function fillCanvasPath(
  context: CanvasRenderingContext2D,
  path: Path2D,
  node: StudioNode,
  width: number,
  height: number,
  fill: string | CanvasGradient,
  sourceFill?: MotionFill
) {
  const gradientFill = sourceFill ?? node.fills?.[0];
  const transform = transformedGradientMatrix(gradientFill, width, height);
  if (gradientFill?.type === "radialGradient" && transform) {
    const gradientCanvas = transformedRadialGradientCanvas(gradientFill, width, height, transform);
    context.save();
    context.clip(path);
    if (gradientCanvas) {
      context.drawImage(gradientCanvas, 0, 0, width, height);
    } else {
      context.transform(...transform);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const stop of gradientFill.colors) {
        gradient.addColorStop(stop.position, colorWithOpacity(stop.color, (stop.opacity ?? 1) * (gradientFill.opacity ?? 1)));
      }
      context.fillStyle = gradient;
      context.fillRect(-4, -4, 8, 8);
    }
    context.restore();
    return;
  }

  context.fillStyle = fill;
  context.fill(path);
}

type CanvasPaint = {
  paint: string | CanvasGradient;
  fill?: MotionFill;
};

function canvasFills(context: CanvasRenderingContext2D, node: StudioNode, width: number, height: number): CanvasPaint[] {
  const fills = node.fills?.length
    ? node.fills
    : typeof node.style.backgroundColor === "string"
      ? [solidFill(String(node.style.backgroundColor))]
      : [];

  const paints: CanvasPaint[] = [];
  for (const fill of fills) {
    const paint = canvasFill(context, node, width, height, fill);
    if (paint !== undefined) paints.push({ paint, fill });
  }
  return paints;
}

function canvasFill(context: CanvasRenderingContext2D, node: StudioNode, width: number, height: number, fill: MotionFill): string | CanvasGradient | undefined {
  const shapeBounds = nodeShapeBounds(node.style);
  const fillX = shapeBounds.left;
  const fillY = shapeBounds.top;
  const fillWidth = Math.max(0.0001, width - shapeBounds.left - shapeBounds.right);
  const fillHeight = Math.max(0.0001, height - shapeBounds.top - shapeBounds.bottom);

  if (fill.type === "solid") return colorWithOpacity(fill.color, fill.opacity ?? 1);

  if (fill.type === "radialGradient") {
    const transform = transformedGradientMatrix(fill, width, height);
    const centerX = transform ? transform[4] : fillX + (fill.centerX ?? 0.5) * fillWidth;
    const centerY = transform ? transform[5] : fillY + (fill.centerY ?? 0.5) * fillHeight;
    const radius = transform
      ? Math.max(Math.hypot(transform[0], transform[1]), Math.hypot(transform[2], transform[3]), 1)
      : fill.radius ?? Math.max(fillWidth, fillHeight) * 0.7;
    const gradient = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );
    for (const stop of fill.colors) {
      gradient.addColorStop(stop.position, colorWithOpacity(stop.color, (stop.opacity ?? 1) * (fill.opacity ?? 1)));
    }
    return gradient;
  }

  const angle = ((fill.angle ?? 90) - 90) * Math.PI / 180;
  const dx = Math.cos(angle) * fillWidth / 2;
  const dy = Math.sin(angle) * fillHeight / 2;
  const centerX = fillX + fillWidth / 2;
  const centerY = fillY + fillHeight / 2;
  const gradient = context.createLinearGradient(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
  for (const stop of fill.colors) {
    gradient.addColorStop(stop.position, colorWithOpacity(stop.color, (stop.opacity ?? 1) * (fill.opacity ?? 1)));
  }
  return gradient;
}

function transformedGradientMatrix(fill: MotionFill | undefined, width: number, height: number): [number, number, number, number, number, number] | undefined {
  if (!fill || fill.type !== "radialGradient" || !Array.isArray(fill.gradientTransform) || fill.gradientTransform.length !== 6) {
    return undefined;
  }

  return fill.gradientTransform.map((value) => numberValue(value)) as [number, number, number, number, number, number];
}

type ProceduralGradientField = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  centerXMode: "proportional" | "top" | "bottom" | "center";
  centerYMode: "proportional" | "top" | "bottom" | "center";
  radiusXMode: "proportional" | "width" | "height" | "minDimension" | "maxDimension" | "fixed";
  radiusYMode: "proportional" | "width" | "height" | "minDimension" | "maxDimension" | "fixed";
  blurMode: "scale" | "fixed";
  blur: number;
  opacity: number;
  stops: Array<{ color: string; position: number; opacity: number }>;
};

type ProceduralGradientRecipe = {
  referenceWidth: number;
  referenceHeight: number;
  fields: ProceduralGradientField[];
  fadeMode: "relative" | "fixed";
  fadeStops: Array<{ color: string; position: number; opacity: number }>;
};

const hotelActiveProceduralGradientRecipe: ProceduralGradientRecipe = {
  referenceWidth: 375,
  referenceHeight: 250,
  fields: [
    {
      centerX: 110,
      centerY: 192.5,
      radiusX: 343,
      radiusY: 217.5,
      centerXMode: "proportional",
      centerYMode: "bottom",
      radiusXMode: "width",
      radiusYMode: "fixed",
      blurMode: "fixed",
      blur: 50,
      opacity: 0.6000000238418579,
      stops: [
        { color: "#7FDEFF", position: 0, opacity: 0.800000011920929 },
        { color: "#7FDEFF", position: 1, opacity: 0 }
      ]
    },
    {
      centerX: 265,
      centerY: 258.5,
      radiusX: 266,
      radiusY: 258.5,
      centerXMode: "proportional",
      centerYMode: "bottom",
      radiusXMode: "width",
      radiusYMode: "fixed",
      blurMode: "fixed",
      blur: 50,
      opacity: 0.6000000238418579,
      stops: [
        { color: "#FFA800", position: 0, opacity: 1 },
        { color: "#FC790D", position: 0.34, opacity: 1 },
        { color: "#FF47D6", position: 0.64, opacity: 1 },
        { color: "#FF47D6", position: 1, opacity: 0 }
      ]
    }
  ],
  fadeMode: "fixed",
  fadeStops: [
    { color: "#FFFFFF", position: 0, opacity: 1 },
    { color: "#FFFFFF", position: 0.26, opacity: 0.76 },
    { color: "#FFFFFF", position: 0.58, opacity: 0 }
  ]
};

function isProceduralGradient(style: Record<string, unknown>) {
  return proceduralGradientRecipe(style) !== undefined;
}

function proceduralGradientStyle(name: string, recipe: ProceduralGradientRecipe): Record<string, string | number> {
  const style: Record<string, string | number> = {
    proceduralGradient: name,
    "proceduralGradient.referenceWidth": recipe.referenceWidth,
    "proceduralGradient.referenceHeight": recipe.referenceHeight,
    "proceduralGradient.fieldCount": recipe.fields.length,
    "proceduralGradient.fadeMode": recipe.fadeMode,
    "proceduralGradient.fadeStopCount": recipe.fadeStops.length
  };

  recipe.fields.forEach((field, index) => {
    const fieldKey = `proceduralGradient.field.${index}`;
    style[`${fieldKey}.centerX`] = field.centerX;
    style[`${fieldKey}.centerY`] = field.centerY;
    style[`${fieldKey}.radiusX`] = field.radiusX;
    style[`${fieldKey}.radiusY`] = field.radiusY;
    style[`${fieldKey}.centerXMode`] = field.centerXMode;
    style[`${fieldKey}.centerYMode`] = field.centerYMode;
    style[`${fieldKey}.radiusXMode`] = field.radiusXMode;
    style[`${fieldKey}.radiusYMode`] = field.radiusYMode;
    style[`${fieldKey}.blurMode`] = field.blurMode;
    style[`${fieldKey}.blur`] = field.blur;
    style[`${fieldKey}.opacity`] = field.opacity;
    style[`${fieldKey}.stopCount`] = field.stops.length;
    field.stops.forEach((stop, stopIndex) => {
      const stopKey = `${fieldKey}.stop.${stopIndex}`;
      style[`${stopKey}.color`] = stop.color;
      style[`${stopKey}.position`] = stop.position;
      style[`${stopKey}.opacity`] = stop.opacity;
    });
  });

  recipe.fadeStops.forEach((stop, index) => {
    const stopKey = `proceduralGradient.fadeStop.${index}`;
    style[`${stopKey}.color`] = stop.color;
    style[`${stopKey}.position`] = stop.position;
    style[`${stopKey}.opacity`] = stop.opacity;
  });

  return style;
}

function proceduralGradientRecipe(style: Record<string, unknown>): ProceduralGradientRecipe | undefined {
  if (typeof style.proceduralGradient !== "string") return undefined;
  const referenceWidth = numberValue(style["proceduralGradient.referenceWidth"], Number.NaN);
  const referenceHeight = numberValue(style["proceduralGradient.referenceHeight"], Number.NaN);
  const fieldCount = Math.max(0, Math.floor(numberValue(style["proceduralGradient.fieldCount"], 0)));
  if (!Number.isFinite(referenceWidth) || !Number.isFinite(referenceHeight) || referenceWidth <= 0 || referenceHeight <= 0 || fieldCount === 0) {
    return undefined;
  }

  const fields: ProceduralGradientField[] = [];
  for (let index = 0; index < fieldCount; index += 1) {
    const fieldKey = `proceduralGradient.field.${index}`;
    const stopCount = Math.max(0, Math.floor(numberValue(style[`${fieldKey}.stopCount`], 0)));
    const stops = [];
    for (let stopIndex = 0; stopIndex < stopCount; stopIndex += 1) {
      const stopKey = `${fieldKey}.stop.${stopIndex}`;
      const color = typeof style[`${stopKey}.color`] === "string" ? String(style[`${stopKey}.color`]) : "#FFFFFF";
      stops.push({
        color,
        position: clamp(numberValue(style[`${stopKey}.position`], 0), 0, 1),
        opacity: clamp(numberValue(style[`${stopKey}.opacity`], 1), 0, 1)
      });
    }
    if (stops.length < 2) continue;
    fields.push({
      centerX: numberValue(style[`${fieldKey}.centerX`], referenceWidth / 2),
      centerY: numberValue(style[`${fieldKey}.centerY`], referenceHeight / 2),
      radiusX: Math.max(1, numberValue(style[`${fieldKey}.radiusX`], referenceWidth)),
      radiusY: Math.max(1, numberValue(style[`${fieldKey}.radiusY`], referenceHeight)),
      centerXMode: proceduralAnchorMode(style[`${fieldKey}.centerXMode`]),
      centerYMode: proceduralAnchorMode(style[`${fieldKey}.centerYMode`]),
      radiusXMode: proceduralSizeMode(style[`${fieldKey}.radiusXMode`]),
      radiusYMode: proceduralSizeMode(style[`${fieldKey}.radiusYMode`]),
      blurMode: style[`${fieldKey}.blurMode`] === "fixed" ? "fixed" : "scale",
      blur: Math.max(0, numberValue(style[`${fieldKey}.blur`], 0)),
      opacity: clamp(numberValue(style[`${fieldKey}.opacity`], 1), 0, 1),
      stops
    });
  }

  if (fields.length === 0) return undefined;
  const fadeStopCount = Math.max(0, Math.floor(numberValue(style["proceduralGradient.fadeStopCount"], 0)));
  const fadeStops = [];
  for (let index = 0; index < fadeStopCount; index += 1) {
    const stopKey = `proceduralGradient.fadeStop.${index}`;
    const color = typeof style[`${stopKey}.color`] === "string" ? String(style[`${stopKey}.color`]) : "#FFFFFF";
    fadeStops.push({
      color,
      position: clamp(numberValue(style[`${stopKey}.position`], 0), 0, 1),
      opacity: clamp(numberValue(style[`${stopKey}.opacity`], 1), 0, 1)
    });
  }

  return {
    referenceWidth,
    referenceHeight,
    fields,
    fadeMode: style["proceduralGradient.fadeMode"] === "fixed" ? "fixed" : "relative",
    fadeStops
  };
}

function proceduralAnchorMode(value: unknown): ProceduralGradientField["centerXMode"] {
  if (value === "top" || value === "bottom" || value === "center") return value;
  return "proportional";
}

function proceduralSizeMode(value: unknown): ProceduralGradientField["radiusXMode"] {
  if (value === "width" || value === "height" || value === "minDimension" || value === "maxDimension" || value === "fixed") {
    return value;
  }
  return "proportional";
}

function proceduralGradientCssBackground(style: Record<string, unknown>) {
  const recipe = proceduralGradientRecipe(style);
  if (!recipe) return undefined;
  const { referenceWidth, referenceHeight, fields, fadeMode, fadeStops } = recipe;
  const layers = [...fields]
    .reverse()
    .map((field) => {
      const stops = field.stops
        .map((stop) => colorWithOpacity(stop.color, stop.opacity * field.opacity) + ` ${Math.round(stop.position * 100)}%`)
        .join(", ");
      return [
        "radial-gradient(",
        `ellipse ${round((field.radiusX / referenceWidth) * 100)}% ${round((field.radiusY / referenceHeight) * 100)}% `,
        `at ${round((field.centerX / referenceWidth) * 100)}% ${round((field.centerY / referenceHeight) * 100)}%, `,
        stops,
        ")"
      ].join("");
    });
  const fade = fadeStops.length > 0
    ? `linear-gradient(180deg, ${fadeStops.map((stop) => `${colorWithOpacity(stop.color, stop.opacity)} ${fadeMode === "fixed" ? `${round(stop.position * referenceHeight)}px` : `${Math.round(stop.position * 100)}%`}`).join(", ")})`
    : undefined;
  return [...(fade ? [fade] : []), ...layers, "#FFFFFF"].join(", ");
}

function drawProceduralGradient(context: CanvasRenderingContext2D, style: Record<string, unknown>, width: number, height: number) {
  const recipe = proceduralGradientRecipe(style);
  if (!recipe) return false;

  const { referenceWidth, referenceHeight, fields, fadeMode, fadeStops } = recipe;
  const scaleX = width / referenceWidth;
  const scaleY = height / referenceHeight;
  const minScale = Math.min(scaleX, scaleY);
  const maxScale = Math.max(scaleX, scaleY);

  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);

  for (const field of fields) {
    drawProceduralGradientField(context, field, { width, height, referenceWidth, referenceHeight, scaleX, scaleY, minScale, maxScale });
  }

  if (fadeStops.length > 0) {
    const fade = context.createLinearGradient(0, 0, 0, height);
    for (const stop of fadeStops) {
      const position = fadeMode === "fixed" ? clamp((stop.position * referenceHeight) / height, 0, 1) : stop.position;
      fade.addColorStop(position, colorWithOpacity(stop.color, stop.opacity));
    }
    context.fillStyle = fade;
    context.fillRect(0, 0, width, height);
  }
  context.restore();
  return true;
}

function drawProceduralGradientField(
  context: CanvasRenderingContext2D,
  field: ProceduralGradientField,
  metrics: {
    width: number;
    height: number;
    referenceWidth: number;
    referenceHeight: number;
    scaleX: number;
    scaleY: number;
    minScale: number;
    maxScale: number;
  }
) {
  const centerX = resolveProceduralPosition(field.centerX, field.centerXMode, metrics.width, metrics.referenceWidth, metrics.scaleX);
  const centerY = resolveProceduralPosition(field.centerY, field.centerYMode, metrics.height, metrics.referenceHeight, metrics.scaleY);
  const radiusX = Math.max(resolveProceduralSize(field.radiusX, field.radiusXMode, metrics), 1);
  const radiusY = Math.max(resolveProceduralSize(field.radiusY, field.radiusYMode, metrics), 1);
  const blurScale = field.blurMode === "fixed" ? 1 : metrics.minScale;
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const stop of field.stops) {
    gradient.addColorStop(stop.position, colorWithOpacity(stop.color, stop.opacity * field.opacity));
  }

  context.save();
  context.filter = `blur(${round(field.blur * blurScale)}px)`;
  context.translate(centerX, centerY);
  context.scale(radiusX, radiusY);
  context.fillStyle = gradient;
  context.fillRect(-2, -2, 4, 4);
  context.restore();
}

function resolveProceduralPosition(value: number, mode: ProceduralGradientField["centerXMode"], size: number, referenceSize: number, scale: number) {
  if (mode === "top") return value;
  if (mode === "bottom") return size - (referenceSize - value);
  if (mode === "center") return size / 2 + (value - referenceSize / 2);
  return value * scale;
}

function resolveProceduralSize(
  value: number,
  mode: ProceduralGradientField["radiusXMode"],
  metrics: { scaleX: number; scaleY: number; minScale: number; maxScale: number }
) {
  if (mode === "fixed") return value;
  if (mode === "width") return value * metrics.scaleX;
  if (mode === "height") return value * metrics.scaleY;
  if (mode === "minDimension") return value * metrics.minScale;
  if (mode === "maxDimension") return value * metrics.maxScale;
  return value * ((metrics.scaleX + metrics.scaleY) / 2);
}

function transformedRadialGradientCanvas(
  fill: Extract<MotionFill, { type: "radialGradient" }>,
  width: number,
  height: number,
  transform: [number, number, number, number, number, number]
) {
  const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const rasterWidth = Math.max(1, Math.ceil(width * ratio));
  const rasterHeight = Math.max(1, Math.ceil(height * ratio));
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 0.000001) return null;

  const canvas = document.createElement("canvas");
  canvas.width = rasterWidth;
  canvas.height = rasterHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(rasterWidth, rasterHeight);
  const data = image.data;
  const stops = [...fill.colors]
    .map((stop) => ({
      position: clamp(stop.position, 0, 1),
      color: parseHexColor(stop.color),
      opacity: clamp((stop.opacity ?? 1) * (fill.opacity ?? 1), 0, 1)
    }))
    .sort((left, right) => left.position - right.position);

  if (stops.length === 0) return null;

  const invA = d / determinant;
  const invB = -b / determinant;
  const invC = -c / determinant;
  const invD = a / determinant;
  const scaleX = width / rasterWidth;
  const scaleY = height / rasterHeight;

  for (let y = 0; y < rasterHeight; y += 1) {
    const nodeY = (y + 0.5) * scaleY;
    for (let x = 0; x < rasterWidth; x += 1) {
      const nodeX = (x + 0.5) * scaleX;
      const localX = nodeX - e;
      const localY = nodeY - f;
      const gx = invA * localX + invC * localY;
      const gy = invB * localX + invD * localY;
      const color = sampleGradientStops(stops, Math.hypot(gx, gy));
      const index = (y * rasterWidth + x) * 4;
      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = Math.round(color.a * 255);
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function parseHexColor(color: string) {
  const normalized = color.trim().replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function sampleGradientStops(
  stops: Array<{ position: number; color: { r: number; g: number; b: number }; opacity: number }>,
  position: number
) {
  const first = stops[0];
  if (!first) return { r: 255, g: 255, b: 255, a: 0 };

  if (position <= first.position) {
    return { r: first.color.r, g: first.color.g, b: first.color.b, a: first.opacity };
  }

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const next = stops[index];
    if (!previous || !next) continue;
    if (position <= next.position) {
      const span = Math.max(next.position - previous.position, 0.000001);
      const progress = clamp((position - previous.position) / span, 0, 1);
      return {
        r: Math.round(mix(previous.color.r, next.color.r, progress)),
        g: Math.round(mix(previous.color.g, next.color.g, progress)),
        b: Math.round(mix(previous.color.b, next.color.b, progress)),
        a: mix(previous.opacity, next.opacity, progress)
      };
    }
  }

  const last = stops[stops.length - 1] ?? first;
  return { r: last.color.r, g: last.color.g, b: last.color.b, a: last.opacity };
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function nodeEffectBounds(style: Record<string, unknown>) {
  const raw = style.effectBounds;
  if (typeof raw === "number") {
    const value = Math.max(0, raw);
    return { top: value, right: value, bottom: value, left: value };
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    return {
      top: numberValue(record.top, 0),
      right: numberValue(record.right, 0),
      bottom: numberValue(record.bottom, 0),
      left: numberValue(record.left, 0)
    };
  }
  const explicit = {
    top: numberValue(style["effectBounds.top"], Number.NaN),
    right: numberValue(style["effectBounds.right"], Number.NaN),
    bottom: numberValue(style["effectBounds.bottom"], Number.NaN),
    left: numberValue(style["effectBounds.left"], Number.NaN)
  };
  if (Object.values(explicit).some(Number.isFinite)) {
    return {
      top: Number.isFinite(explicit.top) ? explicit.top : 0,
      right: Number.isFinite(explicit.right) ? explicit.right : 0,
      bottom: Number.isFinite(explicit.bottom) ? explicit.bottom : 0,
      left: Number.isFinite(explicit.left) ? explicit.left : 0
    };
  }
  const fallback = renderBlur(style) * 2;
  return { top: fallback, right: fallback, bottom: fallback, left: fallback };
}

function nodeShapeBounds(style: Record<string, unknown>) {
  const raw = style.shapeBounds;
  if (typeof raw === "number") {
    const value = Math.max(0, raw);
    return { top: value, right: value, bottom: value, left: value };
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    return {
      top: Math.max(0, numberValue(record.top, 0)),
      right: Math.max(0, numberValue(record.right, 0)),
      bottom: Math.max(0, numberValue(record.bottom, 0)),
      left: Math.max(0, numberValue(record.left, 0))
    };
  }
  const explicit = {
    top: numberValue(style["shapeBounds.top"], Number.NaN),
    right: numberValue(style["shapeBounds.right"], Number.NaN),
    bottom: numberValue(style["shapeBounds.bottom"], Number.NaN),
    left: numberValue(style["shapeBounds.left"], Number.NaN)
  };
  if (Object.values(explicit).some(Number.isFinite)) {
    return {
      top: Number.isFinite(explicit.top) ? Math.max(0, explicit.top) : 0,
      right: Number.isFinite(explicit.right) ? Math.max(0, explicit.right) : 0,
      bottom: Number.isFinite(explicit.bottom) ? Math.max(0, explicit.bottom) : 0,
      left: Number.isFinite(explicit.left) ? Math.max(0, explicit.left) : 0
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function roundedCanvasRect(context: CanvasRenderingContext2D | Path2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(Math.max(radius, 0), width / 2, height / 2);
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
}

function canvasCompositeOperation(value: unknown): GlobalCompositeOperation {
  if (value === "screen") return "screen";
  if (value === "colorDodge" || value === "color-dodge") return "color-dodge";
  if (value === "plusLighter" || value === "plus-lighter") return "lighter";
  if (value === "multiply") return "multiply";
  return "source-over";
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

function buildDesignCodePanel(
  project: StudioProject,
  selectedNode: StudioNode | undefined,
  selectedComponent: StudioComponent | undefined,
  runtimeJson: string
) {
  const component = selectedComponent ?? (selectedNode?.componentId ? project.components[selectedNode.componentId] : undefined);

  if (component) {
    return {
      title: selectedComponent ? "Main Component JSON" : "Component Instance JSON",
      body: formatJson({
        component,
        instance: selectedNode?.componentId === component.id ? selectedNode : undefined,
        runtimeExport: selectedNode ? {
          id: selectedNode.id,
          kind: selectedNode.kind,
          roles: [...selectedNode.roles].sort(),
          layout: selectedNode.layout,
          style: selectedNode.style,
          fills: selectedNode.fills ?? [],
          presentation: selectedNode.presentation,
          children: selectedNode.childIds
        } : undefined
      })
    };
  }

  if (selectedNode) {
    return {
      title: "Layer Runtime JSON",
      body: formatJson({
        node: selectedNode,
        runtimeExport: {
          id: selectedNode.id,
          kind: selectedNode.kind,
          roles: [...selectedNode.roles].sort(),
          layout: selectedNode.layout,
          style: selectedNode.style,
          fills: selectedNode.fills ?? [],
          presentation: selectedNode.presentation,
          children: selectedNode.childIds
        }
      })
    };
  }

  return {
    title: "Runtime JSON",
    body: runtimeJson
  };
}

function normalizeLoadedProject(project: StudioProject) {
  project = dedupeVoiceGradientAssets(project);
  project = removeOrphanNodes(project);
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

function removeOrphanNodes(project: StudioProject) {
  const next = cloneProject(project);
  let changed = false;
  let removed = true;

  while (removed) {
    removed = false;
    for (const node of Object.values(next.nodes)) {
      if (node.id === next.rootNodeId || node.parentId === null || node.parentId === undefined || next.nodes[node.parentId]) continue;
      removeNodeMotionReferences(next, node.id);
      delete next.nodes[node.id];
      changed = true;
      removed = true;
    }
  }

  if (!changed) return project;

  const existingIds = new Set(Object.keys(next.nodes));
  for (const node of Object.values(next.nodes)) {
    node.childIds = node.childIds.filter((childId) => existingIds.has(childId));
  }
  if (next.editor?.selection?.some((nodeId) => !existingIds.has(nodeId))) {
    next.editor = { ...next.editor, viewportPreset: next.editor.viewportPreset ?? "iphone", selection: [] };
  }
  saveStoredProject(next);
  return next;
}

function componentLibraryItems(project: StudioProject, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const components = Object.values(project.components);
  if (!normalizedQuery) return components;

  return components.filter((component) => {
    const searchable = [
      component.name,
      component.id,
      component.kind ?? "",
      ...(component.roles ?? []),
      ...componentLayerAssets(component).map((node) => `${node.name} ${node.kind} ${node.roles.join(" ")}`)
    ].join(" ").toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

function dedupeVoiceGradientAssets(project: StudioProject) {
  const entries = Object.entries(project.components).filter(([, component]) => component.name === "Voice Gradient" || component.roles?.includes("voiceGradient"));
  if (entries.length === 0) return project;

  const canonicalId = "voiceGradient";
  const canonical = project.components[canonicalId] ?? entries[0]?.[1] ?? voiceGradientComponent(canonicalId);
  const previousCanonicalId = canonical.id;
  canonical.id = canonicalId;
  retargetComponentTemplateRoles(canonical, previousCanonicalId, canonicalId);
  canonical.roles = uniqueStrings([...(canonical.roles ?? []), "voiceGradient", `component:${canonicalId}`]);

  const duplicateIds = entries.map(([id]) => id).filter((id) => id !== canonicalId);
  if (duplicateIds.length === 0 && project.components[canonicalId] !== undefined) return project;

  const next = cloneProject(project);
  next.components[canonicalId] = canonical;
  for (const duplicateId of duplicateIds) {
    delete next.components[duplicateId];
  }
  for (const node of Object.values(next.nodes)) {
    if (duplicateIds.includes(node.componentId ?? "")) node.componentId = canonicalId;
    node.roles = uniqueStrings(node.roles.map((role) => duplicateIds.includes(role.replace("component:", "")) ? `component:${canonicalId}` : role));
  }
  next.roles[`component:${canonicalId}`] = { id: `component:${canonicalId}`, name: `component:${canonicalId}` };
  for (const duplicateId of duplicateIds) {
    delete next.roles[`component:${duplicateId}`];
  }
  return next;
}

function saveStoredProject(project: StudioProject) {
  window.localStorage.setItem(storageKey, JSON.stringify(project));
}

function rootBackgroundColor(project: StudioProject) {
  const value = project.nodes[project.rootNodeId]?.style.backgroundColor;
  return typeof value === "string" ? safeHex(value, "#0B1020") : "#0B1020";
}

function canvasPreviewBackgroundStyle(mode: CanvasPreviewBackground, deviceColor: string): React.CSSProperties {
  if (mode === "checker") {
    return {
      backgroundColor: "#FFFFFF",
      backgroundImage: [
        "linear-gradient(45deg, rgba(148, 163, 184, 0.42) 25%, transparent 25%)",
        "linear-gradient(-45deg, rgba(148, 163, 184, 0.42) 25%, transparent 25%)",
        "linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.42) 75%)",
        "linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.42) 75%)"
      ].join(", "),
      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
      backgroundSize: "16px 16px"
    };
  }

  return {
    backgroundColor: mode === "black" ? "#000000" : mode === "white" ? "#FFFFFF" : deviceColor,
    backgroundImage: "none",
    backgroundPosition: "0 0",
    backgroundSize: "auto"
  };
}

function previewBackgroundSwatchStyle(mode: CanvasPreviewBackground, deviceColor: string): React.CSSProperties {
  if (mode === "checker") {
    return {
      ...canvasPreviewBackgroundStyle(mode, deviceColor),
      backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
      backgroundSize: "8px 8px"
    };
  }

  return canvasPreviewBackgroundStyle(mode, deviceColor);
}

function bridgeStatusView(health: BridgeHealth | undefined) {
  if (!health) {
    return { kind: "checking" as const, message: "Checking bridge" };
  }
  if (!health.ok) {
    return { kind: "offline" as const, message: "Bridge offline" };
  }
  if (health.previewClients > 0) {
    return { kind: "connected" as const, message: `Simulator connected (${health.previewClients})` };
  }
  return { kind: "no-client" as const, message: "Bridge running, no simulator" };
}

function formatJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
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
    const nextValues = applyPreviewTargets(project, values, phase);
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
  phase: StudioPhase
): Record<string, PreviewTransform> {
  const next = clone(current);
  for (const assignment of phase.targets) {
    if (typeof assignment.value !== "number") continue;
    for (const nodeId of resolveNodeSelector(project, assignment.select)) {
      const transform = next[nodeId];
      if (!transform) continue;
      for (const property of assignment.select.properties) {
        const value = phase.mode === "deltaFromPrevious"
          ? previewPropertyValue(transform, property) + assignment.value
          : assignment.value;
        if (property === "offset.x") transform.x = value;
        if (property === "offset.y") transform.y = value;
        if (property === "scale") transform.scale = value;
        if (property === "rotation") transform.rotation = value;
        if (property === "opacity") transform.opacity = value;
      }
    }
  }
  return next;
}

function previewPropertyValue(transform: PreviewTransform, property: MotionPropertySelector["properties"][number]) {
  if (property === "offset.x") return transform.x;
  if (property === "offset.y") return transform.y;
  if (property === "scale") return transform.scale;
  if (property === "rotation") return transform.rotation;
  if (property === "opacity") return transform.opacity;
  return 0;
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

function nodeDepth(project: StudioProject, node: StudioNode) {
  let depth = 0;
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && parentId !== project.rootNodeId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    parentId = project.nodes[parentId]?.parentId ?? null;
  }
  return depth;
}

function defaultStyle(kind: NodeKindChoice, name: string): StudioNode["style"] {
  if (kind === "text") return { text: name, foregroundColor: "#E0F2FE" };
  if (kind === "image") return { imageUrl: "", contentMode: "100% 100%" };
  if (kind === "path") {
    return {
      backgroundColor: "#38BDF8",
      pathData: "M 100 0 C 100 55.23 55.23 100 0 100 C -55.23 100 -100 55.23 -100 0 C -100 -55.23 -55.23 -100 0 -100 C 55.23 -100 100 -55.23 100 0 Z",
      viewBoxWidth: 200,
      viewBoxHeight: 200
    };
  }
  if (kind === "circle") return { backgroundColor: "#38BDF8" };
  return { backgroundColor: "#0EA5E9", cornerRadius: 14 };
}

function defaultFills(kind: NodeKindChoice): MotionFill[] {
  if (kind === "text" || kind === "image") return [];
  return [{
    type: "solid",
    color: kind === "circle" ? "#38BDF8" : "#0EA5E9",
    opacity: 1
  }];
}

function defaultLayout(kind: NodeKindChoice): StudioNode["layout"] {
  if (kind === "text") return {};
  if (kind === "image") return { width: 160, height: 110 };
  if (kind === "path") return { width: 120, height: 120 };
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

function retargetComponentTemplateRoles(component: StudioComponent, oldId: string, newId: string) {
  const oldRole = `component:${oldId}`;
  const newRole = `component:${newId}`;
  component.roles = uniqueStrings([...(component.roles ?? []).filter((role) => role !== oldRole), newRole]);
  for (const node of Object.values(component.nodes ?? {})) {
    node.roles = uniqueStrings(node.roles.map((role) => role === oldRole ? newRole : role));
  }
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

function nodeFromTemplateLayer(component: StudioComponent, template: StudioNode, records: Record<string, StudioNode>, rootNodeId: string): StudioNode {
  const id = uniqueId(slug(`${component.name}-${template.name}`), records);
  return {
    ...clone(template),
    id,
    name: template.name,
    parentId: rootNodeId,
    childIds: [],
    roles: uniqueStrings([
      ...template.roles.filter((role) => role !== `component:${component.id}`),
      "assetLayer",
      "detachedAssetLayer",
      `assetSource:${component.id}`
    ]),
    presentation: {
      ...clone(template.presentation),
      "offset.x": 0,
      "offset.y": 0
    }
  };
}

function componentLayerAssets(component: StudioComponent) {
  if (component.nodes === undefined) return [];
  const ids = component.nodeIds?.length ? component.nodeIds : Object.keys(component.nodes);
  return ids
    .map((id) => component.nodes?.[id])
    .filter((node): node is StudioNode => node !== undefined)
    .filter((node) => node.kind !== "zstack" || node.id === component.rootNodeId);
}

function instantiateLayeredComponent(project: StudioProject, component: StudioComponent): StudioNode {
  const templateNodes = component.nodes ?? {};
  const orderedTemplateIds = component.nodeIds?.length ? component.nodeIds : Object.keys(templateNodes);
  const idMap = new Map<string, string>();
  for (const templateId of orderedTemplateIds) {
    idMap.set(templateId, uniqueId(slug(`${component.name}-${templateId}`), project.nodes));
  }

  let firstNode: StudioNode | undefined;
  for (const templateId of orderedTemplateIds) {
    const template = templateNodes[templateId];
    const id = idMap.get(templateId);
    if (!template || !id) continue;
    const mappedParentId = template.parentId !== null ? idMap.get(template.parentId) : undefined;

    const node: StudioNode = {
      ...clone(template),
      id,
      parentId: mappedParentId ?? project.rootNodeId,
      childIds: template.childIds.map((childId) => idMap.get(childId)).filter((childId): childId is string => childId !== undefined),
      roles: uniqueStrings([...template.roles, `component:${component.id}`]),
      componentId: component.id
    };
    project.nodes[id] = node;
    if (mappedParentId === undefined) {
      project.nodes[project.rootNodeId]?.childIds.push(id);
      firstNode ??= node;
    }
  }

  for (const role of componentRoles(component)) {
    project.roles[role] ??= { id: role, name: role };
  }
  project.roles.voiceGradient ??= { id: "voiceGradient", name: "voiceGradient", description: "Layered Figma voice gradient preset" };

  return firstNode ?? nodeFromComponent(component, project.nodes, project.rootNodeId);
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

const voiceDodgeExpandedPath = "M194.147 134.475C194.147 153.515 151.026 220.008 125.03 220.008C99.0331 220.008 100.005 153.515 100.005 134.475C100.005 115.435 121.079 100 147.076 100C173.072 100 194.147 115.435 194.147 134.475Z";

type FigmaColor = { r: number; g: number; b: number; a?: number };
type FigmaGradientStop = { color: FigmaColor; position: number; variable?: string };
type FigmaRadialFill = {
  type: "GRADIENT_RADIAL";
  visible: boolean;
  opacity: number;
  blendMode: string;
  gradientTransform: [[number, number, number], [number, number, number]];
  gradientStops: FigmaGradientStop[];
};
type FigmaLayerBlurEffect = {
  type: "LAYER_BLUR";
  visible: boolean;
  radius: number;
  blurType: string;
};
type FigmaRect = { x: number; y: number; width: number; height: number };
type FigmaEllipseLayerContract = {
  id: string;
  name: string;
  type: "ELLIPSE";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blendMode: string;
  absoluteBoundingBox: FigmaRect;
  absoluteRenderBounds: FigmaRect;
  fills: FigmaRadialFill[];
  effects: FigmaLayerBlurEffect[];
  vectorExport: {
    filterBox: FigmaRect;
    renderBoundsRadialGradientTransform: [number, number, number, number, number, number];
  };
};

const figmaPlanetOneLayer: FigmaEllipseLayerContract = {
  id: "250:475",
  name: "Planet 1",
  type: "ELLIPSE",
  x: -70,
  y: 141.0000762939453,
  width: 516,
  height: 269,
  opacity: 1,
  blendMode: "PASS_THROUGH",
  absoluteBoundingBox: { x: 292, y: 465.00006103515625, width: 516, height: 269 },
  absoluteRenderBounds: { x: 362, y: 365.00006103515625, width: 375, height: 206.99993896484375 },
  fills: [{
    type: "GRADIENT_RADIAL",
    visible: true,
    opacity: 1,
    blendMode: "NORMAL",
    gradientTransform: [
      [-0.003717739600688219, 0.43574050068855286, 0.524412989616394],
      [-0.436233788728714, 1.0644263248593688e-14, 0.70759117603302]
    ],
    gradientStops: [
      { color: { r: 0.9411764740943909, g: 0.5882353186607361, b: 0.054901961237192154, a: 1 }, position: 0.13211318850517273, variable: "yellow-500" },
      { color: { r: 0.9882352948188782, g: 0.4745098054409027, b: 0.05098039284348488, a: 1 }, position: 0.16975507140159607, variable: "orange-500" },
      { color: { r: 0.5137255191802979, g: 0.125490203499794, b: 0.8549019694328308, a: 1 }, position: 0.2731081545352936, variable: "purple-600" },
      { color: { r: 0.8196078538894653, g: 0.5843137502670288, b: 0.9764705896377563, a: 1 }, position: 0.3799999952316284, variable: "purple-300" },
      { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0.44999998807907104, variable: "neutral-100" }
    ]
  }],
  effects: [{ type: "LAYER_BLUR", visible: true, radius: 100, blurType: "NORMAL" }],
  vectorExport: {
    filterBox: { x: -170, y: 0, width: 716, height: 469 },
    renderBoundsRadialGradientTransform: [0, 308.67, -591.426, -2.6306, 175.55, 86.0211]
  }
};

const figmaHotelPlanetOneLayer: FigmaEllipseLayerContract = {
  id: "5014:46007",
  name: "Planet 1",
  type: "ELLIPSE",
  x: 1301.0007934570312,
  y: 2672.99995803833,
  width: 332,
  height: 317,
  opacity: 1,
  blendMode: "PASS_THROUGH",
  absoluteBoundingBox: { x: 21848, y: 14727, width: 332, height: 317 },
  absoluteRenderBounds: { x: 21748, y: 14627, width: 532, height: 517 },
  fills: [{
    type: "GRADIENT_RADIAL",
    visible: true,
    opacity: 1,
    blendMode: "NORMAL",
    gradientTransform: [
      [0.06025275960564613, 0.4398942291736603, 0.49992650747299194],
      [-0.4398942291736603, 0.05836670473217964, 0.6909582614898682]
    ],
    gradientStops: [
      { color: { r: 1, g: 0.6599999666213989, b: 0, a: 1 }, position: 0 },
      { color: { r: 0.9882352948188782, g: 0.4745098054409027, b: 0.05098039284348488, a: 1 }, position: 0.3400000035762787 },
      { color: { r: 1, g: 0.2766667604446411, b: 0.8408665060997009, a: 1 }, position: 0.6399999856948853 }
    ]
  }],
  effects: [{ type: "LAYER_BLUR", visible: true, radius: 100, blurType: "NORMAL" }],
  vectorExport: {
    filterBox: { x: 0, y: 0, width: 532, height: 517 },
    renderBoundsRadialGradientTransform: [49.1762, 353.883, -370.628, 48.4716, 241.556, 81.5399]
  }
};

function figmaEllipseLayerToFrameZeroNode(
  layer: FigmaEllipseLayerContract,
  options: {
    id: string;
    roles: string[];
    parentId: string | null;
    offsetX: number;
    offsetY: number;
  }
): StudioNode {
  const fill = layer.fills.find((candidate) => candidate.visible && candidate.type === "GRADIENT_RADIAL");
  if (!fill) throw new Error(`Figma layer ${layer.id} does not have a visible radial fill`);

  const blur = layer.effects.find((effect) => effect.visible && effect.type === "LAYER_BLUR")?.radius ?? 0;
  const renderBounds = layer.absoluteRenderBounds;
  const filterBox = layer.vectorExport.filterBox;
  const filterAbsoluteX = renderBounds.x + filterBox.x;
  const filterAbsoluteY = renderBounds.y + filterBox.y;
  const shapeLeft = layer.absoluteBoundingBox.x - filterAbsoluteX;
  const shapeTop = layer.absoluteBoundingBox.y - filterAbsoluteY;
  const shapeRight = filterBox.width - shapeLeft - layer.absoluteBoundingBox.width;
  const shapeBottom = filterBox.height - shapeTop - layer.absoluteBoundingBox.height;
  const cropX = -filterBox.x;
  const cropY = -filterBox.y;
  const filterBoxGradientTransform = figmaRenderBoundsTransformToFilterBoxTransform(
    layer.vectorExport.renderBoundsRadialGradientTransform,
    cropX,
    cropY
  );

  return voiceEllipseNode(
    options.id,
    layer.name,
    options.roles,
    round(renderBounds.width),
    round(renderBounds.height),
    options.offsetX,
    options.offsetY,
    layer.opacity,
    [{
      type: "radialGradient",
      colors: fill.gradientStops.map((stop) => ({
        color: figmaColorToHex(stop.color),
        position: stop.position,
        opacity: stop.color.a ?? fill.opacity
      })),
      gradientTransform: filterBoxGradientTransform,
      opacity: fill.opacity
    }],
    {
      figmaBlur: blur,
      "shapeBounds.top": shapeTop,
      "shapeBounds.right": shapeRight,
      "shapeBounds.bottom": shapeBottom,
      "shapeBounds.left": shapeLeft,
      "figmaFilterBox.x": filterBox.x,
      "figmaFilterBox.y": filterBox.y,
      "figmaFilterBox.width": filterBox.width,
      "figmaFilterBox.height": filterBox.height,
      "figmaFilterBox.cropX": cropX,
      "figmaFilterBox.cropY": cropY,
      "figma.source.id": layer.id,
      "figma.source.type": layer.type,
      "figma.source.x": layer.x,
      "figma.source.y": layer.y,
      "figma.source.width": layer.width,
      "figma.source.height": layer.height,
      "figma.source.absoluteBoundingBox.x": layer.absoluteBoundingBox.x,
      "figma.source.absoluteBoundingBox.y": layer.absoluteBoundingBox.y,
      "figma.source.absoluteBoundingBox.width": layer.absoluteBoundingBox.width,
      "figma.source.absoluteBoundingBox.height": layer.absoluteBoundingBox.height,
      "figma.source.absoluteRenderBounds.x": renderBounds.x,
      "figma.source.absoluteRenderBounds.y": renderBounds.y,
      "figma.source.absoluteRenderBounds.width": renderBounds.width,
      "figma.source.absoluteRenderBounds.height": renderBounds.height,
      "figma.source.blurRadius": blur,
      "figma.source.gradientTransform.0.0": fill.gradientTransform[0][0],
      "figma.source.gradientTransform.0.1": fill.gradientTransform[0][1],
      "figma.source.gradientTransform.0.2": fill.gradientTransform[0][2],
      "figma.source.gradientTransform.1.0": fill.gradientTransform[1][0],
      "figma.source.gradientTransform.1.1": fill.gradientTransform[1][1],
      "figma.source.gradientTransform.1.2": fill.gradientTransform[1][2],
      "figma.vectorExport.renderBoundsRadialGradientTransform.0": layer.vectorExport.renderBoundsRadialGradientTransform[0],
      "figma.vectorExport.renderBoundsRadialGradientTransform.1": layer.vectorExport.renderBoundsRadialGradientTransform[1],
      "figma.vectorExport.renderBoundsRadialGradientTransform.2": layer.vectorExport.renderBoundsRadialGradientTransform[2],
      "figma.vectorExport.renderBoundsRadialGradientTransform.3": layer.vectorExport.renderBoundsRadialGradientTransform[3],
      "figma.vectorExport.renderBoundsRadialGradientTransform.4": layer.vectorExport.renderBoundsRadialGradientTransform[4],
      "figma.vectorExport.renderBoundsRadialGradientTransform.5": layer.vectorExport.renderBoundsRadialGradientTransform[5],
      "figma.frameZero.filterBoxRadialGradientTransform.0": filterBoxGradientTransform[0],
      "figma.frameZero.filterBoxRadialGradientTransform.1": filterBoxGradientTransform[1],
      "figma.frameZero.filterBoxRadialGradientTransform.2": filterBoxGradientTransform[2],
      "figma.frameZero.filterBoxRadialGradientTransform.3": filterBoxGradientTransform[3],
      "figma.frameZero.filterBoxRadialGradientTransform.4": filterBoxGradientTransform[4],
      "figma.frameZero.filterBoxRadialGradientTransform.5": filterBoxGradientTransform[5]
    },
    0,
    1,
    options.parentId
  );
}

function figmaRenderBoundsTransformToFilterBoxTransform(
  transform: [number, number, number, number, number, number],
  cropX: number,
  cropY: number
): [number, number, number, number, number, number] {
  return [
    transform[0],
    transform[1],
    transform[2],
    transform[3],
    transform[4] + cropX,
    transform[5] + cropY
  ];
}

function figmaColorToHex(color: FigmaColor) {
  const channel = (value: number) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function voiceGradientComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const roles = ["actor", "voiceGradient", componentRole];
  const nodes: Record<string, StudioNode> = {
    voiceFrame: voiceGradientNode("voiceFrame", "Voice Gradient Frame", "zstack", roles, 375, 248, 0, 0, {
      clip: true,
      cornerRadius: 0
    }, [{
      type: "linearGradient",
      angle: 180,
      colors: [
        { color: "#FFFFFF", position: 0, opacity: 0 },
        { color: "#FFFFFF", position: 0.15, opacity: 0.3 },
        { color: "#FFFFFF", position: 0.35, opacity: 0.7 },
        { color: "#FFFFFF", position: 0.5, opacity: 1 },
        { color: "#FFFFFF", position: 1, opacity: 1 }
      ],
      opacity: 1
    }], 0, null, ["planetWide", "planetOne", "planetFour", "planetThree", "leftDodge", "rightDodge"]),
    planetWide: voiceImageNode("planetWide", "Planet 2", ["voiceGradient", "fidelity:asset-required", "figma:295-45", componentRole], 1060, 440, 0.5, 88, 0.8, "/figma/voice/planet-2.svg", {
      "effectBounds.top": 70,
      "effectBounds.right": 70,
      "effectBounds.bottom": 70,
      "effectBounds.left": 70
    }, 180, 1, "voiceFrame"),
    planetOne: figmaEllipseLayerToFrameZeroNode(figmaPlanetOneLayer, {
      id: "planetOne",
      roles: ["voiceGradient", "figma:250-475", "native-layer:planet-1", componentRole],
      parentId: "voiceFrame",
      offsetX: 0,
      offsetY: 20.5
    }),
    planetFour: voiceImageNode("planetFour", "Planet 4", ["voiceGradient", "fidelity:asset-required", "figma:250-476", componentRole], 303, 276, 0, 10, 0.8, "/figma/voice/planet-4.svg", {
      "effectBounds.top": 80,
      "effectBounds.right": 80,
      "effectBounds.bottom": 80,
      "effectBounds.left": 80
    }, 0, 1, "voiceFrame"),
    planetThree: voiceImageNode("planetThree", "Planet 3", ["voiceGradient", "fidelity:asset-required", "figma:250-477", componentRole], 250, 240, -0.5, 28, 0.8, "/figma/voice/planet-3.svg", {
      blendMode: "screen",
      "effectBounds.top": 80,
      "effectBounds.right": 80,
      "effectBounds.bottom": 80,
      "effectBounds.left": 80
    }, 0, 1, "voiceFrame"),
    leftDodge: voiceImageNode("leftDodge", "Colour Dodge", ["voiceGradient", "fidelity:asset-required", "figma:250-478", componentRole], 294.147, 320.008, -150.36, 7.06, 1, "/figma/voice/colour-dodge-1.svg", {
      blendMode: "plusLighter",
      "effectBounds.top": 100,
      "effectBounds.right": 100,
      "effectBounds.bottom": 100,
      "effectBounds.left": 100
    }, -75),
    rightDodge: voiceImageNode("rightDodge", "Colour Dodge 2", ["voiceGradient", "fidelity:asset-required", "figma:250-479", componentRole], 294.147, 320.008, 151.64, 7.06, 1, "/figma/voice/colour-dodge-2.svg", {
      blendMode: "plusLighter",
      "effectBounds.top": 100,
      "effectBounds.right": 100,
      "effectBounds.bottom": 100,
      "effectBounds.left": 100
    }, -105, -1)
  };

  return {
    id,
    name: "Voice Gradient",
    rootNodeId: "voiceFrame",
    nodeIds: ["voiceFrame", "planetWide", "planetOne", "planetFour", "planetThree", "leftDodge", "rightDodge"],
    nodes,
    roles: ["voiceGradient", componentRole]
  };
}

function hotelPlanetOneComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const nodes: Record<string, StudioNode> = {
    hotelPlanetOne: figmaEllipseLayerToFrameZeroNode(figmaHotelPlanetOneLayer, {
      id: "hotelPlanetOne",
      roles: ["actor", "hotelPlanetOne", "figma:5014-46007", "native-layer:hotel-planet-1", componentRole],
      parentId: null,
      offsetX: 0,
      offsetY: 0
    })
  };
  const frameNode = nodes.hotelGradientFrame;
  if (frameNode) frameNode.presentation.opacity = 0.6000000238418579;

  return {
    id,
    name: "Hotel Planet 1",
    rootNodeId: "hotelPlanetOne",
    nodeIds: ["hotelPlanetOne"],
    nodes,
    roles: ["hotelPlanetOne", componentRole]
  };
}

function hotelPlanetTwoComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const nodes: Record<string, StudioNode> = {
    hotelPlanetTwo: voiceEllipseNode(
      "hotelPlanetTwo",
      "Planet 2",
      ["actor", "hotelPlanetTwo", "figma:5014-46006", "native-layer:hotel-planet-2", componentRole],
      686,
      435,
      447,
      181.5,
      1,
      [{
        type: "linearGradient",
        angle: 0,
        colors: [
          { color: "#7FDEFF", position: 0, opacity: 0.800000011920929 },
          { color: "#7FDEFF", position: 1, opacity: 1 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 100,
        "shapeBounds.top": 100,
        "shapeBounds.right": 100,
        "shapeBounds.bottom": 100,
        "shapeBounds.left": 100,
        "figmaFilterBox.x": 0,
        "figmaFilterBox.y": 0,
        "figmaFilterBox.width": 686,
        "figmaFilterBox.height": 435,
        "figmaFilterBox.cropX": 0,
        "figmaFilterBox.cropY": 0,
        "figma.source.id": "5014:46006",
        "figma.source.type": "ELLIPSE",
        "figma.source.x": 1555.0001831054688,
        "figma.source.y": 2883,
        "figma.source.width": 486.0000305175781,
        "figma.source.height": 234.9999542236328,
        "figma.source.absoluteBoundingBox.x": 21615.999969482422,
        "figma.source.absoluteBoundingBox.y": 14702.000003288895,
        "figma.source.absoluteBoundingBox.width": 486.0000510619284,
        "figma.source.absoluteBoundingBox.height": 234.99999671110527,
        "figma.source.absoluteRenderBounds.x": 21516,
        "figma.source.absoluteRenderBounds.y": 14602,
        "figma.source.absoluteRenderBounds.width": 686,
        "figma.source.absoluteRenderBounds.height": 435,
        "figma.source.blurRadius": 100,
        "figma.source.gradientTransform.0.0": 6.123234262925839e-17,
        "figma.source.gradientTransform.0.1": -1,
        "figma.source.gradientTransform.0.2": 1,
        "figma.source.gradientTransform.1.0": 1,
        "figma.source.gradientTransform.1.1": 6.123234262925839e-17,
        "figma.source.gradientTransform.1.2": 0,
        "figma.vectorExport.linearGradient.x1": 343,
        "figma.vectorExport.linearGradient.y1": 335,
        "figma.vectorExport.linearGradient.x2": 343,
        "figma.vectorExport.linearGradient.y2": 100
      },
      0,
      1,
      null
    )
  };

  return {
    id,
    name: "Blue Planet",
    rootNodeId: "hotelPlanetTwo",
    nodeIds: ["hotelPlanetTwo"],
    nodes,
    roles: ["hotelPlanetTwo", componentRole]
  };
}

function hotelGradientComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const roles = ["actor", "hotelGradient", "figma:5014-46005", componentRole];
  const nodes: Record<string, StudioNode> = {
    hotelGradientFrame: voiceGradientNode(
      "hotelGradientFrame",
      "Gradient",
      "zstack",
      roles,
      764,
      542,
      0,
      0,
      {
        cornerRadius: 0,
        "figma.source.id": "5014:46005",
        "figma.source.type": "GROUP",
        "figma.source.x": 1069,
        "figma.source.y": 2648,
        "figma.source.width": 564,
        "figma.source.height": 342,
        "figma.source.opacity": 0.6000000238418579,
        "figma.source.absoluteBoundingBox.x": 21616,
        "figma.source.absoluteBoundingBox.y": 14702,
        "figma.source.absoluteBoundingBox.width": 564,
        "figma.source.absoluteBoundingBox.height": 342,
        "figma.source.absoluteRenderBounds.x": 21516,
        "figma.source.absoluteRenderBounds.y": 14602,
        "figma.source.absoluteRenderBounds.width": 764,
        "figma.source.absoluteRenderBounds.height": 542
      },
      [],
      0,
      null,
      ["hotelGradientPlanetTwo", "hotelGradientPlanetOne"]
    ),
    hotelGradientPlanetTwo: voiceEllipseNode(
      "hotelGradientPlanetTwo",
      "Planet 2",
      ["hotelGradient", "figma:5014-46006", "native-layer:hotel-planet-2", componentRole],
      686,
      435,
      -39,
      -53.5,
      1,
      [{
        type: "linearGradient",
        angle: 0,
        colors: [
          { color: "#7FDEFF", position: 0, opacity: 0.800000011920929 },
          { color: "#7FDEFF", position: 1, opacity: 1 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 100,
        "shapeBounds.top": 100,
        "shapeBounds.right": 100,
        "shapeBounds.bottom": 100,
        "shapeBounds.left": 100,
        "figmaFilterBox.x": 0,
        "figmaFilterBox.y": 0,
        "figmaFilterBox.width": 686,
        "figmaFilterBox.height": 435,
        "figmaFilterBox.cropX": 0,
        "figmaFilterBox.cropY": 0,
        "figma.source.id": "5014:46006",
        "figma.source.absoluteRenderBounds.x": 21516,
        "figma.source.absoluteRenderBounds.y": 14602,
        "figma.vectorExport.linearGradient.x1": 343,
        "figma.vectorExport.linearGradient.y1": 335,
        "figma.vectorExport.linearGradient.x2": 343,
        "figma.vectorExport.linearGradient.y2": 100
      },
      0,
      1,
      "hotelGradientFrame"
    ),
    hotelGradientPlanetOne: figmaEllipseLayerToFrameZeroNode(figmaHotelPlanetOneLayer, {
      id: "hotelGradientPlanetOne",
      roles: ["hotelGradient", "figma:5014-46007", "native-layer:hotel-planet-1", componentRole],
      parentId: "hotelGradientFrame",
      offsetX: 116,
      offsetY: 12.5
    })
  };
  const frameNode = nodes.hotelGradientFrame;
  if (frameNode) frameNode.presentation.opacity = 0.6000000238418579;

  return {
    id,
    name: "Hotel Full Gradient",
    rootNodeId: "hotelGradientFrame",
    nodeIds: ["hotelGradientFrame", "hotelGradientPlanetTwo", "hotelGradientPlanetOne"],
    nodes,
    roles: ["hotelGradient", componentRole]
  };
}

function hotelActiveGradientComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const frameRoles = ["actor", "hotelActiveGradient", "figma:5013-45996", "figma:4429-181334", componentRole];
  const hotelRoles = ["hotelActiveGradient", "hotelGradient", "figma:4312-238210", "figma:5014-46005", componentRole];
  const nodes: Record<string, StudioNode> = {
    hotelActiveGradientFrame: voiceGradientNode(
      "hotelActiveGradientFrame",
      "Hotel Active Gradient",
      "zstack",
      frameRoles,
      375,
      250,
      0,
      0,
      {
        clip: true,
        cornerRadius: 0,
        "figma.source.id": "5013:45996",
        "figma.variant.id": "4429:181334",
        "figma.variant.type": "xSmall"
      },
      [{
        type: "linearGradient",
        angle: 180,
        colors: [
          { color: "#FFFFFF", position: 0, opacity: 0 },
          { color: "#FFFFFF", position: 0.2, opacity: 0.3 },
          { color: "#FFFFFF", position: 0.35, opacity: 0.7 },
          { color: "#FFFFFF", position: 0.5, opacity: 1 },
          { color: "#FFFFFF", position: 1, opacity: 1 }
        ],
        opacity: 1
      }],
      0,
      null,
      ["hotelActiveGradientSource"]
    ),
    hotelActiveGradientSource: voiceGradientNode(
      "hotelActiveGradientSource",
      "Gradient",
      "zstack",
      hotelRoles,
      764,
      542,
      -38.5,
      121,
      {
        cornerRadius: 0,
        "figma.source.id": "5014:46005",
        "figma.source.wrapper.id": "4312:238210",
        "figma.source.type": "GROUP",
        "figma.source.x": 1069,
        "figma.source.y": 2648,
        "figma.source.width": 564,
        "figma.source.height": 342,
        "figma.source.opacity": 0.6000000238418579,
        "figma.source.absoluteBoundingBox.x": 21616,
        "figma.source.absoluteBoundingBox.y": 14702,
        "figma.source.absoluteBoundingBox.width": 564,
        "figma.source.absoluteBoundingBox.height": 342,
        "figma.source.absoluteRenderBounds.x": 21516,
        "figma.source.absoluteRenderBounds.y": 14602,
        "figma.source.absoluteRenderBounds.width": 764,
        "figma.source.absoluteRenderBounds.height": 542
      },
      [],
      0,
      "hotelActiveGradientFrame",
      ["hotelActivePlanetTwo", "hotelActivePlanetOne"]
    ),
    hotelActivePlanetTwo: voiceEllipseNode(
      "hotelActivePlanetTwo",
      "Planet 2",
      ["hotelActiveGradient", "hotelGradient", "figma:5014-46006", "native-layer:hotel-planet-2", componentRole],
      686,
      435,
      -39,
      -53.5,
      1,
      [{
        type: "linearGradient",
        angle: 0,
        colors: [
          { color: "#7FDEFF", position: 0, opacity: 0.800000011920929 },
          { color: "#7FDEFF", position: 1, opacity: 1 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 100,
        "shapeBounds.top": 100,
        "shapeBounds.right": 100,
        "shapeBounds.bottom": 100,
        "shapeBounds.left": 100,
        "figmaFilterBox.x": 0,
        "figmaFilterBox.y": 0,
        "figmaFilterBox.width": 686,
        "figmaFilterBox.height": 435,
        "figmaFilterBox.cropX": 0,
        "figmaFilterBox.cropY": 0,
        "figma.source.id": "5014:46006",
        "figma.source.absoluteRenderBounds.x": 21516,
        "figma.source.absoluteRenderBounds.y": 14602,
        "figma.vectorExport.linearGradient.x1": 343,
        "figma.vectorExport.linearGradient.y1": 335,
        "figma.vectorExport.linearGradient.x2": 343,
        "figma.vectorExport.linearGradient.y2": 100
      },
      0,
      1,
      "hotelActiveGradientSource"
    ),
    hotelActivePlanetOne: figmaEllipseLayerToFrameZeroNode(figmaHotelPlanetOneLayer, {
      id: "hotelActivePlanetOne",
      roles: ["hotelActiveGradient", "hotelGradient", "figma:5014-46007", "native-layer:hotel-planet-1", componentRole],
      parentId: "hotelActiveGradientSource",
      offsetX: 116,
      offsetY: 12.5
    })
  };
  const sourceNode = nodes.hotelActiveGradientSource;
  if (sourceNode) sourceNode.presentation.opacity = 0.6000000238418579;

  return {
    id,
    name: "Hotel Active Gradient",
    rootNodeId: "hotelActiveGradientFrame",
    nodeIds: ["hotelActiveGradientFrame", "hotelActiveGradientSource", "hotelActivePlanetTwo", "hotelActivePlanetOne"],
    nodes,
    roles: ["hotelActiveGradient", componentRole]
  };
}

function hotelActiveGradientTallComponent(id: string): StudioComponent {
  const componentRole = `component:${id}`;
  const frameRoles = ["actor", "hotelActiveGradientTall", "hotelActiveGradient", "figma:5013-45996", "figma:4429-181334", componentRole];
  const fieldRoles = ["hotelActiveGradientTall", "hotelGradient", "native-layer:hotel-active-500-continuous-field", componentRole];
  const nodes: Record<string, StudioNode> = {
    hotelActiveGradientTallFrame: voiceGradientNode(
      "hotelActiveGradientTallFrame",
      "Hotel Active Gradient 500",
      "zstack",
      frameRoles,
      375,
      500,
      0,
      0,
      {
        clip: true,
        cornerRadius: 0,
        resizePolicy: "locked-375x500",
        compositionPolicy: "continuous-375x500-native-field",
        "figma.source.id": "5013:45996",
        "figma.variant.id": "4429:181334",
        "figma.variant.type": "xSmall"
      },
      [{
        type: "linearGradient",
        angle: 180,
        colors: [
          { color: "#FFFFFF", position: 0, opacity: 0 },
          { color: "#FFFFFF", position: 0.42, opacity: 0.14 },
          { color: "#FFFFFF", position: 0.62, opacity: 0.42 },
          { color: "#FFFFFF", position: 0.75, opacity: 0.78 },
          { color: "#FFFFFF", position: 1, opacity: 1 }
        ],
        opacity: 1
      }],
      0,
      null,
      [
        "hotelActiveTallPlanetTwoField",
        "hotelActiveTallPlanetOneField",
        "hotelActiveTallCyanLowerField",
        "hotelActiveTallPinkLowerField",
        "hotelActiveTallWarmLowerField"
      ]
    ),
    hotelActiveTallPlanetTwoField: voiceEllipseNode(
      "hotelActiveTallPlanetTwoField",
      "Planet 2 Continuous Field",
      [...fieldRoles, "figma:5014-46006", "native-layer:hotel-active-500-planet-2-field"],
      820,
      760,
      -112,
      94,
      0.56,
      [{
        type: "linearGradient",
        angle: 0,
        colors: [
          { color: "#7FDEFF", position: 0, opacity: 0.42 },
          { color: "#7FDEFF", position: 0.58, opacity: 0.26 },
          { color: "#7FDEFF", position: 0.84, opacity: 0.1 },
          { color: "#7FDEFF", position: 1, opacity: 0 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 210,
        "effectBounds.top": 240,
        "effectBounds.right": 240,
        "effectBounds.bottom": 240,
        "effectBounds.left": 240,
        blendMode: "normal",
        resizePolicy: "locked-continuous-field-layer",
        derivationPolicy: "scaled-from-planet-2"
      },
      0,
      1,
      "hotelActiveGradientTallFrame"
    ),
    hotelActiveTallPlanetOneField: voiceEllipseNode(
      "hotelActiveTallPlanetOneField",
      "Planet 1 Continuous Field",
      [...fieldRoles, "figma:5014-46007", "native-layer:hotel-active-500-planet-1-field"],
      650,
      720,
      86,
      150,
      0.46,
      [{
        type: "radialGradient",
        centerX: 0.52,
        centerY: 0.64,
        radius: 420,
        colors: [
          { color: "#FFAA00", position: 0, opacity: 0.24 },
          { color: "#FC790D", position: 0.3, opacity: 0.2 },
          { color: "#FF46D6", position: 0.6, opacity: 0.28 },
          { color: "#B95CFF", position: 0.84, opacity: 0.12 },
          { color: "#B95CFF", position: 1, opacity: 0 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 220,
        "effectBounds.top": 252,
        "effectBounds.right": 252,
        "effectBounds.bottom": 252,
        "effectBounds.left": 252,
        blendMode: "normal",
        resizePolicy: "locked-continuous-field-layer",
        derivationPolicy: "scaled-from-planet-1"
      },
      0,
      1,
      "hotelActiveGradientTallFrame"
    ),
    hotelActiveTallCyanLowerField: voiceEllipseNode(
      "hotelActiveTallCyanLowerField",
      "Cyan Lower Field",
      [...fieldRoles, "figma:5014-46006", "native-layer:hotel-active-500-cyan-lower-field"],
      680,
      420,
      -146,
      174,
      0.32,
      [{
        type: "radialGradient",
        centerX: 0.36,
        centerY: 0.58,
        radius: 350,
        colors: [
          { color: "#7FDEFF", position: 0, opacity: 0.34 },
          { color: "#7FDEFF", position: 0.62, opacity: 0.14 },
          { color: "#7FDEFF", position: 1, opacity: 0 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 170,
        "effectBounds.top": 196,
        "effectBounds.right": 196,
        "effectBounds.bottom": 196,
        "effectBounds.left": 196,
        blendMode: "normal",
        resizePolicy: "locked-continuous-field-layer",
        derivationPolicy: "scaled-from-planet-2"
      },
      0,
      1,
      "hotelActiveGradientTallFrame"
    ),
    hotelActiveTallPinkLowerField: voiceEllipseNode(
      "hotelActiveTallPinkLowerField",
      "Pink Lower Field",
      [...fieldRoles, "figma:5014-46007", "native-layer:hotel-active-500-pink-lower-field"],
      560,
      460,
      90,
      198,
      0.32,
      [{
        type: "radialGradient",
        centerX: 0.48,
        centerY: 0.58,
        radius: 330,
        colors: [
          { color: "#FF46D6", position: 0, opacity: 0.26 },
          { color: "#B95CFF", position: 0.58, opacity: 0.12 },
          { color: "#B95CFF", position: 1, opacity: 0 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 180,
        "effectBounds.top": 204,
        "effectBounds.right": 204,
        "effectBounds.bottom": 204,
        "effectBounds.left": 204,
        blendMode: "normal",
        resizePolicy: "locked-continuous-field-layer",
        derivationPolicy: "scaled-from-planet-1"
      },
      0,
      1,
      "hotelActiveGradientTallFrame"
    ),
    hotelActiveTallWarmLowerField: voiceEllipseNode(
      "hotelActiveTallWarmLowerField",
      "Warm Lower Field",
      [...fieldRoles, "figma:5014-46007", "native-layer:hotel-active-500-warm-lower-field"],
      390,
      310,
      112,
      224,
      0.3,
      [{
        type: "radialGradient",
        centerX: 0.52,
        centerY: 0.62,
        radius: 210,
        colors: [
          { color: "#FFAA00", position: 0, opacity: 0.34 },
          { color: "#FC790D", position: 0.48, opacity: 0.18 },
          { color: "#FC790D", position: 1, opacity: 0 }
        ],
        opacity: 1
      }],
      {
        figmaBlur: 128,
        "effectBounds.top": 152,
        "effectBounds.right": 152,
        "effectBounds.bottom": 152,
        "effectBounds.left": 152,
        blendMode: "normal",
        resizePolicy: "locked-continuous-field-layer",
        colorPolicy: "lower-right-contained",
        derivationPolicy: "scaled-from-planet-1"
      },
      0,
      1,
      "hotelActiveGradientTallFrame"
    )
  };

  return {
    id,
    name: "Hotel Active Gradient 500",
    rootNodeId: "hotelActiveGradientTallFrame",
    nodeIds: [
      "hotelActiveGradientTallFrame",
      "hotelActiveTallPlanetTwoField",
      "hotelActiveTallPlanetOneField",
      "hotelActiveTallCyanLowerField",
      "hotelActiveTallPinkLowerField",
      "hotelActiveTallWarmLowerField"
    ],
    nodes,
    roles: ["hotelActiveGradientTall", componentRole]
  };
}

function voiceGradientNode(
  id: string,
  name: string,
  kind: NodeKindChoice,
  roles: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  style: StudioNode["style"],
  fills: MotionFill[],
  rotation = 0,
  parentId: string | null = null,
  childIds: string[] = []
): StudioNode {
  return {
    id,
    name,
    kind,
    parentId,
    childIds,
    roles,
    layout: { width, height },
    style,
    fills,
    presentation: { "offset.x": x, "offset.y": y, rotation, scale: 1, opacity: 1 }
  };
}

function voiceEllipseNode(
  id: string,
  name: string,
  roles: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  opacity: number,
  fills: MotionFill[],
  styleOverrides: StudioNode["style"] = {},
  rotation = 0,
  scaleY = 1,
  parentId: string | null = "voiceFrame"
): StudioNode {
  const firstSolid = fills.find((fill) => fill.type === "solid");
  const node = voiceGradientNode(
    id,
    name,
    "circle",
    roles,
    width,
    height,
    x,
    y,
    {
      ...(firstSolid?.color !== undefined ? { backgroundColor: firstSolid.color } : {}),
      ...styleOverrides
    },
    fills,
    rotation,
    parentId
  );
  node.presentation.opacity = opacity;
  node.presentation["scale.y"] = scaleY;
  return node;
}

function voiceImageNode(
  id: string,
  name: string,
  roles: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  opacity: number,
  imageUrl: string,
  styleOverrides: StudioNode["style"] = {},
  rotation = 0,
  scaleY = 1,
  parentId = "voiceFrame"
): StudioNode {
  const node = voiceGradientNode(
    id,
    name,
    "image",
    roles,
    width,
    height,
    x,
    y,
    {
      assetPolicy: "locked",
      imageUrl,
      contentMode: "100% 100%",
      ...styleOverrides
    },
    [],
    rotation,
    parentId
  );
  node.presentation.opacity = opacity;
  node.presentation["scale.y"] = scaleY;
  return node;
}

function voicePathNode(
  id: string,
  name: string,
  roles: string[],
  width: number,
  height: number,
  x: number,
  y: number,
  opacity: number,
  fills: MotionFill[],
  styleOverrides: StudioNode["style"] = {},
  rotation = 0,
  scaleY = 1
): StudioNode {
  const firstSolid = fills.find((fill) => fill.type === "solid");
  const node = voiceGradientNode(
    id,
    name,
    "path",
    roles,
    width,
    height,
    x,
    y,
    {
      ...(firstSolid?.color !== undefined ? { backgroundColor: firstSolid.color } : {}),
      pathData: "M 94.1469 34.4752 C 94.1469 53.5153 51.0265 120.0085 25.0298 120.0085 C -0.9669 120.0085 0.0047 53.5153 0.0047 34.4752 C 0.0047 15.4351 21.0792 0 47.0758 0 C 73.0725 0 94.1469 15.4351 94.1469 34.4752 Z",
      viewBoxWidth: 94.147,
      viewBoxHeight: 120.008,
      ...styleOverrides
    },
    fills,
    rotation,
    "voiceFrame"
  );
  node.presentation.opacity = opacity;
  node.presentation["scale.y"] = scaleY;
  return node;
}

function addVoiceGradientPreviewPhases(project: StudioProject) {
  const outId = uniqueId("voiceGradientBreatheOut", project.phases);
  const inId = uniqueId("voiceGradientBreatheIn", { ...project.phases, [outId]: {} as StudioPhase });
  project.phases[outId] = {
    id: outId,
    name: "Voice Gradient Breathe Out",
    mode: "deltaFromPrevious",
    startDelay: 0,
    nextMode: "atTime",
    nextAt: 0.82,
    targets: [
      { select: { role: "voiceGradient", properties: ["scale"] }, value: 0.035 },
      { select: { role: "voiceGradient", properties: ["opacity"] }, value: -0.08 }
    ],
    rules: [
      { select: { role: "voiceGradient", properties: ["scale", "opacity"] }, motion: { type: "spring", response: 0.82, dampingFraction: 0.72 } }
    ],
    arcs: [],
    jiggles: [],
    actions: []
  };
  project.phases[inId] = {
    id: inId,
    name: "Voice Gradient Breathe In",
    mode: "deltaFromPrevious",
    startDelay: 0,
    nextMode: "atTime",
    nextAt: 0.72,
    targets: [
      { select: { role: "voiceGradient", properties: ["scale"] }, value: -0.035 },
      { select: { role: "voiceGradient", properties: ["opacity"] }, value: 0.08 }
    ],
    rules: [
      { select: { role: "voiceGradient", properties: ["scale", "opacity"] }, motion: { type: "spring", response: 0.72, dampingFraction: 0.82 } }
    ],
    arcs: [],
    jiggles: [],
    actions: []
  };
  project.phaseOrder = [outId, inId, ...project.phaseOrder];
  return outId;
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
  if (kind === "image") return "transparent";
  if (fills.length > 0) {
    return cssFill(fills[0]);
  }
  if (kind === "zstack" || kind === "vstack" || kind === "hstack") {
    return typeof style.backgroundColor === "string" ? String(style.backgroundColor) : "transparent";
  }

  const start = String(style.backgroundColor ?? (kind === "text" ? "transparent" : "#5ED8FF"));
  const end = typeof style.gradientEndColor === "string" ? style.gradientEndColor : undefined;
  if (!end) return start;

  const angle = numberValue(style.gradientAngle, 135);
  return `linear-gradient(${angle}deg, ${start}, ${end})`;
}

function imageBackground(style: Record<string, unknown>) {
  const url = typeof style.imageUrl === "string" ? style.imageUrl : undefined;
  if (!url) return undefined;
  return `url("${url}")`;
}

function cssBlendMode(value: unknown): React.CSSProperties["mixBlendMode"] {
  if (value === "screen") return "screen";
  if (value === "colorDodge" || value === "color-dodge") return "color-dodge";
  if (value === "plusLighter" || value === "plus-lighter") return "plus-lighter";
  if (value === "multiply") return "multiply";
  return "normal";
}

function visualEffects(style: Record<string, unknown>, scale = 1) {
  const blur = renderBlur(style) * scale;
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

function renderBlur(style: Record<string, unknown>) {
  if (typeof style.blur === "number") return Math.max(0, style.blur);
  return Math.max(0, numberValue(style.figmaBlur, 0) / 2);
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
  if (fill.type === "radialGradient") {
    const centerX = clamp(fill.centerX ?? 0.5, -1, 2) * 100;
    const centerY = clamp(fill.centerY ?? 0.5, -1, 2) * 100;
    const radius = fill.radius !== undefined ? `${round(fill.radius)}px` : "farthest-side";
    return `radial-gradient(circle ${radius} at ${round(centerX)}% ${round(centerY)}%, ${stops})`;
  }
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
