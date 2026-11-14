// Textos del explorador (la interfaz final está en español).

/** Por qué una finca no es (o es poco) tierra de cultivo: regla aptitud() de pipeline/export_app_fincas.py. */
export const APT: Record<string, string> = {
  urbano: 'Zona urbana o edificada',
  agua: 'Lámina de agua (embalse, río o laguna)',
  publico: 'Dominio público (camino, carretera o cauce)',
  monte: 'Monte o matorral',
  pendiente: 'Pendiente muy fuerte',
  roca: 'Roca o suelo desnudo',
}

export const NOMBRE_COBERTURA: Record<string, string> = {
  cultivo: 'cultivo',
  pasto: 'pasto',
  arbolado: 'arbolado',
  matorral: 'matorral',
  urbano: 'urbano',
  suelo_desnudo: 'suelo desnudo',
  agua: 'agua',
}

export const ROTACION_CORTA: Record<string, string> = { R0: 'Actual', R1: '+ Garbanzo', R2: '+ Veza', R3: '+ Barbecho' }
export const PERFILES: [string, string][] = [['water_first', 'Agua'], ['soil_first', 'Suelo'], ['profit_first', 'Mercado']]

export const DISCLAIMER = 'Herramienta de apoyo a la decisión: ordena opciones y declara incertidumbre; no sustituye al agricultor, al agrónomo ni a una revisión local.'

export const fmt = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d })
