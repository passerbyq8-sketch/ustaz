require('./d4-checks.cjs')('S3').catch(error => { console.error(error); process.exitCode = 1; });
