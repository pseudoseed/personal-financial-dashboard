const fs = require('fs');
const path = require('path');

function extractTokensFromReports() {
  const reportsDir = path.join(__dirname, '../reports/bulk-disconnect');
  
  if (!fs.existsSync(reportsDir)) {
    console.log('❌ Reports directory not found:', reportsDir);
    return;
  }

  const files = fs.readdirSync(reportsDir)
    .filter(file => file.endsWith('.json'))
    .sort();

  console.log(`🔍 Found ${files.length} report files\n`);

  const allTokens = new Set();
  const tokensByInstitution = {};

  files.forEach(file => {
    try {
      const filePath = path.join(reportsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const report = JSON.parse(content);

      console.log(`📄 Processing ${file}:`);
      console.log(`   Job ID: ${report.jobId}`);
      console.log(`   Created: ${report.createdAt}`);
      console.log(`   Total: ${report.totalTokens}, Success: ${report.successCount}, Failed: ${report.failureCount}`);

      if (report.results && Array.isArray(report.results)) {
        report.results.forEach(result => {
          if (result.accessToken) {
            allTokens.add(result.accessToken);
            
            const institution = result.institutionName || 'Unknown';
            if (!tokensByInstitution[institution]) {
              tokensByInstitution[institution] = [];
            }
            tokensByInstitution[institution].push({
              token: result.accessToken,
              success: result.success,
              error: result.error
            });
          }
        });
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });

  console.log('='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total unique access tokens: ${allTokens.size}\n`);

  console.log('🏦 TOKENS BY INSTITUTION:');
  Object.keys(tokensByInstitution).sort().forEach(institution => {
    const tokens = tokensByInstitution[institution];
    const successCount = tokens.filter(t => t.success).length;
    const failureCount = tokens.filter(t => !t.success).length;
    
    console.log(`\n${institution} (${tokens.length} tokens, ${successCount} success, ${failureCount} failed):`);
    tokens.forEach(({ token, success, error }) => {
      const status = success ? '✅' : '❌';
      const errorMsg = error ? ` - ${error}` : '';
      console.log(`  ${status} ${token}${errorMsg}`);
    });
  });

  console.log('\n' + '='.repeat(60));
  console.log('🔑 ALL UNIQUE ACCESS TOKENS:');
  console.log('='.repeat(60));
  Array.from(allTokens).sort().forEach((token, index) => {
    console.log(`${index + 1}. ${token}`);
  });

  // Save to file
  const outputFile = path.join(__dirname, '../extracted-access-tokens.txt');
  const output = [
    'EXTRACTED ACCESS TOKENS',
    '======================',
    '',
    `Total unique tokens: ${allTokens.size}`,
    '',
    'ALL TOKENS:',
    ...Array.from(allTokens).sort().map((token, index) => `${index + 1}. ${token}`),
    '',
    'BY INSTITUTION:',
    ...Object.keys(tokensByInstitution).sort().map(institution => {
      const tokens = tokensByInstitution[institution];
      return [
        `\n${institution} (${tokens.length}):`,
        ...tokens.map(({ token, success, error }) => 
          `  ${success ? '✅' : '❌'} ${token}${error ? ` - ${error}` : ''}`
        )
      ].join('\n');
    })
  ].join('\n');

  fs.writeFileSync(outputFile, output);
  console.log(`\n💾 Saved complete list to: ${outputFile}`);
}

extractTokensFromReports(); 