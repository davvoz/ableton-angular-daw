export interface ParameterDefinition {
  readonly name: string;                    // OBBLIGATORIO: Nome parametro (es. "cutoff", "resonance")
  readonly min: number;                     // OBBLIGATORIO: Valore minimo
  readonly max: number;                     // OBBLIGATORIO: Valore massimo
  readonly default: number;                 // OBBLIGATORIO: Valore di default
  readonly step?: number;                   // OPZIONALE: Step per controlli discreti
  readonly unit?: string;                   // OPZIONALE: Unità di misura (Hz, dB, %, etc.)
  readonly curve?: 'linear' | 'exponential' | 'logarithmic'; // OPZIONALE: Curva di mappatura
}
