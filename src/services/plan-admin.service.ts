import { Injectable, computed, signal, inject } from '@angular/core';
import { PlanTask } from '../plan-task.types';
import { PlanAdminPlan, PlanAdminTask } from '../plan-admin.types';
import { DocumentService } from './document.service';

const DEFAULT_TERM_FALLBACK = 'Fall 2025';
const DEFAULT_ASSIGNEE_NAMES = ['Plan Owner', 'Review Lead', 'Data Analyst'];

const clonePlanTask = (task: PlanTask): PlanTask => JSON.parse(JSON.stringify(task));

const clonePlanEntry = (entry: PlanAdminTask): PlanAdminTask => ({
  ...entry,
  task: clonePlanTask(entry.task),
  assignments: entry.assignments.map(assignment => ({ ...assignment })),
});

const clonePlan = (plan: PlanAdminPlan): PlanAdminPlan => ({
  ...plan,
  assignees: plan.assignees.map(assignee => ({ ...assignee })),
  tasks: plan.tasks.map(clonePlanEntry),
});

const INITIAL_PLAN_ADMIN_TASKS: PlanAdminTask[] = [
  {
    task: {
      id: 101,
      term: 'Fall 2025',
      name: 'Syllabi published before term start',
      description: 'Confirm every syllabus is published and includes required components ahead of the term start.',
      conditionGroups: [
        {
          id: 1,
          conditions: [
            {
              id: 1,
              groupType: 'Syllabus condition',
              source: 'Syllabus Details',
              property: 'Publish State',
              operator: 'Is',
              value: 'Published',
            },
            {
              id: 2,
              groupType: 'Syllabus condition',
              source: 'Syllabus Details',
              property: 'Material count',
              operator: 'Is greater than or equal to',
              value: 3,
            },
          ],
        },
        {
          id: 2,
          conditions: [
            {
              id: 3,
              groupType: 'LMS Condition',
              source: 'Assignments',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 3,
              subConditions: [
                { id: 1, property: 'Publish State', operator: 'Is', value: 'Published' },
                { id: 2, property: 'Graded', operator: 'Is', value: 'Graded' },
              ],
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Action needed', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Syllabus readiness',
    owner: 'Academic Initiatives',
    lastUpdated: '2025-06-05T14:30:00Z',
    assignments: [
      { id: 1, name: 'Upload final syllabus PDF', owner: 'Instructional Designer', status: 'In Progress', dueDate: '2025-08-12' },
      { id: 2, name: 'Annotate missing components', owner: 'Curriculum Team', status: 'Not Started', dueDate: '2025-08-14' },
      { id: 3, name: 'Confirm LMS publish state', owner: 'Program Lead', status: 'Complete', dueDate: '2025-08-16' },
    ],
  },
  {
    task: {
      id: 102,
      term: 'Fall 2025',
      name: 'Assessment artifacts uploaded',
      description: 'Ensure assessment evidence is in place for accreditation sampling.',
      conditionGroups: [
        {
          id: 3,
          conditions: [
            {
              id: 4,
              groupType: 'Syllabus condition',
              source: 'Component by name',
              property: 'Required materials',
              operator: 'Is present',
              value: null,
              subConditions: [
                { id: 3, property: 'Required', operator: 'Is', value: 'Required' },
                { id: 4, property: 'Field - Title', operator: 'Is not empty', value: '' },
              ],
            },
            {
              id: 5,
              groupType: 'Syllabus condition',
              source: 'Component by name',
              property: 'Optional materials',
              operator: 'Is present',
              value: null,
            },
          ],
        },
        {
          id: 4,
          conditions: [
            {
              id: 6,
              groupType: 'LMS Condition',
              source: 'Assignments',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 2,
              subConditions: [
                { id: 5, property: 'Publish State', operator: 'Is', value: 'Published' },
                { id: 6, property: 'Rubric', operator: 'Is', value: 'Used' },
              ],
            },
          ],
        },
      ],
      displayType: 'Number',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Missing artifacts', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Assessment readiness',
    owner: 'Assessment Office',
    lastUpdated: '2025-05-28T16:22:00Z',
    assignments: [
      { id: 4, name: 'Compile sample artifacts', owner: 'Assessment Coordinator', status: 'In Progress', dueDate: '2025-07-01' },
      { id: 5, name: 'Upload rubric alignment', owner: 'Program Lead', status: 'Not Started', dueDate: '2025-07-08' },
    ],
  },
  {
    task: {
      id: 103,
      term: 'Fall 2025',
      name: 'Assurance of Learning data ready',
      description: 'Data collection thresholds met for AoL reporting.',
      conditionGroups: [
        {
          id: 5,
          conditions: [
            {
              id: 7,
              groupType: 'Syllabus condition',
              source: 'Syllabus Details',
              property: 'Status',
              operator: 'Is',
              value: 'Completed',
            },
            {
              id: 8,
              groupType: 'Syllabus condition',
              source: 'Syllabus Details',
              property: 'Objective count',
              operator: 'Is greater than or equal to',
              value: 3,
            },
          ],
        },
        {
          id: 6,
          conditions: [
            {
              id: 9,
              groupType: 'LMS Condition',
              source: 'Assignments',
              property: 'Total Percent',
              operator: 'Is greater than or equal to',
              value: 60,
              subConditions: [
                { id: 7, property: 'Publish State', operator: 'Is', value: 'Published' },
                { id: 8, property: 'Graded', operator: 'Is', value: 'Graded' },
              ],
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Fail', customName: 'Data incomplete', icon: 'dangerous' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Assessment readiness',
    owner: 'AoL Committee',
    lastUpdated: '2025-05-18T12:15:00Z',
    assignments: [
      { id: 6, name: 'Collect AoL results', owner: 'Assessment Analyst', status: 'Not Started', dueDate: '2025-08-01' },
      { id: 7, name: 'Review threshold with dean', owner: 'Academic Initiatives', status: 'Not Started', dueDate: null },
    ],
  },
  {
    task: {
      id: 104,
      term: 'Fall 2025',
      name: 'Faculty credentials validated',
      description: 'Confirm faculty credentials are documented for assigned sections.',
      conditionGroups: [
        {
          id: 7,
          conditions: [
            {
              id: 10,
              groupType: 'Syllabus condition',
              source: 'Component by name',
              property: 'Instructor Information',
              operator: 'Is present',
              value: null,
              subConditions: [
                { id: 9, property: 'Field - Name', operator: 'Is not empty', value: '' },
                { id: 10, property: 'Field - Instructor Photo', operator: 'Is empty', value: '' },
              ],
            },
          ],
        },
        {
          id: 8,
          conditions: [
            {
              id: 11,
              groupType: 'Attribute condition',
              source: 'Course',
              property: 'Credit hours',
              operator: 'Is greater than or equal to',
              value: 3,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Credentials review needed', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Compliance',
    owner: 'Faculty Affairs',
    lastUpdated: '2025-05-10T09:00:00Z',
    assignments: [
      { id: 8, name: 'Verify faculty CVs', owner: 'HR Coordinator', status: 'In Progress', dueDate: '2025-07-15' },
      { id: 9, name: 'Finalize credential audit', owner: 'Faculty Affairs', status: 'Not Started', dueDate: '2025-08-05' },
    ],
  },
  {
    task: {
      id: 105,
      term: 'Spring 2026',
      name: 'Orientation modules published',
      description: 'All spring sections publish a welcome/orientation module one week before start date.',
      conditionGroups: [
        {
          id: 9,
          conditions: [
            {
              id: 12,
              groupType: 'LMS Condition',
              source: 'Modules',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 1,
              subConditions: [
                { id: 11, property: 'Name', operator: 'Contains', value: 'Orientation' },
                { id: 12, property: 'Publish State', operator: 'Is', value: 'Published' },
              ],
            },
          ],
        },
        {
          id: 10,
          conditions: [
            {
              id: 13,
              groupType: 'Attribute condition',
              source: 'Section',
              property: 'Delivery method',
              operator: 'Is',
              value: 'Online',
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Module missing', icon: 'event_busy' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Student readiness',
    owner: 'Instructional Design',
    lastUpdated: '2025-05-01T10:45:00Z',
    assignments: [
      { id: 10, name: 'Provide welcome template', owner: 'Instructional Design', status: 'Complete', dueDate: '2025-04-15' },
      { id: 11, name: 'Audit unpublished modules', owner: 'Online Programs', status: 'In Progress', dueDate: '2025-12-12' },
    ],
  },
];

const COURSE_READINESS_PLAN_TASKS: PlanAdminTask[] = [
  {
    task: {
      id: 201,
      term: 'Fall 2025',
      name: 'Welcome announcements posted',
      description: 'Ensure every course publishes a welcome announcement before classes begin.',
      conditionGroups: [
        {
          id: 2011,
          conditions: [
            {
              id: 20101,
              groupType: 'LMS Condition',
              source: 'Announcements',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 1,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Announcement missing', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Student readiness',
    owner: 'Center for Teaching',
    lastUpdated: '2025-05-20T09:15:00Z',
    assignments: [
      { id: 20101, name: 'Audit welcome message status', owner: 'Center for Teaching', status: 'In Progress', dueDate: '2025-07-22' },
    ],
  },
  {
    task: {
      id: 202,
      term: 'Fall 2025',
      name: 'LMS gradebook configured',
      description: 'Confirm gradebook categories align to syllabus assessments.',
      conditionGroups: [
        {
          id: 2021,
          conditions: [
            {
              id: 20201,
              groupType: 'LMS Condition',
              source: 'Assignments',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 5,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Gradebook review needed', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Quality assurance',
    owner: 'LMS Support',
    lastUpdated: '2025-05-18T14:00:00Z',
    assignments: [
      { id: 20102, name: 'Spot-check gradebook templates', owner: 'LMS Support', status: 'Not Started', dueDate: '2025-08-05' },
    ],
  },
];

const FIRST_YEAR_EXPERIENCE_PLAN_TASKS: PlanAdminTask[] = [
  {
    task: {
      id: 301,
      term: 'Fall 2025',
      name: 'Success coaches assigned',
      description: 'Assign first-year success coaches to every incoming student cohort.',
      conditionGroups: [
        {
          id: 3011,
          conditions: [
            {
              id: 30101,
              groupType: 'Attribute condition',
              source: 'Student',
              property: 'Coach assigned',
              operator: 'Is',
              value: 'Yes',
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Coach missing', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Student success',
    owner: 'Student Success Office',
    lastUpdated: '2025-04-28T11:05:00Z',
    assignments: [
      { id: 30101, name: 'Finalize coach roster', owner: 'Student Success Office', status: 'Complete', dueDate: '2025-05-15' },
      { id: 30102, name: 'Notify academic advisors', owner: 'Advising Center', status: 'In Progress', dueDate: '2025-07-01' },
    ],
  },
  {
    task: {
      id: 302,
      term: 'Spring 2026',
      name: 'Orientation modules refreshed',
      description: 'Update orientation modules with new campus resources and deadlines.',
      conditionGroups: [
        {
          id: 3021,
          conditions: [
            {
              id: 30201,
              groupType: 'LMS Condition',
              source: 'Modules',
              property: 'Total Count',
              operator: 'Is greater than or equal to',
              value: 3,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Content refresh needed', icon: 'event_busy' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Engagement',
    owner: 'Orientation Team',
    lastUpdated: '2025-05-12T08:45:00Z',
    assignments: [
      { id: 30103, name: 'Collect new student testimonials', owner: 'Orientation Team', status: 'Not Started', dueDate: '2025-11-15' },
    ],
  },
];

const GENERAL_EDUCATION_PLAN_TASKS: PlanAdminTask[] = [
  {
    task: {
      id: 401,
      term: 'Fall 2025',
      name: 'Outcomes mapped to core courses',
      description: 'Verify each general education course aligns to at least one learning outcome.',
      conditionGroups: [
        {
          id: 4011,
          conditions: [
            {
              id: 40101,
              groupType: 'Attribute condition',
              source: 'Course',
              property: 'Outcome mappings',
              operator: 'Is greater than or equal to',
              value: 1,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Mapping required', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Assessment',
    owner: 'Gen Ed Committee',
    lastUpdated: '2025-04-30T10:30:00Z',
    assignments: [
      { id: 40101, name: 'Review learning outcome catalog', owner: 'Gen Ed Committee', status: 'In Progress', dueDate: '2025-06-10' },
    ],
  },
  {
    task: {
      id: 402,
      term: 'Fall 2025',
      name: 'Signature assignments identified',
      description: 'Document signature assignments for each area of inquiry.',
      conditionGroups: [
        {
          id: 4021,
          conditions: [
            {
              id: 40201,
              groupType: 'Syllabus condition',
              source: 'Component by name',
              property: 'Program outcomes',
              operator: 'Is present',
              value: null,
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Assignment missing', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Curriculum',
    owner: 'Gen Ed Committee',
    lastUpdated: '2025-05-08T15:25:00Z',
    assignments: [
      { id: 40102, name: 'Collect exemplars from departments', owner: 'Curriculum Council', status: 'Not Started', dueDate: '2025-09-01' },
    ],
  },
];

const INSTRUCTIONAL_MATERIALS_PLAN_TASKS: PlanAdminTask[] = [
  {
    task: {
      id: 501,
      term: 'Spring 2026',
      name: 'All materials ordered',
      description: 'Confirm instructional materials are ordered ahead of the upcoming term.',
      conditionGroups: [
        {
          id: 5011,
          conditions: [
            {
              id: 50101,
              groupType: 'Attribute condition',
              source: 'Course',
              property: 'Material status',
              operator: 'Is',
              value: 'Ordered',
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Order pending', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Procurement',
    owner: 'Materials Management',
    lastUpdated: '2025-05-02T13:00:00Z',
    assignments: [
      { id: 50101, name: 'Review outstanding purchase requests', owner: 'Materials Management', status: 'In Progress', dueDate: '2025-12-05' },
    ],
  },
  {
    task: {
      id: 502,
      term: 'Spring 2026',
      name: 'Inclusive access titles confirmed',
      description: 'Verify inclusive access negotiations are complete for bundled materials.',
      conditionGroups: [
        {
          id: 5021,
          conditions: [
            {
              id: 50201,
              groupType: 'Attribute condition',
              source: 'Course',
              property: 'Inclusive access',
              operator: 'Is',
              value: 'Complete',
            },
          ],
        },
      ],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Warning', customName: 'Vendor update needed', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    },
    category: 'Procurement',
    owner: 'Materials Management',
    lastUpdated: '2025-04-21T16:50:00Z',
    assignments: [
      { id: 50102, name: 'Coordinate with bookstore vendor', owner: 'Bookstore Team', status: 'Not Started', dueDate: '2025-11-18' },
    ],
  },
];

const ACCREDITATION_PLAN_ASSIGNEES = [
  { id: 1, name: 'Lydia Patel' },
  { id: 2, name: 'Marcus Flynn' },
  { id: 3, name: 'Jessie Chen' },
];

const COURSE_READINESS_PLAN_ASSIGNEES = [
  { id: 4, name: 'Taylor Morgan' },
  { id: 5, name: 'Owen Castillo' },
  { id: 6, name: 'Priya Shah' },
];

const FIRST_YEAR_PLAN_ASSIGNEES = [
  { id: 7, name: 'Jordan Blake' },
  { id: 8, name: 'Maya Jennings' },
  { id: 9, name: 'Elena Ruiz' },
];

const GENERAL_EDUCATION_PLAN_ASSIGNEES = [
  { id: 10, name: 'Gabriel Stone' },
  { id: 11, name: 'Rina Cho' },
  { id: 12, name: 'Samir Khan' },
];

const INSTRUCTIONAL_MATERIALS_PLAN_ASSIGNEES = [
  { id: 13, name: 'Daphne Lee' },
  { id: 14, name: 'Robert Mills' },
  { id: 15, name: 'Alexis Fowler' },
];

const INITIAL_PLANS: PlanAdminPlan[] = [
  {
    id: 1,
    name: 'Accreditation (AACSB)',
    description: 'This plan helps ensure course materials reflect approved outcomes and that the school can easily collect evidence for accreditation reviews.',
    owner: 'Accreditation Steering Team',
    assignees: ACCREDITATION_PLAN_ASSIGNEES,
    tasks: INITIAL_PLAN_ADMIN_TASKS,
    isActive: true,
  },
  {
    id: 2,
    name: 'Course Readiness',
    description: 'This plan will evaluate courses campus wide for their readiness for the first day of class and student success.',
    owner: 'Teaching & Learning Hub',
    assignees: COURSE_READINESS_PLAN_ASSIGNEES,
    tasks: COURSE_READINESS_PLAN_TASKS,
    isActive: true,
  },
  {
    id: 3,
    name: 'First-Year Experience',
    description: 'This plan proves that Simple Prep can directly support student success and retention initiatives.',
    owner: 'First-Year Programs',
    assignees: FIRST_YEAR_PLAN_ASSIGNEES,
    tasks: FIRST_YEAR_EXPERIENCE_PLAN_TASKS,
    isActive: true,
  },
  {
    id: 4,
    name: 'General Education',
    description: 'This plan helps validate if a course is meeting the regulatory requirements for General Education.',
    owner: 'General Education Council',
    assignees: GENERAL_EDUCATION_PLAN_ASSIGNEES,
    tasks: GENERAL_EDUCATION_PLAN_TASKS,
    isActive: true,
  },
  {
    id: 5,
    name: 'Instructional Materials (Currently Developing)',
    description: 'Checking to make sure course materials are set for courses and have been procured.',
    owner: 'Materials Management',
    assignees: INSTRUCTIONAL_MATERIALS_PLAN_ASSIGNEES,
    tasks: INSTRUCTIONAL_MATERIALS_PLAN_TASKS,
    isActive: false,
  },
];

@Injectable({ providedIn: 'root' })
export class PlanAdminService {
  private documentService = inject(DocumentService);

  private plansState = signal<PlanAdminPlan[]>(INITIAL_PLANS.map(plan => clonePlan(plan)));
  plans = this.plansState.asReadonly();

  private selectedPlanIdState = signal<number | null>(null);
  private selectedTermState = signal<string>(this.fallbackTermFromDocumentService());
  private taskSortState = signal<{ key: 'name' | 'source' | 'display'; direction: 'asc' | 'desc' } | null>(null);

  activeTask = signal<PlanTask | null>(null);
  private activeTaskBaseline = signal<PlanTask | null>(null);
  private activeTaskPlanId = signal<number | null>(null);

  selectedPlan = computed(() => {
    const planId = this.selectedPlanIdState();
    if (planId === null) {
      return null;
    }
    return this.plansState().find(plan => plan.id === planId) ?? null;
  });

  selectedTerm = this.selectedTermState.asReadonly();

  termOptions = computed(() => {
    const { Future, Current, Historic } = this.documentService.termsByGroup();
    return [...Future, ...Current, ...Historic];
  });

  tasks = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) {
      return [];
    }

    const currentTerm = this.selectedTermState();
    const sort = this.taskSortState();
    const matching = plan.tasks.filter(entry => entry.task.term === currentTerm);

    if (!sort) {
      return matching;
    }

    const sorted = [...matching].sort((a, b) => {
      let aValue = '';
      let bValue = '';

      if (sort.key === 'name') {
        aValue = a.task.name;
        bValue = b.task.name;
      } else if (sort.key === 'display') {
        aValue = a.task.displayType;
        bValue = b.task.displayType;
      } else {
        aValue = this.getSources(a).join(', ');
        bValue = this.getSources(b).join(', ');
      }

      return sort.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

    return sorted;
  });

  selectPlan(planId: number) {
    const match = this.plansState().find(plan => plan.id === planId);
    if (!match) {
      return;
    }

    const previousTerm = this.selectedTermState();
    const term = match.tasks.some(entry => entry.task.term === previousTerm)
      ? previousTerm
      : this.getDefaultTermForPlan(planId);

    this.selectedPlanIdState.set(planId);
    this.selectedTermState.set(term);
    this.clearActiveTask();
  }

  clearSelectedPlan() {
    this.selectedPlanIdState.set(null);
    this.selectedTermState.set(this.fallbackTermFromDocumentService());
    this.clearActiveTask();
  }

  updateSelectedPlanName(name: string) {
    const normalized = name.trim() ? name : 'Untitled Plan';
    this.withSelectedPlan(plan => {
      plan.name = normalized;
    });
  }

  updateSelectedPlanDescription(description: string) {
    this.withSelectedPlan(plan => {
      plan.description = description;
    });
  }

  setSelectedPlanActive(isActive: boolean) {
    this.withSelectedPlan(plan => {
      plan.isActive = isActive;
    });
  }

  createPlan() {
    const newPlanId = this.getNextPlanId();
    const newPlan: PlanAdminPlan = {
      id: newPlanId,
      name: 'Untitled Plan',
      description: 'Add a short summary to guide collaborators.',
      owner: 'Plan Admin Team',
      assignees: this.generateDefaultAssignees(newPlanId),
      tasks: [],
      isActive: true,
    };

    this.plansState.update(plans => [clonePlan(newPlan), ...plans]);
    this.selectPlan(newPlanId);
    return newPlanId;
  }

  deletePlan(planId: number) {
    const wasSelected = this.selectedPlanIdState() === planId;
    this.plansState.update(plans => plans.filter(plan => plan.id !== planId));

    if (!wasSelected) {
      return;
    }

    const remaining = this.plansState();
    if (remaining.length === 0) {
      this.clearSelectedPlan();
      return;
    }

    const fallbackPlan = remaining[0];
    this.selectedPlanIdState.set(fallbackPlan.id);
    this.selectedTermState.set(this.getDefaultTermForPlan(fallbackPlan.id));
    this.clearActiveTask();
  }

  selectTerm(term: string) {
    const options = this.termOptions();
    if (!options.includes(term)) {
      return;
    }
    this.selectedTermState.set(term);
  }

  sortTasks(key: 'name' | 'source' | 'display', direction: 'asc' | 'desc') {
    this.taskSortState.set({ key, direction });
  }

  createTask(preferredTerm?: string) {
    const planId = this.selectedPlanIdState();
    if (planId === null) {
      return null;
    }

    const targetTerm = preferredTerm?.trim() || this.selectedTermState() || this.getDefaultTermForPlan(planId);
    const newTask: PlanTask = {
      id: this.getNextTaskId(),
      term: targetTerm,
      name: 'New task',
      description: '',
      conditionGroups: [],
      displayType: 'Yes/No',
      conditionResult: { type: 'Pass' },
      conditionFailure: { type: 'Fail', customName: 'Needs review', icon: 'report' },
      allowView: true,
      allowEdit: true,
      active: true,
    };

    const entry: PlanAdminTask = {
      task: clonePlanTask(newTask),
      category: 'Uncategorized',
      owner: 'Plan Admin Team',
      lastUpdated: new Date().toISOString(),
      assignments: [],
    };

    this.updatePlan(planId, plan => {
      plan.tasks = [...plan.tasks, entry];
    });
    this.selectedTermState.set(targetTerm);
    this.setActiveTask(newTask.id, planId);
    return newTask.id;
  }

  deleteTask(taskId: number) {
    const planId = this.selectedPlanIdState();
    if (planId === null) {
      return;
    }

    this.updatePlan(planId, plan => {
      plan.tasks = plan.tasks.filter(entry => entry.task.id !== taskId);
    });

    if (this.activeTask()?.id === taskId) {
      this.clearActiveTask();
    }
  }

  setActiveTask(taskId: number, planId?: number) {
    if (typeof planId === 'number' && planId !== this.selectedPlanIdState()) {
      this.selectPlan(planId);
    }

    const plan = this.selectedPlan();
    if (!plan) {
      return;
    }

    const match = plan.tasks.find(entry => entry.task.id === taskId);
    if (!match) {
      return;
    }

    const clone = clonePlanTask(match.task);
    this.activeTask.set(clone);
    this.activeTaskBaseline.set(clonePlanTask(match.task));
    this.activeTaskPlanId.set(plan.id);
  }

  clearActiveTask() {
    this.activeTask.set(null);
    this.activeTaskBaseline.set(null);
    this.activeTaskPlanId.set(null);
  }

  saveActiveTask(updated: PlanTask) {
    const planId = this.activeTaskPlanId() ?? this.selectedPlanIdState();
    if (planId === null) {
      return;
    }

    let found = false;
    const timestamp = new Date().toISOString();

    this.updatePlan(planId, plan => {
      plan.tasks = plan.tasks.map(entry => {
        if (entry.task.id === updated.id) {
          found = true;
          return {
            ...entry,
            task: clonePlanTask(updated),
            lastUpdated: timestamp,
          };
        }
        return entry;
      });

      if (!found) {
        plan.tasks = [
          ...plan.tasks,
          {
            task: clonePlanTask(updated),
            category: 'Uncategorized',
            owner: 'Plan Admin Team',
            lastUpdated: timestamp,
            assignments: [],
          },
        ];
      }
    });

    this.activeTaskBaseline.set(clonePlanTask(updated));
    this.activeTask.set(clonePlanTask(updated));
    this.activeTaskPlanId.set(planId);
    this.selectedTermState.set(updated.term);
  }

  resetActiveTask() {
    const baseline = this.activeTaskBaseline();
    this.activeTask.set(baseline ? clonePlanTask(baseline) : null);
  }

  private withSelectedPlan(mutator: (plan: PlanAdminPlan) => void) {
    const planId = this.selectedPlanIdState();
    if (planId === null) {
      return;
    }
    this.updatePlan(planId, mutator);
  }

  private updatePlan(planId: number, mutator: (plan: PlanAdminPlan) => void) {
    this.plansState.update(plans => plans.map(plan => {
      if (plan.id !== planId) {
        return plan;
      }
      const draft = clonePlan(plan);
      mutator(draft);
      return draft;
    }));
  }

  private generateDefaultAssignees(planId: number) {
    return DEFAULT_ASSIGNEE_NAMES.map((name, index) => ({ id: planId * 10 + index + 1, name }));
  }

  private getDefaultTermForPlan(planId: number | null): string {
    if (planId === null) {
      return this.fallbackTermFromDocumentService();
    }

    const match = this.plansState().find(plan => plan.id === planId);
    if (!match || match.tasks.length === 0) {
      return this.fallbackTermFromDocumentService();
    }

    return match.tasks[0].task.term;
  }

  private fallbackTermFromDocumentService(): string {
    const { Future, Current, Historic } = this.documentService.termsByGroup();
    const combined = [...Future, ...Current, ...Historic];
    return combined[0] ?? DEFAULT_TERM_FALLBACK;
  }

  private getNextPlanId() {
    return this.plansState().reduce((max, plan) => Math.max(max, plan.id), 0) + 1;
  }

  private getNextTaskId() {
    return this.plansState().reduce((max, plan) => {
      const planMax = plan.tasks.reduce((inner, entry) => Math.max(inner, entry.task.id), 0);
      return Math.max(max, planMax);
    }, 0) + 1;
  }

  private getSources(entry: PlanAdminTask): string[] {
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
}
