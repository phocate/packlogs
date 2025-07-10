#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse a single .tid file
function parseTidFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    
    const tiddler = {
        filename: path.basename(filepath),
        fields: {},
        text: ''
    };
    
    // Parse fields (everything before first empty line)
    let textStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
            textStartIndex = i + 1;
            break;
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const fieldName = line.substring(0, colonIndex).trim();
            const fieldValue = line.substring(colonIndex + 1).trim();
            tiddler.fields[fieldName] = fieldValue;
        }
    }
    
    // Everything after empty line is the text content
    tiddler.text = lines.slice(textStartIndex).join('\n');
    
    return tiddler;
}

// Main test
console.log('=== TiddlyWiki .tid Import Test ===\n');

// Check if tids directory exists
if (!fs.existsSync('tids')) {
    console.error('Error: tids/ directory not found');
    console.log('Make sure you run this from the directory containing the tids/ folder');
    process.exit(1);
}

// Get all .tid files
const tidFiles = fs.readdirSync('tids')
    .filter(file => file.endsWith('.tid'))
    .map(file => path.join('tids', file));

console.log(`Found ${tidFiles.length} .tid files in tids/ directory`);

if (tidFiles.length === 0) {
    console.log('No .tid files found in tids/ directory');
    process.exit(0);
}

// Parse ALL files since they're interdependent
console.log(`\nProcessing all ${tidFiles.length} files:\n`);

const results = [];

tidFiles.forEach((file, index) => {
    try {
        const tiddler = parseTidFile(file);
        results.push(tiddler);
        
        console.log(`${index + 1}/${tidFiles.length}. ${tiddler.filename}`);
        if (index < 5) {
            // Show details for first 5 files
            console.log(`   Title: ${tiddler.fields.title || 'No title'}`);
            console.log(`   Created: ${tiddler.fields.created || 'No created date'}`);
            console.log(`   Tags: ${tiddler.fields.tags || 'No tags'}`);
            console.log(`   Text length: ${tiddler.text.length} characters`);
            console.log(`   Fields: ${Object.keys(tiddler.fields).join(', ')}`);
            console.log('');
        } else if (index === 5) {
            console.log('   ... (showing first 5 in detail, continuing with all files) ...\n');
        }
        
    } catch (error) {
        console.error(`   Error parsing ${file}: ${error.message}`);
    }
});

// Create a complete TiddlyWiki store format
const tiddlyWikiStore = {};
results.forEach(tiddler => {
    const title = tiddler.fields.title || tiddler.filename.replace('.tid', '');
    tiddlyWikiStore[title] = {
        ...tiddler.fields,
        text: tiddler.text
    };
});

// Save results in multiple formats
fs.writeFileSync('all_tiddlers.json', JSON.stringify(results, null, 2));
fs.writeFileSync('tiddlywiki_store.json', JSON.stringify(tiddlyWikiStore, null, 2));
console.log(`Results saved to:`);
console.log(`- all_tiddlers.json (raw parsed data)`);
console.log(`- tiddlywiki_store.json (TiddlyWiki store format)`);

console.log('\n=== Summary ===');
console.log(`Successfully parsed: ${results.length} files`);
console.log(`Total files in tids/: ${tidFiles.length}`);

// Show unique field names across all parsed files
const allFields = new Set();
results.forEach(tiddler => {
    Object.keys(tiddler.fields).forEach(field => allFields.add(field));
});
console.log(`Unique field names found: ${Array.from(allFields).join(', ')}`);
