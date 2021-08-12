const arraySort = require('array-sort')
const core = require('@actions/core')
const github = require('@actions/github')
const stringify = require('csv-stringify/lib/sync')
const { Octokit } = require('@octokit/rest')
const { retry } = require('@octokit/plugin-retry')
const { throttling } = require('@octokit/plugin-throttling')

const MyOctokit = Octokit.plugin(throttling, retry)
const eventPayload = require(process.env.GITHUB_EVENT_PATH)
const org = core.getInput('org', { required: false }) || eventPayload.organization.login
const token = core.getInput('token', { required: true })

// API throttling
const octokit = new MyOctokit({
  auth: token,
  request: {
    retries: 1,
    retryAfter: 180
  },
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      oktokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
    }
  }
})

// Query all org member contributions
async function getMemberActivity(orgid, from, to, contribArray) {
  let paginationMember = null
  const query = `query ($org: String! $orgid: ID $cursorID: String $from: DateTime, $to: DateTime) {
    organization(login: $org ) {
      membersWithRole(first: 25, after: $cursorID) {
        nodes {
          login
          contributionsCollection (organizationID: $orgid, from: $from, to: $to) {
            hasAnyContributions
            totalCommitContributions
            totalIssueContributions
            totalPullRequestContributions
            totalPullRequestReviewContributions
            totalRepositoriesWithContributedIssues
            totalRepositoriesWithContributedCommits
            totalRepositoriesWithContributedPullRequests
            totalRepositoriesWithContributedPullRequestReviews
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }`
  try {
    let hasNextPageMember = false
    let getMemberResult = null

    do {
      getMemberResult = await octokit.graphql({
        query,
        org,
        orgid,
        from,
        to,
        cursorID: paginationMember
      })

      const membersObj = getMemberResult.organization.membersWithRole.nodes
      hasNextPageMember = getMemberResult.organization.membersWithRole.pageInfo.hasNextPage

      for (const member of membersObj) {
        if (hasNextPageMember) {
          paginationMember = getMemberResult.organization.membersWithRole.pageInfo.endCursor
        } else {
          paginationMember = null
        }

        const userName = member.login
        const activeContrib = member.contributionsCollection.hasAnyContributions
        const commitContrib = member.contributionsCollection.totalCommitContributions
        const issueContrib = member.contributionsCollection.totalIssueContributions
        const prContrib = member.contributionsCollection.totalPullRequestContributions
        const prreviewContrib = member.contributionsCollection.totalPullRequestReviewContributions
        const repoIssueContrib = member.contributionsCollection.totalRepositoriesWithContributedIssues
        const repoCommitContrib = member.contributionsCollection.totalRepositoriesWithContributedCommits
        const repoPullRequestContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequests
        const repoPullRequestReviewContrib = member.contributionsCollection.totalRepositoriesWithContributedPullRequestReviews

        // Push all member contributions from query to array
        contribArray.push({ userName, activeContrib, commitContrib, issueContrib, prContrib, prreviewContrib, repoIssueContrib, repoCommitContrib, repoPullRequestContrib, repoPullRequestReviewContrib })
        console.log(userName)
      }
    } while (hasNextPageMember)
  } catch (error) {
    core.setFailed(error.message)
  }
}

;(async () => {
  try {
    // Find orgid for organization
    const query = `query ($org: String!) {
      organization(login: $org) {
        id
      }
    }`
    getOrgIdResult = await octokit.graphql({
      query,
      org
    })

    // Set amount of days to query
    const days = core.getInput('days', { required: false }) || '30'
    const orgid = getOrgIdResult.organization.id
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)

    // Take time, orgid parameters and init array to get all member contributions
    const contribArray = []
    console.log(`Retrieving the last ${days} days of member contribution data for the ${org} organization:`)
    await getMemberActivity(orgid, from, to, contribArray)

    // Set sorting settings and add header to array
    const columns = {
      userName: 'Member',
      activeContrib: `Has active contributions (<${days} days)`,
      commitContrib: `Commits created (<${days} days)`,
      issueContrib: `Issues opened (<${days} days)`,
      prContrib: `PRs opened (<${days} days)`,
      prreviewContrib: `PR reviews (<${days} days)`,
      repoIssueContrib: `Issue spread (<${days} days)`,
      repoCommitContrib: `Commit spread (<${days} days)`,
      repoPullRequestContrib: `PR spread (<${days} days)`,
      repoPullRequestReviewContrib: `PR review spread (<${days} days)`
    }
    const sortColumn = core.getInput('sort', { required: false }) || 'commitContrib'
    const sortArray = arraySort(contribArray, sortColumn, { reverse: true })
    sortArray.unshift(columns)

    // Convert array to csv
    const csv = stringify(sortArray, {
      cast: {
        boolean: function (value) {
          return value ? 'TRUE' : 'FALSE'
        }
      }
    })

    // Prepare path/filename, repo/org context and commit name/email variables
    const reportPath = `reports/${org}-${new Date().toISOString().substring(0, 19) + 'Z'}-${days}days.csv`
    const committerName = core.getInput('committer-name', { required: false }) || 'github-actions'
    const committerEmail = core.getInput('committer-email', { required: false }) || 'github-actions@github.com'
    const { owner, repo } = github.context.repo

    // Push csv to repo
    const opts = {
      owner,
      repo,
      path: reportPath,
      message: `${new Date().toISOString().slice(0, 10)} Member contribution report`,
      content: Buffer.from(csv).toString('base64'),
      committer: {
        name: committerName,
        email: committerEmail
      }
    }

    console.log(`Pushing final CSV report to repository path: ${reportPath}`)

    await octokit.rest.repos.createOrUpdateFileContents(opts)
  } catch (error) {
    core.setFailed(error.message)
  }
})()
