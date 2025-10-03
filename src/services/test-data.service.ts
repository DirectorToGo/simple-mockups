import { Injectable, inject } from '@angular/core';
import { DocumentService } from './document.service';

@Injectable({ providedIn: 'root' })
export class TestDataService {
  private documentService = inject(DocumentService);

  testSections = this.documentService.syllabusSections;
}
