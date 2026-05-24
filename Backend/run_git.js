const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  const diff = execSync('git diff Mobile/database/DatabaseService.ts', { cwd: path.join(__dirname, '..') }).toString();
  fs.writeFileSync(path.join(__dirname, 'git_diff.txt'), diff);
  console.log('DIFF WRITTEN SUCCESSFULLY!');
} catch (err) {
  fs.writeFileSync(path.join(__dirname, 'git_diff.txt'), 'ERROR: ' + err.message);
  console.error(err);
}
