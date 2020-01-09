import core from '@actions/core'
import { eventName } from './gh'
import { deploy } from './now'

(async () => {
  try {
    if (eventName !== 'push') {
      exit('deploy-now only deploys to now for pushes')
      return
    }

    const result = await deploy()

    console.debug('deployment result', result)
  } catch (error) {
    exit(error.message)
  }
})()

function exit (message) { core.setFailed(message) }
