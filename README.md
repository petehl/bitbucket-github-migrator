# Bitbucket to Github migrator

## Prerequisites

Requires `git` & `git-lfs` installed and authenticated via http to github and bitbucket

Installed a gh client  - https://cli.github.com

Required gh extension - for granting elevated permissions
`gh extension install mislav/gh-repo-collab` 


List of repositories in a csv file called `repos.csv` with the format

`<reponame>,<newname?>,<archive?>,<renameOld?>,<topics+separated>,<admin?>`

```csv
string-library,,Y,Y
web-app,,Y,Y
ios-app,,Y,Y
```

### Environment variables

`BITBUCKET_ORG` : Organization in Bitbucket
`BITBUCKET_APP_PASSWORD` : Bitbucket App Password for renaming the repo after migration
`BITBUCKET_USER` : Bitbucket User for renaming the repo after migration
`GITHUB_ORG` : Github organization
`GITHUB_TEAM` : Github team
`GITHUB_TOPICS` : Default topics for github repos
