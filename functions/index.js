
'use strict';

const functions = require('firebase-functions');
const rp = require('request-promise');
const crypto = require('crypto');
const secureCompare = require('secure-compare');
const nodemailer = require('nodemailer');


const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});


/**
 * Webhook that will be called each time there is a new GitHub commit and will post a message to
 * Slack.
 */
exports.githubWebhook = functions.https.onRequest(async (req, res) => {
  const cipher = 'sha1';
  const signature = req.headers['x-hub-signature'];

  // TODO: Configure the `github.secret` Google Cloud environment variables.
  const hmac = crypto.createHmac(cipher, functions.config().github.secret)
      .update(req.rawBody)
      .digest('hex');
  const expectedSignature = `${cipher}=${hmac}`;

  // Check that the body of the request has been signed with the GitHub Secret.
  if (!secureCompare(signature, expectedSignature)) {
    console.error('x-hub-signature', signature, 'did not match', expectedSignature);
    return res.status(403).send('Your x-hub-signature\'s bad and you should feel bad!');
  }
  
  try {
    await postToSlack(req.body.compare, req.body.commits.length, req.body.repository);
    return res.end();
  } catch(error) {
    console.error(error);
    return res.status(500).send('Something went wrong while posting the message to Slack.');
  }
});

/**
 * Post a message to Slack about the new GitHub commit.
 */
function postToSlack(url, commits, repo) {
  return rp({
    method: 'POST',
    // TODO: Configure the `slack.webhook_url` Google Cloud environment variables.
    uri: functions.config().slack.webhook_url,
    body: {
      text: `<${url}|${commits} new commit${commits > 1 ? 's' : ''}> pushed to <${repo.url}|${repo.full_name}>.`,
    },
    json: true,
  });
}


// Contact Form to Slack

// This is the URL that we will callback and send the content of the updated data node.
// As an example we're using a Request Bin from http://requestb.in
// TODO: Make sure you create your own Request Bin and change this URL to try this sample.
const WEBHOOK_URL = 'https://hooks.slack.com/services/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';

// Reads the content of the node that triggered the function and sends it to the registered Webhook
// URL.
exports.webhook = functions.database.ref('/hooks/{hookId}').onCreate(async (snap) => {
  const response = await rp({
    uri: WEBHOOK_URL,
    method: 'POST',
    json: true,
    body: { 
        text: snap.val()
    },
    resolveWithFullResponse: true,
  });
  if (response.statusCode >= 400) {
    throw new Error(`HTTP Error: ${response.statusCode}`);
  }
  console.log('SUCCESS! Posted', snap.ref);
});

// v 1.2.2
// Slack is delivering text payload only - when I put snap.val() under body>text> it comes in as blank array
// I tested with request bin and got the full JSON object, so that data is coming thru fine.