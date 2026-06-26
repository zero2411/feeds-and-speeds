(function () {
  const state = {
    editingId: '',
    materials: {}
  };

  const els = {
    add: document.getElementById('tool-add'),
    exportJson: document.getElementById('tool-export-json'),
    importJson: document.getElementById('tool-import-json'),
    importFile: document.getElementById('tool-import-file'),
    exportCsv: document.getElementById('tool-export-csv'),
    exportFusion: document.getElementById('tool-export-fusion'),
    exportVCarve: document.getElementById('tool-export-vcarve'),
    tbody: document.getElementById('tools-tbody'),
    empty: document.getElementById('tools-empty'),
    notice: document.getElementById('tools-notice'),
    filterToolType: document.getElementById('filter-tool-type'),
    filterGeometry: document.getElementById('filter-geometry'),
    filterUsage: document.getElementById('filter-usage'),
    editorCard: document.getElementById('tool-editor-card'),
    editorTitle: document.getElementById('tool-editor-title'),
    form: document.getElementById('tool-form'),
    errors: document.getElementById('tool-errors'),
    id: document.getElementById('tool-id'),
    name: document.getElementById('tool-name'),
    manufacturer: document.getElementById('tool-manufacturer'),
    machine: document.getElementById('tool-machine'),
    calculationMode: document.getElementById('tool-calculation-mode'),
    toolType: document.getElementById('tool-type'),
    geometry: document.getElementById('tool-geometry'),
    usage: document.getElementById('tool-usage'),
    surfacingField: document.getElementById('tool-surfacing-style-field'),
    surfacingStyle: document.getElementById('tool-surfacing-style'),
    diameter: document.getElementById('tool-diameter'),
    flutes: document.getElementById('tool-flutes'),
    shankDiameter: document.getElementById('tool-shank-diameter'),
    cuttingLength: document.getElementById('tool-cutting-length'),
    overallLength: document.getElementById('tool-overall-length'),
    units: document.getElementById('tool-units'),
    notes: document.getElementById('tool-notes'),
    cancel: document.getElementById('tool-cancel'),
    presetList: document.getElementById('preset-list')
  };

  function init() {
    fillSelect(els.filterToolType, ToolDB.TOOL_TYPES, 'All tool types');
    fillSelect(els.filterGeometry, ToolDB.GEOMETRY_TYPES, 'All geometries');
    fillSelect(els.filterUsage, ToolDB.USAGE_TYPES, 'All usage types');
    fillSelect(els.toolType, ToolDB.TOOL_TYPES);
    fillSelect(els.machine, ToolDB.MACHINE_TYPES);
    fillSelect(els.calculationMode, ToolDB.CALCULATION_MODES);
    fillSelect(els.geometry, ToolDB.GEOMETRY_TYPES);
    fillSelect(els.usage, ToolDB.USAGE_TYPES);
    fillSelect(els.surfacingStyle, ToolDB.SURFACING_STYLES);

    els.add.addEventListener('click', () => openEditor());
    els.cancel.addEventListener('click', closeEditor);
    els.form.addEventListener('submit', saveTool);
    toolPreviewFields().forEach((field) => {
      field.addEventListener('input', updateGeneratedPreview);
      field.addEventListener('change', updateGeneratedPreview);
    });
    els.filterToolType.addEventListener('change', renderTools);
    els.filterGeometry.addEventListener('change', renderTools);
    els.filterUsage.addEventListener('change', renderTools);
    els.tbody.addEventListener('click', handleToolAction);
    els.exportJson.addEventListener('click', exportJson);
    els.importJson.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', importJson);
    els.exportCsv.addEventListener('click', exportCsv);
    els.exportFusion.addEventListener('click', exportFusion);
    els.exportVCarve.addEventListener('click', exportVCarve);

    if (window.ToolExportVCarve && typeof ToolExportVCarve.preload === 'function') {
      ToolExportVCarve.preload().catch(() => {});
    }

    renderTools();
  }

  function fillSelect(select, options, emptyLabel) {
    select.innerHTML = '';
    if (emptyLabel) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyLabel;
      select.appendChild(option);
    }
    options.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function renderTools() {
    const tools = ToolDB.getAllTools().filter((tool) => {
      return (!els.filterToolType.value || tool.toolType === els.filterToolType.value)
        && (!els.filterGeometry.value || tool.geometry === els.filterGeometry.value)
        && (!els.filterUsage.value || tool.usage === els.filterUsage.value);
    });

    els.tbody.innerHTML = '';
    els.empty.hidden = tools.length !== 0;
    tools.forEach((tool) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(tool.name)}</strong><span class="tools-subtext">${escapeHtml(tool.manufacturer)}</span></td>
        <td>${formatNumber(tool.diameter)} ${escapeHtml(tool.units)}</td>
        <td>${tool.flutes}</td>
        <td>${escapeHtml(ToolDB.labelFor(ToolDB.TOOL_TYPES, tool.toolType))}</td>
        <td>${escapeHtml(ToolDB.labelFor(ToolDB.GEOMETRY_TYPES, tool.geometry))}</td>
        <td>${escapeHtml(ToolDB.labelFor(ToolDB.USAGE_TYPES, tool.usage))}</td>
        <td>${Object.keys(tool.materials || {}).length}<span class="tools-subtext">${escapeHtml(tool.machine)} · ${escapeHtml(ToolDB.labelFor(ToolDB.CALCULATION_MODES, tool.calculationMode))}</span></td>
        <td>
          <div class="tools-row-actions">
            <button type="button" data-action="edit" data-id="${tool.id}">Edit</button>
            <button type="button" data-action="duplicate" data-id="${tool.id}">Duplicate</button>
            <button type="button" data-action="delete" data-id="${tool.id}">Delete</button>
          </div>
        </td>
      `;
      els.tbody.appendChild(tr);
    });
  }

  function handleToolAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const tool = ToolDB.getTool(button.dataset.id);
    if (!tool) return;

    if (button.dataset.action === 'edit') openEditor(tool);
    if (button.dataset.action === 'duplicate') duplicateTool(tool);
    if (button.dataset.action === 'delete') deleteTool(tool);
  }

  function openEditor(tool) {
    const editing = Boolean(tool);
    state.editingId = editing ? tool.id : '';
    state.materials = editing ? clone(tool.materials || {}) : {};
    els.editorTitle.textContent = editing ? 'Edit Tool' : 'Add Tool';
    els.id.value = editing ? tool.id : '';
    els.name.value = editing ? tool.name : '';
    els.manufacturer.value = editing ? tool.manufacturer : '';
    els.machine.value = editing ? (tool.machine || 'PRO') : 'PRO';
    els.calculationMode.value = editing ? (tool.calculationMode || 'advanced') : 'advanced';
    els.toolType.value = editing ? tool.toolType : 'endmill';
    els.geometry.value = editing ? tool.geometry : 'upcut';
    els.usage.value = editing ? tool.usage : 'general';
    els.surfacingStyle.value = editing ? (tool.surfacingStyle || 'spoilboard') : 'spoilboard';
    els.diameter.value = editing ? tool.diameter : '';
    els.flutes.value = editing ? tool.flutes : '2';
    els.shankDiameter.value = editing ? tool.shankDiameter : '';
    els.cuttingLength.value = editing ? tool.cuttingLength : '';
    els.overallLength.value = editing ? tool.overallLength : '';
    els.units.value = editing ? tool.units : 'mm';
    els.notes.value = editing ? tool.notes : '';
    setErrors([]);
    updateGeneratedPreview();
    els.editorCard.hidden = false;
    els.editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    els.editorCard.hidden = true;
    state.editingId = '';
    state.materials = {};
    setErrors([]);
  }

  function updateGeneratedPreview() {
    els.surfacingField.hidden = els.toolType.value !== 'surfacing';
    const data = collectToolData(false);
    els.name.value = ToolDB.generateToolName(data);
    state.materials = ToolDB.generateMaterialPresets(data);
    renderPresets();
  }

  function saveTool(event) {
    event.preventDefault();
    const data = collectToolData(true);
    try {
      if (state.editingId) {
        ToolDB.updateTool(state.editingId, data);
        showNotice('Tool updated.');
      } else {
        ToolDB.createTool(data);
        showNotice('Tool saved.');
      }
      closeEditor();
      renderTools();
    } catch (error) {
      setErrors([error.message]);
    }
  }

  function collectToolData(generatePresets) {
    return {
      manufacturer: els.manufacturer.value,
      machine: els.machine.value,
      calculationMode: els.calculationMode.value,
      toolType: els.toolType.value,
      geometry: els.geometry.value,
      usage: els.usage.value,
      surfacingStyle: els.surfacingStyle.value,
      diameter: els.diameter.value,
      flutes: els.flutes.value,
      shankDiameter: els.shankDiameter.value,
      cuttingLength: els.cuttingLength.value,
      overallLength: els.overallLength.value,
      units: els.units.value,
      notes: els.notes.value,
      materials: clone(state.materials),
      generatePresets: Boolean(generatePresets)
    };
  }

  function duplicateTool(tool) {
    const copy = clone(tool);
    delete copy.id;
    copy.nameSuffix = nextCopySuffix(tool.name);
    copy.generatePresets = true;
    try {
      ToolDB.createTool(copy);
      showNotice('Tool duplicated.');
      renderTools();
    } catch (error) {
      showNotice(error.message, true);
    }
  }

  function deleteTool(tool) {
    if (!window.confirm(`Delete "${tool.name}"?`)) return;
    ToolDB.deleteTool(tool.id);
    showNotice('Tool deleted.');
    renderTools();
    if (state.editingId === tool.id) closeEditor();
  }

  function renderPresets() {
    const materials = Object.keys(state.materials);
    if (!materials.length) {
      els.presetList.innerHTML = '<div class="tools-empty small">Enter a diameter and flute count to preview generated presets.</div>';
      return;
    }
    els.presetList.innerHTML = `
      <div class="table-overflow tools-preset-preview">
        <table class="tools-table">
          <thead>
            <tr>
              <th>Material <span class="surface-info" tabindex="0" aria-label="Workpiece material for this generated preset.">i</span></th>
              <th>RPM <span class="surface-info" tabindex="0" aria-label="Generated spindle speed for this material.">i</span></th>
              <th>Feedrate <span class="surface-info" tabindex="0" aria-label="Generated cutting feedrate in millimeters per minute.">i</span></th>
              <th>Plungerate <span class="surface-info" tabindex="0" aria-label="Generated plunge feedrate, derived as half of feedrate.">i</span></th>
              <th>DOC <span class="surface-info" tabindex="0" aria-label="Generated maximum depth of cut in millimeters.">i</span></th>
              <th>Stepover <span class="surface-info" tabindex="0" aria-label="Generated radial stepover percentage. Surfacing tools use a wider default.">i</span></th>
              <th>Chipload <span class="surface-info" tabindex="0" aria-label="Generated chipload in millimeters per tooth.">i</span></th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((material) => {
              const preset = state.materials[material];
              return `
                <tr>
                  <td>${escapeHtml(material)}</td>
                  <td>${formatMaybe(preset.rpm)}</td>
                  <td>${formatMaybe(preset.feedrate)}</td>
                  <td>${formatMaybe(preset.plungerate)}</td>
                  <td>${formatMaybe(preset.depthOfCut)}</td>
                  <td>${formatMaybe(preset.stepover)}%</td>
                  <td>${formatMaybe(preset.chipload)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function exportJson() {
    downloadFile('cnc-tool-database.json', JSON.stringify(ToolDB.loadToolDatabase(), null, 2), 'application/json');
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const db = JSON.parse(reader.result);
        if (!db || !Array.isArray(db.tools)) throw new Error('Backup must contain a tools array.');
        db.tools.map(ToolDB.normalizeTool).forEach(ToolDB.validateTool);
        ToolDB.saveToolDatabase(db);
        renderTools();
        showNotice('JSON backup imported.');
      } catch (error) {
        showNotice(`Import failed: ${error.message}`, true);
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file);
  }

  function exportCsv() {
    const rows = [['Name', 'Manufacturer', 'CNC Machine', 'Calculation Mode', 'Diameter', 'Flutes', 'Tool Type', 'Geometry', 'Usage', 'Material', 'RPM', 'Feedrate', 'Plungerate', 'Depth Of Cut', 'Stepover', 'Chipload']];
    ToolDB.getAllTools().forEach((tool) => {
      const entries = Object.entries(tool.materials || {});
      const materialRows = entries.length ? entries : [['', {}]];
      materialRows.forEach(([material, preset]) => {
        rows.push([tool.name, tool.manufacturer, tool.machine, tool.calculationMode, tool.diameter, tool.flutes, tool.toolType, tool.geometry, tool.usage, material, preset.rpm, preset.feedrate, preset.plungerate, preset.depthOfCut, preset.stepover, preset.chipload]);
      });
    });
    downloadFile('cnc-tool-database.csv', rows.map(row => row.map(csvCell).join(',')).join('\n'), 'text/csv');
  }

  function exportFusion() {
    try {
      const file = ToolExportFusion360.exportTools(ToolDB.getAllTools());
      downloadFile(file.filename, file.content, file.mimeType);
    } catch (error) {
      showNotice(`Fusion 360 export failed: ${error.message}`, true);
    }
  }

  async function exportVCarve() {
    els.exportVCarve.disabled = true;
    showNotice('Preparing VCarve export...');
    try {
      const file = await ToolExportVCarve.exportTools(ToolDB.getAllTools());
      downloadFile(file.filename, file.content, file.mimeType);
      showNotice(file.message || 'VCarve export created.');
    } catch (error) {
      showNotice(`VCarve export failed: ${error.message}`, true);
    } finally {
      els.exportVCarve.disabled = false;
    }
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function showNotice(message, isError) {
    els.notice.textContent = message;
    els.notice.classList.toggle('error', Boolean(isError));
    els.notice.hidden = false;
    window.setTimeout(() => {
      els.notice.hidden = true;
    }, 3500);
  }

  function setErrors(errors) {
    if (!errors.length) {
      els.errors.hidden = true;
      els.errors.innerHTML = '';
      return;
    }
    els.errors.innerHTML = `<ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`;
    els.errors.hidden = false;
  }

  function formatNumber(value) {
    return value === '' ? '-' : Number(value).toLocaleString('en', { maximumFractionDigits: 3 });
  }

  function formatMaybe(value) {
    return value === '' || value === undefined ? '-' : value;
  }

  function toolPreviewFields() {
    return [
      els.manufacturer,
      els.machine,
      els.calculationMode,
      els.toolType,
      els.geometry,
      els.surfacingStyle,
      els.diameter,
      els.flutes,
      els.units
    ];
  }

  function nextCopySuffix(baseName) {
    const names = ToolDB.getAllTools().map(tool => tool.name);
    let index = 1;
    let suffix = 'Copy';
    while (names.includes(`${baseName} ${suffix}`)) {
      index += 1;
      suffix = `Copy ${index}`;
    }
    return suffix;
  }

  function csvCell(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  init();
}());
