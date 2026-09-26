require('./d4-checks.cjs')('S5').catch(error => { console.error(error); process.exitCode = 1; });
