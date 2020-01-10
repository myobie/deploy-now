const core = require('@actions/core')
const { eventName } = require('./gh')
const { deploy } = require('./now')

;(async () => {
  try {
    if (eventName !== 'push') {
      exit('deploy-now only deploys to now for pushes')
      return
    }

    await deploy()
  } catch (error) {
    console.error(error.stack)
    exit(error.message)
  }
})()

function exit (message) { core.setFailed(message) }
