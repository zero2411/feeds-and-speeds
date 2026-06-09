// ── Configuration Data ───────────────────────────────────────────────────────

// Machine profiles: DOC (depth of cut) and spindle speed index factors
// EVO = entry-level machines (lower DOC, slower speeds)
// PRO = mid-range machines (moderate DOC, standard speeds)
// FAB = high-end machines (full DOC, maximum speeds)
const MACHINES = {
  EVO: { doc: 0.5,  idx: 0.75 },
  PRO: { doc: 0.8,  idx: 0.90 },
  FAB: { doc: 1.0,  idx: 1.00 },
};

// Tool diameter columns supported by the chipload reference tables (mm)
const DIAMETERS = [2, 3, 4, 6, 8, 10];

// Safety factors: beginner uses conservative values (larger feed) for novices,
// advanced uses standard values for experienced operators
const BEGINNER_FACTOR = 1.00;
const ADVANCED_FACTOR = 1.00;

// Chipload tables per material. Loads correspond to DIAMETER columns.
// DOC adjustment accounts for material hardness (harder = shallower cuts recommended)
const CHIPLOAD = {
  'Hardwood':          { loads: [0.03, 0.06, 0.08, 0.10, 0.12, 0.14], doc: 0.9  },
  'Softwood/Plywood':  { loads: [0.04, 0.08, 0.10, 0.12, 0.14, 0.16], doc: 1.0  },
  'MDF/Particleboard': { loads: [0.05, 0.10, 0.12, 0.14, 0.17, 0.20], doc: 1.0  },
  'Soft Plastic':      { loads: [0.07, 0.13, 0.15, 0.20, 0.24, 0.28], doc: 0.8  },
  'Hard Plastic':      { loads: [0.05, 0.10, 0.12, 0.18, 0.20, 0.22], doc: 0.5  },
  'Aluminium':         { loads: [0.01, 0.025, 0.03, 0.04, 0.05, 0.06], doc: 0.25 },
};

// ── Helper Functions ──────────────────────────────────────────────────────────

// Interpolate chipload value for diameters between table entries
// Uses linear interpolation between adjacent diameter columns
function interpolateChipload(material, diameter) {
  const { loads } = CHIPLOAD[material];
  if (diameter <= DIAMETERS[0]) return loads[0];
  if (diameter >= DIAMETERS[DIAMETERS.length - 1]) return loads[loads.length - 1];
  for (let i = 0; i < DIAMETERS.length - 1; i++) {
    if (diameter >= DIAMETERS[i] && diameter <= DIAMETERS[i + 1]) {
      const t = (diameter - DIAMETERS[i]) / (DIAMETERS[i + 1] - DIAMETERS[i]);
      return loads[i] + t * (loads[i + 1] - loads[i]);
    }
  }
}

// Round spindle speeds/feed to nearest 100 RPM (Excel ROUND(x,-2) style)
// Ensures minimum 100 for positive values
function roundNearest100(x) {
  const rounded = Math.round(x / 100) * 100;
  return rounded < 100 && x > 0 ? 100 : rounded;
}

// Calculate feeds and speeds for a given configuration
// Returns spindle RPM, feed rate, max DOC, and chipload
function calculate(machine, diameter, flutes, material, factor, dampenFeed) {
  const m = MACHINES[machine];
  const baseChipload = interpolateChipload(material, diameter);
  const chipload = baseChipload * factor;
  // DampenFeed uses average flutes for reduced feed (beginner mode safety)
  const effectiveFlutes = dampenFeed ? (flutes + 1) / 2 : flutes;
  const docAdj = CHIPLOAD[material].doc;

  // Spindle speed based on material (soft = faster) and machine capability
  const spindleRaw = (22000 - baseChipload * 3 * 10000) * m.idx;
  const spindle = roundNearest100(Math.min(spindleRaw, 24000));

  // Feed rate: chipload × flutes × spindle (with machine scaling and feed damping)
  const feedRaw = chipload * effectiveFlutes * spindle * (dampenFeed ? m.idx : 1);
  const feed = roundNearest100(feedRaw);

  // Max DOC: machine limit × diameter × material adjustment
  const doc = m.doc * diameter * docAdj;

  return { spindle, feed, doc, chipload };
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

  // Calculate for both modes: beginner (dampened feed) and advanced (standard)
  const beg = calculate(machine, clampedDiam, flutes, material, BEGINNER_FACTOR, true);
  const adv = calculate(machine, clampedDiam, flutes, material, ADVANCED_FACTOR, false);

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

update();
