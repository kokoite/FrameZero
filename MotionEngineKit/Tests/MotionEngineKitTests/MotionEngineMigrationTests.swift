import XCTest
@testable import MotionEngineKit

final class MotionEngineMigrationTests: XCTestCase {

    private func makeValidV1DocumentData() -> Data {
        let json = #"{"schemaVersion": 1, "root": "root", "nodes": [{"id":"root","kind":"zstack","children":[]}], "machines": [], "triggers": []}"#
        return Data(json.utf8)
    }

    private func makeDocumentData(schemaVersion: Int) -> Data {
        let json = #"{"schemaVersion": \#(schemaVersion), "root": "root", "nodes": [], "machines": [], "triggers": []}"#
        return Data(json.utf8)
    }

    private func writeTempFile(_ data: Data) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("motion-\(UUID().uuidString).motion.json")
        try data.write(to: url)
        return url
    }

    @MainActor
    func testLoadDataAcceptsCurrentSchemaUnchanged() throws {
        let engine = MotionEngine()
        XCTAssertNoThrow(try engine.load(data: makeValidV1DocumentData()))
        XCTAssertNotNil(engine.document)
    }

    @MainActor
    func testLoadDataRejectsUnknownFutureSchema() {
        let engine = MotionEngine()
        XCTAssertThrowsError(try engine.load(data: makeDocumentData(schemaVersion: 99))) { error in
            guard case MotionRuntimeError.validation(let msg) = error else {
                XCTFail("expected MotionRuntimeError.validation, got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("unsupported schema version 99"), "message was: \(msg)")
        }
    }

    @MainActor
    func testLoadFileURLAcceptsCurrentSchemaUnchanged() throws {
        let url = try writeTempFile(makeValidV1DocumentData())
        defer { try? FileManager.default.removeItem(at: url) }
        let engine = MotionEngine()
        XCTAssertNoThrow(try engine.load(fileURL: url, hotReload: false))
        XCTAssertNotNil(engine.document)
    }

    @MainActor
    func testLoadEditableDocumentAcceptsCurrentSchema() throws {
        let url = try writeTempFile(makeValidV1DocumentData())
        defer { try? FileManager.default.removeItem(at: url) }
        let engine = MotionEngine()
        try engine.load(fileURL: url, hotReload: true)
        XCTAssertNotNil(engine.document)
    }

    @MainActor
    func testLoadDataPropagatesMigrationErrorAsRuntimeValidation() throws {
        let engine = MotionEngine()
        try engine.load(data: makeValidV1DocumentData())
        let priorDocument = engine.document
        XCTAssertNotNil(priorDocument)

        XCTAssertThrowsError(try engine.load(data: Data("not json".utf8))) { error in
            guard case MotionRuntimeError.validation(let msg) = error else {
                XCTFail("expected validation error, got \(error)")
                return
            }
            XCTAssertEqual(msg, "malformed JSON document")
        }
        XCTAssertNotNil(engine.document, "prior document was lost - snapshot-restore broken")
    }
}
