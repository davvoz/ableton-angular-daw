import { TestBed } from '@angular/core/testing';
import { TransportService } from './transport';

describe('TransportService', () => {
  let service: TransportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start playback', () => {
    service.play();
    expect(service.isPlaying()).toBe(true);
  });

  it('should validate BPM range', () => {
    service.setBpm(50); // Below minimum
    expect(service.bpm()).toBe(80);
    
    service.setBpm(250); // Above maximum  
    expect(service.bpm()).toBe(200);
    
    service.setBpm(120); // Valid
    expect(service.bpm()).toBe(120);
  });
});
