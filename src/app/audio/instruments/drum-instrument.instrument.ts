import { BaseInstrumentImpl } from './base-instrument.abstract';
import { MidiNote } from '../../core/models/midi-note.model';

export class DrumInstrument extends BaseInstrumentImpl {
  // OBBLIGATORI: Drum samples e configurazione
  private drumSamples = new Map<number, {
    buffer: AudioBuffer | null;
    name: string;
    pitch: number;
    decay: number;
  }>();

  constructor(audioContext: AudioContext, id: string = 'drums') {
    super(audioContext, id, '808 Drums', 'drum');
    this.initializeDrumKit();
  }

  // OBBLIGATORIO: Inizializzazione drum kit
  private initializeDrumKit(): void {
    // GM Drum mapping standard
    this.drumSamples.set(36, { buffer: null, name: 'Kick', pitch: 60, decay: 0.5 });
    this.drumSamples.set(38, { buffer: null, name: 'Snare', pitch: 200, decay: 0.3 });
    this.drumSamples.set(42, { buffer: null, name: 'Hi-Hat Closed', pitch: 8000, decay: 0.1 });
    this.drumSamples.set(46, { buffer: null, name: 'Hi-Hat Open', pitch: 6000, decay: 0.4 });
    this.drumSamples.set(49, { buffer: null, name: 'Crash', pitch: 5000, decay: 2.0 });
    this.drumSamples.set(51, { buffer: null, name: 'Ride', pitch: 3000, decay: 1.5 });
    
    // Genera drum sounds procedurali
    this.generateProceduralDrums();
  }

  // PROCEDURAL: Generazione drum sounds senza samples
  private async generateProceduralDrums(): Promise<void> {
    // Per ora generiamo drums procedurali, in futuro si possono caricare samples
    console.log('🥁 Procedural drums initialized');
  }

  // OBBLIGATORIO: Definizione parametri del drum kit
  protected initializeParameters(): void {
    // Kick parameters
    this.addParameterDefinition({
      name: 'kickTune',
      min: -12,
      max: 12,
      default: 0,
      step: 1,
      unit: 'semitones'
    });

    this.addParameterDefinition({
      name: 'kickDecay',
      min: 0.1,
      max: 2.0,
      default: 0.5,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'kickPunch',
      min: 0,
      max: 1,
      default: 0.7,
      unit: 'level'
    });

    // Snare parameters
    this.addParameterDefinition({
      name: 'snareTune',
      min: -12,
      max: 12,
      default: 0,
      step: 1,
      unit: 'semitones'
    });

    this.addParameterDefinition({
      name: 'snareSnap',
      min: 0,
      max: 1,
      default: 0.8,
      unit: 'level'
    });

    // Hi-Hat parameters
    this.addParameterDefinition({
      name: 'hihatDecay',
      min: 0.05,
      max: 1.0,
      default: 0.2,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'hihatTone',
      min: 1000,
      max: 15000,
      default: 8000,
      curve: 'logarithmic',
      unit: 'Hz'
    });

    // Master volume
    this.addParameterDefinition({
      name: 'volume',
      min: 0,
      max: 1,
      default: 0.8,
      unit: 'level'
    });
  }

  // OBBLIGATORIO: Implementazione play per drums
  play(note: MidiNote): void {
    const drumConfig = this.drumSamples.get(note.note);
    if (!drumConfig) {
      console.warn(`No drum sound mapped for MIDI note ${note.note}`);
      return;
    }

    const gain = this.velocityToGain(note.velocity);
    this.playProceduralDrum(note.note, drumConfig, gain);
  }

  // OBBLIGATORIO: Implementazione stop per drums (istantaneo)
  stop(note: MidiNote): void {
    // I drums sono one-shot, stop immediato
    this.stopVoice(note.note);
  }

  // PROCEDURAL: Generazione suoni drum in tempo reale
  private playProceduralDrum(noteNumber: number, config: any, gain: number): void {
    const currentTime = this.audioContext.currentTime;
    let nodes: AudioNode[] = [];

    switch (config.name) {
      case 'Kick':
        nodes = this.createKick(currentTime, gain);
        break;
      case 'Snare':
        nodes = this.createSnare(currentTime, gain);
        break;
      case 'Hi-Hat Closed':
      case 'Hi-Hat Open':
        nodes = this.createHiHat(currentTime, gain, config.name === 'Hi-Hat Open');
        break;
      case 'Crash':
      case 'Ride':
        nodes = this.createCymbal(currentTime, gain, config.decay);
        break;
      default:
        nodes = this.createGenericDrum(currentTime, gain, config.pitch, config.decay);
    }

    this.startVoice(noteNumber, nodes);
  }

  // PROCEDURAL: Kick drum
  private createKick(startTime: number, gain: number): AudioNode[] {
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    // Kick frequency envelope: 60Hz -> 40Hz
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, startTime);
    osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);

    // Low-pass filter per punch
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, startTime);

    // Envelope gain
    const kickDecay = this.getParameter('kickDecay');
    const kickPunch = this.getParameter('kickPunch');
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain * kickPunch, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + kickDecay);

    // Audio chain
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.gainNode);

    // Start e cleanup
    osc.start(startTime);
    osc.stop(startTime + kickDecay + 0.1);

    return [osc, gainNode, filter];
  }

  // PROCEDURAL: Snare drum
  private createSnare(startTime: number, gain: number): AudioNode[] {
    // Snare = tone oscillator + noise
    const toneOsc = this.audioContext.createOscillator();
    const noiseBuffer = this.generateNoiseBuffer(0.2);
    const noiseSource = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    // Tone component (200Hz)
    toneOsc.type = 'triangle';
    toneOsc.frequency.setValueAtTime(200, startTime);

    // Noise component
    noiseSource.buffer = noiseBuffer;

    // Filter per snare caratteristico
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(300, startTime);

    // Envelope
    const snareSnap = this.getParameter('snareSnap');
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain * snareSnap, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    // Mix tone e noise
    const mixer = this.audioContext.createGain();
    toneOsc.connect(mixer);
    noiseSource.connect(mixer);
    mixer.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.gainNode);

    // Start
    toneOsc.start(startTime);
    noiseSource.start(startTime);
    toneOsc.stop(startTime + 0.3);
    noiseSource.stop(startTime + 0.3);

    return [toneOsc, noiseSource, gainNode, filter, mixer];
  }

  // PROCEDURAL: Hi-Hat
  private createHiHat(startTime: number, gain: number, isOpen: boolean): AudioNode[] {
    const noiseBuffer = this.generateNoiseBuffer(isOpen ? 0.4 : 0.1);
    const noiseSource = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;

    // Hi-hat filter
    filter.type = 'highpass';
    const hihatTone = this.getParameter('hihatTone');
    filter.frequency.setValueAtTime(hihatTone, startTime);

    // Envelope
    const hihatDecay = this.getParameter('hihatDecay') * (isOpen ? 2 : 1);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + hihatDecay);

    // Chain
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.gainNode);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + hihatDecay + 0.1);

    return [noiseSource, gainNode, filter];
  }

  // PROCEDURAL: Cymbal generico
  private createCymbal(startTime: number, gain: number, decay: number): AudioNode[] {
    const noiseBuffer = this.generateNoiseBuffer(decay);
    const noiseSource = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;

    // Cymbal shimmer
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, startTime);

    // Long decay envelope
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

    // Chain
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.gainNode);

    noiseSource.start(startTime);
    noiseSource.stop(startTime + decay + 0.1);

    return [noiseSource, gainNode, filter];
  }

  // UTILITY: Drum generico
  private createGenericDrum(startTime: number, gain: number, pitch: number, decay: number): AudioNode[] {
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

    osc.connect(gainNode);
    gainNode.connect(this.gainNode);

    osc.start(startTime);
    osc.stop(startTime + decay + 0.1);

    return [osc, gainNode];
  }

  // UTILITY: Generazione noise buffer
  private generateNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  // OBBLIGATORIO: Applicazione parametri
  protected applyParameterToNodes(parameterName: string, value: number): void {
    const currentTime = this.audioContext.currentTime;

    switch (parameterName) {
      case 'volume':
        this.gainNode.gain.setValueAtTime(value, currentTime);
        break;
      // Altri parametri sono applicati durante la generazione del suono
    }
  }

  // OVERRIDE: Creazione nodi (non usato per drums procedurali)
  protected createVoiceNodes(): AudioNode[] {
    return [];
  }
}
