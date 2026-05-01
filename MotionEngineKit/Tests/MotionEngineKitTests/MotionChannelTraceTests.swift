import Foundation
import XCTest
@testable import MotionEngineKit

final class MotionChannelTraceTests: XCTestCase {
    private let dt = 1.0 / 60.0

    func testWritesSpringTrace() throws {
        try writeTrace(
            name: "spring",
            motionPayload: .spring(response: 0.4, dampingFraction: 0.7),
            motion: .spring(SpringSpec(type: "spring", response: 0.4, dampingFraction: 0.7)),
            stepCount: 200
        )
    }

    func testWritesTimedTrace() throws {
        try writeTrace(
            name: "timed",
            motionPayload: .timed(duration: 1.0, easing: "easeInOut"),
            motion: .timed(TimedSpec(type: "timed", duration: 1.0, easing: .easeInOut)),
            stepCount: 200
        )
    }

    func testWritesImmediateTrace() throws {
        try writeTrace(
            name: "immediate",
            motionPayload: .immediate,
            motion: .immediate,
            stepCount: 5
        )
    }

    func testWritesSpringRetargetTrace() throws {
        try writeTrace(
            name: "spring-retarget",
            motionPayload: .spring(response: 0.4, dampingFraction: 0.7),
            motion: .spring(SpringSpec(type: "spring", response: 0.4, dampingFraction: 0.7)),
            stepCount: 200,
            retargetAt: 18,
            newTarget: 50
        )
    }

    private func writeTrace(
        name: String,
        motionPayload: TraceMotion,
        motion: MotionSpec,
        stepCount: Int,
        retargetAt: Int? = nil,
        newTarget: Double? = nil
    ) throws {
        var channel = MotionChannel(
            current: 0,
            velocity: 0,
            target: 0,
            motion: .immediate,
            animationStart: 0,
            animationElapsed: 0
        )
        channel.setTarget(100, motion: motion)

        var steps = [TraceStep(current: channel.current, velocity: channel.velocity)]
        for step in 0..<stepCount {
            if step == retargetAt {
                channel.setTarget(newTarget ?? channel.target, motion: motion)
            }
            channel.integrate(dt: dt)
            steps.append(TraceStep(current: channel.current, velocity: channel.velocity))
        }

        let trace = Trace(
            name: name,
            initial: TraceInitial(current: 0, velocity: 0, target: 100),
            motion: motionPayload,
            dt: dt,
            retargetAt: retargetAt,
            newTarget: newTarget,
            steps: steps
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(trace)
        try data.write(to: fixtureDirectory().appendingPathComponent("\(name)-trace.json"), options: .atomic)
    }

    private func fixtureDirectory() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
    }
}

private struct Trace: Encodable {
    let name: String
    let initial: TraceInitial
    let motion: TraceMotion
    let dt: Double
    let retargetAt: Int?
    let newTarget: Double?
    let steps: [TraceStep]
}

private struct TraceInitial: Encodable {
    let current: Double
    let velocity: Double
    let target: Double
}

private struct TraceStep: Encodable {
    let current: Double
    let velocity: Double
}

private enum TraceMotion: Encodable {
    case spring(response: Double, dampingFraction: Double)
    case timed(duration: Double, easing: String)
    case immediate

    private enum CodingKeys: String, CodingKey {
        case type
        case response
        case dampingFraction
        case duration
        case easing
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .spring(response, dampingFraction):
            try container.encode("spring", forKey: .type)
            try container.encode(response, forKey: .response)
            try container.encode(dampingFraction, forKey: .dampingFraction)
        case let .timed(duration, easing):
            try container.encode("timed", forKey: .type)
            try container.encode(duration, forKey: .duration)
            try container.encode(easing, forKey: .easing)
        case .immediate:
            try container.encode("immediate", forKey: .type)
        }
    }
}
