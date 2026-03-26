import axios, { type AxiosInstance } from 'axios';
import type { GTMTag, GTMTrigger, GTMVariable } from '../types/index.js';

/**
 * Google Tag Manager API Client
 * 
 * This client interacts with Google Tag Manager API v2
 * Documentation: https://developers.google.com/tag-platform/tag-manager/api/v2
 */
export class GTMClient {
  private client: AxiosInstance;
  private accountId: string;
  private containerId: string;

  /**
   * Initialize the GTM client
   * 
   * @param authToken - OAuth 2.0 access token
   * @param accountId - GTM Account ID (numeric)
   * @param containerId - GTM Container ID (numeric or GTM-XXXXX format)
   */
  constructor(authToken: string, accountId: string, containerId: string) {
    this.accountId = accountId;
    this.containerId = containerId;
    
    // Create axios instance with GTM API configuration
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/tagmanager/v2',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get the workspace path
   * GTM uses a hierarchical path structure for all resources
   * 
   * @returns Workspace path string
   */
  private getWorkspacePath(): string {
    // We're using the default workspace; you could make this configurable
    return `accounts/${this.accountId}/containers/${this.containerId}/workspaces/default`;
  }

  /**
   * Create a new tag in GTM
   * 
   * Tags are tracking pixels, analytics code, or custom scripts that fire
   * based on triggers
   * 
   * @param tag - Tag configuration
   * @returns Created tag data
   */
  async createTag(tag: GTMTag): Promise<any> {
    try {
      const response = await this.client.post(
        `/${this.getWorkspacePath()}/tags`,
        {
          name: tag.name,
          type: tag.type,
          parameter: tag.parameter || [],
          firingTriggerId: tag.firingTriggerId || [],
          blockingTriggerId: tag.blockingTriggerId || [],
          priority: tag.priority,
          paused: tag.paused
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create GTM tag: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * List all tags in the workspace
   * 
   * @returns Array of tags
   */
  async listTags(): Promise<any[]> {
    try {
      const response = await this.client.get(`/${this.getWorkspacePath()}/tags`);
      return response.data.tag || [];
    } catch (error: any) {
      throw new Error(`Failed to list GTM tags: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Create a new trigger in GTM
   * 
   * Triggers define when tags should fire (e.g., page view, button click, form submit)
   * 
   * @param trigger - Trigger configuration
   * @returns Created trigger data
   */
  async createTrigger(trigger: GTMTrigger): Promise<any> {
    try {
      const response = await this.client.post(
        `/${this.getWorkspacePath()}/triggers`,
        {
          name: trigger.name,
          type: trigger.type,
          filter: trigger.filter || [],
          autoEventFilter: trigger.autoEventFilter || []
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create GTM trigger: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * List all triggers in the workspace
   * 
   * @returns Array of triggers
   */
  async listTriggers(): Promise<any[]> {
    try {
      const response = await this.client.get(`/${this.getWorkspacePath()}/triggers`);
      return response.data.trigger || [];
    } catch (error: any) {
      throw new Error(`Failed to list GTM triggers: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Create a new variable in GTM
   * 
   * Variables store and return values that can be used in tags and triggers
   * (e.g., data layer variables, JavaScript variables, constants)
   * 
   * @param variable - Variable configuration
   * @returns Created variable data
   */
  async createVariable(variable: GTMVariable): Promise<any> {
    try {
      const response = await this.client.post(
        `/${this.getWorkspacePath()}/variables`,
        {
          name: variable.name,
          type: variable.type,
          parameter: variable.parameter || []
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create GTM variable: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * List all variables in the workspace
   * 
   * @returns Array of variables
   */
  async listVariables(): Promise<any[]> {
    try {
      const response = await this.client.get(`/${this.getWorkspacePath()}/variables`);
      return response.data.variable || [];
    } catch (error: any) {
      throw new Error(`Failed to list GTM variables: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get workspace information
   * 
   * This shows you the current state of your workspace
   * 
   * @returns Workspace data
   */
  async getWorkspace(): Promise<any> {
    try {
      const response = await this.client.get(`/${this.getWorkspacePath()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get GTM workspace: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Create a new workspace version (for publishing)
   * 
   * In GTM, you work in a workspace and create versions to publish changes.
   * This method creates a version that can then be published to live.
   * 
   * @param name - Version name
   * @param notes - Optional notes about this version
   * @returns Created version data
   */
  async createVersion(name: string, notes?: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/accounts/${this.accountId}/containers/${this.containerId}/versions`,
        {
          name,
          notes: notes || ''
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to create GTM version: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}