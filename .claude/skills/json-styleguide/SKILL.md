---
name: json-styleguide
description: >-
  Apply the Google JSON Style Guide when designing, editing, or reviewing JSON
  API requests, responses, schemas, and examples, and its syntax rules for strict
  JSON files. The jsoncguide source is about JSON APIs, not JSON with comments;
  do not impose API envelopes or naming on tool-owned configuration schemas.
license: CC-BY-3.0
---

# Google JSON style guide

Use the [Google JSON Style
Guide](https://google.github.io/styleguide/jsoncguide.html) for JSON API design
and review. Its published revision is 0.9. Despite the URL's name, this is not a
JSONC syntax guide, and it explicitly forbids comments in JSON payloads.

## Establish the contract

Identify whether the target is an API payload, a schema, an example, a strict
JSON configuration file, or a format that explicitly supports comments. Read the
existing schema and consumers before editing. Existing wire contracts and
tool-defined keys take precedence over adopting new naming or envelopes.

The API conventions below apply to a new or explicitly redesigned contract. Do
not wrap `package.json`, rename JSON Schema keywords, change map keys, remove
intentional JSONC comments, or migrate an established API just for style.

## Syntax, properties, and values

-   Produce strict JSON when JSON is requested: double-quoted keys and strings,
    valid escaping, no comments, trailing commas, expressions, or `undefined`.
    Numbers, booleans, and `null` are values, not quoted stand-ins for those
    types.
-   Give API properties meaningful ASCII `lowerCamelCase` names. Start with a
    letter, `_`, or `$`; subsequent characters may also include digits. Avoid
    reserved JavaScript words as a design preference, not a JSON syntax rule.
-   Distinguish structured objects from maps. Document maps explicitly; their
    arbitrary keys may contain Unicode or numeric strings and are exempt from
    property-naming rules.
-   Use plural names for arrays and singular names for other properties,
    allowing meaningful counts such as `totalItems` or `itemCount`.
-   Avoid arbitrary nesting. Preserve a nested object when it represents a real
    semantic unit, such as an address.
-   Prefer string enum values. Consider omitting optional empty or `null` values
    only when absence has the same meaning. Preserve meaningful `false`, `0`,
    empty collections, and nulls used by an existing contract or update
    operation.
-   Represent date/time values using RFC 3339 strings, durations using ISO 8601
    strings, and combined latitude/longitude using ISO 6709 strings when
    adopting the guide's conventions. Do not replace an established API's
    representation.
-   Resolve incompatible naming changes through a deliberate contract/version
    change; a style edit must not silently break clients.

## API envelope and reserved fields

For APIs adopting this envelope, successful responses carry a `data` object and
failed responses carry an `error` object. Do not emit both. Reserved properties
are not a checklist of mandatory fields; use their defined meanings when needed.
The guide specifically recommends that `apiVersion` be present.

| Property | Meaning |
| --- | --- |
| `apiVersion` | String identifying the API version, not the resource version. |
| `context` | Client-supplied string echoed in the response for correlation. |
| `id` | Server-supplied response identifier, distinct from `data.id`. |
| `method`, `params` | RPC operation name and object of input parameters. |
| `data.kind` | String identifying the resource type. |
| `data.id`, `data.etag` | Resource identity and resource version token. |
| `data.fields` | Nonempty field selection for a partial GET or PATCH. |
| `data.lang`, `data.updated` | BCP 47 language tag and RFC 3339 update time. |
| `data.deleted` | Deletion marker; if present under this convention, `true`. |
| `data.items` | Array holding the collection returned by the operation. |
| `error.code`, `error.message` | Integer error code and human-readable message. |
| `error.errors` | Array of detailed errors, when useful. |

Detailed errors may include `domain`, `reason`, `message`, `location`,
`locationType`, and help/report links. Keep machine-readable reasons separate
from human-readable messages; consult the source for exact reserved semantics.

JSON property order is not a semantic contract. For readable/streamable output,
the guide recommends `kind` first when present and `items` last in `data`.

## Collections and pagination

-   `currentItemCount` equals the returned `items.length`; `itemsPerPage` is the
    page capacity, which may exceed the last page's actual item count.
-   `totalItems` describes the whole collection. `startIndex` and `pageIndex`
    use one-based numbering under this convention. Preserve an existing API's
    cursor or indexing model instead of relabeling it.
-   Use only the fields needed by the selected paging scheme. Check first,
    middle, last, and empty pages when changing pagination behavior.
-   `self`, `edit`, `next`, and `previous` hold reference objects; names ending
    in `Link`, such as `nextLink`, hold URI strings. A `pagingLinkTemplate`, if
    used, must agree with the implemented index/page semantics.

This illustrative response keeps metadata before the items and shows that map
keys need not be property-style identifiers:

```json
{
  "apiVersion": "1.0",
  "data": {
    "kind": "assetCollection",
    "currentItemCount": 1,
    "itemsPerPage": 20,
    "startIndex": 1,
    "totalItems": 1,
    "items": [
      {
        "id": "asset-17",
        "previewBySize": {"72": "https://example.com/asset-17.png"}
      }
    ]
  }
}
```

## Check the change

Parse strict JSON with a real JSON parser and run existing schema or API checks
when available. Review value types, optional-field semantics, reserved names,
pagination consistency, and compatibility with consumers. Use the existing
formatter; this guide does not mandate a JSON indentation width.

For review-only work, report contract and style findings without modifying the
payload. Distinguish invalid JSON from a valid payload using another API style.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
The contract-preservation and verification instructions are repository-specific
adaptations. Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
