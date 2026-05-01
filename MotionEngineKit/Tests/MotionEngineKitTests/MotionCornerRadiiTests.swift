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

    func testDecodeTypedCornerRadius() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {},
          "cornerRadius": 12,
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertEqual(node.cornerRadius, 12)
    }

    func testRejectsNegativeCornerRadius() {
        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": {},
          "cornerRadius": -1,
          "presentation": {},
          "children": []
        }
        """)))
    }

    func testRejectsNonFiniteCornerRadius() throws {
        let encoder = JSONEncoder()
        encoder.nonConformingFloatEncodingStrategy = .convertToString(positiveInfinity: "+Inf", negativeInfinity: "-Inf", nan: "NaN")
        struct Node: Encodable {
            let id = "card"
            let kind = "roundedRectangle"
            let roles: [String] = []
            let layout: [String: String] = [:]
            let style: [String: String] = [:]
            let cornerRadius: Double
            let presentation: [String: String] = [:]
            let children: [String] = []
        }
        let raw = try encoder.encode(Node(cornerRadius: .nan))

        XCTAssertThrowsError(try decoder.decode(MotionNode.self, from: raw))
    }

    func testNodeWithoutTypedCornerRadius() throws {
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

        XCTAssertNil(node.cornerRadius)
    }

    func testStyleCornerRadiusStillParses() throws {
        let node = try decoder.decode(MotionNode.self, from: data("""
        {
          "id": "card",
          "kind": "roundedRectangle",
          "roles": [],
          "layout": {},
          "style": { "cornerRadius": 8 },
          "presentation": {},
          "children": []
        }
        """))

        XCTAssertNil(node.cornerRadius)
        XCTAssertEqual(node.style["cornerRadius"]?.number, 8)
    }
}
