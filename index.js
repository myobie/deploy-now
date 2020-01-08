const core = require('@actions/core')
// const github = require('@actions/github')
const { createDeployment } = require('now-client')

;(async () => {
  try {
    const token = core.getInput('zeit_token', { required: true })

    const deployment = await deploy('.', { token })

    console.debug('deployment', deployment)
    console.log('deployment', deployment)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

async function deploy (path, clientOptions = {}) {
  let deployment

  clientOptions.path = path
  clientOptions.debug = true
  clientOptions.force = true

  const previewURL = 'http://example.com/'

  const deploymentOptions = {
    build: {
      env: {
        PREVIEW_URL: previewURL
      }
    }
  }

  for await (const event of createDeployment(clientOptions, deploymentOptions)) {
    console.debug(event)
    console.log(event)

    if (event.type === 'ready') {
      deployment = event.payload
    }
  }

  return deployment
}
