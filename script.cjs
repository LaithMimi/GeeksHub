const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // text-white replacements
    content = content.replace(/text-white\/90/g, 'text-foreground/90');
    content = content.replace(/text-white\/80/g, 'text-foreground/80');
    content = content.replace(/text-white\/75/g, 'text-foreground/75');
    content = content.replace(/text-white\/70/g, 'text-foreground/70');
    content = content.replace(/text-white\/65/g, 'text-foreground/60');
    content = content.replace(/text-white\/60/g, 'text-foreground/60');
    content = content.replace(/text-white\/50/g, 'text-muted-foreground');
    content = content.replace(/text-white\/45/g, 'text-muted-foreground');
    content = content.replace(/text-white\/40/g, 'text-muted-foreground');
    content = content.replace(/text-white\/35/g, 'text-muted-foreground/70');
    content = content.replace(/text-white\/30/g, 'text-muted-foreground/50');
    content = content.replace(/text-white\/25/g, 'text-muted-foreground/50');
    content = content.replace(/text-white\/20/g, 'text-muted-foreground/30');
    content = content.replace(/text-white\/15/g, 'text-muted-foreground/30');
    content = content.replace(/text-white\/10/g, 'text-muted-foreground/20');
    content = content.replace(/text-white\/5/g, 'text-muted-foreground/10');
    content = content.replace(/text-white\/0/g, 'text-transparent');
    content = content.replace(/text-white(?![A-Za-z0-9\/\[])/g, 'text-foreground');

    // bg-white replacements
    content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-foreground/5');
    content = content.replace(/bg-white\/\[0\.03\]/g, 'bg-foreground/5');
    content = content.replace(/bg-white\/\[0\.04\]/g, 'bg-foreground/5');
    content = content.replace(/bg-white\/\[0\.06\]/g, 'bg-foreground/5');
    content = content.replace(/bg-white\/\[0\.08\]/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/\[0\.1\]/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/\[0\.12\]/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/\[0\.15\]/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/5/g, 'bg-foreground/5');
    content = content.replace(/bg-white\/10/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/15/g, 'bg-foreground/10');
    content = content.replace(/bg-white\/20/g, 'bg-foreground/20');
    content = content.replace(/bg-white\/30/g, 'bg-foreground/30');

    // border-white replacements
    content = content.replace(/border-white\/\[0\.02\]/g, 'border-border');
    content = content.replace(/border-white\/\[0\.04\]/g, 'border-border');
    content = content.replace(/border-white\/\[0\.05\]/g, 'border-border');
    content = content.replace(/border-white\/\[0\.06\]/g, 'border-border');
    content = content.replace(/border-white\/\[0\.08\]/g, 'border-border');
    content = content.replace(/border-white\/\[0\.1\]/g, 'border-border/50');
    content = content.replace(/border-white\/\[0\.12\]/g, 'border-border/50');
    content = content.replace(/border-white\/\[0\.15\]/g, 'border-border/50');
    content = content.replace(/border-white\/5/g, 'border-border/20');
    content = content.replace(/border-white\/10/g, 'border-border/50');
    content = content.replace(/border-white\/20/g, 'border-border/80');

    // divide-white
    content = content.replace(/divide-white\/\[0\.06\]/g, 'divide-border');
    content = content.replace(/divide-white\/\[0\.08\]/g, 'divide-border');
    content = content.replace(/divide-white\/\[0\.1\]/g, 'divide-border');
    content = content.replace(/divide-white\/10/g, 'divide-border');

    // ring-white
    content = content.replace(/ring-white\/[0-9\[\]\.]+/g, 'ring-foreground/20');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
    }
});

console.log('Modified files:', changedCount);
