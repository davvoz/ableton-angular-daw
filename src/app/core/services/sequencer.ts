import { Injectable, signal, computed, inject } from '@angular/core';
import { StateService } from './state';
import { AudioEngineService } from '../../audio/audio-engine';
import { InstrumentFactoryService } from './instrument-factory';
import { ClipManager } from './clip-manager';
import { MetronomeService } from './metronome.service';
import { MidiNote } from '../models/midi-note.model';
import { Clip } from '../models/clip.model';
import { Track } from '../models/track.model';

interface ScheduledNote {
  note: MidiNote;
  clipId: string;
  trackId: string;
  absoluteStartTime: number;
  absoluteEndTime: number;
  instrumentId?: string;
}

interface PlayheadPosition {
  beats: number;
  bars: number;
  sixteenths: number;
  ticks: number;
}

@Injectable({
  providedIn: 'root'
})
export class SequencerService {
  // OBBLIGATORI: Dependency injection
  private stateService = inject(StateService);
  private audioEngine = inject(AudioEngineService);
  private instrumentFactory = inject(InstrumentFactoryService);
  private clipManager = inject(ClipManager);
  private metronomeService = inject(MetronomeService);
  // OBBLIGATORI: Sequencer state
  private _isPlaying = signal<boolean>(false);
  private _currentTime = signal<number>(0); // In beats
  private _bpm = signal<number>(120);
  private _timeSignature = signal<{ numerator: number; denominator: number }>({ numerator: 4, denominator: 4 });
  private _isLooping = signal<boolean>(false);
  private _loopStart = signal<number>(0);
  private _loopEnd = signal<number>(16);
  private _swing = signal<number>(0); // 0-100%
  private _quantization = signal<number>(16); // 1/16 notes
  
  // METRONOMO: Traccia ultimo beat per evitare duplicati
  private _lastMetronomeBeat = -1;  // OBBLIGATORI: Scheduling
  private _scheduledNotes = signal<ScheduledNote[]>([]);
  private _activeNotes = signal<Map<string, { note: MidiNote; instrument: any }>>(new Map());
  private _lookAhead = 20.0; // ms - Ridotto per meno jitter del playhead
  private _scheduleAheadTime = 0.1; // seconds
  private _nextNoteTime = 0.0; // When the next note is due
  private _timerID: number | null = null;
  private _playStartTime = 0.0; // Audio time when play started
  private _playStartBeat = 0.0; // Beat time when play started

  // COMPUTED: Reactive getters
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly bpm = this._bpm.asReadonly();
  readonly timeSignature = this._timeSignature.asReadonly();
  readonly isLooping = this._isLooping.asReadonly();
  readonly loopStart = this._loopStart.asReadonly();
  readonly loopEnd = this._loopEnd.asReadonly();
  readonly swing = this._swing.asReadonly();
  readonly quantization = this._quantization.asReadonly();
  readonly activeNotes = this._activeNotes.asReadonly();  // COMPUTED: Playhead position
  readonly playheadPosition = computed((): PlayheadPosition => {
    const beats = this._currentTime();
    const timeSignature = this._timeSignature();
    const beatsPerBar = timeSignature.numerator;
    
    const bars = Math.floor(beats / beatsPerBar);
    const remainingBeats = beats % beatsPerBar;
    const sixteenths = Math.floor(remainingBeats * 4);
    const ticks = Math.floor((remainingBeats * 4 - sixteenths) * 960); // 960 ticks per quarter note

    return { beats, bars, sixteenths, ticks };
  });

  // COMPUTED: Beats per second for timing calculations
  readonly beatsPerSecond = computed(() => this._bpm() / 60);

  // COMPUTED: Current playing clips
  readonly playingClips = computed(() => {
    if (!this._isPlaying()) return [];
    
    const currentTime = this._currentTime();
    const tracks = this.stateService.tracks();
    const playingClips: Array<{ clip: Clip; track: Track }> = [];

    tracks.forEach(track => {
      if (track.isMuted || !track.clips) return;
      
      Array.from(track.clips.values()).forEach(clip => {
        if (this.isClipPlayingAtTime(clip, currentTime)) {
          playingClips.push({ clip, track });
        }
      });
    });

    return playingClips;
  });

  constructor() {
    // Sync with transport state
    this.syncWithTransportState();
  }
  // OBBLIGATORIO: Sync with StateService transport
  private syncWithTransportState(): void {
    const transport = this.stateService.transport();
    
    this._isPlaying.set(transport.isPlaying);
    this._bpm.set(transport.bpm);
    this._isLooping.set(transport.isLooping);
    this._loopStart.set(transport.loopStart);
    this._loopEnd.set(transport.loopEnd);
    this._currentTime.set(transport.currentTime);
    
    console.log(`🔄 Sequencer synced: loop=${transport.isLooping}, start=${transport.loopStart}, end=${transport.loopEnd}`);
  }// OBBLIGATORIO: Transport controls
  play(): void {
    if (this._isPlaying()) return;

    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return;

    this._isPlaying.set(true);
    this._nextNoteTime = audioContext.currentTime;
    this._playStartTime = audioContext.currentTime;
    
    // IMPORTANTE: Se non specificato diversamente, inizia sempre da 0
    this._playStartBeat = this._currentTime() || 0;
    this._currentTime.set(this._playStartBeat); // Assicurati che sia sincronizzato
    
    this._lastMetronomeBeat = -1; // Reset metronomo
    
    // Update state service
    this.stateService.updateTransport({ isPlaying: true });
    
    // Start scheduler
    this.startScheduler();
    
    console.log(`🎵 Sequencer started at beat ${this._playStartBeat}, audio time ${this._playStartTime}`);
  }

  stop(): void {
    if (!this._isPlaying()) return;

    this._isPlaying.set(false);
    
    // Stop all active notes
    this.stopAllActiveNotes();
    
    // Clear scheduler
    this.stopScheduler();
    
    // Reset position
    this._currentTime.set(0);
    
    // Update state service
    this.stateService.updateTransport({ 
      isPlaying: false,
      currentTime: 0
    });
    
    console.log('⏹️ Sequencer stopped');
  }

  pause(): void {
    if (!this._isPlaying()) return;

    this._isPlaying.set(false);
    this.stopScheduler();
    this.stopAllActiveNotes();
    
    // Update state service
    this.stateService.updateTransport({ isPlaying: false });
    
    console.log('⏸️ Sequencer paused');
  }

  resume(): void {
    if (this._isPlaying()) return;

    this._isPlaying.set(true);
    this._nextNoteTime = this.audioEngine.getAudioContext()?.currentTime || 0;
    this.startScheduler();
    
    // Update state service
    this.stateService.updateTransport({ isPlaying: true });
    
    console.log('▶️ Sequencer resumed');
  }
  // OBBLIGATORIO: Position controls
  setPosition(beats: number): void {
    const clampedBeats = Math.max(0, beats);
    const wasPlaying = this._isPlaying();
    
    // Temporarily stop scheduler to avoid conflicts
    if (wasPlaying) {
      this.stopScheduler();
    }
    
    this._currentTime.set(clampedBeats);
    
    // Update state service with full transport state
    this.stateService.updateTransport({ 
      currentTime: clampedBeats,
      currentBeat: Math.floor(clampedBeats % 4),
      currentBar: Math.floor(clampedBeats / 4),
      currentTick: Math.floor((clampedBeats % 1) * 960),
      isInLoop: this._isLooping() && 
                clampedBeats >= this._loopStart() && 
                clampedBeats <= this._loopEnd()
    });
    
    // If playing, reschedule from new position
    if (wasPlaying) {
      this.stopAllActiveNotes();
      this.rescheduleFromCurrentPosition();
      
      // Update timing for new position
      const audioContext = this.audioEngine.getAudioContext();
      if (audioContext) {
        this._playStartTime = audioContext.currentTime;
        this._playStartBeat = clampedBeats;
        this._nextNoteTime = audioContext.currentTime;
      }
      
      // Restart scheduler
      this.startScheduler();
    }
  }
  setBpm(bpm: number): void {
    const clampedBpm = Math.max(60, Math.min(200, bpm));
    this._bpm.set(clampedBpm);
    
    // Update state service
    this.stateService.updateTransport({ bpm: clampedBpm });
    
    console.log(`🎵 Sequencer BPM set to: ${clampedBpm}`);
  }

  setLoop(enabled: boolean, start?: number, end?: number): void {
    this._isLooping.set(enabled);
    
    if (start !== undefined) {
      this._loopStart.set(Math.max(0, start));
    }
    
    if (end !== undefined) {
      this._loopEnd.set(Math.max(this._loopStart() + 1, end));
    }
    
    // Update state service
    this.stateService.updateTransport({
      isLooping: enabled,
      loopStart: this._loopStart(),
      loopEnd: this._loopEnd()
    });
    
    console.log(`🔄 Sequencer loop: ${enabled}, start=${this._loopStart()}, end=${this._loopEnd()}`);
  }

  // OBBLIGATORIO: Clip playback control
  startClip(clipId: string): void {
    const clip = this.clipManager.getClip(clipId);
    if (!clip) return;

    // Find track for this clip
    const track = this.stateService.tracks().find(t => 
      Array.from(t.clips.values()).some(c => c.id === clipId)
    );
    
    if (!track) return;

    // Mark clip as playing
    this.clipManager.updateClip(clipId, { isPlaying: true });
    
    // If sequencer is playing, schedule notes immediately
    if (this._isPlaying()) {
      this.scheduleClipNotes(clip, track);
    }
    
    console.log(`🎵 Started clip: ${clip.name}`);
  }

  stopClip(clipId: string): void {
    const clip = this.clipManager.getClip(clipId);
    if (!clip) return;

    // Mark clip as not playing
    this.clipManager.updateClip(clipId, { isPlaying: false });
    
    // Stop any active notes from this clip
    this.stopNotesFromClip(clipId);
    
    console.log(`⏹️ Stopped clip: ${clip.name}`);
  }

  // PRIVATE: Scheduler implementation
  private startScheduler(): void {
    this.scheduler();
  }

  private stopScheduler(): void {
    if (this._timerID) {
      clearTimeout(this._timerID);
      this._timerID = null;
    }
  }  private scheduler(): void {
    if (!this._isPlaying()) return;

    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return;

    // IMPORTANTE: Aggiorna la posizione corrente anche se non ci sono note da schedulare
    const currentBeatTime = this.audioTimeToBeatTime(audioContext.currentTime);
    this._currentTime.set(currentBeatTime);

    // Update transport state with all fields (single source of truth)
    this.stateService.updateTransport({ 
      currentTime: currentBeatTime,
      currentBeat: Math.floor(currentBeatTime % 4),
      currentBar: Math.floor(currentBeatTime / 4),
      currentTick: Math.floor((currentBeatTime % 1) * 960),
      isInLoop: this._isLooping() && 
                currentBeatTime >= this._loopStart() && 
                currentBeatTime <= this._loopEnd()
    });

    // Look ahead and schedule notes
    while (this._nextNoteTime < audioContext.currentTime + this._scheduleAheadTime) {
      this.scheduleNote(this._nextNoteTime);
      
      // SEPARATO: Schedule metronomo solo sui beat principali
      this.scheduleMetronomeIfNeeded(this._nextNoteTime);
      
      this.nextNote();
    }

    // Continue scheduling
    this._timerID = setTimeout(() => this.scheduler(), this._lookAhead);
  }private scheduleNote(time: number): void {
    // Convert audio time to beat time
    let beatTime = this.audioTimeToBeatTime(time);
    let isLoopReset = false;
    
    // Handle looping BEFORE updating position
    if (this._isLooping() && beatTime >= this._loopEnd()) {
      console.log(`🔄 Loop detected at beat ${beatTime}, resetting to ${this._loopStart()}`);
      
      // Calculate how much we've overshot the loop end
      const overshoot = beatTime - this._loopEnd();
      const loopLength = this._loopEnd() - this._loopStart();
      
      // Reset to loop start plus any overshoot (wrapped within loop)
      beatTime = this._loopStart() + (overshoot % loopLength);
      isLoopReset = true;
        // Reset timing calculations for the new loop iteration
      const audioContext = this.audioEngine.getAudioContext();
      if (audioContext) {
        // Important: Reset the play start time to now, and beat to the new loop position
        this._playStartTime = audioContext.currentTime;
        this._playStartBeat = beatTime;
      }
      
      console.log(`🔄 Loop reset: new beat time ${beatTime}, playStartTime ${this._playStartTime}, playStartBeat ${this._playStartBeat}`);
    }
    
    // Update current position
    this._currentTime.set(beatTime);    // Schedule notes for all playing clips at this time
    this.playingClips().forEach(({ clip, track }) => {
      if (isLoopReset) {
        // Force scheduling at loop start to ensure notes are retriggered
        console.log(`🔄 Forcing note scheduling at loop reset for clip ${clip.name}`);
        this.forceScheduleNotesAtLoopStart(clip, track, beatTime, time);
      } else {
        // Normal scheduling
        this.scheduleClipNotesAtTime(clip, track, beatTime, time);
      }
    });

    // Note: Transport state is updated in the main scheduler() method to avoid duplicates
  }private scheduleMetronomeIfNeeded(audioTime: number): void {
    if (!this.metronomeService.isEnabled()) return;

    const beatTime = this.audioTimeToBeatTime(audioTime);
    const currentBeat = Math.floor(beatTime);
    
    // CRUCIALE: Suona solo se è un nuovo beat
    if (currentBeat !== this._lastMetronomeBeat && currentBeat >= 0) {
      this._lastMetronomeBeat = currentBeat;
      
      const timeSignature = this._timeSignature();
      const beatsPerBar = timeSignature.numerator;
      const beatInBar = currentBeat % beatsPerBar;
      const isDownbeat = beatInBar === 0;
      
      this.metronomeService.playClickAtTime(audioTime, isDownbeat);
    }
  }

  private nextNote(): void {
    const secondsPerBeat = 60.0 / this._bpm();
    const subdivision = 1.0 / this._quantization(); // 1/16 = 0.0625 beats
    
    this._nextNoteTime += subdivision * secondsPerBeat;
  }  private scheduleClipNotesAtTime(clip: Clip, track: Track, beatTime: number, audioTime: number): void {
    if (!clip.isPlaying) {
      console.log(`⏸️ Clip ${clip.name} not playing, skipping scheduling`);
      return;
    }

    console.log(`🎼 Scheduling notes for clip ${clip.name} at beat ${beatTime}, notes: ${clip.noteCount}`);

    // Get notes that should play at this beat time
    const clipLocalTime = beatTime % clip.length; // Loop within clip
    const tolerance = 1.0 / this._quantization(); // Full subdivision tolerance for better detection

    Array.from(clip.notes.values()).forEach(note => {
      const timeDifference = Math.abs(note.startTime - clipLocalTime);
      
      if (timeDifference < tolerance) {
        console.log(`🎵 Note ${note.note} should play at beat ${beatTime} (clip local time ${clipLocalTime}, note start ${note.startTime}, diff ${timeDifference})`);
        this.playNoteAtTime(note, track, audioTime);
      }
      
      // Check for note end
      const endTimeDifference = Math.abs(note.endTime - clipLocalTime);
      if (endTimeDifference < tolerance) {
        this.stopNoteAtTime(note, track, audioTime);
      }
    });
  }
  private playNoteAtTime(note: MidiNote, track: Track, audioTime: number): void {
    // Get or create instrument for track
    const instrument = this.getInstrumentForTrack(track);
    if (!instrument) {
      console.warn(`❌ No instrument available for track ${track.name}`);
      return;
    }

    console.log(`🎵 Playing note ${note.note} on track ${track.name} at audio time ${audioTime}`);

    // Apply swing
    const swingOffset = this.calculateSwingOffset(note.startTime);
    const scheduledTime = audioTime + swingOffset;

    // Schedule note start
    setTimeout(() => {
      console.log(`🎹 Starting note ${note.note} with velocity ${note.velocity}`);
      instrument.play(note);
      
      // Track active note
      this._activeNotes.update(notes => {
        const newNotes = new Map(notes);
        newNotes.set(`${track.id}-${note.id}`, { note, instrument });
        return newNotes;
      });
    }, Math.max(0, (scheduledTime - (this.audioEngine.getAudioContext()?.currentTime || 0)) * 1000));

    // Schedule note end
    const noteEndTime = scheduledTime + (note.duration * 60 / this._bpm());
    setTimeout(() => {
      this.stopNoteAtTime(note, track, noteEndTime);
    }, Math.max(0, (noteEndTime - (this.audioEngine.getAudioContext()?.currentTime || 0)) * 1000));
  }

  private stopNoteAtTime(note: MidiNote, track: Track, audioTime: number): void {
    const noteKey = `${track.id}-${note.id}`;
    const activeNote = this._activeNotes().get(noteKey);
    
    if (activeNote) {
      setTimeout(() => {
        activeNote.instrument.stop(note);
        
        // Remove from active notes
        this._activeNotes.update(notes => {
          const newNotes = new Map(notes);
          newNotes.delete(noteKey);
          return newNotes;
        });
      }, Math.max(0, (audioTime - (this.audioEngine.getAudioContext()?.currentTime || 0)) * 1000));
    }
  }
  private getInstrumentForTrack(track: Track): any {
    // Get or create instrument instance for track
    if (!track.instrumentId) {
      console.warn(`❌ Track ${track.name} has no instrumentId`);
      return null;
    }
    
    console.log(`🔍 Getting instrument for track ${track.name}, instrumentId: ${track.instrumentId}`);
    
    // Try to get existing instrument from AudioEngine
    let instrument = this.audioEngine.acquireInstrument(track.instrumentId);
    
    if (!instrument) {
      console.log(`🏭 Creating new instrument for track ${track.name}`);
      // Create new instrument
      instrument = this.instrumentFactory.createInstrument(track.instrumentId, track.id);
      
      if (instrument) {
        console.log(`✅ Created instrument: ${instrument.name} for track ${track.name}`);
      } else {
        console.error(`❌ Failed to create instrument for track ${track.name}`);
      }
    } else {
      console.log(`♻️ Reusing existing instrument for track ${track.name}`);
    }
    
    return instrument;
  }

  private calculateSwingOffset(beatTime: number): number {
    const swing = this._swing() / 100; // 0-1
    const subdivision = 1.0 / this._quantization();
    const isOffBeat = (beatTime % (subdivision * 2)) >= subdivision;
    
    if (isOffBeat && swing > 0) {
      return swing * subdivision * 0.1; // Small timing offset
    }
      return 0;
  }  // UTILITY: Time conversion (SEMPLIFICATO)
  private audioTimeToBeatTime(audioTime: number): number {
    if (!this._isPlaying()) return this._currentTime();
    
    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return this._currentTime();
    
    // Calcola semplicemente i secondi trascorsi dall'inizio
    const elapsedSeconds = audioTime - this._playStartTime;
    
    // Converti in beat: beats = secondi * (BPM / 60)
    const bpm = this._bpm();
    const elapsedBeats = elapsedSeconds * (bpm / 60);
    
    // Posizione finale
    const finalPosition = this._playStartBeat + elapsedBeats;
    
    // Log solo ogni 0.5 secondi per debug
    if (Math.floor(elapsedSeconds * 2) !== Math.floor((elapsedSeconds - 0.05) * 2)) {
      console.log(`Time calc: ${elapsedSeconds.toFixed(2)}s, BPM: ${bpm}, Beats: ${finalPosition.toFixed(2)}`);
    }
    
    return Math.max(0, finalPosition); // Non andare mai sotto 0
  }

  private beatTimeToAudioTime(beatTime: number): number {
    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return 0;
    
    const beatDifference = beatTime - this._currentTime();
    const timeDifference = beatDifference / this.beatsPerSecond();
    
    return audioContext.currentTime + timeDifference;
  }

  // UTILITY: Clip scheduling
  private scheduleClipNotes(clip: Clip, track: Track): void {
    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return;

    const scheduledNotes: ScheduledNote[] = [];
    const currentTime = this._currentTime();

    Array.from(clip.notes.values()).forEach(note => {
      const absoluteStartTime = currentTime + note.startTime;
      const absoluteEndTime = currentTime + note.endTime;

      scheduledNotes.push({
        note,
        clipId: clip.id,
        trackId: track.id,
        absoluteStartTime,
        absoluteEndTime,
        instrumentId: track.instrumentId
      });
    });

    this._scheduledNotes.update(notes => [...notes, ...scheduledNotes]);
  }

  private isClipPlayingAtTime(clip: Clip, time: number): boolean {
    return clip.isPlaying && time >= clip.startTime && time < clip.startTime + clip.length;
  }

  private stopAllActiveNotes(): void {
    this._activeNotes().forEach((activeNote, key) => {
      activeNote.instrument.stop(activeNote.note);
    });
    
    this._activeNotes.set(new Map());
  }

  private stopNotesFromClip(clipId: string): void {
    this._activeNotes().forEach((activeNote, key) => {
      if (key.includes(clipId)) {
        activeNote.instrument.stop(activeNote.note);
        this._activeNotes.update(notes => {
          const newNotes = new Map(notes);
          newNotes.delete(key);
          return newNotes;
        });
      }
    });
  }

  private rescheduleFromCurrentPosition(): void {
    // Clear existing scheduled notes
    this._scheduledNotes.set([]);
    
    // Reschedule from current position
    this.playingClips().forEach(({ clip, track }) => {
      this.scheduleClipNotes(clip, track);
    });
  }

  // PUBLIC: API for external control
  getCurrentTime(): number {
    return this._currentTime();
  }

  // PUBLIC: Set current time (delegated from transport)
  setCurrentTime(time: number): void {
    const clampedTime = Math.max(0, time);
    this._currentTime.set(clampedTime);
    
    // Update state service with full transport info
    this.stateService.updateTransport({
      currentTime: clampedTime,
      currentBar: Math.floor(clampedTime / 4),
      currentBeat: Math.floor(clampedTime % 4),
      currentTick: Math.floor((clampedTime % 1) * 960)
    });
    
    // If playing, reschedule from new position
    if (this._isPlaying()) {
      this.stopAllActiveNotes();
      this.rescheduleFromCurrentPosition();
    }
  }

  getPlayheadPosition(): PlayheadPosition {
    return this.playheadPosition();
  }

  isClipPlaying(clipId: string): boolean {
    const clip = this.clipManager.getClip(clipId);
    return clip?.isPlaying || false;
  }

  getActiveNoteCount(): number {
    return this._activeNotes().size;
  }

  // OBBLIGATORIO: Quantization
  quantizePosition(position: number): number {
    const subdivision = 1.0 / this._quantization();
    return Math.round(position / subdivision) * subdivision;
  }

  setQuantization(value: number): void {
    this._quantization.set(Math.max(1, Math.min(64, value)));
  }

  setSwing(value: number): void {
    this._swing.set(Math.max(0, Math.min(100, value)));
  }
  private forceScheduleNotesAtLoopStart(clip: Clip, track: Track, beatTime: number, audioTime: number): void {
    if (!clip.isPlaying) {
      console.log(`⏸️ Clip ${clip.name} not playing, skipping loop start scheduling`);
      return;
    }

    console.log(`🔄 Force scheduling notes for clip ${clip.name} at loop start beat ${beatTime}`);

    // At loop start, we need to check ALL notes in the clip, not just those at the exact loop start
    // This ensures notes that should be playing at the beginning of each loop iteration are triggered
    const clipLocalTime = beatTime % clip.length;
    const tolerance = 1.0 / this._quantization(); // Full subdivision tolerance for better detection
    
    console.log(`🔄 Clip local time: ${clipLocalTime}, tolerance: ${tolerance}, clip length: ${clip.length}`);

    Array.from(clip.notes.values()).forEach(note => {
      // Check if this note should start at the current clip local time
      // We use a more generous tolerance and also check for notes at the very beginning
      const noteStartInClip = note.startTime % clip.length;
      const timeDifference = Math.abs(noteStartInClip - clipLocalTime);
      
      // Also check for notes that start at the very beginning of the clip (time 0)
      const isAtClipStart = noteStartInClip < tolerance;
      const isAtCurrentTime = timeDifference < tolerance;
      
      if (isAtCurrentTime || (clipLocalTime < tolerance && isAtClipStart)) {
        console.log(`🎵 Force playing note ${note.note} at loop iteration - clip local time: ${clipLocalTime}, note start: ${noteStartInClip}, time diff: ${timeDifference}`);
        this.playNoteAtTime(note, track, audioTime);
      }
    });
  }

  // PUBLIC: Force sync with transport service (called when transport settings change)
  syncFromTransport(): void {
    this.syncWithTransportState();
  }
}
