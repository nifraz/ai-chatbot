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
    MatInputModule
  ],
  templateUrl: './smarty.component.html',
  styleUrl: './smarty.component.scss'
})
export class SmartyComponent implements AfterViewChecked {


  @ViewChild('chatBody') private chatBody!: ElementRef;

  constructor(
    public dialog: MatDialog
  ) {

  }

  messages: Message[] = [
    { id: 1, text: "Hi Smarty!", time: new Date("2023-10-05T08:30:00"), isMine: true },
    { id: 2, text: "Hello! How can I assist you today?", time: new Date("2023-10-05T08:30:05"), isMine: false },
    { id: 3, text: "Can you tell me about the school events this month?", time: new Date("2023-10-05T08:30:20"), isMine: true },
    { id: 4, text: "Sure! There are two main events: the Science Fair on October 15th and the Annual Sports Meet on October 29th.", time: new Date("2023-10-05T08:30:35"), isMine: false },
    { id: 5, text: "What time does the Science Fair start?", time: new Date("2023-10-05T08:31:00"), isMine: true },
    { id: 6, text: "The Science Fair will start at 9 AM in the main auditorium.", time: new Date("2023-10-05T08:31:10"), isMine: false },
    { id: 7, text: "Thanks! And how can I register for it?", time: new Date("2023-10-05T08:31:30"), isMine: true },
    { id: 8, text: "You can register by visiting the school office or through our online portal. Would you like the link to the portal?", time: new Date("2023-10-05T08:31:50"), isMine: false },
    { id: 9, text: "Yes, please send me the link.", time: new Date("2023-10-05T08:32:10"), isMine: true },
    { id: 10, text: "Here you go: [School Portal](http://www.schoolportal.com)", time: new Date("2023-10-05T08:32:20"), isMine: false },
    { id: 11, text: "Got it, thank you! How about the sports meet? Where is it held?", time: new Date("2023-10-05T08:33:00"), isMine: true },
    { id: 12, text: "The Annual Sports Meet will be held at the city stadium.", time: new Date("2023-10-05T08:33:15"), isMine: false },
    { id: 13, text: "Is there a bus service to the stadium?", time: new Date("2023-10-05T08:33:40"), isMine: true },
    { id: 14, text: "Yes, there will be buses running from the school to the stadium every 30 minutes on the day of the event.", time: new Date("2023-10-05T08:34:00"), isMine: false },
    { id: 15, text: "That's perfect. Thanks for the help, Smarty!", time: new Date("2023-10-05T08:34:20"), isMine: true },
    { id: 16, text: "You're welcome! If you have any more questions, feel free to ask.", time: new Date("2023-10-05T08:34:35"), isMine: false },
    { id: 17, text: "Actually, do you have updates on the new library construction?", time: new Date("2023-10-05T08:35:00"), isMine: true },
    { id: 18, text: "The construction is going smoothly and is expected to be completed by the end of November.", time: new Date("2023-10-05T08:35:15"), isMine: false },
    { id: 19, text: "Great to hear that! I'll check it out when it's done.", time: new Date("2023-10-05T08:35:50"), isMine: true },
    { id: 20, text: "Sure thing! Have a great day!", time: new Date("2023-10-05T08:36:05"), isMine: false }
  ];

  unreadMessages: number = 0;

  newMessage: string = '';

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  sendMessage() {
    if (this.newMessage.trim()) {
      this.messages.push({ id: this.messages.length + 1, text: this.newMessage, time: new Date(), isMine: true });
      this.newMessage = '';
      this.unreadMessages = 0; // Reset unread messages count
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
}

