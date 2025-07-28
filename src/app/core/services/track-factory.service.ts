import { Injectable } from '@angular/core';
import { Track } from '../models/track.model';

type InstrumentType = 'synth' | 'drum' | 'bass' | 'lead' | 'pad';

@Injectable({
  providedIn: 'root'
})
export class TrackFactoryService {
  
  createTrack(options: {
    name?: string;
    type: InstrumentType;
    index: number;
  }): Track {
    const defaults = this.getDefaultsForType(options.type);
    
    return {
      id: this.generateTrackId(),
      name: options.name || `${this.capitalizeType(options.type)} ${options.index + 1}`,
      index: options.index,
      clips: new Map(),
      clipOrder: [],
      instrumentId: defaults.instrumentId,      instrumentType: options.type,
      volume: defaults.volume,
      pan: 0,
      gain: 0,
      isMuted: false,
      isSolo: false,
      isSelected: false,
      isFrozen: false,
      color: defaults.color,
      height: defaults.height,
      clipCount: 0,
      totalDuration: 0,
      hasClips: false
    };
  }  private getDefaultsForType(type: InstrumentType) {
    const typeDefaults: Record<InstrumentType, {
      instrumentId: string;
      volume: number;
      color: string;
      height: number;
    }> = {
      synth: { 
        instrumentId: 'analog-synth', 
        volume: 0.8, 
        color: '#4CAF50', 
        height: 80 
      },
      drum: { 
        instrumentId: '808-drums', 
        volume: 0.9, 
        color: '#FF5722', 
        height: 100 
      },
      bass: { 
        instrumentId: 'sub-bass', 
        volume: 0.85, 
        color: '#2196F3', 
        height: 80 
      },
      lead: { 
        instrumentId: 'analog-synth', // Use synth for lead until we have a dedicated lead instrument
        volume: 0.75, 
        color: '#FF9800', 
        height: 80 
      },
      pad: { 
        instrumentId: 'analog-synth', // Use synth for pad until we have a dedicated pad instrument
        volume: 0.7, 
        color: '#9C27B0', 
        height: 80 
      }
    };
    
    return typeDefaults[type];
  }

  private generateTrackId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private capitalizeType(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
