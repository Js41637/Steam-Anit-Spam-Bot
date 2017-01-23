import cheerio from 'cheerio'
import needle from 'needle'
import async from 'async'
import SteamUser from './steam'
import { username, password, groups } from "../config.json"
import spamFilter from '../spamFilter'

const endpoints = {
  comments: 'https://steamcommunity.com/comment/Clan/render/%i/-1?count=2',
  delete: 'https://steamcommunity.com/comment/Clan/delete/%i/-1',
  ban: 'https://steamcommunity.com/gid/%i/banuser/?ajax=1'
}
var sessionid = undefined;
var client = new SteamUser(username, password)

client.on('sessionID', session => {
  if (!session) return console.error("No sessionID?")
  sessionid = session
  checkGroupsCommentsForSpam()
})

function checkGroupsCommentsForSpam() {
  async.each(groups, (group, cb) => {
    makeRequest('comments', group.id).then(data => {
      if (!data || !data.comments_html) return console.error("Error: Invalid data")
      var $ = cheerio.load(data.comments_html)
      var usersToBan = []
      var comments = $('.commentthread_comment')
      comments.each((index, comment) => {
        comment = $(comment)
        let userID = comment.find('.commentthread_author_link').attr('data-miniprofile')
        let text = comment.find('.commentthread_comment_text').text().trim()
        if (spamFilter.some(word => text.includes(word)) && !usersToBan.includes(userID)) {
          usersToBan.push(userID)
          banUser(userID, group.id)
        }
      })
      console.log(`Found ${usersToBan.length} users to ban in group: ${group.name}`, usersToBan)
      cb()
    }).catch(err => {
      console.error("Error fetching comment data", err)
      cb()
    })
  })
}

export function banUser(userID, groupID) {
  banQueue.push({ userID, groupID })
}

const banQueue = async.queue(({ userID, groupID }, cb) => {
  makeRequest('ban', groupID, {
    gidforum: -1,
    gidtopic: -1,
    target: userID,
    ban_length: 0,
    ban_reason: 'Spam Detection',
    deletecomments: 'on'
  }).then(resp => {
    if (resp.success) {
      if (resp.success == 1) console.info("Succesfully banned user")
      else console.info("Didn't get success:1 response, ban probably failed!")
    } else console.info("Got response but no success response!")
    setTimeout(() => {
      cb()
    }, 5000); // Ban user every 5 seconds incase of limits
  }).catch(err => {
    console.error("Error banning user:", err)
  })
}, 1)

function makeRequest(type, id, options = {}) {
  return new Promise((resolve, reject) => {
    needle.post(endpoints[type].replace('%i', id), Object.assign({}, { sessionid }, options), (err, resp, body) => {
      if (err || !body || !body.success) return reject(err || body)
      return resolve(body)
    })
  })
}
