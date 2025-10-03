

import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Document, DocumentStatus, DocumentType, TermCategory } from '../../document.types';

@Component({
  selector: 'app-edit-modal',
  templateUrl: './edit-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CommonModule]
})
export class EditModalComponent {
  document = input.required<Document>();
  close = output<void>();
  save = output<Document>();

  editableDocument = signal<Document | null>(null);
  isShowing = signal(false); // New signal for animation state

  statusOptions: DocumentStatus[] = ['Completed', 'Awaiting Approval', 'Not Started'];
  termCategoryOptions: TermCategory[] = ['Future', 'Current', 'Historic'];
  docTypeOptions: DocumentType[] = ['course master', 'syllabus'];

  constructor() {
    effect(() => {
      // Create a deep copy for editing to avoid mutating the original object
      this.editableDocument.set(JSON.parse(JSON.stringify(this.document())));
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
