import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from './help-dialog/help-dialog.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SmartyService } from './smarty.service';

@Component({
  selector: 'smarty',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatToolbarModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    HttpClientModule,
    MatProgressBarModule
  ],
  templateUrl: './smarty.component.html',
  styleUrl: './smarty.component.scss'
})
export class SmartyComponent implements AfterViewChecked {

  @ViewChild('chatBody') private chatBody!: ElementRef;
  messages: Message[] = [];
  unreadMessages: number = 0;
  newMessage: string = '';
  loading: boolean = false; // State to control loading animation
  private responseMap: { [key: string]: string } = {};

  constructor(
    public dialog: MatDialog,
    private smartyService: SmartyService
  ) {

  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  sendMessage() {
    if (this.newMessage.trim()) {
      // Add user's message to messages array
      this.messages.push({
        id: this.messages.length + 1,
        text: this.newMessage,
        time: new Date(),
        isMine: true
      });
  
      // Add a loading message for Smarty
      const loadingMessageId = this.messages.length + 1;
      this.messages.push({
        id: loadingMessageId,
        text: '', // Empty text for loading
        time: new Date(),
        isMine: false,
        isLoading: true // Mark as loading
      });

      this.scrollToBottom();
      
      // Normalize user input and determine response
      const response = this.smartyService.processMessage(this.newMessage);
  
      // Simulate processing time and then replace loading message
      setTimeout(() => {
        // Replace loading message with actual response
        const index = this.messages.findIndex(msg => msg.id === loadingMessageId);
        if (index !== -1) {
          this.messages[index] = {
            id: loadingMessageId,
            text: response,
            time: new Date(),
            isMine: false
          };
          this.scrollToBottom();
        }
      }, 1000);
  
      // Clear the input field and reset unread messages count
      this.newMessage = '';
      this.unreadMessages = 0;
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
  id: number;
  text: string;
  time: Date;
  isMine: boolean; // Determine if the message is sent by the user or the chatbot
  isLoading?: boolean; // New property to indicate loading state
  // isError?: boolean;
}

