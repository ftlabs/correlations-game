const debug = require("debug")("bin:middleware:basic-auth");
const basicAuth = require("basic-auth");
const verifier = require("alexa-verifier");
const IS_TEST_MODE = process.env.hasOwnProperty("TEST_MODE")
  ? process.env.TEST_MODE == "true"
    ? true
    : false
  : false;

module.exports = (req, res, next) => {
  const errResponse = {
    status: "err",
    message: "Invalid basic authorisation credentials passed"
  };
  const creds = basicAuth(req);
  debug(creds);

  if (IS_TEST_MODE) {
    return next();
  }

  //First check for amazon header params, if they exists, check the certificate and verify the request.
  if (req.get("signaturecertchainurl") && req.get("signature")) {
    verifier(
      req.get("signaturecertchainurl"),
      req.get("signature"),
      req.rawBody.toString(),
      err => {
        if (err) {
          res.status(400).json(errResponse);
        } else {
          next();
        }
      }
    );
  }
  //Else check for Basic Auth
  else if (!creds) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="example"');
    res.end();
  } else if (
    creds.name === process.env.BASIC_AUTH_USERNAME &&
    creds.pass === process.env.BASIC_AUTH_PASSWORD
  ) {
    next();
  } else {
    res.status(400).json(errResponse);
  }
};
