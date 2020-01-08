# GitHub Action which deploys to zeit's now on push

## Usage

```yml
name: now
on:
  pull_request:
  push:

jobs:
  deploy:
    name: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Checking out the code
        uses: actions/checkout@v1
      - name: deploy now
        uses: myobie/action-deploy-now@master
        with:
          zeit_token: ${{ secrets.ZEIT_TOKEN }}
          prod: ${{ github.ref == 'refs/heads/master' }}
```

## Development

```sh
$ yarn install

# and then before pushing, rebuild dist/index.js
$ yarn package
```
