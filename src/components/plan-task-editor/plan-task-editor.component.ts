import { Component, ChangeDetectionStrategy, signal, computed, inject, effect, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanTask, Condition, ConditionGroup, DisplayType, ConditionGroupType, SubCondition, ConditionResultType, ConditionResult } from '../../plan-task.types';
import { TermFilterDropdownComponent } from '../term-filter-dropdown/term-filter-dropdown.component';
import { TestDataService } from '../../services/test-data.service';
import { EvaluationService } from '../../services/evaluation.service';
import { GeminiService } from '../../services/gemini.service';
import { EvaluationResult, TestSection } from '../../plan-task-evaluation.types';
import { PlanAdminService } from '../../services/plan-admin.service';

// Operator sets
const NUMERIC_OPERATORS = ['Equals', 'Does not equal', 'Is greater than', 'Is less than', 'Is greater than or equal to', 'Is less than or equal to', 'Is empty', 'Is not empty'];
const STRING_OPERATORS = ['Starts with', 'Ends with', 'Contains', 'Matches', 'Does not match', 'Character count equals', 'Character count less than', 'Is empty', 'Is not empty'];

// Type definitions for the configuration
type ValueType = 'none' | 'select' | 'numeric' | 'string' | 'date';

interface PropertyConfig {
  valueType: ValueType;
  options?: string[];
  operators?: string[];
  subConditionProperties?: Record<string, PropertyConfig>;
  requiresSubConditions?: boolean;
}

const BASE_COMPONENT_SUB_CONDITIONS: Record<string, PropertyConfig> = {
  'Name': { valueType: 'string', operators: STRING_OPERATORS },
  'Required': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Required', 'Not Required'] },
  'Visible': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Visible', 'Not Visible'] },
  'Public/Private': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Public', 'Private'] },
  'Section editing': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Enabled', 'Not Enabled'] },
  'Course editing': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Enabled', 'Not Enabled'] },
  'Help Text': { valueType: 'string', operators: STRING_OPERATORS }
};

const COMPONENT_FIELD_EXTRAS: Record<string, Record<string, PropertyConfig>> = {
  'Instructor Information': {
    'Field - Name': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Title': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Email': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Phone': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Office location': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Office Hours': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Instructor Photo': { valueType: 'string', operators: STRING_OPERATORS },
  },
  'Course Objective': {
    'Field - Objective': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Bloom\'s Taxonomy': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Assessment Method': { valueType: 'string', operators: STRING_OPERATORS },
  },
  'Required materials': {
    'Field - Title': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Subtitle': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - ISBN': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Description': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Thumbnail': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Authors': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Published': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - URL': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Notes': { valueType: 'string', operators: STRING_OPERATORS },
  },
  'Optional materials': {
    'Field - Title': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Subtitle': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - ISBN': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Description': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Thumbnail': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Authors': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Published': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - URL': { valueType: 'string', operators: STRING_OPERATORS },
    'Field - Notes': { valueType: 'string', operators: STRING_OPERATORS },
  },
};

const buildComponentSubConditions = (componentName: string): Record<string, PropertyConfig> => {
  const extras = COMPONENT_FIELD_EXTRAS[componentName] ?? {};
  return { ...BASE_COMPONENT_SUB_CONDITIONS, ...extras };
};

// Reusable sub-condition property configurations for LMS Conditions
const LMS_SUB_COMMON: Record<string, PropertyConfig> = {
  'Name': { valueType: 'string', operators: STRING_OPERATORS },
  'Publish State': { valueType: 'select', operators: ['Is'], options: ['Published', 'Unpublished'] },
  'Last Updated': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
};

const LMS_SUB_GRADABLE: Record<string, PropertyConfig> = {
  ...LMS_SUB_COMMON,
  'Graded': { valueType: 'select', operators: ['Is'], options: ['Graded', 'Not Graded'] },
  'Due Date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
  'Due Date relative to Term': { valueType: 'select', operators: ['Is'], options: ['Outside term dates', 'Not outside term dates'] },
  'Rubric': { valueType: 'select', operators: ['Is'], options: ['Used', 'Not Used'] },
};

const LMS_SUB_ASSIGNMENT: Record<string, PropertyConfig> = {
  ...LMS_SUB_GRADABLE,
  'Anonymous Grading': { valueType: 'select', operators: ['Is'], options: ['On', 'Off'] },
};

const LMS_SUB_POSTABLE: Record<string, PropertyConfig> = {
  ...LMS_SUB_GRADABLE,
  'Instructor Post': { valueType: 'none', operators: ['Exists', 'Does not exist'] },
};

interface DynamicValue {
  label: string;
  value: string;
  type: 'date' | 'string' | 'numeric';
  calculatedValue: string;
}

type ResultViewModel = {
  status: 'no_section' | 'manual' | 'evaluated' | 'invalid';
  data: {
    isManualOverride: boolean;
    passes: boolean;
    displayValue: string;
    resultType: ConditionResultType;
    customName?: string;
    icon?: string;
  } | null;
};

interface GroupHistoryEntry {
  past: Condition[][];
  future: Condition[][];
}

export interface AiResult {
  isValidRequest: boolean;
  clarification: string | null;
  taskName: string | null;
  conditionGroups: Omit<ConditionGroup, 'id'>[] | null;
}

type ValidationContextMode = 'pass' | 'fail';
type ValidationContextLabel = 'Syllabus' | 'LMS' | 'Attribute' | 'Mixed';

interface ValidationContextEntry {
  id: string;
  name: string;
  passes: boolean;
  label: ValidationContextLabel;
  section: TestSection;
  result: EvaluationResult;
}


@Component({
  selector: 'app-plan-task-editor',
  templateUrl: './plan-task-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TermFilterDropdownComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  }
})
export class PlanTaskEditorComponent {
  private testDataService = inject(TestDataService);
  private evaluationService = inject(EvaluationService);
  private geminiService = inject(GeminiService);
  private planAdminService = inject(PlanAdminService);
  // --- AI CONFIG ---
  aiApiKeyInput = signal('');
  isAiConfigured() { return this.geminiService.isConfigured(); }
  // Parent-provided mode: 'create' or 'edit' to set initial sidebar defaults
  mode = input<'edit' | 'create'>('edit');

  saveAiApiKey() {
    const key = this.aiApiKeyInput().trim();
    if (!key) return;
    this.geminiService.configure(key);
    this.aiError.set(null);
  }


  // --- MOCK DATA & CONFIG ---
  private MOCK_PLAN_TASK: PlanTask = {
    id: 1,
    term: 'Fall 2025',
    name: '',
    description: '',
    conditionGroups: [],
    displayType: 'Yes/No',
    conditionResult: { type: 'Pass' },
    conditionFailure: { type: 'Fail' },
    allowView: true,
    allowEdit: false,
    active: true,
  };

  private conditionOptionsConfig: Record<ConditionGroupType, Record<string, { properties: Record<string, PropertyConfig> }>> = {
    'Syllabus condition': {
      'Syllabus Details': {
        properties: {
          'Publish State': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Published', 'Not Published'] },
          'Status': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Not Started', 'In progress', 'Awaiting approval', 'Completed', 'Inactive'] },
          'Completed date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on'] },
          'Material count': { valueType: 'numeric' },
          'Objective count': { valueType: 'numeric' },
          'Instructor count': { valueType: 'numeric' },
          'Component count': { valueType: 'numeric' },
          'Syllabus Access': { valueType: 'select', operators: ['Is', 'Is not'], options: ['General Public', 'Campus Community', 'Private Access'] },
          'Student engagement': { valueType: 'numeric' }
        }
      },
      'Component by name': {
        properties: {
          'Instructor Information': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Instructor Information') },
          'Required materials': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Required materials') },
          'Optional materials': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Optional materials') },
          'Grading scheme': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Grading scheme') },
          'Program outcomes': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Program outcomes') },
          'Course overview': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Course overview') },
          'Class schedule': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Class schedule') },
          'Course Objective': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Course Objective') },
          'Student engagement (syllabus)': { valueType: 'none', operators: ['Is present', 'Is not present'], subConditionProperties: buildComponentSubConditions('Student engagement (syllabus)') },
        }
      },
      'Component by type': {
        properties: {
          'Content': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Instructor': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Internal': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Materials': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Objectives': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Quick Pick': { valueType: 'none', operators: ['Is present', 'Is not present'] },
          'Schedule': { valueType: 'none', operators: ['Is present', 'Is not present'] },
        }
      }
    },
    'LMS Condition': {
      'Assignments': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_ASSIGNMENT },
          'Total Points': { valueType: 'numeric' },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_ASSIGNMENT, requiresSubConditions: true }
        }
      },
      'Course': {
        properties: {
          'Publish State': { valueType: 'select', operators: ['Is'], options: ['Published', 'Unpublished'] },
          'Name': { valueType: 'string', operators: STRING_OPERATORS },
          'Last Updated': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
          'Cross-listed': { valueType: 'select', operators: ['Is'], options: ['Yes', 'No'] },
          'Start date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
          'End date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
          'Student count': { valueType: 'numeric' },
          'Most recent enrollment': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
          'Instructor assigned': { valueType: 'select', operators: ['Is'], options: ['Yes', 'No'] },
          'Created date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] }
        }
      },
      'Discussions': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE },
          'Total Points': { valueType: 'numeric' },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE, requiresSubConditions: true }
        }
      },
      'Documents': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON, requiresSubConditions: true }
        }
      },
      'Modules': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON, requiresSubConditions: true }
        }
      },
      'Pages': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON, requiresSubConditions: true }
        }
      },
      'Quiz': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE },
          'Average Score': { valueType: 'numeric' },
          'Total Points': { valueType: 'numeric' },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE, requiresSubConditions: true }
        }
      },
      'Rubrics': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_COMMON },
          'Is Used': { valueType: 'none', operators: ['Is true', 'Is false'] }
        }
      },
      'Survey': {
        properties: {
          'Total Count': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE },
          'Completion Rate': { valueType: 'numeric' },
          'Total Percent': { valueType: 'numeric', subConditionProperties: LMS_SUB_POSTABLE, requiresSubConditions: true }
        }
      },
    },
    'Attribute condition': {
      'Course': {
        properties: {
          'Subject': { valueType: 'string', operators: STRING_OPERATORS },
          'Course number': { valueType: 'string', operators: STRING_OPERATORS },
          'Title': { valueType: 'string', operators: STRING_OPERATORS },
          'Parent organization': { valueType: 'string', operators: STRING_OPERATORS },
          'Term': { valueType: 'string', operators: STRING_OPERATORS },
          'Catalog description': { valueType: 'string', operators: STRING_OPERATORS },
          'Prerequisite': { valueType: 'string', operators: STRING_OPERATORS },
          'Credit hours': { valueType: 'numeric', operators: NUMERIC_OPERATORS },
        }
      },
      'Section': {
        properties: {
          'Name': { valueType: 'string', operators: STRING_OPERATORS },
          'Course number': { valueType: 'string', operators: STRING_OPERATORS },
          'Title': { valueType: 'string', operators: STRING_OPERATORS },
          'Syllabus due date': { valueType: 'date', operators: ['Is before', 'Is after', 'Is on', 'Is empty', 'Is not empty'] },
          'Timezone': { valueType: 'string', operators: STRING_OPERATORS },
          'Term': { valueType: 'string', operators: STRING_OPERATORS },
          'Subject': { valueType: 'string', operators: STRING_OPERATORS },
          'Delivery method': { valueType: 'select', operators: ['Is', 'Is not'], options: ['Online', 'In-Person', 'Hybrid'] },
          'CRN': { valueType: 'string', operators: STRING_OPERATORS },
        }
      }
    }
  };

  private dynamicValues: DynamicValue[] = [
    // String
    { label: 'Institution Name', value: '{institution_name}', type: 'string', calculatedValue: 'Simple State University' },
    { label: 'Term Name', value: '{term_name}', type: 'string', calculatedValue: 'Fall 2025' },

    // Number
    { label: 'Total Students (LMS)', value: '{total_student (LMS)}', type: 'numeric', calculatedValue: '12,345' },
    { label: 'Total Students (SHE)', value: '{total_student (SHE)}', type: 'numeric', calculatedValue: '12,500' },
    { label: 'Total Published Syllabi', value: '{total_published_syllabi}', type: 'numeric', calculatedValue: '350' },
    { label: 'Total Syllabi', value: '{total_syllabi}', type: 'numeric', calculatedValue: '410' },
    { label: 'Total Sections', value: '{total_sections}', type: 'numeric', calculatedValue: '450' },

    // Date
    { label: 'Today\'s Date', value: '{today}', type: 'date', calculatedValue: new Date().toLocaleDateString() },
    { label: 'Term Start Date', value: '{term_start}', type: 'date', calculatedValue: '08/26/2024' },
    { label: 'Term End Date', value: '{term_end}', type: 'date', calculatedValue: '12/13/2024' },
    { label: 'Syllabus Due Date', value: '{syllabus_due_date}', type: 'date', calculatedValue: '08/19/2024' },
    { label: 'Plan Due Date', value: '{plan_due_date}', type: 'date', calculatedValue: '07/15/2024' },
  ];

  displayTypes: DisplayType[] = ['Yes/No', 'Number', 'Fraction', 'Percent', 'Date', 'Status Label'];
  conditionResultOptions: { type: ConditionResultType, label: string }[] = [
    { type: 'Pass', label: 'Pass' },
    { type: 'Warning', label: 'Warning' },
    { type: 'Fail', label: 'Fail' },
    { type: 'Custom', label: 'Custom' }
  ];
  conditionGroupTypes: ConditionGroupType[] = ['Syllabus condition', 'LMS Condition', 'Attribute condition'];

  iconChoices = ['help', 'info', 'stop_circle', 'dangerous', 'event_busy', 'pause_circle', 'report', 'play_circle'];

  // --- COMPONENT STATE ---
  task = signal<PlanTask>(this.cloneTask(this.MOCK_PLAN_TASK));
  activeDropdown = signal<string | null>(null);
  close = output<void>();

  // Search state for dropdowns
  dropdownSearchQuery = signal('');

  // Custom Condition Result Modal State
  showCustomResultModal = signal(false);
  customResultName = signal('');
  customResultIcon = signal<string | undefined>(undefined);

  customizePassFailStatus = signal(false);
  editingCustomResultType = signal<'success' | 'failure'>('success');

  // Dynamic value state
  dynamicValuesForType = signal<DynamicValue[]>([]);

  // --- AI BUILDER STATE ---
  showAiBuilderModal = signal(false);
  aiPrompt = signal('');
  isGeneratingWithAi = signal(false);
  generatedAiResult = signal<AiResult | null>(null);
  aiError = signal<string | null>(null);


  // --- HELP PANEL STATE ---
  // --- BROWSE PANEL STATE ---
  showBrowseSidebar = signal(true);
  toggleBrowseSidebar() { this.showBrowseSidebar.update(v => !v); }
  private _browseInit = false;

  // --- CONSOLIDATED SIDE PANEL TABS ---
  sideTab = signal<'browse' | 'help'>('browse');
  selectSideTab(tab: 'browse' | 'help') { this.sideTab.set(tab); }

  // Full side help panel visibility (open by default)
  showHelpSidebar = signal(true);
  toggleHelpSidebar() { this.showHelpSidebar.update(v => !v); }


  // --- COPY FROM EXISTING TASKS STATE ---
  copySearchQuery = signal('');
  copyTaskOptions = computed(() => {
    const currentPlanId = this.planAdminService.selectedPlan()?.id ?? null;
    const q = this.copySearchQuery().toLowerCase().trim();
    const plans = this.planAdminService.plans();

    const items = plans.flatMap(plan => plan.tasks.map(entry => ({
      planId: plan.id,
      planName: plan.name,
      task: entry.task,
    })));

    const filtered = items.filter(it => it.planId !== currentPlanId);

    if (!q) return filtered;
    return filtered.filter(it =>
      it.task.name.toLowerCase().includes(q) || (it.task.description?.toLowerCase().includes(q))
    );
  });

  onCopySearch(event: Event) { this.copySearchQuery.set((event.target as HTMLInputElement).value); }

  copyConditionsFrom(source: PlanTask) {
    const clonedGroups = JSON.parse(JSON.stringify(source.conditionGroups || []));
    this.task.update(t => ({ ...t, conditionGroups: clonedGroups }));
    // Auto-collapse the browse panel after copying
    this.showBrowseSidebar.set(false);
  }

  // --- TEST EVALUATION STATE ---
  testSections = this.testDataService.testSections;
  selectedTestSectionId = signal<number | null>(null);
  testSectionSearchQuery = signal('');
  manualTestResultOverride = signal<'pass' | 'fail' | null>(null);
  private groupHistories = signal<Record<number, GroupHistoryEntry>>({});

  validationContextEnabled = signal(true);
  validationContextMode = signal<ValidationContextMode>('fail');
  showPrepStepsModal = signal(false);
  validationContextPageIndex = signal(0);
  prepStepActiveEntryId = signal<string | null>(null);
  prepStepBaseAttributes = signal<{ label: string; value: string; key: string }[]>([]);
  prepStepEdits = signal<Record<string, string>>({});
  private readonly PAGE_SIZE = 5;

  selectedTestSection = computed(() => {
    const id = this.selectedTestSectionId();
    if (id === null) return null;
    return this.testSections().find(s => s.id === id) ?? null;
  });

  filteredTestSections = computed(() => {
    const term = this.task().term?.trim();
    const query = this.testSectionSearchQuery().toLowerCase();

    return this.testSections().filter(section => {
      const termMatches = !term || section.term === term;
      if (!termMatches) {
        return false;
      }

      if (!query) {
        return true;
      }

      return section.name.toLowerCase().includes(query);
    });
  });

  testSectionButtonText = computed(() => {
    const section = this.selectedTestSection();
    return section ? section.name : 'Select a section...';
  });

  evaluationResult = computed<EvaluationResult | null>(() => {
    const section = this.selectedTestSection();
    const currentTask = this.task();
    if (!section || currentTask.conditionGroups.length === 0) {
      return null;
    }

    if (this.hasInvalidConditionConfiguration(currentTask)) {
      return null;
    }
    return this.evaluationService.evaluate(currentTask, section);
  });

  private getDisplayValueForManualState(passes: boolean): string {
    const currentTask = this.task();
    if (currentTask.displayType === 'Yes/No') {
      return passes ? 'Yes' : 'No';
    }
    // Manual tasks/overrides don't have a calculated value for other display types
    return '';
  }

  resultViewModel = computed<ResultViewModel>(() => {
    const currentTask = this.task();
    const hasConditions = currentTask.conditionGroups.length > 0;
    const sectionSelected = !!this.selectedTestSection();
    const override = this.manualTestResultOverride();

    // Case 1: No test section selected. This is now the highest priority state.
    if (!sectionSelected) {
      return { status: 'no_section', data: null };
    }

    // From here, we know a section has been selected.

    // Case 2: Task is manual (no conditions defined).
    if (!hasConditions) {
      // It can still be manually overridden.
      if (override) {
        const passes = override === 'pass';
        const resultConfig = passes ? currentTask.conditionResult : currentTask.conditionFailure;
        return { status: 'manual', data: { isManualOverride: true, passes, displayValue: this.getDisplayValueForManualState(passes), resultType: resultConfig.type, customName: resultConfig.customName, icon: resultConfig.icon } };
      }
      // Default state for a manual task is 'fail'.
      const passes = false;
      const resultConfig = currentTask.conditionFailure;
      return { status: 'manual', data: { isManualOverride: false, passes, displayValue: this.getDisplayValueForManualState(passes), resultType: resultConfig.type, customName: resultConfig.customName, icon: resultConfig.icon } };
    }

    // From here, we know the task has conditions AND a section is selected.
    if (this.hasInvalidConditionConfiguration(currentTask)) {
      return { status: 'invalid', data: null };
    }

    // Case 3: Result is manually overridden.
    if (override) {
      const passes = override === 'pass';
      const resultConfig = passes ? currentTask.conditionResult : currentTask.conditionFailure;
      return { status: 'evaluated', data: { isManualOverride: true, passes, displayValue: this.getDisplayValueForManualState(passes), resultType: resultConfig.type, customName: resultConfig.customName, icon: resultConfig.icon } };
    }

    // Case 4: Automated evaluation.
    const autoResult = this.evaluationResult();
    if (autoResult) {
      return { status: 'evaluated', data: { isManualOverride: false, passes: autoResult.passes, displayValue: autoResult.displayValue, resultType: autoResult.resultType, customName: autoResult.customName, icon: autoResult.icon } };
    }

    // Fallback case, e.g., if evaluation is in progress or failed unexpectedly.
    return { status: 'no_section', data: null };
  });

  constructor() {
    // Initialize browse panel default state based on mode (open for create, closed for edit)
    effect(() => {
      if (!this._browseInit) {
        const m = this.mode();
        this.showBrowseSidebar.set(m === 'create');
        this._browseInit = true;
      }
    });

    effect(() => {
      const activeTask = this.planAdminService.activeTask();
      if (activeTask) {
        this.task.set(this.cloneTask(activeTask));
      } else {
        this.task.set(this.cloneTask(this.MOCK_PLAN_TASK));
      }
    });

    effect(() => {
      const active = this.activeDropdown();
      if (active === null) {
        this.dropdownSearchQuery.set('');
        this.testSectionSearchQuery.set('');
      }
    });

    effect(() => {
      const available = this.availableDisplayTypes();
      const currentDisplayType = this.task().displayType;

      if (currentDisplayType && !available[currentDisplayType]) {
        this.task.update(t => ({ ...t, displayType: 'Yes/No' }));
      }
    });
  }

  availableDisplayTypes = computed(() => {
    const allConditions = this.task().conditionGroups.flatMap(g => g.conditions);

    const availability: Record<DisplayType, boolean> = {
      'Yes/No': true,
      'Number': false,
      'Fraction': false,
      'Percent': false,
      'Date': false,
      'Status Label': false,
    };

    // For value-based display types, we require exactly one condition.
    if (allConditions.length !== 1) {
      return availability;
    }

    const condition = allConditions[0];
    const config = this.getPropertyConfigForCondition(condition);
    if (!config) {
      return availability;
    }

    switch (config.valueType) {
      case 'numeric':
        availability['Number'] = true;
        if (this.doesOperatorRequireValue(condition.operator)) {
          const numericValue = parseFloat(condition.value);
          if (!isNaN(numericValue) && numericValue > 0) {
            availability['Fraction'] = true;
            availability['Percent'] = true;
          }
        }
        break;
      case 'date':
        availability['Date'] = true;
        break;
      case 'string':
      case 'select':
        availability['Status Label'] = true;
        break;
    }

    return availability;
  });

  filteredDynamicValues = computed(() => {
    const query = this.dropdownSearchQuery().toLowerCase();
    if (!query) return this.dynamicValuesForType();
    return this.dynamicValuesForType().filter(v => v.label.toLowerCase().includes(query) || v.value.toLowerCase().includes(query));
  });

  // --- COMPUTED PROPERTIES FOR CONDITION FILTERS ---
  private filterOptions(options: string[]): string[] {
    const query = this.dropdownSearchQuery().toLowerCase();
    return !query ? options : options.filter(opt => opt.toLowerCase().includes(query));
  }

  getSourceOptionsForCondition(condition: Condition): string[] {
    if (!condition.groupType) return [];
    return Object.keys(this.conditionOptionsConfig[condition.groupType]);
  }

  getFilteredSourceOptionsForCondition(condition: Condition): string[] {
    return this.filterOptions(this.getSourceOptionsForCondition(condition));
  }

  getPropertiesForCondition(condition: Condition): string[] {
    if (!condition.groupType || !condition.source) return [];
    return Object.keys(this.conditionOptionsConfig[condition.groupType][condition.source]?.properties ?? {});
  }

  getFilteredPropertiesForCondition(condition: Condition): string[] {
    return this.filterOptions(this.getPropertiesForCondition(condition));
  }

  getOperatorsForCondition(condition: Condition): string[] {
    const config = this.getPropertyConfigForCondition(condition);
    if (!config) return [];
    if (config.operators) return config.operators;

    switch (config.valueType) {
        case 'numeric': return NUMERIC_OPERATORS;
        case 'string': return STRING_OPERATORS;
        default: return [];
    }
  }

  getFilteredOperatorsForCondition(condition: Condition): string[] {
    return this.filterOptions(this.getOperatorsForCondition(condition));
  }

  getPropertyConfigForCondition(condition: Condition): PropertyConfig | undefined {
    if (!condition?.groupType || !condition?.source || !condition?.property) return undefined;
    return this.conditionOptionsConfig[condition.groupType]?.[condition.source]?.properties[condition.property];
  }

  getFilteredValueOptions(condition: Condition): string[] {
    const options = this.getPropertyConfigForCondition(condition)?.options ?? [];
    return this.filterOptions(options);
  }

  getValueInputIcon(condition: Condition): string | null {
    const config = this.getPropertyConfigForCondition(condition);
    if (!config) return null;
    return this.getIconForValueType(config.valueType, condition.property);
  }

  getSubConditionValueIcon(condition: Condition, subCondition: SubCondition): string | null {
    const config = this.getSubConditionPropertyConfig(condition, subCondition);
    if (!config) return null;
    return this.getIconForValueType(config.valueType, subCondition.property);
  }

  allowsDynamicValues(condition: Condition): boolean {
    const config = this.getPropertyConfigForCondition(condition);
    if (!config) return false;
    if (config.valueType === 'numeric' && (condition.property?.toLowerCase().includes('percent') ?? false)) {
      return false;
    }
    return true;
  }

  allowsDynamicValuesForSub(condition: Condition, subCondition: SubCondition): boolean {
    const config = this.getSubConditionPropertyConfig(condition, subCondition);
    if (!config) return false;
    if (config.valueType === 'numeric' && (subCondition.property?.toLowerCase().includes('percent') ?? false)) {
      return false;
    }
    return true;
  }

  private getIconForValueType(valueType: ValueType, propertyName?: string): string | null {
    switch (valueType) {
      case 'string':
        return 'text_fields';
      case 'numeric':
        return propertyName?.toLowerCase().includes('percent') ? 'percent' : 'numbers';
      case 'date':
        return 'calendar_month';
      default:
        return null;
    }
  }


  // --- UI HANDLERS ---
  onDocumentClick(event: MouseEvent) {
    if (!this.activeDropdown()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-dropdown-button]') && !target.closest('[data-dropdown-panel]')) {
        this.activeDropdown.set(null);
    }
  }

  toggleDropdown(name: string) {
    this.activeDropdown.update(current => {
       const newDropdown = current === name ? null : name;
      if (newDropdown !== null && current !== newDropdown) {
        this.dropdownSearchQuery.set('');
        this.testSectionSearchQuery.set('');
      }
      return newDropdown;
    });
  }

  onDropdownSearch(event: Event) { this.dropdownSearchQuery.set((event.target as HTMLInputElement).value); }
  onTestSectionSearch(event: Event) { this.testSectionSearchQuery.set((event.target as HTMLInputElement).value); }

  onTermSelectionChange(term: string) {
    this.task.update(t => ({ ...t, term }));
    this.selectedTestSectionId.set(null);
    this.activeDropdown.set(null);
  }

  openDatePicker(input: HTMLInputElement) {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  }

  onCalendarDateSelected(groupId: number, conditionId: number, value: string) {
    if (!value) {
      return;
    }
    this.updateConditionValue(groupId, conditionId, value);
  }

  onCalendarDateSelectedForSubCondition(groupId: number, conditionId: number, subConditionId: number, value: string) {
    if (!value) {
      return;
    }
    this.updateSubConditionValue(groupId, conditionId, subConditionId, value);
  }

  // --- DYNAMIC DROPDOWN LOGIC ---
  doesOperatorRequireValue(operator: string): boolean {
    const operatorsWithoutValue = [
      'Is published', 'Is not published',
      'Is complete', 'Is not complete',
      'Is present', 'Is not present',
      'Is empty', 'Is not empty',
      'Is true', 'Is false',
      'Is Active', 'Is Inactive',
      'Exists', 'Does not exist',
    ];
    return operator ? !operatorsWithoutValue.includes(operator) : false;
  }

  private findAndRunUpdate(task: PlanTask, groupId: number, conditionId: number, updateFn: (c: Condition) => Condition): PlanTask {
    const newGroups = task.conditionGroups.map(g => {
      if (g.id === groupId) {
        const previousConditions = this.deepCloneConditions(g.conditions);
        const updatedConditions = g.conditions.map(c => {
          if (c.id === conditionId) return updateFn(c);
          return c;
        });

        if (!this.areConditionArraysEqual(previousConditions, updatedConditions)) {
          this.pushGroupHistory(groupId, previousConditions);
        }

        return { ...g, conditions: updatedConditions };
      }
      return g;
    });
    return { ...task, conditionGroups: newGroups };
  }

  selectConditionType(groupId: number, conditionId: number, groupType: ConditionGroupType) {
    this.task.update(task => {
      return this.findAndRunUpdate(task, groupId, conditionId, c => ({
        ...c,
        groupType,
        source: '',
        property: '',
        operator: '',
        value: '',
        subConditions: []
      }));
    });
    this.activeDropdown.set(null);
  }

  selectConditionSource(groupId: number, conditionId: number, source: string) {
    this.task.update(task => {
      return this.findAndRunUpdate(task, groupId, conditionId, c => ({ ...c, source, property: '', operator: '', value: '', subConditions: [] }));
    });
    this.activeDropdown.set(null);
  }

  selectConditionProperty(groupId: number, conditionId: number, property: string) {
    this.task.update(task => {
      return this.findAndRunUpdate(task, groupId, conditionId, c => {
        const propertyConfig = c.groupType && c.source
          ? this.conditionOptionsConfig[c.groupType]?.[c.source]?.properties[property]
          : undefined;

        const newCondition: Condition = { ...c, property, operator: '', value: '', subConditions: [] };

        if (propertyConfig?.requiresSubConditions) {
          newCondition.subConditions = [this.createEmptySubCondition(task)];
        }

        return newCondition;
      });
    });
    this.activeDropdown.set(null);
  }

  selectConditionOperator(groupId: number, conditionId: number, operator: string) {
    this.task.update(task => this.findAndRunUpdate(task, groupId, conditionId, c => {
      const newCondition = { ...c, operator };

      // Check if sub-conditions should be cleared based on the new operator
      const config = this.getPropertyConfigForCondition(newCondition);
      let operatorAllowsSubConditions = false; // Default to false

      if (config?.subConditionProperties) {
        if (newCondition.groupType === 'Syllabus condition') {
          // Only 'Is present' allows sub-conditions
          operatorAllowsSubConditions = newCondition.operator === 'Is present';
        } else if (newCondition.groupType === 'LMS Condition') {
          // For LMS, if a property has sub-conditions, all operators are fine.
          operatorAllowsSubConditions = true;
        }
      }

      if (!operatorAllowsSubConditions) {
        newCondition.subConditions = [];
      }

      return newCondition;
    }));
    this.activeDropdown.set(null);
  }

  updateConditionValue(groupId: number, conditionId: number, value: any) {
    this.task.update(task => this.findAndRunUpdate(task, groupId, conditionId, c => ({ ...c, value })));
  }

  selectConditionValue(groupId: number, conditionId: number, value: any) {
    this.updateConditionValue(groupId, conditionId, value);
    this.activeDropdown.set(null);
  }

  toggleDynamicValueDropdown(id: number, isSub: boolean, type: 'string' | 'numeric' | 'date') {
    const key = `dynamic-value-${isSub ? 'sub' : 'cond'}-${id}`;
    this.activeDropdown.update(current => {
      const newDropdown = current === key ? null : key;
      if (newDropdown) {
        this.dynamicValuesForType.set(this.dynamicValues.filter(v => v.type === type));
        this.dropdownSearchQuery.set('');
      }
      return newDropdown;
    });
  }

  selectDynamicValue(groupId: number, conditionId: number, value: string, subConditionId?: number) {
    if (subConditionId) {
      this.updateSubConditionValue(groupId, conditionId, subConditionId, value);
    } else {
      this.updateConditionValue(groupId, conditionId, value);
    }
    this.activeDropdown.set(null);
  }

  private getNextConditionOrSubConditionId(task: PlanTask): number {
    const allIds = task.conditionGroups.flatMap(group =>
      group.conditions.flatMap(condition => [
        condition.id,
        ...(condition.subConditions?.map(sub => sub.id) ?? [])
      ])
    );
    return Math.max(0, ...allIds, 0) + 1;
  }

  private createEmptySubCondition(task: PlanTask): SubCondition {
    return { id: this.getNextConditionOrSubConditionId(task), property: '', operator: '', value: '' };
  }

  private deepCloneConditions(conditions: Condition[]): Condition[] {
    return conditions.map(condition => ({
      ...condition,
      subConditions: condition.subConditions ? condition.subConditions.map(sub => ({ ...sub })) : []
    }));
  }

  private areConditionArraysEqual(a: Condition[], b: Condition[]): boolean {
    return JSON.stringify(this.normalizeConditions(a)) === JSON.stringify(this.normalizeConditions(b));
  }

  private normalizeConditions(conditions: Condition[]): Condition[] {
    return conditions.map(condition => ({
      ...condition,
      subConditions: (condition.subConditions ?? []).map(sub => ({ ...sub }))
    }));
  }

  private ensureGroupHistory(groupId: number) {
    this.groupHistories.update(histories => {
      if (histories[groupId]) return histories;
      return { ...histories, [groupId]: { past: [], future: [] } };
    });
  }

  private pushGroupHistory(groupId: number, snapshot: Condition[]) {
    this.ensureGroupHistory(groupId);
    const clone = this.deepCloneConditions(snapshot);
    this.groupHistories.update(histories => {
      const entry = histories[groupId];
      return {
        ...histories,
        [groupId]: {
          past: [...entry.past, clone],
          future: []
        }
      };
    });
  }

  private replaceGroupHistory(groupId: number, updater: (entry: GroupHistoryEntry) => GroupHistoryEntry | null) {
    this.groupHistories.update(histories => {
      const entry = histories[groupId];
      if (!entry) return histories;
      const updated = updater(entry);
      if (!updated) {
        const { [groupId]: _, ...rest } = histories;
        return rest;
      }
      return { ...histories, [groupId]: updated };
    });
  }

  private getGroupPast(groupId: number): Condition[][] {
    return this.groupHistories()[groupId]?.past ?? [];
  }

  private getGroupFuture(groupId: number): Condition[][] {
    return this.groupHistories()[groupId]?.future ?? [];
  }

  canUndoGroup(groupId: number): boolean {
    return this.getGroupPast(groupId).length > 0;
  }

  canRedoGroup(groupId: number): boolean {
    return this.getGroupFuture(groupId).length > 0;
  }

  undoGroupChanges(groupId: number) {
    const history = this.groupHistories()[groupId];
    if (!history || history.past.length === 0) return;

    let currentSnapshot: Condition[] | null = null;
    const snapshotToRestore = this.deepCloneConditions(history.past[history.past.length - 1]);

    this.task.update(task => {
      const groupIndex = task.conditionGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return task;
      currentSnapshot = this.deepCloneConditions(task.conditionGroups[groupIndex].conditions);

      const updatedGroups = task.conditionGroups.map((group, index) =>
        index === groupIndex ? { ...group, conditions: this.deepCloneConditions(snapshotToRestore) } : group
      );

      return { ...task, conditionGroups: updatedGroups };
    });

    if (!currentSnapshot) return;

    this.replaceGroupHistory(groupId, entry => ({
      past: entry.past.slice(0, -1),
      future: [...entry.future, currentSnapshot]
    }));
  }

  redoGroupChanges(groupId: number) {
    const history = this.groupHistories()[groupId];
    if (!history || history.future.length === 0) return;

    let currentSnapshot: Condition[] | null = null;
    const snapshotToRestore = this.deepCloneConditions(history.future[history.future.length - 1]);

    this.task.update(task => {
      const groupIndex = task.conditionGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return task;
      currentSnapshot = this.deepCloneConditions(task.conditionGroups[groupIndex].conditions);

      const updatedGroups = task.conditionGroups.map((group, index) =>
        index === groupIndex ? { ...group, conditions: this.deepCloneConditions(snapshotToRestore) } : group
      );

      return { ...task, conditionGroups: updatedGroups };
    });

    if (!currentSnapshot) return;

    this.replaceGroupHistory(groupId, entry => ({
      past: [...entry.past, currentSnapshot],
      future: entry.future.slice(0, -1)
    }));
  }

  // --- CRUD FOR CONDITIONS ---
  onAddConditionGroup() {
    let createdGroupId: number | null = null;
    this.task.update(task => {
      const allGroupIds = task.conditionGroups.map(g => g.id);
      const allConditionIds = task.conditionGroups.flatMap(g => g.conditions.map(c => c.id));
      const newGroupId = Math.max(0, ...allGroupIds, 0) + 1;
      const newConditionId = Math.max(0, ...allConditionIds, 0) + 1;

      const newCondition: Condition = {
        id: newConditionId,
        groupType: null,
        source: '',
        property: '',
        operator: '',
        value: '',
        subConditions: []
      };

      const newGroup: ConditionGroup = {
        id: newGroupId,
        conditions: [newCondition]
      };

      createdGroupId = newGroupId;
      return {...task, conditionGroups: [...task.conditionGroups, newGroup]};
    });
    // Auto-collapse the browse panel once a condition is added
    this.showBrowseSidebar.set(false);


    if (createdGroupId !== null) {
      this.ensureGroupHistory(createdGroupId);
    }
  }

  addCondition(group: ConditionGroup) {
    this.task.update(currentTask => {
      const targetGroup = currentTask.conditionGroups.find(g => g.id === group.id);
      if (!targetGroup) return currentTask;
      const previousConditions = this.deepCloneConditions(targetGroup.conditions);

      const allIds = currentTask.conditionGroups.flatMap(g =>
        g.conditions.flatMap(c =>
          [c.id, ...(c.subConditions?.map(s => s.id) ?? [])]
        )
      );
      const newConditionId = Math.max(0, ...allIds, 0) + 1;

      const newCondition: Condition = {
        id: newConditionId,
        groupType: null,
        source: '',
        property: '',
        operator: '',
        value: '',
        subConditions: []
      };
      const updatedGroup = { ...targetGroup, conditions: [...targetGroup.conditions, newCondition] };

      if (!this.areConditionArraysEqual(previousConditions, updatedGroup.conditions)) {
        this.pushGroupHistory(group.id, previousConditions);
      }

      const updatedGroups = currentTask.conditionGroups.map(g => g.id === group.id ? updatedGroup : g);
      return { ...currentTask, conditionGroups: updatedGroups };
    });
  }

  removeCondition(groupId: number, conditionId: number) {
    let groupRemoved = false;
    this.task.update(currentTask => {
      let updatedGroups = currentTask.conditionGroups.map(g => {
        if (g.id === groupId) {
          const previousConditions = this.deepCloneConditions(g.conditions);
          const remainingConditions = g.conditions.filter(c => c.id !== conditionId);

          if (remainingConditions.length === 0) {
            groupRemoved = true;
            return { ...g, conditions: remainingConditions };
          }

          if (!this.areConditionArraysEqual(previousConditions, remainingConditions)) {
            this.pushGroupHistory(groupId, previousConditions);
          }

          return { ...g, conditions: remainingConditions };
        }
        return g;
      });
       // Filter out groups that are now empty
      updatedGroups = updatedGroups.filter(g => g.conditions.length > 0);

      return { ...currentTask, conditionGroups: updatedGroups };
    });

    if (groupRemoved) {
      this.replaceGroupHistory(groupId, () => null);
    }
  }

  cloneConditionGroup(groupId: number) {
    let clonedGroupId: number | null = null;
    this.task.update(task => {
      const groupIndex = task.conditionGroups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) return task;

      const groupToClone = task.conditionGroups[groupIndex];
      let maxGroupId = Math.max(0, ...task.conditionGroups.map(g => g.id));
      let maxConditionId = Math.max(0, ...task.conditionGroups.flatMap(g =>
        g.conditions.flatMap(c => [c.id, ...(c.subConditions?.map(s => s.id) ?? [])])
      ));

      const clonedConditions = groupToClone.conditions.map(condition => {
        const newConditionId = ++maxConditionId;
        const clonedSubConditions = (condition.subConditions ?? []).map(sub => ({
          ...sub,
          id: ++maxConditionId
        }));

        return {
          ...condition,
          id: newConditionId,
          subConditions: clonedSubConditions
        };
      });

      const newGroupId = ++maxGroupId;
      clonedGroupId = newGroupId;

      const newGroup: ConditionGroup = {
        id: newGroupId,
        conditions: this.deepCloneConditions(clonedConditions)
      };

      const newGroups = [...task.conditionGroups];
      newGroups.splice(groupIndex + 1, 0, newGroup);

      return { ...task, conditionGroups: newGroups };
    });

    if (clonedGroupId !== null) {
      this.ensureGroupHistory(clonedGroupId);
    }
  }

  // --- SUB-CONDITION LOGIC ---
  showSubConditionsFor(condition: Condition): boolean {
    const config = this.getPropertyConfigForCondition(condition);
    if (!config?.subConditionProperties) {
      return false; // No sub-conditions are possible for this property.
    }

    // If no operator is selected yet, show the section to allow adding sub-conditions.
    if (!condition.operator) {
      return true;
    }

    // If an operator is selected, apply logic to see if it allows sub-conditions.
    if (condition.groupType === 'Syllabus condition') {
      return condition.operator === 'Is present';
    }

    if (condition.groupType === 'LMS Condition') {
      return true; // All operators for properties with sub-conditions are allowed.
    }

    return false; // Default to not showing.
  }

  requiresSubConditions(condition: Condition): boolean {
    const config = this.getPropertyConfigForCondition(condition);
    return !!config?.requiresSubConditions;
  }

  isSubConditionRequirementUnmet(condition: Condition): boolean {
    if (!this.requiresSubConditions(condition)) {
      return false;
    }

    const subConditions = condition.subConditions ?? [];
    if (subConditions.length === 0) {
      return true;
    }

    return subConditions.some(sub =>
      this.isSubConditionPropertyInvalid(sub) ||
      this.isOperatorInvalid(sub) ||
      this.isValueInvalid(sub)
    );
  }

  private findAndUpdateSubCondition(task: PlanTask, groupId: number, conditionId: number, subConditionId: number, updateFn: (sc: SubCondition) => SubCondition): PlanTask {
    const newGroups = task.conditionGroups.map(group => {
        if (group.id !== groupId) return group;

        const conditionIndex = group.conditions.findIndex(c => c.id === conditionId);
        if (conditionIndex === -1) return group;

        const condition = group.conditions[conditionIndex];
        const subConditionIndex = condition.subConditions?.findIndex(sc => sc.id === subConditionId);
        if (subConditionIndex === undefined || subConditionIndex === -1) return group;

        const previousConditions = this.deepCloneConditions(group.conditions);
        const newSubConditions = [...condition.subConditions!];
        newSubConditions[subConditionIndex] = updateFn(newSubConditions[subConditionIndex]);

        const newCondition = { ...condition, subConditions: newSubConditions };
        const newConditions = [...group.conditions];
        newConditions[conditionIndex] = newCondition;

        if (!this.areConditionArraysEqual(previousConditions, newConditions)) {
          this.pushGroupHistory(groupId, previousConditions);
        }

        return { ...group, conditions: newConditions };
    });

    return { ...task, conditionGroups: newGroups };
  }

  addSubCondition(conditionId: number) {
    this.task.update(task => {
      const newSubCondition = this.createEmptySubCondition(task);

      const newGroups = task.conditionGroups.map(group => {
        const conditionIndex = group.conditions.findIndex(c => c.id === conditionId);
        if (conditionIndex === -1) return group;

        const previousConditions = this.deepCloneConditions(group.conditions);
        const updatedConditions = group.conditions.map(c =>
          c.id === conditionId
            ? { ...c, subConditions: [...(c.subConditions ?? []), newSubCondition] }
            : c
        );

        if (!this.areConditionArraysEqual(previousConditions, updatedConditions)) {
          this.pushGroupHistory(group.id, previousConditions);
        }

        return { ...group, conditions: updatedConditions };
      });

      return { ...task, conditionGroups: newGroups };
    });
  }

  removeSubCondition(conditionId: number, subConditionId: number) {
    this.task.update(task => {
        const newGroups = task.conditionGroups.map(group => {
          const conditionIndex = group.conditions.findIndex(c => c.id === conditionId);
          if (conditionIndex === -1) return group;

          const previousConditions = this.deepCloneConditions(group.conditions);

          const updatedConditions = group.conditions.map(c => {
            if (c.id === conditionId) {
              let updatedSubConditions = (c.subConditions ?? []).filter(sc => sc.id !== subConditionId);

              if (this.requiresSubConditions(c) && updatedSubConditions.length === 0) {
                updatedSubConditions = [this.createEmptySubCondition(task)];
              }

              return { ...c, subConditions: updatedSubConditions };
            }
            return c;
          });

          if (!this.areConditionArraysEqual(previousConditions, updatedConditions)) {
            this.pushGroupHistory(group.id, previousConditions);
          }

          return { ...group, conditions: updatedConditions };
        });

        return { ...task, conditionGroups: newGroups };
    });
  }

  selectSubConditionProperty(groupId: number, conditionId: number, subConditionId: number, property: string) {
    this.task.update(task => this.findAndUpdateSubCondition(task, groupId, conditionId, subConditionId, sc => ({ ...sc, property, operator: '', value: '' })));
    this.activeDropdown.set(null);
  }

  selectSubConditionOperator(groupId: number, conditionId: number, subConditionId: number, operator: string) {
    this.task.update(task => this.findAndUpdateSubCondition(task, groupId, conditionId, subConditionId, sc => ({ ...sc, operator })));
    this.activeDropdown.set(null);
  }

  updateSubConditionValue(groupId: number, conditionId: number, subConditionId: number, value: any) {
    this.task.update(task => this.findAndUpdateSubCondition(task, groupId, conditionId, subConditionId, sc => ({ ...sc, value })));
  }

  selectSubConditionValue(groupId: number, conditionId: number, subConditionId: number, value: any) {
    this.updateSubConditionValue(groupId, conditionId, subConditionId, value);
    this.activeDropdown.set(null);
  }

  // --- SUB-CONDITION HELPERS FOR TEMPLATE ---
  getSubConditionPropertyOptions(condition: Condition): string[] {
    const config = this.getPropertyConfigForCondition(condition);
    return config?.subConditionProperties ? Object.keys(config.subConditionProperties) : [];
  }

  getSubConditionPropertyConfig(condition: Condition, subCondition: SubCondition): PropertyConfig | undefined {
    const mainConfig = this.getPropertyConfigForCondition(condition);
    return mainConfig?.subConditionProperties?.[subCondition.property];
  }

  getFilteredSubConditionPropertyOptions(condition: Condition): string[] {
    return this.filterOptions(this.getSubConditionPropertyOptions(condition));
  }

  getSubConditionOperatorOptions(condition: Condition, subCondition: SubCondition): string[] {
    const config = this.getSubConditionPropertyConfig(condition, subCondition);
    if (!config) return [];
    if (config.operators) return config.operators;

    switch (config.valueType) {
        case 'numeric': return NUMERIC_OPERATORS;
        case 'string': return STRING_OPERATORS;
        default: return [];
    }
  }

  getFilteredSubConditionOperatorOptions(condition: Condition, subCondition: SubCondition): string[] {
    return this.filterOptions(this.getSubConditionOperatorOptions(condition, subCondition));
  }

  getFilteredSubConditionValueOptions(condition: Condition, subCondition: SubCondition): string[] {
    const options = this.getSubConditionPropertyConfig(condition, subCondition)?.options ?? [];
    return this.filterOptions(options);
  }


  selectDisplayType(type: DisplayType) { this.task.update(task => ({ ...task, displayType: type })); }

  selectConditionResult(type: ConditionResultType) {
    if (type === 'Custom') {
      const currentResult = this.task().conditionResult;
      this.customResultName.set(currentResult.customName || '');
      this.customResultIcon.set(currentResult.icon);
      this.editingCustomResultType.set('success');
      this.showCustomResultModal.set(true);
    } else {
      this.task.update(task => ({
        ...task,
        conditionResult: { type }
      }));
    }
  }

  selectConditionFailure(type: ConditionResultType) {
    if (type === 'Custom') {
      const currentResult = this.task().conditionFailure;
      this.customResultName.set(currentResult.customName || '');
      this.customResultIcon.set(currentResult.icon);
      this.editingCustomResultType.set('failure');
      this.showCustomResultModal.set(true);
    } else {
      this.task.update(task => ({
        ...task,
        conditionFailure: { type }
      }));
    }
  }

  selectIcon(iconHtml: string) {
    this.customResultIcon.update(current => current === iconHtml ? undefined : iconHtml);
  }

  saveCustomResultName() {
    if (this.customResultName().trim()) {
      const customResult: ConditionResult = {
        type: 'Custom',
        customName: this.customResultName().trim(),
        icon: this.customResultIcon()
      };

      if (this.editingCustomResultType() === 'success') {
         this.task.update(task => ({
          ...task,
          conditionResult: customResult
        }));
      } else {
        this.task.update(task => ({
          ...task,
          conditionFailure: customResult
        }));
      }

      this.showCustomResultModal.set(false);
    }
  }

  cancelCustomResultName() {
    this.showCustomResultModal.set(false);
  }

  updateTaskName(event: Event) { this.task.update(t => ({ ...t, name: (event.target as HTMLInputElement).value })); }

  updateTaskDescription(event: Event) {
    this.task.update(t => ({ ...t, description: (event.target as HTMLInputElement).value }));
  }

  updateCustomizePassFailStatus(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.customizePassFailStatus.set(isChecked);
  }

  updateTaskAllowView(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.task.update(t => ({
      ...t,
      allowView: isChecked,
      allowEdit: isChecked ? t.allowEdit : false
    }));
  }

  updateTaskAllowEdit(event: Event) { this.task.update(t => ({ ...t, allowEdit: (event.target as HTMLInputElement).checked })); }

  updateTaskActive(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.task.update(t => ({ ...t, active: isChecked }));
  }
  saveChanges() {
    const currentTask = this.task();
    this.planAdminService.saveActiveTask(currentTask);
    console.log('Save clicked. Current task state:', currentTask);
    this.close.emit();
  }

  cancelChanges() {
    this.planAdminService.resetActiveTask();
    console.log('Cancel clicked');
    this.close.emit();
  }

  selectTestSection(id: number | null) {
    this.selectedTestSectionId.set(id);
    this.activeDropdown.set(null);
  }

  // --- MANUAL OVERRIDE METHODS ---
  setManualOverride(status: 'pass' | 'fail') {
    this.manualTestResultOverride.set(status);
    this.activeDropdown.set(null);
  }

  clearManualOverride() {
    this.manualTestResultOverride.set(null);
  }

  // --- AI BUILDER METHODS ---
  openAiBuilder() {
    this.showAiBuilderModal.set(true);
  }

  closeAiBuilder() {
    this.showAiBuilderModal.set(false);
    this.aiPrompt.set('');
    this.isGeneratingWithAi.set(false);
    this.generatedAiResult.set(null);
    this.aiError.set(null);
  }

  async generateWithAi() {
    if (!this.aiPrompt().trim()) return;

    this.isGeneratingWithAi.set(true);
    this.generatedAiResult.set(null);
    this.aiError.set(null);

    try {
      const result = await this.geminiService.generateConditionGroups(
        this.aiPrompt(),
        this.conditionOptionsConfig,
        this.dynamicValues
      );
      this.generatedAiResult.set(result);
    } catch (e: any) {
      console.error(e);
      const msg = (e && (e.message || e.error?.message)) || 'An unexpected error occurred. Please try again.';
      this.aiError.set(msg);
    } finally {
      this.isGeneratingWithAi.set(false);
    }
  }

  addAiConditions() {
    const result = this.generatedAiResult();
    if (!result || !result.isValidRequest || !result.conditionGroups) return;

    this.task.update(task => {
      let maxGroupId = Math.max(0, ...task.conditionGroups.map(g => g.id));
      let maxConditionId = Math.max(0, ...task.conditionGroups.flatMap(g => g.conditions.flatMap(c => [c.id, ...(c.subConditions?.map(s => s.id) ?? [])])));

      const newGroups: ConditionGroup[] = result.conditionGroups!.map((group: any) => {
        maxGroupId++;
        const newConditions = group.conditions.map((condition: any) => {
            maxConditionId++;
            const newSubConditions = (condition.subConditions || []).map((sub: any) => {
                maxConditionId++;
                return { ...sub, id: maxConditionId };
            });
            return { ...condition, id: maxConditionId, subConditions: newSubConditions };
        });
        return { id: maxGroupId, conditions: newConditions };
      });

      const newName = !task.name.trim() && result.taskName ? result.taskName : task.name;

      return {
          ...task,
          name: newName,
          conditionGroups: [...task.conditionGroups, ...newGroups]
      };
    });

    this.closeAiBuilder();
  }


  private getPrimaryValidationContextLabel(task: PlanTask): ValidationContextLabel {
    const groupTypes = new Set<ConditionGroupType>();

    for (const group of task.conditionGroups) {
      for (const condition of group.conditions) {
        if (condition.groupType) {
          groupTypes.add(condition.groupType);
        }
      }
    }

    if (groupTypes.size === 0) {
      return 'Mixed';
    }

    if (groupTypes.size > 1) {
      return 'Mixed';
    }

    const [type] = Array.from(groupTypes);
    switch (type) {
      case 'Syllabus condition':
        return 'Syllabus';
      case 'LMS Condition':
        return 'LMS';
      case 'Attribute condition':
        return 'Attribute';
      default:
        return 'Mixed';
    }
  }

  private getValidationContextName(label: ValidationContextLabel, section: TestSection): string {
    switch (label) {
      case 'LMS':
        return `${section.name} LMS`;
      default:
        return section.name;
    }
  }

  validationContextEntries = computed<ValidationContextEntry[]>(() => {
    if (!this.validationContextEnabled()) {
      return [];
    }

    const currentTask = this.task();

    if (currentTask.conditionGroups.length === 0) {
      return [];
    }

    if (this.hasInvalidConditionConfiguration(currentTask)) {
      return [];
    }

    const label = this.getPrimaryValidationContextLabel(currentTask);
    const sections = this.testSections();
    const entries: ValidationContextEntry[] = [];

    for (const section of sections) {
      const evaluation = this.evaluationService.evaluate(currentTask, section);
      if (!evaluation) {
        continue;
      }

      entries.push({
        id: `${label}-${section.id}`,
        name: this.getValidationContextName(label, section),
        passes: evaluation.passes,
        label,
        section,
        result: evaluation,
      });
    }

    return entries;
  });

  filteredValidationContextEntries = computed(() => {
    const mode = this.validationContextMode();
    return this.validationContextEntries().filter(entry => (mode === 'pass' ? entry.passes : !entry.passes));
  });

  validationContextTotalEntries = computed(() => this.filteredValidationContextEntries().length);
  validationContextCurrentStart = computed(() => {
    const page = this.validationContextPageIndex();
    return page * this.PAGE_SIZE;
  });
  visibleValidationContextEntries = computed(() => {
    const start = this.validationContextCurrentStart();
    return this.filteredValidationContextEntries().slice(start, start + this.PAGE_SIZE);
  });
  validationContextRangeLabel = computed(() => {
    const total = this.validationContextTotalEntries();
    if (total === 0) return '0 of 0';
    const start = this.validationContextCurrentStart();
    const end = Math.min(start + this.PAGE_SIZE, total);
    return `${start + 1}-${end} of ${total}`;
  });

  currentPrepStepEntry = computed(() => {
    const entries = this.filteredValidationContextEntries();
    if (entries.length === 0) {
      return null;
    }
    const activeId = this.prepStepActiveEntryId();
    if (activeId) {
      const found = entries.find(entry => entry.id === activeId);
      if (found) {
        return found;
      }
    }
    return entries[0];
  });

  private currentPrepStepIndex(): number {
    const entries = this.filteredValidationContextEntries();
    if (entries.length === 0) return -1;
    const activeId = this.prepStepActiveEntryId();
    const index = activeId ? entries.findIndex(entry => entry.id === activeId) : 0;
    return index >= 0 ? index : 0;
  }

  currentPrepStepAttributes = computed(() => {
    const base = this.prepStepBaseAttributes();
    const edits = this.prepStepEdits();
    return base.map(attr => ({ ...attr, value: edits[attr.key] ?? attr.value }));
  });

  toggleValidationContext(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    this.validationContextEnabled.set(enabled);
    if (!enabled) {
      this.showPrepStepsModal.set(false);
    }
    this.validationContextPageIndex.set(0);
    if (this.showPrepStepsModal()) {
      this.initializePrepStepEditsForIndex(0);
    } else {
      this.prepStepBaseAttributes.set([]);
      this.prepStepEdits.set({});
      this.prepStepActiveEntryId.set(null);
    }
  }

  setValidationContextMode(mode: ValidationContextMode) {
    this.validationContextMode.set(mode);
    this.validationContextPageIndex.set(0);
    if (this.showPrepStepsModal()) {
      this.initializePrepStepEditsForIndex(0);
    } else {
      this.prepStepBaseAttributes.set([]);
      this.prepStepEdits.set({});
      this.prepStepActiveEntryId.set(null);
    }
  }

  goToNextValidationPage() {
    const total = this.validationContextTotalEntries();
    if (total === 0) return;
    const page = this.validationContextPageIndex();
    const maxPage = Math.max(0, Math.ceil(total / this.PAGE_SIZE) - 1);
    if (page < maxPage) {
      const newPage = page + 1;
      this.validationContextPageIndex.set(newPage);
      const start = newPage * this.PAGE_SIZE;
      if (this.showPrepStepsModal()) {
        this.initializePrepStepEditsForIndex(start);
      } else {
        this.prepStepBaseAttributes.set([]);
        this.prepStepEdits.set({});
        this.prepStepActiveEntryId.set(null);
      }
    }
  }

  goToPreviousValidationPage() {
    const page = this.validationContextPageIndex();
    if (page > 0) {
      const newPage = page - 1;
      this.validationContextPageIndex.set(newPage);
      const start = newPage * this.PAGE_SIZE;
      if (this.showPrepStepsModal()) {
        this.initializePrepStepEditsForIndex(start);
      } else {
        this.prepStepBaseAttributes.set([]);
        this.prepStepEdits.set({});
        this.prepStepActiveEntryId.set(null);
      }
    }
  }

  openPrepStepModal(entry: ValidationContextEntry) {
    const entries = this.filteredValidationContextEntries();
    const index = entries.findIndex(e => e.id === entry.id);
    if (index >= 0) {
      this.initializePrepStepEditsForIndex(index);
    } else {
      this.initializePrepStepEditsForIndex(0);
    }
    this.showPrepStepsModal.set(true);
  }

  closePrepStepModal() {
    this.showPrepStepsModal.set(false);
    this.prepStepBaseAttributes.set([]);
    this.prepStepEdits.set({});
    this.prepStepActiveEntryId.set(null);
  }

  nextPrepStepEntry() {
    const entries = this.filteredValidationContextEntries();
    if (entries.length === 0) {
      return;
    }
    const currentIndex = this.currentPrepStepIndex();
    const newIndex = (currentIndex + 1) % entries.length;
    this.initializePrepStepEditsForIndex(newIndex);
  }

  previousPrepStepEntry() {
    const entries = this.filteredValidationContextEntries();
    if (entries.length === 0) {
      return;
    }
    const currentIndex = this.currentPrepStepIndex();
    const newIndex = (currentIndex - 1 + entries.length) % entries.length;
    this.initializePrepStepEditsForIndex(newIndex);
  }

  updatePrepStepEdit(key: string, value: string) {
    this.prepStepEdits.update(current => ({ ...current, [key]: value }));
  }

  private initializePrepStepEditsForIndex(index: number) {
    const entries = this.filteredValidationContextEntries();
    if (entries.length === 0) {
      this.prepStepEdits.set({});
      this.prepStepActiveEntryId.set(null);
      return;
    }
    const safeIndex = Math.min(Math.max(index, 0), entries.length - 1);
    const entry = entries[safeIndex];
    this.validationContextPageIndex.set(Math.floor(safeIndex / this.PAGE_SIZE));
    this.prepStepActiveEntryId.set(entry.id);
    const baseAttributes = this.buildPrepStepAttributes(entry.section);
    this.prepStepBaseAttributes.set(baseAttributes);
    const record: Record<string, string> = {};
    for (const attr of baseAttributes) {
      record[attr.key] = attr.value;
    }
    this.prepStepEdits.set(record);
  }

  private buildPrepStepAttributes(section: TestSection): { label: string; value: string; key: string }[] {
    if (!section) {
      return [];
    }
    const format = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    };
    const attributes: { label: string; value: string; key: string }[] = [
      { label: 'Section Name', value: format(section.name), key: 'name' },
      { label: 'Term', value: format(section.term), key: 'term' },
      { label: 'Publish State', value: format(section.publishState), key: 'publishState' },
      { label: 'Status', value: format(section.status), key: 'status' },
      { label: 'Material Count', value: format(section.materialCount), key: 'materialCount' },
      { label: 'Completed Date', value: section.completedDate ? new Date(section.completedDate).toLocaleString() : 'Not Completed', key: 'completedDate' },
      { label: 'Attribute Credit Hours', value: format(section.attributeCreditHours), key: 'attributeCreditHours' },
    ];

    if (section.components.length > 0) {
      attributes.push({
        label: 'Components',
        value: section.components.map(component => component.name).join(', '),
        key: 'components'
      });
    }

    if (section.lmsAssignments.length > 0) {
      attributes.push({
        label: 'LMS Assignments',
        value: section.lmsAssignments.map(assignment => assignment.name).join(', '),
        key: 'lmsAssignments'
      });
    }

    return attributes;
  }

  // --- VALIDATION ---
  private hasInvalidConditionConfiguration(task: PlanTask): boolean {
    for (const group of task.conditionGroups) {
      for (const condition of group.conditions) {
        if (
          this.isGroupTypeInvalid(condition) ||
          this.isSourceInvalid(condition) ||
          this.isPropertyInvalid(condition) ||
          this.isOperatorInvalid(condition) ||
          this.isValueInvalid(condition)
        ) {
          return true;
        }

        const subConditions = condition.subConditions ?? [];

        if (this.requiresSubConditions(condition) && subConditions.length === 0) {
          return true;
        }

        if (subConditions.length > 0) {
          for (const sub of subConditions) {
            if (
              this.isSubConditionPropertyInvalid(sub) ||
              this.isOperatorInvalid(sub) ||
              this.isValueInvalid(sub)
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  isFormInvalid = computed(() => {
    const currentTask = this.task();
    if (!currentTask.name.trim()) {
      return true;
    }

    return this.hasInvalidConditionConfiguration(currentTask);
  });

  isGroupTypeInvalid(condition: Condition): boolean {
    return !condition.groupType;
  }

  isSourceInvalid(condition: Condition): boolean {
    return !!condition.groupType && !condition.source;
  }

  isPropertyInvalid(condition: Condition): boolean {
    return !!condition.source && !condition.property;
  }

  isSubConditionPropertyInvalid(subCondition: SubCondition): boolean {
    // For sub-conditions, property is always required if the sub-condition exists.
    return !subCondition.property;
  }

  isOperatorInvalid(condition: Condition | SubCondition): boolean {
    return !!condition.property && !condition.operator;
  }

  isValueInvalid(condition: Condition | SubCondition): boolean {
    const value = condition.value;
    const isValueMissing = value === '' || value === null || value === undefined;
    return this.doesOperatorRequireValue(condition.operator) && isValueMissing;
  }

  private cloneTask(task: PlanTask): PlanTask {
    return JSON.parse(JSON.stringify(task));
  }
}
