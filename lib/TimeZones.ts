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
import { TIME_ZONES } from "@/data/timezones";

/**************************************************************************
 * TYPES
 ***************************************************************************/

export type LocalTime = {
  timeZone: string;
  hour: number;
  time: string;
}

export type CountryTimeZone = {
  country: string;
  timeZone: string;
  candidateCount: number;
  isApproximate: boolean;
}

/**************************************************************************
 * CONSTANTS
 ***************************************************************************/

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;

/**************************************************************************
 * CLASSES
 ***************************************************************************/

/**
 * Time Zones
 */
class TimeZones {
  protected _formatters: Map<string, Intl.DateTimeFormat> = new Map();

  /**
   * Gets the representative time zone of a country
   */
  get(country: string): CountryTimeZone | null {
    const code = String(country).trim()
      .toUpperCase();
    const zones = TIME_ZONES[code];

    if (!zones) {
      return null;
    }

    return {
      country: code,
      timeZone: zones[0],
      candidateCount: zones.length,
      isApproximate: zones.length > 1
    };
  }

  /**
   * Gets the local time in a time zone
   */
  getLocalTime(timeZone: string, date: Date): LocalTime {
    const parts: Record<string, string> = {};

    for (const part of this._getFormatter(timeZone).formatToParts(date)) {
      parts[part.type] = part.value;
    }

    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);

    return {
      timeZone,
      hour: hour + (minute / MINUTES_PER_HOUR) + (second / SECONDS_PER_HOUR),
      time: (
        `${parts.year}-${parts.month}-${parts.day}T` +
          `${parts.hour}:${parts.minute}:${parts.second}`
      )
    };
  }

  /**
   * Gets the distinct local times observed across a country
   */
  getLocalTimes(country: string, date: Date): LocalTime[] {
    const code = String(country).trim()
      .toUpperCase();
    const zones = TIME_ZONES[code] || [];
    const distinct: Map<string, LocalTime> = new Map();

    for (const timeZone of zones) {
      const local = this.getLocalTime(timeZone, date);

      if (!distinct.has(local.time)) {
        distinct.set(local.time, local);
      }
    }

    return Array.from(distinct.values());
  }

  /**
   * Gets a cached date formatter for a time zone
   */
  protected _getFormatter(timeZone: string): Intl.DateTimeFormat {
    let formatter = this._formatters.get(timeZone);

    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      });

      this._formatters.set(timeZone, formatter);
    }

    return formatter;
  }
}

/**************************************************************************
 * EXPORTS
 ***************************************************************************/

export default TimeZones;
