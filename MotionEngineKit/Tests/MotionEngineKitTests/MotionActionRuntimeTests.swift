import XCTest
@testable import MotionEngineKit

final class MotionActionRuntimeTests: XCTestCase {
    @MainActor
    func testTapTransitionSpawnsParticlesAndScreenShake() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: actionDocument(actions: """
        [
          { "type": "screenShake", "amplitude": 6, "duration": 0.2, "frequency": 12, "decay": 1 },
          {
            "type": "emitParticles",
            "id": "tapBurst",
            "selector": { "id": "orb" },
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

        XCTAssertTrue(engine.particles().isEmpty)
        XCTAssertEqual(engine.screenShakeOffset().x, 0, accuracy: 0.001)
        XCTAssertEqual(engine.screenShakeOffset().y, 0, accuracy: 0.001)

        engine.handleTap(on: "orb")

        XCTAssertEqual(engine.particles().count, 4)
        XCTAssertNotEqual(engine.screenShakeOffset().y, 0)

        engine.advanceForTesting(seconds: 0.3)

        XCTAssertTrue(engine.particles().isEmpty)
        XCTAssertEqual(engine.screenShakeOffset().x, 0, accuracy: 0.001)
        XCTAssertEqual(engine.screenShakeOffset().y, 0, accuracy: 0.001)
    }

    @MainActor
    func testTapTransitionSpawnsDistinctComponents() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: actionDocument(actions: """
        [
          {
            "type": "spawnComponents",
            "id": "twinComponents",
            "selector": { "id": "orb" },
            "components": [
              {
                "id": "leftSpark",
                "kind": "circle",
                "layout": { "width": 12, "height": 12 },
                "style": { "backgroundColor": "#38BDF8", "gradientEndColor": "#B58CFF", "gradientAngle": 135 },
                "fills": [
                  {
                    "type": "linearGradient",
                    "colors": [
                      { "color": "#38BDF8", "position": 0 },
                      { "color": "#B58CFF", "position": 1 }
                    ],
                    "angle": 135
                  }
                ],
                "from": { "offset.x": -8, "offset.y": 0, "scale": 0.6, "opacity": 1 },
                "to": { "offset.x": -48, "offset.y": -30, "scale": 1.2, "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.3, "easing": "easeOut" },
                "lifetime": 0.3
              },
              {
                "id": "score",
                "kind": "text",
                "layout": { "width": 70, "height": 28 },
                "style": { "text": "+10", "foregroundColor": "#FFFFFF" },
                "from": { "offset.x": 8, "offset.y": 0, "opacity": 1 },
                "to": { "offset.x": 54, "offset.y": -48, "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.3, "easing": "easeOut" },
                "lifetime": 0.3
              }
            ]
          }
        ]
        """))

        engine.handleTap(on: "orb")

        let components = engine.components()
        XCTAssertEqual(components.count, 2)
        XCTAssertTrue(components[0].id.contains("twinComponents-leftSpark"))
        XCTAssertTrue(components[1].id.contains("twinComponents-score"))
        XCTAssertEqual(components[0].style["gradientEndColor"]?.string, "#B58CFF")
        XCTAssertEqual(components[0].fills.count, 1)
        XCTAssertEqual(components[0].fills[0].type, .linearGradient)
        XCTAssertEqual(components[1].style["text"]?.string, "+10")

        engine.advanceForTesting(seconds: 0.35)

        XCTAssertTrue(engine.components().isEmpty)
    }

    @MainActor
    func testSequenceDelayDefersParticleEmission() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: actionDocument(actions: """
        [
          {
            "type": "sequence",
            "actions": [
              { "type": "delay", "duration": 0.1 },
              {
                "type": "emitParticles",
                "id": "delayedBurst",
                "selector": { "id": "orb" },
                "count": 2,
                "particle": {
                  "kind": "circle",
                  "layout": { "width": 4, "height": 4 },
                  "style": { "backgroundColor": "#FFFFFF" },
                  "from": { "opacity": 1 },
                  "to": { "opacity": 0 },
                  "motion": { "type": "timed", "duration": 0.2, "easing": "linear" },
                  "lifetime": 0.2
                }
              }
            ]
          }
        ]
        """))

        engine.handleTap(on: "orb")
        XCTAssertTrue(engine.particles().isEmpty)

        engine.advanceForTesting(seconds: 0.05)
        XCTAssertTrue(engine.particles().isEmpty)

        engine.advanceForTesting(seconds: 0.06)
        XCTAssertEqual(engine.particles().count, 2)
    }

    @MainActor
    func testStateChangeCancelsStaleDelayedActions() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staleDelayedActionDocument())

        engine.handleTap(on: "orb")
        engine.advanceForTesting(seconds: 0.06)
        engine.advanceForTesting(seconds: 0.3)

        XCTAssertTrue(engine.particles().isEmpty)
    }

    @MainActor
    func testStateChangeInOtherMachineDoesNotCancelDelayedAction() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: delayedActionAcrossMachinesDocument())

        engine.handleTap(on: "orb")
        engine.advanceForTesting(seconds: 0.08)
        XCTAssertTrue(engine.particles().isEmpty)

        engine.advanceForTesting(seconds: 0.14)
        XCTAssertEqual(engine.particles().count, 2)
    }

    @MainActor
    func testHapticActionUsesInjectedPerformer() throws {
        let engine = MotionEngine()
        let performer = RecordingHapticPerformer()
        engine.setHapticPerformerForTesting(performer)
        try engine.load(jsonString: actionDocument(actions: """
        [
          { "type": "haptic", "style": "success", "intensity": 0.7 }
        ]
        """))

        engine.handleTap(on: "orb")

        XCTAssertEqual(performer.actions.map(\.style), [.success])
        XCTAssertEqual(performer.actions.first?.intensity, 0.7)
    }

    @MainActor
    func testRejectsUnsupportedParticleProperties() {
        let engine = MotionEngine()

        XCTAssertThrowsError(try engine.load(jsonString: actionDocument(actions: """
        [
          {
            "type": "emitParticles",
            "id": "badParticle",
            "selector": { "id": "orb" },
            "count": 2,
            "particle": {
              "kind": "circle",
              "layout": { "width": 4, "height": 4 },
              "style": { "backgroundColor": "#FFFFFF" },
              "from": { "blur": 10, "opacity": 1 },
              "to": { "opacity": 0 },
              "motion": { "type": "timed", "duration": 0.2, "easing": "linear" },
              "lifetime": 0.2
            }
          }
        ]
        """)))
    }

    @MainActor
    func testRejectsUnsupportedComponentProperties() {
        let engine = MotionEngine()

        XCTAssertThrowsError(try engine.load(jsonString: actionDocument(actions: """
        [
          {
            "type": "spawnComponents",
            "id": "badComponents",
            "components": [
              {
                "id": "bad",
                "kind": "circle",
                "layout": { "width": 4, "height": 4 },
                "style": { "backgroundColor": "#FFFFFF" },
                "from": { "blur": 10, "opacity": 1 },
                "to": { "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.2, "easing": "linear" },
                "lifetime": 0.2
              }
            ]
          }
        ]
        """)))
    }

    private func actionDocument(actions: String) -> String {
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
              "children": ["orb"]
            },
            {
              "id": "orb",
              "kind": "circle",
              "roles": ["target"],
              "layout": { "width": 60, "height": 60 },
              "style": { "backgroundColor": "#38BDF8" },
              "presentation": { "offset.x": 0, "offset.y": 0, "scale": 1, "opacity": 1 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "machine",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "feedback",
                  "from": "idle",
                  "to": "idle",
                  "trigger": "tapOrb",
                  "rules": [],
                  "actions": \(actions)
                }
              ]
            }
          ],
          "triggers": [
            { "id": "tapOrb", "type": "tap", "selector": { "id": "orb" } }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }

    private func staleDelayedActionDocument() -> String {
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
              "children": ["orb"]
            },
            {
              "id": "orb",
              "kind": "circle",
              "roles": ["target"],
              "layout": { "width": 60, "height": 60 },
              "style": { "backgroundColor": "#38BDF8" },
              "presentation": { "offset.x": 0, "offset.y": 0, "scale": 1, "opacity": 1 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "machine",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                },
                {
                  "id": "middle",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 10 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                },
                {
                  "id": "end",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 20 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "tapToMiddle",
                  "from": "idle",
                  "to": "middle",
                  "trigger": "tapOrb",
                  "rules": [],
                  "actions": [
                    {
                      "type": "sequence",
                      "actions": [
                        { "type": "delay", "duration": 0.2 },
                        {
                          "type": "emitParticles",
                          "id": "staleBurst",
                          "selector": { "id": "orb" },
                          "count": 2,
                          "particle": {
                            "kind": "circle",
                            "layout": { "width": 4, "height": 4 },
                            "style": { "backgroundColor": "#FFFFFF" },
                            "from": { "opacity": 1 },
                            "to": { "opacity": 0 },
                            "motion": { "type": "timed", "duration": 0.2, "easing": "linear" },
                            "lifetime": 0.2
                          }
                        }
                      ]
                    }
                  ]
                },
                {
                  "id": "middleToEnd",
                  "from": "middle",
                  "to": "end",
                  "trigger": "after",
                  "delay": 0.05,
                  "rules": [],
                  "actions": []
                }
              ]
            }
          ],
          "triggers": [
            { "id": "tapOrb", "type": "tap", "selector": { "id": "orb" } },
            { "id": "after", "type": "after" }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }

    private func delayedActionAcrossMachinesDocument() -> String {
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
              "children": ["orb"]
            },
            {
              "id": "orb",
              "kind": "circle",
              "roles": ["target"],
              "layout": { "width": 60, "height": 60 },
              "style": { "backgroundColor": "#38BDF8" },
              "presentation": { "offset.x": 0, "offset.y": 0, "scale": 1, "opacity": 1 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "feedback",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                },
                {
                  "id": "armed",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "tapToArmed",
                  "from": "idle",
                  "to": "armed",
                  "trigger": "tapOrb",
                  "rules": [],
                  "actions": [
                    {
                      "type": "sequence",
                      "actions": [
                        { "type": "delay", "duration": 0.2 },
                        {
                          "type": "emitParticles",
                          "id": "survivesOtherMachine",
                          "selector": { "id": "orb" },
                          "count": 2,
                          "particle": {
                            "kind": "circle",
                            "layout": { "width": 4, "height": 4 },
                            "style": { "backgroundColor": "#FFFFFF" },
                            "from": { "opacity": 1 },
                            "to": { "opacity": 0 },
                            "motion": { "type": "timed", "duration": 0.2, "easing": "linear" },
                            "lifetime": 0.2
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "id": "layout",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                },
                {
                  "id": "shifted",
                  "values": [
                    { "select": { "id": "orb", "properties": ["offset.x"] }, "value": 8 },
                    { "select": { "id": "orb", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "orb", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "orb", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "autoShift",
                  "from": "idle",
                  "to": "shifted",
                  "trigger": "auto",
                  "delay": 0.05,
                  "rules": [],
                  "actions": []
                }
              ]
            }
          ],
          "triggers": [
            { "id": "tapOrb", "type": "tap", "selector": { "id": "orb" } },
            { "id": "auto", "type": "automatic" }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }
}

private final class RecordingHapticPerformer: MotionHapticPerformer {
    private(set) var actions: [MotionHapticAction] = []

    func perform(_ action: MotionHapticAction) {
        actions.append(action)
    }
}

private extension MotionEngine {
    func advanceForTesting(seconds: Double, frame: Double = 1.0 / 60.0) {
        var elapsed = 0.0
        while elapsed < seconds {
            let step = min(frame, seconds - elapsed)
            _ = tick(dt: step)
            elapsed += step
        }
    }
}
