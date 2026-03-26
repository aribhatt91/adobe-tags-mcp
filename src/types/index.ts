import { z } from 'zod';

/**
 * Adobe Launch Types
 * These define the structure of rules and data elements in Adobe Launch
 */

// Schema for Adobe Launch Rules
// A rule consists of events (when to fire), conditions (checks), and actions (what to do)
export const AdobeLaunchRuleSchema = z.object({
  name: z.string().describe('Unique name for the rule'),
  enabled: z.boolean().default(true).describe('Whether the rule should be active'),
  
  // Events: What triggers the rule (page load, click, etc.)
  events: z.array(z.object({
    name: z.string().describe('Event name for identification'),
    moduleType: z.string().describe('Type of event (e.g., core/page-bottom, core/click)'),
    settings: z.record(z.string(), z.any()).optional().describe('Event configuration settings')
  })).min(1, 'At least one event is required'),
  
  // Conditions: Optional checks that must pass for the rule to fire
  conditions: z.array(z.object({
    name: z.string().describe('Condition name'),
    moduleType: z.string().describe('Type of condition to check'),
    settings: z.record(z.string(), z.any()).optional().describe('Condition configuration'),
    negate: z.boolean().default(false).describe('Invert the condition result')
  })).optional(),
  
  // Actions: What happens when the rule fires
  actions: z.array(z.object({
    name: z.string().describe('Action name'),
    moduleType: z.string().describe('Type of action to execute'),
    settings: z.record(z.string(), z.any()).optional().describe('Action configuration')
  })).min(1, 'At least one action is required')
});

// Schema for Adobe Launch Data Elements
// Data elements are reusable values that can be referenced in rules
export const AdobeLaunchDataElementSchema = z.object({
  name: z.string().describe('Unique name for the data element'),
  delegate_descriptor_id: z.string().describe('Module type (e.g., core::dataElements::custom-code)'),
  settings: z.record(z.string(), z.any()).optional().describe('Data element configuration'),
  clean_text: z.boolean().default(false).describe('Remove extra whitespace from value'),
  force_lowercase: z.boolean().default(false).describe('Convert value to lowercase'),
  storage_duration: z.enum(['pageview', 'session', 'visitor']).optional()
    .describe('How long to cache the value: pageview (resets on page load), session (browser session), visitor (persistent)')
});

/**
 * Google Tag Manager Types
 * These define tags, triggers, and variables in GTM
 */

// Schema for GTM Tags
// Tags are tracking pixels, analytics code, or other scripts
export const GTMTagSchema = z.object({
  name: z.string().describe('Unique name for the tag'),
  type: z.string().describe('Tag type (e.g., "ua" for Universal Analytics, "gaawe" for GA4, "html" for Custom HTML)'),
  
  // Parameters: Configuration for the tag
  parameter: z.array(z.object({
    key: z.string().describe('Parameter name'),
    value: z.string().describe('Parameter value'),
    type: z.enum(['template', 'integer', 'boolean', 'list', 'map']).default('template')
      .describe('Data type of the parameter')
  })).optional(),
  
  firingTriggerId: z.array(z.string()).optional().describe('Triggers that cause this tag to fire'),
  blockingTriggerId: z.array(z.string()).optional().describe('Triggers that prevent this tag from firing'),
  priority: z.number().optional().describe('Firing order (higher = earlier)'),
  paused: z.boolean().default(false).describe('Whether the tag is paused')
});

// Schema for GTM Triggers
// Triggers define when tags should fire
export const GTMTriggerSchema = z.object({
  name: z.string().describe('Unique name for the trigger'),
  type: z.string().describe('Trigger type (e.g., "pageview", "click", "customEvent", "formSubmission")'),
  
  // Filters: Conditions that must be met for the trigger to fire
  filter: z.array(z.object({
    type: z.string().describe('Filter type (e.g., "equals", "contains", "matches")'),
    parameter: z.array(z.object({
      key: z.string().describe('Parameter name'),
      value: z.string().describe('Expected value'),
      type: z.enum(['template', 'integer', 'boolean']).default('template')
    }))
  })).optional(),
  
  // Auto-event filters: Special filters for click/form triggers
  autoEventFilter: z.array(z.object({
    type: z.string().describe('Auto-event filter type'),
    parameter: z.array(z.object({
      key: z.string().describe('Parameter name'),
      value: z.string().describe('Expected value')
    }))
  })).optional()
});

// Schema for GTM Variables
// Variables store and return values for use in tags and triggers
export const GTMVariableSchema = z.object({
  name: z.string().describe('Unique name for the variable'),
  type: z.string().describe('Variable type (e.g., "v" for Data Layer, "jsm" for JavaScript, "c" for Constant)'),
  parameter: z.array(z.object({
    key: z.string().describe('Parameter name'),
    value: z.string().describe('Parameter value'),
    type: z.enum(['template', 'integer', 'boolean', 'list', 'map']).default('template')
  })).optional().describe('Variable configuration')
});

// Export TypeScript types from the Zod schemas
export type AdobeLaunchRule = z.infer<typeof AdobeLaunchRuleSchema>;
export type AdobeLaunchDataElement = z.infer<typeof AdobeLaunchDataElementSchema>;
export type GTMTag = z.infer<typeof GTMTagSchema>;
export type GTMTrigger = z.infer<typeof GTMTriggerSchema>;
export type GTMVariable = z.infer<typeof GTMVariableSchema>;