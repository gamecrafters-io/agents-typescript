---
name: javascript-styleguide
description: >-
  Apply the Google JavaScript Style Guide when writing, editing, refactoring, or
  reviewing JavaScript source, modules, tests, or JSDoc. Use for JavaScript tasks
  even when no style guide is mentioned; use TypeScript-specific guidance for
  TypeScript files instead.
license: CC-BY-3.0
---

# Google JavaScript style guide

Apply the [Google JavaScript Style
Guide](https://google.github.io/styleguide/jsguide.html) to the JavaScript being
changed. The source guide is no longer maintained and recommends TypeScript.
That notice does not require migrating an existing task or changing its
language.

## Apply the guide in context

Read the relevant source and existing lint, formatter, module, and runtime
configuration first. Honor explicit project requirements and public contracts;
explain a material conflict with Google style instead of silently changing the
toolchain. Keep unrelated formatting and generated code outside a focused edit.

The following is a condensed guide. Consult the source for uncommon rules and
exceptions. Examples illustrate choices; they do not make every shown choice
mandatory. Closure-specific instructions apply when that toolchain is used.

## Files, modules, and formatting

-   Use UTF-8, spaces rather than tabs, two-space block indentation, and no
    trailing whitespace. Ordinary lines have an 80-column limit; wrapped
    continuations use at least four extra spaces unless they are block-indented
    constructs.
-   The guide uses lowercase `.js` filenames with underscores or hyphens
    according to project convention. Preserve extensions required by the actual
    runtime, such as `.mjs` or `.cjs`, rather than renaming files mechanically.
-   Keep any license and file overview before dependencies, then implementation.
    Separate these sections with blank lines.
-   Use ES modules for new code where supported. Use named exports and export
    only the intended API. Default imports are allowed for dependencies that
    require them. Avoid dependency cycles and duplicate imports of the same
    module.
-   Include `.js` in ES module file import paths under the source guide. For an
    existing package, preserve valid runtime resolution and package entry
    points.
-   Exported bindings must be stable after module initialization. Expose mutable
    state through accessors or an object with a stable binding.
-   The source exempts import and re-export lines, Closure dependency
    declarations, unsplittable URLs, and copyable commands or strings from the
    column limit.
-   Use explicit semicolons and one statement per line. Do not add semicolons
    after class or function declarations; expressions still need statement
    terminators.
-   Open nonempty blocks on the same line and place their contents on new lines.
    Control structures use braces, with the source's narrow exception for a
    simple one-line `if` without `else` when omitting braces improves
    readability.
-   Add trailing commas to multiline array and object literals. Break wrapped
    expressions at a clear syntactic boundary, normally after an operator. Never
    separate `return` from its returned expression with a newline.

## Language choices

-   Default to `const`; use `let` for reassignment. Declare one variable at a
    time, near its first use. Do not introduce `var` except for an actual legacy
    target covered by the source's legacy-platform appendix.
-   Prefer array and object literals. Avoid the variadic `Array` constructor;
    `new Array(length)` is allowed for deliberate size allocation. Do not use
    the `Object` constructor or attach nonnumeric properties to arrays.
-   Use single-quoted strings and template literals for interpolation or
    multiline text. Do not use backslash line continuations inside strings.
-   Prefer arrow functions for nested functions and callbacks needing lexical
    `this`. Use a block body when no return value is intended. Prefer
    rest/spread over `arguments` and `apply`.
-   Keep destructured parameters shallow. Optional destructured objects or
    arrays default to `{}` or `[]`; put individual defaults in the destructuring
    pattern. Optional parameters follow required ones and have side-effect-free
    defaults.
-   Prefer `for...of`. Do not iterate arrays with `for...in`; for object
    iteration, prefer `Object.keys` or explicitly exclude inherited properties.
-   Use `===` and `!==`. Comparing with `== null` or `!= null` is allowed when
    intentionally testing both `null` and `undefined`.
-   Throw and reject with `Error` instances, constructed with `new`. Explain any
    intentionally empty `catch`. Put `default` last in a `switch`; terminate
    each case group or clearly comment intentional fall-through.
-   Avoid `eval`, string-built functions, `with`, primitive wrapper
    constructors, modifications to built-ins, and unnecessary globals. Use
    constructor parentheses.

## Classes and Closure compatibility

Under the legacy guide, concrete instance fields are declared in constructors,
with appropriate JSDoc types, visibility, and `@const` annotations. Prefer class
syntax and module-local helpers over prototype manipulation or static-only
container classes. Do not use `this` in static methods.

The legacy guide generally forbids getters/setters, with exceptions for required
framework or external API integration; permitted getters have no observable side
effects. Do not transplant this restriction into TypeScript, whose guide allows
accessors under different rules.

For Closure code, preserve the distinction between unquoted struct properties
and quoted/computed dictionary keys, including how they are accessed. Consult
the source's module and JSDoc sections before changing `goog.module`,
`goog.require`, `goog.requireType`, exports, or compiler annotations. Do not add
Closure infrastructure to a project just to apply this skill.

## Naming and documentation

-   Use `UpperCamelCase` for classes and named types; use `lowerCamelCase` for
    functions, methods, variables, and parameters. Treat acronyms as words.
-   Use `CONSTANT_CASE` for enum members and genuine module/static constants,
    rather than every `const` binding. Function-local constants remain camel
    case.
-   Document classes, fields, and methods with JSDoc. Named functions and
    methods document parameter types and nonempty return types; avoid redundant
    prose. Ordinary implementation explanations are not JSDoc.
-   In Closure annotations, explicitly mark reference-type nullability, specify
    generic arguments, and parenthesize casts. Use the installed toolchain's
    supported annotations rather than copying TypeScript syntax into JavaScript.
-   A deprecation comment includes a usable replacement or migration direction.

## Check the change

Use the repository's existing formatter and lint checks for the affected files.
Run relevant behavior checks when behavior changes. Review import resolution,
exports, comments, and the diff for accidental semantic or unrelated changes.
For a review-only request, report concrete findings with locations and suggested
corrections; do not edit solely because this skill was loaded.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
The applicability and verification instructions adapt it to repository work.
Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
