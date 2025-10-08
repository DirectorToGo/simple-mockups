export type DisplayType = 'Yes/No' | 'Number' | 'Fraction' | 'Percent' | 'Date' | 'Status Label';
export type ConditionGroupType = 'Syllabus condition' | 'LMS Condition' | 'Attribute condition';
export type ConditionResultType = 'Pass' | 'Warning' | 'Fail' | 'Custom';

export interface SubCondition {
  id: number;
  property: string;
  operator: string;
  value: any;
}

export interface Condition {
  id: number;
  groupType: ConditionGroupType | null;
  source: string;
  property: string;
  operator: string;
  value: any;
  subConditions?: SubCondition[];
}

export interface ConditionGroup {
  id: number;
  conditions: Condition[];
}

export interface ConditionResult {
  type: ConditionResultType;
  customName?: string;
  icon?: string;
}

export interface PlanTask {
  id: number;
  term: string;
  name: string;
  description: string;
  conditionGroups: ConditionGroup[];
  displayType: DisplayType;
  conditionResult: ConditionResult;
  conditionFailure: ConditionResult;
  allowView: boolean;
  allowEdit: boolean;
  active: boolean;
}
