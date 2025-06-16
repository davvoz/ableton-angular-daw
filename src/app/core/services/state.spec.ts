import { TestBed } from '@angular/core/testing';
import { StateService } from './state';

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(service.trackCount()).toBe(0);
    expect(service.clipCount()).toBe(0);
    expect(service.hasSelection()).toBe(false);
  });
});
