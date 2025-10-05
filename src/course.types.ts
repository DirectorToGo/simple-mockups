import { Document } from './document.types';

export interface Course {
  id: number;
  name: string;
  subject: string;
  courseNumber: string;
  description: string;
  sections: Section[];
}

export interface Section extends Document {
  courseId: number;
  sectionNumber: string;
}
