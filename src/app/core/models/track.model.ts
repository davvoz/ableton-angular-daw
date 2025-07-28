import { Clip } from './clip.model';

export interface Track {
  // OBBLIGATORI: Identificatori
  readonly id: string;                      // OBBLIGATORIO: ID univoco della track
  readonly name: string;                    // OBBLIGATORIO: Nome della track
  readonly index: number;                   // OBBLIGATORIO: Posizione nella sessione (0-based)
  
  // OBBLIGATORI: Contenuto
  readonly clips: ReadonlyMap<string, Clip>; // OBBLIGATORIO: Map per O(1) lookup
  readonly clipOrder: readonly string[];    // OBBLIGATORIO: Array per ordine temporale
  
  // OBBLIGATORI: Strumento
  readonly instrumentId: string;            // OBBLIGATORIO: ID dello strumento assegnato
  readonly instrumentType: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'; // OBBLIGATORIO
  
  // OBBLIGATORI: Audio settings
  readonly volume: number;                  // OBBLIGATORIO: Volume (0.0-1.0)
  readonly pan: number;                     // OBBLIGATORIO: Pan (-1.0 to 1.0)
  readonly gain: number;                    // OBBLIGATORIO: Gain in dB (-60 to +20)
    // OBBLIGATORI: Stato
  readonly isMuted: boolean;                // OBBLIGATORIO: Se la track è mutata
  readonly isSolo: boolean;                 // OBBLIGATORIO: Se la track è in solo
  readonly isSelected: boolean;             // OBBLIGATORIO: Se la track è selezionata
  readonly isFrozen: boolean;               // OBBLIGATORIO: Se la track è freezata
  
  // OBBLIGATORI: Colore e visualizzazione
  readonly color: string;                   // OBBLIGATORIO: Colore della track (hex)
  readonly height: number;                  // OBBLIGATORIO: Altezza UI (in px)
  
  // COMPUTED: Proprietà derivate
  readonly clipCount: number;               // COMPUTED: clips.size
  readonly totalDuration: number;           // COMPUTED: Durata totale di tutti i clip
  readonly hasClips: boolean;               // COMPUTED: clipCount > 0
}
