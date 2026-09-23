import { describe, expect, it } from 'vitest';
import { normalizeDomain, suggestDomains } from './domains';

describe('normalizeDomain', () => {
  it.each([
    ['https://www.pinterest.com/pin/123', 'pinterest.com'],
    ['http://Notion.so/', 'notion.so'],
    ['www.figma.com/file/abc?x=1#y', 'figma.com'],
    ['docs.google.com/document/d/1', 'docs.google.com'],
    ['https://localhost.dev:8080/path', 'localhost.dev'],
    ['  GitHub.com  ', 'github.com'],
    ['en.wikipedia.org', 'en.wikipedia.org'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(['', 'localhost', 'not a site', 'http://', '-bad-.com', 'foo.123'])('rejects %j', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe('suggestDomains', () => {
  const tabs = [
    { url: 'https://www.notion.so/page', lastAccessed: 1 },
    { url: 'https://figma.com/file/x', lastAccessed: 3 },
    { url: 'chrome://extensions', lastAccessed: 5 },
    { url: 'https://notion.so/other', lastAccessed: 2 },
    { url: 'chrome-extension://abc/plan.html', lastAccessed: 9 },
    { url: 'https://github.com/', lastAccessed: 4 },
  ];

  it('dedupes, skips non-web tabs, sorts by recency', () => {
    expect(suggestDomains(tabs, [])).toEqual(['github.com', 'figma.com', 'notion.so']);
  });
  it('leaves out domains already added and respects the limit', () => {
    expect(suggestDomains(tabs, ['github.com'], 1)).toEqual(['figma.com']);
  });
});
