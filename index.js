const core = require('@actions/core')
const github = require('@actions/github')
const { createDeployment } = require('now-client')
const { readFile } = require('fs').promises
// const { fetch } = require('now-client/utils')

;(async () => {
  try {
    const token = core.getInput('zeit_token', { required: true })
    const path = process.cwd()

    const clientOptions = { token }

    const url = await previewURL(path, { token })

    const deploymentOptions = {
      build: {
        env: {
          PREVIEW_URL: url
        }
      }
    }

    const deployment = await deploy(path, clientOptions, deploymentOptions)

    console.debug('deployment', deployment)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

async function previewURL (path, clientOptions = {}) {
  const ref = github.context.ref
  // the first two segments are not the branch
  const branch = ref.split('/').slice(2).join('-').toLowerCase()

  let nowContent

  try {
    nowContent = await readFile(path + '/now.json', 'utf8')
  } catch (e) {
    throw new Error('cannot find a now.json file, please refer to https://github.com/myobie/deploy-now#README')
  }

  const nowJSON = JSON.parse(nowContent)

  const project = nowJSON.name.replace('/', '-')

  if (!project) {
    throw new Error('missing name: key in now.json – please include the project name in now.json')
  }

  const scope = nowJSON.scope || 'myobie' // TOOD: replace which whoami

  const url = `https://${project}-git-${branch}.${scope}.now.sh`

  console.debug('previewURL', url)

  return url
}

async function deploy (path, clientOptions = {}, deploymentOptions = {}) {
  let deployment
  let error

  clientOptions.path = path
  clientOptions.debug = true
  clientOptions.force = true

  for await (const event of createDeployment(clientOptions, deploymentOptions)) {
    console.debug(event.type)

    if (event.type === 'build-state-changed') {
      console.debug(event.payload.readyState, {
        entrypoint: event.payload.entrypoint,
        use: event.payload.use,
        createdIn: event.payload.createdIn
      })
    }

    if (event.type === 'created') {
      deployment = event.payload

      console.debug({ regions: deployment.regions, url: deployment.url, status: deployment.status })
      console.debug('TODO: post a comment here')
      continue
    }

    if (event.type === 'ready') {
      console.debug({ alias: event.payload.alias, public: event.payload.public })
      console.debug('TODO: post a comment here')
      continue
    }

    if (event.type === 'warning') {
      console.error(event.payload)
      continue
    }

    if (event.type === 'error') {
      console.error(event.payload)
      error = event.payload
      break
    }
  }

  if (error) {
    throw error
  } else {
    return deployment
  }
}
