#!/bin/bash

publish () { # HOST, USER, PASS
  mv .npmrc .npmrc-temp
  curl -u $3:$4 $1/auth > .npmrc
  echo "registry=${1}/${2}" >> .npmrc
  cat .npmrc
  npm publish --registry $1/npm-local
  rm .npmrc
  mv .npmrc-temp .npmrc
}

publish "https://artifactory.nike.com/artifactory/api/npm" "npm-nike" "maven" "ludist"