export const en = {
  appName: 'Ciberpiso',
  appTagline: 'Crop rotation explorer',
  about: 'About / Data sources',
  disclaimer: 'Decision-support only. Validate with local agronomists and extension services.',

  map: {
    searchPlaceholder: 'Search a place…',
    search: 'Search',
    searching: 'Searching…',
    noResults: 'No places found.',
    searchError: 'Search is unavailable right now.',
    drawField: 'Draw my field',
    dropPoint: 'Click a point',
    drawHint: 'Click to add corners. Click the first corner to close the field.',
    pointHint: 'Click on the map: we will create a ~500 m square around that point.',
    cancel: 'Cancel',
    area: (ha: number) => `${ha.toLocaleString('en', { maximumFractionDigits: ha < 10 ? 1 : 0 })} ha`,
    confirm: 'Analyse this field',
    redraw: 'Redraw',
    intro: 'Find your farm, then draw your field to explore rotation options with NASA Earth observations.',
    webglError: 'Your browser could not start the 3D map (WebGL). Try another browser or device.',
    flatFallback: '3D terrain could not load. Showing a flat map.',
  },

  dashboard: {
    title: 'Your field',
    newField: 'New field',
    collapse: 'Hide panel',
    expand: 'Show panel',
    tabs: {
      conditions: 'Conditions',
      layers: 'Map layers',
      priorities: 'Priorities',
      rotations: 'Rotations',
    },
  },

  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  demo: 'demo data',
  demoTitle: 'Simulated values for this prototype, not real measurements.',

  glossary: {
    ndvi: 'NDVI is a satellite index of how green and dense vegetation is: higher values mean more active plant cover.',
    et: 'Evapotranspiration is the water that leaves the field as evaporation from soil plus transpiration from plants.',
    soilMoistureAnomaly: 'Soil moisture anomaly shows whether the topsoil is wetter or drier than is normal for that time of year.',
    frostRisk: 'Frost risk is how often the air near the ground drops to 0 °C or below, which can damage sensitive crops.',
    waterBalance: 'Water balance is rain minus the water the atmosphere demands (evapotranspiration): negative means the soil dries out.',
  },

  conditions: {
    loading: 'Loading NASA POWER daily climate data (2015 to yesterday)…',
    fromCache: 'NASA POWER data loaded from this browser’s cache.',
    sampleWarning: (place: string) =>
      `NASA POWER is unavailable right now. Showing a bundled sample dataset for ${place}, not your field.`,
    source: (from: string, to: string) => `NASA POWER daily point data, ${from} – ${to}. Grid cell ≈ 0.5°, not field-level.`,
    annualRain: 'Annual rain',
    meanTemp: 'Mean temperature',
    frostDays: 'Frost days / year',
    rainVariability: 'Rain variability',
    variabilityNote: (cv: number) => `± one std. dev. of annual totals (${Math.round(cv * 100)}% of the mean)`,
    monthlyRain: 'Monthly rainfall (mm)',
    monthlyTemp: 'Monthly temperature (°C)',
    meanSeries: 'Mean',
    minSeries: 'Mean daily minimum',
    frostChart: 'Frost days per month',
    frostNote: 'Days with minimum temperature ≤ 0 °C, average per year.',
    balanceChart: 'Monthly water balance (mm, approximate)',
    balanceNote: 'Rain minus reference evapotranspiration estimated with the Turc formula from temperature, radiation and humidity. Approximate.',
    rain: 'Rain',
    et0: 'Ref. ET',
    balance: 'Balance',
    trendRain: 'Annual rainfall and trend (mm)',
    trendTemp: 'Annual mean temperature and trend (°C)',
    trendLabel: 'Trend',
    perDecade: (v: number, unit: string) => `${v >= 0 ? '+' : ''}${v.toFixed(unit === 'mm' ? 0 : 1)} ${unit} per decade`,
    trendCaution: 'Short record (about 10 years): treat trends as indicative only.',
    smapChart: 'Soil moisture anomaly, last 12 months (SMAP)',
    smapNote: 'Percentage points vs. normal for the month.',
    heatChart: 'Crop heat / water stress by month (ECOSTRESS)',
    heatNote: '0 = no stress, 1 = severe stress.',
    stress: 'Stress index',
    anomaly: 'Anomaly',
    soilTitle: 'Soil properties (SSURGO-like)',
    texture: 'Texture',
    organicMatter: 'Organic matter',
    drainage: 'Drainage',
    waterHolding: 'Available water',
  },

  layers: {
    intro: 'Overlay NASA satellite imagery on the map for context. Pick a date to see conditions on that day.',
    date: 'Imagery date',
    opacity: 'Opacity',
    legend: (name: string) => `Colour legend for ${name}`,
    moistureHelp: 'What is soil moisture?',
    error: 'Some tiles could not load for this date. Try an earlier date, or NASA GIBS may be temporarily down.',
    note: 'GIBS tiles are pictures for visual context, not measured values for your field. Resolution is much coarser than a field.',
    items: {
      ndvi: { name: 'Vegetation greenness (MODIS NDVI, 8-day)', description: 'Higher values mean denser, greener vegetation; low values mean bare soil or dry plants.' },
      imerg: { name: 'Precipitation rate (GPM IMERG)', description: 'How hard it was raining at the time of observation (mm per hour).' },
      smap: { name: 'Surface soil moisture (SMAP L4)', description: 'Water in the top 5 cm of soil, from satellite observations combined with a land model.' },
    },
  },

  priorities: {
    intro: 'Tell us what matters most on your farm. Scores in the Rotations tab are weighted by these choices.',
    heading: 'What matters to you? (0 = not important, 5 = very important)',
    labels: {
      water: 'Water conservation',
      income: 'Extra income',
      erosion: 'Erosion control',
      organic: 'Soil organic matter',
      cost: 'Low input cost',
    },
    constraints: 'Your field',
    irrigation: 'Irrigation available',
    irrigationOptions: { yes: 'Yes', limited: 'Limited', no: 'No (rainfed)' },
    currentCrop: 'Current crop',
    soil: 'Soil type',
    soils: { sandy: 'Sandy', loam: 'Loam', clay: 'Clay' },
    drainage: { excessive: 'Excessive', good: 'Good', moderate: 'Moderate', poor: 'Poor' },
    slope: 'Slope',
    slopes: { flat: 'Flat (< 2 %)', gentle: 'Gentle (2–8 %)', moderate: 'Moderate (8–15 %)', steep: 'Steep (> 15 %)' },
    slopeFromDem: (pct: number) => `Estimated ${pct.toFixed(1)} % from the terrain model. Change it if you know better.`,
    slopeManual: 'Could not estimate slope from terrain. Please choose one.',
  },

  scoring: {
    inputs: {
      soil: 'soil properties (demo)',
      market: 'market suitability (demo)',
      slope: 'slope (not measured)',
      climateSample: 'climate (bundled sample)',
    },
    water: (avgUse: number, balance: number, thirsty: string, irrigation: string) =>
      `Average crop water use ${avgUse.toFixed(1)}/5. Approximate water balance ${Math.round(balance)} mm/yr.` +
      (thirsty ? ` ${thirsty} need${thirsty.includes(',') ? '' : 's'} a lot of water${irrigation !== 'yes' ? ', which is risky without full irrigation' : ''}.` : ''),
    income: (market: number, risky: string, fallowShare: number) =>
      `Average market suitability ${Math.round(market)}/100 (demo data).` +
      (risky ? ` Reduced because ${risky} face${risky.includes(',') ? '' : 's'} high climate risk here.` : '') +
      (fallowShare ? ' Fallow years earn no income.' : ''),
    erosion: (bare: number, rain: number, slope: string) =>
      `Soil is bare about ${bare.toFixed(1)} months per year, receiving ~${Math.round(rain)} mm of rain while unprotected. Slope: ${slope.toLowerCase()}.`,
    organic: (avgOm: number, legume: number, cover: number, fallow: number, soilOm: number) =>
      `Crop residue contribution ${avgOm.toFixed(1)}/5; legume in ${Math.round(legume * 100)}% of years, cover crop in ${Math.round(cover * 100)}%` +
      (fallow ? `, fallow in ${Math.round(fallow * 100)}%` : '') +
      `. Current soil organic matter ${soilOm} % (demo).`,
    cost: (avgCost: number, legume: number, irrigated: boolean) =>
      `Average input cost ${avgCost.toFixed(1)}/5.` +
      (legume ? ' Legumes reduce nitrogen fertiliser for the next crop.' : '') +
      (irrigated ? ' Water-hungry crops add pumping costs.' : ''),
    season: {
      erosion: (rain: number) => `Bare soil during ~${rain} mm of seasonal rain (erosion).`,
      frost: (crops: string, days: number) => `${crops} in the field with ~${days.toFixed(1)} frost days.`,
      drought: (crops: string, balance: number) => `${crops} facing a ${Math.abs(balance)} mm water deficit.`,
      heat: 'High heat stress (demo ECOSTRESS).',
    },
  },

  rotations: {
    intro: 'Three options for your field, scored with transparent rules using your priorities. Use them to start a conversation, not as a prescription.',
    waiting: 'Waiting for climate data to score the rotations…',
    names: { A: 'Current rotation', B: 'Soil-health focused', C: 'Water-saving / drought-tolerant' },
    fallow: 'Fallow',
    year: (n: number) => `Year ${n}`,
    total: 'Weighted score',
    totalNote: 'Weighted by your priorities',
    uncertainty: 'Uncertainty',
    levels: { low: 'Low', medium: 'Medium', high: 'High' },
    uncertaintyNote: 'Uncertainty rises when a score relies on demo data instead of real observations.',
    scoresTitle: 'Score by priority',
    weight: (w: number) => `weight ${w}`,
    demoInputs: (list: string) => `Uses ${list}.`,
    sections: {
      why: 'Why it was suggested',
      evidence: 'Supporting evidence',
      benefits: 'Expected benefits',
      risks: 'Risks to review locally',
      gaps: 'Information gaps',
    },
    sample: 'bundled sample',
    bareTitle: 'Bare field months',
    bareNote: (n: number) => `On average ${n.toFixed(1)} bare months per year.`,
    cover: { full: 'Crop cover', some: 'Partial cover or some years', bare: 'Bare soil' },
    vulnerabilityTitle: 'Vulnerability by season',
    seasonLabel: (months: number[], names: string[]) => `${names[months[0]]}–${names[months[months.length - 1]]}`,
    noRisk: 'No major risk flagged.',
    why: {
      A: (crop: string, partner: string | null) =>
        `This is what you grow now (${crop}${partner ? `, alternated with ${partner}` : ''}). It is the baseline to compare the other options with.`,
      B: (legume: string, cover: string, deep: string) =>
        `Adds a nitrogen-fixing legume (${legume}), a cover crop (${cover}) so the soil is not bare in the rainy season, and a deep-rooted crop (${deep}) to open the subsoil and recover nutrients.`,
      Bperennial: (crop: string, cover: string) =>
        `Keeps your ${crop} and sows ${cover} between the rows each autumn: a legume cover that fixes nitrogen and protects the soil from winter rain.`,
      C: (crops: string[], fallow: boolean, balance: number) =>
        `Uses drought-tolerant crops (${crops.join(', ')})${fallow ? ' and a fallow year to store rain in the soil' : ''}. Suggested because your approximate water balance is ${Math.round(balance)} mm per year.`,
      Cperennial: (crop: string) =>
        `Keeps your ${crop} with a drought-tolerant barley cover between the rows, mowed early in spring before it competes for water.`,
    },
    evidence: {
      balance: (rain: number, et0: number) =>
        `${Math.round(rain)} mm of rain per year against ~${Math.round(et0)} mm of reference evapotranspiration (approximate water balance ${Math.round(rain - et0)} mm).`,
      variability: (std: number, cv: number) => `Annual rain varies by ±${Math.round(std)} mm from year to year (${Math.round(cv * 100)}% of the mean).`,
      frost: (days: number, months: string[]) =>
        `${days.toFixed(1)} frost days per year${months.length ? `, mostly in ${months.join(', ')}` : ''}: relevant for winter cover crops.`,
      bare: (bare: number, rain: number) => `With this rotation the soil is bare ${bare.toFixed(1)} months per year, while ~${Math.round(rain)} mm of rain falls.`,
      heat: 'Summer heat and water stress pattern for the field.',
      soil: (om: number) => `Soil organic matter around ${om} %.`,
    },
    benefit: {
      water: (s: number) => `Uses water carefully (water conservation ${s}/100).`,
      income: (s: number) => `Good market potential (extra income ${s}/100).`,
      erosion: (s: number) => `Keeps the soil protected for longer (erosion control ${s}/100).`,
      organic: (s: number) => `Builds soil organic matter (${s}/100).`,
      cost: (s: number) => `Lower spending on fertiliser and inputs (${s}/100).`,
      familiar: 'No change in machinery, skills or buyers.',
      none: 'No clear strength under your current priorities.',
    },
    risk: {
      frost: (crop: string, days: number) => `Frost can damage ${crop} (~${days.toFixed(1)} frost days during its season).`,
      drought: (crop: string) => `${crop} is likely to suffer water stress without irrigation.`,
      irrigation: (crop: string) => `${crop} will need a lot of irrigation water here.`,
      erosion: (slope: string) => `Bare soil in rainy months on a ${slope.toLowerCase()} slope: erosion risk.`,
      short: 'Short rotations let pests, diseases and weeds build up over time.',
      coverWater: 'In a dry spring the cover crop can use water the next crop needs: terminate it on time.',
      newCrops: 'New crops may need different machinery, skills or buyers.',
      fallow: 'A fallow year earns no income and can leave the soil exposed.',
      lowYield: 'Drought-tolerant crops often yield less than thirstier crops in wet years.',
    },
    gap: {
      grid: 'Climate comes from a NASA POWER grid cell (~50 km), not your exact field.',
      sample: 'Climate is a bundled sample dataset, not your location.',
      soil: 'Soil properties are demo data: confirm with a soil test.',
      market: 'Market scores are demo data: check local prices and buyers.',
      demoSensors: 'Soil moisture (SMAP) and heat stress (ECOSTRESS) are demo data in this prototype.',
      slope: 'Slope was not measured from the terrain model.',
      yields: 'Your own yield history is not included.',
      cover: 'The best cover-crop species and termination date need local trials.',
      fallow: 'How much water a fallow stores depends on soil depth, which is not measured here.',
    },
    humanTitle: 'Where human judgment matters',
    human: [
      'Local knowledge of your soil, pests, weeds and microclimate that satellites cannot see.',
      'Access to machinery, labour, seed and buyers for new crops.',
      'Contracts, subsidies and regulations (for example, cover-crop or eco-scheme rules).',
      'Your appetite for risk and how much income variation you can absorb.',
      'Advice from local agronomists and extension services before changing the rotation.',
    ],
  },

  aboutModal: {
    title: 'About / Data sources',
    close: 'Close',
    intro: 'Ciberpiso is a decision-support prototype built for the NASA Space Apps Challenge. It helps you explore crop-rotation options; it does not replace your judgment or local advice.',
    real: 'Real data',
    demo: 'Demo data (simulated)',
    realItems: [
      'NASA POWER daily point data (temperature, minimum temperature, precipitation, solar radiation, humidity), 2015 to yesterday.',
      'NASA GIBS imagery: MODIS Terra NDVI 8-day, GPM IMERG precipitation rate, SMAP L4 surface soil moisture.',
      'Terrain: Mapzen Terrarium elevation tiles (AWS Open Data). Basemap: Esri World Imagery. Place search: OpenStreetMap Nominatim.',
    ],
    demoItems: [
      'Soil properties (SSURGO-like texture, organic matter, drainage).',
      'SMAP soil moisture anomaly series and ECOSTRESS heat stress.',
      'Market suitability of crops.',
    ],
    catalog: 'The crop catalog is a simplified, hand-made reference table.',
    ackTitle: 'Acknowledgements',
    ackPower: 'These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.',
    ackGibs: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).",
    endorsement: 'NASA does not endorse this project.',
  },
}

export type Strings = typeof en
