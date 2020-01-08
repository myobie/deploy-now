# GitHub Action which deploys to zeit's now on push

## Usage

```yml
name: deploy now
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
        uses: myobie/deploy-now@master
        with:
          github_token: ${{ github.token }}
          zeit_token: ${{ secrets.ZEIT_TOKEN }}
          prod: ${{ github.ref == 'refs/heads/master' }}
```

## Development

```sh
$ yarn install

# and then before pushing, rebuild dist/index.js
$ yarn package

# or install the git pre-commit hook which will package for you
$ cp pre-commit.sample .git/hooks/pre-commit
```
