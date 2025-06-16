export interface TransportState {
  // OBBLIGATORI: Stato playback
  readonly isPlaying: boolean;              // OBBLIGATORIO: Se il transport sta suonando
  readonly isRecording: boolean;            // OBBLIGATORIO: Se sta registrando
  readonly isLooping: boolean;              // OBBLIGATORIO: Se il loop è attivo
  readonly isMetronomeOn: boolean;          // OBBLIGATORIO: Se il metronomo è attivo
  
  // OBBLIGATORI: Posizione temporale
  readonly currentTime: number;             // OBBLIGATORIO: Posizione corrente (in beats)
  readonly totalTime: number;               // OBBLIGATORIO: Durata totale progetto (in beats)
  readonly loopStart: number;               // OBBLIGATORIO: Inizio loop (in beats)
  readonly loopEnd: number;                 // OBBLIGATORIO: Fine loop (in beats)
  
  // OBBLIGATORI: Tempo e timing
  readonly bpm: number;                     // OBBLIGATORIO: Beats per minute (80-200)
  readonly timeSignatureNumerator: number;  // OBBLIGATORIO: Numeratore time signature (es. 4 in 4/4)
  readonly timeSignatureDenominator: number; // OBBLIGATORIO: Denominatore time signature (es. 4 in 4/4)
  readonly swing: number;                   // OBBLIGATORIO: Swing amount (0.0-1.0)
  
  // OBBLIGATORI: Quantizzazione
  readonly quantization: '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1'; // OBBLIGATORIO
  readonly quantizationStrength: number;    // OBBLIGATORIO: Forza quantizzazione (0.0-1.0)
  
  // COMPUTED: Proprietà derivate
  readonly currentBar: number;              // COMPUTED: Battuta corrente
  readonly currentBeat: number;             // COMPUTED: Beat corrente nella battuta
  readonly currentTick: number;             // COMPUTED: Tick corrente nel beat
  readonly isInLoop: boolean;               // COMPUTED: Se la posizione corrente è nel loop
}
