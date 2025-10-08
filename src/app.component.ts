import { Component, ChangeDetectionStrategy, inject, signal, computed, ElementRef, viewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from './services/document.service';
import { Document, DocumentStatus, DocumentType, TermCategory } from './document.types';
import { Student, Enrollment } from './student.types';
import { EditModalComponent } from './components/edit-modal/edit-modal.component';
import { PlanTaskEditorComponent } from './components/plan-task-editor/plan-task-editor.component';
import { TermFilterDropdownComponent } from './components/term-filter-dropdown/term-filter-dropdown.component';
import { PlanAdminComponent } from './components/plan-admin/plan-admin.component';
import { SimpleTaComponent } from './components/simple-ta/simple-ta.component';

import { PlanAdminService } from './services/plan-admin.service';
import { TaAdminComponent } from './components/ta-admin/ta-admin.component';

type ColumnKey = 'term' | 'name' | 'status' | 'editors' | 'type';
type SortDirection = 'asc' | 'desc';
type Page = 'documents' | 'plan-admin' | 'accounts' | 'simple-ta' | 'ta-admin';

interface NavItem {
  page: Page;
  label: string;
  icon: 'documents' | 'plan' | 'chat' | 'automation';
}

interface OrganizationNode {
  name: string;
  children?: OrganizationNode[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, EditModalComponent, PlanTaskEditorComponent, TermFilterDropdownComponent, PlanAdminComponent, SimpleTaComponent, TaAdminComponent],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  }
})
export class AppComponent {
  private documentService = inject(DocumentService);
  private planAdminService = inject(PlanAdminService);

  // State Signals
  allDocuments = this.documentService.documents;
  editingDocument = signal<Document | null>(null);
  activeDropdown = signal<string | null>(null);
  showAdvancedFilters = signal(false);
  actionDropdownOpen = signal<number | null>(null);
  profileDropdownOpen = signal(false);
  siteSettingsDropdownOpen = signal(false);
  currentPage = signal<Page>('documents');
  showPlanTaskModal = signal(false);
  sidebarExpanded = signal(true);
  planTaskModalMode = signal<'edit' | 'create'>('edit');

  // Simulated login state
  currentUserRole = signal<'designer' | 'faculty' | 'instructor' | 'student'>('designer');
  currentUserName = signal<string>('Andrew Admin');
  canEdit = computed(() => this.currentUserRole() !== 'student');
  canSeePlanAdmin = computed(() => this.currentUserRole() === 'designer' || this.currentUserRole() === 'faculty');
  canSeeAccounts = this.canSeePlanAdmin;
  canSeeSimpleTA = computed(() => this.currentUserRole() === 'student' || this.currentUserRole() === 'instructor' || this.currentUserRole() === 'designer');
  canSeeTaAdmin = computed(() => this.currentUserRole() === 'designer');
  navItems: NavItem[] = [
    { page: 'documents', label: 'Document Track', icon: 'documents' },
    { page: 'simple-ta', label: 'Simple TA', icon: 'chat' },
    { page: 'ta-admin', label: 'TA Admin', icon: 'automation' },
    { page: 'plan-admin', label: 'Plan Admin', icon: 'plan' },
  ];

  pageTitle = computed(() => {
    switch (this.currentPage()) {
      case 'documents':
        return 'Document Track';
      case 'plan-admin':
        return 'Plan Admin';
      case 'accounts':
        return 'Accounts';
      case 'ta-admin':
        return 'TA Admin';
      default:
        return 'Document Track';
    }
  });

  // Element Refs for click-outside handling
  termFilterButtonRef = viewChild<ElementRef>('termFilterButton');
  termFilterDropdownRef = viewChild<ElementRef>('termFilterDropdown');
  columnsButtonRef = viewChild<ElementRef>('columnsButton');
  columnsDropdownRef = viewChild<ElementRef>('columnsDropdown');
  statusFilterButtonRef = viewChild<ElementRef>('statusFilterButton');
  statusFilterDropdownRef = viewChild<ElementRef>('statusFilterDropdown');
  docTypeFilterButtonRef = viewChild<ElementRef>('docTypeFilterButton');
  docTypeFilterDropdownRef = viewChild<ElementRef>('docTypeFilterDropdown');
  publishedFilterButtonRef = viewChild<ElementRef>('publishedFilterButton');
  publishedFilterDropdownRef = viewChild<ElementRef>('publishedFilterDropdown');
  subjectFilterButtonRef = viewChild<ElementRef>('subjectFilterButton');
  subjectFilterDropdownRef = viewChild<ElementRef>('subjectFilterDropdown');
  organizationFilterButtonRef = viewChild<ElementRef>('organizationFilterButton');
  organizationFilterDropdownRef = viewChild<ElementRef>('organizationFilterDropdown');
  profileButtonRef = viewChild<ElementRef>('profileButton');
  profileDropdownRef = viewChild<ElementRef>('profileDropdown');
  settingsButtonRef = viewChild<ElementRef>('settingsButton');
  settingsDropdownRef = viewChild<ElementRef>('settingsDropdown');


  // Column Visibility
  visibleColumns = signal<Record<ColumnKey, boolean>>({
    term: true,
    name: true,
    status: true,
    editors: true,
    type: true,
  });

  columnDefs: { key: ColumnKey, label: string }[] = [
    { key: 'term', label: 'Term' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'editors', label: 'Editors' },
    { key: 'type', label: 'Type' },
  ];

  organizationHierarchy: OrganizationNode[] = [
    {
        name: 'Simple State University',
        children: [
            {
                name: 'Business School',
                children: [
                    { name: 'Department of Finance' }
                ]
            },
            {
                name: 'College of Arts & Sciences',
                children: [
                    { name: 'Arts & Humanities' },
                    { name: 'Department of Anthropology' },
                    { name: 'Department of Biology' },
                    { name: 'Department of Chemistry' },
                    { name: 'Department of English' },
                    { name: 'Department of Fine Arts' },
                    { name: 'Science Department' }
                ]
            },
            {
                name: 'Engineering School'
            }
        ]
    }
  ];

  // --- Filter Signals ---
  // Term Filter
  selectedTerms = signal<string[]>([]);

  // Other Filters
  keywordFilter = signal('');
  statusFilter = signal<DocumentStatus[]>(['Not Started', 'In progress', 'Awaiting Approval', 'Completed']);
  docTypeFilter = signal<DocumentType[]>(['syllabus', 'course master']);
  publishedFilter = signal<('Published' | 'Not Published')[]>(['Published', 'Not Published']);
  subjectFilter = signal('');
  organizationFilter = signal('');
  instructorFilter = signal('');
  subjectSearchQuery = signal('');
  organizationSearchQuery = signal('');

  // Sorting
  sortConfig = signal<{ key: ColumnKey; direction: SortDirection } | null>(null);

  // --- Filter Options & Computed Data ---
  statusOptions: DocumentStatus[] = ['Not Started', 'In progress', 'Awaiting Approval', 'Completed', 'Inactive'];
  docTypeOptions: DocumentType[] = ['syllabus', 'course master'];
  publishedOptions: ('Published' | 'Not Published')[] = ['Published', 'Not Published'];

  uniqueSubjects = computed(() => [...new Set(this.allDocuments().map(d => d.subject))].sort());

  filteredSubjects = computed(() => {
    const query = this.subjectSearchQuery().toLowerCase();
    if (!query) {
      return this.uniqueSubjects();
    }
    return this.uniqueSubjects().filter(subject => subject.toLowerCase().includes(query));
  });

  filteredFlatOrganizationHierarchy = computed(() => {
    const filteredTree = this.filterHierarchy(this.organizationHierarchy, this.organizationSearchQuery());
    return this.flattenHierarchy(filteredTree);
  });

  // Pagination Signals
  itemsPerPage = signal(50);
  paginationCurrentPage = signal(1);

  constructor() {
    // Set default term filter to 'Current'
    this.selectedTerms.set(this.documentService.termsByGroup().Current);

    // Effect to clear search queries when dropdowns are closed
    effect(() => {
      const active = this.activeDropdown();
      if (active !== 'subject') this.subjectSearchQuery.set('');
      if (active !== 'organization') this.organizationSearchQuery.set('');
    });
  }

  private flattenHierarchy(nodes: OrganizationNode[], level = 0): { name: string; level: number }[] {
    let result: { name: string; level: number }[] = [];
    for (const node of nodes) {
        result.push({ name: node.name, level });
        if (node.children) {
            result = result.concat(this.flattenHierarchy(node.children, level + 1));
        }
    }
    return result;
  }

  private filterHierarchy(nodes: OrganizationNode[], query: string): OrganizationNode[] {
    if (!query) {
      return nodes;
    }
    const lowerCaseQuery = query.toLowerCase();

    return nodes.reduce((acc, node) => {
      const children = node.children ? this.filterHierarchy(node.children, query) : [];

      if (node.name.toLowerCase().includes(lowerCaseQuery) || children.length > 0) {
        acc.push({ ...node, children });
      }

      return acc;
    }, [] as OrganizationNode[]);
  }

  // --- Computed signals for derived state ---
  filteredDocuments = computed(() => {
    const terms = this.selectedTerms();
    if (terms.length === 0) return []; // If no terms selected, show nothing

    const keyword = this.keywordFilter().toLowerCase();
    const statuses = this.statusFilter();
    const docTypes = this.docTypeFilter();
    const published = this.publishedFilter();
    const subject = this.subjectFilter();
    const organization = this.organizationFilter();
    const instructor = this.instructorFilter().toLowerCase();

    // Role-based base dataset
    const role = this.currentUserRole();
    let baseDocs = this.allDocuments();
    if (role === 'instructor') {
      const me = this.currentUserName();
      baseDocs = baseDocs.filter(d => d.instructor === me || d.editors.some(e => e.name === me));
    } else if (role === 'student') {
      const me = this.currentUserName();
      const enrolled = new Set<number>();
      for (const enr of this.documentService.enrollments()) {
        if (enr.student.name !== me) continue;
        const docId = (enr as any).documentId as number | undefined;
        if (docId !== undefined) enrolled.add(docId);
      }
      baseDocs = baseDocs.filter(d => d.type === 'syllabus' && enrolled.has(d.id));
    }

    return baseDocs.filter(doc => {
      const termMatch = terms.includes(doc.term);
      const statusMatch = statuses.length === 0 || statuses.includes(doc.status);
      const docTypeMatch = docTypes.length === 0 || docTypes.includes(doc.type);
      const subjectMatch = subject === '' || doc.subject === subject;
      const orgMatch = organization === '' || doc.organization === organization;
      const instructorMatch = instructor === '' || doc.instructor.toLowerCase().includes(instructor);

      const publishedMatch = published.length === 0 || published.length === 2 ||
        (published.includes('Published') && doc.published) ||
        (published.includes('Not Published') && !doc.published);

      const keywordMatch = keyword === ''
        || doc.name.toLowerCase().includes(keyword)
        || doc.term.toLowerCase().includes(keyword)
        || doc.editors.some(e => e.name.toLowerCase().includes(keyword));

      return termMatch && keywordMatch && statusMatch && docTypeMatch && publishedMatch && subjectMatch && orgMatch && instructorMatch;
    });
  });

  sortedDocuments = computed(() => {
    const docs = [...this.filteredDocuments()];
    const config = this.sortConfig();

    if (!config) {
      return docs;
    }

    docs.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (config.key === 'editors') {
        aValue = a.editors[0]?.name || '';
        bValue = b.editors[0]?.name || '';
      } else {
        aValue = a[config.key];
        bValue = b[config.key];
      }

      // Basic string/number comparison
      if (aValue < bValue) {
        return config.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return config.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return docs;
  });

  paginatedDocuments = computed(() => {
    const docs = this.sortedDocuments();
    const start = (this.paginationCurrentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return docs.slice(start, end);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredDocuments().length / this.itemsPerPage());
  });

  accounts = computed(() => {
    type Rec = {
      instructorCount: number;
      editorCount: number;
      studentEnrollmentCount: number;
      subjects: Set<string>;
      organizations: Set<string>;
      sections: Set<string>;
    };
    const map = new Map<string, Rec>();

    const docs = this.allDocuments();
    const docsById = new Map<number, (typeof docs)[number]>(docs.map(d => [d.id, d]));

    // Instructors and Editors (from documents)
    for (const doc of docs) {
      if (doc.instructor) {
        const name = doc.instructor;
        const rec = map.get(name) || { instructorCount: 0, editorCount: 0, studentEnrollmentCount: 0, subjects: new Set<string>(), organizations: new Set<string>(), sections: new Set<string>() };
        rec.instructorCount++;
        rec.subjects.add(doc.subject);
        rec.organizations.add(doc.organization);
        rec.sections.add(`${doc.name} - ${doc.term}`);
        map.set(name, rec);
      }
      for (const e of doc.editors) {
        const ename = e.name;
        const rec2 = map.get(ename) || { instructorCount: 0, editorCount: 0, studentEnrollmentCount: 0, subjects: new Set<string>(), organizations: new Set<string>(), sections: new Set<string>() };
        rec2.editorCount++;
        rec2.subjects.add(doc.subject);
        rec2.organizations.add(doc.organization);
        rec2.sections.add(`${doc.name} - ${doc.term}`);
        map.set(ename, rec2);
      }
    }

    // Students (from enrollments → syllabus documents only)
    for (const enr of this.documentService.enrollments()) {
      const docId = (enr as any).documentId as number | undefined;
      const doc = docId ? docsById.get(docId) : undefined;
      if (!doc || doc.type !== 'syllabus') continue;
      const sname = enr.student.name;
      const rec = map.get(sname) || { instructorCount: 0, editorCount: 0, studentEnrollmentCount: 0, subjects: new Set<string>(), organizations: new Set<string>(), sections: new Set<string>() };
      rec.studentEnrollmentCount++;
      rec.subjects.add(doc.subject);
      rec.organizations.add(doc.organization);
      rec.sections.add(`${doc.name} - ${doc.term}`);
      map.set(sname, rec);
    }

    // Ensure all students are present as accounts (even if 0 enrollments)
    for (const s of this.documentService.students()) {
      if (!map.has(s.name)) {
        map.set(s.name, { instructorCount: 0, editorCount: 0, studentEnrollmentCount: 0, subjects: new Set<string>(), organizations: new Set<string>(), sections: new Set<string>() });
      }
    }


    return Array.from(map.entries()).map(([name, v]) => {
      const roles: string[] = [];
      if (v.instructorCount > 0) roles.push('Instructor');
      if (v.editorCount > 0) roles.push('Editor');
      if (v.studentEnrollmentCount > 0) roles.push('Student');
      return {
        name,
        roles: roles.join(', '),
        instructorCount: v.instructorCount,
        editorCount: v.editorCount,
        studentEnrollmentCount: v.studentEnrollmentCount,
        subjects: Array.from(v.subjects).sort(),
        organizations: Array.from(v.organizations).sort(),
        sections: Array.from(v.sections).sort(),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  });


  activeFilterCount = computed(() => {
    let count = 0;
    if (this.statusFilter().length > 0) count++;
    if (this.docTypeFilter().length > 0) count++;
    if (this.publishedFilter().length > 0) count++;
    if (this.subjectFilter() !== '') count++;
    if (this.organizationFilter() !== '') count++;
    if (this.instructorFilter() !== '') count++;
    return count;
  });

  termButtonText = computed(() => {
    const selectedCount = this.selectedTerms().length;
    if (selectedCount === 0) return 'Select Term';
    if (selectedCount === 1) return this.selectedTerms()[0];
    return `${selectedCount} Terms`;
  });

  private createButtonText(selectedItems: readonly string[], defaultText: string, optionsInOrder: readonly string[]): string {
    if (selectedItems.length === 0) {
      return defaultText;
    }
    const orderedSelected = optionsInOrder.filter(option => selectedItems.includes(option as any));
    const text = orderedSelected.join(', ');
    return text.length > 25 ? `${text.substring(0, 25)}...` : text;
  }

  statusButtonText = computed(() => this.createButtonText(this.statusFilter(), 'Select Status', this.statusOptions));
  docTypeButtonText = computed(() => this.createButtonText(this.docTypeFilter(), 'Select Type', this.docTypeOptions));
  publishedButtonText = computed(() => this.createButtonText(this.publishedFilter(), 'Select State', this.publishedOptions));

  visibleColumnCount = computed(() => {
    return Object.values(this.visibleColumns()).filter(isVisible => isVisible).length;
  });

  // --- Avatar helpers ---
  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  getAvatarColor(_name: string): string {
    return 'bg-gray-200 text-gray-800';
  }

  // --- Event Handlers ---
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Main filter dropdowns
    const activeFilterDropdown = this.activeDropdown();
    if (activeFilterDropdown) {
      let buttonRef: ElementRef | undefined;
      let dropdownRef: ElementRef | undefined;

      switch (activeFilterDropdown) {
        case 'term':
          buttonRef = this.termFilterButtonRef();
          dropdownRef = this.termFilterDropdownRef();
          break;
        case 'columns':
          buttonRef = this.columnsButtonRef();
          dropdownRef = this.columnsDropdownRef();
          break;
        case 'status':
          buttonRef = this.statusFilterButtonRef();
          dropdownRef = this.statusFilterDropdownRef();
          break;
        case 'docType':
          buttonRef = this.docTypeFilterButtonRef();
          dropdownRef = this.docTypeFilterDropdownRef();
          break;
        case 'published':
          buttonRef = this.publishedFilterButtonRef();
          dropdownRef = this.publishedFilterDropdownRef();
          break;
        case 'subject':
          buttonRef = this.subjectFilterButtonRef();
          dropdownRef = this.subjectFilterDropdownRef();
          break;
        case 'organization':
          buttonRef = this.organizationFilterButtonRef();
          dropdownRef = this.organizationFilterDropdownRef();
          break;
      }

      const clickedOnButtonOrInDropdown =
        buttonRef?.nativeElement.contains(target) ||
        dropdownRef?.nativeElement.contains(target);

      if (!clickedOnButtonOrInDropdown) {
        this.activeDropdown.set(null);
      }
    }

    // Per-row action dropdown
    if (this.actionDropdownOpen() !== null) {
      if (!target.closest('.action-dropdown-container')) {
        this.actionDropdownOpen.set(null);
      }
    }

    // Profile dropdown
    if (this.profileDropdownOpen()) {
      const clickedOnButtonOrInDropdown =
        this.profileButtonRef()?.nativeElement.contains(target) ||
        this.profileDropdownRef()?.nativeElement.contains(target);

      if (!clickedOnButtonOrInDropdown) {
        this.profileDropdownOpen.set(false);
      }
    }

    // Site settings dropdown
    if (this.siteSettingsDropdownOpen()) {
      const clickedOnButtonOrInDropdown =
        this.settingsButtonRef()?.nativeElement.contains(target) ||
        this.settingsDropdownRef()?.nativeElement.contains(target);

      if (!clickedOnButtonOrInDropdown) {
        this.siteSettingsDropdownOpen.set(false);
      }
    }

  }

  toggleDropdown(name: string) {
    this.activeDropdown.update(current => (current === name ? null : name));
  }

  toggleProfileDropdown() {
    this.profileDropdownOpen.update(v => !v);
  }

  toggleSiteSettingsDropdown() {
    this.siteSettingsDropdownOpen.update(v => !v);
  }

  // Role switching helpers
  switchToDesigner() {
    this.currentUserRole.set('designer');
    this.currentUserName.set('Andrew Admin');
    this.profileDropdownOpen.set(false);
    this.currentPage.set('documents');
  }


  switchToInstructor() {
    this.currentUserRole.set('instructor');
    this.currentUserName.set('Fred Faculty');
    this.profileDropdownOpen.set(false);
    this.currentPage.set('documents');
  }

  switchToStudent() {
    this.currentUserRole.set('student');
    this.currentUserName.set('Alice Student');
    this.profileDropdownOpen.set(false);
    this.currentPage.set('documents');
  }


  openAccounts() {
    this.currentPage.set('accounts');
    this.siteSettingsDropdownOpen.set(false);
  }

  toggleSidebar() {
    this.sidebarExpanded.update(v => !v);
  }

  navigateTo(page: Page) {
    this.currentPage.set(page);
  }

  onPlanAdminEditTask(taskId: number) {
    this.planAdminService.setActiveTask(taskId);
    this.planTaskModalMode.set('edit');
    this.showPlanTaskModal.set(true);
  }

  onPlanAdminAddTask() {
    this.planAdminService.createTask();
    this.planTaskModalMode.set('create');
    this.showPlanTaskModal.set(true);
  }

  closePlanTaskModal() {
    this.showPlanTaskModal.set(false);
    this.planAdminService.clearActiveTask();
    this.planTaskModalMode.set('edit'); // Reset to default mode
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.update(v => !v);
  }

  onKeywordSearch(event: Event) {
    this.keywordFilter.set((event.target as HTMLInputElement).value);
    this.paginationCurrentPage.set(1);
  }

  // Term Filter Methods
  onTermSelectionChange(terms: string[]) {
    this.selectedTerms.set(terms);
    this.paginationCurrentPage.set(1);
  }

  // Advanced Filter Methods
  toggleStatusFilter(status: DocumentStatus) {
    this.statusFilter.update(current =>
      current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status]
    );
    this.paginationCurrentPage.set(1);
  }

  toggleDocTypeFilter(docType: DocumentType) {
    this.docTypeFilter.update(current =>
      current.includes(docType)
        ? current.filter(t => t !== docType)
        : [...current, docType]
    );
    this.paginationCurrentPage.set(1);
  }

  togglePublishedFilter(state: 'Published' | 'Not Published') {
    this.publishedFilter.update(current =>
      current.includes(state)
        ? current.filter(s => s !== state)
        : [...current, state]
    );
    this.paginationCurrentPage.set(1);
  }

  onSubjectSearch(event: Event) {
    this.subjectSearchQuery.set((event.target as HTMLInputElement).value);
  }

  selectSubject(subject: string) {
    this.subjectFilter.set(subject);
    this.activeDropdown.set(null);
    this.paginationCurrentPage.set(1);
  }

  onOrganizationSearch(event: Event) {
    this.organizationSearchQuery.set((event.target as HTMLInputElement).value);
  }

  selectOrganization(org: string) {
    this.organizationFilter.set(org);
    this.activeDropdown.set(null);
    this.paginationCurrentPage.set(1);
  }

  onInstructorFilter(event: Event) {
    this.instructorFilter.set((event.target as HTMLInputElement).value);
    this.paginationCurrentPage.set(1);
  }

  toggleColumnVisibility(key: ColumnKey) {
    this.visibleColumns.update(cols => ({ ...cols, [key]: !cols[key] }));
  }

  toggleActionDropdown(event: MouseEvent, docId: number) {
    event.stopPropagation();
    this.actionDropdownOpen.update(current => (current === docId ? null : docId));
  }

  toggleActivation(doc: Document) {
    const newStatus: DocumentStatus = doc.status === 'Inactive' ? 'Not Started' : 'Inactive';
    const updatedDoc = { ...doc, status: newStatus };
    this.documentService.updateDocument(updatedDoc);
    this.actionDropdownOpen.set(null); // close dropdown
  }

  // Sorting Handler
  onSort(key: ColumnKey) {
    const currentConfig = this.sortConfig();
    let direction: SortDirection = 'asc';

    if (currentConfig && currentConfig.key === key && currentConfig.direction === 'asc') {
      direction = 'desc';
    }

    this.sortConfig.set({ key, direction });
    this.paginationCurrentPage.set(1);
  }

  editDocument(doc: Document) {
    this.editingDocument.set(doc);
  }

  closeModal() {
    this.editingDocument.set(null);
  }

  saveDocument(doc: Document) {
    this.documentService.updateDocument(doc);
    this.closeModal();
  }

  // Pagination Methods
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.paginationCurrentPage.set(page);
    }
  }

  nextPage() {
    this.goToPage(this.paginationCurrentPage() + 1);
  }

  prevPage() {
    this.goToPage(this.paginationCurrentPage() - 1);
  }
}
