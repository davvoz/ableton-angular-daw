import { Injectable, computed } from '@angular/core';
import { StateService } from './state';

@Injectable({
  providedIn: 'root'
})
export class SelectionService {
  clearNoteSelection() {
    const currentSelection = this.selection();
    this.stateService.setSelection(
      currentSelection.selectedTrackIds as string[],
      currentSelection.selectedClipIds as string[],
      []
    );
  }
  // OBBLIGATORI: Computed signals dal StateService
  readonly selection = computed(() => this.stateService.selection());
  readonly selectedTrackIds = computed(() => this.selection().selectedTrackIds);
  readonly selectedClipIds = computed(() => this.selection().selectedClipIds);
  readonly selectedNoteIds = computed(() => this.selection().selectedNoteIds);
  readonly hasSelection = computed(() => this.selection().hasSelection);
  readonly selectionCount = computed(() => this.selection().selectionCount);
  readonly selectionMode = computed(() => this.selection().selectionMode);

  constructor(private stateService: StateService) { }

  // OBBLIGATORI: Gestione selezione tracks
  selectTrack(trackId: string, mode: 'replace' | 'add' | 'toggle' = 'replace'): void {
    const currentSelection = this.selection();
    let newTrackIds: string[] = [];

    switch (mode) {
      case 'replace':
        newTrackIds = [trackId];
        break;
      case 'add':
        newTrackIds = [...currentSelection.selectedTrackIds, trackId];
        break;
      case 'toggle':
        newTrackIds = currentSelection.selectedTrackIds.includes(trackId)
          ? currentSelection.selectedTrackIds.filter(id => id !== trackId)
          : [...currentSelection.selectedTrackIds, trackId];
        break;
    }

    this.stateService.setSelection(
      newTrackIds,
      currentSelection.selectedClipIds as string[],
      currentSelection.selectedNoteIds as string[]
    );
  }

  selectMultipleTracks(trackIds: string[]): void {
    const currentSelection = this.selection();
    this.stateService.setSelection(
      trackIds,
      currentSelection.selectedClipIds as string[],
      currentSelection.selectedNoteIds as string[]
    );
  }

  // OBBLIGATORI: Gestione selezione clips
  selectClip(clipId: string, mode: 'replace' | 'add' | 'toggle' = 'replace'): void {
    const currentSelection = this.selection();
    let newClipIds: string[] = [];

    switch (mode) {
      case 'replace':
        newClipIds = [clipId];
        break;
      case 'add':
        newClipIds = [...currentSelection.selectedClipIds, clipId];
        break;
      case 'toggle':
        newClipIds = currentSelection.selectedClipIds.includes(clipId)
          ? currentSelection.selectedClipIds.filter(id => id !== clipId)
          : [...currentSelection.selectedClipIds, clipId];
        break;
    }

    this.stateService.setSelection(
      currentSelection.selectedTrackIds as string[],
      newClipIds,
      currentSelection.selectedNoteIds as string[]
    );
  }

  selectMultipleClips(clipIds: string[]): void {
    const currentSelection = this.selection();
    this.stateService.setSelection(
      currentSelection.selectedTrackIds as string[],
      clipIds,
      currentSelection.selectedNoteIds as string[]
    );
  }

  // OBBLIGATORI: Gestione selezione notes
  selectNote(noteId: string, mode: 'replace' | 'add' | 'toggle' = 'replace'): void {
    const currentSelection = this.selection();
    let newNoteIds: string[] = [];

    switch (mode) {
      case 'replace':
        newNoteIds = [noteId];
        break;
      case 'add':
        newNoteIds = [...currentSelection.selectedNoteIds, noteId];
        break;
      case 'toggle':
        newNoteIds = currentSelection.selectedNoteIds.includes(noteId)
          ? currentSelection.selectedNoteIds.filter(id => id !== noteId)
          : [...currentSelection.selectedNoteIds, noteId];
        break;
    }

    this.stateService.setSelection(
      currentSelection.selectedTrackIds as string[],
      currentSelection.selectedClipIds as string[],
      newNoteIds
    );
  }

  selectMultipleNotes(noteIds: string[]): void {
    const currentSelection = this.selection();
    this.stateService.setSelection(
      currentSelection.selectedTrackIds as string[],
      currentSelection.selectedClipIds as string[],
      noteIds
    );
  }

  // OBBLIGATORI: Operazioni di selezione avanzate
  selectAll(): void {
    const allTrackIds = this.stateService.tracks().map(track => track.id);
    this.stateService.setSelection(allTrackIds, [], []);
  }

  selectNone(): void {
    this.stateService.clearSelection();
  }

  invertSelection(): void {
    const allTrackIds = this.stateService.tracks().map(track => track.id);
    const currentTrackIds = this.selectedTrackIds();
    const invertedTrackIds = allTrackIds.filter(id => !currentTrackIds.includes(id));
    
    this.stateService.setSelection(invertedTrackIds, [], []);
  }

  // OBBLIGATORI: Selezione range
  selectRange(startId: string, endId: string, type: 'track' | 'clip' | 'note'): void {
    if (type === 'track') {
      const allTracks = this.stateService.tracks();
      const startIndex = allTracks.findIndex(track => track.id === startId);
      const endIndex = allTracks.findIndex(track => track.id === endId);
      
      if (startIndex === -1 || endIndex === -1) return;
      
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      const rangeIds = allTracks.slice(minIndex, maxIndex + 1).map(track => track.id);
      
      this.selectMultipleTracks(rangeIds);
    }
    // TODO: Implementare per clips e notes quando necessario
  }

  // UTILITY: Query selezione
  isTrackSelected(trackId: string): boolean {
    return this.selectedTrackIds().includes(trackId);
  }

  isClipSelected(clipId: string): boolean {
    return this.selectedClipIds().includes(clipId);
  }

  isNoteSelected(noteId: string): boolean {
    return this.selectedNoteIds().includes(noteId);
  }

  // UTILITY: Ottieni elementi selezionati
  getSelectedTracks() {
    return this.selectedTrackIds()
      .map(id => this.stateService.getTrack(id))
      .filter(track => track !== undefined);
  }

  getSelectedClips() {
    return this.selectedClipIds()
      .map(id => this.stateService.getClip(id))
      .filter(clip => clip !== undefined);
  }
}
