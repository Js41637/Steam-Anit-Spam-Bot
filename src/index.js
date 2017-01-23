import cheerio from 'cheerio'
import request from 'request'
import async from 'async'
import SteamUser from './steam'
import { username, password, groups } from "../config.json"
import spamFilter from '../spamFilter'

const client = new SteamUser(username, password)

var SESSIONID = undefined
var COOKIES = undefined
const commentCount = 100 // how many comments to load
const endpoints = {
  comments: `https://steamcommunity.com/comment/Clan/render/%i/-1?count=${commentCount}`,
  delete: 'https://steamcommunity.com/comment/Clan/delete/%i/-1',
  ban: 'https://steamcommunity.com/gid/%i/banuser/'
}

const getURL = (type, id) => endpoints[type].replace('%i', id)

// This event gets fired every 2 hours to make sure our sessionID is still valid so it also fires the spam check
client.on('sessionID', ({ sessionID, cookies }) => {
  if (!sessionID) return console.error("No sessionID?")
  SESSIONID = sessionID
  COOKIES = cookies
  checkGroupsCommentsForSpam()
})

// Goes through each group loading comments and checking for spammmmmm
function checkGroupsCommentsForSpam() {
  async.each(groups, (group, cb) => {
    request.get(getURL('comments', group.id), { json: true }, (err, resp, body) => {
      if (!body || !body.comments_html) return console.error("Error: Invalid body")
      var $ = cheerio.load(body.comments_html)
      var usersToBan = []
      var comments = $('.commentthread_comment')
      comments.each((index, comment) => {
        comment = $(comment)
        let commentID = comment.attr('id').replace('comment_', '')
        let userID = comment.find('.commentthread_author_link').attr('data-miniprofile')
        let text = comment.find('.commentthread_comment_text').text().trim()
        if (spamFilter.some(word => text.includes(word)) && !usersToBan.includes(userID)) {
          usersToBan.push(userID)
          banUser(userID, group.id, commentID)
        }
      })
      console.log(`Found ${usersToBan.length} users to ban in group: ${group.name}`, usersToBan)
      cb()
    })
  })
}

// Adds a user to the queue to be banned
function banUser(userID, groupID, commentID) {
  banQueue.push({ userID, groupID, commentID })
}

// Bans 1 user at a time every 5 seconds
const banQueue = async.queue(({ userID, groupID, commentID }, cb) => {
  var options = {
    method: 'POST',
    url: getURL('ban', groupID),
    qs: { ajax: '1' },
    headers: { cookie: COOKIES.join(';'), 'content-type': 'application/x-www-form-urlencoded' },
    form: {
      gidforum: '-1',
      gidtopic: '-1',
      gidcomment: commentID,
      target: userID,
      sessionid: SESSIONID,
      ban_length: '0',
      ban_reason: 'Spam Detection',
      deletecomments: 'on'
    }
  }

  request(options, (err, resp) => {
    if (!err) {
      switch (resp.statusCode) {
        case 200:
          return console.log("Succesfully banned user", userID)
        case 400:
          return console.log("Error, user already banned", userID)
        case 403:
          return console.error("Error banning user, invalid sessionID")
        case 404:
          return console.error("Error banning using, incorrect url?")
        default:
          return console.log('Got unknown status code'. resp.statusCode)
      }
    } else {
      console.error("Error banning user", userID)
    }
  })

  setTimeout(() => {
    cb()
  }, 1000); // Ban user every 1 second incase of limits
}, 1)
