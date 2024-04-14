import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SmartyComponent } from '../../../smarty/src/public-api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SmartyComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'smarty-app';
}
