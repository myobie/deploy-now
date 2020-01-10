const { zeitToken: token, path, nowJSON: json, packageJSON, debug } = require('./config')
const { createDeployment } = require('now-client')
const gh = require('./gh')
const nodeFetch = require('node-fetch')

export async function deploy () {
  let deployment
  let logsURL
  let error
  const config = await buildFullConfig()
  const actionsURL = `https://github.com/${gh.owner}/${gh.repo}/actions`

  const status = await gh.createDeployment()
  await status.update('pending')

  for await (const event of createDeployment(config.client, config.deployment)) {
    if (event.type === 'created') {
      deployment = event.payload
      logsURL = getLogsURL(deployment, config)

      await status.update('queued', {
        log_url: logsURL
      })
    }

    if (event.type === 'build-state-changed') {
      await status.update('in_progress', {
        log_url: logsURL
      })
    }

    if (event.type === 'ready') {
      deployment = event.payload

      await assignAlais(deployment.id, config.alias)

      await status.update('success', {
        log_url: logsURL,
        environment_url: config.alias
      })
      await gh.createComment(`
🎈 \`${gh.shortSHA}\` was deployed to now for the project [${config.project}](${config.projectURL}) and is available now at
🌍 <${config.alias}>.

💡 Checkout the [action logs](${actionsURL}) here and the [deployment logs](${logsURL}) over on now.
`.trim())
    }

    if (event.type === 'warning') {
      console.error(event.payload)
    }

    if (event.type === 'error') {
      await status.update('failure', {
        log_url: logsURL
      })
      await gh.createComment(`
❌ \`${gh.shortSHA}\` failed to deploy to now for the project [${config.project}](${config.projectURL}).

➡️ Checkout the [action logs](${actionsURL}) here and the [deployment logs](${logsURL}) over on now to see what might have happened.
`.trim())

      error = event.payload
      console.error(event)
      break
    }
  }

  if (error) {
    throw error
  } else {
    return deployment
  }
}

async function assignAlais (deploymentID, alias) {
  return fetch(`/v2/now/deployments/${deploymentID}`, {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ alias })
  })
}

async function buildFullConfig () {
  const project = json.name
  const urlSafeProject = project.replace('/', '-').replace('.', '')
  const user = await fetchUser()
  const scope = json.scope || user
  const alias = `https://${urlSafeProject}-git-${gh.branch}.${scope}.now.sh`
  const projectURL = `https://zeit.co/${scope}/${project}`

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
    urlSafeProject,
    projectURL,
    user,
    scope,
    alias,
    client,
    deployment
  }
}

async function fetchUser () {
  const resp = await fetch('/www/user')
  const json = await resp.json()
  return json.user.username
}

function getLogsURL (deployment, config) {
  const urlParts = deployment.url.split('-')
  const uuid = urlParts[urlParts.length - 1].split('.')[0]

  return `https://zeit.co/${config.user}/${config.urlSafeProject}/${uuid}?tab=build`
}

async function fetch (url, opts = {}) {
  const fullURL = `https://api.zeit.co${url}`
  const userAgent = opts.userAgent || `deploy-now-action-${packageJSON.version}`

  opts.headers = {
    ...opts.headers,
    authorization: `Bearer ${token}`,
    accept: 'application/json',
    'user-agent': userAgent
  }

  if (opts.contentType) {
    opts.headers['Content-type'] = opts.contentType
  }
  delete opts.contentType

  opts.method || (opts.method = 'GET')

  if (debug) {
    console.debug(`FETCH: ${opts.method} ${url}`)
  }

  const time = Date.now()

  const resp = await nodeFetch(fullURL, opts)

  if (debug) {
    console.debug(`DONE in ${Date.now() - time}ms: ${opts.method || 'GET'} ${url}`)
  }

  return resp
}
