// Stato centrale del playback, separato dai modelli dei clip
// per evitare confusione tra stato UI e stato di playback

export interface PlaybackState {
  readonly isPlaying: boolean;                      // OBBLIGATORIO: Se il sequencer è in play
  readonly isPaused: boolean;                       // OBBLIGATORIO: Se il sequencer è in pausa
  readonly currentBeat: number;                     // OBBLIGATORIO: Beat corrente
  readonly activeClips: ReadonlySet<string>;        // OBBLIGATORIO: ID dei clip attivi
  readonly scheduledEvents: ReadonlyMap<string, ScheduledEvent>; // OBBLIGATORIO: Eventi schedulati
  readonly playingNotes: ReadonlyMap<string, PlayingNote>;  // OBBLIGATORIO: Note attualmente suonate
  readonly bpm: number;                             // OBBLIGATORIO: BPM corrente
  readonly timeSignature: readonly [number, number]; // OBBLIGATORIO: Time signature [num, denom]
  readonly metronomeEnabled: boolean;               // OBBLIGATORIO: Metronomo attivo
  readonly loopEnabled: boolean;                    // OBBLIGATORIO: Se il loop è attivo
  readonly loopStart: number;                       // OBBLIGATORIO: Inizio del loop (in beats)
  readonly loopEnd: number;                         // OBBLIGATORIO: Fine del loop (in beats)
  readonly quantization: number;                    // OBBLIGATORIO: Quantizzazione (1/N di beat)
  readonly swing: number;                           // OBBLIGATORIO: Valore di swing (0-100%)
}

export interface ScheduledEvent {
  readonly id: string;                              // OBBLIGATORIO: ID univoco dell'evento
  readonly type: 'note_start' | 'note_stop' | 'metronome'; // OBBLIGATORIO: Tipo di evento
  readonly beat: number;                            // OBBLIGATORIO: Beat in cui è schedulato
  readonly audioTime: number;                       // OBBLIGATORIO: Tempo audio in cui è schedulato
  readonly clipId?: string;                         // OPZIONALE: Clip associato
  readonly noteId?: string;                         // OPZIONALE: Nota associata
  readonly scheduledIds?: string[];                 // OPZIONALE: ID degli oggetti audio schedulati
}

export interface PlayingNote {
  readonly id: string;                              // OBBLIGATORIO: ID univoco della nota
  readonly noteId: string;                          // OBBLIGATORIO: ID della nota nel clip
  readonly clipId: string;                          // OBBLIGATORIO: ID del clip
  readonly startTime: number;                       // OBBLIGATORIO: Tempo di inizio (audio)
  readonly scheduledEndTime: number;                // OBBLIGATORIO: Tempo di fine schedulato (audio)
  readonly pitch: number;                           // OBBLIGATORIO: Pitch della nota
  readonly velocity: number;                        // OBBLIGATORIO: Velocità della nota
  readonly voiceId?: string;                        // OPZIONALE: ID della voce nel synth
  readonly oscId?: number;                          // OPZIONALE: ID dell'oscillatore
}
