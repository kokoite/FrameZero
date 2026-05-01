import XCTest
@testable import MotionEngineKit

final class MotionCornerRadiiTests: XCTestCase {
    private let decoder = JSONDecoder()

    private func data(_ json: String) -> Data {
        Data(json.utf8)
    }

    func testDecodeFullCornerRadii() throws {
        let radii = try decoder.decode(MotionCornerRadii.self, from: data("""
        {
          "topLeft": 12,
          "topRight": 0,
          "bottomLeft": 4,
          "bottomRight": 24
        }
        """))

        XCTAssertEqual(radii.topLeft, 12)
        XCTAssertEqual(radii.topRight, 0)
        XCTAssertEqual(radii.bottomLeft, 4)
        XCTAssertEqual(radii.bottomRight, 24)
    }

    func testRejectsNegativeTopLeft() {
        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: data(##"{"topLeft":-1,"topRight":0,"bottomLeft":4,"bottomRight":24}"##)))
    }

    func testRejectsNegativeTopRight() {
        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: data(##"{"topLeft":12,"topRight":-2,"bottomLeft":4,"bottomRight":24}"##)))
    }

    func testRejectsNegativeBottomLeft() {
        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: data(##"{"topLeft":12,"topRight":0,"bottomLeft":-3,"bottomRight":24}"##)))
    }

    func testRejectsNegativeBottomRight() {
        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: data(##"{"topLeft":12,"topRight":0,"bottomLeft":4,"bottomRight":-4}"##)))
    }

    func testRejectsNonFiniteValue() throws {
        XCTAssertFalse(JSONSerialization.isValidJSONObject([
            "topLeft": Double.nan,
            "topRight": 0,
            "bottomLeft": 4,
            "bottomRight": 24
        ]))

        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "+Inf", negativeInfinity: "-Inf", nan: "NaN")
        struct Wrapper: Encodable {
            let topLeft: Double
            let topRight: Double
            let bottomLeft: Double
            let bottomRight: Double
        }
        let raw = try encoder.encode(Wrapper(topLeft: .nan, topRight: 0, bottomLeft: 4, bottomRight: 24))

        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: raw))
    }

    func testRejectsMissingField() {
        XCTAssertThrowsError(try decoder.decode(MotionCornerRadii.self, from: data(##"{"topLeft":12,"topRight":0,"bottomLeft":4}"##)))
    }

    func testNodeWithoutCornerRadiiDecodes() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {},
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertNil(node.cornerRadii)
    }
}
