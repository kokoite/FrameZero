import XCTest
@testable import MotionEngineKit

final class MotionPolygonStarTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    private func nodeJSON(kind: String, extra: String = "") -> String {
        """
        {
          "id": "shape",
          "kind": "\(kind)",
          "roles": [],
          "layout": {},
          "style": {},
          \(extra)
          "presentation": {},
          "children": []
        }
        """
    }

    func testPolygonDecodesValid() throws {
        let spec = try decoder.decode(MotionPolygonSpec.self, from: data(##"{"sides":6,"cornerRadius":4}"##))

        XCTAssertEqual(spec.sides, 6)
        XCTAssertEqual(spec.cornerRadius, 4)
    }

    func testPolygonRejectsTooFewSides() {
        XCTAssertThrowsError(try decoder.decode(MotionPolygonSpec.self, from: data(##"{"sides":2}"##)))
    }

    func testPolygonRejectsTooManySides() {
        XCTAssertThrowsError(try decoder.decode(MotionPolygonSpec.self, from: data(##"{"sides":65}"##)))
    }

    func testPolygonRejectsNonInteger() {
        XCTAssertThrowsError(try decoder.decode(MotionPolygonSpec.self, from: data(##"{"sides":3.5}"##)))
    }

    func testPolygonRejectsNegativeCornerRadius() {
        XCTAssertThrowsError(try decoder.decode(MotionPolygonSpec.self, from: data(##"{"sides":6,"cornerRadius":-1}"##)))
    }

    func testStarDecodesValid() throws {
        let spec = try decoder.decode(MotionStarSpec.self, from: data(##"{"points":5,"innerRadius":0.5}"##))

        XCTAssertEqual(spec.points, 5)
        XCTAssertEqual(spec.innerRadius, 0.5)
    }

    func testStarInnerRadius1IsValid() throws {
        let spec = try decoder.decode(MotionStarSpec.self, from: data(##"{"points":5,"innerRadius":1.0}"##))

        XCTAssertEqual(spec.innerRadius, 1.0)
    }

    func testStarRejectsInnerRadiusAbove1() {
        XCTAssertThrowsError(try decoder.decode(MotionStarSpec.self, from: data(##"{"points":5,"innerRadius":1.01}"##)))
    }

    func testStarRejectsNegativeInnerRadius() {
        XCTAssertThrowsError(try decoder.decode(MotionStarSpec.self, from: data(##"{"points":5,"innerRadius":-0.01}"##)))
    }

    func testStarRejectsTooFewPoints() {
        XCTAssertThrowsError(try decoder.decode(MotionStarSpec.self, from: data(##"{"points":2,"innerRadius":0.5}"##)))
    }

    func testNodeRejectsKindPolygonWithoutPolygonField() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(kind: "polygon"))))
    }

    func testNodeRejectsKindCircleWithPolygonField() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "circle",
            extra: ##""polygon":{"sides":6},"##
        ))))
    }

    func testNodeRejectsKindPolygonWithStarField() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data(nodeJSON(
            kind: "polygon",
            extra: ##""polygon":{"sides":6},"star":{"points":5,"innerRadius":0.5},"##
        ))))
    }

    func testParticleSpecAcceptsKindStar() throws {
        let particle = try decoder.decode(MotionParticleSpec.self, from: data("""
        {
          "kind": "star",
          "star": { "points": 5, "innerRadius": 0.5 },
          "from": {},
          "to": {},
          "motion": { "type": "immediate" },
          "lifetime": 0.3
        }
        """))

        XCTAssertEqual(particle.kind, .star)
        XCTAssertEqual(particle.star?.points, 5)
        XCTAssertEqual(particle.star?.innerRadius, 0.5)
        XCTAssertNil(particle.star?.cornerRadius)
    }

    func testComponentSpecAcceptsKindPolygon() throws {
        let component = try decoder.decode(MotionComponentSpec.self, from: data("""
        {
          "id": "spark",
          "kind": "polygon",
          "polygon": { "sides": 6, "cornerRadius": 4 },
          "from": {},
          "to": {},
          "motion": { "type": "immediate" },
          "lifetime": 0.3
        }
        """))

        XCTAssertEqual(component.kind, .polygon)
        XCTAssertEqual(component.polygon?.sides, 6)
        XCTAssertEqual(component.polygon?.cornerRadius, 4)
    }
}
