/**
 * Intelligent source detection from user description
 */
export function detectSourceType(description: string): {
  type: string;
  confidence: number;
  extractedValue?: string;
} {
  const lower = description.toLowerCase();

  // Cookie detection
  if (lower.includes('cookie') || lower.match(/from\s+cookies?/)) {
    const cookieMatch = description.match(/cookie\s+(?:named|called)?\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    return {
      type: 'cookie',
      confidence: 0.9,
      extractedValue: cookieMatch?.[1] || ''
    };
  }

  // URL/Query parameter detection
  if (lower.includes('url param') || lower.includes('query param') || 
      lower.includes('utm_') || lower.match(/from\s+(?:the\s+)?url/)) {
    const paramMatch = description.match(/param(?:eter)?\s+["']?([a-zA-Z0-9_-]+)["']?/i) ||
                      description.match(/(utm_[a-z]+)/i);
    return {
      type: 'query-param',
      confidence: 0.9,
      extractedValue: paramMatch?.[1] || ''
    };
  }

  // Local/Session storage detection
  if (lower.includes('local storage') || lower.includes('localstorage')) {
    return { type: 'local-storage', confidence: 0.9 };
  }
  if (lower.includes('session storage') || lower.includes('sessionstorage')) {
    return { type: 'session-storage', confidence: 0.9 };
  }

  // Data layer detection
  if (lower.match(/data\s*layer/) || lower.includes('digitald ata') || 
      lower.match(/from\s+["']?digitaldata/i)) {
    return { type: 'data-layer', confidence: 0.85 };
  }

  // JavaScript variable detection
  if (lower.includes('window.') || lower.includes('global variable') ||
      lower.match(/from\s+window/)) {
    return { type: 'javascript-variable', confidence: 0.8 };
  }

  // Data element reference detection
  if (lower.match(/(?:using|from|reference)\s+(?:data\s+element|%.*%)/)) {
    return { type: 'data-element-reference', confidence: 0.85 };
  }

  // DOM element detection
  if (lower.includes('dom') || lower.includes('element text') || 
      lower.includes('attribute') || lower.match(/from\s+(?:the\s+)?page/)) {
    return { type: 'dom', confidence: 0.7 };
  }

  // Default to custom code for complex logic
  if (lower.includes('calculate') || lower.includes('compute') || 
      lower.includes('transform') || lower.includes('format') ||
      lower.includes('combine') || lower.includes('concatenate')) {
    return { type: 'custom-code', confidence: 0.8 };
  }

  // Default
  return { type: 'custom-code', confidence: 0.5 };
}

/**
 * Extract specific values from description
 */
export function extractValueFromDescription(description: string, sourceType: string): {
  path?: string;
  cookieName?: string;
  paramName?: string;
  storageKey?: string;
  selector?: string;
  attribute?: string;
  dataElementName?: string;
} {
  const result: any = {};

  // Extract path/object reference
  const pathPatterns = [
    /(?:path|from|at)\s*:?\s*["']?([a-zA-Z0-9._\[\]]+)["']?/i,
    /["']([a-zA-Z0-9._\[\]]+)["']/,
    /((?:window|digitalData|dataLayer)\.[a-zA-Z0-9._\[\]]+)/i
  ];

  for (const pattern of pathPatterns) {
    const match = description.match(pattern);
    if (match) {
      result.path = match[1];
      break;
    }
  }

  // Extract cookie name
  if (sourceType === 'cookie') {
    const cookieMatch = description.match(/cookie\s+(?:named|called)?\s*["']?([a-zA-Z0-9_-]+)["']?/i);
    result.cookieName = cookieMatch?.[1] || result.path;
  }

  // Extract parameter name
  if (sourceType === 'query-param') {
    const paramMatch = description.match(/param(?:eter)?\s+["']?([a-zA-Z0-9_-]+)["']?/i) ||
                      description.match(/(utm_[a-z]+)/i);
    result.paramName = paramMatch?.[1] || result.path;
  }

  // Extract storage key
  if (sourceType.includes('storage')) {
    const keyMatch = description.match(/key\s+["']?([a-zA-Z0-9_-]+)["']?/i);
    result.storageKey = keyMatch?.[1] || result.path;
  }

  // Extract DOM selector and attribute
  if (sourceType === 'dom') {
    const selectorMatch = description.match(/selector\s+["']?([^"']+)["']?/i) ||
                         description.match(/element\s+["']?([.#][^"'\s]+)["']?/i);
    result.selector = selectorMatch?.[1];

    const attrMatch = description.match(/attribute\s+["']?([a-zA-Z-]+)["']?/i);
    result.attribute = attrMatch?.[1];
  }

  // Extract data element reference
  if (sourceType === 'data-element-reference') {
    const deMatch = description.match(/%([^%]+)%/) ||
                   description.match(/data\s+element\s+["']?([^"']+)["']?/i);
    result.dataElementName = deMatch?.[1];
  }

  return result;
}

/**
 * Generate code based on source type and extracted values
 */
export function generateCodeForSource(
  sourceType: string,
  extractedValues: any,
  description: string
): string {
  switch (sourceType) {
    case 'cookie':
      const cookieName = extractedValues.cookieName || 'cookieName';
      return `// Get cookie value
var cookies = document.cookie.split(';');
for (var i = 0; i < cookies.length; i++) {
  var cookie = cookies[i].trim();
  if (cookie.indexOf('${cookieName}=') === 0) {
    return cookie.substring('${cookieName}='.length);
  }
}
return '';`;

    case 'query-param':
      const paramName = extractedValues.paramName || 'paramName';
      return `// Get URL parameter
var params = new URLSearchParams(window.location.search);
return params.get('${paramName}') || '';`;

    case 'local-storage':
      const localKey = extractedValues.storageKey || 'key';
      return `// Get from localStorage
try {
  return localStorage.getItem('${localKey}') || '';
} catch (e) {
  return '';
}`;

    case 'session-storage':
      const sessionKey = extractedValues.storageKey || 'key';
      return `// Get from sessionStorage
try {
  return sessionStorage.getItem('${sessionKey}') || '';
} catch (e) {
  return '';
}`;

    case 'javascript-variable':
      const varPath = extractedValues.path || 'window.variableName';
      return `// Get JavaScript variable
try {
  return ${varPath} || '';
} catch (e) {
  return '';
}`;

    case 'data-layer':
      const dlPath = extractedValues.path || 'digitalData.page.pageName';
      // Generate safe access code with optional chaining
      const parts = dlPath.split('.');
      const safePath = parts.reduce((acc: string, part: string, idx: number) => {
        if (idx === 0) return part;
        if (part.includes('[')) {
          const [prop, ...rest] = part.split('[');
          return `${acc}?.${prop}?.[${rest.join('[')}`;
        }
        return `${acc}?.${part}`;
      }, '');
      return `// Get from data layer
return ${safePath} || '';`;

    case 'data-element-reference':
      const deName = extractedValues.dataElementName || 'OtherDataElement';
      return `// Reference another data element
return _satellite.getVar('${deName}') || '';`;

    case 'dom':
      const selector = extractedValues.selector || '.element';
      const attribute = extractedValues.attribute;
      if (attribute) {
        return `// Get DOM element attribute
var element = document.querySelector('${selector}');
return element ? element.getAttribute('${attribute}') : '';`;
      } else {
        return `// Get DOM element text
var element = document.querySelector('${selector}');
return element ? element.textContent.trim() : '';`;
      }

    case 'custom-code':
    default:
      // Generate smart code based on description keywords
      const lower = description.toLowerCase();

      // Analytics products string
      if (lower.includes('analytics products') || lower.includes('products string')) {
        const productsPath = extractedValues.path || 'digitalData.products';
        return `// Generate Adobe Analytics products string
var products = ${productsPath} || [];
return products.map(function(p) {
  return [
    p.category || '',
    p.productID || p.id || '',
    p.quantity || 1,
    p.price || 0
  ].join(';');
}).join(',');`;
      }

      // Concatenation
      if (lower.includes('combine') || lower.includes('concatenate') || lower.includes('join')) {
        return `// Combine values
var value1 = /* first value */;
var value2 = /* second value */;
return value1 + ' ' + value2;`;
      }

      // Calculation
      if (lower.includes('calculate') || lower.includes('compute') || lower.includes('sum') || lower.includes('total')) {
        return `// Calculate value
var values = /* array or object */;
var total = 0;
// Add calculation logic
return total;`;
      }

      // Format currency
      if (lower.includes('currency') || lower.includes('format') && lower.includes('price')) {
        return `// Format as currency
var value = /* get value */;
return '$' + parseFloat(value || 0).toFixed(2);`;
      }

      // Default template
      if (extractedValues.path) {
        return `// Custom logic
return ${extractedValues.path} || '';`;
      }

      return `// TODO: Implement custom logic based on requirements
// ${description}
return '';`;
  }
}

/**
 * Generate appropriate name based on source and description
 */
export function generateSmartName(description: string, sourceType: string, extractedValues: any): string {
  // Clean description
  const cleaned = description
    .toLowerCase()
    .replace(/(?:create|get|retrieve|return|from|the)\s+/gi, '')
    .replace(/data\s*element/gi, '')
    .trim();

  // For specific source types, include in name
  let prefix = 'DE';
  let namePart = '';

  switch (sourceType) {
    case 'cookie':
      prefix = 'Cookie';
      namePart = extractedValues.cookieName || 'Value';
      break;
    case 'query-param':
      prefix = 'Param';
      namePart = extractedValues.paramName || 'Value';
      break;
    case 'local-storage':
      prefix = 'LS';
      namePart = extractedValues.storageKey || 'Value';
      break;
    case 'session-storage':
      prefix = 'SS';
      namePart = extractedValues.storageKey || 'Value';
      break;
    case 'data-element-reference':
      prefix = 'Ref';
      namePart = extractedValues.dataElementName || 'Value';
      break;
    default:
      // Extract meaningful terms
      const terms = cleaned
        .split(/\s+/)
        .filter(word => word.length > 2 && !['the', 'and', 'from'].includes(word))
        .slice(0, 4);
      
      namePart = terms
        .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
  }

  // Capitalize first letter of namePart
  namePart = namePart.charAt(0).toUpperCase() + namePart.slice(1);

  return `${prefix} - ${namePart}`;
}

/**
 * Get clarifying questions based on source type
 */
export function getQuestionsForSourceType(sourceType: string): string[] {
  switch (sourceType) {
    case 'cookie':
      return [
        'What is the exact cookie name?',
        'Should there be a default value if the cookie doesn\'t exist?'
      ];
    case 'query-param':
      return [
        'What is the URL parameter name?',
        'Should there be a default value if the parameter is missing?'
      ];
    case 'local-storage':
    case 'session-storage':
      return [
        'What is the storage key name?',
        'Should there be a default value?'
      ];
    case 'data-layer':
      return [
        'What is the exact data layer path? (e.g., digitalData.page.pageName)',
        'Should there be a default value?',
        'Should the value be cached?'
      ];
    case 'javascript-variable':
      return [
        'What is the complete variable path? (e.g., window.appConfig.userId)',
        'Should there be a default value?'
      ];
    case 'dom':
      return [
        'What is the CSS selector for the element?',
        'Do you want the text content or a specific attribute?',
        'If attribute, which attribute name?'
      ];
    case 'data-element-reference':
      return [
        'What is the name of the data element to reference?',
        'Should there be a default value?'
      ];
    case 'custom-code':
    default:
      return [
        'Can you describe the logic more specifically?',
        'What data sources does this need to access?',
        'What format should the output be in?'
      ];
  }
}