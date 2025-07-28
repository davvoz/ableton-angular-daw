import { Injectable, signal, computed, inject } from '@angular/core';
import { AppState } from '../interfaces/app-state.interface';
import { Track } from '../models/track.model';
import { Clip } from '../models/clip.model';
import { TransportState } from '../models/transport.model';
import { InstrumentDefinition, InstrumentInstance } from '../models/instrument.model';
import { BaseInstrument } from '../interfaces/base-instrument.interface';
import { InstrumentFactoryService } from './instrument-factory';
import { InstrumentRegistryService } from './instrument-registry';
import { TrackFactoryService } from './track-factory.service';

// OBBLIGATORIO: Stato iniziale secondo specifiche
const createInitialState = (): AppState => ({
  // OBBLIGATORI: Collections principali (Map per O(1) lookup)
  tracks: new Map<string, Track>(),
  clips: new Map<string, Clip>(),
  instrumentDefinitions: new Map<string, InstrumentDefinition>(),
  instrumentInstances: new Map<string, InstrumentInstance>(),
  
  // OBBLIGATORI: Ordini visualizzazione
  trackOrder: [],
  
  // OBBLIGATORI: Stati principali
  transport: {
    isPlaying: false,
    isRecording: false,
    isLooping: false,
    isMetronomeOn: false,
    currentTime: 0,
    totalTime: 0,
    loopStart: 0,
    loopEnd: 0,
    bpm: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    swing: 0,
    quantization: '1/16',
    quantizationStrength: 1.0,
    currentBar: 0,
    currentBeat: 0,
    currentTick: 0,
    isInLoop: false
  },
  
  selection: {
    selectedTrackIds: [],
    selectedClipIds: [],
    selectedNoteIds: [],
    selectionMode: 'single',
    lastSelectedId: null,
    hasSelection: false,
    selectionCount: 0
  },
  
  // OBBLIGATORI: Stato applicazione
  isLoading: false,
  isDirty: false,
  currentProjectId: null,
  
  // OBBLIGATORI: UI State
  zoomLevel: 1.0,
  scrollPosition: 0,
  viewMode: 'session',
  
  // COMPUTED: Proprietà derivate
  trackCount: 0,
  clipCount: 0,
  hasUnsavedChanges: false
});

@Injectable({
  providedIn: 'root'
})
export class StateService {
  // OBBLIGATORIO: Signal-based state (NO RxJS Observable)
  private readonly _state = signal<AppState>(createInitialState());
    // OBBLIGATORI: Dependency injection per strumenti
  private instrumentFactory = inject(InstrumentFactoryService);
  private instrumentRegistry = inject(InstrumentRegistryService);
  private trackFactory = inject(TrackFactoryService);
  
  // OBBLIGATORI: Cache strumenti attivi (BaseInstrument instances)
  private _activeInstruments = signal<Map<string, BaseInstrument>>(new Map());
  private _selectedInstrument = signal<BaseInstrument | null>(null);
  
  // 🔒 Flag per evitare doppia inizializzazione
  private _initialized = false;
  
  // OBBLIGATORI: Getter computed per reattività
  readonly state = this._state.asReadonly();
  readonly tracks = computed(() => Array.from(this._state().tracks.values()));
  readonly clips = computed(() => Array.from(this._state().clips.values()));
  readonly trackOrder = computed(() => this._state().trackOrder);
  readonly transport = computed(() => this._state().transport);
  readonly selection = computed(() => this._state().selection);
  
  // NUOVI: Getter per strumenti
  readonly instruments = computed(() => this._activeInstruments());
  readonly selectedInstrument = this._selectedInstrument.asReadonly();
  
  // COMPUTED: Proprietà derivate per performance
  readonly trackCount = computed(() => this._state().tracks.size);
  readonly clipCount = computed(() => this._state().clips.size);
  readonly hasSelection = computed(() => this._state().selection.selectionCount > 0);
  constructor() { 
    console.log('🏗️ StateService constructor - NON inizializza automaticamente');
    // NON chiamare initializeDefaultState() qui per evitare doppia inizializzazione
  }

  // OBBLIGATORI: Metodi CRUD per tracks
  addTrack(track: Track): void {
    this._state.update(state => ({
      ...state,
      tracks: new Map(state.tracks).set(track.id, track),
      trackOrder: [...state.trackOrder, track.id],
      isDirty: true
    }));
  }

  removeTrack(id: string): void {
    this._state.update(state => {
      const newTracks = new Map(state.tracks);
      newTracks.delete(id);
      return {
        ...state,
        tracks: newTracks,
        trackOrder: state.trackOrder.filter(trackId => trackId !== id),
        isDirty: true
      };
    });
  }
  updateTrack(id: string, updates: Partial<Track>): void {
    console.log(`🔧 StateService.updateTrack called for ${id} with updates:`, updates);
    
    this._state.update(state => {
      const track = state.tracks.get(id);
      if (!track) {
        console.log(`❌ Track ${id} not found in state`);
        return state;
      }
      
      console.log(`📊 BEFORE UPDATE: Track ${track.name} - isMuted: ${track.isMuted}, isSolo: ${track.isSolo}`);
      
      const updatedTrack = { ...track, ...updates };
      const newTracks = new Map(state.tracks);
      newTracks.set(id, updatedTrack);
      
      console.log(`📊 AFTER UPDATE: Track ${updatedTrack.name} - isMuted: ${updatedTrack.isMuted}, isSolo: ${updatedTrack.isSolo}`);
      
      return {
        ...state,
        tracks: newTracks,
        isDirty: true
      };
    });
  }

  // NUOVO: Gestione del Solo per le track
  setSoloTrack(trackId: string): void {
    this._state.update(state => {
      const newTracks = new Map();
      
      // Itera su tutte le track
      for (const [id, track] of state.tracks) {
        if (id === trackId) {
          // La track selezionata va in solo e non è mutata
          newTracks.set(id, { 
            ...track, 
            isSolo: true, 
            isMuted: false 
          });
        } else {
          // Tutte le altre track vengono mutate e perdono il solo
          newTracks.set(id, { 
            ...track, 
            isSolo: false, 
            isMuted: true 
          });
        }
      }
      
      return {
        ...state,
        tracks: newTracks,
        isDirty: true
      };
    });
  }

  clearSolo(): void {
    this._state.update(state => {
      const newTracks = new Map();
      
      // Rimuove il solo da tutte le track e le smuta
      for (const [id, track] of state.tracks) {
        newTracks.set(id, { 
          ...track, 
          isSolo: false, 
          isMuted: false 
        });
      }
      
      return {
        ...state,
        tracks: newTracks,
        isDirty: true
      };
    });
  }

  // OBBLIGATORI: Metodi CRUD per clips
  addClip(clip: Clip): void {
    this._state.update(state => ({
      ...state,
      clips: new Map(state.clips).set(clip.id, clip),
      isDirty: true
    }));
  }

  // NEW: Add clip to track's clips collection
  addClipToTrack(trackId: string, clipId: string): void {
    const track = this.getTrack(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    const clip = this.getClip(clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }

    this._state.update(state => {
      const updatedTracks = new Map(state.tracks);
      const updatedTrack = {
        ...track,
        clips: new Map(track.clips).set(clipId, clip),
        clipCount: track.clips.size + 1
      };
      updatedTracks.set(trackId, updatedTrack);

      return {
        ...state,
        tracks: updatedTracks,
        isDirty: true
      };
    });
  }

  removeClip(id: string): void {
    this._state.update(state => {
      const newClips = new Map(state.clips);
      newClips.delete(id);
      return {
        ...state,
        clips: newClips,
        isDirty: true
      };
    });
  }

  // NEW: Remove clip from track
  removeClipFromTrack(trackId: string, clipId: string): void {
    const track = this.getTrack(trackId);
    if (!track) {
      console.warn(`Track ${trackId} not found`);
      return;
    }

    this._state.update(state => {
      const updatedTracks = new Map(state.tracks);
      const updatedClips = new Map(track.clips);
      updatedClips.delete(clipId);
      
      const updatedTrack = {
        ...track,
        clips: updatedClips,
        clipCount: updatedClips.size
      };
      updatedTracks.set(trackId, updatedTrack);

      return {
        ...state,
        tracks: updatedTracks,
        isDirty: true
      };
    });
  }

  updateClip(id: string, updates: Partial<Clip>): void {
    this._state.update(state => {
      const clip = state.clips.get(id);
      if (!clip) return state;
      
      const updatedClip = { ...clip, ...updates };
      const newClips = new Map(state.clips);
      newClips.set(id, updatedClip);
      
      // Also update clip in track
      const track = state.tracks.get(clip.trackId);
      if (track) {
        const updatedTracks = new Map(state.tracks);
        const updatedTrackClips = new Map(track.clips);
        updatedTrackClips.set(id, updatedClip);
        
        const updatedTrack = {
          ...track,
          clips: updatedTrackClips
        };
        updatedTracks.set(clip.trackId, updatedTrack);
        
        return {
          ...state,
          clips: newClips,
          tracks: updatedTracks,
          isDirty: true
        };
      }
      
      return {
        ...state,
        clips: newClips,
        isDirty: true
      };
    });
  }

  // OBBLIGATORI: Metodi per Transport
  updateTransport(updates: Partial<TransportState>): void {
    this._state.update(state => ({
      ...state,
      transport: { ...state.transport, ...updates },
      isDirty: true
    }));
  }

  // OBBLIGATORI: Metodi per Selection
  setSelection(trackIds: string[] = [], clipIds: string[] = [], noteIds: string[] = []): void {
    this._state.update(state => ({
      ...state,
      selection: {
        selectedTrackIds: trackIds,
        selectedClipIds: clipIds,
        selectedNoteIds: noteIds,
        selectionMode: trackIds.length + clipIds.length + noteIds.length > 1 ? 'multiple' : 'single',
        lastSelectedId: [...trackIds, ...clipIds, ...noteIds].pop() || null,
        hasSelection: trackIds.length + clipIds.length + noteIds.length > 0,
        selectionCount: trackIds.length + clipIds.length + noteIds.length
      }
    }));
  }
  clearSelection(): void {
    this.setSelection();
  }

  // OBBLIGATORI: Metodi utili per ordinamento
  reorderTracks(newOrder: string[]): void {
    this._state.update(state => ({
      ...state,
      trackOrder: [...newOrder],
      isDirty: true
    }));
  }

  // OBBLIGATORI: Metodi batch per performance
  batchUpdate(updates: {
    tracks?: Map<string, Track>;
    clips?: Map<string, Clip>;
    transport?: Partial<TransportState>;
    trackOrder?: string[];
  }): void {
    this._state.update(state => ({
      ...state,
      ...(updates.tracks && { tracks: new Map(updates.tracks) }),
      ...(updates.clips && { clips: new Map(updates.clips) }),
      ...(updates.transport && { transport: { ...state.transport, ...updates.transport } }),
      ...(updates.trackOrder && { trackOrder: [...updates.trackOrder] }),
      isDirty: true
    }));
  }

  // UTILITY: Getter per Map lookups O(1)
  getTrack(id: string): Track | undefined {
    return this._state().tracks.get(id);
  }

  getClip(id: string): Clip | undefined {
    return this._state().clips.get(id);
  }

  getInstrumentInstance(id: string): InstrumentInstance | undefined {
    return this._state().instrumentInstances.get(id);
  }

  getInstrumentDefinition(id: string): InstrumentDefinition | undefined {
    return this._state().instrumentDefinitions.get(id);
  }

  getOrderedTracks(): Track[] {
    const state = this._state();
    return state.trackOrder
      .map(id => state.tracks.get(id))
      .filter((track): track is Track => track !== undefined);
  }

  isPlaying(): boolean {
    return this._state().transport.isPlaying;
  }

  isRecording(): boolean {
    return this._state().transport.isRecording;
  }
  // UTILITY: Reset stato
  resetState(): void {
    this._state.set(createInitialState());
    this._activeInstruments.set(new Map());
    this._selectedInstrument.set(null);
  }
  // NUOVI: Gestione strumenti attivi
  public initializeState(): void {
    if (this._initialized) {
      console.log('⚠️ StateService già inizializzato, skip doppia inizializzazione');
      return;
    }
    
    console.log('🔄 Inizializzando stato con strumenti di default...');
    this.initializeDefaultState();
  }  private initializeDefaultState(): void {
    if (this._initialized) {
      console.log('⚠️ initializeDefaultState già eseguito, skip');
      return;
    }
    
    console.log('🎹 Creando strumenti di default...');
    
    try {
      // Verifica che l'AudioEngine sia inizializzato
      const audioContext = this.instrumentFactory['audioEngine'].getAudioContext();
      if (!audioContext) {
        console.warn('⚠️ AudioContext non disponibile, ritento tra 100ms...');
        setTimeout(() => this.initializeDefaultState(), 100);
        return;
      }
      
      if (audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext sospeso, attivando...');
        audioContext.resume().then(() => {
          console.log('✅ AudioContext riattivato');
          this.createDefaultInstruments();
        });
      } else {
        this.createDefaultInstruments();
      }
      
    } catch (error) {
      console.error('❌ Errore nella verifica AudioContext:', error);
      // Fallback: prova comunque a creare gli strumenti
      this.createDefaultInstruments();
    }
  }
    private createDefaultInstruments(): void {
    console.log('🎵 Tentativo di creare strumenti e tracce...');
    
    try {
      // Crea strumenti usando le definizioni dal registry
      const instruments = new Map<string, BaseInstrument>();
      
      // Prova a creare i 3 strumenti principali
      const synthInstrument = this.instrumentFactory.createInstrument('analog-synth', 'synth-track');
      if (synthInstrument) {
        instruments.set('synth', synthInstrument);
        console.log('✅ Synth creato:', synthInstrument.name);
      } else {
        console.error('❌ Impossibile creare Synth');
      }
      
      const bassInstrument = this.instrumentFactory.createInstrument('sub-bass', 'bass-track');
      if (bassInstrument) {
        instruments.set('bass', bassInstrument);
        console.log('✅ Bass creato:', bassInstrument.name);
      } else {
        console.error('❌ Impossibile creare Bass');
      }
      
      const drumInstrument = this.instrumentFactory.createInstrument('808-drums', 'drum-track');
      if (drumInstrument) {
        instruments.set('drums', drumInstrument);
        console.log('✅ Drums creati:', drumInstrument.name);
      } else {
        console.error('❌ Impossibile creare Drums');
      }      // Aggiorna il signal degli strumenti attivi
      this._activeInstruments.set(instruments);
      
      // 🆕 DISABILITATO: Non creare tracce default automaticamente
      // this.createDefaultTracks(instruments);
      
      // 🔒 Marca come inizializzato per evitare doppie inizializzazioni
      this._initialized = true;
      
      console.log(`🎉 Inizializzati ${instruments.size} strumenti su 3 tentativi`);
      
      if (instruments.size === 0) {
        console.warn('⚠️ Nessuno strumento creato, verifica configurazione');
      }
      
    } catch (error) {
      console.error('❌ Errore nella creazione strumenti:', error);
    }
  }  // 🆕 NUOVO: Crea tracce default
  private createDefaultTracks(instruments: Map<string, BaseInstrument>): void {
    console.log('🎛️ Creando tracce default...');
    
    const tracks: Track[] = [];
    let trackIndex = 0;
    
    // Crea una traccia per ogni strumento
    instruments.forEach((instrument, key) => {
      const trackType = this.getTrackTypeForInstrument(key);
      const track = this.trackFactory.createTrack({
        name: this.getTrackNameForInstrument(key),
        type: trackType,
        index: trackIndex++
      });
      
      // Override instrument ID to match the created instrument
      const updatedTrack: Track = {
        ...track,
        instrumentId: instrument.id,
        color: this.getTrackColorForType(key)
      };
      
      tracks.push(updatedTrack);
      console.log(`✅ Traccia creata: ${updatedTrack.name} (${updatedTrack.instrumentType})`);
    });
    
    // Aggiorna lo stato delle tracce
    this._state.update(state => {
      const newTracksMap = new Map<string, Track>();
      tracks.forEach(track => newTracksMap.set(track.id, track));
      
      return {
        ...state,
        tracks: newTracksMap,
        trackOrder: tracks.map(t => t.id)
      };
    });
    
    console.log(`🎛️ ${tracks.length} tracce create con successo`);
  }

  // 🆕 Helper methods per tracce default
  private getTrackTypeForInstrument(instrumentKey: string): 'synth' | 'drum' | 'bass' | 'lead' | 'pad' {
    const types = {
      'synth': 'synth' as const,
      'bass': 'bass' as const,
      'drums': 'drum' as const
    };
    return types[instrumentKey as keyof typeof types] || 'synth';
  }

  // 🆕 Helper methods per tracce default
  private getTrackNameForInstrument(instrumentKey: string): string {
    const names = {
      'synth': 'Analog Synth',
      'bass': 'Sub Bass',
      'drums': '808 Drums'
    };
    return names[instrumentKey as keyof typeof names] || 'Track';
  }

  private getTrackColorForType(type: string): string {
    const colors = {
      'synth': '#00ff88',
      'bass': '#ff4444', 
      'drums': '#ffaa00'
    };
    return colors[type as keyof typeof colors] || '#888888';
  }

  // NUOVI: Metodi per gestione strumenti
  addActiveInstrument(instrument: BaseInstrument): void {
    this._activeInstruments.update(instruments => {
      const newMap = new Map(instruments);
      newMap.set(instrument.id, instrument);
      return newMap;
    });
  }

  removeActiveInstrument(instrumentId: string): void {
    const instrument = this._activeInstruments().get(instrumentId);
    if (instrument) {
      instrument.dispose();
      
      this._activeInstruments.update(instruments => {
        const newMap = new Map(instruments);
        newMap.delete(instrumentId);
        return newMap;
      });
      
      if (this._selectedInstrument()?.id === instrumentId) {
        this._selectedInstrument.set(null);
      }
    }
  }

  selectInstrument(instrumentId: string): void {
    const instrument = this._activeInstruments().get(instrumentId);
    this._selectedInstrument.set(instrument || null);
  }

  getActiveInstrument(instrumentId: string): BaseInstrument | undefined {
    return this._activeInstruments().get(instrumentId);
  }

  // NUOVO: Metodo per ottenere strumenti come array
  getInstruments(): BaseInstrument[] {
    const instrumentsMap = this._activeInstruments();
    const array = Array.from(instrumentsMap.values());
    console.log('🔍 getInstruments chiamato, map size:', instrumentsMap.size, 'array length:', array.length);
    return array;
  }

  // NUOVO: Metodo per testare riproduzione strumento
  playInstrumentTest(instrumentId: string): void {
    const instrument = this._activeInstruments().get(instrumentId);
    if (!instrument) {
      console.warn(`Strumento ${instrumentId} non trovato per test play`);
      return;
    }

    try {
      const testNote = {
        id: `test-${Date.now()}`,
        note: 60, // C4
        noteName: 'C4',
        velocity: 100,
        startTime: 0,
        endTime: 1000,
        duration: 1000
      };

      instrument.play(testNote);
      setTimeout(() => instrument.stop(testNote), 1000);
      console.log(`🎵 Test play per ${instrument.name}`);
    } catch (error) {
      console.error(`Errore nel test play per ${instrumentId}:`, error);
    }
  }
  // NUOVO: Metodo per aggiungere nuovo strumento
  addNewInstrument(): void {
    try {
      const types = ['synth', 'drum', 'bass'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const timestamp = Date.now();
      const trackId = `track-${timestamp}`;
      
      const newInstrument = this.instrumentFactory.createInstrument(randomType, trackId);

      if (newInstrument) {
        this.addActiveInstrument(newInstrument);
        console.log(`✅ Nuovo strumento aggiunto: ${newInstrument.name}`);
      }
    } catch (error) {
      console.error('Errore nell\'aggiunta nuovo strumento:', error);
    }
  }

  // NUOVO: Debug completo
  debugState(): void {
    console.log('🔍 === DEBUG STATE COMPLETO ===');
    console.log('State service instance:', this);
    console.log('Active instruments signal:', this._activeInstruments());
    console.log('Active instruments map:', this._activeInstruments());
    console.log('Instruments array:', this.getInstruments());
    console.log('InstrumentFactory:', this.instrumentFactory);
    console.log('InstrumentRegistry:', this.instrumentRegistry);
    console.log('===========================');
  }
}
