import { supabaseAdmin } from '../../../lib/supabase';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const REPO_NAME = process.env.GITHUB_REPO_NAME;

async function githubRequest(path, method = 'GET', body = null) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

// GET - read a file from the repo
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');
  if (!filePath) return Response.json({ error: 'No path' }, { status: 400 });

  try {
    const data = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return Response.json({ content, sha: data.sha });
  } catch (error) {
    return Response.json({ error: 'Failed to read file' }, { status: 500 });
  }
}

// POST - create a PR with proposed changes
export async function POST(request) {
  try {
    const { filePath, newContent, commitMessage, prTitle, prBody } = await request.json();

    // Get current file SHA
    const currentFile = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
    
    // Create a new branch
    const branchName = `claude-update-${Date.now()}`;
    const mainRef = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`);
    
    await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: mainRef.object.sha,
    });

    // Update file on new branch
    await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, 'PUT', {
      message: commitMessage || `Claude: ${prTitle}`,
      content: Buffer.from(newContent).toString('base64'),
      sha: currentFile.sha,
      branch: branchName,
    });

    // Create PR
    const pr = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, 'POST', {
      title: prTitle || 'Claude proposed update',
      body: prBody || 'Proposed by Claude via Throughline.',
      head: branchName,
      base: 'main',
    });

    // Log PR to Supabase
    await supabaseAdmin.from('github_prs').insert({
      pr_number: pr.number,
      pr_url: pr.html_url,
      file_path: filePath,
      title: prTitle,
      status: 'open',
    }).catch(() => {});

    return Response.json({ pr_url: pr.html_url, pr_number: pr.number });
  } catch (error) {
    console.error('GitHub PR error:', error);
    return Response.json({ error: 'Failed to create PR' }, { status: 500 });
  }
}
