import { Injectable, signal, computed } from '@angular/core';
import { Clip } from '../models/clip.model';
import { MidiNote } from '../models/midi-note.model';
import { StateService } from './state';

interface ClipCacheEntry {
  clip: Clip;
  lastAccessed: number;
  accessCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClipManager {
  // OBBLIGATORIO: LRU cache per performance
  private readonly MAX_CACHE_SIZE = 100;
  private clipCache = new Map<string, ClipCacheEntry>();
  private _cacheHitRate = signal<number>(0);
  private _cacheSize = signal<number>(0);
  
  // COMPUTED: Stats cache
  readonly cacheHitRate = this._cacheHitRate.asReadonly();
  readonly cacheSize = this._cacheSize.asReadonly();
  readonly cacheUsage = computed(() => 
    (this.cacheSize() / this.MAX_CACHE_SIZE) * 100
  );

  constructor(private stateService: StateService) { }  // OBBLIGATORIO: Clip creation con ottimizzazioni
  createClip(trackId: string, startTime: number, length: number = 4, color?: string): Clip {
    // VALIDATE: Check if track exists
    const track = this.stateService.getTrack(trackId);
    if (!track) {
      throw new Error(`Cannot create clip: Track ${trackId} not found`);
    }

    // VALIDATE: Check for overlapping clips
    const existingClips = Array.from(track.clips.values());
    const hasOverlap = existingClips.some(clip => 
      (startTime >= clip.startTime && startTime < clip.startTime + clip.length) ||
      (startTime + length > clip.startTime && startTime < clip.startTime + clip.length)
    );

    if (hasOverlap) {
      console.warn(`⚠️ Clip overlap detected at track ${trackId}, startTime ${startTime}`);
      // You might want to handle overlap differently based on requirements
    }

    const clipId = this.generateClipId();
    
    const clip: Clip = {
      id: clipId,
      name: `Clip ${clipId.slice(-4)}`,
      trackId,
      startTime,
      length,
      loopStart: 0,
      loopEnd: length,
      notes: new Map<string, MidiNote>(),
      noteOrder: [],
      isLoop: true,
      // isPlaying non è più nel modello, ora è nel PlaybackState
      isMuted: false,
      isSelected: false,
      color: color || this.generateClipColor(),
      endTime: startTime + length,
      noteCount: 0
    };

    // ADD to state first
    this.stateService.addClip(clip);
    
    // ADD to track's clips collection
    this.stateService.addClipToTrack(trackId, clipId);
    
    // ADD to cache
    this.addToCache(clip);
    
    console.log(`✅ Created clip: ${clipId} on track ${trackId} at ${startTime}`);
    
    return clip;
  }

  // OBBLIGATORIO: LRU cache retrieval
  getClip(clipId: string): Clip | undefined {
    // Prima controlla cache
    const cached = this.clipCache.get(clipId);
    if (cached) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.updateCacheStats(true);
      return cached.clip;
    }

    // Fallback a StateService
    const clip = this.stateService.getClip(clipId);
    if (clip) {
      this.addToCache(clip);
      this.updateCacheStats(false);
      return clip;
    }

    this.updateCacheStats(false);
    return undefined;
  }
  // OBBLIGATORIO: Note management
  addNoteToClip(clipId: string, note: MidiNote): boolean {
    const clip = this.getClip(clipId);
    if (!clip) return false;

    const newNotes = new Map(clip.notes);
    newNotes.set(note.id, note);
    
    // CRITICAL: Auto-expand clip length if note extends beyond current clip length
    let newClipLength = clip.length;
    const noteEndTime = note.endTime;
    
    if (noteEndTime > clip.length) {
      // Expand clip to accommodate the new note, rounding up to the next beat
      newClipLength = Math.ceil(noteEndTime);
      console.log(`📏 Auto-expanding clip ${clipId} from ${clip.length} to ${newClipLength} beats to accommodate note ending at ${noteEndTime}`);
    }
    
    const updatedClip: Clip = {
      ...clip,
      notes: newNotes,
      length: newClipLength, // Apply the potentially expanded length
      noteOrder: [...clip.noteOrder, note.id].sort((a, b) => {
        const noteA = newNotes.get(a)!;
        const noteB = newNotes.get(b)!;
        return noteA.startTime - noteB.startTime;
      }),
      noteCount: newNotes.size
    };

    this.stateService.updateClip(clipId, updatedClip);
    this.updateCache(clipId, updatedClip);
    
    return true;
  }
  removeNoteFromClip(clipId: string, noteId: string): boolean {
    const clip = this.getClip(clipId);
    if (!clip) return false;

    const newNotes = new Map(clip.notes);
    newNotes.delete(noteId);
    
    // OPTIONAL: Auto-shrink clip length if no notes extend to the current length
    let newClipLength = clip.length;
    if (newNotes.size > 0) {
      const maxNoteEndTime = Math.max(...Array.from(newNotes.values()).map(n => n.endTime));
      // Only shrink if the max note end time is significantly less than current length
      // Keep at least 4 beats minimum, and round up to next beat
      const minLength = Math.max(4, Math.ceil(maxNoteEndTime));
      if (minLength < clip.length) {
        newClipLength = minLength;
        console.log(`📏 Auto-shrinking clip ${clipId} from ${clip.length} to ${newClipLength} beats after note removal`);
      }
    } else {
      // No notes left, reset to default length
      newClipLength = 4;
      console.log(`📏 Resetting clip ${clipId} to default length (4 beats) - no notes remaining`);
    }
    
    const updatedClip: Clip = {
      ...clip,
      notes: newNotes,
      length: newClipLength,
      noteOrder: clip.noteOrder.filter(id => id !== noteId),
      noteCount: newNotes.size
    };

    this.stateService.updateClip(clipId, updatedClip);
    this.updateCache(clipId, updatedClip);
    
    return true;
  }
  // OBBLIGATORIO: Clip update
  updateClip(clipId: string, updates: Partial<Clip>): boolean {
    const clip = this.getClip(clipId);
    if (!clip) return false;

    // Update clip in StateService
    this.stateService.updateClip(clipId, updates);
    
    // Update cache with merged clip
    const updatedClip: Clip = {
      ...clip,
      ...updates
    };
    this.updateCache(clipId, updatedClip);
    
    return true;
  }

  // OBBLIGATORIO: Clip deletion with track cleanup
  deleteClip(clipId: string): boolean {
    const clip = this.getClip(clipId);
    if (!clip) return false;

    // Remove from track first
    this.stateService.removeClipFromTrack(clip.trackId, clipId);
    
    // Remove from global state
    this.stateService.removeClip(clipId);
    
    // Remove from cache
    this.clipCache.delete(clipId);
    this._cacheSize.set(this.clipCache.size);
    
    console.log(`🗑️ Deleted clip: ${clipId} from track: ${clip.trackId}`);
    return true;
  }

  // OBBLIGATORIO: Note update in clip
  updateNoteInClip(clipId: string, noteId: string, updates: Partial<MidiNote>): boolean {
    const clip = this.getClip(clipId);
    if (!clip) return false;

    const note = clip.notes.get(noteId);
    if (!note) return false;

    const updatedNote: MidiNote = {
      ...note,
      ...updates
    };

    const newNotes = new Map(clip.notes);
    newNotes.set(noteId, updatedNote);
    
    const updatedClip: Clip = {
      ...clip,
      notes: newNotes,
      // Re-sort noteOrder if startTime changed
      noteOrder: updates.startTime !== undefined 
        ? [...clip.noteOrder].sort((a, b) => {
            const noteA = newNotes.get(a)!;
            const noteB = newNotes.get(b)!;
            return noteA.startTime - noteB.startTime;
          })
        : clip.noteOrder
    };

    this.stateService.updateClip(clipId, updatedClip);
    this.updateCache(clipId, updatedClip);
    
    return true;
  }

  // OBBLIGATORIO: LRU cache management
  private addToCache(clip: Clip): void {
    // Rimuovi il meno usato se cache è piena
    if (this.clipCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    this.clipCache.set(clip.id, {
      clip: { ...clip },
      lastAccessed: Date.now(),
      accessCount: 1
    });

    this._cacheSize.set(this.clipCache.size);
  }

  private evictLeastRecentlyUsed(): void {
    let oldestTime = Date.now();
    let oldestKey = '';

    for (const [key, entry] of this.clipCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.clipCache.delete(oldestKey);
      console.log(`♻️ Evicted clip from cache: ${oldestKey}`);
    }
  }

  private updateCacheStats(wasHit: boolean): void {
    const currentHitRate = this._cacheHitRate();
    const newHitRate = wasHit ? 
      Math.min(1, currentHitRate + 0.01) : 
      Math.max(0, currentHitRate - 0.01);
    
    this._cacheHitRate.set(newHitRate);
  }

  // OBBLIGATORI: Cache management API
  clearCache(): void {
    this.clipCache.clear();
    this._cacheSize.set(0);
    this._cacheHitRate.set(0);
    console.log('🗑️ Clip cache cleared');
  }

  getCacheStats(): { size: number; hitRate: number; usage: number } {
    return {
      size: this.cacheSize(),
      hitRate: this.cacheHitRate(),
      usage: this.cacheUsage()
    };
  }

  // OBBLIGATORI: Batch operations per performance
  preloadClips(clipIds: string[]): void {
    const clips = clipIds.map(id => this.stateService.getClip(id)).filter((c): c is Clip => !!c);
    clips.forEach(clip => this.addToCache(clip));
  }

  // HELPER: Utility methods
  private generateClipId(): string {
    return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateClipColor(): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
      '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // OBBLIGATORIO: Update cache when clip changes
  private updateCache(clipId: string, updatedClip: Clip): void {
    const cached = this.clipCache.get(clipId);
    if (cached) {
      cached.clip = { ...updatedClip };
      cached.lastAccessed = Date.now();
    }
  }
}
