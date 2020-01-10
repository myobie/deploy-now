const core = require('@actions/core')
const { debug } = require('./config')
const { eventName } = require('./gh')
const { deploy } = require('./now')

;(async () => {
  try {
    if (eventName !== 'push') {
      exit('deploy-now only deploys to now for pushes')
      return
    }

    const result = await deploy()

    if (debug) {
      console.debug('deployment result', result)
    }
  } catch (error) {
    console.error(error.stack)
    exit(error.message)
  }
})()

function exit (message) { core.setFailed(message) }
