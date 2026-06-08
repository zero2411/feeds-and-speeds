# Surface G-Code Generator Implementation Plan

## Goal
Implement `surface.html` as a plain JavaScript CNC surfacing G-code generator for wooden slabs, with validated inputs, grain-direction-aware zig-zag raster generation, multiple depth passes, readable G-code preview, statistics, and `.nc` download support.

## Files To Change
- `surface.html`
- `styles.css`  
- `surface.js` new file

## Current Context
- `surface.html` is mostly empty.
- The site already has shared layout, navigation, card, form, result-card, and responsive styles in `styles.css`.
- Existing scripts are plain JavaScript with direct DOM access and simple modular functions.
- Navigation currently marks multiple links as `active`; while implementing `surface.html`, set only the surface page link active on that page.

## HTML Plan
Update `surface.html` to:
- Keep existing shared `styles.css` and add `<link rel="stylesheet" href="surface.css">`.
- Replace the empty `<main>` container with:
  - A generator form card.
  - A statistics/result card.
  - A G-code preview/download card.
- Replace `<script src="toolpath.js"></script>` with `<script src="surface.js"></script>`.

Form sections:
- Workpiece:
  - `surface-width`, number, mm, default `500`.
  - `surface-length`, number, mm, default `800`.
  - `surface-total-depth`, number, mm, default `1.5`.
- Grain Direction:
  - Radio group `grain-direction` with values `X` and `Y`, default `X`.
- Tool Parameters:
  - `surface-bit-diameter`, number, mm, default `25`.
  - `surface-stepover`, number, percent, default `60`, min `10`, max `90`.
- Cutting Parameters:
  - `surface-feedrate`, number, mm/min, default `5000`.
  - `surface-rpm`, number, rpm, default `18000`.
  - `surface-depth-per-pass`, number, mm, default `0.5`.
- Advanced Settings:
  - `surface-safe-z`, number, mm, default `10`.
  - `surface-start-x`, number, mm, default `0`.
  - `surface-start-y`, number, mm, default `0`.
  - `surface-start-z`, number, mm, default `0`.

Controls and output:
- Validation message area, hidden unless errors exist.
- `Generate G-Code` button.
- `Download .nc` button, disabled/hidden until generation succeeds.
- Readonly textarea `surface-gcode-output` for generated G-code.
- Stats output values:
  - Raster passes.
  - Depth passes.
  - Toolpath length in meters.
  - Estimated machining time in `Xm Ys` format.

## CSS Plan
Create `surface.css` for page-specific additions only, relying on `styles.css` for common structure.

Add styles for:
- Section headings inside the form card.
- Radio button layout.
- Form action buttons.
- Error box.
- G-code textarea, monospaced and large.
- Download button state.
- Responsive tweaks for surface-specific layouts if needed.

Keep visual language consistent with the existing site.

## JavaScript Plan
Create `surface.js` with the functions requested in the specification:
- `generateGcode()`
- `generateHeader()`
- `generateFooter()`
- `generateRasterToolpath()`
- `calculatePasses()`
- `calculateStepover()`
- `estimateMachiningTime()`
- `downloadGcode()`
- `validateInputs()`

Additional small helpers if useful:
- `getInputs()` to parse DOM values into a single object.
- `formatNumber()` to keep G-code numeric output clean.
- `formatDuration()` for estimated time.
- `setValidationErrors()` to display errors.
- `setStats()` to update the UI.

## Calculation Details
- `stepoverDistance = bitDiameter * (stepoverPercent / 100)`.
- `depthPasses = Math.ceil(totalDepth / depthPerPass)`.
- `margin = bitDiameter / 2`.
- For grain `X`:
  - Long axis is X, cross axis is Y.
  - X range is `startX - margin` to `startX + width + margin`.
  - Y range is `startY - margin` to `startY + length + margin`.
  - Raster row count should cover the full Y range including margin: `Math.ceil((length + bitDiameter) / stepoverDistance) + 1` or equivalent endpoint-based loop.
- For grain `Y`:
  - Long axis is Y, cross axis is X.
  - Y range is `startY - margin` to `startY + length + margin`.
  - X range is `startX - margin` to `startX + width + margin`.
  - Raster row count covers the full X range including margin.
- For each depth pass:
  - `currentDepth = -Math.min(totalDepth, passNumber * depthPerPass)`.
  - Rapid to safe Z before positioning at the first raster start.
  - Plunge using a conservative fixed plunge feed from the example, `F1000`, or use `Math.min(feedrate, 1000)` to avoid plunging faster than the programmed feed on small jobs.
  - Cut long zig-zag passes at `F{feedrate}`.
  - Step over on the cross axis between long passes without retracting.
- Zig-zag alternates endpoints so the next long pass starts where the previous one ended.

## G-Code Format
Generate readable lines like:
```gcode
%
(SURFACING PROGRAM)

(Width: 500 mm)
(Length: 800 mm)
(Bit Diameter: 25 mm)
(Stepover: 60%)
(Feedrate: 5000 mm/min)
(RPM: 18000)
(Grain Direction: X)
(Total Depth: 1.5 mm)
(Passes: 3)

G21
G90
G17

M3 S18000

G0 Z10
G0 X0 Y0
```

Footer:
```gcode
G0 Z10
G0 X0 Y0

M5

M30
%
```

## Validation Rules
Implement `validateInputs()` with meaningful messages:
- `width > 0`
- `length > 0`
- `totalDepth > 0`
- `bitDiameter > 0`
- `stepoverPercent >= 10 && stepoverPercent <= 90`
- `feedrate > 0`
- `rpm >= 1000`
- `depthPerPass > 0`
- `safeZ > startZ` recommended/required to avoid unsafe rapid height; if not strictly required by spec, validate as `safeZ > 0` and leave `startZ` as metadata/control origin value.
- Advanced coordinates must be finite numbers.

If validation fails:
- Show all messages in the error area.
- Do not generate or download G-code.
- Keep previous generated code only if already present, or clear it for clarity.

## Statistics Plan
- Raster passes: number of cross-axis raster lines per depth pass.
- Depth passes: `passCount`.
- Toolpath length:
  - Include cutting long passes and cross-axis stepover moves for each depth pass.
  - Exclude rapid positioning and retracts for a simple estimate.
  - Convert display to meters with one decimal place.
- Estimated machining time:
  - `toolpathLengthMm / feedrate` minutes.
  - Format as minutes and seconds.

## Download Plan
- Store latest generated G-code in a module-level variable.
- Enable download button only after successful generation.
- Filename: `surface_${width}x${length}_${totalDepth}mm.nc`, sanitized by replacing decimal dots if necessary is optional; keep readable as specified, e.g. `surface_500x800_1.5mm.nc`.
- Use `Blob`, `URL.createObjectURL`, temporary `<a>`, click, then revoke URL.

## Verification Plan
After implementation:
- Open/read files to confirm correct script and stylesheet references.
- Run browser-free sanity checks where possible by reviewing generated JS syntax and DOM IDs.
- Optionally run a lightweight syntax check with `node --check surface.js` if available.
- Manually reason through the example values:
  - Width `500`, length `800`, depth `1.5`, bit `25`, stepover `60`, depth/pass `0.5` should produce `3` depth passes.
  - Margin should be `12.5`.
  - Grain X should emit X long passes and Y stepover moves.
  - Grain Y should emit Y long passes and X stepover moves.

## Notes
- No canvas preview will be implemented because the required output section asks for G-code preview; canvas preview is listed under future enhancements.
- Existing navigation active-state inconsistencies on other pages can be left untouched unless explicitly included later; `surface.html` should be correct for the surface page.
