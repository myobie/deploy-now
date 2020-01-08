const core = require('@actions/core')
// const github = require('@actions/github')
const { createDeployment } = require('now-client')

;(async () => {
  try {
    const token = core.getInput('zeit_token', { required: true })
    const path = process.cwd()
    console.log('path', path)
    const deployment = await deploy(path, { token })
    console.debug('deployment', deployment)
  } catch (error) {
    core.setFailed(error.message)
  }
})()

async function deploy (path, options) {
  let deployment

  for await (const event of createDeployment(path, options)) {
    console.debug(event)

    if (event.type === 'ready') {
      deployment = event.payload
    }
  }

  return deployment
}
