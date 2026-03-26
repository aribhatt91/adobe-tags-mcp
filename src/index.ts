#!/usr/bin/env node

/**
 * Tag Manager MCP Server
 * 
 * This is the main entry point for the MCP server.
 * It does the following:
 * 1. Loads environment variables
 * 2. Initializes API clients (Adobe Launch and/or GTM)
 * 3. Creates MCP tools from those clients
 * 4. Starts the MCP server
 * 5. Handles requests from Claude
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
//import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { AdobeLaunchClient } from './clients/adobe-launch.client.js';
import { GTMClient } from './clients/gtm.client.js';
import { createAdobeLaunchTools } from './tools/adobe-launch.tools.js';
import { createWeatherAPITool } from './tools/test.tool.js';
import { createGTMTools } from './tools/gtm.tools.js';

// ============================================================================
// STEP 1: Load Environment Variables
// ============================================================================

dotenv.config({
    // Suppress .dotenv messages, else mcp may not work correctly as it prints messages to stdout
    quiet: true
});

// Define which environment variables are needed for each platform
const requiredEnvVars = {
  adobe: [
    'ADOBE_CLIENT_ID',
    'ADOBE_CLIENT_SECRET',
    'ADOBE_COMPANY_ID',
    'ADOBE_LAUNCH_PROPERTY_ID'
  ],
  gtm: [
    'GTM_ACCOUNT_ID',
    'GTM_CONTAINER_ID',
    'GTM_AUTH_TOKEN'
  ]
};

// ============================================================================
// STEP 2: Check Which Platforms Are Configured
// ============================================================================

// Check configuration mode
const hasClientSecret = !!process.env.ADOBE_CLIENT_SECRET;
const hasAccessToken = !!process.env.ADOBE_ACCESS_TOKEN;

// Check if all required environment variables are present
const adobeConfigured = requiredEnvVars.adobe.every(envVar => process.env[envVar]) && (hasAccessToken || hasClientSecret);
const gtmConfigured = requiredEnvVars.gtm.every(envVar => process.env[envVar]);

// At least one platform must be configured
if (!adobeConfigured && !gtmConfigured) {
  console.error('Error: No tag management platforms configured.');
  console.error('');
  console.error('Please set environment variables for at least one platform:');
  console.error('');
  console.error('Adobe Launch:');
  requiredEnvVars.adobe.forEach(v => console.error(`  - ${v}`));
  console.error('');
  console.error('Google Tag Manager:');
  requiredEnvVars.gtm.forEach(v => console.error(`  - ${v}`));
  console.error('');
  process.exit(1);
}

// ============================================================================
// STEP 3: Initialize Clients and Tools
// ============================================================================

let adobeClient: AdobeLaunchClient | undefined;
let gtmClient: GTMClient | undefined;
let allTools: Record<string, any> = {};
const enabledPlatforms: string[] = [];

// Initialize Adobe Launch if configured
if (adobeConfigured) {
  console.error('Initializing Adobe Launch client...');

  if (hasAccessToken) {
    // Use only for testing
    console.error('Using manual token mode (expires in 24h)');
    
    adobeClient = new AdobeLaunchClient(
        process.env.ADOBE_CLIENT_ID!,
        process.env.ADOBE_ACCESS_TOKEN!,
        process.env.ADOBE_ORG_ID!,
        process.env.ADOBE_COMPANY_ID!,
        process.env.ADOBE_LAUNCH_PROPERTY_ID!
    );
  }else {
    console.error('Using automatic token refresh mode');
    adobeClient = new AdobeLaunchClient(
        process.env.ADOBE_CLIENT_ID!,
        null,
        process.env.ADOBE_ORG_ID!,
        process.env.ADOBE_COMPANY_ID!,
        process.env.ADOBE_LAUNCH_PROPERTY_ID!,
        process.env.ADOBE_CLIENT_SECRET
    );
  }
  
  // Create tools for Adobe Launch
  const adobeTools = createAdobeLaunchTools(adobeClient);
  allTools = { ...allTools, ...adobeTools };
  enabledPlatforms.push('Adobe Launch');
  
  console.error('Adobe Launch configured');
  console.error(`   - Company: ${process.env.ADOBE_COMPANY_ID}`);
  console.error(`   - Property: ${process.env.ADOBE_LAUNCH_PROPERTY_ID}`);
}

// Initialize Google Tag Manager if configured
if (false && gtmConfigured) {
  console.error('Initializing Google Tag Manager client...');
  
  gtmClient = new GTMClient(
    process.env.GTM_AUTH_TOKEN!,
    process.env.GTM_ACCOUNT_ID!,
    process.env.GTM_CONTAINER_ID!
  );
  
  // Create tools for GTM
  //const gtmTools = createGTMTools(gtmClient);
  //allTools = { ...allTools, ...gtmTools };
  enabledPlatforms.push('Google Tag Manager');
  
  console.error('Google Tag Manager configured');
  console.error(`   - Account: ${process.env.GTM_ACCOUNT_ID}`);
  console.error(`   - Container: ${process.env.GTM_CONTAINER_ID}`);
}

allTools = {...allTools, ...createWeatherAPITool()}

// ============================================================================
// STEP 4: Create the MCP Server
// ============================================================================

console.error('Creating MCP server...');

const server = new McpServer(
  {
    name: 'tag-manager-mcp',
    version: '1.0.0',
  }
);

// ============================================================================
// STEP 5: Register Request Handlers
// ============================================================================

/**
 * Handler for ListTools requests
 * 
 * This is called when Claude wants to know what tools are available.
 * We need to return a list of all tools with their schemas.
 */

/* 
  server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('📋 Listing available tools...');
  
  const tools = Object.entries(allTools).map(([name, tool]) => ({
    name,
    description: tool.description,
    // Convert Zod schema to JSON Schema format for Claude
    inputSchema: tool.inputSchema.shape ? {
      type: 'object',
      properties: Object.entries(tool.inputSchema.shape).reduce((acc: any, [key, value]: [string, any]) => {
        acc[key] = {
          type: value._def.typeName.toLowerCase().replace('zod', ''),
          description: value._def.description || ''
        };
        return acc;
      }, {}),
      required: Object.entries(tool.inputSchema.shape)
        .filter(([_, value]: [string, any]) => !value.isOptional())
        .map(([key]) => key)
    } : tool.inputSchema
  }));

  console.error(`   Found ${tools.length} tools`);
  return { tools };
});
 */
/**
 * Handler for CallTool requests
 * 
 * This is called when Claude wants to execute a tool.
 * We validate the tool exists, then call its handler.
 */
/* server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`Tool called: ${name}`);
  console.error(`   Arguments:`, JSON.stringify(args, null, 2));

  // Check if the tool exists
  const tool = allTools[name];
  if (!tool) {
    console.error(`Unknown tool: ${name}`);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Unknown tool: ${name}`,
          availableTools: Object.keys(allTools)
        })
      }],
      isError: true
    };
  }

  // Execute the tool
  try {
    const result = await tool.handler(args || {});
    console.error(`Tool executed successfully`);
    return result;
  } catch (error: any) {
    console.error(`Tool execution failed:`, error.message);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          stack: error.stack
        })
      }],
      isError: true
    };
  }
}); */

for (const [toolName, toolDef] of Object.entries(allTools)) {
  console.error(`Registering tool - ${toolName}`);
  const { title=toolName, description, inputSchema, handler } = toolDef;
  /* server.tool(
    toolName,              // Name
    toolDef.description,   // Description
    toolDef.inputSchema,   // Zod schema
    toolDef.handler        // Async handler
  ); */
  server.registerTool(
    toolName,
    {
      title,
      description,
      inputSchema
    },
    handler
  )
}

// ============================================================================
// STEP 6: Start the Server
// ============================================================================

async function main() {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  Tag Manager MCP Server');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('');
  console.error(`Enabled platforms: ${enabledPlatforms.join(', ')}`);
  console.error(`Available tools: ${Object.keys(allTools).length}`);
  console.error('');
  console.error('Tool list:');
  Object.keys(allTools).forEach(tool => {
    console.error(`  - ${tool}`);
  });
  console.error('');
  console.error('Server is ready and waiting for connections...');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('');
  
  // Create stdio transport (communicates via stdin/stdout)
  const transport = new StdioServerTransport();
  
  // Connect the server to the transport
  await server.connect(transport);
  
  console.error('MCP Server connected and running');
}

// Run the server and handle any startup errors
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});