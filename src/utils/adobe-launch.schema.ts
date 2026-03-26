import { z } from 'zod';

export const createLibrarySchema = z.object({
        name: z.string().describe('Library name (descriptive, e.g., "Consent Updates - Jan 2024")')
      })

export const createLaunchRuleSchema = z.object({
        name: z.string().describe('Rule name'),
        enabled: z.boolean().default(true).describe('Whether the rule is enabled'),
        events: z.array(z.object({
          name: z.string(),
          moduleType: z.string(),
          settings: z.record(z.string(), z.any()).optional()
        })),
        conditions: z.array(z.object({
          name: z.string(),
          moduleType: z.string(),
          settings: z.record(z.string(), z.any()).optional(),
          negate: z.boolean().default(false)
        })).optional(),
        actions: z.array(z.object({
          name: z.string(),
          moduleType: z.string(),
          settings: z.record(z.string(), z.any()).optional()
        }))
      });

export const addConditionToRuleSchema = z.object({
        ruleId: z.string().optional(),
        ruleName: z.string().optional(),
        condition: z.object({
          name: z.string(),
          moduleType: z.string(),
          settings: z.record(z.string(), z.any()).optional(),
          negate: z.boolean().default(false)
        }),
        dryRun: z.boolean().default(false)
      }).refine((data: any) => data.ruleId || data.ruleName, {
        message: 'Either ruleId or ruleName must be provided'
      })
export const selectLibrarySchema = z.object({
        libraryId: z.string().optional().describe('Library ID'),
        libraryName: z.string().optional().describe('Library name (alternative to ID)')
      }).refine((data: any) => data.libraryId || data.libraryName, {
        message: 'Either libraryId or libraryName must be provided'
      })

export const createDataElementSchema = z.object({
        description: z.string().describe('What should this data element do? Be specific about the source. Examples: "get user ID from cookie", "return product ID from digitalData.product.id", "calculate cart total"'),
        name: z.string().optional().describe('Custom name (auto-generated if not provided)'),
        
        // Source-specific overrides
        sourceType: z.enum([
          'auto',           // Auto-detect (default)
          'custom-code',    // Custom JavaScript
          'data-layer',     // Data layer variable
          'cookie',         // Cookie value
          'query-param',    // URL parameter
          'javascript-variable', // Window variable
          'local-storage',  // localStorage
          'session-storage', // sessionStorage
          'dom-attribute',  // DOM element attribute
          'constant',       // Static value
          'data-element-reference' // Reference another DE
        ]).default('auto').describe('Source type (auto-detected if not specified)'),
        
        // Generic parameters
        path: z.string().optional().describe('Path/key/selector (e.g., "digitalData.cart.total", "userId", ".element")'),
        defaultValue: z.string().optional().describe('Default value if source returns nothing'),
        
        // Storage options
        storageType: z.enum(['none', 'pageview', 'session', 'visitor']).default('none').describe('How long to cache'),
        cleanText: z.boolean().default(false).describe('Remove whitespace'),
        forceLowercase: z.boolean().default(false).describe('Convert to lowercase'),
        
        // Advanced
        customCode: z.string().optional().describe('Provide your own custom code instead of auto-generation'),
        needsClarification: z.boolean().default(false).describe('Set true if you need more info from user')
      })
export const genericObjectSchema = z.object({});