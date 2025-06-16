import { Track } from '../models/track.model';
import { Clip } from '../models/clip.model';
import { TransportState } from '../models/transport.model';
import { InstrumentDefinition, InstrumentInstance } from '../models/instrument.model';

export interface SelectionState {
  // OBBLIGATORI: Elementi selezionati
  readonly selectedTrackIds: readonly string[];        // OBBLIGATORIO: Track selezionate
  readonly selectedClipIds: readonly string[];         // OBBLIGATORIO: Clip selezionati
  readonly selectedNoteIds: readonly string[];         // OBBLIGATORIO: Note selezionate
  
  // OBBLIGATORI: Tipo di selezione
  readonly selectionMode: 'single' | 'multiple' | 'range'; // OBBLIGATORIO
  readonly lastSelectedId: string | null;              // OBBLIGATORIO: Ultimo elemento selezionato
  
  // COMPUTED: Convenienza
  readonly hasSelection: boolean;                      // COMPUTED: Se c'è qualcosa di selezionato
  readonly selectionCount: number;                     // COMPUTED: Numero totale elementi selezionati
}

export interface AppState {
  // OBBLIGATORI: Collections principali (Map per O(1) lookup)
  readonly tracks: ReadonlyMap<string, Track>;         // OBBLIGATORIO: Map per O(1) lookup
  readonly clips: ReadonlyMap<string, Clip>;           // OBBLIGATORIO: Map per O(1) lookup
  readonly instrumentDefinitions: ReadonlyMap<string, InstrumentDefinition>; // OBBLIGATORIO
  readonly instrumentInstances: ReadonlyMap<string, InstrumentInstance>; // OBBLIGATORIO
  
  // OBBLIGATORI: Ordini visualizzazione (Array per ordine)
  readonly trackOrder: readonly string[];              // OBBLIGATORIO: Array per ordine visualizzazione
  
  // OBBLIGATORI: Stati principali
  readonly transport: TransportState;                  // OBBLIGATORIO: Stato playback
  readonly selection: SelectionState;                  // OBBLIGATORIO: Elementi selezionati
  
  // OBBLIGATORI: Stato applicazione
  readonly isLoading: boolean;                         // OBBLIGATORIO: Se sta caricando
  readonly isDirty: boolean;                           // OBBLIGATORIO: Se ci sono modifiche non salvate
  readonly currentProjectId: string | null;           // OBBLIGATORIO: ID progetto corrente
  
  // OBBLIGATORI: UI State
  readonly zoomLevel: number;                          // OBBLIGATORIO: Livello zoom timeline (0.1-10.0)
  readonly scrollPosition: number;                     // OBBLIGATORIO: Posizione scroll timeline
  readonly viewMode: 'session' | 'piano-roll' | 'mixer'; // OBBLIGATORIO: Vista corrente
  
  // COMPUTED: Proprietà derivate per performance
  readonly trackCount: number;                         // COMPUTED: tracks.size
  readonly clipCount: number;                          // COMPUTED: clips.size
  readonly hasUnsavedChanges: boolean;                 // COMPUTED: isDirty
}
