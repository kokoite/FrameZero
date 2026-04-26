import XCTest
@testable import MotionEngineKit

final class MotionActionSchemaTests: XCTestCase {
    func testDecodesAllFrameZeroActionTypes() throws {
        let actions = try decodeActions("""
        [
          {
            "type": "sequence",
            "actions": [
              { "type": "delay", "duration": 0.12 },
              { "type": "haptic", "style": "success", "intensity": 0.8 }
            ]
          },
          {
            "type": "parallel",
            "actions": [
              { "type": "screenShake", "amplitude": 6, "duration": 0.18, "frequency": 18, "decay": 0.7 },
              {
                "type": "emitParticles",
                "id": "tapBurst",
                "selector": { "id": "card" },
                "count": 12,
                "duration": 0.35,
                "particle": {
                  "kind": "circle",
                  "layout": { "width": 8, "height": 8 },
                  "style": { "backgroundColor": "#FFFFFF" },
                  "from": { "scale": 0.3, "opacity": 1 },
                  "to": { "scale": 1.8, "opacity": 0 },
                  "motion": { "type": "timed", "duration": 0.35, "easing": "easeOut" },
                  "lifetime": 0.35
                }
              }
            ]
          },
          {
            "type": "spawnComponents",
            "id": "twinPop",
            "selector": { "id": "card" },
            "components": [
              {
                "id": "leftDot",
                "kind": "circle",
                "layout": { "width": 12, "height": 12 },
                "style": { "backgroundColor": "#38BDF8" },
                "from": { "offset.x": -8, "opacity": 1 },
                "to": { "offset.x": -48, "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.4, "easing": "easeOut" },
                "lifetime": 0.4
              },
              {
                "id": "rightLabel",
                "kind": "text",
                "layout": { "width": 80, "height": 28 },
                "style": { "text": "+10", "foregroundColor": "#FFFFFF" },
                "from": { "offset.x": 8, "offset.y": 0, "opacity": 1 },
                "to": { "offset.x": 48, "offset.y": -30, "opacity": 0 },
                "motion": { "type": "timed", "duration": 0.4, "easing": "easeOut" },
                "lifetime": 0.4
              }
            ]
          }
        ]
        """)

        XCTAssertEqual(actions.count, 3)

        guard case let .sequence(sequence) = actions[0] else {
            return XCTFail("Expected first action to decode as sequence")
        }
        XCTAssertEqual(sequence.actions.count, 2)

        guard case let .delay(delay) = sequence.actions[0] else {
            return XCTFail("Expected sequence first child to decode as delay")
        }
        XCTAssertEqual(delay.duration, 0.12)

        guard case let .haptic(haptic) = sequence.actions[1] else {
            return XCTFail("Expected sequence second child to decode as haptic")
        }
        XCTAssertEqual(haptic.style, .success)
        XCTAssertEqual(haptic.intensity, 0.8)

        guard case let .parallel(parallel) = actions[1] else {
            return XCTFail("Expected second action to decode as parallel")
        }
        XCTAssertEqual(parallel.actions.count, 2)

        guard case let .screenShake(screenShake) = parallel.actions[0] else {
            return XCTFail("Expected parallel first child to decode as screenShake")
        }
        XCTAssertEqual(screenShake.amplitude, 6)
        XCTAssertEqual(screenShake.duration, 0.18)
        XCTAssertEqual(screenShake.frequency, 18)
        XCTAssertEqual(screenShake.decay, 0.7)

        guard case let .emitParticles(emitParticles) = parallel.actions[1] else {
            return XCTFail("Expected parallel second child to decode as emitParticles")
        }
        XCTAssertEqual(emitParticles.id, "tapBurst")
        XCTAssertEqual(emitParticles.selector?.id, "card")
        XCTAssertEqual(emitParticles.count, 12)
        XCTAssertEqual(emitParticles.duration, 0.35)
        XCTAssertEqual(emitParticles.particle.lifetime, 0.35)

        guard case let .spawnComponents(spawnComponents) = actions[2] else {
            return XCTFail("Expected third action to decode as spawnComponents")
        }
        XCTAssertEqual(spawnComponents.id, "twinPop")
        XCTAssertEqual(spawnComponents.selector?.id, "card")
        XCTAssertEqual(spawnComponents.components.map(\.id), ["leftDot", "rightLabel"])
        XCTAssertEqual(spawnComponents.components[1].kind, .text)
    }

    func testTransitionActionsDefaultToEmpty() throws {
        let transition = try JSONDecoder().decode(MotionTransition.self, from: Data("""
        {
          "id": "expand",
          "from": "idle",
          "to": "expanded",
          "trigger": "tap",
          "rules": []
        }
        """.utf8))

        XCTAssertTrue(transition.actions.isEmpty)
    }

    func testRejectsUnknownActionType() {
        assertInvalidActions("""
        [
          { "type": "unknownAction" }
        ]
        """)
    }

    func testRejectsNegativeDelayDuration() {
        assertInvalidActions("""
        [
          { "type": "delay", "duration": -0.1 }
        ]
        """)
    }

    func testRejectsEmptyActionGroup() {
        assertInvalidActions("""
        [
          { "type": "sequence", "actions": [] }
        ]
        """)
    }

    func testRejectsOutOfRangeHapticIntensity() {
        assertInvalidActions("""
        [
          { "type": "haptic", "style": "heavy", "intensity": 1.1 }
        ]
        """)
    }

    func testRejectsParticleEmissionWithoutPositiveCount() {
        assertInvalidActions("""
        [
          {
            "type": "emitParticles",
            "id": "tapBurst",
            "count": 0,
            "particle": {
              "kind": "circle",
              "motion": { "type": "immediate" },
              "lifetime": 0.2
            }
          }
        ]
        """)
    }

    func testRejectsParticleEmissionAboveBudget() {
        assertInvalidActions("""
        [
          {
            "type": "emitParticles",
            "id": "tapBurst",
            "count": \(MotionActionLimits.maxParticlesPerEmission + 1),
            "particle": {
              "kind": "circle",
              "motion": { "type": "immediate" },
              "lifetime": 0.2
            }
          }
        ]
        """)
    }

    func testRejectsComponentSpawnWithoutComponents() {
        assertInvalidActions("""
        [
          { "type": "spawnComponents", "id": "empty", "components": [] }
        ]
        """)
    }

    private func decodeActions(_ json: String) throws -> [MotionAction] {
        try JSONDecoder().decode([MotionAction].self, from: Data(json.utf8))
    }

    private func assertInvalidActions(
        _ json: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(try decodeActions(json), file: file, line: line)
    }
}
