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
    suggestions: [],
  };
  private chatHistory: ChatResponse[] = [];
  private storedHistory: Map<string, ChatResponse[]> = new Map<string, ChatResponse[]>();

  constructor(private http: HttpClient) { }

  reloadChatbotData(): Observable<ChatbotData> {
    return this.http.get<ChatbotData>(this.chatbotDataUrl).pipe(
      tap(data => {
        if (data) {
          this.actions = data.actions;
          this.actions.forEach(action => {
            action.followUps = this.actions.filter(act => action.followUpKeys.some(key => key == act.key));
            action.reactions = this.actions.filter(act => action.reactionKeys.some(key => key == act.key));
          });
        }
      })
    );
  }

  greetingKeys: string[] = ['say-hi', 'ask-name'];
  ignoredKeysFromRandomSuggestions: string[] = [...this.greetingKeys, 'tell-name', 'ask-to-help', 'tell-a-joke'];
  farewellActionKeys = ['say-bye', 'say-later'];
  getNextSuggestions(): string[] {
      if (!this.chatHistory.length) {
      const keywords = this.actions.find(action => action.key == 'tell-name')?.keywords;
      return getRandomElementsAndShuffle(keywords);
    }

    if (this.chatHistory.length == 1) {
      const keywords = this.actions
        .filter(action => this.greetingKeys.includes(action.key))
        .flatMap(action => action.keywords);
      return getRandomElementsAndShuffle(keywords);
    }

    const responseKeywords = this.latestResponse.botReplyActions?.flatMap(action => action.reactions).flatMap(reaction => reaction.keywords) ?? [];
    const randomReactionSuggestions = getRandomElementsAndShuffle(responseKeywords);
    const randomKeywords = this.actions
      .filter(action => !this.ignoredKeysFromRandomSuggestions.includes(action.key))
      .flatMap(action => action.keywords);
    const randomSuggestions = getRandomElementsAndShuffle(randomKeywords);
    return getRandomElementsAndShuffle([...randomReactionSuggestions, ...randomSuggestions]);
  }

  getNextResponse(userMessage: ChatMessage): ChatResponse {
    this.latestResponse = {
      userMessage: userMessage,
      botReplyMessage: { owner: Owner.Smarty, nickname: Owner[Owner.Smarty] },
      suggestions: [],
    }

    // if (!this.chatHistory.length) {
    //   const phrases = this.actions.find(action => action.key == 'tell-name')?.phrases ?? ['I’m{self}.'];
    //   const randomPhrase = getRandomElement(phrases);
    //   userMessage.text = this.replaceName(randomPhrase, userMessage.nickname, '{self}');
    // }

    if (userMessage.text) {
      this.latestResponse.userMessage = userMessage;
      this.latestResponse.tokens = userMessage.text.split(/[.?!]\s*/);

      this.matchTokensToActions(this.latestResponse.tokens);
      const response = this.buildResponse();

      const hasFarewellAction = this.latestResponse.botReplyActions?.some(action => this.farewellActionKeys.includes(action.key));
      if (hasFarewellAction) {
        this.latestResponse.isUserLeft = true;
        this.storedHistory.set(userMessage.nickname ?? '', this.chatHistory);
        this.chatHistory = [];
      }
      return response;
    }

    return this.latestResponse;
  }

  matchTokensToActions(tokens: string[]): void {
    this.latestResponse.mappedUserActions = [];
    tokens.forEach(token => {
      const matchingAction = this.actions.find(action =>
        action.keywords.some(keyword => containsExactPhrase(token, keyword))
      );
      const tellNameAction = this.actions.find(action => action.key == 'tell-name');
      const confusedAction = this.actions.find(action => action.key == 'say-im-confused');
      
      this.latestResponse.botReplyActions = [];
      let mappedReactions: Action[] = [];
      
      if (matchingAction) {
        this.latestResponse.mappedUserActions?.push(matchingAction);
        mappedReactions = getRandomElementsAndShuffle(matchingAction.reactions, getRandomIntInclusive(1, 2));
      }
      else if (!this.chatHistory.length && tellNameAction) {
        this.latestResponse.mappedUserActions?.push(tellNameAction);
        mappedReactions = getRandomElementsAndShuffle(tellNameAction.reactions, getRandomIntInclusive(1, 2));
      }
      else if (confusedAction) {
        mappedReactions = [confusedAction];
      }

      mappedReactions.forEach(element => {
        if (!this.latestResponse.botReplyActions?.some(action => action.key == element.key)) {
          this.latestResponse.botReplyActions?.push(element);
        }
      });
      const mappedFollowUps = getRandomElementsAndShuffle(mappedReactions.flatMap(reaction => reaction.followUps), getRandomIntInclusive(1, 2));
      mappedFollowUps.forEach(element => {
        if (!this.latestResponse.botReplyActions?.some(action => action.key == element.key)) {
          this.latestResponse.botReplyActions?.push(element);
        }
      });
    });
  }

  buildResponse(): ChatResponse {
    this.latestResponse.botReplyMessage.text = '404';
    if (this.latestResponse && this.latestResponse.botReplyActions) {
      let responseText = '';
      this.latestResponse.botReplyActions?.forEach(action => {
        for (let index = 0; index < 3; index++) {
          const mappedPhrase = getRandomElement(action.phrases);
          if (!responseText.includes(mappedPhrase)) {
            responseText += mappedPhrase + " ";
            break;
          }
        }
      });

      if (responseText.trim()) {
        this.latestResponse.botReplyMessage.text = responseText.trim();
        // const latestAction = this.latestResponse.actionMappings[this.latestResponse.actionMappings.length - 1].action;
      }
      else {
        const isQuestion = this.latestResponse.userMessage?.text?.includes('?');
        if (isQuestion) {
          this.latestResponse.botReplyMessage.text = `Can you tell me the answer? I'll remember that for you.`;
          this.latestResponse.needLearning = true;
        }
      }
    }

    this.latestResponse.botReplyMessage.text = this.replaceName(this.latestResponse.botReplyMessage.text, this.latestResponse.botReplyMessage.nickname, '{self}', true);
    this.latestResponse.botReplyMessage.text = this.replaceName(this.latestResponse.botReplyMessage.text, this.latestResponse.userMessage.nickname, '{target}');
    this.chatHistory.push(this.latestResponse);
    this.latestResponse.suggestions = this.getNextSuggestions();
    return this.latestResponse;
  }

  replaceName(text: string, name: string | undefined, placeholder: string, isImportant: boolean = false): string {
    let indices = [];
    let index = text?.indexOf(placeholder) ?? -1;

    // Collect all indices of the placeholder
    while (index !== -1) {
      indices.push(index);
      index = text.indexOf(placeholder, index + 1) ?? -1;
    }

    // Check if any placeholders were found
    if (indices.length > 0) {
      // Randomly select one index from indices array
      const selectedIndex = indices[Math.floor(Math.random() * indices.length)];

      // Replace one occurrence randomly with the nickname
      text = text.substring(0, selectedIndex) + this.getNameReplacement(name, isImportant) +
        text?.substring(selectedIndex + placeholder.length);

      // Replace all remaining placeholders with an empty string
      text = text.replace(new RegExp(placeholder, 'g'), '');
    }
    return text;
  }

  getNameReplacement(name: string | undefined, isImportant: boolean): string {
    if (name && (isImportant || !this.chatHistory.length || tossCoin())) {
      return (tossCoin() ? ',' : '') + ` ${name}`;
    }
    return '';
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

export function containsExactPhrase(text: string, phrase: string): boolean {
  text = sanitize(text);
  phrase = sanitize(phrase);
  // Create a regular expression with word boundaries around the entire phrase
  const regex = new RegExp(`\\b${phrase}\\b`, 'i');
  return regex.test(text);
}


export function sanitize(input: string): string {
  // removes any character that is not a word character or whitespace
  return input.toLowerCase().replace(/[^\w\s]/g, '');
}

export function escapeSpecialCharacters(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special characters for regex
}

export function removeDuplicates<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export interface ChatbotData {
  actions: Action[];
}

export interface Action {
  key: string,
  isImportant?: boolean,
  isQuestion?: boolean,
  keywords: string[],
  phrases: string[],
  followUpKeys: string[],
  followUps: Action[],
  reactionKeys: string[],
  reactions: Action[],
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
  mappedUserActions?: Action[];
  botReplyActions?: Action[];
  botReplyMessage: ChatMessage,
  needLearning?: boolean,
  suggestions: string[],
  isUserLeft?: boolean;
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