#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== Automated TiddlyWiki Import ===\n');

// Configuration
const CONFIG = {
    tiddlyWikiPath: 'templates/index.html',
    tidsDirectory: 'tids',
    outputPrefix: 'tiddlywiki_imported',
    verbose: true
};

// Parse command line arguments
process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--tw=')) CONFIG.tiddlyWikiPath = arg.split('=')[1];
    if (arg.startsWith('--tids=')) CONFIG.tidsDirectory = arg.split('=')[1];
    if (arg.startsWith('--output=')) CONFIG.outputPrefix = arg.split('=')[1];
    if (arg === '--quiet') CONFIG.verbose = false;
});

function log(message) {
    if (CONFIG.verbose) console.log(message);
}

function error(message) {
    console.error(`❌ Error: ${message}`);
    process.exit(1);
}

// Validate inputs
if (!fs.existsSync(CONFIG.tiddlyWikiPath)) {
    error(`TiddlyWiki file not found: ${CONFIG.tiddlyWikiPath}`);
}

if (!fs.existsSync(CONFIG.tidsDirectory)) {
    error(`Tids directory not found: ${CONFIG.tidsDirectory}`);
}

// Parse a single .tid file into TiddlyWiki format
function parseTidFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n');
        
        const tiddler = {};
        let textStartIndex = 0;
        
        // Parse metadata fields
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
                tiddler[fieldName] = fieldValue;
            }
        }
        
        // Extract text content
        tiddler.text = lines.slice(textStartIndex).join('\n');
        
        return tiddler;
    } catch (err) {
        console.warn(`⚠️  Warning: Failed to parse ${filepath}: ${err.message}`);
        return null;
    }
}

// Convert tiddler object to TiddlyWiki DIV format
function tiddlerToStoreDiv(title, tiddler) {
    const escapeHtml = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
    
    // Build attribute string from all fields except 'text'
    const attributes = [];
    Object.entries(tiddler).forEach(([key, value]) => {
        if (key !== 'text' && value !== undefined && value !== '') {
            attributes.push(`${key}="${escapeHtml(String(value))}"`);
        }
    });
    
    // Ensure title attribute is present
    if (!tiddler.title) {
        attributes.unshift(`title="${escapeHtml(title)}"`);
    }
    
    const attributeString = attributes.join(' ');
    const textContent = escapeHtml(tiddler.text || '');
    
    return `<div ${attributeString}><pre>${textContent}</pre></div>`;
}

// Main import process
async function importTiddlers() {
    log('🔍 Scanning for .tid files...');
    
    // Get all .tid files
    const tidFiles = fs.readdirSync(CONFIG.tidsDirectory)
        .filter(file => file.endsWith('.tid'))
        .map(file => path.join(CONFIG.tidsDirectory, file));
    
    if (tidFiles.length === 0) {
        error('No .tid files found in directory');
    }
    
    log(`📄 Found ${tidFiles.length} .tid files`);
    
    // Parse all tiddlers
    log('📖 Parsing tiddlers...');
    const tiddlers = {};
    let successCount = 0;
    
    tidFiles.forEach(filepath => {
        const tiddler = parseTidFile(filepath);
        if (tiddler) {
            // Use title field or filename as key
            const title = tiddler.title || path.basename(filepath, '.tid');
            tiddlers[title] = tiddler;
            successCount++;
            log(`  ✓ ${title}`);
        }
    });
    
    log(`📦 Successfully parsed ${successCount}/${tidFiles.length} tiddlers`);
    
    // Read TiddlyWiki HTML
    log('📂 Reading TiddlyWiki template...');
    let html = fs.readFileSync(CONFIG.tiddlyWikiPath, 'utf8');
    
    // Convert tiddlers to store format
    log('🔄 Converting to TiddlyWiki format...');
    const tiddlerDivs = Object.entries(tiddlers).map(([title, tiddler]) => {
        return tiddlerToStoreDiv(title, tiddler);
    });
    
    // Create store area content
    const storeContent = tiddlerDivs.join('\n');
    const storeArea = `<div id="storeArea" style="display:none;">\n${storeContent}\n</div>`;
    
    // Insert into HTML
    log('🔧 Injecting tiddlers into TiddlyWiki...');
    const storeAreaRegex = /<div id="storeArea"[^>]*>.*?<\/div>/s;
    
    if (html.match(storeAreaRegex)) {
        // Replace existing store area
        html = html.replace(storeAreaRegex, storeArea);
        log('  ↻ Replaced existing store area');
    } else {
        // Insert before closing body tag
        const bodyCloseIndex = html.lastIndexOf('</body>');
        if (bodyCloseIndex !== -1) {
            html = html.slice(0, bodyCloseIndex) + storeArea + '\n' + html.slice(bodyCloseIndex);
            log('  + Added new store area');
        } else {
            // Fallback: append to end
            html += '\n' + storeArea;
            log('  + Appended store area to end');
        }
    }
    
    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = `${CONFIG.outputPrefix}_${timestamp}.html`;
    
    // Write result
    log('💾 Writing output file...');
    fs.writeFileSync(outputFile, html);
    
    // Success summary
    console.log('\n🎉 Import Complete!');
    console.log(`   📊 Imported: ${Object.keys(tiddlers).length} tiddlers`);
    console.log(`   📄 Output: ${outputFile}`);
    console.log(`   📏 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
    
    // Show field statistics
    if (CONFIG.verbose) {
        const fieldCounts = {};
        Object.values(tiddlers).forEach(tiddler => {
            Object.keys(tiddler).forEach(field => {
                fieldCounts[field] = (fieldCounts[field] || 0) + 1;
            });
        });
        
        console.log('\n📋 Field usage:');
        Object.entries(fieldCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10) // Top 10 fields
            .forEach(([field, count]) => {
                console.log(`   ${field}: ${count} tiddlers`);
            });
    }
    
    console.log('\n🚀 Ready to test! Open the output file in your browser.');
    
    return outputFile;
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --tw=<path>      Path to TiddlyWiki HTML file (default: templates/index.html)
  --tids=<path>    Path to tids directory (default: tids)
  --output=<name>  Output filename prefix (default: tiddlywiki_imported)
  --quiet          Suppress verbose output
  --help, -h       Show this help

Examples:
  node ${path.basename(__filename)}
  node ${path.basename(__filename)} --tw=my-wiki.html --tids=./my-tids
  node ${path.basename(__filename)} --output=my-imported-wiki --quiet
`);
    process.exit(0);
}

// Run the import
importTiddlers().catch(err => {
    error(`Import failed: ${err.message}`);
});
