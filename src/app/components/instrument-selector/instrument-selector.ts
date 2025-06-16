import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstrumentRegistryService } from '../../core/services/instrument-registry';
import { InstrumentDefinition } from '../../core/models/instrument.model';

@Component({
  selector: 'app-instrument-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instrument-selector.html',
  styleUrl: './instrument-selector.scss'
})
export class InstrumentSelector {
  // DEPENDENCY INJECTION
  private instrumentRegistry = inject(InstrumentRegistryService);

  // INPUTS
  selectedInstrumentId = input<string | null>(null);
  disabled = input<boolean>(false);

  // OUTPUTS
  instrumentSelected = output<InstrumentDefinition>();

  // COMPUTED GETTERS
  get instruments(): InstrumentDefinition[] {
    return this.instrumentRegistry.instruments();
  }

  get categories(): string[] {
    return this.instrumentRegistry.getCategories();
  }

  get selectedInstrument(): InstrumentDefinition | null {
    const id = this.selectedInstrumentId();
    return id ? this.instrumentRegistry.getInstrument(id) || null : null;
  }

  // METHODS
  selectInstrument(instrument: InstrumentDefinition): void {
    if (!this.disabled() && instrument) {
      this.instrumentSelected.emit(instrument);
    }
  }

  onSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const instrumentId = target.value;
    
    if (instrumentId) {
      const instrument = this.instrumentRegistry.getInstrument(instrumentId);
      if (instrument) {
        this.selectInstrument(instrument);
      }
    }
  }

  getInstrumentsByCategory(category: string): InstrumentDefinition[] {
    return this.instruments.filter(inst => inst.category === category);
  }

  isSelected(instrumentId: string): boolean {
    return this.selectedInstrumentId() === instrumentId;
  }
}
