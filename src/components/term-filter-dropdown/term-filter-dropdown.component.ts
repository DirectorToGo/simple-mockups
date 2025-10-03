import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TermCategory } from '../../document.types';
import { DocumentService } from '../../services/document.service';

@Component({
  selector: 'app-term-filter-dropdown',
  templateUrl: './term-filter-dropdown.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class TermFilterDropdownComponent {
  private documentService = inject(DocumentService);

  // Inputs
  selected = input.required<string[] | string>();
  selectionMode = input<'single' | 'multi'>('multi');

  // Outputs
  selectionChange = output<string[] | string>();
  
  // Internal state
  selectedTerms = signal<string[]>([]);
  termSectionsOpen = signal<Record<TermCategory, boolean>>({ Future: true, Current: true, Historic: true });
  termSearchQuery = signal('');

  termsByGroup = this.documentService.termsByGroup;

  constructor() {
    effect(() => {
      const s = this.selected();
      if (this.selectionMode() === 'multi' && Array.isArray(s)) {
        this.selectedTerms.set(s);
      } else if (this.selectionMode() === 'single' && typeof s === 'string') {
        this.selectedTerms.set(s ? [s] : []);
      }
    });
  }
  
  // --- Computed properties ---
  filteredTermsByGroup = computed(() => {
    const query = this.termSearchQuery().toLowerCase();
    const allGroups = this.termsByGroup();
    if (!query) {
      return allGroups;
    }
    const groups: Record<TermCategory, string[]> = { Future: [], Current: [], Historic: [] };
    (Object.keys(allGroups) as TermCategory[]).forEach(category => {
      groups[category] = allGroups[category].filter(term => term.toLowerCase().includes(query));
    });
    return groups;
  });

  // --- Event handlers ---
  onTermSearch(event: Event) {
    this.termSearchQuery.set((event.target as HTMLInputElement).value);
  }

  toggleTermSectionOpen(section: TermCategory) {
    this.termSectionsOpen.update(current => ({ ...current, [section]: !current[section] }));
  }

  toggleTerm(term: string) {
    if (this.selectionMode() === 'multi') {
      const newSelection = this.selectedTerms().includes(term)
        ? this.selectedTerms().filter(t => t !== term)
        : [...this.selectedTerms(), term];
      this.selectedTerms.set(newSelection);
      this.selectionChange.emit(newSelection);
    } else {
      this.selectedTerms.set([term]);
      this.selectionChange.emit(term);
    }
  }

  toggleTermGroup(category: TermCategory) {
    if (this.selectionMode() !== 'multi') return;

    const termsInGroup = this.termsByGroup()[category];
    const allSelected = this.isTermGroupChecked(category);
    
    this.selectedTerms.update(current => {
      let newSelection: string[];
      if (allSelected) { // if all are selected, deselect them
        newSelection = current.filter(t => !termsInGroup.includes(t));
      } else { // otherwise, select them
        newSelection = [...new Set([...current, ...termsInGroup])];
      }
      this.selectionChange.emit(newSelection);
      return newSelection;
    });
  }
  
  isTermGroupChecked(category: TermCategory): boolean {
    const termsInGroup = this.termsByGroup()[category];
    if (termsInGroup.length === 0) return false;
    return termsInGroup.every(t => this.selectedTerms().includes(t));
  }
  
  isTermGroupIndeterminate(category: TermCategory): boolean {
    const termsInGroup = this.termsByGroup()[category];
    const selectedCount = termsInGroup.filter(t => this.selectedTerms().includes(t)).length;
    return selectedCount > 0 && selectedCount < termsInGroup.length;
  }
}
