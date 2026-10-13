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

describe("Assess", () => {
  test("recommends sending during French daytime", () => {
    const assessment = shallISend.assess("FR", "2026-09-10T10:00:00Z");

    expect(assessment.local.time).toBe("2026-09-10T12:00:00");
    expect(assessment.local.period).toBe("daytime");
    expect(assessment.recommendation).toBe("send");
    expect(assessment.shouldDelay).toBe(false);
  });

  test("recommends delaying late French messages", () => {
    const assessment = shallISend.assess("FR", "2026-09-10T21:30:00Z");

    expect(assessment.local.time).toBe("2026-09-10T23:30:00");
    expect(assessment.local.period).toBe("late");
    expect(assessment.recommendation).toBe("delay");
  });

  test("does not send late at night in a certain German timezone", () => {
    const assessment = shallISend.assess("DE", "2026-09-12T21:30:00Z");

    expect(assessment.local.time).toBe("2026-09-12T23:30:00");
    expect(assessment.local.quietProbability).toBe(1);
    expect(assessment.shouldDelay).toBe(true);
    expect(assessment.next?.at).toBeDefined();
    expect(assessment.next!.at > assessment.at).toBe(true);
  });

  test("reduces false positives for countries with multiple timezones", () => {
    const assessment = shallISend.assess("US", "2026-09-10T03:00:00Z");

    expect(assessment.local.timeZone).toBe("America/New_York");
    expect(assessment.local.isApproximate).toBe(true);
    expect(assessment.local.period).toBe("mixed");
    expect(assessment.local.lateProbability).toBe(3 / 7);
    expect(assessment.shouldDelay).toBe(false);
  });

  test("delays when all timezone offsets are in quiet hours", () => {
    const assessment = shallISend.assess("US", "2026-09-10T10:55:00Z");

    expect(assessment.local.quietProbability).toBe(1);
    expect(assessment.shouldDelay).toBe(true);
  });

  test("uses a distinct French weekend profile", () => {
    const weekday = shallISend.assess("FR", "2026-09-11T07:00:00Z");
    const weekend = shallISend.assess("FR", "2026-09-13T07:00:00Z");

    expect(weekday.activity.period).toBe("weekday");
    expect(weekend.activity.period).toBe("weekend");
    expect(weekday.activity.relative).toBeGreaterThan(
      weekend.activity.relative
    );
  });

  test("normalizes the country code", () => {
    const assessment = shallISend.assess(" fr ", "2026-09-10T10:00:00Z");

    expect(assessment.country).toBe("FR");
  });

  test("accepts dates and timestamps", () => {
    const iso = shallISend.assess("FR", "2026-09-10T10:00:00Z");
    const date = shallISend.assess("FR", new Date("2026-09-10T10:00:00Z"));
    const timestamp = shallISend.assess("FR", Date.parse("2026-09-10T10:00:00Z"));

    expect(date.at).toBe(iso.at);
    expect(timestamp.at).toBe(iso.at);
  });

  test("defaults to the current time", () => {
    const before = Date.now();
    const assessment = shallISend.assess("FR");

    expect(Date.parse(assessment.at)).toBeGreaterThanOrEqual(before);
  });

  test("handles an unknown country with the global model", () => {
    const assessment = shallISend.assess("XX", "2026-09-10T10:00:00Z");

    expect(assessment.model.usesFallback).toBe(true);
    expect(assessment.local.period).toBe("unknown");
    expect(assessment.local.timeZone).toBeNull();
    expect(assessment.local.isApproximate).toBe(true);
  });

  test("rejects an invalid date", () => {
    expect(() => {
      shallISend.assess("FR", "not a date");
    }).toThrow(TypeError);
  });

  test("allows overriding options for a single call", () => {
    const assessment = shallISend.assess("FR", "2026-09-10T19:30:00Z", {
      quietStart: 23
    });

    expect(assessment.local.period).toBe("daytime");
  });
});

describe("Options", () => {
  test("uses options given to the constructor", () => {
    const strict = new ShallISend({ quietStart: 12 });
    const assessment = strict.assess("FR", "2026-09-10T11:00:00Z");

    expect(assessment.local.period).toBe("late");
    expect(assessment.shouldDelay).toBe(true);
  });

  test("rejects out of range options", () => {
    expect(() => {
      return new ShallISend({ quietStart: 25 });
    }).toThrow(RangeError);

    expect(() => {
      return new ShallISend({ minimumActivity: 2 });
    }).toThrow(RangeError);

    expect(() => {
      return new ShallISend({ stepMinutes: 0 });
    }).toThrow(RangeError);

    expect(() => {
      return new ShallISend({ stepMinutes: 1.5 });
    }).toThrow("stepMinutes must be an integer between 1 and 60");

    expect(() => {
      return new ShallISend({ horizonHours: 500 });
    }).toThrow(RangeError);
  });

  test("rejects out of range options for a single call", () => {
    expect(() => {
      shallISend.assess("FR", "2026-09-10T10:00:00Z", { quietConsensus: -1 });
    }).toThrow(RangeError);
  });
});
