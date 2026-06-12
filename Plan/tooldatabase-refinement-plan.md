# Tool Database Refinement Plan

## Overview
Refine tool creation so a user enters physical tool parameters once, chooses a CNC machine and calculation mode, and the app generates complete feeds and speeds presets for every supported material. Tool names become derived data instead of manual input, and every tool database form field gets an accessible information tooltip.

---

## Refinement 1: Shared Feeds & Speeds Calculation

**Goal:** Reuse the existing calculator formulas when creating tool database presets.

**Current state:**
- `script.js` owns `MACHINES`, `DIAMETERS`, `CHIPLOAD`, `BEGINNER_FACTOR`, `ADVANCED_FACTOR`, `interpolateChipload()`, `roundNearest100()`, and `calculate()`.
- `js/tooldb.js` owns the material list used by tool presets.
- `js/tools.js` currently stores manual material presets.

**Tasks:**
- [ ] Extract shared calculator constants and helpers into a reusable module, for example `js/calc-core.js`.
- [ ] Load the shared module before `script.js`, `surface.js` where needed, and `js/tools.js`.
- [ ] Keep existing calculator outputs unchanged after extraction.
- [ ] Add a tool-database helper such as `generateMaterialPresets({ diameter, flutes, calculationMode, machine })`.
- [ ] Generate one preset for every material in `ToolDB.MATERIALS`.
- [ ] Store generated values using the existing preset shape: `rpm`, `feedrate`, `plungerate`, `depthOfCut`, `stepover`, `chipload`.

**Implementation notes:**
- The existing formula depends on CNC machine profile (`EVO`, `PRO`, `FAB`), so tool creation must include a CNC Machine field.
- Use the same machine labels and values as the feeds/speeds calculator.

**Acceptance criteria:**
- Adding a tool creates presets for Hardwood, Softwood/Plywood, MDF/Particleboard, Soft Plastic, Hard Plastic, and Aluminium automatically.
- The generated values match the calculator for the same diameter, flutes, material, mode, and CNC machine.
- Existing saved tools still load normally.

---

## Refinement 2: CNC Machine And Beginner/Advanced Preset Mode

**Goal:** Replace manual per-material preset entry with CNC machine and calculation-mode choices.

**Current state:**
- The editor has an "Add Preset" flow where the user chooses one material and manually fills RPM, feedrate, plungerate, DOC, stepover, and chipload.

**Tasks:**
- [ ] Add a required `machine` field to the tool schema: `EVO`, `PRO`, or `FAB`.
- [ ] Add a required `calculationMode` field to the tool schema: `beginner` or `advanced`.
- [ ] Add a CNC Machine select in the tool editor.
- [ ] Add a segmented control or select in the tool editor labeled "Calculation Mode".
- [ ] Remove or hide manual "Add Preset" controls during normal add/edit.
- [ ] On create/update, regenerate `tool.materials` for all materials from current tool parameters, selected CNC machine, and selected calculation mode.
- [ ] Recalculate presets whenever diameter, flutes, units, tool type, CNC machine, or calculation mode changes before saving.
- [ ] Show a read-only material preset preview so users can inspect generated RPM, feedrate, plungerate, DOC, stepover, and chipload.
- [ ] Preserve imported/manual legacy presets where possible, but prefer regenerated values after the tool is edited.

**Implementation notes:**
- Beginner mode should use the existing beginner calculation path.
- Advanced mode should use the existing advanced calculation path.
- For `plungerate`, use a consistent derivation from feedrate if the shared calculator does not currently output it. Recommended starting rule: `plungerate = feedrate * 0.5`, rounded to nearest 100.
- For `stepover`, use a deterministic default by tool type. Recommended starting values:
  - End mill, ball nose, V-bit, drill, engraving, other: `40%`
  - Surfacing cutter: `60%`
- For surfacing tools, generated presets must still populate the surface generator fields correctly.

**Acceptance criteria:**
- User chooses CNC Machine and Beginner or Advanced for feeds/speeds generation.
- No material is left without a preset after saving a tool.
- Tool selector integrations in `index.html` and `surface.html` continue to auto-fill from saved presets.

---

## Refinement 3: Automatic Tool Names

**Goal:** Make tool names consistent and generated from tool parameters.

**Current state:**
- `tool.name` is required and typed manually.
- Duplicate tools append `" Copy"` manually.

**Tasks:**
- [ ] Add a shared `generateToolName(tool)` helper in `js/tooldb.js`.
- [ ] Generate the name during `normalizeTool()` or immediately before validation.
- [ ] Make the name field read-only or replace it with a generated preview.
- [ ] Remove manual name requirement from the editor.
- [ ] Update duplicate behavior so the copied tool receives the generated name from its copied parameters, with a suffix only if needed to avoid an identical visible name.
- [ ] Regenerate names when key fields change.

**Recommended name format:**
- `{diameter}{unit} {flutes}F {geometry label} {tool type label}`
- Add surfacing style for surfacing tools: `{diameter}{unit} {flutes}F {surfacing style label}`
- Add manufacturer only when present and useful: `{manufacturer} - {generated name}`

**Examples:**
- `6mm 2F Upcut End Mill`
- `25mm 3F Spoilboard Cutter`
- `Amana - 3mm 2F Compression End Mill`

**Acceptance criteria:**
- Saving a new tool never requires typing a name.
- Renaming happens automatically after changing diameter, flutes, geometry, tool type, surfacing style, units, or manufacturer.
- Tool lists, exports, and selectors all use the generated name.

---

## Refinement 4: Information Icons On All Tool Form Fields

**Goal:** Add `(i)` tooltips to every tool database form field.

**Current state:**
- `index.html` and `surface.html` already use `.surface-info` tooltip styling.
- `tools.html` fields do not currently have info icons.

**Tasks:**
- [ ] Reuse `.surface-info` for all tool database labels.
- [ ] Add tooltip text to filter fields: Tool Type, Geometry, Usage.
- [ ] Add tooltip text to tool editor fields: generated name preview, manufacturer, CNC machine, tool type, geometry, usage, surfacing cutter style, diameter, flutes, shank diameter, cutting length, overall length, units, calculation mode, notes.
- [ ] Add tooltip text to read-only generated preset columns: material, RPM, feedrate, plungerate, depth of cut, stepover, chipload.
- [ ] Ensure each icon is keyboard focusable with `tabindex="0"` and has an `aria-label`.
- [ ] Check tooltip placement in the table/preset preview so it does not clip or obscure nearby controls.

**Acceptance criteria:**
- Every visible tool database form field has a usable info icon.
- Tooltips work with mouse hover and keyboard focus.
- The tooltip styling remains consistent with the rest of the app.

---

## Refinement 5: Data Migration, Import, And Export

**Goal:** Keep existing user data compatible while adding generated-name and generated-preset behavior.

**Tasks:**
- [ ] Bump `DATABASE_VERSION`.
- [ ] Add migration for tools without `machine`; default to `PRO` unless a better legacy signal exists.
- [ ] Add migration for tools without `calculationMode`; default to `advanced` unless a better legacy signal exists.
- [ ] During migration, keep existing presets but mark them as legacy/manual if the user has not edited the tool.
- [ ] On next save, regenerate all material presets from the selected CNC machine and calculation mode.
- [ ] Add `machine` and `calculationMode` to JSON export/import.
- [ ] Add `CNC Machine` and `Calculation Mode` to CSV export.
- [ ] Include generated material presets in Fusion 360 export as before.

**Acceptance criteria:**
- Existing localStorage databases do not disappear or fail validation.
- Imported older JSON backups still work.
- Exports reflect generated names and generated presets.

---

## Refinement 6: Testing Checklist

**Goal:** Verify the new workflow end to end.

**Manual tests:**
- [ ] Add a 6mm, 2 flute end mill for `PRO` in Beginner mode and confirm all materials are generated.
- [ ] Add the same tool for `PRO` in Advanced mode and confirm generated feedrates differ where expected.
- [ ] Change the CNC machine from `EVO` to `FAB` and confirm generated RPM, feedrate, and DOC update where expected.
- [ ] Edit diameter/flutes and confirm name and all presets regenerate.
- [ ] Add a surfacing cutter and confirm surface generator receives diameter, RPM, feedrate, stepover, and depth per pass.
- [ ] Select the generated tool in the feeds/speeds calculator and confirm material preset selection works.
- [ ] Import an older JSON backup and confirm tools still display.
- [ ] Export JSON, CSV, and Fusion 360 files and confirm generated fields are present.
- [ ] Check all tooltips on desktop and mobile widths.

**Regression tests:**
- [ ] Existing calculator Beginner and Advanced results are unchanged after extracting shared logic.
- [ ] LocalStorage persistence still works across reloads.
- [ ] Tool filters still work with generated names.

---

## Suggested Implementation Order

1. Extract shared calculation logic without changing behavior.
2. Add generated presets behind the current save flow.
3. Add CNC machine and calculation mode, then remove manual preset editing from the primary workflow.
4. Add automatic naming.
5. Add info icons and tooltip copy.
6. Add migration/export updates.
7. Run the full testing checklist.
