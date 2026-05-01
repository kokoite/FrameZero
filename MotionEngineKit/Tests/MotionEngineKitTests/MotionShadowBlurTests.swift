import XCTest
@testable import MotionEngineKit

final class MotionShadowBlurTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    private func decodeNode(_ fields: String) throws -> MotionNode {
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

    func testDecodeFullTypedShadow() throws {
        let node = try decodeNode(##""shadow":{"x":4,"y":8,"blur":12,"opacity":0.35,"color":"#112233"},"##)

        XCTAssertEqual(node.shadow?.x, 4)
        XCTAssertEqual(node.shadow?.y, 8)
        XCTAssertEqual(node.shadow?.blur, 12)
        XCTAssertEqual(node.shadow?.opacity, 0.35)
        XCTAssertEqual(node.shadow?.color, "#112233")
    }

    func testRejectsInvalidTypedShadowValues() {
        let invalidPayloads = [
            ##"{"x":4,"y":8,"blur":-1,"opacity":0.35,"color":"#112233"}"##,
            ##"{"x":4,"y":8,"blur":12,"opacity":1.1,"color":"#112233"}"##,
            ##"{"x":4,"y":8,"blur":12,"opacity":-0.1,"color":"#112233"}"##,
            ##"{"x":NaN,"y":8,"blur":12,"opacity":0.35,"color":"#112233"}"##,
            ##"{"x":4,"y":8,"blur":12,"opacity":0.35,"color":"not-hex"}"##,
            ##"{"x":4,"y":8,"blur":12,"opacity":0.35}"##
        ]

        for payload in invalidPayloads {
            XCTAssertThrowsError(try decodeNode(#""shadow":\#(payload),"#), payload)
        }
    }

    func testDecodeLayerBlurValid() throws {
        let node = try decodeNode(#""layerBlur": 6,"#)

        XCTAssertEqual(node.layerBlur, 6)
    }

    func testRejectsInvalidLayerBlurValues() {
        XCTAssertThrowsError(try decodeNode(#""layerBlur": -1,"#))
        XCTAssertThrowsError(try decodeNode(#""layerBlur": NaN,"#))
    }

    func testBackwardCompatUntypedShadowParsesWithoutTypedShadow() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {
            "shadowX": 4,
            "shadowY": 6,
            "shadowBlur": 10,
            "shadowOpacity": 0.25,
            "shadowColor": "#445566"
          },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertNil(node.shadow)
        XCTAssertEqual(node.style["shadowX"], .number(4))
    }

    @MainActor
    func testTypedShadowTakesResolverPrecedenceOverUntypedStyle() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {
            "shadowX": 100,
            "shadowY": 100,
            "shadowBlur": 100,
            "shadowOpacity": 0.1,
            "shadowColor": "#000000"
          },
          "shadow": { "x": 4, "y": 8, "blur": 12, "opacity": 0.35, "color": "#112233" },
          "presentation": {},
          "children": []
        }
        """))

        let resolved = MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveShadow(node: node)
        XCTAssertEqual(resolved?.x, 4)
        XCTAssertEqual(resolved?.y, 8)
        XCTAssertEqual(resolved?.blur, 12)
        XCTAssertEqual(resolved?.opacity, 0.35)
        XCTAssertEqual(resolved?.color, "#112233")
    }

    @MainActor
    func testTypedLayerBlurTakesPrecedenceOverStyleBlur() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "blur": 2 },
          "layerBlur": 9,
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveLayerBlur(node: node), 9)
    }

    @MainActor
    func testFigmaBlurHalvingIsPreserved() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "figmaBlur": 8 },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveLayerBlur(node: node), 4)
    }

    @MainActor
    func testStyleBlurTakesPrecedenceOverFigmaBlur() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "blur": 6, "figmaBlur": 20 },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertEqual(MotionRuntimeView(engine: MotionEngine(), frame: 0).resolveLayerBlur(node: node), 6)
    }

    func testParticleSpecDecodesTypedShadowAndLayerBlur() throws {
        let particle = try decoder.decode(MotionParticleSpec.self, from: data("""
        {
          "kind": "circle",
          "layout": { "width": 8, "height": 8 },
          "style": { "backgroundColor": "#FFFFFF" },
          "shadow": { "x": 1, "y": 2, "blur": 3, "opacity": 0.4, "color": "#123456" },
          "layerBlur": 5,
          "from": { "scale": 0.3, "opacity": 1 },
          "to": { "scale": 1.8, "opacity": 0 },
          "motion": { "type": "timed", "duration": 0.35, "easing": "easeOut" },
          "lifetime": 0.35
        }
        """))

        XCTAssertEqual(particle.shadow?.color, "#123456")
        XCTAssertEqual(particle.layerBlur, 5)
    }

    func testComponentSpecDecodesTypedShadowAndLayerBlur() throws {
        let component = try decoder.decode(MotionComponentSpec.self, from: data("""
        {
          "id": "badge",
          "kind": "roundedRectangle",
          "layout": { "width": 80, "height": 28 },
          "style": { "backgroundColor": "#38BDF8" },
          "shadow": { "x": 1, "y": 2, "blur": 3, "opacity": 0.4, "color": "#123456" },
          "layerBlur": 5,
          "from": { "offset.x": 8, "opacity": 1 },
          "to": { "offset.x": 48, "opacity": 0 },
          "motion": { "type": "timed", "duration": 0.4, "easing": "easeOut" },
          "lifetime": 0.4
        }
        """))

        XCTAssertEqual(component.shadow?.color, "#123456")
        XCTAssertEqual(component.layerBlur, 5)
    }

    @MainActor
    func testRuntimeCarriesTypedShadowAndLayerBlurForSpawnedVisuals() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: """
        {
          "schemaVersion": 1,
          "root": "root",
          "nodes": [
            { "id": "root", "kind": "zstack", "roles": ["screen"], "layout": {}, "style": {}, "presentation": {}, "children": ["card"] },
            { "id": "card", "kind": "roundedRectangle", "roles": [], "layout": {}, "style": {}, "presentation": { "opacity": 1 }, "children": [] }
          ],
          "machines": [
            {
              "id": "main",
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
                  "trigger": "tap",
                  "rules": [],
                  "actions": [
                    {
                      "type": "emitParticles",
                      "id": "burst",
                      "selector": { "id": "card" },
                      "count": 1,
                      "particle": {
                        "kind": "circle",
                        "layout": { "width": 8, "height": 8 },
                        "style": { "backgroundColor": "#FFFFFF" },
                        "shadow": { "x": 1, "y": 2, "blur": 3, "opacity": 0.4, "color": "#123456" },
                        "layerBlur": 5,
                        "from": { "opacity": 1 },
                        "to": { "opacity": 0 },
                        "motion": { "type": "timed", "duration": 0.35, "easing": "easeOut" },
                        "lifetime": 0.35
                      }
                    },
                    {
                      "type": "spawnComponents",
                      "id": "spawn",
                      "selector": { "id": "card" },
                      "components": [
                        {
                          "id": "badge",
                          "kind": "roundedRectangle",
                          "layout": { "width": 80, "height": 28 },
                          "style": { "backgroundColor": "#38BDF8" },
                          "shadow": { "x": 6, "y": 7, "blur": 8, "opacity": 0.9, "color": "#654321" },
                          "layerBlur": 10,
                          "from": { "opacity": 1 },
                          "to": { "opacity": 0 },
                          "motion": { "type": "timed", "duration": 0.4, "easing": "easeOut" },
                          "lifetime": 0.4
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ],
          "triggers": [{ "id": "tap", "type": "tap", "selector": { "id": "card" } }],
          "dragBindings": [],
          "bodies": [],
          "forces": []
        }
        """)

        engine.handleTap(on: "card")

        XCTAssertEqual(engine.particles().first?.shadow?.color, "#123456")
        XCTAssertEqual(engine.particles().first?.layerBlur, 5)
        XCTAssertEqual(engine.components().first?.shadow?.color, "#654321")
        XCTAssertEqual(engine.components().first?.layerBlur, 10)
    }
}
