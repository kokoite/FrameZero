import Foundation

typealias NodeID = String
typealias MachineID = String
typealias StateID = String
typealias TriggerID = String
typealias TransitionID = String

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
    let presentation: [String: MotionValue]
    let children: [NodeID]
    let presence: MotionPresence?
}

enum MotionNodeKind: String, Decodable {
    case zstack
    case vstack
    case hstack
    case text
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
