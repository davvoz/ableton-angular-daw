import { MidiNote } from './midi-note.model';

export interface Clip {
  // OBBLIGATORI: Identificatori
  readonly id: string;                      // OBBLIGATORIO: ID univoco del clip
  readonly name: string;                    // OBBLIGATORIO: Nome del clip
  readonly trackId: string;                 // OBBLIGATORIO: ID della track di appartenenza
  
  // OBBLIGATORI: Timing e posizione
  readonly startTime: number;               // OBBLIGATORIO: Tempo di inizio nella timeline (in beats)
  readonly length: number;                  // OBBLIGATORIO: Lunghezza del clip (in beats)
  readonly loopStart: number;               // OBBLIGATORIO: Inizio del loop (relativo al clip)
  readonly loopEnd: number;                 // OBBLIGATORIO: Fine del loop (relativo al clip)
  
  // OBBLIGATORI: Contenuto MIDI
  readonly notes: ReadonlyMap<string, MidiNote>; // OBBLIGATORIO: Map per O(1) lookup
  readonly noteOrder: readonly string[];    // OBBLIGATORIO: Array per ordine temporale
  
  // OBBLIGATORI: Stato
  readonly isLoop: boolean;                 // OBBLIGATORIO: Se il clip è in loop
  readonly isPlaying: boolean;              // OBBLIGATORIO: Se il clip sta suonando
  readonly isMuted: boolean;                // OBBLIGATORIO: Se il clip è mutato
  readonly isSelected: boolean;             // OBBLIGATORIO: Se il clip è selezionato
  
  // OBBLIGATORI: Colore e visualizzazione
  readonly color: string;                   // OBBLIGATORIO: Colore del clip (hex)
  readonly waveformData?: readonly number[]; // OPZIONALE: Dati waveform per visualizzazione
  
  // COMPUTED: Proprietà derivate
  readonly endTime: number;                 // COMPUTED: startTime + length
  readonly noteCount: number;               // COMPUTED: notes.size
}
