import SteamUser from 'steam-user'

export default class Steam extends SteamUser {
  constructor(accountName, password) {
    super() // SUPER~~~~

    this.on('loggedOn', () => {
      console.log("Logged into Steam as " + this.steamID.getSteam3RenderedID())
      this.setPersona(SteamUser.EPersonaState.Online)
      this.gamesPlayed([753, "Steam"]) // Idle in steam app for lolz
    })

    this.on('webSession', (sessionID, cookies) => {
      this.emit('sessionID', {sessionID, cookies})
    })

    this.on('error', e => {
      console.error("SteamUser Error:", e)
    })

    this.logOn({ accountName, password }) // :rocket:

    setInterval(() => {
      this.webLogOn()
    }, 1000 * 60 * 60 * 1); // Update sessionID every 1 hour
  }
}
