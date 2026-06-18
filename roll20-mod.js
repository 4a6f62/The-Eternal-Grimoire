/*
  ==============================================================================
  D&D Character Manager - Roll20 API Integration Script
  ==============================================================================
  This script allows you to import characters created in the D&D Character Manager
  into Roll20, or export Roll20 characters back to the D&D Character Manager.

  Requirements:
  - Roll20 Pro subscription (required to use API Scripts)
  - Character Sheet: "5th Edition by Roll20" (formerly OGL sheet)

  Installation:
  1. Go to your Roll20 Game Details page.
  2. Click on "Settings" and select "API Scripts".
  3. Create a new script, name it "DnDCharsIntegration.js", and paste this entire code.
  4. Click "Save Script".

  Commands:
  - !dndchar help           - Display usage instructions.
  - !dndchar import         - Import character from a Handout named "Import Character".
  - !dndchar import <JSON>  - Import character from raw JSON pasted in chat (smaller chars).
  - !dndchar export         - Export the selected token's character to a Handout.
  - !dndchar export "Name"  - Export the character named "Name" to a Handout.
  ==============================================================================
*/

var DnDCharsIntegration = DnDCharsIntegration || (function() {
    'use strict';

    var version = '1.0.0';

    // Helper to log with styling
    function logMsg(message) {
        log('DnDChars: ' + message);
    }

    // Helper to send formatted whispers to GM
    function sendFeedback(msg, to) {
        var style = "border: 1px solid #4a5568; background-color: #1a202c; color: #e2e8f0; padding: 10px; border-radius: 5px; font-family: sans-serif;";
        var titleStyle = "color: #3182ce; font-weight: bold; border-bottom: 1px solid #4a5568; margin-bottom: 5px; padding-bottom: 3px; font-size: 1.1em;";
        var content = '<div style="' + style + '"><div style="' + titleStyle + '">D&D Character Integration</div>' + msg + '</div>';
        
        if (to) {
            sendChat('DnDChars', '/w ' + to + ' ' + content);
        } else {
            sendChat('DnDChars', '/w gm ' + content);
        }
    }

    // Clean HTML tags and entities from handout notes
    function cleanHTML(html) {
        if (!html) return '';
        var text = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p>/gi, '')
            .replace(/<\/p>/gi, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&lsquo;/g, "'")
            .replace(/&rsquo;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
        
        // Strip all other HTML tags
        text = text.replace(/<[^>]*>/g, '');
        
        // Clean up Unicode smart quotes and zero-width / control characters
        text = text
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u200b\u200c\u200d\ufeff]/g, '');
            
        return text.trim();
    }

    // Generate a Roll20 alphanumeric repeating row ID
    function generateRowId() {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var result = '-';
        for (var i = 0; i < 19; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Calculate ability modifier
    function getModifier(score) {
        return Math.floor((parseInt(score, 10) - 10) / 2);
    }

    // Calculate proficiency bonus from total level
    function getProficiencyBonus(level) {
        return Math.ceil(parseInt(level, 10) / 4) + 1;
    }

    // Find or create an attribute for a character
    function setOrCreateAttr(characterId, name, current, max) {
        var attr = findObjs({ _type: 'attribute', _characterid: characterId, name: name })[0];
        var valString = current !== undefined && current !== null ? current.toString() : '';
        var maxString = max !== undefined && max !== null ? max.toString() : '';

        if (attr) {
            attr.set({ current: valString, max: maxString });
        } else {
            createObj('attribute', {
                characterid: characterId,
                name: name,
                current: valString,
                max: maxString
            });
        }
    }

    // Clear all repeating section attributes to prevent duplicate imports
    function clearRepeatingAttributes(characterId) {
        var attrs = findObjs({ _type: 'attribute', _characterid: characterId });
        var count = 0;
        _.each(attrs, function(attr) {
            var name = attr.get('name');
            if (name.indexOf('repeating_') === 0) {
                attr.remove();
                count++;
            }
        });
        logMsg('Cleared ' + count + ' repeating attributes from character ID ' + characterId);
    }

    // Import logic
    function importCharacter(jsonText, sender) {
        try {
            // Clean up smart quotes and zero-width / control characters that might break JSON.parse
            var cleanedText = jsonText
                .replace(/[\u201c\u201d]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
                .trim();

            var data = JSON.parse(cleanedText);
            if (!data.name) {
                sendFeedback('❌ Invalid character JSON: "name" property is missing.', sender);
                return;
            }

            var name = data.name;
            var character = findObjs({ _type: 'character', name: name })[0];
            var isNew = false;

            if (!character) {
                character = createObj('character', { name: name });
                isNew = true;
            }

            var charId = character.id;
            
            // Set Avatar if it is a valid URL
            if (data.avatar && data.avatar.indexOf('http') === 0) {
                character.set('avatar', data.avatar);
            } else if (data.portraitUrl && data.portraitUrl.indexOf('http') === 0) {
                character.set('avatar', data.portraitUrl);
            }

            // Clear repeating sections to prevent duplicates on re-imports
            clearRepeatingAttributes(charId);

            // Handle Roll20 Export Format
            if (data.attribs && Array.isArray(data.attribs)) {
                sendFeedback('⚙️ Importing Roll20-format character attributes...', sender);
                
                // Prioritize core attributes to prevent sheet workers from throwing missing-dependency warnings
                var coreNames = ['pb', 'wtype', 'rtype', 'd20', 'charname_output', 'strength_mod', 'dexterity_mod', 'constitution_mod', 'intelligence_mod', 'wisdom_mod', 'charisma_mod'];
                var coreAttribs = [];
                var otherAttribs = [];
                
                _.each(data.attribs, function(attr) {
                    if (attr && attr.name) {
                        if (coreNames.indexOf(attr.name) !== -1) {
                            coreAttribs.push(attr);
                        } else {
                            otherAttribs.push(attr);
                        }
                    }
                });

                // Create core attributes first
                _.each(coreAttribs, function(attr) {
                    setOrCreateAttr(charId, attr.name, attr.current, attr.max);
                });
                
                // Create the rest of the attributes
                _.each(otherAttribs, function(attr) {
                    setOrCreateAttr(charId, attr.name, attr.current, attr.max);
                });
            } 
            // Handle Native Character Format
            else if (data.stats) {
                sendFeedback('⚙️ Importing native character data, mapping D&D 5e attributes...', sender);
                
                // Pre-calculate total level and proficiency bonus
                var totalLevel = 0;
                if (data.classes && Array.isArray(data.classes)) {
                    _.each(data.classes, function(cls) {
                        totalLevel += parseInt(cls.level, 10) || 1;
                    });
                }
                if (totalLevel === 0) totalLevel = 1;
                var pbVal = getProficiencyBonus(totalLevel);

                // Set core sheet config attributes first to satisfy workers
                setOrCreateAttr(charId, 'pb', pbVal);
                setOrCreateAttr(charId, 'wtype', '');
                setOrCreateAttr(charId, 'rtype', '{{query=1}} {{normal=1}} {{r2=[[1d20');
                setOrCreateAttr(charId, 'd20', '1d20');
                setOrCreateAttr(charId, 'charname_output', '{{charname=@{character_name}}}');
                setOrCreateAttr(charId, 'global_attack_mod', '0');
                setOrCreateAttr(charId, 'global_damage_mod_type', '');

                // 1. Stats and modifiers (set modifiers early)
                var stats = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
                _.each(stats, function(stat) {
                    var score = data.stats[stat] || 10;
                    setOrCreateAttr(charId, stat, score);
                    setOrCreateAttr(charId, stat + '_base', score);
                    setOrCreateAttr(charId, stat + '_mod', getModifier(score));
                });

                // 2. HP & Basic Stats
                if (data.hp) {
                    setOrCreateAttr(charId, 'hp', data.hp.current || 10, data.hp.max || 10);
                    setOrCreateAttr(charId, 'hp_temp', data.hp.temp || 0);
                }
                
                setOrCreateAttr(charId, 'race', data.race || 'Human');
                setOrCreateAttr(charId, 'background', data.background || '');
                setOrCreateAttr(charId, 'alignment', data.alignment || 'True Neutral');
                setOrCreateAttr(charId, 'size', data.size || 'Medium');
                setOrCreateAttr(charId, 'speed', 30); // Default speed

                // 3. Classes and Levels
                if (data.classes && Array.isArray(data.classes)) {
                    var classNames = [];
                    _.each(data.classes, function(cls, idx) {
                        var num = idx + 1;
                        var levelVal = parseInt(cls.level, 10) || 1;

                        setOrCreateAttr(charId, 'class_' + num, cls.name);
                        setOrCreateAttr(charId, 'level_' + num, levelVal);
                        if (cls.subclass) {
                            setOrCreateAttr(charId, 'subclass_' + num, cls.subclass);
                        }
                        classNames.push(cls.name + ' ' + levelVal);
                    });

                    setOrCreateAttr(charId, 'class_and_level', classNames.join(' / '));
                    setOrCreateAttr(charId, 'level', totalLevel);
                }

                // 4. Languages
                if (data.languages && Array.isArray(data.languages)) {
                    setOrCreateAttr(charId, 'languages', data.languages.join(', '));
                }

                // 5. Inventory Items (repeating_inventory)
                if (data.inventory && Array.isArray(data.inventory)) {
                    _.each(data.inventory, function(item) {
                        var rowId = generateRowId();
                        setOrCreateAttr(charId, 'repeating_inventory_' + rowId + '_itemname', item.name);
                        setOrCreateAttr(charId, 'repeating_inventory_' + rowId + '_itemcount', item.quantity || 1);
                        if (item.weight !== undefined) {
                            setOrCreateAttr(charId, 'repeating_inventory_' + rowId + '_itemweight', item.weight);
                        }
                        setOrCreateAttr(charId, 'repeating_inventory_' + rowId + '_equipped', 1);
                    });
                }

                // 6. Spells (repeating_spell-cantrip or repeating_spell-levelX)
                if (data.spells && Array.isArray(data.spells)) {
                    _.each(data.spells, function(spell) {
                        var rowId = generateRowId();
                        var lvl = parseInt(spell.level, 10);
                        var prefix = (lvl === 0) ? 'repeating_spell-cantrip_' : ('repeating_spell-level' + lvl + '_');
                        
                        setOrCreateAttr(charId, prefix + rowId + '_spellname', spell.name);
                        if (spell.desc) {
                            setOrCreateAttr(charId, prefix + rowId + '_spelldescription', spell.desc);
                        }
                    });
                }
            } else {
                sendFeedback('❌ Unknown character JSON schema format. It must have either "attribs" or "stats" defined.', sender);
                return;
            }

            // Prevent Charactermancer from triggering when opening the sheet
            setOrCreateAttr(charId, 'l1mancer_status', 'completed');
            setOrCreateAttr(charId, 'charactermancer_step', '');
            setOrCreateAttr(charId, 'lpmancer_status', '');
            setOrCreateAttr(charId, 'mancer_confirm', 'on');

            var statusText = isNew ? 'created' : 'updated';
            sendFeedback('✅ Character <strong>' + name + '</strong> successfully ' + statusText + '! (ID: ' + charId + ')', sender);

        } catch (err) {
            sendFeedback('❌ JSON parse error: ' + err.message, sender);
        }
    }

    // Export logic
    function exportCharacter(character, sender) {
        if (!character) {
            sendFeedback('❌ No character object supplied for export.', sender);
            return;
        }

        var charId = character.id;
        var name = character.get('name');
        var avatar = character.get('avatar') || '';
        
        sendFeedback('⚙️ Exporting character <strong>' + name + '</strong>...', sender);

        var attributes = findObjs({ _type: 'attribute', _characterid: charId });
        var attribs = _.map(attributes, function(attr) {
            return {
                name: attr.get('name'),
                current: attr.get('current'),
                max: attr.get('max')
            };
        });

        var exportData = {
            schema_version: 3,
            name: name,
            avatar: avatar,
            attribs: attribs,
            abilities: []
        };

        var jsonString = JSON.stringify(exportData);

        // Find or create an export Handout
        var handoutName = 'Export - ' + name;
        var handouts = findObjs({ _type: 'handout', name: handoutName });
        var handout;

        if (handouts.length > 0) {
            handout = handouts[0];
        } else {
            handout = createObj('handout', {
                name: handoutName,
                inplayerjournals: 'all' // Make visible to all, or let GM assign
            });
        }

        // Put JSON in handout notes
        handout.set('notes', '<pre style="white-space: pre-wrap; word-break: break-all; font-family: monospace; font-size: 11px;">' + _.escape(jsonString) + '</pre>');
        
        // Log to API Console as well
        logMsg('Export JSON for ' + name + ':\n' + jsonString);

        sendFeedback('✅ Character exported successfully!<br><br>Open the Handout named <strong><span style="color: #63b3ed;">' + handoutName + '</span></strong> in your Journal to copy the JSON block.', sender);
    }

    // Chat command handler
    function handleChatMessage(msg) {
        if (msg.type !== 'api') return;

        var args = msg.content.split(/\s+/);
        var command = args[0];

        if (command === '!dndchar') {
            var subCommand = args[1] ? args[1].toLowerCase() : 'help';
            var sender = msg.who;

            if (subCommand === 'help') {
                var helpMsg = '<strong>Roll20 JS Mod Help</strong><br>' +
                    'Commands:<br>' +
                    '<code>!dndchar import</code> - Reads JSON from a Handout named "Import Character" and imports it.<br>' +
                    '<code>!dndchar import {JSON}</code> - Imports JSON directly from chat.<br>' +
                    '<code>!dndchar export</code> - Exports the selected token\'s character to a handout.<br>' +
                    '<code>!dndchar export "Name"</code> - Exports character by name to a handout.';
                sendFeedback(helpMsg, sender);
            } 
            else if (subCommand === 'import') {
                // Check if JSON is pasted directly in the chat message
                var jsonStartIndex = msg.content.indexOf('{');
                if (jsonStartIndex !== -1) {
                    var jsonText = msg.content.substring(jsonStartIndex);
                    importCharacter(jsonText, sender);
                } else {
                    // Look for a Handout named "Import Character"
                    var handouts = findObjs({ _type: 'handout', name: 'Import Character' });
                    if (handouts.length === 0) {
                        sendFeedback('❌ Handout named <strong>"Import Character"</strong> not found in Journal.<br><br>Please create a Handout, name it exactly <strong>Import Character</strong>, paste the character JSON into its Notes, save it, and try again.', sender);
                        return;
                    }
                    
                    var handout = handouts[0];
                    handout.get('notes', function(notesHTML) {
                        if (!notesHTML || notesHTML === 'null') {
                            sendFeedback('❌ The handout <strong>"Import Character"</strong> Notes are empty. Please paste character JSON in it first.', sender);
                            return;
                        }
                        var cleanedJson = cleanHTML(notesHTML);
                        importCharacter(cleanedJson, sender);
                    });
                }
            } 
            else if (subCommand === 'export') {
                // If there's an argument after export, look up character by name
                var nameArg = msg.content.substring(16).trim(); // length of "!dndchar export" + 1
                // Remove quotes if present
                if ((nameArg.startsWith('"') && nameArg.endsWith('"')) || (nameArg.startsWith("'") && nameArg.endsWith("'"))) {
                    nameArg = nameArg.substring(1, nameArg.length - 1);
                }

                if (nameArg.length > 0) {
                    var character = findObjs({ _type: 'character', name: nameArg })[0];
                    if (!character) {
                        sendFeedback('❌ Character named <strong>"' + nameArg + '"</strong> not found.', sender);
                        return;
                    }
                    exportCharacter(character, sender);
                } else {
                    // Check for selected token
                    if (!msg.selected || msg.selected.length === 0) {
                        sendFeedback('❌ No character name specified, and no token is selected.<br><br>Please select a token on the map or type: <code>!dndchar export "Character Name"</code>', sender);
                        return;
                    }

                    var token = getObj('graphic', msg.selected[0]._id);
                    if (!token) {
                        sendFeedback('❌ Failed to get selected token object.', sender);
                        return;
                    }

                    var charId = token.get('represents');
                    if (!charId) {
                        sendFeedback('❌ Selected token does not represent a Character Sheet.', sender);
                        return;
                    }

                    var character = getObj('character', charId);
                    if (!character) {
                        sendFeedback('❌ Character represented by token not found.', sender);
                        return;
                    }

                    exportCharacter(character, sender);
                }
            } 
            else {
                sendFeedback('❌ Unknown command. Type <code>!dndchar help</code> for usage.', sender);
            }
        }
    }

    // Register script hooks
    function registerEventHandlers() {
        on('chat:message', handleChatMessage);
        logMsg('Loaded version ' + version);
    }

    return {
        RegisterEventHandlers: registerEventHandlers
    };
})();

on('ready', function() {
    'use strict';
    DnDCharsIntegration.RegisterEventHandlers();
});
