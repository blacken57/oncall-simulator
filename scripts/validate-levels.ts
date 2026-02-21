import fs from 'fs';
import path from 'path';
import { validateLevel } from '../src/lib/game/validator';

const DATA_DIR = path.resolve('src/data');
const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

let hasErrors = false;

console.log('🔍 Validating level configurations...');

files.forEach(file => {
  const filePath = path.join(DATA_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const config = JSON.parse(content);
    const errors = validateLevel(config);
    
    if (errors.length > 0) {
      hasErrors = true;
      console.error(`\n❌ Errors in ${file}:`);
      errors.forEach(err => {
        console.error(`  - [${err.path}]: ${err.message}`);
      });
    } else {
      console.log(`✅ ${file} is valid.`);
    }
  } catch (e: any) {
    hasErrors = true;
    console.error(`\n❌ Failed to parse ${file}: ${e.message}`);
  }
});

if (hasErrors) {
  console.error('\nLevel validation failed. Please fix the errors above.');
  process.exit(1);
} else {
  console.log('\nAll levels validated successfully.');
}
