---
name: cpp-styleguide
description: >-
  Apply the Google C++ Style Guide when writing, editing, refactoring, or reviewing
  C++ source, headers, tests, interfaces, and examples, even when no style guide
  is mentioned. Check that shared header extensions actually contain C++; do not
  apply these rules to C, C#, JavaScript, or TypeScript.
license: CC-BY-3.0
---

# Google C++ style guide

Use the [Google C++ Style
Guide](https://google.github.io/styleguide/cppguide.html) for the C++ being
changed. At the 2026-10-29 review, the guide targets C++20 and excludes C++23
features. Read the actual build configuration, supported platforms, formatter,
and local conventions first; do not change a project's language standard, ABI,
dependencies, or exception policy merely to apply this skill.

Apply Google rules where compatible with explicit project requirements. Its
existing-code exceptions allow local consistency. Keep style-only cleanup
separate from unrelated behavior changes, and distinguish a Google convention
from a C++ language requirement when explaining a finding.

Read [language policies](references/language-policies.md) when touching advanced
language features, exceptions/RTTI, global lifetimes, numeric representation,
standard-library choices, or platform-specific code. Consult the original guide
for uncommon details; its illustrative snippets are not complete code templates.

## Headers and dependencies

-   Make headers self-contained: each can compile with its own direct
    dependencies. Include what a file uses instead of relying on transitive
    includes, even when the matching header currently includes the same
    dependency.
-   Google uses lowercase `.cc` and `.h` files, normally paired, with `_test.cc`
    for tests. Tests and small `main`-only files need not have a matching
    header. Preserve extensions required by an existing build rather than
    renaming files in a narrow task. Reserve `.inc` for rare intentional textual
    inclusion.
-   Use unique `#ifndef`/`#define` guards based on project and full relative
    path, such as `PROJECT_COMPONENT_WIDGET_H_`. Google's rule uses guards
    rather than `#pragma once`.
-   Prefer including a cheap public header to forward declarations. Do not
    forward declare entities owned by another project, especially
    standard-library types. A forward declaration for an owned type needs a real
    compile-time justification.
-   Keep template/inline definitions available to clients through the declaring
    header. Do not require clients to include a separate `-inl.h`. Ensure header
    definitions satisfy the One Definition Rule; put substantial ordinary
    function bodies in `.cc` files.
-   Order includes: related header, C/system headers, C++ standard headers,
    other libraries, then this project's headers. Separate nonempty groups with
    one blank line and sort within each group. Put the related header first in
    its source or test to expose missing prerequisites.
-   Use angle brackets where required for system/standard headers; use quoted
    project-relative paths without `.` or `..` for project headers. Preserve
    valid platform-specific include requirements.

## Scope, ownership, and interfaces

-   Put code in a uniquely named project namespace. Avoid `using namespace`,
    inline namespaces, declarations in `std`, and public namespace aliases in
    headers. Namespace contents are not indented; comment closing namespace
    braces.
-   Give file-private functions and variables internal linkage in `.cc` files,
    using an unnamed namespace or `static`. Do not give header definitions
    internal linkage this way. Prefer free functions over static-only container
    classes.
-   Declare local variables near their first use, in the smallest useful scope,
    and initialize them at declaration.
-   Prefer one clear owner for dynamically allocated objects. Use
    `std::unique_ptr` for explicit ownership transfer; use `std::shared_ptr`
    only for a justified shared lifetime. A raw pointer or reference normally
    borrows; document any different ownership contract. Never use
    `std::auto_ptr`.
-   Prefer returning a value over output parameters. Required inputs usually use
    values or `const T&`; required outputs/in-out parameters may use `T&`. Use
    pointers when null is a valid option and document its meaning. The current
    guide does not require every reference parameter to be const.
-   Avoid retaining a reference parameter beyond the call, because it can bind
    to a temporary. If a borrowed argument must outlive the call, use a clear
    pointer contract and document the lifetime/non-null requirement, or take
    ownership.
-   Prefer input parameters before output parameters while preserving
    established APIs. Make overloads semantically consistent. Defaults must be
    stable and may not appear on virtual functions.

## Classes and functions

-   Use `struct` for passive public data without cross-field invariants; use a
    class for behavior and enforced invariants. Prefer meaningful named fields
    to an opaque pair or tuple when designing an interface.
-   Keep class data private except constants and the source's narrow
    test-fixture exception. Order visibility sections `public`, `protected`,
    then `private`. Group related declarations; keep long method bodies out of
    the public definition.
-   Make the supported copy/move operations clear, normally with explicit
    defaulted or deleted public declarations. Do not blindly require all five
    special members: the source allows omissions when the behavior is already
    obvious.
-   Mark conversion operators and constructors callable with one argument
    `explicit`, except copy/move constructors and the source's initializer-list
    exception. Avoid virtual calls in constructors and unreportable
    initialization failure; use the project's established factory/error contract
    where needed.
-   Prefer composition. Use public inheritance for an actual subtype
    relationship. Mark an override with exactly one of `override` or `final`,
    without repeating `virtual`. Avoid slicing and unnecessary multiple
    implementation inheritance.
-   Keep functions focused. Roughly 40 lines is a prompt to consider
    decomposition, not a hard limit. Short public inline definitions are
    generally about ten lines or fewer.
-   Overload operators only with unsurprising semantics on owned types. Do not
    overload `&&`, `||`, comma, unary `&`, or introduce/use user-defined
    literals.
-   Make read-only API operations const when accurate. Document synchronization
    and thread-safety requirements, including any limits on concurrent const
    calls.

## Names, comments, and formatting

| Entity | Convention |
| --- | --- |
| Types, concepts, type parameters | `UpperCamelCase` or a clear type parameter such as `T`. |
| Ordinary functions | `UpperCamelCase`; accessors may use `snake_case`. |
| Variables, parameters, namespaces | `snake_case`. |
| Class data members | `snake_case_`, except static constants. |
| Struct data members | `snake_case`, without the trailing underscore. |
| Program-lifetime constants and enumerators | `kUpperCamelCase`. |
| Necessary macros | `PROJECT_UPPER_SNAKE_CASE`. |

Use descriptive, inclusive names and avoid unfamiliar abbreviations. Interop and
STL-like interfaces may follow the established interface's naming rules.

Use project license boilerplate where required. Document non-obvious types and
functions at their declarations: purpose, inputs/outputs, ownership,
nullability, lifetimes, invariants, and synchronization. Explain implementation
choices near their definitions rather than repeating interface comments. Keep
TODOs traceable to an issue or a real owner; do not invent an owner or copyright
notice.

Use spaces with two-space indentation and an 80-column limit. The guide permits
long includes, guards, using-declarations, and text whose splitting would harm
readability or copyability. Put opening braces on the declaration/control line;
use braces for control bodies, respecting the source's narrow historical
exceptions and any stricter local policy. Empty loops do not use a lone
semicolon.

Indent access labels by one space and members by two. Wrapped parameters or
initializer lists may use a four-space continuation. Keep preprocessor
directives at column zero. Use `T* pointer` and `T& reference` spacing, and do
not combine multiple pointer/reference declarations in one declaration. Avoid
trailing spaces.

## Check the change

Use the project's existing formatter and style checks, including cpplint when
available. Use a Google clang-format style only when no project configuration
overrides it. Run relevant builds and tests for changed behavior or interfaces;
formatting and linting alone do not establish correctness.

For header/interface changes, check direct dependencies, standalone header
compilation where supported, and affected consumers. For lifetime changes, check
moves, ownership transfer, escaping captures, and cleanup paths. Reuse existing
sanitizer checks when relevant; do not add a new toolchain solely for style. For
review-only work, return specific findings without editing files.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
Repository compatibility and verification instructions are local adaptations.
Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
