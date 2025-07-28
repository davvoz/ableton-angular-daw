// Tipi di eventi per l'intera applicazione DAW

// ====== TRANSPORT EVENTS =======
export type TransportEvent =
  | { type: 'TRANSPORT_PLAY'; payload: TransportPlayPayload }
  | { type: 'TRANSPORT_STOP'; payload: {} }
  | { type: 'TRANSPORT_PAUSE'; payload: {} }
  | { type: 'TRANSPORT_RESUME'; payload: {} }
  | { type: 'TRANSPORT_SEEK'; payload: { beat: number } }
  | { type: 'TRANSPORT_BPM_CHANGE'; payload: { bpm: number } }
  | { type: 'TRANSPORT_TIME_SIGNATURE_CHANGE'; payload: { timeSignature: [number, number] } }
  | { type: 'TRANSPORT_LOOP_TOGGLE'; payload: { enabled: boolean } }
  | { type: 'TRANSPORT_LOOP_SET'; payload: { start: number; end: number } }
  | { type: 'TRANSPORT_METRONOME_TOGGLE'; payload: { enabled: boolean } };

export interface TransportPlayPayload {
  readonly startBeat: number;
  readonly audioTime?: number;
  readonly resumeFromPause: boolean;
}

// ====== CLIP EVENTS =======
export type ClipEvent =
  | { type: 'CLIP_CREATE'; payload: ClipCreatePayload }
  | { type: 'CLIP_DELETE'; payload: { clipId: string } }
  | { type: 'CLIP_START'; payload: ClipStartPayload }
  | { type: 'CLIP_STOP'; payload: { clipId: string } }
  | { type: 'CLIP_LOOP'; payload: { clipId: string; loopCount: number } }
  | { type: 'CLIP_UPDATE'; payload: ClipUpdatePayload }
  | { type: 'CLIP_DUPLICATE'; payload: ClipDuplicatePayload };

export interface ClipCreatePayload {
  readonly clipId: string;
  readonly trackId: string;
  readonly startTime: number;
  readonly length: number;
  readonly color?: string;
  readonly name?: string;
}

export interface ClipStartPayload {
  readonly clipId: string;
  readonly startBeat: number;
  readonly audioTime?: number;
  readonly quantized: boolean;
}

export interface ClipUpdatePayload {
  readonly clipId: string;
  readonly updates: any; // TODO: Type this
}

export interface ClipDuplicatePayload {
  readonly sourceClipId: string;
  readonly newClipId: string;
  readonly startTime: number;
}

// ====== NOTE EVENTS =======
export type NoteEvent =
  | { type: 'NOTE_ADD'; payload: NoteAddPayload }
  | { type: 'NOTE_REMOVE'; payload: { noteId: string; clipId: string } }
  | { type: 'NOTE_UPDATE'; payload: NoteUpdatePayload }
  | { type: 'NOTE_START'; payload: NotePlayPayload }
  | { type: 'NOTE_END'; payload: { noteId: string; clipId: string } };

export interface NoteAddPayload {
  readonly noteId: string;
  readonly clipId: string;
  readonly startTime: number;
  readonly duration: number;
  readonly pitch: number;
  readonly velocity: number;
}

export interface NoteUpdatePayload {
  readonly noteId: string;
  readonly clipId: string;
  readonly updates: any; // TODO: Type this
}

export interface NotePlayPayload {
  readonly noteId: string;
  readonly clipId: string;
  readonly trackId: string;
  readonly audioTime: number;
}

// ====== TIMING EVENTS =======
export type TimingEvent =
  | { type: 'TIMING_TICK'; payload: TimingTickPayload }
  | { type: 'TIMING_BEAT'; payload: { beat: number; audioTime: number } }
  | { type: 'TIMING_BAR'; payload: { bar: number; beat: number; audioTime: number } };

export interface TimingTickPayload {
  readonly currentBeat: number;
  readonly audioTime: number;
  readonly bpm: number;
  readonly deltaTime: number;
}

// ====== UI EVENTS =======
export type UIEvent =
  | { type: 'UI_SELECTION_CHANGE'; payload: UISelectionPayload }
  | { type: 'UI_ZOOM_CHANGE'; payload: { horizontal: number; vertical?: number } }
  | { type: 'UI_VIEW_CHANGE'; payload: { view: 'session' | 'arrangement' | 'piano-roll' } };

export interface UISelectionPayload {
  readonly selectedClips: string[];
  readonly selectedNotes: string[];
  readonly selectedTracks: string[];
}

// ====== ALL EVENTS =======
export type DawEvent =
  | TransportEvent
  | ClipEvent
  | NoteEvent
  | TimingEvent
  | UIEvent
  ;
