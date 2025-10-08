import { Injectable, computed, signal } from '@angular/core';

export type TaRole = 'Student' | 'Instructor' | 'Admin';
export type TaBotStatus = 'Draft' | 'Published';
export type TaContextType = 'Syllabus' | 'Course Master' | 'LMS' | 'Attributes' | 'Custom';

export interface TaBot {
  id: string; // uuid-ish
  name: string;
  description?: string;
  contextTypes: TaContextType[];
  temperature: number; // 0.0 - 1.0
  confidencePercent: number; // 0-100
  defaultPrompts: string[];
  roles: TaRole[]; // Available to Roles (multi)
  status: TaBotStatus; // Draft/Published
  active: boolean; // Active/Inactive status
  createdAt: number;
  updatedAt: number;
  creatorName?: string;
}

@Injectable({ providedIn: 'root' })
export class TaBotService {
  private storageKey = 'simple-ta:bots:v1';

  // In-memory state
  readonly bots = signal<TaBot[]>([]);

  // Derived
  readonly publishedBots = computed(() => this.bots().filter(b => b.status === 'Published'));

  constructor() {
    this.load();
    if (this.bots().length === 0) {
      // Seed with an example bot for convenience
      const seed: TaBot = {
        id: this.makeId(),
        name: 'Simple TA',
        description: 'General-purpose Simple TA',
        contextTypes: ['Syllabus', 'Course Master'],
        temperature: 0.7,
        confidencePercent: 3,
        defaultPrompts: [
          'When is my next assignment due?',
          'How is participation graded?',
          'What topics are covered in this course?',
          'What are the course learning objectives?'
        ],
        roles: ['Student', 'Instructor'],
        status: 'Published',
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        creatorName: 'System'
      };
      this.bots.set([seed]);
      this.persist();
    } else {
      // Check if there's an existing "Default TA" and rename it to "Simple TA"
      const existingBots = this.bots();
      const defaultBot = existingBots.find(bot => bot.name === 'Default TA');
      if (defaultBot) {
        defaultBot.name = 'Simple TA';
        defaultBot.updatedAt = Date.now();
        this.bots.set(existingBots);
        this.persist();
      }
    }
  }

  getBotsForRole(appRole: 'student' | 'instructor' | 'designer'): TaBot[] {
    if (appRole === 'designer') {
      // Admin can see everything
      return this.bots();
    }
    const needed: TaRole = appRole === 'instructor' ? 'Instructor' : 'Student';
    return this.publishedBots().filter(b => b.roles.includes(needed));
  }

  createBot(partial: Omit<TaBot, 'id' | 'createdAt' | 'updatedAt'>): TaBot {
    const now = Date.now();
    const bot: TaBot = { ...partial, id: this.makeId(), createdAt: now, updatedAt: now };
    this.bots.update(all => [bot, ...all]);
    this.persist();
    return bot;
  }

  updateBot(bot: TaBot) {
    bot.updatedAt = Date.now();
    this.bots.update(list => list.map(b => (b.id === bot.id ? { ...bot } : b)));
    this.persist();
  }

  deleteBot(id: string) {
    this.bots.update(list => list.filter(b => b.id !== id));
    this.persist();
  }

  cloneBot(id: string, newName?: string): TaBot | null {
    const src = this.bots().find(b => b.id === id);
    if (!src) return null;
    const now = Date.now();
    const clone: TaBot = {
      ...src,
      id: this.makeId(),
      name: newName || `${src.name} (Copy)`,
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
    };
    this.bots.update(list => [clone, ...list]);
    this.persist();
    return clone;
  }

  // --- Persistence ---
  private load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        // Basic validation
        this.bots.set(data.filter(x => x && typeof x.id === 'string'));
      }
    } catch {}
  }

  private persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bots()));
    } catch {}
  }

  private makeId(): string {
    // Lightweight random id
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}
