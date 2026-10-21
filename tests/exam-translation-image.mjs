// The alternate-language image tool was deliberately retired: an attempt now
// stays in the language explicitly selected before starting, including review.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/unified-exam.js','utf8');
for(const feature of ['function translationModel(', 'function showTranslation(', 'function wrapTranslation(', 'id="uxLang"', 'id="uxReviewLang"'])assert(!source.includes(feature),feature+' must not expose the unselected language');
assert(source.includes('function renderLanguageChoice('));
assert(source.includes("setAttribute?.('lang',S.lang)"));
console.log('PASS: pre-start language selection replaces alternate-language images and in-review switching');
