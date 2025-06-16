import { Injectable, signal, computed } from '@angular/core';
import { BaseInstrument } from '../core/interfaces/base-instrument.interface';

@Injectable({
  providedIn: 'root'
})
export class AudioEngineService {
  // OBBLIGATORI: Audio Context e nodi principali
  private audioContext!: AudioContext;
  private masterGain!: GainNode;
  private compressor!: DynamicsCompressorNode;
  
  // OBBLIGATORI: Object pooling per performance
  private instrumentPool = new Map<string, BaseInstrument[]>();
  private activeInstruments = new Map<string, BaseInstrument>();
  
  // OBBLIGATORI: Stato reattivo
  private _isInitialized = signal<boolean>(false);
  private _masterVolume = signal<number>(0.8);
  private _sampleRate = signal<number>(44100);
  
  // COMPUTED: Getter reattivi
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly masterVolume = this._masterVolume.asReadonly();
  readonly sampleRate = this._sampleRate.asReadonly();
  readonly latency = computed(() => 
    this.audioContext ? this.audioContext.baseLatency * 1000 : 0
  );
  constructor() {
    console.log('🎵 AudioEngine constructor chiamato');
    this.initializeAudioContext();
  }

  // OBBLIGATORIO: Inizializzazione Audio Context
  private async initializeAudioContext(): Promise<void> {
    console.log('🔊 Inizializzando AudioContext...');
    try {
      this.audioContext = new AudioContext({
        sampleRate: 44100,
        latencyHint: 'interactive'
      });
      
      console.log('🎵 AudioContext creato, stato:', this.audioContext.state);

      // OBBLIGATORIO: Master gain chain
      this.masterGain = this.audioContext.createGain();
      this.compressor = this.audioContext.createDynamicsCompressor();
      
      // Audio chain: compressor -> master gain -> destination
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      
      // Configurazione compressor per mastering
      this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
      this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);

      this._sampleRate.set(this.audioContext.sampleRate);
      this._isInitialized.set(true);
      
      console.log('🔊 AudioEngine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AudioEngine:', error);
      throw error;
    }
  }

  // OBBLIGATORI: Pool management per object pooling
  acquireInstrument(instrumentId: string): BaseInstrument | null {
    console.log(`🔄 Acquiring instrument: ${instrumentId}`);
    
    const pool = this.instrumentPool.get(instrumentId) || [];
    let instrument = pool.pop();
    
    if (!instrument) {
      console.log(`🆕 Creating new instrument instance: ${instrumentId}`);
      // Qui dovremmo creare nuove istanze usando InstrumentFactory
      // Per ora ritorniamo null, implementeremo dopo
      return null;
    }
    
    // Reset instrument state per riutilizzo
    instrument.reset();
    this.activeInstruments.set(instrument.id, instrument);
    
    console.log(`✅ Instrument acquired: ${instrumentId}, active count: ${this.activeInstruments.size}`);
    return instrument;
  }

  releaseInstrument(instrument: BaseInstrument): void {
    console.log(`🔄 Releasing instrument: ${instrument.id}`);
    
    // Stop all notes e reset
    instrument.stopAll();
    instrument.reset();
    
    // Remove from active
    this.activeInstruments.delete(instrument.id);
    
    // Return to pool
    const instrumentType = instrument.constructor.name.toLowerCase();
    const pool = this.instrumentPool.get(instrumentType) || [];
    pool.push(instrument);
    this.instrumentPool.set(instrumentType, pool);
    
    console.log(`♻️ Instrument released to pool: ${instrument.id}`);
  }

  // OBBLIGATORI: Playback control
  startClip(clipId: string): void {
    console.log(`▶️ Starting clip: ${clipId}`);
    
    const clip = this.getClipById(clipId);
    if (!clip) {
      console.warn(`⚠️ Clip not found: ${clipId}`);
      return;
    }
    
    const instrument = this.acquireInstrument(clip.instrumentId);
    if (!instrument) {
      console.warn(`⚠️ Instrument not available: ${clip.instrumentId}`);
      return;
    }
    
    // Schedule clip notes
    this.scheduleClipNotes(clip, instrument);
  }

  stopClip(clipId: string): void {
    console.log(`⏹️ Stopping clip: ${clipId}`);
    
    const clip = this.getClipById(clipId);
    if (!clip) return;
    
    const instrument = this.activeInstruments.get(clip.instrumentId);
    if (instrument) {
      instrument.stopAll();
      this.releaseInstrument(instrument);
    }
  }

  stopAllClips(): void {
    console.log(`⏹️ Stopping all clips`);
    
    this.activeInstruments.forEach(instrument => {
      instrument.stopAll();
    });
    
    // Clear all active instruments
    this.activeInstruments.clear();
  }

  // OBBLIGATORI: Master controls
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this._masterVolume.set(clampedVolume);
    
    if (this.masterGain) {
      this.masterGain.gain.value = clampedVolume;
    }
    
    console.log(`🔊 Master volume set to: ${clampedVolume}`);
  }

  // HELPER: Schedule clip notes
  private scheduleClipNotes(clip: any, instrument: BaseInstrument): void {
    // TODO: Implementare scheduling MIDI notes
    console.log(`🎵 Scheduling notes for clip: ${clip.id}`);
  }

  // HELPER: Get clip by ID (integrazione con StateService)
  private getClipById(clipId: string): any {
    // TODO: Integrare con StateService quando disponibile
    return null;
  }
  // OBBLIGATORIO: Gestione user gesture per browsers
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 AudioContext resumed after user gesture');
        console.log('🔊 AudioContext state:', this.audioContext.state);
        console.log('🔊 Master volume:', this.masterGain.gain.value);
        console.log('🔊 Sample rate:', this.audioContext.sampleRate);
      } catch (error) {
        console.error('❌ Failed to resume AudioContext:', error);
        throw error;
      }
    } else if (this.audioContext) {
      console.log('🔊 AudioContext already running:', this.audioContext.state);
      console.log('🔊 Master volume:', this.masterGain.gain.value);
    }
  }

  // OBBLIGATORIO: Check se AudioContext è attivo
  isAudioContextActive(): boolean {
    return this.audioContext && this.audioContext.state === 'running';
  }

  isAudioContextSuspended(): boolean {
    return this.audioContext ? this.audioContext.state === 'suspended' : true;
  }

  // PUBLIC: Getter per AudioContext
  getAudioContext(): AudioContext | undefined {
    return this.audioContext;
  }

  getMasterCompressor(): DynamicsCompressorNode | undefined {
    return this.compressor;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain && this._isInitialized() ? this.masterGain : null;
  }

  // UTILITY: Conversioni audio
  dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  linearToDb(linear: number): number {
    return 20 * Math.log10(linear);
  }

  // CLEANUP: Dispose resources
  dispose(): void {
    this.stopAllClips();
    
    this.activeInstruments.forEach(instrument => {
      instrument.dispose();
    });
    
    this.instrumentPool.forEach(pool => {
      pool.forEach(instrument => instrument.dispose());
    });
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this._isInitialized.set(false);
  }
}
