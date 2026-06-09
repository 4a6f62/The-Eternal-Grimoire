import { db } from './db';

const FIVE_ETOOLS_BASE_URL = 'https://raw.githubusercontent.com/5etools-mirror-2/5etools-mirror-2.github.io/master/data';

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
    const data = await response.json();

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
