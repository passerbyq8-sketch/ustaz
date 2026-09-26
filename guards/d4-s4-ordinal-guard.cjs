require('./d4-checks.cjs')('S4').catch(error => { console.error(error); process.exitCode = 1; });
