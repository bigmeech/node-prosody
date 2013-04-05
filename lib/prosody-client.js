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

  this['user'] = {
    get: self.getUser,
    add: self.addUser,
    remove: self.removeUser
  };

  this['module'] = {
    get: self.getModule,
    load: self.loadModule,
    unload: self.unloadModule
  };

  this['whitelist'] = {
    get: self.getWhitelist,
    add: self.addToWhitelist,
    remove: self.removeFromWhitelist
  };

  ([]).concat(this['user'], this['module'], this['whitelist'])
  .forEach(function(wrap) {
    Object.keys(wrap).forEach(function(fn) {
      wrap[fn] = wrap[fn].bind(self);
    });
  });
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
Client.prototype.message = function(target, message, from, callback) {
  if (typeof from === 'function') {
    callback = from;
    from = null;
  };
  var body = { message: message };
  var dest = jid_split(target);
  if (typeof from === 'string') body.from = from;
  if (dest.hostname) body.host = dest.hostname;
  return this._request('POST', '/message/' + dest.username, body, callback);
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

Client.prototype.getUser = function(user, callback) {
  return this._request('GET', '/user/' + user, callback);
};

Client.prototype.getConnected = function(user, callback) {
  return this._request('GET', '/user_connected/' + user, callback);
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
