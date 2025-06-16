import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransportService } from '../../core/services/transport';
import { StateService } from '../../core/services/state';

@Component({
  selector: 'app-transport',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transport.html',
  styleUrl: './transport.scss'
})
export class Transport {
  // OBBLIGATORI: Dependency injection
  private transportService = inject(TransportService);
  private stateService = inject(StateService);

  // OBBLIGATORI: Signal-based reactive data
  readonly isPlaying = this.transportService.isPlaying;
  readonly isRecording = this.transportService.isRecording;
  readonly isLooping = this.transportService.isLooping;
  readonly currentTime = this.transportService.currentTime;
  readonly bpm = this.transportService.bpm;
  readonly transport = this.transportService.transport;

  // NUOVO: Sequencer state
  readonly playheadPosition = this.transportService.playheadPosition;
  readonly activeNoteCount = this.transportService.activeNoteCount;
  
  // NUOVO: Metronome state
  readonly isMetronomeOn = this.transportService.isMetronomeOn;
  readonly metronomeVolume = this.transportService.metronomeVolume;  // COMPUTED: Display formatters
  readonly currentTimeDisplay = computed(() => {
    // TEST: Prova con currentTime diretto dal sequencer
    const currentBeats = this.transportService.currentTime();
    const beatsPerBar = 4; // Assumiamo 4/4 per ora
    
    const bars = Math.floor(currentBeats / beatsPerBar);
    const remainingBeats = currentBeats % beatsPerBar;
    const beat = Math.floor(remainingBeats) + 1;
    const sixteenths = Math.floor((remainingBeats % 1) * 4) + 1;
    
    const display = `${bars + 1}.${beat}.${String(sixteenths).padStart(2, '0')}`;
    return display;
  });

  readonly bpmDisplay = computed(() => Math.round(this.bpm()));

  readonly playButtonText = computed(() => 
    this.isPlaying() ? '⏸️' : '▶️'
  );

  readonly recordButtonText = computed(() => 
    this.isRecording() ? '⏹️' : '⏺️'
  );

  readonly loopButtonText = computed(() => 
    this.isLooping() ? '🔄' : '🔁'
  );

  readonly metronomeButtonText = computed(() => 
    this.isMetronomeOn() ? '🥁' : '🔇'
  );

  readonly metronomeVolumePercent = computed(() => 
    Math.round(this.metronomeVolume() * 100)
  );

  // OBBLIGATORI: Transport controls
  play(): void {
    if (this.isPlaying()) {
      this.transportService.pause();
    } else {
      this.transportService.play();
    }
  }

  stop(): void {
    this.transportService.stop();
  }

  record(): void {
    if (this.isRecording()) {
      this.transportService.stop();
    } else {
      this.transportService.record();
    }
  }

  pause(): void {
    this.transportService.pause();
  }

  // OBBLIGATORI: Loop controls
  toggleLoop(): void {
    this.transportService.toggleLoop();
  }

  // OBBLIGATORI: Tempo controls
  setBpm(bpm: number): void {
    this.transportService.setBpm(bpm);
  }

  // OBBLIGATORI: Position controls
  skipToStart(): void {
    this.transportService.skipToStart();
  }

  skipToEnd(): void {
    this.transportService.skipToEnd();
  }
  // OBBLIGATORI: Metronome
  toggleMetronome(): void {
    this.transportService.toggleMetronome();
  }

  setMetronomeVolume(volume: number): void {
    this.transportService.setMetronomeVolume(volume);
  }

  setMetronomeSound(sound: 'click' | 'beep' | 'tick'): void {
    this.transportService.setMetronomeSound(sound);
  }

  validateBpm(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 80) {
      input.value = '80';
      this.setBpm(80);
    } else if (value > 200) {
      input.value = '200';
      this.setBpm(200);
    } else {
      this.setBpm(value);
    }
  }

  onMetronomeWheel(event: WheelEvent): void {
    if (!this.isMetronomeOn()) return;
    
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const newVolume = Math.max(0, Math.min(1, this.metronomeVolume() + delta));
    this.setMetronomeVolume(newVolume);
  }
}
