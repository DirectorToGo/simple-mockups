import {
  DocumentStatus,
  SyllabusAssignment,
  SyllabusComponent,
  SyllabusPublishState,
} from './document.types';
import { ConditionResultType } from './plan-task.types';

export type TestLmsAssignment = SyllabusAssignment;

export type TestComponent = SyllabusComponent;

export interface TestSection {
  id: number;
  name: string; // e.g., 'ACT 1100 1'
  term: string;
  
  // Syllabus properties
  publishState: SyllabusPublishState;
  status: DocumentStatus;
  materialCount: number;
  components: TestComponent[];
  completedDate: string | null;
  
  // LMS properties
  lmsAssignments: TestLmsAssignment[];
  
  // Attribute properties
  attributeCreditHours: number;
}

export interface EvaluationResult {
  passes: boolean;
  displayValue: string;
  resultType: ConditionResultType;
  customName?: string;
  icon?: string;
}

export interface DisplayedEvaluationResult extends EvaluationResult {
  isManualOverride: boolean;
  isManualTask: boolean;
}
