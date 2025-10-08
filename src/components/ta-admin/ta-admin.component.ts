import { Component, ChangeDetectionStrategy, computed, inject, signal, HostListener, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaBot, TaBotService, TaContextType, TaRole } from '../../services/ta-bot.service';

type PanelTab = 'details' | 'roles' | 'assign';

@Component({
  selector: 'app-ta-admin',
  templateUrl: './ta-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class TaAdminComponent {
  private taBotService = inject(TaBotService);

  // Data
  bots = this.taBotService.bots;

  // Editing state
  selectedBot = signal<TaBot | null>(null);
  isNew = signal(false);
  editingBot = signal<TaBot | null>(null);

  // UI state
  botActionDropdownOpen = signal<string | null>(null);
  promptDropdownOpen = signal<number | null>(null);
  botSearchQuery = signal('');
  botFilterCount = signal(0);
  panelTab = signal<PanelTab>('details');

  // Options
  roleOptions: TaRole[] = ['Student', 'Instructor', 'Admin'];
  contextOptions: TaContextType[] = ['Syllabus', 'Course Master', 'LMS', 'Attributes', 'Custom'];

  // User data for role-based access
  private allUsers = [
    { name: 'Alice Student', role: 'Student' },
    { name: 'Bob Student', role: 'Student' },
    { name: 'Charlie Student', role: 'Student' },
    { name: 'Fred Faculty', role: 'Instructor' },
    { name: 'Grace Instructor', role: 'Instructor' },
    { name: 'Henry Professor', role: 'Instructor' },
    { name: 'Andrew Admin', role: 'Admin' },
    { name: 'Sarah Administrator', role: 'Admin' }
  ];

  // Computed
  filteredBots = computed(() => {
    const bots = this.bots();
    const query = this.botSearchQuery().toLowerCase().trim();
    if (!query) {
      return bots;
    }

    return bots.filter(bot => {
      const combined = `${bot.name} ${bot.description || ''} ${bot.creatorName || ''} ${bot.roles.join(' ')}`.toLowerCase();
      return combined.includes(query);
    });
  });

  panelOpen = computed(() => this.selectedBot() !== null);

  // Users available to the bot based on selected roles
  availableUsers = computed(() => {
    const bot = this.editingBot();
    if (!bot || !bot.roles.length) return [];
    
    return this.allUsers.filter(user => bot.roles.includes(user.role as TaRole));
  });

  trackBotById(_: number, bot: TaBot) { return bot.id; }

  // Search and filtering
  onBotSearchInput(event: Event) {
    this.botSearchQuery.set((event.target as HTMLInputElement).value);
  }

  // Bot CRUD operations
  onAddBot() {
    const now = Date.now();
    const fresh: TaBot = {
      id: 'temp', // will be replaced on save
      name: 'New TA',
      description: '',
      contextTypes: ['Syllabus'],
      temperature: 0.7,
      confidencePercent: 3,
      defaultPrompts: [
        'When is my next assignment due?',
        'How is participation graded?'
      ],
      roles: ['Student'],
      status: 'Draft',
      active: true, // Active by default
      createdAt: now,
      updatedAt: now,
      creatorName: 'Admin'
    };
    this.editingBot.set({ ...fresh });
    this.selectedBot.set({ ...fresh });
    this.isNew.set(true);
    this.panelTab.set('details');
  }

  onSelectBot(botId: string) {
    const bot = this.bots().find(b => b.id === botId);
    if (bot) {
      this.editingBot.set({ 
        ...bot, 
        defaultPrompts: [...bot.defaultPrompts], 
        contextTypes: [...bot.contextTypes], 
        roles: [...bot.roles] 
      });
      this.selectedBot.set(bot);
      this.isNew.set(false);
      this.panelTab.set('details');
    }
  }

  onClosePanel() {
    this.selectedBot.set(null);
    this.editingBot.set(null);
    this.isNew.set(false);
    this.botActionDropdownOpen.set(null);
  }

  toggleBotActionDropdown(event: MouseEvent, botId: string) {
    event.stopPropagation();
    this.botActionDropdownOpen.update(current => current === botId ? null : botId);
  }

  togglePromptDropdown(event: MouseEvent, promptIndex: number) {
    event.stopPropagation();
    this.promptDropdownOpen.update(current => current === promptIndex ? null : promptIndex);
  }

  onBotClone(botId: string) {
    const name = prompt('Name for clone?', 'Cloned Bot');
    if (name) {
      const cloned = this.taBotService.cloneBot(botId, name);
      if (cloned) {
        this.onSelectBot(cloned.id);
      }
    }
    this.botActionDropdownOpen.set(null);
  }

  onBotDelete(botId: string) {
    const bot = this.bots().find(b => b.id === botId);
    if (bot && confirm(`Delete bot "${bot.name}"?`)) {
      this.taBotService.deleteBot(botId);
      if (this.selectedBot()?.id === botId) {
        this.onClosePanel();
      }
    }
    this.botActionDropdownOpen.set(null);
  }

  isSelectedBot(botId: string) {
    return this.selectedBot()?.id === botId;
  }

  // Panel tab management
  selectPanelTab(tab: PanelTab) {
    this.panelTab.set(tab);
  }

  // Form input handlers
  onBotNameInput(event: Event) {
    const bot = this.editingBot();
    if (bot) {
      bot.name = (event.target as HTMLInputElement).value;
      this.editingBot.set({ ...bot });
    }
  }

  onBotDescriptionInput(event: Event) {
    const bot = this.editingBot();
    if (bot) {
      bot.description = (event.target as HTMLInputElement).value;
      this.editingBot.set({ ...bot });
    }
  }

  onBotStatusToggle(event: Event) {
    const bot = this.editingBot();
    if (bot) {
      bot.status = (event.target as HTMLInputElement).checked ? 'Published' : 'Draft';
      this.editingBot.set({ ...bot });
    }
  }

  onBotActiveToggle(event: Event) {
    const bot = this.editingBot();
    if (bot) {
      bot.active = (event.target as HTMLInputElement).checked;
      this.editingBot.set({ ...bot });
    }
  }

  // Save/Cancel operations
  onSave() {
    const bot = this.editingBot();
    if (!bot) return;

    // Clamp values
    bot.temperature = Math.max(0, Math.min(1, Number(bot.temperature || 0)));
    bot.confidencePercent = Math.max(0, Math.min(100, Math.round(Number(bot.confidencePercent || 0))));

    if (this.isNew()) {
      const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = bot as any;
      const created = this.taBotService.createBot({ ...(rest as Omit<TaBot, 'id' | 'createdAt' | 'updatedAt'>) });
      this.onSelectBot(created.id);
      this.isNew.set(false);
    } else {
      this.taBotService.updateBot(bot);
      this.selectedBot.set(bot);
    }
  }

  onCancel() {
    this.onClosePanel();
  }

  // Context and role management
  toggleArrayValue<T>(arr: T[], val: T): T[] {
    const set = new Set(arr);
    if (set.has(val)) set.delete(val); else set.add(val);
    return Array.from(set);
  }

  toggleRole(role: TaRole) {
    const bot = this.editingBot();
    if (!bot) return;
    bot.roles = this.toggleArrayValue(bot.roles, role);
    this.editingBot.set({ ...bot });
  }

  toggleContext(ctx: TaContextType) {
    const bot = this.editingBot();
    if (!bot) return;
    bot.contextTypes = this.toggleArrayValue(bot.contextTypes, ctx);
    this.editingBot.set({ ...bot });
  }

  // Prompt management
  addPrompt() {
    const bot = this.editingBot();
    if (!bot) return;
    bot.defaultPrompts = [...(bot.defaultPrompts || []), ''];
    this.editingBot.set({ ...bot });
  }

  updatePrompt(idx: number, val: string) {
    const bot = this.editingBot();
    if (!bot) return;
    const arr = [...bot.defaultPrompts];
    arr[idx] = val;
    bot.defaultPrompts = arr;
    this.editingBot.set({ ...bot });
  }

  removePrompt(idx: number) {
    const bot = this.editingBot();
    if (!bot) return;
    const arr = [...bot.defaultPrompts];
    arr.splice(idx, 1);
    bot.defaultPrompts = arr;
    this.editingBot.set({ ...bot });
  }

  movePrompt(idx: number, dir: -1 | 1) {
    const bot = this.editingBot();
    if (!bot) return;
    const arr = [...bot.defaultPrompts];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const [item] = arr.splice(idx, 1);
    arr.splice(j, 0, item);
    bot.defaultPrompts = arr;
    this.editingBot.set({ ...bot });
  }

  // AI parameter updates
  updateTemperature(value: number) {
    const bot = this.editingBot();
    if (!bot) return;
    bot.temperature = value;
    this.editingBot.set({ ...bot });
  }

  updateConfidencePercent(value: number) {
    const bot = this.editingBot();
    if (!bot) return;
    bot.confidencePercent = value;
    this.editingBot.set({ ...bot });
  }

  // Click outside handling
  @HostListener('document:click')
  onDocumentClick(event: MouseEvent) {
    if (!event) return;
    const target = event.target as HTMLElement;

    if (this.botActionDropdownOpen() !== null) {
      this.botActionDropdownOpen.set(null);
    }
    if (this.promptDropdownOpen() !== null) {
      this.promptDropdownOpen.set(null);
    }
  }

  // Prompt edit functionality
  focusPromptInput(promptIndex: number) {
    // Focus the input field when Edit button is clicked
    setTimeout(() => {
      const input = document.querySelector(`input[data-prompt-index="${promptIndex}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }
}
