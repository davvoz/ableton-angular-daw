import { ParameterDefinition } from '../interfaces/parameter-definition.interface';

export interface InstrumentDefinition {
  // OBBLIGATORI: Identificatori
  readonly id: string;                      // OBBLIGATORIO: ID univoco dello strumento
  readonly name: string;                    // OBBLIGATORIO: Nome dello strumento
  readonly type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'; // OBBLIGATORIO
  readonly category: string;                // OBBLIGATORIO: Categoria (es. "Lead Synth", "808 Drums")
  
  // OBBLIGATORI: Parametri
  readonly parameters: ReadonlyMap<string, ParameterDefinition>; // OBBLIGATORIO: Definizioni parametri
  readonly defaultPreset: ReadonlyMap<string, number>; // OBBLIGATORIO: Valori default
  
  // OBBLIGATORI: Metadati
  readonly polyphony: number;               // OBBLIGATORIO: Numero max voci simultanee
  readonly latency: number;                 // OBBLIGATORIO: Latenza in samples
  readonly cpuUsage: number;                // OBBLIGATORIO: Uso CPU stimato (0.0-1.0)
  
  // OPZIONALI: UI e visualizzazione
  readonly icon?: string;                   // OPZIONALE: Icona strumento
  readonly color?: string;                  // OPZIONALE: Colore UI
  readonly description?: string;            // OPZIONALE: Descrizione
}

export interface InstrumentInstance {
  // OBBLIGATORI: Riferimenti
  readonly id: string;                      // OBBLIGATORIO: ID istanza
  readonly definitionId: string;            // OBBLIGATORIO: ID della definizione
  readonly trackId: string;                 // OBBLIGATORIO: ID track di appartenenza
  
  // OBBLIGATORI: Stato corrente
  readonly currentParameters: ReadonlyMap<string, number>; // OBBLIGATORIO: Valori attuali
  readonly isActive: boolean;               // OBBLIGATORIO: Se l'istanza è attiva
  readonly voiceCount: number;              // OBBLIGATORIO: Voci attualmente suonanti
  
  // OBBLIGATORI: Performance
  readonly cpuUsage: number;                // OBBLIGATORIO: Uso CPU corrente
  readonly memoryUsage: number;             // OBBLIGATORIO: Uso memoria (bytes)
  readonly lastUsedTime: number;            // OBBLIGATORIO: Timestamp ultimo utilizzo (per pooling)
}
