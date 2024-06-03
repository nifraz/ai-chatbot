import { AfterViewChecked, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
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

declare var webkitSpeechRecognition: any;

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
  usernameRegExp: RegExp = /^[a-zA-Z]{3,8}$/; 
  currentUsername: string = '';
  suggestions: string[] = [];
  messages: ChatMessage[] = [];
  get unseenMessageCount(): number { return this.messages.filter(x => !x.seen && x.owner != Owner.System).length }
  userInput: string = '';
  lastResponse: ChatResponse | undefined = undefined;
  isLoading: boolean = false; // State to control loading animation
  // isError: boolean = false;
  Owner = Owner;
  isRecording: boolean = false;
  recognition: any;
  isSpeechRecognitionSupported: boolean = true;
  isVoiceEnabled: boolean = false;

  constructor(
    public dialog: MatDialog,
    private smartyService: SmartyService,
    private ngZone: NgZone
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
    this.checkSpeechRecognitionSupport();
  }

  checkSpeechRecognitionSupport() {
    if ('webkitSpeechRecognition' in window) {
      this.initializeVoiceRecognition();
    } else {
      this.isSpeechRecognitionSupported = false;
      console.warn("Speech recognition is not supported in this browser.");
    }
  }

  initializeVoiceRecognition() {
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true; // Allow continuous recognition
    this.recognition.interimResults = true; // Enable interim results
    this.recognition.lang = 'en-US';
  
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
  
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          this.recognition.stop(); // Stop recognition on final result
        } else {
          interimTranscript += transcript;
        }
      }
  
      this.ngZone.run(() => {
        this.userInput = interimTranscript || finalTranscript;
        if (finalTranscript) {
          this.processInput(this.userInput);
        }
      });
    };
  
    this.recognition.onerror = (event: any) => {
      console.error(event.error);
      // clearTimeout(this.stopTimeout); // Clear timeout on error
    };
  
    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.isRecording = false;
      });
      // clearTimeout(this.stopTimeout); // Clear timeout on end
    };
  }

  toggleRecording() {
    if (this.isRecording) {
      this.recognition.stop();
    } else {
      this.isRecording = true;
      this.recognition.start();
    }
  }

  speakText(text: string, callback: (word: string) => void) {
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(text);
      speech.onboundary = (event: SpeechSynthesisEvent) => {
        if (event.name === 'word') {
          const word = text.substring(event.charIndex, event.charIndex + event.charLength);
          callback(word);
        }
      };
      window.speechSynthesis.speak(speech);
    } else {
      console.warn('Text-to-Speech is not supported in this browser.');
    }
  }

  typewriteText(text: string, element: HTMLElement, delay: number = 50, callback?: () => void) {
    element.innerHTML = ''; // Clear the element
    let index = 0;
    let words = text.split(' ');
  
    const typewrite = () => {
      if (index < words.length) {
        element.innerHTML += words[index] + ' ';
        index++;
        setTimeout(typewrite, delay);
      } else if (callback) {
        callback();
      }
    };
  
    typewrite();
  }

  readNickname(): void {
    this.currentUsername = '';
    this.addNewMessage({
      owner: Owner.System,
      text: `Please enter your nickname. It should be 3 to 8 characters long and contain only letters, with no spaces or special characters.`,
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

  processInput(input: string) {
    if (!input || !input.length) {
      return;
    }
    const text = input.trim();
    if (this.isLoading || !text) return;

    if (!this.currentUsername) {
      if (!this.usernameRegExp.test(text)) {
        this.addNewMessage({
          owner: Owner.System,
          text: `Invalid nickname '${text}'. Please make sure your nickname is 3 to 8 characters long, contains only letters, and has no spaces or special characters. Try again.`,
          isError: true,
        });
        return;
      }
      this.currentUsername = input.toLowerCase();
      this.suggestions = [];
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

    const response = this.smartyService.getNextResponse(userMessage);

    const loadingMessage = response.botReplyMessage;
    const botReplyMessageText = response.botReplyMessage.text ?? '';
    loadingMessage.text = '';
    loadingMessage.seen = true;
    loadingMessage.isLoading = true;

    setTimeout(() => {
      this.addNewMessage(loadingMessage);
    }, 300);

    setTimeout(() => {
      loadingMessage.seen = false;
      loadingMessage.isLoading = false;
      this.suggestions = response.botSuggestions;
      const messageElement = document.querySelector(`#message-${loadingMessage.id}`) as HTMLElement;
      if (this.isVoiceEnabled) {
        messageElement.innerHTML = '';
        this.speakText(botReplyMessageText, (word) => {
          this.ngZone.run(() => {
            messageElement.innerHTML += word + ' ';
          });
        });
      }
      else {
        this.typewriteText(botReplyMessageText, messageElement, 100)
      }
      if (response.isUserLeft) {
        this.readNickname();
      }
    }, 1500);

    // Get the newly added bot message element
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
