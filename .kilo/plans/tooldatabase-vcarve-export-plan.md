# Tool Database Refinement Plan

## Overview
Refine the tool database so adding/editing a tool is parameter driven: the user chooses CNC machine and Beginner/Advanced calculation mode, the app automatically derives the tool name, and material presets are generated for every supported material. Also split exporter code out of `js/tools.js` and add real Vectric VCarve `.vtdb` SQLite export based on the sample database at `Plan/vcarve-export.vtdb`.

## Current State
- `js/tooldb.js` already stores `machine`, `calculationMode`, generated tool names, and generated material presets for all materials using `window.CncCalc`.
- `tools.html` already has a read-only generated name field and `(i)` tooltip icons for the visible tool database filters/editor fields.
- `js/tools.js` still owns all UI logic plus CSV, JSON, and Fusion 360 export implementation.
- Fusion 360 export is currently embedded in `js/tools.js` as `exportFusion()`, `fusionTool()`, `fusionPreset()`, and helper functions.
- Vectric VCarve `.vtdb` is SQLite, not text/JSON. Browser export needs a client-side SQLite implementation or a prebuilt SQLite binary/database builder.
- Sample schema in `Plan/vcarve-export.vtdb` includes `version`, `migration`, `machine`, `material`, `tool_geometry`, `tool_cutting_data`, `tool_entity`, and `tool_tree_entry` tables.

## Target UX
- Add/edit tool form asks for physical tool parameters, CNC machine, and calculation mode.
- User does not manually enter feeds/speeds/material presets during the normal workflow.
- `tool.name` is derived automatically and shown as read-only preview.
- Generated presets are available for every `ToolDB.MATERIALS` material.
- Export buttons include separate Fusion 360 and Vectric VCarve actions.
- All tool database form fields keep accessible `(i)` icons with `aria-label` and keyboard focus.

## Phase 1: Confirm Generated Tool Workflow
**Goal:** Verify the current generated-name/generated-preset implementation is complete and remove any leftover manual-preset assumptions.

**Tasks:**
- [ ] Review `js/tooldb.js` generated preset behavior for create, update, duplicate, import, and migration paths.
- [ ] Confirm `ToolDB.generateMaterialPresets()` creates entries for every material: Hardwood, Softwood/Plywood, MDF/Particleboard, Soft Plastic, Hard Plastic, Aluminium.
- [ ] Confirm `validateGeneratedPresets()` prevents saving a generated tool with missing material presets.
- [ ] Decide whether imported legacy tools should keep existing presets until edited or regenerate immediately on import.
- [ ] Ensure unit handling is explicit: formulas currently use millimeter calculator values, so inch-dimension tools need either conversion or mm-only validation for generated presets.

**Acceptance Criteria:**
- Adding a valid tool always stores presets for all supported materials.
- Beginner and Advanced modes produce calculator-matching values.
- Tool name cannot be manually edited and updates when relevant fields change.

## Phase 2: Complete Tooltip Coverage
**Goal:** Ensure every visible tool database form field has an accessible info icon.

**Tasks:**
- [ ] Audit `tools.html` labels in filters, editor, import/export controls if applicable, generated preset preview, and action areas.
- [ ] Audit dynamically rendered preset table headers in `js/tools.js`.
- [ ] Add missing `.surface-info` icons only where fields/controls do not already have them.
- [ ] Verify icons are keyboard-focusable with `tabindex="0"` and have meaningful `aria-label` text.
- [ ] Check tooltip placement in table overflow containers on desktop and mobile.

**Acceptance Criteria:**
- Every visible input/select/textarea field in the tool database UI has an `(i)` tooltip.
- Tooltip styling remains consistent with existing `surface-info` behavior.

## Phase 3: Split Export Code Into Dedicated Modules
**Goal:** Keep `js/tools.js` focused on UI and move file-format-specific export logic into separate files.

**Files to create:**
- `js/export-fusion360.js`
- `js/export-vcarve.js`

**Files to modify:**
- `tools.html`
- `js/tools.js`

**Tasks:**
- [ ] Move Fusion 360-specific functions from `js/tools.js` into `js/export-fusion360.js`.
- [ ] Expose a small global API, for example `window.ToolExportFusion360.exportTools(tools)` returning `{ filename, content, mimeType }`.
- [ ] Create `js/export-vcarve.js` with a matching API, for example `window.ToolExportVCarve.exportTools(tools)`.
- [ ] Keep shared generic helpers in `js/tools.js` only if they are UI-specific, such as `downloadFile()`.
- [ ] If helpers are needed by both exporters, duplicate small pure helpers or add a tiny shared export utility only if duplication becomes significant.
- [ ] Load exporter scripts after `js/tooldb.js` and before `js/tools.js` in `tools.html`.
- [ ] Update export button handlers in `js/tools.js` to call exporter modules.

**Acceptance Criteria:**
- Fusion 360 `.tools` export output remains behaviorally equivalent after the split.
- `js/tools.js` no longer contains Fusion 360 object-building logic.
- VCarve export can be implemented without adding more format-specific code to `js/tools.js`.

## Phase 4: Add Vectric VCarve `.vtdb` Export
**Goal:** Export a valid SQLite `.vtdb` file compatible with Vectric VCarve tool database import/open workflows.

**Implementation Decision Needed:**
A browser cannot create SQLite databases with built-in Web APIs. Use one of these approaches:
- Recommended: add a browser SQLite library such as `sql.js` and generate the database entirely client-side.
- Alternative: keep a minimal template `.vtdb` as binary asset, load it, mutate it with SQLite, and export the resulting bytes.
- Alternative: implement export server-side or with a build step, but this does not fit the current static app architecture.

**Tasks:**
- [ ] Add or vendor a client-side SQLite writer (`sql.js` recommended for static browser use).
- [ ] Decide whether to create the database from SQL schema text or clone `Plan/vcarve-export.vtdb` as a template asset.
- [ ] Recreate required schema tables from the sample: `version`, `migration`, `machine`, `material`, `tool_geometry`, `tool_cutting_data`, `tool_entity`, `tool_tree_entry`, plus support tables present in sample schema.
- [ ] Insert `version` row matching the sample (`1`) unless compatibility testing shows another value is required.
- [ ] Insert a machine row for the selected/export target CNC machine. The sample uses a Mekanika PRO CNC S row with `dimensions_units = 0`.
- [ ] Insert one `material` row per exported material. Map app material names to VCarve material names consistently, for example `Softwood/Plywood` to `Softwood / Plywood`.
- [ ] For each app tool, create one `tool_geometry` row.
- [ ] For each tool/material preset, create one `tool_cutting_data` row and one `tool_entity` row linking geometry, material, machine, and cutting data.
- [ ] Create a default/fallback `tool_entity` with empty material if VCarve expects it, matching the sample pattern.
- [ ] Create `tool_tree_entry` group rows and child tool rows so VCarve shows tools in a visible folder.
- [ ] Generate stable UUIDs with `crypto.randomUUID()` where available.
- [ ] Export the SQLite database bytes as `cnc-tool-database.vtdb` with `application/octet-stream`.

**VCarve Field Mapping:**
- `tool_geometry.id`: generated UUID.
- `tool_geometry.name_format`: use sample endmill format initially or a generated format by tool type.
- `tool_geometry.notes`: app `tool.notes`.
- `tool_geometry.tool_type`: map app tool type to VCarve integer. Sample end mills use `1`; exact Vectric constants must be validated for ball nose, V-bit, drill, surfacing, engraving.
- `tool_geometry.units`: `0` for millimeters based on sample; validate inch value before supporting `in`.
- `tool_geometry.diameter`: app `tool.diameter`.
- `tool_geometry.included_angle`: for V-bit/engraving only if the app captures angle later; otherwise leave null.
- `tool_geometry.flat_diameter`: leave null unless needed for V-bit/engraving.
- `tool_geometry.num_flutes`: app `tool.flutes`.
- `tool_geometry.flute_length`: app `tool.cuttingLength` when present.
- `tool_geometry.custom_attributes`: JSON string with `Vendor`, geometry direction, usage, source app metadata.
- `tool_cutting_data.rate_units`: sample uses `1` for populated metric feeds and `4` for fallback empty cutting data; validate exact constants.
- `tool_cutting_data.feed_rate`: preset `feedrate`.
- `tool_cutting_data.plunge_rate`: preset `plungerate`.
- `tool_cutting_data.spindle_speed`: preset `rpm`.
- `tool_cutting_data.stepdown`: preset `depthOfCut`.
- `tool_cutting_data.stepover`: convert preset percentage to absolute distance if VCarve expects distance. Sample 8mm tool with stepover `3.2` implies absolute mm from 40%.
- `tool_cutting_data.length_units`: `0` for millimeters based on sample.
- `tool_cutting_data.tool_number`: assign sequential tool number or leave null for material-specific rows, matching compatibility tests.

**Acceptance Criteria:**
- Export button downloads a `.vtdb` file, not JSON or CSV.
- `sqlite3 exported.vtdb .schema` succeeds.
- `PRAGMA integrity_check` returns `ok`.
- Row counts match expected tools/materials/entities.
- VCarve can open/import the exported database and shows generated tool geometry and feeds/speeds.

## Phase 5: Tool Type Mapping Validation
**Goal:** Avoid corrupt or misleading VCarve tools by validating format-specific limitations.

**Tasks:**
- [ ] Identify Vectric `tool_geometry.tool_type` integer constants for end mill, ball nose, V-bit, surfacing/clearance, drill, engraving, and other.
- [ ] Decide how to handle unsupported app tool types: skip with warning, export as end mill, or block export.
- [ ] Validate whether VCarve expects stepover as absolute distance, percentage, or both.
- [ ] Validate whether `tool_cutting_data.spindle_dir` can be null or should be set explicitly.
- [ ] Validate VCarve units constants for inches if `tool.units === 'in'`.
- [ ] Consider adding missing app fields later for V-bit angle/tip geometry if accurate VCarve V-bit export is required.

**Acceptance Criteria:**
- Exporter documents and handles unsupported/ambiguous tool types safely.
- VCarve-exported end mills and surfacing tools are accurate for diameter, flutes, feed, plunge, RPM, stepdown, and stepover.

## Phase 6: Export UI And Errors
**Goal:** Make exports understandable and resilient.

**Tasks:**
- [ ] Add `Export VCarve` button to `tools.html`.
- [ ] Wire the button in `js/tools.js`.
- [ ] Show a clear error notice if the SQLite library fails to load or a tool cannot be exported.
- [ ] If unsupported tool types are skipped, show a notice with the skipped count and reason.
- [ ] Keep JSON backup and CSV export unchanged unless migration fields need inclusion.

**Acceptance Criteria:**
- User can export JSON, CSV, Fusion 360, and VCarve independently.
- Export failures do not break the tool database UI.

## Phase 7: Verification Checklist
**Automated/manual browser checks:**
- [ ] Add a 6mm 2-flute end mill for PRO Beginner; confirm all materials are generated.
- [ ] Switch to Advanced; confirm values update.
- [ ] Change machine from EVO to FAB; confirm generated values update.
- [ ] Edit diameter/flutes; confirm generated name and presets update.
- [ ] Add a surfacing cutter; confirm surface generator auto-fills from its preset.
- [ ] Export Fusion 360; compare output shape with current `.tools` export.
- [ ] Export VCarve; run `sqlite3 exported.vtdb "PRAGMA integrity_check;"`.
- [ ] Inspect exported VCarve tables with `sqlite3` for expected row counts.
- [ ] Open/import exported `.vtdb` in VCarve and verify tool names, geometry, materials, and feeds/speeds.
- [ ] Check all tooltips on desktop and mobile widths.

## Suggested Implementation Order
1. Finish audit of generated workflow and tooltip coverage.
2. Split Fusion 360 export into `js/export-fusion360.js` without behavior changes.
3. Add VCarve exporter file and UI button behind a simple error path.
4. Add client-side SQLite generation and schema creation.
5. Implement conservative end mill/surfacing export first.
6. Validate VCarve import and expand tool type mappings.
7. Run full regression checklist.

## Open Questions
- Should VCarve export target one selected CNC machine or include generated rows for the tool's saved `machine` only?
- Is it acceptable to add/vendor `sql.js` for browser-side SQLite export?
- Should unsupported VCarve tool types be skipped with a warning or exported as generic end mills?
