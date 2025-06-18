import { BaseInstrumentImpl } from './base-instrument.abstract';
import { MidiNote } from '../../core/models/midi-note.model';
import { ParameterDefinition } from '../../core/interfaces/parameter-definition.interface';

export class BassInstrument extends BaseInstrumentImpl {
  // OBBLIGATORI: Nodi audio specifici del bass
  private filterNode!: BiquadFilterNode;
  private distortionNode!: WaveShaperNode;
  private envelope!: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };

  constructor(audioContext: AudioContext, id: string = 'bass') {
    super(audioContext, id, 'Sub Bass', 'bass');
    this.initializeAudioNodes();
  }

  // OBBLIGATORIO: Inizializzazione nodi audio specifici del bass
  private initializeAudioNodes(): void {
    // Filtro low-pass aggressivo per bass
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(400, this.audioContext.currentTime);
    this.filterNode.Q.setValueAtTime(5, this.audioContext.currentTime);
    
    // Distorsione per saturation
    this.distortionNode = this.audioContext.createWaveShaper();
    this.distortionNode.curve = this.createDistortionCurve(2);
    this.distortionNode.oversample = '4x';
    
    // Chain: filter -> distortion -> gain
    this.filterNode.connect(this.distortionNode);
    this.distortionNode.connect(this.gainNode);
    
    // Envelope ADSR per bass
    this.envelope = {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.8,
      release: 0.2
    };
  }

  // OBBLIGATORIO: Definizione parametri del bass
  protected initializeParameters(): void {
    // Oscillatore
    this.addParameterDefinition({
      name: 'waveform',
      min: 0,
      max: 3,
      default: 1, // 0=sine, 1=square, 2=sawtooth, 3=triangle
      step: 1,
      unit: 'type'
    });

    this.addParameterDefinition({
      name: 'subOscillator',
      min: 0,
      max: 1,
      default: 0.3,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'detune',
      min: -50,
      max: 50,
      default: 0,
      step: 1,
      unit: 'cents'
    });

    // Filtro low-pass aggressivo
    this.addParameterDefinition({
      name: 'cutoff',
      min: 20,
      max: 1000,
      default: 400,
      curve: 'logarithmic',
      unit: 'Hz'
    });

    this.addParameterDefinition({
      name: 'resonance',
      min: 0.1,
      max: 20,
      default: 5,
      curve: 'logarithmic',
      unit: 'Q'
    });

    // Distorsione per punch
    this.addParameterDefinition({
      name: 'drive',
      min: 1,
      max: 10,
      default: 2,
      curve: 'exponential',
      unit: 'x'
    });

    this.addParameterDefinition({
      name: 'saturation',
      min: 0,
      max: 1,
      default: 0.3,
      unit: 'level'
    });

    // Envelope ADSR
    this.addParameterDefinition({
      name: 'attack',
      min: 0.001,
      max: 1,
      default: 0.01,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'decay',
      min: 0.001,
      max: 2,
      default: 0.1,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'sustain',
      min: 0,
      max: 1,
      default: 0.8,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'release',
      min: 0.001,
      max: 5,
      default: 0.2,
      curve: 'exponential',
      unit: 's'
    });

    // Master
    this.addParameterDefinition({
      name: 'volume',
      min: 0,
      max: 1,
      default: 0.9,
      unit: 'level'
    });
  }
  // OBBLIGATORIO: Implementazione play per bass
  play(note: MidiNote): void {
    console.log(`🎹 BassInstrument.play() called for note ${note.note} with velocity ${note.velocity}`);
    
    // CRITICAL FIX: Stop any existing voice for this note to prevent duplicate oscillators
    if (this.activeVoices.has(note.note)) {
      console.log(`🛑 Stopping existing voice for note ${note.note} before starting new one`);
      this.stop(note);
    }
    
    const frequency = this.midiNoteToFrequency(note.note);
    const gain = this.velocityToGain(note.velocity);
    const currentTime = this.audioContext.currentTime;

    // Crea oscillatore principale
    const mainOscillator = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();

    // Crea sub-oscillatore (1 ottava sotto)
    const subOscillator = this.audioContext.createOscillator();
    const subGain = this.audioContext.createGain();

    // Configura oscillatore principale
    const waveformType = this.getWaveformType();
    mainOscillator.type = waveformType;
    mainOscillator.frequency.setValueAtTime(frequency, currentTime);
    
    const detuneValue = this.getParameter('detune');
    mainOscillator.detune.setValueAtTime(detuneValue, currentTime);

    // Configura sub-oscillatore
    subOscillator.type = 'sine';
    subOscillator.frequency.setValueAtTime(frequency / 2, currentTime);
    
    const subLevel = this.getParameter('subOscillator');
    subGain.gain.setValueAtTime(subLevel * gain, currentTime);

    // Configura envelope ADSR per main oscillator
    mainGain.gain.setValueAtTime(0, currentTime);
    
    // Attack
    const attack = this.getParameter('attack');
    mainGain.gain.linearRampToValueAtTime(gain, currentTime + attack);
    
    // Decay
    const decay = this.getParameter('decay');
    const sustain = this.getParameter('sustain');
    mainGain.gain.exponentialRampToValueAtTime(
      gain * sustain, 
      currentTime + attack + decay
    );

    // Collega i nodi: main -> mainGain -> filter
    mainOscillator.connect(mainGain);
    mainGain.connect(this.filterNode);

    // Collega sub oscillator direttamente al filter per più punch
    subOscillator.connect(subGain);
    subGain.connect(this.filterNode);

    // Avvia oscillatori
    mainOscillator.start(currentTime);
    subOscillator.start(currentTime);

    // Salva i nodi per questo note
    this.startVoice(note.note, [mainOscillator, subOscillator, mainGain, subGain]);
  }  // OBBLIGATORIO: Implementazione stop per bass
  stop(note: MidiNote): void {
    console.log(`🛑 BassInstrument.stop() called for note ${note.note}`);
    
    const nodes = this.activeVoices.get(note.note);
    if (!nodes || nodes.length < 4) {
      console.log(`⚠️ No active voice found for note ${note.note} - already stopped?`);
      return;
    }    const [mainOscillator, subOscillator, mainGain, subGain] = nodes;
    const currentTime = this.audioContext.currentTime;

    console.log(`� FORCE STOPPING bass note ${note.note} IMMEDIATELY (no release)`);

    // EMERGENCY FIX: Stop oscillators immediately without release envelope
    try {
      (mainOscillator as OscillatorNode).stop(currentTime);
      (subOscillator as OscillatorNode).stop(currentTime);
      console.log(`✅ Bass oscillators stopped IMMEDIATELY for note ${note.note}`);
    } catch (error) {
      console.warn(`⚠️ Error stopping bass oscillators for note ${note.note}:`, error);    }

    // CRITICAL FIX: Remove voice from active voices immediately
    this.stopVoice(note.note);
    console.log(`✅ Bass voice ${note.note} removed from active voices immediately`);
  }
  // OVERRIDE: Enhanced stopAll to handle releasing oscillators
  override stopAll(): void {
    console.log(`🛑 BassInstrument.stopAll() called - stopping ${this.activeVoices.size} active voices`);
    
    // Stop all actively playing voices (now with immediate stop)
    super.stopAll();
    
    console.log(`✅ All bass voices stopped for ${this.name}`);
  }

  // OBBLIGATORIO: Applicazione parametri ai nodi
  protected applyParameterToNodes(parameterName: string, value: number): void {
    const currentTime = this.audioContext.currentTime;

    switch (parameterName) {
      case 'cutoff':
        this.filterNode.frequency.setValueAtTime(value, currentTime);
        break;
        
      case 'resonance':
        this.filterNode.Q.setValueAtTime(value, currentTime);
        break;
        
      case 'drive':
        this.distortionNode.curve = this.createDistortionCurve(value);
        break;
        
      case 'volume':
        this.gainNode.gain.setValueAtTime(value, currentTime);
        break;
        
      case 'attack':
      case 'decay':
      case 'sustain':
      case 'release':
        this.envelope[parameterName] = value;
        break;
    }
  }

  // PRIVATE: Utility methods
  private getWaveformType(): OscillatorType {
    const waveformValue = this.getParameter('waveform');
    const waveforms: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    return waveforms[Math.floor(waveformValue)] || 'square';
  }

  private createDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }
  // OVERRIDE: Creazione nodi specifici
  protected createVoiceNodes(): AudioNode[] {
    const mainOscillator = this.audioContext.createOscillator();
    const subOscillator = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    const subGain = this.audioContext.createGain();
    return [mainOscillator, subOscillator, mainGain, subGain];
  }
  // PUBLIC: Cleanup for releasing oscillators
  override dispose(): void {
    console.log(`🧹 BassInstrument.dispose() called`);
    super.dispose();
  }
}
