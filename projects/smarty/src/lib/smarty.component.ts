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
import { ChatMessage, ChatResponse, Owner, SmartyService } from './smarty.service';
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
  get unseenMessageCount(): number { return this.messages.filter(x => !x.seen && x.owner != Owner.System).length }
  userInput: string = '';
  lastResponse: ChatResponse | undefined = undefined;
  isLoading: boolean = false; // State to control loading animation
  // showSuggestions: boolean = false;
  Owner = Owner;

  constructor(
    public dialog: MatDialog,
    private smartyService: SmartyService
  ) {

  }
  ngOnInit(): void {
    const message = this.addMessage({ text: `Please wait while we're loading things up for you...`, owner: Owner.System })
    this.isLoading = true;
    this.smartyService.loadChatbotData().subscribe({
      next: res => {
        this.isLoading = false;
        message.text = `Welcome! Get the conversation going by typing your own message or simply click on one of the suggestions to begin chatting.`
        this.suggestions = this.smartyService.getSuggestions();
      },
      error: err => this.isLoading = false,
    });
  }

  addMessage(message: ChatMessage): ChatMessage {
    if (!message.id) {
      message.id = Guid.create();
    }
    if (!message.time) {
      message.time = new Date();
    }

    this.messages.push(message);
    this.scrollToBottom();
    return message;
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
      const userMessage = this.addMessage({ text: input, owner: Owner.User });

      const loadingMessage = {
        text: '',
        owner: Owner.Smarty,
        seen: true,
        isLoading: true // Mark as loading
      };

      setTimeout(() => {
        this.addMessage(loadingMessage);
      }, 300);

      setTimeout(() => {
        const response = this.smartyService.getNextResponse(userMessage);
        // Replace loading message with actual response
        loadingMessage.isLoading = false;
        loadingMessage.seen = false;
        loadingMessage.text = response.text;
        this.suggestions = this.smartyService.getSuggestions(response.actionMappings[response.actionMappings.length - 1].followUps);
      }, 1500);

    }
  }

  scrollToBottom(): void {
    if (this.chatBody) {
      this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
    }
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

