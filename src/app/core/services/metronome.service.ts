import { Injectable, inject, signal } from '@angular/core';
import { AudioEngineService } from '../../audio/audio-engine';

@Injectable({
  providedIn: 'root'
})
export class MetronomeService {
  private audioEngine = inject(AudioEngineService);
  
  private _isEnabled = signal<boolean>(false);
  private _volume = signal<number>(0.5);
  private _sound = signal<'click' | 'beep' | 'tick'>('click');
  private _lastClickTime = 0; // Debounce per evitare click multipli
  
  readonly isEnabled = this._isEnabled.asReadonly();
  readonly volume = this._volume.asReadonly();
  readonly sound = this._sound.asReadonly();  /**
   * Genera un click del metronomo ad un tempo audio specifico (come nelle DAW)
   * @param audioTime Il tempo audio preciso per il click
   * @param isDownbeat Se true, genera un suono più acuto per il primo beat
   */
  playClickAtTime(audioTime: number, isDownbeat: boolean = false): void {
    if (!this._isEnabled()) return;

    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) return;

    // TIMING PRECISO: Usa il tempo audio esatto passato dal sequencer
    const frequency = isDownbeat ? 1200 : 800;
    const duration = 0.05; // Click molto breve e preciso
    
    // Crea oscillatore
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.frequency.setValueAtTime(frequency, audioTime);
    oscillator.type = 'sine';
    
    // Envelope veloce e pulito
    gainNode.gain.setValueAtTime(0, audioTime);
    gainNode.gain.linearRampToValueAtTime(this._volume() * 0.7, audioTime + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioTime + duration);
    
    // Connetti e schedule
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(audioTime);
    oscillator.stop(audioTime + duration);
  }

  /**
   * Genera un click del metronomo (backward compatibility)
   */
  playClick(isDownbeat: boolean = false): void {
    const audioContext = this.audioEngine.getAudioContext();
    if (audioContext) {
      this.playClickAtTime(audioContext.currentTime, isDownbeat);
    }
  }

  /**
   * Attiva/disattiva il metronomo
   */
  toggle(): void {
    this._isEnabled.update(enabled => !enabled);
  }

  /**
   * Imposta il volume del metronomo (0-1)
   */
  setVolume(volume: number): void {
    this._volume.set(Math.max(0, Math.min(1, volume)));
  }

  /**
   * Imposta il tipo di suono del metronomo
   */
  setSound(sound: 'click' | 'beep' | 'tick'): void {
    this._sound.set(sound);
  }
}
