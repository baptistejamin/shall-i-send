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

describe("Activity", () => {
  test("normalizes the hourly profile", () => {
    let totalShare = 0;

    for (let hour = 0; hour < 24; hour += 1) {
      const instant = `2026-09-10T${String(hour).padStart(2, "0")}:00:00Z`;

      totalShare += shallISend.getActivity("FR", instant).hourlyShare;
    }

    expect(Math.abs(totalShare - 1)).toBeLessThan(1e-12);
  });

  test("models the observed French morning peak", () => {
    const morning = shallISend.getActivity("FR", "2026-09-10T09:00:00Z");
    const night = shallISend.getActivity("FR", "2026-09-10T03:00:00Z");

    expect(morning.index).toBeGreaterThan(night.index);
    expect(shallISend.getPeakHours("FR", "weekday", 1)[0].hour).toBe(9);
  });

  test("keeps the relative activity between 0 and 1", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const instant = `2026-09-12T${String(hour).padStart(2, "0")}:30:00Z`;
      const { relative } = shallISend.getActivity("DE", instant);

      expect(relative).toBeGreaterThanOrEqual(0);
      expect(relative).toBeLessThanOrEqual(1);
    }
  });

  test("lists peak hours sorted by activity", () => {
    const peaks = shallISend.getPeakHours("FR", "weekday", 3);

    expect(peaks).toHaveLength(3);
    expect(peaks[0].index).toBeGreaterThanOrEqual(peaks[1].index);
    expect(peaks[1].index).toBeGreaterThanOrEqual(peaks[2].index);
  });

  test("rejects an invalid peak hours count", () => {
    expect(() => {
      shallISend.getPeakHours("FR", "weekday", 0);
    }).toThrow(RangeError);

    expect(() => {
      shallISend.getPeakHours("FR", "weekday", 25);
    }).toThrow(RangeError);
  });

  test("compares countries by activity", () => {
    const comparison = shallISend.compareCountries(
      ["US", "fr"], "2026-09-10T09:00:00Z"
    );

    expect(comparison[0].country).toBe("FR");
    expect(comparison[0].activity.index).toBeGreaterThan(
      comparison[1].activity.index
    );
  });
});

describe("Model", () => {
  test("describes a known country", () => {
    const info = shallISend.getModelInfo("fr");

    expect(info.country).toBe("FR");
    expect(info.usesFallback).toBe(false);
    expect(info.samples).toBeGreaterThan(0);
    expect(info.confidence).toBeGreaterThan(0.5);
    expect(info.confidence).toBeLessThan(1);
  });

  test("uses the global model for an unknown country", () => {
    const info = shallISend.getModelInfo("XX");

    expect(info.usesFallback).toBe(true);
    expect(info.samples).toBe(0);
    expect(info.confidence).toBe(0);
  });

  test("still estimates activity for an unknown country", () => {
    const activity = shallISend.getActivity("XX", "2026-09-10T09:00:00Z");

    expect(activity.index).toBeGreaterThan(0);
  });
});

describe("Time zones", () => {
  test("gets the representative time zone", () => {
    expect(shallISend.getTimeZone("FR")).toEqual({
      country: "FR",
      timeZone: "Europe/Paris",
      candidateCount: 1,
      isApproximate: false
    });
  });

  test("flags multi time zone countries as approximate", () => {
    const timeZone = shallISend.getTimeZone("US");

    expect(timeZone?.timeZone).toBe("America/New_York");
    expect(timeZone?.isApproximate).toBe(true);
  });

  test("returns null for an unknown country", () => {
    expect(shallISend.getTimeZone("XX")).toBeNull();
  });

  test("lists distinct local times", () => {
    const locals = shallISend.getLocalTimes("US", "2026-09-10T03:00:00Z");

    expect(locals[0].time).toBe("2026-09-09T23:00:00");
    expect(locals).toHaveLength(7);
  });

  test("returns no local time for an unknown country", () => {
    expect(shallISend.getLocalTimes("XX", "2026-09-10T03:00:00Z")).toEqual([]);
  });
});
