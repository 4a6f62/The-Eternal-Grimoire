import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'class'],
  });
}

export function sanitizeAndParseJson<T>(jsonString: string, schema: any): T {
  const parsed = JSON.parse(jsonString);
  // Basic recursive sanitization for strings in the object
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') return sanitizeHtml(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = sanitizeObject(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  const sanitized = sanitizeObject(parsed);
  return schema.parse(sanitized);
}
