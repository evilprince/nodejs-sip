const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
var sip = require('sip');
var util = require('util');
var os = require('os');

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);


// sip register

// Initiating a call example. Note: we use bogus sdp, so no real rtp session will be established.

var dialogs = {};

function rstring() { return Math.floor(Math.random()*1e6).toString(); }


//starting stack

sip.start({}, function(rq) {
  console.log("----msg")
  if(rq.headers.to.params.tag) { // check if it's an in dialog request
    var id = [rq.headers['call-id'], rq.headers.to.params.tag, rq.headers.from.params.tag].join(':');
    if(dialogs[id])
      dialogs[id](rq);
    else
      sip.send(sip.makeResponse(rq, 481, "Call doesn't exists"));
  }
  else{
    sip.send(sip.makeResponse(rq, 405, 'Method not allowed'));
  }
});

sip.send({
    method: 'REGISTER',
    uri: 'sip:192.168.1.50:30045',
    headers: {
      to: {uri: 'sip:10005@iwf-domain'},
      from: {uri: 'sip:1005@iwf-domain', params: {tag: rstring()}},
      'call-id': rstring(),
      cseq: {method: 'REGISTER', seq: Math.floor(Math.random() * 1e5)},
      'content-type': 'application/sdp',
      contact: [{uri: 'sip:1005@iwf-domain'}]  // if your call doesnt get in-dialog request, maybe os.hostname() isn't resolving in your ip address
    },
    content: ''
  },
  function(rs) {
    if(rs.status >= 300) {
      console.log('call failed with status ' + rs.status);
    }
    else if(rs.status < 200) {
      console.log('call progress status ' + rs.status);
    }
    else {
      // yes we can get multiple 2xx response with different tags
      console.log('call answered with tag ' + rs.headers.to.params.tag);
    }
  });



// // Making the call

// sip.send({
//     method: 'INVITE',
//     uri: 'sip:192.168.1.50:30045',
//     headers: {
//       to: {uri: 'sip:10005@192.168.1.50:55029'},
//       from: {uri: 'sip:5001@192.168.1.15', params: {tag: rstring()}},
//       'call-id': rstring(),
//       cseq: {method: 'INVITE', seq: Math.floor(Math.random() * 1e5)},
//       'content-type': 'application/sdp',
//       contact: [{uri: 'sip:5001@192.168.1.15:5060'}]  // if your call doesnt get in-dialog request, maybe os.hostname() isn't resolving in your ip address
//     },
//     content:
//       'v=0\r\n'+
//       'o=- 13374 13374 IN IP4 172.16.2.2\r\n'+
//       's=-\r\n'+
//       'c=IN IP4 172.16.2.2\r\n'+
//       't=0 0\r\n'+
//       'm=audio 16424 RTP/AVP 0 8 101\r\n'+
//       'a=rtpmap:0 PCMU/8000\r\n'+
//       'a=rtpmap:8 PCMA/8000\r\n'+
//       'a=rtpmap:101 telephone-event/8000\r\n'+
//       'a=fmtp:101 0-15\r\n'+
//       'a=ptime:30\r\n'+
//       'a=sendrecv\r\n'
//   },
//   function(rs) {
//     if(rs.status >= 300) {
//       console.log('call failed with status ' + rs.status);
//     }
//     else if(rs.status < 200) {
//       console.log('call progress status ' + rs.status);
//     }
//     else {
//       // yes we can get multiple 2xx response with different tags
//       console.log('call answered with tag ' + rs.headers.to.params.tag);

      // // sending ACK
      // sip.send({
      //   method: 'ACK',
      //   uri: rs.headers.contact[0].uri,
      //   headers: {
      //     to: rs.headers.to,
      //     from: rs.headers.from,
      //     'call-id': rs.headers['call-id'],
      //     cseq: {method: 'ACK', seq: rs.headers.cseq.seq},
      //     via: []
      //   }
      // });

      // var id = [rs.headers['call-id'], rs.headers.from.params.tag, rs.headers.to.params.tag].join(':');

      // // registring our 'dialog' which is just function to process in-dialog requests
      // if(!dialogs[id]) {
      //   dialogs[id] = function(rq) {
      //     if(rq.method === 'BYE') {
      //       console.log('call received bye');

            // delete dialogs[id];

  //           sip.send(sip.makeResponse(rq, 200, 'Ok'));
  //         }
  //         else {
  //           sip.send(sip.makeResponse(rq, 405, 'Method not allowed'));
  //         }
  //       }
  //     }
  //   }
  // });




module.exports = app;
