import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SmartyService {
  private chatbotDataUrl: string = 'https://raw.githubusercontent.com/nifraz/data/master/chatbotData.json';
  private actions: Action[] = [];

  private currentInput: string = '';
  private currentTokens: string[] = [];
  private currentActionMappings: ActionMapping[] = [];

  private chatHistory: ChatMessage[] = [];
  
  constructor(private http: HttpClient) { }

  loadChatbotData(): Observable<ChatbotData> {
    return this.http.get<ChatbotData>(this.chatbotDataUrl).pipe(
      tap(data => {
        if (data) {
          this.actions = data.actions;
        }
      })
    );
  }

  processInput(input: string): string {
    this.currentInput = input;
    const sanitizedInput = this.sanitizeInput(input);
    this.currentTokens = sanitizedInput.split(/[.?!]\s*/);

    this.matchTokensToActions(this.currentTokens);
    return this.buildResponse();
  }

  sanitizeInput(input: string): string {
    return input.toLowerCase().replace(/[^\w\s]/g, '');
  }

  matchTokensToActions(tokens: string[]): void {
    tokens.forEach(token => {
      const matchingAction = this.actions.find(action =>
        action.triggers.some(trigger => token.includes(trigger))
      );

      if (matchingAction) {
        const actionMapping = this.addToActionMappings({action: matchingAction});
        if (actionMapping) {
          const followUpCount = getRandomIntInclusive(1, matchingAction.followUps.length);
          actionMapping.followUps = getRandomElementsAndShuffle(matchingAction.followUps, followUpCount);
          actionMapping.followUps.forEach(actionKey => {
            const followUpAction = this.actions.find(action => action.key == actionKey);
            if (followUpAction) {
              this.addToActionMappings({action: followUpAction});
            }
          });
        }
      }
    });
  }
  
  addToActionMappings(actionMapping: ActionMapping): ActionMapping | undefined {
    if (actionMapping && actionMapping.action && (this.currentActionMappings.length === 0 || this.currentActionMappings[this.currentActionMappings.length - 1].action.key !== actionMapping.action.key)) {
      this.currentActionMappings.push(actionMapping);
      return actionMapping;
    }
    return undefined;
  }

  buildResponse(): string {
    let response = '';
    this.currentActionMappings.forEach(x => {
      for (let index = 0; index < 3; index++) {
        x.sentence = x.action.sentences[getRandomIndex(x.action.sentences.length)];
        if (!response.includes(x.sentence)) {
          response += x.sentence + " ";
          break;
        }
      }
    });
    
    if (response.trim()) {
      this.chatHistory.push({
        userInput: this.currentInput,
        tokens: this.currentTokens,
        actionMappings: this.currentActionMappings,
      });

      this.currentInput = '';
      this.currentTokens = [];
      this.currentActionMappings = [];

      return response.trim();
    }
    return '404';
  }
}

function getRandomIndex (length: number, minIndex: number = 0): number {
  return getRandomIntInclusive(minIndex, length - 1)
}

function getRandomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function getRandomElementsAndShuffle<T>(originalArray: T[], numElements: number): T[] {
  if (numElements > originalArray.length) {
    throw new Error("Requested more elements than are available in the array.");
    // Alternatively, you could return the entire shuffled array if this is acceptable behavior.
  }

  // Create a copy of the array to avoid modifying the original
  let arrayCopy = originalArray.slice();
  shuffleArray(arrayCopy); // Shuffle the copy
  
  // Return the first numElements from the shuffled array
  return arrayCopy.slice(0, numElements);
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements using destructuring
  }
}

interface ChatbotData {
  actions: Action[];
}

interface Action {
  key: string,
  triggers: string[],
  sentences: string[],
  followUps: string[],
}

interface ChatMessage {
  userInput: string,
  tokens: string[],
  actionMappings: ActionMapping[],
}

interface ActionMapping {
  action: Action,
  sentence?: string,
  trigger?: string,
  followUps?: string[],
}