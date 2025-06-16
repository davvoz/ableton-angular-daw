import { Injectable, computed, inject } from '@angular/core';
import { StateService } from './state';
import { SequencerService } from './sequencer';
import { MetronomeService } from './metronome.service';
import { AudioEngineService } from '../../audio/audio-engine';
import { ClipManager } from './clip-manager';
import { TransportState } from '../models/transport.model';

@Injectable({
  providedIn: 'root'
})
export class TransportService {  // OBBLIGATORI: Dependency injection
  private stateService = inject(StateService);
  private sequencerService = inject(SequencerService);
  private metronomeService = inject(MetronomeService);
  private audioEngine = inject(AudioEngineService);
  private clipManager = inject(ClipManager);

  // OBBLIGATORI: Computed signals dal StateService
  readonly isPlaying = computed(() => this.stateService.transport().isPlaying);
  readonly isRecording = computed(() => this.stateService.transport().isRecording);
  readonly isLooping = computed(() => this.stateService.transport().isLooping);
  readonly currentTime = computed(() => this.stateService.transport().currentTime);
  readonly bpm = computed(() => this.stateService.transport().bpm);
  readonly transport = computed(() => this.stateService.transport());

  // COMPUTED: Sequencer state
  readonly playheadPosition = computed(() => this.sequencerService.getPlayheadPosition());
  readonly activeNoteCount = computed(() => this.sequencerService.getActiveNoteCount());
  
  // COMPUTED: Metronome state
  readonly isMetronomeOn = computed(() => this.metronomeService.isEnabled());
  readonly metronomeVolume = computed(() => this.metronomeService.volume());

  // OBBLIGATORI: Playback loop management
  private animationFrame?: number;
  private isPlaybackLoopActive = false;

  constructor() { }  // OBBLIGATORI: Controlli playback con sequencer
  async play(): Promise<void> {
    console.log('🎵 Transport: Starting playback');
    
    // Resume AudioContext if suspended - MUST wait for this
    try {
      await this.audioEngine.resumeAudioContext();
      console.log('🔊 AudioContext resumed successfully');
    } catch (error) {
      console.error('❌ Failed to resume AudioContext:', error);
      return;
    }
    
    // Verify AudioContext is running
    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext || audioContext.state !== 'running') {
      console.error('❌ AudioContext not running, cannot start playback');
      return;
    }
    
    console.log('✅ AudioContext state:', audioContext.state);
    
    // Update transport state
    this.stateService.updateTransport({ 
      isPlaying: true,
      isRecording: false 
    });
    
    // Start playback loop for timing
    this.startPlaybackLoop();
    
    // Start active clips
    this.startActiveClips();
    
    // Use sequencer for MIDI timing
    this.sequencerService.play();
  }

  stop(): void {
    console.log('🎵 Transport: Stopping playback');
    
    this.stateService.updateTransport({ 
      isPlaying: false,
      isRecording: false 
    });
    
    this.stopPlaybackLoop();
    this.audioEngine.stopAllClips();
    this.sequencerService.stop();
  }

  pause(): void {
    console.log('🎵 Transport: Pausing playback');
    
    this.stateService.updateTransport({ isPlaying: false });
    this.stopPlaybackLoop();
    this.audioEngine.stopAllClips();
    this.sequencerService.pause();
  }

  resume(): void {
    console.log('🎵 Transport: Resuming playback');
    
    // Resume AudioContext if needed
    this.audioEngine.resumeAudioContext().catch(console.error);
    
    this.stateService.updateTransport({ isPlaying: true });
    this.startPlaybackLoop();
    this.startActiveClips();
    this.sequencerService.resume();
  }
  // OBBLIGATORIO: Recording control
  record(): void {
    const currentTransport = this.stateService.transport();
    
    if (!currentTransport.isRecording) {
      console.log('🔴 Starting recording');
      
      this.stateService.updateTransport({ 
        isRecording: true,
        isPlaying: true // Auto-start playback quando recording
      });
      
      // Use existing sequencer methods
      this.sequencerService.play();
      this.startPlaybackLoop();
      this.startActiveClips();
    } else {
      console.log('⏹️ Stopping recording');
      
      this.stateService.updateTransport({ isRecording: false });
      // Recording stop è gestito dal state change
    }
  }

  // OBBLIGATORI: Transport controls
  toggleRecording(): void {
    this.record();
  }
  togglePlayback(): void {
    if (this.isPlaying()) {
      this.stop();
    } else {
      this.play();
    }
  }  // OBBLIGATORI: BPM and timing controls
  setBpm(bpm: number): void {
    const clampedBpm = Math.max(60, Math.min(200, bpm));
    this.stateService.updateTransport({ bpm: clampedBpm });
    
    // Force sequencer to sync with new BPM
    this.sequencerService.syncFromTransport();
    
    console.log(`🎵 BPM set to: ${clampedBpm}`);
  }
    setLoop(enabled: boolean, start?: number, end?: number): void {
    const currentTransport = this.stateService.transport();
    const updates: Partial<TransportState> = { isLooping: enabled };
    
    // Set default loop points if not provided
    if (start !== undefined) (updates as any).loopStart = start;
    else if (enabled && currentTransport.loopStart === 0 && currentTransport.loopEnd === 0) {
      (updates as any).loopStart = 0;
    }
    
    if (end !== undefined) (updates as any).loopEnd = end;
    else if (enabled && currentTransport.loopEnd === 0) {
      (updates as any).loopEnd = 16; // Default 4-bar loop
    }
    
    this.stateService.updateTransport(updates);
    
    // Force sequencer to sync with new loop settings
    this.sequencerService.syncFromTransport();
    
    console.log(`🔄 Loop ${enabled ? 'enabled' : 'disabled'} from ${updates.loopStart || currentTransport.loopStart} to ${updates.loopEnd || currentTransport.loopEnd}`);
  }

  // OBBLIGATORI: Metronome controls  
  toggleMetronome(): void {
    this.metronomeService.toggle();
  }

  setMetronomeVolume(volume: number): void {
    this.metronomeService.setVolume(volume);
  }
  // OBBLIGATORI: Playback loop per sync audio  
  private startPlaybackLoop(): void {
    if (this.isPlaybackLoopActive) return;
    
    this.isPlaybackLoopActive = true;
    
    const loop = () => {
      if (!this.isPlaybackLoopActive) return;
      
      // No transport time updates - sequencer handles all timing
      // Continue loop for any future UI updates if needed
      this.animationFrame = requestAnimationFrame(loop);
    };
    
    this.animationFrame = requestAnimationFrame(loop);
  }

  private stopPlaybackLoop(): void {
    this.isPlaybackLoopActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }  // HELPER: Update transport time - DELEGATE TO SEQUENCER
  private updateTransportTime(): void {
    // DISABLED: Let sequencer be the single source of truth for timing
    // The sequencer handles all time updates including loop logic
    // This prevents double playhead updates
    
    // No-op: sequencer handles all timing updates
    return;
  }
  // HELPER: Start clips that should be playing
  private startActiveClips(): void {
    const clips = this.stateService.clips();
    
    console.log(`🎬 Starting active clips, found ${clips.length} clips`);
    
    clips.forEach(clip => {
      console.log(`🔍 Checking clip ${clip.name}: isPlaying=${clip.isPlaying}, noteCount=${clip.noteCount}`);
      
      // Auto-start clips that have notes but aren't marked as playing
      if (!clip.isPlaying && clip.noteCount > 0) {
        console.log(`▶️ Auto-starting clip ${clip.name} with ${clip.noteCount} notes`);
        this.clipManager.updateClip(clip.id, { isPlaying: true });
      }
      
      if (clip.isPlaying) {
        console.log(`🎵 Starting clip ${clip.name} in AudioEngine`);
        this.audioEngine.startClip(clip.id);
      }
    });
  }

  setMetronomeSound(sound: 'click' | 'beep' | 'tick'): void {
    this.metronomeService.setSound(sound);
  }

  setTimeSignature(numerator: number, denominator: number): void {
    this.stateService.updateTransport({ 
      timeSignatureNumerator: numerator,
      timeSignatureDenominator: denominator 
    });
  }

  setQuantizationStrength(strength: number): void {
    const validStrength = Math.max(0, Math.min(1, strength));
    this.stateService.updateTransport({ quantizationStrength: validStrength });
  }

  // OBBLIGATORI: Metodi di controllo mancanti
  toggleLoop(): void {
    const currentTransport = this.stateService.transport();
    this.setLoop(!currentTransport.isLooping);
  }
  skipToStart(): void {
    console.log('⏮️ Skipping to start');
    
    this.sequencerService.setCurrentTime(0);
  }
  // OBBLIGATORI: Metodi di navigazione
  skipToEnd(): void {
    const clips = this.stateService.clips();
    if (clips.length === 0) return;
    
    // Find the longest clip to determine end time
    const longestClip = clips.reduce((longest, current) => 
      current.endTime > longest.endTime ? current : longest
    );
    
    this.sequencerService.setCurrentTime(longestClip.endTime);
    
    console.log('⏭️ Skipped to end');
  }
  // OBBLIGATORI: Controlli di tempo - delegate to sequencer
  setCurrentTime(time: number): void {
    const clampedTime = Math.max(0, time);
    
    // Delegate to sequencer instead of updating directly
    this.sequencerService.setCurrentTime(clampedTime);
  }
  // OBBLIGATORI: Snap to grid - delegate to sequencer
  snapCurrentTimeToGrid(): void {
    const currentTime = this.currentTime();
    const transport = this.stateService.transport();
    const quantization = this.parseQuantization(transport.quantization);
    
    const snappedTime = Math.round(currentTime / quantization) * quantization;
    this.sequencerService.setCurrentTime(snappedTime);
    
    console.log(`📍 Snapped time to grid: ${snappedTime}`);
  }

  private parseQuantization(quantization: string): number {
    // Convert quantization string to beat fraction
    switch (quantization) {
      case '1/4': return 1;
      case '1/8': return 0.5;
      case '1/16': return 0.25;
      case '1/32': return 0.125;
      default: return 0.25; // Default to 1/16
    }
  }
  // OBBLIGATORI: Controlli avanzati di trasporto
  fastForward(): void {
    const currentTime = this.currentTime();
    const jumpAmount = 4; // 4 beats forward
    this.sequencerService.setCurrentTime(currentTime + jumpAmount);
    console.log('⏩ Fast forward');
  }

  rewind(): void {
    const currentTime = this.currentTime();
    const jumpAmount = 4; // 4 beats backward
    this.sequencerService.setCurrentTime(Math.max(0, currentTime - jumpAmount));
    console.log('⏪ Rewind');
  }
  // OBBLIGATORI: Controlli di quantizzazione
  setQuantization(quantization: '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | '1/1'): void {
    this.stateService.updateTransport({ quantization });
    console.log(`🎯 Quantization set to: ${quantization}`);
  }

  // OBBLIGATORI: Controlli di swing
  setSwing(swing: number): void {
    const clampedSwing = Math.max(0, Math.min(100, swing));
    this.stateService.updateTransport({ swing: clampedSwing });
    console.log(`🎵 Swing set to: ${clampedSwing}%`);
  }
  // OBBLIGATORI: Stato del transport
  resetTransport(): void {
    this.stop();
    this.sequencerService.setCurrentTime(0);
    this.stateService.updateTransport({
      isPlaying: false,
      isRecording: false,
      currentTime: 0,
      currentBar: 0,
      currentBeat: 0,
      currentTick: 0,
      isInLoop: false
    });
    console.log('🔄 Transport reset');
  }
}
