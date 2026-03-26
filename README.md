# Adobe Tags MCP Server

A natural language interface for Adobe Experience Platform Tags (formerly Adobe Launch). Talk to Claude to create, update, and audit your tag rules, data elements, and libraries — without writing code or navigating the Tags UI manually.

> **Who is this for?** Tag managers, analysts, developers, and QA testers who work with Adobe Tags daily. Non-technical users can describe what they want in plain English. Technical users can be as specific as they like with extension IDs and API-level detail.

> **Safety first.** This tool can only make changes to your **development** environment. It cannot submit, build, or publish to staging or production under any circumstance. Those steps must go through your existing review and approval process.

---

## Table of contents

- [What this tool can do](#what-this-tool-can-do)
- [Hard limits and safety guardrails](#hard-limits-and-safety-guardrails)
- [Setup and configuration](#setup-and-configuration)
- [How to use it — by role](#how-to-use-it--by-role)
- [Prompt library reference](#prompt-library-reference)
- [Known limitations and challenges](#known-limitations-and-challenges)
- [Adobe Reactor API reference](#adobe-reactor-api-reference)

---

## What this tool can do

### Property management
- List all Adobe Tag properties in your organisation
- Select a property to work with (persists for the session)
- Retrieve property settings, metadata, and publish state

### Data elements
- List, create, update, and delete data elements
- Set storage duration, default values, clean text, and lowercase options
- Supports all extension-provided data element types

### Rules and rule components
- List, create, update, and delete rules
- Add, update, and remove conditions, actions, and events from rules
- Reorder rule components
- Enable and disable rules

### Extensions
- List installed extensions and available extension packages
- Install and update extensions on a property

### Libraries (development only)
- Create a new dev library
- Add rules, data elements, and extensions to a dev library
- Build a dev library and poll for build status
- List resources in a library

### Bulk / complex operations
- Add a consent condition (e.g. C0004) to all rules matching a filter (e.g. all Meta/Facebook tags)
- Find all rules using a specific data element or extension
- Audit all rules missing a required condition
- Copy a rule component pattern across multiple rules

---

## Hard limits and safety guardrails

These restrictions are enforced at the server level. They cannot be overridden by any instruction, prompt, or user request — not even by developers.

### Environment restriction

**This tool operates on development only.**

| Action | Allowed |
|--------|---------|
| Read data from any environment (dev, staging, prod) | Yes — read-only |
| Create / update / delete resources in **development** | Yes |
| Build a **development** library | Yes |
| Submit a library to **staging** | **Never** |
| Build or approve in **staging** | **Never** |
| Publish to **production** | **Never** |
| Delete a property | **Never** |

If you ask Claude to do any of the blocked actions, it will explain why it can't and suggest the correct manual process instead.

### Bulk operation safety

Any operation that would modify more than one rule at once will:

1. Show you a named list of every rule that will be affected
2. Tell you exactly what change will be made to each
3. Stop and wait for you to type "yes" before proceeding
4. Report exactly which rules were updated and which (if any) failed

There is no way to skip the confirmation step for bulk operations.

### No undo

The Adobe Tags API does not support undo. Once a rule component is deleted or a data element is updated, the change cannot be automatically reversed. For any destructive operation (delete, overwrite), Claude will warn you explicitly and require confirmation. For safety-critical changes, consider cloning the rule first.

---

## Setup and configuration

### Prerequisites

- Node.js 18 or later
- An Adobe IO project with the Experience Platform Launch API enabled
- A service account with the correct product profiles assigned in Adobe Admin Console

### Environment variables

Create a `.env` file in the project root:

```env
# Adobe IO credentials
ADOBE_CLIENT_ID=your_client_id
ADOBE_CLIENT_SECRET=your_client_secret
ADOBE_ORG_ID=your_org_id@AdobeOrg
ADOBE_TECHNICAL_ACCOUNT_ID=your_technical_account@techacct.adobe.com
ADOBE_PRIVATE_KEY_PATH=./private.key

# Optional: lock to a specific company ID (recommended for production use)
ADOBE_COMPANY_ID=COxxxxxxxxxxx

# Optional: restrict to dev environment builds only (default: true)
ALLOW_DEV_BUILDS_ONLY=true
```

### Installation

```bash
npm install
npm run build
```

### Connecting to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "adobe-tags": {
      "command": "node",
      "args": ["/absolute/path/to/adobe-tags-mcp/dist/index.js"],
      "env": {
        "ADOBE_CLIENT_ID": "your_client_id",
        "ADOBE_CLIENT_SECRET": "your_client_secret",
        "ADOBE_ORG_ID": "your_org_id@AdobeOrg",
        "ADOBE_TECHNICAL_ACCOUNT_ID": "your_account@techacct.adobe.com"
      }
    }
  }
}
```

Restart Claude Desktop. The server will appear in the tools panel.

### Development mode (with live reload)

```bash
npm run inspect      # Opens MCP inspector at localhost:5173
npm run typecheck:watch  # Type checking in parallel
```

---

## How to use it — by role

### For everyone: start every session the same way

Before anything else, tell Claude which property to work on:

> "Show me my Tag properties"

Claude will list them and ask you to pick one. After that, you don't need to mention the property again — it remembers for the rest of the session.

---

### For tag managers and analysts

You do not need to know extension IDs, API names, or technical settings. Describe what you want in plain English and Claude will ask for any details it needs.

**Audit and reporting:**
> "Which rules are missing a consent check?"
> "Show me all the rules that fire Meta or Facebook tags"
> "Find every rule that uses the Page Name data element"
> "Compare the Meta Page View rule with the Meta Add to Cart rule — are they set up consistently?"

**Making changes:**
> "Add a C0004 cookie consent check to all Meta and Facebook rules"
> "Create a rule that fires on page load and sends a page view event to Meta"
> "Rename the data element called 'pg_name' to 'Page Name'"

**For bulk operations**, Claude will always show you a list of what will be changed and ask you to confirm before touching anything. You can review and say no if something looks wrong.

**If you're unsure what to call something**, just describe it — Claude will find the closest match and confirm before acting:
> "Update the checkout tag... the one that fires on the order confirmation page"

---

### For developers and QA

Full control with technical specificity when you need it:

> "Create a Custom Code data element called 'Consent Categories' that reads window.OnetrustActiveGroups"
> "Add a condition to the Meta Purchase rule using extension ID EX123 with consentCategory C0004"
> "List all rule components on the Checkout Confirmation rule including their order and extension IDs"
> "Add all changed rules and data elements to a new dev library called 'Sprint 42' and build it"

**Testing a change:**
> "Show me the exact settings of the C0004 condition on the Meta Page View rule"
> "Which rules were modified since the last library build?"
> "Clone the Meta Page View rule as Meta Page View - TEST so I can verify changes safely"

---

### For non-technical stakeholders

You can ask questions in completely plain language — no tags knowledge required:

> "What consent checks do we have on our advertising tags?"
> "Are our Meta tags compliant with cookie consent rules?"
> "How many rules do we have for Google Analytics?"
> "What would change if we added a consent check to all Facebook tags?"

Claude will explain what it finds in plain English and will always ask before making any changes.

---

### How Claude handles ambiguity

If your instruction is unclear or missing details, Claude will ask rather than guess:

| Situation | What Claude does |
|-----------|-----------------|
| No property selected | Lists all properties and asks which one |
| Rule name is ambiguous | Shows the closest matches and asks which one |
| Bulk operation would affect many rules | Shows the full list and asks for explicit confirmation |
| A required setting is missing | Asks for it in plain language before proceeding |
| A typo in a rule or element name | Finds the closest match and confirms before acting |

---

## Prompt library reference

See `src/prompts/` for the full implementation. The following named prompts are available as slash commands in Claude Desktop:

| Prompt | Slash command | Audience | What it does |
|--------|--------------|----------|--------------|
| Select property | `/select-property` | Everyone | Lists properties and guides selection |
| Consent compliance report | `/consent-compliance-report` | Stakeholders, analysts | Plain-English compliance summary, no jargon |
| Audit consent | `/audit-consent` | Tag managers, developers | Finds rules missing a named consent condition |
| Add consent to vendor | `/add-consent-to-vendor` | Tag managers, developers | Adds a consent condition to all rules for a vendor — preview + confirm |
| Create data element | `/create-data-element` | Tag managers, developers | Guided data element creation |
| Create rule | `/create-rule` | Tag managers, developers | Guided rule creation with events, conditions, and actions |
| Build dev library | `/build-dev-library` | Developers, QA | Adds changed resources and triggers a dev build |
| Compare rules | `/compare-rules` | Developers, QA | Shows diff between two rules |
| Clone rule | `/clone-rule` | Developers, QA | Duplicates a rule with a new name |
| Find by data element | `/find-by-data-element` | Developers, QA | Finds all rules using a specific data element |

---

## Known limitations and challenges

### API rate limits

The Adobe Reactor API enforces rate limits. Bulk operations that affect many rules (e.g. adding a consent condition to 50 rules) will be throttled — the agent handles this with retry logic and exponential backoff, but large operations will be slower than expected.

### No atomic transactions

The Reactor API has no rollback mechanism. If a bulk operation fails halfway through (e.g. after updating 30 of 50 rules), the changes already applied remain. The agent logs exactly which resources were modified before the failure so you can resume or manually correct.

### Rule component ordering

The Reactor API returns rule components in creation order, not display order. When reordering conditions or actions, the agent must delete and recreate components to change position, which means IDs will change.

### Data element dependency resolution

When creating or updating a data element that other data elements depend on, the API does not automatically flag dependency conflicts. The agent cannot guarantee safe deletion of a data element without first auditing all rules and other data elements that reference it.

### Extension version conflicts

Installing a new version of an extension may break existing rule components that depend on settings from the old version. The agent will warn when an extension upgrade is requested but cannot automatically validate all downstream component compatibility.

### Build time unpredictability

Dev library build times vary from seconds to several minutes depending on property size and Adobe's infrastructure load. The agent polls for build status but has a timeout — if a build takes too long, it will report the build was initiated and advise you to check the Tags UI.

### Context window limits for large properties

Properties with hundreds of rules and data elements produce large API responses. For very large properties, the agent may need to paginate across multiple tool calls, which increases latency and may occasionally lose context between steps in a very long session.

### Consent condition complexity

The "add consent to all vendor rules" workflow requires the agent to correctly identify which rules belong to a vendor. It does this by matching rule names and action extension IDs against the vendor name you provide. This matching is heuristic — rules with ambiguous names may be missed or incorrectly included. Always review the preview list before confirming a bulk consent operation.

### No undo

There is no undo operation. Deleted rules, data elements, and rule components are gone unless you have a published library version to compare against. For any destructive operation, the agent will warn you and require explicit confirmation.

---

## Adobe Reactor API reference

- [Reactor API overview](https://developer.adobe.com/experience-platform-apis/references/reactor/)
- [Authentication guide](https://developer.adobe.com/developer-console/docs/guides/authentication/)
- [Extension packages](https://developer.adobe.com/experience-platform-apis/references/reactor/#tag/Extension-Packages)
- [Library publish workflow](https://experienceleague.adobe.com/docs/experience-platform/tags/publish/overview.html)
