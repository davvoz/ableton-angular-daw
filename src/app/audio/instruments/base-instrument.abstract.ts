import { BaseInstrument } from '../../core/interfaces/base-instrument.interface';
import { ParameterDefinition } from '../../core/interfaces/parameter-definition.interface';
import { MidiNote } from '../../core/models/midi-note.model';

export abstract class BaseInstrumentImpl implements BaseInstrument {
  // OBBLIGATORI: Identificatori
  readonly id: string;
  readonly name: string;
  readonly type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad';
  // OBBLIGATORI: Audio context e nodi
  protected audioContext: AudioContext;
  public gainNode: GainNode; // Reso pubblico per connessioni esterne
  
  // OBBLIGATORI: Gestione parametri
  protected parameters = new Map<string, number>();
  protected parameterDefinitions: ParameterDefinition[] = [];
  
  // OBBLIGATORI: Stato interno
  protected _isActive = false;
  protected _voiceCount = 0;
  protected activeVoices = new Map<number, AudioNode[]>();

  constructor(
    audioContext: AudioContext,
    id: string,
    name: string,
    type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'
  ) {
    this.audioContext = audioContext;
    this.id = id;
    this.name = name;
    this.type = type;
    
    // OBBLIGATORIO: Crea gain node per output
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
    
    // Inizializza parametri di base
    this.initializeParameters();
  }

  // ABSTRACT: Metodi che devono essere implementati dalle sottoclassi
  abstract play(note: MidiNote): void;
  abstract stop(note: MidiNote): void;
  
  // ASTRATTO: Inizializzazione parametri specifici dello strumento
  protected abstract initializeParameters(): void;
  
  // ASTRATTO: Creazione nodi audio specifici
  protected abstract createVoiceNodes(): AudioNode[];
  // OBBLIGATORI: Implementazioni concrete
  stopAll(): void {
    console.log(`🛑 BaseInstrument.stopAll() called for ${this.name}, active voices: ${this.activeVoices.size}`);
    
    this.activeVoices.forEach((nodes, noteNumber) => {
      console.log(`🛑 Force stopping voice ${noteNumber}`);
      this.forceStopVoice(noteNumber);
    });
    
    // Clear all active voices immediately
    this.activeVoices.clear();
    this._voiceCount = 0;
    this._isActive = false;
    
    console.log(`✅ All voices stopped for ${this.name}`);
  }

  setParameter(name: string, value: number): void {
    // Validazione parametro
    const paramDef = this.parameterDefinitions.find(p => p.name === name);
    if (!paramDef) {
      console.warn(`Parameter '${name}' not found on instrument '${this.name}'`);
      return;
    }
    
    // Clamp value nel range valido
    const clampedValue = Math.max(paramDef.min, Math.min(paramDef.max, value));
    this.parameters.set(name, clampedValue);
    
    // Applica il parametro ai nodi audio
    this.applyParameterToNodes(name, clampedValue);
  }

  getParameter(name: string): number {
    return this.parameters.get(name) ?? 0;
  }

  getParameters(): readonly ParameterDefinition[] {
    return [...this.parameterDefinitions];
  }

  // OBBLIGATORI: Audio routing
  getAudioNode(): AudioNode {
    return this.gainNode;
  }

  reset(): void {
    this.stopAll();
    this.parameters.clear();
    this.initializeParameters();
    this._isActive = false;
  }

  dispose(): void {
    this.stopAll();
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
  }

  // GETTERS: Stato
  get isActive(): boolean {
    return this._isActive;
  }

  get voiceCount(): number {
    return this._voiceCount;
  }

  // METODO REQUIRED: Per il sequencer emergency stop
  getActiveVoiceCount(): number {
    return this._voiceCount;
  }

  // PROTECTED: Utility methods per sottoclassi
  protected addParameterDefinition(definition: ParameterDefinition): void {
    this.parameterDefinitions.push(definition);
    this.parameters.set(definition.name, definition.default);
  }

  protected startVoice(noteNumber: number, nodes: AudioNode[]): void {
    this.activeVoices.set(noteNumber, nodes);
    this._voiceCount = this.activeVoices.size;
    this._isActive = this._voiceCount > 0;
  }
  protected stopVoice(noteNumber: number): void {
    const nodes = this.activeVoices.get(noteNumber);
    if (nodes) {
      nodes.forEach(node => {
        if ('stop' in node && typeof node.stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      });
      this.activeVoices.delete(noteNumber);
    }
    this._voiceCount = this.activeVoices.size;
    this._isActive = this._voiceCount > 0;
  }

  protected forceStopVoice(noteNumber: number): void {
    const nodes = this.activeVoices.get(noteNumber);
    if (nodes) {
      console.log(`🛑 Force stopping voice ${noteNumber} with ${nodes.length} nodes`);
      
      nodes.forEach((node, index) => {
        try {
          if ('stop' in node && typeof node.stop === 'function') {
            // For oscillators, stop immediately to prevent hanging notes
            (node as any).stop(this.audioContext.currentTime);
            console.log(`✅ Stopped node ${index} (oscillator) for voice ${noteNumber}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error stopping node ${index} for voice ${noteNumber}:`, error);
        }
        
        try {
          node.disconnect();
          console.log(`✅ Disconnected node ${index} for voice ${noteNumber}`);
        } catch (error) {
          console.warn(`⚠️ Error disconnecting node ${index} for voice ${noteNumber}:`, error);
        }
      });
      
      this.activeVoices.delete(noteNumber);
      console.log(`✅ Voice ${noteNumber} removed from active voices`);
    }
    this._voiceCount = this.activeVoices.size;
    this._isActive = this._voiceCount > 0;
  }

  protected abstract applyParameterToNodes(parameterName: string, value: number): void;

  // UTILITY: Conversioni MIDI
  protected midiNoteToFrequency(noteNumber: number): number {
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
  }

  protected velocityToGain(velocity: number): number {
    // Conversione da velocità MIDI (0-127) a gain (0-1) con curva logaritmica
    return Math.pow(velocity / 127, 2);
  }
}
