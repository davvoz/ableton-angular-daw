import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstrumentSelector } from './instrument-selector';

describe('InstrumentSelector', () => {
  let component: InstrumentSelector;
  let fixture: ComponentFixture<InstrumentSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstrumentSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
