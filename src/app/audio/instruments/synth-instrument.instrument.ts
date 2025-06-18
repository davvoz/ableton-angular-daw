import { BaseInstrumentImpl } from './base-instrument.abstract';
import { MidiNote } from '../../core/models/midi-note.model';

export class SynthInstrument extends BaseInstrumentImpl {
  // OBBLIGATORI: Nodi audio specifici del synth
  private filterNode!: BiquadFilterNode;
  private lfoOscillator!: OscillatorNode;
  private lfoGain!: GainNode;
  private delayNode!: DelayNode;
  private delayFeedback!: GainNode;
  private delayWet!: GainNode;
  private chorusDelay!: DelayNode;
  private chorusLfo!: OscillatorNode;
  private chorusGain!: GainNode;
  private envelope!: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };

  constructor(audioContext: AudioContext, id: string = 'synth') {
    super(audioContext, id, 'Analog Synth', 'synth');
    this.initializeAudioNodes();
  }

  // OBBLIGATORIO: Inizializzazione nodi audio specifici del synth
  private initializeAudioNodes(): void {
    // Filtro low-pass con cutoff modulabile
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    this.filterNode.Q.setValueAtTime(1, this.audioContext.currentTime);
    
    // LFO per modulazione filtro
    this.lfoOscillator = this.audioContext.createOscillator();
    this.lfoOscillator.type = 'sine';
    this.lfoOscillator.frequency.setValueAtTime(4, this.audioContext.currentTime);
    
    this.lfoGain = this.audioContext.createGain();
    this.lfoGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    
    // Delay per spazialità
    this.delayNode = this.audioContext.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(0.25, this.audioContext.currentTime);
    
    this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    
    this.delayWet = this.audioContext.createGain();
    this.delayWet.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    
    // Chorus per ricchezza timbrica
    this.chorusDelay = this.audioContext.createDelay(0.1);
    this.chorusDelay.delayTime.setValueAtTime(0.02, this.audioContext.currentTime);
    
    this.chorusLfo = this.audioContext.createOscillator();
    this.chorusLfo.type = 'sine';
    this.chorusLfo.frequency.setValueAtTime(0.8, this.audioContext.currentTime);
    
    this.chorusGain = this.audioContext.createGain();
    this.chorusGain.gain.setValueAtTime(0.005, this.audioContext.currentTime);
    
    // Routing audio: oscillatori -> filter -> chorus -> delay -> gain
    this.filterNode.connect(this.chorusDelay);
    this.filterNode.connect(this.delayWet); // Dry signal
    
    // Setup chorus
    this.chorusLfo.connect(this.chorusGain);
    this.chorusGain.connect(this.chorusDelay.delayTime);
    this.chorusDelay.connect(this.delayWet);
    
    // Setup delay
    this.delayWet.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
    this.delayWet.connect(this.gainNode); // Wet + dry
    
    // Setup LFO per filtro
    this.lfoOscillator.connect(this.lfoGain);
    this.lfoGain.connect(this.filterNode.frequency);
    
    // Avvia LFO permanenti
    this.lfoOscillator.start();
    this.chorusLfo.start();
    
    // Envelope ADSR per synth
    this.envelope = {
      attack: 0.1,
      decay: 0.3,
      sustain: 0.6,
      release: 0.8
    };
  }
  // OBBLIGATORIO: Definizione parametri del synth
  protected initializeParameters(): void {
    // Oscillatori duali
    this.addParameterDefinition({
      name: 'waveform1',
      min: 0,
      max: 3,
      default: 2, // 0=sine, 1=square, 2=sawtooth, 3=triangle
      step: 1,
      unit: 'type'
    });

    this.addParameterDefinition({
      name: 'waveform2',
      min: 0,
      max: 3,
      default: 1,
      step: 1,
      unit: 'type'
    });

    this.addParameterDefinition({
      name: 'oscillatorMix',
      min: 0,
      max: 1,
      default: 0.5,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'detune',
      min: -50,
      max: 50,
      default: 7,
      step: 1,
      unit: 'cents'
    });

    this.addParameterDefinition({
      name: 'octave',
      min: -2,
      max: 2,
      default: 0,
      step: 1,
      unit: 'oct'
    });

    // Filtro modulabile
    this.addParameterDefinition({
      name: 'cutoff',
      min: 100,
      max: 8000,
      default: 2000,
      curve: 'logarithmic',
      unit: 'Hz'
    });

    this.addParameterDefinition({
      name: 'resonance',
      min: 0.1,
      max: 10,
      default: 1,
      curve: 'logarithmic',
      unit: 'Q'
    });

    // LFO per modulazione
    this.addParameterDefinition({
      name: 'lfoRate',
      min: 0.1,
      max: 20,
      default: 4,
      curve: 'logarithmic',
      unit: 'Hz'
    });

    this.addParameterDefinition({
      name: 'lfoAmount',
      min: 0,
      max: 1000,
      default: 0,
      unit: 'Hz'
    });

    // Envelope ADSR
    this.addParameterDefinition({
      name: 'attack',
      min: 0.001,
      max: 2,
      default: 0.1,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'decay',
      min: 0.001,
      max: 2,
      default: 0.3,
      curve: 'exponential',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'sustain',
      min: 0,
      max: 1,
      default: 0.6,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'release',
      min: 0.01,
      max: 3,
      default: 0.8,
      curve: 'exponential',
      unit: 's'
    });

    // Effetti
    this.addParameterDefinition({
      name: 'delayTime',
      min: 0.05,
      max: 1,
      default: 0.25,
      curve: 'logarithmic',
      unit: 's'
    });

    this.addParameterDefinition({
      name: 'delayFeedback',
      min: 0,
      max: 0.8,
      default: 0.3,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'delayWet',
      min: 0,
      max: 1,
      default: 0.2,
      unit: 'level'
    });

    this.addParameterDefinition({
      name: 'chorusRate',
      min: 0.1,
      max: 5,
      default: 0.8,
      unit: 'Hz'
    });

    this.addParameterDefinition({
      name: 'chorusDepth',
      min: 0,
      max: 0.02,
      default: 0.005,
      unit: 's'
    });

    // Master
    this.addParameterDefinition({
      name: 'volume',
      min: 0,
      max: 1,
      default: 0.7,
      unit: 'level'
    });  }
    // OBBLIGATORIO: Implementazione play per synth
  play(note: MidiNote): void {
    console.log(`🎹 SynthInstrument.play() called for note ${note.note} with velocity ${note.velocity}`);
    
    // CRITICAL FIX: Stop any existing voice for this note to prevent duplicate oscillators
    if (this.activeVoices.has(note.note)) {
      console.log(`🛑 Stopping existing voice for note ${note.note} before starting new one`);
      this.stop(note);
    }
    
    const frequency = this.midiNoteToFrequency(note.note);
    const gain = this.velocityToGain(note.velocity);
    const currentTime = this.audioContext.currentTime;

    console.log(`🔊 Note frequency: ${frequency}Hz, gain: ${gain}, audioContext time: ${currentTime}`);

    // Crea oscillatori duali
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const osc1Gain = this.audioContext.createGain();
    const osc2Gain = this.audioContext.createGain();
    const voiceGain = this.audioContext.createGain();

    // Configura oscillatore 1
    const waveform1 = this.getWaveformType('waveform1');
    oscillator1.type = waveform1;
    
    const octaveShift = this.getParameter('octave');
    const adjustedFreq = frequency * Math.pow(2, octaveShift);
    oscillator1.frequency.setValueAtTime(adjustedFreq, currentTime);

    // Configura oscillatore 2 (detuned)
    const waveform2 = this.getWaveformType('waveform2');
    oscillator2.type = waveform2;
    
    const detuneValue = this.getParameter('detune');
    oscillator2.frequency.setValueAtTime(adjustedFreq, currentTime);
    oscillator2.detune.setValueAtTime(detuneValue, currentTime);

    // Mix oscillatori
    const oscillatorMix = this.getParameter('oscillatorMix');
    osc1Gain.gain.setValueAtTime((1 - oscillatorMix) * 0.7, currentTime);
    osc2Gain.gain.setValueAtTime(oscillatorMix * 0.7, currentTime);

    // Configura envelope ADSR
    voiceGain.gain.setValueAtTime(0, currentTime);
    
    // Attack
    const attack = this.getParameter('attack');
    voiceGain.gain.linearRampToValueAtTime(gain, currentTime + attack);
    
    // Decay
    const decay = this.getParameter('decay');
    const sustain = this.getParameter('sustain');
    voiceGain.gain.exponentialRampToValueAtTime(
      gain * sustain, 
      currentTime + attack + decay
    );    console.log(`🎛️ Envelope: attack=${attack}, decay=${decay}, sustain=${sustain}`);

    // Routing: oscillatori -> gains -> voiceGain -> filter
    oscillator1.connect(osc1Gain);
    oscillator2.connect(osc2Gain);
    osc1Gain.connect(voiceGain);
    osc2Gain.connect(voiceGain);
    voiceGain.connect(this.filterNode);

    console.log(`🔗 Audio chain connected: oscillators -> gains -> voice -> filter -> effects -> master`);

    // Avvia oscillatori
    oscillator1.start(currentTime);
    oscillator2.start(currentTime);

    console.log(`🎯 Oscillators started at time ${currentTime}`);    // Salva i nodi per questo note
    this.startVoice(note.note, [oscillator1, oscillator2, osc1Gain, osc2Gain, voiceGain]);
    
    console.log(`✅ Voice ${note.note} started successfully. Active voices: ${this.activeVoices.size}`);
  }  // OBBLIGATORIO: Implementazione stop per synth
  stop(note: MidiNote): void {
    console.log(`🛑 SynthInstrument.stop() called for note ${note.note}`);
    
    const nodes = this.activeVoices.get(note.note);
    if (!nodes || nodes.length < 5) {
      console.log(`⚠️ No active voice found for note ${note.note} - already stopped?`);
      return;
    }    const [oscillator1, oscillator2, osc1Gain, osc2Gain, voiceGain] = nodes;
    const currentTime = this.audioContext.currentTime;

    console.log(`� FORCE STOPPING note ${note.note} IMMEDIATELY (no release)`);

    // EMERGENCY FIX: Stop oscillators immediately without release envelope
    try {
      (oscillator1 as OscillatorNode).stop(currentTime);
      (oscillator2 as OscillatorNode).stop(currentTime);
      console.log(`✅ Synth oscillators stopped IMMEDIATELY for note ${note.note}`);
    } catch (error) {
      console.warn(`⚠️ Error stopping synth oscillators for note ${note.note}:`, error);
    }

    // CRITICAL FIX: Remove voice from active voices immediately
    this.stopVoice(note.note);
    console.log(`✅ Voice ${note.note} removed from active voices immediately`);
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
        
      case 'lfoRate':
        this.lfoOscillator.frequency.setValueAtTime(value, currentTime);
        break;
        
      case 'lfoAmount':
        this.lfoGain.gain.setValueAtTime(value, currentTime);
        break;
        
      case 'delayTime':
        this.delayNode.delayTime.setValueAtTime(value, currentTime);
        break;
        
      case 'delayFeedback':
        this.delayFeedback.gain.setValueAtTime(value, currentTime);
        break;
        
      case 'delayWet':
        this.delayWet.gain.setValueAtTime(value, currentTime);
        break;
        
      case 'chorusRate':
        this.chorusLfo.frequency.setValueAtTime(value, currentTime);
        break;
        
      case 'chorusDepth':
        this.chorusGain.gain.setValueAtTime(value, currentTime);
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
  private getWaveformType(parameterName: string): OscillatorType {
    const waveformValue = this.getParameter(parameterName);
    const waveforms: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    return waveforms[Math.floor(waveformValue)] || 'sawtooth';
  }

  // OVERRIDE: Creazione nodi specifici
  protected createVoiceNodes(): AudioNode[] {
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const osc1Gain = this.audioContext.createGain();
    const osc2Gain = this.audioContext.createGain();
    const voiceGain = this.audioContext.createGain();
    return [oscillator1, oscillator2, osc1Gain, osc2Gain, voiceGain];
  }
  // OVERRIDE: Enhanced stopAll to handle releasing oscillators
  override stopAll(): void {
    console.log(`🛑 SynthInstrument.stopAll() called - stopping ${this.activeVoices.size} active voices`);
    
    // Stop all actively playing voices (now with immediate stop)
    super.stopAll();
    
    console.log(`✅ All synth voices stopped for ${this.name}`);
  }  // PUBLIC: Cleanup per LFO permanenti
  override dispose(): void {
    console.log(`🧹 SynthInstrument.dispose() called`);
    
    // Stop LFO oscillators
    if (this.lfoOscillator.context.state !== 'closed') {
      this.lfoOscillator.stop();
    }
    if (this.chorusLfo.context.state !== 'closed') {
      this.chorusLfo.stop();
    }
    super.dispose();
  }
}
