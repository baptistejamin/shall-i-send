# shall-i-send

Shall I send this message now? Given a country and a moment, `shall-i-send` tells you if it is a good time to reach someone there, and when to send it otherwise.

- Activity is modeled per country with a small Fourier series (no CSV, no network, no runtime dependency).
- Weekdays and weekends have distinct profiles.
- Countries spanning several time zones are handled with an uncertainty score, to avoid false positives (e.g. the United States).
- Unknown countries fall back to a global profile.

## Installation

```bash
npm install shall-i-send
```

Requires Node.js 18 or newer.

## Usage

```ts
import ShallISend from "shall-i-send";

const shallISend = new ShallISend();

// Assess right now
const now = shallISend.assess("FR");

if (now.shouldDelay) {
  console.log(`Better send it at ${now.next?.at}`);
}

// Assess a specific instant
const assessment = shallISend.assess("FR", "2026-09-10T21:30:00Z");

assessment.recommendation; // "delay"
assessment.local.time; // "2026-09-10T23:30:00"
assessment.next?.at; // "2026-09-11T07:00:00.000Z"
assessment.next?.localTime; // "2026-09-11T09:00:00"
```

The instant is optional and defaults to now. It can be a `Date`, a timestamp or an ISO string.

## API

### `new ShallISend(options?)`

| Option            | Default | Description                                                     |
| ----------------- | ------- | --------------------------------------------------------------- |
| `quietStart`      | `21`    | Local hour from which it is considered too late                 |
| `quietEnd`        | `8`     | Local hour before which it is considered too early              |
| `quietConsensus`  | `0.7`   | Share of local times in quiet hours needed to delay (0 to 1)    |
| `minimumActivity` | `0.4`   | Below this relative activity, the message is delayed (0 to 1)   |
| `targetActivity`  | `0.7`   | Relative activity wanted for the next candidate (0 to 1)        |
| `stepMinutes`     | `15`    | Search step of the next candidate, in minutes (1 to 60)         |
| `horizonHours`    | `24`    | How far the next candidate is searched, in hours (1 to 168)     |

Invalid options throw a `RangeError`. Every method that takes `options` accepts the same keys to override them for a single call.

### Methods

- `assess(country, at?, options?)` returns a `SendAssessment`: the recommendation (`"send"` or `"delay"`), a delay score, the estimated activity, the local time assessment and the next candidate.
- `getNextCandidate(country, at?, options?)` returns the next suitable instant, or the best one reachable in the horizon (`meetsTarget: false`), or `null`.
- `getActivity(country, at?)` returns the activity index, the activity relative to the weekly peak (0 to 1) and the share of the daily activity.
- `getPeakHours(country, period?, count?)` lists the most active UTC hours, for `"weekday"` or `"weekend"`.
- `compareCountries(countries, at?)` sorts countries by activity at a given instant.
- `getTimeZone(country)` returns the representative time zone of a country.
- `getLocalTimes(country, at?)` returns the distinct local times observed across a country.
- `getModelInfo(country)` returns the sample size, the confidence and whether the global fallback is used.

Country codes are ISO 3166-1 alpha-2 and case insensitive.

## How it works

- **Activity**: a 24h Fourier series (4 harmonics) per country and per period, smoothed towards the global profile when a country has few samples. The activity is expressed relative to the weekly peak of the country.
- **Weekdays and weekends**: selected from the UTC day of the instant.
- **Quiet hours**: the local time is computed in every time zone of the country. The probability of quiet hours is the share of distinct local times that are too late or too early.
- **Decision**: the message is delayed if the relative activity is under `minimumActivity`, or if the quiet probability reaches `quietConsensus`.

## Limitations

- The model describes when customers are active, not when they are likely to reply.
- Public holidays are not modeled.
- The profiles come from a sample of the activity, with hours assumed to be in UTC.

## License

MIT, Baptiste Jamin
