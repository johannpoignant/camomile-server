/*
The MIT License (MIT)

Copyright (c) 2013-2014 CNRS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var express = require('express');
var http = require('http');
var cors = require('cors');
var app = express();

//var bcrypt = require('bcrypt');

var program = require('commander');

var mongoose = require('mongoose');
var MongoStore = require('connect-mongo')(express);

var userAPI = require('./controllers/UserAPI');
var User = require('./models/User');
var routes = require('./routes/routes');
var Session = require('./controllers/Session');


program
    .option('--port <port>', 'Local port to listen to (default: 3000)', parseInt)
    .option('--mongodb-host <host>', 'MongoDB host (default: localhost)')
    .option('--mongodb-port <port>', 'MongoDB port (default: 27017)', parseInt)
    .option('--mongodb-name <dbname>', 'MongoDB database name (default: camomile)')
    .option('--root-password <dbname>', 'Change/set root password')
    .option('--media <dir>', 'Path to media root directory')
    .parse(process.argv);

var port = program.port || process.env.PORT || 3000;
var mongodb_host = program.mongodbHost || process.env.MONGO_HOST || process.env.MONGODB_PORT_27017_TCP_ADDR || 'localhost';
var mongodb_port = program.mongodbPort || process.env.MONGO_PORT || process.env.MONGODB_PORT_27017_TCP_PORT || 27017;
var mongodb_name = program.mongodbName || process.env.MONGO_NAME || 'camomile';
var root_password = program.rootPassword || process.env.ROOT_PASSWORD;
var media = program.media || process.env.MEDIA || '/media';

mongoose.connect('mongodb://' + mongodb_host + ':' + mongodb_port + '/' + mongodb_name);


var cors_options = {
  origin: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE'],
  allowedHeaders: ['X-CSRF-Token', 'X-Requested-With', 'Accept', 'Accept-Version', 'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'X-Api-Version'],
  credentials: true,
};

var sessionStore = new MongoStore({
    mongoose_connection: mongoose.connection,
    db: mongoose.connections[0].db,
    clear_interval: 60
  });

var session_options = {
    key : "camomile.sid",
    secret: "123camomile",
    cookie: {maxAge: 24 * 60 * 60 * 1000},  // sessions expire every day
    store: sessionStore
};

app.set('port', port);
app.set('media', media);
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(cors(cors_options));
app.use(express.cookieParser('your secret here'));
app.use(express.session(session_options));
app.use(app.router);

// handle CORS pre-flight requests
// (must be added before any other route)
app.options('*', cors(cors_options));

//start routes:
routes.initialize(app);

User.findOne({username: "root"}, function (error, user) {
  if (user || root_password) {

    if (!user) {
      user = new User({username: "root", role: "admin"});
    }

    // if (root_password) {
    //   bcrypt.genSalt(10, function(err, salt) {
    //       bcrypt.hash(root_password, salt, function(err, hash) {
    //           user.salt = salt;
    //           user.hash = hash;
    //           user.save(function (err, user) {
    //             if (err) {
    //               console.log('error when setting root password')
    //             } else {
    //               console.log('successfully set root password');
    //             }
    //           });
    //       });
    //   });
    // }

    if (root_password) {
      hash(root_password, function (error, new_salt, new_hash) {
        user.salt = new_salt;
        user.hash = new_hash;
        user.save(function (error, user) {

        });
      });
    }

    http.createServer(app).listen(app.get('port'), process.env.IP, function () {
      console.log('Express server listening on port ' + app.get('port'));
    });

  } else {
    console.log("root user does not exist and root password is not defined to create root user (add '--root-password' option)");
  }
});
