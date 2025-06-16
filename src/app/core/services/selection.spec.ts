import { TestBed } from '@angular/core/testing';
import { SelectionService } from './selection';

describe('SelectionService', () => {
  let service: SelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with no selection', () => {
    expect(service.hasSelection()).toBe(false);
    expect(service.selectionCount()).toBe(0);
  });

  it('should select tracks', () => {
    service.selectTrack('track-1');
    expect(service.selectedTrackIds()).toEqual(['track-1']);
    expect(service.hasSelection()).toBe(true);
    expect(service.isTrackSelected('track-1')).toBe(true);
  });

  it('should support multiple selection modes', () => {
    service.selectTrack('track-1');
    service.selectTrack('track-2', 'add');
    expect(service.selectedTrackIds()).toEqual(['track-1', 'track-2']);
    
    service.selectTrack('track-1', 'toggle');
    expect(service.selectedTrackIds()).toEqual(['track-2']);
  });
});
