(function () {
  function exportTools(tools) {
    const now = Date.now();
    return {
      filename: 'cnc-tool-database.tools',
      mimeType: 'application/json',
      content: JSON.stringify({
        version: 36,
        data: tools.map((tool, index) => fusionTool(tool, index + 1, now))
      }, null, 2)
    };
  }

  function fusionTool(tool, number, timestamp) {
    const diameter = numberOrZero(tool.diameter);
    const flutes = Number.parseInt(tool.flutes, 10) || 1;
    const shankDiameter = numberOrZero(tool.shankDiameter) || diameter;
    const fluteLength = numberOrZero(tool.cuttingLength) || diameter * 3;
    const overallLength = numberOrZero(tool.overallLength) || fluteLength * 2.5;
    const bodyLength = Math.max(fluteLength, overallLength - shankDiameter * 2);
    const productId = tool.id || '';
    const unit = fusionUnit(tool.units);

    return {
      BMC: 'carbide',
      description: tool.name,
      expressions: {
        tool_bodyLength: `${formatFusionNumber(bodyLength)} mm`,
        tool_description: quotedExpression(tool.name),
        tool_diameter: `${formatFusionNumber(diameter)} mm`,
        tool_fluteLength: `${formatFusionNumber(fluteLength)} mm`,
        tool_number: String(number),
        tool_overallLength: `${formatFusionNumber(overallLength)} mm`,
        tool_productId: quotedExpression(productId),
        tool_productLink: "''",
        tool_shaftDiameter: `${formatFusionNumber(shankDiameter)} mm`,
        tool_shoulderLength: `${formatFusionNumber(fluteLength)} mm`,
        tool_unit: quotedExpression(unit)
      },
      geometry: {
        CSP: false,
        DC: diameter,
        HAND: true,
        LB: bodyLength,
        LCF: fluteLength,
        NOF: flutes,
        OAL: overallLength,
        SFDM: shankDiameter,
        assemblyGaugeLength: bodyLength,
        'shoulder-diameter': shankDiameter,
        'shoulder-length': fluteLength
      },
      guid: tool.id,
      last_modified: timestamp,
      'post-process': {
        'break-control': false,
        comment: '',
        'diameter-offset': number,
        'length-offset': number,
        live: true,
        'manual-tool-change': false,
        number,
        turret: 0
      },
      'product-id': productId,
      'product-link': '',
      reference_guid: generateFusionGuid(),
      'start-values': {
        presets: Object.entries(tool.materials || {}).map(([material, preset]) => fusionPreset(tool, material, preset))
      },
      type: fusionToolType(tool),
      unit,
      vendor: tool.manufacturer || ''
    };
  }

  function fusionPreset(tool, material, preset) {
    const diameter = numberOrZero(tool.diameter);
    const flutes = Number.parseInt(tool.flutes, 10) || 1;
    const rpm = numberOrZero(preset.rpm);
    const feedrate = numberOrZero(preset.feedrate);
    const plungerate = numberOrZero(preset.plungerate) || feedrate;
    const stepdown = numberOrZero(preset.depthOfCut);
    const stepover = diameter * (numberOrZero(preset.stepover) / 100);
    const chipload = rpm > 0 && flutes > 0 ? feedrate / (rpm * flutes) : numberOrZero(preset.chipload);
    const plungePerRev = rpm > 0 ? plungerate / rpm : 0;
    const surfaceSpeed = diameter > 0 && rpm > 0 ? Math.PI * diameter * rpm / 1000 : 0;

    return {
      expressions: {
        tool_coolant: "'air'",
        tool_feedCutting: `${formatFusionNumber(feedrate)} mmpm`,
        tool_feedPlunge: `${formatFusionNumber(plungerate)} mmpm`,
        tool_feedRamp: `${formatFusionNumber(plungerate)} mmpm`,
        tool_spindleSpeed: `${formatFusionNumber(rpm)} rpm`,
        tool_stepdown: `${formatFusionNumber(stepdown)} mm`,
        tool_stepover: `${formatFusionNumber(stepover)} mm`
      },
      f_n: plungePerRev,
      f_z: chipload,
      guid: generateFusionGuid(),
      material: {
        category: 'all',
        query: '',
        'use-hardness': false
      },
      n: rpm,
      n_ramp: rpm,
      name: material || 'default',
      'ramp-angle': 2,
      stepdown,
      stepover,
      'tool-coolant': 'air',
      'use-stepdown': true,
      'use-stepover': true,
      v_c: surfaceSpeed,
      v_f: feedrate,
      v_f_leadIn: feedrate,
      v_f_leadOut: feedrate,
      v_f_plunge: plungerate,
      v_f_ramp: plungerate,
      v_f_transition: feedrate
    };
  }

  function fusionToolType(tool) {
    if (tool.toolType === 'ballnose') return 'ball end mill';
    if (tool.toolType === 'vbit' || tool.toolType === 'engraving') return 'chamfer mill';
    if (tool.toolType === 'drill') return 'drill';
    return 'flat end mill';
  }

  function fusionUnit(unit) {
    return unit === 'in' ? 'inches' : 'millimeters';
  }

  function quotedExpression(value) {
    return `'${String(value || '').replace(/'/g, "\\'")}'`;
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatFusionNumber(value) {
    return Number(value || 0).toLocaleString('en', {
      maximumFractionDigits: 6,
      useGrouping: false
    });
  }

  function generateFusionGuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.ToolExportFusion360 = { exportTools };
}());
