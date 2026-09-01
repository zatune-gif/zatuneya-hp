import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getChromePath, Launcher } from 'chrome-launcher';
import lighthouse, { desktopConfig } from 'lighthouse';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
const performanceDiagnosticAudits = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'speed-index',
  'total-blocking-time',
  'cumulative-layout-shift'
];
const profiles = [
  { name: 'mobile', config: undefined },
  { name: 'desktop', config: desktopConfig }
];
const repeats = 2;
const LIGHTHOUSE_RUN_TIMEOUT_MS = 90_000;
const LIGHTHOUSE_TOTAL_TIMEOUT_MS = 240_000;
const CHROME_START_TIMEOUT_MS = 20_000;
const CHROME_STOP_TIMEOUT_MS = 5_000;
const CHROME_STDERR_LIMIT = 2_000;

function completeWithin(promise, timeoutMs, description) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${description} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function conciseChromeStderr(chrome) {
  const stderr = chrome?.stderr?.trim();
  if (!stderr) {
    return '';
  }
  return `\nChrome stderr (last ${Math.min(stderr.length, CHROME_STDERR_LIMIT)} chars):\n${stderr.slice(-CHROME_STDERR_LIMIT)}`;
}

function assertLocalhostOrigin(origin) {
  const url = new URL(origin);
  assert.equal(url.protocol, 'http:', 'Lighthouse QA server uses HTTP');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
    `Lighthouse QA server must be localhost, received ${url.hostname}`);
  assert.ok(url.port, 'Lighthouse QA server has an ephemeral localhost port');
}

async function resolveChromePath() {
  const attempts = [];
  const candidates = [
    ['CHROME_PATH', process.env.CHROME_PATH],
    ['LIGHTHOUSE_CHROME_PATH', process.env.LIGHTHOUSE_CHROME_PATH]
  ];
  try {
    candidates.push(['chrome-launcher auto detection', getChromePath()]);
  } catch (error) {
    attempts.push(`chrome-launcher auto detection: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (process.platform === 'win32') {
    candidates.push(['Windows fallback', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']);
  }

  for (const [source, candidate] of candidates) {
    if (!candidate) {
      attempts.push(`${source}: not set or not found`);
      continue;
    }
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      attempts.push(`${source}: ${candidate} (${error instanceof Error && 'code' in error ? error.code : 'unavailable'})`);
    }
  }

  throw new Error(
    `Chrome executable was not found. Checked: ${attempts.join('; ')}. ` +
    'Set CHROME_PATH or LIGHTHOUSE_CHROME_PATH to a Chrome executable.'
  );
}

async function readDevToolsPort(userDataDir, chromeProcess) {
  const portFile = join(userDataDir, 'DevToolsActivePort');
  while (chromeProcess.exitCode === null && chromeProcess.signalCode === null) {
    try {
      const [portLine] = (await readFile(portFile, 'utf8')).split(/\r?\n/);
      const port = Number.parseInt(portLine, 10);
      if (Number.isInteger(port) && port > 0 && port <= 65_535) {
        return port;
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
    await delay(100);
  }
  throw new Error(
    `Chrome exited before publishing its DevTools port (exit=${chromeProcess.exitCode}, signal=${chromeProcess.signalCode})`
  );
}

async function waitForDevTools(port, chromeProcess) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  while (chromeProcess.exitCode === null && chromeProcess.signalCode === null) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome can publish its port just before DevTools begins accepting connections.
    }
    await delay(100);
  }
  throw new Error(
    `Chrome exited before DevTools became ready (exit=${chromeProcess.exitCode}, signal=${chromeProcess.signalCode})`
  );
}

async function launchChrome({ chromePath, userDataDir }) {
  const chromeProcess = spawn(chromePath, [
    ...Launcher.defaultFlags(),
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-sandbox',
    '--headless',
    '--disable-gpu',
    'about:blank'
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  });
  const chrome = { process: chromeProcess, port: undefined, stderr: '' };
  chromeProcess.stderr.setEncoding('utf8');
  chromeProcess.stderr.on('data', chunk => {
    chrome.stderr = `${chrome.stderr}${chunk}`.slice(-CHROME_STDERR_LIMIT);
  });

  try {
    chrome.port = await completeWithin(
      readDevToolsPort(userDataDir, chromeProcess),
      CHROME_START_TIMEOUT_MS,
      'Chrome DevTools port discovery'
    );
    await completeWithin(
      waitForDevTools(chrome.port, chromeProcess),
      CHROME_START_TIMEOUT_MS,
      'Chrome DevTools readiness'
    );
    return chrome;
  } catch (error) {
    let stopError;
    try {
      await terminateChromeProcess(chrome);
    } catch (cleanupError) {
      stopError = cleanupError;
    }
    if (stopError) {
      throw new AggregateError([error, stopError],
        `Chrome failed to start and failed to stop${conciseChromeStderr(chrome)}`);
    }
    throw new Error(`${error instanceof Error ? error.message : String(error)}${conciseChromeStderr(chrome)}`, {
      cause: error
    });
  }
}

function processClosed(chromeProcess) {
  return chromeProcess.exitCode !== null || chromeProcess.signalCode !== null;
}

function waitForChromeClose(chromeProcess, description) {
  if (processClosed(chromeProcess)) {
    return Promise.resolve();
  }
  return completeWithin(
    new Promise(resolveClose => chromeProcess.once('close', resolveClose)),
    CHROME_STOP_TIMEOUT_MS,
    description
  );
}

async function terminateChromeProcess(chrome) {
  const chromeProcess = chrome?.process;
  if (!chromeProcess || processClosed(chromeProcess)) {
    return;
  }

  const closed = waitForChromeClose(chromeProcess, 'Chrome shutdown after direct kill');
  const errors = [];
  try {
    if (!chromeProcess.kill()) {
      errors.push(new Error('Chrome direct kill did not send a signal'));
    }
  } catch (error) {
    errors.push(error);
  }
  try {
    await closed;
    return;
  } catch (error) {
    errors.push(error);
  }

  if (processClosed(chromeProcess)) {
    return;
  }
  const forceClosed = waitForChromeClose(chromeProcess, 'Chrome shutdown after force-kill fallback');
  try {
    if (!chromeProcess.kill('SIGKILL')) {
      errors.push(new Error('Chrome force-kill fallback did not send a signal'));
    }
  } catch (error) {
    errors.push(error);
  }
  try {
    await forceClosed;
    return;
  } catch (error) {
    errors.push(error);
  }

  throw new AggregateError(errors,
    `Chrome process ${chromeProcess.pid ?? 'unknown'} did not stop${conciseChromeStderr(chrome)}`);
}

async function stopChrome(chrome) {
  await terminateChromeProcess(chrome);
}

function assertProfileConfiguration(lhr, profileName) {
  const settings = lhr.configSettings;
  assert.equal(settings.disableStorageReset, false,
    `Lighthouse ${profileName} leaves its default storage reset enabled`);
  if (profileName === 'mobile') {
    assert.equal(settings.formFactor, 'mobile', 'Lighthouse mobile uses the default mobile form factor');
    assert.equal(settings.screenEmulation.mobile, true, 'Lighthouse mobile uses mobile screen emulation');
    return;
  }

  assert.equal(settings.formFactor, desktopConfig.settings.formFactor,
    'Lighthouse desktop uses the official desktop preset form factor');
  assert.deepEqual(settings.screenEmulation, desktopConfig.settings.screenEmulation,
    'Lighthouse desktop uses the official desktop preset screen emulation');
  assert.deepEqual(settings.throttling, desktopConfig.settings.throttling,
    'Lighthouse desktop uses the official desktop preset throttling');
}

async function runAudits({ server, chrome, temporaryReportDirectory }) {
  const thresholdFailures = [];
  for (const profile of profiles) {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      const result = await completeWithin(
        lighthouse(`${server.origin}/index.html`, {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: categories,
          disableStorageReset: false
        }, profile.config),
        LIGHTHOUSE_RUN_TIMEOUT_MS,
        `Lighthouse ${profile.name} run ${repeat}`
      );
      assert.ok(result, `Lighthouse ${profile.name} run ${repeat}: returned a result`);
      assert.equal(result.lhr.runtimeError, undefined,
        `Lighthouse ${profile.name} run ${repeat}: completed without runtime error`);
      assertProfileConfiguration(result.lhr, profile.name);
      await writeFile(
        join(temporaryReportDirectory, `${profile.name}-${repeat}.report.json`),
        result.report,
        'utf8'
      );

      const fontRequests = result.lhr.audits['network-requests']?.details?.items;
      assert.ok(Array.isArray(fontRequests),
        `Lighthouse ${profile.name} run ${repeat}: reports network requests for font verification`);
      const externalFontRequests = fontRequests.filter(({ url }) => /fonts\.(?:googleapis|gstatic)\.com/i.test(url));
      assert.equal(externalFontRequests.length, 0,
        `Lighthouse ${profile.name} run ${repeat}: makes no Google Fonts network requests`);

      const scoreSummary = categories.map(category => {
        const score = result.lhr.categories[category]?.score;
        assert.equal(typeof score, 'number',
          `Lighthouse ${profile.name} run ${repeat}: ${category} score is available`);
        if (score < 0.9) {
          const diagnostics = category === 'performance'
            ? performanceDiagnosticAudits.map(auditId => {
                const audit = result.lhr.audits[auditId];
                return `${auditId}=${audit?.displayValue ?? audit?.numericValue ?? 'unavailable'}`;
              }).concat(
                (result.lhr.audits['long-tasks']?.details?.items ?? []).map(item =>
                  `long-task=${Math.round(item.duration)}ms@${item.url || 'unknown'}`
                )
              ).join(', ')
            : '';
          thresholdFailures.push(
            `${profile.name} run ${repeat}: ${category}=${score.toFixed(2)} (minimum 0.90)` +
            (diagnostics ? ` [${diagnostics}]` : '')
          );
        }
        return `${category}=${score.toFixed(2)}`;
      });
      console.log(`LIGHTHOUSE ${profile.name} run ${repeat}: ${scoreSummary.join(' ')}`);
    }
  }

  if (thresholdFailures.length > 0) {
    assert.fail(`Lighthouse score gate failed:\n${thresholdFailures.join('\n')}`);
  }
}

async function runLighthouseQa() {
  const temporaryReportDirectory = await mkdtemp(join(tmpdir(), 'zatuneya-lighthouse-'));
  const chromeProfileDirectory = await mkdtemp(join(temporaryReportDirectory, 'chrome-profile-'));
  let server;
  let chrome;
  let primaryError;
  const cleanupErrors = [];
  const startedAt = Date.now();

  try {
    const chromePath = await resolveChromePath();
    server = await startQaServer(root);
    assertLocalhostOrigin(server.origin);
    chrome = await launchChrome({ chromePath, userDataDir: chromeProfileDirectory });
    await completeWithin(
      runAudits({ server, chrome, temporaryReportDirectory }),
      LIGHTHOUSE_TOTAL_TIMEOUT_MS - (Date.now() - startedAt),
      'Complete Lighthouse QA run'
    );
  } catch (error) {
    primaryError = error;
  } finally {
    if (chrome) {
      try {
        await stopChrome(chrome);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (server) {
      try {
        await server.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await rm(temporaryReportDirectory, { recursive: true, force: true, maxRetries: 3 });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (primaryError && cleanupErrors.length > 0) {
    throw new AggregateError([primaryError, ...cleanupErrors],
      `Lighthouse QA failed and cleanup also failed${conciseChromeStderr(chrome)}`);
  }
  if (primaryError) {
    throw new Error(`${primaryError instanceof Error ? primaryError.message : String(primaryError)}${conciseChromeStderr(chrome)}`, {
      cause: primaryError
    });
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors,
      `Lighthouse QA cleanup failed${conciseChromeStderr(chrome)}`);
  }
}

await runLighthouseQa();
console.log('PASS Lighthouse mobile/default and desktop/preset profiles meet every 0.90 category threshold in both runs');
