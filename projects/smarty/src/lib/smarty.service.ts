import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SmartyService {
  private responseMapUrl: string = 'https://raw.githubusercontent.com/nifraz/data/master/responseMap.json';
  private responseMap = new Map<string[], string[]>();
  private defaultResponses: string[] = [];
  
  constructor(private http: HttpClient) {
    
  }

  loadResponseMap(): Observable<ChatbotData> {
    return this.http.get<ChatbotData>(this.responseMapUrl).pipe(
      tap(data => {
        data.mappedResponses.forEach(entry => {
          this.responseMap.set(entry.keys, entry.responses);
        });
        this.defaultResponses = data.defaultResponses;
      })
    );
  }

  processMessage(userInput: string): string {
    userInput = userInput.toLowerCase().replace(/[^\w\s]/gi, ''); // Normalize input

    for (let [keys, responses] of this.responseMap.entries()) {
        if (keys.some(key => userInput.includes(key))) {
            return responses[this.randomIndex(responses.length)]; // Return a random response from matched keys
        }
    }

    return this.defaultResponses[this.randomIndex(this.defaultResponses.length)];
  }

  private randomIndex = (length: number) => Math.floor(Math.random() * length);
}

interface ChatbotData {
  mappedResponses: ResponseEntry[];
  defaultResponses: string[];
}

interface ResponseEntry {
  keys: string[];
  responses: string[];
}