import { z } from 'zod';
import { GTMClient } from '../clients/gtm.client.js';
import { GTMTagSchema, GTMTriggerSchema, GTMVariableSchema } from '../types/index.js';

/**
 * Create Google Tag Manager MCP Tools
 * 
 * This function creates all the tools that Claude can use to interact with GTM.
 * Each tool corresponds to a specific GTM operation.
 * 
 * @param client - Initialized GTM client
 * @returns Object containing all GTM tools
 */
export function createGTMTools(client: GTMClient) {
  return {
    /**
     * ========================================================================
     * TOOL: Create a Tag
     * ========================================================================
     * 
     * Tags are the tracking pixels, analytics code, or scripts that fire
     * based on triggers. Common tag types:
     * - "gaawe" - Google Analytics 4
     * - "ua" - Universal Analytics
     * - "html" - Custom HTML
     * - "img" - Custom Image
     * - "flc" - Floodlight Counter
     * 
     * Example: GA4 pageview tag, Facebook pixel, custom tracking script
     */
    gtm_create_tag: {
      description: 'Create a new tag in Google Tag Manager. Tags fire tracking pixels, analytics code, or other scripts.',
      
      inputSchema: z.object({
        name: z.string().describe('Name of the tag'),
        type: z.string().describe('Tag type (e.g., "ua" for Universal Analytics, "gaawe" for GA4, "html" for Custom HTML)'),
        
        // Parameters define the tag's configuration
        // For example, GA4 tags need measurement ID, event name, etc.
        parameter: z.array(z.object({
          key: z.string().describe('Parameter key'),
          value: z.string().describe('Parameter value'),
          type: z.enum(['template', 'integer', 'boolean', 'list', 'map']).default('template').describe('Parameter type')
        })).optional().describe('Tag parameters/settings'),
        
        // Triggers control when the tag fires
        firingTriggerId: z.array(z.string()).optional().describe('IDs of triggers that fire this tag'),
        
        // Blocking triggers prevent the tag from firing
        blockingTriggerId: z.array(z.string()).optional().describe('IDs of triggers that block this tag'),
        
        priority: z.number().optional().describe('Tag firing priority (higher numbers fire first)'),
        paused: z.boolean().default(false).describe('Whether the tag is paused')
      }),
      
      handler: async (args: any) => {
        // Validate the input using our Zod schema
        const validatedArgs = GTMTagSchema.parse(args);
        
        // Call the GTM API to create the tag
        const tag = await client.createTag(validatedArgs);
        
        // Return formatted response to Claude
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              tag,
              message: `Tag "${validatedArgs.name}" created successfully`,
              tagId: tag.tagId,
              tip: 'Remember to create a version and publish for changes to go live!'
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: List All Tags
     * ========================================================================
     * 
     * Retrieves all tags in the current workspace.
     * Useful for:
     * - Seeing what's already configured
     * - Finding tag IDs for updates
     * - Auditing your GTM setup
     */
    gtm_list_tags: {
      description: 'List all tags in the Google Tag Manager workspace',
      inputSchema: z.object({}),  // No parameters needed
      
      handler: async () => {
        const tags = await client.listTags();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: tags.length,
              tags: tags.map((t: any) => ({
                tagId: t.tagId,
                name: t.name,
                type: t.type,
                paused: t.paused,
                firingTriggerId: t.firingTriggerId,
                // Show if tag is actually being used
                hasActiveTriggers: (t.firingTriggerId?.length || 0) > 0
              }))
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: Create a Trigger
     * ========================================================================
     * 
     * Triggers define WHEN tags should fire. Common trigger types:
     * - "pageview" - All pages or some pages
     * - "click" - Click events
     * - "formSubmission" - Form submissions
     * - "customEvent" - Custom events from dataLayer.push()
     * - "domReady" - DOM ready
     * - "windowLoaded" - Window loaded
     * - "timer" - Time-based
     * - "scrollDepth" - Scroll tracking
     * 
     * Example: "Fire on all pageviews" or "Fire when button with ID 'cta' is clicked"
     */
    gtm_create_trigger: {
      description: 'Create a new trigger in Google Tag Manager. Triggers define when tags should fire.',
      
      inputSchema: z.object({
        name: z.string().describe('Name of the trigger'),
        type: z.string().describe('Trigger type (e.g., "pageview", "click", "customEvent", "domReady")'),
        
        // Filters are conditions that must be met
        // Example: Fire only if Page URL contains "/checkout/"
        filter: z.array(z.object({
          type: z.string().describe('Filter type (e.g., "equals", "contains", "startsWith", "matchRegex")'),
          parameter: z.array(z.object({
            key: z.string().describe('Parameter key (e.g., "arg0" for variable, "arg1" for comparison value)'),
            value: z.string().describe('Parameter value'),
            type: z.enum(['template', 'integer', 'boolean']).default('template')
          }))
        })).optional().describe('Trigger filters/conditions'),
        
        // Auto-event filters are special for click/form triggers
        // Example: Only clicks on elements with class "button"
        autoEventFilter: z.array(z.object({
          type: z.string().describe('Auto-event filter type'),
          parameter: z.array(z.object({
            key: z.string().describe('Parameter key'),
            value: z.string().describe('Parameter value')
          }))
        })).optional().describe('Auto-event filters for click/form triggers')
      }),
      
      handler: async (args: any) => {
        const validatedArgs = GTMTriggerSchema.parse(args);
        const trigger = await client.createTrigger(validatedArgs);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              trigger,
              message: `Trigger "${validatedArgs.name}" created successfully`,
              triggerId: trigger.triggerId,
              tip: 'Use this triggerId when creating tags to make them fire on this trigger'
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: List All Triggers
     * ========================================================================
     * 
     * Shows all triggers in your workspace.
     */
    gtm_list_triggers: {
      description: 'List all triggers in the Google Tag Manager workspace',
      inputSchema: z.object({}),
      
      handler: async () => {
        const triggers = await client.listTriggers();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: triggers.length,
              triggers: triggers.map((t: any) => ({
                triggerId: t.triggerId,
                name: t.name,
                type: t.type,
                // Help identify what kind of trigger it is
                category: t.type.includes('page') ? 'Page' : 
                         t.type.includes('click') ? 'Click' :
                         t.type.includes('form') ? 'Form' :
                         t.type.includes('custom') ? 'Custom Event' : 'Other'
              }))
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: Create a Variable
     * ========================================================================
     * 
     * Variables store and return values for use in tags and triggers.
     * Common variable types:
     * - "v" - Data Layer Variable (from dataLayer)
     * - "jsm" - JavaScript Variable
     * - "c" - Constant
     * - "u" - URL (page path, hostname, query params)
     * - "ctv" - Container Version
     * - "k" - First Party Cookie
     * - "e" - Custom JavaScript
     * - "remm" - RegEx Table
     * - "smm" - Lookup Table
     * 
     * Example: Data Layer variable that gets user.id from the data layer
     */
    gtm_create_variable: {
      description: 'Create a new variable in Google Tag Manager. Variables store and return values for use in tags and triggers.',
      
      inputSchema: z.object({
        name: z.string().describe('Name of the variable'),
        type: z.string().describe('Variable type (e.g., "v" for Data Layer Variable, "jsm" for JavaScript, "c" for Constant)'),
        
        // Parameters configure the variable
        // For Data Layer Variable: {"name": "dataLayerVariable", "value": "userId"}
        // For Constant: {"name": "value", "value": "some-constant-value"}
        parameter: z.array(z.object({
          key: z.string().describe('Parameter key'),
          value: z.string().describe('Parameter value'),
          type: z.enum(['template', 'integer', 'boolean', 'list', 'map']).default('template')
        })).optional().describe('Variable parameters/settings')
      }),
      
      handler: async (args: any) => {
        const validatedArgs = GTMVariableSchema.parse(args);
        const variable = await client.createVariable(validatedArgs);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              variable,
              message: `Variable "${validatedArgs.name}" created successfully`,
              variableId: variable.variableId,
              tip: 'Use {{Variable Name}} in tags and triggers to reference this variable'
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: List All Variables
     * ========================================================================
     * 
     * Shows all variables in your workspace, including built-in and custom.
     */
    gtm_list_variables: {
      description: 'List all variables in the Google Tag Manager workspace',
      inputSchema: z.object({}),
      
      handler: async () => {
        const variables = await client.listVariables();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              count: variables.length,
              variables: variables.map((v: any) => ({
                variableId: v.variableId,
                name: v.name,
                type: v.type,
                // Show if it's a built-in or custom variable
                isBuiltIn: v.variableId?.startsWith('builtin') || false
              }))
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: Get Workspace Info
     * ========================================================================
     * 
     * Gets information about the current workspace you're working in.
     * GTM uses workspaces to organize changes before publishing.
     */
    gtm_get_workspace: {
      description: 'Get information about the current Google Tag Manager workspace',
      inputSchema: z.object({}),
      
      handler: async () => {
        const workspace = await client.getWorkspace();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              workspace: {
                workspaceId: workspace.workspaceId,
                name: workspace.name,
                description: workspace.description,
                accountId: workspace.accountId,
                containerId: workspace.containerId,
                fingerprint: workspace.fingerprint
              },
              tip: 'All changes are made in this workspace. Create a version to publish them.'
            }, null, 2)
          }]
        };
      }
    },

    /**
     * ========================================================================
     * TOOL: Create a Version
     * ========================================================================
     * 
     * Creates a container version for publishing changes.
     * In GTM workflow:
     * 1. Make changes in workspace (create tags, triggers, variables)
     * 2. Create a version (snapshot of changes)
     * 3. Publish the version (make it live)
     * 
     * This tool handles step 2. You'll still need to publish via GTM UI.
     */
    gtm_create_version: {
      description: 'Create a new container version in Google Tag Manager (for publishing changes)',
      
      inputSchema: z.object({
        name: z.string().describe('Version name (e.g., "GA4 Implementation v1.0")'),
        notes: z.string().optional().describe('Version notes/description explaining what changed')
      }),
      
      handler: async (args: any) => {
        const version = await client.createVersion(args.name, args.notes);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              version: {
                containerVersionId: version.containerVersionId,
                name: version.name,
                description: version.description,
                container: version.container,
                fingerprint: version.fingerprint
              },
              message: `Version "${args.name}" created successfully`,
              nextSteps: [
                '1. Review the version in GTM UI',
                '2. Preview the changes if needed',
                '3. Publish the version to make it live'
              ]
            }, null, 2)
          }]
        };
      }
    }
  };
}

/**
 * ========================================================================
 * GTM WORKFLOW SUMMARY
 * ========================================================================
 * 
 * Typical GTM setup workflow using these tools:
 * 
 * 1. CREATE VARIABLES (data sources)
 *    - Data Layer Variables for user data
 *    - URL variables for page info
 *    - Constants for IDs
 * 
 * 2. CREATE TRIGGERS (when to fire)
 *    - All Pages trigger
 *    - Specific page triggers
 *    - Click triggers
 *    - Custom event triggers
 * 
 * 3. CREATE TAGS (what to fire)
 *    - GA4 configuration tag
 *    - GA4 event tags
 *    - Custom HTML tags
 *    - Third-party pixels
 * 
 * 4. CREATE VERSION (snapshot changes)
 *    - Package all changes together
 *    - Add descriptive notes
 * 
 * 5. PUBLISH (via GTM UI)
 *    - Review in preview mode
 *    - Publish to production
 * 
 * ========================================================================
 */