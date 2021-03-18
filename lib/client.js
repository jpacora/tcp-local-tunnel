const net = require('net');
const EventEmitter = require("events")

class Client extends EventEmitter {

  constructor(remoteServer, localServer, tunnels=10) {
    super()
    //Bind methods
    this.connectTunnel = this.connectTunnel.bind(this)
    //Properties
    this.remoteServer = remoteServer
    this.localServer = localServer
    this.Tunnels = []
    //Spin
    while(tunnels--) {
      this.connectTunnel()
    }
  }

  connectTunnel() {
    ///
    const self = this
    const { remoteServer, localServer, Tunnels } = this

    const local = net.connect({
      host: localServer.host,
      port: localServer.port
    })

    local.setKeepAlive(true)

    local.on('error', err => {
      console.log('local error', err)
    });

    const remote = net.connect({
      host: remoteServer.host,
      port: remoteServer.port
    });

    remote.setKeepAlive(true)

    remote.on('error', (err) => {
      console.log(Date.now(), 'Remote connection error')
      remote.end()
      local.end()
      setTimeout(self.connectTunnel, 1000)
    });

    remote.once('connect', () => {
      console.log('connected to remote')
    });

    remote.on('end', data => {
      local.end();
      this.connectTunnel()
    });
  
    local.on('end', (data) => {
      remote.end();
      this.connectTunnel()
    });

    remote.pipe(local).pipe(remote)

  }

}

module.exports = Client