import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LoadingDotsComponent } from "../loading-dots/loading-dots.component";

@Component({
    selector: 'suggestions',
    standalone: true,
    templateUrl: './suggestions.component.html',
    styleUrl: './suggestions.component.css',
    imports: [
        CommonModule,
        LoadingDotsComponent
    ]
})
export class SuggestionsComponent {
  sendSuggestion(suggestion: string) {
    this.click.emit(suggestion);
  }

  @Input() items: string[] | undefined = undefined;
  @Output() click = new EventEmitter<string>();

}
