import { Component, ChangeDetectionStrategy, inject, signal, input, output, computed, OnInit, ElementRef, HostListener, ViewChild, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { DocumentService } from '../../services/document.service';
import { Document } from '../../document.types';
import { TermFilterDropdownComponent } from '../term-filter-dropdown/term-filter-dropdown.component';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  citations?: { docId: number; label: string }[];
}

interface Thread {
  id: number;
  title: string;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-simple-ta',
  standalone: true,
  imports: [CommonModule, TermFilterDropdownComponent],
  templateUrl: './simple-ta.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimpleTaComponent implements OnInit, AfterViewChecked {
  private gemini = inject(GeminiService);
  private documentService = inject(DocumentService);
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Outputs
  openSource = output<number>();

  // Inputs
  currentStudentName = input<string>('');

  // Context scope & filters
  scopeMode = signal<'all' | 'mine'>('mine');
  showAdvancedFilters = signal(false);
  termDropdownOpen = signal(false);
  selectedTerms = signal<string[]>([]);
  subjectFilter = signal('');
  organizationFilter = signal('');
  instructorFilter = signal('');
  subjectSearchQuery = signal('');
  organizationSearchQuery = signal('');
  // New: course/section multi-selects
  selectedCourses = signal<string[]>([]);
  selectedSections = signal<string[]>([]);
  showSubjectDropdown = signal(false);
  showOrganizationDropdown = signal(false);
  showCourseDropdown = signal(false);
  showSectionDropdown = signal(false);

  expandedCourses = signal<string[]>([]);

  // Threads
  selectedThreadId = signal<number | null>(null);

  // Rename modal state
  renameModalOpen = signal(false);
  renameThreadId = signal<number | null>(null);
  renameTitle = signal('');

  // Delete modal state
  deleteModalOpen = signal(false);
  threadToDelete = signal<Thread | null>(null);

  // Syllabus modal state
  modalOpen = signal(false);
  modalDocId = signal<number | null>(null);
  highlightKey = signal<string>('');
  modalDoc = computed(() => {
    const id = this.modalDocId();
    if (id == null) return null as unknown as Document;
    return this.documentService.documents().find(d => d.id === id) as Document;
  });

  threads = signal<Thread[]>([
    { id: 1, title: 'Questions about CS101 syllabus', messages: [
      { role: 'user', text: 'Can you summarize the topics in CS 101?', ts: Date.now() - 1000 * 60 * 60 },
      { role: 'assistant', text: 'CS 101 covers basics of programming, data structures, and problem solving.', ts: Date.now() - 1000 * 60 * 58 },
    ]},
    { id: 2, title: 'Clarifying assignment deadlines', messages: [
      { role: 'user', text: 'When is Homework 2 due for my classes?', ts: Date.now() - 1000 * 60 * 40 },
      { role: 'assistant', text: 'Homework 2 due dates vary by course; check the syllabus schedule section for each.', ts: Date.now() - 1000 * 60 * 38 },
    ]},
    { id: 3, title: 'Understanding grading policies', messages: [
      { role: 'user', text: 'How is participation graded in my courses?', ts: Date.now() - 1000 * 60 * 20 },
      { role: 'assistant', text: 'Participation often counts 10–15% and is detailed under "Grading scheme" in each syllabus.', ts: Date.now() - 1000 * 60 * 18 },
    ]},
  ]);

  // Chat state (current conversation view)
  messages = signal<ChatMessage[]>([]);
  input = signal('');
  sending = signal(false);

  // Auto-scroll state
  private shouldAutoScroll = signal(false);
  isUserAtBottom = signal(true);
  private hasNewMessages = signal(false);
  private scrollTimeout: any;
  private lastScrollTop = 0;
  private isStreaming = signal(false);
  private userManuallyScrolled = signal(false);
  
  // Smooth scrolling animation state
  private streamingScrollAnimation: any;
  private lastScrollHeight = 0;
  private targetScrollTop = 0;
  private currentScrollVelocity = 0;
  private scrollAnimationId: any;
  private animationStartTime = 0;
  private lastAnimationTime = 0;

  quickPrompts = [
    'When is my next assignment due?',
    'How is participation graded?',
    'What topics are covered in this course?',
    'What are the course learning objectives?'
  ];

  // Derived / UI helpers
  termButtonText = computed(() => {
    const selectedCount = this.selectedTerms().length;
    if (selectedCount === 0) return 'Select Term';
    if (selectedCount === 1) return this.selectedTerms()[0];
    return `${selectedCount} Terms`;
  });

  uniqueSubjects = computed(() => {
    const docs = this.getScopeOnlyDocs();
    return Array.from(new Set(docs.map(d => d.subject).filter(Boolean))).sort();
  });

  filteredSubjects = computed(() => {
    const query = this.subjectSearchQuery().toLowerCase();
    if (!query) {
      return this.uniqueSubjects();
    }
    return this.uniqueSubjects().filter(subject => subject.toLowerCase().includes(query));
  });

  uniqueOrganizations = computed(() => {
    const docs = this.getScopeOnlyDocs();
    return Array.from(new Set(docs.map(d => d.organization).filter(Boolean))).sort();
  });

  // Organization hierarchy (same as main app component)
  organizationHierarchy = [
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

  filteredFlatOrganizationHierarchy = computed(() => {
    const filteredTree = this.filterHierarchy(this.organizationHierarchy, this.organizationSearchQuery());
    return this.flattenHierarchy(filteredTree);
  });

  // Extract course code (e.g., "ACT 1100" from "ACT 1100 1" or "HIS 220 A")
  private extractCourseCode(name: string): string {
    const m = name.match(/^([A-Z]{2,}\s+\d{3,4})\b/);
    return m ? m[1] : name;
  }

  courseOptions = computed(() => {
    const docs = this.getScopeOnlyDocs();
    return Array.from(new Set(docs.map(d => this.extractCourseCode(d.name)))).sort();
  });

  // Sections for a given course code
  sectionsForCourse(code: string): string[] {
    return this.getScopeOnlyDocs()
      .filter(d => this.extractCourseCode(d.name) === code)
      .map(d => d.name)
      .sort();
  }

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedTerms().length > 0) count++;
    if (this.organizationFilter()) count++;
    if (this.subjectFilter()) count++;
    if (this.selectedCourses().length > 0) count++;
    if (this.selectedSections().length > 0) count++;
    return count;
  });

  // Computed property to determine when to show the welcome interface
  showWelcomeInterface = computed(() => {
    const threadId = this.selectedThreadId();
    const messagesLength = this.messages().length;
    
    // Show when no thread is selected or when a thread has no messages
    return !threadId || messagesLength === 0;
  });

  ngOnInit(): void {
    // Default terms to Current on first load
    const currentTerms = this.documentService.termsByGroup().Current;
    this.selectedTerms.set([...currentTerms]);
    // Restore from localStorage (per-user)
    this.restorePersistedState();
    
    // Initialize scroll detection after view is ready
    setTimeout(() => {
      this.initializeScrollDetection();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up event listeners and timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.removeScrollListener();
    this.stopSmoothScrolling();
  }

  // --- Threads ---
  newThread() {
    const id = Math.max(0, ...this.threads().map(t => t.id)) + 1;
    
    // Create empty thread without welcome message so our enhanced welcome UI shows
    const t: Thread = { id, title: 'New thread', messages: [] };
    this.threads.update(list => [t, ...list]);
    
    this.selectedThreadId.set(id);
    this.messages.set([]);
    
    // Reset manual scroll and auto-scroll to bottom when creating a new thread
    this.userManuallyScrolled.set(false);
    this.triggerAutoScroll();
    this.persistThreadsSnapshot();
    this.closeAllDropdowns();
  }

  // Expand/collapse helpers for Course dropdown
  isCourseExpanded(code: string): boolean {
    const list = this.expandedCourses();
    if (list.includes(code)) return true;
    return this.selectedSections().some(sec => this.extractCourseCode(sec) === code);
  }
  toggleCourseExpanded(code: string) {
    const list = [...this.expandedCourses()];
    const idx = list.indexOf(code);
    if (idx >= 0) list.splice(idx, 1); else list.push(code);
    this.expandedCourses.set(list);
  }
  selectAllSectionsForCourse(code: string) {
    const all = this.sectionsForCourse(code);
    const set = new Set(this.selectedSections());
    for (const s of all) set.add(s);
    this.selectedSections.set(Array.from(set));
    this.persistState();
  }
  clearSectionsForCourse(code: string) {
    const all = new Set(this.sectionsForCourse(code));
    const filtered = this.selectedSections().filter(s => !all.has(s));
    this.selectedSections.set(filtered);
    this.persistState();
  }

  selectThread(id: number) {
    this.selectedThreadId.set(id);
    const t = this.threads().find(x => x.id === id);
    if (t) this.messages.set([...t.messages]);
    // Ensure we start at the most recent message when opening a thread
    this.userManuallyScrolled.set(false);
    this.triggerAutoScroll();
    this.persistThreadsSnapshot();
    this.closeAllDropdowns();
  }

  // --- Thread Management: Rename & Delete ---
  startRenameThread(threadId: number, event: MouseEvent) {
    event.stopPropagation(); // Prevent row selection
    const thread = this.threads().find(t => t.id === threadId);
    if (thread) {
      this.renameThreadId.set(threadId);
      this.renameTitle.set(thread.title);
      this.renameModalOpen.set(true);
    }
  }

  saveRename() {
    const threadId = this.renameThreadId();
    const newTitle = this.renameTitle().trim();
    
    if (threadId && newTitle) {
      this.threads.update(list => 
        list.map(t => t.id === threadId ? { ...t, title: newTitle } : t)
      );
      this.persistThreadsSnapshot();
      
      // If this is the currently selected thread, update the messages reference
      if (this.selectedThreadId() === threadId) {
        const t = this.threads().find(x => x.id === threadId);
        if (t) this.messages.set([...t.messages]);
      }
    }
    
    this.cancelRename();
  }

  cancelRename() {
    this.renameModalOpen.set(false);
    this.renameThreadId.set(null);
    this.renameTitle.set('');
  }

  deleteThread(threadId: number, event: MouseEvent) {
    event.stopPropagation(); // Prevent row selection
    const thread = this.threads().find(t => t.id === threadId);
    if (thread) {
      this.threadToDelete.set(thread);
      this.deleteModalOpen.set(true);
    }
  }

  confirmDelete() {
    const threadToDelete = this.threadToDelete();
    if (threadToDelete) {
      const threadId = threadToDelete.id;
      
      // Remove the thread
      this.threads.update(list => list.filter(t => t.id !== threadId));
      this.persistThreadsSnapshot();
      
      // If the deleted thread was selected, clear selection and messages
      if (this.selectedThreadId() === threadId) {
        this.selectedThreadId.set(null);
        this.messages.set([]);
      }
    }
    
    this.cancelDelete();
  }

  cancelDelete() {
    this.deleteModalOpen.set(false);
    this.threadToDelete.set(null);
  }

  // --- Scope & Filters ---
  setScopeMode(mode: 'all' | 'mine') { this.scopeMode.set(mode); this.persistState(); this.closeAllDropdowns(); }
  toggleAdvancedFilters() { this.showAdvancedFilters.update(v => !v); }
  toggleTermDropdown() { this.termDropdownOpen.update(v => !v); this.showSubjectDropdown.set(false); this.showOrganizationDropdown.set(false); this.showCourseDropdown.set(false); this.showSectionDropdown.set(false); }
  toggleSubjectDropdown() { this.showSubjectDropdown.update(v => !v); this.termDropdownOpen.set(false); this.showOrganizationDropdown.set(false); this.showCourseDropdown.set(false); this.showSectionDropdown.set(false); }
  toggleOrganizationDropdown() { this.showOrganizationDropdown.update(v => !v); this.termDropdownOpen.set(false); this.showSubjectDropdown.set(false); this.showCourseDropdown.set(false); this.showSectionDropdown.set(false); }
  toggleCourseDropdown() { this.showCourseDropdown.update(v => !v); this.termDropdownOpen.set(false); this.showSubjectDropdown.set(false); this.showOrganizationDropdown.set(false); this.showSectionDropdown.set(false); }
  toggleSectionDropdown() { this.showSectionDropdown.update(v => !v); this.termDropdownOpen.set(false); this.showSubjectDropdown.set(false); this.showOrganizationDropdown.set(false); this.showCourseDropdown.set(false); }

  onTermSelectionChange(terms: string[]) { this.selectedTerms.set(terms); this.persistState(); }
  selectSubject(val: string) { this.subjectFilter.set(val); this.persistState(); this.showSubjectDropdown.set(false); }
  onSubjectSearch(ev: Event) { this.subjectSearchQuery.set((ev.target as HTMLInputElement).value); }
  selectOrganization(val: string) { this.organizationFilter.set(val); this.persistState(); this.showOrganizationDropdown.set(false); }
  onOrganizationSearch(ev: Event) { this.organizationSearchQuery.set((ev.target as HTMLInputElement).value); }
  onInstructorFilter(ev: Event) { this.instructorFilter.set((ev.target as HTMLInputElement).value || ''); this.persistState(); }

  // Course/Section selection handlers
  isCourseCodeSelected(code: string) { return this.selectedCourses().includes(code); }
  toggleCourseCode(code: string) {
    const set = new Set(this.selectedCourses());
    if (set.has(code)) set.delete(code); else set.add(code);
    this.selectedCourses.set(Array.from(set));
    this.persistState();
  }
  isSectionSelected(name: string) { return this.selectedSections().includes(name); }
  toggleSection(name: string) {
    const set = new Set(this.selectedSections());
    if (set.has(name)) set.delete(name); else set.add(name);
    this.selectedSections.set(Array.from(set));
    this.persistState();
  }



  // --- AI integration ---
  isAiConfigured() { return this.gemini.isConfigured(); }

  async sendPrompt(prompt?: string) {
    const text = (prompt ?? this.input()).trim();
    if (!text || this.sending()) return;

    // Push user message
    const userMsg: ChatMessage = { role: 'user', text, ts: Date.now() };
    
    this.input.set('');
    this.sending.set(true);
    
    // Reset manual scroll flag for new user message
    this.userManuallyScrolled.set(false);
    
    // Trigger auto-scroll after user message is added
    this.triggerAutoScroll();

    // If no thread selected (welcome screen), create one and seed with the first user message
    let tid = this.selectedThreadId();
    if (!tid) {
      const id = Math.max(0, ...this.threads().map(t => t.id)) + 1;
      const title = this.autoTitle(text);
      const t: Thread = { id, title, messages: [userMsg] };
      this.threads.update(list => [t, ...list]);
      this.selectedThreadId.set(id);
      tid = id;
      this.persistThreadsSnapshot();
      // Update messages signal with the new thread's messages
      this.messages.set([userMsg]);
    } else {
      // If existing empty thread or "New thread", auto-title from first message
      const updatedThread = this.threads().find(t => t.id === tid);
      if (updatedThread && updatedThread.messages.length === 0) {
        // Empty thread - add user message
        this.messages.set([userMsg]);
        this.threads.update(list => list.map(t => {
          if (t.id === tid) {
            return { ...t, title: this.autoTitle(text), messages: [userMsg] };
          }
          return t;
        }));
      } else {
        // Thread with existing messages - append user message
        this.messages.update(msgs => [...msgs, userMsg]);
        this.threads.update(list => list.map(t => {
          if (t.id === tid && (t.title === 'New thread' || t.title === '')) {
            return { ...t, title: this.autoTitle(text) };
          }
          return t;
        }));
      }
      this.persistThreadsSnapshot();
    }

    let reply = '';
    const useStream = typeof (this.gemini as any).generateSimpleTaReplyStream === 'function';
    const context = this.buildCourseContext();

    if (this.isAiConfigured() && useStream) {
      try {
        // Start streaming
        this.isStreaming.set(true);
        let started = false;
        
        await (this.gemini as any).generateSimpleTaReplyStream(text, context, (chunk: string) => {
          this.messages.update(msgs => {
            const copy = [...msgs];
            if (!started) {
              // First chunk: create assistant message now (no blank placeholder)
              copy.push({ role: 'assistant', text: chunk, ts: Date.now() });
              started = true;
            } else {
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                last.text += chunk;
              }
            }
            return copy;
          });
          // Persist after each chunk
          const snap = this.messages();
          this.threads.update(list => list.map(t => t.id === tid ? { ...t, messages: [...snap] } : t));
          this.persistThreadsSnapshot();
          
          // Trigger auto-scroll during streaming to follow the response
          this.triggerAutoScroll();
        });
        
        reply = this.messages()[this.messages().length - 1]?.text || '';
      } catch {
        reply = await this.safeNonStreamingReply(text, context);
      } finally {
        // End streaming
        this.isStreaming.set(false);
      }
    } else {
      // Non-streaming response
      this.isStreaming.set(true);
      try {
        reply = await this.safeNonStreamingReply(text, context);
      } finally {
        this.isStreaming.set(false);
      }
    }

    // Add citations to the last assistant message (or append a new one if non-streaming)
    const citations = this.extractCitationsFromReply(reply);
    this.messages.update(msgs => {
      const copy = [...msgs];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        last.citations = citations;
      } else {
        copy.push({ role: 'assistant', text: reply, ts: Date.now(), citations });
      }
      return copy;
    });

    // Persist after final message update
    const snapshot = this.messages();
    this.threads.update(list => list.map(t => t.id === tid ? { ...t, messages: [...snapshot] } : t));
    this.persistThreadsSnapshot();

    // Trigger final auto-scroll after response is complete
    this.triggerAutoScroll();

    this.sending.set(false);
  }

  private async safeNonStreamingReply(text: string, context: string): Promise<string> {
    try {
      return await this.gemini.generateSimpleTaReply(text, context);
    } catch {
      return await this.mockReply(text);
    }
  }

  private getScopeOnlyDocs(): Document[] {
    const allDocs = this.documentService.documents();
    const syllabi = allDocs.filter(d => d.type === 'syllabus');
    let scoped: Document[];
    if (this.scopeMode() === 'all') {
      scoped = syllabi;
    } else {
      const student = (this.currentStudentName() || '').trim();
      const enrollments = this.documentService.enrollments();
      const ids = new Set(enrollments.filter(e => e.student.name === student).map(e => (e as any).documentId as number));
      scoped = syllabi.filter(d => ids.has(d.id));
    }
    const terms = this.selectedTerms();
    if (terms.length > 0) scoped = scoped.filter(d => terms.includes(d.term));
    return scoped;
  }

  private getScopedDocs(): Document[] {
    let scoped = this.getScopeOnlyDocs();
    // Apply filters
    const selCourses = this.selectedCourses();
    if (selCourses.length > 0) scoped = scoped.filter(d => selCourses.includes(this.extractCourseCode(d.name)));
    const selSections = this.selectedSections();
    if (selSections.length > 0) scoped = scoped.filter(d => selSections.includes(d.name));
    const subj = this.subjectFilter();
    if (subj) scoped = scoped.filter(d => d.subject === subj);
    const org = this.organizationFilter();
    if (org) scoped = scoped.filter(d => d.organization === org);
    const instr = this.instructorFilter().toLowerCase();
    if (instr) scoped = scoped.filter(d => d.instructor.toLowerCase().includes(instr));
    return scoped;
  }

  private buildCourseContext(): string {
    const docs = this.getScopedDocs();
    const student = (this.currentStudentName() || '').trim();

    if (docs.length === 0) {
      return this.scopeMode() === 'mine'
        ? `Student ${student || 'Unknown'} has no courses in scope.`
        : 'No courses available.';
    }

    const lines: string[] = [];
    for (const doc of docs) {
      const details = doc.syllabusDetails;
      let nextDue = '';
      if (details && details.lmsAssignments?.length) {
        const future = details.lmsAssignments
          .filter(a => !!a.dueDate)
          .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
        if (future?.dueDate) nextDue = `; next due: ${future.name} on ${future.dueDate}`;
      }
      lines.push(`${doc.name} (${doc.term}) — subject ${doc.subject}, instructor ${doc.instructor}${nextDue}`);
    }

    const scopeLabel = this.scopeMode() === 'all' ? 'All Courses' : 'My Courses';
    const studentLine = this.scopeMode() === 'mine' ? `Student: ${student}\n` : '';
    return `${studentLine}Scope: ${scopeLabel}\nCourses:\n- ` + lines.join('\n- ');
  }

  // --- UI helpers ---
  formatTime(ts: number): string {
    try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return ''; }
  }
  // --- Syllabus modal actions ---
  openCitation(docId: number, label: string) {
    this.modalDocId.set(docId);
    // Try to parse assignment name from label format: "Assignment: <name> (<course>)"
    let key = '';
    const m = label?.match(/^Assignment:\s(.+?)\s\(/);
    if (m && m[1]) key = m[1];
    this.highlightKey.set(key);
    this.modalOpen.set(true);
    // Scroll to highlighted segment shortly after render
    setTimeout(() => {
      let targetId = '';
      if (key) {
        targetId = 'assign-' + this.slugify(key);
      } else if (this.highlightKey()) {
        targetId = 'comp-' + this.slugify(this.highlightKey());
      }
      if (targetId) {
        const doc = this.host.nativeElement.ownerDocument;
        const el = doc.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-pink-500');
          setTimeout(() => el.classList.remove('ring-2', 'ring-pink-500'), 2000);
        }
      }
    }, 50);
  }

  closeCitation() {
    this.modalOpen.set(false);
    this.modalDocId.set(null);
    this.highlightKey.set('');
  }

  slugify(s: string) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  getInitials(name: string) { return (name || '').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase(); }
  getAvatarColor(name: string) {
    const colors = ['bg-pink-600 text-white','bg-pink-100 text-pink-700','bg-gray-200 text-gray-700','bg-yellow-100 text-yellow-800','bg-blue-100 text-blue-800'];
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return colors[h % colors.length];
  }
  private welcomeText() { return "Hi! I'm Simple TA. Ask me about your course — due dates, grading, or topics."; }
  private autoTitle(text: string) { return (text.length > 40 ? text.slice(0, 40) + '…' : text) || 'New thread'; }

  private extractCitationsFromReply(reply: string): { docId: number; label: string }[] {
    const citations: { docId: number; label: string }[] = [];
    const docs = this.getScopedDocs();
    for (const doc of docs) {
      if (reply.includes(doc.name)) citations.push({ docId: doc.id, label: `View syllabus: ${doc.name}` });
      const assignments = doc.syllabusDetails?.lmsAssignments || [];
      for (const a of assignments) {
        if (a.name && reply.includes(a.name)) citations.push({ docId: doc.id, label: `Assignment: ${a.name} (${doc.name})` });
      }
    }
    const seen = new Set<string>();
    return citations.filter(c => (seen.has(c.label) ? false : (seen.add(c.label), true)));
  }

  quickPromptClick(prompt: string) { void this.sendPrompt(prompt); }

  handleSuggestionClick(suggestion: string) {
    // Create a new thread and send the suggestion as the first message
    void this.sendPrompt(suggestion);
  }


  // Mock fallback
  private async mockReply(userText: string): Promise<string> {
    await new Promise(r => setTimeout(r, 400));
    return `Here's a quick answer to: "${userText}"\n\n` +
      `Simple TA (scaffold) will use your syllabus and course data to respond. ` +
      `In a future iteration, this will be powered by the configured Gemini model for richer, context-aware help.`;
  }

  // --- Global dropdown close ---
  private closeAllDropdowns() {
    this.termDropdownOpen.set(false);
    this.showSubjectDropdown.set(false);
    this.showOrganizationDropdown.set(false);
    this.showCourseDropdown.set(false);
    this.showSectionDropdown.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.modalOpen()) this.closeCitation();
    if (this.renameModalOpen()) this.cancelRename();
    if (this.deleteModalOpen()) this.cancelDelete();
    this.closeAllDropdowns();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const root: HTMLElement = this.host.nativeElement;
    if (!root.contains(ev.target as Node)) return; // clicks outside component handled elsewhere
    this.closeAllDropdowns();
  }


  // --- Persistence ---
  private storageKey() { return `simple-ta:${this.currentStudentName() || 'anon'}`; }
  private threadsKey() { return `simple-ta:threads:${this.currentStudentName() || 'anon'}`; }
  private persistState() {
    try {
      const data = {
        scopeMode: this.scopeMode(),
        selectedTerms: this.selectedTerms(),
        subject: this.subjectFilter(),
        organization: this.organizationFilter(),
        instructor: this.instructorFilter(),
        selectedCourses: this.selectedCourses(),
        selectedSections: this.selectedSections(),
      };
      localStorage.setItem(this.storageKey(), JSON.stringify(data));
    } catch {}
  }
  private restorePersistedState() {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) {
        const data = JSON.parse(raw);
        if (data.scopeMode) this.scopeMode.set(data.scopeMode);
        if (Array.isArray(data.selectedTerms)) this.selectedTerms.set(data.selectedTerms);
        if (typeof data.subject === 'string') this.subjectFilter.set(data.subject);
        if (typeof data.organization === 'string') this.organizationFilter.set(data.organization);
        if (typeof data.instructor === 'string') this.instructorFilter.set(data.instructor);
        if (Array.isArray(data.selectedCourses)) this.selectedCourses.set(data.selectedCourses);
        if (Array.isArray(data.selectedSections)) this.selectedSections.set(data.selectedSections);
      }
      // Restore threads/messages
      const trRaw = localStorage.getItem(this.threadsKey());
      if (trRaw) {
        const data = JSON.parse(trRaw);
        if (Array.isArray(data.threads)) this.threads.set(data.threads);
        if (typeof data.selectedThreadId === 'number' || data.selectedThreadId === null) {
          this.selectedThreadId.set(data.selectedThreadId);
          const t = this.threads().find(x => x.id === data.selectedThreadId);
          this.messages.set(t ? [...t.messages] : []);
          // Ensure the chat view starts at the bottom on restore
          this.userManuallyScrolled.set(false);
          setTimeout(() => this.triggerAutoScroll(), 0);
        }
      }
    } catch {}
  }

  private persistThreadsSnapshot() {
    try {
      const payload = { threads: this.threads(), selectedThreadId: this.selectedThreadId() };
      localStorage.setItem(this.threadsKey(), JSON.stringify(payload));
    } catch {}
  }

  // --- Organization hierarchy helpers ---
  private flattenHierarchy(nodes: any[], level = 0): { name: string; level: number }[] {
    let result: { name: string; level: number }[] = [];
    for (const node of nodes) {
        result.push({ name: node.name, level });
        if (node.children) {
            result = result.concat(this.flattenHierarchy(node.children, level + 1));
        }
    }
    return result;
  }

  private filterHierarchy(nodes: any[], query: string): any[] {
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
    }, [] as any[]);
  }

  // --- Auto-scroll functionality ---
  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll()) {
      this.performAutoScroll();
      this.shouldAutoScroll.set(false);
    }
  }

  // Enhanced scroll detection and management
  private initializeScrollDetection(): void {
    if (this.messagesContainer?.nativeElement) {
      this.updateScrollPosition();
      this.addScrollListener();
    }
  }

  private addScrollListener(): void {
    const container = this.messagesContainer?.nativeElement;
    if (container) {
      // Use passive listener for better performance
      container.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
    }
  }

  private removeScrollListener(): void {
    const container = this.messagesContainer?.nativeElement;
    if (container) {
      container.removeEventListener('scroll', this.onScroll.bind(this));
    }
  }

  private onScroll(): void {
    // Throttle scroll events to improve performance
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    this.scrollTimeout = setTimeout(() => {
      this.updateScrollPosition();
    }, 50);
  }

  private updateScrollPosition(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Check if user is at bottom (with 50px threshold)
    const atBottom = scrollHeight - scrollTop - clientHeight <= 50;
    this.isUserAtBottom.set(atBottom);
    
    // Detect manual scroll during streaming
    if (this.isStreaming() && !atBottom) {
      // User scrolled away from bottom during streaming
      this.userManuallyScrolled.set(true);
    }
    
    // If user scrolls to bottom, clear manual scroll flag and new messages indicator
    if (atBottom) {
      this.userManuallyScrolled.set(false);
      if (this.hasNewMessages()) {
        this.hasNewMessages.set(false);
      }
    }
    
    this.lastScrollTop = scrollTop;
  }

  private performAutoScroll(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    // During streaming, use smooth scrolling animation
    if (this.isStreaming()) {
      this.startSmoothScrollingDuringStreaming();
      return;
    }

    // For user messages or non-streaming content, respect user position
    if (this.isUserAtBottom() || !this.userManuallyScrolled()) {
      this.scrollToBottomSmooth();
    } else {
      // User has manually scrolled up during non-streaming, show indicator
      this.hasNewMessages.set(true);
    }
  }

  private scrollToBottomSmooth(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    try {
      // Use smooth scrolling for better UX
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
      
      // Fallback for browsers that don't support smooth scrolling
      setTimeout(() => {
        if (container.scrollTop + container.clientHeight < container.scrollHeight - 10) {
          container.scrollTop = container.scrollHeight;
        }
      }, 300);
    } catch (err) {
      // Fallback to instant scroll if smooth scrolling fails
      container.scrollTop = container.scrollHeight;
    }
  }

  private scrollToBottomInstant(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    try {
      // Instant scroll for immediate response during streaming
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      // Silently handle any scroll errors
    }
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    try {
      // Instant scroll for immediate response
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      // Silently handle any scroll errors
    }
  }

  // Public method for manual scroll to bottom (e.g., from UI button)
  scrollToBottomNow(): void {
    this.isUserAtBottom.set(true);
    this.hasNewMessages.set(false);
    this.scrollToBottomSmooth();
  }

  // Check if there are new messages the user should see
  showNewMessagesIndicator(): boolean {
    return this.hasNewMessages() && !this.isUserAtBottom();
  }

  // --- Smooth Scrolling Animation Methods ---
  
  /**
   * Starts smooth scrolling animation during AI streaming
   * Uses requestAnimationFrame for smooth 60fps scrolling
   */
  private startSmoothScrollingDuringStreaming(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    // Stop any existing animation
    this.stopSmoothScrolling();

    // Initialize animation state
    this.lastScrollHeight = container.scrollHeight;
    this.targetScrollTop = container.scrollHeight - container.clientHeight;
    this.currentScrollVelocity = 0;
    this.animationStartTime = performance.now();
    this.lastAnimationTime = this.animationStartTime;

    this.debugScrollState('Starting smooth scroll animation', {
      scrollHeight: container.scrollHeight,
      targetScrollTop: this.targetScrollTop,
      isStreaming: this.isStreaming()
    });

    // Start the animation loop with a small delay to ensure DOM is updated
    setTimeout(() => {
      if (this.isStreaming()) {
        this.animateSmoothScroll();
      }
    }, 16); // ~1 frame delay
  }

  /**
   * Main animation loop for smooth scrolling during streaming
   * Uses physics-based animation for natural movement
   */
  private animateSmoothScroll = (): void => {
    const container = this.messagesContainer?.nativeElement;
    if (!container || !this.isStreaming()) {
      this.stopSmoothScrolling();
      return;
    }

    try {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastAnimationTime;
      this.lastAnimationTime = currentTime;

      const currentScrollTop = container.scrollTop;
      const currentScrollHeight = container.scrollHeight;
      const maxScrollTop = currentScrollHeight - container.clientHeight;
      
      // Update target if content height changed
      if (currentScrollHeight !== this.lastScrollHeight) {
        this.targetScrollTop = maxScrollTop;
        this.lastScrollHeight = currentScrollHeight;
        
        // Add a boost to velocity when content grows to catch up quickly
        this.currentScrollVelocity = Math.max(this.currentScrollVelocity, 2);
        this.debugScrollState('Content growth detected', {
          oldHeight: this.lastScrollHeight,
          newHeight: currentScrollHeight,
          targetScroll: this.targetScrollTop
        });
      }

      // Calculate distance to target
      const distance = this.targetScrollTop - currentScrollTop;
      
      // If we're very close to the target, snap to it and continue monitoring
      if (Math.abs(distance) < 0.5) {
        container.scrollTop = this.targetScrollTop;
        this.currentScrollVelocity = 0;
        
        // Continue animation to monitor for content changes during streaming
        this.scrollAnimationId = requestAnimationFrame(this.animateSmoothScroll);
        return;
      }

      // Enhanced physics-based animation with time-based calculations
      const springStrength = 0.15; // Increased for more responsive movement
      const damping = 0.8; // Slightly reduced for more fluid motion
      
      // Calculate acceleration (spring force)
      const acceleration = distance * springStrength;
      
      // Update velocity with damping and time-based scaling
      this.currentScrollVelocity = (this.currentScrollVelocity + acceleration * deltaTime / 16) * damping;
      
      // Apply velocity to scroll position with time-based scaling
      const newScrollTop = currentScrollTop + this.currentScrollVelocity * deltaTime / 16;
      
      // Apply the scroll with bounds checking
      const boundedScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
      container.scrollTop = boundedScrollTop;
      
      this.debugScrollState('Animation frame', {
        currentScroll: currentScrollTop,
        targetScroll: this.targetScrollTop,
        distance: distance,
        velocity: this.currentScrollVelocity,
        newScroll: boundedScrollTop
      });
      
      // Continue the animation
      this.scrollAnimationId = requestAnimationFrame(this.animateSmoothScroll);
    } catch (error) {
      this.debugScrollState('Animation error, using fallback', error);
      this.fallbackScrollDuringStreaming();
    }
  };

  /**
   * Stops the smooth scrolling animation and cleans up resources
   */
  private stopSmoothScrolling(): void {
    if (this.scrollAnimationId) {
      cancelAnimationFrame(this.scrollAnimationId);
      this.scrollAnimationId = null;
    }
    
    // Reset animation state
    this.currentScrollVelocity = 0;
    this.streamingScrollAnimation = null;
  }

  /**
   * Enhanced scroll trigger with improved timing during streaming
   * More frequent triggers during streaming for smoother following
   */
  private triggerAutoScroll(): void {
    this.shouldAutoScroll.set(true);
    
    // During streaming, also trigger immediate smooth scroll
    if (this.isStreaming()) {
      // Use setTimeout to ensure DOM updates are applied
      setTimeout(() => {
        if (this.isStreaming()) {
          this.startSmoothScrollingDuringStreaming();
        }
      }, 0);
    }
  }

  /**
   * Debug method to log scroll state (can be disabled in production)
   */
  private debugScrollState(message: string, extra?: any): void {
    // Uncomment for debugging
    // console.log(`[SmoothScroll] ${message}`, extra || '');
  }

  /**
   * Fallback scroll method to ensure scrolling works even if animation fails
   */
  private fallbackScrollDuringStreaming(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    // Force instant scroll as fallback
    container.scrollTop = container.scrollHeight;
    this.debugScrollState('Fallback scroll executed', { 
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    });
  }

  /**
   * Enhanced content growth detection during streaming
   * Monitors for changes in scroll height to detect new content
   */
  private detectContentGrowth(): boolean {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return false;

    const currentHeight = container.scrollHeight;
    const hasGrowth = currentHeight > this.lastScrollHeight;
    
    if (hasGrowth && this.isStreaming()) {
      // Content grew during streaming, update target
      this.targetScrollTop = currentHeight - container.clientHeight;
      this.lastScrollHeight = currentHeight;
      
      // Restart animation if needed
      if (!this.scrollAnimationId) {
        this.startSmoothScrollingDuringStreaming();
      }
    }
    
    return hasGrowth;
  }
}
