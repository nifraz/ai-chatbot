import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartyComponent } from './smarty.component';

describe('SmartyComponent', () => {
  let component: SmartyComponent;
  let fixture: ComponentFixture<SmartyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmartyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SmartyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
