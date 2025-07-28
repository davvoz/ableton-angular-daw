import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state';
import { SelectionService } from '../../core/services/selection';
import { ClipManager } from '../../core/services/clip-manager';
import { SequencerService } from '../../core/services/sequencer';
import { PlaybackManager } from '../../core/timing/playback-manager';
import { Clip as ClipModel } from '../../core/models/clip.model';
import { MidiNote } from '../../core/models/midi-note.model';

@Component({
  selector: 'app-clip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clip.html',
  styleUrl: './clip.scss'
})
export class Clip {
  // OBBLIGATORIO: Input data
  @Input({ required: true }) clipData!: ClipModel;
  @Input() trackHeight: number = 80;
  @Input() timelineZoom: number = 1.0;
  @Input() beatWidth: number = 50;
  // OBBLIGATORI: Output events
  @Output() clipSelected = new EventEmitter<{ clipId: string, event: MouseEvent }>();
  @Output() clipDoubleClick = new EventEmitter<string>();
  @Output() clipContextMenu = new EventEmitter<{ clipId: string, event: MouseEvent }>();
  @Output() clipPlay = new EventEmitter<string>();
  @Output() clipStop = new EventEmitter<string>();

  // OBBLIGATORI: Dependency injection
  private stateService = inject(StateService);
  private selectionService = inject(SelectionService);
  private clipManager = inject(ClipManager);
  private sequencerService = inject(SequencerService);
  private playbackManager = inject(PlaybackManager);

  // OBBLIGATORI: Local state
  private _isHovered = signal<boolean>(false);
  private _isDragging = signal<boolean>(false);

  // COMPUTED: Reactive properties
  readonly isHovered = this._isHovered.asReadonly();
  readonly isDragging = this._isDragging.asReadonly();
  readonly isSelected = computed(() => 
    this.selectionService.isClipSelected(this.clipData.id)
  );
  readonly isPlaying = computed(() => 
    this.playbackManager.isClipActive(this.clipData.id)
  );
  readonly noteCount = computed(() => this.clipData.noteCount);
  readonly duration = computed(() => this.clipData.length);
  readonly hasNotes = computed(() => this.noteCount() > 0);

  // COMPUTED: Style calculations
  readonly clipStyle = computed(() => ({
    'left': `${this.clipData.startTime * this.beatWidth * this.timelineZoom}px`,
    'width': `${this.clipData.length * this.beatWidth * this.timelineZoom}px`,
    'height': `${this.trackHeight - 10}px`,
    'background-color': this.clipData.color,
    'opacity': this.clipData.isMuted ? '0.6' : '1.0',
    'border': this.isSelected() ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.1)',
    'transform': this.isDragging() ? 'scale(1.02)' : 'scale(1)'
  }));

  readonly notesPreview = computed(() => {
    // Generate simplified note preview for visualization
    const notes = Array.from(this.clipData.notes.values());
    return notes.slice(0, 8).map(note => ({
      left: `${(note.startTime / this.clipData.length) * 100}%`,
      width: `${(note.duration / this.clipData.length) * 100}%`,
      bottom: `${((note.note - 36) / 48) * 80}%`, // C2 to C6 range
      height: '2px',
      opacity: note.velocity / 127
    }));
  });

  // OBBLIGATORI: Event handlers
  onClipClick(event: MouseEvent): void {
    event.stopPropagation();
    this.clipSelected.emit({ clipId: this.clipData.id, event });
  }

  onClipDoubleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.clipDoubleClick.emit(this.clipData.id);
  }

  onClipContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clipContextMenu.emit({ clipId: this.clipData.id, event });
  }

  onMouseEnter(): void {
    this._isHovered.set(true);
  }

  onMouseLeave(): void {
    this._isHovered.set(false);
  }

  onDragStart(event: DragEvent): void {
    this._isDragging.set(true);
    event.dataTransfer?.setData('text/plain', this.clipData.id);
  }

  onDragEnd(): void {
    this._isDragging.set(false);
  }
  // UTILITY: Actions
  toggleMute(): void {
    this.stateService.updateClip(this.clipData.id, { 
      isMuted: !this.clipData.isMuted 
    });
  }

  playClip(): void {
    this.sequencerService.startClip(this.clipData.id);
    this.clipPlay.emit(this.clipData.id);
    console.log(`🎵 Playing clip: ${this.clipData.name}`);
  }

  stopClip(): void {
    this.sequencerService.stopClip(this.clipData.id);
    this.clipStop.emit(this.clipData.id);
    console.log(`⏹️ Stopping clip: ${this.clipData.name}`);
  }
  togglePlayback(): void {
    if (this.isPlaying()) {
      this.stopClip();
    } else {
      this.playClip();
    }
  }

  duplicateClip(): void {
    const newStartTime = this.clipData.startTime + this.clipData.length;
    const duplicatedClip = this.clipManager.createClip(
      this.clipData.trackId, 
      newStartTime, 
      this.clipData.length
    );
    
    // Copy notes
    Array.from(this.clipData.notes.values()).forEach(note => {
      const newNote: MidiNote = {
        ...note,
        id: `${note.id}_copy`,
      };
      this.clipManager.addNoteToClip(duplicatedClip.id, newNote);
    });
  }
  deleteClip(): void {
    this.clipManager.deleteClip(this.clipData.id);
  }

  // UTILITY: UI helpers
  getClipClasses(): { [key: string]: boolean } {
    return {
      'clip': true,
      'selected': this.isSelected(),
      'hovered': this.isHovered(),
      'dragging': this.isDragging(),
      'muted': this.clipData.isMuted,
      'playing': this.isPlaying(),
      'has-notes': this.hasNotes(),
      'loop': this.clipData.isLoop
    };
  }

  formatDuration(): string {
    const beats = Math.floor(this.duration());
    const fraction = (this.duration() % 1).toFixed(2).substring(2);
    return fraction === '00' ? `${beats}` : `${beats}.${fraction}`;
  }

  // TEST: Metodo per testare se il click funziona
  testClick(): void {
    console.log('🎯 BOTTONE CLICCATO!');
    alert('BOTTONE PLAY CLICCATO!');
    this.togglePlayback();
  }
}
