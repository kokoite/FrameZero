import Foundation
import SwiftUI
import XCTest
@testable import MotionEngineKit

final class MotionRuntimeTraceTests: XCTestCase {
    private let dt = 1.0 / 60.0
    private let stepCount = 200
    private let applyStateAt = 30

    @MainActor
    func testWritesPhase1CardRuntimeTrace() throws {
        let engine = MotionEngine()
        engine.updateViewport(
            size: CGSize(width: 390, height: 844),
            safeAreaInsets: EdgeInsets(top: 47, leading: 0, bottom: 34, trailing: 0)
        )
        try engine.load(data: Data(contentsOf: phase1CardURL()))

        let channels = engine.channelSnapshots().map {
            TraceChannel(nodeID: $0.nodeID, property: $0.property)
        }

        var steps: [[TraceStep]] = []
        for step in 0..<stepCount {
            if step == applyStateAt {
                try engine.applyStateForTesting(
                    machineID: "circleMachine",
                    stateID: "completed",
                    transitionID: "completeClockwiseHandoff"
                )
            }

            _ = engine.tick(dt: dt)
            let snapshots = engine.channelSnapshots()
            XCTAssertEqual(
                snapshots.map { "\($0.nodeID).\($0.property)" },
                channels.map { "\($0.nodeID).\($0.property)" }
            )
            steps.append(snapshots.map { TraceStep(current: $0.current, velocity: $0.velocity) })
        }

        let trace = RuntimeTrace(
            fixture: "Phase1Card",
            viewport: TraceViewport(
                width: 390,
                height: 844,
                safeAreaTop: 47,
                safeAreaLeading: 0,
                safeAreaBottom: 34,
                safeAreaTrailing: 0
            ),
            applyStateAt: applyStateAt,
            applyState: TraceApplyState(
                machineID: "circleMachine",
                stateID: "completed",
                transitionID: "completeClockwiseHandoff"
            ),
            dt: dt,
            channels: channels,
            steps: steps
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(trace)
        try data.write(to: fixtureDirectory().appendingPathComponent("runtime-phase1card-trace.json"), options: .atomic)
    }

    private func phase1CardURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Examples")
            .appendingPathComponent("Phase1Card.motion.json")
    }

    private func fixtureDirectory() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
    }
}

private struct RuntimeTrace: Encodable {
    let fixture: String
    let viewport: TraceViewport
    let applyStateAt: Int
    let applyState: TraceApplyState
    let dt: Double
    let channels: [TraceChannel]
    let steps: [[TraceStep]]
}

private struct TraceViewport: Encodable {
    let width: Double
    let height: Double
    let safeAreaTop: Double
    let safeAreaLeading: Double
    let safeAreaBottom: Double
    let safeAreaTrailing: Double
}

private struct TraceApplyState: Encodable {
    let machineID: String
    let stateID: String
    let transitionID: String
}

private struct TraceChannel: Encodable {
    let nodeID: String
    let property: String
}

private struct TraceStep: Encodable {
    let current: Double
    let velocity: Double
}
