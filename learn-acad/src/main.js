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
      closeGlossary: document.getElementById('close-glossary')
    }

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

      // Load first chapter by default
      if (this.content.parts.length > 0 && this.content.parts[0].chapters.length > 0) {
        this.loadChapter(this.content.parts[0].chapters[0].id)
      }
    } catch (error) {
      console.error('Failed to initialize ACAD platform:', error)
      this.elements.mainContent.innerHTML = `
        <div class="error-state">
          <h2>Architecture Loading Error</h2>
          <p>We could not initialize the curriculum database. Please ensure content.json is generated.</p>
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
      }
      // Glossary drawer toggle (Cmd+G)
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        this.toggleGlossary(true)
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

    let currentModule = null

    Array.from(temp.children).forEach(child => {
      if (child.tagName === 'H2') {
        if (currentModule) {
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

        // Start a new module for following content
        currentModule = document.createElement('div')
        currentModule.className = 'content-module'
      } else if (currentModule) {
        currentModule.appendChild(child)
      } else {
        const ghostModule = document.createElement('div')
        ghostModule.className = 'content-module'
        ghostModule.appendChild(child)
        contentViewer.appendChild(ghostModule)
      }
    })
    if (currentModule && currentModule.children.length > 0) contentViewer.appendChild(currentModule)

    // Mark heading-focused modules
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
