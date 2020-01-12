# GitHub Action which deploys to zeit's now on push

## Quickstart

```yml
# for pushes, after checkout
- name: now
  uses: myobie/deploy-now@v1
  with:
    zeit_token: ${{ secrets.ZEIT_TOKEN }}
    prod: ${{ github.ref == 'refs/heads/master' }}
```

## Automatically deploy every branch and PR to a preview alias

<img width="378" alt="Screenshot of PR which has been deployed to a preview alias" src="https://user-images.githubusercontent.com/179/72175558-b4f50680-33dc-11ea-8ce9-0175790d7c4a.png">

## Automatically deploy master to production

<img width="505" alt="Screenshot of a commit with a comment about being deployed" src="https://user-images.githubusercontent.com/179/72175557-b45c7000-33dc-11ea-9541-7d8a4568381c.png">

## Usage

### Secrets

You **must** configure a secret for your repository that contains a zeit API token. You can create one at <https://zeit.co/account/tokens>. It is recommended to use the name `ZEIT_TOKEN`.

### `now.json`

You **must** have a `now.json` file in the root of your repo and it **must** have the `name:` key set to your project's name. If you are deploying a project that is under a team you also need to set the `scope:` key to your team's slug (the default scope is your zeit username).

It is also recommended to disable the auto-github features of `now` so you don't have competing deploy hooks by assigning the `github.enabled:` and `github.autoAlias:` keys to `false`. This means one can still enable the GitHub integration and get nice links to the repo and commits, but prevent zeit from competing with this action.

An example json file:

```json
{
  "name": "shareup.app",
  "scope": "shareup",
  "github": {
    "enabled": false,
    "autoAlias": false
  }
}
```

### `now.yml` in `.github/workflows/`

An example action workflow using this action:

```yml
name: now
on:
  push:

jobs:
  deploy:
    name: deploy
    runs-on: ubuntu-latest
    steps:
      - name: checkout
        uses: actions/checkout@v1
      - name: now
        uses: myobie/deploy-now@v1
        with:
          zeit_token: ${{ secrets.ZEIT_TOKEN }}
          prod: ${{ github.ref == 'refs/heads/master' }}
```

_There is already a token set on the `github` context and this action uses it by default; you do not need to generate and set a token in your repository secrets._

A comment is posted to PRs after a deploy to now and this can be disabled with `skip_comment: true`. To output more debugging information to the logs, add `debug: true`.

### Preview Alias

A preview alias URL is assigned to the deployment in the pattern `https://{project}-git-{branch}.{user}.now.sh`

The alias is exposed during the build and runtime steps as `NOW_PREVIEW_ALIAS`. For a full list of `ENV` variables, refer to the [deployment configuration in `now.js`](https://github.com/myobie/deploy-now/blob/master/now.js#L166)

An example of how to use this with a static site generator (`hugo` for example) is:

```sh
if [[ -n "${NOW_PREVIEW_ALIAS}" ]]; then
  echo "Building for ${NOW_PREVIEW_ALIAS}"
  hugo --baseURL="https://${NOW_PREVIEW_ALIAS}"
else
  echo "Building for default url"
  hugo
fi
```

## Why use this instead of the built in GitHub integration?

`now` is very smart and will not redeploy if the source hasn't changed. However, it's possible to have build-time ENV variables that change and affect the output (like the `NOW_PREVIEW_ALIAS`) which need to force a deploy. Not every URL can be rendered without the host, like an RSS feed or a txt template that might be used for sending emails, so it's important to rebuild with the latest ENV.

It's also super cool and flexible to be able to control when things are deployed inside the source of the repo.

## Development

```sh
$ yarn install

# and then before pushing, rebuild dist/index.js
$ yarn package

# or install the git pre-commit hook which will package for you
$ cp pre-commit.sample .git/hooks/pre-commit
```
