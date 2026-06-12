(function () {
  const MACHINES = {
    EVO: { label: 'EVO', doc: 0.5, idx: 0.75 },
    PRO: { label: 'PRO', doc: 0.8, idx: 0.90 },
    FAB: { label: 'FAB', doc: 1.0, idx: 1.00 }
  };

  const MACHINE_OPTIONS = Object.keys(MACHINES).map(value => ({
    value,
    label: MACHINES[value].label
  }));

  const DIAMETERS = [2, 3, 4, 6, 8, 10];
  const BEGINNER_FACTOR = 1.00;
  const ADVANCED_FACTOR = 1.00;

  const CHIPLOAD = {
    'Hardwood': { loads: [0.03, 0.06, 0.08, 0.10, 0.12, 0.14], doc: 0.9 },
    'Softwood/Plywood': { loads: [0.04, 0.08, 0.10, 0.12, 0.14, 0.16], doc: 1.0 },
    'MDF/Particleboard': { loads: [0.05, 0.10, 0.12, 0.14, 0.17, 0.20], doc: 1.0 },
    'Soft Plastic': { loads: [0.07, 0.13, 0.15, 0.20, 0.24, 0.28], doc: 0.8 },
    'Hard Plastic': { loads: [0.05, 0.10, 0.12, 0.18, 0.20, 0.22], doc: 0.5 },
    'Aluminium': { loads: [0.01, 0.025, 0.03, 0.04, 0.05, 0.06], doc: 0.25 }
  };

  function interpolateChipload(material, diameter) {
    const materialData = CHIPLOAD[material];
    if (!materialData) return 0;
    const { loads } = materialData;
    if (diameter <= DIAMETERS[0]) return loads[0];
    if (diameter >= DIAMETERS[DIAMETERS.length - 1]) return loads[loads.length - 1];
    for (let i = 0; i < DIAMETERS.length - 1; i += 1) {
      if (diameter >= DIAMETERS[i] && diameter <= DIAMETERS[i + 1]) {
        const t = (diameter - DIAMETERS[i]) / (DIAMETERS[i + 1] - DIAMETERS[i]);
        return loads[i] + t * (loads[i + 1] - loads[i]);
      }
    }
    return loads[loads.length - 1];
  }

  function roundNearest100(x) {
    const rounded = Math.round(x / 100) * 100;
    return rounded < 100 && x > 0 ? 100 : rounded;
  }

  function calculate(machine, diameter, flutes, material, factor, dampenFeed) {
    const m = MACHINES[machine] || MACHINES.PRO;
    const baseChipload = interpolateChipload(material, diameter);
    const chipload = baseChipload * factor;
    const effectiveFlutes = dampenFeed ? (flutes + 1) / 2 : flutes;
    const docAdj = CHIPLOAD[material].doc;
    const spindleRaw = (22000 - baseChipload * 3 * 10000) * m.idx;
    const spindle = roundNearest100(Math.min(spindleRaw, 24000));
    const feedRaw = chipload * effectiveFlutes * spindle * (dampenFeed ? m.idx : 1);
    const feed = roundNearest100(feedRaw);
    const doc = m.doc * diameter * docAdj;
    return { spindle, feed, doc, chipload };
  }

  function calculateMode(machine, diameter, flutes, material, calculationMode) {
    const beginner = calculationMode === 'beginner';
    return calculate(
      machine,
      diameter,
      flutes,
      material,
      beginner ? BEGINNER_FACTOR : ADVANCED_FACTOR,
      beginner
    );
  }

  window.CncCalc = {
    MACHINES,
    MACHINE_OPTIONS,
    DIAMETERS,
    BEGINNER_FACTOR,
    ADVANCED_FACTOR,
    CHIPLOAD,
    interpolateChipload,
    roundNearest100,
    calculate,
    calculateMode
  };
}());
