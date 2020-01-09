import { createDeployment } from 'now-client'
import { zeitToken as token, path, json, debug } from './config'
import * as gh from './gh'
// const { fetch } = require('now-client/utils')

export async function deploy () {
  let deploymentResult
  let deploymentURL
  let error

  const config = buildFullConfig()

  const projectURL = `https://zeit.co/${config.scope}/${config.name}`
  const actionURL = '#' // TODO: what is the url to this action's logs?

  const deployment = await gh.createDeployment()
  await deployment.update('pending')

  for await (const event of createDeployment(config.client, config.deployment)) {
    if (event.type === 'created') {
      await deployment.update('queued')
    }

    if (event.type === 'build-state-changed') {
      await deployment.update('in_progress')
    }

    if (event.type === 'ready') {
      await deployment.update('success')
      await gh.createComment(`🎈 \`${gh.shortSHA}\` was deployed to now for the project [${config.name}](${projectURL}) and is available at 🌍 <${config.alias}>. `.trim())
      deploymentResult = event.payload
    }

    if (event.type === 'warning') {
      console.error(event.payload)
    }

    if (event.type === 'error') {
      await deployment.update('failure')
      await gh.createComment(`
❌ \`${gh.shortSHA}\` failed to deploy to now for the project [${config.name}](${projectURL}).

Checkout the [action logs](${actionURL}) here and the [deployment logs](${deploymentURL}) over on now to see what might have happened.
`.trim())

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
    force: true, // I really mean it
    path,
    token,
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
  // TODO: hit the zeit API and get the current username
  return 'myobie'
}
