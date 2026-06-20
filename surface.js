// ── DOM References ───────────────────────────────────────────────────────────

// Form and output elements
const surfaceForm = document.getElementById('surface-form');
const surfaceErrors = document.getElementById('surface-errors');
const surfaceGcodeOutput = document.getElementById('surface-gcode-output');
const surfaceDownloadButton = document.getElementById('surface-download');
const surfaceToolSelect = document.getElementById('surface-tool-select');
const surfaceToolPresetField = document.getElementById('surface-tool-preset-field');
const surfaceToolPresetSelect = document.getElementById('surface-tool-preset-select');
const surfaceToolClear = document.getElementById('surface-tool-clear');

// Statistics display elements
const surfaceStatRasterPasses = document.getElementById('surface-stat-raster-passes');
const surfaceStatDepthPasses = document.getElementById('surface-stat-depth-passes');
const surfaceStatToolpathLength = document.getElementById('surface-stat-toolpath-length');
const surfaceStatTime = document.getElementById('surface-stat-time');

// ── Settings Persistence ───────────────────────────────────────────────────────

// LocalStorage key for saving form values between sessions
const surfaceSettingsStorageKey = 'cnc-surface-generator-settings';

// Form fields to persist (by element ID)
const surfaceSettingFields = [
  'surface-width', 'surface-length', 'surface-total-depth',
  'surface-bit-diameter', 'surface-stepover', 'surface-feedrate',
  'surface-rpm', 'surface-depth-per-pass', 'surface-safe-z',
  'surface-start-x', 'surface-start-y', 'surface-start-z'
];

// Cached outputs for download
let latestGcode = '';
let latestInputs = null;
let selectedSurfaceTool = null;

// Restore saved settings from localStorage on page load
function loadSavedSettings() {
  try {
    const savedSettings = JSON.parse(localStorage.getItem(surfaceSettingsStorageKey));
    if (!savedSettings || typeof savedSettings !== 'object') return;

    surfaceSettingFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && savedSettings[fieldId] !== undefined) {
        field.value = savedSettings[fieldId];
      }
    });

    // Also restore grain direction radio selection
    if (savedSettings.grainDirection) {
      const grainInput = document.querySelector(`input[name="grain-direction"][value="${savedSettings.grainDirection}"]`);
      if (grainInput) grainInput.checked = true;
    }
  } catch (error) {
    localStorage.removeItem(surfaceSettingsStorageKey);
  }
}

// Save current form values to localStorage
function saveSettings() {
  const settings = surfaceSettingFields.reduce((savedSettings, fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) savedSettings[fieldId] = field.value;
    return savedSettings;
  }, {});
  const grainInput = document.querySelector('input[name="grain-direction"]:checked');
  settings.grainDirection = grainInput ? grainInput.value : 'X';
  localStorage.setItem(surfaceSettingsStorageKey, JSON.stringify(settings));
}

// Attach event listeners to form fields for auto-saving
function watchSettings() {
  surfaceSettingFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) field.addEventListener('input', saveSettings);
  });
  document.querySelectorAll('input[name="grain-direction"]').forEach((field) => {
    field.addEventListener('change', saveSettings);
  });
}

// ── Input Handling ──────────────────────────────────────────────────────────

// Collect all form values into an input object
function getInputs() {
  const grainInput = document.querySelector('input[name="grain-direction"]:checked');
  return {
    width: parseFloat(document.getElementById('surface-width').value),
    length: parseFloat(document.getElementById('surface-length').value),
    totalDepth: parseFloat(document.getElementById('surface-total-depth').value),
    grainDirection: grainInput ? grainInput.value : 'X',
    bitDiameter: parseFloat(document.getElementById('surface-bit-diameter').value),
    stepoverPercent: parseFloat(document.getElementById('surface-stepover').value),
    feedrate: parseFloat(document.getElementById('surface-feedrate').value),
    rpm: parseFloat(document.getElementById('surface-rpm').value),
    depthPerPass: parseFloat(document.getElementById('surface-depth-per-pass').value),
    safeZ: parseFloat(document.getElementById('surface-safe-z').value),
    startX: parseFloat(document.getElementById('surface-start-x').value),
    startY: parseFloat(document.getElementById('surface-start-y').value),
    startZ: parseFloat(document.getElementById('surface-start-z').value)
  };
}

// Validate all inputs; returns array of error messages (empty if valid)
function validateInputs(inputs) {
  const errors = [];
  // Check required positive values
  if (!Number.isFinite(inputs.width) || inputs.width <= 0) errors.push('Width must be greater than 0 mm.');
  if (!Number.isFinite(inputs.length) || inputs.length <= 0) errors.push('Length must be greater than 0 mm.');
  if (!Number.isFinite(inputs.totalDepth) || inputs.totalDepth <= 0) errors.push('Total depth must be greater than 0 mm.');
  if (!Number.isFinite(inputs.bitDiameter) || inputs.bitDiameter <= 0) errors.push('Bit diameter must be greater than 0 mm.');
  if (!Number.isFinite(inputs.stepoverPercent) || inputs.stepoverPercent < 10 || inputs.stepoverPercent > 90) errors.push('Stepover must be between 10% and 90%.');
  if (!Number.isFinite(inputs.feedrate) || inputs.feedrate <= 0) errors.push('Feedrate must be greater than 0 mm/min.');
  if (!Number.isFinite(inputs.rpm) || inputs.rpm < 1000) errors.push('RPM must be at least 1000.');
  if (!Number.isFinite(inputs.depthPerPass) || inputs.depthPerPass <= 0) errors.push('Depth per pass must be greater than 0 mm.');
  if (!Number.isFinite(inputs.safeZ) || inputs.safeZ <= 0) errors.push('Safe Z must be greater than 0 mm.');
  // Check finite values (can be negative for start positions)
  if (!Number.isFinite(inputs.startX)) errors.push('Start X must be a finite number.');
  if (!Number.isFinite(inputs.startY)) errors.push('Start Y must be a finite number.');
  if (!Number.isFinite(inputs.startZ)) errors.push('Start Z must be a finite number.');
  // Safe Z must be above the workpiece
  if (Number.isFinite(inputs.safeZ) && Number.isFinite(inputs.startZ) && inputs.safeZ <= inputs.startZ) errors.push('Safe Z must be higher than Start Z.');
  return errors;
}

// Display validation errors or clear them if none
function setValidationErrors(errors) {
  if (!errors.length) {
    surfaceErrors.hidden = true;
    surfaceErrors.innerHTML = '';
    return;
  }
  surfaceErrors.innerHTML = `<ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>`;
  surfaceErrors.hidden = false;
}

// ── Calculation Functions ───────────────────────────────────────────────────

// Calculate stepover distance (mm) from bit diameter and percentage
function calculateStepover(inputs) {
  return inputs.bitDiameter * (inputs.stepoverPercent / 100);
}

// Calculate number of depth passes needed
function calculatePasses(inputs) {
  return Math.ceil(inputs.totalDepth / inputs.depthPerPass);
}

// Build array of Y (or X) positions for raster scan lines
// Starts at workpiece edge minus bit radius, ends at far edge plus bit radius
function buildRasterLines(inputs) {
  // const margin = inputs.bitDiameter / 2;
  const margin = 0;
  const stepoverDistance = calculateStepover(inputs);
  const crossLength = inputs.grainDirection === 'X' ? inputs.length : inputs.width;
  const crossStart = inputs.grainDirection === 'X' ? inputs.startY - margin : inputs.startX - margin;
  const crossEnd = crossStart + crossLength + inputs.bitDiameter;
  const lines = [];

  // Generate stepover lines across the workpiece
  for (let cross = crossStart; cross < crossEnd; cross += stepoverDistance) {
    lines.push(Math.min(cross, crossEnd));
  }

  // Ensure we always include the endpoint
  if (lines.length === 0 || lines[lines.length - 1] < crossEnd) {
    lines.push(crossEnd);
  }
  return lines;
}

// Estimate total toolpath length (mm) for all passes
function calculateToolpathLength(inputs) {
  const rasterLines = buildRasterLines(inputs);
  const depthPasses = calculatePasses(inputs);
  const longLength = (inputs.grainDirection === 'X' ? inputs.width : inputs.length) + inputs.bitDiameter;
  const crossLength = rasterLines.length > 1 ? rasterLines[rasterLines.length - 1] - rasterLines[0] : 0;
  const lengthPerDepth = (rasterLines.length * longLength) + crossLength;
  return lengthPerDepth * depthPasses;
}

// Estimate machining time (minutes) from toolpath length and feedrate
function estimateMachiningTime(toolpathLengthMm, feedrate) {
  return toolpathLengthMm / feedrate;
}

// ── Formatting Helpers ───────────────────────────────────────────────────────

// Format number to 3 decimal places without trailing zeros
function formatNumber(value) {
  return Number(value.toFixed(3)).toString();
}

// Convert minutes to "Xm Ys" format for display
function formatDuration(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

// ── G-code Generation ───────────────────────────────────────────────────────

// Generate G-code header with program info and setup commands
function generateHeader(inputs) {
  const passCount = calculatePasses(inputs);
  return [
    '%', '(SURFACING PROGRAM)', '',
    `(Width: ${formatNumber(inputs.width)} mm)`,
    `(Length: ${formatNumber(inputs.length)} mm)`,
    `(Bit Diameter: ${formatNumber(inputs.bitDiameter)} mm)`,
    `(Stepover: ${formatNumber(inputs.stepoverPercent)}%)`,
    `(Feedrate: ${formatNumber(inputs.feedrate)} mm/min)`,
    `(RPM: ${formatNumber(inputs.rpm)})`,
    `(Grain Direction: ${inputs.grainDirection})`,
    `(Total Depth: ${formatNumber(inputs.totalDepth)} mm)`,
    `(Passes: ${passCount})`, '',
    'G21', 'G90', 'G17', '',  // Metric, absolute coords, XY plane
    `M3 S${formatNumber(inputs.rpm)}`, '',  // Spindle on
    `G0 Z${formatNumber(inputs.safeZ)}`,  // Safe Z height
    `G0 X${formatNumber(inputs.startX)} Y${formatNumber(inputs.startY)}`  // Start position
  ];
}

// Generate raster toolpath for all depth passes
// Grain direction determines scan axis: X=scan along width, Y=scan along length
function generateRasterToolpath(inputs) {
  const lines = [];
  // const margin = inputs.bitDiameter / 2;
  const margin = 0;
  const rasterLines = buildRasterLines(inputs);
  const depthPasses = calculatePasses(inputs);
  const plungeFeed = Math.min(inputs.feedrate, 1000);  // Limit plunge feed

  // Workpiece bounds including approach margin
  const xMin = inputs.startX - margin;
  const xMax = inputs.startX + inputs.width + margin;
  const yMin = inputs.startY - margin;
  const yMax = inputs.startY + inputs.length + margin;

  for (let pass = 1; pass <= depthPasses; pass += 1) {
    const currentDepth = inputs.startZ - Math.min(inputs.totalDepth, pass * inputs.depthPerPass);
    lines.push('', `(DEPTH PASS ${pass} OF ${depthPasses} - Z${formatNumber(currentDepth)})`);
    lines.push(`G0 Z${formatNumber(inputs.safeZ)}`);

    // X-grain: scan along X axis (Y moves between raster lines)
    if (inputs.grainDirection === 'X') {
      lines.push(`G0 X${formatNumber(xMin)} Y${formatNumber(rasterLines[0])}`);
      lines.push(`G1 Z${formatNumber(currentDepth)} F${formatNumber(plungeFeed)}`);

      rasterLines.forEach((y, index) => {
        const x = index % 2 === 0 ? xMax : xMin;  // Zig-zag pattern
        lines.push(`G1 X${formatNumber(x)} Y${formatNumber(y)} F${formatNumber(inputs.feedrate)}`);
        if (index < rasterLines.length - 1) {
          lines.push(`G1 X${formatNumber(x)} Y${formatNumber(rasterLines[index + 1])}`);  // Move to next line
        }
      });
    } else {
      // Y-grain: scan along Y axis (X moves between raster lines)
      lines.push(`G0 X${formatNumber(rasterLines[0])} Y${formatNumber(yMin)}`);
      lines.push(`G1 Z${formatNumber(currentDepth)} F${formatNumber(plungeFeed)}`);

      rasterLines.forEach((x, index) => {
        const y = index % 2 === 0 ? yMax : yMin;  // Zig-zag pattern
        lines.push(`G1 X${formatNumber(x)} Y${formatNumber(y)} F${formatNumber(inputs.feedrate)}`);
        if (index < rasterLines.length - 1) {
          lines.push(`G1 X${formatNumber(rasterLines[index + 1])} Y${formatNumber(y)}`);  // Move to next line
        }
      });
    }
  }
  return lines;
}

// Generate G-code footer to return to safe position and end program
function generateFooter(inputs) {
  return [
    '',
    `G0 Z${formatNumber(inputs.safeZ)}`,  // Retract to safe Z
    `G0 X${formatNumber(inputs.startX)} Y${formatNumber(inputs.startY)}`, '',  // Return to start
    'M5', '',  // Spindle stop
    'M30', '%'  // Program end
  ];
}

// ── Statistics Display ───────────────────────────────────────────────────────

// Update statistics panel with calculated values
function setStats(inputs) {
  const rasterPasses = buildRasterLines(inputs).length;
  const depthPasses = calculatePasses(inputs);
  const toolpathLengthMm = calculateToolpathLength(inputs);
  const machiningTime = estimateMachiningTime(toolpathLengthMm, inputs.feedrate);

  surfaceStatRasterPasses.textContent = rasterPasses.toLocaleString('en');
  surfaceStatDepthPasses.textContent = depthPasses.toLocaleString('en');
  surfaceStatToolpathLength.textContent = (toolpathLengthMm / 1000).toFixed(1);  // Convert to meters
  surfaceStatTime.textContent = formatDuration(machiningTime);
}

// Clear statistics display (used when validation fails)
function clearStats() {
  surfaceStatRasterPasses.textContent = '-';
  surfaceStatDepthPasses.textContent = '-';
  surfaceStatToolpathLength.textContent = '-';
  surfaceStatTime.textContent = '-';
}

// ── Main Event Handlers ─────────────────────────────────────────────────────

// Handle form submission: validate inputs and generate G-code
function generateGcode(event) {
  if (event) event.preventDefault();

  const inputs = getInputs();
  const errors = validateInputs(inputs);
  setValidationErrors(errors);

  if (errors.length) {
    // Clear output on validation failure
    latestGcode = '';
    latestInputs = null;
    surfaceGcodeOutput.value = '';
    surfaceDownloadButton.disabled = true;
    clearStats();
    return;
  }

  // Combine header, toolpath, and footer into complete G-code program
  const gcode = [
    ...generateHeader(inputs),
    ...generateRasterToolpath(inputs),
    ...generateFooter(inputs)
  ].join('\n');

  latestGcode = gcode;
  latestInputs = inputs;
  surfaceGcodeOutput.value = gcode;
  surfaceDownloadButton.disabled = false;
  setStats(inputs);
}

// Download generated G-code as .nc file
function downloadGcode() {
  if (!latestGcode || !latestInputs) return;

  const filename = `surface_${formatNumber(latestInputs.width)}x${formatNumber(latestInputs.length)}_${formatNumber(latestInputs.totalDepth)}mm.nc`;
  const blob = new Blob([latestGcode], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Tool Database Integration ────────────────────────────────────────────────

function populateSurfaceToolSelector() {
  if (!window.ToolDB || !surfaceToolSelect) return;
  const tools = ToolDB.getAllTools().filter(tool => tool.toolType === 'surfacing');
  surfaceToolSelect.innerHTML = '<option value="">— select —</option>';
  tools.forEach((tool) => {
    const option = document.createElement('option');
    option.value = tool.id;
    option.textContent = `${tool.name} (${tool.diameter}${tool.units || 'mm'})`;
    surfaceToolSelect.appendChild(option);
  });
}

function populateSurfacePresetSelector(tool) {
  const materials = Object.keys((tool && tool.materials) || {});
  surfaceToolPresetSelect.innerHTML = '<option value="">— select —</option>';
  materials.forEach((material) => {
    const option = document.createElement('option');
    option.value = material;
    option.textContent = material;
    surfaceToolPresetSelect.appendChild(option);
  });
  surfaceToolPresetField.hidden = materials.length === 0;
}

function selectSurfaceTool(toolId) {
  selectedSurfaceTool = window.ToolDB && toolId ? ToolDB.getTool(toolId) : null;
  surfaceToolPresetSelect.value = '';
  if (!selectedSurfaceTool) {
    populateSurfacePresetSelector(null);
    generateGcode();
    return;
  }
  setFieldValue('surface-bit-diameter', selectedSurfaceTool.diameter);
  populateSurfacePresetSelector(selectedSurfaceTool);
  saveSettings();
  generateGcode();
}

function selectSurfacePreset(material) {
  if (!selectedSurfaceTool || !material) {
    generateGcode();
    return;
  }
  const preset = selectedSurfaceTool.materials[material];
  if (!preset) return;
  setFieldValue('surface-rpm', preset.rpm);
  setFieldValue('surface-feedrate', preset.feedrate);
  setFieldValue('surface-stepover', preset.stepover);
  setFieldValue('surface-depth-per-pass', preset.depthOfCut);
  saveSettings();
  generateGcode();
}

function clearSurfaceTool() {
  selectedSurfaceTool = null;
  surfaceToolSelect.value = '';
  surfaceToolPresetSelect.value = '';
  populateSurfacePresetSelector(null);
  generateGcode();
}

function setFieldValue(fieldId, value) {
  if (value === '' || value === null || value === undefined) return;
  const field = document.getElementById(fieldId);
  if (field) field.value = value;
}

// ── Initialization ───────────────────────────────────────────────────────────

surfaceForm.addEventListener('submit', generateGcode);
surfaceDownloadButton.addEventListener('click', downloadGcode);
if (surfaceToolSelect) {
  surfaceToolSelect.addEventListener('change', () => selectSurfaceTool(surfaceToolSelect.value));
  surfaceToolPresetSelect.addEventListener('change', () => selectSurfacePreset(surfaceToolPresetSelect.value));
  surfaceToolClear.addEventListener('click', clearSurfaceTool);
}
loadSavedSettings();
watchSettings();
populateSurfaceToolSelector();
generateGcode();
