const core = require('@actions/core')
const { path, json } = require('./config')
const { createDeployment } = require('now-client')
// const { fetch } = require('now-client/utils')
const gh = require('./github')

export const token = core.getInput('zeit_token', { required: true })
export const prod = core.getInput('prod') === true
export const force = core.getInput('force') === true
export const debug = core.getInput('debug') === true

export async function deploy () {
  let deploymentResult
  let error

  const config = buildFullConfig()

  const deployment = await gh.createDeployment()

  for await (const event of createDeployment(config.client, config.deployment)) {
    if (event.type === 'created') {
      await deployment.update('queued')
    }

    if (event.type === 'build-state-changed') {
      await deployment.update('in_progress')
    }

    if (event.type === 'ready') {
      await deployment.update('success')
      await gh.createComment(`🎈 deployment finished for ${config.alias}`)
      deploymentResult = event.payload
    }

    if (event.type === 'warning') {
      console.error(event.payload)
    }

    if (event.type === 'error') {
      await deployment.update('failure')
      await gh.createComment(`❌ deployment failed for ${config.alias}`)

      error = event.payload
      console.error(event)
      break
    }
  }

  if (error) {
    throw error
  } else {
    return deploymentResult
  }
}

async function buildFullConfig () {
  const project = json.name.replace('/', '-').replace('.', '')
  const user = await fetchUser()
  const scope = json.scope || user
  const alias = `https://${project}-git-${gh.branch}.${scope}.now.sh`

  const client = {
    path,
    token,
    force,
    debug
  }

  const deployment = {
    env: {
      GITHUB_REPO: gh.repo,
      GITHUB_OWNER: gh.owner,
      GITHUB_BRANCH: gh.branch,
      NOW_PREVIEW_ALIAS: alias
    },
    build: {
      env: {
        GITHUB_REPO: gh.repo,
        GITHUB_OWNER: gh.owner,
        GITHUB_BRANCH: gh.branch,
        NOW_PREVIEW_ALIAS: alias
      }
    }
  }

  return {
    project,
    user,
    scope,
    alias,
    client,
    deployment
  }
}

async function fetchUser () {
  return 'myobie'
}
