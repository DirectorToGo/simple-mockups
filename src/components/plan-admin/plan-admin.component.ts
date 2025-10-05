import { Component, ChangeDetectionStrategy, computed, inject, output, signal, HostListener, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TermFilterDropdownComponent } from '../term-filter-dropdown/term-filter-dropdown.component';
import { PlanAdminService } from '../../services/plan-admin.service';
import { PlanAdminPlan, PlanAdminTask } from '../../plan-admin.types';

type PanelTab = 'details' | 'assign' | 'reviewers';

@Component({
  selector: 'app-plan-admin',
  templateUrl: './plan-admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TermFilterDropdownComponent],
})
export class PlanAdminComponent {
  private planAdminService = inject(PlanAdminService);

  editTask = output<number>();
  addTask = output<void>();

  plans = this.planAdminService.plans;
  selectedPlan = this.planAdminService.selectedPlan;
  selectedTerm = this.planAdminService.selectedTerm;
  tasks = this.planAdminService.tasks;

  termDropdownOpen = signal(false);
  actionDropdownOpen = signal<number | null>(null);
  planActionDropdownOpen = signal<number | null>(null);
  planSearchQuery = signal('');
  planFilterCount = signal(0);
  panelTab = signal<PanelTab>('details');
  private taskSortState = signal<{ key: 'name' | 'source' | 'display'; direction: 'asc' | 'desc' } | null>(null);

  termButtonRef = viewChild<ElementRef>('planTermButton');
  termDropdownRef = viewChild<ElementRef>('planTermDropdown');

  private readonly avatarPalette = [
    'bg-pink-100 text-pink-700',
    'bg-purple-100 text-purple-700',
    'bg-blue-100 text-blue-700',
    'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700',
  ];

  filteredPlans = computed(() => {
    const plans = this.plans();
    const query = this.planSearchQuery().toLowerCase().trim();
    if (!query) {
      return plans;
    }

    return plans.filter(plan => {
      const combined = `${plan.name} ${plan.description} ${plan.owner}`.toLowerCase();
      return combined.includes(query);
    });
  });

  planSummary = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) {
      return 'Select a plan to see its tasks';
    }
    const taskCount = this.tasks().length;
    return taskCount === 1 ? '1 task' : `${taskCount} tasks`;
  });

  panelOpen = computed(() => this.selectedPlan() !== null);
  taskSort = this.taskSortState.asReadonly();

  trackPlanById(_: number, plan: PlanAdminPlan) { return plan.id; }
  trackTaskById(_: number, entry: PlanAdminTask) { return entry.task.id; }

  onPlanSearchInput(event: Event) {
    this.planSearchQuery.set((event.target as HTMLInputElement).value);
  }

  onAddPlan() {
    const newPlanId = this.planAdminService.createPlan();
    if (typeof newPlanId === 'number') {
      this.panelTab.set('details');
    }
  }

  onSelectPlan(planId: number) {
    this.planAdminService.selectPlan(planId);
    this.panelTab.set('details');
  }

  onClosePanel() {
    this.planAdminService.clearSelectedPlan();
    this.planActionDropdownOpen.set(null);
  }

  togglePlanActionDropdown(event: MouseEvent, planId: number) {
    event.stopPropagation();
    this.planActionDropdownOpen.update(current => current === planId ? null : planId);
  }

  onPlanDelete(planId: number) {
    this.planAdminService.deletePlan(planId);
    this.planActionDropdownOpen.set(null);
  }

  isSelectedPlan(planId: number) {
    return this.selectedPlan()?.id === planId;
  }

  onPlanNameInput(event: Event) {
    this.planAdminService.updateSelectedPlanName((event.target as HTMLInputElement).value);
  }

  onPlanDescriptionInput(event: Event) {
    this.planAdminService.updateSelectedPlanDescription((event.target as HTMLInputElement).value);
  }

  onPlanActiveToggle(event: Event) {
    this.planAdminService.setSelectedPlanActive((event.target as HTMLInputElement).checked);
  }

  selectPanelTab(tab: PanelTab) {
    this.panelTab.set(tab);
  }

  getPlanTaskCount(plan: PlanAdminPlan) {
    return plan.tasks.length;
  }

  getAssigneeInitials(name: string) {
    return name.split(' ').map(part => part[0] ?? '').join('').slice(0, 2).toUpperCase();
  }

  getAssigneeColor(name: string) {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.avatarPalette[hash % this.avatarPalette.length];
  }

  getSources(entry: PlanAdminTask): string[] {
    const sources = new Set<string>();
    entry.task.conditionGroups?.forEach(group => {
      group.conditions?.forEach(condition => {
        if (condition.source) {
          sources.add(condition.source);
        }
      });
    });

    return Array.from(sources);
  }

  onAddTask() {
    this.addTask.emit();
  }

  onTermSelect(term: string) {
    this.planAdminService.selectTerm(term);
    this.termDropdownOpen.set(false);
  }

  onTermSelectionChange(selection: string | string[]) {
    const term = Array.isArray(selection) ? selection[0] ?? '' : selection;
    if (term) {
      this.onTermSelect(term);
    } else {
      this.termDropdownOpen.set(false);
    }
  }

  onEditTask(taskId: number) {
    this.actionDropdownOpen.set(null);
    this.editTask.emit(taskId);
  }

  toggleActionDropdown(event: MouseEvent, taskId: number) {
    event.stopPropagation();
    this.actionDropdownOpen.update(current => current === taskId ? null : taskId);
  }

  toggleTermDropdown() {
    this.termDropdownOpen.update(open => !open);
  }

  onDeleteTask(taskId: number) {
    this.planAdminService.deleteTask(taskId);
    this.actionDropdownOpen.set(null);
  }

  sortTasksBy(key: 'name' | 'source' | 'display') {
    const current = this.taskSortState();
    const direction: 'asc' | 'desc' = current && current.key === key && current.direction === 'asc' ? 'desc' : 'asc';
    this.taskSortState.set({ key, direction });
    this.planAdminService.sortTasks(key, direction);
  }

  @HostListener('document:click')
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (this.actionDropdownOpen() !== null) {
      this.actionDropdownOpen.set(null);
    }
    if (this.planActionDropdownOpen() !== null) {
      this.planActionDropdownOpen.set(null);
    }

    const button = this.termButtonRef();
    const dropdown = this.termDropdownRef();
    if (this.termDropdownOpen() && button && dropdown) {
      const clickedInside = button.nativeElement.contains(target) || dropdown.nativeElement.contains(target);
      if (!clickedInside) {
        this.termDropdownOpen.set(false);
      }
    }
  }
}
