import Foundation

typealias NodeID = String
typealias MachineID = String
typealias StateID = String
typealias TriggerID = String
typealias TransitionID = String

enum MotionActionLimits {
    static let maxParticlesPerEmission = 128
    static let maxParticleSelectorMatches = 16
    static let maxActiveParticles = 512
    static let maxComponentsPerSpawn = 32
    static let maxActiveComponents = 256
}

struct MotionDocument: Decodable {
    let schemaVersion: Int
    let root: NodeID
    let nodes: [MotionNode]
    let machines: [MotionStateMachine]
    let triggers: [MotionTrigger]
    let dragBindings: [MotionDragBinding]
    let bodies: [MotionPhysicsBodySpec]
    let forces: [MotionForceSpec]

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case root
        case nodes
        case machines
        case triggers
        case dragBindings
        case bodies
        case forces
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        root = try container.decode(NodeID.self, forKey: .root)
        nodes = try container.decode([MotionNode].self, forKey: .nodes)
        machines = try container.decode([MotionStateMachine].self, forKey: .machines)
        triggers = try container.decode([MotionTrigger].self, forKey: .triggers)
        dragBindings = try container.decodeIfPresent([MotionDragBinding].self, forKey: .dragBindings) ?? []
        bodies = try container.decodeIfPresent([MotionPhysicsBodySpec].self, forKey: .bodies) ?? []
        forces = try container.decodeIfPresent([MotionForceSpec].self, forKey: .forces) ?? []
    }
}

struct MotionNode: Identifiable, Decodable {
    let id: NodeID
    let kind: MotionNodeKind
    let roles: [String]
    let layout: [String: MotionValue]
    let style: [String: MotionValue]
    let fills: [MotionFill]
    let presentation: [String: MotionValue]
    let children: [NodeID]
    let presence: MotionPresence?

    private enum CodingKeys: String, CodingKey {
        case id
        case kind
        case roles
        case layout
        case style
        case fills
        case presentation
        case children
        case presence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(NodeID.self, forKey: .id)
        kind = try container.decode(MotionNodeKind.self, forKey: .kind)
        roles = try container.decodeIfPresent([String].self, forKey: .roles) ?? []
        layout = try container.decodeIfPresent([String: MotionValue].self, forKey: .layout) ?? [:]
        style = try container.decodeIfPresent([String: MotionValue].self, forKey: .style) ?? [:]
        fills = try container.decodeIfPresent([MotionFill].self, forKey: .fills) ?? []
        presentation = try container.decodeIfPresent([String: MotionValue].self, forKey: .presentation) ?? [:]
        children = try container.decodeIfPresent([NodeID].self, forKey: .children) ?? []
        presence = try container.decodeIfPresent(MotionPresence.self, forKey: .presence)
    }
}

struct MotionFill: Decodable, Equatable {
    let type: MotionFillType
    let color: String?
    let colors: [MotionColorStop]
    let angle: Double?
    let centerX: Double?
    let centerY: Double?
    let radius: Double?
    let gradientTransform: [Double]?
    let opacity: Double?

    private enum CodingKeys: String, CodingKey {
        case type
        case color
        case colors
        case angle
        case centerX
        case centerY
        case radius
        case gradientTransform
        case opacity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(MotionFillType.self, forKey: .type)
        color = try container.decodeIfPresent(String.self, forKey: .color)
        colors = try container.decodeIfPresent([MotionColorStop].self, forKey: .colors) ?? []
        angle = try container.decodeFiniteDoubleIfPresent(forKey: .angle)
        centerX = try container.decodeFiniteDoubleIfPresent(forKey: .centerX)
        centerY = try container.decodeFiniteDoubleIfPresent(forKey: .centerY)
        radius = try container.decodeFinitePositiveDoubleIfPresent(forKey: .radius)
        gradientTransform = try container.decodeIfPresent([Double].self, forKey: .gradientTransform)
        opacity = try container.decodeUnitIntervalIfPresent(forKey: .opacity)

        if let gradientTransform {
            guard gradientTransform.count == 6, gradientTransform.allSatisfy(\.isFinite) else {
                throw DecodingError.dataCorruptedError(forKey: .gradientTransform, in: container, debugDescription: "Gradient transform must contain six finite numbers")
            }
        }

        switch type {
        case .solid:
            if color == nil {
                throw DecodingError.dataCorruptedError(forKey: .color, in: container, debugDescription: "Solid fill requires color")
            }
        case .linearGradient, .radialGradient:
            if colors.count < 2 {
                throw DecodingError.dataCorruptedError(forKey: .colors, in: container, debugDescription: "Gradient fill requires at least two color stops")
            }
        }
    }
}

enum MotionFillType: String, Decodable, Equatable {
    case solid
    case linearGradient
    case radialGradient
}

struct MotionColorStop: Decodable, Equatable {
    let color: String
    let position: Double
    let opacity: Double?

    private enum CodingKeys: String, CodingKey {
        case color
        case position
        case opacity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        color = try container.decode(String.self, forKey: .color)
        position = try container.decodeFiniteDouble(forKey: .position)
        opacity = try container.decodeUnitIntervalIfPresent(forKey: .opacity)

        if position < 0 || position > 1 {
            throw DecodingError.dataCorruptedError(forKey: .position, in: container, debugDescription: "Color stop position must be between 0 and 1")
        }
    }
}

enum MotionNodeKind: String, Decodable {
    case zstack
    case vstack
    case hstack
    case text
    case image
    case path
    case circle
    case roundedRectangle
}

struct MotionPresence: Decodable {
    let machine: MachineID
    let states: [StateID]
}

struct MotionStateMachine: Identifiable, Decodable {
    let id: MachineID
    let initial: StateID
    let states: [MotionVisualState]
    let transitions: [MotionTransition]
}

struct MotionVisualState: Identifiable, Decodable {
    let id: StateID
    let values: [MotionPropertyAssignment]
}

struct MotionTransition: Identifiable, Decodable {
    let id: TransitionID
    let from: StateID
    let to: StateID
    let trigger: TriggerID
    let rules: [MotionRule]
    let arcs: [MotionArcRule]
    let jiggles: [MotionJiggleRule]
    let delay: Double?
    let enter: [MotionIgnoredRule]
    let exit: [MotionIgnoredRule]
    let spawns: [MotionIgnoredRule]
    let actions: [MotionAction]

    private enum CodingKeys: String, CodingKey {
        case id
        case from
        case to
        case trigger
        case rules
        case arcs
        case jiggles
        case delay
        case enter
        case exit
        case spawns
        case actions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(TransitionID.self, forKey: .id)
        from = try container.decode(StateID.self, forKey: .from)
        to = try container.decode(StateID.self, forKey: .to)
        trigger = try container.decode(TriggerID.self, forKey: .trigger)
        rules = try container.decode([MotionRule].self, forKey: .rules)
        arcs = try container.decodeIfPresent([MotionArcRule].self, forKey: .arcs) ?? []
        jiggles = try container.decodeIfPresent([MotionJiggleRule].self, forKey: .jiggles) ?? []
        delay = try container.decodeIfPresent(Double.self, forKey: .delay)
        enter = try container.decodeIfPresent([MotionIgnoredRule].self, forKey: .enter) ?? []
        exit = try container.decodeIfPresent([MotionIgnoredRule].self, forKey: .exit) ?? []
        spawns = try container.decodeIfPresent([MotionIgnoredRule].self, forKey: .spawns) ?? []
        actions = try container.decodeIfPresent([MotionAction].self, forKey: .actions) ?? []
    }
}

indirect enum MotionAction: Decodable {
    case sequence(MotionActionGroup)
    case parallel(MotionActionGroup)
    case delay(MotionDelayAction)
    case haptic(MotionHapticAction)
    case screenShake(MotionScreenShakeAction)
    case emitParticles(MotionEmitParticlesAction)
    case spawnComponents(MotionSpawnComponentsAction)

    private enum CodingKeys: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(MotionActionType.self, forKey: .type)

        switch type {
        case .sequence:
            self = .sequence(try MotionActionGroup(from: decoder))
        case .parallel:
            self = .parallel(try MotionActionGroup(from: decoder))
        case .delay:
            self = .delay(try MotionDelayAction(from: decoder))
        case .haptic:
            self = .haptic(try MotionHapticAction(from: decoder))
        case .screenShake:
            self = .screenShake(try MotionScreenShakeAction(from: decoder))
        case .emitParticles:
            self = .emitParticles(try MotionEmitParticlesAction(from: decoder))
        case .spawnComponents:
            self = .spawnComponents(try MotionSpawnComponentsAction(from: decoder))
        }
    }
}

enum MotionActionType: String, Decodable {
    case sequence
    case parallel
    case delay
    case haptic
    case screenShake
    case emitParticles
    case spawnComponents
}

struct MotionActionGroup: Decodable {
    let actions: [MotionAction]

    private enum CodingKeys: String, CodingKey {
        case actions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        actions = try container.decode([MotionAction].self, forKey: .actions)

        if actions.isEmpty {
            throw DecodingError.dataCorruptedError(
                forKey: .actions,
                in: container,
                debugDescription: "Action group must contain at least one action"
            )
        }
    }
}

struct MotionDelayAction: Decodable {
    let duration: Double

    private enum CodingKeys: String, CodingKey {
        case duration
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        duration = try container.decodeFiniteNonNegativeDouble(forKey: .duration)
    }
}

struct MotionHapticAction: Decodable {
    let style: MotionHapticStyle
    let intensity: Double?

    private enum CodingKeys: String, CodingKey {
        case style
        case intensity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        style = try container.decode(MotionHapticStyle.self, forKey: .style)

        let decodedIntensity = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .intensity)
        if let decodedIntensity, decodedIntensity > 1 {
            throw DecodingError.dataCorruptedError(
                forKey: .intensity,
                in: container,
                debugDescription: "Haptic intensity must be between 0 and 1"
            )
        }
        intensity = decodedIntensity
    }
}

enum MotionHapticStyle: String, Decodable {
    case light
    case medium
    case heavy
    case rigid
    case soft
    case selection
    case success
    case warning
    case error
}

struct MotionScreenShakeAction: Decodable {
    let amplitude: Double
    let duration: Double
    let frequency: Double?
    let decay: Double?

    private enum CodingKeys: String, CodingKey {
        case amplitude
        case duration
        case frequency
        case decay
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        amplitude = try container.decodeFiniteNonNegativeDouble(forKey: .amplitude)
        duration = try container.decodeFinitePositiveDouble(forKey: .duration)
        frequency = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .frequency)
        decay = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .decay)
    }
}

struct MotionEmitParticlesAction: Decodable {
    let id: String
    let selector: MotionNodeSelector?
    let particle: MotionParticleSpec
    let count: Int
    let duration: Double?
    let angle: MotionDoubleRange?
    let distance: MotionDoubleRange?

    private enum CodingKeys: String, CodingKey {
        case id
        case selector
        case particle
        case count
        case duration
        case angle
        case distance
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        selector = try container.decodeIfPresent(MotionNodeSelector.self, forKey: .selector)
        particle = try container.decode(MotionParticleSpec.self, forKey: .particle)
        count = try container.decode(Int.self, forKey: .count)
        duration = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .duration)
        angle = try container.decodeIfPresent(MotionDoubleRange.self, forKey: .angle)
        distance = try container.decodeIfPresent(MotionDoubleRange.self, forKey: .distance)

        if id.isEmpty {
            throw DecodingError.dataCorruptedError(
                forKey: .id,
                in: container,
                debugDescription: "Particle emission id must not be empty"
            )
        }

        if count <= 0 {
            throw DecodingError.dataCorruptedError(
                forKey: .count,
                in: container,
                debugDescription: "Particle emission count must be greater than zero"
            )
        }

        if count > MotionActionLimits.maxParticlesPerEmission {
            throw DecodingError.dataCorruptedError(
                forKey: .count,
                in: container,
                debugDescription: "Particle emission count must be <= \(MotionActionLimits.maxParticlesPerEmission)"
            )
        }
    }
}

struct MotionDoubleRange: Decodable {
    let min: Double
    let max: Double

    private enum CodingKeys: String, CodingKey {
        case min
        case max
    }

    init(min: Double, max: Double) {
        self.min = min
        self.max = max
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        min = try container.decodeFiniteDouble(forKey: .min)
        max = try container.decodeFiniteDouble(forKey: .max)

        if min > max {
            throw DecodingError.dataCorruptedError(
                forKey: .max,
                in: container,
                debugDescription: "Range min must be less than or equal to max"
            )
        }
    }
}

struct MotionParticleSpec: Decodable {
    let kind: MotionNodeKind
    let layout: [String: MotionValue]
    let style: [String: MotionValue]
    let fills: [MotionFill]
    let from: [String: MotionValue]
    let to: [String: MotionValue]
    let motion: MotionSpec
    let lifetime: Double

    private enum CodingKeys: String, CodingKey {
        case kind
        case layout
        case style
        case fills
        case from
        case to
        case motion
        case lifetime
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kind = try container.decode(MotionNodeKind.self, forKey: .kind)
        layout = try container.decodeIfPresent([String: MotionValue].self, forKey: .layout) ?? [:]
        style = try container.decodeIfPresent([String: MotionValue].self, forKey: .style) ?? [:]
        fills = try container.decodeIfPresent([MotionFill].self, forKey: .fills) ?? []
        from = try container.decodeIfPresent([String: MotionValue].self, forKey: .from) ?? [:]
        to = try container.decodeIfPresent([String: MotionValue].self, forKey: .to) ?? [:]
        motion = try container.decode(MotionSpec.self, forKey: .motion)
        lifetime = try container.decodeFinitePositiveDouble(forKey: .lifetime)
    }
}

struct MotionSpawnComponentsAction: Decodable {
    let id: String
    let selector: MotionNodeSelector?
    let components: [MotionComponentSpec]

    private enum CodingKeys: String, CodingKey {
        case id
        case selector
        case components
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        selector = try container.decodeIfPresent(MotionNodeSelector.self, forKey: .selector)
        components = try container.decode([MotionComponentSpec].self, forKey: .components)

        if id.isEmpty {
            throw DecodingError.dataCorruptedError(
                forKey: .id,
                in: container,
                debugDescription: "Component spawn id must not be empty"
            )
        }

        if components.isEmpty {
            throw DecodingError.dataCorruptedError(
                forKey: .components,
                in: container,
                debugDescription: "Component spawn must contain at least one component"
            )
        }

        if components.count > MotionActionLimits.maxComponentsPerSpawn {
            throw DecodingError.dataCorruptedError(
                forKey: .components,
                in: container,
                debugDescription: "Component spawn must contain <= \(MotionActionLimits.maxComponentsPerSpawn) components"
            )
        }
    }
}

struct MotionComponentSpec: Decodable {
    let id: String
    let kind: MotionNodeKind
    let layout: [String: MotionValue]
    let style: [String: MotionValue]
    let fills: [MotionFill]
    let from: [String: MotionValue]
    let to: [String: MotionValue]
    let motion: MotionSpec
    let lifetime: Double

    private enum CodingKeys: String, CodingKey {
        case id
        case kind
        case layout
        case style
        case fills
        case from
        case to
        case motion
        case lifetime
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        kind = try container.decode(MotionNodeKind.self, forKey: .kind)
        layout = try container.decodeIfPresent([String: MotionValue].self, forKey: .layout) ?? [:]
        style = try container.decodeIfPresent([String: MotionValue].self, forKey: .style) ?? [:]
        fills = try container.decodeIfPresent([MotionFill].self, forKey: .fills) ?? []
        from = try container.decodeIfPresent([String: MotionValue].self, forKey: .from) ?? [:]
        to = try container.decodeIfPresent([String: MotionValue].self, forKey: .to) ?? [:]
        motion = try container.decode(MotionSpec.self, forKey: .motion)
        lifetime = try container.decodeFinitePositiveDouble(forKey: .lifetime)

        if id.isEmpty {
            throw DecodingError.dataCorruptedError(
                forKey: .id,
                in: container,
                debugDescription: "Spawned component id must not be empty"
            )
        }
    }
}

struct MotionPropertyAssignment: Decodable {
    let select: MotionPropertySelector
    let value: MotionValue
}

struct MotionRule: Decodable {
    let select: MotionPropertySelector
    let motion: MotionSpec
    let delay: Double?
}

struct MotionArcRule: Decodable {
    let select: MotionNodeSelector
    let x: String
    let y: String
    let direction: MotionArcDirection
    let bend: Double?
    let motion: MotionSpec
}

enum MotionArcDirection: String, Decodable {
    case clockwise
    case anticlockwise
}

struct MotionJiggleRule: Decodable {
    let select: MotionPropertySelector
    let amplitude: MotionValue
    let duration: Double
    let cycles: Double
    let startDirection: MotionJiggleDirection
    let decay: Double?
}

enum MotionJiggleDirection: String, Decodable {
    case negative
    case positive
    case clockwise
    case anticlockwise
}

struct MotionPropertySelector: Decodable {
    let id: NodeID?
    let role: String?
    let properties: [String]
}

struct MotionTrigger: Identifiable, Decodable {
    let id: TriggerID
    let type: MotionTriggerType
    let selector: MotionNodeSelector?
}

enum MotionTriggerType: String, Decodable {
    case tap
    case automatic
    case after
}

struct MotionNodeSelector: Decodable {
    let id: NodeID?
    let role: String?
}

struct MotionDragBinding: Identifiable, Decodable {
    let id: String
    let type: MotionDragBindingType
    let selector: MotionNodeSelector
    let anchor: MotionPointValue?
    let maxPull: Double
    let minLaunchPull: Double?
    let launchPower: Double
    let throwPower: Double?
    let gravity: Double?
    let airResistance: Double?
    let restitution: Double?
    let friction: Double?
    let stopSpeed: Double?
    let throwThreshold: Double?
    let radius: Double?
    let chargeScale: Double?
    let chargeFeedback: MotionChargeFeedbackSpec?
    let trail: MotionTrailSpec?
    let trajectory: MotionTrajectorySpec?
}

struct MotionChargeFeedbackSpec: Decodable {
    let stretchX: Double?
    let stretchY: Double?
    let launchPowerBase: Double?
    let launchPowerRange: Double?
    let launchPowerExponent: Double?
    let throwInfluenceWhenFast: Double?
}

struct MotionPhysicsBodySpec: Identifiable, Decodable {
    let id: String
    let selector: MotionNodeSelector
    let radius: Double?
    let mass: Double?
    let airResistance: Double?
    let restitution: Double?
    let friction: Double?
    let stopSpeed: Double?
    let collision: MotionCollisionMode?
}

enum MotionCollisionMode: String, Decodable {
    case none
    case screenBounds
    case safeAreaBounds
}

struct MotionForceSpec: Identifiable, Decodable {
    let id: String
    let type: MotionForceType
    let selector: MotionNodeSelector?
    let x: Double?
    let y: Double?
}

enum MotionForceType: String, Decodable {
    case gravity
    case wind
    case constant
}

enum MotionDragBindingType: String, Decodable {
    case slingshot
}

struct MotionPointValue: Decodable {
    let x: MotionValue
    let y: MotionValue
}

struct MotionTrailSpec: Decodable {
    let color: String?
    let width: Double?
    let maxWidth: Double?
    let forkSpacing: Double?
    let chargeCurve: Double?
    let opacityBase: Double?
    let opacityRange: Double?
    let glowBaseSize: Double?
    let glowGrowth: Double?
    let glowFillOpacityBase: Double?
    let glowFillOpacityRange: Double?
    let glowStrokeOpacityBase: Double?
    let glowStrokeOpacityRange: Double?
    let glowStrokeWidthBase: Double?
    let glowStrokeWidthRange: Double?
    let glowInnerScale: Double?

    private enum CodingKeys: String, CodingKey {
        case color
        case width
        case maxWidth
        case forkSpacing
        case chargeCurve
        case opacityBase
        case opacityRange
        case glowBaseSize
        case glowGrowth
        case glowFillOpacityBase
        case glowFillOpacityRange
        case glowStrokeOpacityBase
        case glowStrokeOpacityRange
        case glowStrokeWidthBase
        case glowStrokeWidthRange
        case glowInnerScale
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        color = try container.decodeIfPresent(String.self, forKey: .color)
        width = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .width)
        maxWidth = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .maxWidth)
        forkSpacing = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .forkSpacing)
        chargeCurve = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .chargeCurve)
        opacityBase = try container.decodeUnitIntervalIfPresent(forKey: .opacityBase)
        opacityRange = try container.decodeFiniteDoubleIfPresent(forKey: .opacityRange)
        glowBaseSize = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .glowBaseSize)
        glowGrowth = try container.decodeFiniteDoubleIfPresent(forKey: .glowGrowth)
        glowFillOpacityBase = try container.decodeUnitIntervalIfPresent(forKey: .glowFillOpacityBase)
        glowFillOpacityRange = try container.decodeFiniteDoubleIfPresent(forKey: .glowFillOpacityRange)
        glowStrokeOpacityBase = try container.decodeUnitIntervalIfPresent(forKey: .glowStrokeOpacityBase)
        glowStrokeOpacityRange = try container.decodeFiniteDoubleIfPresent(forKey: .glowStrokeOpacityRange)
        glowStrokeWidthBase = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .glowStrokeWidthBase)
        glowStrokeWidthRange = try container.decodeFiniteDoubleIfPresent(forKey: .glowStrokeWidthRange)
        glowInnerScale = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .glowInnerScale)
    }
}

struct MotionTrajectorySpec: Decodable {
    let color: String?
    let points: Int?
    let step: Double?
    let chargeCurve: Double?
    let pointCountBaseFactor: Double?
    let pointCountChargeFactor: Double?
    let sizeBase: Double?
    let sizeRange: Double?
    let minFade: Double?
    let opacityBase: Double?
    let opacityRange: Double?
    let opacityMinFade: Double?

    private enum CodingKeys: String, CodingKey {
        case color
        case points
        case step
        case chargeCurve
        case pointCountBaseFactor
        case pointCountChargeFactor
        case sizeBase
        case sizeRange
        case minFade
        case opacityBase
        case opacityRange
        case opacityMinFade
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        color = try container.decodeIfPresent(String.self, forKey: .color)
        points = try container.decodeIfPresent(Int.self, forKey: .points)
        step = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .step)
        chargeCurve = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .chargeCurve)
        pointCountBaseFactor = try container.decodeFiniteDoubleIfPresent(forKey: .pointCountBaseFactor)
        pointCountChargeFactor = try container.decodeFiniteDoubleIfPresent(forKey: .pointCountChargeFactor)
        sizeBase = try container.decodeFiniteNonNegativeDoubleIfPresent(forKey: .sizeBase)
        sizeRange = try container.decodeFiniteDoubleIfPresent(forKey: .sizeRange)
        minFade = try container.decodeUnitIntervalIfPresent(forKey: .minFade)
        opacityBase = try container.decodeUnitIntervalIfPresent(forKey: .opacityBase)
        opacityRange = try container.decodeFiniteDoubleIfPresent(forKey: .opacityRange)
        opacityMinFade = try container.decodeUnitIntervalIfPresent(forKey: .opacityMinFade)
    }
}

enum MotionSpec: Decodable, Equatable {
    case spring(SpringSpec)
    case timed(TimedSpec)
    case immediate

    private enum CodingKeys: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "spring":
            self = .spring(try SpringSpec(from: decoder))
        case "timed":
            self = .timed(try TimedSpec(from: decoder))
        case "immediate":
            self = .immediate
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unsupported motion type '\(type)'"
            )
        }
    }
}

struct SpringSpec: Decodable, Equatable {
    let type: String
    let response: Double
    let dampingFraction: Double
}

extension SpringSpec {
    private enum CodingKeys: String, CodingKey {
        case type
        case response
        case dampingFraction
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        response = try container.decodeFinitePositiveDouble(forKey: .response)
        dampingFraction = try container.decodeOpenUnitInterval(forKey: .dampingFraction)
    }
}

struct TimedSpec: Decodable, Equatable {
    let type: String
    let duration: Double
    let easing: TimedEasing?
}

enum TimedEasing: String, Decodable {
    case linear
    case easeIn
    case easeOut
    case easeInOut
}

enum MotionValue: Decodable, Equatable {
    case number(Double)
    case string(String)
    case bool(Bool)
    case metric(MotionMetricValue)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(MotionMetricValue.self) {
            self = .metric(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported motion value"
            )
        }
    }

    var number: Double? {
        guard case let .number(value) = self else { return nil }
        return value
    }

    var string: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }

    var boolean: Bool? {
        guard case let .bool(value) = self else { return nil }
        return value
    }
}

struct MotionMetricValue: Decodable, Equatable {
    let metric: MotionMetric
    let multiplier: Double?
    let offset: Double?
}

enum MotionMetric: String, Decodable, Equatable {
    case screenWidth = "screen.width"
    case screenHeight = "screen.height"
    case screenLeft = "screen.left"
    case screenRight = "screen.right"
    case screenTop = "screen.top"
    case screenBottom = "screen.bottom"
    case screenCenterX = "screen.centerX"
    case screenCenterY = "screen.centerY"
    case safeAreaWidth = "safeArea.width"
    case safeAreaHeight = "safeArea.height"
    case safeAreaLeft = "safeArea.left"
    case safeAreaRight = "safeArea.right"
    case safeAreaTop = "safeArea.top"
    case safeAreaBottom = "safeArea.bottom"
    case safeAreaCenterX = "safeArea.centerX"
    case safeAreaCenterY = "safeArea.centerY"
}

struct MotionIgnoredRule: Decodable {}

internal extension KeyedDecodingContainer {
    func decodeFiniteDouble(forKey key: Key) throws -> Double {
        let value = try decode(Double.self, forKey: key)
        if !value.isFinite {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite"
            )
        }
        return value
    }

    func decodeFiniteDoubleIfPresent(forKey key: Key) throws -> Double? {
        guard let value = try decodeIfPresent(Double.self, forKey: key) else {
            return nil
        }
        if !value.isFinite {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite"
            )
        }
        return value
    }

    func decodeFiniteNonNegativeDouble(forKey key: Key) throws -> Double {
        let value = try decode(Double.self, forKey: key)
        try validateFiniteNonNegative(value, forKey: key)
        return value
    }

    func decodeFinitePositiveDouble(forKey key: Key) throws -> Double {
        let value = try decode(Double.self, forKey: key)
        if !value.isFinite || value <= 0 {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and positive"
            )
        }
        return value
    }

    func decodeFinitePositiveDoubleIfPresent(forKey key: Key) throws -> Double? {
        guard let value = try decodeIfPresent(Double.self, forKey: key) else {
            return nil
        }
        if !value.isFinite || value <= 0 {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and positive"
            )
        }
        return value
    }

    func decodeFiniteNonNegativeDoubleIfPresent(forKey key: Key) throws -> Double? {
        guard let value = try decodeIfPresent(Double.self, forKey: key) else {
            return nil
        }

        try validateFiniteNonNegative(value, forKey: key)
        return value
    }

    func decodeFiniteBoundedDouble(forKey key: Key, min: Double, max: Double) throws -> Double {
        let value = try decode(Double.self, forKey: key)
        try validateFiniteBounded(value, forKey: key, min: min, max: max)
        return value
    }

    func decodeFiniteBoundedDoubleIfPresent(forKey key: Key, min: Double, max: Double) throws -> Double? {
        guard let value = try decodeIfPresent(Double.self, forKey: key) else { return nil }
        try validateFiniteBounded(value, forKey: key, min: min, max: max)
        return value
    }

    func decodeUnitInterval(forKey key: Key) throws -> Double {
        return try decodeFiniteBoundedDouble(forKey: key, min: 0, max: 1)
    }

    func decodeUnitIntervalIfPresent(forKey key: Key) throws -> Double? {
        return try decodeFiniteBoundedDoubleIfPresent(forKey: key, min: 0, max: 1)
    }

    func decodeOpenUnitInterval(forKey key: Key) throws -> Double {
        let value = try decode(Double.self, forKey: key)
        if !value.isFinite || value <= 0 || value > 1 {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and within (0, 1]"
            )
        }
        return value
    }

    func decodeOpenUnitIntervalIfPresent(forKey key: Key) throws -> Double? {
        guard let value = try decodeIfPresent(Double.self, forKey: key) else { return nil }
        if !value.isFinite || value <= 0 || value > 1 {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and within (0, 1]"
            )
        }
        return value
    }

    private func validateFiniteBounded(_ value: Double, forKey key: Key, min: Double, max: Double) throws {
        if !value.isFinite || value < min || value > max {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and within [\(min), \(max)]"
            )
        }
    }

    private func validateFiniteNonNegative(_ value: Double, forKey key: Key) throws {
        if !value.isFinite || value < 0 {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "\(key.stringValue) must be finite and non-negative"
            )
        }
    }
}
