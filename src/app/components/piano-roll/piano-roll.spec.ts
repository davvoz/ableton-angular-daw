import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PianoRoll } from './piano-roll';

describe('PianoRoll', () => {
  let component: PianoRoll;
  let fixture: ComponentFixture<PianoRoll>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PianoRoll]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PianoRoll);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
