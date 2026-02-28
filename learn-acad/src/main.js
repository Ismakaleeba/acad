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
    this.currentChapter = null
    this.loadedChapters = [] // Track all chapters currently in DOM
    this.isLoadingNext = false

    this.elements = {
      navMenu: document.getElementById('nav-menu'),
      mainContent: document.getElementById('main-content'),
      breadcrumb: document.getElementById('breadcrumb'),
      sidebar: document.getElementById('sidebar'),
      menuToggle: document.getElementById('menu-toggle'),
      themeToggle: document.getElementById('theme-toggle'),
      searchTrigger: document.getElementById('search-trigger'),
      searchOverlay: document.getElementById('search-overlay'),
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      closeSearch: document.getElementById('close-search'),
      glossaryToggle: document.getElementById('glossary-toggle'),
      glossaryDrawer: document.getElementById('glossary-drawer'),
      glossaryContent: document.getElementById('glossary-content'),
      closeGlossary: document.getElementById('close-glossary'),
      notesToggle: document.getElementById('notes-toggle'),
      notesDrawer: document.getElementById('notes-drawer'),
      notesTextarea: document.getElementById('notes-textarea'),
      closeNotes: document.getElementById('close-notes'),
      notesSaveStatus: document.getElementById('notes-save-status'),
      hlToolbar: document.getElementById('highlight-toolbar'),
      hlRemoveBtn: document.getElementById('hl-remove-btn')
    }

    this.highlights = JSON.parse(localStorage.getItem('acad-user-highlights')) || {}
    this.currentSelection = null

    this.init()
  }

  async init() {
    try {
      const response = await fetch('/content.json')
      this.content = await response.json()
      this.renderNavigation()
      this.setupEventListeners()
      this.initScrollTracing()
      this.initTheme()

      // Load first chapter by default — defer to let browser paint skeleton first
      if (this.content.parts.length > 0 && this.content.parts[0].chapters.length > 0) {
        requestAnimationFrame(() => {
          const skeleton = document.getElementById('skeleton-loader')
          if (skeleton) skeleton.remove()
          this.loadChapter(this.content.parts[0].chapters[0].id)
        })
      }
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

  setupEventListeners() {
    this.elements.menuToggle.addEventListener('click', () => {
      if (window.innerWidth > 1024) {
        this.elements.sidebar.classList.toggle('collapsed')
      } else {
        this.elements.sidebar.classList.toggle('open')
      }
    })

    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme())
    this.elements.glossaryToggle.addEventListener('click', () => this.toggleGlossary(true))
    this.elements.closeGlossary.addEventListener('click', () => this.toggleGlossary(false))
    this.elements.notesToggle.addEventListener('click', () => this.toggleNotes(true))
    this.elements.closeNotes.addEventListener('click', () => this.toggleNotes(false))

    // Note autosave listener
    let saveTimeout
    this.elements.notesTextarea.addEventListener('input', (e) => {
      this.elements.notesSaveStatus.textContent = 'Saving...'
      this.elements.notesSaveStatus.classList.remove('saved')
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        localStorage.setItem('acad-user-notes', e.target.value)
        this.elements.notesSaveStatus.textContent = 'Saved locally'
        this.elements.notesSaveStatus.classList.add('saved')
      }, 500)
    })

    // Search listeners
    this.elements.searchTrigger.addEventListener('click', () => this.toggleSearch(true))
    this.elements.closeSearch.addEventListener('click', () => this.toggleSearch(false))
    this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value))

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        this.toggleSearch(true)
      }
      if (e.key === 'Escape') {
        this.toggleSearch(false)
        this.toggleGlossary(false)
        this.toggleNotes(false)
      }
      // Glossary drawer toggle (Cmd+G)
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        this.toggleGlossary(true)
      }
      // Notes drawer toggle (Cmd+N)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        this.toggleNotes(true)
      }
      // Focus mode toggle (Cmd+B like VS Code)
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        if (window.innerWidth > 1024) {
          this.elements.sidebar.classList.toggle('collapsed')
        }
      }
    })

    const backToTop = document.getElementById('back-to-top')
    backToTop.addEventListener('click', () => {
      this.elements.mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    })

    // Highlighting Logic Listeners
    this.elements.mainContent.addEventListener('mouseup', (e) => {
      // Don't trigger new selection if clicking on an existing highlight
      if (e.target.closest('.acad-highlight')) return
      this.handleTextSelection()
    })

    document.addEventListener('selectionchange', () => {
      const selection = document.getSelection()
      if (!selection || selection.isCollapsed) {
        // Only hide if we aren't explicitly focused on removal
        if (!this.currentSelection || !this.currentSelection.isRemoval) {
          this.hideHighlightToolbar()
        }
      }
    })

    // Completely prevent ANY default mousedown behavior on the toolbar
    // so interacting with it NEVER clears the current document selection
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

    // Scroll progress, reveal logic, and endless scrolling
    this.elements.mainContent.addEventListener('scroll', () => {
      this.updateScrollProgress()
      this.handleContinuousReading()
      backToTop.classList.toggle('visible', this.elements.mainContent.scrollTop > 500)
    })
  }

  handleContinuousReading() {
    const el = this.elements.mainContent
    // If we're near the bottom (100px threshold), load next chapter
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      this.loadNextChapter()
    }

    // Update UI based on visible chapter
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
  }

  updateScrollProgress() {
    const el = this.elements.mainContent
    const scrollPos = el.scrollTop
    const totalHeight = el.scrollHeight - el.clientHeight
    const progress = (scrollPos / totalHeight) * 100
    const progressBar = document.getElementById('scroll-progress')
    if (progressBar) progressBar.style.width = `${progress}%`
  }

  renderNavigation() {
    let navHtml = ''

    this.content.parts.forEach(part => {
      navHtml += `
        <div class="nav-part">
          <div class="nav-part-title">Part ${part.number}</div>
          <div class="nav-items">
            ${part.chapters.map(chap => `
              <div class="nav-item" data-id="${chap.id}" title="${chap.title}">
                ${chap.title}
              </div>
            `).join('')}
          </div>
        </div>
      `
    })

    this.elements.navMenu.innerHTML = navHtml

    // Add click listeners to nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // When clicking, we clear and load fresh
        this.loadedChapters = []
        this.elements.mainContent.innerHTML = ''
        this.loadChapter(e.target.dataset.id)
        if (window.innerWidth <= 1024) {
          this.elements.sidebar.classList.remove('open')
        }
      })
    })
  }

  loadChapter(chapterId) {
    let foundChapter = null
    let foundPart = null

    for (const part of this.content.parts) {
      foundChapter = part.chapters.find(c => c.id === chapterId)
      if (foundChapter) {
        foundPart = part
        break
      }
    }

    if (!foundChapter || this.loadedChapters.includes(chapterId)) return

    this.currentChapter = foundChapter
    this.loadedChapters.push(chapterId)

    this.renderContent(foundChapter, foundPart)
    this.syncUIState(chapterId, foundPart.number, foundChapter.title)
  }

  loadNextChapter() {
    if (this.isLoadingNext) return

    // Find index of current chapter
    let allChapters = []
    this.content.parts.forEach(p => {
      p.chapters.forEach(c => allChapters.push(c.id))
    })

    const currentIndex = allChapters.indexOf(this.currentChapter.id)
    if (currentIndex < allChapters.length - 1) {
      this.isLoadingNext = true
      // Visual indicator for loading
      const loader = document.createElement('div')
      loader.className = 'scroll-loader'
      loader.innerHTML = 'Designing next module...'
      this.elements.mainContent.appendChild(loader)

      setTimeout(() => {
        loader.remove()
        this.loadChapter(allChapters[currentIndex + 1])
        this.isLoadingNext = false
      }, 800)
    }
  }

  syncUIState(chapterId, partNum, chapTitle) {
    // Update active state in nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === chapterId)
    })

    // Update breadcrumb
    this.elements.breadcrumb.innerHTML = `Part ${partNum} &nbsp; / &nbsp; ${chapTitle}`
  }

  updateActiveUIOnScroll() {
    // Determine which chapter wrapper is most visible
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
      const chapterId = mostVisible.dataset.id
      let foundChap = null
      let foundPart = null

      for (const part of this.content.parts) {
        foundChap = part.chapters.find(c => c.id === chapterId)
        if (foundChap) {
          foundPart = part
          break
        }
      }

      if (foundChap) {
        this.currentChapter = foundChap
        this.syncUIState(chapterId, foundPart.number, foundChap.title)
      }
    }
  }

  renderContent(chapter, part) {
    const rawHtml = marked.parse(chapter.content)
    const temp = document.createElement('div')
    temp.innerHTML = rawHtml

    const chapterWrapper = document.createElement('section')
    chapterWrapper.className = 'chapter-wrapper'
    chapterWrapper.dataset.id = chapter.id

    // 1. Create Hero Section
    const hero = document.createElement('div')
    hero.className = 'chapter-hero'

    // Chapter Title
    const h1 = document.createElement('h1')
    h1.textContent = chapter.title
    hero.appendChild(h1)

    // Reading Time Estimate
    const wordCount = chapter.content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200)
    const meta = document.createElement('div')
    meta.className = 'chapter-meta'
    meta.innerHTML = `<span>${readingTime} MIN READ</span> <span>•</span> <span>${wordCount} WORDS</span>`
    hero.appendChild(meta)

    // Drop Cap Intro logic
    const firstP = temp.querySelector('p')
    if (firstP) {
      firstP.classList.add('drop-cap', 'intro-line')
      hero.appendChild(firstP.cloneNode(true))
      firstP.remove()
    }

    // Remove any accidental H1s in content
    const contentH1 = temp.querySelector('h1')
    if (contentH1) contentH1.remove()

    // 2. Wrap Sections in Modules
    const contentViewer = document.createElement('div')
    contentViewer.className = 'content-viewer'
    contentViewer.appendChild(hero)

    // FIX 1: Collect all pre-H2 elements into a SINGLE intro module
    let currentModule = null
    let introModule = null // accumulator for pre-H2 content

    Array.from(temp.children).forEach(child => {
      if (child.tagName === 'H2') {
        // Flush intro module if we haven't yet
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

        // Create an isolated heading card for the H2
        const h2Module = document.createElement('div')
        h2Module.className = 'content-module heading-card'
        child.id = `chap-${chapter.id}-${child.textContent.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
        h2Module.appendChild(child)
        contentViewer.appendChild(h2Module)

        // Start a fresh content module for following content
        currentModule = document.createElement('div')
        currentModule.className = 'content-module'
      } else if (currentModule) {
        currentModule.appendChild(child)
      } else {
        // Pre-H2 content: gather into one shared intro module
        if (!introModule) {
          introModule = document.createElement('div')
          introModule.className = 'content-module'
        }
        introModule.appendChild(child)
      }
    })

    // Flush remaining intro or current module
    if (introModule && introModule.children.length > 0) contentViewer.appendChild(introModule)
    if (currentModule && currentModule.children.length > 0) contentViewer.appendChild(currentModule)

    // FIX 2: Merge thin modules (<=2 children, no heading-card) into their predecessor
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

    // FIX 3: Inject sub-divider ornaments before each H3 within modules
    contentViewer.querySelectorAll('.content-module:not(.heading-card) h3').forEach(h3 => {
      const subDiv = document.createElement('div')
      subDiv.className = 'sub-divider'
      h3.parentNode.insertBefore(subDiv, h3)
    })

    // Mark heading-focused modules (safety pass)
    contentViewer.querySelectorAll('.content-module').forEach(module => {
      const children = Array.from(module.children)
      if (children.length === 1 && children[0].tagName === 'H2') {
        module.classList.add('heading-card')
      }
    })

    // 3. Post-Process Special Blocks
    contentViewer.querySelectorAll('.content-module').forEach(module => {
      module.querySelectorAll('p').forEach(p => {
        const text = p.innerText.trim()
        if (text.startsWith('Tip:')) {
          p.className = 'callout callout-tip'
          p.innerHTML = p.innerHTML.replace(/^Tip:/i, '')
        } else if (text.startsWith('Example:')) {
          p.className = 'callout callout-example'
          p.innerHTML = p.innerHTML.replace(/^Example:/i, '')
        }
      })

      module.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div')
        wrapper.className = 'action-board'

        // Add Copy Button
        const copyBtn = document.createElement('button')
        copyBtn.className = 'copy-table-btn'
        copyBtn.innerText = 'Copy Data'
        copyBtn.onclick = () => this.copyTableToClipboard(table)

        table.parentNode.insertBefore(wrapper, table)
        wrapper.appendChild(copyBtn)
        wrapper.appendChild(table)
      })

      // Handle Split Sections
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
          // If there's a following element, move it into the right panel
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

    // 4. Build Sub-Navigator (only on top chapter for now or per wrapper)
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
    this.elements.mainContent.appendChild(chapterWrapper)

    // apply glossary tooltips
    this.applyGlossary(chapterWrapper)

    // apply smart punctuation
    this.applySmartPunctuation(chapterWrapper)

    // Restore saved highlights
    this.restoreHighlights(chapter.id, chapterWrapper)

    // Observe modules for reveal animations
    chapterWrapper.querySelectorAll('.content-module').forEach(m => this.observer.observe(m))

    // If it's the first chapter loaded, reset scroll
    if (this.loadedChapters.length === 1) {
      this.elements.mainContent.scrollTo(0, 0)
    }

    this.updateScrollProgress()
  }

  toggleSearch(state) {
    this.elements.searchOverlay.classList.toggle('active', state)
    if (state) {
      setTimeout(() => this.elements.searchInput.focus(), 100)
    }
  }

  toggleGlossary(state) {
    this.elements.glossaryDrawer.classList.toggle('active', state)
    if (state && !this.elements.glossaryContent.innerHTML.trim()) {
      this.renderGlossaryItems()
    }
  }

  toggleNotes(state) {
    this.elements.notesDrawer.classList.toggle('active', state)
    if (state) {
      // Load saved notes when opening
      const savedNotes = localStorage.getItem('acad-user-notes')
      if (savedNotes !== null) {
        this.elements.notesTextarea.value = savedNotes
      }
      setTimeout(() => this.elements.notesTextarea.focus(), 100)
    }
  }

  renderGlossaryItems() {
    const glossary = {
      'Action Board': 'A visual strategic tool used in ACAD to map a complete system design, from problem to impact.',
      'Comparative Advantage': 'The definitive reason why one system design outperforms another in a specific context.',
      'Impact Logic': 'The traceable sequence linking specific activities to measurable long-term changes.',
      'Scalability': 'The ability of a system to grow or be replicated across different geographies or populations.',
      'Feasibility': 'The operational reality and practical likelihood of a system working in the real world.',
      'Root Cause': 'The underlying structural issue that must be addressed to create sustainable impact.',
      'Strategic Island': 'A modular approach to content design where concepts are grouped into distinct, navigable cards.',
      'Continuous Reading': 'An app-like scrolling engine that pre-loads curriculum modules for a seamless flow.',
      'Luxury Academic': 'The design philosophy focusing on premium typography, high-contrast aesthetics, and prestigious flourishes.'
    }

    this.elements.glossaryContent.innerHTML = Object.entries(glossary).map(([term, def]) => `
      <div class="glossary-item">
        <h3>${term}</h3>
        <p>${def}</p>
      </div>
    `).join('')
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
          results.push({ ...chap, snippet })
        }
      })
    })

    this.elements.searchResults.innerHTML = results.length > 0
      ? results.map(res => `
          <div class="search-result-item" data-id="${res.id}">
            <span class="res-title">${res.title}</span>
            <span class="res-snippet">${res.snippet}</span>
          </div>
        `).join('')
      : '<div class="search-placeholder">No strategic concepts found for this query.</div>'

    this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        this.loadChapter(item.dataset.id)
        this.toggleSearch(false)
      })
    })
  }

  applyGlossary(container) {
    const glossary = {
      'Action Board': 'A visual strategic tool used in ACAD to map a complete system design, from problem to impact.',
      'Comparative Advantage': 'The definitive reason why one system design outperforms another in a specific context.',
      'Impact Logic': 'The traceable sequence linking specific activities to measurable long-term changes.',
      'Scalability': 'The ability of a system to grow or be replicated across different geographies or populations.',
      'Feasibility': 'The operational reality and practical likelihood of a system working in the real world.',
      'Root Cause': 'The underlying structural issue that must be addressed to create sustainable impact.'
    }

    const terms = Object.keys(glossary)

    // We only want to replace text in paragraphs, not in headings or tables
    container.querySelectorAll('p').forEach(p => {
      let html = p.innerHTML
      // Sort terms by length descending to match longest phrases first (e.g., "Action Board" before "Board")
      const sortedTerms = terms.sort((a, b) => b.length - a.length)

      sortedTerms.forEach(term => {
        // Use a regex that ensures we aren't already inside a tag
        const regex = new RegExp(`\\b${term}\\b(?![^<]*>)`, 'gi')
        html = html.replace(regex, (match) => {
          return `<span class="glossary-term" data-definition="${glossary[term]}">${match}</span>`
        })
      })
      p.innerHTML = html
    })

    // Make terms clickable to open drawer
    container.querySelectorAll('.glossary-term').forEach(term => {
      term.addEventListener('click', () => {
        this.toggleGlossary(true)
      })
    })
  }

  // --- Highlighting Engine ---
  handleTextSelection() {
    // Wait briefly to ensure default selection events have settled
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

      // Position toolbar above selection
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

    // Create the visual mark element
    const mark = document.createElement('mark')
    mark.className = `acad-highlight hl-${color}`
    mark.dataset.id = id
    mark.textContent = range.extractContents().textContent

    range.insertNode(mark)
    window.getSelection().removeAllRanges()
    this.hideHighlightToolbar()

    // Save to persistence
    if (!this.highlights[chapterId]) {
      this.highlights[chapterId] = []
    }

    this.highlights[chapterId].push({
      id,
      color,
      text: text.trim()
    })
    localStorage.setItem('acad-user-highlights', JSON.stringify(this.highlights))

    // Add remove listener to new mark
    mark.addEventListener('mousedown', (e) => {
      e.preventDefault() // prevent selection collapse
      e.stopPropagation()
    })
    mark.addEventListener('click', (e) => this.showRemoveToolbar(e, mark))
  }

  showRemoveToolbar(e, markElement) {
    e.stopPropagation()
    e.preventDefault()

    // Clear any active document text selection immediately so they don't fight
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

    // Check if the mark is still attached
    if (!mark.parentNode) return

    // Remove visual mark but keep text
    const textNode = document.createTextNode(mark.textContent)
    mark.parentNode.replaceChild(textNode, mark)

    // Unselect the text so we don't immediately pop the create toolbar back up
    window.getSelection().removeAllRanges()

    // Remove from persistence
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

    // Attempt to restore each highlight by finding exact text matches
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
            e.preventDefault() // prevent selection collapse
            e.stopPropagation()
          })
          mark.addEventListener('click', (e) => this.showRemoveToolbar(e, mark))

          // Re-evaluate text nodes since we split one
          textNodes.splice(i, 1)
          break; // Move to next highlight once applied
        }
      }
    })

  }

  applySmartPunctuation(container) {
    container.querySelectorAll('p, li, h1, h2, h3').forEach(el => {
      let text = el.innerHTML
      text = text
        .replace(/--/g, '—') // md-style dashes
        .replace(/"([^"]*)"/g, '“$1”') // double quotes
        .replace(/'([^']*)'/g, '‘$1’') // single quotes
        .replace(/\.\.\./g, '…') // ellipses
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
