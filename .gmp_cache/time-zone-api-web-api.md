---
name: time-zone-api-web-api
description: Use this skill when a user needs to retrieve time zone data for specific latitude and longitude coordinates using the Google Maps Platform Time Zone API. Invoke this skill to calculate local times, determine UTC and daylight saving time (DST) offsets, retrieve Unicode CLDR time zone IDs, or localize time zone names via HTTP REST requests.
license: Apache-2.0
metadata:
  version: 1.0.55
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

Use this skill to integrate the Google Maps Platform Time Zone API into
applications via HTTP REST requests. The Time Zone API provides time offset data
for locations on the surface of the earth. By requesting the time zone
information for a specific latitude/longitude pair and a desired timestamp, the
API returns the name of that time zone, the time offset from UTC, the daylight
savings time (DST) offset, and the Unicode Common Locale Data Repository (CLDR)
time zone ID, with support for localized responses.

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Returns the time zone information for a specified timestamp
    and set of latitude/longitude coordinates via an HTTP GET request.** Read
    [references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md](https://www.gstatic.com/googlemapsplatform-agent-skills/time-zone-api-web-api/references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md).
    *Trigger Condition*: Use as the baseline prerequisite whenever the user
    wants to query the Time Zone API for time zone data using geographic
    coordinates and a timestamp. *Evidence Checkpoint*: The HTTP GET request
    includes valid location, timestamp, and key query parameters and returns a
    200 OK JSON or XML payload with status 'OK'.

### Phase 2: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Places (Optional - Use-Case Dependent)

-   [ ] **Retrieves and parses the daylight savings offset in seconds
    (dstOffset) for a time zone from the Time Zone API response.** Read
    [references/return-daylight-savings-offset-information-time-zone.md](https://www.gstatic.com/googlemapsplatform-agent-skills/time-zone-api-web-api/references/return-daylight-savings-offset-information-time-zone.md).
    *Dependencies*:
    `["references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md"]` \
    *Trigger Condition*: Use when the user needs to determine daylight savings
    time offsets or calculate local time accounting for DST. *Evidence
    Checkpoint*: The API response payload is parsed to extract the numeric
    'dstOffset' field value.
-   [ ] **Specifies the language in which localized time zone names
    (timeZoneName) should be returned in the Time Zone API request.** Read
    [references/specify-language-time-zone-requests.md](https://www.gstatic.com/googlemapsplatform-agent-skills/time-zone-api-web-api/references/specify-language-time-zone-requests.md).
    *Dependencies*:
    `["references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md"]` \
    *Trigger Condition*: Use when the user wants the returned time zone name
    localized into a specific language. *Evidence Checkpoint*: The HTTP GET
    request URL includes a valid 'language' query parameter and the response
    'timeZoneName' field reflects the requested locale.
-   [ ] **Retrieves the Unicode Common Locale Data Repository (CLDR) / IANA time
    zone ID (timeZoneId) from the Time Zone API response.** Read
    [references/return-unicode-common-locale-data-repository-cldr-id-time-zone.md](https://www.gstatic.com/googlemapsplatform-agent-skills/time-zone-api-web-api/references/return-unicode-common-locale-data-repository-cldr-id-time-zone.md).
    *Dependencies*:
    `["references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md"]` \
    *Trigger Condition*: Use when the user needs the canonical time zone
    identifier (such as 'America/Los_Angeles' or 'Australia/Sydney') for a
    location. *Evidence Checkpoint*: The API response payload is parsed to
    extract the 'timeZoneId' string field.
-   [ ] **Retrieves the standard base offset from UTC in seconds (rawOffset) for
    a given location from the Time Zone API response.** Read
    [references/return-offset-utc-seconds-time-zone.md](https://www.gstatic.com/googlemapsplatform-agent-skills/time-zone-api-web-api/references/return-offset-utc-seconds-time-zone.md).
    *Dependencies*:
    `["references/return-time-zone-timestamp-and-set-latitudelongitude-coordinates.md"]` \
    *Trigger Condition*: Use when the user needs the standard UTC offset in
    seconds (excluding daylight savings) or needs to compute the exact local
    time alongside dstOffset. *Evidence Checkpoint*: The API response payload is
    parsed to extract the numeric 'rawOffset' field value.
