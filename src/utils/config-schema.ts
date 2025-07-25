/**
 * @file CONFIG-SCHEMA.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Schema Validation for Code Pulse
 * Provides comprehensive schema validation for all extension configurations
 * with detailed error messages and migration support.
 */


// ------------ IMPORTS
import * as vscode from 'vscode';

// ------------ INTERFACES

export interface ConfigSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: any[];
  default?: any;
  description?: string;
  deprecated?: boolean;
  migration?: (oldValue: any) => any;
  group?: string;
  order?: number;
  markdownDescription?: string;
  category?: string;
  tags?: string[];
  examples?: any[];
  userFriendly?: {
    title: string;
    description: string;
    category: string;
    subcategory?: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    impact: string;
    recommendations?: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  migratedConfig?: any;
  score?: number; // Configuration health score (0-100)
  categories?: {
    [category: string]: {
      score: number;
      issues: ValidationError[];
      recommendations: string[];
    };
  };
}

export interface ValidationError {
  path: string;
  message: string;
  value: any;
  expectedType?: string;
  code?: string;
  severity?: 'error' | 'warning' | 'info';
  fixable?: boolean;
  autoFix?: () => any;
}

export interface ValidationWarning {
  path: string;
  message: string;
  value: any;
  code?: string;
  fixable?: boolean;
  autoFix?: () => any;
}

// Configuration categories for better organization
export enum ConfigCategory {
  CORE = 'core',
  TRACKING = 'tracking',
  COMPLEXITY = 'complexity',
  ANALYTICS = 'analytics',
  DASHBOARD = 'dashboard',
  WEBSOCKET = 'websocket',
  REPORTING = 'reporting',
  PERFORMANCE = 'performance',
  STORAGE = 'storage',
  NOTIFICATIONS = 'notifications',
  LANGUAGES = 'languages',
  UI = 'ui',
  ADVANCED = 'advanced'
}

// Configuration groups for UI organization
export interface ConfigGroup {
  id: string;
  title: string;
  description: string;
  category: ConfigCategory;
  order: number;
  icon?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Predefined configuration groups
export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'core',
    title: 'Core Settings',
    description: 'Essential configuration options for basic functionality',
    category: ConfigCategory.CORE,
    order: 1,
    icon: 'gear',
    defaultExpanded: true
  },
  {
    id: 'tracking',
    title: 'Tracking & Metrics',
    description: 'Configure how metrics are collected and processed',
    category: ConfigCategory.TRACKING,
    order: 2,
    icon: 'pulse',
    defaultExpanded: true
  },
  {
    id: 'complexity',
    title: 'Code Complexity',
    description: 'Settings for code complexity analysis and thresholds',
    category: ConfigCategory.COMPLEXITY,
    order: 3,
    icon: 'graph',
    defaultExpanded: false
  },
  {
    id: 'analytics',
    title: 'Advanced Analytics',
    description: 'Enable advanced analytics and insights features',
    category: ConfigCategory.ANALYTICS,
    order: 4,
    icon: 'chart-line',
    defaultExpanded: false
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Customize dashboard appearance and behavior',
    category: ConfigCategory.DASHBOARD,
    order: 5,
    icon: 'dashboard',
    defaultExpanded: false
  },
  {
    id: 'websocket',
    title: 'Real-time Updates',
    description: 'Configure WebSocket connections for real-time data',
    category: ConfigCategory.WEBSOCKET,
    order: 6,
    icon: 'broadcast',
    defaultExpanded: false
  },
  {
    id: 'reporting',
    title: 'Reports & Export',
    description: 'Settings for generating and exporting reports',
    category: ConfigCategory.REPORTING,
    order: 7,
    icon: 'file-text',
    defaultExpanded: false
  },
  {
    id: 'storage',
    title: 'Data Storage',
    description: 'Manage data retention and storage limits',
    category: ConfigCategory.STORAGE,
    order: 8,
    icon: 'database',
    defaultExpanded: false
  },
  {
    id: 'languages',
    title: 'Language-Specific',
    description: 'Configure settings for specific programming languages',
    category: ConfigCategory.LANGUAGES,
    order: 9,
    icon: 'code',
    defaultExpanded: false
  },
  {
    id: 'advanced',
    title: 'Advanced Settings',
    description: 'Advanced configuration options for power users',
    category: ConfigCategory.ADVANCED,
    order: 10,
    icon: 'tools',
    defaultExpanded: false
  }
];

// ------------ MAIN CONFIGURATION SCHEMA =====

export const MAIN_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  properties: {
    enableMetricTracking: {
      type: 'boolean',
      default: true,
      description: 'Enable or disable metric tracking',
      markdownDescription: '**Enable Productivity Tracking**\n\nWhen enabled, the extension will monitor your coding activity, complexity metrics, and productivity patterns to provide insights.',
      group: 'core',
      order: 1,
      userFriendly: {
        title: 'Enable Tracking',
        description: 'Turn on productivity monitoring and metrics collection',
        category: 'Essential',
        importance: 'critical',
        difficulty: 'beginner',
        impact: 'Enables all core functionality of the extension',
        recommendations: ['Keep enabled for full functionality', 'Disable only if privacy is a concern']
      }
    },
    complexityThreshold: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Global complexity threshold for warnings',
      markdownDescription: '**Code Complexity Warning Threshold**\n\nCode with complexity above this value will trigger warnings. Lower values = more strict analysis.',
      group: 'complexity',
      order: 1,
      userFriendly: {
        title: 'Complexity Threshold',
        description: 'Set when to warn about complex code (1-100)',
        category: 'Code Quality',
        importance: 'high',
        difficulty: 'intermediate',
        impact: 'Controls sensitivity of complexity warnings',
        recommendations: [
          'Start with 10 for balanced analysis',
          'Use 5-7 for strict code quality',
          'Use 15-20 for legacy codebases'
        ]
      }
    },
    trackingInterval: {
      type: 'number',
      minimum: 1,
      maximum: 1440, // 24 hours in minutes
      default: 30,
      description: 'Tracking interval in minutes',
      markdownDescription: '**Data Collection Frequency**\n\nHow often metrics are collected and processed. Lower values provide more granular data but may impact performance.',
      group: 'tracking',
      order: 1,
      userFriendly: {
        title: 'Update Frequency',
        description: 'How often to collect metrics (in minutes)',
        category: 'Performance',
        importance: 'medium',
        difficulty: 'beginner',
        impact: 'Affects data granularity and system performance',
        recommendations: [
          '30 minutes for balanced performance',
          '15 minutes for detailed tracking',
          '60+ minutes for minimal impact'
        ]
      }
    },
    excludedLanguages: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 50
      },
      default: ['json', 'lock'],
      description: 'File types to exclude from tracking',
      markdownDescription: '**Excluded File Types**\n\nSpecify file extensions or language IDs to exclude from metrics collection. Useful for ignoring config files, generated code, etc.',
      group: 'tracking',
      order: 2,
      userFriendly: {
        title: 'Excluded Languages',
        description: 'File types to ignore during tracking',
        category: 'Filtering',
        importance: 'medium',
        difficulty: 'beginner',
        impact: 'Reduces noise from non-code files',
        recommendations: [
          'Include: json, xml, yaml for config files',
          'Include: lock, log for generated files',
          'Add specific extensions as needed'
        ]
      }
    },
    enableDetailedLogging: {
      type: 'boolean',
      default: false,
      description: 'Enable detailed debug logging',
      markdownDescription: '**Debug Logging**\n\n⚠️ **Warning**: Detailed logging may impact performance and should only be enabled for troubleshooting.',
      group: 'advanced',
      order: 1,
      userFriendly: {
        title: 'Debug Logging',
        description: 'Enable verbose logging for troubleshooting',
        category: 'Debugging',
        importance: 'low',
        difficulty: 'advanced',
        impact: 'May reduce performance, useful for debugging',
        recommendations: [
          'Only enable when troubleshooting issues',
          'Disable after resolving problems',
          'Check logs in VS Code Developer Console'
        ]
      }
    },
    maxStorageSize: {
      type: 'number',
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum storage size in MB',
      group: 'storage',
      order: 1
    },
    dataRetentionDays: {
      type: 'number',
      minimum: 1,
      maximum: 365,
      default: 90,
      description: 'Number of days to retain metrics data',
      group: 'storage',
      order: 2,
      markdownDescription: 'Number of days to retain metrics data. **Note**: Longer retention periods will use more storage space.'
    },
    theme: {
      type: 'string',
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
      description: 'UI theme preference',
      group: 'ui',
      order: 1
    },
    enableNotifications: {
      type: 'boolean',
      default: true,
      description: 'Enable extension notifications',
      group: 'ui',
      order: 2
    },
    websocket: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable WebSocket for real-time updates',
          group: 'websocket',
          order: 1
        },
        fallbackToPolling: {
          type: 'boolean',
          default: true,
          description: 'Fallback to polling if WebSocket fails',
          group: 'websocket',
          order: 2
        },
        updateInterval: {
          type: 'number',
          minimum: 100,
          maximum: 10000,
          default: 1000,
          description: 'Update interval in milliseconds',
          group: 'websocket',
          order: 3
        },
        maxClients: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum number of WebSocket clients',
          group: 'websocket',
          order: 4
        },
        pingInterval: {
          type: 'number',
          minimum: 5000,
          maximum: 120000,
          default: 30000,
          description: 'Ping interval in milliseconds',
          group: 'websocket',
          order: 5
        },
        connectionTimeout: {
          type: 'number',
          minimum: 10000,
          maximum: 300000,
          default: 60000,
          description: 'Connection timeout in milliseconds',
          group: 'websocket',
          order: 6
        }
      },
      required: ['enabled'],
      default: {
        enabled: true,
        fallbackToPolling: true,
        updateInterval: 1000,
        maxClients: 10,
        pingInterval: 30000,
        connectionTimeout: 60000
      },
      group: 'websocket',
      order: 1
    },
    analytics: {
      type: 'object',
      properties: {
        enableAdvancedAnalytics: {
          type: 'boolean',
          default: true,
          description: 'Enable advanced analytics features',
          group: 'analytics',
          order: 1
        },
        enableTrendAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Enable trend analysis',
          group: 'analytics',
          order: 2
        },
        enablePerformanceBenchmarking: {
          type: 'boolean',
          default: true,
          description: 'Enable performance benchmarking',
          group: 'analytics',
          order: 3
        },
        enableTeamMetrics: {
          type: 'boolean',
          default: true,
          description: 'Enable team collaboration metrics',
          group: 'analytics',
          order: 4
        },
        enableCodeHealthScoring: {
          type: 'boolean',
          default: true,
          description: 'Enable code health scoring',
          group: 'analytics',
          order: 5
        },
        enableHistoricalAnalysis: {
          type: 'boolean',
          default: true,
          description: 'Enable historical data analysis',
          group: 'analytics',
          order: 6
        },
        enableRegressionDetection: {
          type: 'boolean',
          default: true,
          description: 'Enable performance regression detection',
          group: 'analytics',
          order: 7
        },
        enableProductivityPatterns: {
          type: 'boolean',
          default: true,
          description: 'Enable productivity pattern recognition',
          group: 'analytics',
          order: 8
        },
        updateFrequency: {
          type: 'number',
          minimum: 60,
          maximum: 3600,
          default: 300,
          description: 'Analytics update frequency in seconds',
          group: 'analytics',
          order: 9
        }
      },
      default: {
        enableAdvancedAnalytics: true,
        enableTrendAnalysis: true,
        enablePerformanceBenchmarking: true,
        enableTeamMetrics: true,
        enableCodeHealthScoring: true,
        enableHistoricalAnalysis: true,
        enableRegressionDetection: true,
        enableProductivityPatterns: true,
        updateFrequency: 300
      },
      group: 'analytics',
      order: 1
    },
    complexityThresholds: {
      type: 'object',
      description: 'Language-specific complexity thresholds',
      default: {
        typescript: 15,
        javascript: 12,
        python: 20,
        java: 15,
        csharp: 15,
        cpp: 20,
        go: 15,
        rust: 15,
        php: 12,
        ruby: 12
      },
      group: 'languages',
      order: 1
    },
    languageConfigs: {
      type: 'object',
      description: 'Advanced language-specific configuration overrides',
      default: {},
      group: 'languages',
      order: 2
    },
    dashboard: {
      type: 'object',
      properties: {
        enableDrillDown: {
          type: 'boolean',
          default: true,
          description: 'Enable drill-down capabilities in charts'
        },
        enableFiltering: {
          type: 'boolean',
          default: true,
          description: 'Enable filtering and search functionality'
        },
        enableExport: {
          type: 'boolean',
          default: true,
          description: 'Enable export options for different formats'
        },
        enableGoalTracking: {
          type: 'boolean',
          default: true,
          description: 'Enable goal setting and tracking features'
        },
        refreshInterval: {
          type: 'number',
          default: 5000,
          minimum: 1000,
          maximum: 60000,
          description: 'Dashboard refresh interval in milliseconds'
        }
      },
      default: {
        enableDrillDown: true,
        enableFiltering: true,
        enableExport: true,
        enableGoalTracking: true,
        refreshInterval: 5000
      },
      group: 'dashboard',
      order: 1
    },
    reporting: {
      type: 'object',
      properties: {
        enablePDFReports: {
          type: 'boolean',
          default: true,
          description: 'Enable PDF report generation'
        },
        enableScheduledReports: {
          type: 'boolean',
          default: false,
          description: 'Enable scheduled reports'
        },
        enableTeamReports: {
          type: 'boolean',
          default: false,
          description: 'Enable team summary reports'
        },
        enableCIIntegration: {
          type: 'boolean',
          default: false,
          description: 'Enable CI/CD integration reports'
        }
      },
      default: {
        enablePDFReports: true,
        enableScheduledReports: false,
        enableTeamReports: false,
        enableCIIntegration: false
      },
      group: 'reporting',
      order: 1
    }
  },
  required: ['enableMetricTracking', 'complexityThreshold', 'trackingInterval']
};

// ------------ LANGUAGE-SPECIFIC CONFIGURATION SCHEMA =====

export const LANGUAGE_CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  properties: {
    weights: {
      type: 'object',
      properties: {
        cyclomatic: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          default: 1
        },
        cognitive: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          default: 1
        },
        nesting: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          default: 1
        },
        length: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          default: 0.5
        }
      },
      required: ['cyclomatic', 'cognitive'],
      default: {
        cyclomatic: 1,
        cognitive: 1,
        nesting: 1,
        length: 0.5
      }
    },
    thresholds: {
      type: 'object',
      properties: {
        cyclomatic: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        cognitive: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 15
        },
        nesting: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 4
        },
        length: {
          type: 'number',
          minimum: 10,
          maximum: 10000,
          default: 500
        }
      },
      required: ['cyclomatic', 'cognitive'],
      default: {
        cyclomatic: 10,
        cognitive: 15,
        nesting: 4,
        length: 500
      }
    },
    options: {
      type: 'object',
      properties: {
        ignoreComments: {
          type: 'boolean',
          default: true
        },
        ignoreEmptyLines: {
          type: 'boolean',
          default: true
        },
        enableCaching: {
          type: 'boolean',
          default: true
        }
      },
      default: {
        ignoreComments: true,
        ignoreEmptyLines: true,
        enableCaching: true
      }
    }
  },
  required: ['weights', 'thresholds']
};

// ------------ CONFIGURATION VALIDATOR CLASS =====

export class ConfigSchemaValidator {
  private static instance: ConfigSchemaValidator;

  public static getInstance(): ConfigSchemaValidator {
    if (!ConfigSchemaValidator.instance) {
      ConfigSchemaValidator.instance = new ConfigSchemaValidator();
    }
    return ConfigSchemaValidator.instance;
  }

  /**
   * Validate configuration against schema
   */
  public validate(config: any, schema: ConfigSchema, path: string = ''): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let migratedConfig = config;

    try {
      const result = this.validateValue(config, schema, path, errors, warnings);
      migratedConfig = result.migratedValue;

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        migratedConfig
      };
    } catch (error) {
      errors.push({
        path,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: config
      });

      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate main extension configuration
   */
  public validateMainConfig(config: any): ValidationResult {
    return this.validate(config, MAIN_CONFIG_SCHEMA, 'productivityDashboard');
  }

  /**
   * Validate language-specific configuration
   */
  public validateLanguageConfig(config: any, language: string): ValidationResult {
    return this.validate(config, LANGUAGE_CONFIG_SCHEMA, `languageConfigs.${language}`);
  }

  /**
   * Validate a single value against schema
   */
  private validateValue(
    value: any,
    schema: ConfigSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): { isValid: boolean; migratedValue: any } {
    let migratedValue = value;

    // Handle undefined/null values
    if (value === undefined || value === null) {
      if (schema.default !== undefined) {
        migratedValue = schema.default;
        warnings.push({
          path,
          message: `Using default value: ${JSON.stringify(schema.default)}`,
          value
        });
        return { isValid: true, migratedValue };
      }
      
      errors.push({
        path,
        message: 'Value is required but not provided',
        value,
        expectedType: schema.type
      });
      return { isValid: false, migratedValue };
    }

    // Handle deprecated properties
    if (schema.deprecated) {
      warnings.push({
        path,
        message: 'This configuration option is deprecated',
        value
      });
    }

    // Apply migration if available
    if (schema.migration && typeof schema.migration === 'function') {
      try {
        migratedValue = schema.migration(value);
        warnings.push({
          path,
          message: 'Configuration migrated to new format',
          value
        });
      } catch (error) {
        errors.push({
          path,
          message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          value
        });
        return { isValid: false, migratedValue };
      }
    }

    // Type validation
    if (!this.validateType(migratedValue, schema.type)) {
      errors.push({
        path,
        message: `Expected ${schema.type}, got ${typeof migratedValue}`,
        value: migratedValue,
        expectedType: schema.type
      });
      return { isValid: false, migratedValue };
    }

    // Type-specific validation
    switch (schema.type) {
      case 'string':
        this.validateString(migratedValue, schema, path, errors);
        break;
      case 'number':
        this.validateNumber(migratedValue, schema, path, errors);
        break;
      case 'array':
        migratedValue = this.validateArray(migratedValue, schema, path, errors, warnings);
        break;
      case 'object':
        migratedValue = this.validateObject(migratedValue, schema, path, errors, warnings);
        break;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(migratedValue)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value: migratedValue
      });
      return { isValid: false, migratedValue };
    }

    return { isValid: errors.length === 0, migratedValue };
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }

  private validateString(value: string, schema: ConfigSchema, path: string, errors: ValidationError[]): void {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `String must be at least ${schema.minLength} characters long`,
        value
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `String must be at most ${schema.maxLength} characters long`,
        value
      });
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String does not match required pattern: ${schema.pattern}`,
          value
        });
      }
    }
  }

  private validateNumber(value: number, schema: ConfigSchema, path: string, errors: ValidationError[]): void {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Number must be at least ${schema.minimum}`,
        value
      });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Number must be at most ${schema.maximum}`,
        value
      });
    }
  }

  private validateArray(
    value: any[],
    schema: ConfigSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): any[] {
    const migratedArray: any[] = [];

    if (schema.items) {
      value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        const result = this.validateValue(item, schema.items!, itemPath, errors, warnings);
        migratedArray.push(result.migratedValue);
      });
    } else {
      return value;
    }

    return migratedArray;
  }

  private validateObject(
    value: Record<string, any>,
    schema: ConfigSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Record<string, any> {
    const migratedObject: Record<string, any> = { ...value };

    if (schema.properties) {
      // Validate required properties
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in value)) {
            const propSchema = schema.properties[requiredProp];
            if (propSchema?.default !== undefined) {
              migratedObject[requiredProp] = propSchema.default;
              warnings.push({
                path: `${path}.${requiredProp}`,
                message: `Using default value: ${JSON.stringify(propSchema.default)}`,
                value: undefined
              });
            } else {
              errors.push({
                path: `${path}.${requiredProp}`,
                message: 'Required property is missing',
                value: undefined
              });
            }
          }
        }
      }

      // Validate existing properties
      for (const [propName, propValue] of Object.entries(value)) {
        const propSchema = schema.properties[propName];
        if (propSchema) {
          const propPath = `${path}.${propName}`;
          const result = this.validateValue(propValue, propSchema, propPath, errors, warnings);
          migratedObject[propName] = result.migratedValue;
        } else {
          warnings.push({
            path: `${path}.${propName}`,
            message: 'Unknown property (will be ignored)',
            value: propValue
          });
        }
      }

      // Add missing properties with defaults
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (!(propName in migratedObject) && propSchema.default !== undefined) {
          migratedObject[propName] = propSchema.default;
        }
      }
    }

    return migratedObject;
  }

  /**
   * Validate configuration with detailed error reporting
   */
  public validateWithDetails(config: any, schema: ConfigSchema, path: string = ''): ValidationResult {
    const result = this.validate(config, schema, path);
    
    // Add detailed context to each error
    result.errors = result.errors.map(error => ({
      ...error,
      context: this.getErrorContext(error, schema),
      suggestion: this.getSuggestionForError(error, schema)
    }));
    
    return result;
  }

  /**
   * Get additional context for an error
   */
  private getErrorContext(error: ValidationError, _schema: ConfigSchema): string {
    if (error.path.includes('complexityThreshold')) {
      return 'Complexity thresholds should be positive integers representing the maximum allowed complexity.';
    }
    
    if (error.path.includes('languageConfigs')) {
      return 'Language configurations should follow the standard schema for language-specific settings.';
    }
    
    return '';
  }

  /**
   * Get suggestion for fixing an error
   */
  private getSuggestionForError(error: ValidationError, schema: ConfigSchema): string {
    if (error.message.includes('type')) {
      return `Expected type: ${schema.type}. Consider converting your value to match this type.`;
    }
    
    if (error.message.includes('minimum')) {
      return `Value should be at least ${schema.minimum}. Consider increasing your value.`;
    }
    
    return 'Check the schema documentation for valid values.';
  }
}
