import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from './help-dialog/help-dialog.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ChatMessage, ChatResponse, SmartyService } from './smarty.service';
import { LoadingDotsComponent } from './loading-dots/loading-dots.component';
import { SuggestionsComponent } from "./suggestions/suggestions.component";
import { Guid } from 'guid-typescript';

@Component({
    selector: 'smarty',
    standalone: true,
    templateUrl: './smarty.component.html',
    styleUrl: './smarty.component.scss',
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatToolbarModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        LoadingDotsComponent,
        SuggestionsComponent
    ]
})
export class SmartyComponent implements OnInit, AfterViewChecked {

  @ViewChild('chatBody') private chatBody!: ElementRef;
  suggestions: string[] = [];
  messages: ChatMessage[] = [];
  get unseenMessageCount(): number { return this.messages.filter(x => !x.seen).length }
  userInput: string = '';
  lastResponse: ChatResponse | undefined = undefined;
  isLoading: boolean = false; // State to control loading animation
  // showSuggestions: boolean = false;

  constructor(
    public dialog: MatDialog,
    private smartyService: SmartyService
  ) {

  }
  ngOnInit(): void {
    this.isLoading = true;
    this.smartyService.loadChatbotData().subscribe({
      next: res => {
        this.isLoading = false;
        this.suggestions = this.smartyService.getSuggestions();
      },
      error: err => this.isLoading = false,
    })
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  sendMessage(input: string) {
    if (this.isLoading) return;
    
    input = input.trim();
    this.userInput = '';
    this.suggestions = [];
    if (input) {
      const userMessage: ChatMessage = {
        id: Guid.create(),
        text: input,
        time: new Date(),
        owner: true
      };
      // Add user's message to messages array
      this.messages.push(userMessage);
  
      // Add a loading message for Smarty
      const loadingMessageId = Guid.create();

      setTimeout(() => {
        this.messages.push({
          id: loadingMessageId,
          text: '', // Empty text for loading
          time: new Date(),
          owner: false,
          seen: true,
          isLoading: true // Mark as loading
        });

        this.scrollToBottom();
      }, 300);
      
      // Normalize user input and determine response
      const response = this.smartyService.getNextResponse(userMessage);
  
      // Simulate processing time and then replace loading message
      setTimeout(() => {
        // Replace loading message with actual response
        const index = this.messages.findIndex(msg => msg.id === loadingMessageId);
        if (index !== -1) {
          response.responseMessage = {
            id: loadingMessageId,
            text: response.text,
            time: new Date(),
            owner: false,
            seen: false,
            isLoading: false,
          };
          this.messages[index] = response.responseMessage;
          this.suggestions = this.smartyService.getSuggestions(response.actionMappings[response.actionMappings.length - 1].followUps);
          this.scrollToBottom();
        }
      }, 1500);
  
    }
  }
  
  scrollToBottom(): void {
    this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
  }

  openHelpDialog() {
    this.dialog.open(HelpDialogComponent, {
      width: '250px'
    });
  }
}

export interface Message {
  
  // isError?: boolean;
}

