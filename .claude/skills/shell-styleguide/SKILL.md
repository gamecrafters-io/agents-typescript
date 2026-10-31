---
name: shell-styleguide
description: >-
  Apply the Google Shell Style Guide when writing, editing, refactoring, or
  reviewing Bash scripts, libraries, wrappers, or Bash command examples. Inspect
  the interpreter before applying Bash features; this is not a PowerShell, batch,
  zsh, or POSIX-sh migration skill.
license: CC-BY-3.0
---

# Google Shell style guide

Use the [Google Shell Style
Guide](https://google.github.io/styleguide/shellguide.html) for Bash work.
Determine the interpreter from the shebang, invocation, and deployment
environment; a `.sh` extension alone does not establish Bash support. Preserve
an existing POSIX-only or platform-specific contract.

## Choose and structure the script

-   The source specifies Bash executables beginning with `#!/bin/bash`, with
    minimal interpreter flags. Set shell options in the body using `set`.
    Preserve an explicitly required interpreter path or portable launcher in
    this project.
-   Prefer shell for short wrappers around other commands. The guide recommends
    a structured language for scripts over roughly 100 lines or with complicated
    control flow/data manipulation. Assess that tradeoff instead of
    automatically rewriting an existing script during a small change.
-   Executables may have a `.sh` extension or none; directly installed commands
    commonly omit it. Libraries end in `.sh` and are not executable. Do not
    apply SUID or SGID bits to shell scripts.
-   Put a short purpose comment at the top. Document all library functions and
    nontrivial script functions: behavior, globals used/modified, arguments,
    outputs, and meaningful return statuses.
-   Keep constants, includes, and shell options before functions. Group
    functions together. An executable with helper functions has a final `main`
    function and ends with `main "$@"`; a short linear script does not need this
    wrapper. Do not add an automatically invoked `main` to a sourced library.
-   Send error messages to stderr. Keep stdout appropriate for the script's
    output contract. Prefer informative return codes over silently continuing
    after failure.

## Formatting and naming

-   Use two-space indentation and an 80-character line limit, allowing
    indivisible URLs/paths. Tabs are reserved for the body of a `<<-`
    here-document. Preserve the established indentation in an existing file.
-   Keep `; then` and `; do` on the control statement's line. Align `else`,
    `fi`, and `done` with their corresponding control statements.
-   A pipeline that fits stays on one line. Otherwise place one stage on each
    line, indent the leading pipe by two spaces, and use consistent backslash
    continuations. This convention also applies to long `&&`/`||` chains.
-   Indent `case` patterns two spaces, their multiline bodies another two, and
    use `;;`. Avoid `;&` and `;;&`. Do not put an opening parenthesis before a
    pattern.
-   Use lowercase names with underscores for files, functions, and ordinary
    variables. Constants and environment variables use `UPPER_SNAKE_CASE`;
    prefer `readonly` and `export` to cryptic `declare` options.
-   Functions use `name() {` with the brace on the same line. The `function`
    keyword is optional but should be consistent. Libraries may use a
    `package::function` naming convention when it fits the runtime.

## Quoting and data handling

-   Quote expansions containing strings, command substitutions, whitespace, or
    metacharacters unless intentionally using splitting or pattern expansion.
    Prefer `"${variable}"`; braces alone do not quote anything.
-   Use `"$@"` to forward arguments. Keep simple special/positional parameters
    such as `$1` unbraced unless braces are needed for disambiguation.
-   Build argument lists as arrays and expand them with `"${args[@]}"`. Do not
    put several arguments into one string or recover them with `eval`.
-   Use `$(command)` instead of backticks. Prefer `[[ ... ]]` for Bash tests and
    explicit `-z`/`-n` for string emptiness. Quote literal comparison values;
    leave a pattern or regular expression unquoted only when that matching is
    intended.
-   Use `(( ... ))` for arithmetic tests and `$(( ... ))` for arithmetic values.
    `<` and `>` inside `[[ ... ]]` compare strings. Avoid `expr`, `let`, and
    `$[...]`.
-   Use explicit paths such as `./*` for globs so a filename beginning with `-`
    does not look like an option.
-   Prefer `while IFS= read -r ...` with redirection/process substitution for
    line input. A piped `while` typically runs in a subshell and loses variable
    updates. `readarray` is another option on supported Bash versions. Avoid
    splitting command output with `for value in $(...)` when data may contain
    whitespace.
-   Prefer shell built-ins over unnecessary external processes, and functions
    over aliases in scripts.

## Variables and failure handling

Declare function variables with `local`. Separate declaration from assignment
when using command substitution, because `local` can mask the command's status:

```bash
# Prints the short revision, or returns git's failure status.
# Outputs: The revision on stdout; a diagnostic on stderr on failure.
# Returns: Zero on success, otherwise git's status.
print_revision() {
  local revision
  local status
  if revision="$(git rev-parse --short HEAD)"; then
    printf '%s\n' "${revision}"
  else
    status=$?
    printf '%s\n' 'Unable to read the revision.' >&2
    return "${status}"
  fi
}
```

Check command failures directly with `if command; then ...` or immediately save
`$?`. For a pipeline, `pipefail` can expose overall failure; copy `PIPESTATUS`
immediately if individual statuses are needed, before another command overwrites
them. Process substitution does not automatically propagate producer failures;
account for those when the result matters.

Do not mechanically add `set -euo pipefail` as a supposed Google requirement.
Shell options change behavior and need deliberate handling. In particular, `((
count++ ))` may return failure when its value is zero and terminate a script
under `set -e`. The conditional assignment in the example above handles command
failure explicitly, including when `errexit` is enabled.

## Check the change

Run `bash -n` and ShellCheck on changed Bash files when those tools are
available, using the repository's configuration. Check the supported Bash
version for features such as `readarray`. For behavior changes, exercise
suitable existing tests or safe fixtures covering spaces, empty input, and
failed commands. Do not execute a script against live resources merely to check
formatting.

Review quoting, argument boundaries, statuses, and stdout/stderr behavior. For
review-only requests, return specific findings rather than modifying scripts.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
Platform, scope, and verification instructions are repository adaptations; the
example is newly written. Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
