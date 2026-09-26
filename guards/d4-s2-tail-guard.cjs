require('./d4-checks.cjs')('S2').catch(error => { console.error(error); process.exitCode = 1; });
