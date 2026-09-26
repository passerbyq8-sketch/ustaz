require('./d4-checks.cjs')('S6').catch(error => { console.error(error); process.exitCode = 1; });
