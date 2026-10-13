/*
 * This file is part of shall-i-send
 *
 * Copyright (c) 2026 Baptiste Jamin
 * All rights reserved
 */

/**************************************************************************
 * IMPORTS
 ***************************************************************************/

// PROJECT: MAIN
import ShallISend from "@/shall-i-send";

/**************************************************************************
 * TESTS
 ***************************************************************************/

const shallISend = new ShallISend();

describe("Next candidate", () => {
  test("returns the next suitable candidate after a late French message", () => {
    const assessment = shallISend.assess("FR", "2026-09-10T21:30:00Z");

    expect(assessment.shouldDelay).toBe(true);
    expect(assessment.next).not.toBeNull();
    expect(assessment.next!.at > assessment.at).toBe(true);
    expect(assessment.next!.localTime).toBe("2026-09-11T09:00:00");
    expect(assessment.next!.meetsTarget).toBe(true);
    expect(assessment.next!.activity.relative).toBeGreaterThanOrEqual(0.7);
  });

  test("returns the current instant when it is already suitable", () => {
    const candidate = shallISend.getNextCandidate("FR", "2026-09-10T09:00:00Z");

    expect(candidate).not.toBeNull();
    expect(candidate!.at).toBe("2026-09-10T09:00:00.000Z");
    expect(candidate!.meetsTarget).toBe(true);
  });

  test("returns the best weekend candidate when the target is unreachable", () => {
    const assessment = shallISend.assess("FR", "2026-09-12T21:30:00Z");

    expect(assessment.next).not.toBeNull();
    expect(assessment.next!.activity.period).toBe("weekend");
    expect(assessment.next!.meetsTarget).toBe(false);
    expect(assessment.next!.activity.relative).toBeGreaterThan(
      assessment.activity.relative
    );
  });

  test("reports a send candidate for the current instant", () => {
    const assessment = shallISend.assess("FR", "2026-09-10T10:00:00Z");

    expect(assessment.next).not.toBeNull();
    expect(assessment.next!.at).toBe(assessment.at);
  });

  test("returns null when no instant is reachable in the horizon", () => {
    const candidate = shallISend.getNextCandidate(
      "FR", "2026-09-10T21:30:00Z", { horizonHours: 1 }
    );

    expect(candidate).toBeNull();
  });

  test("honors a custom target activity", () => {
    const candidate = shallISend.getNextCandidate(
      "FR", "2026-09-10T21:30:00Z", { targetActivity: 0.5 }
    );

    expect(candidate).not.toBeNull();
    expect(candidate!.meetsTarget).toBe(true);
    expect(candidate!.localTime! < "2026-09-11T09:00:00").toBe(true);
  });
});
