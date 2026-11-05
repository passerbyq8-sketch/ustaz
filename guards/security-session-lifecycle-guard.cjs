'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', '--test', 'tests/auth-session-lifecycle.test.cjs', 'tests/panel-intake.test.cjs', 'tests/panel-usage-admission.test.cjs', 'tests/panel-reports.test.cjs', 'tests/panel-settings.test.cjs', 'tests/panel-campaign.test.cjs', 'tests/panel-versions.test.cjs', 'tests/panel-viewer.test.cjs'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', windowsHide: true });
process.exitCode = result.status === null ? 1 : result.status;
