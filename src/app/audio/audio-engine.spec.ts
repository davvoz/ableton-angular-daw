import { TestBed } from '@angular/core/testing';

import { AudioEngine } from './audio-engine';

describe('AudioEngine', () => {
  let service: AudioEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioEngine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
