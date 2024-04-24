import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Guid } from 'guid-typescript';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SmartyService {
  private chatbotDataUrl: string = 'https://raw.githubusercontent.com/nifraz/data/master/chatbotData.json';
  private actions: Action[] = [];

  // private userInput: string = '';
  // private tokens: string[] = [];
  // private actionMappings: ActionMapping[] = [];

  private lastResponse: ChatResponse = { text: '', actionMappings: [] }
  private chatHistory: ChatResponse[] = [];

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

  getSuggestions(actionKeys: string[] | undefined = undefined): string[] {
    if (actionKeys && actionKeys.length) {
      const matchingActions = this.actions.filter(action => actionKeys.some(key => key == action.key));
      const triggers = matchingActions.flatMap(action => action.triggers);
    }
    const greetingTriggers = this.actions.find(x => x.key == 'greet')?.triggers;
    return greetingTriggers ? getRandomElementsAndShuffle(greetingTriggers, greetingTriggers.length < 5 ? greetingTriggers.length : 5) : [];
  }

  getNextResponse(inputMessage: ChatMessage | undefined): ChatResponse {
    this.lastResponse = {
      text: '400',
      actionMappings: [],
    }
    // const chatMessage: ChatMessage = { text: '400' };
    if (inputMessage && inputMessage.text) {
      this.lastResponse.userMessage = inputMessage;
      const sanitizedInput = this.sanitizeInput(inputMessage.text);
      this.lastResponse.tokens = sanitizedInput.split(/[.?!]\s*/);

      this.matchTokensToActions(this.lastResponse.tokens);
      return this.buildResponse();
    }

    return this.lastResponse;
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
        const actionMapping = this.addToActionMappings({ action: matchingAction });
        if (actionMapping) {
          const followUpCount = getRandomIntInclusive(1, matchingAction.followUps.length);
          actionMapping.followUps = getRandomElementsAndShuffle(matchingAction.followUps, followUpCount);
          actionMapping.followUps.forEach(actionKey => {
            const followUpAction = this.actions.find(action => action.key == actionKey);
            if (followUpAction) {
              this.addToActionMappings({ action: followUpAction });
            }
          });
        }
      }
    });
  }

  addToActionMappings(actionMapping: ActionMapping): ActionMapping | undefined {
    if (actionMapping 
        && actionMapping.action 
        && this.lastResponse
        && this.lastResponse.actionMappings
        && (this.lastResponse.actionMappings.length === 0 || this.lastResponse.actionMappings[this.lastResponse.actionMappings.length - 1].action.key !== actionMapping.action.key)) {
      this.lastResponse.actionMappings.push(actionMapping);
      return actionMapping;
    }
    return undefined;
  }

  buildResponse(): ChatResponse {
    
    this.lastResponse.text = '404'
    this.lastResponse.suggestions = this.getSuggestions();
    if (this.lastResponse && this.lastResponse.actionMappings) {
      let responseText = '';
      this.lastResponse.actionMappings.forEach(mapping => {
        for (let index = 0; index < 3; index++) {
          mapping.sentence = mapping.action.sentences[getRandomIndex(mapping.action.sentences.length)];
          if (!responseText.includes(mapping.sentence)) {
            responseText += mapping.sentence + " ";
            break;
          }
        }
      });
  
      if (responseText.trim()) {
        this.lastResponse.text = responseText.trim();
        const followUpKeys = this.lastResponse.actionMappings[this.lastResponse.actionMappings.length - 1].action.followUps;
        this.lastResponse.suggestions = this.getSuggestions(followUpKeys);
      }
      else {
        this.lastResponse.text = '404';
      }
    }
    this.chatHistory.push(this.lastResponse);
    return this.lastResponse;
  }
}

function getRandomIndex(length: number, minIndex: number = 0): number {
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

export interface ChatbotData {
  actions: Action[];
}

export interface Action {
  key: string,
  triggers: string[],
  sentences: string[],
  followUps: string[],
}

export interface ChatMessage {
  id?: Guid;
  text?: string,
  time?: Date;
  owner?: boolean;
  seen?: boolean;
  isLoading?: boolean;
}

export interface ChatResponse {
  userMessage?: ChatMessage;
  tokens?: string[],
  actionMappings: ActionMapping[],
  text: string,
  responseMessage?: ChatMessage,
  suggestions?: string[],
}

export interface ActionMapping {
  action: Action,
  sentence?: string,
  trigger?: string,
  followUps?: string[],
}