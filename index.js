const core = require('@actions/core')
const github = require('@actions/github')
const { createDeployment } = require('now-client')
const { readFile } = require('fs').promises
// const { fetch } = require('now-client/utils')

const octokit = new github.GitHub(core.getInput('github_token', { required: true }))

;(async () => {
  try {
    if (github.context.eventName !== 'push' &&
      !(github.context.eventName === 'pull_request' && github.context.payload.action === 'synchronize')) {
      core.setFailed('deploy-now only deploys to now for pushes or pull_request synchronizes')
      return
    }

    const path = process.cwd()
    const token = core.getInput('zeit_token', { required: true })

    const clientOptions = { path, token }

    const deployment = await deploy(clientOptions)

    console.debug('deployment', deployment)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

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

async function previewURL (options = {}) {
  const branch = getBranch()
  console.debug('branch', branch)

  let nowContent

  try {
    nowContent = await readFile(options.path + '/now.json', 'utf8')
  } catch (e) {
    throw new Error('cannot find a now.json file, please refer to https://github.com/myobie/deploy-now#README')
  }

  const nowJSON = JSON.parse(nowContent)

  const project = nowJSON.name.replace('/', '-')

  if (!project) {
    throw new Error('missing name: key in now.json – please include the project name in now.json')
  }

  console.debug('now project', project)

  const scope = nowJSON.scope || 'myobie' // TOOD: replace which whoami

  console.debug('now scope', scope)

  const url = `https://${project}-git-${branch}.${scope}.now.sh`

  console.debug('previewURL', url)

  return url
}

async function postComment (body) {
  return octokit.repos.createCommitComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    commit_sha: getSHA(),
    body
  })
}

async function updateComment (commentID, body) {
  return octokit.repos.updateCommitComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    comment_id: commentID,
    body
  })
}

async function deploy (clientOptions = {}) {
  let deployment
  let error
  let commentID

  clientOptions.debug = true
  clientOptions.force = true

  const _previewURL = await previewURL(clientOptions)

  const deploymentOptions = {
    build: {
      env: {
        PREVIEW_URL: previewURL
      }
    }
  }

  for await (const event of createDeployment(clientOptions, deploymentOptions)) {
    console.debug('event', event.type)

    if (event.type === 'build-state-changed') {
      console.debug(event.payload.readyState, {
        entrypoint: event.payload.entrypoint,
        use: event.payload.use,
        createdIn: event.payload.createdIn
      })
    }

    if (event.type === 'created') {
      deployment = event.payload

      // const deploymentID = deployment.url.split('-')[1].split('.')[0]

      console.debug({ regions: deployment.regions, url: deployment.url, status: deployment.status })
      console.debug('TODO: post a comment here')
      commentID = await postComment(`🚀 started deployment for ${_previewURL}`)
      continue
    }

    if (event.type === 'ready') {
      console.debug({ alias: event.payload.alias, public: event.payload.public })
      await updateComment(commentID, `✅ completed deployment for ${_previewURL}`)
      continue
    }

    if (event.type === 'warning') {
      console.error(event.payload)
      continue
    }

    if (event.type === 'error') {
      console.error(event.payload)
      error = event.payload
      await updateComment(commentID, `❌ deployment failed for ${_previewURL}`)
      break
    }
  }

  if (error) {
    throw error
  } else {
    return deployment
  }
}
