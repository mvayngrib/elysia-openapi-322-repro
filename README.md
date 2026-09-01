# Repro: `fromTypes` silently drops routes whose path segment ends in a digit

Reproduces [elysiajs/elysia-openapi#322](https://github.com/elysiajs/elysia-openapi/issues/322)
on the current `next` release, **`@elysia/openapi@2.0.0-beta.2`** with `elysia@2.0.0-beta.11`.

Same root cause as [#345](https://github.com/elysiajs/elysia-openapi/issues/345),
[#339](https://github.com/elysiajs/elysia-openapi/issues/339) and
[#298](https://github.com/elysiajs/elysia-openapi/issues/298).

## This is already fixed in two open PRs

**No new patch is needed — one of these just needs review.** Both have been sitting open:

| PR | Opened | Approach |
|---|---|---|
| [**#290** — fix: add type-gen support for alphanumeric paths](https://github.com/elysiajs/elysia-openapi/pull/290) | 2025-10-18 (+58/-2, with tests) | Quotes *every* unquoted property key instead of narrowing the numeric match. Minimal and self-contained; explicitly targets [#298](https://github.com/elysiajs/elysia-openapi/issues/298). |
| [**#329** — fix: fromTypes response parsing](https://github.com/elysiajs/elysia-openapi/pull/329) | 2026-02-23 (+895/-34) | Carries the identical `(?<=^\|[{;,\s])(\d+):` lookbehind, bundled with unrelated fixes (type-alias inlining, `import()` resolution). |

[#290](https://github.com/elysiajs/elysia-openapi/pull/290) is the smaller review surface if the
goal is just to unblock [#322](https://github.com/elysiajs/elysia-openapi/issues/322),
[#345](https://github.com/elysiajs/elysia-openapi/issues/345),
[#339](https://github.com/elysiajs/elysia-openapi/issues/339) and
[#298](https://github.com/elysiajs/elysia-openapi/issues/298) — four issues, one line.

This repo exists only to show the bug is still live on the current `next` release.

## Run

```sh
bun install
bun run repro
```

## Actual output

```
DROPPED  issue #322  /api/v1/project/test   <no response schema>
DROPPED  issue #345  /encode/base64         <no response schema>
ok       control    /encode/hex            {"200":{"type":"object","required":["enc"],...
DROPPED  issue #339  /test3                 <no response schema>
ok       control    /test                   {"200":{"type":"string"}}

3 of 5 routes have no inferred response schema.
```

`/encode/hex` works and `/encode/base64` does not. The only difference is the trailing digit.

## Root cause

`src/gen/index.ts` quotes bare numeric status-code keys before handing the declaration to the
schema parser:

```ts
const numberKey = /(\d+):/g
// ...
extractRootObjects(declaration.replace(numberKey, '"$1":'))
```

The intent is `200:` → `"200":`. But the pattern matches *any* run of digits before a colon,
including the trailing digits of an identifier. `tsc` emits the route tree as nested keys, so a
path segment `v1` becomes:

```
{api: { v"1": { project: { test: { get: { body: unknown; ...
```

That is not parseable TypeScript, so `Script()` returns a `Never` schema, `schema.type !== 'object'`
hits `continue`, and the whole object is dropped. Because each route is its own intersection member
of the routes generic, **every** route under `api.v1` disappears at once — which is why #322 looks
like "type inference is completely unavailable" rather than one bad route.

## The one-line change

For reference, this is what [#329](https://github.com/elysiajs/elysia-openapi/pull/329)
carries; [#290](https://github.com/elysiajs/elysia-openapi/pull/290) achieves the same result by
quoting every key. Anchor the match to a key boundary so it only fires on keys that are entirely
numeric:

```diff
-const numberKey = /(\d+):/g
+const numberKey = /(?<=^|[{};,\s])(\d+):/g
```

Applying that to `node_modules/@elysia/openapi/dist/gen/index.mjs` in this repro turns the output
into:

```
ok       issue #322  /api/v1/project/test   {"200":{"type":"object","required":["success","message"],...
ok       issue #345  /encode/base64         {"200":{"type":"object","required":["enc"],...
ok       control    /encode/hex            {"200":{"type":"object","required":["enc"],...
ok       issue #339  /test3                 {"200":{"type":"string"}}
ok       control    /test                   {"200":{"type":"string"}}

0 of 5 routes have no inferred response schema.
```

Paths that are *entirely* numeric (`/api/2024/report`) still get quoted correctly and keep working.

## Notes

- The regex is byte-identical in `1.4.15`, `2.0.0-beta.1` and `2.0.0-beta.2`.
- 2.0 does add real declared-type handling (`extractTypeContext`, `resolveTypeRefs`,
  `resolveExternalRefs`), but both branches of `declarationToReference` call
  `declarationToJSONSchema`, which applies the corrupting replace before any of it runs.
- `@elysia/openapi@2.0.0-beta.1` cannot be tested directly: its `dist/gen/index.mjs` imports
  `"../node_modules/typebox/build/type/script/script.mjs"`, which is not in the published tarball,
  so `@elysia/openapi/gen` fails to import at all. Fixed in `beta.2`.

Verified with bun 1.4.0 and tsc 5.9.3 on macOS (arm64).
