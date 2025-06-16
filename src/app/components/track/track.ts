import { Component, Input, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state';
import { SelectionService } from '../../core/services/selection';
import { ClipManager } from '../../core/services/clip-manager';
import { InstrumentFactoryService } from '../../core/services/instrument-factory';
import { AudioEngineService } from '../../audio/audio-engine';
import { Track as TrackModel } from '../../core/models/track.model';
import { Clip as ClipModel } from '../../core/models/clip.model';
import { MidiNote } from '../../core/models/midi-note.model';
import { InstrumentDefinition } from '../../core/models/instrument.model';
import { BaseInstrument } from '../../core/interfaces/base-instrument.interface';
import { Clip as ClipComponent } from '../clip/clip';
import { InstrumentSelector } from '../instrument-selector/instrument-selector';
import { InstrumentControls } from '../instrument-controls/instrument-controls';

@Component({
  selector: 'app-track',
  standalone: true,
  imports: [CommonModule, ClipComponent, InstrumentSelector, InstrumentControls],
  templateUrl: './track.html',
  styleUrl: './track.scss'
})
export class Track implements OnInit {
  // OBBLIGATORIO: Input track data
  @Input({ required: true }) trackData!: TrackModel;
  @Input() viewportWidth: number = 800;
  @Input() timelineZoom: number = 1.0;
  // OBBLIGATORI: Dependency injection
  private stateService = inject(StateService);
  private selectionService = inject(SelectionService);
  private clipManager = inject(ClipManager);
  private instrumentFactory = inject(InstrumentFactoryService);
  private audioEngine = inject(AudioEngineService);

  // OBBLIGATORI: Local state
  private _clips = signal<ClipModel[]>([]);
  private _isHovered = signal<boolean>(false);
  private _currentInstrument = signal<BaseInstrument | null>(null);
  private _showInstrumentControls = signal<boolean>(false);

  // COMPUTED: Reactive getters
  readonly clips = this._clips.asReadonly();
  readonly isHovered = this._isHovered.asReadonly();
  readonly currentInstrument = this._currentInstrument.asReadonly();
  readonly showInstrumentControls = this._showInstrumentControls.asReadonly();
  readonly disabled = computed(() => false); // TODO: Implement disable logic
  readonly isSelected = computed(() => 
    this.selectionService.isTrackSelected(this.trackData.id)
  );
  readonly clipCount = computed(() => this.clips().length);
  readonly timelineBeats = computed(() => {
    // Generate beat markers for timeline
    const maxBeats = Math.max(32, this.clips().reduce((max, clip) => 
      Math.max(max, clip.startTime + clip.length), 0
    ));
    return Array.from({ length: Math.ceil(maxBeats) }, (_, i) => i);
  });
  ngOnInit(): void {
    this.loadTrackClips();
    this.initializeInstrument();
  }

  // OBBLIGATORIO: Clip management
  private loadTrackClips(): void {
    const trackClips = Array.from(this.trackData.clips.values());
    this._clips.set(trackClips);
  }

  // NUOVO: Instrument management
  private initializeInstrument(): void {
    if (this.trackData.instrumentId) {
      const instrument = this.instrumentFactory.createInstrument(
        this.trackData.instrumentId, 
        this.trackData.id
      );
      this._currentInstrument.set(instrument);
    }
  }

  // NUOVO: Instrument event handlers
  onInstrumentSelected(definition: InstrumentDefinition): void {
    // Create new instrument instance
    const newInstrument = this.instrumentFactory.createInstrument(
      definition.id,
      this.trackData.id
    );
    
    if (newInstrument) {
      // Dispose old instrument
      const oldInstrument = this._currentInstrument();
      if (oldInstrument) {
        this.audioEngine.releaseInstrument(oldInstrument);
      }
      
      // Set new instrument
      this._currentInstrument.set(newInstrument);
      
      // Update track data
      this.stateService.updateTrack(this.trackData.id, {
        instrumentId: definition.id,
        instrumentType: definition.type
      });
      
      console.log(`🎹 Instrument changed: ${definition.name} for track ${this.trackData.name}`);
    }
  }

  onParameterChanged(event: {parameter: string, value: number}): void {
    const instrument = this._currentInstrument();
    if (instrument) {
      instrument.setParameter(event.parameter, event.value);
      console.log(`🔧 Parameter ${event.parameter} = ${event.value} on ${instrument.name}`);
    }
  }

  onNotePlay(note: MidiNote): void {
    const instrument = this._currentInstrument();
    if (instrument) {
      instrument.play(note);
      console.log(`🎵 Playing note ${note.noteName} on ${instrument.name}`);
    }
  }

  onNoteStop(note: MidiNote): void {
    const instrument = this._currentInstrument();
    if (instrument) {
      instrument.stop(note);
      console.log(`🔇 Stopping note ${note.noteName} on ${instrument.name}`);
    }
  }

  // OBBLIGATORI: Event handlers
  onTrackClick(event: MouseEvent): void {
    event.stopPropagation();
    const mode = event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
    this.selectionService.selectTrack(this.trackData.id, mode);
  }
  onTrackDoubleClick(): void {
    // Toggle instrument controls on double-click
    this._showInstrumentControls.update(show => !show);
    console.log(`🎵 Toggled instrument controls for track: ${this.trackData.name}`);
  }

  onMouseEnter(): void {
    this._isHovered.set(true);
  }

  onMouseLeave(): void {
    this._isHovered.set(false);
  }
  // OBBLIGATORIO: Clip creation
  createClip(startTime: number): void {
    try {
      const clip = this.clipManager.createClip(this.trackData.id, startTime);
      this.loadTrackClips(); // Refresh clips display
      this.selectionService.selectClip(clip.id);
      console.log(`✅ Created clip: ${clip.id} on track: ${this.trackData.name} at ${startTime}`);
    } catch (error) {
      console.error('❌ Error creating clip:', error);
    }
  }

  createNewClip(): void {
    const currentTime = this.stateService.transport().currentTime || 0;
    this.createClip(currentTime);
    console.log(`🎵 Created new clip on track: ${this.trackData.name} at time ${currentTime}`);
  }
  // OBBLIGATORIO: Clip selection
  selectClip(clipId: string, event: MouseEvent): void {
    event.stopPropagation();
    const mode = event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
    this.selectionService.selectClip(clipId, mode);
  }

  // ADDITIONAL: Clip event handlers
  onClipSelect(clipId: string, event: MouseEvent): void {
    this.selectClip(clipId, event);
  }

  onClipDoubleClick(clipId: string): void {
    // TODO: Apri piano roll per editing clip
    console.log(`🎵 Opening piano roll for clip: ${clipId}`);
  }

  onClipContextMenu(clipId: string, event: MouseEvent): void {
    // TODO: Mostra context menu per clip
    console.log(`📝 Context menu for clip: ${clipId}`, event);
  }

  onTimelineDoubleClick(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const beatPosition = Math.floor(clickX / (50 * this.timelineZoom));
    this.createClip(beatPosition);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const clipId = event.dataTransfer?.getData('text/plain');
    if (clipId) {
      // TODO: Handle clip drop/move
      console.log(`📦 Dropped clip: ${clipId}`);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  // UTILITY: Track controls
  toggleMute(): void {
    this.stateService.updateTrack(this.trackData.id, { 
      isMuted: !this.trackData.isMuted 
    });
  }

  toggleSolo(): void {
    this.stateService.updateTrack(this.trackData.id, { 
      isSolo: !this.trackData.isSolo 
    });
  }

  toggleArm(): void {
    this.stateService.updateTrack(this.trackData.id, { 
      isArmed: !this.trackData.isArmed 
    });
  }

  // UTILITY: UI helpers
  getTrackStyle(): { [key: string]: string } {
    return {
      'background-color': this.trackData.color,
      'height': `${this.trackData.height}px`,
      'opacity': this.trackData.isMuted ? '0.6' : '1.0'
    };
  }

  getClipPosition(clip: ClipModel): { [key: string]: string } {
    const leftPercent = (clip.startTime * this.timelineZoom / this.viewportWidth) * 100;
    const widthPercent = (clip.length * this.timelineZoom / this.viewportWidth) * 100;
    
    return {
      'left': `${leftPercent}%`,
      'width': `${widthPercent}%`,
      'background-color': clip.color,
      'opacity': clip.isMuted ? '0.6' : '1.0'
    };
  }

  isClipSelected(clipId: string): boolean {
    return this.selectionService.isClipSelected(clipId);
  }
}
