import XCTest
@testable import MotionEngineKit

final class MotionRenderPolicyTests: XCTestCase {
    func testVisibleOpacitySnapsNearZeroToFullyInvisible() {
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(-1), 0)
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(0), 0)
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(0.009), 0)
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(0.01), 0.01)
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(0.5), 0.5)
        XCTAssertEqual(MotionRenderStyle.visibleOpacity(2), 1)
    }

    func testHexColorValidation() {
        XCTAssertTrue(MotionRenderStyle.isValidHexColor("#38BDF8"))
        XCTAssertTrue(MotionRenderStyle.isValidHexColor("38BDF8"))
        XCTAssertFalse(MotionRenderStyle.isValidHexColor("#38BDF"))
        XCTAssertFalse(MotionRenderStyle.isValidHexColor("#38BDF8FF"))
        XCTAssertFalse(MotionRenderStyle.isValidHexColor("not-a-color"))
    }

    func testRendererDoesNotInventFallbackVisualColors() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let sourceFiles = [
            packageRoot.appendingPathComponent("Sources/MotionEngineKit/MotionRenderer.swift"),
            packageRoot.appendingPathComponent("Sources/MotionEngineKit/MotionHostView.swift")
        ]

        for file in sourceFiles {
            let source = try String(contentsOf: file)
            XCTAssertFalse(source.contains("?? .blue"), "\(file.lastPathComponent) should not default missing JSON colors to blue.")
            XCTAssertFalse(source.contains("?? .primary"), "\(file.lastPathComponent) should not default missing JSON text colors to the platform primary color.")
            XCTAssertFalse(source.contains("Color.yellow"), "\(file.lastPathComponent) should not default missing JSON colors to yellow.")
            XCTAssertFalse(source.contains("Color.cyan"), "\(file.lastPathComponent) should not default missing JSON colors to cyan.")
        }
    }

    @MainActor
    func testFailedLoadRestoresPreviousEngineState() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: validDocument())
        XCTAssertEqual(engine.statusMessage, "Loaded motion document")
        XCTAssertNotNil(engine.node("root"))

        XCTAssertThrowsError(try engine.load(jsonString: validDocument(nodes: """
        [
          { "id": "root", "kind": "zstack", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": ["missing"] }
        ]
        """)))

        XCTAssertEqual(engine.statusMessage, "Loaded motion document")
        XCTAssertNotNil(engine.node("root"))
        XCTAssertNil(engine.node("missing"))
    }

    @MainActor
    func testRejectsInvalidNodeColors() {
        assertInvalidDocument(
            nodes: """
            [
              { "id": "root", "kind": "zstack", "roles": [], "layout": {}, "style": { "backgroundColor": "blue" }, "presentation": {}, "children": [] }
            ]
            """,
            contains: "backgroundColor"
        )
    }

    @MainActor
    func testAcceptsNodeGradientStyle() throws {
        let json = validDocument(
            nodes: """
            [
              { "id": "root", "kind": "roundedRectangle", "roles": [], "layout": {}, "style": { "backgroundColor": "#38BDF8", "gradientEndColor": "#B58CFF", "gradientAngle": 135 }, "presentation": {}, "children": [] }
            ]
            """
        )

        XCTAssertNoThrow(try MotionEngine().load(jsonString: json))
    }

    @MainActor
    func testAcceptsStructuredNodeFills() throws {
        let engine = MotionEngine()
        try engine.load(jsonString: validDocument(
            nodes: """
            [
              {
                "id": "root",
                "kind": "roundedRectangle",
                "roles": [],
                "layout": {},
                "style": { "cornerRadius": 18 },
                "fills": [
                  {
                    "type": "radialGradient",
                    "colors": [
                      { "color": "#E0F2FE", "position": 0 },
                      { "color": "#38BDF8", "position": 0.52 },
                      { "color": "#B58CFF", "position": 1 }
                    ],
                    "centerX": 0.35,
                    "centerY": 0.28,
                    "radius": 90,
                    "opacity": 0.92
                  }
                ],
                "presentation": {},
                "children": []
              }
            ]
            """
        ))

        let node = try XCTUnwrap(engine.node("root"))
        XCTAssertEqual(node.fills.count, 1)
        XCTAssertEqual(node.fills[0].type, .radialGradient)
        XCTAssertEqual(node.fills[0].colors.count, 3)
    }

    @MainActor
    func testRejectsInvalidNodeGradientColor() {
        assertInvalidDocument(
            nodes: """
            [
              { "id": "root", "kind": "roundedRectangle", "roles": [], "layout": {}, "style": { "backgroundColor": "#38BDF8", "gradientEndColor": "purple" }, "presentation": {}, "children": [] }
            ]
            """,
            contains: "gradientEndColor"
        )
    }

    @MainActor
    func testRejectsInvalidStructuredFillColor() {
        assertInvalidDocument(
            nodes: """
            [
              {
                "id": "root",
                "kind": "roundedRectangle",
                "roles": [],
                "layout": {},
                "style": {},
                "fills": [
                  {
                    "type": "linearGradient",
                    "colors": [
                      { "color": "#38BDF8", "position": 0 },
                      { "color": "purple", "position": 1 }
                    ],
                    "angle": 135
                  }
                ],
                "presentation": {},
                "children": []
              }
            ]
            """,
            contains: "Fill color stop"
        )
    }

    @MainActor
    func testRejectsInvalidTrailColors() {
        let json = validDocument(
            nodes: """
            [
              { "id": "root", "kind": "zstack", "roles": ["screen"], "layout": {}, "style": {}, "presentation": {}, "children": ["orb"] },
              { "id": "orb", "kind": "circle", "roles": ["target"], "layout": {}, "style": {}, "presentation": {}, "children": [] }
            ]
            """,
            dragBindings: """
            [
              {
                "id": "drag",
                "type": "slingshot",
                "selector": { "id": "orb" },
                "maxPull": 120,
                "launchPower": 8,
                "trail": { "color": "cyan" }
              }
            ]
            """
        )

        XCTAssertThrowsError(try MotionEngine().load(jsonString: json)) { error in
            XCTAssertTrue(error.localizedDescription.contains("trail.color"))
        }
    }

    @MainActor
    func testRejectsDuplicateChildOwnership() {
        assertInvalidDocument(
            nodes: """
            [
              { "id": "root", "kind": "zstack", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": ["a", "b"] },
              { "id": "a", "kind": "zstack", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": ["shared"] },
              { "id": "b", "kind": "zstack", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": ["shared"] },
              { "id": "shared", "kind": "circle", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": [] }
            ]
            """,
            contains: "both"
        )
    }

    @MainActor
    func testRejectsUnreachableNodes() {
        assertInvalidDocument(
            nodes: """
            [
              { "id": "root", "kind": "zstack", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": [] },
              { "id": "orphan", "kind": "circle", "roles": [], "layout": {}, "style": {}, "presentation": {}, "children": [] }
            ]
            """,
            contains: "not reachable"
        )
    }

    @MainActor
    func testRejectsAmbiguousPropertySelectors() {
        assertInvalidDocument(
            stateValues: """
            [
              {
                "select": { "id": "root", "role": "screen", "properties": ["opacity"] },
                "value": 1
              }
            ]
            """,
            contains: "exactly one"
        )
    }

    @MainActor
    func testRejectsEmptyPropertySelectors() {
        assertInvalidDocument(
            stateValues: """
            [
              {
                "select": { "id": "root", "properties": [] },
                "value": 1
              }
            ]
            """,
            contains: "at least one property"
        )
    }

    @MainActor
    private func assertInvalidDocument(
        nodes: String = """
        [
          { "id": "root", "kind": "zstack", "roles": ["screen"], "layout": {}, "style": {}, "presentation": {}, "children": [] }
        ]
        """,
        stateValues: String = "[]",
        contains expectedMessage: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let json = validDocument(nodes: nodes, stateValues: stateValues)

        XCTAssertThrowsError(try MotionEngine().load(jsonString: json), file: file, line: line) { error in
            XCTAssertTrue(
                error.localizedDescription.contains(expectedMessage),
                "Expected error containing '\(expectedMessage)', got '\(error.localizedDescription)'",
                file: file,
                line: line
            )
        }
    }

    private func validDocument(
        nodes: String = """
        [
          { "id": "root", "kind": "zstack", "roles": ["screen"], "layout": {}, "style": {}, "presentation": {}, "children": [] }
        ]
        """,
        stateValues: String = "[]",
        dragBindings: String = "[]"
    ) -> String {
        """
        {
          "schemaVersion": 1,
          "root": "root",
          "nodes": \(nodes),
          "machines": [
            {
              "id": "machine",
              "initial": "idle",
              "states": [
                { "id": "idle", "values": \(stateValues) }
              ],
              "transitions": []
            }
          ],
          "triggers": [],
          "dragBindings": \(dragBindings),
          "bodies": [],
          "forces": []
        }
        """
    }
}
