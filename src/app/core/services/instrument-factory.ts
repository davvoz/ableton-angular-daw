import { Injectable, inject } from '@angular/core';
import { BaseInstrument } from '../interfaces/base-instrument.interface';
import { InstrumentDefinition } from '../models/instrument.model';
import { InstrumentRegistryService } from './instrument-registry';
import { AudioEngineService } from '../../audio/audio-engine';

// Import delle implementazioni degli strumenti
import { SynthInstrument } from '../../audio/instruments/synth-instrument.instrument';
import { DrumInstrument } from '../../audio/instruments/drum-instrument.instrument';
import { BassInstrument } from '../../audio/instruments/bass-instrument.instrument';

@Injectable({
  providedIn: 'root'
})
export class InstrumentFactoryService {
  // OBBLIGATORIO: Dependency injection
  private instrumentRegistry = inject(InstrumentRegistryService);
  private audioEngine = inject(AudioEngineService);

  // OBBLIGATORIO: Contatore per ID univoci
  private instanceCounter = 0;

  constructor() { }

  // OBBLIGATORIO: Factory method principale
  createInstrument(definitionId: string, trackId: string): BaseInstrument | null {
    const definition = this.instrumentRegistry.getInstrument(definitionId);
    if (!definition) {
      console.error(`Instrument definition not found: ${definitionId}`);
      return null;
    }

    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) {
      console.error('AudioContext not available');
      return null;
    }

    const instanceId = this.generateInstanceId(definitionId, trackId);    try {
      const instrument = this.createInstrumentInstance(definition, audioContext, instanceId);
      
      if (instrument) {        // OBBLIGATORIO: Connetti strumento all'AudioEngine output
        const compressor = this.audioEngine.getMasterCompressor();
        if (compressor) {
          instrument.getAudioNode().connect(compressor);
          console.log(`🔗 Connected instrument ${instrument.name} to audio output`);
        }
        
        // Applica preset di default
        this.applyDefaultPreset(instrument, definition);
        console.log(`🎹 Created instrument: ${definition.name} (${instanceId})`);
      }

      return instrument;
    } catch (error) {
      console.error(`Failed to create instrument ${definitionId}:`, error);
      return null;
    }
  }

  // OBBLIGATORI: Instrument creation per tipo
  private createInstrumentInstance(
    definition: InstrumentDefinition, 
    audioContext: AudioContext, 
    instanceId: string
  ): BaseInstrument | null {
    
    try {      switch (definition.type) {
        case 'synth':
          return new SynthInstrument(audioContext, instanceId);
          
        case 'drum':
          return new DrumInstrument(audioContext, instanceId);
          
        case 'bass':
          return new BassInstrument(audioContext, instanceId);
          
        default:
          console.error(`Unknown instrument type: ${definition.type}`);
          return null;
      }
      
    } catch (error) {
      console.error(`Failed to create instrument ${definition.name}:`, error);
      return null;
    }
  }

  // OBBLIGATORI: Instance management
  private generateInstanceId(definitionId: string, trackId: string): string {
    return `${definitionId}-${trackId}-${++this.instanceCounter}`;
  }

  private applyDefaultPreset(instrument: BaseInstrument, definition: InstrumentDefinition): void {
    if (definition.defaultPreset) {
      Object.entries(definition.defaultPreset).forEach(([paramId, value]) => {
        instrument.setParameter(paramId, value);
      });
      
      console.log(`🎛️ Applied default preset to ${instrument.name}`);
    }
  }

  // OBBLIGATORI: Batch creation per performance
  createMultipleInstruments(definitions: { definitionId: string; trackId: string }[]): BaseInstrument[] {
    const instruments: BaseInstrument[] = [];
    
    definitions.forEach(({ definitionId, trackId }) => {
      const instrument = this.createInstrument(definitionId, trackId);
      if (instrument) {
        instruments.push(instrument);
      }
    });
    
    console.log(`🎵 Created ${instruments.length}/${definitions.length} instruments`);
    return instruments;
  }

  // OBBLIGATORI: Validation e info
  isInstrumentTypeSupported(type: string): boolean {
    return ['synth', 'drum', 'bass'].includes(type);
  }

  getSupportedTypes(): string[] {
    return ['synth', 'drum', 'bass'];
  }

  getInstrumentCapabilities(definitionId: string): { hasParameterAutomation: boolean; supportsPolyphony: boolean; hasPresets: boolean } {
    const definition = this.instrumentRegistry.getInstrument(definitionId);    return {
      hasParameterAutomation: (definition?.parameters?.size || 0) > 0,
      supportsPolyphony: definition?.type !== 'drum', // Drum kits are usually monophonic per pad
      hasPresets: definition?.defaultPreset !== undefined
    };
  }
}
