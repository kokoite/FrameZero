import XCTest
@testable import MotionEngineKit

final class MotionLineTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    private func nodeJSON(kind: String, style: String = "{}", extra: String = "") -> String {
        """
        {
          "id": "line",
          "kind": "\(kind)",
          "roles": [],
          "layout": {},
          "style": \(style),
          \(extra)
          "presentation": {},
          "children": []
        }
        """
    }

    private func encodedPointJSON(x: Double, y: Double) -> Data {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(
            positiveInfinity: "+Inf",
            negativeInfinity: "-Inf",
            nan: "NaN"
        )
        struct W: Encodable {
            let from: P
            let to: P
        }
        struct P: Encodable {
            let x: Double
            let y: Double
        }
        return try! encoder.encode(W(from: P(x: x, y: y), to: P(x: 1, y: 2)))
    }

    func testLineDecodesValid() throws {
        let spec = try decoder.decode(MotionLineSpec.self, from: data(##"{"from":{"x":0,"y":1},"to":{"x":20,"y":30}}"##))

        XCTAssertEqual(spec.from.x, 0)
        XCTAssertEqual(spec.from.y, 1)
        XCTAssertEqual(spec.to.x, 20)
        XCTAssertEqual(spec.to.y, 30)
    }

    func testLineRejectsNaN() {
        XCTAssertThrowsError(try decoder.decode(MotionLineSpec.self, from: encodedPointJSON(x: .nan, y: 0)))
    }

    func testLineRejectsInfinity() {
        XCTAssertThrowsError(try decoder.decode(MotionLineSpec.self, from: encodedPointJSON(x: .infinity, y: 0)))
    }

    func testLineAllowsNegativeCoordinates() throws {
        let spec = try decoder.decode(MotionLineSpec.self, from: data(##"{"from":{"x":-10,"y":-1.5},"to":{"x":20,"y":-30}}"##))

        XCTAssertEqual(spec.from.x, -10)
        XCTAssertEqual(spec.from.y, -1.5)
        XCTAssertEqual(spec.to.y, -30)
    }

    func testNodeRejectsKindLineWithoutLineSpec() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "line",
            extra: ##""stroke":{"color":"#FF0000","width":2},"##
        ))))
    }

    func testNodeRejectsKindLineWithoutStroke() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "line",
            extra: ##""line":{"from":{"x":0,"y":0},"to":{"x":10,"y":10}},"##
        ))))
    }

    func testNodeAcceptsKindLineWithUntypedStroke() throws {
        let node = try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "line",
            style: ##"{"strokeWidth":2,"strokeColor":"#00FF00"}"##,
            extra: ##""line":{"from":{"x":0,"y":0},"to":{"x":10,"y":10}},"##
        )))

        XCTAssertEqual(node.kind, .line)
        XCTAssertEqual(node.line?.to.x, 10)
    }

    func testNodeRejectsKindCircleWithLineSpec() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "circle",
            extra: ##""line":{"from":{"x":0,"y":0},"to":{"x":10,"y":10}},"##
        ))))
    }

    func testNodeRejectsKindLineWithPolygon() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "line",
            extra: ##""line":{"from":{"x":0,"y":0},"to":{"x":10,"y":10}},"polygon":{"sides":6},"stroke":{"color":"#FF0000","width":2},"##
        ))))
    }

    func testNodeRejectsKindLineWithStar() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "line",
            extra: ##""line":{"from":{"x":0,"y":0},"to":{"x":10,"y":10}},"star":{"points":5,"innerRadius":0.5},"stroke":{"color":"#FF0000","width":2},"##
        ))))
    }

    func testParticleSpecAcceptsKindLine() throws {
        let particle = try decoder.decode(MotionParticleSpec.self, from: data("""
        {
          "kind": "line",
          "style": { "strokeWidth": 2, "strokeColor": "#00FF00" },
          "line": { "from": { "x": 0, "y": 0 }, "to": { "x": 10, "y": 10 } },
          "from": {},
          "to": {},
          "motion": { "type": "immediate" },
          "lifetime": 0.3
        }
        """))

        XCTAssertEqual(particle.kind, .line)
        XCTAssertEqual(particle.line?.to.y, 10)
    }

    func testComponentSpecAcceptsKindLine() throws {
        let component = try decoder.decode(MotionComponentSpec.self, from: data("""
        {
          "id": "spark",
          "kind": "line",
          "style": { "strokeWidth": 2, "strokeColor": "#00FF00" },
          "line": { "from": { "x": 0, "y": 0 }, "to": { "x": 10, "y": 10 } },
          "from": {},
          "to": {},
          "motion": { "type": "immediate" },
          "lifetime": 0.3
        }
        """))

        XCTAssertEqual(component.kind, .line)
        XCTAssertEqual(component.line?.from.x, 0)
    }
}
