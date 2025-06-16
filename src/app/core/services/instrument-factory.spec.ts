import { TestBed } from '@angular/core/testing';

import { InstrumentFactory } from './instrument-factory';

describe('InstrumentFactory', () => {
  let service: InstrumentFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstrumentFactory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
