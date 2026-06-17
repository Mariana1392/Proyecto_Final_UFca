import fs from 'fs';

if (fs.existsSync('.env.local')) {
  console.log('--- .env.local content ---');
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key.includes('URL') || key.includes('DB') || key.includes('PROJECT') || key.includes('PASS')) {
        console.log(`${key}: ${val}`);
      } else {
        console.log(`${key}: (hidden, length ${val.length})`);
      }
    }
  });
} else {
  console.log('.env.local does not exist');
}
