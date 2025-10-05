
export interface Student {
  id: number;
  name: string;
  email: string;
}

// Links a student to a specific section/syllabus
// documentId refers to the Document.id of a syllabus. Optional legacy fields are kept for compatibility.
export interface Enrollment {
  student: Student;
  documentId?: number;
  courseId?: number;
  sectionId?: number;
}
