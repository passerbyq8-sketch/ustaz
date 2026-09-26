require('./d4-checks.cjs')('S1').catch(error => { console.error(error); process.exitCode = 1; });
