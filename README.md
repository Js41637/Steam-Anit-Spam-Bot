## Steam-Anti-Spam-Bot
Monitors a Groups comment section deleting and banning users it detects spamming.


#### Usage
`npm i` Install package deps  
`npm run dev` Run the bot in dev mode
#### Config
```
{
  "username": "",
  "password": "",
  "groups": [
    {
      "name": ""
      "id": ""
    }
  ]
}
```
Username & Password are required for the bot to login to Steam, the bot does not support SteamGuard so it has to be disabled otherwise it will not work.  
Name of group can be anything, it's just an easy identifier, ID is the actual ID of the group, can be a bit hard to find but you can inspect the Join Group Chat button on the website, it contains a link that has the ID in it.
