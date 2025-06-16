import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Transport } from './transport';

describe('Transport', () => {
  let component: Transport;
  let fixture: ComponentFixture<Transport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Transport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Transport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
