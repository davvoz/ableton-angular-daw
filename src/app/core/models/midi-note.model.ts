export interface MidiNote {
  // OBBLIGATORI: Identificatori
  readonly id: string;                      // OBBLIGATORIO: ID univoco della nota
  readonly note: number;                    // OBBLIGATORIO: Numero MIDI (0-127, C4 = 60)
  readonly velocity: number;                // OBBLIGATORIO: Velocità (0-127)
  
  // OBBLIGATORI: Timing
  readonly startTime: number;               // OBBLIGATORIO: Tempo di inizio (in beat/ticks)
  readonly duration: number;                // OBBLIGATORIO: Durata (in beat/ticks)
  
  // OPZIONALI: Modulazioni
  readonly pitchBend?: number;              // OPZIONALE: Pitch bend (-8192 to 8191)
  readonly modulation?: number;             // OPZIONALE: Modulation wheel (0-127)
  readonly aftertouch?: number;             // OPZIONALE: Channel aftertouch (0-127)
  
  // UTILITY: Computed properties
  readonly noteName: string;                // COMPUTED: Nome nota (es. "C4", "A#3")
  readonly endTime: number;                 // COMPUTED: startTime + duration
}
