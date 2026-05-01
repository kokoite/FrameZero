import SwiftUI
import XCTest
@testable import MotionEngineKit

final class MotionChannelInspectorTests: XCTestCase {
    @MainActor
    func testEmptyEngineSnapshotIsEmpty() {
        XCTAssertTrue(MotionEngine().channelSnapshots().isEmpty)
    }

    @MainActor
    func testSnapshotsAfterLoadReturnsExpectedChannels() throws {
        let engine = MotionEngine()
        try engine.load(data: Data(contentsOf: fixtureURL("Phase1Card.motion.json")))

        let snapshots = engine.channelSnapshots()
        let pairs = Set(snapshots.map { "\($0.nodeID).\($0.property)" })

        XCTAssertGreaterThan(snapshots.count, 0)
        XCTAssertTrue(pairs.contains("sourceShape.scale"))
        XCTAssertTrue(pairs.contains("destinationShape.opacity"))
    }

    @MainActor
    func testRuleKindMapping() throws {
        let timed = MotionEngine()
        try timed.load(jsonString: inspectorDocument(motion: #"{ "type": "timed", "duration": 0.2, "easing": "linear" }"#))
        timed.handleTap(on: "card")
        XCTAssertTrue(timed.channelSnapshots().contains { $0.nodeID == "card" && $0.property == "opacity" && $0.rule == .timed })

        let spring = MotionEngine()
        try spring.load(jsonString: inspectorDocument(motion: #"{ "type": "spring", "response": 0.3, "dampingFraction": 0.8 }"#))
        spring.handleTap(on: "card")
        XCTAssertTrue(spring.channelSnapshots().contains { $0.nodeID == "card" && $0.property == "opacity" && $0.rule == .spring })
    }

    @MainActor
    func testElapsedAdvances() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: inspectorDocument(motion: #"{ "type": "timed", "duration": 0.2, "easing": "linear" }"#))

        engine.handleTap(on: "card")
        _ = engine.tick(dt: 0.05)

        XCTAssertTrue(engine.channelSnapshots().contains { $0.elapsed > 0 })
    }

    @MainActor
    func testIsSettledAfterTickToCompletion() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: inspectorDocument(motion: #"{ "type": "timed", "duration": 0.2, "easing": "linear" }"#))

        engine.handleTap(on: "card")
        engine.advance(seconds: 0.4)

        let matching = engine.channelSnapshots().filter { $0.nodeID == "card" && $0.property == "opacity" }
        XCTAssertFalse(matching.isEmpty)
        XCTAssertTrue(matching.allSatisfy(\.isSettled))
        XCTAssertTrue(matching.allSatisfy { $0.velocity == 0 })
    }

    @MainActor
    func testIsDragOverriddenWhenDragging() throws {
        let engine = MotionEngine()
        try engine.load(data: Data(contentsOf: fixtureURL("Phase1Card.motion.json")))
        engine.updateViewport(size: CGSize(width: 390, height: 844), safeAreaInsets: EdgeInsets())

        engine.handleDragChanged(on: "sourceShape", sample: MotionDragSample(
            translationX: 40,
            translationY: 10,
            predictedTranslationX: 40,
            predictedTranslationY: 10
        ))

        XCTAssertTrue(engine.channelSnapshots().contains { $0.nodeID == "sourceShape" && $0.isDragOverridden })

        engine.handleDragEnded(on: "sourceShape", sample: MotionDragSample(
            translationX: 40,
            translationY: 10,
            predictedTranslationX: 40,
            predictedTranslationY: 10
        ))
        engine.advance(seconds: 0.4)

        XCTAssertFalse(engine.channelSnapshots().contains { $0.nodeID == "sourceShape" && $0.isDragOverridden })
    }

    @MainActor
    func testDeterminism() throws {
        let first = MotionEngine()
        let second = MotionEngine()
        let document = inspectorDocument(motion: #"{ "type": "timed", "duration": 0.2, "easing": "linear" }"#)
        try first.load(jsonString: document)
        try second.load(jsonString: document)

        first.handleTap(on: "card")
        second.handleTap(on: "card")
        for dt in [0.01, 0.02, 0.05, 0.1] {
            _ = first.tick(dt: dt)
            _ = second.tick(dt: dt)
        }

        XCTAssertEqual(first.channelSnapshots(), second.channelSnapshots())
    }

    @MainActor
    func testSnapshotIsReadOnly() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: inspectorDocument(motion: #"{ "type": "timed", "duration": 0.2, "easing": "linear" }"#))
        let before = try XCTUnwrap(engine.channelSnapshots().first { $0.nodeID == "card" && $0.property == "opacity" })

        engine.handleTap(on: "card")
        _ = engine.tick(dt: 0.05)

        let after = try XCTUnwrap(engine.channelSnapshots().first { $0.nodeID == "card" && $0.property == "opacity" })
        XCTAssertEqual(before.current, 0)
        XCTAssertNotEqual(before.current, after.current)
    }

    private func fixtureURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Examples")
            .appendingPathComponent(name)
    }

    private func inspectorDocument(motion: String) -> String {
        """
        {
          "schemaVersion": 1,
          "root": "screen",
          "nodes": [
            {
              "id": "screen",
              "kind": "zstack",
              "roles": ["screen"],
              "layout": {},
              "style": {},
              "presentation": {},
              "children": ["card"]
            },
            {
              "id": "card",
              "kind": "roundedRectangle",
              "roles": ["card"],
              "layout": { "width": 10, "height": 10 },
              "style": { "backgroundColor": "#FFFFFF" },
              "presentation": { "opacity": 0 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "machine",
              "initial": "idle",
              "states": [
                { "id": "idle", "values": [{ "select": { "id": "card", "properties": ["opacity"] }, "value": 0 }] },
                { "id": "active", "values": [{ "select": { "id": "card", "properties": ["opacity"] }, "value": 1 }] }
              ],
              "transitions": [
                {
                  "id": "activate",
                  "from": "idle",
                  "to": "active",
                  "trigger": "tapCard",
                  "rules": [{ "select": { "id": "card", "properties": ["opacity"] }, "motion": \(motion) }],
                  "arcs": [],
                  "jiggles": [],
                  "enter": [],
                  "exit": [],
                  "spawns": [],
                  "actions": []
                }
              ]
            }
          ],
          "triggers": [{ "id": "tapCard", "type": "tap", "selector": { "id": "card" } }],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }
}

private extension MotionEngine {
    func advance(seconds: Double, frame: Double = 1.0 / 60.0) {
        var elapsed = 0.0
        while elapsed < seconds {
            let step = min(frame, seconds - elapsed)
            _ = tick(dt: step)
            elapsed += step
        }
    }
}
