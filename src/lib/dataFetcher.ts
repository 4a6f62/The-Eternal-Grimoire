import { db } from './db';

const FIVE_ETOOLS_BASE_URL = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';

export async function fetchAndCache5eData(type: 'class' | 'race' | 'spells' | 'items' | 'feats' | 'backgrounds') {
  try {
    if (type === 'spells') {
      const indexUrl = `${FIVE_ETOOLS_BASE_URL}/spells/index.json`;
      const indexRes = await fetch(indexUrl);
      const indexData = await indexRes.json();
      
      const sourcesUrl = `${FIVE_ETOOLS_BASE_URL}/spells/sources.json`;
      const sourcesRes = await fetch(sourcesUrl);
      const sourcesData = await sourcesRes.json();

      const spellFiles = Object.values(indexData);
      const allSpells: any[] = [];
      
      for (const file of spellFiles) {
        try {
          const res = await fetch(`${FIVE_ETOOLS_BASE_URL}/spells/${file}`);
          const data = await res.json();
          if (data.spell) {
            data.spell.forEach((s: any) => {
              const sourceMappings = sourcesData[s.source]?.[s.name];
              const mergedClasses = s.classes || sourceMappings || {};

              allSpells.push({
                id: `spell:${s.name.toLowerCase().replace(/\s+/g, '-')}-${s.source.toLowerCase()}`,
                type: 'spell' as const,
                name: s.name,
                data: { ...s, classes: mergedClasses }
              });
            });
          }
        } catch (e) {
          console.error(`Failed to fetch spell file ${file}`, e);
        }
      }
      await db.fiveetools.bulkPut(allSpells);
      console.log(`Cached ${allSpells.length} spells from all sources with class mappings.`);
      return;
    }

    let url = '';
    switch (type) {
      case 'class': url = `${FIVE_ETOOLS_BASE_URL}/class/index.json`; break;
      case 'race': url = `${FIVE_ETOOLS_BASE_URL}/races.json`; break;
      case 'feats': url = `${FIVE_ETOOLS_BASE_URL}/feats.json`; break;
      case 'backgrounds': url = `${FIVE_ETOOLS_BASE_URL}/backgrounds.json`; break;
      default: return;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

    if (type === 'feats') {
      const feats = data.feat.map((f: any) => ({
        id: `feat:${f.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'feat' as const,
        name: f.name,
        data: f
      }));
      await db.fiveetools.bulkPut(feats);
    }

    if (type === 'class') {
      const classes = Object.keys(data).map(key => ({
          id: `class:${key.toLowerCase()}`,
          type: 'class' as const,
          name: key.charAt(0).toUpperCase() + key.slice(1),
          data: { filename: data[key] }
      }));
      await db.fiveetools.bulkPut(classes);
    }

    if (type === 'backgrounds') {
      const backgrounds = data.background.map((b: any) => ({
        id: `background:${b.name.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'background' as const,
        name: b.name,
        data: b
      }));
      await db.fiveetools.bulkPut(backgrounds);
    }
  } catch (err) {
    console.error(`Failed to fetch 5etools ${type} data`, err);
  }
}

export async function fetchClassDetails(className: string, filename: string) {
  const url = `${FIVE_ETOOLS_BASE_URL}/class/${filename}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
    const data = await response.json();
    
    const existing = await db.fiveetools.get(`class:${className.toLowerCase()}`);
    if (existing && !existing.data.fullData) {
      await db.fiveetools.put({
        ...existing,
        data: { ...existing.data, fullData: data }
      });
      console.log(`Successfully cached detailed data for ${className}`);
    }
    return data;
  } catch (err) {
    console.error(`Failed to fetch class details for ${className}`, err);
    return null;
  }
}
