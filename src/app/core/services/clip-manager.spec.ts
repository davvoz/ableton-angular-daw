import { TestBed } from '@angular/core/testing';

import { ClipManager } from './clip-manager';

describe('ClipManager', () => {
  let service: ClipManager;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClipManager);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
