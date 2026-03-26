import z from 'zod';
import { AdobeLaunchClient } from '../clients/adobe-launch.client.js';
import { AdobeLaunchRuleSchema, AdobeLaunchDataElementSchema } from '../types/index.js';
import { addConditionToRuleSchema, createDataElementSchema, createLaunchRuleSchema, createLibrarySchema, genericObjectSchema, selectLibrarySchema } from '../utils/adobe-launch.schema.js';
import { detectSourceType, extractValueFromDescription, generateCodeForSource, generateSmartName, getQuestionsForSourceType } from '../utils/helpers.js';

/**
 * LIBRARY WORKFLOW STATE
 * 
 * This tracks which library is being used for the current session.
 * All modification operations require a library to be selected first.
 */
let currentLibraryId: string | null = null;
let currentLibraryName: string | null = null;

/**
 * Production Adobe Launch Tools with Library Management
 * 
 * CRITICAL: All changes MUST go through a Development library.
 * This MCP server CANNOT publish to Staging or Production - this is intentional.
 */
export function createAdobeLaunchTools(client: AdobeLaunchClient) {
  return {
    /**
     * ========================================================================
     * LIST ALL PROPERTIES (Universal - All Sources)
     * ========================================================================
     */
    adobe_launch_list_properties: {
      title: 'List all properties',
      description: 'See a comprehensive list of all properties within your organisation',
      inputSchema: genericObjectSchema,
      handler: async () => {
        try {
          const properties = await client.listProperties();

          if(!properties.length) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  error: 'We found no properties for this organisation'
                }, null, 2)
              }],
              isError: false
            };
          }

          const response = properties.map((p: any) => ({
            id: p.id,
            name: p.attributes.name,
            platform: p.attributes.platform,
            createdAt: p.attributes.created_at,
            createdBy: p.attributes.created_by_display_name || p.attributes.created_by_email
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }],
            isError: false
          };

        }catch(error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },
    /**
     * ========================================================================
     * CREATE DATA ELEMENT (Universal - All Sources)
     * ========================================================================
     */
    adobe_launch_create_data_element_smart: {
      title: 'Create a Adobe Tags Data Element',
      description: `Create a data element from ANY source. Intelligently detects source type and generates appropriate code.
      
      Supported sources:
      - Data Layer: "get page name from digitalData.page.pageName"
      - Cookies: "get user ID from cookie named userId"
      - URL Parameters: "get utm_campaign from URL"
      - JavaScript Variables: "get app config from window.appConfig"
      - Local/Session Storage: "get cart ID from localStorage"
      - DOM Elements: "get text from element .page-title"
      - Other Data Elements: "get value using data element %User ID%"
      - Custom Code: "calculate total cart value", "format price as currency"
      
      The tool will:
      - Auto-detect source type
      - Generate appropriate code
      - Create descriptive name
      - Ask for clarification if needed`,

      inputSchema: createDataElementSchema,

      handler: async (args: any) => {
        try {
          // Check library
          const { currentLibraryId, currentLibraryName } = await import('../utils/library-state.js');
          
          if (!currentLibraryId) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No library selected',
                  requiredAction: 'Select or create a library first'
                }, null, 2)
              }]
            };
          }

          // Auto-detect source type if needed
          let sourceType = args.sourceType;
          let detectedInfo: any = {};
          
          if (sourceType === 'auto') {
            detectedInfo = detectSourceType(args.description);
            sourceType = detectedInfo.type;
            //console.error(`Auto-detected source type: ${sourceType} (confidence: ${detectedInfo.confidence})`);
          }

          // Extract values from description
          const extractedValues = extractValueFromDescription(args.description, sourceType);
          
          // Merge with explicitly provided path
          if (args.path) {
            extractedValues.path = args.path;
          }

          // Check if we need clarification
          const needsClarification = 
            args.needsClarification ||
            (detectedInfo.confidence && detectedInfo.confidence < 0.7) ||
            (!extractedValues.path && !extractedValues.cookieName && !extractedValues.paramName && sourceType !== 'custom-code');

          if (needsClarification) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  needsClarification: true,
                  detectedSourceType: sourceType,
                  confidence: detectedInfo.confidence,
                  questions: getQuestionsForSourceType(sourceType),
                  tip: 'Please provide more specific details about the data source'
                }, null, 2)
              }]
            };
          }

          // Generate name
          const name = args.name || generateSmartName(args.description, sourceType, extractedValues);

          // Generate code
          let code: string;
          let moduleType: string;
          let settings: any = {};

          if (args.customCode) {
            // User provided custom code
            code = args.customCode;
            moduleType = 'core::dataElements::custom-code';
            settings = { source: code, language: 'javascript' };
          } else {
            // Generate code based on source type
            code = generateCodeForSource(sourceType, extractedValues, args.description);
            
            // Set module type based on source
            if (sourceType === 'cookie') {
              moduleType = 'core::dataElements::cookie';
              settings = { name: extractedValues.cookieName };
            } else if (sourceType === 'query-param') {
              moduleType = 'core::dataElements::query-string-parameter';
              settings = { name: extractedValues.paramName };
            } else if (sourceType === 'javascript-variable') {
              moduleType = 'core::dataElements::javascript-variable';
              settings = { path: extractedValues.path };
            } else if (sourceType === 'constant') {
              moduleType = 'core::dataElements::constant';
              settings = { value: args.defaultValue || '' };
            } else {
              // Custom code for everything else
              moduleType = 'core::dataElements::custom-code';
              settings = { source: code, language: 'javascript' };
            }
          }

          // Add default value if provided
          if (args.defaultValue && settings.source) {
            // Wrap code to include default
            settings.source = `var value = (function() {
${settings.source}
})();
return value || '${args.defaultValue}';`;
          }

          // Create data element
          const dataElement = {
            name,
            delegate_descriptor_id: moduleType,
            settings,
            clean_text: args.cleanText,
            force_lowercase: args.forceLowercase,
            storage_duration: args.storageType === 'none' ? undefined : args.storageType
          };

          const result = await client.createDataElement(dataElement);
          
          // Add to library
          await client.addResourceToLibrary(currentLibraryId!, result.data.id, 'data_elements');

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                dataElement: {
                  id: result.data.id,
                  name: result.data.attributes.name,
                  sourceType: sourceType,
                  code: settings.source || `Native ${sourceType} implementation`,
                  detectedFrom: detectedInfo.confidence ? `Auto-detected (${Math.round(detectedInfo.confidence * 100)}% confidence)` : 'Explicitly specified'
                },
                library: {
                  id: currentLibraryId,
                  name: currentLibraryName
                },
                message: `Data element "${name}" created successfully`,
                usage: `Reference in rules as: %${name}%`,
                tip: 'Use adobe_launch_build_library to deploy changes'
              }, null, 2)
            }]
          };

        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },
    /**
     * ========================================================================
     * LIBRARY WORKFLOW: Step 1 - Check Library Status
     * ========================================================================
     * ALWAYS call this FIRST before any modification
     */
    adobe_launch_check_library_status: {
      title: 'Check Library status',
      description: 'Check if a library is selected for the current session. MUST be called before any create/update operations. Returns current library status and guides next steps.',
      inputSchema: genericObjectSchema,
      
      handler: async () => {
        try {
          if (currentLibraryId) {
            const library = await client.getLibrary(currentLibraryId);
            const environment = await client.getLibraryEnvironment(currentLibraryId);
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  librarySelected: true,
                  library: {
                    id: currentLibraryId,
                    name: currentLibraryName,
                    state: library.data.attributes.state,
                    environment: {
                      id: environment.data.id,
                      name: environment.data.attributes.name,
                      stage: environment.data.attributes.stage
                    }
                  },
                  message: 'Library is active. All changes will be saved to this library.',
                  note: 'When done with changes, use adobe_launch_build_library to build.'
                }, null, 2)
              }]
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  librarySelected: false,
                  message: 'No library selected. You must select or create a library before making changes.',
                  nextSteps: [
                    '1. Use adobe_launch_list_development_libraries to see existing libraries',
                    '2. Either:',
                    '   a) Use adobe_launch_select_library to choose an existing one, OR',
                    '   b) Use adobe_launch_create_library to create a new one'
                  ],
                  warning: 'All changes MUST be saved in a Development library'
                }, null, 2)
              }]
            };
          }
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * LIBRARY WORKFLOW: Step 2a - List Development Libraries
     * ========================================================================
     */
    adobe_launch_list_development_libraries: {
      title: 'List development libraries',
      description: 'List all development libraries. Use this to see existing libraries before selecting one.',
      inputSchema: genericObjectSchema,
      
      handler: async () => {
        try {
          const libraries = await client.getDevelopmentLibraries();
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: libraries.length,
                libraries: libraries.map((lib: any) => ({
                  id: lib.id,
                  name: lib.attributes.name,
                  state: lib.attributes.state,
                  created_at: lib.attributes.created_at
                })),
                message: libraries.length > 0 ? 
                  'Use adobe_launch_select_library with one of these IDs or names' :
                  'No development libraries found. Use adobe_launch_create_library to create one.',
                tip: 'Development libraries are where all changes are saved before building'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * LIBRARY WORKFLOW: Step 2b - Create New Library
     * ========================================================================
     */
    adobe_launch_create_library: {
      title: 'Create development library',
      description: 'Create a new development library. First checks if development environments are available. If none are free, user must select an existing library instead.',
      inputSchema: createLibrarySchema,
      
      handler: async (args: any) => {
        try {
          // Check for available development environments
          const availableEnvs = await client.getAvailableDevelopmentEnvironments();
          
          if (availableEnvs.length === 0) {
            const devLibs = await client.getDevelopmentLibraries();
            
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No development environments available',
                  reason: 'All development environments are assigned to existing libraries',
                  existingLibraries: devLibs.map((lib: any) => ({
                    id: lib.id,
                    name: lib.attributes.name
                  })),
                  requiredAction: 'You must select an existing development library',
                  nextStep: 'Use adobe_launch_select_library with one of the library IDs above'
                }, null, 2)
              }]
            };
          }
          
          // Create library with first available environment
          const environment = availableEnvs[0];
          const library = await client.createLibrary(args.name, environment.id);
          
          // Automatically select this library for the session
          currentLibraryId = library.data.id;
          currentLibraryName = library.data.attributes.name;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                library: {
                  id: library.data.id,
                  name: library.data.attributes.name,
                  state: library.data.attributes.state,
                  environment: {
                    id: environment.id,
                    name: environment.attributes.name
                  }
                },
                message: `Library "${args.name}" created and selected for this session`,
                note: 'All subsequent changes will be saved to this library',
                reminder: 'When done, use adobe_launch_build_library to build the changes'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * LIBRARY WORKFLOW: Step 2c - Select Existing Library
     * ========================================================================
     */
    adobe_launch_select_library: {
      title: 'Select working library',
      description: 'Select an existing development library to use for this session. All changes will be saved to this library.',
      inputSchema: selectLibrarySchema,
      
      handler: async (args: any) => {
        try {
          let libraryId = args.libraryId;
          
          // Search by name if ID not provided
          if (!libraryId && args.libraryName) {
            const libraries = await client.getDevelopmentLibraries();
            const match = libraries.find((lib: any) => 
              lib.attributes.name === args.libraryName
            );
            
            if (!match) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `No development library found with name "${args.libraryName}"`,
                    suggestion: 'Use adobe_launch_list_development_libraries to see available libraries'
                  }, null, 2)
                }]
              };
            }
            
            libraryId = match.id;
          }
          
          // Verify it's a development library
          const library = await client.getLibrary(libraryId!);
          
          if (library.data.attributes.state !== 'development') {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Library "${library.data.attributes.name}" is not in development state`,
                  currentState: library.data.attributes.state,
                  reason: 'Only development libraries can be modified',
                  suggestion: 'Choose a different library or create a new one'
                }, null, 2)
              }]
            };
          }
          
          // Select this library
          currentLibraryId = libraryId!;
          currentLibraryName = library.data.attributes.name;
          
          const environment = await client.getLibraryEnvironment(libraryId!);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                library: {
                  id: libraryId,
                  name: library.data.attributes.name,
                  state: library.data.attributes.state,
                  environment: {
                    id: environment.data.id,
                    name: environment.data.attributes.name
                  }
                },
                message: `Library "${library.data.attributes.name}" selected for this session`,
                note: 'All subsequent changes will be saved to this library'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * CREATE RULE (with library enforcement)
     * ========================================================================
     */
    adobe_launch_create_rule: {
      title: 'Create new Rule',
      description: 'Create a new rule and save it to the selected library. REQUIRES a library to be selected first via adobe_launch_check_library_status.',
      inputSchema: createLaunchRuleSchema,
      
      handler: async (args: any) => {
        try {
          // ENFORCE: Library must be selected
          if (!currentLibraryId) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No library selected',
                  requiredAction: 'You must select or create a library first',
                  nextSteps: [
                    '1. Call adobe_launch_check_library_status',
                    '2. Follow the guidance to select or create a library',
                    '3. Then retry this operation'
                  ]
                }, null, 2)
              }]
            };
          }
          
          const validatedArgs = AdobeLaunchRuleSchema.parse(args);
          const result = await client.createRuleInLibrary(validatedArgs, currentLibraryId);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                rule: {
                  id: result.rule.data.id,
                  name: result.rule.data.attributes.name
                },
                library: {
                  id: currentLibraryId,
                  name: currentLibraryName
                },
                message: `Rule "${validatedArgs.name}" created and added to library "${currentLibraryName}"`,
                reminder: 'Use adobe_launch_build_library when ready to build all changes'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * ADD CONDITION TO RULE (with library enforcement)
     * ========================================================================
     */
    adobe_launch_add_condition: {
      title: 'Add condition to a rule',
      description: 'Add a condition to an existing rule and save changes to the selected library. REQUIRES a library to be selected first.',
      inputSchema: addConditionToRuleSchema,
      
      handler: async (args: any) => {
        try {
          // ENFORCE: Library must be selected (except for dry-run)
          if (!args.dryRun && !currentLibraryId) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No library selected',
                  requiredAction: 'Select or create a library first',
                  tip: 'You can use dryRun=true to preview without selecting a library'
                }, null, 2)
              }]
            };
          }
          
          // Resolve rule ID
          let ruleId = args.ruleId;
          if (!ruleId && args.ruleName) {
            const rules = await client.searchRules(`^${args.ruleName}$`);
            if (rules.length !== 1) {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: rules.length === 0 ? 'Rule not found' : 'Multiple rules match'
                  }, null, 2)
                }]
              };
            }
            ruleId = rules[0].id;
          }
          
          // Dry run
          if (args.dryRun) {
            const currentRule = await client.getRuleDetails(ruleId);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  dryRun: true,
                  targetRule: {
                    id: currentRule.rule.id,
                    name: currentRule.rule.attributes.name
                  },
                  conditionToAdd: args.condition,
                  currentConditions: currentRule.conditions.length,
                  afterAddition: currentRule.conditions.length + 1
                }, null, 2)
              }]
            };
          }
          
          // Execute and add to library
          const componentResult = await client.createRuleComponent(ruleId, args.condition, 'conditions');
          await client.addResourceToLibrary(currentLibraryId!, ruleId, 'rules');
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                condition: {
                  id: componentResult.data.id,
                  name: componentResult.data.attributes.name
                },
                library: {
                  id: currentLibraryId,
                  name: currentLibraryName
                },
                message: 'Condition added and rule updated in library'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    /**
     * ========================================================================
     * BUILD LIBRARY
     * ========================================================================
     * Creates a build from the library so changes can be deployed
     */
    adobe_launch_build_library: {
      title: 'Build working library',
      description: 'Build the selected library to deploy changes to the development environment. This creates a build script. CANNOT publish to staging or production - that must be done manually in Adobe Launch UI.',
      inputSchema: genericObjectSchema,
      
      handler: async () => {
        try {
          if (!currentLibraryId) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No library selected to build'
                }, null, 2)
              }]
            };
          }
          
          const buildResult = await client.buildLibrary(currentLibraryId);
          const build = await client.getBuild(buildResult.data.id);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                library: {
                  id: currentLibraryId,
                  name: currentLibraryName
                },
                build: {
                  id: build.data.id,
                  status: build.data.attributes.status,
                  created_at: build.data.attributes.created_at
                },
                message: `Library "${currentLibraryName}" built successfully`,
                deploymentScript: build.data.attributes.web_path || 'Building...',
                importantNote: [
                  'This build is ONLY in Development environment',
                  'To promote to Staging or Production:',
                  '1. Go to Adobe Launch UI',
                  '2. Navigate to Publishing',
                  '3. Manually submit and approve for higher environments'
                ],
                warning: 'This MCP server CANNOT publish to Staging or Production (by design for safety)'
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }],
            isError: true
          };
        }
      }
    },

    // ... (include read-only tools: list_rules, search_rules, get_rule, list_extensions, etc.)
    
    /**
     * ========================================================================
     * CAPABILITIES
     * ========================================================================
     */
    adobe_launch_get_capabilities: {
      title: 'Get information about the Tool',
      description: 'Get information about what this MCP server can and cannot do, including library/publishing restrictions.',
      inputSchema: genericObjectSchema,
      
      handler: async () => {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              version: '2.0.0-production-with-libraries',
              libraryWorkflow: {
                required: true,
                description: 'ALL changes must go through a Development library',
                workflow: [
                  '1. Check library status (adobe_launch_check_library_status)',
                  '2. Either select existing or create new library',
                  '3. Make changes (create/update rules, etc.)',
                  '4. Build library when done',
                  '5. Manually publish in Adobe Launch UI'
                ]
              },
              capabilities: {
                libraryManagement: {
                  canDo: [
                    'List development libraries',
                    'Create new development libraries (if environment available)',
                    'Select library for session',
                    'Build library to development environment'
                  ],
                  cannotDo: [
                    'Submit to Staging (manual in UI only)',
                    'Publish to Production (manual in UI only)',
                    'Approve library promotions',
                    'Modify libraries in submitted/approved state'
                  ],
                  reasoning: 'Publishing restrictions are INTENTIONAL for safety'
                },
                ruleManagement: {
                  canDo: [
                    'Create rules in selected library',
                    'Update rules and add to library',
                    'Add conditions/actions to rules',
                    'Bulk add conditions with dry-run'
                  ],
                  requiresLibrary: true
                }
              },
              criticalLimitations: {
                noStagingPublish: 'Cannot submit to Staging - must use Adobe Launch UI',
                noProductionPublish: 'Cannot publish to Production - must use Adobe Launch UI',
                developmentOnly: 'All API changes are Development environment only',
                manualApproval: 'Promotion workflows require manual approval in UI'
              },
              safetyFeatures: {
                libraryEnforcement: 'All changes require library selection',
                dryRunAvailable: 'Preview changes before executing',
                developmentLock: 'Cannot accidentally publish to production',
                buildNotification: 'Reminds user to build after changes'
              }
            }, null, 2)
          }]
        };
      }
    }
  };
}

// Export function to reset library state (for new sessions)
export function resetLibraryState() {
  currentLibraryId = null;
  currentLibraryName = null;
}