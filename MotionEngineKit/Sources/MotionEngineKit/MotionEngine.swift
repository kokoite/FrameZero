import Foundation
import SwiftUI
import os

struct MotionChannelKey: Hashable {
    let nodeID: NodeID
    let property: String
}

struct MotionChannel {
    var current: Double
    var velocity: Double
    var target: Double
    var motion: MotionSpec
    var animationStart: Double
    var animationElapsed: Double
}

struct PendingChannelTarget {
    let key: MotionChannelKey
    let target: Double
    let motion: MotionSpec
    var remainingDelay: Double
}

struct MotionViewport: Equatable {
    var width: Double
    var height: Double
    var safeAreaTop: Double
    var safeAreaLeading: Double
    var safeAreaBottom: Double
    var safeAreaTrailing: Double
}

struct MotionArcRuntime {
    let nodeID: NodeID
    let xProperty: String
    let yProperty: String
    let startX: Double
    let startY: Double
    let endX: Double
    let endY: Double
    let bend: Double
    let direction: MotionArcDirection
    var progress: MotionChannel
}

struct MotionJiggleRuntime {
    let key: MotionChannelKey
    let origin: Double
    let amplitude: Double
    let duration: Double
    let cycles: Double
    let startDirection: MotionJiggleDirection
    let decay: Double
    var elapsed: Double
}

struct MotionDragSample {
    let translationX: Double
    let translationY: Double
    let predictedTranslationX: Double
    let predictedTranslationY: Double
}

struct MotionTrailRuntime: Identifiable {
    let id: NodeID
    let anchorX: Double
    let anchorY: Double
    let currentX: Double
    let currentY: Double
    let color: String?
    let opacity: Double
    let charge: Double
    let glowBaseSize: Double
    let glowGrowth: Double
    let glowFillOpacityBase: Double
    let glowFillOpacityRange: Double
    let glowStrokeOpacityBase: Double
    let glowStrokeOpacityRange: Double
    let glowStrokeWidthBase: Double
    let glowStrokeWidthRange: Double
    let glowInnerScale: Double
}

struct MotionTrajectoryPointRuntime: Identifiable {
    let id: String
    let x: Double
    let y: Double
    let color: String?
    let size: Double
    let opacity: Double
}

private struct ScheduledMotionAction {
    let machineID: MachineID
    let action: MotionAction
    var remainingDelay: Double
}

struct MotionScreenShakeRuntime: Identifiable {
    let id: String
    let amplitude: Double
    let duration: Double
    let frequency: Double
    let decay: Double
    var elapsed: Double
}

struct MotionParticleRuntime: Identifiable {
    let id: String
    let kind: MotionNodeKind
    let layout: [String: MotionValue]
    let style: [String: MotionValue]
    let fills: [MotionFill]
    var channels: [String: MotionChannel]
    let lifetime: Double
    var elapsed: Double
}

struct MotionComponentRuntime: Identifiable {
    let id: String
    let kind: MotionNodeKind
    let layout: [String: MotionValue]
    let style: [String: MotionValue]
    let fills: [MotionFill]
    var channels: [String: MotionChannel]
    let lifetime: Double
    var elapsed: Double
}

private struct ActiveSlingshotDrag {
    let nodeID: NodeID
    let binding: MotionDragBinding
    let anchorX: Double
    let anchorY: Double
    var currentX: Double
    var currentY: Double
    var charge: Double
}

private struct ActiveProjectile {
    let nodeID: NodeID
    let radius: Double
    let mass: Double
    let forceX: Double
    let forceY: Double
    let airResistance: Double
    let restitution: Double
    let friction: Double
    let stopSpeed: Double
    let collision: MotionCollisionMode
    var x: Double
    var y: Double
    var velocityX: Double
    var velocityY: Double
    var accelerationX: Double
    var accelerationY: Double
    var collisionCount: Int
    var restingFrames: Int
}

private struct ResolvedPhysicsBody {
    let radius: Double
    let mass: Double
    let airResistance: Double
    let restitution: Double
    let friction: Double
    let stopSpeed: Double
    let collision: MotionCollisionMode
}

private struct ResolvedDragBinding {
    let binding: MotionDragBinding
    let nodeIDs: [NodeID]
}

private enum MotionRuntimeDefaults {
    static let minLaunchPull = 24.0
    static let throwThreshold = 24.0
    static let throwInfluenceWhenFast = 0.22
    static let launchPowerBase = 0.68
    static let launchPowerRange = 0.62
    static let launchPowerExponent = 0.5
    static let chargeStretchX = 0.16
    static let chargeStretchY = -0.08
    static let trailChargeCurve = 0.7
    static let trailOpacityBase = 0.2
    static let trailOpacityRange = 0.75
    static let glowBaseSize = 74.0
    static let glowGrowth = 56.0
    static let glowFillOpacityBase = 0.09
    static let glowFillOpacityRange = 0.14
    static let glowStrokeOpacityBase = 0.22
    static let glowStrokeOpacityRange = 0.34
    static let glowStrokeWidthBase = 2.0
    static let glowStrokeWidthRange = 7.0
    static let glowInnerScale = 0.78
    static let trajectoryPoints = 9
    static let trajectoryStep = 0.12
    static let trajectoryMinStep = 0.016
    static let trajectoryChargeCurve = 0.65
    static let trajectoryPointCountBaseFactor = 0.45
    static let trajectoryPointCountChargeFactor = 0.55
    static let trajectorySizeBase = 5.0
    static let trajectorySizeRange = 6.0
    static let trajectoryMinFade = 0.35
    static let trajectoryOpacityBase = 0.24
    static let trajectoryOpacityRange = 0.7
    static let trajectoryOpacityMinFade = 0.22
    static let snapOffsetSpringResponse = 0.28
    static let snapOffsetSpringDamping = 0.76
    static let snapScaleSpringResponse = 0.24
    static let snapScaleSpringDamping = 0.8
    static let releaseShapeSpringResponse = 0.2
    static let releaseShapeSpringDamping = 0.62
    static let releaseScaleSpringResponse = 0.22
    static let releaseScaleSpringDamping = 0.66
    static let bodyMass = 1.0
    static let bodyAirResistance = 0.7
    static let bodyRestitution = 0.72
    static let bodyFriction = 0.92
    static let bodyStopSpeed = 45.0
    static let gravity = 980.0
    static let fallbackGravity = 900.0
}

private struct EngineSnapshot {
    let document: MotionDocument?
    let errorMessage: String?
    let statusMessage: String
    let nodesByID: [NodeID: MotionNode]
    let parentByID: [NodeID: NodeID]
    let machinesByID: [MachineID: MotionStateMachine]
    let triggersByID: [TriggerID: MotionTrigger]
    let tapTriggerIDsByNodeID: [NodeID: [TriggerID]]
    let dragBindingByNodeID: [NodeID: MotionDragBinding]
    let resolvedDragBindings: [ResolvedDragBinding]
    let bodySpecByNodeID: [NodeID: MotionPhysicsBodySpec]
    let globalForces: [MotionForceSpec]
    let forceSpecsByNodeID: [NodeID: [MotionForceSpec]]
    let currentStates: [MachineID: StateID]
    let stateElapsedByMachine: [MachineID: CFTimeInterval]
    let channels: [MotionChannelKey: MotionChannel]
    let stateTargets: [MotionChannelKey: MotionValue]
    let pendingTargets: [PendingChannelTarget]
    let activeArcs: [MotionArcRuntime]
    let activeJiggles: [MotionJiggleRuntime]
    let scheduledActions: [ScheduledMotionAction]
    let activeScreenShakes: [MotionScreenShakeRuntime]
    let activeParticles: [MotionParticleRuntime]
    let activeComponents: [MotionComponentRuntime]
    let activeSlingshotDrags: [NodeID: ActiveSlingshotDrag]
    let activeProjectiles: [NodeID: ActiveProjectile]
    let activeGlobalDragNodeID: NodeID?
    let idleElapsed: CFTimeInterval
    let viewport: MotionViewport?
    let editableDocumentURL: URL?
    let lastLoadedModificationDate: Date?
    let hotReloadPath: String?
}

@MainActor
public final class MotionEngine {
    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "MotionEngineKit", category: "MotionEngine")

    public var isDebugLoggingEnabled = false

    private(set) var document: MotionDocument?
    public private(set) var errorMessage: String?
    public private(set) var statusMessage: String = "Loading"
    public private(set) var hotReloadPath: String?

    private var nodesByID: [NodeID: MotionNode] = [:]
    private var parentByID: [NodeID: NodeID] = [:]
    private var machinesByID: [MachineID: MotionStateMachine] = [:]
    private var triggersByID: [TriggerID: MotionTrigger] = [:]
    private var tapTriggerIDsByNodeID: [NodeID: [TriggerID]] = [:]
    private var dragBindingByNodeID: [NodeID: MotionDragBinding] = [:]
    private var resolvedDragBindings: [ResolvedDragBinding] = []
    private var bodySpecByNodeID: [NodeID: MotionPhysicsBodySpec] = [:]
    private var globalForces: [MotionForceSpec] = []
    private var forceSpecsByNodeID: [NodeID: [MotionForceSpec]] = [:]
    private var currentStates: [MachineID: StateID] = [:]
    private var stateElapsedByMachine: [MachineID: CFTimeInterval] = [:]
    private var channels: [MotionChannelKey: MotionChannel] = [:]
    private var stateTargets: [MotionChannelKey: MotionValue] = [:]
    private var pendingTargets: [PendingChannelTarget] = []
    private var activeArcs: [MotionArcRuntime] = []
    private var activeJiggles: [MotionJiggleRuntime] = []
    private var scheduledActions: [ScheduledMotionAction] = []
    private var activeScreenShakes: [MotionScreenShakeRuntime] = []
    private var activeParticles: [MotionParticleRuntime] = []
    private var activeComponents: [MotionComponentRuntime] = []
    private var activeSlingshotDrags: [NodeID: ActiveSlingshotDrag] = [:]
    private var activeProjectiles: [NodeID: ActiveProjectile] = [:]
    private var activeGlobalDragNodeID: NodeID?
    private var idleElapsed: CFTimeInterval = 0
    private var viewport: MotionViewport?
    private var editableDocumentURL: URL?
    private var lastLoadedModificationDate: Date?
    private var hapticPerformer: MotionHapticPerformer = DefaultMotionHapticPerformer()

    public init() {}

    func setHapticPerformerForTesting(_ performer: MotionHapticPerformer) {
        hapticPerformer = performer
    }

    public static func phase1Demo() -> MotionEngine {
        let engine = MotionEngine()
        engine.prepareEditablePhase1Document(overwrite: false)
        engine.loadEditableDocument()
        return engine
    }

    public func load(data: Data) throws {
        let decoded = try JSONDecoder().decode(MotionDocument.self, from: data)
        let snapshot = snapshot()

        do {
            try install(decoded)
            editableDocumentURL = nil
            lastLoadedModificationDate = nil
            hotReloadPath = nil
            statusMessage = "Loaded motion document"
        } catch {
            restore(snapshot)
            throw error
        }
    }

    public func load(jsonString: String) throws {
        guard let data = jsonString.data(using: .utf8) else {
            throw MotionRuntimeError.validation("Motion JSON must be valid UTF-8")
        }

        try load(data: data)
    }

    public func load(fileURL: URL, hotReload: Bool = false) throws {
        let data = try Data(contentsOf: fileURL)
        let decoded = try JSONDecoder().decode(MotionDocument.self, from: data)
        let snapshot = snapshot()

        do {
            try install(decoded)

            if hotReload {
                editableDocumentURL = fileURL
                hotReloadPath = fileURL.path
                lastLoadedModificationDate = try fileURL
                    .resourceValues(forKeys: [.contentModificationDateKey])
                    .contentModificationDate
            } else {
                editableDocumentURL = nil
                hotReloadPath = nil
                lastLoadedModificationDate = nil
            }

            statusMessage = "Loaded \(fileURL.lastPathComponent)"
        } catch {
            restore(snapshot)
            throw error
        }
    }

    public func resetPhase1Demo() {
        prepareEditablePhase1Document(overwrite: true)
        loadEditableDocument()
    }

    public func reloadEditableDocumentIfChanged() -> Bool {
        guard let editableDocumentURL else { return false }

        do {
            let modificationDate = try editableDocumentURL
                .resourceValues(forKeys: [.contentModificationDateKey])
                .contentModificationDate
            guard modificationDate != lastLoadedModificationDate else { return false }
            loadEditableDocument()
            return true
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Hot reload failed"
            return true
        }
    }

    func node(_ id: NodeID) -> MotionNode? {
        nodesByID[id]
    }

    func visibleChildren(for node: MotionNode) -> [NodeID] {
        node.children.filter { childID in
            guard let child = nodesByID[childID] else { return false }
            return isNodeVisible(child)
        }
    }

    func number(for nodeID: NodeID, property: String, default defaultValue: Double) -> Double {
        channels[MotionChannelKey(nodeID: nodeID, property: property)]?.current ?? defaultValue
    }

    func layoutNumber(for node: MotionNode, _ property: String) -> Double? {
        node.layout[property].flatMap(resolveNumber)
    }

    func styleString(for node: MotionNode, _ property: String) -> String? {
        node.style[property]?.string
    }

    func styleNumber(for node: MotionNode, _ property: String) -> Double? {
        node.style[property].flatMap(resolveNumber)
    }

    func styleBool(for node: MotionNode, _ property: String) -> Bool {
        node.style[property]?.boolean ?? false
    }

    func updateViewport(size: CGSize, safeAreaInsets: EdgeInsets) {
        let next = MotionViewport(
            width: Double(size.width),
            height: Double(size.height),
            safeAreaTop: Double(safeAreaInsets.top),
            safeAreaLeading: Double(safeAreaInsets.leading),
            safeAreaBottom: Double(safeAreaInsets.bottom),
            safeAreaTrailing: Double(safeAreaInsets.trailing)
        )

        guard viewport != next else { return }
        let shouldSnap = viewport == nil
        viewport = next
        refreshResolvedTargets(snap: shouldSnap)
    }

    func hasTapTrigger(on nodeID: NodeID) -> Bool {
        tapTriggers(for: nodeID).isEmpty == false
    }

    func handleTap(on nodeID: NodeID) {
        let matchingTriggers = tapTriggers(for: nodeID)

        for trigger in matchingTriggers {
            fire(triggerID: trigger.id)
        }
    }

    func hasDragBinding(on nodeID: NodeID) -> Bool {
        dragBinding(for: nodeID) != nil
    }

    func hasAnyDragBinding() -> Bool {
        !(document?.dragBindings.isEmpty ?? true)
    }

    func handleGlobalDragChanged(
        startX: Double,
        startY: Double,
        translationX: Double,
        translationY: Double,
        predictedTranslationX: Double,
        predictedTranslationY: Double
    ) {
        guard let viewport else { return }
        let startEngineX = startX - (viewport.width / 2)
        let startEngineY = startY - (viewport.height / 2)

        if activeGlobalDragNodeID == nil {
            activeGlobalDragNodeID = nearestDragNode(toX: startEngineX, y: startEngineY)
        }

        guard let nodeID = activeGlobalDragNodeID else { return }
        handleDragChanged(on: nodeID, sample: MotionDragSample(
            translationX: translationX,
            translationY: translationY,
            predictedTranslationX: predictedTranslationX,
            predictedTranslationY: predictedTranslationY
        ))
    }

    func handleGlobalDragEnded(
        translationX: Double,
        translationY: Double,
        predictedTranslationX: Double,
        predictedTranslationY: Double
    ) {
        guard let nodeID = activeGlobalDragNodeID else { return }
        handleDragEnded(on: nodeID, sample: MotionDragSample(
            translationX: translationX,
            translationY: translationY,
            predictedTranslationX: predictedTranslationX,
            predictedTranslationY: predictedTranslationY
        ))
        activeGlobalDragNodeID = nil
    }

    func handleDragChanged(on nodeID: NodeID, sample: MotionDragSample) {
        guard let binding = dragBinding(for: nodeID), binding.type == .slingshot else { return }
        activeProjectiles[nodeID] = nil

        let anchor = activeSlingshotDrags[nodeID].map { ($0.anchorX, $0.anchorY) }
            ?? resolveAnchor(for: binding, nodeID: nodeID)
        let maxPull = max(binding.maxPull, 1)
        let rawX = anchor.0 + sample.translationX
        let rawY = anchor.1 + sample.translationY
        let dx = rawX - anchor.0
        let dy = rawY - anchor.1
        let distance = hypot(dx, dy)
        let scale = distance > maxPull ? maxPull / distance : 1
        let currentX = anchor.0 + (dx * scale)
        let currentY = anchor.1 + (dy * scale)
        let charge = min(distance / maxPull, 1)

        activeSlingshotDrags[nodeID] = ActiveSlingshotDrag(
            nodeID: nodeID,
            binding: binding,
            anchorX: anchor.0,
            anchorY: anchor.1,
            currentX: currentX,
            currentY: currentY,
            charge: charge
        )

        setChannel(nodeID: nodeID, property: "offset.x", current: currentX, velocity: 0)
        setChannel(nodeID: nodeID, property: "offset.y", current: currentY, velocity: 0)
        if let chargeScale = binding.chargeScale {
            setChannel(nodeID: nodeID, property: "scale", current: 1 + ((chargeScale - 1) * charge), velocity: 0)
        }
        let feedback = binding.chargeFeedback
        let stretchX = feedback?.stretchX ?? MotionRuntimeDefaults.chargeStretchX
        let stretchY = feedback?.stretchY ?? MotionRuntimeDefaults.chargeStretchY
        setChannel(nodeID: nodeID, property: "scale.x", current: 1 + (stretchX * charge), velocity: 0)
        setChannel(nodeID: nodeID, property: "scale.y", current: 1 + (stretchY * charge), velocity: 0)
    }

    func handleDragEnded(on nodeID: NodeID, sample: MotionDragSample) {
        guard let drag = activeSlingshotDrags[nodeID] else { return }

        let pullX = drag.anchorX - drag.currentX
        let pullY = drag.anchorY - drag.currentY
        let pullDistance = hypot(pullX, pullY)
        let minLaunchPull = drag.binding.minLaunchPull ?? MotionRuntimeDefaults.minLaunchPull

        if pullDistance < minLaunchPull {
            snapNode(nodeID, toX: drag.anchorX, y: drag.anchorY)
            activeSlingshotDrags[nodeID] = nil
            return
        }

        let throwX = sample.predictedTranslationX - sample.translationX
        let throwY = sample.predictedTranslationY - sample.translationY
        let launchPower = drag.binding.launchPower
        let throwPower = drag.binding.throwPower ?? 0
        let throwSpeed = hypot(throwX, throwY)
        let feedback = drag.binding.chargeFeedback
        let throwThreshold = drag.binding.throwThreshold ?? MotionRuntimeDefaults.throwThreshold
        let isThrow = throwSpeed >= throwThreshold
        let pullInfluence = isThrow
            ? feedback?.throwInfluenceWhenFast ?? MotionRuntimeDefaults.throwInfluenceWhenFast
            : 1
        let charge = min(max(pullDistance / max(drag.binding.maxPull, 1), 0), 1)
        let powerCurve = launchPowerMultiplier(for: drag.binding, charge: charge)
        let velocityX = (pullX * launchPower * pullInfluence * powerCurve) + (throwX * throwPower)
        let velocityY = (pullY * launchPower * pullInfluence * powerCurve) + (throwY * throwPower)
        let body = physicsBody(for: nodeID, binding: drag.binding)
        let acceleration = forceAcceleration(for: nodeID, mass: body.mass, fallbackGravity: drag.binding.gravity)

        activeProjectiles[nodeID] = ActiveProjectile(
            nodeID: nodeID,
            radius: body.radius,
            mass: body.mass,
            forceX: acceleration.x,
            forceY: acceleration.y,
            airResistance: body.airResistance,
            restitution: body.restitution,
            friction: body.friction,
            stopSpeed: body.stopSpeed,
            collision: body.collision,
            x: drag.currentX,
            y: drag.currentY,
            velocityX: velocityX,
            velocityY: velocityY,
            accelerationX: 0,
            accelerationY: acceleration.y,
            collisionCount: 0,
            restingFrames: 0
        )
        releaseDragShape(for: nodeID)
        activeSlingshotDrags[nodeID] = nil
    }

    func slingshotTrails() -> [MotionTrailRuntime] {
        activeSlingshotDrags.values.map { drag in
            let trail = drag.binding.trail
            let visualCharge = pow(
                min(max(drag.charge, 0), 1),
                trail?.chargeCurve ?? MotionRuntimeDefaults.trailChargeCurve
            )

            return MotionTrailRuntime(
                id: drag.nodeID,
                anchorX: drag.anchorX,
                anchorY: drag.anchorY,
                currentX: drag.currentX,
                currentY: drag.currentY,
                color: trail?.color,
                opacity: (trail?.opacityBase ?? MotionRuntimeDefaults.trailOpacityBase)
                    + ((trail?.opacityRange ?? MotionRuntimeDefaults.trailOpacityRange) * visualCharge),
                charge: visualCharge,
                glowBaseSize: trail?.glowBaseSize ?? MotionRuntimeDefaults.glowBaseSize,
                glowGrowth: trail?.glowGrowth ?? MotionRuntimeDefaults.glowGrowth,
                glowFillOpacityBase: trail?.glowFillOpacityBase ?? MotionRuntimeDefaults.glowFillOpacityBase,
                glowFillOpacityRange: trail?.glowFillOpacityRange ?? MotionRuntimeDefaults.glowFillOpacityRange,
                glowStrokeOpacityBase: trail?.glowStrokeOpacityBase ?? MotionRuntimeDefaults.glowStrokeOpacityBase,
                glowStrokeOpacityRange: trail?.glowStrokeOpacityRange ?? MotionRuntimeDefaults.glowStrokeOpacityRange,
                glowStrokeWidthBase: trail?.glowStrokeWidthBase ?? MotionRuntimeDefaults.glowStrokeWidthBase,
                glowStrokeWidthRange: trail?.glowStrokeWidthRange ?? MotionRuntimeDefaults.glowStrokeWidthRange,
                glowInnerScale: trail?.glowInnerScale ?? MotionRuntimeDefaults.glowInnerScale
            )
        }
    }

    func slingshotTrajectoryPoints() -> [MotionTrajectoryPointRuntime] {
        activeSlingshotDrags.values.flatMap { drag in
            let spec = drag.binding.trajectory
            let color = spec?.color
            let configuredPointCount = max(spec?.points ?? MotionRuntimeDefaults.trajectoryPoints, 0)
            let charge = pow(
                min(max(drag.charge, 0), 1),
                spec?.chargeCurve ?? MotionRuntimeDefaults.trajectoryChargeCurve
            )
            let pointCountBaseFactor = spec?.pointCountBaseFactor ?? MotionRuntimeDefaults.trajectoryPointCountBaseFactor
            let pointCountChargeFactor = spec?.pointCountChargeFactor ?? MotionRuntimeDefaults.trajectoryPointCountChargeFactor
            let pointCount = max(0, Int((Double(configuredPointCount) * (pointCountBaseFactor + (pointCountChargeFactor * charge))).rounded()))
            let step = max(spec?.step ?? MotionRuntimeDefaults.trajectoryStep, MotionRuntimeDefaults.trajectoryMinStep)
            let powerCurve = launchPowerMultiplier(for: drag.binding, charge: min(max(drag.charge, 0), 1))
            let velocityX = (drag.anchorX - drag.currentX) * drag.binding.launchPower * powerCurve
            let velocityY = (drag.anchorY - drag.currentY) * drag.binding.launchPower * powerCurve
            let body = physicsBody(for: drag.nodeID, binding: drag.binding)
            let acceleration = forceAcceleration(for: drag.nodeID, mass: body.mass, fallbackGravity: drag.binding.gravity)

            return (0..<pointCount).map { index in
                let t = step * Double(index + 1)
                let x = drag.currentX + (velocityX * t) + (0.5 * acceleration.x * t * t)
                let y = drag.currentY + (velocityY * t) + (0.5 * acceleration.y * t * t)
                let fade = 1 - (Double(index) / Double(max(pointCount, 1)))

                return MotionTrajectoryPointRuntime(
                    id: "\(drag.nodeID)-\(index)",
                    x: x,
                    y: y,
                    color: color,
                    size: ((spec?.sizeBase ?? MotionRuntimeDefaults.trajectorySizeBase)
                        + ((spec?.sizeRange ?? MotionRuntimeDefaults.trajectorySizeRange) * charge))
                        * max(fade, spec?.minFade ?? MotionRuntimeDefaults.trajectoryMinFade),
                    opacity: ((spec?.opacityBase ?? MotionRuntimeDefaults.trajectoryOpacityBase)
                        + ((spec?.opacityRange ?? MotionRuntimeDefaults.trajectoryOpacityRange) * charge))
                        * max(fade, spec?.opacityMinFade ?? MotionRuntimeDefaults.trajectoryOpacityMinFade)
                )
            }
        }
    }

    func screenShakeOffset() -> (x: Double, y: Double) {
        activeScreenShakes.reduce(into: (x: 0.0, y: 0.0)) { result, shake in
            let progress = min(max(shake.elapsed / shake.duration, 0), 1)
            let envelope = pow(1 - progress, shake.decay)
            let phase = shake.elapsed * shake.frequency * 2 * Double.pi
            result.x += sin(phase) * shake.amplitude * envelope
            result.y += cos(phase * 1.37) * shake.amplitude * envelope
        }
    }

    func particles() -> [MotionParticleRuntime] {
        activeParticles
    }

    func components() -> [MotionComponentRuntime] {
        activeComponents
    }

    private func tapTriggers(for nodeID: NodeID) -> [MotionTrigger] {
        var currentID: NodeID? = nodeID

        while let id = currentID {
            if let triggerIDs = tapTriggerIDsByNodeID[id], !triggerIDs.isEmpty {
                return triggerIDs.compactMap { triggersByID[$0] }
            }

            currentID = parentByID[id]
        }

        return []
    }

    private func dragBinding(for nodeID: NodeID) -> MotionDragBinding? {
        var currentID: NodeID? = nodeID

        while let id = currentID {
            if let binding = dragBindingByNodeID[id] {
                return binding
            }

            currentID = parentByID[id]
        }

        return nil
    }

    private func nearestDragNode(toX x: Double, y: Double) -> NodeID? {
        var best: (nodeID: NodeID, distance: Double)?

        for resolved in resolvedDragBindings {
            for nodeID in resolved.nodeIDs {
                let centerX = number(for: nodeID, property: "offset.x", default: 0)
                let centerY = number(for: nodeID, property: "offset.y", default: 0)
                let radius = max(resolved.binding.radius ?? projectileRadius(for: nodeID), 44)
                let distance = hypot(x - centerX, y - centerY)
                guard distance <= radius else { continue }

                if best == nil || distance < best!.distance {
                    best = (nodeID, distance)
                }
            }
        }

        return best?.nodeID
    }

    private func resolveAnchor(for binding: MotionDragBinding, nodeID: NodeID) -> (Double, Double) {
        return (
            number(for: nodeID, property: "offset.x", default: 0),
            number(for: nodeID, property: "offset.y", default: 0)
        )
    }

    private func launchPowerMultiplier(for binding: MotionDragBinding, charge: Double) -> Double {
        let feedback = binding.chargeFeedback
        let base = feedback?.launchPowerBase ?? MotionRuntimeDefaults.launchPowerBase
        let range = feedback?.launchPowerRange ?? MotionRuntimeDefaults.launchPowerRange
        let exponent = feedback?.launchPowerExponent ?? MotionRuntimeDefaults.launchPowerExponent
        let curvedCharge = pow(min(max(charge, 0), 1), exponent)

        return base + (range * curvedCharge)
    }

    private func setChannel(nodeID: NodeID, property: String, current: Double, velocity: Double) {
        let key = MotionChannelKey(nodeID: nodeID, property: property)
        var channel = channels[key] ?? MotionChannel(
            current: current,
            velocity: velocity,
            target: current,
            motion: .immediate,
            animationStart: current,
            animationElapsed: 0
        )
        channel.current = current
        channel.target = current
        channel.velocity = velocity
        channel.motion = .immediate
        channel.animationStart = current
        channel.animationElapsed = 0
        channels[key] = channel
    }

    private func snapNode(_ nodeID: NodeID, toX x: Double, y: Double) {
        for (property, target) in [("offset.x", x), ("offset.y", y)] {
            let key = MotionChannelKey(nodeID: nodeID, property: property)
            var channel = channels[key] ?? MotionChannel(
                current: target,
                velocity: 0,
                target: target,
                motion: .immediate,
                animationStart: target,
                animationElapsed: 0
            )
            channel.setTarget(
                target,
                motion: .spring(SpringSpec(
                    type: "spring",
                    response: MotionRuntimeDefaults.snapOffsetSpringResponse,
                    dampingFraction: MotionRuntimeDefaults.snapOffsetSpringDamping
                ))
            )
            channels[key] = channel
        }

        let scaleKey = MotionChannelKey(nodeID: nodeID, property: "scale")
        if var scale = channels[scaleKey] {
            scale.setTarget(1, motion: .spring(SpringSpec(
                type: "spring",
                response: MotionRuntimeDefaults.snapScaleSpringResponse,
                dampingFraction: MotionRuntimeDefaults.snapScaleSpringDamping
            )))
            channels[scaleKey] = scale
        }

        releaseDragShape(for: nodeID)
    }

    private func releaseDragShape(for nodeID: NodeID) {
        for property in ["scale.x", "scale.y"] {
            let key = MotionChannelKey(nodeID: nodeID, property: property)
            var channel = channels[key] ?? MotionChannel(
                current: 1,
                velocity: 0,
                target: 1,
                motion: .immediate,
                animationStart: 1,
                animationElapsed: 0
            )
            channel.setTarget(
                1,
                motion: .spring(SpringSpec(
                    type: "spring",
                    response: MotionRuntimeDefaults.releaseShapeSpringResponse,
                    dampingFraction: MotionRuntimeDefaults.releaseShapeSpringDamping
                ))
            )
            channels[key] = channel
        }

        let scaleKey = MotionChannelKey(nodeID: nodeID, property: "scale")
        if var scale = channels[scaleKey] {
            scale.setTarget(1, motion: .spring(SpringSpec(
                type: "spring",
                response: MotionRuntimeDefaults.releaseScaleSpringResponse,
                dampingFraction: MotionRuntimeDefaults.releaseScaleSpringDamping
            )))
            channels[scaleKey] = scale
        }
    }

    private func projectileRadius(for nodeID: NodeID) -> Double {
        guard let node = nodesByID[nodeID] else { return 30 }
        return (layoutNumber(for: node, "width") ?? 60) / 2
    }

    private func physicsBody(for nodeID: NodeID, binding: MotionDragBinding) -> ResolvedPhysicsBody {
        let spec = physicsBodySpec(for: nodeID)

        return ResolvedPhysicsBody(
            radius: binding.radius ?? spec?.radius ?? projectileRadius(for: nodeID),
            mass: max(spec?.mass ?? MotionRuntimeDefaults.bodyMass, 0.001),
            airResistance: binding.airResistance ?? spec?.airResistance ?? MotionRuntimeDefaults.bodyAirResistance,
            restitution: binding.restitution ?? spec?.restitution ?? MotionRuntimeDefaults.bodyRestitution,
            friction: binding.friction ?? spec?.friction ?? MotionRuntimeDefaults.bodyFriction,
            stopSpeed: binding.stopSpeed ?? spec?.stopSpeed ?? MotionRuntimeDefaults.bodyStopSpeed,
            collision: spec?.collision ?? .screenBounds
        )
    }

    private func physicsBodySpec(for nodeID: NodeID) -> MotionPhysicsBodySpec? {
        var currentID: NodeID? = nodeID

        while let id = currentID {
            if let spec = bodySpecByNodeID[id] {
                return spec
            }

            currentID = parentByID[id]
        }

        return nil
    }

    private func forceAcceleration(
        for nodeID: NodeID,
        mass: Double,
        fallbackGravity: Double?
    ) -> (x: Double, y: Double) {
        var accelerationX = 0.0
        var accelerationY = 0.0
        var hasGravity = false

        for force in resolvedForces(for: nodeID) {
            switch force.type {
            case .gravity:
                accelerationX += force.x ?? 0
                accelerationY += force.y ?? MotionRuntimeDefaults.gravity
                hasGravity = true
            case .wind, .constant:
                accelerationX += (force.x ?? 0) / max(mass, 0.001)
                accelerationY += (force.y ?? 0) / max(mass, 0.001)
            }
        }

        if !hasGravity {
            accelerationY += fallbackGravity ?? MotionRuntimeDefaults.fallbackGravity
        }

        return (accelerationX, accelerationY)
    }

    private func resolvedForces(for nodeID: NodeID) -> [MotionForceSpec] {
        var forces = globalForces
        var currentID: NodeID? = nodeID

        while let id = currentID {
            if let scoped = forceSpecsByNodeID[id] {
                forces.append(contentsOf: scoped)
            }

            currentID = parentByID[id]
        }

        return forces
    }

    private func prepareEditablePhase1Document(overwrite: Bool) {
        do {
            guard let bundledURL = Bundle.main.url(forResource: "Phase1Card", withExtension: "motion.json") else {
                throw MotionRuntimeError.validation("Missing bundled document Phase1Card.motion.json")
            }
            let documentsURL = try FileManager.default.url(
                for: .documentDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            let editableURL = documentsURL.appendingPathComponent("Phase1Card.motion.json")

            if overwrite || !FileManager.default.fileExists(atPath: editableURL.path) {
                if FileManager.default.fileExists(atPath: editableURL.path) {
                    try FileManager.default.removeItem(at: editableURL)
                }
                try FileManager.default.copyItem(at: bundledURL, to: editableURL)
            }

            editableDocumentURL = editableURL
            hotReloadPath = editableURL.path
        } catch {
            errorMessage = error.localizedDescription
            statusMessage = "Could not prepare hot reload file"
        }
    }

    private func loadEditableDocument() {
        guard let editableDocumentURL else {
            errorMessage = "No editable document URL"
            statusMessage = "Hot reload unavailable"
            return
        }

        let snapshot = snapshot()

        do {
            let data = try Data(contentsOf: editableDocumentURL)
            let decoded = try JSONDecoder().decode(MotionDocument.self, from: data)
            try install(decoded)
            lastLoadedModificationDate = try editableDocumentURL
                .resourceValues(forKeys: [.contentModificationDateKey])
                .contentModificationDate
            statusMessage = "Loaded \(editableDocumentURL.lastPathComponent)"
        } catch {
            restore(snapshot)
            errorMessage = error.localizedDescription
            statusMessage = "Hot reload failed"
        }
    }

    private func snapshot() -> EngineSnapshot {
        EngineSnapshot(
            document: document,
            errorMessage: errorMessage,
            statusMessage: statusMessage,
            nodesByID: nodesByID,
            parentByID: parentByID,
            machinesByID: machinesByID,
            triggersByID: triggersByID,
            tapTriggerIDsByNodeID: tapTriggerIDsByNodeID,
            dragBindingByNodeID: dragBindingByNodeID,
            resolvedDragBindings: resolvedDragBindings,
            bodySpecByNodeID: bodySpecByNodeID,
            globalForces: globalForces,
            forceSpecsByNodeID: forceSpecsByNodeID,
            currentStates: currentStates,
            stateElapsedByMachine: stateElapsedByMachine,
            channels: channels,
            stateTargets: stateTargets,
            pendingTargets: pendingTargets,
            activeArcs: activeArcs,
            activeJiggles: activeJiggles,
            scheduledActions: scheduledActions,
            activeScreenShakes: activeScreenShakes,
            activeParticles: activeParticles,
            activeComponents: activeComponents,
            activeSlingshotDrags: activeSlingshotDrags,
            activeProjectiles: activeProjectiles,
            activeGlobalDragNodeID: activeGlobalDragNodeID,
            idleElapsed: idleElapsed,
            viewport: viewport,
            editableDocumentURL: editableDocumentURL,
            lastLoadedModificationDate: lastLoadedModificationDate,
            hotReloadPath: hotReloadPath
        )
    }

    private func restore(_ snapshot: EngineSnapshot) {
        document = snapshot.document
        errorMessage = snapshot.errorMessage
        statusMessage = snapshot.statusMessage
        nodesByID = snapshot.nodesByID
        parentByID = snapshot.parentByID
        machinesByID = snapshot.machinesByID
        triggersByID = snapshot.triggersByID
        tapTriggerIDsByNodeID = snapshot.tapTriggerIDsByNodeID
        dragBindingByNodeID = snapshot.dragBindingByNodeID
        resolvedDragBindings = snapshot.resolvedDragBindings
        bodySpecByNodeID = snapshot.bodySpecByNodeID
        globalForces = snapshot.globalForces
        forceSpecsByNodeID = snapshot.forceSpecsByNodeID
        currentStates = snapshot.currentStates
        stateElapsedByMachine = snapshot.stateElapsedByMachine
        channels = snapshot.channels
        stateTargets = snapshot.stateTargets
        pendingTargets = snapshot.pendingTargets
        activeArcs = snapshot.activeArcs
        activeJiggles = snapshot.activeJiggles
        scheduledActions = snapshot.scheduledActions
        activeScreenShakes = snapshot.activeScreenShakes
        activeParticles = snapshot.activeParticles
        activeComponents = snapshot.activeComponents
        activeSlingshotDrags = snapshot.activeSlingshotDrags
        activeProjectiles = snapshot.activeProjectiles
        activeGlobalDragNodeID = snapshot.activeGlobalDragNodeID
        idleElapsed = snapshot.idleElapsed
        viewport = snapshot.viewport
        editableDocumentURL = snapshot.editableDocumentURL
        lastLoadedModificationDate = snapshot.lastLoadedModificationDate
        hotReloadPath = snapshot.hotReloadPath
    }

    private func install(_ document: MotionDocument) throws {
        guard document.schemaVersion == 1 else {
            throw MotionRuntimeError.validation("Unsupported schema version \(document.schemaVersion)")
        }

        try validateUnique(document.nodes.map(\.id), label: "Node IDs")
        try validateUnique(document.machines.map(\.id), label: "Machine IDs")
        try validateUnique(document.triggers.map(\.id), label: "Trigger IDs")
        try validateUnique(document.dragBindings.map(\.id), label: "Drag binding IDs")
        try validateUnique(document.bodies.map(\.id), label: "Physics body IDs")
        try validateUnique(document.forces.map(\.id), label: "Force IDs")

        let nodePairs = document.nodes.map { ($0.id, $0) }
        nodesByID = Dictionary(uniqueKeysWithValues: nodePairs)
        parentByID = [:]
        guard nodesByID[document.root] != nil else {
            throw MotionRuntimeError.validation("Root node '\(document.root)' does not exist")
        }

        for node in document.nodes {
            try validateFiniteNumbers(in: node.layout, context: "layout for node '\(node.id)'")
            try validateFiniteNumbers(in: node.style, context: "style for node '\(node.id)'")
            try validateNodeStyle(node)
            try validateFiniteNumbers(in: node.presentation, context: "presentation for node '\(node.id)'")

            for childID in node.children where nodesByID[childID] == nil {
                throw MotionRuntimeError.validation("Node '\(node.id)' references missing child '\(childID)'")
            }
            for childID in node.children {
                if let existingParent = parentByID[childID] {
                    throw MotionRuntimeError.validation("Node '\(childID)' is listed as a child of both '\(existingParent)' and '\(node.id)'")
                }
                parentByID[childID] = node.id
            }
        }
        try validateTree(rootID: document.root)

        machinesByID = Dictionary(uniqueKeysWithValues: document.machines.map { ($0.id, $0) })
        triggersByID = Dictionary(uniqueKeysWithValues: document.triggers.map { ($0.id, $0) })
        tapTriggerIDsByNodeID = [:]
        dragBindingByNodeID = [:]
        resolvedDragBindings = []
        bodySpecByNodeID = [:]
        globalForces = []
        forceSpecsByNodeID = [:]

        for trigger in document.triggers {
            switch trigger.type {
            case .tap:
                guard let selector = trigger.selector else {
                    throw MotionRuntimeError.validation("Tap trigger '\(trigger.id)' must include a selector")
                }
                try validateNodeSelector(selector, context: "trigger '\(trigger.id)'")
            case .automatic:
                if trigger.selector != nil {
                    throw MotionRuntimeError.validation("Automatic trigger '\(trigger.id)' must not include a selector")
                }
            case .after:
                if trigger.selector != nil {
                    throw MotionRuntimeError.validation("After trigger '\(trigger.id)' must not include a selector")
                }
            }
        }

        for binding in document.dragBindings {
            try validateDragBinding(binding)
        }

        for body in document.bodies {
            try validatePhysicsBody(body)
        }

        for force in document.forces {
            try validateForce(force)
        }

        try compileRuntimeIndexes(document)

        currentStates = [:]
        stateElapsedByMachine = [:]
        channels = [:]
        stateTargets = [:]
        pendingTargets = []
        activeArcs = []
        activeJiggles = []
        scheduledActions = []
        activeScreenShakes = []
        activeParticles = []
        activeComponents = []
        activeSlingshotDrags = [:]
        activeProjectiles = [:]
        activeGlobalDragNodeID = nil
        idleElapsed = 0

        for node in document.nodes {
            for (property, value) in node.presentation {
                if let number = resolveNumber(value) {
                    channels[MotionChannelKey(nodeID: node.id, property: property)] = MotionChannel(
                        current: number,
                        velocity: 0,
                        target: number,
                        motion: .immediate,
                        animationStart: number,
                        animationElapsed: 0
                    )
                }
            }
        }

        for machine in document.machines {
            try validateUnique(machine.states.map(\.id), label: "State IDs in machine '\(machine.id)'")
            let stateIDs = Set(machine.states.map(\.id))
            guard stateIDs.contains(machine.initial) else {
                throw MotionRuntimeError.validation("Machine '\(machine.id)' initial state is missing")
            }

            for state in machine.states {
                try validateState(state, machineID: machine.id)
            }
            try validateTransitions(machine)
            currentStates[machine.id] = machine.initial
            stateElapsedByMachine[machine.id] = 0
            try applyState(machineID: machine.id, stateID: machine.initial, transition: nil, snap: true)
        }

        self.document = document
        errorMessage = nil
    }

    private func validateTransitions(_ machine: MotionStateMachine) throws {
        let stateIDs = Set(machine.states.map(\.id))
        try validateUnique(machine.transitions.map(\.id), label: "Transition IDs in machine '\(machine.id)'")

        var edges: Set<String> = []
        for transition in machine.transitions {
            guard stateIDs.contains(transition.from), stateIDs.contains(transition.to) else {
                throw MotionRuntimeError.validation("Transition '\(transition.id)' references a missing state")
            }
            guard triggersByID[transition.trigger] != nil else {
                throw MotionRuntimeError.validation("Transition '\(transition.id)' references missing trigger '\(transition.trigger)'")
            }
            let edgeKey = "\(transition.from)|\(transition.trigger)"
            guard !edges.contains(edgeKey) else {
                throw MotionRuntimeError.validation("Multiple transitions match state '\(transition.from)' and trigger '\(transition.trigger)'")
            }
            edges.insert(edgeKey)

            for rule in transition.rules {
                _ = try resolve(rule.select)
                try validateMotion(rule.motion, context: "transition '\(transition.id)'")
                if let delay = rule.delay, (!delay.isFinite || delay < 0) {
                    throw MotionRuntimeError.validation("Rule delay must be finite and non-negative in transition '\(transition.id)'")
                }
            }

            if let delay = transition.delay, (!delay.isFinite || delay < 0) {
                throw MotionRuntimeError.validation("Transition '\(transition.id)' delay must be finite and non-negative")
            }

            for arc in transition.arcs {
                try validateNodeSelector(arc.select, context: "arc in transition '\(transition.id)'")
                try validateArc(arc, context: "transition '\(transition.id)'")
                try validateMotion(arc.motion, context: "arc in transition '\(transition.id)'")
            }

            for jiggle in transition.jiggles {
                _ = try resolve(jiggle.select)
                try validateJiggle(jiggle, context: "transition '\(transition.id)'")
            }

            for action in transition.actions {
                try validateAction(action, context: "transition '\(transition.id)'")
            }
        }
    }

    private func validateAction(_ action: MotionAction, context: String) throws {
        switch action {
        case let .sequence(group), let .parallel(group):
            for child in group.actions {
                try validateAction(child, context: context)
            }
        case let .delay(delay):
            guard delay.duration.isFinite, delay.duration >= 0 else {
                throw MotionRuntimeError.validation("Action delay duration must be finite and non-negative in \(context)")
            }
        case let .haptic(haptic):
            if let intensity = haptic.intensity, (!intensity.isFinite || intensity < 0 || intensity > 1) {
                throw MotionRuntimeError.validation("Haptic intensity must be between 0 and 1 in \(context)")
            }
        case let .screenShake(shake):
            guard shake.duration.isFinite, shake.duration > 0 else {
                throw MotionRuntimeError.validation("Screen shake duration must be positive and finite in \(context)")
            }
            guard shake.amplitude.isFinite, shake.amplitude >= 0 else {
                throw MotionRuntimeError.validation("Screen shake amplitude must be finite and non-negative in \(context)")
            }
            if let frequency = shake.frequency, (!frequency.isFinite || frequency < 0) {
                throw MotionRuntimeError.validation("Screen shake frequency must be finite and non-negative in \(context)")
            }
            if let decay = shake.decay, (!decay.isFinite || decay < 0) {
                throw MotionRuntimeError.validation("Screen shake decay must be finite and non-negative in \(context)")
            }
        case let .emitParticles(emission):
            if let selector = emission.selector {
                try validateNodeSelector(selector, context: "particle action '\(emission.id)' in \(context)")
                let matchCount = try resolveNodeIDs(selector).count
                guard matchCount <= MotionActionLimits.maxParticleSelectorMatches else {
                    throw MotionRuntimeError.validation("Particle action '\(emission.id)' selector matches \(matchCount) nodes; max is \(MotionActionLimits.maxParticleSelectorMatches) in \(context)")
                }
            }
            guard emission.count > 0 else {
                throw MotionRuntimeError.validation("Particle action '\(emission.id)' count must be greater than zero in \(context)")
            }
            guard emission.count <= MotionActionLimits.maxParticlesPerEmission else {
                throw MotionRuntimeError.validation("Particle action '\(emission.id)' count must be <= \(MotionActionLimits.maxParticlesPerEmission) in \(context)")
            }
            if let duration = emission.duration, (!duration.isFinite || duration < 0) {
                throw MotionRuntimeError.validation("Particle action '\(emission.id)' duration must be finite and non-negative in \(context)")
            }
            try validateParticleSpec(emission.particle, context: "particle action '\(emission.id)' in \(context)")
        case let .spawnComponents(spawn):
            if let selector = spawn.selector {
                try validateNodeSelector(selector, context: "component action '\(spawn.id)' in \(context)")
                let matchCount = try resolveNodeIDs(selector).count
                guard matchCount <= MotionActionLimits.maxParticleSelectorMatches else {
                    throw MotionRuntimeError.validation("Component action '\(spawn.id)' selector matches \(matchCount) nodes; max is \(MotionActionLimits.maxParticleSelectorMatches) in \(context)")
                }
            }
            guard spawn.components.count <= MotionActionLimits.maxComponentsPerSpawn else {
                throw MotionRuntimeError.validation("Component action '\(spawn.id)' must contain <= \(MotionActionLimits.maxComponentsPerSpawn) components in \(context)")
            }
            for component in spawn.components {
                try validateComponentSpec(component, context: "component '\(component.id)' in action '\(spawn.id)' in \(context)")
            }
        }
    }

    private func validateParticleSpec(_ particle: MotionParticleSpec, context: String) throws {
        try validateFiniteNumbers(in: particle.layout, context: "particle layout for \(context)")
        try validateFiniteNumbers(in: particle.style, context: "particle style for \(context)")
        try validateFiniteNumbers(in: particle.from, context: "particle from values for \(context)")
        try validateFiniteNumbers(in: particle.to, context: "particle to values for \(context)")
        try validateFills(particle.fills, context: "particle fills for \(context)")
        try validateImageAssetPolicy(kind: particle.kind, style: particle.style, context: "particle for \(context)")

        for key in ["backgroundColor", "gradientEndColor"] where particle.style[key] != nil {
            guard let value = particle.style[key]?.string, MotionRenderStyle.isValidHexColor(value) else {
                throw MotionRuntimeError.validation("Particle style '\(key)' for \(context) must be a 6-digit hex color")
            }
        }

        try validateParticleKeys(particle, context: context)

        guard particle.lifetime.isFinite, particle.lifetime > 0 else {
            throw MotionRuntimeError.validation("Particle lifetime must be positive and finite in \(context)")
        }
        try validateMotion(particle.motion, context: context)
    }

    private func validateParticleKeys(_ particle: MotionParticleSpec, context: String) throws {
        try requireKeys(
            particle.layout,
            areIn: ["width", "height"],
            label: "particle layout",
            context: context
        )
        try requireKeys(
            particle.style,
            areIn: ["backgroundColor", "gradientEndColor", "gradientAngle", "cornerRadius", "assetPolicy", "imageUrl", "contentMode", "blendMode"],
            label: "particle style",
            context: context
        )
        try requireKeys(
            particle.from,
            areIn: ["offset.x", "offset.y", "scale", "scale.x", "scale.y", "rotation", "opacity"],
            label: "particle from",
            context: context
        )
        try requireKeys(
            particle.to,
            areIn: ["offset.x", "offset.y", "scale", "scale.x", "scale.y", "rotation", "opacity"],
            label: "particle to",
            context: context
        )

        for key in particle.layout.keys {
            guard particle.layout[key]?.number != nil else {
                throw MotionRuntimeError.validation("Particle layout '\(key)' for \(context) must be a number")
            }
        }

        if let cornerRadius = particle.style["cornerRadius"], cornerRadius.number == nil {
            throw MotionRuntimeError.validation("Particle style 'cornerRadius' for \(context) must be a number")
        }

        if let gradientAngle = particle.style["gradientAngle"], gradientAngle.number == nil {
            throw MotionRuntimeError.validation("Particle style 'gradientAngle' for \(context) must be a number")
        }
    }

    private func validateComponentSpec(_ component: MotionComponentSpec, context: String) throws {
        try validateFiniteNumbers(in: component.layout, context: "component layout for \(context)")
        try validateFiniteNumbers(in: component.style, context: "component style for \(context)")
        try validateFiniteNumbers(in: component.from, context: "component from values for \(context)")
        try validateFiniteNumbers(in: component.to, context: "component to values for \(context)")
        try validateFills(component.fills, context: "component fills for \(context)")
        try validateImageAssetPolicy(kind: component.kind, style: component.style, context: "component for \(context)")

        for key in ["backgroundColor", "foregroundColor", "gradientEndColor"] where component.style[key] != nil {
            guard let value = component.style[key]?.string, MotionRenderStyle.isValidHexColor(value) else {
                throw MotionRuntimeError.validation("Component style '\(key)' for \(context) must be a 6-digit hex color")
            }
        }

        try requireKeys(
            component.layout,
            areIn: ["width", "height", "padding"],
            label: "component layout",
            context: context
        )
        try requireKeys(
            component.style,
            areIn: ["backgroundColor", "gradientEndColor", "gradientAngle", "foregroundColor", "cornerRadius", "text", "font", "assetPolicy", "imageUrl", "contentMode", "blendMode"],
            label: "component style",
            context: context
        )
        try requireKeys(
            component.from,
            areIn: ["offset.x", "offset.y", "scale", "scale.x", "scale.y", "rotation", "opacity"],
            label: "component from",
            context: context
        )
        try requireKeys(
            component.to,
            areIn: ["offset.x", "offset.y", "scale", "scale.x", "scale.y", "rotation", "opacity"],
            label: "component to",
            context: context
        )

        for key in ["width", "height", "padding"] where component.layout[key] != nil {
            guard component.layout[key]?.number != nil else {
                throw MotionRuntimeError.validation("Component layout '\(key)' for \(context) must be a number")
            }
        }

        if let cornerRadius = component.style["cornerRadius"], cornerRadius.number == nil {
            throw MotionRuntimeError.validation("Component style 'cornerRadius' for \(context) must be a number")
        }

        if let gradientAngle = component.style["gradientAngle"], gradientAngle.number == nil {
            throw MotionRuntimeError.validation("Component style 'gradientAngle' for \(context) must be a number")
        }

        guard component.lifetime.isFinite, component.lifetime > 0 else {
            throw MotionRuntimeError.validation("Component lifetime must be positive and finite in \(context)")
        }
        try validateMotion(component.motion, context: context)
    }

    private func requireKeys(
        _ values: [String: MotionValue],
        areIn supportedKeys: Set<String>,
        label: String,
        context: String
    ) throws {
        for key in values.keys where !supportedKeys.contains(key) {
            throw MotionRuntimeError.validation("Unsupported \(label) key '\(key)' for \(context)")
        }
    }

    private func validateState(_ state: MotionVisualState, machineID: MachineID) throws {
        var assignedKeys: Set<MotionChannelKey> = []

        for assignment in state.values {
            try validateNumericValue(assignment.value, context: "state '\(state.id)'")

            let keys = try resolve(assignment.select)
            for key in keys {
                guard !assignedKeys.contains(key) else {
                    throw MotionRuntimeError.validation("Duplicate assignment for \(key.nodeID).\(key.property) in state '\(state.id)' of machine '\(machineID)'")
                }
                assignedKeys.insert(key)
            }
        }
    }

    private func validateMotion(_ motion: MotionSpec, context: String) throws {
        switch motion {
        case .immediate:
            return
        case let .spring(spec):
            guard spec.response.isFinite, spec.response > 0 else {
                throw MotionRuntimeError.validation("Spring response must be positive and finite in \(context)")
            }
            guard spec.dampingFraction.isFinite, spec.dampingFraction >= 0 else {
                throw MotionRuntimeError.validation("Spring dampingFraction must be finite and non-negative in \(context)")
            }
        case let .timed(spec):
            guard spec.duration.isFinite, spec.duration > 0 else {
                throw MotionRuntimeError.validation("Timed duration must be positive and finite in \(context)")
            }
        }
    }

    private func validateNodeSelector(_ selector: MotionNodeSelector, context: String) throws {
        let selectedModes = [selector.id != nil, selector.role != nil].filter { $0 }.count
        guard selectedModes == 1 else {
            throw MotionRuntimeError.validation("Node selector in \(context) must include exactly one of id or role")
        }

        if let id = selector.id {
            guard nodesByID[id] != nil else {
                throw MotionRuntimeError.validation("Node selector in \(context) references missing node '\(id)'")
            }
            return
        }

        if let role = selector.role {
            let matches = nodesByID.values.filter { $0.roles.contains(role) }
            guard !matches.isEmpty else {
                throw MotionRuntimeError.validation("Node selector in \(context) references unmatched role '\(role)'")
            }
            return
        }

        throw MotionRuntimeError.validation("Node selector in \(context) must include id or role")
    }

    private func validateArc(_ arc: MotionArcRule, context: String) throws {
        guard !arc.x.isEmpty, !arc.y.isEmpty else {
            throw MotionRuntimeError.validation("Arc in \(context) must include x and y properties")
        }

        if let bend = arc.bend, (!bend.isFinite || bend < 0) {
            throw MotionRuntimeError.validation("Arc bend must be finite and non-negative in \(context)")
        }
    }

    private func validateJiggle(_ jiggle: MotionJiggleRule, context: String) throws {
        try validateNumericValue(jiggle.amplitude, context: "jiggle amplitude in \(context)")

        guard jiggle.duration.isFinite, jiggle.duration > 0 else {
            throw MotionRuntimeError.validation("Jiggle duration must be positive and finite in \(context)")
        }

        guard jiggle.cycles.isFinite, jiggle.cycles > 0 else {
            throw MotionRuntimeError.validation("Jiggle cycles must be positive and finite in \(context)")
        }

        if let decay = jiggle.decay, (!decay.isFinite || decay < 0 || decay > 1) {
            throw MotionRuntimeError.validation("Jiggle decay must be between 0 and 1 in \(context)")
        }
    }

    private func validateDragBinding(_ binding: MotionDragBinding) throws {
        try validateNodeSelector(binding.selector, context: "drag binding '\(binding.id)'")

        guard binding.maxPull.isFinite, binding.maxPull > 0 else {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' maxPull must be positive and finite")
        }

        if let minLaunchPull = binding.minLaunchPull, (!minLaunchPull.isFinite || minLaunchPull < 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' minLaunchPull must be finite and non-negative")
        }

        guard binding.launchPower.isFinite, binding.launchPower >= 0 else {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' launchPower must be finite and non-negative")
        }

        if let anchor = binding.anchor {
            try validateNumericValue(anchor.x, context: "drag binding '\(binding.id)' anchor.x")
            try validateNumericValue(anchor.y, context: "drag binding '\(binding.id)' anchor.y")
        }

        if let throwPower = binding.throwPower, (!throwPower.isFinite || throwPower < 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' throwPower must be finite and non-negative")
        }

        if let gravity = binding.gravity, !gravity.isFinite {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' gravity must be finite")
        }

        if let airResistance = binding.airResistance, (!airResistance.isFinite || airResistance < 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' airResistance must be finite and non-negative")
        }

        if let restitution = binding.restitution, (!restitution.isFinite || restitution < 0 || restitution > 1) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' restitution must be between 0 and 1")
        }

        if let friction = binding.friction, (!friction.isFinite || friction < 0 || friction > 1) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' friction must be between 0 and 1")
        }

        if let stopSpeed = binding.stopSpeed, (!stopSpeed.isFinite || stopSpeed < 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' stopSpeed must be finite and non-negative")
        }

        if let throwThreshold = binding.throwThreshold, (!throwThreshold.isFinite || throwThreshold < 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' throwThreshold must be finite and non-negative")
        }

        if let radius = binding.radius, (!radius.isFinite || radius <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' radius must be positive and finite")
        }

        if let chargeScale = binding.chargeScale, (!chargeScale.isFinite || chargeScale <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' chargeScale must be positive and finite")
        }

        try validateChargeFeedback(binding.chargeFeedback, bindingID: binding.id)

        if let width = binding.trail?.width, (!width.isFinite || width <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' trail width must be positive and finite")
        }

        if let maxWidth = binding.trail?.maxWidth, (!maxWidth.isFinite || maxWidth <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' trail maxWidth must be positive and finite")
        }

        if let forkSpacing = binding.trail?.forkSpacing, (!forkSpacing.isFinite || forkSpacing <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' trail forkSpacing must be positive and finite")
        }

        try validateTrail(binding.trail, bindingID: binding.id)

        if let points = binding.trajectory?.points, points < 0 {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' trajectory points must be non-negative")
        }

        if let step = binding.trajectory?.step, (!step.isFinite || step <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(binding.id)' trajectory step must be positive and finite")
        }

        try validateTrajectory(binding.trajectory, bindingID: binding.id)
    }

    private func validateChargeFeedback(_ feedback: MotionChargeFeedbackSpec?, bindingID: String) throws {
        guard let feedback else { return }

        try validateOptionalFinite(feedback.stretchX, "chargeFeedback.stretchX", bindingID: bindingID)
        try validateOptionalFinite(feedback.stretchY, "chargeFeedback.stretchY", bindingID: bindingID)
        try validateOptionalFinite(feedback.launchPowerBase, "chargeFeedback.launchPowerBase", bindingID: bindingID)
        try validateOptionalFinite(feedback.launchPowerRange, "chargeFeedback.launchPowerRange", bindingID: bindingID)
        try validateOptionalPositive(feedback.launchPowerExponent, "chargeFeedback.launchPowerExponent", bindingID: bindingID)
        try validateOptionalFinite(feedback.throwInfluenceWhenFast, "chargeFeedback.throwInfluenceWhenFast", bindingID: bindingID)
    }

    private func validateTrail(_ trail: MotionTrailSpec?, bindingID: String) throws {
        guard let trail else { return }

        try validateOptionalColor(trail.color, "trail.color", bindingID: bindingID)
        try validateOptionalPositive(trail.chargeCurve, "trail.chargeCurve", bindingID: bindingID)
        try validateOptionalFinite(trail.opacityBase, "trail.opacityBase", bindingID: bindingID)
        try validateOptionalFinite(trail.opacityRange, "trail.opacityRange", bindingID: bindingID)
        try validateOptionalPositive(trail.glowBaseSize, "trail.glowBaseSize", bindingID: bindingID)
        try validateOptionalFinite(trail.glowGrowth, "trail.glowGrowth", bindingID: bindingID)
        try validateOptionalFinite(trail.glowFillOpacityBase, "trail.glowFillOpacityBase", bindingID: bindingID)
        try validateOptionalFinite(trail.glowFillOpacityRange, "trail.glowFillOpacityRange", bindingID: bindingID)
        try validateOptionalFinite(trail.glowStrokeOpacityBase, "trail.glowStrokeOpacityBase", bindingID: bindingID)
        try validateOptionalFinite(trail.glowStrokeOpacityRange, "trail.glowStrokeOpacityRange", bindingID: bindingID)
        try validateOptionalFinite(trail.glowStrokeWidthBase, "trail.glowStrokeWidthBase", bindingID: bindingID)
        try validateOptionalFinite(trail.glowStrokeWidthRange, "trail.glowStrokeWidthRange", bindingID: bindingID)
        try validateOptionalPositive(trail.glowInnerScale, "trail.glowInnerScale", bindingID: bindingID)
    }

    private func validateTrajectory(_ trajectory: MotionTrajectorySpec?, bindingID: String) throws {
        guard let trajectory else { return }

        try validateOptionalColor(trajectory.color, "trajectory.color", bindingID: bindingID)
        try validateOptionalPositive(trajectory.chargeCurve, "trajectory.chargeCurve", bindingID: bindingID)
        try validateOptionalFinite(trajectory.pointCountBaseFactor, "trajectory.pointCountBaseFactor", bindingID: bindingID)
        try validateOptionalFinite(trajectory.pointCountChargeFactor, "trajectory.pointCountChargeFactor", bindingID: bindingID)
        try validateOptionalFinite(trajectory.sizeBase, "trajectory.sizeBase", bindingID: bindingID)
        try validateOptionalFinite(trajectory.sizeRange, "trajectory.sizeRange", bindingID: bindingID)
        try validateOptionalFinite(trajectory.minFade, "trajectory.minFade", bindingID: bindingID)
        try validateOptionalFinite(trajectory.opacityBase, "trajectory.opacityBase", bindingID: bindingID)
        try validateOptionalFinite(trajectory.opacityRange, "trajectory.opacityRange", bindingID: bindingID)
        try validateOptionalFinite(trajectory.opacityMinFade, "trajectory.opacityMinFade", bindingID: bindingID)
    }

    private func validateOptionalFinite(_ value: Double?, _ label: String, bindingID: String) throws {
        if let value, !value.isFinite {
            throw MotionRuntimeError.validation("Drag binding '\(bindingID)' \(label) must be finite")
        }
    }

    private func validateOptionalPositive(_ value: Double?, _ label: String, bindingID: String) throws {
        if let value, (!value.isFinite || value <= 0) {
            throw MotionRuntimeError.validation("Drag binding '\(bindingID)' \(label) must be positive and finite")
        }
    }

    private func validateOptionalColor(_ value: String?, _ label: String, bindingID: String) throws {
        guard let value else { return }

        if !MotionRenderStyle.isValidHexColor(value) {
            throw MotionRuntimeError.validation("Drag binding '\(bindingID)' \(label) must be a 6-digit hex color")
        }
    }

    private func validatePhysicsBody(_ body: MotionPhysicsBodySpec) throws {
        try validateNodeSelector(body.selector, context: "physics body '\(body.id)'")

        if let radius = body.radius, (!radius.isFinite || radius <= 0) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' radius must be positive and finite")
        }

        if let mass = body.mass, (!mass.isFinite || mass <= 0) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' mass must be positive and finite")
        }

        if let airResistance = body.airResistance, (!airResistance.isFinite || airResistance < 0) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' airResistance must be finite and non-negative")
        }

        if let restitution = body.restitution, (!restitution.isFinite || restitution < 0 || restitution > 1) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' restitution must be between 0 and 1")
        }

        if let friction = body.friction, (!friction.isFinite || friction < 0 || friction > 1) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' friction must be between 0 and 1")
        }

        if let stopSpeed = body.stopSpeed, (!stopSpeed.isFinite || stopSpeed < 0) {
            throw MotionRuntimeError.validation("Physics body '\(body.id)' stopSpeed must be finite and non-negative")
        }
    }

    private func validateForce(_ force: MotionForceSpec) throws {
        if let selector = force.selector {
            try validateNodeSelector(selector, context: "force '\(force.id)'")
        }

        if let x = force.x, !x.isFinite {
            throw MotionRuntimeError.validation("Force '\(force.id)' x must be finite")
        }

        if let y = force.y, !y.isFinite {
            throw MotionRuntimeError.validation("Force '\(force.id)' y must be finite")
        }
    }

    private func compileRuntimeIndexes(_ document: MotionDocument) throws {
        for trigger in document.triggers where trigger.type == .tap {
            guard let selector = trigger.selector else { continue }
            for nodeID in try resolveNodeIDs(selector) {
                tapTriggerIDsByNodeID[nodeID, default: []].append(trigger.id)
            }
        }

        for binding in document.dragBindings {
            let nodeIDs = try resolveNodeIDs(binding.selector)
            resolvedDragBindings.append(ResolvedDragBinding(binding: binding, nodeIDs: nodeIDs))

            for nodeID in nodeIDs {
                dragBindingByNodeID[nodeID] = binding
            }
        }

        for body in document.bodies {
            for nodeID in try resolveNodeIDs(body.selector) {
                bodySpecByNodeID[nodeID] = body
            }
        }

        for force in document.forces {
            guard let selector = force.selector else {
                globalForces.append(force)
                continue
            }

            for nodeID in try resolveNodeIDs(selector) {
                forceSpecsByNodeID[nodeID, default: []].append(force)
            }
        }
    }

    private func validateFiniteNumbers(in values: [String: MotionValue], context: String) throws {
        for (key, value) in values {
            if let number = value.number, !number.isFinite {
                throw MotionRuntimeError.validation("Non-finite number for '\(key)' in \(context)")
            }
            try validateNumericMetric(value, context: "'\(key)' in \(context)")
        }
    }

    private func validateNodeStyle(_ node: MotionNode) throws {
        try validateFills(node.fills, context: "fills for node '\(node.id)'")
        try validateImageAssetPolicy(kind: node.kind, style: node.style, context: "node '\(node.id)'")

        for key in ["backgroundColor", "foregroundColor", "gradientEndColor", "strokeColor", "shadowColor"] where node.style[key] != nil {
            guard let value = node.style[key]?.string else {
                throw MotionRuntimeError.validation("Style '\(key)' for node '\(node.id)' must be a 6-digit hex color string")
            }

            guard MotionRenderStyle.isValidHexColor(value) else {
                throw MotionRuntimeError.validation("Style '\(key)' for node '\(node.id)' must be a 6-digit hex color")
            }
        }

        if let gradientAngle = node.style["gradientAngle"], gradientAngle.number == nil {
            throw MotionRuntimeError.validation("Style 'gradientAngle' for node '\(node.id)' must be a number")
        }

        let numericStyleKeys = [
            "blur",
            "figmaBlur",
            "strokeWidth",
            "shadowX",
            "shadowY",
            "shadowBlur",
            "shadowOpacity",
            "shapeBounds",
            "shapeBounds.top",
            "shapeBounds.right",
            "shapeBounds.bottom",
            "shapeBounds.left",
            "effectBounds",
            "effectBounds.top",
            "effectBounds.right",
            "effectBounds.bottom",
            "effectBounds.left"
        ]

        for key in numericStyleKeys where node.style[key] != nil {
            guard node.style[key]?.number != nil else {
                throw MotionRuntimeError.validation("Style '\(key)' for node '\(node.id)' must be a number")
            }
        }
    }

    private func validateImageAssetPolicy(kind: MotionNodeKind, style: [String: MotionValue], context: String) throws {
        guard kind == .image else { return }
        guard style["assetPolicy"]?.string == "locked" else {
            throw MotionRuntimeError.validation("Image \(context) requires style.assetPolicy = 'locked'")
        }
    }

    private func validateFills(_ fills: [MotionFill], context: String) throws {
        for fill in fills {
            if let color = fill.color, !MotionRenderStyle.isValidHexColor(color) {
                throw MotionRuntimeError.validation("Fill color for \(context) must be a 6-digit hex color")
            }

            for stop in fill.colors {
                guard MotionRenderStyle.isValidHexColor(stop.color) else {
                    throw MotionRuntimeError.validation("Fill color stop for \(context) must be a 6-digit hex color")
                }
            }
        }
    }

    private func validateTree(rootID: NodeID) throws {
        enum VisitState {
            case visiting
            case visited
        }

        var states: [NodeID: VisitState] = [:]

        func visit(_ nodeID: NodeID, path: [NodeID]) throws {
            if states[nodeID] == .visiting {
                throw MotionRuntimeError.validation("Node tree contains a cycle: \((path + [nodeID]).joined(separator: " -> "))")
            }

            if states[nodeID] == .visited {
                return
            }

            guard let node = nodesByID[nodeID] else {
                throw MotionRuntimeError.validation("Node tree references missing node '\(nodeID)'")
            }

            states[nodeID] = .visiting
            for childID in node.children {
                try visit(childID, path: path + [nodeID])
            }
            states[nodeID] = .visited
        }

        try visit(rootID, path: [])

        let unreachable = Set(nodesByID.keys).subtracting(states.keys)
        if let nodeID = unreachable.sorted().first {
            throw MotionRuntimeError.validation("Node '\(nodeID)' is not reachable from root '\(rootID)'")
        }
    }

    private func validateNumericValue(_ value: MotionValue, context: String) throws {
        switch value {
        case let .number(number):
            guard number.isFinite else {
                throw MotionRuntimeError.validation("Non-finite value in \(context)")
            }
        case .metric:
            try validateNumericMetric(value, context: context)
        case .string, .bool:
            throw MotionRuntimeError.validation("Only numeric or metric values are supported in \(context)")
        }
    }

    private func validateNumericMetric(_ value: MotionValue, context: String) throws {
        guard case let .metric(metricValue) = value else { return }

        if let multiplier = metricValue.multiplier, !multiplier.isFinite {
            throw MotionRuntimeError.validation("Metric multiplier must be finite for \(context)")
        }

        if let offset = metricValue.offset, !offset.isFinite {
            throw MotionRuntimeError.validation("Metric offset must be finite for \(context)")
        }
    }

    private func validateUnique(_ values: [String], label: String) throws {
        var seen: Set<String> = []

        for value in values {
            guard !seen.contains(value) else {
                throw MotionRuntimeError.validation("\(label) must be unique; duplicate '\(value)'")
            }
            seen.insert(value)
        }
    }

    private func fire(triggerID: TriggerID) {
        for machine in machinesByID.values {
            guard let currentState = currentStates[machine.id] else { continue }
            let matches = machine.transitions.filter { transition in
                transition.from == currentState && transition.trigger == triggerID
            }

            guard let transition = matches.first else { continue }
            guard matches.count == 1 else {
                errorMessage = "Multiple transitions matched trigger \(triggerID)"
                return
            }

            do {
                if isDebugLoggingEnabled {
                    let elapsed = stateElapsedByMachine[machine.id] ?? 0
                    let triggerType = triggersByID[triggerID]?.type.rawValue ?? "unknown"
                    Self.logger.info("[FrameZeroEngine] fire machine=\(machine.id, privacy: .public) transition=\(transition.id, privacy: .public) from=\(transition.from, privacy: .public) to=\(transition.to, privacy: .public) trigger=\(triggerID, privacy: .public) triggerType=\(triggerType, privacy: .public) stateElapsed=\(elapsed, privacy: .public) idleElapsed=\(self.idleElapsed, privacy: .public) configuredDelay=\((transition.delay ?? 0), privacy: .public)")
                }
                currentStates[machine.id] = transition.to
                try applyState(machineID: machine.id, stateID: transition.to, transition: transition, snap: false)
                stateElapsedByMachine[machine.id] = 0
                idleElapsed = 0
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func fireAutomaticTransitionsIfIdle() -> Bool {
        var didFire = false
        let automaticTriggerIDs = Set(triggersByID.values
            .filter { $0.type == .automatic }
            .map(\.id))

        for machine in machinesByID.values.sorted(by: { $0.id < $1.id }) {
            guard let currentState = currentStates[machine.id] else { continue }
            guard let transition = machine.transitions.first(where: { transition in
                transition.from == currentState
                    && automaticTriggerIDs.contains(transition.trigger)
                    && idleElapsed >= (transition.delay ?? 0)
            }) else {
                continue
            }

            fire(triggerID: transition.trigger)
            didFire = true
        }

        return didFire
    }

    private func fireAfterTransitions() -> Bool {
        var didFire = false
        let afterTriggerIDs = Set(triggersByID.values
            .filter { $0.type == .after }
            .map(\.id))

        for machine in machinesByID.values.sorted(by: { $0.id < $1.id }) {
            guard let currentState = currentStates[machine.id] else { continue }
            let elapsed = stateElapsedByMachine[machine.id] ?? 0
            guard let transition = machine.transitions.first(where: { transition in
                transition.from == currentState
                    && afterTriggerIDs.contains(transition.trigger)
                    && elapsed >= (transition.delay ?? 0)
            }) else {
                continue
            }

            fire(triggerID: transition.trigger)
            didFire = true
        }

        return didFire
    }

    private func applyState(
        machineID: MachineID,
        stateID: StateID,
        transition: MotionTransition?,
        snap: Bool
    ) throws {
        guard let machine = machinesByID[machineID] else {
            throw MotionRuntimeError.validation("Machine '\(machineID)' does not exist")
        }
        guard let state = machine.states.first(where: { $0.id == stateID }) else {
            throw MotionRuntimeError.validation("State '\(stateID)' does not exist")
        }

        idleElapsed = 0
        stateElapsedByMachine[machineID] = 0
        pendingTargets = []
        activeArcs = []
        activeJiggles = []
        scheduledActions.removeAll { $0.machineID == machineID }

        for assignment in state.values {
            let keys = try resolve(assignment.select)
            guard let target = resolveNumber(assignment.value) else {
                throw MotionRuntimeError.validation("Only numeric state assignments are supported in Phase 1")
            }

            for key in keys {
                let rule = transitionRule(for: key, transition: transition)
                let motion = rule?.motion ?? defaultTransitionMotion()
                var channel = channels[key] ?? MotionChannel(
                    current: target,
                    velocity: 0,
                    target: target,
                    motion: motion,
                    animationStart: target,
                    animationElapsed: 0
                )
                stateTargets[key] = assignment.value
                if snap {
                    channel.current = target
                    channel.velocity = 0
                    channel.setTarget(target, motion: motion)
                } else if let delay = rule?.delay, delay > 0 {
                    channel.target = channel.current
                    channel.velocity = 0
                    channel.motion = .immediate
                    channel.animationStart = channel.current
                    channel.animationElapsed = 0
                    pendingTargets.append(PendingChannelTarget(
                        key: key,
                        target: target,
                        motion: motion,
                        remainingDelay: delay
                    ))
                } else {
                    channel.setTarget(target, motion: motion)
                }
                channels[key] = channel
            }
        }

        if !snap, let transition {
            try configureArcMotions(for: transition)
            try configureJiggleMotions(for: transition)
            scheduleActions(transition.actions, machineID: machineID)
            runReadyActions()
        }
    }

    private func transitionRule(for key: MotionChannelKey, transition: MotionTransition?) -> MotionRule? {
        guard let transition else { return nil }

        for rule in transition.rules.reversed() {
            guard let keys = try? resolve(rule.select), keys.contains(key) else { continue }
            return rule
        }

        return nil
    }

    private func defaultTransitionMotion() -> MotionSpec {
        .immediate
    }

    private func refreshResolvedTargets(snap: Bool) {
        for (key, value) in stateTargets {
            guard let target = resolveNumber(value) else { continue }
            var channel = channels[key] ?? MotionChannel(
                current: target,
                velocity: 0,
                target: target,
                motion: .immediate,
                animationStart: target,
                animationElapsed: 0
            )
            channel.setTarget(target, motion: channel.motion)
            if snap {
                channel.current = target
                channel.velocity = 0
                channel.animationStart = target
                channel.animationElapsed = 0
            }
            channels[key] = channel
        }
    }

    private func configureArcMotions(for transition: MotionTransition) throws {
        for arc in transition.arcs {
            let nodeIDs = try resolveNodeIDs(arc.select)

            for nodeID in nodeIDs {
                let xKey = MotionChannelKey(nodeID: nodeID, property: arc.x)
                let yKey = MotionChannelKey(nodeID: nodeID, property: arc.y)
                guard let xChannel = channels[xKey], let yChannel = channels[yKey] else {
                    throw MotionRuntimeError.validation("Arc in transition '\(transition.id)' references missing \(nodeID).\(arc.x)/\(arc.y) channels")
                }

                let startX = xChannel.current
                let startY = yChannel.current
                let endX = xChannel.target
                let endY = yChannel.target
                let distance = hypot(endX - startX, endY - startY)
                guard distance > 0.001 else { continue }

                let bend = arc.bend ?? distance * 0.45
                channels[xKey] = MotionChannel(
                    current: startX,
                    velocity: 0,
                    target: endX,
                    motion: .immediate,
                    animationStart: startX,
                    animationElapsed: 0
                )
                channels[yKey] = MotionChannel(
                    current: startY,
                    velocity: 0,
                    target: endY,
                    motion: .immediate,
                    animationStart: startY,
                    animationElapsed: 0
                )

                activeArcs.append(MotionArcRuntime(
                    nodeID: nodeID,
                    xProperty: arc.x,
                    yProperty: arc.y,
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY,
                    bend: bend,
                    direction: arc.direction,
                    progress: MotionChannel(
                        current: 0,
                        velocity: 0,
                        target: 1,
                        motion: arc.motion,
                        animationStart: 0,
                        animationElapsed: 0
                    )
                ))
            }
        }
    }

    private func configureJiggleMotions(for transition: MotionTransition) throws {
        for jiggle in transition.jiggles {
            guard let amplitude = resolveNumber(jiggle.amplitude) else {
                throw MotionRuntimeError.validation("Jiggle in transition '\(transition.id)' has unresolved amplitude")
            }

            for key in try resolve(jiggle.select) {
                guard var channel = channels[key] else {
                    throw MotionRuntimeError.validation("Jiggle in transition '\(transition.id)' references missing \(key.nodeID).\(key.property) channel")
                }

                let origin = channel.current
                channel.target = origin
                channel.velocity = 0
                channel.motion = .immediate
                channels[key] = channel

                activeJiggles.append(MotionJiggleRuntime(
                    key: key,
                    origin: origin,
                    amplitude: amplitude,
                    duration: jiggle.duration,
                    cycles: jiggle.cycles,
                    startDirection: jiggle.startDirection,
                    decay: jiggle.decay ?? 0,
                    elapsed: 0
                ))
            }
        }
    }

    private func scheduleActions(_ actions: [MotionAction], machineID: MachineID) {
        for action in actions {
            scheduleAction(action, machineID: machineID, after: 0)
        }
    }

    private func scheduleAction(_ action: MotionAction, machineID: MachineID, after delay: Double) {
        switch action {
        case let .sequence(group):
            var cursor = delay
            for child in group.actions {
                scheduleAction(child, machineID: machineID, after: cursor)
                cursor += actionDuration(child)
            }
        case let .parallel(group):
            for child in group.actions {
                scheduleAction(child, machineID: machineID, after: delay)
            }
        case let .delay(delayAction):
            guard delayAction.duration > 0 else { return }
            scheduledActions.append(ScheduledMotionAction(machineID: machineID, action: action, remainingDelay: delay + delayAction.duration))
        case .haptic, .screenShake, .emitParticles, .spawnComponents:
            scheduledActions.append(ScheduledMotionAction(machineID: machineID, action: action, remainingDelay: delay))
        }
    }

    private func actionDuration(_ action: MotionAction) -> Double {
        switch action {
        case let .sequence(group):
            return group.actions.reduce(0) { $0 + actionDuration($1) }
        case let .parallel(group):
            return group.actions.map(actionDuration).max() ?? 0
        case let .delay(delay):
            return delay.duration
        case .haptic:
            return 0
        case let .screenShake(shake):
            return shake.duration
        case let .emitParticles(emission):
            return emission.duration ?? emission.particle.lifetime
        case let .spawnComponents(spawn):
            return spawn.components.map(\.lifetime).max() ?? 0
        }
    }

    private func runReadyActions() {
        for index in scheduledActions.indices.reversed() where scheduledActions[index].remainingDelay <= 0 {
            let action = scheduledActions[index].action
            scheduledActions.remove(at: index)
            runAction(action)
        }
    }

    private func runAction(_ action: MotionAction) {
        switch action {
        case .sequence, .parallel, .delay:
            return
        case let .haptic(haptic):
            hapticPerformer.perform(haptic)
        case let .screenShake(shake):
            activeScreenShakes.append(MotionScreenShakeRuntime(
                id: UUID().uuidString,
                amplitude: shake.amplitude,
                duration: shake.duration,
                frequency: shake.frequency ?? 24,
                decay: shake.decay ?? 1,
                elapsed: 0
            ))
        case let .emitParticles(emission):
            spawnParticles(from: emission)
        case let .spawnComponents(spawn):
            spawnComponents(from: spawn)
        }
    }

    private func spawnParticles(from emission: MotionEmitParticlesAction) {
        let originNodeIDs: [NodeID]
        if let selector = emission.selector, let resolved = try? resolveNodeIDs(selector) {
            originNodeIDs = resolved
        } else {
            originNodeIDs = []
        }

        let origins = originNodeIDs.isEmpty
            ? [(x: 0.0, y: 0.0)]
            : originNodeIDs.map { nodeID in
                (
                    x: number(for: nodeID, property: "offset.x", default: 0),
                    y: number(for: nodeID, property: "offset.y", default: 0)
                )
            }

        for origin in origins {
            for index in 0..<emission.count {
                guard activeParticles.count < MotionActionLimits.maxActiveParticles else { return }

                let progress = emission.count == 1 ? 0.5 : Double(index) / Double(emission.count - 1)
                let angleRange = emission.angle ?? MotionDoubleRange(min: 0, max: 360)
                let distanceRange = emission.distance ?? MotionDoubleRange(min: 36, max: 96)
                let angle = (angleRange.min + ((angleRange.max - angleRange.min) * progress)) * Double.pi / 180
                let alternating = index.isMultiple(of: 2) ? 1.0 : -1.0
                let distanceProgress = emission.count == 1 ? 1 : Double((index * 37) % max(emission.count, 1)) / Double(max(emission.count - 1, 1))
                let distance = distanceRange.min + ((distanceRange.max - distanceRange.min) * distanceProgress)
                let defaultTargetX = cos(angle) * distance
                let defaultTargetY = sin(angle) * distance * alternating
                let particle = makeParticle(
                    emission: emission,
                    idSuffix: "\(index)-\(UUID().uuidString)",
                    originX: origin.x,
                    originY: origin.y,
                    defaultTargetX: defaultTargetX,
                    defaultTargetY: defaultTargetY
                )
                activeParticles.append(particle)
            }
        }
    }

    private func makeParticle(
        emission: MotionEmitParticlesAction,
        idSuffix: String,
        originX: Double,
        originY: Double,
        defaultTargetX: Double,
        defaultTargetY: Double
    ) -> MotionParticleRuntime {
        var channels: [String: MotionChannel] = [:]
        let particle = emission.particle
        var properties = Set(particle.from.keys)
        properties.formUnion(particle.to.keys)
        properties.formUnion(["offset.x", "offset.y", "scale", "opacity"])

        for property in properties {
            let explicitFrom = particle.from[property].flatMap(resolveNumber)
            let explicitTo = particle.to[property].flatMap(resolveNumber)
            let fromValue = explicitFrom ?? defaultParticleValue(for: property, target: false)
            let toValue = explicitTo ?? defaultParticleValue(for: property, target: true)
            let adjustedFrom = fromValue + ((property == "offset.x") ? originX : (property == "offset.y" ? originY : 0))
            let targetDefault = property == "offset.x" ? defaultTargetX : (property == "offset.y" ? defaultTargetY : 0)
            let adjustedTo = toValue
                + ((property == "offset.x") ? originX : (property == "offset.y" ? originY : 0))
                + ((explicitTo == nil && (property == "offset.x" || property == "offset.y")) ? targetDefault : 0)

            channels[property] = MotionChannel(
                current: adjustedFrom,
                velocity: 0,
                target: adjustedTo,
                motion: particle.motion,
                animationStart: adjustedFrom,
                animationElapsed: 0
            )
        }

        return MotionParticleRuntime(
            id: "\(emission.id)-\(idSuffix)",
            kind: particle.kind,
            layout: particle.layout,
            style: particle.style,
            fills: particle.fills,
            channels: channels,
            lifetime: particle.lifetime,
            elapsed: 0
        )
    }

    private func defaultParticleValue(for property: String, target: Bool) -> Double {
        switch property {
        case "scale":
            return target ? 0.2 : 1
        case "opacity":
            return target ? 0 : 1
        default:
            return 0
        }
    }

    private func spawnComponents(from spawn: MotionSpawnComponentsAction) {
        let originNodeIDs: [NodeID]
        if let selector = spawn.selector, let resolved = try? resolveNodeIDs(selector) {
            originNodeIDs = resolved
        } else {
            originNodeIDs = []
        }

        let origins = originNodeIDs.isEmpty
            ? [(x: 0.0, y: 0.0)]
            : originNodeIDs.map { nodeID in
                (
                    x: number(for: nodeID, property: "offset.x", default: 0),
                    y: number(for: nodeID, property: "offset.y", default: 0)
                )
            }

        for origin in origins {
            for component in spawn.components {
                guard activeComponents.count < MotionActionLimits.maxActiveComponents else { return }
                activeComponents.append(makeComponent(
                    spawnID: spawn.id,
                    component: component,
                    originX: origin.x,
                    originY: origin.y
                ))
            }
        }
    }

    private func makeComponent(
        spawnID: String,
        component: MotionComponentSpec,
        originX: Double,
        originY: Double
    ) -> MotionComponentRuntime {
        var channels: [String: MotionChannel] = [:]
        var properties = Set(component.from.keys)
        properties.formUnion(component.to.keys)
        properties.formUnion(["offset.x", "offset.y", "scale", "opacity"])

        for property in properties {
            let explicitFrom = component.from[property].flatMap(resolveNumber)
            let explicitTo = component.to[property].flatMap(resolveNumber)
            let fromValue = explicitFrom ?? defaultComponentValue(for: property, target: false)
            let toValue = explicitTo ?? defaultComponentValue(for: property, target: true)
            let adjustedFrom = fromValue + ((property == "offset.x") ? originX : (property == "offset.y" ? originY : 0))
            let adjustedTo = toValue + ((property == "offset.x") ? originX : (property == "offset.y" ? originY : 0))

            channels[property] = MotionChannel(
                current: adjustedFrom,
                velocity: 0,
                target: adjustedTo,
                motion: component.motion,
                animationStart: adjustedFrom,
                animationElapsed: 0
            )
        }

        return MotionComponentRuntime(
            id: "\(spawnID)-\(component.id)-\(UUID().uuidString)",
            kind: component.kind,
            layout: component.layout,
            style: component.style,
            fills: component.fills,
            channels: channels,
            lifetime: component.lifetime,
            elapsed: 0
        )
    }

    private func defaultComponentValue(for property: String, target: Bool) -> Double {
        switch property {
        case "scale":
            return target ? 1 : 0.8
        case "opacity":
            return target ? 0 : 1
        default:
            return 0
        }
    }

    private func resolveNumber(_ value: MotionValue) -> Double? {
        switch value {
        case let .number(number):
            return number
        case let .metric(metricValue):
            let base = viewport?.value(for: metricValue.metric) ?? 0
            return (base * (metricValue.multiplier ?? 1)) + (metricValue.offset ?? 0)
        case .string, .bool:
            return nil
        }
    }

    private func resolve(_ selector: MotionPropertySelector) throws -> [MotionChannelKey] {
        guard !selector.properties.isEmpty else {
            throw MotionRuntimeError.validation("Property selector must include at least one property")
        }

        let nodeIDs = try resolveNodeIDs(selector)

        return nodeIDs.flatMap { nodeID in
            selector.properties.map { property in
                MotionChannelKey(nodeID: nodeID, property: property)
            }
        }
    }

    private func resolveNodeIDs(_ selector: MotionPropertySelector) throws -> [NodeID] {
        let selectedModes = [selector.id != nil, selector.role != nil].filter { $0 }.count
        guard selectedModes == 1 else {
            throw MotionRuntimeError.validation("Property selector must include exactly one of id or role")
        }

        if let id = selector.id {
            guard nodesByID[id] != nil else {
                throw MotionRuntimeError.validation("Selector references missing node '\(id)'")
            }
            return [id]
        }

        if let role = selector.role {
            let nodeIDs = nodesByID.values
                .filter { $0.roles.contains(role) }
                .map(\.id)
                .sorted()
            guard !nodeIDs.isEmpty else {
                throw MotionRuntimeError.validation("Selector role '\(role)' matched no nodes")
            }
            return nodeIDs
        }

        throw MotionRuntimeError.validation("Selector must include id or role")
    }

    private func resolveNodeIDs(_ selector: MotionNodeSelector) throws -> [NodeID] {
        let selectedModes = [selector.id != nil, selector.role != nil].filter { $0 }.count
        guard selectedModes == 1 else {
            throw MotionRuntimeError.validation("Node selector must include exactly one of id or role")
        }

        if let id = selector.id {
            guard nodesByID[id] != nil else {
                throw MotionRuntimeError.validation("Node selector references missing node '\(id)'")
            }
            return [id]
        }

        if let role = selector.role {
            let nodeIDs = nodesByID.values
                .filter { $0.roles.contains(role) }
                .map(\.id)
                .sorted()
            guard !nodeIDs.isEmpty else {
                throw MotionRuntimeError.validation("Node selector role '\(role)' matched no nodes")
            }
            return nodeIDs
        }

        throw MotionRuntimeError.validation("Node selector must include id or role")
    }

    private func selector(_ selector: MotionNodeSelector, matches nodeID: NodeID) -> Bool {
        guard let node = nodesByID[nodeID] else { return false }

        if let id = selector.id {
            return id == nodeID
        }

        if let role = selector.role {
            return node.roles.contains(role)
        }

        return false
    }

    private func isNodeVisible(_ node: MotionNode) -> Bool {
        guard let presence = node.presence else { return true }
        return currentStates[presence.machine].map { presence.states.contains($0) } ?? false
    }

    public func tick(dt rawDelta: CFTimeInterval) -> Bool {
        let dt = min(max(rawDelta, 0), 0.032)
        guard dt > 0 else { return false }

        for machineID in currentStates.keys {
            stateElapsedByMachine[machineID, default: 0] += dt
        }

        var hasActiveChannels = false
        for index in pendingTargets.indices.reversed() {
            pendingTargets[index].remainingDelay -= dt
            if pendingTargets[index].remainingDelay <= 0 {
                let pending = pendingTargets[index]
                if var channel = channels[pending.key] {
                    channel.setTarget(pending.target, motion: pending.motion)
                    channels[pending.key] = channel
                }
                pendingTargets.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        let channelKeys = Array(channels.keys)
        for key in channelKeys {
            guard var channel = channels[key] else { continue }
            channel.integrate(dt: dt)
            if !channel.isSettled {
                hasActiveChannels = true
            }
            channels[key] = channel
        }

        for index in activeArcs.indices.reversed() {
            activeArcs[index].progress.integrate(dt: dt)
            let arc = activeArcs[index]
            let progress = min(max(arc.progress.current, 0), 1)
            let point = arc.point(at: progress)
            let xKey = MotionChannelKey(nodeID: arc.nodeID, property: arc.xProperty)
            let yKey = MotionChannelKey(nodeID: arc.nodeID, property: arc.yProperty)

            if var xChannel = channels[xKey] {
                xChannel.current = point.x
                xChannel.velocity = 0
                channels[xKey] = xChannel
            }

            if var yChannel = channels[yKey] {
                yChannel.current = point.y
                yChannel.velocity = 0
                channels[yKey] = yChannel
            }

            if arc.progress.isSettled {
                if var xChannel = channels[xKey] {
                    xChannel.current = arc.endX
                    xChannel.velocity = 0
                    channels[xKey] = xChannel
                }

                if var yChannel = channels[yKey] {
                    yChannel.current = arc.endY
                    yChannel.velocity = 0
                    channels[yKey] = yChannel
                }

                activeArcs.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        for index in activeJiggles.indices.reversed() {
            activeJiggles[index].elapsed += dt
            let jiggle = activeJiggles[index]
            let progress = min(max(jiggle.elapsed / jiggle.duration, 0), 1)
            let value = jiggle.value(at: progress)

            if var channel = channels[jiggle.key] {
                channel.current = value
                channel.target = jiggle.origin
                channel.velocity = 0
                channels[jiggle.key] = channel
            }

            if progress >= 1 {
                if var channel = channels[jiggle.key] {
                    channel.current = jiggle.origin
                    channel.target = jiggle.origin
                    channel.velocity = 0
                    channels[jiggle.key] = channel
                }
                activeJiggles.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        if !activeSlingshotDrags.isEmpty {
            hasActiveChannels = true
        }

        for nodeID in Array(activeProjectiles.keys) {
            guard var projectile = activeProjectiles[nodeID] else { continue }
            projectile.integrate(dt: dt, viewport: viewport)
            activeProjectiles[nodeID] = projectile

            setChannel(nodeID: nodeID, property: "offset.x", current: projectile.x, velocity: projectile.velocityX)
            setChannel(nodeID: nodeID, property: "offset.y", current: projectile.y, velocity: projectile.velocityY)

            if projectile.isResting {
                activeProjectiles[nodeID] = nil
            } else {
                hasActiveChannels = true
            }
        }

        for index in scheduledActions.indices.reversed() {
            scheduledActions[index].remainingDelay -= dt
            if scheduledActions[index].remainingDelay <= 0 {
                let action = scheduledActions[index].action
                scheduledActions.remove(at: index)
                runAction(action)
            } else {
                hasActiveChannels = true
            }
        }

        for index in activeScreenShakes.indices.reversed() {
            activeScreenShakes[index].elapsed += dt
            if activeScreenShakes[index].elapsed >= activeScreenShakes[index].duration {
                activeScreenShakes.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        for index in activeParticles.indices.reversed() {
            activeParticles[index].elapsed += dt
            let channelKeys = Array(activeParticles[index].channels.keys)
            for key in channelKeys {
                activeParticles[index].channels[key]?.integrate(dt: dt)
            }

            if activeParticles[index].elapsed >= activeParticles[index].lifetime {
                activeParticles.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        for index in activeComponents.indices.reversed() {
            activeComponents[index].elapsed += dt
            let channelKeys = Array(activeComponents[index].channels.keys)
            for key in channelKeys {
                activeComponents[index].channels[key]?.integrate(dt: dt)
            }

            if activeComponents[index].elapsed >= activeComponents[index].lifetime {
                activeComponents.remove(at: index)
            } else {
                hasActiveChannels = true
            }
        }

        if hasActiveChannels {
            idleElapsed = 0
        } else {
            idleElapsed += dt
        }

        if fireAfterTransitions() {
            return true
        }

        if !hasActiveChannels, fireAutomaticTransitionsIfIdle() {
            return true
        }

        return hasActiveChannels
    }
}

private extension MotionArcRuntime {
    func point(at progress: Double) -> (x: Double, y: Double) {
        let dx = endX - startX
        let dy = endY - startY
        let distance = max(hypot(dx, dy), 0.001)
        let directionMultiplier = direction == .clockwise ? 1.0 : -1.0
        let normalX = (-dy / distance) * directionMultiplier
        let normalY = (dx / distance) * directionMultiplier
        let controlX = ((startX + endX) / 2) + (normalX * bend)
        let controlY = ((startY + endY) / 2) + (normalY * bend)
        let inverse = 1 - progress
        let x = (inverse * inverse * startX) + (2 * inverse * progress * controlX) + (progress * progress * endX)
        let y = (inverse * inverse * startY) + (2 * inverse * progress * controlY) + (progress * progress * endY)

        return (x, y)
    }
}

private extension MotionJiggleRuntime {
    func value(at progress: Double) -> Double {
        let sign = startDirection.sign
        let decayScale = 1 - (decay * progress)
        let offset = sign * amplitude * decayScale * sin(2 * Double.pi * cycles * progress)

        return origin + offset
    }
}

private extension ActiveProjectile {
    var isResting: Bool {
        collisionCount > 0 && restingFrames >= 4
    }

    mutating func integrate(dt: CFTimeInterval, viewport: MotionViewport?) {
        accelerationX = -airResistance * velocityX
        accelerationY = forceY - (airResistance * velocityY)
        accelerationX += forceX

        velocityX += accelerationX * dt
        velocityY += accelerationY * dt

        let drag = exp(-airResistance * dt * 0.18)
        velocityX *= drag
        velocityY *= drag

        x += velocityX * dt
        y += velocityY * dt

        guard let viewport else { return }
        guard collision != .none else { return }

        let leftMetric: MotionMetric = collision == .safeAreaBounds ? .safeAreaLeft : .screenLeft
        let rightMetric: MotionMetric = collision == .safeAreaBounds ? .safeAreaRight : .screenRight
        let topMetric: MotionMetric = collision == .safeAreaBounds ? .safeAreaTop : .screenTop
        let bottomMetric: MotionMetric = collision == .safeAreaBounds ? .safeAreaBottom : .screenBottom
        let left = viewport.value(for: leftMetric) + radius
        let right = viewport.value(for: rightMetric) - radius
        let top = viewport.value(for: topMetric) + radius
        let bottom = viewport.value(for: bottomMetric) - radius

        var didCollide = false

        if x < left {
            x = left
            if velocityX < 0 {
                velocityX = -velocityX * restitution
                velocityY *= friction
                didCollide = true
            }
        } else if x > right {
            x = right
            if velocityX > 0 {
                velocityX = -velocityX * restitution
                velocityY *= friction
                didCollide = true
            }
        }

        if y < top {
            y = top
            if velocityY < 0 {
                velocityY = -velocityY * restitution
                velocityX *= friction
                didCollide = true
            }
        } else if y > bottom {
            y = bottom
            if velocityY > 0 {
                velocityY = -velocityY * restitution
                velocityX *= friction
                didCollide = true
            }
        }

        if didCollide {
            collisionCount += 1
        }

        let isOnFloor = abs(y - bottom) < 0.001
        let speed = hypot(velocityX, velocityY)
        if isOnFloor && speed < stopSpeed {
            velocityX = 0
            velocityY = 0
            accelerationX = 0
            accelerationY = 0
            restingFrames += 1
        } else {
            restingFrames = 0
        }
    }
}

private extension MotionJiggleDirection {
    var sign: Double {
        switch self {
        case .negative, .anticlockwise:
            return -1
        case .positive, .clockwise:
            return 1
        }
    }
}

private extension MotionViewport {
    func value(for metric: MotionMetric) -> Double {
        let left = -width / 2
        let right = width / 2
        let top = -height / 2
        let bottom = height / 2
        let safeLeft = left + safeAreaLeading
        let safeRight = right - safeAreaTrailing
        let safeTop = top + safeAreaTop
        let safeBottom = bottom - safeAreaBottom

        switch metric {
        case .screenWidth:
            return width
        case .screenHeight:
            return height
        case .screenLeft:
            return left
        case .screenRight:
            return right
        case .screenTop:
            return top
        case .screenBottom:
            return bottom
        case .screenCenterX:
            return 0
        case .screenCenterY:
            return 0
        case .safeAreaWidth:
            return safeRight - safeLeft
        case .safeAreaHeight:
            return safeBottom - safeTop
        case .safeAreaLeft:
            return safeLeft
        case .safeAreaRight:
            return safeRight
        case .safeAreaTop:
            return safeTop
        case .safeAreaBottom:
            return safeBottom
        case .safeAreaCenterX:
            return (safeLeft + safeRight) / 2
        case .safeAreaCenterY:
            return (safeTop + safeBottom) / 2
        }
    }
}

private extension MotionChannel {
    var isSettled: Bool {
        abs(current - target) < 0.001 && abs(velocity) < 0.001
    }

    mutating func setTarget(_ newTarget: Double, motion newMotion: MotionSpec) {
        target = newTarget
        motion = newMotion
        animationStart = current
        animationElapsed = 0
    }

    mutating func integrate(dt: CFTimeInterval) {
        switch motion {
        case .immediate:
            current = target
            velocity = 0
        case let .spring(spec):
            let response = max(spec.response, 0.001)
            let damping = max(spec.dampingFraction, 0)
            let omega = 2 * Double.pi / response
            let stiffness = omega * omega
            let dampingCoefficient = 2 * damping * omega
            let displacement = current - target
            let acceleration = (-stiffness * displacement) - (dampingCoefficient * velocity)

            velocity += acceleration * dt
            current += velocity * dt

            if isSettled {
                current = target
                velocity = 0
            }
        case let .timed(spec):
            let oldCurrent = current
            animationElapsed += dt

            let duration = max(spec.duration, 0.001)
            let progress = min(max(animationElapsed / duration, 0), 1)
            let easedProgress = spec.easing.eased(progress)
            current = animationStart + ((target - animationStart) * easedProgress)
            velocity = (current - oldCurrent) / max(dt, 0.001)

            if progress >= 1 {
                current = target
                velocity = 0
            }
        }
    }
}

private extension Optional where Wrapped == TimedEasing {
    func eased(_ progress: Double) -> Double {
        switch self ?? .easeInOut {
        case .linear:
            return progress
        case .easeIn:
            return progress * progress
        case .easeOut:
            return 1 - pow(1 - progress, 2)
        case .easeInOut:
            return progress < 0.5
                ? 2 * progress * progress
                : 1 - (pow(-2 * progress + 2, 2) / 2)
        }
    }
}

enum MotionRuntimeError: LocalizedError {
    case validation(String)

    var errorDescription: String? {
        switch self {
        case let .validation(message):
            return message
        }
    }
}
