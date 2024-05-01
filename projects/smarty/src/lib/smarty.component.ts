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
import { ChatMessage, ChatResponse, Owner, SmartyService, tossCoin } from './smarty.service';
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
  currentUsername: string = '';
  suggestions: string[] = [];
  messages: ChatMessage[] = [];
  get unseenMessageCount(): number { return this.messages.filter(x => !x.seen && x.owner != Owner.System).length }
  userInput: string = '';
  lastResponse: ChatResponse | undefined = undefined;
  isLoading: boolean = false; // State to control loading animation
  // isError: boolean = false;
  Owner = Owner;

  constructor(
    public dialog: MatDialog,
    private smartyService: SmartyService
  ) {

  }
  ngOnInit(): void {
    const loadingMessage = this.addNewMessage({ text: `Please wait while we're loading things up for you...`, owner: Owner.System });
    this.isLoading = true;
    this.smartyService.reloadChatbotData().subscribe({
      next: res => {
        this.isLoading = false;
        loadingMessage.isError = false;
        loadingMessage.text = `Loading successful.`;
        this.readNickname();
      },
      error: err => {
        this.isLoading = false;
        loadingMessage.isError = true;
        console.error(err);
        loadingMessage.text = `Oops! Something went wrong. Please refresh the page. If the problem continues, contact support by opening Help icon in top right corner. We apologize for any inconvenience.`;
      },
    });
  }

  readNickname(): void {
    this.currentUsername = '';
    this.addNewMessage({
      owner: Owner.System,
      text: `Please enter your nickname. It should be 3 to 8 characters long and contain only letters and numbers, with no spaces or special characters.`,
    });
    this.suggestions = this.smartyService.getNextSuggestions();
  }

  addNewMessage(message: ChatMessage): ChatMessage {
    if (!message.id) {
      message.id = Guid.create();
    }
    if (!message.time) {
      message.time = new Date();
    }
      
    message.nickname = message.owner == Owner.User ? this.currentUsername : Owner[message.owner].toLowerCase();

    this.messages.push(message);
    this.scrollToBottom();
    return message;
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  saveNickname(input: string): void {
    const regex = /^[a-zA-Z0-9]{3,8}$/;
    this.currentUsername = regex.test(input) ? input.toLowerCase() : 'potato';
    this.suggestions = [];
  }

  processInput(input: string) {
    if (!input || !input.length) {
      return;
    }
    const text = input.trim();
    if (this.isLoading || !text) return;

    if (!this.currentUsername) {
      this.saveNickname(text);
    }
    this.sendMessage(text);
  }

  sendMessage(text: string) {
    this.userInput = '';
    this.suggestions = [];
    
    const userMessage = this.addNewMessage({ text: text, owner: Owner.User });
  
    if (this.messages.filter(message => message.owner == Owner.User).length == 1) {
      this.addNewMessage({
        owner: Owner.System,
        text: `Get the conversation going by entering a message. Keep your messages short, clean and to the point.`,
      });
    }
    
    const loadingMessage: ChatMessage = {
      owner: Owner.Smarty,
      seen: true,
      isLoading: true // Mark as loading
    };

    setTimeout(() => {
      this.addNewMessage(loadingMessage);
    }, 300);

    setTimeout(() => {
      const response = this.smartyService.getNextResponse(userMessage);
      // Replace loading message with actual response
      loadingMessage.isLoading = false;
      loadingMessage.seen = false;
      loadingMessage.text = response.botReplyMessage.text;
      this.suggestions = response.suggestions;
      if (response.isUserLeft) {
        this.readNickname();
      }
    }, 1500);
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
