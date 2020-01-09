const github = require('@actions/github')
const { githubToken: token, debug } = require('./config')

const validDeploymentStates = ['error', 'failure', 'in_progress', 'queued', 'pending', 'success']

const octokitOptions = {}

if (debug) {
  octokitOptions.log = console
}

const octokit = new github.GitHub(token, octokitOptions)

export const client = octokit
export const eventName = github.context.eventName
export const owner = github.context.repo.owner
export const repo = github.context.repo.repo
export const sha = getSHA()
export const shortSHA = sha.substring(0, 8)
export const branch = getBranch()
export const environment = getDeploymentEnvironment()

export async function createComment (body) {
  const prs = await associatedPullRequests()

  if (prs.length === 0) {
    createCommitComment(body)
  } else {
    prs.forEach(pr => {
      // KNOWN ISSUE: this doesn't paginate, so will be limited to the "first page"
      createPullRequestComment(pr.number, body)
    })
  }
}

async function associatedPullRequests () {
  const resp = await octokit.repos.listPullRequestsAssociatedWithCommit({
    commit_sha: sha,
    owner,
    repo
  })

  return resp.data
}

export async function createDeployment (previewAlias) {
  const resp = await octokit.repos.createDeployment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    required_contexts: [], // always deploy
    ref: sha,
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
        state,
        mediaType: {
          previews: ['flash', 'ant-man']
        }
      })

      // TODO: supply the log_url that points to the zeit dashboard page for the zeit deployment

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

async function createCommitComment (body) {
  const resp = await octokit.repos.createCommitComment({
    commit_sha: sha,
    owner,
    repo,
    body
  })

  return resp.data
}

async function createPullRequestComment (number, body) {
  const resp = await octokit.issues.createComment({
    issue_number: number,
    owner,
    repo,
    body
  })

  return resp.data
}
