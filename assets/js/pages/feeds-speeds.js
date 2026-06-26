// ── Configuration Data ───────────────────────────────────────────────────────

// Machine profiles: DOC (depth of cut) and spindle speed index factors
// EVO = entry-level machines (lower DOC, slower speeds)
// PRO = mid-range machines (moderate DOC, standard speeds)
// FAB = high-end machines (full DOC, maximum speeds)
const { MACHINES, DIAMETERS, BEGINNER_FACTOR, ADVANCED_FACTOR, CHIPLOAD } = window.CncCalc;

// Tool diameter columns supported by the chipload reference tables (mm)
// ── Helper Functions ──────────────────────────────────────────────────────────

// Interpolate chipload value for diameters between table entries
// Uses linear interpolation between adjacent diameter columns
function interpolateChipload(material, diameter) {
  return window.CncCalc.interpolateChipload(material, diameter);
}

// Round spindle speeds/feed to nearest 100 RPM (Excel ROUND(x,-2) style)
// Ensures minimum 100 for positive values
function roundNearest100(x) {
  return window.CncCalc.roundNearest100(x);
}

// Calculate feeds and speeds for a given configuration
// Returns spindle RPM, feed rate, max DOC, and chipload
function calculate(machine, diameter, flutes, material, factor, dampenFeed) {
  return window.CncCalc.calculate(machine, diameter, flutes, material, factor, dampenFeed);
}

// Find index of nearest diameter column for table highlighting
function nearestDiameterIndex(tableColumns, diameter) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < tableColumns.length; i++) {
    const dist = Math.abs(tableColumns[i] - diameter);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

// ── DOM References ───────────────────────────────────────────────────────────

// Input controls
const inpMachine  = document.getElementById('inp-machine');
const inpDiam     = document.getElementById('inp-diameter');
const inpFlutes   = document.getElementById('inp-flutes');
const inpMaterial = document.getElementById('inp-material');
const toolSelect  = document.getElementById('tool-select');
const toolPresetField = document.getElementById('tool-preset-field');
const toolPresetSelect = document.getElementById('tool-preset-select');
const toolClear = document.getElementById('tool-clear');
const resultsArea = document.getElementById('results-area');
const diamNote    = document.getElementById('diameter-range-note');

// Beginner panel outputs
const outSpindleBeg  = document.getElementById('out-spindle-beg');
const outFeedBeg     = document.getElementById('out-feed-beg');
const outDocBeg      = document.getElementById('out-doc-beg');
const chiploNoteBeg  = document.getElementById('chipload-note-beg');
const feedWarningBeg = document.getElementById('feed-warning-beg');
const rcFeedBeg      = document.getElementById('rc-feed-beg');

// Advanced panel outputs
const outSpindleAdv  = document.getElementById('out-spindle-adv');
const outFeedAdv     = document.getElementById('out-feed-adv');
const outDocAdv      = document.getElementById('out-doc-adv');
const chiploNoteAdv  = document.getElementById('chipload-note-adv');
const feedWarningAdv = document.getElementById('feed-warning-adv');
const rcFeedAdv      = document.getElementById('rc-feed-adv');

const begTbl = document.getElementById('tbl-beginner');
const advTbl = document.getElementById('tbl-advanced');

const BEG_COLS = DIAMETERS;
const ADV_COLS = DIAMETERS;
let selectedTool = null;
let selectedPresetMaterial = '';

// ── Table Highlighting ───────────────────────────────────────────────────────

// Remove all highlight classes from table cells/rows
function clearHighlights(table) {
  table.querySelectorAll('.hl-cell, .hl-row-material').forEach(el => {
    el.classList.remove('hl-cell', 'hl-row-material');
  });
}

// Highlight the active material row and nearest diameter column in the reference table
function highlightTable(table, material, diameter, colDiameters) {
  clearHighlights(table);
  if (!material || !diameter) return;

  const colIdx = nearestDiameterIndex(colDiameters, diameter);

  table.querySelectorAll('tbody tr').forEach(row => {
    const rowMaterial = row.dataset.material;
    const cells = row.querySelectorAll('td');

    if (rowMaterial === material) {
      // Highlight the entire material row
      cells[0].classList.add('hl-row-material');
      // Highlight the cell at the nearest diameter column
      cells.forEach(cell => {
        if (parseInt(cell.dataset.d) === colDiameters[colIdx]) {
          cell.classList.add('hl-cell');
        }
      });
    }
  });
}

// ── Table Renderer ────────────────────────────────────────────────────────────

// Build the beginner and advanced chipload reference tables dynamically
// Creates diameter columns and populates with scaled chipload values
function renderTables() {
  const tables = [
    { el: begTbl, factor: BEGINNER_FACTOR },
    { el: advTbl, factor: ADVANCED_FACTOR },
  ];

  tables.forEach(({ el, factor }) => {
    // Build header row with diameter columns
    const headRow = el.tHead.rows[0];
    headRow.innerHTML = '<th>Material</th>';
    DIAMETERS.forEach(d => {
      const th = document.createElement('th');
      th.textContent = d + 'mm';
      headRow.appendChild(th);
    });

    // Populate body with material rows and chipload values
    const tbody = el.tBodies[0];
    tbody.innerHTML = '';
    Object.entries(CHIPLOAD).forEach(([material, { loads }]) => {
      const tr = document.createElement('tr');
      tr.dataset.material = material;

      const nameTd = document.createElement('td');
      nameTd.textContent = material;
      tr.appendChild(nameTd);

      DIAMETERS.forEach((d, i) => {
        const td = document.createElement('td');
        td.dataset.d = String(d);
        td.textContent = (loads[i] * factor).toFixed(3);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  });
}

// ── Main Update ───────────────────────────────────────────────────────────────

// Recalculate and display feeds/speeds for current input values
// Updates both panels and highlights reference tables
function update() {
  const machine  = inpMachine.value;
  const diameter = parseFloat(inpDiam.value);
  const flutes   = parseInt(inpFlutes.value, 10);
  const material = inpMaterial.value;

  // Show note if diameter is outside recommended range
  const diamOutOfRange = diameter && (diameter < 2 || diameter > 10);
  diamNote.classList.toggle('visible', diamOutOfRange);

  // Validate inputs - hide results if incomplete/invalid
  if (!machine || !inpDiam.value || isNaN(diameter) || diameter <= 0 || isNaN(flutes) || !material) {
    resultsArea.classList.remove('visible');
    clearHighlights(begTbl);
    clearHighlights(advTbl);
    return;
  }

  // Clamp diameter to table range for lookup
  const clampedDiam = Math.max(DIAMETERS[0], Math.min(DIAMETERS[DIAMETERS.length - 1], diameter));

  const preset = getSelectedPreset(material);
  const calculatedBeg = calculate(machine, clampedDiam, flutes, material, BEGINNER_FACTOR, true);
  const calculatedAdv = calculate(machine, clampedDiam, flutes, material, ADVANCED_FACTOR, false);
  const beg = preset ? applyPresetToResult(calculatedBeg, preset) : calculatedBeg;
  const adv = preset ? applyPresetToResult(calculatedAdv, preset) : calculatedAdv;

  // Update beginner panel outputs
  outSpindleBeg.textContent = beg.spindle.toLocaleString('en');
  outFeedBeg.textContent    = beg.feed.toLocaleString('en');
  outDocBeg.textContent     = beg.doc.toFixed(2);
  feedWarningBeg.classList.toggle('visible', beg.feed > 7000);
  rcFeedBeg.classList.toggle('has-warning', beg.feed > 7000);
  chiploNoteBeg.textContent = `Chip load: ${beg.chipload.toFixed(4)} mm/tooth at ⌀${diameter} mm`;

  // Update advanced panel outputs
  outSpindleAdv.textContent = adv.spindle.toLocaleString('en');
  outFeedAdv.textContent    = adv.feed.toLocaleString('en');
  outDocAdv.textContent     = adv.doc.toFixed(2);
  feedWarningAdv.classList.toggle('visible', adv.feed > 7000);
  rcFeedAdv.classList.toggle('has-warning', adv.feed > 7000);
  chiploNoteAdv.textContent = `Chip load: ${adv.chipload.toFixed(4)} mm/tooth at ⌀${diameter} mm`;

  resultsArea.classList.add('visible');

  highlightTable(begTbl, material, diameter, BEG_COLS);
  highlightTable(advTbl, material, diameter, ADV_COLS);
}

// ── Tool Database Integration ────────────────────────────────────────────────

function populateToolSelector() {
  if (!window.ToolDB || !toolSelect) return;
  const tools = ToolDB.getAllTools();
  toolSelect.innerHTML = '<option value="">— select —</option>';
  tools.forEach((tool) => {
    const option = document.createElement('option');
    option.value = tool.id;
    option.textContent = `${tool.name} (${formatToolDiameter(tool)})`;
    toolSelect.appendChild(option);
  });
}

function populatePresetSelector(tool) {
  const materials = Object.keys((tool && tool.materials) || {});
  toolPresetSelect.innerHTML = '<option value="">— select —</option>';
  materials.forEach((material) => {
    const option = document.createElement('option');
    option.value = material;
    option.textContent = material;
    toolPresetSelect.appendChild(option);
  });
  toolPresetField.hidden = materials.length === 0;
}

function selectTool(toolId) {
  selectedTool = window.ToolDB && toolId ? ToolDB.getTool(toolId) : null;
  selectedPresetMaterial = '';
  toolPresetSelect.value = '';
  if (!selectedTool) {
    populatePresetSelector(null);
    update();
    return;
  }
  inpMachine.value = selectedTool.machine || inpMachine.value;
  inpDiam.value = selectedTool.diameter;
  inpFlutes.value = selectedTool.flutes;
  persistField(inpMachine, 'machine');
  persistField(inpDiam, 'diameter');
  persistField(inpFlutes, 'flutes');
  populatePresetSelector(selectedTool);
  update();
}

function selectPreset(material) {
  selectedPresetMaterial = material;
  if (material) {
    inpMaterial.value = material;
    persistField(inpMaterial, 'material');
  }
  update();
}

function clearSelectedTool() {
  selectedTool = null;
  selectedPresetMaterial = '';
  toolSelect.value = '';
  toolPresetSelect.value = '';
  populatePresetSelector(null);
  update();
}

function getSelectedPreset(material) {
  if (!selectedTool || !selectedPresetMaterial || selectedPresetMaterial !== material) return null;
  return selectedTool.materials[selectedPresetMaterial] || null;
}

function applyPresetToResult(result, preset) {
  return {
    spindle: preset.rpm || result.spindle,
    feed: preset.feedrate || result.feed,
    doc: preset.depthOfCut || result.doc,
    chipload: preset.chipload || result.chipload
  };
}

function formatToolDiameter(tool) {
  return `${tool.diameter}${tool.units || 'mm'}`;
}

function persistField(el, key) {
  localStorage.setItem(key, el.value);
}

// ── Initialization ────────────────────────────────────────────────────────────

// Build tables on load and wire up input change handlers
renderTables();

const fields = [
  { el: inpMachine,  key: 'machine'  },
  { el: inpDiam,     key: 'diameter' },
  { el: inpFlutes,   key: 'flutes'   },
  { el: inpMaterial, key: 'material' },
];

fields.forEach(({ el, key }) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) el.value = saved;
  el.addEventListener('input', () => {
    localStorage.setItem(key, el.value);
    update();
  });
  el.addEventListener('change', () => {
    localStorage.setItem(key, el.value);
    update();
  });
});

populateToolSelector();
if (toolSelect) {
  toolSelect.addEventListener('change', () => selectTool(toolSelect.value));
  toolPresetSelect.addEventListener('change', () => selectPreset(toolPresetSelect.value));
  toolClear.addEventListener('click', clearSelectedTool);
}

update();
