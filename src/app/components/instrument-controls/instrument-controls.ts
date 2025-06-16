import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseInstrument } from '../../core/interfaces/base-instrument.interface';
import { ParameterDefinition } from '../../core/interfaces/parameter-definition.interface';
import { MidiNote } from '../../core/models/midi-note.model';

@Component({
  selector: 'app-instrument-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instrument-controls.html',
  styleUrl: './instrument-controls.scss'
})
export class InstrumentControls {
  // INPUT: Strumento da controllare
  @Input() instrument: BaseInstrument | null = null;
  @Input() disabled: boolean = false;

  // OUTPUT: Eventi per notificare cambiamenti
  @Output() parameterChanged = new EventEmitter<{parameter: string, value: number}>();
  @Output() notePlay = new EventEmitter<MidiNote>();
  @Output() noteStop = new EventEmitter<MidiNote>();
  // STATE: Parametri reattivi
  private _parameters = signal<readonly ParameterDefinition[]>([]);
  private _parameterValues = signal<Map<string, number>>(new Map());
  
  // COMPUTED: Parametri organizzati per categoria
  readonly synthParameters = computed(() => 
    this._parameters().filter(p => 
      ['waveform', 'detune', 'subOscillator'].includes(p.name)
    )
  );
  
  readonly filterParameters = computed(() => 
    this._parameters().filter(p => 
      ['cutoff', 'resonance', 'drive', 'saturation'].includes(p.name)
    )
  );
  
  readonly envelopeParameters = computed(() => 
    this._parameters().filter(p => 
      ['attack', 'decay', 'sustain', 'release'].includes(p.name)
    )
  );
  
  readonly drumParameters = computed(() => 
    this._parameters().filter(p => 
      p.name.includes('kick') || p.name.includes('snare') || p.name.includes('hihat')
    )
  );
  
  readonly masterParameters = computed(() => 
    this._parameters().filter(p => 
      ['volume'].includes(p.name)
    )
  );

  // COMPUTED: Info strumento
  readonly hasInstrument = computed(() => this.instrument !== null);
  readonly instrumentInfo = computed(() => {
    if (!this.instrument) return null;
    return {
      name: this.instrument.name,
      type: this.instrument.type,
      id: this.instrument.id,
      isActive: this.instrument.isActive,
      voiceCount: this.instrument.voiceCount
    };
  });

  // LIFECYCLE: Aggiorna parametri quando cambia strumento
  ngOnChanges(): void {
    this.updateParameters();
  }

  // PUBLIC: Aggiorna parametri da strumento
  updateParameters(): void {
    if (!this.instrument) {
      this._parameters.set([]);
      this._parameterValues.set(new Map());
      return;
    }

    const params = this.instrument.getParameters();
    this._parameters.set(params);
    
    // Aggiorna valori correnti
    const values = new Map<string, number>();
    params.forEach(param => {
      values.set(param.name, this.instrument!.getParameter(param.name));
    });
    this._parameterValues.set(values);
  }

  // PUBLIC: Gestione parametri
  onParameterChange(parameterName: string, value: number): void {
    if (!this.instrument || this.disabled) return;

    // Aggiorna strumento
    this.instrument.setParameter(parameterName, value);
    
    // Aggiorna stato locale
    const currentValues = new Map(this._parameterValues());
    currentValues.set(parameterName, value);
    this._parameterValues.set(currentValues);
    
    // Emetti evento
    this.parameterChanged.emit({ parameter: parameterName, value });
  }

  // PUBLIC: Gestione note test
  playTestNote(note: number = 60): void {
    if (!this.instrument || this.disabled) return;

    const testNote: MidiNote = {
      id: `test-${Date.now()}`,
      note: note,
      velocity: 100,
      startTime: 0,
      duration: 1,
      noteName: this.getNoteNameFromNumber(note),
      endTime: 1
    };

    this.instrument.play(testNote);
    this.notePlay.emit(testNote);

    // Auto-stop dopo 1 secondo
    setTimeout(() => {
      this.instrument?.stop(testNote);
      this.noteStop.emit(testNote);
    }, 1000);
  }

  // PUBLIC: Stop tutte le note
  stopAllNotes(): void {
    if (!this.instrument) return;
    this.instrument.stopAll();
  }

  // UTILITY: Ottieni valore parametro
  getParameterValue(parameterName: string): number {
    return this._parameterValues().get(parameterName) ?? 0;
  }

  // UTILITY: Formatta valore per display
  formatParameterValue(param: ParameterDefinition, value: number): string {
    const unit = param.unit || '';
    
    // Formattazione speciale per alcuni tipi
    switch (param.name) {
      case 'waveform':
        const waveforms = ['Sine', 'Square', 'Sawtooth', 'Triangle'];
        return waveforms[Math.floor(value)] || 'Unknown';
      
      case 'cutoff':
      case 'hihatTone':
        return `${Math.round(value)} ${unit}`;
      
      case 'attack':
      case 'decay':
      case 'release':
      case 'kickDecay':
      case 'hihatDecay':
        return `${(value * 1000).toFixed(0)} ms`;
      
      default:
        if (param.step && param.step >= 1) {
          return `${Math.round(value)} ${unit}`;
        }
        return `${value.toFixed(2)} ${unit}`;
    }
  }

  // UTILITY: Converte numero nota in nome
  private getNoteNameFromNumber(noteNumber: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  }

  // UTILITY: Ottieni range slider per parametro
  getSliderStep(param: ParameterDefinition): number {
    if (param.step) return param.step;
    
    const range = param.max - param.min;
    if (range <= 1) return 0.01;
    if (range <= 10) return 0.1;
    if (range <= 100) return 1;
    return Math.ceil(range / 100);
  }

  // UTILITY: Verifica se parametro è discreto
  isDiscreteParameter(param: ParameterDefinition): boolean {
    return param.step !== undefined && param.step >= 1;
  }
}
