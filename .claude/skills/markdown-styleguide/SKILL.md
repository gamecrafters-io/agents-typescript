---
name: markdown-styleguide
description: >-
  Apply Google's Markdown style guide when writing, editing, or reviewing
  repository Markdown documentation, README files, guides, or skill documents.
  Preserve the target renderer and existing document contracts; do not treat
  ordinary chat answers or non-Markdown artifacts as repository documentation.
license: CC-BY-3.0
---

# Google Markdown style guide

Use the [Google Markdown style
guide](https://google.github.io/styleguide/docguide/style.html) to keep
documentation readable both as source and when rendered. Favor a small, accurate
document that answers its reader's need. Keep improvements focused; do not
expand a narrow edit into an unrelated documentation overhaul.

## Layout and headings

-   Start the document body with a single H1 title and a short introduction that
    establishes the subject and purpose. Preserve required frontmatter or
    template metadata before the body.
-   Use ATX headings (`## Topic`), with a space after the hashes and blank lines
    around headings. Subsequent sections start at H2 or deeper.
-   Make headings unique, complete, and descriptive so readers and generated
    link anchors can identify them. Preserve product, tool, and binary
    capitalization.
-   The source recommends `[TOC]` after the introduction and before the first H2
    for longer documents on compatible hosts such as Gitiles. Check the actual
    renderer: use its supported contents mechanism, and do not emit a literal
    unsupported directive on GitHub or another host.
-   Use an optional final related-links section when it helps readers continue.

## Source formatting and lists

-   Wrap ordinary prose at 80 characters. Links, headings, tables, and code
    blocks may exceed this limit; still wrap adjacent prose normally.
-   Remove trailing whitespace. Separate paragraphs with a blank line. If a hard
    line break is essential, prefer a trailing backslash over two trailing
    spaces.
-   Prefer ordinary numbered or bulleted lists for sequential or parallel
    content. Keep blank lines between lists and surrounding paragraphs.
-   Use explicit numbering for short stable ordered lists; repeated `1.` markers
    are useful for longer lists that change frequently.
-   For nested or wrapped lists, use four-space nesting and align continuation
    text consistently. A one-space gap after the marker is sufficient for a
    short, unnested list whose items each fit on one line.

## Code and command examples

-   Use inline code for identifiers, literal values, generic file extensions,
    example paths, and text that should not be interpreted as Markdown.
-   Use fenced blocks for multiline code and declare the language (`typescript`,
    `json`, `bash`, or `text`, for example). Prefer fences to indented code
    blocks.
-   Indent a fenced block inside its list item so it remains part of that item.
-   Preserve copy/paste behavior for commands. Continue wrapped shell commands
    using the intended shell's syntax. The source's backslash example applies to
    shells such as Bash, not to PowerShell or Windows command prompt.
-   Keep examples consistent with their actual language and API contract. Do not
    introduce comments or trailing commas into a block advertised as strict
    JSON.

## Links and references

-   Link a descriptive phrase that identifies the destination; avoid labels such
    as "here" or "link" and unexplained bare URLs.
-   Link to explicit files and valid anchors. The source prefers repository-root
    paths for cross-directory links and allows same-directory relative links.
    Adapt this to the hosting base path and repository conventions; verify that
    the target resolves instead of mechanically replacing every `../` link.
-   Use reference links when a long destination disrupts readability, is reused,
    or would make a table unwieldy. Short, clear links can remain inline.
-   Put a reference definition near its first use, normally before the next
    heading. Definitions shared across sections belong at the document's end;
    respect existing formatter placement conventions.

## Images, tables, and HTML

Use images when they explain something more clearly than text, with meaningful
alt text for readers who cannot see them. Keep table cells short and reserve
tables for parallel data that benefits from comparison. Use lists or sections
instead of forcing long prose into cells.

Prefer standard Markdown over HTML. Renderer support matters: Gitiles does not
render HTML, and extensions supported by one host may fail on another.

## Check the document

Read both source and rendered output when a preview is available. Check heading
hierarchy, list nesting, fences, link targets and anchors, image descriptions,
table readability, and command copyability. Run existing Markdown lint or docs
checks for the changed files; do not add new tooling for an ordinary prose edit.

When reviewing, provide specific corrections and prioritize accuracy and
readability. Accept useful incremental improvements without requiring unrelated
rewrites. Do not edit a document in response to a review-only request.

## Source and attribution

Adapted and condensed from Google's guide linked above, checked on 2026-10-29.
Renderer, shell, and repository compatibility notes are adaptations for this
workflow. Google's source is licensed under [CC BY
3.0](https://creativecommons.org/licenses/by/3.0/), as stated in the [styleguide
license](https://github.com/google/styleguide/blob/gh-pages/LICENSE).
