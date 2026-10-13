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
import ActivityModel, {
  ActivityEstimate,
  ActivityPeriod,
  ModelInfo,
  PeakHour
} from "@/ActivityModel";
import TimeZones, { CountryTimeZone, LocalTime } from "@/TimeZones";

/**************************************************************************
 * TYPES
 ***************************************************************************/

export type SendInstant = Date | number | string;

export type SendRecommendation = "send" | "delay";

export type LocalPeriod = (
  "daytime" | "mixed" | "quiet" | "late" | "too_early" | "unknown"
);

export type ShallISendOptions = {
  quietStart?: number;
  quietEnd?: number;
  quietConsensus?: number;
  minimumActivity?: number;
  targetActivity?: number;
  stepMinutes?: number;
  horizonHours?: number;
}

export type QuietProbabilities = {
  late: number;
  tooEarly: number;
  quiet: number;
}

export type LocalAssessment = {
  timeZone: string | null;
  time: string | null;
  offsetCount: number;
  isApproximate: boolean;
  period: LocalPeriod;
  lateProbability: number;
  tooEarlyProbability: number;
  quietProbability: number;
}

export type SendCandidate = {
  at: string;
  timeZone: string | null;
  localTime: string | null;
  activity: ActivityEstimate;
  quietProbability: number;
  meetsTarget: boolean;
}

export type SendAssessment = {
  country: string;
  at: string;
  recommendation: SendRecommendation;
  shouldDelay: boolean;
  delayScore: number;
  activity: ActivityEstimate;
  local: LocalAssessment;
  next: SendCandidate | null;
  model: ModelInfo;
}

export type CountryComparison = {
  country: string;
  activity: ActivityEstimate;
  confidence: number;
}

/**************************************************************************
 * CONSTANTS
 ***************************************************************************/

const DEFAULT_OPTIONS: Required<ShallISendOptions> = {
  quietStart: 21,
  quietEnd: 8,
  quietConsensus: 0.7,
  minimumActivity: 0.4,
  targetActivity: 0.7,
  stepMinutes: 15,
  horizonHours: 24
};

const HOURS_PER_DAY = 24;
const MAXIMUM_HORIZON_HOURS = 168;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_MINUTE = 60000;
const MILLISECONDS_PER_HOUR = 3600000;
const SUNDAY = 0;
const SATURDAY = 6;

/**************************************************************************
 * CLASSES
 ***************************************************************************/

/**
 * Shall I Send
 */
class ShallISend {
  protected _options: Required<ShallISendOptions>;

  protected _model: ActivityModel = new ActivityModel();

  protected _timeZones: TimeZones = new TimeZones();

  /**
   * Constructor
   */
  constructor(options: ShallISendOptions = {}) {
    this._options = this._resolveOptions(options, DEFAULT_OPTIONS);
  }

  /**
   * Assesses if a message should be sent to a country at a given instant
   */
  assess(
    country: string, at?: SendInstant, options: ShallISendOptions = {}
  ): SendAssessment {
    const resolved = this._resolveOptions(options, this._options);
    const date = this._toDate(at);
    const code = this._model.normalizeCountry(country);
    const activity = this._estimate(code, date);
    const local = this._assessLocal(code, date, resolved);
    const shouldDelay = (
      activity.relative < resolved.minimumActivity ||
        local.quietProbability >= resolved.quietConsensus
    );

    return {
      country: code,
      at: date.toISOString(),
      recommendation: shouldDelay ? "delay" : "send",
      shouldDelay,
      delayScore: Math.max(1 - activity.relative, local.quietProbability),
      activity,
      local,
      next: shouldDelay
        ? this.getNextCandidate(code, date, resolved)
        : this._buildCandidate(code, date, resolved),
      model: this._model.getInfo(code)
    };
  }

  /**
   * Finds the next instant matching the target activity, or the best one
   */
  getNextCandidate(
    country: string, at?: SendInstant, options: ShallISendOptions = {}
  ): SendCandidate | null {
    const resolved = this._resolveOptions(options, this._options);
    const date = this._toDate(at);
    const code = this._model.normalizeCountry(country);

    if (this._isSuitable(code, date, resolved)) {
      return this._buildCandidate(code, date, resolved);
    }

    const step = resolved.stepMinutes * MILLISECONDS_PER_MINUTE;
    const start = Math.ceil(date.getTime() / step) * step;
    const end = start + (resolved.horizonHours * MILLISECONDS_PER_HOUR);

    let best: Date | null = null;
    let bestActivity = -1;

    for (let timestamp = start; timestamp <= end; timestamp += step) {
      const candidate = new Date(timestamp);

      if (this._isSuitable(code, candidate, resolved)) {
        return this._buildCandidate(code, candidate, resolved);
      }

      const relative = this._estimate(code, candidate).relative;

      if (
        this._getQuietProbabilities(code, candidate, resolved).quiet <
          resolved.quietConsensus &&
        relative > bestActivity
      ) {
        best = candidate;
        bestActivity = relative;
      }
    }

    return best ? this._buildCandidate(code, best, resolved) : null;
  }

  /**
   * Estimates the activity of a country at a given instant
   */
  getActivity(country: string, at?: SendInstant): ActivityEstimate {
    return this._estimate(
      this._model.normalizeCountry(country), this._toDate(at)
    );
  }

  /**
   * Lists the most active UTC hours of a country
   */
  getPeakHours(
    country: string, period: ActivityPeriod = "weekday", count = 3
  ): PeakHour[] {
    return this._model.getPeakHours(country, period, count);
  }

  /**
   * Compares the activity of countries at a given instant
   */
  compareCountries(
    countries: string[], at?: SendInstant
  ): CountryComparison[] {
    const date = this._toDate(at);

    return countries
      .map((country) => {
        const code = this._model.normalizeCountry(country);

        return {
          country: code,
          activity: this._estimate(code, date),
          confidence: this._model.getInfo(code).confidence
        };
      })
      .sort((left, right) => {
        return right.activity.index - left.activity.index;
      });
  }

  /**
   * Gets the representative time zone of a country
   */
  getTimeZone(country: string): CountryTimeZone | null {
    return this._timeZones.get(country);
  }

  /**
   * Gets the distinct local times observed across a country
   */
  getLocalTimes(country: string, at?: SendInstant): LocalTime[] {
    return this._timeZones.getLocalTimes(country, this._toDate(at));
  }

  /**
   * Gets information about the model used for a country
   */
  getModelInfo(country: string): ModelInfo {
    return this._model.getInfo(country);
  }

  /**
   * Converts an instant to a valid date
   */
  protected _toDate(at?: SendInstant): Date {
    const date = (at === undefined) ? new Date() : new Date(at);

    if (Number.isNaN(date.getTime())) {
      throw new TypeError("at must be a valid date");
    }

    return date;
  }

  /**
   * Merges and validates options against a base set of options
   */
  protected _resolveOptions(
    options: ShallISendOptions, base: Required<ShallISendOptions>
  ): Required<ShallISendOptions> {
    const resolved = { ...base };

    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && key in resolved) {
        resolved[key as keyof ShallISendOptions] = value;
      }
    }

    this._assertRange("quietStart", resolved.quietStart, 0, HOURS_PER_DAY);
    this._assertRange("quietEnd", resolved.quietEnd, 0, HOURS_PER_DAY);
    this._assertRange("quietConsensus", resolved.quietConsensus, 0, 1);
    this._assertRange("minimumActivity", resolved.minimumActivity, 0, 1);
    this._assertRange("targetActivity", resolved.targetActivity, 0, 1);
    this._assertRange(
      "stepMinutes", resolved.stepMinutes, 1, MINUTES_PER_HOUR, true
    );
    this._assertRange(
      "horizonHours", resolved.horizonHours, 1, MAXIMUM_HORIZON_HOURS, true
    );

    return resolved;
  }

  /**
   * Throws if an option is outside of its allowed range
   */
  protected _assertRange(
    name: string, value: number, minimum: number, maximum: number,
    integer = false
  ): void {
    if (
      !Number.isFinite(value) || value < minimum || value > maximum ||
        (integer && !Number.isInteger(value))
    ) {
      throw new RangeError(
        `${name} must be ${integer ? "an integer " : ""}` +
          `between ${minimum} and ${maximum}`
      );
    }
  }

  /**
   * Gets the activity period of an instant, based on its UTC day
   */
  protected _getPeriod(date: Date): ActivityPeriod {
    const day = date.getUTCDay();

    return (day === SUNDAY || day === SATURDAY) ? "weekend" : "weekday";
  }

  /**
   * Estimates the activity of a country at an instant
   */
  protected _estimate(country: string, date: Date): ActivityEstimate {
    const utcHour = (
      date.getUTCHours() +
        (date.getUTCMinutes() / MINUTES_PER_HOUR) +
        (date.getUTCSeconds() / SECONDS_PER_HOUR)
    );

    return this._model.estimate(country, utcHour, this._getPeriod(date));
  }

  /**
   * Computes how likely it is to be quiet hours in a country
   */
  protected _getQuietProbabilities(
    country: string, date: Date, options: Required<ShallISendOptions>
  ): QuietProbabilities {
    const locals = this._timeZones.getLocalTimes(country, date);

    if (locals.length === 0) {
      return { late: 0, tooEarly: 0, quiet: 0 };
    }

    const late = locals.filter((local) => {
      return local.hour >= options.quietStart;
    }).length / locals.length;

    const tooEarly = locals.filter((local) => {
      return local.hour < options.quietEnd;
    }).length / locals.length;

    return { late, tooEarly, quiet: late + tooEarly };
  }

  /**
   * Classifies the local period of a country
   */
  protected _classify(
    probabilities: QuietProbabilities, offsetCount: number,
    options: Required<ShallISendOptions>
  ): LocalPeriod {
    const consensus = options.quietConsensus;

    if (offsetCount === 0) {
      return "unknown";
    } else if (probabilities.late >= consensus) {
      return "late";
    } else if (probabilities.tooEarly >= consensus) {
      return "too_early";
    } else if (probabilities.quiet >= consensus) {
      return "quiet";
    } else if (probabilities.quiet > 0) {
      return "mixed";
    }

    return "daytime";
  }

  /**
   * Assesses the local time of a country
   */
  protected _assessLocal(
    country: string, date: Date, options: Required<ShallISendOptions>
  ): LocalAssessment {
    const locals = this._timeZones.getLocalTimes(country, date);
    const probabilities = this._getQuietProbabilities(country, date, options);

    return {
      timeZone: locals.length ? locals[0].timeZone : null,
      time: locals.length ? locals[0].time : null,
      offsetCount: locals.length,
      isApproximate: locals.length !== 1,
      period: this._classify(probabilities, locals.length, options),
      lateProbability: probabilities.late,
      tooEarlyProbability: probabilities.tooEarly,
      quietProbability: probabilities.quiet
    };
  }

  /**
   * Checks if an instant meets the target activity outside of quiet hours
   */
  protected _isSuitable(
    country: string, date: Date, options: Required<ShallISendOptions>
  ): boolean {
    return (
      this._estimate(country, date).relative >= options.targetActivity &&
        this._getQuietProbabilities(country, date, options).quiet <
          options.quietConsensus
    );
  }

  /**
   * Builds a send candidate for an instant
   */
  protected _buildCandidate(
    country: string, date: Date, options: Required<ShallISendOptions>
  ): SendCandidate {
    const locals = this._timeZones.getLocalTimes(country, date);
    const quiet = this._getQuietProbabilities(country, date, options).quiet;
    const activity = this._estimate(country, date);

    return {
      at: date.toISOString(),
      timeZone: locals.length ? locals[0].timeZone : null,
      localTime: locals.length ? locals[0].time : null,
      activity,
      quietProbability: quiet,
      meetsTarget: (
        activity.relative >= options.targetActivity &&
          quiet < options.quietConsensus
      )
    };
  }
}

/**************************************************************************
 * EXPORTS
 ***************************************************************************/

export * from "@/ActivityModel";
export * from "@/TimeZones";
export { ShallISend };
export default ShallISend;
