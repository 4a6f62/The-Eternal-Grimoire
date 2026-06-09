import { db } from './db';

const FIVE_ETOOLS_BASE_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

export async function fetchAndCache5eData(type: 'class' | 'race' | 'spells' | 'items') {
  let url = '';
  switch (type) {
    case 'class':
      url = `${FIVE_ETOOLS_BASE_URL}/class/index.json`;
      break;
    case 'race':
      url = `${FIVE_ETOOLS_BASE_URL}/races.json`;
      break;
    default:
      return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json") && !contentType.includes("text/plain")) {
      // GitHub raw often returns text/plain for .json files
      // But we should at least check if it's not HTML
    }
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`Failed to parse JSON from ${url}. Content starts with: ${text.substring(0, 50)}`);
      return;
    }

    if (type === 'race') {
      const races = data.race.map((r: any) => ({
        id: `race:${r.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'race' as const,
        name: r.name,
        data: r
      }));
      await db.fiveetools.bulkPut(races);
    }

    if (type === 'class') {
      const classes = Object.keys(data).map(key => ({
          id: `class:${key.toLowerCase()}`,
          type: 'class' as const,
          name: key,
          data: data[key]
      }));
      await db.fiveetools.bulkPut(classes);
    }
  } catch (err) {
    console.error(`Failed to fetch 5etools ${type} data`, err);
  }
}
