const nodemailer = require('nodemailer')
const { google } = require('googleapis')
const { OAuth2 } = google.auth;
const OAUTH_PLAYGROUND = 'https://developers.google.com/oauthplayground'

const {
    MAILING_SERVICE_CLIENT_ID,
    MAILING_SERVICE_CLIENT_SECRET,
    MAILING_SERVICE_REFRESH_TOKEN,
    SENDER_EMAIL_ADDRESS
} = process.env

const oauth2Client = new OAuth2(
    MAILING_SERVICE_CLIENT_ID,
    MAILING_SERVICE_CLIENT_SECRET,
    MAILING_SERVICE_REFRESH_TOKEN,
    OAUTH_PLAYGROUND
)

// send mail
const sendEmail = (to, url, txt) => {
    oauth2Client.setCredentials({
        refresh_token: MAILING_SERVICE_REFRESH_TOKEN
    })

    const accessToken = oauth2Client.getAccessToken()
    const smtpTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: SENDER_EMAIL_ADDRESS,
            clientId: MAILING_SERVICE_CLIENT_ID,
            clientSecret: MAILING_SERVICE_CLIENT_SECRET,
            refreshToken: MAILING_SERVICE_REFRESH_TOKEN,
            accessToken
        }
    })

    const mailOptions = {
        from: SENDER_EMAIL_ADDRESS,
        to: to,
        subject: "Mamazee Wears",
        html:
            `
        <div style="max-width: 700px;font-size: 110%;margin:0 auto;">
        <div style="background:#38023B;height:80px;padding:10px;font-family:cursive;text-shadow:2px 2px crimson;">
           <h2 style="text-align: center; text-transform: uppercase;color:#fff;">MAMAZEE WEARS</h2>
        </div>
        
        <div style="padding:40px 15px;">
            <p style="font-family:monospace;text-align:center">Thanks! for registering an account with mamazee wears, Please confirm that you want to use this as your mamazee account email address, Once it is done you will be able to start buying and enjoying our predefined services</p>
        
      
          <div style="text-align:center;margin-top:60px; margin-bottom:60px;">
            <a href=${url}>
            <button style="background:red;max-width:500px;padding:10px;border:none;outline:none;color:#fff;font-weight:bold;cursor:pointer">${txt}</button>
          </a>
          </div>
      
        </div>
        <hr>
        <p style="text-align:center;font-family:monospace;">If you did not enter this email address when signing up for mamazee services, kindly disregard this message. Thanks!</p>
                  </div>

        `
    }

    smtpTransport.sendMail(mailOptions, (err, infor) => {
        if (err) return err;
        return infor
    })
}

module.exports = sendEmail