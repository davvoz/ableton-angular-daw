import { BassInstrument } from './bass-instrument.instrument';

describe('BassInstrument', () => {
  let audioContext: AudioContext;
  let bassInstrument: BassInstrument;

  beforeEach(() => {
    audioContext = new AudioContext();
    bassInstrument = new BassInstrument(audioContext);
  });

  afterEach(() => {
    audioContext.close();
  });

  it('should create an instance', () => {
    expect(bassInstrument).toBeTruthy();
  });

  it('should have correct type and name', () => {
    expect(bassInstrument.type).toBe('bass');
    expect(bassInstrument.name).toBe('Sub Bass');
  });

  it('should have required parameters', () => {
    const parameters = bassInstrument.getParameters();
    const paramNames = parameters.map(p => p.name);
    
    expect(paramNames).toContain('cutoff');
    expect(paramNames).toContain('resonance');
    expect(paramNames).toContain('drive');
    expect(paramNames).toContain('subOscillator');
    expect(paramNames).toContain('attack');
    expect(paramNames).toContain('decay');
    expect(paramNames).toContain('sustain');
    expect(paramNames).toContain('release');
  });

  it('should set and get parameters correctly', () => {
    bassInstrument.setParameter('cutoff', 800);
    expect(bassInstrument.getParameter('cutoff')).toBe(800);
    
    bassInstrument.setParameter('drive', 5);
    expect(bassInstrument.getParameter('drive')).toBe(5);
  });

  it('should have audio output node', () => {
    const audioNode = bassInstrument.getAudioNode();
    expect(audioNode).toBeTruthy();
    expect(audioNode).toBeInstanceOf(GainNode);
  });
});
