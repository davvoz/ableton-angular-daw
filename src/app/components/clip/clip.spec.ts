import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Clip } from './clip';

describe('Clip', () => {
  let component: Clip;
  let fixture: ComponentFixture<Clip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Clip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Clip);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
