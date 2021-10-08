# GitHub Organization Member Contribution Action

> A GitHub Action to generate a report that contains member contribution data for a set interval belonging to a GitHub organization.

## Usage

By default the example [workflow](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions) below runs on a monthly [schedule](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events) using the amount of days from today interval as set in `action.yml` (default 30 days) and can also be triggered manually using a [workflow_dispatch](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#manual-events) event.

```yml
name: Member Contribution Report

on:
  schedule:
    # Runs on the first day of the month at 00:00 UTC
    #
    #        ┌────────────── minute
    #        │ ┌──────────── hour
    #        │ │ ┌────────── day (month)
    #        │ │ │ ┌──────── month
    #        │ │ │ │ ┌────── day (week)
    - cron: '0 0 1 * *'
  workflow_dispatch:
    inputs:
      fromdate:
        description: 'Optional interval start date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided
      todate:
        description: 'Optional interval end date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided

jobs:
  member-contribution-report:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Get Member Contributions
        uses: nicklegan/github-org-member-contribution-action@v1.1.1
        with:
          token: ${{ secrets.ORG_TOKEN }}
          fromdate: ${{ github.event.inputs.fromdate }} # Used for workflow dispatch input
          todate: ${{ github.event.inputs.todate }} # Used for workflow dispatch input
```

## GitHub secrets

| Name                 | Value                                                            | Required |
| :------------------- | :--------------------------------------------------------------- | :------- |
| `ORG_TOKEN`          | A `repo`, `read:org`, `read:user` scoped [Personal Access Token] | `true`   |
| `ACTIONS_STEP_DEBUG` | `true` [Enables diagnostic logging]                              | `false`  |

[personal access token]: https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=Member+Contribution+Action 'Personal Access Token'
[enables diagnostic logging]: https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging#enabling-runner-diagnostic-logging 'Enabling runner diagnostic logging'

:bulb: Disable [token expiration](https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/) to avoid failed workflow runs when running on a schedule.

## Action inputs

| Name              | Description                                                   | Default                     | Options                                                                                                                                                                            | Required |
| :---------------- | :------------------------------------------------------------ | :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `org`             | Organization different than workflow context                  |                             |                                                                                                                                                                                    | `false`  |
| `days`            | Amount of days in the past to collect data for                | `30`                        |                                                                                                                                                                                    | `false`  |
| `sort`            | Column used to sort the acquired contribution data            | `commitContrib`             | `activeContrib`, `commitContrib`, `issueContrib`, `prContrib`, `prreviewContrib`, `repoIssueContrib`, `repoCommitContrib`, `repoPullRequestContrib` `repoPullRequestReviewContrib` | `false`  |
| `committer-name`  | The name of the committer that will appear in the Git history | `github-actions`            |                                                                                                                                                                                    | `false`  |
| `committer-email` | The committer email that will appear in the Git history       | `github-actions@github.com` |                                                                                                                                                                                    | `false`  |

## Workflow dispatch inputs

The additional option to retrieve historical contribution data using a custom date interval.
If the below fields are left empty during [workflow dispatch input](https://github.blog/changelog/2020-07-06-github-actions-manual-triggers-with-workflow_dispatch/), the default interval option of set days from the current date configured in __main.yml__ will be used instead.

| Name                           | Value                                   | Required |
| :----------------------------- | :-------------------------------------- | :------- |
| `Optional interval start date` | A date matching the format `yyyy-mm-dd` | `false`  |
| `Optional interval end date`   | A date matching the format `yyyy-mm-dd` | `false`  |

## CSV layout

The results of all except the first two columns will be the sum of contributions for the requested interval per organization member.

| Column                   | Description                                                     |
| :----------------------- | :-------------------------------------------------------------- |
| Member                   | Username of the organization member                             |
| Has active contributions | Returns true if the member made contributions                   |
| Commits created          | Number of commits created by the org member                     |
| Issues opened            | Number of issues opened by the org member                       |
| PRs opened               | Number of pull requests opened by the org member                |
| PR reviews               | Number of pull request reviews given by the org member          |
| Issue spread             | Number of repos the org member opened issues in                 |
| Commit spread            | Number of repos the org member created commits in               |
| PR spread                | Number of repos the org member opened pull requests in          |
| PR review spread         | Number of repos the org member reviewed pull request reviews in |

A CSV report file to be saved in the repository __reports__ folder using the following naming format: __organization-date-interval.csv__.

:bulb: If no contribution data for an org member is returned but __Has active contributions__ returns __true__, the user was added to the organization during the requested interval which also counts as a contribution.

## GitHub App authentication

In some scenarios it might be preferred to authenthicate as a [GitHub App](https://docs.github.com/developers/apps/getting-started-with-apps/about-apps) rather than using a [personal access token](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

The following features could be a benefit authenticating as a GitHub App installation:

- The GitHub App is directly installed on the organization, no separate user account is required.
- A GitHub App has more granular permissions than a personal access token.
- To avoid hitting the 5000 requests per hour GitHub API rate limit, [authenticating as a GitHub App installation](https://docs.github.com/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation) would increase the [API request limit](https://docs.github.com/developers/apps/building-github-apps/rate-limits-for-github-apps#github-enterprise-cloud-server-to-server-rate-limits).

The GitHub App authentication strategy can be integrated with the Octokit library by installing and configuring the [@octokit/auth-app](https://github.com/octokit/auth-app.js/#usage-with-octokit) npm module before [rebuilding](https://docs.github.com/actions/creating-actions/creating-a-javascript-action) the Action in a separate repository.