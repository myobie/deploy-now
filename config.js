const core = require('@actions/core')
const { readFileSync } = require('fs')

export const githubToken = core.getInput('github_token', { required: true })
export const zeitToken = core.getInput('zeit_token', { required: true })
export const prod = isTrue(core.getInput('prod'))
export const debug = isTrue(core.getInput('debug'))
export const skipComment = isTrue(core.getInput('skip_comment'))

export const path = process.cwd()

export const packageJSON = (() => {
  let content

  try {
    content = readFileSync(path + '/package.json', 'utf8')
  } catch (e) {
    throw new Error('cannot find a package.json file')
  }

  const json = JSON.parse(content)

  if (!json.version) {
    throw new Error("missing key 'version' in package.json")
  }

  return json
})()

export const nowJSON = (() => {
  let content

  try {
    content = readFileSync(path + '/now.json', 'utf8')
  } catch (e) {
    throw new Error('cannot find a now.json file, please refer to https://github.com/myobie/deploy-now#README')
  }

  const json = JSON.parse(content)

  if (!json.name) {
    throw new Error("missing key 'name' in now.json – please include the project name in now.json and retry")
  }

  return json
})()

function isTrue (thing) {
  return thing === true || thing === 'true'
}
