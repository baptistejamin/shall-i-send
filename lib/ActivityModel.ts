/*
 * This file is part of shall-i-send
 *
 * Copyright (c) 2026 Baptiste Jamin
 * All rights reserved
 */

/**************************************************************************
 * IMPORTS
 ***************************************************************************/

// PROJECT: DATA
import {
  ACTIVITY_COEFFICIENTS,
  FALLBACK_COEFFICIENTS,
  ActivityCoefficients
} from "@/data/activity";

/**************************************************************************
 * TYPES
 ***************************************************************************/

export type ActivityPeriod = "weekday" | "weekend";

export type ActivityEstimate = {
  period: ActivityPeriod;
  index: number;
  relative: number;
  hourlyShare: number;
}

export type ModelInfo = {
  country: string;
  samples: number;
  confidence: number;
  usesFallback: boolean;
}

export type PeakHour = {
  hour: number;
  index: number;
  share: number;
}

/**************************************************************************
 * CONSTANTS
 ***************************************************************************/

const HOURS_PER_DAY = 24;
const HARMONICS = 4;
const PRIOR_STRENGTH = 500;
const PEAK_RESOLUTION = 4;
const TAU = Math.PI * 2;

/**************************************************************************
 * CLASSES
 ***************************************************************************/

/**
 * Activity Model
 */
class ActivityModel {
  protected _peaks: Map<string, number> = new Map();

  /**
   * Normalizes a country code
   */
  normalizeCountry(country: string): string {
    return String(country).trim()
      .toUpperCase();
  }

  /**
   * Gets information about the model used for a country
   */
  getInfo(country: string): ModelInfo {
    const code = this.normalizeCountry(country);
    const coefficients = ACTIVITY_COEFFICIENTS[code];
    const samples = coefficients ? coefficients.samples : 0;

    return {
      country: code,
      samples,
      confidence: samples / (samples + PRIOR_STRENGTH),
      usesFallback: !coefficients
    };
  }

  /**
   * Evaluates the activity index at a UTC hour, where 1 is the daily average
   */
  evaluate(country: string, utcHour: number, period: ActivityPeriod): number {
    if (!Number.isFinite(utcHour)) {
      throw new TypeError("utcHour must be a finite number");
    }

    const coefficients = this._getCoefficients(country);
    const hour = ((utcHour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
    const harmonics = coefficients[period];
    const scale = (period === "weekend") ? coefficients.weekendScale : 1;

    let index = 1;

    for (let harmonic = 1; harmonic <= HARMONICS; harmonic += 1) {
      const angle = (TAU * harmonic * hour) / HOURS_PER_DAY;
      const offset = (harmonic - 1) * 2;

      index += harmonics[offset] * Math.cos(angle);
      index += harmonics[offset + 1] * Math.sin(angle);
    }

    return Math.max(0, index * scale);
  }

  /**
   * Gets the highest activity index reached during a period
   */
  getPeak(country: string, period: ActivityPeriod): number {
    const key = `${this.normalizeCountry(country)}:${period}`;
    const cached = this._peaks.get(key);

    if (cached !== undefined) {
      return cached;
    }

    let peak = 0;

    for (let step = 0; step < HOURS_PER_DAY * PEAK_RESOLUTION; step += 1) {
      peak = Math.max(
        peak, this.evaluate(country, step / PEAK_RESOLUTION, period)
      );
    }

    this._peaks.set(key, peak);

    return peak;
  }

  /**
   * Gets the highest activity index reached during a whole week
   */
  getWeeklyPeak(country: string): number {
    return Math.max(
      this.getPeak(country, "weekday"), this.getPeak(country, "weekend")
    );
  }

  /**
   * Gets the share of the daily activity that happens during a UTC hour
   */
  getHourlyShare(
    country: string, utcHour: number, period: ActivityPeriod
  ): number {
    let dailyTotal = 0;

    for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
      dailyTotal += this.evaluate(country, hour, period);
    }

    return this.evaluate(country, utcHour, period) / dailyTotal;
  }

  /**
   * Estimates the activity at a UTC hour, relative to the weekly peak
   */
  estimate(
    country: string, utcHour: number, period: ActivityPeriod
  ): ActivityEstimate {
    const index = this.evaluate(country, utcHour, period);
    const weeklyPeak = this.getWeeklyPeak(country);

    return {
      period,
      index,
      relative: (weeklyPeak > 0) ? (index / weeklyPeak) : 0,
      hourlyShare: this.getHourlyShare(country, utcHour, period)
    };
  }

  /**
   * Lists the most active UTC hours of a period
   */
  getPeakHours(
    country: string, period: ActivityPeriod, count: number
  ): PeakHour[] {
    if (!Number.isInteger(count) || count < 1 || count > HOURS_PER_DAY) {
      throw new RangeError("count must be an integer between 1 and 24");
    }

    return Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
      return {
        hour,
        index: this.evaluate(country, hour, period),
        share: this.getHourlyShare(country, hour, period)
      };
    })
      .sort((left, right) => {
        return right.index - left.index;
      })
      .slice(0, count);
  }

  /**
   * Gets the coefficients of a country, or the global ones as a fallback
   */
  protected _getCoefficients(country: string): ActivityCoefficients {
    return (
      ACTIVITY_COEFFICIENTS[this.normalizeCountry(country)] ||
        FALLBACK_COEFFICIENTS
    );
  }
}

/**************************************************************************
 * EXPORTS
 ***************************************************************************/

export default ActivityModel;
