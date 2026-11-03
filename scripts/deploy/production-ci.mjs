async function read(path) {
  const response = await fetch(`https://api.github.com/repos/avecging/nibatlas/${path}`, {headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json'}, redirect: 'error', signal: AbortSignal.timeout(60000)});
  if (!response.ok) throw Error('Could not verify production commit checks');
  return response.json();
}

try {
  const sha = process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || process.env.GITHUB_REPOSITORY !== 'avecging/nibatlas') throw Error();
  const head = await read('git/ref/heads/main');
  if (head.object.sha !== sha) throw Error();
  const runs = await read(`actions/runs?head_sha=${sha}&event=push&per_page=100`);
  const run = runs.workflow_runs.filter(item => item.path === '.github/workflows/ci.yml' && item.head_branch === 'main').sort((a, b) => b.id - a.id)[0];
  if (!run || run.status !== 'completed' || run.conclusion !== 'success') throw Error();
  console.log('Current main commit has successful CI.');
} catch {
  console.error('Production requires the current main commit with successful CI; no release performed.');
  process.exitCode = 1;
}
