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

  private latestResponse: ChatResponse = { text: '', actionMappings: [] }
  private chatHistory: ChatResponse[] = [];

  constructor(private http: HttpClient) { }

  loadChatbotData(): Observable<ChatbotData> {
    return this.http.get<ChatbotData>(this.chatbotDataUrl).pipe(
      tap(data => {
        if (data) {
          this.actions = data.actions;
          this.actions.forEach(action => {
            action.followUpActions = this.actions.filter(act => action.followUpKeys.some(key => key == act.key))
          });
        }
      })
    );
  }

  getNicknameSuggestions(): string[] {
    const nicknames = [
      "ninja",
      "potato",
      "rocket",
      "gizmo",
      "bender",
      "widget",
      "muffin",
      "wombat",
      "peanut",
      "gadget",
      "bandit",
      "rascal",
      "biscuit",
      "tango",
      "snack",
      "pickle",
      "cheeto",
      "fidget",
      "puzzle",
      "squash"
    ];

    return getRandomElementsAndShuffle(nicknames);
  }

  getSuggestions(action: Action | undefined = undefined): string[] {
    let triggers = this.actions.find(x => x.key == 'hi')?.triggers;
    if (action) {
      triggers = action.followUpActions.flatMap(followUp => followUp.triggers);
    }
    return triggers ? getRandomElementsAndShuffle(triggers) : [];
  }

  getRandomSuggestions(): string[] {
    const allTriggers = this.actions.flatMap(action => action.triggers);
    return getRandomElementsAndShuffle(allTriggers);
  }

  getNextResponse(inputMessage: ChatMessage | undefined): ChatResponse {
    this.latestResponse = {
      text: '400',
      actionMappings: [],
    }
    // const chatMessage: ChatMessage = { text: '400' };
    if (inputMessage && inputMessage.text) {
      this.latestResponse.userMessage = inputMessage;
      const sanitizedInput = this.sanitizeInput(inputMessage.text);
      this.latestResponse.tokens = sanitizedInput.split(/[.?!]\s*/);

      this.matchTokensToActions(this.latestResponse.tokens);
      return this.buildResponse();
    }

    return this.latestResponse;
  }

  sanitizeInput(input: string): string {
    return input.toLowerCase().replace(/[^\w\s]/g, '');
  }

  matchTokensToActions(tokens: string[]): void {
    tokens.forEach(token => {
      const matchingAction = this.actions.find(action =>
        action.triggers.some(trigger => containsExactPhrase(token, trigger))
      );

      if (matchingAction) {
        const actionMapping = this.addToActionMappings({ action: matchingAction });
        if (actionMapping) {
          actionMapping.mappedFollowUpActions = matchingAction.followUpActions.filter(action => !action.isOptional || tossCoin())
          actionMapping.mappedFollowUpActions.forEach(action => this.addToActionMappings({ action: action }));
        }
      }
    });
  }

  addToActionMappings(actionMapping: ActionMapping): ActionMapping | undefined {
    if (actionMapping
      && actionMapping.action
      && this.latestResponse
      && this.latestResponse.actionMappings
      && (this.latestResponse.actionMappings.length === 0 || this.latestResponse.actionMappings[this.latestResponse.actionMappings.length - 1].action.key !== actionMapping.action.key)) {
      this.latestResponse.actionMappings.push(actionMapping);
      return actionMapping;
    }
    return undefined;
  }

  buildResponse(): ChatResponse {
    this.latestResponse.text = '404'
    if (this.latestResponse && this.latestResponse.actionMappings) {
      let responseText = '';
      this.latestResponse.actionMappings.forEach(mapping => {
        for (let index = 0; index < 3; index++) {
          mapping.sentence = getRandomElement(mapping.action.sentences);
          if (!responseText.includes(mapping.sentence)) {
            responseText += mapping.sentence + " ";
            break;
          }
        }
      });

      if (responseText.trim()) {
        this.latestResponse.text = responseText.trim();
        const latestAction = this.latestResponse.actionMappings[this.latestResponse.actionMappings.length - 1].action;
        this.latestResponse.suggestions = this.getSuggestions(latestAction);
      }
      else {
        const isQuestion = this.latestResponse.userMessage?.text?.includes('?');
        if (isQuestion) {
          this.latestResponse.text = `Can you tell me the answer? I'll remember that for you.`;
          this.latestResponse.needLearning = true;
        }
        else {
          const defaultAction = this.actions.find(action => action.key == '404');
          if (defaultAction) {
            this.latestResponse.text = getRandomElement(defaultAction.sentences);
          }
        }
      }
    }
    this.chatHistory.push(this.latestResponse);
    return this.latestResponse;
  }
}

export function getRandomElement<T>(array: T[]): T {
  return array[getRandomIndex(array.length)];
}

export function getRandomIndex(length: number, minIndex: number = 0): number {
  return getRandomIntInclusive(minIndex, length - 1)
}

export function getRandomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getRandomElementsAndShuffle<T>(originalArray: T[], numElements: number = 20): T[] {
  numElements = originalArray.length < numElements ? originalArray.length : numElements;

  // Create a copy of the array to avoid modifying the original
  let arrayCopy = originalArray.slice();
  shuffleArray(arrayCopy); // Shuffle the copy

  // Return the first numElements from the shuffled array
  return arrayCopy.slice(0, numElements);
}

export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements using destructuring
  }
}

export function tossCoin(): boolean {
  return Math.floor(Math.random() * 2) === 1;
}

export function containsExactPhrase(token: string, trigger: string): boolean {
  // Create a regular expression with word boundaries around the entire phrase
  const regex = new RegExp(`\\b${trigger}\\b`, 'i');
  return regex.test(token);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special characters for regex
}

export interface ChatbotData {
  actions: Action[];
}

export interface Action {
  key: string,
  isOptional: boolean,
  triggers: string[],
  sentences: string[],
  followUpKeys: string[],
  followUpActions: Action[],
}

export interface ChatMessage {
  id?: Guid;
  text?: string,
  time?: Date;
  owner: Owner;
  nickname?: string;
  state?: State,
  isLoading?: boolean;
  isError?: boolean;
  seen?: boolean;
}

export interface ChatResponse {
  userMessage?: ChatMessage;
  tokens?: string[],
  actionMappings: ActionMapping[],
  text: string,
  responseMessage?: ChatMessage,
  needLearning?: boolean,
  suggestions?: string[],
}

export interface ActionMapping {
  action: Action,
  sentence?: string,
  trigger?: string,
  mappedFollowUpActions?: Action[],
}

export enum Owner {
  System,
  Smarty,
  User,
  Stranger,
}

export enum State {
  Created,
  UserSeen,
}