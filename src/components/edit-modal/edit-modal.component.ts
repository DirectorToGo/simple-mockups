

import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Document, DocumentStatus, DocumentType, TermCategory, SyllabusComponentName, SyllabusComponent, SyllabusComponentType } from '../../document.types';

@Component({
  selector: 'app-edit-modal',
  templateUrl: './edit-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule]
})
export class EditModalComponent {
  document = input.required<Document>();
  readonly = input<boolean>(false);
  close = output<void>();
  save = output<Document>();

  editableDocument = signal<Document | null>(null);
  isShowing = signal(false); // New signal for animation state

  statusOptions: DocumentStatus[] = ['Completed', 'Awaiting Approval', 'Not Started'];
  termCategoryOptions: TermCategory[] = ['Future', 'Current', 'Historic'];
  docTypeOptions: DocumentType[] = ['course master', 'syllabus'];

  // Current user context for permission checks
  currentUserRole = input<'designer' | 'faculty' | 'instructor' | 'student'>('designer');
  currentUserName = input<string>('');

  // The eight required components and their types (order preserved)
  private REQUIRED_COMPONENTS: Array<{ name: SyllabusComponentName; type: SyllabusComponentType }> = [
    { name: 'Instructor Information', type: 'Instructor' },
    { name: 'Required materials', type: 'Materials' },
    { name: 'Optional materials', type: 'Materials' },
    { name: 'Grading scheme', type: 'Content' },
    { name: 'Program outcomes', type: 'Objectives' },
    { name: 'Course overview', type: 'Content' },
    { name: 'Class schedule', type: 'Schedule' },
    { name: 'Course Objective', type: 'Objectives' },
  ];

  private ensureComponents(doc: Document) {
    // Ensure details object exists
    if (!doc.syllabusDetails) {
      doc.syllabusDetails = {
        publishState: 'Not Published',
        materialCount: this.REQUIRED_COMPONENTS.length,
        completedDate: null,
        components: this.REQUIRED_COMPONENTS.map(def => ({ name: def.name, type: def.type, content: '', visible: true })),
        lmsAssignments: [],
        attributeCreditHours: 3,
      };
      return;
    }
    // Ensure all required components are present
    const existingByName = new Map<SyllabusComponentName, SyllabusComponent>(doc.syllabusDetails.components.map(c => [c.name, c] as const));
    for (const def of this.REQUIRED_COMPONENTS) {
      if (!existingByName.has(def.name)) {
        doc.syllabusDetails.components.push({ name: def.name, type: def.type, content: '', visible: true });
      } else {
        const comp = existingByName.get(def.name)!;
        // Backfill new fields if missing
        (comp as any).type = comp.type || def.type;
        (comp as any).content = comp.content || '';
      }
    }
  }

  getOrderedComponents(doc: Document): SyllabusComponent[] {
    const details = doc.syllabusDetails;
    if (!details) return [];
    const map = new Map(details.components.map(c => [c.name, c] as const));
    return this.REQUIRED_COMPONENTS.map(def => map.get(def.name)!).filter(Boolean) as SyllabusComponent[];
  }

  canEditComponents(doc: Document): boolean {
    const role = this.currentUserRole();
    if (role === 'student') return false;
    if (role === 'designer' || role === 'faculty') return true; // Admin
    if (role === 'instructor') return this.currentUserName() === doc.instructor;
    return false;
  }

  constructor() {
    effect(() => {
      // Create a deep copy for editing to avoid mutating the original object
      this.editableDocument.set(JSON.parse(JSON.stringify(this.document())));
      const d = this.editableDocument();
      if (d) this.ensureComponents(d);
    });
    // Use timeout to allow initial render before starting enter animation
    setTimeout(() => this.isShowing.set(true));
  }

  onSave() {
    if (this.editableDocument()) {
      this.isShowing.set(false); // Trigger exit animation
      setTimeout(() => {
        this.save.emit(this.editableDocument()!); // Emit save after animation
      }, 300); // Duration should match CSS transition
    }
  }

  onCancel() {
    this.isShowing.set(false); // Trigger exit animation
    setTimeout(() => {
      this.close.emit(); // Emit close after animation
    }, 300); // Duration should match CSS transition
  }

  // This is needed to stop click propagation from the modal content to the backdrop
  onModalClick(event: MouseEvent) {
    event.stopPropagation();
  }
}
