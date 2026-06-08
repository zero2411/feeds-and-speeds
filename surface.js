const surfaceForm = document.getElementById('surface-form');
const surfaceErrors = document.getElementById('surface-errors');
const surfaceGcodeOutput = document.getElementById('surface-gcode-output');
const surfaceDownloadButton = document.getElementById('surface-download');

const surfaceStatRasterPasses = document.getElementById('surface-stat-raster-passes');
const surfaceStatDepthPasses = document.getElementById('surface-stat-depth-passes');
const surfaceStatToolpathLength = document.getElementById('surface-stat-toolpath-length');
const surfaceStatTime = document.getElementById('surface-stat-time');

let latestGcode = '';
let latestInputs = null;

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

function validateInputs(inputs) {
  const errors = [];

  if (!Number.isFinite(inputs.width) || inputs.width <= 0) errors.push('Width must be greater than 0 mm.');
  if (!Number.isFinite(inputs.length) || inputs.length <= 0) errors.push('Length must be greater than 0 mm.');
  if (!Number.isFinite(inputs.totalDepth) || inputs.totalDepth <= 0) errors.push('Total depth must be greater than 0 mm.');
  if (!Number.isFinite(inputs.bitDiameter) || inputs.bitDiameter <= 0) errors.push('Bit diameter must be greater than 0 mm.');
  if (!Number.isFinite(inputs.stepoverPercent) || inputs.stepoverPercent < 10 || inputs.stepoverPercent > 90) errors.push('Stepover must be between 10% and 90%.');
  if (!Number.isFinite(inputs.feedrate) || inputs.feedrate <= 0) errors.push('Feedrate must be greater than 0 mm/min.');
  if (!Number.isFinite(inputs.rpm) || inputs.rpm < 1000) errors.push('RPM must be at least 1000.');
  if (!Number.isFinite(inputs.depthPerPass) || inputs.depthPerPass <= 0) errors.push('Depth per pass must be greater than 0 mm.');
  if (!Number.isFinite(inputs.safeZ) || inputs.safeZ <= 0) errors.push('Safe Z must be greater than 0 mm.');
  if (!Number.isFinite(inputs.startX)) errors.push('Start X must be a finite number.');
  if (!Number.isFinite(inputs.startY)) errors.push('Start Y must be a finite number.');
  if (!Number.isFinite(inputs.startZ)) errors.push('Start Z must be a finite number.');
  if (Number.isFinite(inputs.safeZ) && Number.isFinite(inputs.startZ) && inputs.safeZ <= inputs.startZ) errors.push('Safe Z must be higher than Start Z.');

  return errors;
}

function setValidationErrors(errors) {
  if (!errors.length) {
    surfaceErrors.hidden = true;
    surfaceErrors.innerHTML = '';
    return;
  }

  surfaceErrors.innerHTML = `<ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>`;
  surfaceErrors.hidden = false;
}

function calculateStepover(inputs) {
  return inputs.bitDiameter * (inputs.stepoverPercent / 100);
}

function calculatePasses(inputs) {
  return Math.ceil(inputs.totalDepth / inputs.depthPerPass);
}

function buildRasterLines(inputs) {
  const margin = inputs.bitDiameter / 2;
  const stepoverDistance = calculateStepover(inputs);
  const crossLength = inputs.grainDirection === 'X' ? inputs.length : inputs.width;
  const crossStart = inputs.grainDirection === 'X' ? inputs.startY - margin : inputs.startX - margin;
  const crossEnd = crossStart + crossLength + inputs.bitDiameter;
  const lines = [];

  for (let cross = crossStart; cross < crossEnd; cross += stepoverDistance) {
    lines.push(Math.min(cross, crossEnd));
  }

  if (lines.length === 0 || lines[lines.length - 1] < crossEnd) {
    lines.push(crossEnd);
  }

  return lines;
}

function calculateToolpathLength(inputs) {
  const rasterLines = buildRasterLines(inputs);
  const depthPasses = calculatePasses(inputs);
  const longLength = (inputs.grainDirection === 'X' ? inputs.width : inputs.length) + inputs.bitDiameter;
  const crossLength = rasterLines.length > 1 ? rasterLines[rasterLines.length - 1] - rasterLines[0] : 0;
  const lengthPerDepth = (rasterLines.length * longLength) + crossLength;

  return lengthPerDepth * depthPasses;
}

function estimateMachiningTime(toolpathLengthMm, feedrate) {
  return toolpathLengthMm / feedrate;
}

function formatNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function formatDuration(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins}m ${secs}s`;
}

function generateHeader(inputs) {
  const passCount = calculatePasses(inputs);

  return [
    '%',
    '(SURFACING PROGRAM)',
    '',
    `(Width: ${formatNumber(inputs.width)} mm)`,
    `(Length: ${formatNumber(inputs.length)} mm)`,
    `(Bit Diameter: ${formatNumber(inputs.bitDiameter)} mm)`,
    `(Stepover: ${formatNumber(inputs.stepoverPercent)}%)`,
    `(Feedrate: ${formatNumber(inputs.feedrate)} mm/min)`,
    `(RPM: ${formatNumber(inputs.rpm)})`,
    `(Grain Direction: ${inputs.grainDirection})`,
    `(Total Depth: ${formatNumber(inputs.totalDepth)} mm)`,
    `(Passes: ${passCount})`,
    '',
    'G21',
    'G90',
    'G17',
    '',
    `M3 S${formatNumber(inputs.rpm)}`,
    '',
    `G0 Z${formatNumber(inputs.safeZ)}`,
    `G0 X${formatNumber(inputs.startX)} Y${formatNumber(inputs.startY)}`
  ];
}

function generateRasterToolpath(inputs) {
  const lines = [];
  const margin = inputs.bitDiameter / 2;
  const rasterLines = buildRasterLines(inputs);
  const depthPasses = calculatePasses(inputs);
  const plungeFeed = Math.min(inputs.feedrate, 1000);

  const xMin = inputs.startX - margin;
  const xMax = inputs.startX + inputs.width + margin;
  const yMin = inputs.startY - margin;
  const yMax = inputs.startY + inputs.length + margin;

  for (let pass = 1; pass <= depthPasses; pass += 1) {
    const currentDepth = inputs.startZ - Math.min(inputs.totalDepth, pass * inputs.depthPerPass);

    lines.push('');
    lines.push(`(DEPTH PASS ${pass} OF ${depthPasses} - Z${formatNumber(currentDepth)})`);
    lines.push(`G0 Z${formatNumber(inputs.safeZ)}`);

    if (inputs.grainDirection === 'X') {
      lines.push(`G0 X${formatNumber(xMin)} Y${formatNumber(rasterLines[0])}`);
      lines.push(`G1 Z${formatNumber(currentDepth)} F${formatNumber(plungeFeed)}`);

      rasterLines.forEach((y, index) => {
        const x = index % 2 === 0 ? xMax : xMin;
        lines.push(`G1 X${formatNumber(x)} Y${formatNumber(y)} F${formatNumber(inputs.feedrate)}`);

        if (index < rasterLines.length - 1) {
          lines.push(`G1 X${formatNumber(x)} Y${formatNumber(rasterLines[index + 1])}`);
        }
      });
    } else {
      lines.push(`G0 X${formatNumber(rasterLines[0])} Y${formatNumber(yMin)}`);
      lines.push(`G1 Z${formatNumber(currentDepth)} F${formatNumber(plungeFeed)}`);

      rasterLines.forEach((x, index) => {
        const y = index % 2 === 0 ? yMax : yMin;
        lines.push(`G1 X${formatNumber(x)} Y${formatNumber(y)} F${formatNumber(inputs.feedrate)}`);

        if (index < rasterLines.length - 1) {
          lines.push(`G1 X${formatNumber(rasterLines[index + 1])} Y${formatNumber(y)}`);
        }
      });
    }
  }

  return lines;
}

function generateFooter(inputs) {
  return [
    '',
    `G0 Z${formatNumber(inputs.safeZ)}`,
    `G0 X${formatNumber(inputs.startX)} Y${formatNumber(inputs.startY)}`,
    '',
    'M5',
    '',
    'M30',
    '%'
  ];
}

function setStats(inputs) {
  const rasterPasses = buildRasterLines(inputs).length;
  const depthPasses = calculatePasses(inputs);
  const toolpathLengthMm = calculateToolpathLength(inputs);
  const machiningTime = estimateMachiningTime(toolpathLengthMm, inputs.feedrate);

  surfaceStatRasterPasses.textContent = rasterPasses.toLocaleString('en');
  surfaceStatDepthPasses.textContent = depthPasses.toLocaleString('en');
  surfaceStatToolpathLength.textContent = (toolpathLengthMm / 1000).toFixed(1);
  surfaceStatTime.textContent = formatDuration(machiningTime);
}

function clearStats() {
  surfaceStatRasterPasses.textContent = '-';
  surfaceStatDepthPasses.textContent = '-';
  surfaceStatToolpathLength.textContent = '-';
  surfaceStatTime.textContent = '-';
}

function generateGcode(event) {
  if (event) event.preventDefault();

  const inputs = getInputs();
  const errors = validateInputs(inputs);

  setValidationErrors(errors);

  if (errors.length) {
    latestGcode = '';
    latestInputs = null;
    surfaceGcodeOutput.value = '';
    surfaceDownloadButton.disabled = true;
    clearStats();
    return;
  }

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

surfaceForm.addEventListener('submit', generateGcode);
surfaceDownloadButton.addEventListener('click', downloadGcode);
