/**
 * @file CONFIG-VALIDATOR.TS
 *
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 *
 * @description
 * Configuration Validator for Code Pulse
 * Validates configuration objects for complexity analysis with comprehensive validation rules
 * for weights, thresholds, and optional parameters to ensure data integrity.
 */

// ------------ INTERFACES
/**
 * Configuration structure for complexity analysis
 */
export interface ComplexityConfig {
  /** Weight factors for different complexity metrics */
  weights: Record<string, number>;

  /** Threshold values for different complexity levels */
  thresholds: Record<string, number>;

  /** Optional configuration parameters */
  options?: Record<string, unknown>;
}

// ------------ CLASS
/**
 * Validates configuration objects for complexity analysis with comprehensive validation rules
 */
export class ConfigValidator {
  /**
   * Validates a complete complexity configuration
   * @param config The configuration to validate
   * @throws Error if the configuration is invalid
   */
  public static validateConfig(config: ComplexityConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: must be a non-null object');
    }
    
    if (!config.weights || !config.thresholds) {
      throw new Error('Invalid configuration: missing required fields');
    }

    this.validateWeights(config.weights);
    this.validateThresholds(config.thresholds);
    
    // Optional validation of additional options
    if (config.options && typeof config.options !== 'object') {
      throw new Error('Invalid configuration: options must be an object');
    }
  }

  /**
   * Validates the weights configuration
   * @param weights Weight values to validate
   * @throws Error if any weight is invalid
   * @private
   */
  private static validateWeights(weights: Record<string, number>): void {
    if (!weights || Object.keys(weights).length === 0) {
      throw new Error('Invalid configuration: weights object cannot be empty');
    }
    
    for (const [key, value] of Object.entries(weights)) {
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        throw new Error(`Invalid weight for "${key}": must be a positive finite number`);
      }
    }
  }

  /**
   * Validates the thresholds configuration
   * @param thresholds Threshold values to validate
   * @throws Error if any threshold is invalid
   * @private
   */
  private static validateThresholds(thresholds: Record<string, number>): void {
    if (!thresholds || Object.keys(thresholds).length === 0) {
      throw new Error('Invalid configuration: thresholds object cannot be empty');
    }
    
    for (const [key, value] of Object.entries(thresholds)) {
      if (typeof value !== 'number' || value < 0 || !isFinite(value)) {
        throw new Error(`Invalid threshold for "${key}": must be a positive finite number`);
      }
    }
  }
}