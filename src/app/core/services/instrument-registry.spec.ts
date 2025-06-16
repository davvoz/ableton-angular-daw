import { TestBed } from '@angular/core/testing';

import { InstrumentRegistry } from './instrument-registry';

describe('InstrumentRegistry', () => {
  let service: InstrumentRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstrumentRegistry);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
