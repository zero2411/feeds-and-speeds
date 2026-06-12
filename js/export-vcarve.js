(function () {
  const SQL_JS_PATH = 'vendor/sql.js/';
  const MACHINE_ID = '2a5e48b1-185a-4224-88fd-55b58fbbb892';
  const ROOT_GROUP_NAME = 'Mekanika';
  const SUPPORTED_TOOL_TYPES = new Set(['endmill', 'surfacing']);
  const MIGRATIONS = [
    [1, 0, '1_0_create_db', 'eb8956f072d5424bcfe5e0f870eb3ab8'],
    [2, 0, '2_0_add_tip_radius', '464b7aa57046d2a2ef2dd5720a1e6bb9'],
    [3, 0, '3_0_tool_number', '9dacf3050174eccbee215f0336e53cc1'],
    [4, 0, '4_0_tool_name_format', '42c3df3b53166c1fdc90a9cbfea9e715'],
    [5, 0, '5_0_laser_watt', '84a9f320f2c16fac892f5424b5996ae2'],
    [6, 0, '6_0_upload_data', '60007cc6288adf2462b10a8aa89c6fe4'],
    [7, 0, '7_0_custom_fields', '8493fbdc67e7b15ccafc51daed0da18c'],
    [8, 0, '8_0_thread_milling_fields', '0b28c0b6db82b65d55f3a48be9ccd47e'],
    [9, 0, '9_0_thread_milling_fields_2', 'ad107ae3ba987dd2976258e7792cde10'],
    [10, 0, '10_0_laser_head', 'f33a83a72fd722ff5265f3f28cd3b1b9'],
    [11, 0, '11_0_drill_banks', '1d242c31cf269ff56976fcaed51f2cf5'],
    [11, 1, '11_1_burn_rate_fix', 'c199632815a253349d92a3ae96caa977'],
    [12, 0, '12_0_add_axis_acceleration', 'e9259521e0d406160368f0059401dda7'],
    [13, 0, '13_0_drill_banks_additional_drill_num', '0d69bbf29c1417f77e36d44c246244f5']
  ];
  let sqlPromise = null;

  function preload() {
    if (!sqlPromise) {
      if (typeof window.initSqlJs !== 'function') {
        sqlPromise = Promise.reject(new Error('VCarve export requires sql.js. Refresh the page and try again.'));
      } else {
        sqlPromise = window.initSqlJs({
          locateFile: file => `${SQL_JS_PATH}${file}`,
          wasmBinary: window.SqlJsWasmBinary
        });
      }
    }
    return sqlPromise;
  }

  async function exportTools(tools) {
    const exportable = tools.filter(tool => SUPPORTED_TOOL_TYPES.has(tool.toolType) && tool.units !== 'in');
    const skipped = tools.length - exportable.length;
    if (!exportable.length) {
      throw new Error('No VCarve-compatible metric end mill or surfacing tools were found.');
    }

    const SQL = await preload();
    if (!window.VCarveTemplateDatabase) {
      throw new Error('VCarve template database is missing. Refresh the page and try again.');
    }
    const db = new SQL.Database(window.VCarveTemplateDatabase);
    clearTemplateRows(db);
    ensureMachine(db);
    const materials = insertMaterials(db, exportable);
    insertTools(db, exportable, materials);
    const content = db.export();
    db.close();

    return {
      filename: 'cnc-tool-database.vtdb',
      mimeType: 'application/octet-stream',
      content,
      message: skipped ? `VCarve export created. Skipped ${skipped} unsupported or inch-based tool(s).` : 'VCarve export created.'
    };
  }

  function clearTemplateRows(db) {
    db.run(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM tool_tree_entry;
      DELETE FROM tool_entity;
      DELETE FROM tool_cutting_data;
      DELETE FROM tool_geometry;
      DELETE FROM material;
      DELETE FROM machine;
      PRAGMA foreign_keys = ON;
    `);
  }

  function createSchema(db) {
    db.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS migration (
        version INTEGER NOT NULL,
        subversion INTEGER NOT NULL,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        PRIMARY KEY(version, subversion)
      );
      CREATE TABLE IF NOT EXISTS version (
        version INTEGER NOT NULL UNIQUE,
        PRIMARY KEY(version)
      );
      CREATE TABLE IF NOT EXISTS machine (
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        make TEXT,
        model TEXT,
        controller_type TEXT,
        dimensions_units INTEGER,
        max_width REAL,
        max_height REAL,
        support_rotary INTEGER,
        support_tool_change INTEGER,
        has_laser_head INTEGER,
        acceleration_units INTEGER,
        x_axis_acceleration REAL,
        y_axis_acceleration REAL,
        z_axis_acceleration REAL,
        angular_acceleration_units INTEGER,
        angular_acceleration REAL,
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS material (
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS tool_geometry (
        id TEXT NOT NULL UNIQUE,
        name_format TEXT NOT NULL,
        notes TEXT,
        tool_type INTEGER NOT NULL,
        units INTEGER NOT NULL,
        diameter REAL,
        included_angle REAL,
        flat_diameter REAL,
        num_flutes INTEGER,
        flute_length REAL,
        thread_pitch REAL,
        outline BLOB,
        tip_radius REAL,
        laser_watt INTEGER,
        custom_attributes TEXT,
        tooth_size REAL,
        tooth_offset REAL,
        neck_length REAL,
        tooth_height REAL,
        threaded_length REAL,
        drill_bank_data_id TEXT,
        FOREIGN KEY(drill_bank_data_id) REFERENCES drill_bank_data(id),
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS tool_cutting_data (
        id TEXT NOT NULL UNIQUE,
        rate_units INTEGER NOT NULL,
        feed_rate REAL,
        plunge_rate REAL,
        spindle_speed INTEGER,
        spindle_dir INTEGER,
        stepdown REAL,
        stepover REAL,
        clear_stepover REAL,
        thread_depth REAL,
        thread_step_in REAL,
        laser_power REAL,
        laser_passes INTEGER,
        laser_burn_rate REAL,
        line_width REAL,
        length_units INTEGER NOT NULL DEFAULT 0,
        tool_number INTEGER,
        laser_kerf INTEGER,
        notes TEXT,
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS tool_entity (
        id TEXT NOT NULL UNIQUE,
        material_id TEXT,
        machine_id TEXT,
        tool_geometry_id TEXT,
        tool_cutting_data_id TEXT NOT NULL,
        PRIMARY KEY(tool_geometry_id, material_id, machine_id),
        FOREIGN KEY(material_id) REFERENCES material(id),
        FOREIGN KEY(machine_id) REFERENCES machine(id),
        FOREIGN KEY(tool_geometry_id) REFERENCES tool_geometry(id),
        FOREIGN KEY(tool_cutting_data_id) REFERENCES tool_cutting_data(id)
      );
      CREATE TABLE IF NOT EXISTS tool_tree_entry (
        id TEXT NOT NULL UNIQUE,
        parent_group_id TEXT,
        sibling_order INTEGER NOT NULL,
        tool_geometry_id TEXT UNIQUE,
        name TEXT,
        notes TEXT,
        expanded INTEGER,
        FOREIGN KEY(tool_geometry_id) REFERENCES tool_geometry(id),
        PRIMARY KEY(id, parent_group_id, sibling_order),
        FOREIGN KEY(parent_group_id) REFERENCES tool_tree_entry(id)
      );
      CREATE TABLE IF NOT EXISTS tool_name_format (
        id TEXT NOT NULL,
        tool_type INTEGER NOT NULL UNIQUE,
        format TEXT NOT NULL,
        PRIMARY KEY(id, tool_type)
      );
      CREATE TABLE IF NOT EXISTS upload_data (
        id INTEGER NOT NULL UNIQUE,
        date_uploaded INTEGER NOT NULL,
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS drill_bank_data (
        id TEXT NOT NULL UNIQUE,
        num_horizontal_drills INTEGER NOT NULL,
        num_vertical_drills INTEGER NOT NULL,
        drill_bank_pitch REAL NOT NULL,
        horizontal_centre_index INTEGER NOT NULL,
        vertical_centre_index INTEGER NOT NULL,
        origin_index INTEGER NOT NULL,
        supports_variable_depth INTEGER NOT NULL,
        PRIMARY KEY(id)
      );
      CREATE TABLE IF NOT EXISTS drill_bank_drill (
        id TEXT NOT NULL UNIQUE,
        drill_bank_data_id TEXT NOT NULL,
        global_index INTEGER NOT NULL,
        horizontal_index INTEGER NOT NULL,
        vertical_index INTEGER NOT NULL,
        user_drill_number INTEGER NOT NULL,
        on_horizontal INTEGER NOT NULL,
        on_vertical INTEGER NOT NULL,
        diameter REAL NOT NULL,
        extra_user_drill_number INTEGER,
        FOREIGN KEY(drill_bank_data_id) REFERENCES drill_bank_data(id),
        PRIMARY KEY(id)
      );
    `);
  }

  function insertBaseRows(db) {
    db.run('INSERT INTO version (version) VALUES (?)', [1]);
    MIGRATIONS.forEach(row => {
      db.run('INSERT INTO migration (version, subversion, name, checksum) VALUES (?, ?, ?, ?)', row);
    });
    db.run(`
      INSERT INTO machine (
        id, name, make, model, controller_type, dimensions_units, max_width, max_height,
        support_rotary, support_tool_change, has_laser_head, acceleration_units,
        x_axis_acceleration, y_axis_acceleration, z_axis_acceleration,
        angular_acceleration_units, angular_acceleration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [MACHINE_ID, 'PRO CNC S - Default', 'Mekanika', 'PRO CNC S', 'PlanetCNC TG', 0, 630, 630, 0, 0, 0, null, null, null, null, null, null]);
    db.run('INSERT INTO tool_tree_entry (id, parent_group_id, sibling_order, tool_geometry_id, name, notes, expanded) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuid(), null, 0, null, ROOT_GROUP_NAME, '', 1]);
  }

  function ensureMachine(db) {
    db.run(`
      INSERT INTO machine (
        id, name, make, model, controller_type, dimensions_units, max_width, max_height,
        support_rotary, support_tool_change, has_laser_head, acceleration_units,
        x_axis_acceleration, y_axis_acceleration, z_axis_acceleration,
        angular_acceleration_units, angular_acceleration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [MACHINE_ID, 'PRO CNC S - Default', 'Mekanika', 'PRO CNC S', 'PlanetCNC TG', 0, 630, 630, 0, 0, 0, null, null, null, null, null, null]);
    db.run('INSERT INTO tool_tree_entry (id, parent_group_id, sibling_order, tool_geometry_id, name, notes, expanded) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuid(), null, 0, null, ROOT_GROUP_NAME, '', 1]);
  }

  function insertMaterials(db, tools) {
    const names = Array.from(new Set(tools.flatMap(tool => Object.keys(tool.materials || {}))));
    return names.reduce((map, material, index) => {
      const id = uuid();
      const name = vcarveMaterialName(material);
      db.run('INSERT INTO material (id, name) VALUES (?, ?)', [id, name]);
      map[material] = { id, name, order: index };
      return map;
    }, {});
  }

  function insertTools(db, tools, materials) {
    const rootId = db.exec('SELECT id FROM tool_tree_entry WHERE parent_group_id IS NULL LIMIT 1')[0].values[0][0];
    tools.forEach((tool, index) => {
      const geometryId = uuid();
      const diameter = numberOrNull(tool.diameter);
      db.run(`
        INSERT INTO tool_geometry (
          id, name_format, notes, tool_type, units, diameter, included_angle, flat_diameter,
          num_flutes, flute_length, thread_pitch, outline, tip_radius, laser_watt,
          custom_attributes, tooth_size, tooth_offset, neck_length, tooth_height,
          threaded_length, drill_bank_data_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        geometryId,
        tool.name || 'Tool',
        tool.notes || null,
        vcarveToolType(tool),
        0,
        diameter,
        null,
        null,
        Number.parseInt(tool.flutes, 10) || null,
        numberOrNull(tool.cuttingLength),
        null,
        null,
        null,
        null,
        JSON.stringify({
          Vendor: tool.manufacturer || '',
          source: 'FeedsAndSpeeds',
          appToolType: tool.toolType,
          geometry: tool.geometry,
          usage: tool.usage,
          machine: tool.machine,
          calculationMode: tool.calculationMode
        }),
        null,
        null,
        null,
        null,
        null,
        null
      ]);

      Object.entries(tool.materials || {}).forEach(([material, preset]) => {
        const materialRow = materials[material];
        if (!materialRow) return;
        insertCuttingEntity(db, tool, preset, geometryId, materialRow.id, index + 1, false);
      });
      insertCuttingEntity(db, tool, {}, geometryId, null, null, true);
      db.run('INSERT INTO tool_tree_entry (id, parent_group_id, sibling_order, tool_geometry_id, name, notes, expanded) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuid(), rootId, index, geometryId, '', '', null]);
    });
  }

  function insertCuttingEntity(db, tool, preset, geometryId, materialId, toolNumber, fallback) {
    const cuttingDataId = uuid();
    const diameter = numberOrNull(tool.diameter) || 0;
    db.run(`
      INSERT INTO tool_cutting_data (
        id, rate_units, feed_rate, plunge_rate, spindle_speed, spindle_dir, stepdown,
        stepover, clear_stepover, thread_depth, thread_step_in, laser_power, laser_passes,
        laser_burn_rate, line_width, length_units, tool_number, laser_kerf, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cuttingDataId,
      fallback ? 4 : 1,
      fallback ? null : numberOrNull(preset.feedrate),
      fallback ? null : numberOrNull(preset.plungerate),
      fallback ? null : integerOrNull(preset.rpm),
      null,
      fallback ? null : numberOrNull(preset.depthOfCut),
      fallback ? null : diameter * (numberOrNull(preset.stepover) || 0) / 100,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      toolNumber,
      null,
      null
    ]);
    db.run('INSERT INTO tool_entity (id, material_id, machine_id, tool_geometry_id, tool_cutting_data_id) VALUES (?, ?, ?, ?, ?)', [uuid(), materialId, MACHINE_ID, geometryId, cuttingDataId]);
  }

  function vcarveToolType(tool) {
    return tool.toolType === 'surfacing' ? 1 : 1;
  }

  function vcarveMaterialName(material) {
    if (material === 'Softwood/Plywood') return 'Softwood / Plywood';
    if (material === 'MDF/Particleboard') return 'MDF / Particleboard';
    return material;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function integerOrNull(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? number : null;
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `vcarve-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  window.ToolExportVCarve = { exportTools, preload };
}());
