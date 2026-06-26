# File Layout Reorganization Plan

## Goal
Reorganize the repository's file and folder layout for clarity without changing application behavior, feature scope, or runtime architecture.

## Confirmed Scope
- In scope:
  - File and folder moves/renames only.
  - Updating HTML asset paths and navigation links as required by moved files.
  - Separating runtime assets from planning/reference/sample artifacts.
- Out of scope:
  - Refactoring JavaScript internals.
  - Converting scripts to modules/build tooling.
  - Feature changes, UI changes, or data model changes.
  - Changing LocalStorage keys or export formats.

## Current Layout Summary
- Root entry pages:
  - `index.html`
  - `surface.html`
  - `tools.html`
- Runtime assets are currently split across:
  - `styles.css`
  - `script.js`
  - `surface.js`
  - `js/calc-core.js`
  - `js/tooldb.js`
  - `js/tools.js`
  - `js/export-fusion360.js`
  - `js/export-vcarve.js`
  - `vendor/`
- Non-runtime artifacts are mixed into `Plan/`:
  - planning markdown
  - sample export/database files
  - spreadsheets
  - saved external reference article and asset folder

## Decisions
- Keep the three user-facing HTML pages at the repo root to avoid static-hosting and navigation risk.
- Reorganize supporting runtime assets under dedicated asset folders.
- Split the existing `Plan/` folder by purpose:
  - planning/reference documentation
  - examples/fixtures/sample artifacts
- Preserve behavior exactly; all changes should be path-safe moves plus reference updates.

## Target Layout
```text
/
  index.html
  surface.html
  tools.html
  assets/
    css/
      styles.css
    js/
      core/
        calc-core.js
        tooldb.js
      pages/
        feeds-speeds.js
        surface-generator.js
        tool-database.js
      export/
        export-fusion360.js
        export-vcarve.js
    vendor/
      vcarve-template.js
      sql.js/
        sql-wasm-binary.js
        sql-wasm.js
        sql-wasm.wasm
  docs/
    plans/
    reference/
  examples/
    tool-databases/
    exports/
    source-material/
```

## File Mapping
- Runtime files:
  - `styles.css` -> `assets/css/styles.css`
  - `js/calc-core.js` -> `assets/js/core/calc-core.js`
  - `js/tooldb.js` -> `assets/js/core/tooldb.js`
  - `script.js` -> `assets/js/pages/feeds-speeds.js`
  - `surface.js` -> `assets/js/pages/surface-generator.js`
  - `js/tools.js` -> `assets/js/pages/tool-database.js`
  - `js/export-fusion360.js` -> `assets/js/export/export-fusion360.js`
  - `js/export-vcarve.js` -> `assets/js/export/export-vcarve.js`
  - `vendor/` -> `assets/vendor/`
- Non-runtime files from `Plan/`:
  - markdown planning docs -> `docs/plans/`
  - saved article and related downloaded asset folder -> `docs/reference/`
  - sample DB/export files such as `.tools`, `.vtdb`, `.wal`, `.shm`, `Library.json` -> `examples/exports/` or `examples/tool-databases/`
  - spreadsheets and other source materials -> `examples/source-material/` unless they are referenced as documentation, in which case place them under `docs/reference/`

## Implementation Tasks
1. Create the target runtime asset directories.
2. Move the shared stylesheet into `assets/css/`.
3. Move shared calculator/storage scripts into `assets/js/core/`.
4. Move page-specific scripts into `assets/js/pages/` using descriptive names.
5. Move export helpers into `assets/js/export/`.
6. Move third-party runtime dependencies from `vendor/` into `assets/vendor/` without changing filenames.
7. Update `index.html` script and stylesheet paths.
8. Update `surface.html` script and stylesheet paths.
9. Update `tools.html` script, stylesheet, and vendor dependency paths.
10. Verify that cross-page navigation links remain correct after asset moves.
11. Create `docs/plans/`, `docs/reference/`, and example directories.
12. Move `Plan/` contents into the appropriate documentation/reference/example locations.
13. Remove the old `Plan/` directory only after confirming it is empty and fully migrated.

## Validation
- Open `index.html` and verify:
  - stylesheet loads
  - calculator scripts load in the correct order
  - tool selector still reads ToolDB data
- Open `surface.html` and verify:
  - stylesheet loads
  - surfacing tool selector still reads ToolDB data
  - G-code generation still works
- Open `tools.html` and verify:
  - stylesheet loads
  - ToolDB UI renders
  - Fusion export still downloads
  - VCarve export still loads its SQL.js and template dependencies
- Confirm there are no broken asset paths in any HTML file.
- Confirm moved non-runtime files are no longer referenced by runtime pages.

## Risks And Controls
- Risk: broken script load order on static pages.
  - Control: preserve existing dependency order when updating HTML tags.
- Risk: VCarve export may depend on relative vendor paths.
  - Control: inspect `export-vcarve.js` and related vendor initialization when updating paths; verify export end-to-end.
- Risk: ambiguity when classifying files from `Plan/`.
  - Control: classify by actual use:
    - runtime example/sample artifact -> `examples/`
    - planning/reference material -> `docs/`
- Risk: external links or bookmarks to `Plan/` content may break.
  - Control: acceptable unless the repo explicitly depends on those paths; if any internal references exist, update them.

## Notes For The Implementer
- Keep root HTML filenames unchanged.
- Do not alter runtime code structure beyond the minimum path/reference edits needed for moved files.
- Preserve all existing filenames inside third-party vendor packages where possible.
- Prefer a single migration PR/commit so path updates and moves stay synchronized.

## Open Questions
- None for the agreed scope. The plan is implementation-ready for a file-layout-only reorganization.
