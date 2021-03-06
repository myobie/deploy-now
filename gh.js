const github = require('@actions/github')
const { githubToken: token, debug, prod } = require('./config')

const validDeploymentStates = ['error', 'failure', 'in_progress', 'queued', 'pending', 'success']

const clientOptions = {}

if (debug) {
  clientOptions.log = console
}

export const client = new github.GitHub(token, clientOptions)
export const eventName = github.context.eventName
export const owner = github.context.repo.owner
export const repo = github.context.repo.repo
export const sha = getSHA()
export const shortSHA = sha.substring(0, 8)
export const commitURL = `https://github.com/${owner}/${repo}/commit/${sha}`
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
  const resp = await client.repos.listPullRequestsAssociatedWithCommit({
    commit_sha: sha,
    owner,
    repo
  })

  const openPRs = resp.data.filter(pr => {
    return pr.state !== 'closed'
  })

  return openPRs
}

export async function createDeployment () {
  const resp = await client.repos.createDeployment({
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
    update: async (state, params) => {
      if (!validDeploymentStates.includes(state)) {
        throw new Error(`invalid github deployment state ${state}, must be one of ${validDeploymentStates.join(', ')}`)
      }

      const resp = await client.repos.createDeploymentStatus({
        ...params,
        deployment_id: id,
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

function getSHA () {
  return github.context.payload.after
}

function getBranch () {
  if (github.context.payload.pull_request) {
    return github.context.payload.pull_request.head.ref
  } else {
    const ref = github.context.ref
    // the first two segments are not the branch
    return ref.split('/').slice(2).join('-').toLowerCase()
    // TODO: don't replace the / with a - and lowercase here, do that over to make it URL safe where it's needed
  }
}

function getDeploymentEnvironment () {
  if (prod) {
    return 'production'
  } else {
    return 'preview'
  }
}

async function createCommitComment (body) {
  const resp = await client.repos.createCommitComment({
    commit_sha: sha,
    owner,
    repo,
    body
  })

  return resp.data
}

async function createPullRequestComment (number, body) {
  const resp = await client.issues.createComment({
    issue_number: number,
    owner,
    repo,
    body
  })

  return resp.data
}
