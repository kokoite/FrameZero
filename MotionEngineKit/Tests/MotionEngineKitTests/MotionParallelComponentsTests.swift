import XCTest
@testable import MotionEngineKit

final class MotionParallelComponentsTests: XCTestCase {
    @MainActor
    func testRoleSelectorAnimatesMultipleExistingComponentsInParallel() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: parallelComponentsDocument())

        XCTAssertEqual(engine.number(for: "card", property: "offset.x", default: -1), 0, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "icon", property: "offset.x", default: -1), 0, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "title", property: "opacity", default: -1), 0.35, accuracy: 0.001)

        engine.handleTap(on: "card")
        engine.advanceForTesting(seconds: 0.2)

        XCTAssertEqual(engine.number(for: "card", property: "offset.x", default: -1), 32, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "icon", property: "offset.x", default: -1), 32, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "card", property: "scale", default: -1), 1.1, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "icon", property: "scale", default: -1), 1.1, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "title", property: "offset.y", default: -1), -12, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "title", property: "opacity", default: -1), 0.675, accuracy: 0.001)

        engine.advanceForTesting(seconds: 0.25)

        XCTAssertEqual(engine.number(for: "card", property: "offset.x", default: -1), 64, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "icon", property: "offset.x", default: -1), 64, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "title", property: "offset.y", default: -1), -24, accuracy: 0.001)
        XCTAssertEqual(engine.number(for: "title", property: "opacity", default: -1), 1, accuracy: 0.001)
    }

    private func parallelComponentsDocument() -> String {
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
              "children": ["card", "icon", "title"]
            },
            {
              "id": "card",
              "kind": "roundedRectangle",
              "roles": ["tapTarget", "gesturePart"],
              "layout": { "width": 170, "height": 96 },
              "style": { "backgroundColor": "#0EA5E9", "cornerRadius": 18 },
              "presentation": { "offset.x": 0, "offset.y": 0, "scale": 1, "opacity": 1 },
              "children": []
            },
            {
              "id": "icon",
              "kind": "circle",
              "roles": ["gesturePart"],
              "layout": { "width": 42, "height": 42 },
              "style": { "backgroundColor": "#FFFFFF" },
              "presentation": { "offset.x": 0, "offset.y": -18, "scale": 1, "opacity": 1 },
              "children": []
            },
            {
              "id": "title",
              "kind": "text",
              "roles": ["gestureCopy"],
              "layout": {},
              "style": { "text": "Drag ready", "foregroundColor": "#FFFFFF" },
              "presentation": { "offset.x": 0, "offset.y": 0, "scale": 1, "opacity": 0.35 },
              "children": []
            }
          ],
          "machines": [
            {
              "id": "gestureMachine",
              "initial": "idle",
              "states": [
                {
                  "id": "idle",
                  "values": [
                    { "select": { "role": "gesturePart", "properties": ["offset.x"] }, "value": 0 },
                    { "select": { "role": "gesturePart", "properties": ["scale"] }, "value": 1 },
                    { "select": { "id": "title", "properties": ["offset.y"] }, "value": 0 },
                    { "select": { "id": "title", "properties": ["opacity"] }, "value": 0.35 }
                  ]
                },
                {
                  "id": "communicatingGesture",
                  "values": [
                    { "select": { "role": "gesturePart", "properties": ["offset.x"] }, "value": 64 },
                    { "select": { "role": "gesturePart", "properties": ["scale"] }, "value": 1.2 },
                    { "select": { "id": "title", "properties": ["offset.y"] }, "value": -24 },
                    { "select": { "id": "title", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "gestureCue",
                  "from": "idle",
                  "to": "communicatingGesture",
                  "trigger": "tapCard",
                  "rules": [
                    {
                      "select": { "role": "gesturePart", "properties": ["offset.x", "scale"] },
                      "motion": { "type": "timed", "duration": 0.4, "easing": "linear" }
                    },
                    {
                      "select": { "id": "title", "properties": ["offset.y", "opacity"] },
                      "motion": { "type": "timed", "duration": 0.4, "easing": "linear" }
                    }
                  ],
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
