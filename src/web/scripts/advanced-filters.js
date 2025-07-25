/**
 * @file ADVANCED-FILTERS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Advanced Filtering and Search System
 * Provides comprehensive filtering, search, and data manipulation
 * capabilities for the dashboard with real-time updates.
 */

// ------------ MAIN
class AdvancedFilterManager {
  constructor() {
    this.filters = new Map();
    this.searchQuery = '';
    this.activeFilters = {};
    this.filterHistory = [];
    this.savedFilters = new Map();
    this.originalData = null;
    this.filteredData = null;
    
    this.init();
  }

  /**
   * Initialize filter manager
   */
  init() {
    this.setupEventListeners();
    this.loadSavedFilters();
    this.createFilterUI();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search input
    document.addEventListener('input', (e) => {
      if (e.target.matches('#searchInput, .search-input')) {
        this.handleSearch(e.target.value);
      }
    });

    // Filter controls
    document.addEventListener('change', (e) => {
      if (e.target.matches('.filter-select, .filter-checkbox, .filter-range')) {
        this.handleFilterChange(e.target);
      }
    });

    // Advanced filter buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('.filter-action')) {
        this.handleFilterAction(e.target.dataset.action, e.target);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            this.focusSearch();
            break;
          case 'k':
            e.preventDefault();
            this.showFilterPanel();
            break;
        }
      }
    });
  }

  /**
   * Create advanced filter UI
   */
  createFilterUI() {
    const filterPanel = document.createElement('div');
    filterPanel.className = 'advanced-filter-panel';
    filterPanel.id = 'advancedFilterPanel';
    filterPanel.innerHTML = `
      <div class="filter-panel-header">
        <h3>Advanced Filters</h3>
        <button class="close-filter-panel" aria-label="Close">&times;</button>
      </div>
      
      <div class="filter-panel-body">
        <!-- Date Range Filter -->
        <div class="filter-group">
          <label class="filter-label">Date Range</label>
          <div class="date-range-inputs">
            <input type="date" class="filter-input" id="startDate" name="startDate">
            <span>to</span>
            <input type="date" class="filter-input" id="endDate" name="endDate">
          </div>
        </div>

        <!-- Language Filter -->
        <div class="filter-group">
          <label class="filter-label">Languages</label>
          <div class="checkbox-group" id="languageFilters">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Complexity Range -->
        <div class="filter-group">
          <label class="filter-label">Complexity Range</label>
          <div class="range-inputs">
            <input type="range" class="filter-range" id="complexityMin" min="0" max="100" value="0">
            <input type="range" class="filter-range" id="complexityMax" min="0" max="100" value="100">
            <div class="range-values">
              <span id="complexityMinValue">0</span> - <span id="complexityMaxValue">100</span>
            </div>
          </div>
        </div>

        <!-- File Size Filter -->
        <div class="filter-group">
          <label class="filter-label">File Size (lines)</label>
          <select class="filter-select" id="fileSizeFilter">
            <option value="all">All Sizes</option>
            <option value="small">Small (< 100 lines)</option>
            <option value="medium">Medium (100-500 lines)</option>
            <option value="large">Large (500-1000 lines)</option>
            <option value="xlarge">Extra Large (> 1000 lines)</option>
          </select>
        </div>

        <!-- Activity Level -->
        <div class="filter-group">
          <label class="filter-label">Activity Level</label>
          <div class="radio-group">
            <label><input type="radio" name="activityLevel" value="all" checked> All</label>
            <label><input type="radio" name="activityLevel" value="high"> High Activity</label>
            <label><input type="radio" name="activityLevel" value="medium"> Medium Activity</label>
            <label><input type="radio" name="activityLevel" value="low"> Low Activity</label>
          </div>
        </div>

        <!-- Custom Filters -->
        <div class="filter-group">
          <label class="filter-label">Custom Filters</label>
          <div class="custom-filter-builder">
            <select class="filter-field">
              <option value="linesOfCode">Lines of Code</option>
              <option value="complexity">Complexity</option>
              <option value="lastModified">Last Modified</option>
              <option value="fileType">File Type</option>
            </select>
            <select class="filter-operator">
              <option value="equals">Equals</option>
              <option value="greater">Greater Than</option>
              <option value="less">Less Than</option>
              <option value="contains">Contains</option>
            </select>
            <input type="text" class="filter-value" placeholder="Value">
            <button class="btn btn-sm btn-primary" onclick="window.filterManager.addCustomFilter()">Add</button>
          </div>
          <div class="custom-filters-list" id="customFiltersList"></div>
        </div>
      </div>

      <div class="filter-panel-footer">
        <div class="filter-actions">
          <button class="btn btn-secondary" onclick="window.filterManager.clearAllFilters()">Clear All</button>
          <button class="btn btn-secondary" onclick="window.filterManager.saveCurrentFilters()">Save Filters</button>
          <button class="btn btn-primary" onclick="window.filterManager.applyFilters()">Apply Filters</button>
        </div>
        
        <div class="saved-filters">
          <label>Saved Filters:</label>
          <select id="savedFiltersSelect">
            <option value="">Select saved filter...</option>
          </select>
          <button class="btn btn-sm" onclick="window.filterManager.loadSavedFilter()">Load</button>
        </div>
      </div>
    `;

    document.body.appendChild(filterPanel);
    this.populateLanguageFilters();
    this.setupRangeInputs();
  }

  /**
   * Handle search functionality
   */
  handleSearch(query) {
    this.searchQuery = query.toLowerCase();
    
    if (query.length === 0) {
      this.clearSearchHighlights();
      this.applyFilters();
      return;
    }

    if (query.length >= 2) {
      this.performAdvancedSearch(query);
    }
  }

  /**
   * Perform advanced search with multiple criteria
   */
  performAdvancedSearch(query) {
    const searchCriteria = this.parseSearchQuery(query);
    const results = this.searchData(searchCriteria);
    
    this.highlightSearchResults(results);
    this.updateSearchResultsCount(results.length);
    
    // Apply search as a filter
    this.activeFilters.search = searchCriteria;
    this.applyFilters();
  }

  /**
   * Parse search query for advanced search syntax
   */
  parseSearchQuery(query) {
    const criteria = {
      text: [],
      language: [],
      complexity: null,
      fileSize: null,
      dateRange: null
    };

    // Parse special syntax: language:typescript, complexity:>10, size:<500, date:2024-01-01
    const tokens = query.split(/\s+/);
    
    tokens.forEach(token => {
      if (token.includes(':')) {
        const [key, value] = token.split(':');
        
        switch (key.toLowerCase()) {
          case 'language':
          case 'lang':
            criteria.language.push(value);
            break;
          case 'complexity':
            criteria.complexity = this.parseNumericFilter(value);
            break;
          case 'size':
          case 'lines':
            criteria.fileSize = this.parseNumericFilter(value);
            break;
          case 'date':
            criteria.dateRange = this.parseDateFilter(value);
            break;
          default:
            criteria.text.push(token);
        }
      } else {
        criteria.text.push(token);
      }
    });

    return criteria;
  }

  /**
   * Parse numeric filter (e.g., >10, <500, =25)
   */
  parseNumericFilter(value) {
    const match = value.match(/^([><=]+)?(\d+)$/);
    if (!match) return null;

    const operator = match[1] || '=';
    const number = parseInt(match[2]);

    return { operator, value: number };
  }

  /**
   * Parse date filter
   */
  parseDateFilter(value) {
    // Support formats: 2024-01-01, >2024-01-01, <2024-01-01
    const match = value.match(/^([><=]+)?(\d{4}-\d{2}-\d{2})$/);
    if (!match) return null;

    const operator = match[1] || '=';
    const date = new Date(match[2]);

    return { operator, value: date };
  }

  /**
   * Search data based on criteria
   */
  searchData(criteria) {
    if (!this.originalData) return [];

    const results = [];
    
    // Search through different data types
    this.searchInMetrics(criteria, results);
    this.searchInCharts(criteria, results);
    this.searchInInsights(criteria, results);

    return results;
  }

  /**
   * Search in metrics data
   */
  searchInMetrics(criteria, results) {
    const metricCards = document.querySelectorAll('.metric-card');
    
    metricCards.forEach((card, index) => {
      const label = card.querySelector('.metric-label')?.textContent || '';
      const value = card.querySelector('.metric-value')?.textContent || '';
      
      if (this.matchesCriteria(label + ' ' + value, criteria)) {
        results.push({
          type: 'metric',
          element: card,
          index,
          relevance: this.calculateRelevance(label + ' ' + value, criteria)
        });
      }
    });
  }

  /**
   * Search in chart data
   */
  searchInCharts(criteria, results) {
    const chartContainers = document.querySelectorAll('.chart-container');
    
    chartContainers.forEach((container, index) => {
      const title = container.querySelector('.chart-title')?.textContent || '';
      
      if (this.matchesCriteria(title, criteria)) {
        results.push({
          type: 'chart',
          element: container,
          index,
          relevance: this.calculateRelevance(title, criteria)
        });
      }
    });
  }

  /**
   * Search in insights
   */
  searchInInsights(criteria, results) {
    const insightItems = document.querySelectorAll('.insight-item');
    
    insightItems.forEach((item, index) => {
      const title = item.querySelector('.insight-title')?.textContent || '';
      const description = item.querySelector('.insight-description')?.textContent || '';
      const text = title + ' ' + description;
      
      if (this.matchesCriteria(text, criteria)) {
        results.push({
          type: 'insight',
          element: item,
          index,
          relevance: this.calculateRelevance(text, criteria)
        });
      }
    });
  }

  /**
   * Check if content matches search criteria
   */
  matchesCriteria(content, criteria) {
    const lowerContent = content.toLowerCase();
    
    // Check text criteria
    if (criteria.text.length > 0) {
      const textMatch = criteria.text.some(term => 
        lowerContent.includes(term.toLowerCase())
      );
      if (!textMatch) return false;
    }

    // Additional criteria TODO: Would be checked here based on data structure
    return true;
  }

  /**
   * Calculate search relevance score
   */
  calculateRelevance(content, criteria) {
    let score = 0;
    const lowerContent = content.toLowerCase();
    
    criteria.text.forEach(term => {
      const termLower = term.toLowerCase();
      const index = lowerContent.indexOf(termLower);
      
      if (index !== -1) {
        // Higher score for exact matches and earlier positions
        score += index === 0 ? 10 : (5 - Math.min(4, Math.floor(index / 10)));
        
        // Bonus for multiple occurrences
        const occurrences = (lowerContent.match(new RegExp(termLower, 'g')) || []).length;
        score += occurrences * 2;
      }
    });

    return score;
  }

  /**
   * Highlight search results
   */
  highlightSearchResults(results) {
    // Clear previous highlights
    this.clearSearchHighlights();
    
    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    // Highlight top results
    results.slice(0, 10).forEach((result, index) => {
      result.element.classList.add('search-highlight');
      result.element.style.setProperty('--search-rank', index + 1);
    });
  }

  /**
   * Clear search highlights
   */
  clearSearchHighlights() {
    document.querySelectorAll('.search-highlight').forEach(element => {
      element.classList.remove('search-highlight');
      element.style.removeProperty('--search-rank');
    });
  }

  /**
   * Update search results count
   */
  updateSearchResultsCount(count) {
    let counter = document.getElementById('searchResultsCount');
    if (!counter) {
      counter = document.createElement('div');
      counter.id = 'searchResultsCount';
      counter.className = 'search-results-count';
      
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.appendChild(counter);
      }
    }
    
    counter.textContent = count > 0 ? `${count} results` : '';
    counter.style.display = count > 0 ? 'block' : 'none';
  }

  /**
   * Handle filter changes
   */
  handleFilterChange(element) {
    const filterName = element.name || element.id;
    const filterValue = element.type === 'checkbox' ? element.checked : element.value;
    
    this.activeFilters[filterName] = filterValue;
    this.applyFilters();
  }

  /**
   * Apply all active filters
   */
  applyFilters() {
    if (!this.originalData) {
      this.originalData = this.captureCurrentData();
    }

    const filteredData = this.filterData(this.originalData, this.activeFilters);
    this.updateDisplayWithFilteredData(filteredData);
    this.updateFilterSummary();
  }

  /**
   * Capture current dashboard data
   */
  captureCurrentData() {
    return {
      metrics: this.captureMetricsData(),
      charts: this.captureChartsData(),
      insights: this.captureInsightsData()
    };
  }

  /**
   * Filter data based on active filters
   */
  filterData(data, filters) {
    let filtered = JSON.parse(JSON.stringify(data)); // Deep clone

    // Apply each filter
    Object.entries(filters).forEach(([filterName, filterValue]) => {
      filtered = this.applySpecificFilter(filtered, filterName, filterValue);
    });

    return filtered;
  }

  /**
   * Apply specific filter to data
   */
  applySpecificFilter(data, filterName, filterValue) {
    switch (filterName) {
      case 'startDate':
      case 'endDate':
        return this.applyDateFilter(data, filterName, filterValue);
      case 'language':
        return this.applyLanguageFilter(data, filterValue);
      case 'complexity':
        return this.applyComplexityFilter(data, filterValue);
      case 'search':
        return this.applySearchFilter(data, filterValue);
      default:
        return data;
    }
  }

  /**
   * Show filter panel
   */
  showFilterPanel() {
    const panel = document.getElementById('advancedFilterPanel');
    if (panel) {
      panel.classList.add('show');
    }
  }

  /**
   * Hide filter panel
   */
  hideFilterPanel() {
    const panel = document.getElementById('advancedFilterPanel');
    if (panel) {
      panel.classList.remove('show');
    }
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.activeFilters = {};
    this.searchQuery = '';
    
    // Reset UI elements
    document.querySelectorAll('.filter-input, .filter-select').forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = input.type === 'range' ? input.min : '';
      }
    });

    // Clear search input
    const searchInput = document.querySelector('#searchInput, .search-input');
    if (searchInput) {
      searchInput.value = '';
    }

    this.clearSearchHighlights();
    this.applyFilters();
  }

  /**
   * Save current filters
   */
  saveCurrentFilters() {
    const name = prompt('Enter a name for this filter set:');
    if (name) {
      this.savedFilters.set(name, { ...this.activeFilters });
      this.updateSavedFiltersDropdown();
      localStorage.setItem('codePulse_savedFilters', JSON.stringify(Array.from(this.savedFilters.entries())));
    }
  }

  /**
   * Load saved filters
   */
  loadSavedFilter() {
    const select = document.getElementById('savedFiltersSelect');
    const filterName = select.value;
    
    if (filterName && this.savedFilters.has(filterName)) {
      this.activeFilters = { ...this.savedFilters.get(filterName) };
      this.updateFilterUI();
      this.applyFilters();
    }
  }

  /**
   * Focus search input
   */
  focusSearch() {
    const searchInput = document.querySelector('#searchInput, .search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
}
