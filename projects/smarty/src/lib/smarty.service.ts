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

  private latestResponse: ChatResponse = {
    userMessage: { owner: Owner.User },
    botReplyMessage: { owner: Owner.Smarty },
    actionMappings: [],
    suggestions: [],
  };
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

  private getNameSuggestions(): string[] {
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

  // : string[] {
  //   const triggers = action.followUpActions.flatMap(followUp => followUp.triggers);
  //   return getRandomElementsAndShuffle(triggers);
  // }

  getGreetingSuggestions(): string[] {
    const triggers = this.actions.find(x => x.key == 'hi')?.triggers;
    return getRandomElementsAndShuffle(triggers);
  }

  ignoredKeysFromRandomSuggestions: string[] = ['hi'];
  getNextSuggestions(action: Action | undefined = undefined): string[] {
    if (!action) {
      return this.getNameSuggestions();
    }
    const followUpTriggers = action.followUpActions.flatMap(followUp => followUp.triggers);
    const followUpRandomSuggestions = getRandomElementsAndShuffle(followUpTriggers);
    const randomTriggers = this.actions
      .filter(action => !this.ignoredKeysFromRandomSuggestions.includes(action.key))
      .flatMap(action => action.triggers);
    const randomSuggestions = getRandomElementsAndShuffle(randomTriggers);
    return getRandomElementsAndShuffle([...followUpRandomSuggestions, ...randomSuggestions]);
  }

  getNextResponse(userMessage: ChatMessage): ChatResponse {
    this.latestResponse = {
      userMessage: userMessage,
      botReplyMessage: { owner: Owner.Smarty },
      actionMappings: [],
      suggestions: [],
    }
    // const chatMessage: ChatMessage = { text: '400' };
    if (userMessage && userMessage.text) {
      this.latestResponse.userMessage = userMessage;
      const sanitizedInput = this.sanitizeInput(userMessage.text);
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
    this.latestResponse.botReplyMessage.text = '404';
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
        this.latestResponse.botReplyMessage.text = responseText.trim();
        const latestAction = this.latestResponse.actionMappings[this.latestResponse.actionMappings.length - 1].action;
        this.latestResponse.suggestions = this.getNextSuggestions(latestAction);
      }
      else {
        const isQuestion = this.latestResponse.userMessage?.text?.includes('?');
        if (isQuestion) {
          this.latestResponse.botReplyMessage.text = `Can you tell me the answer? I'll remember that for you.`;
          this.latestResponse.needLearning = true;
        }
        else {
          const defaultAction = this.actions.find(action => action.key == '404');
          if (defaultAction) {
            this.latestResponse.botReplyMessage.text = getRandomElement(defaultAction.sentences);
          }
        }
      }
    }
    this.replaceName();
    this.chatHistory.push(this.latestResponse);
    return this.latestResponse;
  }

  replaceName(): void {
    if (!this.latestResponse.botReplyMessage.text) return;
    const placeholder = '{name}';
    let indices = [];
    let index = this.latestResponse.botReplyMessage.text?.indexOf(placeholder) ?? -1;

    // Collect all indices of the placeholder
    while (index !== -1) {
      indices.push(index);
      index = this.latestResponse.botReplyMessage.text.indexOf(placeholder, index + 1) ?? -1;
    }

    // Check if any placeholders were found
    if (indices.length > 0) {
      // Randomly select one index from indices array
      const selectedIndex = indices[Math.floor(Math.random() * indices.length)];

      // Replace one occurrence randomly with the nickname
      this.latestResponse.botReplyMessage.text = this.latestResponse.botReplyMessage.text.substring(0, selectedIndex) + this.getNameReplacement(this.latestResponse.userMessage.nickname) +
        this.latestResponse.botReplyMessage.text?.substring(selectedIndex + placeholder.length);

      // Replace all remaining placeholders with an empty string
      this.latestResponse.botReplyMessage.text = this.latestResponse.botReplyMessage.text.replace(new RegExp(placeholder, 'g'), '');
    }
  }

  getNameReplacement(name: string | undefined): string {
    if (!name || !this.chatHistory.length || !tossCoin()) {
      return '';
    }
    return (tossCoin() ? ',' : '') + ` ${name}`;
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

export function getRandomElementsAndShuffle<T>(originalArray: T[] | undefined, numElements: number = 32): T[] {
  if (!originalArray) return [];

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
  userMessage: ChatMessage;
  tokens?: string[],
  actionMappings: ActionMapping[],
  botReplyMessage: ChatMessage,
  needLearning?: boolean,
  suggestions: string[],
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