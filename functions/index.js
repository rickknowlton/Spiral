
'use strict';

const functions = require('firebase-functions');
const rp = require('request-promise');
const crypto = require('crypto');
const secureCompare = require('secure-compare');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });
const fs = require("fs");
const path = require('path');
const emailUsername = functions.config().email.username;
const emailPassword = functions.config().email.password;
const emailHost = functions.config().email.host;
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  host: emailHost,
  port: 465,
  secure: true,
  auth: {
  user: emailUsername,
  pass: emailPassword
  }  
  
  // service: 'gmail',
    // auth: {
    //     user: gmailEmail,
    //     pass: gmailPassword
    // }
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
  const payload = snap.val()
  console.log(payload.name);
  const response = await rp({
    uri: WEBHOOK_URL,
    method: 'POST',
    json: true,
    body: {	"text": "🔥 Comin' in hot! You've got a new message from the contact form!",
    "attachments": [
        {
            "fallback": "Contact Form Alert 📧",
            "color": "#10E7E0",			
            "title": "📧 Message from " + payload.name,
            "text": payload.message + "\n\n Email: " + payload.email + "\nPhone: " + payload.phone,
            "mrkdwn_in": [
                "text",
                "pretext"
            ]
        }
    ]
        },
  resolveWithFullResponse: true,
  });
  if (response.statusCode >= 400) {
    throw new Error(`HTTP Error: ${response.statusCode}`);
  }
  console.log('SUCCESS! Posted', snap.ref);
});



// Outbound Mailer

//Add Outbound Email Config/Templating

// exports.mailFxn = functions.database
//   .ref("/hooks/{hookId}")
//   .onCreate((snapshot, context) => {
//     // Grab the current value of what was written to the Realtime Database.
//     const makers = snapshot.val();
//     console.log(makers.name);
//     console.log(makers.email);

//     const makerID = context.params.id;



//     //firebase functions:config:set gmail.email=myemailID@gmail.com gmail.password=Mypassword
//     //To set email and password

//     //To view the set email and pass firebase functions:config:get

//     sendEmail(makers, makerID);

//     return null;
//   });

// function sendEmail(makers) {

//   //http://www.google.com/accounts/DisplayUnlockCaptcha
//   //https://myaccount.google.com/lesssecureapps
//   //This link is important to enable accesses to google account

//   var UNIQUE_NAME = makers.name;
//   // var UNIQUE_ID = makerID;

//   var filePath = path.join(__dirname, 'templates/confirmation.html');

//   fs.readFile(filePath, { encoding: 'utf-8' }, function (err, data) {
//     data = data.toString();
//     data = data.replace(/##UNIQUE_NAME/g, UNIQUE_NAME);


//     var mailOptions = {
//       from: '"tiny machine." <rick@teamtinymachine.com>', // sender address 
//       to: makers.email, // list of receivers 
//       subject: '🤠 Well howdy there, pardner! ', // Subject line 
//       html: data // html body
//     };



//     try {
//       mailTransport.sendMail(mailOptions);
//     } catch (error) {
//       console.error('There was an error while sending the email:', error);

//       // errorEmails = functions.database.ref(`/emailError/${makerID}`).set({
//       //   email: makers.email
//       // })

//     }


//     return console.log(
//       `Sending mail to ${makers.name} with stamp ${makers.stamp}`
//     );
//   });
// }

// Inbound Mailer
exports.inbound = functions.database
  .ref("/hooks/{hookId}")
  .onCreate((snapshot, context) => {
    // Grab the current value of what was written to the Realtime Database.
    const contact = snapshot.val();
    console.log(contact.name);
    console.log(contact.email);

    const contactID = context.params.id;



    //firebase functions:config:set gmail.email=myemailID@gmail.com gmail.password=Mypassword
    //To set email and password

    //To view the set email and pass firebase functions:config:get

    sendEmail(contact, contactID);

    return null;
  });

function sendEmail(contact) {

  //http://www.google.com/accounts/DisplayUnlockCaptcha
  //https://myaccount.google.com/lesssecureapps
  //This link is important to enable accesses to google account

  var UNIQUE_NAME = contact.name;
  var UNIQUE_EMAIL = contact.email;
  var UNIQUE_PHONE = contact.phone;
  var UNIQUE_COMPANY = contact.company;
  var UNIQUE_MESSAGE = contact.message;

  // var UNIQUE_ID = makerID;

  var filePath = path.join(__dirname, 'templates/submission.html');

  fs.readFile(filePath, { encoding: 'utf-8' }, function (err, data) {
    data = data.toString();
    data = data.replace(/##UNIQUE_NAME/g, UNIQUE_NAME);
    data = data.replace(/##UNIQUE_EMAIL/g, UNIQUE_EMAIL);
    data = data.replace(/##UNIQUE_PHONE/g, UNIQUE_PHONE);
    data = data.replace(/##UNIQUE_COMPANY/g, UNIQUE_COMPANY);
    data = data.replace(/##UNIQUE_MESSAGE/g, UNIQUE_MESSAGE);


    var mailOptions = {
      to: '"tiny machine." <richard.d.knowlton@gmail.com>', // list of receivers 
      from: '"tiny machine." <hello@teamtinymachine.com>', // sender address 
      subject: '🚀 Incoming Form Submission from ' + contact.name + '!', // Subject line 
      html: data // html body
    };



    try {
      mailTransport.sendMail(mailOptions);
    } catch (error) {
      console.error('There was an error while sending the email:', error);

      // errorEmails = functions.database.ref(`/emailError/${makerID}`).set({
      //   email: makers.email
      // })

    }


    return console.log(
      `Sending mail to ${contact.name} with stamp ${contact.stamp}`
    );
  });
}

//To deploy firebase deploy --only functions:mailFxn

// v 1.2.2
// Slack is delivering text payload only - when I put snap.val() under body>text> it comes in as blank array
// I tested with request bin and got the full JSON object, so that data is coming thru fine.


// firebase functions:config:set email.host=premium56.web-hosting.com


