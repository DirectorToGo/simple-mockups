
export interface Editor {
  name: string;
}

export type DocumentStatus = 'Completed' | 'Awaiting Approval' | 'Not Started' | 'In progress' | 'Inactive';
export type TermCategory = 'Future' | 'Current' | 'Historic';
export type DocumentType = 'course master' | 'syllabus';
export type SyllabusPublishState = 'Published' | 'Not Published';
export type AssignmentPublishState = 'Published' | 'Unpublished';
export type SyllabusComponentName =
  | 'Instructor Information'
  | 'Required materials'
  | 'Optional materials'
  | 'Grading scheme'
  | 'Program outcomes'
  | 'Course overview'
  | 'Class schedule'
  | 'Course Objective'
  | 'Student engagement (syllabus)';

export interface SyllabusComponent {
  name: SyllabusComponentName;
  visible: boolean;
}

export interface SyllabusAssignment {
  name: string;
  publishState: AssignmentPublishState;
  graded: boolean;
  dueDate: string | null;
}

export interface SyllabusDetails {
  publishState: SyllabusPublishState;
  materialCount: number;
  completedDate: string | null;
  components: SyllabusComponent[];
  lmsAssignments: SyllabusAssignment[];
  attributeCreditHours: number;
}

export interface Document {
  id: number;
  term: string;
  termCategory: TermCategory;
  name: string;
  status: DocumentStatus;
  editors: Editor[];
  type: DocumentType;
  published: boolean;
  subject: string;
  organization: string;
  instructor: string;
  syllabusDetails?: SyllabusDetails;
}
