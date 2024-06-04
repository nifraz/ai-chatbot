import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import Fuse, { IFuseOptions } from 'fuse.js';
import { Guid } from 'guid-typescript';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SmartyService {
  private static readonly CHATBOT_DATA_URL: string = 'https://raw.githubusercontent.com/nifraz/data/master/chatbotData.json';
  private static readonly CHATBOT_NAME: string = 'Smarty';
  private actions: Action[] = [];
  private knowledgeBase: Knowledge[] = [];
  
  private newResponse: ChatResponse = {
    userMessage: { owner: Owner.User },
    botReplyMessage: { owner: Owner.Smarty },
    botSuggestions: [],
  };
  private chatHistory: ChatResponse[] = [];
  private storedHistory: Map<string, ChatResponse[]> = new Map<string, ChatResponse[]>();
  
  private static readonly THRESHOLD: number = 0.3;
  private static readonly MAX_THRESHOLD: number = 0.5;
  private actionFuseOptions: IFuseOptions<Action> = {
    keys: ["keywords"],
    includeScore: true,
    threshold: SmartyService.MAX_THRESHOLD,
    includeMatches: true,
  };
  private knowledgeFuseOptions: IFuseOptions<Knowledge> = {
    keys: ["triggers"],
    includeScore: true,
    threshold: SmartyService.MAX_THRESHOLD,
    includeMatches: true,
  };
  private actionFuse: Fuse<Action> = new Fuse(this.actions, this.actionFuseOptions);
  private knowledgeFuse: Fuse<Knowledge> = new Fuse(this.knowledgeBase, this.knowledgeFuseOptions);

  constructor(private http: HttpClient) { 

  }

  reloadChatbotData(): Observable<ChatbotData> {
    return this.http.get<ChatbotData>(SmartyService.CHATBOT_DATA_URL).pipe(
      tap(data => {
        if (data) {
          this.actions = data.actions;
          this.actions.forEach(action => {
            action.followUps = this.actions.filter(act => action.followUpKeys.some(key => key == act.key));
            action.reactions = this.actions.filter(act => action.reactionKeys.some(key => key == act.key));
          });
          const fuseActions = this.actions.filter(action => action.key != 'tell-name')
          this.actionFuse = new Fuse(fuseActions, this.actionFuseOptions);

          this.knowledgeBase = data.knowledgeBase;
          this.knowledgeFuse = new Fuse(this.knowledgeBase, this.knowledgeFuseOptions);
        }
      })
    );
  }

  greetingActionKeys: string[] = ['say-hi', 'ask-name'];
  farewellActionKeys = ['say-bye', 'say-later'];
  ignoredRandomActionKeys: string[] = [...this.greetingActionKeys, 'tell-name', 'ask-to-help', 'tell-a-joke'];
  getNextSuggestions(): string[] {
    if (!this.chatHistory.length) {
      const keywords = this.actions.find(action => action.key == 'tell-name')?.keywords;
      return getRandomElementsAndShuffle(keywords);
    }
    
    let focusedKeywords: string[] = [];
    if (this.chatHistory.length == 1) {
      focusedKeywords = this.actions
        .filter(action => this.greetingActionKeys.includes(action.key))
        .flatMap(action => action.keywords);
    }
    else if (this.chatHistory.length >= 5) {
      focusedKeywords = this.actions
        .filter(action => this.farewellActionKeys.includes(action.key))
        .flatMap(action => action.keywords);
    }
    else {
      focusedKeywords = this.newResponse.botReactions?.flatMap(action => action.reactions).flatMap(reaction => reaction.keywords) ?? [];
    }

    const knowledgeSuggestions = this.knowledgeBase
      .flatMap(knowledge => knowledge.triggers);
    const randomFocusedSuggestions = getRandomElementsAndShuffle([...knowledgeSuggestions, ...focusedKeywords]);
    
    const randomKeywords = this.actions
      .filter(action => !this.ignoredRandomActionKeys.includes(action.key))
      .flatMap(action => action.keywords);
    const randomSuggestions = getRandomElementsAndShuffle(randomKeywords);
    return getRandomElementsAndShuffle(this.removeUsedSuggestions([...randomFocusedSuggestions, ...randomSuggestions]));
  }

  getNextResponse(userMessage: ChatMessage): ChatResponse {
    this.newResponse = {
      userMessage: userMessage,
      botReplyMessage: { owner: Owner.Smarty, nickname: Owner[Owner.Smarty] },
      botSuggestions: [],
    }

    if (userMessage.text) {
      this.newResponse.userMessage = userMessage;
      

      this.mapActionsToReactions();
      const response = this.buildResponse();

      const hasFarewellAction = this.newResponse.botReactions?.some(action => this.farewellActionKeys.includes(action.key));
      if (hasFarewellAction) {
        this.newResponse.isUserLeft = true;
        this.storedHistory.set(userMessage.nickname ?? '', this.chatHistory);
        this.chatHistory = [];
      }
      return response;
    }

    return this.newResponse;
  }

  removeUsedSuggestions(suggestions: string[]): string[] {
    const usedActionKeywords = this.chatHistory
      .flatMap(response => response.userKeywords);
    const usedKnowledgeTriggers = this.chatHistory
      .filter(response => response.botKnowledge)
      .flatMap(response => response.botKnowledge?.triggers);
    return suggestions.filter(suggestion => ![...usedActionKeywords, ...usedKnowledgeTriggers].includes(suggestion));
  }

  mapActionsToReactions(): void {
    this.newResponse.tokens = [];
    this.newResponse.userActions = [];
    this.newResponse.botReactions = [];
    let mappedReaction: Action | undefined;

    const lastResponse = this.chatHistory.length ? this.chatHistory[this.chatHistory.length - 1] : undefined;
    const tellNameAction = this.actions.find(action => action.key == 'tell-name');
    const confusedAction = this.actions.find(action => action.key == 'say-im-confused');
    const askForAnswerAction = this.actions.find(action => action.key == 'ask-for-answer');
    const iWillRememberAction = this.actions.find(action => action.key == 'i-will-remember');
    const sayRandomThingAction = this.actions.find(action => action.key == 'say-random-thing');
    const tellAJokeAction = this.actions.find(action => action.key == 'tell-a-joke');
    const cannotShareJokeAction = this.actions.find(action => action.key == 'cannot-share');
    const askToHelpAction = this.actions.find(action => action.key == 'ask-to-help');
    
    const sanitizedUserMessageText = removeWord(this.newResponse.userMessage.text ?? '', Owner[Owner.Smarty]) ;
    if (lastResponse && lastResponse.isAwaitingAnswer) {
      this.newResponse.tokens.push(sanitizedUserMessageText);
    }
    
    this.newResponse.tokens.push(...splitTextWithPunctuation(sanitizedUserMessageText).filter(token => token));

    this.newResponse.tokens.forEach(token => {
      
      const bestMatchingAction = this.actions.find(action =>
        action.keywords.some(keyword => containsExactPhrase(token, keyword))
      );
      const bestMatchingKnowledge = this.knowledgeBase.find(knowledge =>
        knowledge.triggers.some(trigger => containsExactPhrase(token, trigger))
      );

      this.newResponse.userKeywords = [];
      if (iWillRememberAction && lastResponse && lastResponse.isAwaitingAnswer && lastResponse.knowledgeTrigger && sanitizedUserMessageText) {
        const existingKnowledge = this.knowledgeBase.find(knowledge => knowledge.response == sanitizedUserMessageText);
        if (existingKnowledge) {
          existingKnowledge.triggers.push(lastResponse.knowledgeTrigger);
        }
        else {
          const newKnowledge: Knowledge = {
            triggers: [lastResponse.knowledgeTrigger],
            response: token,
          }
          this.knowledgeBase.push(newKnowledge);
        }
        mappedReaction = iWillRememberAction;
        this.newResponse.tokens = [token];
      }
      else if (!this.chatHistory.length && tellNameAction) {
        this.newResponse.userActions?.push(tellNameAction);
        mappedReaction = getRandomElement(tellNameAction.reactions);
      }
      else if (bestMatchingAction) {
        this.newResponse.userKeywords.push(token);
        this.newResponse.userActions?.push(bestMatchingAction);
        mappedReaction = getRandomElement(bestMatchingAction.reactions);
      }
      else if (bestMatchingKnowledge) {
        this.newResponse.botTrigger = token;
        this.newResponse.botKnowledge = bestMatchingKnowledge;
      }
      else if (confusedAction) {
        const actionFuseResults = this.actionFuse.search(token);
        const bestMatchingActionResult = actionFuseResults[0];

        const knowledgeFuseResults = this.knowledgeFuse.search(token);
        const bestMatchingKnowledgeResult = knowledgeFuseResults[0];

        if (bestMatchingActionResult && bestMatchingActionResult.score && bestMatchingActionResult.score <= SmartyService.THRESHOLD) {
          this.newResponse.userKeywords.push(token);
          const matchingAction = bestMatchingActionResult.item;
          this.newResponse.userActions?.push(matchingAction);
          mappedReaction = getRandomElement(matchingAction.reactions);
        }
        else if (bestMatchingKnowledgeResult && bestMatchingKnowledgeResult.score && bestMatchingKnowledgeResult.score <= SmartyService.THRESHOLD) {
          this.newResponse.botTrigger = token;
          const matchingKnowledge = bestMatchingKnowledgeResult.item;
          this.newResponse.botKnowledge = matchingKnowledge;
        }
        // else if (actionFuseResults.length || knowledgeFuseResults.length) {
        //   mappedReaction = confusedAction;
        //   const actionSuggestions = actionFuseResults.map(result => result.item).flatMap(action => action.keywords);
        //   const knowledgeSuggestions = knowledgeFuseResults.map(result => result.item).flatMap(knowledge => knowledge.triggers);
        //   this.newResponse.botSuggestions = getRandomElementsAndShuffle(this.removeUsedSuggestions([...actionSuggestions, ...knowledgeSuggestions]));
        // }
        else {
          const isUnknownQuestion = token.endsWith('?');
          this.newResponse.botReactions?.push(confusedAction);
          if (isUnknownQuestion && askForAnswerAction && cannotShareJokeAction) {
            mappedReaction = askForAnswerAction;
            this.newResponse.knowledgeTrigger = cleanText(token);
            this.newResponse.isAwaitingAnswer = true;
            this.newResponse.botSuggestions = getRandomElementsAndShuffle(this.removeUsedSuggestions(cannotShareJokeAction.keywords));
          }
          else {
            mappedReaction = getRandomElement([sayRandomThingAction, tellAJokeAction]);
          }
        }
      }

      if (mappedReaction && !this.newResponse.botReactions?.some(action => action.key == mappedReaction?.key)) {
        this.newResponse.botReactions?.push(mappedReaction);
      }
      
      if (tossCoin()) {
        const mappedFollowUps = getRandomElementsAndShuffle(mappedReaction?.followUps, 1);
        mappedFollowUps.forEach(followUp => {
          if (!this.newResponse.botReactions?.some(action => action.key == followUp.key)) {
            this.newResponse.botReactions?.push(followUp);
          }
        });
        
      }
    });
    if (tossCoin() && !mappedReaction && askToHelpAction && !this.newResponse.isAwaitingAnswer) {
      this.newResponse.botReactions?.push(askToHelpAction);
    }
  }

  buildResponse(): ChatResponse {
    this.newResponse.botReplyMessage.text = '404';
    if (this.newResponse && this.newResponse.botReactions) {
      let responseText = '';
      if (this.newResponse.botKnowledge) {
        responseText += this.newResponse.botKnowledge.response + " ";
      }
      this.newResponse.botReactions?.forEach(action => {
        for (let index = 0; index < 3; index++) {
          const mappedPhrase = getRandomElement(action.phrases);
          if (mappedPhrase && !responseText.includes(mappedPhrase)) {
            responseText += mappedPhrase + " ";
            break;
          }
        }
      });

      this.newResponse.botReplyMessage.text = responseText.trim();
    }

    const isTellTargetNameImportant = this.newResponse.userMessage.text?.includes(SmartyService.CHATBOT_NAME)
    this.newResponse.botReplyMessage.text = this.replaceName(this.newResponse.botReplyMessage.text, SmartyService.CHATBOT_NAME, '{self}', true);
    this.newResponse.botReplyMessage.text = this.replaceName(this.newResponse.botReplyMessage.text, this.newResponse.userMessage.nickname, '{target}', );
    this.chatHistory.push(this.newResponse);
    this.newResponse.botSuggestions = this.newResponse.botSuggestions.length ? this.newResponse.botSuggestions : this.getNextSuggestions();
    return this.newResponse;
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
      return ` ${name}`;
    }
    return '';
  }

}

export function getRandomElement<T>(array: T[]): T | undefined {
  if (!array.length) {
    return undefined;
  }
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

export function removeWord(text: string, word: string): string {
  // Create a regular expression to match the word with its leading spaces
  const regex = new RegExp(`\\s*${word}\\b`, 'gi');
  // Replace the word with an empty string
  return text.replace(regex, '').trimEnd();
}

export function splitTextWithPunctuation(text: string): string[] {
  return text.split(/(?<=[.?!])\s*/);
}

export function cleanText(text: string): string {
  return text.replace(/^[^a-zA-Z]+/, '').trimEnd();
}

export interface ChatbotData {
  actions: Action[],
  knowledgeBase: Knowledge[],
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

export interface Knowledge {
  triggers: string[],
  response: string,
}

export interface ChatMessage {
  id?: Guid;
  text?: string,
  time?: Date;
  owner: Owner;
  nickname?: string;
  state?: State,
  isLoading?: boolean;
  isTyping?: boolean;
  isError?: boolean;
  seen?: boolean;
}

export interface ChatResponse {
  userMessage: ChatMessage,
  tokens?: string[],
  userKeywords?: string[],
  userActions?: Action[];
  botReactions?: Action[],
  botReplyMessage: ChatMessage,
  botSuggestions: string[],
  isUserLeft?: boolean,
  botTrigger?: string,
  botKnowledge?: Knowledge,
  isAwaitingAnswer?: boolean,
  userKnowledge?: Knowledge,
  knowledgeTrigger?: string,
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