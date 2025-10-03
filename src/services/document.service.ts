import { Injectable, signal, computed } from '@angular/core';
import {
  Document,
  TermCategory,
  SyllabusDetails,
  SyllabusComponentName,
  SyllabusAssignment,
  SyllabusComponent,
} from '../document.types';
import { TestSection } from '../plan-task-evaluation.types';

const COMPONENT_NAME_POOL: SyllabusComponentName[] = [
  'Instructor Information',
  'Required materials',
  'Optional materials',
  'Grading scheme',
  'Program outcomes',
  'Course overview',
  'Class schedule',
  'Course Objective',
  'Student engagement (syllabus)',
];

const ASSIGNMENT_LABELS = ['Homework', 'Project', 'Quiz', 'Reflection'];

const toUtcIsoDate = (year: number, month: number, day: number): string =>
  new Date(Date.UTC(year, month - 1, day)).toISOString();

const cloneComponents = (components: SyllabusComponent[]): SyllabusComponent[] =>
  components.map(component => ({ ...component }));

const cloneAssignments = (assignments: SyllabusAssignment[]): SyllabusAssignment[] =>
  assignments.map(assignment => ({ ...assignment }));

const buildComponents = (count: number, seed: number): SyllabusComponent[] => {
  const cappedCount = Math.min(count, COMPONENT_NAME_POOL.length);
  return COMPONENT_NAME_POOL.slice(0, cappedCount).map((name, index) => ({
    name,
    visible: ((seed + index) % 2) === 0,
  }));
};

const buildAssignments = (seed: number): SyllabusAssignment[] => {
  return [0, 1, 2].map(index => {
    const label = ASSIGNMENT_LABELS[(seed + index) % ASSIGNMENT_LABELS.length];
    const number = ((seed + index) % 4) + 1;
    const publishState = ((seed + index) % 3 === 0) ? 'Unpublished' : 'Published';
    const graded = ((seed + index) % 2) === 0;
    const dueDate = ((seed + index) % 5 === 0)
      ? null
      : toUtcIsoDate(2024 + (seed % 3), ((seed + index) % 12) + 1, 10 + index * 4);

    return {
      name: `${label} ${number}`,
      publishState,
      graded,
      dueDate,
    };
  });
};

const createSyllabusDetails = (seed: number, overrides: Partial<SyllabusDetails> = {}): SyllabusDetails => {
  const defaultComponents = buildComponents(2 + (seed % 4), seed);
  const defaultAssignments = buildAssignments(seed);
  const publishState = overrides.publishState ?? ((seed % 2 === 0) ? 'Published' : 'Not Published');
  const components = overrides.components ? cloneComponents(overrides.components) : defaultComponents;
  const assignments = overrides.lmsAssignments ? cloneAssignments(overrides.lmsAssignments) : defaultAssignments;
  const materialCount = overrides.materialCount ?? components.length;
  const attributeCreditHours = overrides.attributeCreditHours ?? (seed % 2 === 0 ? 3 : 4);

  return {
    publishState,
    materialCount,
    completedDate: overrides.completedDate ?? null,
    components,
    lmsAssignments: assignments,
    attributeCreditHours,
  };
};

const ACT_1100_1_DETAILS = createSyllabusDetails(1, {
  publishState: 'Published',
  materialCount: 5,
  completedDate: '2025-09-01T10:00:00Z',
  components: [
    { name: 'Instructor Information', visible: true },
    { name: 'Required materials', visible: true },
  ],
  lmsAssignments: [
    { name: 'Homework 1', publishState: 'Published', graded: true, dueDate: '2025-09-15T23:59:59Z' },
    { name: 'Homework 2', publishState: 'Published', graded: true, dueDate: '2025-09-22T23:59:59Z' },
    { name: 'Midterm Outline', publishState: 'Unpublished', graded: false, dueDate: null },
  ],
  attributeCreditHours: 3,
});

const ACT_2100_1_DETAILS = createSyllabusDetails(2, {
  publishState: 'Not Published',
  materialCount: 1,
  completedDate: null,
  components: [
    { name: 'Instructor Information', visible: false },
  ],
  lmsAssignments: [
    { name: 'Project Proposal', publishState: 'Published', graded: true, dueDate: '2025-10-01T23:59:59Z' },
  ],
  attributeCreditHours: 3,
});

const ACT_2100_2_DETAILS = createSyllabusDetails(3, {
  publishState: 'Not Published',
  materialCount: 0,
  completedDate: null,
  components: [],
  lmsAssignments: [],
  attributeCreditHours: 4,
});

const BIO_101_DETAILS = createSyllabusDetails(4, {
  publishState: 'Not Published',
  materialCount: 3,
  completedDate: null,
  components: [
    { name: 'Instructor Information', visible: true },
    { name: 'Course overview', visible: true },
    { name: 'Class schedule', visible: false },
  ],
});

const ENG_102_DETAILS = createSyllabusDetails(5, {
  publishState: 'Not Published',
  materialCount: 2,
  completedDate: null,
  components: [
    { name: 'Instructor Information', visible: true },
    { name: 'Program outcomes', visible: true },
  ],
});

const CS_101_DETAILS = createSyllabusDetails(6, {
  publishState: 'Published',
  materialCount: 4,
  completedDate: '2024-03-01T12:00:00Z',
  components: [
    { name: 'Instructor Information', visible: true },
    { name: 'Required materials', visible: true },
    { name: 'Grading scheme', visible: true },
    { name: 'Class schedule', visible: true },
  ],
});

const HIS_220_A_DETAILS = createSyllabusDetails(7, {
  publishState: 'Published',
  materialCount: 6,
  completedDate: '2023-08-20T09:30:00Z',
  components: [
    { name: 'Instructor Information', visible: true },
    { name: 'Required materials', visible: true },
    { name: 'Optional materials', visible: true },
    { name: 'Grading scheme', visible: true },
    { name: 'Course overview', visible: true },
    { name: 'Class schedule', visible: true },
  ],
  attributeCreditHours: 3,
});

const MOCK_DOCUMENTS: Document[] = [
  // Current Term Data based on screenshot
  { id: 1, term: 'Fall 2025', termCategory: 'Current', name: 'ACT 1100', status: 'Completed', editors: [{ name: 'Isabelle Designer' }], type: 'course master', published: true, subject: 'ACT', organization: 'Department of Finance', instructor: 'Isabelle Designer' },
  { id: 2, term: 'Fall 2025', termCategory: 'Current', name: 'ACT 1100 1', status: 'Completed', editors: [{ name: 'Francesca Faculty' }], type: 'syllabus', published: ACT_1100_1_DETAILS.publishState === 'Published', subject: 'ACT', organization: 'Business School', instructor: 'Francesca Faculty', syllabusDetails: ACT_1100_1_DETAILS },
  { id: 3, term: 'Fall 2025', termCategory: 'Current', name: 'ACT 2100', status: 'Completed', editors: [{ name: 'Isabelle Designer' }], type: 'course master', published: true, subject: 'ACT', organization: 'Business School', instructor: 'Isabelle Designer' },
  { id: 4, term: 'Fall 2025', termCategory: 'Current', name: 'ACT 2100 1', status: 'Awaiting Approval', editors: [{ name: 'Fay Faculty' }], type: 'syllabus', published: ACT_2100_1_DETAILS.publishState === 'Published', subject: 'ACT', organization: 'Business School', instructor: 'Fay Faculty', syllabusDetails: ACT_2100_1_DETAILS },
  { id: 5, term: 'Fall 2025', termCategory: 'Current', name: 'ACT 2100 2', status: 'Not Started', editors: [{ name: 'Fatima Faculty' }], type: 'syllabus', published: ACT_2100_2_DETAILS.publishState === 'Published', subject: 'ACT', organization: 'Business School', instructor: 'Fatima Faculty', syllabusDetails: ACT_2100_2_DETAILS },

  // Historic Term Data based on screenshot
  { id: 13, term: 'Spring 2025', termCategory: 'Historic', name: 'BIO 101', status: 'In progress', editors: [{ name: 'Fatima Faculty' }], type: 'syllabus', published: BIO_101_DETAILS.publishState === 'Published', subject: 'BIO', organization: 'Science Department', instructor: 'Fatima Faculty', syllabusDetails: BIO_101_DETAILS },
  { id: 14, term: 'Fall 2024', termCategory: 'Historic', name: 'BIO 101 Master', status: 'Completed', editors: [{ name: 'Fred Faculty' }], type: 'course master', published: true, subject: 'BIO', organization: 'Science Department', instructor: 'Fred Faculty' },
  { id: 15, term: 'Spring 2024', termCategory: 'Historic', name: 'ENG 102', status: 'Awaiting Approval', editors: [{ name: 'Fay Faculty' }], type: 'syllabus', published: ENG_102_DETAILS.publishState === 'Published', subject: 'ENG', organization: 'Arts & Humanities', instructor: 'Fay Faculty', syllabusDetails: ENG_102_DETAILS },
  { id: 16, term: 'Spring 2024', termCategory: 'Historic', name: 'CS 101', status: 'In progress', editors: [{ name: 'Fareed Faculty' }], type: 'syllabus', published: CS_101_DETAILS.publishState === 'Published', subject: 'CSC', organization: 'Engineering School', instructor: 'Fareed Faculty', syllabusDetails: CS_101_DETAILS },
  { id: 17, term: 'Fall 2023', termCategory: 'Historic', name: 'HIS 220', status: 'Completed', editors: [{ name: 'Isabelle Designer' }], type: 'course master', published: true, subject: 'HIS', organization: 'Arts & Humanities', instructor: 'Isabelle Designer' },
  { id: 18, term: 'Fall 2023', termCategory: 'Historic', name: 'HIS 220 A', status: 'Inactive', editors: [{ name: 'Francesca Faculty' }], type: 'syllabus', published: HIS_220_A_DETAILS.publishState === 'Published', subject: 'HIS', organization: 'Arts & Humanities', instructor: 'Francesca Faculty', syllabusDetails: HIS_220_A_DETAILS },
  { id: 19, term: 'Fall 2023', termCategory: 'Historic', name: 'MTH 300', status: 'Completed', editors: [{ name: 'Fred Faculty' }], type: 'course master', published: true, subject: 'MTH', organization: 'Science Department', instructor: 'Fred Faculty' },

  ...Array.from({ length: 111 }, (_, index) => {
    const id = 20 + index;
    const termMap = [
      { term: 'Fall 2025', category: 'Current' as const },
      { term: 'Spring 2025', category: 'Historic' as const },
      { term: 'Fall 2024', category: 'Historic' as const },
      { term: 'Spring 2024', category: 'Historic' as const },
      { term: 'Fall 2023', category: 'Historic' as const },
    ];
    const selectedTerm = termMap[index % termMap.length];
    const status = (['Completed', 'Awaiting Approval', 'Not Started', 'In progress', 'Inactive'] as const)[index % 5];
    const type = (['syllabus', 'course master'] as const)[index % 2];
    const subjectName = ['Physics', 'Chemistry', 'Art History', 'Economics', 'Anthropology', 'Marketing', 'Finance'][index % 7];
    const subjectCode = subjectName.substring(0, 3).toUpperCase();
    const name = `${subjectCode} ${1000 + index}`;
    const editor = [
      { name: 'Isabelle Designer' },
      { name: 'Francesca Faculty' },
      { name: 'Fay Faculty' },
      { name: 'Fatima Faculty' },
      { name: 'Fred Faculty' },
      { name: 'Fareed Faculty' },
    ][index % 6];

    const baseDocument = {
      id,
      term: selectedTerm.term,
      termCategory: selectedTerm.category,
      name,
      status,
      editors: [editor],
      type,
      subject: subjectCode,
      organization: ['Simple State University', 'College of Arts & Sciences', 'Department of Anthropology', 'Department of Biology', 'Department of Chemistry', 'Department of English', 'Department of Fine Arts'][index % 7],
      instructor: editor.name,
    };

    if (type === 'syllabus') {
      const publishState: SyllabusDetails['publishState'] = status === 'Completed' ? 'Published' : (index % 3 === 0 ? 'Published' : 'Not Published');
      const details = createSyllabusDetails(index + 10, {
        publishState,
        materialCount: 2 + (index % 6),
        completedDate: status === 'Completed' ? toUtcIsoDate(2024 + (index % 3), ((index % 12) + 1), 5 + (index % 20)) : null,
      });

      return {
        ...baseDocument,
        published: details.publishState === 'Published',
        syllabusDetails: details,
      };
    }

    return {
      ...baseDocument,
      published: status === 'Completed',
    };
  }),
];

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private documentsState = signal<Document[]>(MOCK_DOCUMENTS);
  documents = this.documentsState.asReadonly();
  syllabusSections = computed<TestSection[]>(() =>
    this.documents()
      .map(doc => this.mapDocumentToTestSection(doc))
      .filter((section): section is TestSection => section !== null)
  );

  updateDocument(updatedDocument: Document) {
    this.documentsState.update(docs =>
      docs.map(doc => (doc.id === updatedDocument.id ? updatedDocument : doc))
    );
  }

  private academicTermSort(a: string, b: string): number {
    const seasonOrder: Record<string, number> = { Fall: 3, Summer: 2, Spring: 1, Winter: 0 };

    const [seasonA, yearStrA] = a.split(' ');
    const [seasonB, yearStrB] = b.split(' ');

    const yearA = parseInt(yearStrA, 10);
    const yearB = parseInt(yearStrB, 10);

    if (yearA !== yearB) {
      return yearB - yearA;
    }

    const weightA = seasonOrder[seasonA] ?? -1;
    const weightB = seasonOrder[seasonB] ?? -1;

    return weightB - weightA;
  }

  termsByGroup = computed(() => {
    const groups: Record<TermCategory, string[]> = { Future: [], Current: [], Historic: [] };

    for (const doc of this.documents()) {
      if (!groups[doc.termCategory].includes(doc.term)) {
        groups[doc.termCategory].push(doc.term);
      }
    }

    groups.Future.sort(this.academicTermSort);
    groups.Current.sort(this.academicTermSort);
    groups.Historic.sort(this.academicTermSort);
    return groups;
  });

  private mapDocumentToTestSection(doc: Document): TestSection | null {
    if (doc.type !== 'syllabus' || !doc.syllabusDetails) {
      return null;
    }

    const details = doc.syllabusDetails;

    return {
      id: doc.id,
      name: `${doc.name} - ${doc.term}`,
      term: doc.term,
      publishState: details.publishState,
      status: doc.status,
      materialCount: details.materialCount,
      components: cloneComponents(details.components),
      completedDate: details.completedDate,
      lmsAssignments: cloneAssignments(details.lmsAssignments),
      attributeCreditHours: details.attributeCreditHours,
    };
  }
}
