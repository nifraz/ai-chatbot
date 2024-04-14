import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'lib-help-dialog',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './help-dialog.component.html',
  styleUrl: './help-dialog.component.scss'
})
export class HelpDialogComponent {

  constructor(public dialogRef: MatDialogRef<HelpDialogComponent>) {}

  closeDialog() {
    this.dialogRef.close();
  }
}

