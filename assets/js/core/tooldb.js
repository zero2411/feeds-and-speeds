(function () {
  const STORAGE_KEY = 'cnc-tool-database';
  const DATABASE_VERSION = 2;

  const TOOL_TYPES = [
    { value: 'endmill', label: 'End Mill' },
    { value: 'ballnose', label: 'Ball Nose' },
    { value: 'vbit', label: 'V-Bit' },
    { value: 'surfacing', label: 'Surfacing Cutter' },
    { value: 'drill', label: 'Drill' },
    { value: 'engraving', label: 'Engraving Bit' },
    { value: 'other', label: 'Other' }
  ];

  const GEOMETRY_TYPES = [
    { value: 'upcut', label: 'Upcut' },
    { value: 'downcut', label: 'Downcut' },
    { value: 'compression', label: 'Compression' },
    { value: 'straight', label: 'Straight' },
    { value: 'spiral', label: 'Spiral' },
    { value: 'insert', label: 'Insert' },
    { value: 'other', label: 'Other' }
  ];

  const USAGE_TYPES = [
    { value: 'roughing', label: 'Roughing' },
    { value: 'finishing', label: 'Finishing' },
    { value: 'adaptive', label: 'Adaptive' },
    { value: 'profiling', label: 'Profiling' },
    { value: 'pocketing', label: 'Pocketing' },
    { value: 'surfacing', label: 'Surfacing' },
    { value: 'general', label: 'General' }
  ];

  const SURFACING_STYLES = [
    { value: 'spoilboard', label: 'Spoilboard Cutter' },
    { value: 'flycutter', label: 'Fly Cutter' },
    { value: 'insert', label: 'Insert Surfacer' },
    { value: 'bowl', label: 'Bowl/Tray Bit' },
    { value: 'other', label: 'Other' }
  ];

  const MATERIALS = [
    'Hardwood',
    'Softwood/Plywood',
    'MDF/Particleboard',
    'Soft Plastic',
    'Hard Plastic',
    'Aluminium'
  ];

  const MACHINE_TYPES = (window.CncCalc && window.CncCalc.MACHINE_OPTIONS) || [
    { value: 'EVO', label: 'EVO' },
    { value: 'PRO', label: 'PRO' },
    { value: 'FAB', label: 'FAB' }
  ];

  const CALCULATION_MODES = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'advanced', label: 'Advanced' }
  ];

  function createEmptyDatabase() {
    return {
      version: DATABASE_VERSION,
      lastUpdated: new Date().toISOString(),
      tools: []
    };
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadToolDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyDatabase();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tools)) return createEmptyDatabase();
      return {
        version: Number(parsed.version) || DATABASE_VERSION,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        tools: parsed.tools.map(normalizeTool)
      };
    } catch (error) {
      return createEmptyDatabase();
    }
  }

  function saveToolDatabase(db) {
    const normalized = {
      version: DATABASE_VERSION,
      lastUpdated: new Date().toISOString(),
      tools: Array.isArray(db.tools) ? db.tools.map(normalizeTool) : []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function createTool(data) {
    const db = loadToolDatabase();
    const tool = normalizeTool({
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString()
    });
    validateGeneratedPresets(tool, data.generatePresets);
    validateTool(tool);
    db.tools.push(tool);
    saveToolDatabase(db);
    return tool;
  }

  function updateTool(id, data) {
    const db = loadToolDatabase();
    const index = db.tools.findIndex(tool => tool.id === id);
    if (index === -1) throw new Error('Tool not found.');
    const updated = normalizeTool({
      ...db.tools[index],
      ...data,
      id,
      updatedAt: new Date().toISOString()
    });
    validateGeneratedPresets(updated, data.generatePresets);
    validateTool(updated);
    db.tools[index] = updated;
    saveToolDatabase(db);
    return updated;
  }

  function deleteTool(id) {
    const db = loadToolDatabase();
    const nextTools = db.tools.filter(tool => tool.id !== id);
    if (nextTools.length === db.tools.length) return false;
    db.tools = nextTools;
    saveToolDatabase(db);
    return true;
  }

  function getTool(id) {
    return loadToolDatabase().tools.find(tool => tool.id === id) || null;
  }

  function getAllTools() {
    return loadToolDatabase().tools;
  }

  function validateTool(tool) {
    const errors = [];
    if (!tool.name) errors.push('Generated name could not be created.');
    if (!includesValue(MACHINE_TYPES, tool.machine)) errors.push('CNC machine is required.');
    if (!includesValue(CALCULATION_MODES, tool.calculationMode)) errors.push('Calculation mode is required.');
    if (!includesValue(TOOL_TYPES, tool.toolType)) errors.push('Tool type is required.');
    if (!includesValue(GEOMETRY_TYPES, tool.geometry)) errors.push('Geometry is required.');
    if (!includesValue(USAGE_TYPES, tool.usage)) errors.push('Usage is required.');
    if (!isPositive(tool.diameter)) errors.push('Diameter must be greater than 0.');
    if (!Number.isInteger(Number(tool.flutes)) || Number(tool.flutes) < 1) errors.push('Flutes must be at least 1.');
    Object.values(tool.materials || {}).forEach(validateMaterialPreset);
    if (errors.length) throw new Error(errors.join(' '));
    return true;
  }

  function validateMaterialPreset(preset) {
    const numericFields = ['rpm', 'feedrate', 'plungerate', 'depthOfCut', 'stepover', 'chipload'];
    numericFields.forEach((field) => {
      const value = preset[field];
      if (value !== '' && value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        throw new Error(`${field} must be zero or greater.`);
      }
    });
    return true;
  }

  function validateGeneratedPresets(tool, generatePresets) {
    if (!generatePresets) return true;
    const missing = MATERIALS.filter(material => !tool.materials[material]);
    if (missing.length) throw new Error(`Generated presets are missing for: ${missing.join(', ')}.`);
    return true;
  }

  function normalizeTool(data) {
    const normalizedBase = {
      id: data.id || generateId(),
      manufacturer: stringValue(data.manufacturer),
      nameSuffix: stringValue(data.nameSuffix),
      machine: data.machine || 'PRO',
      calculationMode: data.calculationMode || 'advanced',
      toolType: data.toolType || 'endmill',
      geometry: data.geometry || 'upcut',
      usage: data.usage || 'general',
      surfacingStyle: data.toolType === 'surfacing' ? stringValue(data.surfacingStyle || 'spoilboard') : '',
      diameter: numberOrBlank(data.diameter),
      flutes: Number.parseInt(data.flutes, 10) || 1,
      shankDiameter: numberOrBlank(data.shankDiameter),
      cuttingLength: numberOrBlank(data.cuttingLength),
      overallLength: numberOrBlank(data.overallLength),
      units: data.units || 'mm',
      notes: stringValue(data.notes),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || ''
    };
    const materials = {};
    const generatedMaterials = data.generatePresets ? generateMaterialPresets(normalizedBase) : null;
    Object.entries(generatedMaterials || data.materials || {}).forEach(([material, preset]) => {
      if (MATERIALS.includes(material)) materials[material] = normalizePreset(preset);
    });

    return {
      ...normalizedBase,
      name: generateToolName(normalizedBase),
      materials,
    };
  }

  function generateToolName(tool) {
    const diameter = numberOrBlank(tool.diameter);
    const unit = tool.units || 'mm';
    const diameterPart = diameter === '' ? '' : `${formatCompactNumber(diameter)}${unit}`;
    const flutes = Number.parseInt(tool.flutes, 10) || 1;
    const manufacturer = stringValue(tool.manufacturer);
    const typeLabel = labelFor(TOOL_TYPES, tool.toolType);
    const geometryLabel = labelFor(GEOMETRY_TYPES, tool.geometry);
    const surfacingLabel = labelFor(SURFACING_STYLES, tool.surfacingStyle);
    const descriptor = tool.toolType === 'surfacing'
      ? surfacingLabel || typeLabel
      : `${geometryLabel} ${typeLabel}`.trim();
    const generated = [diameterPart, `${flutes}F`, descriptor].filter(Boolean).join(' ');
    const baseName = [manufacturer, generated || typeLabel || 'Tool'].filter(Boolean).join(' - ');
    return [baseName, stringValue(tool.nameSuffix)].filter(Boolean).join(' ');
  }

  function generateMaterialPresets(tool) {
    const diameter = Number(tool.diameter);
    const flutes = Number.parseInt(tool.flutes, 10);
    if (!window.CncCalc || !Number.isFinite(diameter) || diameter <= 0 || !Number.isInteger(flutes) || flutes < 1) {
      return {};
    }
    const clampedDiameter = Math.max(
      window.CncCalc.DIAMETERS[0],
      Math.min(window.CncCalc.DIAMETERS[window.CncCalc.DIAMETERS.length - 1], diameter)
    );
    return MATERIALS.reduce((presets, material) => {
      const result = window.CncCalc.calculateMode(tool.machine || 'PRO', clampedDiameter, flutes, material, tool.calculationMode || 'advanced');
      presets[material] = {
        rpm: result.spindle,
        feedrate: result.feed,
        plungerate: window.CncCalc.roundNearest100(result.feed * 0.5),
        depthOfCut: roundTo(result.doc, 3),
        stepover: defaultStepover(tool.toolType),
        chipload: roundTo(result.chipload, 4)
      };
      return presets;
    }, {});
  }

  function defaultStepover(toolType) {
    return toolType === 'surfacing' ? 60 : 40;
  }

  function formatCompactNumber(value) {
    return Number(value).toLocaleString('en', { maximumFractionDigits: 3 });
  }

  function roundTo(value, places) {
    const multiplier = 10 ** places;
    return Math.round(Number(value) * multiplier) / multiplier;
  }

  function normalizePreset(preset) {
    return {
      rpm: numberOrBlank(preset.rpm),
      feedrate: numberOrBlank(preset.feedrate),
      plungerate: numberOrBlank(preset.plungerate),
      depthOfCut: numberOrBlank(preset.depthOfCut),
      stepover: numberOrBlank(preset.stepover),
      chipload: numberOrBlank(preset.chipload)
    };
  }

  function numberOrBlank(value) {
    if (value === '' || value === null || value === undefined) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number : '';
  }

  function stringValue(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function isPositive(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function includesValue(list, value) {
    return list.some(item => item.value === value);
  }

  function labelFor(list, value) {
    return (list.find(item => item.value === value) || {}).label || value || '';
  }

  window.ToolDB = {
    STORAGE_KEY,
    TOOL_TYPES,
    GEOMETRY_TYPES,
    USAGE_TYPES,
    SURFACING_STYLES,
    MATERIALS,
    MACHINE_TYPES,
    CALCULATION_MODES,
    createEmptyDatabase,
    loadToolDatabase,
    saveToolDatabase,
    createTool,
    updateTool,
    deleteTool,
    getTool,
    getAllTools,
    validateTool,
    validateMaterialPreset,
    normalizeTool,
    generateToolName,
    generateMaterialPresets,
    labelFor
  };
}());
