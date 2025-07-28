import { Injectable, inject, signal, computed } from '@angular/core';
import { StateService } from '../services/state';
import { EventBus } from '../events/event-bus';

@Injectable({
  providedIn: 'root'
})
export class TimingEngine {
  private readonly stateService = inject(StateService);
  private readonly eventBus = inject(EventBus);
  
  private _isRunning = signal<boolean>(false);
  private _currentBeat = signal<number>(0);
  private _audioTime = signal<number>(0);
  
  readonly isRunning = this._isRunning.asReadonly();
  readonly currentBeat = this._currentBeat.asReadonly();
  readonly audioTime = this._audioTime.asReadonly();
  
  private rafId?: number;
  private audioContext?: AudioContext;
  private startTime = 0;
  private startBeat = 0;
  private lastTickTime = 0;
  private bpm = 120;
  
  constructor() {
    this.syncWithState();
  }
  
  private syncWithState(): void {
    // Subscribe to BPM changes from state
    this.eventBus.on('TRANSPORT_BPM_CHANGE', ({payload}) => {
      this.bpm = payload.bpm;
    });
  }
  
  start(fromBeat: number = 0): Promise<void> {
    if (this._isRunning()) return Promise.resolve();
    
    // Initialize or resume AudioContext
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    } else if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    return this.audioContext.resume().then(() => {
      this.startTime = this.audioContext!.currentTime;
      this.startBeat = fromBeat;
      this.lastTickTime = performance.now();
      this.bpm = this.stateService.transport().bpm;
      
      this._currentBeat.set(fromBeat);
      this._audioTime.set(this.startTime);
      this._isRunning.set(true);
      
      this.tick();
      
      this.eventBus.emit({
        type: 'TRANSPORT_PLAY',
        payload: {
          startBeat: fromBeat,
          resumeFromPause: false
        }
      });
      
      console.log(`▶️ Timing engine started at beat ${fromBeat}, audio time ${this.startTime}`);
    });
  }
  
  stop(): void {
    if (!this._isRunning()) return;
    
    this._isRunning.set(false);
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
    
    this.eventBus.emit({
      type: 'TRANSPORT_STOP',
      payload: {}
    });
    
    console.log(`⏹️ Timing engine stopped at beat ${this.currentBeat()}`);
  }
  
  setPosition(beat: number): void {
    this.startBeat = beat;
    if (this.audioContext) {
      this.startTime = this.audioContext.currentTime;
    }
    this._currentBeat.set(beat);
    
    console.log(`⏱️ Timing engine position set to beat ${beat}`);
  }
  
  private tick(): void {
    if (!this._isRunning() || !this.audioContext) return;
    
    const now = performance.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;
    
    const currentAudioTime = this.audioContext.currentTime;
    const elapsedAudioTime = currentAudioTime - this.startTime;
    const currentBeat = this.startBeat + (elapsedAudioTime * this.bpm) / 60;
    
    this._audioTime.set(currentAudioTime);
    this._currentBeat.set(currentBeat);
    
    // Emit timing events
    this.emitTimingEvents(currentBeat, currentAudioTime, deltaTime);
    
    this.rafId = requestAnimationFrame(() => this.tick());
  }
  
  private emitTimingEvents(beat: number, audioTime: number, deltaTime: number): void {
    // Emit tick event every frame
    this.eventBus.emit({
      type: 'TIMING_TICK',
      payload: { 
        currentBeat: beat, 
        audioTime, 
        bpm: this.bpm, 
        deltaTime 
      }
    });
    
    // Emit beat event on each beat boundary
    const lastBeat = Math.floor(beat - deltaTime * this.bpm / 60);
    const currentBeatInt = Math.floor(beat);
    
    if (currentBeatInt > lastBeat) {
      this.eventBus.emit({
        type: 'TIMING_BEAT',
        payload: { 
          beat: currentBeatInt, 
          audioTime 
        }
      });
      
      // Emit bar event on bar boundary
      const transport = this.stateService.transport();
      const beatsPerBar = transport.timeSignatureNumerator || 4;
      
      if (currentBeatInt % beatsPerBar === 0) {
        this.eventBus.emit({
          type: 'TIMING_BAR',
          payload: { 
            bar: Math.floor(currentBeatInt / beatsPerBar),
            beat: currentBeatInt,
            audioTime 
          }
        });
      }
    }
  }
  
  // OBBLIGATORIO: Conversione tra tempo musicale e tempo audio
  beatToAudioTime(beat: number): number {
    if (!this.audioContext || !this._isRunning()) return 0;
    
    const beatDuration = 60 / this.bpm;
    return this.startTime + ((beat - this.startBeat) * beatDuration);
  }
  
  audioTimeToBeat(audioTime: number): number {
    if (!this.audioContext || !this._isRunning()) return 0;
    
    const elapsedTime = audioTime - this.startTime;
    return this.startBeat + (elapsedTime * this.bpm / 60);
  }
  
  getAudioContext(): AudioContext | undefined {
    return this.audioContext;
  }
}
