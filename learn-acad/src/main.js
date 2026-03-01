import './index.css'
import { marked } from 'marked'

// Configure Marked for professional rendering
marked.setOptions({
  gfm: true,
  breaks: true,
  smartyPants: true
})

class LearnACAD {
  constructor() {
    this.content = null
    this.glossary = []
    this.currentChapter = null
    this.loadedChapters = []
    this.isLoadingNext = false

    // Persistence
    this.highlights = JSON.parse(localStorage.getItem('acad-user-highlights')) || {}
    this.completedChapters = JSON.parse(localStorage.getItem('acad-completed')) || []
    this.bookmarks = JSON.parse(localStorage.getItem('acad-bookmarks')) || []
    this.notes = JSON.parse(localStorage.getItem('acad-notes')) || {}
    this.fontSizeScale = localStorage.getItem('acad-font-size') || 'md'

    this.currentSelection = null
    this.previousChapterId = null
    this._touchStartX = 0
    this._touchStartY = 0

    this.elements = {
      navMenu: document.getElementById('nav-menu'),
      mainContent: document.getElementById('main-content'),
      breadcrumb: document.getElementById('breadcrumb'),
      sidebar: document.getElementById('sidebar'),
      menuToggle: document.getElementById('menu-toggle'),
      themeToggle: document.getElementById('theme-toggle'),
      focusToggle: document.getElementById('focus-toggle'),
      searchTrigger: document.getElementById('search-trigger'),
      searchOverlay: document.getElementById('search-overlay'),
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      closeSearch: document.getElementById('close-search'),
      glossaryToggle: document.getElementById('glossary-toggle'),
      glossaryDrawer: document.getElementById('glossary-drawer'),
      glossaryContent: document.getElementById('glossary-content'),
      glossarySearch: document.getElementById('glossary-search'),
      closeGlossary: document.getElementById('close-glossary'),
      notesToggle: document.getElementById('notes-toggle'),
      notesDrawer: document.getElementById('notes-drawer'),
      notesTextarea: document.getElementById('notes-textarea'),
      notesChapterLabel: document.getElementById('notes-chapter-label'),
      closeNotes: document.getElementById('close-notes'),
      notesSaveStatus: document.getElementById('notes-save-status'),
      exportNotes: document.getElementById('export-notes'),
      hlToolbar: document.getElementById('highlight-toolbar'),
      hlRemoveBtn: document.getElementById('hl-remove-btn'),
      progressLabel: document.getElementById('progress-label'),
      progressBarFill: document.getElementById('progress-bar-fill'),
      bookmarksSection: document.getElementById('bookmarks-section'),
      bookmarksList: document.getElementById('bookmarks-list'),
      fontSizeIncrease: document.getElementById('font-size-increase'),
      fontSizeDecrease: document.getElementById('font-size-decrease'),
    }

    this.init()
  }

  async init() {
    try {
      // Fetch content and glossary in parallel
      const [contentRes, glossaryRes] = await Promise.all([
        fetch('/content.json'),
        fetch('/glossary.json')
      ])
      this.content = await contentRes.json()
      this.glossary = await glossaryRes.json()

      this.renderNavigation()
      this.setupEventListeners()
      this.initScrollTracing()
      this.initTheme()
      this.applyFontSize()
      this.initTouchGestures()
      this.updateProgressCounter()
      this.renderBookmarks()

      // Priority: URL hash → last visited chapter → first chapter
      const hash = window.location.hash.slice(1)
      const lastChapter = localStorage.getItem('acad-last-chapter')
      const targetId = (hash && this.findChapter(hash)) ? hash
        : (lastChapter && this.findChapter(lastChapter)) ? lastChapter
          : this.content.parts[0].chapters[0].id

      requestAnimationFrame(() => {
        const skeleton = document.getElementById('skeleton-loader')
        if (skeleton) skeleton.remove()
        this.loadChapter(targetId)
      })
    } catch (error) {
      console.error('Failed to initialize ACAD platform:', error)
      this.elements.mainContent.innerHTML = `
        <div class="error-state">
          <h2>Architecture Loading Error</h2>
          <p>We could not initialize the curriculum database. Please ensure content.json is generated.</p>
          <pre style="text-align:left; font-size:12px; margin-top:20px; color:#ef4444; background: #fee2e2; padding:10px; border-radius:5px; white-space:pre-wrap;">${error.message}\n${error.stack}</pre>
        </div>
      `
    }
  }

  // ─── Theme ───────────────────────────────────────────────────────────────────

  initTheme() {
    const savedTheme = localStorage.getItem('acad-theme') || 'light'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme')
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('acad-theme', newTheme)
  }

  // ─── Font Size ───────────────────────────────────────────────────────────────

  applyFontSize() {
    document.documentElement.setAttribute('data-font-size', this.fontSizeScale)
  }

  adjustFontSize(delta) {
    const scales = ['xs', 'sm', 'md', 'lg', 'xl']
    const idx = scales.indexOf(this.fontSizeScale)
    const newIdx = Math.max(0, Math.min(scales.length - 1, idx + delta))
    this.fontSizeScale = scales[newIdx]
    localStorage.setItem('acad-font-size', this.fontSizeScale)
    this.applyFontSize()
    // Visual feedback on buttons
    const btn = delta > 0 ? this.elements.fontSizeIncrease : this.elements.fontSizeDecrease
    btn.classList.add('fs-btn-active')
    setTimeout(() => btn.classList.remove('fs-btn-active'), 300)
  }

  // ─── Focus Mode ──────────────────────────────────────────────────────────────

  toggleFocusMode() {
    document.body.classList.toggle('focus-mode')
    const isFocus = document.body.classList.contains('focus-mode')
    this.elements.focusToggle.classList.toggle('active', isFocus)
    this.elements.focusToggle.title = isFocus ? 'Exit Focus Mode (Ctrl+Shift+F)' : 'Focus Mode (Ctrl+Shift+F)'
  }

  // ─── Event Listeners ─────────────────────────────────────────────────────────

  setupEventListeners() {
    this.elements.menuToggle.addEventListener('click', () => {
      if (window.innerWidth > 1024) {
        this.elements.sidebar.classList.toggle('collapsed')
      } else {
        this.elements.sidebar.classList.toggle('open')
      }
    })

    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme())
    this.elements.focusToggle.addEventListener('click', () => this.toggleFocusMode())
    this.elements.glossaryToggle.addEventListener('click', () => this.toggleGlossary(true))
    this.elements.closeGlossary.addEventListener('click', () => this.toggleGlossary(false))
    this.elements.notesToggle.addEventListener('click', () => this.toggleNotes(true))
    this.elements.closeNotes.addEventListener('click', () => this.toggleNotes(false))
    this.elements.exportNotes.addEventListener('click', () => this.exportNotes())

    // Font size controls
    this.elements.fontSizeIncrease.addEventListener('click', () => this.adjustFontSize(1))
    this.elements.fontSizeDecrease.addEventListener('click', () => this.adjustFontSize(-1))

    // Note autosave
    let saveTimeout
    this.elements.notesTextarea.addEventListener('input', (e) => {
      this.elements.notesSaveStatus.textContent = 'Saving...'
      this.elements.notesSaveStatus.classList.remove('saved')
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        const chapterId = this.currentChapter ? this.currentChapter.id : '__global__'
        this.notes[chapterId] = e.target.value
        localStorage.setItem('acad-notes', JSON.stringify(this.notes))
        this.elements.notesSaveStatus.textContent = 'Saved locally'
        this.elements.notesSaveStatus.classList.add('saved')
      }, 500)
    })

    // Glossary search filter
    this.elements.glossarySearch.addEventListener('input', (e) => {
      this.renderGlossaryItems(e.target.value)
    })

    // Search listeners
    this.elements.searchTrigger.addEventListener('click', () => this.toggleSearch(true))
    this.elements.closeSearch.addEventListener('click', () => this.toggleSearch(false))
    this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value))

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Cmd/Ctrl+K — search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        this.toggleSearch(true)
      }
      // Escape — close overlays
      if (e.key === 'Escape') {
        this.toggleSearch(false)
        this.toggleGlossary(false)
        this.toggleNotes(false)
        if (document.body.classList.contains('focus-mode')) this.toggleFocusMode()
      }
      // Ctrl+G — glossary
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        this.toggleGlossary(true)
      }
      // Ctrl+N — notes
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        this.toggleNotes(true)
      }
      // Ctrl+B — sidebar collapse
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        if (window.innerWidth > 1024) {
          this.elements.sidebar.classList.toggle('collapsed')
        }
      }
      // Ctrl+Shift+F — focus mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        this.toggleFocusMode()
      }
      // Ctrl+ArrowRight — next chapter
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault()
        this.loadNextChapter()
      }
      // Ctrl+ArrowLeft — previous chapter
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault()
        this.loadPreviousChapter()
      }
    })

    const backToTop = document.getElementById('back-to-top')
    backToTop.addEventListener('click', () => {
      this.elements.mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    })

    // Highlighting
    this.elements.mainContent.addEventListener('mouseup', (e) => {
      if (e.target.closest('.acad-highlight')) return
      this.handleTextSelection()
    })

    document.addEventListener('selectionchange', () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) {
        if (!this.currentSelection || !this.currentSelection.isRemoval) {
          this.hideHighlightToolbar()
        }
      }
    })

    this.elements.hlToolbar.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })

    this.elements.hlToolbar.querySelectorAll('.hl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.applyHighlight(btn.dataset.color)
      })
    })

    this.elements.hlRemoveBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.removeHighlight()
    })

    // Scroll
    this.elements.mainContent.addEventListener('scroll', () => {
      this.updateScrollProgress()
      this.handleContinuousReading()
      backToTop.classList.toggle('visible', this.elements.mainContent.scrollTop > 500)
    })

    // URL hash change (browser back/forward)
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1)
      if (hash && this.findChapter(hash) && !this.loadedChapters.includes(hash)) {
        this.loadedChapters = []
        this.elements.mainContent.innerHTML = ''
        this.loadChapter(hash)
      }
    })
  }

  // ─── Touch Gestures ──────────────────────────────────────────────────────────

  initTouchGestures() {
    const appEl = document.getElementById('app')

    appEl.addEventListener('touchstart', (e) => {
      this._touchStartX = e.touches[0].clientX
      this._touchStartY = e.touches[0].clientY
    }, { passive: true })

    appEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this._touchStartX
      const dy = Math.abs(e.changedTouches[0].clientY - this._touchStartY)
      // Only trigger if horizontal swipe is dominant (not scrolling)
      if (dy > 40) return
      if (dx > 60 && !this.elements.sidebar.classList.contains('open')) {
        this.elements.sidebar.classList.add('open')
      } else if (dx < -60 && this.elements.sidebar.classList.contains('open')) {
        this.elements.sidebar.classList.remove('open')
      }
    }, { passive: true })
  }

  // ─── Continuous Reading ───────────────────────────────────────────────────────

  handleContinuousReading() {
    const el = this.elements.mainContent
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      this.loadNextChapter()
    }
    this.updateActiveUIOnScroll()
  }

  initScrollTracing() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
        }
      })
    }, {
      threshold: 0.1,
      root: this.elements.mainContent
    })

    // Observer for chapter completion (bottom sentinel)
    this.completionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const chapterId = entry.target.dataset.completionChapterId
          if (chapterId) this.markChapterComplete(chapterId)
        }
      })
    }, {
      threshold: 0.9,
      root: this.elements.mainContent
    })
  }

  updateScrollProgress() {
    const el = this.elements.mainContent
    const scrollPos = el.scrollTop
    const totalHeight = el.scrollHeight - el.clientHeight
    const progress = totalHeight > 0 ? (scrollPos / totalHeight) * 100 : 0
    const progressBar = document.getElementById('scroll-progress')
    if (progressBar) progressBar.style.width = `${progress}%`
  }

  // ─── Progress Tracking ───────────────────────────────────────────────────────

  markChapterComplete(chapterId) {
    if (this.completedChapters.includes(chapterId)) return
    this.completedChapters.push(chapterId)
    localStorage.setItem('acad-completed', JSON.stringify(this.completedChapters))

    // Update nav badge
    const navItem = document.querySelector(`.nav-item[data-id="${chapterId}"]`)
    if (navItem) {
      navItem.classList.add('completed')
      if (!navItem.querySelector('.nav-check')) {
        const check = document.createElement('span')
        check.className = 'nav-check'
        check.textContent = '✓'
        navItem.appendChild(check)
      }
    }

    this.updateProgressCounter()
  }

  updateProgressCounter() {
    if (!this.content) return
    let total = 0
    this.content.parts.forEach(p => { total += p.chapters.length })
    const done = this.completedChapters.length
    const pct = total > 0 ? (done / total) * 100 : 0

    if (this.elements.progressLabel) {
      this.elements.progressLabel.textContent = `${done} / ${total} chapters`
    }
    if (this.elements.progressBarFill) {
      this.elements.progressBarFill.style.width = `${pct}%`
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  findChapter(id) {
    for (const part of this.content.parts) {
      const chap = part.chapters.find(c => c.id === id)
      if (chap) return { chap, part }
    }
    return null
  }

  getAllChapterIds() {
    const ids = []
    this.content.parts.forEach(p => p.chapters.forEach(c => ids.push(c.id)))
    return ids
  }

  renderNavigation() {
    let navHtml = ''

    this.content.parts.forEach(part => {
      navHtml += `
        <div class="nav-part">
          <div class="nav-part-title">Part ${part.number}</div>
          <div class="nav-items">
            ${part.chapters.map(chap => {
        const isCompleted = this.completedChapters.includes(chap.id)
        return `
                <div class="nav-item ${isCompleted ? 'completed' : ''}" data-id="${chap.id}" title="${chap.title}">
                  ${chap.title}
                  ${isCompleted ? '<span class="nav-check">✓</span>' : ''}
                </div>
              `
      }).join('')}
          </div>
        </div>
      `
    })

    this.elements.navMenu.innerHTML = navHtml

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.saveCurrentNotes()
        this.loadedChapters = []
        this.elements.mainContent.innerHTML = ''
        this.loadChapter(e.currentTarget.dataset.id)
        if (window.innerWidth <= 1024) {
          this.elements.sidebar.classList.remove('open')
        }
      })
    })
  }

  loadChapter(chapterId) {
    const found = this.findChapter(chapterId)
    if (!found || this.loadedChapters.includes(chapterId)) return

    const { chap: foundChapter, part: foundPart } = found

    this.previousChapterId = this.currentChapter ? this.currentChapter.id : null
    this.currentChapter = foundChapter
    this.loadedChapters.push(chapterId)

    // Persist last visited
    localStorage.setItem('acad-last-chapter', chapterId)

    // Update URL hash (without triggering hashchange listener)
    history.replaceState(null, '', `#${chapterId}`)

    this.renderContent(foundChapter, foundPart)
    this.syncUIState(chapterId, foundPart.number, foundChapter.title)
  }

  loadNextChapter() {
    if (this.isLoadingNext || !this.currentChapter) return

    const allIds = this.getAllChapterIds()
    const currentIndex = allIds.indexOf(this.currentChapter.id)
    if (currentIndex < allIds.length - 1) {
      this.isLoadingNext = true
      const loader = document.createElement('div')
      loader.className = 'scroll-loader'
      loader.innerHTML = 'Designing next module...'
      this.elements.mainContent.appendChild(loader)

      setTimeout(() => {
        loader.remove()
        this.loadChapter(allIds[currentIndex + 1])
        this.isLoadingNext = false
      }, 800)
    }
  }

  loadPreviousChapter() {
    if (!this.currentChapter) return

    const allIds = this.getAllChapterIds()
    const currentIndex = allIds.indexOf(this.currentChapter.id)
    if (currentIndex > 0) {
      this.saveCurrentNotes()
      this.loadedChapters = []
      this.elements.mainContent.innerHTML = ''
      this.loadChapter(allIds[currentIndex - 1])
    }
  }

  syncUIState(chapterId, partNum, chapTitle) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === chapterId)
    })
    this.elements.breadcrumb.innerHTML = `Part ${partNum} &nbsp; / &nbsp; ${chapTitle}`
  }

  updateActiveUIOnScroll() {
    const wrappers = document.querySelectorAll('.chapter-wrapper')
    let mostVisible = null
    let maxVisibleHeight = 0

    const containerTop = this.elements.mainContent.getBoundingClientRect().top
    const containerHeight = this.elements.mainContent.clientHeight

    wrappers.forEach(w => {
      const rect = w.getBoundingClientRect()
      const visibleTop = Math.max(rect.top, containerTop)
      const visibleBottom = Math.min(rect.bottom, containerTop + containerHeight)
      const visibleHeight = Math.max(0, visibleBottom - visibleTop)

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight
        mostVisible = w
      }
    })

    if (mostVisible && mostVisible.dataset.id !== this.currentChapter.id) {
      const found = this.findChapter(mostVisible.dataset.id)
      if (found) {
        this.currentChapter = found.chap
        localStorage.setItem('acad-last-chapter', found.chap.id)
        history.replaceState(null, '', `#${found.chap.id}`)
        this.syncUIState(found.chap.id, found.part.number, found.chap.title)
        // Auto-load notes for newly visible chapter
        if (this.elements.notesDrawer.classList.contains('active')) {
          this._loadNotesForChapter(found.chap.id)
        }
      }
    }
  }

  // ─── Content Rendering ───────────────────────────────────────────────────────

  renderContent(chapter, part) {
    const rawHtml = marked.parse(chapter.content)
    const temp = document.createElement('div')
    temp.innerHTML = rawHtml

    const chapterWrapper = document.createElement('section')
    chapterWrapper.className = 'chapter-wrapper'
    chapterWrapper.dataset.id = chapter.id

    // 1. Hero Section
    const hero = document.createElement('div')
    hero.className = 'chapter-hero'

    const h1 = document.createElement('h1')
    h1.textContent = chapter.title
    hero.appendChild(h1)

    const wordCount = chapter.content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200)
    const meta = document.createElement('div')
    meta.className = 'chapter-meta'
    meta.innerHTML = `<span>${readingTime} MIN READ</span> <span>•</span> <span>${wordCount} WORDS</span>`
    hero.appendChild(meta)

    const firstP = temp.querySelector('p')
    if (firstP) {
      firstP.classList.add('drop-cap', 'intro-line')
      hero.appendChild(firstP.cloneNode(true))
      firstP.remove()
    }

    const contentH1 = temp.querySelector('h1')
    if (contentH1) contentH1.remove()

    // 2. Wrap Sections in Modules
    const contentViewer = document.createElement('div')
    contentViewer.className = 'content-viewer'
    contentViewer.appendChild(hero)

    let currentModule = null
    let introModule = null

    Array.from(temp.children).forEach(child => {
      if (child.tagName === 'H2') {
        if (introModule && introModule.children.length > 0) {
          contentViewer.appendChild(introModule)
          introModule = null
        }
        if (currentModule && currentModule.children.length > 0) {
          contentViewer.appendChild(currentModule)
          const divider = document.createElement('div')
          divider.className = 'strategic-divider'
          divider.innerHTML = '<span>✧</span>'
          contentViewer.appendChild(divider)
        }

        const h2Module = document.createElement('div')
        h2Module.className = 'content-module heading-card'
        child.id = `chap-${chapter.id}-${child.textContent.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`

        // Bookmark button inside heading card
        const bookmarkBtn = document.createElement('button')
        bookmarkBtn.className = 'bookmark-btn'
        bookmarkBtn.title = 'Bookmark this section'
        const sectionTitle = child.textContent
        const sectionId = child.id
        const isBookmarked = this.bookmarks.some(b => b.sectionId === sectionId)
        bookmarkBtn.innerHTML = isBookmarked
          ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
          : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        bookmarkBtn.classList.toggle('bookmarked', isBookmarked)
        bookmarkBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          this.toggleBookmark(chapter.id, sectionId, sectionTitle)
          const nowBookmarked = this.bookmarks.some(b => b.sectionId === sectionId)
          bookmarkBtn.innerHTML = nowBookmarked
            ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
            : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
          bookmarkBtn.classList.toggle('bookmarked', nowBookmarked)
        })
        h2Module.appendChild(bookmarkBtn)
        h2Module.appendChild(child)
        contentViewer.appendChild(h2Module)

        currentModule = document.createElement('div')
        currentModule.className = 'content-module'
      } else if (currentModule) {
        currentModule.appendChild(child)
      } else {
        if (!introModule) {
          introModule = document.createElement('div')
          introModule.className = 'content-module'
        }
        introModule.appendChild(child)
      }
    })

    if (introModule && introModule.children.length > 0) contentViewer.appendChild(introModule)
    if (currentModule && currentModule.children.length > 0) contentViewer.appendChild(currentModule)

    // Merge thin modules
    const allModules = Array.from(contentViewer.querySelectorAll('.content-module:not(.heading-card)'))
    for (let i = allModules.length - 1; i >= 1; i--) {
      const mod = allModules[i]
      const prev = allModules[i - 1]
      if (mod.children.length <= 2 && !mod.classList.contains('heading-card')) {
        Array.from(mod.children).forEach(c => prev.appendChild(c))
        const prevSibling = mod.previousElementSibling
        if (prevSibling && prevSibling.classList.contains('strategic-divider')) {
          prevSibling.remove()
        }
        mod.remove()
      }
    }

    // Sub-dividers before H3
    contentViewer.querySelectorAll('.content-module:not(.heading-card) h3').forEach(h3 => {
      const subDiv = document.createElement('div')
      subDiv.className = 'sub-divider'
      h3.parentNode.insertBefore(subDiv, h3)
    })

    // Safety pass for heading-card class
    contentViewer.querySelectorAll('.content-module').forEach(module => {
      const children = Array.from(module.children)
      if (children.length === 1 && children[0].tagName === 'H2') {
        module.classList.add('heading-card')
      }
    })

    // 3. Special Blocks
    contentViewer.querySelectorAll('.content-module').forEach(module => {
      module.querySelectorAll('p').forEach(p => {
        const text = p.innerText.trim()
        if (text.startsWith('Tip:')) {
          p.className = 'callout callout-tip'
          p.innerHTML = p.innerHTML.replace(/^Tip:/i, '')
        } else if (text.startsWith('Example:')) {
          p.className = 'callout callout-example'
          p.innerHTML = p.innerHTML.replace(/^Example:/i, '')
        } else if (text.startsWith('Quiz:')) {
          this.renderQuiz(p)
        }
      })

      module.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div')
        wrapper.className = 'action-board'
        const copyBtn = document.createElement('button')
        copyBtn.className = 'copy-table-btn'
        copyBtn.innerText = 'Copy Data'
        copyBtn.onclick = () => this.copyTableToClipboard(table)
        table.parentNode.insertBefore(wrapper, table)
        wrapper.appendChild(copyBtn)
        wrapper.appendChild(table)
      })

      const pTags = Array.from(module.querySelectorAll('p'))
      pTags.forEach(p => {
        if (p.innerText.trim().startsWith('Split:')) {
          const splitContainer = document.createElement('div')
          splitContainer.className = 'split-module'
          const left = document.createElement('div')
          left.className = 'split-left'
          left.innerHTML = p.innerHTML.replace(/^Split:/i, '')
          const right = document.createElement('div')
          right.className = 'split-right'
          const next = p.nextElementSibling
          if (next) {
            right.appendChild(next.cloneNode(true))
            next.remove()
          } else {
            right.innerHTML = '<div class="strategic-ornament">DESIGN FOCUS</div>'
          }
          splitContainer.appendChild(left)
          splitContainer.appendChild(right)
          p.parentNode.replaceChild(splitContainer, p)
        }
      })
    })

    // 4. Sub-Navigator
    const h2s = contentViewer.querySelectorAll('h2')
    if (h2s.length > 0) {
      const subNav = document.createElement('div')
      subNav.className = 'chapter-nav'
      h2s.forEach(h2 => {
        const link = document.createElement('a')
        link.href = `#${h2.id}`
        link.innerText = h2.innerText
        subNav.appendChild(link)
      })
      contentViewer.insertBefore(subNav, contentViewer.children[1] || null)
    }

    chapterWrapper.appendChild(contentViewer)

    // 5. Completion Sentinel — invisible element at the very bottom
    const sentinel = document.createElement('div')
    sentinel.className = 'completion-sentinel'
    sentinel.dataset.completionChapterId = chapter.id
    chapterWrapper.appendChild(sentinel)

    this.elements.mainContent.appendChild(chapterWrapper)

    this.applyGlossary(chapterWrapper)
    this.applySmartPunctuation(chapterWrapper)
    this.restoreHighlights(chapter.id, chapterWrapper)

    chapterWrapper.querySelectorAll('.content-module').forEach(m => this.observer.observe(m))
    this.completionObserver.observe(sentinel)

    if (this.loadedChapters.length === 1) {
      this.elements.mainContent.scrollTo(0, 0)
    }

    this.updateScrollProgress()
  }

  // ─── Quiz Rendering ──────────────────────────────────────────────────────────

  renderQuiz(pElement) {
    // Format: Quiz: Question text | OptionA | OptionB* | OptionC
    // asterisk marks the correct answer
    const raw = pElement.innerText.replace(/^Quiz:/i, '').trim()
    const parts = raw.split('|').map(s => s.trim())
    const question = parts[0]
    const options = parts.slice(1)

    const quizBlock = document.createElement('div')
    quizBlock.className = 'quiz-block'
    quizBlock.innerHTML = `<div class="quiz-question">${question}</div>`

    const optionsList = document.createElement('div')
    optionsList.className = 'quiz-options'

    options.forEach((opt, i) => {
      const isCorrect = opt.endsWith('*')
      const label = isCorrect ? opt.slice(0, -1) : opt
      const btn = document.createElement('button')
      btn.className = 'quiz-option'
      btn.textContent = label
      btn.addEventListener('click', () => {
        if (quizBlock.classList.contains('answered')) return
        quizBlock.classList.add('answered')
        if (isCorrect) {
          btn.classList.add('correct')
          quizBlock.querySelector('.quiz-feedback').textContent = '✓ Correct!'
          quizBlock.querySelector('.quiz-feedback').className = 'quiz-feedback feedback-correct'
        } else {
          btn.classList.add('incorrect')
          quizBlock.querySelector('.quiz-feedback').textContent = '✗ Not quite — try reviewing this section.'
          quizBlock.querySelector('.quiz-feedback').className = 'quiz-feedback feedback-incorrect'
          optionsList.querySelectorAll('.quiz-option').forEach((ob, oi) => {
            if (options[oi] && options[oi].endsWith('*')) ob.classList.add('correct')
          })
        }
      })
      optionsList.appendChild(btn)
    })

    const feedback = document.createElement('div')
    feedback.className = 'quiz-feedback'
    quizBlock.appendChild(optionsList)
    quizBlock.appendChild(feedback)
    pElement.parentNode.replaceChild(quizBlock, pElement)
  }

  // ─── Bookmarks ───────────────────────────────────────────────────────────────

  toggleBookmark(chapterId, sectionId, sectionTitle) {
    const existingIdx = this.bookmarks.findIndex(b => b.sectionId === sectionId)
    if (existingIdx >= 0) {
      this.bookmarks.splice(existingIdx, 1)
    } else {
      this.bookmarks.push({ chapterId, sectionId, sectionTitle })
    }
    localStorage.setItem('acad-bookmarks', JSON.stringify(this.bookmarks))
    this.renderBookmarks()
  }

  renderBookmarks() {
    const section = this.elements.bookmarksSection
    const list = this.elements.bookmarksList

    if (this.bookmarks.length === 0) {
      section.style.display = 'none'
      return
    }

    section.style.display = 'block'
    list.innerHTML = this.bookmarks.map(b => `
      <div class="bookmark-item" data-chapter-id="${b.chapterId}" data-section-id="${b.sectionId}">
        <div class="bookmark-item-title">${b.sectionTitle}</div>
        <button class="bookmark-remove" data-section-id="${b.sectionId}" title="Remove bookmark">✕</button>
      </div>
    `).join('')

    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.querySelector('.bookmark-item-title').addEventListener('click', () => {
        const chapterId = item.dataset.chapterId
        const sectionId = item.dataset.sectionId
        // If chapter not loaded, load it first
        if (!this.loadedChapters.includes(chapterId)) {
          this.loadedChapters = []
          this.elements.mainContent.innerHTML = ''
          this.loadChapter(chapterId)
          // Scroll to section after chapter loads
          setTimeout(() => {
            const el = document.getElementById(sectionId)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 400)
        } else {
          const el = document.getElementById(sectionId)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        if (window.innerWidth <= 1024) this.elements.sidebar.classList.remove('open')
      })
      item.querySelector('.bookmark-remove').addEventListener('click', (e) => {
        e.stopPropagation()
        const secId = e.currentTarget.dataset.sectionId
        const bm = this.bookmarks.find(b => b.sectionId === secId)
        if (bm) this.toggleBookmark(bm.chapterId, bm.sectionId, bm.sectionTitle)
        // Update bookmark button in content if visible
        const bookmarkBtn = document.querySelector(`.bookmark-btn[data-section-id="${secId}"]`)
        if (bookmarkBtn) {
          bookmarkBtn.classList.remove('bookmarked')
          bookmarkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        }
      })
    })
  }

  // ─── Notes ───────────────────────────────────────────────────────────────────

  _loadNotesForChapter(chapterId) {
    const saved = this.notes[chapterId] || ''
    this.elements.notesTextarea.value = saved
    if (this.elements.notesChapterLabel) {
      const found = this.findChapter(chapterId)
      this.elements.notesChapterLabel.textContent = found
        ? `Notes for: ${found.chap.title}`
        : 'General Notes'
    }
  }

  toggleNotes(state) {
    this.elements.notesDrawer.classList.toggle('active', state)
    if (state) {
      const chapterId = this.currentChapter ? this.currentChapter.id : '__global__'
      this._loadNotesForChapter(chapterId)
      setTimeout(() => this.elements.notesTextarea.focus(), 100)
    }
  }

  saveCurrentNotes() {
    if (!this.elements.notesTextarea.value && !this.currentChapter) return
    const chapterId = this.currentChapter ? this.currentChapter.id : '__global__'
    const value = this.elements.notesTextarea.value
    if (value || this.notes[chapterId]) {
      this.notes[chapterId] = value
      localStorage.setItem('acad-notes', JSON.stringify(this.notes))
    }
  }

  exportNotes() {
    if (!this.content) return
    let output = `# ACAD Study Notes\n_Exported ${new Date().toLocaleDateString()}_\n\n`

    // Iterate in chapter order
    this.content.parts.forEach(part => {
      part.chapters.forEach(chap => {
        const note = this.notes[chap.id]
        if (note && note.trim()) {
          output += `## ${chap.title}\n\n${note.trim()}\n\n---\n\n`
        }
      })
    })

    const global = this.notes['__global__']
    if (global && global.trim()) {
      output += `## General Notes\n\n${global.trim()}\n`
    }

    if (output.trim() === '# ACAD Study Notes\n_Exported ' + new Date().toLocaleDateString() + '_') {
      alert('No notes to export yet!')
      return
    }

    const blob = new Blob([output], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `acad-notes-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  toggleSearch(state) {
    this.elements.searchOverlay.classList.toggle('active', state)
    if (state) {
      setTimeout(() => this.elements.searchInput.focus(), 100)
    }
  }

  handleSearch(query) {
    if (!query || query.length < 2) {
      this.elements.searchResults.innerHTML = '<div class="search-placeholder">Type to search the ACAD curriculum...</div>'
      return
    }

    const results = []
    const q = query.toLowerCase()

    this.content.parts.forEach(part => {
      part.chapters.forEach(chap => {
        if (chap.title.toLowerCase().includes(q) || chap.content.toLowerCase().includes(q)) {
          const index = chap.content.toLowerCase().indexOf(q)
          const snippetStart = Math.max(0, index - 40)
          const snippet = chap.content.slice(snippetStart, snippetStart + 120).replace(/\n/g, ' ') + '...'
          // Highlight search term in snippet
          const highlightedSnippet = snippet.replace(
            new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            match => `<mark class="search-hit">${match}</mark>`
          )
          results.push({ ...chap, snippet: highlightedSnippet, searchQuery: query })
        }
      })
    })

    this.elements.searchResults.innerHTML = results.length > 0
      ? results.map(res => `
          <div class="search-result-item" data-id="${res.id}" data-query="${res.searchQuery}">
            <span class="res-title">${res.title}</span>
            <span class="res-snippet">${res.snippet}</span>
          </div>
        `).join('')
      : '<div class="search-placeholder">No strategic concepts found for this query.</div>'

    this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const chapterId = item.dataset.id
        const searchQuery = item.dataset.query
        this.toggleSearch(false)
        this.saveCurrentNotes()

        if (!this.loadedChapters.includes(chapterId)) {
          this.loadedChapters = []
          this.elements.mainContent.innerHTML = ''
          this.loadChapter(chapterId)
          setTimeout(() => this._scrollToSearchResult(chapterId, searchQuery), 600)
        } else {
          this._scrollToSearchResult(chapterId, searchQuery)
        }
      })
    })
  }

  _scrollToSearchResult(chapterId, query) {
    const wrapper = document.querySelector(`.chapter-wrapper[data-id="${chapterId}"]`)
    if (!wrapper) return

    const q = query.toLowerCase()
    const allTextContainers = wrapper.querySelectorAll('p, h2, h3, li')
    for (const el of allTextContainers) {
      if (el.textContent.toLowerCase().includes(q)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('search-flash')
        setTimeout(() => el.classList.remove('search-flash'), 2500)
        break
      }
    }
  }

  // ─── Glossary ─────────────────────────────────────────────────────────────────

  toggleGlossary(state) {
    this.elements.glossaryDrawer.classList.toggle('active', state)
    if (state) {
      this.elements.glossarySearch.value = ''
      this.renderGlossaryItems('')
      setTimeout(() => this.elements.glossarySearch.focus(), 100)
    }
  }

  renderGlossaryItems(filter = '') {
    const q = filter.toLowerCase()
    const filtered = q
      ? this.glossary.filter(g => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q))
      : this.glossary

    if (filtered.length === 0) {
      this.elements.glossaryContent.innerHTML = `<div class="glossary-empty">No terms match "${filter}"</div>`
      return
    }

    this.elements.glossaryContent.innerHTML = filtered.map(({ term, definition }) => `
      <div class="glossary-item">
        <h3>${term}</h3>
        <p>${definition}</p>
      </div>
    `).join('')
  }

  applyGlossary(container) {
    const terms = this.glossary.map(g => g.term)
    const glossaryMap = {}
    this.glossary.forEach(g => { glossaryMap[g.term] = g.definition })

    container.querySelectorAll('p').forEach(p => {
      let html = p.innerHTML
      const sortedTerms = [...terms].sort((a, b) => b.length - a.length)

      sortedTerms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b(?![^<]*>)`, 'gi')
        html = html.replace(regex, (match) => {
          return `<span class="glossary-term" data-definition="${glossaryMap[term]}">${match}</span>`
        })
      })
      p.innerHTML = html
    })

    container.querySelectorAll('.glossary-term').forEach(term => {
      term.addEventListener('click', () => {
        this.toggleGlossary(true)
        // Filter to clicked term
        setTimeout(() => {
          this.elements.glossarySearch.value = term.textContent
          this.renderGlossaryItems(term.textContent)
        }, 150)
      })
    })
  }

  // ─── Highlighting ─────────────────────────────────────────────────────────────

  handleTextSelection() {
    setTimeout(() => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount || selection.toString().trim().length === 0) {
        if (!this.currentSelection || !this.currentSelection.isRemoval) {
          return this.hideHighlightToolbar()
        }
        return
      }

      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const chapterItem = container.nodeType === 3
        ? container.parentElement.closest('.chapter-wrapper')
        : container.closest('.chapter-wrapper')

      if (!chapterItem) {
        return this.hideHighlightToolbar()
      }

      const rect = range.getBoundingClientRect()
      const mainRect = this.elements.mainContent.getBoundingClientRect()

      const top = rect.top - mainRect.top + this.elements.mainContent.scrollTop - 45
      const left = rect.left - mainRect.left + (rect.width / 2) - (this.elements.hlToolbar.offsetWidth / 2)

      this.elements.hlToolbar.style.top = `${top}px`
      this.elements.hlToolbar.style.left = `${Math.max(10, left)}px`
      this.elements.hlToolbar.classList.add('active')

      this.currentSelection = {
        chapterId: chapterItem.dataset.id,
        text: selection.toString(),
        range: range
      }
    }, 10)
  }

  hideHighlightToolbar() {
    this.elements.hlToolbar.classList.remove('active')
  }

  applyHighlight(color) {
    if (!this.currentSelection) return

    const { chapterId, text, range } = this.currentSelection
    const id = 'hl-' + Date.now()

    const mark = document.createElement('mark')
    mark.className = `acad-highlight hl-${color}`
    mark.dataset.id = id
    mark.textContent = range.extractContents().textContent

    range.insertNode(mark)
    window.getSelection().removeAllRanges()
    this.hideHighlightToolbar()

    if (!this.highlights[chapterId]) {
      this.highlights[chapterId] = []
    }

    this.highlights[chapterId].push({ id, color, text: text.trim() })
    localStorage.setItem('acad-user-highlights', JSON.stringify(this.highlights))

    mark.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    mark.addEventListener('click', (e) => this.showRemoveToolbar(e, mark))
  }

  showRemoveToolbar(e, markElement) {
    e.stopPropagation()
    e.preventDefault()
    window.getSelection().removeAllRanges()

    const rect = markElement.getBoundingClientRect()
    const mainRect = this.elements.mainContent.getBoundingClientRect()

    const top = rect.top - mainRect.top + this.elements.mainContent.scrollTop - 45
    const left = rect.left - mainRect.left + (rect.width / 2) - (this.elements.hlToolbar.offsetWidth / 2)

    this.elements.hlToolbar.style.top = `${top}px`
    this.elements.hlToolbar.style.left = `${Math.max(10, left)}px`
    this.elements.hlToolbar.classList.add('active')

    this.currentSelection = { isRemoval: true, markElement }
  }

  removeHighlight() {
    if (!this.currentSelection || !this.currentSelection.isRemoval) return

    const mark = this.currentSelection.markElement
    const chapterId = mark.closest('.chapter-wrapper').dataset.id
    const hlId = mark.dataset.id

    if (!mark.parentNode) return

    const textNode = document.createTextNode(mark.textContent)
    mark.parentNode.replaceChild(textNode, mark)
    window.getSelection().removeAllRanges()

    if (this.highlights[chapterId]) {
      this.highlights[chapterId] = this.highlights[chapterId].filter(h => h.id !== hlId)
      localStorage.setItem('acad-user-highlights', JSON.stringify(this.highlights))
    }

    this.hideHighlightToolbar()
    this.currentSelection = null
  }

  restoreHighlights(chapterId, container) {
    const chapterHighlights = this.highlights[chapterId]
    if (!chapterHighlights || chapterHighlights.length === 0) return

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false)
    const textNodes = []
    let node
    while ((node = walker.nextNode())) {
      textNodes.push(node)
    }

    chapterHighlights.forEach(hl => {
      if (!hl.text) return

      for (let i = 0; i < textNodes.length; i++) {
        const textNode = textNodes[i]
        const index = textNode.nodeValue.indexOf(hl.text)

        if (index !== -1) {
          const range = document.createRange()
          range.setStart(textNode, index)
          range.setEnd(textNode, index + hl.text.length)

          const mark = document.createElement('mark')
          mark.className = `acad-highlight hl-${hl.color}`
          mark.dataset.id = hl.id

          range.surroundContents(mark)
          mark.addEventListener('mousedown', (e) => {
            e.preventDefault()
            e.stopPropagation()
          })
          mark.addEventListener('click', (e) => this.showRemoveToolbar(e, mark))

          textNodes.splice(i, 1)
          break
        }
      }
    })
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  applySmartPunctuation(container) {
    container.querySelectorAll('p, li, h1, h2, h3').forEach(el => {
      let text = el.innerHTML
      text = text
        .replace(/--/g, '—')
        .replace(/"([^"]*)"/g, '\u201c$1\u201d')
        .replace(/'([^']*)'/g, '\u2018$1\u2019')
        .replace(/\.\.\./g, '\u2026')
      el.innerHTML = text
    })
  }

  async copyTableToClipboard(table) {
    let markdown = ''
    const rows = Array.from(table.rows)

    rows.forEach((row, i) => {
      const cells = Array.from(row.cells).map(c => c.innerText.trim())
      markdown += `| ${cells.join(' | ')} |\n`
      if (i === 0) {
        markdown += `| ${cells.map(() => '---').join(' | ')} |\n`
      }
    })

    try {
      await navigator.clipboard.writeText(markdown)
      const btn = table.parentElement.querySelector('.copy-table-btn')
      if (btn) {
        const originalText = btn.innerText
        btn.innerText = 'Copied!'
        btn.classList.add('success')
        setTimeout(() => {
          btn.innerText = originalText
          btn.classList.remove('success')
        }, 2000)
      }
    } catch (err) {
      console.error('Failed to copy table:', err)
    }
  }
}

// Start the platform
document.addEventListener('DOMContentLoaded', () => {
  new LearnACAD()
})
