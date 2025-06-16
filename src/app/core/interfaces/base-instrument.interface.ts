import { ParameterDefinition } from './parameter-definition.interface';
import { MidiNote } from '../models/midi-note.model';

export interface BaseInstrument {
  // OBBLIGATORI: Identificatori
  readonly id: string;                                   // OBBLIGATORIO: ID univoco strumento
  readonly name: string;                                 // OBBLIGATORIO: Nome strumento
  readonly type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'; // OBBLIGATORIO: Tipo strumento
  
  // OBBLIGATORI: Controllo audio
  play(note: MidiNote): void;                           // OBBLIGATORIO: Suona una nota MIDI
  stop(note: MidiNote): void;                           // OBBLIGATORIO: Ferma una nota specifica
  stopAll(): void;                                      // OBBLIGATORIO: Ferma tutte le note
  
  // OBBLIGATORI: Parametri
  setParameter(name: string, value: number): void;      // OBBLIGATORIO: Imposta parametro
  getParameter(name: string): number;                   // OBBLIGATORIO: Legge valore parametro
  getParameters(): readonly ParameterDefinition[];     // OBBLIGATORIO: Lista parametri disponibili
  
  // OBBLIGATORI: Audio routing
  getAudioNode(): AudioNode;                            // OBBLIGATORIO: Nodo audio per routing
  
  // OBBLIGATORI: Lifecycle (per pooling)
  reset(): void;                                        // OBBLIGATORIO: Reset per riutilizzo
  dispose(): void;                                      // OBBLIGATORIO: Cleanup resources
  
  // OBBLIGATORI: Stato
  readonly isActive: boolean;                           // OBBLIGATORIO: Se strumento è attivo
  readonly voiceCount: number;                          // OBBLIGATORIO: Numero voci attualmente suonanti
}
