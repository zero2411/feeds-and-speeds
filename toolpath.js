const inpToolDiameter = document.getElementById('inp-tool-diameter');
const inpPocketWidth = document.getElementById('inp-pocket-width');
const inpPocketLength = document.getElementById('inp-pocket-length');
const inpStepover = document.getElementById('inp-stepover');
const inpFeedrate = document.getElementById('inp-feedrate');
const toolpathResults = document.getElementById('toolpath-results');

const outStepoverDistance = document.getElementById('out-stepover-distance');
const outPasses = document.getElementById('out-passes');
const outToolpathLength = document.getElementById('out-toolpath-length');
const outCutTime = document.getElementById('out-cut-time');

function updateToolpath() {
  const toolDiameter = parseFloat(inpToolDiameter.value);
  const pocketWidth = parseFloat(inpPocketWidth.value);
  const pocketLength = parseFloat(inpPocketLength.value);
  const stepoverPercent = parseFloat(inpStepover.value);
  const feedrate = parseFloat(inpFeedrate.value);

  if (
    isNaN(toolDiameter) || toolDiameter <= 0 ||
    isNaN(pocketWidth) || pocketWidth <= 0 ||
    isNaN(pocketLength) || pocketLength <= 0 ||
    isNaN(stepoverPercent) || stepoverPercent <= 0 ||
    isNaN(feedrate) || feedrate <= 0
  ) {
    toolpathResults.classList.remove('visible');
    return;
  }

  const stepoverDistance = toolDiameter * (stepoverPercent / 100);
  const passes = Math.ceil(Math.max(pocketWidth - toolDiameter, 0) / stepoverDistance) + 1;
  const toolpathLength = passes * pocketLength;
  const cutTime = toolpathLength / feedrate;

  outStepoverDistance.textContent = stepoverDistance.toFixed(2);
  outPasses.textContent = passes.toLocaleString('en');
  outToolpathLength.textContent = Math.round(toolpathLength).toLocaleString('en');
  outCutTime.textContent = cutTime.toFixed(1);

  toolpathResults.classList.add('visible');
}

[inpToolDiameter, inpPocketWidth, inpPocketLength, inpStepover, inpFeedrate].forEach(el => {
  el.addEventListener('input', updateToolpath);
  el.addEventListener('change', updateToolpath);
});
