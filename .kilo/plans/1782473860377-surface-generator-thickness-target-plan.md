# Surface Generator Thickness Target Plan

## Goal
Add a second surfacing input workflow to `surface.html` and `assets/js/pages/surface-generator.js` so users can generate G-code either by:

1. entering a direct `Total Depth` using top-of-material Z zero, or
2. entering `Initial Thickness` and `Final Thickness` using machine-bed/spoilboard Z zero.

## Decisions
- Add an explicit depth mode toggle with two options:
  - `Total depth`
  - `Thickness target`
- Hide inactive field groups entirely.
- `Total depth` mode keeps the current zeroing model:
  - Z zero is the material top.
  - `Start Z` remains active.
  - Cutting depth is `totalDepth` below `Start Z`.
- `Thickness target` mode uses a different zeroing model:
  - Z zero is the machine bed/spoilboard surface.
  - `Start Z` is hidden/inactive.
  - `Initial Thickness` and `Final Thickness` are entered in mm above the bed.
  - Effective stock removal is `initialThickness - finalThickness`.
  - Final cutting Z is absolute `finalThickness`.
- Persist both workflows in localStorage, along with the selected mode.

## Affected Files
- `surface.html`
- `assets/js/pages/surface-generator.js`
- `assets/css/styles.css` only if existing utility classes are insufficient for the new mode/field-group visibility behavior.

## Implementation Tasks
1. Update the form in `surface.html`.
   - Add a new section near the workpiece/depth inputs for the depth mode toggle.
   - Keep the existing `Total Depth` field in its own mode-specific group.
   - Add a new thickness-target group with:
     - `Initial Thickness`
     - `Final Thickness`
   - Keep `Start Z` visible only for total-depth mode.
   - Add concise helper text or `aria-label` wording that makes the zero-reference difference explicit:
     - total-depth mode = top-of-material zero
     - thickness-target mode = machine-bed zero

2. Extend persisted settings in `surface-generator.js`.
   - Include the new mode field and the new thickness inputs in `surfaceSettingFields` or equivalent persistence logic.
   - Restore the selected mode on load before first generation.
   - Ensure hidden inactive values are still preserved in localStorage when users switch modes.

3. Refactor input collection into a mode-aware shape.
   - Read and store:
     - `depthMode`
     - `totalDepth`
     - `initialThickness`
     - `finalThickness`
   - Keep existing common fields unchanged.
   - Add one shared helper that computes the effective cutting depth and target Z behavior from the selected mode.

4. Add mode-aware validation.
   - Validate common fields as today.
   - In `Total depth` mode:
     - require `totalDepth > 0`
     - require `Start Z` finite
     - keep the existing `safeZ > startZ` rule
   - In `Thickness target` mode:
     - require `initialThickness > 0`
     - require `finalThickness >= 0`
     - require `finalThickness < initialThickness`
     - require `safeZ > initialThickness` because safe Z must clear the top of the stock when bed zero is used
   - Error messages must state the active reference model clearly.

5. Centralize derived depth calculations.
   - Introduce a helper that returns the mode-derived surfacing data, for example:
     - effective removal depth
     - pass count basis
     - top surface Z used for the first plunge
     - final target Z for the last pass
   - Use this helper everywhere current code reads `inputs.totalDepth` directly.

6. Update pass-count, stats, and toolpath calculations.
   - `calculatePasses()` must use the effective removal depth, not raw `totalDepth`.
   - Toolpath length and time estimates stay structurally the same, but use the new pass count.
   - Stats panel remains unchanged visually unless a small label update is needed for clarity.

7. Update G-code header comments.
   - Include the selected depth mode.
   - In total-depth mode, keep `Total Depth` in the header.
   - In thickness-target mode, include:
     - `Initial Thickness`
     - `Final Thickness`
     - derived removal depth
     - note that Z zero is machine bed/spoilboard

8. Update Z motion generation in `generateRasterToolpath()`.
   - Total-depth mode:
     - preserve the current behavior using `startZ - incrementalDepth`.
   - Thickness-target mode:
     - start from the stock top at `initialThickness`
     - compute each depth pass by stepping down toward `finalThickness`
     - last pass must end exactly at `finalThickness`
     - safe retracts stay at `safeZ`
   - XY raster logic stays unchanged.

9. Update filename generation.
   - Replace direct dependence on `latestInputs.totalDepth`.
   - Use mode-aware naming:
     - total-depth mode: preserve current depth-based naming
     - thickness-target mode: include final thickness or derived removal depth in a concise way
   - Keep names filesystem-safe and consistent with current style.

10. Add mode-switch behavior.
   - On mode change:
     - show/hide the relevant field groups
     - save settings
     - rerun generation so validation/output/stats reflect the active mode immediately

## Edge Cases
- Switching modes should not clear previously entered values for the other mode.
- `Final Thickness = 0` should be valid if surfacing down to the bed is intentionally allowed by the current product expectations; if implementation prefers to forbid this for safety, that must be explicitly changed and documented before shipping.
- Very small removal values in thickness mode must still produce exactly one pass when they are greater than zero and less than `depthPerPass`.
- The last thickness-mode pass must clamp exactly to `finalThickness` to avoid overshooting due to floating-point accumulation.

## Validation Plan
- Manual checks in browser for both modes.
- Verify total-depth mode still reproduces current behavior and output structure.
- Verify thickness-target mode with a sample like:
  - initial `40 mm`
  - final `38.5 mm`
  - depth per pass `0.5 mm`
  - expected removal `1.5 mm`
  - expected pass count `3`
  - final programmed cutting Z `38.5`
- Verify invalid scenarios:
  - final thickness greater than or equal to initial thickness
  - safe Z not above initial thickness in thickness mode
  - missing total depth in total-depth mode
- Verify page reload restores selected mode and relevant values.
- Verify downloaded filename changes appropriately per mode.

## Risks
- The main regression risk is mixing two Z-reference models inside the existing single input structure.
- The safest implementation approach is to isolate all mode-specific depth math in one helper and keep raster XY logic unchanged.
