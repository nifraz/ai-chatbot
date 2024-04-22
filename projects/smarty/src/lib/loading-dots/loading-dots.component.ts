import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'loading-dots',
  standalone: true,
  imports: [CommonModule],
  template: `<div *ngIf="showAnimation">{{dots}}</div>`,
  styleUrls: ['./loading-dots.component.css']
})
export class LoadingDotsComponent implements OnInit, OnDestroy {
  dots = '. ';
  showAnimation = false;
  private intervalId: any;

  ngOnInit(): void {
    this.startAnimation();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  startAnimation() {
    this.showAnimation = true;
    this.intervalId = setInterval(() => {
      this.dots += '. ';
      if (this.dots.length > 6) {
        this.dots = '. ';
      }
    }, 300);
  }

  stopAnimation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.showAnimation = false;
      this.dots = '.';
    }
  }
}

