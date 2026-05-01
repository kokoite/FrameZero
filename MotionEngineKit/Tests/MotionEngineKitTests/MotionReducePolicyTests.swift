import XCTest
@testable import MotionEngineKit

final class MotionReducePolicyTests: XCTestCase {
    @MainActor
    func testDecorativeSpringCollapsesToShortTimedWhenReduceMotionIsOn() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "decorative"))

        engine.handleTap(on: "card")
        engine.advanceForReduceMotionTesting(seconds: 0.16)

        XCTAssertEqual(engine.number(for: "card", property: "offset.x", default: 0), 100, accuracy: 0.001)
    }

    @MainActor
    func testEssentialSpringIsPreservedWhenReduceMotionIsOn() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "essential"))

        engine.handleTap(on: "card")
        engine.advanceForReduceMotionTesting(seconds: 0.16)

        XCTAssertNotEqual(engine.number(for: "card", property: "offset.x", default: 0), 100, accuracy: 0.01)
    }

    @MainActor
    func testIgnorePolicyPreservesSpringWhenReduceMotionIsOn() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "ignore", ruleSensitivity: "decorative"))

        engine.handleTap(on: "card")
        engine.advanceForReduceMotionTesting(seconds: 0.16)

        XCTAssertNotEqual(engine.number(for: "card", property: "offset.x", default: 0), 100, accuracy: 0.01)
    }

    @MainActor
    func testRespectPolicyPreservesSpringWhenReduceMotionIsOff() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: false))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "decorative"))

        engine.handleTap(on: "card")
        engine.advanceForReduceMotionTesting(seconds: 0.16)

        XCTAssertNotEqual(engine.number(for: "card", property: "offset.x", default: 0), 100, accuracy: 0.01)
    }

    @MainActor
    func testDecorativeActionsNoopWhenReduceMotionIsOn() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "decorative", actions: """
        [
          { "type": "screenShake", "amplitude": 8, "duration": 0.2, "frequency": 12, "decay": 1 }
        ]
        """))

        engine.handleTap(on: "card")

        XCTAssertEqual(engine.screenShakeOffset().x, 0, accuracy: 0.001)
        XCTAssertEqual(engine.screenShakeOffset().y, 0, accuracy: 0.001)
    }

    @MainActor
    func testEmitParticlesIsNoopWhenReduceMotionIsOnAndDecorative() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "decorative", actions: """
        [
          {
            "type": "emitParticles",
            "id": "tapBurst",
            "selector": { "id": "card" },
            "count": 4,
            "angle": { "min": 0, "max": 270 },
            "distance": { "min": 20, "max": 40 },
            "particle": {
              "kind": "circle",
              "layout": { "width": 6, "height": 6 },
              "style": { "backgroundColor": "#38BDF8" },
              "from": { "scale": 1, "opacity": 1 },
              "to": { "scale": 0.2, "opacity": 0 },
              "motion": { "type": "timed", "duration": 0.2, "easing": "easeOut" },
              "lifetime": 0.2
            }
          }
        ]
        """))

        engine.handleTap(on: "card")

        XCTAssertTrue(engine.particles().isEmpty)
    }

    @MainActor
    func testSpawnComponentsIsNoopWhenReduceMotionIsOnAndDecorative() throws {
        let engine = MotionEngine(accessibility: MockMotionAccessibility(isReduceMotionEnabled: true))
        try engine.load(jsonString: reduceMotionDocument(policy: "respect", ruleSensitivity: "decorative", actions: """
        [
          {
            "type": "spawnComponents",
            "id": "twinComponents",
            "selector": { "id": "card" },
            "components": [
              {
                "id": "leftSpark",
                "kind": "circle",
                "layout": { "width": 12, "height": 12 },
                "style": { "backgroundColor": "#38BDF8" },
                "from": { "offset.x": 0, "scale": 0.6, "opacity": 1 },
                "to": { "offset.x": -48, "scale": 1.2, "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.3, "easing": "easeOut" },
                "lifetime": 0.3
              }
            ]
          }
        ]
        """))

        engine.handleTap(on: "card")

        XCTAssertTrue(engine.components().isEmpty)
    }

    @MainActor
    func testAccessibilityToggleUpdatesPublishedFlag() async throws {
        let accessibility = MockMotionAccessibility(isReduceMotionEnabled: false)
        let engine = MotionEngine(accessibility: accessibility)

        XCTAssertFalse(engine.isMotionReduced)
        accessibility.setReduceMotionEnabled(true)
        await Task.yield()

        XCTAssertTrue(engine.isMotionReduced)
    }

    private func reduceMotionDocument(
        policy: String,
        ruleSensitivity: String,
        actions: String = "[]"
    ) -> String {
        """
        {
          "schemaVersion": 1,
          "reduceMotionPolicy": "\(policy)",
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
              "roles": [],
              "layout": {},
              "style": {},
              "presentation": { "offset.x": 0 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "main",
              "initial": "idle",
              "states": [
                { "id": "idle", "values": [{ "select": { "id": "card", "properties": ["offset.x"] }, "value": 0 }] },
                { "id": "moved", "values": [{ "select": { "id": "card", "properties": ["offset.x"] }, "value": 100 }] }
              ],
              "transitions": [
                {
                  "id": "move",
                  "from": "idle",
                  "to": "moved",
                  "trigger": "tapCard",
                  "rules": [
                    {
                      "select": { "id": "card", "properties": ["offset.x"] },
                      "motion": { "type": "spring", "response": 1, "dampingFraction": 0.7 },
                      "motionSensitivity": "\(ruleSensitivity)"
                    }
                  ],
                  "arcs": [],
                  "jiggles": [],
                  "actions": \(actions)
                }
              ]
            }
          ],
          "triggers": [
            { "id": "tapCard", "type": "tap", "selector": { "id": "card" } }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }
}

private final class MockMotionAccessibility: MotionAccessibility {
    private var handler: ((Bool) -> Void)?
    var isReduceMotionEnabled: Bool

    init(isReduceMotionEnabled: Bool) {
        self.isReduceMotionEnabled = isReduceMotionEnabled
    }

    func observeChanges(_ handler: @escaping (Bool) -> Void) -> AnyObject {
        self.handler = handler
        return NSObject()
    }

    func setReduceMotionEnabled(_ enabled: Bool) {
        isReduceMotionEnabled = enabled
        handler?(enabled)
    }
}

private extension MotionEngine {
    func advanceForReduceMotionTesting(seconds: Double, frame: Double = 1.0 / 60.0) {
        var elapsed = 0.0
        while elapsed < seconds {
            let step = min(frame, seconds - elapsed)
            _ = tick(dt: step)
            elapsed += step
        }
    }
}
