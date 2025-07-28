import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { StateService } from '../../core/services/state';
import { SelectionService } from '../../core/services/selection';
import { TrackFactoryService } from '../../core/services/track-factory.service';
import { ClipManager } from '../../core/services/clip-manager';
import { SequencerService } from '../../core/services/sequencer';
import { Track as TrackModel } from '../../core/models/track.model';
import { Clip as ClipModel } from '../../core/models/clip.model';

@Component({
  selector: 'app-session',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  templateUrl: './session.html',
  styleUrl: './session.scss',
  host: {
    '(keydown)': 'onKeyDown($event)',
    'tabindex': '0'
  }
})
export class Session {  // 🎛️ DEPENDENCY INJECTION
  private stateService = inject(StateService);
  private selectionService = inject(SelectionService);
  private trackFactory = inject(TrackFactoryService);
  private clipManager = inject(ClipManager);
  private sequencerService = inject(SequencerService);
  // 🎛️ UI STATE
  showAddTrackMenu = signal<boolean>(false);
  showClipContextMenu = signal<boolean>(false);
  contextMenuPosition = signal<{x: number, y: number}>({x: 0, y: 0});
  contextMenuTrackId = signal<string>('');
  contextMenuSceneIndex = signal<number>(0);
  private _sceneCount = signal<number>(8); // Start with 8 scenes like Ableton

  // 🎛️ COMPUTED PROPERTIES
  readonly tracks = this.stateService.tracks;
  readonly visibleTracks = computed(() => this.tracks().slice(0, 20)); // Limit for performance
  readonly sceneCount = this._sceneCount.asReadonly();
  readonly sceneIndices = computed(() => 
    Array.from({ length: this.sceneCount() }, (_, i) => i)
  );

  // Make context menu properties accessible to template
  readonly contextMenuVisible = this.showClipContextMenu.asReadonly();
  readonly menuPosition = this.contextMenuPosition.asReadonly();
  constructor() {
    // Close menus when clicking outside
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.track-controls')) {
        this.showAddTrackMenu.set(false);
      }
      if (!target.closest('.clip-context-menu')) {
        this.showClipContextMenu.set(false);
      }
    });

    console.log('🎛️ Session component initialized');
  }

  // 🎵 TRACK MANAGEMENT
  onTrackSelect(trackId: string, event: MouseEvent): void {
    const mode = event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
    this.selectionService.selectTrack(trackId, mode);
  }

  onTrackDoubleClick(trackId: string): void {
    console.log(`🎵 Double-clicked track: ${trackId}`);
    // TODO: Show track details
  }

  isTrackSelected(trackId: string): boolean {
    return this.selectionService.isTrackSelected(trackId);
  }
  // 🎛️ TRACK CONTROLS
  toggleTrackMute(trackId: string): void {
    console.log(`🔇 Toggle mute for track ${trackId}`);
    const track = this.stateService.getTrack(trackId);
    if (!track) {
      console.log(`❌ Track ${trackId} not found`);
      return;
    }
    
    const newMuteState = !track.isMuted;
    
    // Se la track è in solo, non permettere il mute
    if (track.isSolo && newMuteState) {
      console.log(`🚫 Cannot mute track ${track.name} because it's in solo`);
      return;
    }
    
    this.stateService.updateTrack(trackId, { 
      isMuted: newMuteState 
    });
    
    console.log(`🔇 Track ${track.name} ${newMuteState ? 'muted' : 'unmuted'}`);
  }

  toggleTrackSolo(trackId: string): void {
    console.log(`🔊 Toggle solo for track ${trackId}`);
    const track = this.stateService.getTrack(trackId);
    if (!track) {
      console.log(`❌ Track ${trackId} not found`);
      return;
    }
    
    const newSoloState = !track.isSolo;
    
    // Gestione del solo: quando una track va in solo, le altre vengono automaticamente mutate
    if (newSoloState) {
      // Attiva solo su questa track e muta tutte le altre
      this.stateService.setSoloTrack(trackId);
      console.log(`🎵 Track ${track.name} soloed - all other tracks muted`);
    } else {
      // Disattiva solo su questa track
      this.stateService.clearSolo();
      console.log(`🎵 Solo cleared - all tracks unmuted`);
    }
  }

  // 🎬 SCENE MANAGEMENT
  playScene(sceneIndex: number): void {
    console.log(`🎬 Playing scene ${sceneIndex + 1}`);
    // TODO: Implement scene playback
  }

  isScenePlaying(sceneIndex: number): boolean {
    // TODO: Implement scene playing state
    return false;
  }

  addScene(): void {
    this._sceneCount.update(count => count + 1);
    console.log(`🎬 Added scene ${this._sceneCount()}`);
  }

  // 🎵 CLIP MANAGEMENT
  onClipSlotClick(trackId: string, sceneIndex: number, event: MouseEvent): void {
    const clip = this.getClipAt(trackId, sceneIndex);
    if (clip) {
      const mode = event.ctrlKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
      this.selectionService.selectClip(clip.id, mode);
    }
  }
  onClipSlotDoubleClick(trackId: string, sceneIndex: number): void {
    const clip = this.getClipAt(trackId, sceneIndex);
    if (clip) {
      console.log(`🎵 Opening clip editor for ${clip.name}`);
      // TODO: Open piano roll
    } else {
      // Create new clip
      this.createClip(trackId, sceneIndex);
    }
  }
  onClipSlotRightClick(trackId: string, sceneIndex: number, event: MouseEvent): void {
    event.preventDefault();
    const clip = this.getClipAt(trackId, sceneIndex);
    
    if (!clip) {
      // Show context menu for empty slot
      this.contextMenuPosition.set({
        x: event.clientX,
        y: event.clientY
      });
      this.contextMenuTrackId.set(trackId);
      this.contextMenuSceneIndex.set(sceneIndex);
      this.showClipContextMenu.set(true);
    }
  }

  onContextMenuAction(action: 'create' | 'paste' | 'cancel'): void {
    const trackId = this.contextMenuTrackId();
    const sceneIndex = this.contextMenuSceneIndex();
    
    switch (action) {
      case 'create':
        this.createClip(trackId, sceneIndex);
        break;
      case 'paste':
        // TODO: Implement clipboard paste
        console.log('🎵 Paste clip functionality coming soon');
        break;
      case 'cancel':
        break;
    }
    
    this.showClipContextMenu.set(false);
  }

  getClipAt(trackId: string, sceneIndex: number): ClipModel | null {
    const track = this.tracks().find(t => t.id === trackId);
    if (!track) return null;
    
    // Find clip that spans this scene (simplified logic)
    const clipAtScene = Array.from(track.clips.values()).find(clip => {
      const clipScene = Math.floor(clip.startTime / 4); // 4 beats per scene
      return clipScene === sceneIndex;
    });
    
    return clipAtScene || null;
  }  isClipPlaying(clipId: string): boolean {
    // Usa playingClips computed invece di chiamare metodi che modificano signal
    const playingClips = this.sequencerService.playingClips();
    return playingClips.some(pc => pc.clip.id === clipId);
  }

  isClipSelected(clipId: string): boolean {
    return this.selectionService.isClipSelected(clipId);
  }
  createClip(trackId: string, sceneIndex: number): void {
    const startTime = sceneIndex * 4; // 4 beats per scene
    console.log(`🎵 Creating clip at track ${trackId}, scene ${sceneIndex}, start time ${startTime}`);
    
    try {
      // VALIDATE: Check if track exists
      const track = this.stateService.getTrack(trackId);
      if (!track) {
        console.error(`❌ Track ${trackId} not found`);
        return;
      }

      const clip = this.clipManager.createClip(trackId, startTime);
      this.selectionService.selectClip(clip.id);
      console.log(`✅ Created clip: ${clip.id} on track: ${track.name}`);
    } catch (error) {
      console.error('❌ Error creating clip:', error);
      // Optionally show user notification
    }
  }
  // 🎛️ ADD TRACK FUNCTIONALITY
  toggleAddTrackMenu(): void {
    const currentState = this.showAddTrackMenu();
    console.log(`🎛️ Toggling add track menu from ${currentState} to ${!currentState}`);
    this.showAddTrackMenu.update(show => !show);
  }

  addTrack(type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad' = 'synth', name?: string): void {
    const currentTracks = this.tracks();
    const newTrack = this.trackFactory.createTrack({
      name,
      type,
      index: currentTracks.length
    });
    
    this.stateService.addTrack(newTrack);
    console.log(`🎵 Added new ${type} track:`, newTrack.name);
  }

  addTrackAndClose(type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad'): void {
    this.addTrack(type);
    this.showAddTrackMenu.set(false);
  }

  // 🎹 KEYBOARD SHORTCUTS
  onKeyDown(event: KeyboardEvent): void {
    // Ctrl+N - Create new clip on selected track at current scene
    if (event.ctrlKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.createClipOnSelectedTrack();
      return;
    }
    
    // Delete key - Delete selected clips
    if (event.key === 'Delete') {
      event.preventDefault();
      this.deleteSelectedClips();
      return;
    }
    
    // Ctrl+D - Duplicate selected clips
    if (event.ctrlKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      this.duplicateSelectedClips();
      return;
    }
  }

  private createClipOnSelectedTrack(): void {
    const selectedTracks = this.selectionService.getSelectedTracks();
    if (selectedTracks.length > 0) {
      const trackId = selectedTracks[0].id;
      const currentScene = 0; // TODO: Get current scene index from transport
      this.createClip(trackId, currentScene);
      console.log(`🎵 Created clip via Ctrl+N on track: ${selectedTracks[0].name}`);
    } else {
      console.log('⚠️ No track selected for Ctrl+N');
    }
  }
  private deleteSelectedClips(): void {
    const selectedClips = this.selectionService.getSelectedClips();
    selectedClips.forEach(clip => {
      this.stateService.removeClip(clip.id);
      console.log(`🗑️ Deleted clip: ${clip.id}`);
    });
    // Clear selection after deletion
    this.selectionService.selectClip('', 'replace');
  }

  private duplicateSelectedClips(): void {
    const selectedClips = this.selectionService.getSelectedClips();
    selectedClips.forEach(clip => {
      const newClip = this.clipManager.createClip(
        clip.trackId,
        clip.startTime + clip.length, // Place after original
        clip.length,
        clip.color
      );
      console.log(`📋 Duplicated clip: ${clip.id} -> ${newClip.id}`);
    });
  }  playClip(clipId: string): void {
    console.log('🎵 Playing clip:', clipId);
    
    // Usa playingClips computed invece di chiamare metodi che modificano signal
    const playingClips = this.sequencerService.playingClips();
    const isPlaying = playingClips.some(pc => pc.clip.id === clipId);
    
    if (isPlaying) {
      console.log('⏹️ Stopping clip:', clipId);
      this.sequencerService.stopClip(clipId);
    } else {
      console.log('▶️ Starting clip:', clipId);
      this.sequencerService.startClip(clipId);
    }
  }

  trackById = (index: number, track: TrackModel): string => track.id;
}
