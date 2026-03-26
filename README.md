```javascript
// claude_desktop_config.json

{
  "mcpServers": {
    "adobe-launch-gtm-mcp": {
      "command": "node",
      "args": ["C:\\username\\tms-mcp-server\\build\\index.js"],
      "env": {
        "ADOBE_LAUNCH_API_KEY":"your-launch-api-key",
        "ADOBE_LAUNCH_COMPANY_ID":"your-company-id",
        "ADOBE_ORG_ID":"your-org-id",
        "ADOBE_LAUNCH_PROPERTY_ID":"your-launch-property-id",
        "ADOBE_LAUNCH_CLIENT_SECRET":"your-client-secret"
      }
    },
    ...
  },
  ...
}

```