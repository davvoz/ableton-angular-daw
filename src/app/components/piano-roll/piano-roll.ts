import { Component, Input, inject, computed, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StateService } from '../../core/services/state';
import { SelectionService } from '../../core/services/selection';
import { ClipManager } from '../../core/services/clip-manager';
import { TransportService } from '../../core/services/transport';
import { TrackFactoryService } from '../../core/services/track-factory.service';
import { Clip as ClipModel } from '../../core/models/clip.model';
import { MidiNote } from '../../core/models/midi-note.model';
import { AudioEngineService } from '../../audio/audio-engine';
import { InstrumentFactoryService } from '../../core/services/instrument-factory';

interface PianoKey {
  note: number;
  noteName: string;
  isBlack: boolean;
  octave: number;
  keyIndex: number;
}

@Component({
  selector: 'app-piano-roll',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './piano-roll.html',
  styleUrl: './piano-roll.scss'
})
export class PianoRoll implements OnInit, OnDestroy, AfterViewInit {
  // Input properties
  @Input() clipId?: string;
  @Input() trackId?: string;
  @Input() viewportWidth: number = 1200;
  @Input() viewportHeight: number = 600;

  // Template references
  @ViewChild('gridArea') gridArea!: ElementRef<HTMLDivElement>;
  @ViewChild('pianoKeysContainer') pianoKeysContainer!: ElementRef<HTMLDivElement>;
  // Services
  private stateService = inject(StateService);
  private selectionService = inject(SelectionService);
  private clipManager = inject(ClipManager);
  private transportService = inject(TransportService);
  private audioEngine = inject(AudioEngineService);
  private instrumentFactory = inject(InstrumentFactoryService);
  private trackFactory = inject(TrackFactoryService);
  private cdr = inject(ChangeDetectorRef);  // State signals
  private _zoomLevel = signal<number>(1.0);
  private _scrollX = signal<number>(0);
  private _scrollY = signal<number>(0);
  private _snapToGrid = signal<boolean>(true);
    // NUOVO: Stato drag/resize unificato e semplificato
  private _dragState = signal<{
    active: boolean;
    type: 'move' | 'resize-left' | 'resize-right' | 'velocity' | null;
    noteId: string | null;
    startX: number;
    startY: number;
    originalNote: MidiNote | null;
  }>({
    active: false,
    type: null,
    noteId: null,
    startX: 0,
    startY: 0,
    originalNote: null
  });

  // NUOVO: Preview della nota durante drag/resize
  private _previewNote = signal<MidiNote | null>(null);

  readonly dragState = this._dragState.asReadonly();
  readonly previewNote = this._previewNote.asReadonly();

  // Piano keys (88 keys)
  readonly pianoKeys = computed(() => {
    const keys: PianoKey[] = [];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const blackKeys = [1, 3, 6, 8, 10];
    
    for (let noteNumber = 21; noteNumber <= 108; noteNumber++) {
      const noteIndex = (noteNumber - 21) % 12;
      const octave = Math.floor((noteNumber - 21) / 12);
      const noteName = noteNames[noteIndex];
      const isBlack = blackKeys.includes(noteIndex);
      
      keys.push({
        note: noteNumber,
        noteName: `${noteName}${octave}`,
        isBlack,
        octave,
        keyIndex: noteNumber - 21
      });
    }
    
    return keys.reverse();
  });

  // Current clip
  readonly currentClip = computed(() => {
    if (this.clipId) {
      const clips = this.stateService.clips();
      const clip = clips.find(c => c.id === this.clipId);
      if (clip) return clip;
    }
    
    const selectedClipIds = this.selectionService.selectedClipIds();
    if (selectedClipIds.length > 0) {
      const clips = this.stateService.clips();
      return clips.find(c => c.id === selectedClipIds[0]) || null;
    }
    
    return null;
  });

  readonly effectiveClipId = computed(() => {
    const clip = this.currentClip();
    return clip?.id || null;
  });  // Notes from current clip (con preview durante drag)
  readonly clipNotes = computed(() => {
    const clip = this.currentClip();
    if (!clip) {
      console.log('🔍 clipNotes computed: no clip');
      return [];
    }
    
    let notes = Array.from(clip.notes.values()).sort((a, b) => a.startTime - b.startTime);
    
    // Se c'è un preview attivo, sostituisci la nota originale con quella di preview
    const dragState = this._dragState();
    const previewNote = this._previewNote();
    
    if (dragState.active && previewNote && dragState.noteId) {
      notes = notes.map(note => 
        note.id === dragState.noteId ? previewNote : note
      );
    }
    
    console.log('🔍 clipNotes computed:', notes.length, 'notes from clip', clip.id, 'with preview:', !!previewNote);
    return notes;
  });
  // Notes da visualizzare (incluso preview durante drag/resize)
  readonly displayNotes = computed(() => {
    const clip = this.currentClip();
    if (!clip) return [];
    
    const notes = Array.from(clip.notes.values()).sort((a, b) => a.startTime - b.startTime);
    const previewNote = this._previewNote();
    const dragState = this._dragState();
    
    // Se c'è un preview attivo, nascondi la nota originale e mostra il preview
    if (previewNote && dragState.active && dragState.noteId) {
      const filteredNotes = notes.filter(note => note.id !== dragState.noteId);
      // Aggiungi il preview note con un ID temporaneo
      const previewWithTempId = {
        ...previewNote,
        id: `${previewNote.id}_preview`,
        isPreview: true
      };
      return [...filteredNotes, previewWithTempId].sort((a, b) => a.startTime - b.startTime);
    }
    
    return notes;
  });

  // Grid parameters
  readonly beatWidth = computed(() => 128 * this._zoomLevel());
  readonly keyHeight = computed(() => 20);
  readonly gridSubdivision = computed(() => 16);
  readonly totalBeats = computed(() => {
    const clip = this.currentClip();
    return clip ? Math.max(clip.length, 64) : 64;
  });
  readonly totalWidth = computed(() => this.totalBeats() * this.beatWidth());

  // Vertical grid lines
  readonly verticalGridLines = computed(() => {
    const lines: Array<{beat: number, subdivision: number, position: number, isOnBeat: boolean, isOnBar: boolean}> = [];
    const totalBeats = this.totalBeats();
    const subdivision = this.gridSubdivision();
    
    for (let beat = 0; beat < totalBeats; beat++) {
      for (let sub = 0; sub < subdivision; sub++) {
        lines.push({
          beat,
          subdivision: sub,
          position: this.getGridLinePosition(beat, sub),
          isOnBeat: this.isOnBeat(sub),
          isOnBar: this.isOnBar(beat, sub)
        });
      }
    }
    
    return lines;
  });  // Readonly getters
  readonly selectedNotes = computed(() => this.selectionService.selectedNoteIds());
  readonly zoomLevel = this._zoomLevel.asReadonly();
  readonly scrollX = this._scrollX.asReadonly();
  readonly scrollY = this._scrollY.asReadonly();
  readonly snapToGridEnabled = this._snapToGrid.asReadonly();

  // Loop configuration computed properties
  readonly loopStart = computed(() => this.transportService.loopStart());
  readonly loopEnd = computed(() => this.transportService.loopEnd());
  readonly loopLength = computed(() => this.loopEnd() - this.loopStart());

  // Transport state
  readonly isPlaying = computed(() => this.transportService.isPlaying());
  readonly currentTime = computed(() => this.transportService.currentTime());
  readonly isLooping = computed(() => this.transportService.isLooping());
  readonly bpm = computed(() => this.transportService.bpm()); 
   readonly playheadPosition = computed(() => {
    const currentTimeValue = this.currentTime();
    const clip = this.currentClip();
    
    if (!clip) {
      return Math.max(0, currentTimeValue) * this.beatWidth();
    }
    
    // CORRETTO: Gestione proper del loop con timing preciso
    const clipStartTime = clip.startTime;
    const clipLength = clip.length;
    const relativeTime = currentTimeValue - clipStartTime;
    
    // Se siamo nel range del clip, mostra la posizione relativa
    if (relativeTime >= 0 && relativeTime < clipLength) {
      return relativeTime * this.beatWidth();
    }
    
    // Se siamo in loop, calcola la posizione nel ciclo
    if (this.isLooping() && relativeTime >= 0) {
      const loopPosition = relativeTime % clipLength;
      return loopPosition * this.beatWidth();
    }
    
    // Altrimenti nascondi il playhead
    return -1;
  });

  readonly showPlayhead = computed(() => this.isPlaying());  readonly dragCursorStyle = computed(() => {
    const state = this._dragState();
    if (!state.active) return 'default';
      switch (state.type) {
      case 'move': return 'grabbing';
      case 'resize-left': 
      case 'resize-right': return 'ew-resize';
      case 'velocity': return 'ns-resize';
      default: return 'default';
    }
  });

    ngOnInit(): void {
    console.log('🎹 PIANO ROLL COMPONENT INITIALIZED!');
    console.log('📎 Input clipId:', this.clipId);
    console.log('🔍 Input trackId:', this.trackId);
    console.log('📊 Current clips:', this.stateService.clips());
    console.log('📊 Current tracks:', this.stateService.tracks());
    console.log('📊 Selected clips:', this.selectionService.selectedClipIds());
    console.log('📊 Selected tracks:', this.selectionService.selectedTrackIds());
    console.log('🎯 Current clip computed:', this.currentClip());
    console.log('🎯 Effective clip ID computed:', this.effectiveClipId());
    
    this.centerOnMiddleC();
    this.setupDragListeners();
    this.setupKeyboardListeners();
    console.log('🎹 Piano roll setup completed');
  }
  
  ngAfterViewInit(): void {
    console.log('🔍 PIANO ROLL VIEW INIT - Checking DOM elements...');
    console.log('🎹 Grid area element:', this.gridArea?.nativeElement);
    console.log('🎹 Piano keys container:', this.pianoKeysContainer?.nativeElement);
    console.log('🎹 Piano keys count:', this.pianoKeys().length);
    console.log('🎹 Key height:', this.keyHeight());
    console.log('🎹 Total width:', this.totalWidth());
    console.log('🎹 Beat width:', this.beatWidth());
    
    if (this.gridArea?.nativeElement) {
      console.log('✅ Grid area found, size:', {
        width: this.gridArea.nativeElement.offsetWidth,
        height: this.gridArea.nativeElement.offsetHeight,
        scrollHeight: this.gridArea.nativeElement.scrollHeight
      });
      
      // Controlla le celle della griglia
      const gridCells = this.gridArea.nativeElement.querySelectorAll('.grid-row');
      console.log('🔍 Grid cells found:', gridCells.length);
      
      if (gridCells.length > 0) {
        const firstCell = gridCells[0] as HTMLElement;
        console.log('🔍 First cell:', {
          top: firstCell.style.top,
          height: firstCell.style.height,
          offsetTop: firstCell.offsetTop,
          offsetHeight: firstCell.offsetHeight
        });
      }
    } else {
      console.error('❌ Grid area NOT found!');
    }
    
    // Initialize scroll synchronization after view is ready
    this.initializeScrollSync();
  }
  // NUOVO: Remove keyboard listeners  
  private removeKeyboardListeners(): void {
    if (typeof window !== 'undefined') {
      document.removeEventListener('keydown', this.onKeyDown);
    }  }

  // Zoom controls
  zoomIn(): void {
    const newZoom = Math.min(4.0, this._zoomLevel() * 1.2);
    this._zoomLevel.set(newZoom);
  }

  zoomOut(): void {
    const newZoom = Math.max(0.25, this._zoomLevel() / 1.2);
    this._zoomLevel.set(newZoom);
  }

  resetZoom(): void {
    this._zoomLevel.set(1.0);
  }

  // Grid snapping
  toggleSnapToGrid(): void {
    this._snapToGrid.set(!this._snapToGrid());
  }

  private snapToGrid(timePosition: number): number {
    if (!this._snapToGrid()) return timePosition;
    
    const subdivision = this.gridSubdivision();
    const snapUnit = 1 / subdivision;
    return Math.round(timePosition / snapUnit) * snapUnit;
  }  // Loop configuration controls
  onLoopLengthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newLength = Math.max(1, Math.min(64, parseInt(input.value) || 1));
    
    const currentStart = this.loopStart();
    // Il loop può essere più lungo del clip - il sequencer gestirà il loop interno
    const maxLength = 64 - currentStart;
    const finalLength = Math.min(newLength, maxLength);
    
    // Update the transport service loop end
    this.transportService.setLoopEnd(currentStart + finalLength);
    
    console.log('🔄 Loop length changed to:', finalLength, 'beats');
  }

  onLoopStartChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newStart = Math.max(0, Math.min(63, parseInt(input.value) || 0));
    
    const currentLength = this.loopLength();
    
    // Il loop start può andare fino a 63 (con lunghezza minima di 1)
    const maxStart = Math.max(0, 64 - currentLength);
    const finalStart = Math.min(newStart, maxStart);
    
    // Update both loop start and end to maintain length
    this.transportService.setLoopStart(finalStart);
    this.transportService.setLoopEnd(finalStart + currentLength);
    
    console.log('🔄 Loop start changed to:', finalStart, 'beats');
  }

  setLoopToClip(): void {
    const clip = this.currentClip();
    if (clip) {
      this.transportService.setLoopStart(0);
      this.transportService.setLoopEnd(clip.length);
      console.log('🔄 Loop set to full clip length:', clip.length, 'beats');
    }
  }

 
  // Note creation
  createNote(note: number, startTime: number, velocity: number = 100): void {
    const effectiveClipId = this.effectiveClipId();
    if (!effectiveClipId) {
      console.error('No active clip for note creation');
      return;
    }

    const snappedStartTime = this.snapToGrid(startTime);
    const defaultDuration = 1;

    const newNote: MidiNote = {
      id: `note-${Date.now()}-${note}`,
      note,
      velocity,
      startTime: snappedStartTime,
      duration: defaultDuration,
      noteName: this.getNoteNameFromNumber(note),
      endTime: snappedStartTime + defaultDuration
    };

    console.log('Creating note:', newNote);
    
    const success = this.clipManager.addNoteToClip(effectiveClipId, newNote);
    if (success) {
      this.selectionService.selectNote(newNote.id);
      console.log('Note created successfully and selected');
      
      // 🔥 FORZA IL CHANGE DETECTION!
      this.cdr.detectChanges();
      console.log('✅ Change detection triggered');
      
      // Verifica che la nota sia stata aggiunta
      const updatedClip = this.currentClip();
      console.log('🔍 Updated clip notes count:', updatedClip?.notes.size);
      console.log('🔍 Clip notes:', Array.from(updatedClip?.notes.values() || []));
    } else {
      console.error('Failed to add note to clip');
    }
  }  // Test method for debugging
  onGridAreaClick(event: MouseEvent): void {
    console.log('🎯🎯🎯 GRID AREA CLICKED!', event);
    
    // Calcola quale nota è stata cliccata basandosi sulla posizione Y
    const gridArea = event.currentTarget as HTMLElement;
    const rect = gridArea.getBoundingClientRect();
    
    // IMPORTANTE: Aggiungi lo scroll offset per calcolare la posizione corretta
    const clickY = event.clientY - rect.top + gridArea.scrollTop;
    const keyIndex = Math.floor(clickY / this.keyHeight());
    const keys = this.pianoKeys();
    
    console.log('📐 Position calc:', {
      clientY: event.clientY,
      rectTop: rect.top,
      scrollTop: gridArea.scrollTop,
      finalClickY: clickY,
      keyHeight: this.keyHeight(),
      calculatedKeyIndex: keyIndex,
      totalKeys: keys.length
    });
    
    if (keyIndex >= 0 && keyIndex < keys.length) {
      const note = keys[keyIndex].note;
      console.log('🎵 Calculated note from Y position:', note, 'at keyIndex:', keyIndex);
      this.onGridClick(event, note);
    } else {
      console.log('❌ Click outside valid note range, keyIndex:', keyIndex);
    }
  }

  // TEST METHOD - per debug da console
  testGridClick(): void {
    console.log('🧪 TEST GRID CLICK CALLED');
    this.onGridClick(new MouseEvent('click', { clientX: 100, clientY: 100 }), 60);
  }  // Grid click handler
  onGridClick(event: MouseEvent, note: number): void {
    console.log('🎯 Grid click for note:', note);
    
    event.preventDefault();
    event.stopPropagation();
    
    const workingClipId = this.ensureWorkingClip();
    if (!workingClipId) {
      console.error('❌ Could not create or find a working clip');
      return;
    }

    const gridArea = this.gridArea?.nativeElement;
    if (!gridArea) {
      console.error('❌ Grid area not found');
      return;
    }
    
    const rect = gridArea.getBoundingClientRect();
    const clickX = event.clientX - rect.left + gridArea.scrollLeft;
    
    const beatWidth = this.beatWidth();
    const clickTime = clickX / beatWidth;
    const snappedTime = this.snapToGrid(clickTime);
    
    // CORRETTO: Assicurati che il tempo sia nel range del clip
    const clip = this.currentClip();
    if (clip && snappedTime >= clip.length) {
      console.log('❌ Click outside clip bounds');
      return;
    }
    
    console.log('🎵 Creating note at time:', snappedTime, 'for note:', note);
    this.createNote(note, snappedTime, 100);
  }

  // Piano key click
  onPianoKeyClick(noteNumber: number): void {
    // Play note preview
    console.log('Piano key clicked:', noteNumber);
  }

  // Grid scroll handler - synchronizes piano keys with grid scroll
  onGridScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target && this.pianoKeysContainer) {
      // Synchronize vertical scroll only
      this.pianoKeysContainer.nativeElement.scrollTop = target.scrollTop;
      
      // Update scroll position signals
      this._scrollX.set(target.scrollLeft);
      this._scrollY.set(target.scrollTop);
    }
  }

  // Piano keys scroll handler - synchronizes grid with piano keys scroll
  onPianoKeysScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target && this.gridArea) {
      // Synchronize vertical scroll only
      this.gridArea.nativeElement.scrollTop = target.scrollTop;
      
      // Update scroll position signal
      this._scrollY.set(target.scrollTop);
    }
  }  // NUOVO: Mouse down su nota (drag)
  onNoteMouseDown(note: MidiNote, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    
    console.log('🎯 Note mouse down:', note.id);
    
    // Seleziona la nota
    if (!this.isNoteSelected(note.id)) {
      this.selectionService.selectNote(note.id);
    }
    
    // Inizia drag
    this._dragState.set({
      active: true,
      type: 'move',
      noteId: note.id,
      startX: event.clientX,
      startY: event.clientY,
      originalNote: { ...note }
    });
    
    document.body.style.cursor = 'grabbing';
    console.log('✅ Drag started');
  }

  onNoteDoubleClick(note: MidiNote, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    
    console.log('🗑️ Deleting note:', note.id);
    
    const effectiveClipId = this.effectiveClipId();
    if (effectiveClipId) {
      // Prima rimuovi la selezione
      this.selectionService.clearNoteSelection();
      
      // Poi rimuovi la nota dal clip
      const success = this.clipManager.removeNoteFromClip(effectiveClipId, note.id);
      
      if (success) {
        console.log('✅ Note deleted successfully');
        this.cdr.detectChanges();
      } else {
        console.error('❌ Failed to delete note');
      }
    }
  }  // Utility methods - CORRETTO per garantire note visibili
  getNotePosition(note: MidiNote): { left: number; top: number; width: number; height: number } {
    const left = note.startTime * this.beatWidth();
    const top = (108 - note.note) * this.keyHeight();
    const width = Math.max(20, note.duration * this.beatWidth()); // MINIMO 20px width
    const height = Math.max(18, this.keyHeight() - 1); // MINIMO 18px height
    
    return { left, top, width, height };
  }

  isNoteSelected(noteId: string): boolean {
    return this.selectedNotes().includes(noteId);
  }

  getGridLinePosition(beat: number, subdivision: number): number {
    const beatPosition = beat * this.beatWidth();
    const subdivisionPosition = (subdivision / this.gridSubdivision()) * this.beatWidth();
    return beatPosition + subdivisionPosition;
  }

  isOnBeat(subdivision: number): boolean {
    return subdivision === 0;
  }

  isOnBar(beat: number, subdivision: number): boolean {
    return beat % 4 === 0 && subdivision === 0;
  }

  getNoteNameFromNumber(noteNumber: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor((noteNumber - 12) / 12);
    const noteIndex = (noteNumber - 12) % 12;
    return `${noteNames[noteIndex]}${octave}`;
  }

  // Control handlers
  onQuantizeChange(event: any): void {
    // TODO: Implement quantize change
  }

  onVelocityChange(event: any): void {
    // TODO: Implement velocity change
  }

  quantizeSelectedNotes(): void {
    // TODO: Implement quantize selected
  }

  duplicateSelectedNotes(): void {
    // TODO: Implement duplicate selected
  }
  deleteSelectedNotes(): void {
    const selectedNotes = this.selectedNotes();
    const effectiveClipId = this.effectiveClipId();
    
    if (effectiveClipId && selectedNotes.length > 0) {
      console.log('🗑️ Deleting', selectedNotes.length, 'selected notes');
      
      selectedNotes.forEach(noteId => {
        this.clipManager.removeNoteFromClip(effectiveClipId, noteId);
      });
      
      this.selectionService.clearNoteSelection();
      this.cdr.detectChanges();
      
      console.log('✅ Selected notes deleted');
    }
  }

  // Private methods
  private centerOnMiddleC(): void {
    const middleCIndex = 60 - 21;
    const targetScrollY = (88 - middleCIndex - 10) * this.keyHeight();
    this._scrollY.set(Math.max(0, targetScrollY));
    
    // Apply scroll to both containers if they exist
    if (this.gridArea && this.pianoKeysContainer) {
      const scrollY = Math.max(0, targetScrollY);
      this.gridArea.nativeElement.scrollTop = scrollY;
      this.pianoKeysContainer.nativeElement.scrollTop = scrollY;
    }
  }

  private initializeScrollSync(): void {
    // Synchronize initial scroll positions
    if (this.gridArea && this.pianoKeysContainer) {
      // Set initial scroll position for piano keys to match grid
      const initialScrollY = this._scrollY();
      this.pianoKeysContainer.nativeElement.scrollTop = initialScrollY;
      this.gridArea.nativeElement.scrollTop = initialScrollY;
    }
  }
  private setupDragListeners(): void {
    if (typeof window !== 'undefined') {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    }
  }

  private removeDragListeners(): void {
    if (typeof window !== 'undefined') {
      document.removeEventListener('mousemove', this.onMouseMove);
      document.removeEventListener('mouseup', this.onMouseUp);
    }
  }
  private ensureClipExists(): void {
    const effectiveClipId = this.effectiveClipId();
    if (effectiveClipId) {
      return; // Clip already exists
    }

    // Check if we have a trackId to create a clip
    if (!this.trackId) {
      // Try to get the first available track or create one
      const tracks = this.stateService.tracks();
      let targetTrackId: string;      if (tracks.length === 0) {
        // Create a new track if none exist
        const newTrack = this.trackFactory.createTrack({ 
          name: 'MIDI Track 1', 
          type: 'synth',
          index: 0
        });
        
        // Aggiungi il track allo StateService
        this.stateService.addTrack(newTrack);
        targetTrackId = newTrack.id;
        console.log('Created and added new track for piano roll:', targetTrackId);
        
        // Verifica che il track sia stato aggiunto correttamente
        const verifyTrack = this.stateService.getTrack(targetTrackId);
        if (!verifyTrack) {
          console.error('Track was not properly added to state!');
          return;
        }
        console.log('Track verified in state:', verifyTrack.id);
      } else {
        targetTrackId = tracks[0].id;
      }
      
      // Create a new clip on the target track
      const newClip = this.clipManager.createClip(targetTrackId, 0, 16); // 16 beats default
      this.selectionService.selectClip(newClip.id);
      console.log('Created new clip for piano roll:', newClip.id);
    } else {
      // Create clip on the specified track
      const newClip = this.clipManager.createClip(this.trackId, 0, 16);
      this.selectionService.selectClip(newClip.id);
      console.log('Created new clip on specified track:', this.trackId);
    }
  }

  // Metodo semplificato per assicurarsi che esista un clip
  private ensureWorkingClip(): string | null {
    // Prima controlla se abbiamo già un clip selezionato
    let effectiveClipId = this.effectiveClipId();
    if (effectiveClipId) {
      return effectiveClipId;
    }

    // Se non c'è un clip, dobbiamo crearne uno
    let targetTrackId: string | null = null;

    if (this.trackId) {
      // Usa il track specificato
      targetTrackId = this.trackId;
    } else {
      // Trova o crea un track
      const tracks = this.stateService.tracks();
      if (tracks.length > 0) {
        targetTrackId = tracks[0].id;
      } else {
        // Crea un nuovo track
        console.log('Creating new track for piano roll...');
        const newTrack = this.trackFactory.createTrack({ 
          name: 'MIDI Track 1', 
          type: 'synth',
          index: 0
        });
        this.stateService.addTrack(newTrack);
        targetTrackId = newTrack.id;
        console.log('Created track:', targetTrackId);
      }
    }

    if (!targetTrackId) {
      console.error('Could not determine target track');
      return null;
    }

    // Verifica che il track esista
    const track = this.stateService.getTrack(targetTrackId);
    if (!track) {
      console.error('Target track not found:', targetTrackId);
      return null;
    }

    // Crea il clip
    try {
      console.log('Creating clip on track:', targetTrackId);
      const newClip = this.clipManager.createClip(targetTrackId, 0, 16);
      this.selectionService.selectClip(newClip.id);
      console.log('Created clip:', newClip.id);
      return newClip.id;
    } catch (error) {
      console.error('Failed to create clip:', error);
      return null;
    }  
  }  // NUOVO: Mouse move semplificato con throttling
  private onMouseMove = (event: MouseEvent): void => {
    const state = this._dragState();
    if (!state.active || !state.originalNote) return;

    // Throttling per evitare troppi aggiornamenti
    const now = Date.now();
    if (this.lastPreviewUpdate && now - this.lastPreviewUpdate < 16) return; // ~60fps
    this.lastPreviewUpdate = now;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    
    this.updateNotePreview(state, deltaX, deltaY);
  };

  private lastPreviewUpdate = 0;// CORRETTO: Mouse up handler per completare drag E resize
  // NUOVO: Mouse up semplificato
  private onMouseUp = (event: MouseEvent): void => {
    const state = this._dragState();
    if (!state.active || !state.originalNote) return;

    console.log('🎯 Mouse up, completing operation:', state.type);

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    
    this.applyNoteChange(state, deltaX, deltaY);
    
    // Reset state e preview
    this._dragState.set({
      active: false,
      type: null,
      noteId: null,
      startX: 0,
      startY: 0,
      originalNote: null
    });
    
    this._previewNote.set(null); // Pulisci il preview
    
    document.body.style.cursor = 'default';
    console.log('✅ Operation completed');
  };  // NUOVO: Aggiorna preview della nota durante drag/resize (NON modifica la nota reale)
  private updateNotePreview(state: any, deltaX: number, deltaY: number): void {
    if (!state.originalNote) return;

    let previewNote = { ...state.originalNote };

    switch (state.type) {
      case 'move':
        const timeOffset = deltaX / this.beatWidth();
        const noteOffset = Math.round(-deltaY / this.keyHeight());
        
        previewNote.startTime = Math.max(0, state.originalNote.startTime + timeOffset);
        previewNote.note = Math.max(21, Math.min(108, state.originalNote.note + noteOffset));
        previewNote.noteName = this.getNoteNameFromNumber(previewNote.note);
        previewNote.endTime = previewNote.startTime + previewNote.duration;
        break;

      case 'resize-left':
        const leftTimeOffset = deltaX / this.beatWidth();
        const newStartTime = Math.max(0, state.originalNote.startTime + leftTimeOffset);
        const maxStartTime = state.originalNote.startTime + state.originalNote.duration - 0.25;
        
        previewNote.startTime = Math.min(newStartTime, maxStartTime);
        previewNote.duration = state.originalNote.startTime + state.originalNote.duration - previewNote.startTime;
        previewNote.endTime = previewNote.startTime + previewNote.duration;
        break;

      case 'resize-right':
        const rightTimeOffset = deltaX / this.beatWidth();
        previewNote.duration = Math.max(0.25, state.originalNote.duration + rightTimeOffset);
        previewNote.endTime = previewNote.startTime + previewNote.duration;
        break;

      case 'velocity':
        const velocityChange = Math.round(-deltaY / 2);
        previewNote.velocity = Math.max(1, Math.min(127, state.originalNote.velocity + velocityChange));
        break;
    }

    // Applica snap se abilitato
    if (this._snapToGrid() && (state.type === 'move' || state.type.includes('resize'))) {
      previewNote.startTime = this.snapToGrid(previewNote.startTime);
      if (state.type === 'resize-right') {
        previewNote.duration = this.snapToGrid(previewNote.duration);
      }
      previewNote.endTime = previewNote.startTime + previewNote.duration;
    }

    // IMPORTANTE: Mantieni lo stesso ID per sostituire correttamente la nota nel computed
    previewNote.id = state.originalNote.id;

    // Aggiorna solo il preview (NON la nota reale)
    this._previewNote.set(previewNote);
  }

  // NUOVO: Applica il cambiamento finale alla nota
  private applyNoteChange(state: any, deltaX: number, deltaY: number): void {
    if (!state.originalNote) return;

    const effectiveClipId = this.effectiveClipId();
    if (!effectiveClipId) return;

    // Calcola i valori finali
    let finalNote = { ...state.originalNote };

    switch (state.type) {
      case 'move':
        const timeOffset = deltaX / this.beatWidth();
        const noteOffset = Math.round(-deltaY / this.keyHeight());
        
        finalNote.startTime = Math.max(0, state.originalNote.startTime + timeOffset);
        finalNote.note = Math.max(21, Math.min(108, state.originalNote.note + noteOffset));
        finalNote.noteName = this.getNoteNameFromNumber(finalNote.note);
        finalNote.endTime = finalNote.startTime + finalNote.duration;
        break;

      case 'resize-left':
        const leftTimeOffset = deltaX / this.beatWidth();
        const newStartTime = Math.max(0, state.originalNote.startTime + leftTimeOffset);
        const maxStartTime = state.originalNote.startTime + state.originalNote.duration - 0.25;
        
        finalNote.startTime = Math.min(newStartTime, maxStartTime);
        finalNote.duration = state.originalNote.startTime + state.originalNote.duration - finalNote.startTime;
        finalNote.endTime = finalNote.startTime + finalNote.duration;
        break;

      case 'resize-right':
        const rightTimeOffset = deltaX / this.beatWidth();
        finalNote.duration = Math.max(0.25, state.originalNote.duration + rightTimeOffset);
        finalNote.endTime = finalNote.startTime + finalNote.duration;
        break;

      case 'velocity':
        const velocityChange = Math.round(-deltaY / 2);
        finalNote.velocity = Math.max(1, Math.min(127, state.originalNote.velocity + velocityChange));
        break;
    }

    // Applica snap se abilitato
    if (this._snapToGrid() && (state.type === 'move' || state.type.includes('resize'))) {
      finalNote.startTime = this.snapToGrid(finalNote.startTime);
      if (state.type === 'resize-right') {
        finalNote.duration = this.snapToGrid(finalNote.duration);
      }
      finalNote.endTime = finalNote.startTime + finalNote.duration;
    }

    // Verifica che la nota sia nel range del clip
    const clip = this.currentClip();
    if (clip && finalNote.startTime >= clip.length) {
      console.log('❌ Note outside clip bounds, reverting');
      // Ripristina la nota originale
      this.clipManager.updateNoteInClip(effectiveClipId, state.noteId, {
        startTime: state.originalNote.startTime,
        duration: state.originalNote.duration,
        endTime: state.originalNote.endTime,
        note: state.originalNote.note,
        noteName: state.originalNote.noteName,
        velocity: state.originalNote.velocity
      });
      return;
    }

    // Applica il cambiamento finale
    const success = this.clipManager.updateNoteInClip(effectiveClipId, state.noteId, {
      startTime: finalNote.startTime,
      duration: finalNote.duration,
      endTime: finalNote.endTime,
      note: finalNote.note,
      noteName: finalNote.noteName,
      velocity: finalNote.velocity
    });

    if (success) {
      console.log('✅ Note updated successfully:', state.type);
      this.cdr.detectChanges();
    } else {
      console.error('❌ Failed to update note');
    }
  }

  // TrackBy functions for *ngFor optimization
  trackByNote = (index: number, key: PianoKey): number => key.note;
  
  trackByNoteId = (index: number, note: MidiNote): string => note.id;
  
  trackByGridLine = (index: number, line: any): string => 
    `${line.beat}-${line.subdivision}`;
  // NUOVO: Keyboard event handler
  private onKeyDown = (event: KeyboardEvent): void => {
    // Solo se il piano roll ha il focus o se non ci sono input attivi
    const activeElement = document.activeElement;
    const isInputActive = activeElement && 
      (activeElement.tagName === 'INPUT' || 
       activeElement.tagName === 'TEXTAREA' || 
       (activeElement as HTMLElement).contentEditable === 'true');
    
    if (isInputActive) return;

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.deleteSelectedNotes();
        break;
      case 'Escape':
        event.preventDefault();
        this.selectionService.clearNoteSelection();
        break;
      case ' ': // Spacebar
        event.preventDefault();
        this.transportService.togglePlayback();
        break;
    }
  }

  // NUOVO: Setup keyboard listeners
  private setupKeyboardListeners(): void {
    if (typeof window !== 'undefined') {
      document.addEventListener('keydown', this.onKeyDown);
    }
  }  // AGGIORNATO: Reset drag state on destroy
  ngOnDestroy(): void {
    this.removeDragListeners();
    this.removeKeyboardListeners();
    
    // Reset drag state e preview
    this._dragState.set({
      active: false,
      type: null,
      noteId: null,
      startX: 0,
      startY: 0,
      originalNote: null
    });
    
    this._previewNote.set(null);
    
    document.body.style.cursor = 'default';
  }

  // NUOVO: Mouse down su handle resize
  onResizeHandleMouseDown(note: MidiNote, handle: 'left' | 'right' | 'velocity', event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    
    console.log('🎯 Resize handle mouse down:', note.id, handle);
    
    // Seleziona la nota
    if (!this.isNoteSelected(note.id)) {
      this.selectionService.selectNote(note.id);
    }
    
    // Inizia resize
    this._dragState.set({
      active: true,
      type: handle === 'left' ? 'resize-left' : handle === 'right' ? 'resize-right' : 'velocity',
      noteId: note.id,
      startX: event.clientX,
      startY: event.clientY,
      originalNote: { ...note }
    });
    
    document.body.style.cursor = handle === 'velocity' ? 'ns-resize' : 'ew-resize';
    console.log('✅ Resize started:', handle);
  }
}
