import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Session } from './components/session/session';
import { Transport } from './components/transport/transport';
import { PianoRoll } from './components/piano-roll/piano-roll';
import { SelectionService } from './core/services/selection';
import { StateService } from './core/services/state';
import { TrackFactoryService } from './core/services/track-factory.service';
import { AudioEngineService } from './audio/audio-engine';

type DetailTab = 'clip' | 'device' | 'mix';

@Component({
  selector: 'app-root',
  imports: [CommonModule, Session, Transport, PianoRoll],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'Ableton Angular DAW';  // OBBLIGATORI: Dependency injection
  private selectionService = inject(SelectionService);
  private stateService = inject(StateService);
  private trackFactory = inject(TrackFactoryService);
  private audioEngine = inject(AudioEngineService);// OBBLIGATORI: UI state signals
  private _showTestPanel = signal<boolean>(false);
  private _showDetailView = signal<boolean>(false);
  private _activeDetailTab = signal<DetailTab>('clip');
  private _cpuUsage = signal<number>(0);
  
  // NUOVO: Bottom panel state
  private _activeBottomTab = signal<'piano-roll' | 'instrument' | 'debug'>('piano-roll');
  readonly activeBottomTab = this._activeBottomTab.asReadonly();

  // COMPUTED: Piano Roll state
  readonly selectedClipId = computed(() => {
    const selectedClips = this.selectionService.selectedClipIds();
    return selectedClips.length > 0 ? selectedClips[0] : undefined;
  });

  readonly selectedTrackId = computed(() => {
    const selectedTracks = this.selectionService.selectedTrackIds();
    return selectedTracks.length > 0 ? selectedTracks[0] : undefined;
  });

  readonly selectedTrackName = computed(() => {
    const trackId = this.selectedTrackId();
    if (!trackId) return null;
    const track = this.stateService.getTrack(trackId);
    return track?.name || null;
  });

  readonly selectedTrackInstrument = computed(() => {
    const trackId = this.selectedTrackId();
    if (!trackId) return null;
    const track = this.stateService.getTrack(trackId);
    return track?.instrumentId ? this.stateService.getInstrumentInstance(track.instrumentId) : null;
  });  readonly visibleTracks = computed(() => {
    return this.stateService.getOrderedTracks();
  });
  // COMPUTED: Instruments count
  readonly instrumentCount = computed(() => {
    const instruments = this.stateService.instruments();
    return instruments.size;
  });

  // COMPUTED: Selected device per detail view
  readonly selectedDevice = computed(() => {
    const instrumentId = this.selectedTrackInstrument()?.id;
    if (!instrumentId) return null;
    
    return {
      name: this.selectedTrackInstrument()?.definitionId || 'Unknown Device',
      type: 'instrument'
    };
  });  // PUBLIC: Read-only signals for template
  readonly showTestPanel = this._showTestPanel.asReadonly();
  readonly showDetailView = this._showDetailView.asReadonly();
  readonly activeDetailTab = this._activeDetailTab.asReadonly();
  readonly cpuUsage = this._cpuUsage.asReadonly();  constructor() {
    console.log('🚀 App Component inizializzato');
    
    // Inizializza strumenti all'avvio
    console.log('🎹 Inizializzando strumenti...');
    this.stateService.initializeState();
    
    // 🎵 Add user interaction listener to activate AudioContext
    this.setupAudioContextActivation();
    
    // Auto-show detail view when clip is selected
    effect(() => {
      const clipId = this.selectedClipId();
      if (clipId) {
        this._showDetailView.set(true);
        this._activeDetailTab.set('clip');
      }
    });

    // Auto-show detail view when track is selected
    effect(() => {
      const trackId = this.selectedTrackId();
      if (trackId && !this._showDetailView()) {
        this._showDetailView.set(true);
        this._activeDetailTab.set('device');
      }    });

    // Simulate CPU usage for demo
    this.startCpuMonitoring();
  }

  // 🎵 NUOVO: Setup AudioContext activation on user interaction
  private setupAudioContextActivation(): void {
    const activateAudio = () => {
      try {
        const audioEngine = this.audioEngine;
        const audioContext = audioEngine.getAudioContext();
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            console.log('🔊 AudioContext activated by user interaction');
            // Remove listener after activation
            document.removeEventListener('click', activateAudio);
          });
        }
      } catch (error) {
        console.warn('Could not activate AudioContext:', error);
      }
    };

    // Add global click listener
    document.addEventListener('click', activateAudio, { once: true });
  }// OBBLIGATORI: UI Controls
  toggleTestPanel(): void {
    this._showTestPanel.update(show => !show);
  }// NEW: Track management - Delegated to session component
  delegateAddTrack(): void {
    // Get reference to session component and call its addTrack method
    console.log('Delegating track creation to session component');
    // This will be handled by a ViewChild or service injection
  }  // Keep the direct method for now for compatibility
  addNewTrack(): void {
    const currentTracks = this.stateService.tracks();
    
    const newTrack = this.trackFactory.createTrack({
      type: 'synth', // Default type
      index: currentTracks.length
    });
    
    this.stateService.addTrack(newTrack);
    console.log('Added new track:', newTrack.name, 'ID:', newTrack.id);
  }

  // Track control methods
  selectTrack(trackId: string, event: MouseEvent): void {
    const mode = event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
    this.selectionService.selectTrack(trackId, mode);
  }

  toggleTrackMute(trackId: string): void {
    const track = this.stateService.getTrack(trackId);
    if (track) {
      this.stateService.updateTrack(trackId, { isMuted: !track.isMuted });
    }
  }

  toggleTrackSolo(trackId: string): void {
    const track = this.stateService.getTrack(trackId);
    if (track) {
      this.stateService.updateTrack(trackId, { isSolo: !track.isSolo });
    }
  }

  toggleTrackArm(trackId: string): void {
    const track = this.stateService.getTrack(trackId);
    if (track) {
      this.stateService.updateTrack(trackId, { isArmed: !track.isArmed });
    }  }

  setDetailTab(tab: DetailTab): void {
    this._activeDetailTab.set(tab);
    if (!this._showDetailView()) {
      this._showDetailView.set(true);
    }
  }

  closeDetailView(): void {
    this._showDetailView.set(false);
    // Clear selections to truly close
    this.selectionService.selectNone();
  }

  startResize(event: MouseEvent, direction: 'horizontal' | 'vertical'): void {
    // TODO: Implement panel resizing
  }
    // NUOVO: Bottom panel tab management
  setActiveBottomTab(tab: 'piano-roll' | 'instrument' | 'debug'): void {
    console.log('🎛️ Setting bottom panel tab from:', this._activeBottomTab(), 'to:', tab);
    this._activeBottomTab.set(tab);
    console.log('🎛️ Bottom panel tab is now:', this._activeBottomTab());
  }

  private startCpuMonitoring(): void {
    // Simulate CPU usage fluctuation for demo
    setInterval(() => {
      const baseUsage = 15;
      const variation = Math.random() * 20;
      const isPlaying = this.stateService.isPlaying();
      const playingBoost = isPlaying ? 25 : 0;
      const usage = Math.min(100, baseUsage + variation + playingBoost);      this._cpuUsage.set(Math.round(usage));
    }, 1000);
  }
}
