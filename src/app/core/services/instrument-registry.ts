import { Injectable, signal, computed } from '@angular/core';
import { InstrumentDefinition } from '../models/instrument.model';
import { ParameterDefinition } from '../interfaces/parameter-definition.interface';

@Injectable({
  providedIn: 'root'
})
export class InstrumentRegistryService {
  // OBBLIGATORIO: Map-based registry per O(1) lookup
  private _instruments = signal<Map<string, InstrumentDefinition>>(new Map());
  
  // COMPUTED: Getter reattivi
  readonly instruments = computed(() => Array.from(this._instruments().values()));
  readonly instrumentCount = computed(() => this._instruments().size);

  constructor() {
    this.initializeDefaultInstruments();
  }

  // OBBLIGATORIO: Registrazione strumento
  registerInstrument(definition: InstrumentDefinition): void {
    this._instruments.update(instruments => {
      const newMap = new Map(instruments);
      newMap.set(definition.id, definition);
      return newMap;
    });
  }

  // OBBLIGATORIO: Recupero strumento per ID
  getInstrument(id: string): InstrumentDefinition | undefined {
    return this._instruments().get(id);
  }

  // OBBLIGATORIO: Lista strumenti per tipo
  getInstrumentsByType(type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'): InstrumentDefinition[] {
    return Array.from(this._instruments().values()).filter(inst => inst.type === type);
  }

  // OBBLIGATORIO: Lista categorie disponibili
  getCategories(): string[] {
    const categories = new Set<string>();
    this._instruments().forEach(inst => categories.add(inst.category));
    return Array.from(categories).sort();
  }

  // OBBLIGATORIO: Rimozione strumento
  unregisterInstrument(id: string): boolean {
    const currentMap = this._instruments();
    if (currentMap.has(id)) {
      this._instruments.update(instruments => {
        const newMap = new Map(instruments);
        newMap.delete(id);
        return newMap;
      });
      return true;
    }
    return false;
  }

  // PRIVATE: Inizializzazione strumenti di default
  private initializeDefaultInstruments(): void {
    // Synth Definition
    this.registerInstrument({
      id: 'analog-synth',
      name: 'Analog Synth',
      type: 'synth',
      category: 'Lead Synth',
      parameters: new Map<string, ParameterDefinition>([
        ['waveform', { name: 'waveform', min: 0, max: 3, default: 0, step: 1, unit: 'type' }],
        ['cutoff', { name: 'cutoff', min: 20, max: 20000, default: 1000, curve: 'logarithmic', unit: 'Hz' }],
        ['resonance', { name: 'resonance', min: 0.1, max: 30, default: 1, curve: 'logarithmic', unit: 'Q' }],
        ['attack', { name: 'attack', min: 0.001, max: 5, default: 0.1, curve: 'exponential', unit: 's' }],
        ['decay', { name: 'decay', min: 0.001, max: 5, default: 0.2, curve: 'exponential', unit: 's' }],
        ['sustain', { name: 'sustain', min: 0, max: 1, default: 0.6, unit: 'level' }],
        ['release', { name: 'release', min: 0.001, max: 10, default: 0.3, curve: 'exponential', unit: 's' }],
        ['volume', { name: 'volume', min: 0, max: 1, default: 0.8, unit: 'level' }]
      ]),
      defaultPreset: new Map<string, number>([
        ['waveform', 0],
        ['cutoff', 1000],
        ['resonance', 1],
        ['attack', 0.1],
        ['decay', 0.2],
        ['sustain', 0.6],
        ['release', 0.3],
        ['volume', 0.8]
      ]),
      polyphony: 8,
      latency: 0,
      cpuUsage: 0.1,
      icon: '🎹',
      color: '#4CAF50',
      description: 'Classic analog-style synthesizer with filter and ADSR envelope'
    });

    // Bass Definition
    this.registerInstrument({
      id: 'sub-bass',
      name: 'Sub Bass',
      type: 'bass',
      category: 'Bass Synth',
      parameters: new Map<string, ParameterDefinition>([
        ['waveform', { name: 'waveform', min: 0, max: 3, default: 1, step: 1, unit: 'type' }],
        ['subOscillator', { name: 'subOscillator', min: 0, max: 1, default: 0.3, unit: 'level' }],
        ['cutoff', { name: 'cutoff', min: 20, max: 1000, default: 400, curve: 'logarithmic', unit: 'Hz' }],
        ['resonance', { name: 'resonance', min: 0.1, max: 20, default: 5, curve: 'logarithmic', unit: 'Q' }],
        ['drive', { name: 'drive', min: 1, max: 10, default: 2, curve: 'exponential', unit: 'x' }],
        ['saturation', { name: 'saturation', min: 0, max: 1, default: 0.3, unit: 'level' }],
        ['attack', { name: 'attack', min: 0.001, max: 1, default: 0.01, curve: 'exponential', unit: 's' }],
        ['decay', { name: 'decay', min: 0.001, max: 2, default: 0.1, curve: 'exponential', unit: 's' }],
        ['sustain', { name: 'sustain', min: 0, max: 1, default: 0.8, unit: 'level' }],
        ['release', { name: 'release', min: 0.001, max: 5, default: 0.2, curve: 'exponential', unit: 's' }],
        ['volume', { name: 'volume', min: 0, max: 1, default: 0.9, unit: 'level' }]
      ]),
      defaultPreset: new Map<string, number>([
        ['waveform', 1],
        ['subOscillator', 0.3],
        ['cutoff', 400],
        ['resonance', 5],
        ['drive', 2],
        ['saturation', 0.3],
        ['attack', 0.01],
        ['decay', 0.1],
        ['sustain', 0.8],
        ['release', 0.2],
        ['volume', 0.9]
      ]),
      polyphony: 4,
      latency: 0,
      cpuUsage: 0.15,
      icon: '🔊',
      color: '#FF5722',
      description: 'Heavy sub bass with sub-oscillator and distortion'
    });

    // Drum Definition
    this.registerInstrument({
      id: '808-drums',
      name: '808 Drums',
      type: 'drum',
      category: 'Drum Machine',
      parameters: new Map<string, ParameterDefinition>([
        ['kickTune', { name: 'kickTune', min: -12, max: 12, default: 0, step: 1, unit: 'semitones' }],
        ['kickDecay', { name: 'kickDecay', min: 0.1, max: 2.0, default: 0.5, curve: 'exponential', unit: 's' }],
        ['kickPunch', { name: 'kickPunch', min: 0, max: 1, default: 0.7, unit: 'level' }],
        ['snareTune', { name: 'snareTune', min: -12, max: 12, default: 0, step: 1, unit: 'semitones' }],
        ['snareSnap', { name: 'snareSnap', min: 0, max: 1, default: 0.8, unit: 'level' }],
        ['hihatDecay', { name: 'hihatDecay', min: 0.05, max: 1.0, default: 0.2, curve: 'exponential', unit: 's' }],
        ['hihatTone', { name: 'hihatTone', min: 1000, max: 15000, default: 8000, curve: 'logarithmic', unit: 'Hz' }],
        ['volume', { name: 'volume', min: 0, max: 1, default: 0.8, unit: 'level' }]
      ]),
      defaultPreset: new Map<string, number>([
        ['kickTune', 0],
        ['kickDecay', 0.5],
        ['kickPunch', 0.7],
        ['snareTune', 0],
        ['snareSnap', 0.8],
        ['hihatDecay', 0.2],
        ['hihatTone', 8000],
        ['volume', 0.8]
      ]),
      polyphony: 16,
      latency: 0,
      cpuUsage: 0.08,
      icon: '🥁',
      color: '#9C27B0',
      description: 'Classic 808-style drum machine with procedural sounds'
    });

    console.log(`🎹 Initialized ${this.instrumentCount()} default instruments`);
  }
}
