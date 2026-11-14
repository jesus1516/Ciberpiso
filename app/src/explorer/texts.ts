// Explorer texts (the final interface is in English).

/** Why a farm is not (or is hardly) cropland: rule aptitud() in pipeline/export_app_fincas.py. */
export const APT: Record<string, string> = {
  urbano: 'Urban or built-up area',
  agua: 'Open water (reservoir, river or lagoon)',
  publico: 'Public domain (track, road or watercourse)',
  monte: 'Forest or scrub',
  pendiente: 'Very steep slope',
  roca: 'Rock or bare soil',
}

/** Land-cover names by their class code in the data files. */
export const COVER_NAME: Record<string, string> = {
  cultivo: 'cropland',
  pasto: 'pasture',
  arbolado: 'tree cover',
  matorral: 'scrub',
  urbano: 'urban',
  suelo_desnudo: 'bare soil',
  agua: 'water',
}

export const SHORT_ROTATION: Record<string, string> = { R0: 'Current', R1: '+ Chickpea', R2: '+ Vetch', R3: '+ Fallow' }
export const PROFILES: [string, string][] = [['water_first', 'Water'], ['soil_first', 'Soil'], ['profit_first', 'Market']]

export const DISCLAIMER = 'Decision-support tool: it ranks options and states uncertainty; it does not replace the farmer, the agronomist or a local review.'

export const fmt = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
