const core = require('@actions/core')
const { zeitToken: token, path, nowJSON: json, packageJSON, prod, debug, skipComment } = require('./config')
const { createDeployment } = require('now-client')
const gh = require('./gh')
const nodeFetch = require('node-fetch')

export async function deploy () {
  let deployment
  let logsURL
  let error
  const config = await buildFullConfig()
  const actionsURL = `https://github.com/${gh.owner}/${gh.repo}/actions`

  let environmentURL
  if (prod) {
    environmentURL = config.productionAliasURL
  } else {
    environmentURL = config.aliasURL
  }

  if (debug) {
    console.debug('environment_url', environmentURL)
  }

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
        environment_url: environmentURL
      })

      if (!skipComment) {
        await gh.createComment(`
🎈 [\`${gh.shortSHA}\`](${gh.commitURL}) was deployed to now for the project [${config.project.name}](${config.projectURL}) and is available now at
🌍 <${environmentURL}>.

💡 Checkout the [action logs](${actionsURL}) or the [deployment logs](${logsURL}) over on now.
        `.trim())
      }
    }

    if (event.type === 'warning') {
      console.error(event.payload)
    }

    if (event.type === 'error') {
      await status.update('failure', {
        log_url: logsURL
      })

      if (!skipComment) {
        await gh.createComment(`
❌ [\`${gh.shortSHA}\`](${gh.commitURL}) failed to deploy to now for the project [${config.project.name}](${config.projectURL}).

➡️ Checkout the [action logs](${actionsURL}) or the [deployment logs](${logsURL}) over on now to see what might have happened.
        `.trim())
      }

      error = event.payload
      console.error(event)
      break
    }
  }

  if (error) {
    throw error
  } else {
    core.setOutput('deployment_url', logsURL)

    if (!prod) {
      core.setOutput('preview_alias', config.alias)
      core.setOutput('preview_alias_url', config.aliasURL)
    }
  }
}

async function assignAlais (deploymentID, alias) {
  if (prod) { return { prod } }

  const resp = await fetch(`/v2/now/deployments/${deploymentID}/aliases`, {
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ alias })
  })

  await checkStatus(resp)

  if (debug) {
    console.debug('alias response', resp.status, await resp.json())
  }

  return resp
}

async function buildFullConfig () {
  let stagingPrefix
  let team
  let project
  let productionAlias
  let productionAliasURL

  const user = await fetchUser()

  if (json.scope) {
    team = await fetchTeam(json.scope)
    stagingPrefix = team.stagingPrefix
  } else {
    stagingPrefix = user.stagingPrefix
  }

  if (team) {
    project = await fetchProject(json.name, team.id)
  } else {
    project = await fetchProject(json.name)
  }

  const urlSafeProjectName = project.name.replace('/', '-').replace('.', '')
  const projectURL = `https://zeit.co/${stagingPrefix}/${project.name}`

  const alias = `${urlSafeProjectName}-git-${gh.branch}.${stagingPrefix}.now.sh`
  const aliasURL = `https://${alias}`

  const foundProductionAlias = project.alias.find(alias => {
    return !alias.redirect && alias.target === 'PRODUCTION'
  })

  if (foundProductionAlias) {
    productionAlias = foundProductionAlias.domain
  } else {
    productionAlias = project.targets.production.alias[0]
  }

  if (productionAlias) {
    productionAliasURL = 'https://' + productionAlias
  }

  const client = {
    force: true, // I really mean it
    path,
    token,
    debug
  }

  let aliasAndURL

  if (prod) {
    aliasAndURL = {}
  } else {
    aliasAndURL = {
      NOW_PREVIEW_ALIAS: alias,
      NOW_PREVIEW_ALIAS_URL: aliasURL
    }
  }

  const deployment = {
    env: {
      GITHUB_REPO: gh.repo,
      GITHUB_OWNER: gh.owner,
      GITHUB_BRANCH: gh.branch,
      ...aliasAndURL
    },
    build: {
      env: {
        GITHUB_REPO: gh.repo,
        GITHUB_OWNER: gh.owner,
        GITHUB_BRANCH: gh.branch,
        ...aliasAndURL
      }
    }
  }

  if (prod) {
    deployment.target = 'production'
  }

  return {
    project,
    urlSafeProjectName,
    projectURL,
    user,
    stagingPrefix,
    alias,
    aliasURL,
    productionAliasURL,
    client,
    deployment
  }
}

async function fetchUser () {
  const resp = await fetch('/www/user')
  await checkStatus(resp)
  const json = await resp.json()
  return json.user
}

async function fetchTeam (slug) {
  const resp = await fetch(`/v1/teams?slug=${slug}`)
  await checkStatus(resp)
  return resp.json()
}

async function fetchProject (name, teamId) {
  let url = `/v1/projects/${name}`

  if (teamId) {
    url = url + `?teamId=${teamId}`
  }

  const resp = await fetch(url)
  await checkStatus(resp)
  return resp.json()
}

function getLogsURL (deployment, config) {
  const urlParts = deployment.url.split('-')
  const uuid = urlParts[urlParts.length - 1].split('.')[0]

  return `https://zeit.co/${config.stagingPrefix}/${config.urlSafeProjectName}/${uuid}?tab=build`
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
    console.debug(`${opts.method} ${url}`)
  }

  const time = Date.now()

  const resp = await nodeFetch(fullURL, opts)

  if (debug) {
    console.debug(`${resp.status} in ${Date.now() - time}ms → ${opts.method || 'GET'} ${url}`)
  }

  return resp
}

async function checkStatus (resp) {
  if (resp.ok) {
    return resp
  } else {
    let error
    try {
      const json = resp.json()
      error = json.error
    } catch (err) {
      error = null
    }

    error || (error = resp.statusText)

    throw new Error(error)
  }
}
