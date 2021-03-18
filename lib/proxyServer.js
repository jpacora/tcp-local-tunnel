const net = require('net');
const crypto = require('crypto');
const EventEmitter = require("events")

const pipeSockets = ({ client, tunnel, encKey = null, encIv = null }) => {
  console.log('piping');

  if (encKey && encIv) {
    // Transport encryption enabled
    const cipher = crypto.createCipheriv('aes-256-ctr', encKey, encIv);
    const decipher = crypto.createDecipheriv('aes-256-ctr', encKey, encIv);

    cipher.on('data', data => console.log('DATA ENCRYPTED: ', data.length))
    client.pipe(cipher).pipe(tunnel).pipe(decipher).pipe(client);
  } else {
    // Transport encryption disabled
    client.pipe(tunnel).pipe(client);
  }
};

class ProxyServer extends EventEmitter {

  constructor(config) {
    super()
    //Bind methods
    this.handleProxyConnection = this.handleProxyConnection.bind(this)
    this.handleTunnelConnection = this.handleTunnelConnection.bind(this)
    this.spinServer = this.spinServer.bind(this)
    this.disconnectClients = this.disconnectClients.bind(this)
    this.stop = this.stop.bind(this)
    this.onHasTunnel = this.onHasTunnel.bind(this)
    //Vars
    this.config = config
    this.ProxyServer = net.createServer(this.handleProxyConnection)
    this.TunnelServer = net.createServer(this.handleTunnelConnection)
    this.ProxyClients = []
    this.TunnelClients = []
    this.tunnels = []
    this.waitingClients = []
    //Event Handlers
    this.ProxyServer.on('error', this.handleError)
    this.TunnelServer.on('error', this.handleError)
    //
    this.spinServer()
  }

  hasTunnel() {
    return this.TunnelClients.length > 0
  }

  onHasTunnel() {
    //Emit the event only once
    if(this.tunnels.length === 0) {
      this.emit("hasTunnel")
    }
  }

  handleError(err) {
    console.log("[SocketError]", err)
  }

  handleProxyConnection(client) {
    let { waitingClients, tunnels, config, ProxyClients } = this

    ProxyClients.push(client)

    client.on('error', this.handleError)

    client.on('close', () => {
      const clientIndex = ProxyClients.indexOf(client)
      ProxyClients.splice(clientIndex, 1)
    })

    client.setKeepAlive(true)
    if (tunnels.length) {
      pipeSockets({ client, tunnel: tunnels.shift(), encKey: config.encKey, encIv: config.encIv })
    } else {
      waitingClients.push(client)
    }
    //deleteAfterTimeout(client);
  }

  handleTunnelConnection(tunnel) {

    let { waitingClients, tunnels, config, TunnelClients } = this

    tunnel.on('error', this.handleError)

    tunnel.on('close', () => {
      const clientIndex = TunnelClients.indexOf(tunnel)
      TunnelClients.splice(clientIndex, 1)
    })

    this.onHasTunnel()

    TunnelClients.push(tunnel)

    console.log('has tunnel')
    
    tunnel.setKeepAlive(true, 2000)

    if (this.waitingClients.length) {
      pipeSockets({ client: waitingClients.shift(), tunnel, encKey: config.encKey, encIv: config.encIv });
    } else {
      tunnel.on('data', data => {
        console.log('tunnel received data', data.toString().length);
      });

      tunnel.on('end', data => {
        console.log('tunnel end');
      });

      tunnel.on('error', err => {
        console.log(Date.now(), 'tunnel connection error', err);
      });

      tunnel.on('close', data => {
        console.log('tunnel close');
        console.log('pre filter', tunnels.length);
        tunnels = tunnels.filter(_tunnel => _tunnel != tunnel);
        console.log('post flter', tunnels.length);
      });

      tunnels.push(tunnel);
    }
  }

  spinServer() {
    let { config } = this

    this.ProxyServer.listen(config.proxyPort, '0.0.0.0', () => {    
        console.log('[ProxyServer] Server listening to %j', this.ProxyServer.address())
    })

    this.TunnelServer.listen(config.tunnelPort, '0.0.0.0', () => {    
      console.log('[TunnelServer] Server listening to %j', this.TunnelServer.address())
    })
  }

  disconnectClients() {
    //Disconnect proxy-clients
    this.ProxyClients.forEach(Client => {
        Client.destroy()
    })
    //Disconnect tunnel-clients
    this.TunnelClients.forEach(Client => {
      Client.destroy()
    })
  }

  stop() {
    this.disconnectClients()
    this.ProxyServer.close()
    this.TunnelServer.close()
  }

}

module.exports = ProxyServer;
