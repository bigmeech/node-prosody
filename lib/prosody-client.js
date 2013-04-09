var http = require('http');

var debug = false && console.log;

function jid_split(str) {
  var split = str.split('@');
  return { username: split[0], hostname: split[1] };
};

function auth(user, password) {
  return 'Basic ' + new Buffer(user + ':' + password).toString('base64');
};

function Client(options) {
  var self = this;

  if (!options.jid || !options.password) {
    throw new Error("Missing username or password");
  };

  this._jid = options.jid;
  this._password = options.password;
  this._auth = auth(this._jid, this._password);
  this._user = jid_split(this._jid);
  this._port = options.port || 5280;
  this._host = options.host || this._user.hostname;
  this._timeout = options.timeout || 5000;
  this._base_path = options.base_path || '/admin_rest';
};

Client.prototype = Object.create(process.EventEmitter.prototype);

Client.prototype._request = function(method, path, body, callback) {
  var callback = callback || function(){};

  if (arguments.length === 3) {
    callback = body;
    body = null;
  };

  var options = {
    host: this._host,
    port: this._port,
    method: method.toUpperCase(),
    path: escape(this._base_path + path),
    headers: {
      'Authorization': this._auth,
      'Connection': 'keep-alive'
    }
  };

  if (body) {
    body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
  };

  if (debug) {
    debug('>>', JSON.stringify(options, null, 2));
    debug('>>', JSON.stringify(body));
  };

  var request = http.request(options, function(response) {
    var body = '';
    response.on('error', callback);
    response.on('data', function(data) { body += data; });
    response.on('end', function() {
      try { body = JSON.parse(body).result; } 
      catch(exception) { };
      if (debug) {
        debug('<<', response.statusCode, JSON.stringify(body, null, 2));
      };
      callback(null, response, body);
    });
  });

  if (this._timeout) {
    request.setTimeout(this._timeout, function() {
      callback(new Error('Timeout exceeded'));
    });
  };

  request.on('error', callback);
  request.end(body || null);
};

Client.prototype.ping = function(callback) {
  return this._request('GET', '/ping', callback);
};

Client.prototype.sendMessage =
Client.prototype.message = function(target, message, callback) {
  var body = { message: message };
  var route = '/message/' + jid_split(target).username;
  return this._request('POST', route, body, callback);
};

Client.prototype.sendMulticast =
Client.prototype.multicast = function(targets, callback) {
  var body = { recipients: targets };
  return this._request('POST', '/message', body, callback);
};

Client.prototype.sendBroadcast =
Client.prototype.broadcast = function(message, callback) {
  var body = { message: message };
  return this._request('POST', '/broadcast', body, callback);
};

Client.prototype.users = 
Client.prototype.getUsers = function(callback) {
  return this._request('GET', '/users', callback);
};

Client.prototype.usersCount = 
Client.prototype.getUsersCount = function(callback) {
  return this._request('GET', '/users/count', callback);
};

Client.prototype.getUser = function(user, callback) {
  return this._request('GET', '/user/' + user, callback);
};

Client.prototype.isConnected = function(user, callback) {
  return this._request('GET', '/user/' + user + '/connected', callback);
};

Client.prototype.addUser = function(user, password, callback) {
  var body = { password: password };
  return this._request('POST', '/user/' + user, body, callback);
};

Client.prototype.removeUser = function(user, callback) {
  return this._request('DELETE', '/user/' + user, callback);
};

Client.prototype.setPassword = function(user, password, callback) {
  var body = { password: password };
  return this._request('PATCH', '/user/' + user + '/password', body, callback);
};

Client.prototype.modules = 
Client.prototype.getModules = function(callback) {
  return this._request('GET', '/modules', callback);
};

Client.prototype.modulesCount =
Client.prototype.getModulesCount = function(callback) {
  return this._request('GET', '/modules/count', callback);
};

Client.prototype.moduleLoaded = 
Client.prototype.getModule = function(modulename, callback) {
  return this._request('GET', '/module/' + modulename, callback);
};

Client.prototype.loadModule = function(modulename, callback) {
  return this._request('PUT', '/module/' + modulename, callback);
};

Client.prototype.unloadModule = function(modulename, callback) {
  return this._request('DELETE', '/module/' + modulename, callback);
};

Client.prototype.getWhitelist = function(callback) {
  return this._request('GET', '/whitelist', callback);
};

Client.prototype.addToWhitelist = function(ip, callback) {
  return this._request('PUT', '/whitelist/' + ip, callback);
};

Client.prototype.removeFromWhitelist = function(ip, callback) {
  return this._request('DELETE', '/whitelist/' + ip, callback);
};

module.exports = Client;
