const net = require('net');
const EventEmitter = require("events")

class Client extends EventEmitter {

  constructor(remoteServer, localServer, tunnels=10, maxRetries=15) {
    super()
    //Bind methods
    this.connectTunnel = this.connectTunnel.bind(this)
    this.kill = this.kill.bind(this)
    //Properties
    this.remoteServer = remoteServer
    this.localServer = localServer
    this.Tunnels = []
    this.maxRetries = maxRetries
    this.errors = []
    this.collapse = []
    //Spin
    while(tunnels--) {
      this.connectTunnel()
    }
  }

  connectTunnel() {
    ///
    const self = this
    const { remoteServer, localServer, Tunnels, maxRetries, errors, collapse } = this


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
      if(maxRetries === errors.length) {

        if(collapse.length > (maxRetries)) {
          self.kill()
        }

        collapse.push(1)
        
      } else {
        errors.push(err)
        console.log(Date.now(), 'Remote connection error')
        remote.destroy()
        local.destroy()
        setTimeout(self.connectTunnel, 1000)
      }
      
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

    //Pipe connection
    remote.pipe(local).pipe(remote)

    //Add to the array
    Tunnels.push({
      local,
      remote
    })

  }

  kill() {
    this.isKilled = true
    //Kille each connection
    this.Tunnels.forEach(({ local, remote }) => {
      local.destroy()
      remote.destroy()
    })


    this.emit('killed')
  }

}

module.exports = Client