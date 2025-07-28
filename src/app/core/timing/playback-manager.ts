import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { StateService } from '../services/state';
import { EventBus } from '../events/event-bus';
import { TimingEngine } from './timing-engine';
import { AudioEngineService } from '../../audio/audio-engine';
import { ClipManager } from '../services/clip-manager';
import { PlaybackState, ScheduledEvent, PlayingNote } from '../models/playback.model';
import { Clip } from '../models/clip.model';
import { Track } from '../models/track.model';
import { MidiNote } from '../models/midi-note.model';

@Injectable({
    providedIn: 'root'
})
export class PlaybackManager {
    private readonly stateService = inject(StateService);
    private readonly eventBus = inject(EventBus);
    private readonly timingEngine = inject(TimingEngine);
    private readonly audioEngine = inject(AudioEngineService);
    private readonly clipManager = inject(ClipManager);

    private readonly SCHEDULE_AHEAD_TIME = 0.1; // 100ms

    // OBBLIGATORIO: Stato interno centralizzato per playback
    private _playbackState = signal<PlaybackState>({
        isPlaying: false,
        isPaused: false,
        currentBeat: 0,
        activeClips: new Set<string>(),
        scheduledEvents: new Map<string, ScheduledEvent>(),
        playingNotes: new Map<string, PlayingNote>(),
        bpm: 120,
        timeSignature: [4, 4],
        metronomeEnabled: false,
        loopEnabled: false,
        loopStart: 0,
        loopEnd: 16,
        quantization: 16, // 1/16 note
        swing: 0
    });

    // COMPUTED: Selectors
    readonly playbackState = this._playbackState.asReadonly();
    readonly isPlaying = computed(() => this._playbackState().isPlaying);
    readonly currentBeat = computed(() => this._playbackState().currentBeat);
    readonly activeClips = computed(() => this._playbackState().activeClips);
    readonly playingNotes = computed(() => this._playbackState().playingNotes);
    readonly scheduledEvents = computed(() => this._playbackState().scheduledEvents);

    readonly playingClips = computed(() => {
        const activeClips = this.activeClips();
        const allClips: Clip[] = [];
        const tracks = this.stateService.tracks();

        // Trova i clip attivi dalle tracce
        tracks.forEach(track => {
            track.clips.forEach(clip => {
                if (activeClips.has(clip.id)) {
                    allClips.push(clip);
                }
            });
        });

        return allClips;
    });

    constructor() {
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Gestione eventi di timing
        this.eventBus.on('TIMING_TICK', ({ payload }) => {
            this.updateCurrentBeat(payload.currentBeat);
            this.scheduleUpcomingEvents(payload.currentBeat, payload.audioTime);
        });

        // Gestione eventi di transport
        this.eventBus.on('TRANSPORT_STOP', () => {
            this.stopAllClips();
        });

        // Sync con stato globale
        this.syncWithState();
    }

    private syncWithState(): void {
        // Sincronizza BPM
        effect(() => {
            const bpm = this.stateService.transport().bpm;
            this.updatePlaybackState(state => ({ ...state, bpm }));
        });
    }

    // OBBLIGATORIO: Aggiornamento stato centrale
    private updatePlaybackState(updater: (state: PlaybackState) => PlaybackState): void {
        this._playbackState.update(updater);
    }

    // OBBLIGATORIO: Update del beat corrente
    private updateCurrentBeat(beat: number): void {
        this.updatePlaybackState(state => ({ ...state, currentBeat: beat }));
    }

    // OBBLIGATORIO: Clip playback control
    startClip(clipId: string): void {
        const clip = this.clipManager.getClip(clipId);
        if (!clip) {
            console.error(`❌ Cannot start clip: Clip ${clipId} not found`);
            return;
        }

        // Aggiunge clip agli attivi
        this.updatePlaybackState(state => ({
            ...state,
            activeClips: new Set([...state.activeClips, clipId])
        }));

        // Trova la traccia del clip
        const track = this.findTrackForClip(clipId);
        if (!track) {
            console.error(`❌ Cannot start clip: Track for clip ${clipId} not found`);
            return;
        }

        // Emette evento per notificare che il clip è partito
        this.eventBus.emit({
            type: 'CLIP_START',
            payload: {
                clipId,
                startBeat: this.timingEngine.currentBeat(),
                quantized: false
            }
        });

        // Se il sequencer è in play, schedula immediatamente le note
        if (this.isPlaying()) {
            this.scheduleClipEvents(clip, track, this.currentBeat());
        }

        console.log(`🎵 Started clip: ${clip.name}`);
    }

    stopClip(clipId: string): void {
        const clip = this.clipManager.getClip(clipId);
        if (!clip) return;

        // Rimuove clip dagli attivi
        this.updatePlaybackState(state => {
            const newActiveClips = new Set(state.activeClips);
            newActiveClips.delete(clipId);
            return {
                ...state,
                activeClips: newActiveClips
            };
        });

        // Ferma tutte le note attive di questo clip
        this.stopClipNotes(clipId);

        // Cancella eventi schedulati di questo clip
        this.cancelClipEvents(clipId);

        // Emette evento per notificare che il clip si è fermato
        this.eventBus.emit({
            type: 'CLIP_STOP',
            payload: { clipId }
        });

        console.log(`⏹️ Stopped clip: ${clip.name}`);
    }

    stopAllClips(): void {
        // Ottiene una copia dell'array per evitare problemi con l'iterazione
        const activeClips = Array.from(this.activeClips());

        // Ferma tutti i clip uno per uno
        activeClips.forEach(clipId => {
            this.stopClip(clipId);
        });

        // Ferma tutte le note attive che possono essere rimaste
        this.stopAllNotes();

        console.log(`🛑 Stopped all clips: ${activeClips.length} clips`);
    }

    // OBBLIGATORIO: Note e scheduling
    private stopAllNotes(): void {
        this.audioEngine.stopAllNotes();

        this.updatePlaybackState(state => ({
            ...state,
            playingNotes: new Map()
        }));
    }

    private stopClipNotes(clipId: string): void {
        const playingNotes = this._playbackState().playingNotes;
        const notesToStop: PlayingNote[] = [];

        // Trova tutte le note di questo clip
        playingNotes.forEach(note => {
            if (note.clipId === clipId) {
                notesToStop.push(note);
            }
        });

        // Ferma tutte le note trovate
        notesToStop.forEach(note => {
            this.audioEngine.stopNote(note.pitch, note.voiceId);
        });

        // Aggiorna lo stato rimuovendo le note fermate
        this.updatePlaybackState(state => {
            const newPlayingNotes = new Map(state.playingNotes);
            notesToStop.forEach(note => {
                newPlayingNotes.delete(note.id);
            });

            return {
                ...state,
                playingNotes: newPlayingNotes
            };
        });

        console.log(`🎵 Stopped ${notesToStop.length} notes from clip ${clipId}`);
    }

    private cancelClipEvents(clipId: string): void {
        const scheduledEvents = this._playbackState().scheduledEvents;
        const eventsToCancel: ScheduledEvent[] = [];

        // Trova tutti gli eventi di questo clip
        scheduledEvents.forEach(event => {
            if (event.clipId === clipId) {
                eventsToCancel.push(event);
            }
        });

        // Aggiorna lo stato rimuovendo gli eventi cancellati
        this.updatePlaybackState(state => {
            const newScheduledEvents = new Map(state.scheduledEvents);
            eventsToCancel.forEach(event => {
                newScheduledEvents.delete(event.id);
            });

            return {
                ...state,
                scheduledEvents: newScheduledEvents
            };
        });

        console.log(`🗑️ Cancelled ${eventsToCancel.length} scheduled events for clip ${clipId}`);
    }

    // OBBLIGATORIO: Scheduling di eventi futuri
    private scheduleUpcomingEvents(currentBeat: number, audioTime: number): void {
        if (!this.isPlaying()) return;

        const scheduleUntilBeat = currentBeat + this.SCHEDULE_AHEAD_TIME * this._playbackState().bpm / 60;
        const activeClips = this.activeClips();
        const tracks = this.stateService.tracks();

        // Per ogni clip attivo, schedula le note nel range di tempo
        tracks.forEach(track => {
            track.clips.forEach(clip => {
                if (activeClips.has(clip.id)) {
                    this.scheduleClipEvents(clip, track, currentBeat, scheduleUntilBeat, audioTime);
                }
            });
        });

        // Cleanup di eventi vecchi
        this.cleanupOldEvents(audioTime);
    }

    private scheduleClipEvents(clip: Clip, track: Track, currentBeat: number, untilBeat?: number, startAudioTime?: number): void {
        const audioContext = this.audioEngine.getAudioContext();
        if (!audioContext) return;

        const until = untilBeat || (currentBeat + 4); // Default: schedula 4 beats avanti
        const startTime = startAudioTime || audioContext.currentTime;

        // Assicurati che stiamo schedulando solo note che non sono già state schedulate
        const scheduledEvents = this._playbackState().scheduledEvents;
        const loopLength = clip.loopEnd - clip.loopStart;

        // Per ogni nota nel clip
        clip.notes.forEach((note, noteId) => {
            // Calcola tutte le occorrenze della nota nel range temporale, considerando il loop
            const noteEvents = this.calculateNoteEventsInRange(note, clip, currentBeat, until);

            // Schedula ogni occorrenza della nota
            noteEvents.forEach(event => {
                // Genera un ID univoco per questo evento
                const eventId = `${clip.id}-${noteId}-${event.beat.toFixed(3)}`;

                // Se l'evento è già schedulato, salta
                if (scheduledEvents.has(eventId)) return;

                // Converti il tempo musicale in tempo audio
                const eventAudioTime = this.timingEngine.beatToAudioTime(event.beat);

                // Schedula l'evento
                if (event.type === 'note_start') {
                    // Schedula inizio nota
                    this.scheduleNoteStart(note, clip, track, event.beat, eventAudioTime, eventId);
                } else if (event.type === 'note_stop') {
                    // Schedula fine nota
                    this.scheduleNoteStop(note, clip, track, event.beat, eventAudioTime, eventId);
                }
            });
        });
    }

    private calculateNoteEventsInRange(note: MidiNote, clip: Clip, fromBeat: number, toBeat: number): Array<{
        type: 'note_start' | 'note_stop';
        beat: number;
        note: MidiNote;
    }> {
        const events: Array<{ type: 'note_start' | 'note_stop'; beat: number; note: MidiNote }> = [];

        // Calcola posizione nota rispetto all'inizio del clip
        const clipStartTime = clip.startTime;
        const clipLength = clip.length;
        const isLoop = clip.isLoop;
        const noteStartInClip = note.startTime;
        const noteEndInClip = note.startTime + note.duration;

        // Se il clip non è in loop, calcola una singola occorrenza
        if (!isLoop) {
            const absoluteNoteStart = clipStartTime + noteStartInClip;
            const absoluteNoteEnd = clipStartTime + noteEndInClip;

            // Se la nota inizia in questo range
            if (absoluteNoteStart >= fromBeat && absoluteNoteStart < toBeat) {
                events.push({
                    type: 'note_start',
                    beat: absoluteNoteStart,
                    note
                });
            }

            // Se la nota finisce in questo range
            if (absoluteNoteEnd >= fromBeat && absoluteNoteEnd < toBeat) {
                events.push({
                    type: 'note_stop',
                    beat: absoluteNoteEnd,
                    note
                });
            }

            return events;
        }

        // Se il clip è in loop, calcola più occorrenze

        // 1. Trova il primo loop che interseca il range temporale
        let currentLoopStart = clipStartTime;
        while (currentLoopStart + clipLength < fromBeat) {
            currentLoopStart += clipLength;
        }

        // 2. Schedula tutte le occorrenze nel range
        while (currentLoopStart < toBeat) {
            const absoluteNoteStart = currentLoopStart + noteStartInClip;
            const absoluteNoteEnd = currentLoopStart + noteEndInClip;

            // Se la nota inizia in questo range
            if (absoluteNoteStart >= fromBeat && absoluteNoteStart < toBeat) {
                events.push({
                    type: 'note_start',
                    beat: absoluteNoteStart,
                    note
                });
            }

            // Se la nota finisce in questo range
            if (absoluteNoteEnd >= fromBeat && absoluteNoteEnd < toBeat) {
                events.push({
                    type: 'note_stop',
                    beat: absoluteNoteEnd,
                    note
                });
            }

            // Passa al loop successivo
            currentLoopStart += clipLength;
        }

        return events;
    }

    // Schedula inizio nota
    private scheduleNoteStart(note: MidiNote, clip: Clip, track: Track, beatTime: number, audioTime: number, eventId: string): void {
        // Se la traccia è mutata, non suonare
        if (track.isMuted || clip.isMuted) {
            console.log(`🔇 Note ${note.id} muted (track/clip mute)`);
            return;
        }

        // Trova instrument dalla traccia
        const instrumentId = track.instrumentId;
        if (!instrumentId) {
            console.warn(`⚠️ No instrument for track ${track.id}`);
            return;
        }

        // Schedula audio
        const voiceId = this.audioEngine.scheduleNote(
            note.note,
            note.velocity,
            audioTime,
            instrumentId
        );

        if (!voiceId) {
            console.warn(`⚠️ Failed to schedule note ${note.id}`);
            return;
        }

        // Calcola durata nota
        const noteDuration = note.duration;
        const noteEndBeat = beatTime + noteDuration;
        const noteEndTime = this.timingEngine.beatToAudioTime(noteEndBeat);

        // Aggiungi nota attiva
        const playingNoteId = `${clip.id}-${note.id}-${audioTime.toFixed(3)}`;
        const playingNote: PlayingNote = {
            id: playingNoteId,
            noteId: note.id,
            clipId: clip.id,
            startTime: audioTime,
            scheduledEndTime: noteEndTime,
            pitch: this.note2Pitch(note.note),
            velocity: note.velocity,
            voiceId
        };

        // Aggiungi evento schedulato
        const scheduledEvent: ScheduledEvent = {
            id: eventId,
            type: 'note_start',
            beat: beatTime,
            audioTime,
            clipId: clip.id,
            noteId: note.id,
            scheduledIds: [voiceId]
        };

        // Aggiorna stato
        this.updatePlaybackState(state => {
            const newPlayingNotes = new Map(state.playingNotes);
            newPlayingNotes.set(playingNoteId, playingNote);

            const newScheduledEvents = new Map(state.scheduledEvents);
            newScheduledEvents.set(eventId, scheduledEvent);

            return {
                ...state,
                playingNotes: newPlayingNotes,
                scheduledEvents: newScheduledEvents
            };
        });

        // Emetti evento
        this.eventBus.emit({
            type: 'NOTE_START',
            payload: {
                noteId: note.id,
                clipId: clip.id,
                trackId: track.id,
                audioTime
            }
        });
    }
    // Schedula fine nota
    private scheduleNoteStop(note: MidiNote, clip: Clip, track: Track, beatTime: number, audioTime: number, eventId: string): void {
        // Se la traccia è mutata, ignora (la nota non è stata riprodotta)
        if (track.isMuted || clip.isMuted) {
            return;
        }

        // Trova tutte le note attive che corrispondono a questa nota
        const playingNotes = this._playbackState().playingNotes;
        const matchingNotes: PlayingNote[] = [];

        playingNotes.forEach(playingNote => {
            if (playingNote.noteId === note.id && playingNote.clipId === clip.id) {
                matchingNotes.push(playingNote);
            }
        });

        if (matchingNotes.length === 0) {
            // Nessuna nota attiva trovata
            return;
        }

        // Per ogni nota attiva trovata, schedula lo stop
        matchingNotes.forEach(playingNote => {
            // Schedula audio stop
            if (playingNote.voiceId) {
                // Usa setTimeout per schedulare lo stop della nota
                const currentTime = this.audioEngine.getAudioContext()?.currentTime || 0;
                const delayMs = Math.max(0, (audioTime - currentTime) * 1000);

                setTimeout(() => {
                    this.audioEngine.stopNote(playingNote.pitch, playingNote.voiceId);                    // Emetti evento di fine nota
                    this.eventBus.emit({
                        type: 'NOTE_END',
                        payload: {
                            noteId: note.id,
                            clipId: clip.id,
                            audioTime
                        }
                    });
                }, delayMs);
            }

            // Aggiungi evento schedulato
            const scheduledEvent: ScheduledEvent = {
                id: eventId,
                type: 'note_stop',
                beat: beatTime,
                audioTime,
                clipId: clip.id,
                noteId: note.id,
                scheduledIds: playingNote.voiceId ? [playingNote.voiceId] : undefined
            };

            // Aggiorna stato
            this.updatePlaybackState(state => {
                const newScheduledEvents = new Map(state.scheduledEvents);
                newScheduledEvents.set(eventId, scheduledEvent);
                return {
                    ...state,
                    scheduledEvents: newScheduledEvents
                };
            });
        });
    }

    // Pulizia eventi vecchi
    private cleanupOldEvents(currentAudioTime: number): void {
        const threshold = currentAudioTime - 1.0; // Eventi più vecchi di 1 secondo
        const scheduledEvents = this._playbackState().scheduledEvents;
        const eventsToRemove: string[] = [];

        scheduledEvents.forEach((event, id) => {
            if (event.audioTime < threshold) {
                eventsToRemove.push(id);
            }
        });

        if (eventsToRemove.length === 0) return;

        this.updatePlaybackState(state => {
            const newScheduledEvents = new Map(state.scheduledEvents);
            eventsToRemove.forEach(id => {
                newScheduledEvents.delete(id);
            });

            return {
                ...state,
                scheduledEvents: newScheduledEvents
            };
        });

        console.log(`🧹 Cleaned up ${eventsToRemove.length} old scheduled events`);
    }

    // UTILITY: Helper methods
    private findTrackForClip(clipId: string): Track | undefined {
        const tracks = this.stateService.tracks();
        return tracks.find(track =>
            Array.from(track.clips.values()).some(clip => clip.id === clipId)
        );
    }    isClipActive(clipId: string): boolean {
        return this._playbackState().activeClips.has(clipId);
    }

    private note2Pitch(note: number): number {
        return Math.pow(2, (note - 69) / 12) * 440;
    }


}

