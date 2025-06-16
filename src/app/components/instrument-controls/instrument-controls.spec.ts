import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { InstrumentControls } from './instrument-controls';
import { BaseInstrument } from '../../core/interfaces/base-instrument.interface';
import { ParameterDefinition } from '../../core/interfaces/parameter-definition.interface';
import { MidiNote } from '../../core/models/midi-note.model';

// Mock instrument for testing
class MockInstrument implements BaseInstrument {
  id = 'test-instrument';
  name = 'Test Instrument';
  type: 'synth' | 'drum' | 'bass' | 'lead' | 'pad' = 'synth';
  trackId = 'test-track';
  isActive = true;
  voiceCount = 4;

  private parameters: Map<string, number> = new Map([
    ['volume', 0.8],
    ['cutoff', 1000],
    ['resonance', 0.5],
    ['attack', 0.1],
    ['decay', 0.3],
    ['sustain', 0.7],
    ['release', 0.5],
    ['waveform', 0]
  ]);

  private parameterDefinitions: ParameterDefinition[] = [
    { name: 'volume', min: 0, max: 1, default: 0.8, unit: '' },
    { name: 'cutoff', min: 20, max: 20000, default: 1000, unit: 'Hz' },
    { name: 'resonance', min: 0, max: 1, default: 0.5, unit: '' },
    { name: 'attack', min: 0, max: 2, default: 0.1, unit: 's' },
    { name: 'decay', min: 0, max: 2, default: 0.3, unit: 's' },
    { name: 'sustain', min: 0, max: 1, default: 0.7, unit: '' },
    { name: 'release', min: 0, max: 2, default: 0.5, unit: 's' },
    { name: 'waveform', min: 0, max: 3, default: 0, unit: '', step: 1 }
  ];

  private mockAudioNode: AudioNode = {} as AudioNode;

  getParameters(): readonly ParameterDefinition[] {
    return this.parameterDefinitions;
  }

  getParameter(name: string): number {
    return this.parameters.get(name) ?? 0;
  }

  setParameter(name: string, value: number): void {
    this.parameters.set(name, value);
  }

  play(note: MidiNote): void {
    // Mock implementation
  }

  stop(note: MidiNote): void {
    // Mock implementation
  }

  stopAll(): void {
    // Mock implementation
  }

  getAudioNode(): AudioNode {
    return this.mockAudioNode;
  }

  reset(): void {
    // Mock implementation
  }

  dispose(): void {
    // Mock implementation
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }
}

describe('InstrumentControls', () => {
  let component: InstrumentControls;
  let fixture: ComponentFixture<InstrumentControls>;
  let mockInstrument: MockInstrument;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentControls, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentControls);
    component = fixture.componentInstance;
    mockInstrument = new MockInstrument();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with no instrument', () => {
    expect(component.instrument).toBeNull();
    expect(component.hasInstrument()).toBeFalsy();
    expect(component.instrumentInfo()).toBeNull();
  });

  describe('Instrument Integration', () => {
    beforeEach(() => {
      component.instrument = mockInstrument;
      component.updateParameters();
      fixture.detectChanges();
    });

    it('should display instrument info when instrument is set', () => {
      expect(component.hasInstrument()).toBeTruthy();
      
      const info = component.instrumentInfo();
      expect(info).toBeTruthy();
      expect(info?.name).toBe('Test Instrument');
      expect(info?.type).toBe('synth');
      expect(info?.isActive).toBeTruthy();
      expect(info?.voiceCount).toBe(4);
    });

    it('should load parameters from instrument', () => {
      const synthParams = component.synthParameters();
      const filterParams = component.filterParameters();
      const envelopeParams = component.envelopeParameters();
      const masterParams = component.masterParameters();

      expect(synthParams.length).toBeGreaterThan(0);
      expect(filterParams.length).toBeGreaterThan(0);
      expect(envelopeParams.length).toBeGreaterThan(0);
      expect(masterParams.length).toBeGreaterThan(0);
    });

    it('should get parameter values correctly', () => {
      expect(component.getParameterValue('volume')).toBe(0.8);
      expect(component.getParameterValue('cutoff')).toBe(1000);
      expect(component.getParameterValue('nonexistent')).toBe(0);
    });
  });

  describe('Parameter Management', () => {
    beforeEach(() => {
      component.instrument = mockInstrument;
      component.updateParameters();
    });

    it('should handle parameter changes', () => {
      spyOn(component.parameterChanged, 'emit');
      spyOn(mockInstrument, 'setParameter');

      component.onParameterChange('volume', 0.5);

      expect(mockInstrument.setParameter).toHaveBeenCalledWith('volume', 0.5);
      expect(component.parameterChanged.emit).toHaveBeenCalledWith({
        parameter: 'volume',
        value: 0.5
      });
      expect(component.getParameterValue('volume')).toBe(0.5);
    });

    it('should not change parameters when disabled', () => {
      component.disabled = true;
      spyOn(mockInstrument, 'setParameter');

      component.onParameterChange('volume', 0.5);

      expect(mockInstrument.setParameter).not.toHaveBeenCalled();
    });

    it('should not change parameters when no instrument', () => {
      component.instrument = null;
      spyOn(component.parameterChanged, 'emit');

      component.onParameterChange('volume', 0.5);

      expect(component.parameterChanged.emit).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Formatting', () => {
    beforeEach(() => {
      component.instrument = mockInstrument;
      component.updateParameters();
    });    it('should format waveform parameter correctly', () => {
      const waveformParam = { name: 'waveform', min: 0, max: 3, default: 0, unit: '', step: 1 };
      
      expect(component.formatParameterValue(waveformParam, 0)).toBe('Sine');
      expect(component.formatParameterValue(waveformParam, 1)).toBe('Square');
      expect(component.formatParameterValue(waveformParam, 2)).toBe('Sawtooth');
      expect(component.formatParameterValue(waveformParam, 3)).toBe('Triangle');
    });

    it('should format frequency parameters correctly', () => {
      const cutoffParam = { name: 'cutoff', min: 20, max: 20000, default: 1000, unit: 'Hz' };
      
      expect(component.formatParameterValue(cutoffParam, 1000)).toBe('1000 Hz');
    });

    it('should format time parameters correctly', () => {
      const attackParam = { name: 'attack', min: 0, max: 2, default: 0.1, unit: 's' };
      
      expect(component.formatParameterValue(attackParam, 0.1)).toBe('100 ms');
      expect(component.formatParameterValue(attackParam, 0.05)).toBe('50 ms');
    });

    it('should format decimal parameters correctly', () => {
      const volumeParam = { name: 'volume', min: 0, max: 1, default: 0.8, unit: '' };
      
      expect(component.formatParameterValue(volumeParam, 0.8)).toBe('0.80 ');
    });
  });

  describe('Slider Utilities', () => {
    it('should calculate correct slider steps', () => {
      const paramWithStep = { name: 'test', min: 0, max: 10, default: 5, unit: '', step: 0.5 };
      const paramWithoutStep = { name: 'test', min: 0, max: 100, default: 50, unit: '' };
      const smallRange = { name: 'test', min: 0, max: 1, default: 0.5, unit: '' };

      expect(component.getSliderStep(paramWithStep)).toBe(0.5);
      expect(component.getSliderStep(paramWithoutStep)).toBe(1);
      expect(component.getSliderStep(smallRange)).toBe(0.01);
    });

    it('should identify discrete parameters correctly', () => {
      const discreteParam = { name: 'test', min: 0, max: 10, default: 5, unit: '', step: 1 };
      const continuousParam = { name: 'test', min: 0, max: 1, default: 0.5, unit: '' };

      expect(component.isDiscreteParameter(discreteParam)).toBeTruthy();
      expect(component.isDiscreteParameter(continuousParam)).toBeFalsy();
    });
  });

  describe('Note Playing', () => {
    beforeEach(() => {
      component.instrument = mockInstrument;
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should play test note', () => {
      spyOn(mockInstrument, 'play');
      spyOn(component.notePlay, 'emit');

      component.playTestNote(60);

      expect(mockInstrument.play).toHaveBeenCalled();
      expect(component.notePlay.emit).toHaveBeenCalled();

      const playCall = mockInstrument.play as jasmine.Spy;
      const note = playCall.calls.mostRecent().args[0] as MidiNote;
      expect(note.note).toBe(60);
      expect(note.noteName).toBe('C4');
      expect(note.velocity).toBe(100);
    });

    it('should auto-stop test note after 1 second', () => {
      spyOn(mockInstrument, 'stop');
      spyOn(component.noteStop, 'emit');

      component.playTestNote(60);

      // Fast-forward time
      jasmine.clock().tick(1001);

      expect(mockInstrument.stop).toHaveBeenCalled();
      expect(component.noteStop.emit).toHaveBeenCalled();
    });

    it('should not play note when disabled', () => {
      component.disabled = true;
      spyOn(mockInstrument, 'play');

      component.playTestNote(60);

      expect(mockInstrument.play).not.toHaveBeenCalled();
    });

    it('should stop all notes', () => {
      spyOn(mockInstrument, 'stopAll');

      component.stopAllNotes();

      expect(mockInstrument.stopAll).toHaveBeenCalled();
    });
  });

  describe('Note Name Conversion', () => {
    it('should convert note numbers to correct names', () => {
      // Test some common notes
      component.instrument = mockInstrument;
      
      // Testing private method through public method
      component.playTestNote(60); // C4
      expect(component.notePlay.emit).toHaveBeenCalled();
      
      const emitCall = (component.notePlay.emit as jasmine.Spy).calls.mostRecent();
      const note = emitCall.args[0] as MidiNote;
      expect(note.noteName).toBe('C4');
    });
  });

  describe('Lifecycle', () => {
    it('should update parameters on ngOnChanges', () => {
      spyOn(component, 'updateParameters');
      
      component.ngOnChanges();
      
      expect(component.updateParameters).toHaveBeenCalled();
    });

    it('should clear parameters when instrument is null', () => {
      component.instrument = mockInstrument;
      component.updateParameters();
      
      expect(component.synthParameters().length).toBeGreaterThan(0);
      
      component.instrument = null;
      component.updateParameters();
      
      expect(component.synthParameters().length).toBe(0);
      expect(component.getParameterValue('volume')).toBe(0);
    });
  });


});
