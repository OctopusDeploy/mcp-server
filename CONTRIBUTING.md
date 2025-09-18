# Contributing Guide

Thanks for contributing to this project! :+1: This project and everyone participating in it is governed by the [Octopus Deploy Code of Conduct](https://github.com/OctopusDeploy/.github/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior using the instructions in the code of conduct.

This guide provides an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

## Getting Started

This project is built, tested, and released by workflows defined in GitHub Actions (see [Actions](/actions/) for more information). Release management is controlled through [Release-Please](https://github.com/googleapis/release-please). 

Please use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/#summary), and choose the "Squash and Merge" option to merge your PR (so we get a nice, clear Git history that makes it obvious what's changed)

### Issues

We :heart: feedback! Submitting an issue (i.e. feature, bug) is the best way to document things your experience with this project. For example, if there's a feature missing or there's behavior that doesn't match your expectations then we strongly encourage you to submit an issue. That way, contributors can track them and have interested folks (like you) by notified if/when they're resolved.

### Commit Your Change(s) through Pull Requests

This project employs [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/managing-a-branch-protection-rule); the `main` branch is protected. Therefore, your changes MUST be committed to a branch and submitted as a pull request. Also, this project requires the use of [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages. Using Conventional Commits enables this project to autogenerate its [CHANGELOG.md](CHANGELOG.md) and release notes.

### Your Pull Request is Merged! Now What?

Congratulations! :tada: And thank you very much for your contribution to this project!

Once your pull request is merged, our build and test workflow will execute once again to validate changes. Afterward, your changes will be committed to the `main` branch.