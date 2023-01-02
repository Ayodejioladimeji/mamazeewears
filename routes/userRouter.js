const router = require('express').Router();
const userCtrl = require('../controllers/userCtrl');
const auth = require('../middleware/auth');
const authAdmin = require('../middleware/authAdmin');

router.post('/register', userCtrl.register);

router.post('/activation', userCtrl.activateEmail);

router.post('/login', userCtrl.login);

router.post('/forgot', userCtrl.forgotPassword);

router.post('/reset', auth, userCtrl.resetPassword);

router.post('/refreshtoken', userCtrl.getAccessToken);

router.get('/logout', userCtrl.logout);

router.get('/refresh_token', userCtrl.refreshToken);

router.get('/infor', auth, userCtrl.getUser);

router.get('/all_infor', auth, authAdmin, userCtrl.getUsersAllInfor);

router.patch('/update', auth, userCtrl.updateUser);

router.patch('/addcart', auth, userCtrl.addCart);

router.get('/history', auth, userCtrl.history);

router.delete('/delete/:id', auth, authAdmin, userCtrl.deleteUser);

// The section of the social login
router.post('/google_login', userCtrl.googleLogin);
router.post('/facebook_login', userCtrl.facebookLogin);

module.exports = router;
