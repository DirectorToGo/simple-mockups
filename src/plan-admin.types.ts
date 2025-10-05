import { PlanTask } from './plan-task.types';

export type PlanTaskAssignmentStatus = 'Not Started' | 'In Progress' | 'Complete';

export interface PlanAssignee {
  id: number;
  name: string;
  role?: string;
  avatarUrl?: string;
}

export interface PlanTaskAssignment {
  id: number;
  name: string;
  owner: string;
  status: PlanTaskAssignmentStatus;
  dueDate: string | null;
}

export interface PlanAdminTask {
  task: PlanTask;
  category: string;
  lastUpdated: string;
  owner: string;
  assignments: PlanTaskAssignment[];
}

export interface PlanAdminPlan {
  id: number;
  name: string;
  description: string;
  owner: string;
  assignees: PlanAssignee[];
  tasks: PlanAdminTask[];
  isActive: boolean;
}
