const core = require('@actions/core')
const { eventName } = require('./gh')
const { deploy } = require('./now')

;(async () => {
  try {
    if (eventName !== 'push' && eventName !== 'pull_request') {
      exit('deploy-now only deploys to now for pushes and pull_request synchronizes')
      return
    }

    const result = await deploy()

    console.debug('deployment result', result)
  } catch (error) {
    exit(error.message)
  }
})()

function exit (message) { core.setFailed(message) }
