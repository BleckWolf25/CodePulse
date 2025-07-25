/**
 * @file THEME-MANAGER.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Theme Manager
 * Handles theme switching, persistence, and system preference detection
 * Provides smooth transitions between light and dark themes
 */

// ------------ MAIN
class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.systemPreference = null;
    this.storageKey = 'codepulse-theme';
    this.accessibilityStorageKey = 'codepulse-accessibility';

    // Accessibility preferences
    this.accessibilityFeatures = {
      reducedMotion: false,
      highContrast: false,
      colorBlindness: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
      fontSize: 'normal', // 'small', 'normal', 'large', 'extra-large'
      focusIndicators: true,
      screenReader: false
    };

    // Theme validation and integration
    this.integrationStatus = {
      backendConnected: false,
      configSynced: false,
      lastSyncTime: null
    };

    this.init();
  }

  /**
   * Initialize theme manager with accessibility
   */
  init() {
    this.detectSystemPreferences();
    this.loadSavedTheme();
    this.loadAccessibilityPreferences();
    this.addTransitionStyles();
    this.setupEventListeners();
    this.setupAccessibilityListeners();
    this.setupKeyboardNavigation();
    this.applyTheme();
    this.applyAccessibilityFeatures();
    this.validateThemeIntegration();
  }

  /**
   * Detect system preferences including accessibility
   */
  detectSystemPreferences() {
    // Color scheme detection
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPreference = darkModeQuery.matches ? 'dark' : 'light';

      // Listen for system preference changes
      darkModeQuery.addEventListener('change', (e) => {
        this.systemPreference = e.matches ? 'dark' : 'light';
        if (!this.currentTheme || this.currentTheme === 'auto') {
          this.applyTheme();
        }
      });

      // Detect reduced motion preference
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.accessibilityFeatures.reducedMotion = reducedMotionQuery.matches;

      reducedMotionQuery.addEventListener('change', (e) => {
        this.accessibilityFeatures.reducedMotion = e.matches;
        this.applyAccessibilityFeatures();
      });

      // Detect high contrast preference
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      this.accessibilityFeatures.highContrast = highContrastQuery.matches;

      highContrastQuery.addEventListener('change', (e) => {
        this.accessibilityFeatures.highContrast = e.matches;
        this.applyAccessibilityFeatures();
      });

      // Detect screen reader usage
      this.detectScreenReader();
    } else {
      this.systemPreference = 'light';
    }
  }

  /**
   * Load saved theme from storage
   */
  loadSavedTheme() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved && ['light', 'dark', 'auto'].includes(saved)) {
        this.currentTheme = saved;
      } else {
        this.currentTheme = 'auto';
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      this.currentTheme = 'auto';
    }
  }

  /**
   * Save theme preference to storage
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.storageKey, theme);
      this.currentTheme = theme;
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  /**
   * Get effective theme (resolves 'auto' to actual theme)
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemPreference || 'light';
    }
    return this.currentTheme;
  }

  /**
   * Apply theme to document
   */
  applyTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    const root = document.documentElement;
    
    // Remove existing theme attributes
    root.removeAttribute('data-theme');
    
    // Apply new theme
    if (effectiveTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    }
    
    // Update theme toggle button state
    this.updateThemeToggle();
    
    // Dispatch theme change event
    this.dispatchThemeChangeEvent(effectiveTheme);
    
    // Animate theme transition
    this.animateThemeTransition();
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const currentEffective = this.getEffectiveTheme();
    const newTheme = currentEffective === 'dark' ? 'light' : 'dark';

    this.saveTheme(newTheme);
    this.applyTheme();
    this.notifyExtension(newTheme);

    return newTheme;
  }

  /**
   * Set specific theme
   */
  setTheme(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }

    this.saveTheme(theme);
    this.applyTheme();
    this.notifyExtension(theme);
  }

  /**
   * Update theme toggle button appearance
   */
  updateThemeToggle() {
    const toggles = document.querySelectorAll('.theme-toggle');
    const effectiveTheme = this.getEffectiveTheme();

    toggles.forEach(toggle => {
      toggle.setAttribute('aria-label',
        effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
      toggle.setAttribute('title',
        effectiveTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );

      // Update icon
      const icon = toggle.querySelector('.theme-icon');
      if (icon) {
        icon.textContent = effectiveTheme === 'dark' ? '☀️' : '🌙';
      }
    });
  }

  /**
   * Animate theme transition
   */
  animateThemeTransition() {
    // Add transition class to body for smooth color transitions
    document.body.classList.add('theme-transitioning');
    
    // Remove transition class after animation completes
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, 300);
  }

  /**
   * Dispatch custom theme change event
   */
  dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent('themechange', {
      detail: {
        theme: theme,
        previousTheme: this.previousTheme || 'light'
      }
    });
    
    this.previousTheme = theme;
    window.dispatchEvent(event);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Theme toggle buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('.theme-toggle') || e.target.closest('.theme-toggle')) {
        e.preventDefault();
        this.toggleTheme();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + T for theme toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.toggleTheme();
      }
    });

    // Listen for theme change events from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.command === 'setTheme' && message.theme) {
        this.setTheme(message.theme);
      }
    });
  }

  /**
   * Get current theme info
   */
  getThemeInfo() {
    return {
      current: this.currentTheme,
      effective: this.getEffectiveTheme(),
      system: this.systemPreference,
      isAuto: this.currentTheme === 'auto'
    };
  }

  /**
   * Add CSS for theme transitions
   */
  addTransitionStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .theme-transitioning,
      .theme-transitioning * {
        transition: background-color 300ms ease-in-out,
                    color 300ms ease-in-out,
                    border-color 300ms ease-in-out,
                    box-shadow 300ms ease-in-out !important;
      }
      
      .theme-transitioning .chart-container canvas {
        transition: opacity 300ms ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Notify extension about theme change
   */
  notifyExtension(theme) {
    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({
        command: 'saveTheme',
        theme: theme,
        accessibility: this.accessibilityFeatures
      });
    }
  }

  /**
   * Load accessibility preferences from storage
   */
  loadAccessibilityPreferences() {
    try {
      const saved = localStorage.getItem(this.accessibilityStorageKey);
      if (saved) {
        const preferences = JSON.parse(saved);
        this.accessibilityFeatures = { ...this.accessibilityFeatures, ...preferences };
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    }
  }

  /**
   * Save accessibility preferences to storage
   */
  saveAccessibilityPreferences() {
    try {
      localStorage.setItem(this.accessibilityStorageKey, JSON.stringify(this.accessibilityFeatures));
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }

  /**
   * Apply accessibility features
   */
  applyAccessibilityFeatures() {
    const root = document.documentElement;

    // Reduced motion
    if (this.accessibilityFeatures.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // High contrast
    if (this.accessibilityFeatures.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Color blindness support
    root.setAttribute('data-colorblind', this.accessibilityFeatures.colorBlindness);

    // Font size
    root.setAttribute('data-font-size', this.accessibilityFeatures.fontSize);

    // Focus indicators
    if (this.accessibilityFeatures.focusIndicators) {
      root.classList.add('style-focus');
    } else {
      root.classList.remove('style-focus');
    }

    // Screen reader support
    if (this.accessibilityFeatures.screenReader) {
      root.classList.add('screen-reader-mode');
    } else {
      root.classList.remove('screen-reader-mode');
    }

    this.saveAccessibilityPreferences();
  }

  /**
   * Setup accessibility event listeners
   */
  setupAccessibilityListeners() {
    // Listen for accessibility preference changes
    document.addEventListener('click', (e) => {
      if (e.target.matches('.accessibility-toggle')) {
        const feature = e.target.dataset.feature;
        const value = e.target.dataset.value || !this.accessibilityFeatures[feature];
        this.setAccessibilityFeature(feature, value);
      }
    });

    // Listen for font size changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('.font-size-selector')) {
        this.setAccessibilityFeature('fontSize', e.target.value);
      }
    });

    // Listen for color blindness mode changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('.colorblind-selector')) {
        this.setAccessibilityFeature('colorBlindness', e.target.value);
      }
    });
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt + H for high contrast toggle
      if (e.altKey && e.key === 'h') {
        e.preventDefault();
        this.toggleAccessibilityFeature('highContrast');
      }

      // Alt + M for reduced motion toggle
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        this.toggleAccessibilityFeature('reducedMotion');
      }

      // Alt + F for focus indicators toggle
      if (e.altKey && e.key === 'f') {
        e.preventDefault();
        this.toggleAccessibilityFeature('focusIndicators');
      }

      // Alt + Plus/Minus for font size
      if (e.altKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.increaseFontSize();
      }
      if (e.altKey && e.key === '-') {
        e.preventDefault();
        this.decreaseFontSize();
      }
    });

    // Improve focus management
    this.setupFocusManagement();
  }

  /**
   * Setup focus management for better accessibility
   */
  setupFocusManagement() {
    // Add focus trap for modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('.modal:not([hidden])');
        if (modal) {
          this.trapFocus(e, modal);
        }
      }
    });

    // Add skip links
    this.addSkipLinks();
  }

  /**
   * Detect screen reader usage
   */
  detectScreenReader() {
    // Check for common screen reader indicators
    const indicators = [
      navigator.userAgent.includes('NVDA'),
      navigator.userAgent.includes('JAWS'),
      navigator.userAgent.includes('VoiceOver'),
      window.speechSynthesis && window.speechSynthesis.getVoices().length > 0,
      document.querySelector('[aria-live]') !== null
    ];

    this.accessibilityFeatures.screenReader = indicators.some(Boolean);
  }

  /**
   * Validate theme integration with backend
   */
  validateThemeIntegration() {
    // Check if WebSocket connection exists
    if (window.websocketClient) {
      this.integrationStatus.backendConnected = window.websocketClient.isConnected();

      // Request theme sync from backend
      window.websocketClient.send({
        type: 'theme',
        command: 'sync',
        data: {
          currentTheme: this.currentTheme,
          effectiveTheme: this.getEffectiveTheme(),
          accessibility: this.accessibilityFeatures
        }
      });
    }

    // Validate CSS variables are properly loaded
    this.validateCSSVariables();

    // Check for theme consistency
    this.checkThemeConsistency();
  }

  /**
   * Set accessibility feature
   */
  setAccessibilityFeature(feature, value) {
    if (feature in this.accessibilityFeatures) {
      this.accessibilityFeatures[feature] = value;
      this.applyAccessibilityFeatures();
      this.notifyExtension(this.currentTheme);
    }
  }

  /**
   * Toggle accessibility feature
   */
  toggleAccessibilityFeature(feature) {
    if (feature in this.accessibilityFeatures && typeof this.accessibilityFeatures[feature] === 'boolean') {
      this.accessibilityFeatures[feature] = !this.accessibilityFeatures[feature];
      this.applyAccessibilityFeatures();
      this.notifyExtension(this.currentTheme);
    }
  }

  /**
   * Increase font size
   */
  increaseFontSize() {
    const sizes = ['small', 'normal', 'large', 'extra-large'];
    const currentIndex = sizes.indexOf(this.accessibilityFeatures.fontSize);
    if (currentIndex < sizes.length - 1) {
      this.setAccessibilityFeature('fontSize', sizes[currentIndex + 1]);
    }
  }

  /**
   * Decrease font size
   */
  decreaseFontSize() {
    const sizes = ['small', 'normal', 'large', 'extra-large'];
    const currentIndex = sizes.indexOf(this.accessibilityFeatures.fontSize);
    if (currentIndex > 0) {
      this.setAccessibilityFeature('fontSize', sizes[currentIndex - 1]);
    }
  }

  /**
   * Trap focus within an element
   */
  trapFocus(event, element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Add skip links for better navigation
   */
  addSkipLinks() {
    if (document.querySelector('.skip-links')) return;

    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#theme-controls" class="skip-link">Skip to theme controls</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Validate CSS variables are loaded
   */
  validateCSSVariables() {
    const testElement = document.createElement('div');
    testElement.style.display = 'none';
    document.body.appendChild(testElement);

    const computedStyle = getComputedStyle(testElement);
    const primaryColor = computedStyle.getPropertyValue('--color-primary');

    if (!primaryColor) {
      console.warn('CSS variables not loaded properly');
      this.integrationStatus.configSynced = false;
    } else {
      this.integrationStatus.configSynced = true;
    }

    document.body.removeChild(testElement);
  }

  /**
   * Check theme consistency across components
   */
  checkThemeConsistency() {
    const effectiveTheme = this.getEffectiveTheme();
    const rootTheme = document.documentElement.getAttribute('data-theme');

    if ((effectiveTheme === 'dark' && rootTheme !== 'dark') ||
        (effectiveTheme === 'light' && rootTheme === 'dark')) {
      console.warn('Theme inconsistency detected, reapplying theme');
      this.applyTheme();
    }
  }

  /**
   * Get accessibility status
   */
  getAccessibilityStatus() {
    return {
      features: { ...this.accessibilityFeatures },
      systemPreferences: {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: window.matchMedia('(prefers-contrast: high)').matches,
        colorScheme: this.systemPreference
      },
      integration: { ...this.integrationStatus }
    };
  }

  /**
   * Export theme and accessibility settings
   */
  exportSettings() {
    return {
      theme: {
        current: this.currentTheme,
        effective: this.getEffectiveTheme(),
        system: this.systemPreference
      },
      accessibility: { ...this.accessibilityFeatures },
      integration: { ...this.integrationStatus },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import theme and accessibility settings
   */
  importSettings(settings) {
    try {
      if (settings.theme && settings.theme.current) {
        this.setTheme(settings.theme.current);
      }

      if (settings.accessibility) {
        this.accessibilityFeatures = { ...this.accessibilityFeatures, ...settings.accessibility };
        this.applyAccessibilityFeatures();
      }

      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Reset all settings to defaults
   */
  resetToDefaults() {
    this.currentTheme = 'auto';
    this.accessibilityFeatures = {
      reducedMotion: false,
      highContrast: false,
      colorBlindness: 'none',
      fontSize: 'normal',
      focusIndicators: true,
      screenReader: false
    };

    this.saveTheme('auto');
    this.saveAccessibilityPreferences();
    this.applyTheme();
    this.applyAccessibilityFeatures();
  }
}

// Auto-initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
  });
} else {
  window.themeManager = new ThemeManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
