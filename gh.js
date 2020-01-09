const core = require('@actions/core')
const github = require('@actions/github')

const validDeploymentStates = ['error', 'failure', 'in_progress', 'queued', 'pending', 'success']

export const token = core.getInput('github_token', { required: true })

const octokit = new github.GitHub(token)

export const client = octokit
export const eventName = github.context.eventName
export const owner = github.context.repo.owner
export const repo = github.context.repo.repo
export const sha = getSHA()
export const branch = getBranch()
export const environment = getDeploymentEnvironment()

export async function createComment (body) {
  const resp = await octokit.repos.createCommitComment({
    commit_sha: getSHA(),
    owner,
    repo,
    body
  })

  return resp.data
}

export async function createDeployment (previewAlias) {
  const resp = octokit.repos.createDeployment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    ref: branch,
    environment
  })

  const data = resp.data
  const id = data.id

  return {
    data,
    id,
    update: async (state) => {
      if (!validDeploymentStates.contains(state)) {
        throw new Error(`invalid github deployment state ${state}, must be one of ${validDeploymentStates.join(', ')}`)
      }

      const resp = await octokit.repos.createDeploymentStatus({
        deployment_id: id,
        environment_url: previewAlias,
        owner,
        repo,
        state
      })

      return resp.data
    }
  }
}

function getSHA () { return github.context.payload.after }

function getBranch () {
  if (github.context.payload.pull_request) {
    return github.context.payload.pull_request.head.ref
  } else {
    const ref = github.context.ref
    // the first two segments are not the branch
    return ref.split('/').slice(2).join('-').toLowerCase()
  }
}

function getDeploymentEnvironment () {
  if (getBranch() === 'master') {
    return 'production'
  } else {
    return 'preview'
  }
}
