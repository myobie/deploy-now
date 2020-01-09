const core = require('@actions/core')
const { readFileSync } = require('fs')

const githubToken = core.getInput('github_token', { required: true })
exports.githubToken = githubToken

const zeitToken = core.getInput('zeit_token', { required: true })
exports.zeitToken = zeitToken

const prod = isTrue(core.getInput('prod'))
exports.prod = prod

const debug = isTrue(core.getInput('debug'))
exports.debug = debug

const path = process.cwd()
exports.path = path

exports.json = (() => {
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
