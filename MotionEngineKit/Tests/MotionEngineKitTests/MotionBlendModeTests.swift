import XCTest
@testable import MotionEngineKit

final class MotionBlendModeTests: XCTestCase {
    private let decoder = JSONDecoder()
    private let allBlendModes = [
        "normal",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
        "colorDodge",
        "colorBurn",
        "softLight",
        "hardLight",
        "difference",
        "exclusion",
        "hue",
        "saturation",
        "color",
        "luminosity",
        "plusLighter",
        "plusDarker"
    ]

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    private func decodeNode(_ fields: String = "") throws -> MotionNode {
        try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {},
          \(fields)
          "presentation": {},
          "children": []
        }
        """))
    }

    func testDecodesAllTypedBlendModes() throws {
        for rawValue in allBlendModes {
            let node = try decodeNode(#""blendMode": "\#(rawValue)","#)

            XCTAssertEqual(node.blendMode?.rawValue, rawValue)
        }
    }

    func testRejectsInvalidBlendMode() {
        XCTAssertThrowsError(try decodeNode(#""blendMode": "frobnicate","#))
    }

    func testNodeWithoutBlendModeDecodes() throws {
        let node = try decodeNode()

        XCTAssertNil(node.blendMode)
    }

    @MainActor
    func testBackwardCompatUntypedBlendMode() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "blendMode": "multiply" },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertNil(node.blendMode)
        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveBlendMode(node: node), .multiply)
    }

    @MainActor
    func testTypedBlendModeWinsOverUntyped() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: document(nodeFields: #""style": { "blendMode": "multiply" }, "blendMode": "screen","#))

        let node = try XCTUnwrap(engine.node("card"))

        XCTAssertEqual(MotionRuntimeView(engine: engine, frame: 0).resolveBlendMode(node: node), .screen)
    }

    func testParticleSpecAcceptsTypedBlendMode() throws {
        let particle = try decoder.decode(MotionParticleSpec.self, from: data("""
        {
          "kind": "circle",
          "layout": { "width": 8, "height": 8 },
          "style": { "backgroundColor": "#FFFFFF" },
          "blendMode": "plusDarker",
          "from": { "scale": 0.3, "opacity": 1 },
          "to": { "scale": 1.8, "opacity": 0 },
          "motion": { "type": "timed", "duration": 0.35, "easing": "easeOut" },
          "lifetime": 0.35
        }
        """))

        XCTAssertEqual(particle.blendMode, .plusDarker)
    }

    func testComponentSpecAcceptsTypedBlendMode() throws {
        let component = try decoder.decode(MotionComponentSpec.self, from: data("""
        {
          "id": "badge",
          "kind": "roundedRectangle",
          "layout": { "width": 80, "height": 28 },
          "style": { "backgroundColor": "#38BDF8" },
          "blendMode": "colorBurn",
          "from": { "offset.x": 8, "opacity": 1 },
          "to": { "offset.x": 48, "opacity": 0 },
          "motion": { "type": "timed", "duration": 0.4, "easing": "easeOut" },
          "lifetime": 0.4
        }
        """))

        XCTAssertEqual(component.blendMode, .colorBurn)
    }

    @MainActor
    func testNewlySupportedBlendMode() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "blendMode": "overlay" },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveBlendMode(node: node), .overlay)
    }

    @MainActor
    func testMissingBlendModeResolvesNormal() throws {
        let node = try decodeNode()

        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveBlendMode(node: node), .normal)
    }

    private func document(nodeFields: String = "", actions: String = "[]") -> String {
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
              "roles": ["target"],
              "layout": { "width": 60, "height": 60 },
              \(nodeFields)
              "presentation": { "opacity": 1 },
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
                    { "select": { "id": "card", "properties": ["opacity"] }, "value": 1 }
                  ]
                }
              ],
              "transitions": [
                {
                  "id": "feedback",
                  "from": "idle",
                  "to": "idle",
                  "trigger": "tapCard",
                  "rules": [],
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
