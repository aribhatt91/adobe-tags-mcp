import axios, { type AxiosInstance } from 'axios';
import type { AdobeLaunchRule, AdobeLaunchDataElement } from '../types/index.js';
import { TokenManager } from '../utils/token-manager.js';

const BASE_URL = 'https://reactor.adobe.io';

/**
 * Adobe Launch API Client with Library Management
 * 
 * Adobe Launch Workflow:
 * 1. Changes are made in a LIBRARY (not directly to property)
 * 2. Libraries are associated with ENVIRONMENTS (Development, Staging, Production)
 * 3. Only Development libraries can be created/modified via API
 * 4. Libraries must be BUILT to apply changes
 * 5. Promotion to Staging/Production is MANUAL in UI only
 */
export class AdobeLaunchClient {
  private client: AxiosInstance;
  private companyId: string;
  private propertyId: string;
  private tokenManager: TokenManager | null = null;
  private apiKey: string;
  private imsOrgId: string;

  constructor(
    apiKey: string, 
    accessTokenOrClientSecret: string | null, 
    imsOrgId: string,
    companyId: string, 
    propertyId: string,
    clientSecret?: string,
    ) {
    this.apiKey = apiKey;
    this.imsOrgId = imsOrgId;
    this.companyId = companyId;
    this.propertyId = propertyId;

    // If client secret provided, use token manager
    if (clientSecret) {
      this.tokenManager = new TokenManager(this.apiKey, clientSecret);
    }
    
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        //'Authorization': `Bearer ${accessToken}`,
        'X-Api-Key': apiKey,
        'x-gw-ims-org-id': imsOrgId,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json;revision=1'
      }
    });
    // Add request interceptor to inject fresh token
    this.client.interceptors.request.use(async (config) => {
      if (this.tokenManager) {
        // Get fresh token (auto-refreshes if needed)
        const token = await this.tokenManager.getToken();
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Use static token
        config.headers.Authorization = `Bearer ${accessTokenOrClientSecret}`;
      }
      return config;
    });

    // Add response interceptor to handle token expiry
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // If 401 and we have token manager, force refresh and retry
        if (error.response?.status === 401 && this.tokenManager) {
          try {
            //console.error('401 error, forcing token refresh...');
            await this.tokenManager.getToken();
            // Retry the request with new token
            return this.client.request(error.config);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize client (load/refresh token)
   */
  async initialize(): Promise<void> {
    if (this.tokenManager) {
      await this.tokenManager.initialize();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.tokenManager) {
      this.tokenManager.destroy();
    }
  }

  // ============================================================================
  // PROPERTY MANAGEMENT
  // ============================================================================

  /**
   * List all libraries in the property
   */
  async listProperties(): Promise<any[]> {
    try {
      const response = await this.client.get(`/companies/${this.companyId}/properties`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list properties: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  // ============================================================================
  // LIBRARY MANAGEMENT
  // ============================================================================

  /**
   * List all libraries in the property
   */
  async listLibraries(): Promise<any[]> {
    try {
      const response = await this.client.get(`/properties/${this.propertyId}/libraries`);
      return response.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list libraries: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Get development libraries (state = development)
   */
  async getDevelopmentLibraries(): Promise<any[]> {
    try {
      const allLibraries = await this.listLibraries();
      return allLibraries.filter((lib: any) => 
        lib.attributes.state === 'development'
      );
    } catch (error: any) {
      throw new Error(`Failed to get development libraries: ${error.message}`);
    }
  }

  /**
   * Get a specific library with full details
   */
  async getLibrary(libraryId: string): Promise<any> {
    try {
      const response = await this.client.get(`/libraries/${libraryId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get library: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * List all environments
   */
  async listEnvironments(): Promise<any[]> {
    try {
      const response = await this.client.get(`/properties/${this.propertyId}/environments`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list environments: ${error.message}`);
    }
  }

  /**
   * Get available development environments (not assigned to a library)
   */
  async getAvailableDevelopmentEnvironments(): Promise<any[]> {
    try {
      const environments = await this.listEnvironments();
      const libraries = await this.listLibraries();
      
      // Filter for development environments
      const devEnvironments = environments.filter((env: any) => 
        env.attributes.stage === 'development'
      );
      
      // Find which environments are assigned to libraries
      const assignedEnvIds = new Set(
        libraries
          .filter((lib: any) => lib.relationships?.environment?.data?.id)
          .map((lib: any) => lib.relationships.environment.data.id)
      );
      
      // Return unassigned development environments
      return devEnvironments.filter((env: any) => !assignedEnvIds.has(env.id));
    } catch (error: any) {
      throw new Error(`Failed to get available environments: ${error.message}`);
    }
  }

  /**
   * Create a new library
   * IMPORTANT: Can only create in Development environment
   */
  async createLibrary(name: string, environmentId: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/properties/${this.propertyId}/libraries`,
        {
          data: {
            type: 'libraries',
            attributes: {
              name: name
            },
            relationships: {
              environment: {
                data: {
                  id: environmentId,
                  type: 'environments'
                }
              }
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create library: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Add a resource (rule, data element, extension) to a library
   */
  async addResourceToLibrary(libraryId: string, resourceId: string, resourceType: 'rules' | 'data_elements' | 'extensions'): Promise<any> {
    try {
      const response = await this.client.post(
        `/libraries/${libraryId}/relationships/${resourceType}`,
        {
          data: [{
            id: resourceId,
            type: resourceType
          }]
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to add resource to library: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Build a library
   * This creates a build that can be deployed to the environment
   */
  async buildLibrary(libraryId: string): Promise<any> {
    try {
      // First, transition to submitted state if needed
      const library = await this.getLibrary(libraryId);
      
      if (library.data.attributes.state === 'development') {
        // Transition to submitted
        await this.client.patch(
          `/libraries/${libraryId}`,
          {
            data: {
              id: libraryId,
              type: 'libraries',
              meta: {
                action: 'submit'
              }
            }
          }
        );
      }
      
      // Now build
      const response = await this.client.post(
        `/libraries/${libraryId}/builds`,
        {
          data: {
            type: 'builds',
            relationships: {
              library: {
                data: {
                  id: libraryId,
                  type: 'libraries'
                }
              }
            }
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to build library: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Get build status and script
   */
  async getBuild(buildId: string): Promise<any> {
    try {
      const response = await this.client.get(`/builds/${buildId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get build: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Get the environment associated with a library
   */
  async getLibraryEnvironment(libraryId: string): Promise<any> {
    try {
      const library = await this.getLibrary(libraryId);
      const envId = library.data.relationships?.environment?.data?.id;
      
      if (!envId) {
        throw new Error('Library has no environment assigned');
      }
      
      const response = await this.client.get(`/environments/${envId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get library environment: ${error.message}`);
    }
  }

  // ============================================================================
  // RULE OPERATIONS (enhanced with library support)
  // ============================================================================

  /**
   * Create a rule and add it to a library
   */
  async createRuleInLibrary(rule: AdobeLaunchRule, libraryId: string): Promise<any> {
    try {
      // Create the rule
      const ruleResult = await this.createRule(rule);
      const ruleId = ruleResult.data.id;
      
      // Add rule components
      for (const event of rule.events) {
        await this.createRuleComponent(ruleId, event, 'events');
      }
      
      if (rule.conditions) {
        for (const condition of rule.conditions) {
          await this.createRuleComponent(ruleId, condition, 'conditions');
        }
      }
      
      for (const action of rule.actions) {
        await this.createRuleComponent(ruleId, action, 'actions');
      }
      
      // Add to library
      await this.addResourceToLibrary(libraryId, ruleId, 'rules');
      
      return {
        rule: ruleResult,
        addedToLibrary: true,
        libraryId
      };
    } catch (error: any) {
      throw new Error(`Failed to create rule in library: ${error.message}`);
    }
  }

  /**
   * Update rule component and add to library
   */
  async updateRuleComponentInLibrary(componentId: string, updates: any, libraryId: string): Promise<any> {
    try {
      // Update the component
      const result = await this.updateRuleComponent(componentId, updates);
      
      // Get the rule ID for this component
      const component = await this.getRuleComponent(componentId);
      const ruleId = component.data.relationships.rule.data.id;
      
      // Add rule to library (if not already there)
      await this.addResourceToLibrary(libraryId, ruleId, 'rules');
      
      return {
        component: result,
        addedToLibrary: true,
        libraryId
      };
    } catch (error: any) {
      throw new Error(`Failed to update component in library: ${error.message}`);
    }
  }

  // ============================================================================
  // EXISTING OPERATIONS (from previous version)
  // ============================================================================

  async getRule(ruleId: string): Promise<any> {
    try {
      const response = await this.client.get(`/rules/${ruleId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get rule: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async getRuleComponents(ruleId: string): Promise<any> {
    try {
      const response = await this.client.get(`/rules/${ruleId}/rule_components`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to get rule components: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async searchRules(pattern: string): Promise<any[]> {
    try {
      const allRules = await this.listRules();
      const regex = new RegExp(pattern, 'i');
      return allRules.filter((rule: any) => 
        regex.test(rule.attributes.name)
      );
    } catch (error: any) {
      throw new Error(`Failed to search rules: ${error.message}`);
    }
  }

  async createRule(rule: AdobeLaunchRule): Promise<any> {
    try {
      const response = await this.client.post(
        `/properties/${this.propertyId}/rules`,
        {
          data: {
            type: 'rules',
            attributes: {
              name: rule.name,
              enabled: rule.enabled
            },
            relationships: {
              property: {
                data: {
                  id: this.propertyId,
                  type: 'properties'
                }
              }
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create rule: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async updateRule(ruleId: string, updates: Partial<{ name: string; enabled: boolean }>): Promise<any> {
    try {
      const current = await this.getRule(ruleId);
      
      const response = await this.client.patch(
        `/rules/${ruleId}`,
        {
          data: {
            type: 'rules',
            id: ruleId,
            attributes: {
              ...current.data.attributes,
              ...updates
            },
            meta: {
              revision_number: current.data.meta?.revision_number
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update rule: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async listRules(): Promise<any[]> {
    try {
      const response = await this.client.get(`/properties/${this.propertyId}/rules`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list rules: ${error.message}`);
    }
  }

  async getRuleComponent(componentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/rule_components/${componentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get rule component: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async createRuleComponent(ruleId: string, component: any, componentType: 'events' | 'conditions' | 'actions'): Promise<any> {
    try {
      const response = await this.client.post(
        `/properties/${this.propertyId}/rule_components`,
        {
          data: {
            type: 'rule_components',
            attributes: {
              delegate_descriptor_id: component.moduleType,
              name: component.name,
              settings: component.settings || {},
              negate: component.negate || false,
              order: component.order || 0
            },
            relationships: {
              rule: {
                data: {
                  id: ruleId,
                  type: 'rules'
                }
              }
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create rule component: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async updateRuleComponent(componentId: string, updates: any): Promise<any> {
    try {
      const current = await this.getRuleComponent(componentId);
      
      const response = await this.client.patch(
        `/rule_components/${componentId}`,
        {
          data: {
            type: 'rule_components',
            id: componentId,
            attributes: {
              ...current.data.attributes,
              ...updates
            },
            meta: {
              revision_number: current.data.meta?.revision_number
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update rule component: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async getRuleDetails(ruleId: string): Promise<any> {
    const rule = await this.getRule(ruleId);
    const components = await this.getRuleComponents(ruleId);
    
    return {
      rule: rule.data,
      events: components.filter((c: any) => c.attributes.delegate_descriptor_id.includes('events')),
      conditions: components.filter((c: any) => c.attributes.delegate_descriptor_id.includes('conditions')),
      actions: components.filter((c: any) => c.attributes.delegate_descriptor_id.includes('actions'))
    };
  }

  async addConditionToRules(rulePattern: string, condition: any): Promise<{ succeeded: string[]; failed: any[] }> {
    const matchingRules = await this.searchRules(rulePattern);
    const results = { succeeded: [] as string[], failed: [] as any[] };

    for (const rule of matchingRules) {
      try {
        await this.createRuleComponent(rule.id, condition, 'conditions');
        results.succeeded.push(rule.attributes.name);
      } catch (error: any) {
        results.failed.push({
          rule: rule.attributes.name,
          error: error.message
        });
      }
    }

    return results;
  }

  async createDataElement(dataElement: AdobeLaunchDataElement): Promise<any> {
    try {
      const response = await this.client.post(
        `/properties/${this.propertyId}/data_elements`,
        {
          data: {
            type: 'data_elements',
            attributes: {
              name: dataElement.name,
              delegate_descriptor_id: dataElement.delegate_descriptor_id,
              settings: dataElement.settings || {},
              clean_text: dataElement.clean_text,
              force_lowercase: dataElement.force_lowercase,
              storage_duration: dataElement.storage_duration
            },
            relationships: {
              property: {
                data: {
                  id: this.propertyId,
                  type: 'properties'
                }
              }
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create data element: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  async listDataElements(): Promise<any[]> {
    try {
      const response = await this.client.get(`/properties/${this.propertyId}/data_elements`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list data elements: ${error.message}`);
    }
  }

  /**
   * Get a specific data element by ID
   */
  async getDataElement(dataElementId: string): Promise<any> {
    try {
      const response = await this.client.get(`/data_elements/${dataElementId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get data element: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Update a data element
   */
  async updateDataElement(dataElementId: string, updates: any): Promise<any> {
    try {
      const current = await this.getDataElement(dataElementId);
      
      const response = await this.client.patch(
        `/data_elements/${dataElementId}`,
        {
          data: {
            type: 'data_elements',
            id: dataElementId,
            attributes: {
              ...current.data.attributes,
              ...updates
            },
            meta: {
              revision_number: current.data.meta?.revision_number
            }
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to update data element: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Delete a data element
   */
  async deleteDataElement(dataElementId: string): Promise<void> {
    try {
      await this.client.delete(`/data_elements/${dataElementId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete data element: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Search data elements by name pattern
   */
  async searchDataElements(pattern: string): Promise<any[]> {
    try {
      const allDataElements = await this.listDataElements();
      const regex = new RegExp(pattern, 'i');
      return allDataElements.filter((de: any) => 
        regex.test(de.attributes.name)
      );
    } catch (error: any) {
      throw new Error(`Failed to search data elements: ${error.message}`);
    }
  }

  /**
   * Create data element and add to library
   */
  async createDataElementInLibrary(dataElement: AdobeLaunchDataElement, libraryId: string): Promise<any> {
    try {
      const result = await this.createDataElement(dataElement);
      const dataElementId = result.data.id;
      
      // Add to library
      await this.addResourceToLibrary(libraryId, dataElementId, 'data_elements');
      
      return {
        dataElement: result,
        addedToLibrary: true,
        libraryId
      };
    } catch (error: any) {
      throw new Error(`Failed to create data element in library: ${error.message}`);
    }
  }

  async listExtensions(): Promise<any[]> {
    try {
      const response = await this.client.get(`/properties/${this.propertyId}/extensions`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(`Failed to list extensions: ${error.message}`);
    }
  }
}