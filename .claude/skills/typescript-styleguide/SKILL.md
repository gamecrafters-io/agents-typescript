---
name: typescript-styleguide
description: >-
  Apply the Google TypeScript Style Guide when writing, editing, refactoring, or
  reviewing TypeScript and TSX source, types, imports, tests, or API documentation,
  even when no style guide is mentioned. Use its TypeScript-specific rules rather
  than imposing the legacy JavaScript guide's different class and JSDoc rules.
license: CC-BY-3.0
---

# Google TypeScript style guide

Apply the [Google TypeScript Style
Guide](https://google.github.io/styleguide/tsguide.html) to changed TypeScript
code. The source notes that Google's environment has constraints that may differ
from external projects. Read the local `tsconfig`, lint and formatter
configuration, framework conventions, and public contracts before applying its
rules.

Explicit project requirements and valid runtime behavior take precedence over
mechanical style adoption. Explain material deviations. Preserve required
framework exports and existing module resolution; do not alter the toolchain or
migrate unrelated code merely because this skill applies.

## Files and modules

-   Use UTF-8. Order any license, file-level JSDoc, imports, and implementation
    with a blank line between sections. Follow the repository's configured
    formatter.
-   Use ES imports/exports and prefer relative imports within the same logical
    project. Use named imports for clear, frequent symbols or namespace imports
    when they improve readability across a large API.
-   Use named exports and expose only the intended API. The Google rule forbids
    default exports; retain one when an existing framework contract requires it.
    Default imports are allowed for external code that requires them.
-   Avoid `export let` and other mutable exported bindings. Use explicit
    accessors for changing state. Do not create static-only classes to namespace
    functions.
-   `import type` is allowed for type-only symbols; normal imports are required
    for values. Re-export types using `export type`. Use a side-effect import
    when runtime initialization is needed, not a type import.
-   Do not use inline `import('module').Type` annotations. Prefer a top-level
    type import. This rule concerns type annotations, not runtime dynamic
    imports.
-   Do not introduce TypeScript `namespace` or `import = require` constructs;
    namespaces are reserved for required third-party interoperability.

## Type design

-   Prefer interfaces for object shapes and type aliases for unions, tuples, and
    other type expressions. Use structural contracts instead of classes that
    merely carry a type declaration.
-   Omit trivially inferred annotations on unexported literal-initialized
    values. Add annotations when they clarify a complex expression or public
    contract. Explicit return types are a local choice, not universally required
    by Google. Keep annotations required by settings such as
    `isolatedDeclarations`.
-   Use `T[]` and `readonly T[]` for simple element types, including qualified
    names; use `Array<T>` or `ReadonlyArray<T>` for complex element types.
-   Prefer a precise type or `unknown` over `any`. Narrow unknown values before
    use. A necessary `any`, such as a deliberately incomplete test double, needs
    a narrow, explained exception rather than a broad suppression.
-   Do not treat `{}` as an empty-object type: it accepts any non-nullish value.
    Choose `unknown`, `object`, a specific interface, or an appropriate
    dictionary type according to the actual contract. Use primitive `string`,
    `number`, and `boolean` types rather than their wrapper types.
-   Both `null` and `undefined` may represent absence. Preserve the API's
    meaning; do not impose a blanket preference. Add nullable unions at use
    sites rather than hiding absence in a generally reused type alias.
-   Prefer the simplest type construct that expresses the contract. Mapped and
    conditional types are allowed when their benefit warrants the complexity.
-   Consider `Map`/`Set` for dynamic collections; use meaningful index-signature
    parameter names. Prefer named fields to opaque tuple positions when useful.
-   Avoid APIs whose generic parameter appears only in the return type. When
    consuming such an existing API, specify the generic argument explicitly.

## Assertions, errors, and control flow

-   Prefer a runtime check or type narrowing over `as` and non-null assertions.
    An assertion needs an obvious invariant or an explanation. Use `as` syntax;
    if a justified double assertion is necessary, cast through `unknown`.
-   Annotate an object literal with its expected type instead of asserting it
    after construction, so missing or incompatible fields remain detectable.
-   Throw/reject `Error` instances and use `new Error(...)`. An error `cause`
    should itself be an error. Keep `try` blocks focused and explain empty
    catches. The source assumes errors are `Error` objects; document known
    non-Error throws at an external boundary instead of silently relying on that
    assumption there.
-   Use `===`/`!==`; `== null`/`!= null` is allowed for a combined nullish
    check. Compare enum values explicitly instead of converting them to
    booleans.
-   Prefer `for...of` for arrays and `Object.keys`/`values`/`entries` for
    objects. Filter inherited keys if a `for...in` loop is necessary.
-   Use braces for control bodies, with the source's small one-line `if`
    exception. Put `default` last in a `switch`; nonempty case groups must not
    fall through.
-   Convert numeric strings using `Number` and handle invalid results. Avoid
    unary `+` and `parseFloat`; use `parseInt` only for a required nondecimal
    radix, with input validation and a check for `NaN`.

## Functions, classes, and language features

-   Default to `const`, use `let` for reassignment, and do not use `var`.
    Declare one variable per statement. Use array/object literals, not their
    constructors; `Array.from` is available for deliberate array construction.
-   Prefer declarations for named functions and arrows for callbacks. Function
    expressions are reserved for required dynamic `this` binding or generators.
    Explicit callback forwarding avoids accidental extra arguments.
-   Use concise arrow bodies only when their result is intended, or explicitly
    discarded with `void`. Avoid rebinding `this`; keep stable handler
    references when event listeners must later be removed.
-   Use rest/spread rather than `arguments`/`apply`, shallow parameter
    destructuring, and simple default values without observable side effects.
-   Mark fields not reassigned after construction `readonly`; this does not
    imply deep immutability. Prefer parameter properties for straightforward
    assignments. Initialize independent fields at their declarations; do not
    make field initializers depend on constructor parameter properties.
-   The source uses TypeScript `private`/`protected`, not ECMAScript `#private`.
    Do not access private members through bracket notation. Omit redundant
    `public` except for non-readonly public constructor parameter properties.
-   Accessors are allowed: getters have no observable side effects and return
    consistent results, and at least one accessor must do more than pass through
    a field. Avoid `this` in static methods and direct prototype manipulation.
-   Use single quotes, allowing double quotes to avoid escaping an apostrophe;
    use template literals for interpolation. Do not continue strings with a
    trailing backslash. End statements with explicit semicolons.
-   Do not introduce `const enum`, primitive wrapper constructors, `eval`,
    string-built functions, production `debugger` statements, or changes to
    built-in prototypes. The source restricts decorators to established
    framework ones; preserve the project's supported decorator model.

## Names and documentation

-   Use `UpperCamelCase` for classes, interfaces, types, enums, type parameters,
    and TSX component functions. Use `lowerCamelCase` for other functions,
    variables, parameters, properties, and module aliases. Treat acronyms as
    words.
-   Use `CONSTANT_CASE` for module/global constants and enum members intended to
    remain unchanged; function-local `const` values remain camel case.
-   Do not add private-member underscores or routine `I` prefixes to interfaces.
    An underscore prefix may mark a syntactically required unused parameter.
-   Document top-level exports and non-obvious members with JSDoc; symbols
    exported solely for tooling are exempt. Describe behavior and constraints,
    without restating TypeScript types in `@param`, `@return`, or visibility
    annotations.
-   Use `//` comments for implementation explanations, including multiline ones.
    Put JSDoc before decorators and include migration guidance in `@deprecated`.

## Check the change

Run the repository's applicable formatter, lint, and type-check commands. A
transpilation-only build does not establish type correctness. Run relevant tests
when behavior changes and inspect the final diff for unrelated edits.

Do not suppress production errors with `@ts-ignore`, `@ts-nocheck`, or
`@ts-expect-error`. The source permits `@ts-expect-error` in unit tests but
discourages broad error matching; preserve a justified negative-type test with
the narrowest useful scope. Report concrete findings without editing for a
review-only request.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
Repository and external-boundary compatibility notes are local adaptations.
Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
