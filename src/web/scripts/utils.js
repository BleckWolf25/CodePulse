/**
 * @file UTILS.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Common utility functions for the dashboard UI
 * Includes formatting, animations, and helper functions
 */

// ------------ MAIN
/**
 * Format numbers with appropriate units
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }
  
  return num.toFixed(decimals);
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format file size in bytes to human readable format
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

/**
 * Format percentage with appropriate precision
 */
function formatPercentage(value, total, decimals = 1) {
  if (!total || total === 0) return '0%';
  
  const percentage = (value / total) * 100;
  return percentage.toFixed(decimals) + '%';
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date) {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Debounce function calls
 */
function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

/**
 * Throttle function calls
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Animate number changes
 */
function animateNumber(element, start, end, duration = 1000) {
  const startTime = performance.now();
  const difference = end - start;
  
  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (difference * easeOut);
    
    element.textContent = Math.round(current);
    
    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  }
  
  requestAnimationFrame(updateNumber);
}

/**
 * Create smooth scroll to element
 */
function smoothScrollTo(element, duration = 500) {
  const targetPosition = element.offsetTop;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;
  
  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }
  
  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  }
  
  requestAnimationFrame(animation);
}

/**
 * Generate random ID
 */
function generateId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if element is in viewport
 */
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
      return true;
    } catch (err) {
      textArea.remove();
      return false;
    }
  }
}

/**
 * Download data as JSON file
 */
function downloadJSON(data, filename = 'data.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Download data as CSV file
 */
function downloadCSV(data, filename = 'data.csv') {
  if (!Array.isArray(data) || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Get CSS custom property value
 */
function getCSSVariable(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Set CSS custom property value
 */
function setCSSVariable(name, value) {
  document.documentElement.style.setProperty(name, value);
}

/**
 * Create loading spinner element
 */
function createSpinner(size = 'medium') {
  const spinner = document.createElement('div');
  spinner.className = `spinner spinner-${size}`;
  return spinner;
}

/**
 * Show/hide loading overlay on element
 */
function toggleLoadingOverlay(element, show = true) {
  let overlay = element.querySelector('.loading-overlay');
  
  if (show && !overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.appendChild(createSpinner());
    element.style.position = 'relative';
    element.appendChild(overlay);
  } else if (!show && overlay) {
    overlay.remove();
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize HTML string
 */
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Parse query string parameters
 */
function parseQueryParams(queryString = window.location.search) {
  const params = new URLSearchParams(queryString);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Format code complexity score with color coding
 */
function formatComplexity(score, threshold = 10) {
  const level = score <= threshold ? 'low' : score <= threshold * 2 ? 'medium' : 'high';
  return {
    score: score.toFixed(1),
    level: level,
    className: `complexity-${level}`
  };
}

/**
 * Calculate trend direction and percentage
 */
function calculateTrend(current, previous) {
  if (!previous || previous === 0) {
    return { direction: 'neutral', percentage: 0 };
  }
  
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  
  return {
    direction: direction,
    percentage: Math.abs(change).toFixed(1)
  };
}

// Export utilities for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatNumber,
    formatDuration,
    formatFileSize,
    formatPercentage,
    formatRelativeTime,
    debounce,
    throttle,
    animateNumber,
    smoothScrollTo,
    generateId,
    isInViewport,
    copyToClipboard,
    downloadJSON,
    downloadCSV,
    getCSSVariable,
    setCSSVariable,
    createSpinner,
    toggleLoadingOverlay,
    isValidEmail,
    sanitizeHTML,
    parseQueryParams,
    formatComplexity,
    calculateTrend
  };
}
