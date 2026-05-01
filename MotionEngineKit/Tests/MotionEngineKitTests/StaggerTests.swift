import XCTest
@testable import MotionEngineKit

final class StaggerTests: XCTestCase {
    @MainActor
    func testRoleRuleStaggersNodesInSortedOrder() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(ruleFields: #""stagger": 0.1"#))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.05)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "opacity", default: -1), 0)
        XCTAssertEqual(engine.number(for: "card.b", property: "opacity", default: -1), 0, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "card.c", property: "opacity", default: -1), 0, accuracy: 0.001)

        engine.advanceForStaggerTesting(seconds: 0.10)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "opacity", default: -1), 0)
        XCTAssertGreaterThan(engine.number(for: "card.b", property: "opacity", default: -1), 0)
        XCTAssertEqual(engine.number(for: "card.c", property: "opacity", default: -1), 0, accuracy: 0.001)

        engine.advanceForStaggerTesting(seconds: 0.10)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "opacity", default: -1), 0)
        XCTAssertGreaterThan(engine.number(for: "card.b", property: "opacity", default: -1), 0)
        XCTAssertGreaterThan(engine.number(for: "card.c", property: "opacity", default: -1), 0)
    }

    @MainActor
    func testDelayAndStaggerAddTogether() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(
            nodes: ["card.b", "card.a"],
            ruleFields: #""delay": 0.2, "stagger": 0.1"#
        ))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.19)
        XCTAssertEqual(engine.number(for: "card.a", property: "opacity", default: -1), 0, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "card.b", property: "opacity", default: -1), 0, accuracy: 0.001)

        engine.advanceForStaggerTesting(seconds: 0.02)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "opacity", default: -1), 0)
        XCTAssertEqual(engine.number(for: "card.b", property: "opacity", default: -1), 0, accuracy: 0.001)

        engine.advanceForStaggerTesting(seconds: 0.10)
        XCTAssertGreaterThan(engine.number(for: "card.b", property: "opacity", default: -1), 0)
    }

    @MainActor
    func testMultiplePropertiesOnSameNodeShareStaggerIndex() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(
            nodes: ["card.a"],
            properties: ["scale.x", "scale.y"],
            inactiveValue: 1,
            activeValue: 2,
            ruleFields: #""stagger": 0.1"#
        ))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.05)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "scale.x", default: -1), 1)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "scale.y", default: -1), 1)
    }

    func testDecodeRejectsNegativeRuleStagger() {
        XCTAssertThrowsError(try decodeTransition(ruleFields: #""stagger": -0.1"#))
    }

    func testDecodeRejectsNaNRuleStagger() {
        let json = transitionJSON(ruleFields: #""stagger": "NaN""#)
        let decoder = JSONDecoder()
        decoder.nonConformingFloatDecodingStrategy = .convertFromString(
            positiveInfinity: "Infinity",
            negativeInfinity: "-Infinity",
            nan: "NaN"
        )

        XCTAssertThrowsError(try decoder.decode(MotionTransition.self, from: Data(json.utf8)))
    }

    @MainActor
    func testRuleWithoutStaggerStartsAllNodesTogether() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(ruleFields: ""))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.05)
        let a = engine.number(for: "card.a", property: "opacity", default: -1)
        XCTAssertGreaterThan(a, 0)
        XCTAssertEqual(engine.number(for: "card.b", property: "opacity", default: -1), a, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "card.c", property: "opacity", default: -1), a, accuracy: 0.001)
    }

    @MainActor
    func testArcStaggersNodesInSortedOrder() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(
            nodes: ["card.b", "card.a"],
            properties: ["offset.x", "offset.y"],
            inactiveValue: 0,
            activeValue: 100,
            ruleFields: "",
            arcs: """
            {
              "select": { "role": "card" },
              "x": "offset.x",
              "y": "offset.y",
              "direction": "clockwise",
              "motion": { "type": "timed", "duration": 1.0, "easing": "linear" },
              "stagger": 0.1
            }
            """
        ))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.05)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "offset.x", default: -1), 0)
        XCTAssertEqual(engine.number(for: "card.b", property: "offset.x", default: -1), 0, accuracy: 0.001)
    }

    @MainActor
    func testJiggleStaggersNodesInSortedOrder() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: staggerDocument(
            nodes: ["card.b", "card.a"],
            properties: ["offset.x"],
            inactiveValue: 0,
            activeValue: 0,
            ruleFields: "",
            jiggles: """
            {
              "select": { "role": "card", "properties": ["offset.x"] },
              "amplitude": 10,
              "duration": 1.0,
              "cycles": 0.25,
              "startDirection": "positive",
              "stagger": 0.1
            }
            """
        ))

        engine.handleTap(on: "card.a")
        engine.advanceForStaggerTesting(seconds: 0.05)
        XCTAssertGreaterThan(engine.number(for: "card.a", property: "offset.x", default: -1), 0)
        XCTAssertEqual(engine.number(for: "card.b", property: "offset.x", default: -1), 0, accuracy: 0.001)
    }

    private func decodeTransition(ruleFields: String) throws {
        _ = try JSONDecoder().decode(MotionTransition.self, from: Data(transitionJSON(ruleFields: ruleFields).utf8))
    }

    private func transitionJSON(ruleFields: String) -> String {
        """
        {
          "id": "activate",
          "from": "idle",
          "to": "active",
          "trigger": "tapCard",
          "rules": [
            {
              "select": { "role": "card", "properties": ["opacity"] },
              "motion": { "type": "timed", "duration": 1.0, "easing": "linear" }\(ruleFields.isEmpty ? "" : ",")
              \(ruleFields)
            }
          ],
          "arcs": [],
          "jiggles": [],
          "enter": [],
          "exit": [],
          "spawns": [],
          "actions": []
        }
        """
    }

    private func staggerDocument(
        nodes: [String] = ["card.b", "card.a", "card.c"],
        properties: [String] = ["opacity"],
        inactiveValue: Double = 0,
        activeValue: Double = 1,
        ruleFields: String,
        arcs: String = "",
        jiggles: String = ""
    ) -> String {
        let nodeJSON = nodes.map { nodeID in
            """
            {
              "id": "\(nodeID)",
              "kind": "roundedRectangle",
              "roles": ["card"],
              "layout": { "width": 10, "height": 10 },
              "style": { "backgroundColor": "#FFFFFF" },
              "presentation": {\(properties.map { #""\#($0)": \#(inactiveValue)"# }.joined(separator: ", "))},
              "children": []
            }
            """
        }.joined(separator: ",")
        let propertyList = properties.map { #""\#($0)""# }.joined(separator: ", ")

        return """
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
              "children": [\(nodes.map { #""\#($0)""# }.joined(separator: ", "))]
            },
            \(nodeJSON)
          ],
          "machines": [
            {
              "id": "machine",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "role": "card", "properties": [\(propertyList)] }, "value": \(inactiveValue) }
                  ]
                },
                {
                  "id": "active",
                  "values": [
                    { "select": { "role": "card", "properties": [\(propertyList)] }, "value": \(activeValue) }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "activate",
                  "from": "idle",
                  "to": "active",
                  "trigger": "tapCard",
                  "rules": [
                    {
                      "select": { "role": "card", "properties": [\(propertyList)] },
                      "motion": { "type": "timed", "duration": 1.0, "easing": "linear" }\(ruleFields.isEmpty ? "" : ",")
                      \(ruleFields)
                    }
                  ],
                  "arcs": [\(arcs)],
                  "jiggles": [\(jiggles)],
                  "enter": [],
                  "exit": [],
                  "spawns": [],
                  "actions": []
                }
              ]
            }
          ],
          "triggers": [
            { "id": "tapCard", "type": "tap", "selector": { "id": "card.a" } }
          ],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """
    }
}

private extension MotionEngine {
    func advanceForStaggerTesting(seconds: Double, frame: Double = 1.0 / 60.0) {
        var elapsed = 0.0
        while elapsed < seconds {
            let step = min(frame, seconds - elapsed)
            _ = tick(dt: step)
            elapsed += step
        }
    }
}
