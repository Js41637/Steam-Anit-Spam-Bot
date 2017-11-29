import request from 'request'
import async from 'async'
import SteamUser from './steam'
import { username, password, groups } from "../config.json"
import spamFilter from '../spamFilter'

const client = new SteamUser(username, password)

var SESSIONID = undefined
var COOKIES = undefined
const endpoints = {
  comments: 'https://steamcommunity.com/groups/%i/discussions/0/',
  delete: 'https://steamcommunity.com/comment/Clan/delete/%i/-1',
  ban: 'https://steamcommunity.com/gid/%i/banuser/'
}

const NB_COMMENTS_TO_SKIP = 8

const getURL = (type, id) => endpoints[type].replace('%i', id)

// This event gets fired every 2 hours to make sure our sessionID is still valid so it also fires the spam check
client.on('sessionID', ({ sessionID, cookies }) => {
  if (!sessionID) return console.error("No sessionID?")
  SESSIONID = sessionID
  COOKIES = cookies
})

client.on('newComments', ()=>{

  checkGroupsCommentsForSpam()
})
// Goes through each group loading comments and checking for spammmmmm

const extractTopics = body =>
  body.split('<div class="forum_topic_name ">')
    .map((elem, i) => (i > NB_COMMENTS_TO_SKIP)
        && elem.split('</div>')[0].trim())
    .filter(x=>x);

const extractTopicOPs = body =>
  body.split('<div class="forum_topic_op">')
    .map((elem, i) => (i > NB_COMMENTS_TO_SKIP)
        && elem.split('</div>')[0].trim()).filter(x=>x);

const extractTopicURLs = body =>
  body.split('data-gidforumtopic="')
    .map((elem, i) => (i > NB_COMMENTS_TO_SKIP)
        && elem.split('" data-tooltip-content')[0].trim())
    .filter(x=>x);

const extractTopicTitle = body =>{
  const topic = body.split('<div class="topic">')[1]
  return topic && topic.split("</div>")[0]
}

const extractOPId = body => {
  const _id = body.split('forum_op_author " href="http://steamcommunity.com/profiles/')
  return _id[1] && _id[1].split('"')[0]
}

const checkGroupsCommentsForSpam = () => {

  async.each(groups, (group, cb) => {
    const commentsURL = getURL('comments', group.name)
    request.get(commentsURL, {}, (err, resp, body)=>{
      const topics = extractTopics(body);
      const topicsOPs = extractTopicOPs(body);
      const topicsURL = extractTopicURLs(body)
      topicsURL.forEach((topicURL) => {
        request.get(commentsURL + topicURL, {}, (err, resp, body_)=>{
          const topicTitle = extractTopicTitle(body_)
          console.log({
            URL: commentsURL + topicURL,
            topicTitle
          })
          if (spamFilter.some(word => topicTitle && topicTitle.includes(word))){
            console.log("^^^ SPAM DETECTED !!")
            const _id = extractOPId(body_)
            //userIDs.push(_id)
            if (_id){ // won t get an id on group moderators / admins
              banUser(_id, 4581246, topicURL)
            }
          }
        })
      })
      console.log(topics)
      console.log(topicsURL)
      console.log(topicsOPs)
    })
  cb()
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
