# C++ language and library policies

Read the section relevant to the feature being changed. These are condensed
policies from the [Google C++ Style
Guide](https://google.github.io/styleguide/cppguide.html), checked on
2026-10-29, with explicit project-compatibility notes. They supplement the
[skill entrypoint](../SKILL.md).

## Exceptions, RTTI, and casts

Google C++ does not use exceptions or exception-handling facilities such as
`std::exception_ptr`. This is an integration policy, not a claim that exceptions
are invalid C++. For an existing project with a different policy, preserve its
error contracts and build flags; do not silently replace exceptions with aborts
or alter dependent code during style cleanup.

Use `noexcept` only when correct for the function's failure semantics,
especially for move operations where it can affect container behavior. Do not
promise that an operation cannot throw merely to silence a diagnostic.

RTTI is allowed freely in unit tests and should usually be avoided elsewhere.
Prefer an appropriate interface to branching on concrete runtime types. A
`dynamic_cast` is allowed when program logic guarantees the derived type; do not
replace RTTI with a hand-built hierarchy of type tags just to evade this rule.

Use brace conversion for arithmetic types when narrowing should be rejected,
function-style conversion to class types, and appropriate named C++ casts for
other cases. Avoid C-style casts except to `void`. Downcasts need a valid type
invariant; `reinterpret_cast` needs attention to aliasing and representation.
Prefer `std::bit_cast` for valid same-size value representation conversion. Use
Abseil casting helpers only when they are part of the project's dependencies.

## Lifetime and storage duration

Objects with static storage duration must normally be trivially destructible
under Google rules. Prefer constant initialization marked with `constexpr` or
`constinit`; avoid cross-translation-unit initialization/destruction ordering
dependencies. Function-local dynamic initialization is allowed, but it does not
remove the destruction constraint.

The source allows specific process-lifetime allocation patterns as a fallback;
do not turn that into a general recommendation to leak objects. Understand the
existing ownership and shutdown contract before changing global storage.

Namespace/class-scope `thread_local` variables need compile-time initialization,
enforced with `constinit` (or an appropriate `constexpr`). Function-local TLS
still needs review for destruction and references to already-destroyed TLS.

Prefer explicit captures for escaping lambdas. A reference capture requires the
referent to outlive use. Use `[&]` only when the lifetime is clearly shorter
than all captures; use `[=]` only for short obvious captures without implicit
`this`. Do not use init-captures to conceal unrelated variable declarations.

## Types, templates, and newer features

-   Use `auto` or structured bindings when they improve clarity or safety, not
    merely to avoid spelling a useful type. Avoid deduced return types on public
    header APIs. Do not use `auto` parameters on non-lambda functions; spell out
    named template parameters when a function genuinely needs to be generic.
-   Use class template argument deduction only for standard templates or
    templates whose maintainers support it through explicit deduction guides.
-   Limit rvalue references to move operations, consuming `&&`-qualified
    methods, perfect forwarding, or a justified pair of lvalue/rvalue overloads.
    Prefer passing an ordinary consumed parameter by value when that suffices.
-   Avoid elaborate template metaprogramming. Isolate necessary complexity and
    make diagnostics comprehensible to API users.
-   Use concepts sparingly where a template constraint is useful. Prefer
    existing standard concepts and `requires(Concept<T>)` to legacy SFINAE or
    `template<Concept T>`. Keep new concepts internal and compiler-verifiable;
    do not create public concepts merely to restate obvious function
    requirements.
-   Use C++20 designated initializers in declaration order. Do not depend on a
    compiler extension that relaxes those rules.
-   The reviewed guide forbids C++20 modules. Coroutines may use an established
    project-approved library; do not invent promise/awaitable types to introduce
    a coroutine framework as part of a small change.

## Numeric, control-flow, and library details

-   Prefer `int` for ordinary small integers and exact-width types when size
    matters; `size_t` and `ptrdiff_t` remain appropriate for their APIs. Do not
    use unsigned solely to express nonnegativity. Review mixed signedness,
    narrowing, and intermediate overflow. Prefer `float`/`double` over `long
    double`.
-   Use `nullptr` for null pointers and `'\0'` for the null character. Prefer
    `sizeof(variable)` for a particular object and prefix increment/decrement
    when the old value is not needed.
-   A non-enum `switch` needs a `default`; enum switches may rely on exhaustive
    diagnostics. Mark intentional nonempty fall-through with `[[fallthrough]];`.
-   Prefer functions, constants, and enums over macros. Necessary exported
    macros need a globally unique project prefix; do not generate public APIs
    with macros.
-   Use existing project libraries first. The source favors Abseil in its own
    environment; applying this skill does not require adding Abseil.
-   The reviewed guide disallows `<ratio>`, `<cfenv>`, `<fenv.h>`, and
    `<filesystem>`. Treat these as Google policies; preserve an explicitly
    different project dependency contract rather than broadly replacing working
    APIs.
-   Streams are permitted for suitable simple local/developer-facing output.
    Prefer established logging/formatting libraries, avoid stateful stream
    tricks, and restrict `operator<<` to a meaningful user-visible value
    representation.

## Platform integration

Keep platform-specific code localized and preserve the established portability
layer. The source generally rejects nonstandard extensions but permits
designated portability wrappers. Windows API types and necessary COM conventions
may follow their external contracts; avoid introducing Hungarian notation into
ordinary code.

The source's Windows exception allowance concerns compiling libraries that need
exception support, not a blanket permission to introduce new exception handling.
Use project wrappers for DLL import/export declarations. Do not treat a style
review as authorization to change compiler flags or platform behavior.

This reference is a condensed adaptation of Google's source under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/); see the source attribution
in the skill entrypoint.
