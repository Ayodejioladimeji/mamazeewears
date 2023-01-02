const Users = require('../models/userModel');
const Payments = require('../models/paymentModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendMail = require('./sendMail');
const passwordMail = require('./passwordMail');

const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const fetch = require('node-fetch');

const client = new OAuth2(process.env.MAILING_SERVICE_CLIENT_ID);

const { CLIENT_URL } = process.env;

const userCtrl = {
  // The section that registers the users
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ msg: 'Please fill in all fields' });

      if (!validateEmail(email))
        return res.status(400).json({ msg: 'Invalid email' });

      const user = await Users.findOne({ email });
      if (user)
        return res.status(400).json({ msg: 'The email already exists.' });

      if (password.length < 6)
        return res
          .status(400)
          .json({ msg: 'Password must at least 6 characters long.' });

      // Password Encryption
      const passwordHash = await bcrypt.hash(password, 12);

      const newUser = {
        name,
        email,
        password: passwordHash,
      };

      // Then create jsonwebtoken to authentication
      const activation_token = createActivationToken(newUser);

      const url = `${CLIENT_URL}/user/activate/${activation_token}`;
      sendMail(email, url, 'verify your email address');

      res.json({
        msg: 'Registration successful! Please check your email to activate your account',
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section that activates an email
  activateEmail: async (req, res) => {
    try {
      const { activation_token } = req.body;
      const user = jwt.verify(
        activation_token,
        process.env.ACTIVATION_TOKEN_SECRET
      );

      const { name, email, password } = user;

      const check = await Users.findOne({ email });
      if (check)
        return res.status(400).json({ msg: 'This email already exists' });

      const newUser = new Users({
        name,
        email,
        password,
      });

      await newUser.save();

      const refreshtoken = createRefreshToken({ id: user._id });

      res.cookie('refreshtoken', refreshtoken, {
        httpOnly: true,
        path: '/user/refreshtoken',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
      });

      res.json({ msg: 'Account has been activated' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of thelogin
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await Users.findOne({ email });
      if (!user) return res.status(400).json({ msg: 'User does not exist.' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ msg: 'Incorrect password.' });

      // If login success , create refresh token
      const access_token = createAccessToken({ id: user._id });

      res.json({ msg: 'Login success!', access_token });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the logout
  logout: async (req, res) => {
    try {
      res.clearCookie('refreshtoken', { path: '/user/refresh_token' });
      return res.json({ msg: 'Logged out' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the refresh token
  refreshToken: (req, res) => {
    try {
      const rf_token = req.cookies.refreshtoken;
      if (!rf_token)
        return res.status(400).json({ msg: 'Please Login or Register first' });

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err)
          return res.status(400).json({ msg: 'Please Login or Register' });

        const accesstoken = createAccessToken({ id: user.id });

        res.json({ accesstoken });
      });
    } catch (err) {
      return res
        .status(500)
        .json({ msg: err.message }, console.log('main eror'));
    }
  },

  // The section of the Get Access token
  getAccessToken: (req, res) => {
    try {
      const rf_token = req.cookies.refreshtoken;
      if (!rf_token)
        return res.status(400).json({ msg: 'Please Login or Register' });

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err)
          return res.status(400).json({ msg: 'Please Login or Register' });

        const access_token = createAccessToken({ id: user.id });

        res.json({ access_token });
      });
    } catch (err) {
      return res
        .status(500)
        .json({ msg: err.message }, console.log('main eror'));
    }
  },

  // The section of the forgot password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      const user = await Users.findOne({ email });
      if (!user)
        return res.status(400).json({ msg: 'This email does not exists.' });

      if (email === 'brightlayo11@gmail.com')
        return res
          .status(400)
          .json({
            msg: 'To change your password, register with your own email...Thanks',
          });

      const access_token = createAccessToken({ id: user._id });
      const url = `${CLIENT_URL}/user/reset/${access_token}`;

      passwordMail(email, url, 'Reset your password');
      res.json({ msg: 'please check your email to continue' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the reset password
  resetPassword: async (req, res) => {
    try {
      const { password } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);

      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          password: passwordHash,
        }
      );

      res.json({ msg: 'Password Changed successfully' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the update users
  updateUser: async (req, res) => {
    try {
      const { name, avatar } = req.body;
      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          name,
          avatar,
        }
      );

      res.json({ msg: 'Update Success' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the get single users
  getUser: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id).select('-password');
      // console.log(user)
      if (!user) return res.status(400).json({ msg: 'User does not exist.' });

      res.json(user);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section that gets all users
  getUsersAllInfor: async (req, res) => {
    try {
      const users = await Users.find().select('-password');

      res.json(users);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section adding to the cart
  addCart: async (req, res) => {
    try {
      const user = await Users.findById(req.user.id);
      if (!user) return res.status(400).json({ msg: 'User does not exist.' });

      await Users.findOneAndUpdate(
        { _id: req.user.id },
        {
          cart: req.body.cart,
        }
      );

      return res.json({ msg: 'Added to cart' });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the history
  history: async (req, res) => {
    try {
      const history = await Payments.find({ user_id: req.user.id });

      res.json(history);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section to delete a user
  deleteUser: async (req, res) => {
    try {
      await Users.findByIdAndDelete(req.params.id);

      res.json({ msg: 'Deleted Successfully' });
    } catch (err) {
      console.log('cannot delete');
    }
  },

  // The section of the google login
  googleLogin: async (req, res) => {
    try {
      const { tokenId } = req.body;

      const verify = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.MAILING_SERVICE_CLIENT_ID,
      });

      const { email_verified, email, name, picture } = verify.payload;

      const password = email + process.env.GOOGLE_SECRET;

      const passwordHash = await bcrypt.hash(password, 12);

      if (!email_verified)
        return res.status(400).json({ msg: 'Email verification failed' });

      const user = await Users.findOne({ email });

      if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return res.status(400).json({ msg: 'password is incorrect' });

        const refresh_token = createRefreshToken({ id: user._id });

        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        res.json({ msg: 'Login success!' });
      } else {
        const newUser = new Users({
          name,
          email,
          password: passwordHash,
          avatar: picture,
        });

        await newUser.save();

        const refresh_token = createRefreshToken({ id: newUser._id });
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7days
        });

        res.json({ msg: 'Login success!' });
      }
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  // The section of the facebook login
  facebookLogin: async (req, res) => {
    try {
      const { accessToken, userID } = req.body;

      const URL = `https://graph.facebook.com/v2.9/${userID}/?fields=id,name,email,picture&access_token=${accessToken}`;

      const data = await fetch(URL)
        .then((res) => res.json())
        .then((res) => {
          return res;
        });

      const { email, name, picture } = data;

      const password = email + process.env.FACEBOOK_SECRET;

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await Users.findOne({ email });

      if (user) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return res.status(400).json({ msg: 'Password is incorrect' });

        const refresh_token = createRefreshToken({ id: user._id });
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000, //7days
        });

        res.json({ msg: 'Login Success' });
      } else {
        const newUser = new Users({
          name,
          email,
          password: passwordHash,
          avatar: picture.data.url,
        });

        await newUser.save();

        const refresh_token = createRefreshToken({ id: user._id });
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000, //7days
        });

        res.json({ msg: 'Login Success' });
      }
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

const createActivationToken = (payload) => {
  return jwt.sign(payload, process.env.ACTIVATION_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

const createAccessToken = (user) => {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
};

const createRefreshToken = (user) => {
  return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

// The section validating the email address
function validateEmail(email) {
  const re =
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

module.exports = userCtrl;
